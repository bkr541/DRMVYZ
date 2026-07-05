import type { PreparedTrackInput } from '../../audio/runtimeTrack'
import type { ImportedTrackIntelligence, RekordboxLibrary } from './types'
import { parseRekordboxXmlFile } from './parseRekordboxXml'
import { matchFileToRekordboxTrack } from './matchTrack'
import { mapRekordboxMatchToDrmvyz } from './mapToDrmvyzAnalysis'
import { getNativeFilePath, selectNativeRekordboxUsbRoot } from './nativeBridge'

const AUDIO_EXT_RE = /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i
const XML_EXT_RE = /\.xml$/i
const PDB_RE = /(^|\/)PIONEER\/rekordbox\/export\.pdb$/i
const ANLZ_RE = /(^|\/)PIONEER\/USBANLZ\/.*\.(DAT|EXT|2EX)$/i
const MAX_SAFE_ANLZ_SCAN_COUNT = 250

interface FileSystemFileHandleLike {
  kind: 'file'
  name: string
  getFile(): Promise<File>
}

interface FileSystemDirectoryHandleLike {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandleLike>
  entries(): AsyncIterableIterator<[string, FileSystemFileHandleLike | FileSystemDirectoryHandleLike]>
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }) => Promise<FileSystemDirectoryHandleLike>
}

function relativePath(file: File): string {
  return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/')
}

function filenameWithoutExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || name
}

export interface RekordboxFolderImportResult {
  library: RekordboxLibrary | null
  audioFiles: File[]
  warnings: string[]
  detectedPdbFiles: number
  detectedAnlzFiles: number
}

export interface RekordboxUsbRootSelectionResult extends RekordboxFolderImportResult {
  cancelled: boolean
  scannedRootName?: string
  usedFileSystemAccessApi: boolean
  usedNativeBridge?: boolean
  scannedRootPath?: string
  parserMode?: string
}

export interface PreparedTrackInputOptions {
  /**
   * Explicit user intent: the loaded audio came from a Rekordbox-prepared USB.
   * When no XML match exists yet, DRMVYZ still tags the track as Rekordbox USB mode
   * instead of silently treating it as a generic local file.
   */
  forceUsbMode?: boolean
}

export async function importRekordboxXml(files: FileList | File[]): Promise<RekordboxLibrary> {
  const selected = Array.from(files)
  const xml = selected.find(file => XML_EXT_RE.test(file.name))
  if (!xml) throw new Error('Select a Rekordbox XML export file.')
  return parseRekordboxXmlFile(xml)
}

export async function importRekordboxFolder(files: FileList | File[]): Promise<RekordboxFolderImportResult> {
  const selected = Array.from(files)
  const audioFiles = selected.filter(file => file.type.startsWith('audio/') || AUDIO_EXT_RE.test(file.name))
  const xml = selected.find(file => XML_EXT_RE.test(file.name) && /rekordbox/i.test(file.name))
    ?? selected.find(file => XML_EXT_RE.test(file.name))
  const detectedPdbFiles = selected.filter(file => PDB_RE.test(relativePath(file))).length
  const detectedAnlzFiles = selected.filter(file => ANLZ_RE.test(relativePath(file))).length
  const warnings: string[] = []

  let library: RekordboxLibrary | null = null
  if (xml) {
    library = await parseRekordboxXmlFile(xml)
    library = {
      ...library,
      source: 'rekordbox_usb',
      stats: {
        ...library.stats,
        detectedPdbFiles,
        detectedAnlzFiles,
      },
      warnings: [...library.warnings],
    }
  } else if (detectedPdbFiles > 0) {
    warnings.push('Rekordbox export.pdb was detected, but this browser-safe importer currently needs a Rekordbox XML export to read cue points and metadata. ANLZ/export.pdb parsing should be implemented in an Electron/main-process bridge next.')
  } else {
    warnings.push('No Rekordbox XML export was found in the selected folder.')
  }

  if (audioFiles.length === 0) warnings.push('No audio files were found in the selected folder.')

  return { library, audioFiles, warnings, detectedPdbFiles, detectedAnlzFiles }
}

