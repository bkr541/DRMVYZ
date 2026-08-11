import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCanvasShowManagerShow } from '../components/vyzualz/showManager/CanvasShowManagerDomain'
import { createLaserDmxShowManagerShow } from '../components/vyzualz/showManager/LaserDmxShowManagerDomain'
import { mergeReactStoreState, migrateReactStore, reactPersistStorage, reactStorePartialize, useReactStore } from './reactStore'
import { useAudioStore, type SavedAudioTrack } from './audioStore'
import { useReactPersistenceStatusStore } from './reactPersistenceStatusStore'

describe('Show Manager audio-bound Stage 1 store integration', () => {
  beforeEach(() => {
    useReactPersistenceStatusStore.getState().reset()
    useAudioStore.setState({ savedTracks: [], loading: false, loadError: null })
    useReactStore.setState({
      showManagerShows: [],
      showManagerEditingShowId: null,
      canvasShowManagerShows: [],
      canvasShowManagerEditingShowId: null,
      canvasShowManagerEditingSectionId: null,
      canvasShowManagerEditingElementId: null,
      laserDmxShowManagerShows: [],
      laserDmxShowManagerEditingShowId: null,
      laserDmxShowManagerEditingSectionId: null,
      laserDmxShowManagerPlaybackSectionId: null,
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('creates one shared audio-bound Show and seeds the selected engine payload atomically', async () => {
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()

    const showId = await useReactStore.getState().createShowManagerShow({
      name: '  Main   Stage ',
      linkedAudioTrackId: 'audio-db-1',
      tags: ['Festival', ' festival ', 'Peak'],
      groupId: 'collection-1',
      initialEngineId: 'canvas',
    })

    expect(showId).toBeTruthy()
    const state = useReactStore.getState()
    expect(state.showManagerShows).toEqual([expect.objectContaining({
      id: showId,
      name: 'Main Stage',
      linkedAudioTrackId: 'audio-db-1',
      tags: ['Festival', 'Peak'],
      groupId: 'collection-1',
      engineIds: ['canvas'],
    })])
    expect(state.showManagerEditingShowId).toBe(showId)
    expect(state.canvasShowManagerShows[0]?.id).toBe(showId)
    expect(state.canvasShowManagerEditingShowId).toBe(showId)
    expect(state.laserDmxShowManagerShows).toEqual([])
  })

  it('rejects normalized duplicate names and missing audio before persistence/state mutation', async () => {
    const persist = vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()
    await useReactStore.getState().createShowManagerShow({
      name: 'Festival Main',
      linkedAudioTrackId: 'audio-db-1',
      initialEngineId: 'laserDmx',
    })
    const callCount = persist.mock.calls.length

    await expect(useReactStore.getState().createShowManagerShow({
      name: '  FESTIVAL   MAIN ',
      linkedAudioTrackId: 'audio-db-2',
      initialEngineId: 'canvas',
    })).resolves.toBeNull()
    await expect(useReactStore.getState().createShowManagerShow({
      name: 'No Audio',
      linkedAudioTrackId: '   ',
      initialEngineId: 'canvas',
    })).resolves.toBeNull()

    expect(persist).toHaveBeenCalledTimes(callCount)
    expect(useReactStore.getState().showManagerShows).toHaveLength(1)
  })

  it('serializes rapid repeated Create attempts so one user action cannot create duplicates', async () => {
    let releaseFirstWrite: () => void = () => { throw new Error('persistence write was not started') }
    vi.spyOn(reactPersistStorage, 'setItem')
      .mockImplementationOnce(() => new Promise<void>(resolve => { releaseFirstWrite = resolve }))
      .mockResolvedValue(undefined)

    const first = useReactStore.getState().createShowManagerShow({
      name: 'Rapid Create',
      linkedAudioTrackId: 'audio-db-rapid',
      initialEngineId: 'canvas',
    })
    const second = useReactStore.getState().createShowManagerShow({
      name: 'Rapid Create',
      linkedAudioTrackId: 'audio-db-rapid',
      initialEngineId: 'canvas',
    })

    await expect(second).resolves.toBeNull()
    releaseFirstWrite()
    await expect(first).resolves.toBeTruthy()
    expect(useReactStore.getState().showManagerShows).toHaveLength(1)
    expect(useReactStore.getState().canvasShowManagerShows).toHaveLength(1)
  })

  it('does not commit a partial Show when persistence fails', async () => {
    vi.spyOn(reactPersistStorage, 'setItem').mockRejectedValueOnce(new Error('disk unavailable'))

    await expect(useReactStore.getState().createShowManagerShow({
      name: 'Persistence Failure',
      linkedAudioTrackId: 'audio-db-3',
      initialEngineId: 'laserDmx',
    })).resolves.toBeNull()

    const state = useReactStore.getState()
    expect(state.showManagerShows).toEqual([])
    expect(state.laserDmxShowManagerShows).toEqual([])
    expect(state.showManagerEditingShowId).toBeNull()
  })

  it('persists Show tags/group independently without mutating linked audio metadata', async () => {
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()
    const audioTrack: SavedAudioTrack = {
      id: 'audio-audio-db-meta',
      dbId: 'audio-db-meta',
      title: 'Canonical Track',
      fileName: 'canonical.wav',
      storagePath: 'user/audio/canonical.wav',
      durationSec: 180,
      sampleRate: 48000,
      channels: 2,
      fileSizeByte: 1024,
      mimeType: 'audio/wav',
      transcriptionAssets: null,
      artist: 'Artist',
      genre: 'Original Genre',
      bpm: 140,
      musicalKey: 'F#m',
      createdAt: '2026-08-11T00:00:00.000Z',
    }
    useAudioStore.setState({ savedTracks: [audioTrack] })

    const showId = await useReactStore.getState().createShowManagerShow({
      name: 'Independent Metadata',
      linkedAudioTrackId: audioTrack.dbId,
      tags: ['Show Tag'],
      groupId: 'show-group',
      initialEngineId: 'pixGrid',
    })

    expect(showId).toBeTruthy()
    expect(useReactStore.getState().showManagerShows[0]).toEqual(expect.objectContaining({
      tags: ['Show Tag'],
      groupId: 'show-group',
    }))
    expect(useAudioStore.getState().savedTracks[0]).toEqual(audioTrack)
  })

  it('persists registry metadata but never persists the currently opened editing session', async () => {
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()
    const showId = await useReactStore.getState().createShowManagerShow({
      name: 'Persisted Show',
      linkedAudioTrackId: 'audio-db-4',
      initialEngineId: 'canvas',
    })
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>

    expect((persisted.showManagerShows as Array<{ id: string; linkedAudioTrackId: string }>)[0]).toEqual(expect.objectContaining({
      id: showId,
      linkedAudioTrackId: 'audio-db-4',
    }))
    expect(persisted).not.toHaveProperty('showManagerEditingShowId')

    const reloaded = mergeReactStoreState(persisted, useReactStore.getState())
    expect(reloaded.showManagerShows[0]?.id).toBe(showId)
    expect(reloaded.showManagerEditingShowId).toBeNull()
  })

  it('resets only the Show Manager editing session and leaves persisted Shows intact', async () => {
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()
    const showId = await useReactStore.getState().createShowManagerShow({
      name: 'Session Reset',
      linkedAudioTrackId: 'audio-db-5',
      initialEngineId: 'laserDmx',
    })

    useReactStore.getState().resetShowManagerSession()
    const state = useReactStore.getState()
    expect(state.showManagerShows[0]?.id).toBe(showId)
    expect(state.showManagerEditingShowId).toBeNull()
    expect(state.laserDmxShowManagerEditingShowId).toBeNull()
    expect(state.laserDmxShowManagerEditingSectionId).toBeNull()
  })

  it('migrates existing engine Shows into safe legacy registry records with no fabricated audio ID', () => {
    const canvas = createCanvasShowManagerShow('Legacy Canvas', 'canvas-legacy')
    const laser = createLaserDmxShowManagerShow('Legacy Laser', 'laser-legacy')
    const migrated = migrateReactStore({
      canvasShowManagerShows: [canvas],
      laserDmxShowManagerShows: [laser],
    }, 72)
    const shared = migrated.showManagerShows as Array<{ id: string; linkedAudioTrackId: string | null; engineIds: string[] }>

    expect(shared).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'canvas-legacy', linkedAudioTrackId: null, engineIds: ['canvas'] }),
      expect.objectContaining({ id: 'laser-legacy', linkedAudioTrackId: null, engineIds: ['laserDmx'] }),
    ]))
  })
})
