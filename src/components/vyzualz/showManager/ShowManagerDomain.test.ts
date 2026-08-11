import { describe, expect, it } from 'vitest'
import {
  createShowManagerShow,
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
      schemaVersion: 1,
      id: 'show-1',
      name: 'Saved Show',
      linkedAudioTrackId: 'audio-db-9',
      tags: ['One'],
      groupId: null,
      engineIds: ['canvas'],
    })
  })
})
