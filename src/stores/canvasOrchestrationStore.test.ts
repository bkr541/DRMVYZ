import { beforeEach, describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, type CanvasMediaItem } from '../components/vyzualz/react/ReactTypes'
import { CANVAS_LEGACY_COMPATIBILITY_POOL_ID } from '../components/vyzualz/react/canvasPerformance/CanvasAuthoringState'
import { MAX_CANVAS_AUTHORED_LAYERS } from '../components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes'
import { mergeReactStoreState, migrateReactStore, reactStorePartialize, useReactStore } from './reactStore'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
})

describe('CANVAS orchestration persistence and compatibility', () => {
  it('keeps orchestration opt-in and preserves every existing CANVAS preset', () => {
    const settings = useReactStore.getState().canvasOrchestrationSettings
    expect(settings.enabled).toBe(false)
    expect(settings.authoredLayers).toEqual([])
    expect(settings.mediaPools).toEqual([])
    expect(settings.activeMediaPoolId).toBeNull()
    expect(Object.keys(CANVAS_PRESET_BY_ID)).toEqual(expect.arrayContaining([
      'canvas-clean-playback',
      'canvas-bass-bloom',
      'canvas-ghost-echo',
      'canvas-glitch-pulse',
      'canvas-luma-melt',
      'canvas-frame-stutter',
      'canvas-particle-aura',
      'canvas-fractures',
    ]))
  })

  it('defaults Auto Role on for an unconfigured Auto Performance workflow while preserving explicit user intent', () => {
    const store = useReactStore.getState()
    expect(store.canvasOrchestrationSettings.autoRoleEnabled).toBe(true)

    store.setCanvasOrchestrationSettings({ enabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(true)

    useReactStore.getState().setCanvasOrchestrationSettings({ autoRoleEnabled: false })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(false)

    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: false })
    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(false)

    useReactStore.getState().setCanvasOrchestrationSettings({ autoRoleEnabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(true)
  })

  it('keeps library focus, Make Active, authored layers, and pool membership independent', () => {
    useReactStore.getState().setCanvasAutoSelectEnabled(true)
    useReactStore.getState().selectCanvasMediaItem('library-video-1')
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
    expect(useReactStore.getState().canvasEngineSettings.manualMediaOverrideId).toBe('library-video-1')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])

    useReactStore.getState().focusCanvasMediaItem('library-image-2')
    expect(useReactStore.getState().selectedCanvasMediaId).toBe('library-image-2')
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')

    const poolResult = useReactStore.getState().createCanvasMediaPool('Main')
    expect(poolResult.ok).toBe(true)
    if (!poolResult.ok) throw new Error(poolResult.message)
    useReactStore.getState().setActiveCanvasMediaPool(poolResult.pool.id)
    useReactStore.getState().addCanvasMediaToPool(poolResult.pool.id, 'library-image-2')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual(['library-image-2'])
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')

    const layerResult = useReactStore.getState().addCanvasAuthoredLayer('library-image-2')
    expect(layerResult.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual(['library-image-2'])

    useReactStore.getState().removeCanvasMediaFromPool(poolResult.pool.id, 'library-image-2')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(1)
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')

    useReactStore.getState().applyCanvasAutoSelection({ mediaId: 'library-image-3', presetId: 'canvas-bass-bloom' })
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
  })

  it('supports 0-4 authored layer instances, duplicate media, deterministic reorder, update, duplicate, and atomic fifth-layer rejection', () => {
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])

    const first = useReactStore.getState().addCanvasAuthoredLayer('shared-media')
    const second = useReactStore.getState().addCanvasAuthoredLayer('shared-media')
    const third = useReactStore.getState().addCanvasAuthoredLayer('media-c', { ownership: 'automatic', pinned: false })
    const fourth = useReactStore.getState().addCanvasAuthoredLayer('media-d')
    expect([first.ok, second.ok, third.ok, fourth.ok]).toEqual([true, true, true, true])
    if (!first.ok || !second.ok || !third.ok || !fourth.ok) throw new Error('Expected four CANVAS layers')

    const fourLayerState = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(fourLayerState).toHaveLength(MAX_CANVAS_AUTHORED_LAYERS)
    expect(new Set(fourLayerState.map(layer => layer.id)).size).toBe(4)
    expect(fourLayerState.filter(layer => layer.mediaId === 'shared-media')).toHaveLength(2)
    expect(fourLayerState.map(layer => layer.order)).toEqual([0, 1, 2, 3])
    expect(fourLayerState.map(layer => layer.id)).toEqual([
      fourth.layer.id,
      third.layer.id,
      second.layer.id,
      first.layer.id,
    ])
    expect(fourLayerState.find(layer => layer.id === third.layer.id)).toMatchObject({ ownership: 'automatic', pinned: false })

    const beforeRejectedAdd = JSON.stringify(fourLayerState)
    const rejected = useReactStore.getState().addCanvasAuthoredLayer('media-e')
    expect(rejected).toMatchObject({ ok: false, code: 'layer-limit-reached' })
    expect(JSON.stringify(useReactStore.getState().canvasOrchestrationSettings.authoredLayers)).toBe(beforeRejectedAdd)

    const reordered = useReactStore.getState().reorderCanvasAuthoredLayer(first.layer.id, 0)
    expect(reordered.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual([
      first.layer.id,
      fourth.layer.id,
      third.layer.id,
      second.layer.id,
    ])

    const updated = useReactStore.getState().updateCanvasAuthoredLayer(first.layer.id, { solo: true, pinned: false })
    expect(updated.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === first.layer.id)).toMatchObject({ solo: true, pinned: false })

    expect(useReactStore.getState().removeCanvasAuthoredLayer(second.layer.id).ok).toBe(true)
    const duplicate = useReactStore.getState().duplicateCanvasAuthoredLayer(first.layer.id)
    expect(duplicate.ok).toBe(true)
    if (!duplicate.ok) throw new Error(duplicate.message)
    expect(duplicate.layer.id).not.toBe(first.layer.id)
    expect(duplicate.layer.mediaId).toBe(first.layer.mediaId)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(4)
  })

  it('supports multiple named pools while deriving the legacy runtime pool from exactly one active pool', () => {
    const first = useReactStore.getState().createCanvasMediaPool('Warmup')
    const second = useReactStore.getState().createCanvasMediaPool('Drop')
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('Expected named pools')

    useReactStore.getState().addCanvasMediaToPool(first.pool.id, 'warm-a')
    useReactStore.getState().addCanvasMediaToPool(first.pool.id, 'warm-b')
    useReactStore.getState().addCanvasMediaToPool(second.pool.id, 'drop-a')

    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    useReactStore.getState().setActiveCanvasMediaPool(first.pool.id)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual(['warm-a', 'warm-b'])

    useReactStore.getState().setActiveCanvasMediaPool(second.pool.id)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual(['drop-a'])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools).toHaveLength(2)

    const deleted = useReactStore.getState().deleteCanvasMediaPool(second.pool.id)
    expect(deleted.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId).toBeNull()
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.id)).toEqual([first.pool.id])

    expect(useReactStore.getState().deleteCanvasMediaPool(first.pool.id).ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
  })

  it('migrates legacy flat pool persistence into a deterministic compatibility pool and round-trips only canonical pool truth', () => {
    const current = useReactStore.getState()
    const basePersisted = reactStorePartialize(current) as unknown as Record<string, unknown>
    const legacy = {
      ...basePersisted,
      canvasOrchestrationSettings: {
        enabled: true,
        autoRoleEnabled: false,
        mediaPoolIds: ['legacy-a', 'legacy-b', 'legacy-a'],
        mediaRolesById: { 'legacy-a': ['hero'] },
        mediaLocksByLayer: {},
        layerLocks: {},
        globalLocks: {},
        complexity: 0.7,
        transitionDensity: 0.4,
        effectIntensity: 0.5,
        motionIntensity: 0.6,
        cutDensity: 0.3,
        compositionPreference: 'auto',
        poolRevision: 3,
        programId: 'canvas-cinematic-bass-editor',
        fracturesShowOverrides: null,
      },
    }

    const versionMigrated = migrateReactStore(legacy, 74)
    const versionMigratedCanvas = versionMigrated.canvasOrchestrationSettings as Record<string, unknown>
    expect(versionMigratedCanvas.mediaPools).toEqual([{
      id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
      name: 'Performance Pool',
      mediaIds: ['legacy-a', 'legacy-b'],
    }])
    expect(versionMigratedCanvas.activeMediaPoolId).toBe(CANVAS_LEGACY_COMPATIBILITY_POOL_ID)

    const migrated = mergeReactStoreState(versionMigrated, current)
    expect(migrated.canvasOrchestrationSettings.mediaPools).toEqual([{
      id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
      name: 'Performance Pool',
      mediaIds: ['legacy-a', 'legacy-b'],
    }])
    expect(migrated.canvasOrchestrationSettings.activeMediaPoolId).toBe(CANVAS_LEGACY_COMPATIBILITY_POOL_ID)
    expect(migrated.canvasOrchestrationSettings.mediaPoolIds).toEqual(['legacy-a', 'legacy-b'])
    expect(migrated.canvasOrchestrationSettings.mediaRolesById['legacy-a']).toEqual(['hero'])

    useReactStore.setState({ canvasOrchestrationSettings: migrated.canvasOrchestrationSettings })
    const persisted = reactStorePartialize(useReactStore.getState()) as unknown as Record<string, unknown>
    const persistedCanvas = persisted.canvasOrchestrationSettings as Record<string, unknown>
    expect(persistedCanvas).not.toHaveProperty('mediaPoolIds')
    expect(persistedCanvas).toMatchObject({
      activeMediaPoolId: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
      mediaPools: [{ id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID, mediaIds: ['legacy-a', 'legacy-b'] }],
    })

    const reloaded = mergeReactStoreState(persisted, useReactStore.getState())
    expect(reloaded.canvasOrchestrationSettings.mediaPoolIds).toEqual(['legacy-a', 'legacy-b'])
  })

  it('migrates missing Auto Role intent to on while round-tripping explicit off through persistence', () => {
    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: true, autoRoleEnabled: false })
    const current = useReactStore.getState()
    const persisted = JSON.parse(JSON.stringify(reactStorePartialize(current))) as ReturnType<typeof reactStorePartialize>
    const explicitOff = mergeReactStoreState(persisted, current)
    expect(explicitOff.canvasOrchestrationSettings.autoRoleEnabled).toBe(false)

    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    delete (legacy.canvasOrchestrationSettings as Partial<typeof legacy.canvasOrchestrationSettings>).autoRoleEnabled
    const migrated = mergeReactStoreState(legacy, current)
    expect(migrated.canvasOrchestrationSettings.autoRoleEnabled).toBe(true)
  })

  it('removes cleared local media from canonical layers, all pools, roles, and locks without disturbing library references', () => {
    const local: CanvasMediaItem = {
      id: 'local-video',
      name: 'Local video',
      type: 'video',
      objectUrl: 'blob:local-video',
      thumbnailUrl: null,
      mimeType: 'video/mp4',
      meta: 'VIDEO',
      source: 'legacySession',
      createdAt: new Date(0).toISOString(),
    }
    useReactStore.getState().addCanvasMediaItems([local])
    useReactStore.getState().selectCanvasMediaItem(local.id)
    useReactStore.getState().setCanvasMediaRoles(local.id, ['hero'])
    useReactStore.getState().setCanvasMediaLock('hero', local.id)
    const pool = useReactStore.getState().createCanvasMediaPool('Cleanup')
    if (!pool.ok) throw new Error(pool.message)
    useReactStore.getState().setActiveCanvasMediaPool(pool.pool.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, local.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, 'library-keep')
    useReactStore.getState().addCanvasAuthoredLayer(local.id)
    useReactStore.getState().addCanvasAuthoredLayer('library-layer-keep')
    const revisionBefore = useReactStore.getState().canvasOrchestrationSettings.poolRevision

    useReactStore.getState().clearCanvasMediaItems()

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.mediaPoolIds).toEqual(['library-keep'])
    expect(state.canvasOrchestrationSettings.authoredLayers.map(layer => layer.mediaId)).toEqual(['library-layer-keep'])
    expect(state.canvasOrchestrationSettings.mediaRolesById[local.id]).toBeUndefined()
    expect(state.canvasOrchestrationSettings.mediaLocksByLayer.hero).toBeUndefined()
    expect(state.canvasOrchestrationSettings.poolRevision).toBe(revisionBefore + 1)
  })

  it('persists authored layers, pools, user-facing roles and locks while reset preserves canonical authoring data', () => {
    useReactStore.getState().selectCanvasMediaItem('hero-a')
    useReactStore.getState().setCanvasMediaRoles('hero-a', ['hero', 'dropAsset'])
    useReactStore.getState().setCanvasMediaLock('hero', 'hero-a')
    useReactStore.getState().setCanvasLayerLock('hero', true)
    const pool = useReactStore.getState().createCanvasMediaPool('Main')
    if (!pool.ok) throw new Error(pool.message)
    useReactStore.getState().setActiveCanvasMediaPool(pool.pool.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, 'hero-a')
    const layer = useReactStore.getState().addCanvasAuthoredLayer('hero-a')
    if (!layer.ok) throw new Error(layer.message)
    useReactStore.getState().setCanvasOrchestrationSettings({
      enabled: true,
      programId: 'canvas-dreamstate-media-tunnel',
      complexity: 0.9,
      transitionDensity: 0.63,
      effectIntensity: 0.74,
      motionIntensity: 0.58,
      cutDensity: 0.67,
      compositionPreference: 'echoTunnel',
    })

    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      enabled: true,
      programId: 'canvas-dreamstate-media-tunnel',
      complexity: 0.9,
      transitionDensity: 0.63,
      effectIntensity: 0.74,
      motionIntensity: 0.58,
      cutDensity: 0.67,
      compositionPreference: 'echoTunnel',
      mediaPoolIds: ['hero-a'],
      mediaRolesById: { 'hero-a': ['hero', 'dropAsset'] },
      mediaLocksByLayer: { hero: 'hero-a' },
      layerLocks: { hero: true },
    })

    const persisted = reactStorePartialize(useReactStore.getState()) as unknown as Record<string, unknown>
    const persistedCanvas = persisted.canvasOrchestrationSettings as Record<string, unknown>
    expect(persistedCanvas).not.toHaveProperty('mediaPoolIds')
    expect(persistedCanvas).toHaveProperty('mediaPools')
    expect(persistedCanvas).toHaveProperty('authoredLayers')

    useReactStore.getState().resetCanvasOrchestration()
    const reset = useReactStore.getState().canvasOrchestrationSettings
    expect(reset.enabled).toBe(false)
    expect(reset.mediaPoolIds).toEqual(['hero-a'])
    expect(reset.mediaPools).toHaveLength(1)
    expect(reset.authoredLayers).toHaveLength(1)
    expect(reset.authoredLayers[0]?.id).toBe(layer.layer.id)
    expect(reset.mediaRolesById['hero-a']).toEqual(['hero', 'dropAsset'])
    expect(reset.mediaLocksByLayer).toEqual({})
  })
})
