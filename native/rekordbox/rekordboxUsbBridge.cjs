'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const {
  parsePssiTag,
  alignRekordboxPhrases,
  mergeRekordboxPhrases,
  mergePssiIntegrity,
} = require('./rekordboxPssi.cjs')

const AUDIO_EXT_RE = /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i
const ANLZ_EXT_RE = /\.(DAT|EXT|2EX)$/i
const MAX_NATIVE_ANLZ_FILES = 50000

// Matches the same removable-media mount-point shapes the renderer uses to guess
// a USB root from a loaded file's path (see guessNativeUsbRootFromFile in
// src/features/rekordboxImport/nativeBridge.ts). The select-usb-root-and-parse
// handler only ever receives a path the user picked via the native OS folder
// dialog, so it's inherently authorized. scan-usb-root instead takes a path
// string supplied directly by renderer JS, so it gets checked against this
// pattern before the main process reads anything from disk on its behalf.
const REMOVABLE_ROOT_RE = new RegExp(
  [
    '^/Volumes/[^/]+/?$', // macOS
    '^[A-Za-z]:[\\\\/]?$', // Windows drive root
    '^/(?:media|mnt)/[^/]+(?:/[^/]+)?/?$', // Linux
    '^/run/media/[^/]+/[^/]+/?$', // Linux (systemd-managed mounts)
  ].join('|'),
)

function isPlausibleRemovableRoot(rootPath) {
  return REMOVABLE_ROOT_RE.test(path.resolve(String(rootPath || '')))
}

