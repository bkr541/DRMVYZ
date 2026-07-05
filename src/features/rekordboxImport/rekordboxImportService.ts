import type { PreparedTrackInput } from '../../audio/runtimeTrack'
import type { RekordboxLibrary } from './types'
import { parseRekordboxXmlFile } from './parseRekordboxXml'
import { matchFileToRekordboxTrack } from './matchTrack'
import { mapRekordboxMatchToDrmvyz } from './mapToDrmvyzAnalysis'

const AUDIO_EXT_RE = /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i
const XML_EXT_RE = /\.xml$/i
const PDB_RE = /(^|\/)PIONEER\/rekordbox\/export\.pdb$/i
const ANLZ_RE = /(^|\/)PIONEER\/USBANLZ\/.*\.(DAT|EXT|2EX)$/i

function relativePath(file: File): string {
  return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/')
}

export interface RekordboxFolderImportResult {
  library: RekordboxLibrary | null
  audioFiles: File[]
  warnings: string[]
  detectedPdbFiles: number
  detectedAnlzFiles: number
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

export function createPreparedTrackInputs(files: File[], library: RekordboxLibrary | null): PreparedTrackInput[] {
  return files.map(file => {
    const match = matchFileToRekordboxTrack(file, library)
    return {
      file,
      imported: match && library ? mapRekordboxMatchToDrmvyz(match, library) : undefined,
    }
  })
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
  return parts.join(' · ')
}
