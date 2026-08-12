import { describe, expect, it } from 'vitest'
import {
  buildShowManagerCanonicalTrackMap,
  createShowManagerShow,
  reconcileShowManagerTrackMap,
  resolveShowManagerActiveSection,
  updateShowManagerTrackMapBoundary,
  updateShowManagerTrackMapSection,
  isShowManagerShowNameAvailable,
  isSupportedShowManagerAudioLibraryItem,
  mergeLegacyShowManagerRecords,
  normalizeShowManagerShowName,
  normalizeShowManagerShows,
} from './ShowManagerDomain'

describe('ShowManagerDomain audio-bound Stage 1 contract', () => {
  it('normalizes Show names and rejects case/whitespace duplicates globally', () => {
    const existing = createShowManagerShow({
      name: '  Festival   Main  ',
      linkedAudioTrackId: 'audio-db-1',
      initialEngineId: 'canvas',
    })!

    expect(normalizeShowManagerShowName('  Festival   Main  ')).toBe('Festival Main')
    expect(isShowManagerShowNameAvailable([existing], 'festival main')).toBe(false)
    expect(isShowManagerShowNameAvailable([existing], '  FESTIVAL   MAIN ')).toBe(false)
    expect(isShowManagerShowNameAvailable([existing], 'Festival Side')).toBe(true)
  })

  it('accepts only durable audio-library records supported by the canonical audio ingestion rule', () => {
    expect(isSupportedShowManagerAudioLibraryItem({
      dbId: 'audio-db-1',
      storagePath: 'user/audio/track.wav',
      fileName: 'track.wav',
      mimeType: 'audio/wav',
    })).toBe(true)
    expect(isSupportedShowManagerAudioLibraryItem({
      dbId: 'audio-db-2',
      storagePath: 'user/audio/track.flac',
      fileName: 'track.flac',
      mimeType: null,
    })).toBe(true)
    expect(isSupportedShowManagerAudioLibraryItem({
      dbId: 'audio-db-3',
      storagePath: 'user/media/clip.mp4',
      fileName: 'clip.mp4',
      mimeType: 'video/mp4',
    })).toBe(false)
    expect(isSupportedShowManagerAudioLibraryItem({
      dbId: '',
      storagePath: 'user/audio/track.wav',
      fileName: 'track.wav',
      mimeType: 'audio/wav',
    })).toBe(false)
  })

  it('requires a durable audio-library identity and normalizes Show-only metadata', () => {
    expect(createShowManagerShow({ name: 'No Audio', linkedAudioTrackId: '   ' })).toBeNull()
    expect(createShowManagerShow({ name: '   ', linkedAudioTrackId: 'audio-db-1' })).toBeNull()

    const show = createShowManagerShow({
      name: ' Main Show ',
      linkedAudioTrackId: ' audio-db-1 ',
      tags: ['Peak', ' peak ', 'Night'],
      groupId: ' collection-1 ',
      initialEngineId: 'laserDmx',
    })!

    expect(show.name).toBe('Main Show')
    expect(show.linkedAudioTrackId).toBe('audio-db-1')
    expect(show.tags).toEqual(['Peak', 'Night'])
    expect(show.groupId).toBe('collection-1')
    expect(show.engineIds).toEqual(['laserDmx'])
  })

  it('migrates legacy engine Shows without inventing an audio association', () => {
    const migrated = mergeLegacyShowManagerRecords(undefined, [
      { id: 'canvas-legacy-1', name: 'Legacy Visuals', engineId: 'canvas' },
      { id: 'laser-legacy-1', name: 'Legacy Lasers', engineId: 'laserDmx' },
    ])

    expect(migrated).toHaveLength(2)
    expect(migrated.map(show => show.linkedAudioTrackId)).toEqual([null, null])
    expect(migrated[0].engineIds).toEqual(['canvas'])
    expect(migrated[1].engineIds).toEqual(['laserDmx'])
  })

  it('normalizes malformed persisted metadata without persisting transient values', () => {
    const [show] = normalizeShowManagerShows([{
      schemaVersion: 99,
      id: 'show-1',
      name: '  Saved Show ',
      linkedAudioTrackId: 'audio-db-9',
      tags: ['One', '', 'one'],
      groupId: '',
      engineIds: ['canvas', 'canvas', 'unknown'],
      currentTime: 42,
      objectUrl: 'blob:should-not-survive',
    }])

    expect(show).toEqual({
      schemaVersion: 2,
      id: 'show-1',
      name: 'Saved Show',
      linkedAudioTrackId: 'audio-db-9',
      tags: ['One'],
      groupId: null,
      engineIds: ['canvas'],
      trackMap: null,
    })
  })


  it('normalizes malformed persisted Show Track Map ranges without mutating unrelated authored metadata', () => {
    const [show] = normalizeShowManagerShows([{
      schemaVersion: 2,
      id: 'show-malformed-map',
      name: 'Malformed Map',
      linkedAudioTrackId: 'audio-db-1',
      tags: ['Keep'],
      groupId: 'group-1',
      engineIds: ['canvas'],
      trackMap: {
        schemaVersion: 1,
        linkedAudioTrackId: 'wrong-id-is-ignored',
        baseAnalysisVersion: 'analysis-v3',
        baseTimelineRevision: '',
        durationSec: 30,
        edited: true,
        sections: [
          { id: 'valid', label: ' Intro ', type: 'intro', startSec: -3, endSec: 12, intensity: 2, source: 'user-edited-auto' },
          { id: 'invalid', label: 'Broken', type: 'drop', startSec: 20, endSec: 10, intensity: 1, source: 'auto' },
          { id: 'outro', label: 'Outro', type: 'outro', startSec: 12, endSec: 40, intensity: 0.2, source: 'manual' },
        ],
      },
    }])

    expect(show.tags).toEqual(['Keep'])
    expect(show.groupId).toBe('group-1')
    expect(show.trackMap?.linkedAudioTrackId).toBe('audio-db-1')
    expect(show.trackMap?.edited).toBe(true)
    expect(show.trackMap?.sections.map(section => [section.id, section.startSec, section.endSec, section.intensity])).toEqual([
      ['valid', 0, 12, 1],
      ['outro', 12, 30, 0.2],
    ])
  })

  it('seeds a Show-owned Track Map from canonical analysis without mutating the canonical sections', () => {
    const canonical = [
      { id: 'intro', label: 'Intro', type: 'intro' as const, startSec: 0, endSec: 12, intensity: 0.4, source: 'auto' as const },
      { id: 'drop', label: 'Drop', type: 'drop' as const, startSec: 12, endSec: 30, intensity: 1, source: 'auto' as const },
    ]
    const before = JSON.stringify(canonical)
    const map = buildShowManagerCanonicalTrackMap({
      linkedAudioTrackId: 'audio-db-1',
      analysisVersion: 'analysis-v3',
      durationSec: 30,
      canonicalSections: canonical,
    })!

    expect(map.edited).toBe(false)
    expect(map.sections.map(section => [section.id, section.startSec, section.endSec])).toEqual([
      ['intro', 0, 12],
      ['drop', 12, 30],
    ])
    expect(JSON.stringify(canonical)).toBe(before)
  })

  it('uses shared Track Map boundary semantics and preserves authored edits across canonical revisions', () => {
    const canonical = buildShowManagerCanonicalTrackMap({
      linkedAudioTrackId: 'audio-db-1',
      analysisVersion: 'analysis-v3',
      durationSec: 30,
      canonicalSections: [
        { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 12, intensity: 0.4, source: 'auto' },
        { id: 'drop', label: 'Drop', type: 'drop', startSec: 12, endSec: 30, intensity: 1, source: 'auto' },
      ],
    })!
    const moved = updateShowManagerTrackMapBoundary(canonical, 'drop', 'start', 14, 'intro', 14)
    const relabeled = updateShowManagerTrackMapSection(moved, 'drop', { label: 'Main Drop' })

    expect(relabeled.edited).toBe(true)
    expect(relabeled.sections[0]!.endSec).toBe(14)
    expect(relabeled.sections[1]!.startSec).toBe(14)
    expect(relabeled.sections.map(section => section.source)).toEqual(['user-edited-auto', 'user-edited-auto'])
    expect(relabeled.sections[1]!.provenance?.authority).toBe('manual_replacement')
    expect(resolveShowManagerActiveSection(relabeled, 14)?.id).toBe('drop')

    const revisedCanonical = buildShowManagerCanonicalTrackMap({
      linkedAudioTrackId: 'audio-db-1',
      analysisVersion: 'analysis-v4',
      durationSec: 30,
      canonicalSections: [
        { id: 'intro-v4', label: 'Intro', type: 'intro', startSec: 0, endSec: 10, intensity: 0.4, source: 'auto' },
        { id: 'drop-v4', label: 'Drop', type: 'drop', startSec: 10, endSec: 30, intensity: 1, source: 'auto' },
      ],
    })!
    expect(reconcileShowManagerTrackMap(canonical, revisedCanonical)).toBe(canonical)
    expect(reconcileShowManagerTrackMap(relabeled, revisedCanonical)).toBe(relabeled)
  })
})