function installRekordboxUsbBridge({ ipcMain, dialog, BrowserWindow }) {
  if (!ipcMain || !dialog) throw new Error('installRekordboxUsbBridge requires Electron ipcMain and dialog.')

  ipcMain.handle('drmvyz:rekordbox:select-usb-root-and-parse', async event => {
    const owner = BrowserWindow?.fromWebContents?.(event.sender)
    const result = await dialog.showOpenDialog(owner, {
      title: 'Select Rekordbox USB root',
      properties: ['openDirectory'],
      message: 'Select the USB root containing /PIONEER/rekordbox/export.pdb and /PIONEER/USBANLZ.',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return emptyResult({ cancelled: true })
    }

    return scanRekordboxUsbRoot(result.filePaths[0])
  })

  ipcMain.handle('drmvyz:rekordbox:scan-usb-root', async (_event, rootPath) => {
    if (!isPlausibleRemovableRoot(rootPath)) {
      return emptyResult({
        warnings: ['The requested path does not look like a removable-media mount point and was not scanned.'],
      })
    }
    return scanRekordboxUsbRoot(rootPath)
  })
}

async function scanRekordboxUsbRoot(rootPath) {
  const normalizedRoot = path.resolve(String(rootPath || ''))
  const rootName = path.basename(normalizedRoot)
  const warnings = []

  const rekordboxDir = path.join(normalizedRoot, 'PIONEER', 'rekordbox')
  const exportPdb = path.join(rekordboxDir, 'export.pdb')
  const usbAnlzDir = path.join(normalizedRoot, 'PIONEER', 'USBANLZ')

  const detectedPdbFiles = await fileExists(exportPdb) ? 1 : 0
  const anlzFiles = await listFiles(usbAnlzDir, file => ANLZ_EXT_RE.test(file), MAX_NATIVE_ANLZ_FILES)
  if (anlzFiles.capped) warnings.push(`ANLZ scan stopped after ${MAX_NATIVE_ANLZ_FILES.toLocaleString()} metadata files.`)

  let parserMode = 'anlz-lite'
  let tracks = []

  const anlzLibrary = await parseAnlzLibrary(anlzFiles.files, normalizedRoot, warnings)
  tracks = anlzLibrary.tracks

  if (detectedPdbFiles > 0) {
    const pdbResult = await parsePdbIfParserAvailable(exportPdb, warnings)
    if (pdbResult.tracks.length > 0) {
      tracks = mergePdbAndAnlzTracks(pdbResult.tracks, tracks)
      parserMode = anlzLibrary.tracks.length > 0 ? 'hybrid' : 'rekordbox-parser'
    } else if (!pdbResult.available) {
      warnings.push('export.pdb was found, but the optional rekordbox-parser module is not installed. DRMVYZ parsed ANLZ cue and beat-grid files directly instead.')
    }
  }

  const stats = buildStats(tracks, detectedPdbFiles, anlzFiles.files.length)
  if (detectedPdbFiles === 0) warnings.push('No /PIONEER/rekordbox/export.pdb file was found on the selected USB root.')
  if (anlzFiles.files.length === 0) warnings.push('No /PIONEER/USBANLZ/*.DAT, *.EXT, or *.2EX analysis files were found.')
  if (tracks.length === 0) warnings.push('No usable Rekordbox tracks could be parsed from this USB. Confirm this is the root of a Rekordbox-prepared USB.')

  return {
    cancelled: false,
    library: {
      id: `rekordbox-usb-native:${hash(normalizedRoot)}:${Date.now()}`,
      source: 'rekordbox_usb',
      importedAt: new Date().toISOString(),
      tracks,
      warnings,
      stats,
    },
    warnings,
    detectedPdbFiles,
    detectedAnlzFiles: anlzFiles.files.length,
    scannedRootName: rootName,
    scannedRootPath: normalizedRoot,
    parserMode,
  }
}

async function parseAnlzLibrary(files, rootPath, warnings) {
  const byAudioPath = new Map()
  for (const filePath of files) {
    try {
      const parsed = parseAnlzBuffer(await fs.readFile(filePath), filePath)
      const location = normalizeDevicePath(parsed.audioPath || parsed.pathTag || '') || null
      const stablePath = location || normalizeDevicePath(filePath)
      const key = normalizeMatchKey(stablePath)
      const existing = byAudioPath.get(key) || makeTrackFromPath(stablePath, filePath)
      existing.cues = mergeCues(existing.cues || [], parsed.cues || [])
      existing.beatGrid = mergeBeatGrid(existing.beatGrid || [], parsed.beatGrid || [])
      existing.phrases = alignRekordboxPhrases(
        mergeRekordboxPhrases(existing.phrases || [], parsed.phrases || []),
        existing.beatGrid,
      )
      existing.pssiIntegrity = mergePssiIntegrity(existing.pssiIntegrity, parsed.pssiIntegrity)
      for (const warning of parsed.warnings || []) warnings.push(`${path.basename(filePath)}: ${warning}`)
      existing.downbeats = (existing.beatGrid || []).filter(beat => beat.isDownbeat)
      existing.beatGridOffsetSec = existing.beatGrid?.[0]?.timeSec ?? existing.beatGridOffsetSec ?? null
      existing.bpm = existing.bpm || inferBpmFromBeatGrid(existing.beatGrid || [])
      existing.durationSec = Math.max(existing.durationSec || 0, parsed.durationSec || 0) || null
      existing.location = location || existing.location
      existing.analysisFilePaths = Array.from(new Set([...(existing.analysisFilePaths || []), normalizeDevicePath(filePath)]))
      byAudioPath.set(key, existing)
    } catch (err) {
      warnings.push(`Skipped ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { tracks: Array.from(byAudioPath.values()) }
}

function parseAnlzBuffer(buffer, filePath) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'PMAI') {
    throw new Error('not a Rekordbox ANLZ PMAI file')
  }

  const headerLen = safeReadU32BE(buffer, 4) || 0x1c
  const result = {
    audioPath: null,
    pathTag: null,
    beatGrid: [],
    cues: [],
    phrases: [],
    pssiIntegrity: null,
    warnings: [],
    durationSec: null,
  }

  const cueBuckets = { extended: [], legacy: [] }
  let offset = Math.max(12, Math.min(headerLen, buffer.length))
  while (offset + 12 <= buffer.length) {
    const fourcc = buffer.toString('ascii', offset, offset + 4)
    const tagLen = safeReadU32BE(buffer, offset + 8)
    if (!tagLen || tagLen < 12 || offset + tagLen > buffer.length) {
      offset += 1
      continue
    }

    if (fourcc === 'PPTH') {
      const len = safeReadU32BE(buffer, offset + 0x0c)
      result.pathTag = decodeUtf16Be(buffer, offset + 0x10, Math.max(0, Math.min(len, tagLen - 0x10)))
      result.audioPath = result.pathTag
    } else if (fourcc === 'PQTZ') {
      result.beatGrid = parseBeatGridTag(buffer, offset, tagLen)
      const last = result.beatGrid[result.beatGrid.length - 1]
      if (last) result.durationSec = Math.max(result.durationSec || 0, last.timeSec)
    } else if (fourcc === 'PCO2') {
      cueBuckets.extended.push(...parseExtendedCueTag(buffer, offset, tagLen, filePath))
    } else if (fourcc === 'PCOB') {
      cueBuckets.legacy.push(...parseLegacyCueTag(buffer, offset, tagLen, filePath))
    } else if (fourcc === 'PSSI') {
      const pssi = parsePssiTag(buffer, offset, tagLen)
      result.phrases.push(...pssi.phrases)
      result.pssiIntegrity = mergePssiIntegrity(result.pssiIntegrity, pssi.integrity)
      result.warnings.push(...pssi.warnings)
    }

    offset += tagLen
  }

  result.cues = dedupeCues(cueBuckets.extended.length > 0 ? cueBuckets.extended : cueBuckets.legacy)
  result.phrases = alignRekordboxPhrases(result.phrases, result.beatGrid)
  const lastCue = result.cues.reduce((max, cue) => Math.max(max, cue.endSec || cue.startSec || 0), 0)
  result.durationSec = Math.max(result.durationSec || 0, lastCue) || null
  return result
}

function parseBeatGridTag(buffer, tagStart, tagLen) {
  const count = safeReadU32BE(buffer, tagStart + 0x14)
  const beats = []
  if (!count || count < 0 || count > 200000) return beats
  let entry = tagStart + 0x18
  for (let i = 0; i < count && entry + 8 <= tagStart + tagLen; i++, entry += 8) {
    const beatNumber = safeReadU16BE(buffer, entry)
    const tempoRaw = safeReadU16BE(buffer, entry + 2)
    const timeMs = safeReadU32BE(buffer, entry + 4)
    if (timeMs == null || tempoRaw == null) continue
    beats.push({
      timeSec: timeMs / 1000,
      confidence: 0.98,
      isDownbeat: beatNumber === 1,
      bpm: tempoRaw > 0 ? tempoRaw / 100 : undefined,
    })
  }
  return beats
}

function parseLegacyCueTag(buffer, tagStart, tagLen, filePath) {
  const listType = safeReadU32BE(buffer, tagStart + 0x0c) || 0
  const count = safeReadU16BE(buffer, tagStart + 0x12) || 0
  const cues = []
  let offset = tagStart + 0x18
  for (let i = 0; i < count && offset + 0x38 <= tagStart + tagLen; i++) {
    if (buffer.toString('ascii', offset, offset + 4) !== 'PCPT') break
    const entryLen = safeReadU32BE(buffer, offset + 8) || 0x38
    const hotCue = safeReadU32BE(buffer, offset + 0x0c) || 0
    const cueType = safeReadU8(buffer, offset + 0x1c) || 1
    const timeMs = safeReadU32BE(buffer, offset + 0x20) || 0
    const loopMs = safeReadU32BE(buffer, offset + 0x24) || 0
    const isLoop = cueType === 2 && loopMs > timeMs
    const kind = isLoop ? 'loop' : (listType === 1 || hotCue > 0 ? 'hot_cue' : 'memory_cue')
    cues.push({
      id: `anlz:${hash(filePath)}:pcob:${listType}:${hotCue || i}:${timeMs}`,
      trackId: '',
      name: null,
      startSec: timeMs / 1000,
      endSec: isLoop ? loopMs / 1000 : null,
      kind,
      slot: hotCue > 0 ? hotCueSlot(hotCue) : null,
      color: null,
    })
    offset += Math.max(0x38, entryLen)
  }
  return cues
}

function parseExtendedCueTag(buffer, tagStart, tagLen, filePath) {
  const listType = safeReadU32BE(buffer, tagStart + 0x0c) || 0
  const count = safeReadU16BE(buffer, tagStart + 0x10) || 0
  const cues = []
  let offset = tagStart + 0x14
  for (let i = 0; i < count && offset + 0x20 <= tagStart + tagLen; i++) {
    if (buffer.toString('ascii', offset, offset + 4) !== 'PCP2') break
    const entryLen = safeReadU32BE(buffer, offset + 8) || 0
    if (entryLen < 0x20 || offset + entryLen > tagStart + tagLen) break

    const hotCue = safeReadU32BE(buffer, offset + 0x0c) || 0
    const cueType = safeReadU8(buffer, offset + 0x10) || 1
    const timeMs = safeReadU32BE(buffer, offset + 0x14) || 0
    const loopMs = safeReadU32BE(buffer, offset + 0x18) || 0
    const commentLen = safeReadU32BE(buffer, offset + 0x28) || 0
    const comment = commentLen > 0 && offset + 0x2c + commentLen <= offset + entryLen
      ? decodeUtf16Be(buffer, offset + 0x2c, commentLen)
      : null
    const colorOffset = offset + 0x2c + Math.max(0, commentLen)
    const color = colorOffset + 4 <= offset + entryLen
      ? rgbToHex(safeReadU8(buffer, colorOffset + 1), safeReadU8(buffer, colorOffset + 2), safeReadU8(buffer, colorOffset + 3))
      : null
    const isLoop = cueType === 2 && loopMs > timeMs
    const kind = isLoop ? 'loop' : (listType === 1 || hotCue > 0 ? 'hot_cue' : 'memory_cue')
    cues.push({
      id: `anlz:${hash(filePath)}:pco2:${listType}:${hotCue || i}:${timeMs}`,
      trackId: '',
      name: comment || null,
      startSec: timeMs / 1000,
      endSec: isLoop ? loopMs / 1000 : null,
      kind,
      slot: hotCue > 0 ? hotCueSlot(hotCue) : null,
      color,
    })
    offset += entryLen
  }
  return cues
}

async function parsePdbIfParserAvailable(exportPdbPath, warnings) {
  let parser
  try {
    parser = require('rekordbox-parser')
  } catch {
    return { available: false, tracks: [] }
  }

  try {
    const db = parser.parsePdb(await fs.readFile(exportPdbPath))
    const pageType = parser.RekordboxPdb?.PageType || {}
    const tracksTable = (db.tables || []).find(table => table.type === pageType.TRACKS)
      || (db.tables || []).find(table => table.rows?.some?.(row => row.filePath || row.filename || row.title))
    if (!tracksTable) {
      warnings.push('rekordbox-parser opened export.pdb, but no track table was found.')
      return { available: true, tracks: [] }
    }

    const rows = rowsForTable(tracksTable, parser)
    const lookups = buildPdbLookups(db, parser)
    return {
      available: true,
      tracks: rows.map(row => pdbRowToTrack(row, lookups)).filter(Boolean),
    }
  } catch (err) {
    warnings.push(`export.pdb parser failed: ${err instanceof Error ? err.message : String(err)}`)
    return { available: true, tracks: [] }
  }
}

function rowsForTable(table, parser) {
  if (!table) return []
  return typeof parser.tableRows === 'function'
    ? Array.from(parser.tableRows(table))
    : Array.from(table.rows || [])
}

function buildPdbLookups(db, parser) {
  const pageType = parser.RekordboxPdb?.PageType || {}
  const tablesByType = new Map((db.tables || []).map(table => [table.type, table]))
  const lookupFor = type => {
    const map = new Map()
    for (const row of rowsForTable(tablesByType.get(type), parser)) {
      if (row && row.id != null) map.set(row.id, rowText(row))
    }
    return map
  }

  return {
    artists: lookupFor(pageType.ARTISTS),
    albums: lookupFor(pageType.ALBUMS),
    genres: lookupFor(pageType.GENRES),
    labels: lookupFor(pageType.LABELS),
    keys: lookupFor(pageType.KEYS),
    colors: lookupFor(pageType.COLORS),
  }
}

function lookupText(map, id) {
  if (!map || id == null || id === 0) return null
  return map.get(id) || null
}

function pdbRowToTrack(row, lookups) {
  const filePath = textOf(row.filePath) || textOf(row.path) || textOf(row.location) || null
  const filename = textOf(row.filename) || (filePath ? path.basename(filePath) : null)
  const title = textOf(row.title) || textOf(row.name) || filenameWithoutExtension(filename || '')
  if (!title && !filename && !filePath) return null
  const tempo = typeof row.tempo === 'number' ? row.tempo / 100 : null
  const track = {
    trackId: String(row.id ?? hash(filePath || filename || title)),
    name: title || filenameWithoutExtension(filename || 'Rekordbox Track'),
    artist: textOf(row.artist) || lookupText(lookups.artists, row.artistId),
    album: textOf(row.album) || lookupText(lookups.albums, row.albumId),
    genre: textOf(row.genre) || lookupText(lookups.genres, row.genreId),
    label: textOf(row.label) || lookupText(lookups.labels, row.labelId),
    comments: textOf(row.comment) || null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    color: textOf(row.color) || lookupText(lookups.colors, row.colorId),
    bpm: Number.isFinite(tempo) && tempo > 0 ? tempo : null,
    key: textOf(row.key) || lookupText(lookups.keys, row.keyId),
    durationSec: typeof row.duration === 'number' ? row.duration : null,
    location: normalizeDevicePath(filePath || filename || ''),
    filename,
    cues: [],
    phrases: [],
    pssiIntegrity: null,
    beatGrid: [],
    downbeats: [],
    beatGridOffsetSec: null,
  }
  return track
}

function mergePdbAndAnlzTracks(pdbTracks, anlzTracks) {
  const output = []
  const usedAnlz = new Set()
  for (const pdb of pdbTracks) {
    const match = findBestTrackMatch(pdb, anlzTracks, usedAnlz)
    if (match) {
      usedAnlz.add(match.trackId)
      const beatGrid = match.beatGrid || pdb.beatGrid || []
      output.push({
        ...pdb,
        cues: mergeCues(pdb.cues || [], match.cues || []).map(cue => ({ ...cue, trackId: pdb.trackId })),
        phrases: alignRekordboxPhrases(
          mergeRekordboxPhrases(pdb.phrases || [], match.phrases || []),
          beatGrid,
        ),
        pssiIntegrity: match.pssiIntegrity ?? pdb.pssiIntegrity ?? null,
        beatGrid,
        downbeats: match.downbeats || pdb.downbeats || [],
        beatGridOffsetSec: match.beatGridOffsetSec ?? pdb.beatGridOffsetSec ?? null,
        bpm: pdb.bpm || match.bpm || null,
        durationSec: pdb.durationSec || match.durationSec || null,
        analysisFilePaths: match.analysisFilePaths || [],
      })
    } else {
      output.push(pdb)
    }
  }
  for (const anlz of anlzTracks) {
    if (!usedAnlz.has(anlz.trackId)) output.push(anlz)
  }
  return output.map(track => ({
    ...track,
    cues: (track.cues || []).map(cue => ({ ...cue, trackId: track.trackId })),
    phrases: alignRekordboxPhrases(track.phrases || [], track.beatGrid || []),
  }))
}

function findBestTrackMatch(target, candidates, usedIds) {
  const targetPath = normalizeMatchKey(target.location || '')
  const targetName = normalizeMatchKey(target.filename || target.name || '')
  let best = null
  for (const candidate of candidates) {
    if (usedIds.has(candidate.trackId)) continue
    const candidatePath = normalizeMatchKey(candidate.location || '')
    const candidateName = normalizeMatchKey(candidate.filename || candidate.name || '')
    let score = 0
    if (targetPath && candidatePath && (targetPath.endsWith(candidatePath) || candidatePath.endsWith(targetPath))) score = 0.98
    else if (targetName && candidateName && targetName === candidateName) score = 0.85
    else if (targetName && candidatePath.endsWith(targetName)) score = 0.76
    if (!best || score > best.score) best = { score, ...candidate }
  }
  return best && best.score >= 0.7 ? best : null
}

function makeTrackFromPath(audioPath, anlzPath) {
  const filename = path.basename(audioPath || anlzPath)
  const trackId = `anlz-${hash(audioPath || anlzPath)}`
  return {
    trackId,
    name: filenameWithoutExtension(filename),
    artist: null,
    album: null,
    genre: null,
    label: null,
    comments: null,
    rating: null,
    color: null,
    bpm: null,
    key: null,
    durationSec: null,
    location: normalizeDevicePath(audioPath || ''),
    filename,
    cues: [],
    phrases: [],
    pssiIntegrity: null,
    beatGrid: [],
    downbeats: [],
    beatGridOffsetSec: null,
    analysisFilePaths: [normalizeDevicePath(anlzPath)],
  }
}

function buildStats(tracks, detectedPdbFiles, detectedAnlzFiles) {
  const cues = tracks.reduce((sum, track) => sum + (track.cues || []).filter(cue => cue.kind !== 'loop').length, 0)
  const loops = tracks.reduce((sum, track) => sum + (track.cues || []).filter(cue => cue.kind === 'loop').length, 0)
  const beatGridBeats = tracks.reduce((sum, track) => sum + (track.beatGrid || []).length, 0)
  return {
    totalTracks: tracks.length,
    tracksWithCues: tracks.filter(track => (track.cues || []).length > 0).length,
    cues,
    loops,
    detectedPdbFiles,
    detectedAnlzFiles,
    tracksWithBeatGrids: tracks.filter(track => (track.beatGrid || []).length > 0).length,
    beatGridBeats,
  }
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function listFiles(root, predicate, cap) {
  const files = []
  let capped = false
  async function visit(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (files.length >= cap) { capped = true; return }
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile() && predicate(full)) files.push(full)
      if (capped) return
    }
  }
  await visit(root)
  return { files, capped }
}

function normalizeDevicePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\u0000/g, '').trim()
}

function normalizeMatchKey(value) {
  return normalizeDevicePath(value).toLowerCase()
}

function filenameWithoutExtension(name) {
  return String(name || '').replace(/\.[^.]+$/, '').trim() || 'Rekordbox Track'
}

function mergeCues(a, b) {
  const map = new Map()
  for (const cue of [...a, ...b]) {
    const key = `${cue.kind}:${cue.slot || ''}:${Math.round((cue.startSec || 0) * 1000)}:${Math.round((cue.endSec || 0) * 1000)}`
    map.set(key, cue)
  }
  return Array.from(map.values()).sort((x, y) => x.startSec - y.startSec)
}

function mergeBeatGrid(a, b) {
  const selected = b.length >= a.length ? b : a
  return selected.slice().sort((x, y) => x.timeSec - y.timeSec)
}

function dedupeCues(cues) {
  return mergeCues([], cues).filter(cue => Number.isFinite(cue.startSec) && cue.startSec >= 0)
}

function inferBpmFromBeatGrid(beats) {
  const bpms = beats.map(beat => beat.bpm).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0)
  if (bpms.length > 0) return Math.round(bpms[0] * 100) / 100
  if (beats.length < 2) return null
  const deltas = []
  for (let i = 1; i < Math.min(beats.length, 32); i++) deltas.push(beats[i].timeSec - beats[i - 1].timeSec)
  const avg = deltas.reduce((sum, v) => sum + v, 0) / deltas.length
  return avg > 0 ? Math.round((60 / avg) * 100) / 100 : null
}

function hotCueSlot(value) {
  const index = Math.max(1, Number(value || 1)) - 1
  return String.fromCharCode('A'.charCodeAt(0) + index)
}

function rgbToHex(r, g, b) {
  if (![r, g, b].every(v => typeof v === 'number' && v > 0)) return null
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
}

function decodeUtf16Be(buffer, start, length) {
  const end = Math.min(buffer.length, start + Math.max(0, length))
  if (end <= start) return ''
  const swapped = Buffer.alloc(end - start)
  for (let i = start; i + 1 < end; i += 2) {
    swapped[i - start] = buffer[i + 1]
    swapped[i - start + 1] = buffer[i]
  }
  return swapped.toString('utf16le').replace(/\u0000+$/g, '').trim()
}

function rowText(row) {
  return textOf(row.name) || textOf(row.title) || textOf(row.value) || textOf(row.body) || null
}

function textOf(value) {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value.body?.text === 'string') return value.body.text
  if (typeof value.text === 'string') return value.text
  if (typeof value.body === 'string') return value.body
  return null
}

function safeReadU8(buffer, offset) {
  return offset >= 0 && offset < buffer.length ? buffer.readUInt8(offset) : null
}

function safeReadU16BE(buffer, offset) {
  return offset >= 0 && offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : null
}

function safeReadU32BE(buffer, offset) {
  return offset >= 0 && offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : null
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12)
}

function emptyResult(overrides = {}) {
  return {
    cancelled: false,
    library: null,
    warnings: [],
    detectedPdbFiles: 0,
    detectedAnlzFiles: 0,
    parserMode: 'unavailable',
    ...overrides,
  }
}

module.exports = {
  installRekordboxUsbBridge,
  scanRekordboxUsbRoot,
  parseAnlzBuffer,
  isPlausibleRemovableRoot,
}