/**
 * Safe USB-root scan that uses the File System Access API when available.
 * This does not use <input webkitdirectory>, so the browser will not try to
 * upload or enumerate every audio/artifact file on the USB. It only probes the
 * Rekordbox metadata folders needed for status and optional XML hydration.
 */
export async function selectRekordboxUsbRoot(): Promise<RekordboxUsbRootSelectionResult> {
  const nativeResult = await selectNativeRekordboxUsbRoot()
  if (nativeResult) {
    return {
      library: nativeResult.library,
      audioFiles: [],
      warnings: nativeResult.warnings,
      detectedPdbFiles: nativeResult.detectedPdbFiles,
      detectedAnlzFiles: nativeResult.detectedAnlzFiles,
      cancelled: nativeResult.cancelled,
      scannedRootName: nativeResult.scannedRootName,
      scannedRootPath: nativeResult.scannedRootPath,
      usedFileSystemAccessApi: false,
      usedNativeBridge: true,
      parserMode: nativeResult.parserMode,
    }
  }

  const picker = (typeof window !== 'undefined'
    ? (window as DirectoryPickerWindow).showDirectoryPicker
    : undefined)

  if (!picker) {
    return {
      library: null,
      audioFiles: [],
      warnings: [
        'This browser does not expose a safe USB folder picker. USB Mode was armed instead; import RB XML to hydrate cue points, or use a native/Electron parser bridge for export.pdb/ANLZ.',
      ],
      detectedPdbFiles: 0,
      detectedAnlzFiles: 0,
      cancelled: false,
      usedFileSystemAccessApi: false,
      usedNativeBridge: false,
    }
  }

  let root: FileSystemDirectoryHandleLike
  try {
    root = await picker({ id: 'drmvyz-rekordbox-usb-root', mode: 'read' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        library: null,
        audioFiles: [],
        warnings: [],
        detectedPdbFiles: 0,
        detectedAnlzFiles: 0,
        cancelled: true,
        usedFileSystemAccessApi: true,
        usedNativeBridge: false,
      }
    }
    throw err
  }

  const warnings: string[] = []
  const rekordboxDir = await getNestedDirectory(root, ['PIONEER', 'rekordbox'])
  const usbAnlzDir = await getNestedDirectory(root, ['PIONEER', 'USBANLZ'])

  let detectedPdbFiles = 0
  let detectedAnlzFiles = 0
  let library: RekordboxLibrary | null = null

  if (rekordboxDir) {
    const xml = await findFirstXmlFile(rekordboxDir)
    detectedPdbFiles = await countImmediateFiles(rekordboxDir, name => /^export\.pdb$/i.test(name))
    if (xml) {
      library = await parseRekordboxXmlFile(xml)
      library = {
        ...library,
        source: 'rekordbox_usb',
        stats: {
          ...library.stats,
          detectedPdbFiles,
          detectedAnlzFiles: 0,
        },
        warnings: [...library.warnings],
      }
    }
  }

  if (usbAnlzDir) {
    const count = await countNestedFiles(
      usbAnlzDir,
      name => /\.(DAT|EXT|2EX)$/i.test(name),
      MAX_SAFE_ANLZ_SCAN_COUNT,
    )
    detectedAnlzFiles = count.count
    if (count.capped) {
      warnings.push(`ANLZ metadata was detected; scan stopped after ${MAX_SAFE_ANLZ_SCAN_COUNT} files to avoid heavy USB enumeration.`)
    }
  }

  if (library) {
    library = {
      ...library,
      stats: {
        ...library.stats,
        detectedPdbFiles,
        detectedAnlzFiles,
      },
    }
  } else if (detectedPdbFiles > 0 || detectedAnlzFiles > 0) {
    warnings.push('Rekordbox USB metadata was detected. DRMVYZ can mark loaded tracks as USB-sourced now, but direct export.pdb/ANLZ cue parsing still needs the native parser bridge.')
  } else {
    warnings.push('No Rekordbox USB metadata was found under /PIONEER/rekordbox or /PIONEER/USBANLZ. USB Mode was armed so the next loaded track is still marked as USB-sourced if you confirm it.')
  }

  return {
    library,
    audioFiles: [],
    warnings,
    detectedPdbFiles,
    detectedAnlzFiles,
    cancelled: false,
    scannedRootName: root.name,
    usedFileSystemAccessApi: true,
    usedNativeBridge: false,
  }
}

