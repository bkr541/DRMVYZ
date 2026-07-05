import type { RekordboxCuePoint, RekordboxLibrary, RekordboxTrackMetadata } from './types'

function attr(el: Element, name: string): string | null {
  return el.getAttribute(name) ?? el.getAttribute(name.toLowerCase()) ?? null
}

function parseNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function decodeLocation(location: string | null): string | null {
  if (!location) return null
  try {
    const withoutPrefix = location.replace(/^file:\/\//i, '')
    return decodeURIComponent(withoutPrefix).replace(/\\/g, '/')
  } catch {
    return location.replace(/^file:\/\//i, '').replace(/\\/g, '/')
  }
}

function basename(path: string | null | undefined): string | null {
  if (!path) return null
  const clean = path.replace(/\\/g, '/')
  const parts = clean.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1]! : clean
}

function normalizeColor(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`
  const lower = trimmed.toLowerCase()
  const named: Record<string, string> = {
    red: '#ff4f5f', orange: '#ff9f3d', yellow: '#ffd84d', green: '#36f08a',
    aqua: '#45e3ff', blue: '#4b8dff', purple: '#b875ff', pink: '#ff66c4',
  }
  return named[lower] ?? null
}

function cueKind(type: string | null, hasEnd: boolean): RekordboxCuePoint['kind'] {
  const normalized = (type ?? '').trim().toLowerCase()
  if (hasEnd || normalized.includes('loop')) return 'loop'
  if (normalized === '0' || normalized.includes('memory')) return 'memory_cue'
  if (normalized === '1' || normalized.includes('hot')) return 'hot_cue'
  return 'marker'
}

function parseCue(trackId: string, el: Element, index: number): RekordboxCuePoint | null {
  const start = parseNumber(attr(el, 'Start') ?? attr(el, 'StartSec') ?? attr(el, 'start'))
  if (start == null || start < 0) return null

  const end = parseNumber(attr(el, 'End') ?? attr(el, 'EndSec') ?? attr(el, 'end'))
  const hotCueNum = attr(el, 'Num') ?? attr(el, 'HotCue') ?? attr(el, 'slot')
  const type = attr(el, 'Type') ?? attr(el, 'Kind')
  const kind = cueKind(type, end != null && end > start)
  const name = attr(el, 'Name') ?? attr(el, 'Label') ?? null
  const labelBase = name?.trim() || (kind === 'hot_cue' ? `Hot Cue ${hotCueNum ?? index + 1}` : kind === 'memory_cue' ? 'Memory Cue' : kind === 'loop' ? 'Loop' : 'Marker')

  return {
    id: `${trackId}:${kind}:${hotCueNum ?? index}:${start.toFixed(3)}`,
    trackId,
    name: labelBase,
    startSec: start,
    endSec: end != null && end > start ? end : null,
    kind,
    slot: hotCueNum,
    color: normalizeColor(attr(el, 'Color') ?? attr(el, 'Colour')),
  }
}

function parseTrack(el: Element): RekordboxTrackMetadata | null {
  const trackId = attr(el, 'TrackID') ?? attr(el, 'TrackId') ?? attr(el, 'ID')
  const name = attr(el, 'Name') ?? attr(el, 'Title')
  if (!trackId || !name) return null

  const location = decodeLocation(attr(el, 'Location'))
  const duration = parseNumber(attr(el, 'TotalTime') ?? attr(el, 'Duration'))
  const bpm = parseNumber(attr(el, 'AverageBpm') ?? attr(el, 'BPM') ?? attr(el, 'Tempo'))
  const cues = Array.from(el.querySelectorAll('POSITION_MARK, position_mark, CUE, Cue'))
    .map((cue, index) => parseCue(trackId, cue, index))
    .filter((cue): cue is RekordboxCuePoint => cue != null)
    .sort((a, b) => a.startSec - b.startSec)

  return {
    trackId,
    name,
    artist: attr(el, 'Artist'),
    album: attr(el, 'Album'),
    genre: attr(el, 'Genre'),
    label: attr(el, 'Label'),
    comments: attr(el, 'Comments'),
    rating: parseNumber(attr(el, 'Rating')),
    color: normalizeColor(attr(el, 'Colour') ?? attr(el, 'Color')),
    bpm,
    key: attr(el, 'Tonality') ?? attr(el, 'Key'),
    durationSec: duration,
    location,
    filename: basename(location),
    cues,
  }
}

export async function parseRekordboxXmlFile(file: File): Promise<RekordboxLibrary> {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error(`Rekordbox XML could not be parsed: ${parseError.textContent?.trim() || 'invalid XML'}`)

  const trackEls = Array.from(doc.querySelectorAll('COLLECTION > TRACK, COLLECTION > Track, COLLECTION TRACK'))
  const tracks = trackEls
    .map(parseTrack)
    .filter((track): track is RekordboxTrackMetadata => track != null)

  const warnings: string[] = []
  if (tracks.length === 0) warnings.push('No Rekordbox TRACK entries were found in the XML file.')

  const cueCount = tracks.reduce((sum, track) => sum + track.cues.length, 0)
  const loopCount = tracks.reduce((sum, track) => sum + track.cues.filter(cue => cue.kind === 'loop').length, 0)

  return {
    id: `rekordbox-xml:${file.name}:${file.size}:${file.lastModified}`,
    source: 'rekordbox_xml',
    importedAt: new Date().toISOString(),
    tracks,
    warnings,
    stats: {
      totalTracks: tracks.length,
      tracksWithCues: tracks.filter(track => track.cues.length > 0).length,
      cues: cueCount,
      loops: loopCount,
      detectedPdbFiles: 0,
      detectedAnlzFiles: 0,
    },
  }
}
