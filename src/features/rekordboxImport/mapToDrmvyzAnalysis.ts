import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'
import type { TrackSectionMI } from '../musicIntelligence/types'
import type { ExternalTrackMetadata } from '../../types'
import type { VzCueMarker, VzCueRegion } from '../../types/cue'
import type { ImportedTrackIntelligence, RekordboxAnalysisSeed, RekordboxCuePoint, RekordboxLibrary, RekordboxTrackMetadata } from './types'
import type { RekordboxTrackMatch } from './matchTrack'

const DEFAULT_HOT_CUE_COLORS = ['#36f5ff', '#35f08c', '#ffd84d', '#ff9f3d', '#ff4f6d', '#b875ff', '#67a8ff', '#ffffff']

function cueVisualType(label: string, fallback: VzCueMarker['type'] = 'custom'): VzCueMarker['type'] {
  const lower = label.toLowerCase()
  if (lower.includes('intro')) return 'intro'
  if (lower.includes('verse')) return 'verse'
  if (lower.includes('build') || lower.includes('riser')) return 'build'
  if (lower.includes('drop') || lower.includes('chorus')) return 'drop'
  if (lower.includes('break')) return 'break'
  if (lower.includes('outro') || lower.includes('end')) return 'outro'
  return fallback
}

function sectionTypeFromCue(label: string): ReactSectionType | null {
  const type = cueVisualType(label)
  if (type === 'break') return 'breakdown'
  if (type === 'custom') return null
  return type
}

function cueColor(cue: RekordboxCuePoint, index: number): string {
  return cue.color || DEFAULT_HOT_CUE_COLORS[index % DEFAULT_HOT_CUE_COLORS.length]!
}

function cueLabel(cue: RekordboxCuePoint, index: number): string {
  if (cue.name?.trim()) return cue.name.trim()
  if (cue.kind === 'hot_cue') return `Hot Cue ${cue.slot ?? index + 1}`
  if (cue.kind === 'memory_cue') return 'Memory Cue'
  if (cue.kind === 'loop') return 'Loop'
  return 'Rekordbox Marker'
}

export function mapRekordboxMatchToDrmvyz(match: RekordboxTrackMatch, library: RekordboxLibrary): ImportedTrackIntelligence {
  const track = match.track
  const warnings: string[] = []
  const cueMarkers: VzCueMarker[] = []
  const cueRegions: VzCueRegion[] = []

  track.cues.forEach((cue, index) => {
    const label = cueLabel(cue, index)
    const color = cueColor(cue, index)
    const externalId = `rekordbox:${track.trackId}:${cue.id}`

    cueMarkers.push({
      id: externalId,
      label,
      time: cue.startSec,
      type: cueVisualType(label),
      color,
      source: 'rekordbox',
      kind: cue.kind,
      externalId,
      endTime: cue.endSec ?? undefined,
    })

    if (cue.kind === 'loop' && cue.endSec != null && cue.endSec > cue.startSec) {
      cueRegions.push({
        id: `${externalId}:region`,
        label,
        startTime: cue.startSec,
        endTime: cue.endSec,
        type: 'loop',
        color,
        source: 'rekordbox',
        externalId,
      })
    }
  })

  const sourceSections = buildCueSeededSections(track)
  const beatGrid = track.beatGrid?.filter(beat => Number.isFinite(beat.timeSec)) ?? []
  const downbeats = track.downbeats?.length
    ? track.downbeats
    : beatGrid.filter(beat => beat.isDownbeat)
  const analysisSeed: RekordboxAnalysisSeed = {
    source: library.source,
    bpm: track.bpm ?? inferBpmFromBeatGrid(beatGrid),
    beatGridOffsetSec: track.beatGridOffsetSec ?? beatGrid[0]?.timeSec ?? null,
    beatGrid: beatGrid.length ? beatGrid : undefined,
    downbeats: downbeats.length ? downbeats : undefined,
    key: track.key ?? null,
    keyConfidence: track.key ? 0.92 : null,
    sections: sourceSections,
  }

  const metadata: ExternalTrackMetadata = {
    source: library.source,
    sourceLibraryId: library.id,
    sourceTrackId: track.trackId,
    sourcePath: track.location ?? track.analysisFilePaths?.[0] ?? null,
    title: track.name,
    artist: track.artist ?? null,
    album: track.album ?? null,
    genre: track.genre ?? null,
    label: track.label ?? null,
    comments: track.comments ?? null,
    rating: track.rating ?? null,
    color: track.color ?? null,
    bpm: track.bpm ?? null,
    musicalKey: track.key ?? null,
    durationSec: track.durationSec ?? null,
    importedAt: library.importedAt,
    warnings,
  }

  return {
    source: library.source,
    metadata,
    cueMarkers,
    cueRegions,
    rekordboxPhrases: track.phrases ?? [],
    analysisSeed,
    matchConfidence: match.confidence,
    matchReason: match.reason,
    warnings,
  }
}

function inferBpmFromBeatGrid(beatGrid: NonNullable<RekordboxTrackMetadata['beatGrid']>): number | null {
  const explicit = beatGrid.map(beat => beat.bpm).find((bpm): bpm is number => typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0)
  if (explicit) return explicit
  if (beatGrid.length < 2) return null
  const deltas: number[] = []
  for (let i = 1; i < Math.min(beatGrid.length, 32); i++) {
    const delta = beatGrid[i]!.timeSec - beatGrid[i - 1]!.timeSec
    if (delta > 0.1 && delta < 3) deltas.push(delta)
  }
  if (!deltas.length) return null
  const avg = deltas.reduce((sum, value) => sum + value, 0) / deltas.length
  return Math.round((60 / avg) * 100) / 100
}

function buildCueSeededSections(track: RekordboxTrackMetadata): TrackSectionMI[] {
  const labeledCues = track.cues
    .map((cue, index) => ({ cue, index, label: cueLabel(cue, index), type: sectionTypeFromCue(cueLabel(cue, index)) }))
    .filter((item): item is { cue: RekordboxCuePoint; index: number; label: string; type: ReactSectionType } => item.type != null)

  if (labeledCues.length === 0) return []

  return labeledCues.map((item, index) => {
    const next = labeledCues[index + 1]
    const endSec = next?.cue.startSec ?? track.durationSec ?? item.cue.endSec ?? item.cue.startSec + 32
    return {
      id: `rekordbox-section-${track.trackId}-${index}`,
      label: item.label,
      type: item.type,
      startSec: item.cue.startSec,
      endSec: Math.max(item.cue.startSec + 1, endSec),
      intensity: item.type === 'drop' ? 0.95 : item.type === 'build' ? 0.78 : 0.55,
      confidence: 0.72,
      source: 'rekordbox',
      locked: true,
    }
  })
}