async function getNestedDirectory(
  root: FileSystemDirectoryHandleLike,
  path: string[],
): Promise<FileSystemDirectoryHandleLike | null> {
  let current = root
  for (const segment of path) {
    try {
      current = await current.getDirectoryHandle(segment)
    } catch {
      return null
    }
  }
  return current
}

async function findFirstXmlFile(dir: FileSystemDirectoryHandleLike): Promise<File | null> {
  let fallback: FileSystemFileHandleLike | null = null
  for await (const [, handle] of dir.entries()) {
    if (handle.kind !== 'file' || !XML_EXT_RE.test(handle.name)) continue
    if (/rekordbox/i.test(handle.name)) return handle.getFile()
    fallback ??= handle
  }
  return fallback ? fallback.getFile() : null
}

async function countImmediateFiles(
  dir: FileSystemDirectoryHandleLike,
  predicate: (name: string) => boolean,
): Promise<number> {
  let count = 0
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === 'file' && predicate(handle.name)) count += 1
  }
  return count
}

async function countNestedFiles(
  dir: FileSystemDirectoryHandleLike,
  predicate: (name: string) => boolean,
  cap: number,
): Promise<{ count: number; capped: boolean }> {
  let count = 0
  let capped = false

  async function visit(current: FileSystemDirectoryHandleLike): Promise<void> {
    for await (const [, handle] of current.entries()) {
      if (count >= cap) {
        capped = true
        return
      }
      if (handle.kind === 'file') {
        if (predicate(handle.name)) count += 1
      } else {
        await visit(handle)
        if (capped) return
      }
    }
  }

  await visit(dir)
  return { count, capped }
}

export function createPreparedTrackInputs(
  files: File[],
  library: RekordboxLibrary | null,
  options: PreparedTrackInputOptions = {},
): PreparedTrackInput[] {
  return files.map(file => {
    const match = matchFileToRekordboxTrack(file, library)
    return {
      file,
      imported: match && library
        ? mapRekordboxMatchToDrmvyz(match, library)
        : options.forceUsbMode ? createUsbModeFallback(file, library) : undefined,
    }
  })
}

function createUsbModeFallback(file: File, library: RekordboxLibrary | null): ImportedTrackIntelligence {
  const importedAt = new Date().toISOString()
  const warning = library
    ? 'Track was loaded in Rekordbox USB Mode, but it did not match the imported Rekordbox XML library. Cue points were not hydrated.'
    : 'Track was loaded in Rekordbox USB Mode. Direct export.pdb/ANLZ parsing is not implemented yet, so cue points require RB XML or the native parser bridge.'

  return {
    source: 'rekordbox_usb',
    metadata: {
      source: 'rekordbox_usb',
      sourceLibraryId: library?.id ?? 'manual-usb-mode',
      sourceTrackId: null,
      sourcePath: getNativeFilePath(file) ?? relativePath(file),
      title: filenameWithoutExtension(file.name),
      artist: null,
      importedAt,
      warnings: [warning],
    },
    cueMarkers: [],
    cueRegions: [],
    analysisSeed: {
      source: 'rekordbox_usb',
    },
    matchConfidence: 0.1,
    matchReason: library ? 'usb-mode-unmatched' : 'usb-mode-manual-confirmation',
    warnings: [warning],
  }
}

export function summarizeRekordboxLibrary(library: RekordboxLibrary): string {
  const parts = [
    `${library.stats.totalTracks} tracks`,
    `${library.stats.tracksWithCues} with cues`,
    `${library.stats.cues} cue markers`,
  ]
  if (library.stats.loops > 0) parts.push(`${library.stats.loops} loops`)
  if (library.stats.detectedPdbFiles > 0) parts.push(`${library.stats.detectedPdbFiles} export.pdb`)
  if (library.stats.detectedAnlzFiles > 0) parts.push(`${library.stats.detectedAnlzFiles} ANLZ files`)
  if (library.stats.tracksWithBeatGrids && library.stats.tracksWithBeatGrids > 0) {
    parts.push(`${library.stats.tracksWithBeatGrids} beat grids`)
  }
  return parts.join(' · ')
}
