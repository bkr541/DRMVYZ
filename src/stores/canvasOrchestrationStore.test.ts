import { beforeEach, describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, type CanvasMediaItem } from '../components/vyzualz/react/ReactTypes'
import { CANVAS_LEGACY_COMPATIBILITY_POOL_ID, resolveCanvasEffectiveAuthoredLayers } from '../components/vyzualz/react/canvasPerformance/CanvasAuthoringState'
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
    expect(settings.renderMode).toBe('single')
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
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('performance')

    useReactStore.getState().setCanvasOrchestrationSettings({ autoRoleEnabled: false })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(false)

    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: false })
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('single')
    useReactStore.getState().setCanvasOrchestrationSettings({ enabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(false)

    useReactStore.getState().setCanvasOrchestrationSettings({ autoRoleEnabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(true)
  })

  it('Make Active exits Auto Performance without disabling its saved preference, then Add as Layer preserves the visible source', () => {
    const store = useReactStore.getState()
    store.setCanvasOrchestrationSettings({ enabled: true })
    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      enabled: true,
      renderMode: 'performance',
    })

    store.selectCanvasMediaItem('visible-media')
    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      enabled: true,
      renderMode: 'single',
    })
    expect(useReactStore.getState().activeCanvasMediaId).toBe('visible-media')

    const added = useReactStore.getState().addCanvasAuthoredLayer('new-layer-media', {
      ownership: 'manual',
      pinned: true,
      preserveActiveSource: true,
    })
    expect(added.ok).toBe(true)

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(state.canvasOrchestrationSettings.authoredLayers.map(layer => layer.mediaId)).toEqual([
      'visible-media',
      'new-layer-media',
    ])
    expect(state.selectedCanvasLayerId).toBe(added.ok ? added.layer.id : null)
  })

  it('keeps library focus and pool membership independent while Make Active retires the previous composition', () => {
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

    const layerResult = useReactStore.getState().addCanvasAuthoredLayer('library-image-2')
    expect(layerResult.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('layers')

    useReactStore.getState().selectCanvasMediaItem('library-video-1')
    const afterMakeActive = useReactStore.getState()
    expect(afterMakeActive.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(afterMakeActive.canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(afterMakeActive.selectedCanvasLayerId).toBeNull()
    expect(afterMakeActive.canvasOrchestrationSettings.mediaPoolIds).toEqual(['library-image-2'])

    useReactStore.getState().setSelectedCanvasLayer(layerResult.ok ? layerResult.layer.id : null)
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('single')

    useReactStore.getState().removeCanvasMediaFromPool(poolResult.pool.id, 'library-image-2')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(useReactStore.getState().activeCanvasMediaId).toBe('library-video-1')
  })

  it('Make Active after a four-layer composition starts a fresh composition and permits Add as Layer', () => {
    const retiredLayerIds: string[] = []
    for (const mediaId of ['existing-a', 'existing-b', 'existing-c', 'existing-d']) {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
      retiredLayerIds.push(result.layer.id)
    }
    useReactStore.getState().addCanvasLayerEffect(retiredLayerIds[0], 'echo')
    useReactStore.getState().addCanvasLayerEffect(retiredLayerIds[1], 'stutter')

    useReactStore.getState().selectCanvasMediaItem('primary-media')
    const fresh = useReactStore.getState()
    expect(fresh.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(fresh.canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(fresh.canvasOrchestrationSettings.primaryLayer).toMatchObject({ kind: 'detached' })
    expect(fresh.getCanvasPrimaryLayer()).toMatchObject({ mediaId: 'primary-media', effects: [] })
    const persisted = reactStorePartialize(fresh) as unknown as Record<string, unknown>
    expect((persisted.canvasOrchestrationSettings as { authoredLayers?: unknown[] }).authoredLayers).toEqual([])

    const added = fresh.addCanvasAuthoredLayer('candidate-media', { preserveActiveSource: true })
    if (!added.ok) throw new Error(added.message)
    const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(layers.map(layer => layer.mediaId)).toEqual(['primary-media', 'candidate-media'])
    expect(layers.every(layer => !retiredLayerIds.includes(layer.id))).toBe(true)
  })

  it('creates a fresh primary identity after Make Active instead of reviving a retired authored layer', () => {
    const first = useReactStore.getState().addCanvasAuthoredLayer('first-media')
    const previousPrimary = useReactStore.getState().addCanvasAuthoredLayer('primary-media')
    if (!first.ok || !previousPrimary.ok) throw new Error('Expected authored layers')
    useReactStore.getState().addCanvasLayerEffect(previousPrimary.layer.id, 'bloom')

    useReactStore.getState().selectCanvasMediaItem('primary-media')
    const freshPrimary = useReactStore.getState().getCanvasPrimaryLayer()
    if (!freshPrimary) throw new Error('Expected fresh primary')
    expect(freshPrimary.id).not.toBe(previousPrimary.layer.id)
    expect(freshPrimary).toMatchObject({ mediaId: 'primary-media', effects: [] })

    const added = useReactStore.getState().addCanvasAuthoredLayer('candidate-media', { preserveActiveSource: true })
    if (!added.ok) throw new Error(added.message)
    const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(layers.map(layer => layer.mediaId)).toEqual(['primary-media', 'candidate-media'])
    expect(layers[0]?.id).toBe(freshPrimary.id)
    expect(layers.map(layer => layer.order)).toEqual([0, 1])
  })

  it('does not accumulate hidden authored layers during repeated normal media selection', () => {
    const authored = useReactStore.getState().addCanvasAuthoredLayer('intentional-layer')
    if (!authored.ok) throw new Error(authored.message)

    for (const mediaId of ['browse-a', 'browse-b', 'browse-c']) {
      useReactStore.getState().selectCanvasMediaItem(mediaId)
      expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])
    }

    const state = useReactStore.getState()
    expect(state.activeCanvasMediaId).toBe('browse-c')
    expect(state.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(state.canvasOrchestrationSettings.authoredLayers).toEqual([])
  })

  it('supports four active authored layer instances, duplicate media, deterministic reorder, update, duplicate, and atomic fifth-active-layer rejection', () => {
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
      first.layer.id,
      second.layer.id,
      third.layer.id,
      fourth.layer.id,
    ])
    expect(fourLayerState.find(layer => layer.id === third.layer.id)).toMatchObject({ ownership: 'automatic', pinned: false })

    const beforeRejectedAdd = JSON.stringify(fourLayerState)
    const rejected = useReactStore.getState().addCanvasAuthoredLayer('media-e')
    expect(rejected).toMatchObject({ ok: false, code: 'layer-limit-reached' })
    expect(JSON.stringify(useReactStore.getState().canvasOrchestrationSettings.authoredLayers)).toBe(beforeRejectedAdd)

    const reordered = useReactStore.getState().reorderCanvasAuthoredLayer(first.layer.id, 3)
    expect(reordered.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual([
      second.layer.id,
      third.layer.id,
      fourth.layer.id,
      first.layer.id,
    ])

    useReactStore.getState().setSelectedCanvasLayer(first.layer.id)
    const updated = useReactStore.getState().updateCanvasAuthoredLayer(first.layer.id, { solo: true, pinned: false })
    expect(updated.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === first.layer.id)).toMatchObject({ solo: true, pinned: false })
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(first.layer.id)

    expect(useReactStore.getState().removeCanvasAuthoredLayer(second.layer.id).ok).toBe(true)
    const duplicate = useReactStore.getState().duplicateCanvasAuthoredLayer(first.layer.id)
    expect(duplicate.ok).toBe(true)
    if (!duplicate.ok) throw new Error(duplicate.message)
    expect(duplicate.layer.id).not.toBe(first.layer.id)
    expect(duplicate.layer.mediaId).toBe(first.layer.mediaId)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(4)
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(duplicate.layer.id)

    expect(useReactStore.getState().setCanvasAuthoredLayerSolo(fourth.layer.id, true).ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.filter(layer => layer.solo).map(layer => layer.id)).toEqual([fourth.layer.id])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === first.layer.id)?.enabled).toBe(true)

    const selectedIndex = useReactStore.getState().canvasOrchestrationSettings.authoredLayers.findIndex(layer => layer.id === duplicate.layer.id)
    expect(useReactStore.getState().removeCanvasAuthoredLayer(duplicate.layer.id).ok).toBe(true)
    const remaining = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    const expectedNeighbor = remaining[selectedIndex]?.id ?? remaining[selectedIndex - 1]?.id ?? remaining[0]?.id ?? null
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(expectedNeighbor)
  })

  it('allows disabled stored layers to remain without consuming active capacity and blocks re-enable beyond four active media', () => {
    const layers = ['media-a', 'media-b', 'media-c', 'media-d'].map(mediaId => {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
      return result.layer
    })
    expect(useReactStore.getState().updateCanvasAuthoredLayer(layers[1].id, { enabled: false }).ok).toBe(true)

    const fifth = useReactStore.getState().addCanvasAuthoredLayer('media-e')
    if (!fifth.ok) throw new Error(fifth.message)
    const stored = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(stored).toHaveLength(5)
    expect(resolveCanvasEffectiveAuthoredLayers(stored).map(layer => layer.mediaId)).toEqual([
      'media-a', 'media-c', 'media-d', 'media-e',
    ])

    const rejectedEnable = useReactStore.getState().updateCanvasAuthoredLayer(layers[1].id, { enabled: true })
    expect(rejectedEnable).toMatchObject({ ok: false, code: 'layer-limit-reached' })
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === layers[1].id)?.enabled).toBe(false)
  })

  it('deletes selected soloed top, middle, and bottom instances with deterministic neighbor cleanup and allows re-add', () => {
    for (const targetIndex of [0, 1, 2]) {
      useReactStore.getState().resetReactView()
      useReactStore.getState().selectReactEngine('canvas')
      const a = useReactStore.getState().addCanvasAuthoredLayer(`delete-a-${targetIndex}`)
      const b = useReactStore.getState().addCanvasAuthoredLayer(`delete-b-${targetIndex}`)
      const c = useReactStore.getState().addCanvasAuthoredLayer(`delete-c-${targetIndex}`)
      if (!a.ok || !b.ok || !c.ok) throw new Error('Expected deletion scenario layers')

      const ordered = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
      const target = ordered[targetIndex]
      if (!target) throw new Error('Expected deletion target')
      useReactStore.getState().setSelectedCanvasLayer(target.id)
      expect(useReactStore.getState().setCanvasAuthoredLayerSolo(target.id, true).ok).toBe(true)

      expect(useReactStore.getState().removeCanvasAuthoredLayer(target.id).ok).toBe(true)
      const remaining = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
      const expectedNeighbor = remaining[targetIndex]?.id ?? remaining[targetIndex - 1]?.id ?? remaining[0]?.id ?? null
      expect(useReactStore.getState().selectedCanvasLayerId).toBe(expectedNeighbor)
      expect(remaining.some(layer => layer.solo)).toBe(false)

      const readded = useReactStore.getState().addCanvasAuthoredLayer(target.mediaId)
      expect(readded.ok).toBe(true)
    }
  })

  it('keeps current CANVAS layer selection runtime-only across persistence and hydration', () => {
    const added = useReactStore.getState().addCanvasAuthoredLayer('runtime-selection-media')
    expect(added.ok).toBe(true)
    if (!added.ok) throw new Error('Expected CANVAS layer')

    useReactStore.getState().setSelectedCanvasLayer(added.layer.id)
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(added.layer.id)

    const persisted = reactStorePartialize(useReactStore.getState()) as unknown as Record<string, unknown>
    expect(persisted).not.toHaveProperty('selectedCanvasLayerId')

    const contaminatedPersisted = { ...persisted, selectedCanvasLayerId: added.layer.id }
    const reloaded = mergeReactStoreState(contaminatedPersisted, useReactStore.getState())
    expect(reloaded.selectedCanvasLayerId).toBeNull()
    expect(reloaded.canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toContain(added.layer.id)
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

    useReactStore.getState().selectCanvasMediaItem('drop-a')
    const protectedLayer = useReactStore.getState().addCanvasAuthoredLayer('drop-a')
    if (!protectedLayer.ok) throw new Error(protectedLayer.message)

    const deleted = useReactStore.getState().deleteCanvasMediaPool(second.pool.id)
    expect(deleted.ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId).toBeNull()
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.id)).toEqual([first.pool.id])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === protectedLayer.layer.id)?.mediaId).toBe('drop-a')
    expect(useReactStore.getState().activeCanvasMediaId).toBe('drop-a')

    expect(useReactStore.getState().deleteCanvasMediaPool(first.pool.id).ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPoolIds).toEqual([])
  })

  it('removes Pool membership idempotently without changing source or layer state', () => {
    useReactStore.getState().selectCanvasMediaItem('pool-media')
    const layer = useReactStore.getState().addCanvasAuthoredLayer('pool-media')
    if (!layer.ok) throw new Error(layer.message)
    const pool = useReactStore.getState().createCanvasMediaPool('Removal')
    if (!pool.ok) throw new Error(pool.message)
    useReactStore.getState().setActiveCanvasMediaPool(pool.pool.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, 'pool-media')

    expect(useReactStore.getState().removeCanvasMediaFromPool(pool.pool.id, 'pool-media').ok).toBe(true)
    const revisionAfterFirstRemoval = useReactStore.getState().canvasOrchestrationSettings.poolRevision
    expect(useReactStore.getState().removeCanvasMediaFromPool(pool.pool.id, 'pool-media').ok).toBe(true)

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.poolRevision).toBe(revisionAfterFirstRemoval)
    expect(state.canvasOrchestrationSettings.mediaPoolIds).toEqual([])
    expect(state.canvasOrchestrationSettings.authoredLayers.map(candidate => candidate.id)).toContain(layer.layer.id)
    expect(state.activeCanvasMediaId).toBe('pool-media')
  })

  it('rejects blank and case-folded duplicate pool names without mutating canonical pool state', () => {
    const blank = useReactStore.getState().createCanvasMediaPool('   ')
    expect(blank).toMatchObject({ ok: false, code: 'invalid-pool-name' })
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools).toEqual([])

    const first = useReactStore.getState().createCanvasMediaPool('Warmup')
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(first.message)

    const duplicate = useReactStore.getState().createCanvasMediaPool(' warmUP ')
    expect(duplicate).toMatchObject({ ok: false, code: 'pool-name-conflict' })
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.name)).toEqual(['Warmup'])

    const second = useReactStore.getState().createCanvasMediaPool('Drop')
    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error(second.message)
    expect(useReactStore.getState().renameCanvasMediaPool(second.pool.id, 'WARMUP')).toMatchObject({
      ok: false,
      code: 'pool-name-conflict',
    })
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.name)).toEqual(['Warmup', 'Drop'])
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

  it('persists layered render ownership and canonical authored order while legacy state without the discriminator safely migrates to single-source output', () => {
    const first = useReactStore.getState().addCanvasAuthoredLayer('persisted-layer-a')
    const second = useReactStore.getState().addCanvasAuthoredLayer('persisted-layer-b')
    if (!first.ok || !second.ok) throw new Error('Expected persisted CANVAS layers')
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('layers')

    const persisted = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState()))) as ReturnType<typeof reactStorePartialize>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(restored.canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual([first.layer.id, second.layer.id])

    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    delete (legacy.canvasOrchestrationSettings as Partial<typeof legacy.canvasOrchestrationSettings>).renderMode
    const migrated = mergeReactStoreState(legacy, useReactStore.getState())
    expect(migrated.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(migrated.canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual([first.layer.id, second.layer.id])

    const legacyAutoPerformance = JSON.parse(JSON.stringify(legacy)) as typeof legacy
    legacyAutoPerformance.canvasOrchestrationSettings.enabled = true
    const migratedAutoPerformance = mergeReactStoreState(legacyAutoPerformance, useReactStore.getState())
    expect(migratedAutoPerformance.canvasOrchestrationSettings.renderMode).toBe('performance')
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

  it('persists Pool automation authoring choices while keeping runtime event state transient', () => {
    const initial = useReactStore.getState().canvasOrchestrationSettings
    expect(initial.poolAutomationEnabled).toBe(false)
    expect(initial.poolAutomationTrigger).toBe('beat')
    expect(initial.poolAutomationTransitionId).toBe('crossfade')

    useReactStore.getState().setCanvasOrchestrationSettings({
      poolAutomationEnabled: true,
      poolAutomationTrigger: '6bars',
      poolAutomationTransitionId: 'dipToBlack',
      renderMode: 'layers',
    })
    const persisted = reactStorePartialize(useReactStore.getState()) as unknown as Record<string, unknown>
    const persistedCanvas = persisted.canvasOrchestrationSettings as Record<string, unknown>
    expect(persistedCanvas).toMatchObject({
      poolAutomationEnabled: true,
      poolAutomationTrigger: '6bars',
      poolAutomationTransitionId: 'dipToBlack',
    })
    expect(persistedCanvas).not.toHaveProperty('lastEventToken')
    expect(persistedCanvas).not.toHaveProperty('automaticMediaIds')

    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.canvasOrchestrationSettings).toMatchObject({
      poolAutomationEnabled: true,
      poolAutomationTrigger: '6bars',
      poolAutomationTransitionId: 'dipToBlack',
    })

    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    const legacyCanvas = legacy.canvasOrchestrationSettings as Record<string, unknown>
    delete legacyCanvas.poolAutomationEnabled
    delete legacyCanvas.poolAutomationTrigger
    delete legacyCanvas.poolAutomationTransitionId
    const migrated = mergeReactStoreState(legacy, useReactStore.getState())
    expect(migrated.canvasOrchestrationSettings.poolAutomationEnabled).toBe(false)
    expect(migrated.canvasOrchestrationSettings.poolAutomationTrigger).toBe('beat')
    expect(migrated.canvasOrchestrationSettings.poolAutomationTransitionId).toBe('crossfade')

    const corrupt = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    const corruptCanvas = corrupt.canvasOrchestrationSettings as Record<string, unknown>
    corruptCanvas.poolAutomationTrigger = '3bars'
    corruptCanvas.poolAutomationTransitionId = 'parallel-transition-engine'
    const repaired = mergeReactStoreState(corrupt, useReactStore.getState())
    expect(repaired.canvasOrchestrationSettings.poolAutomationTrigger).toBe('beat')
    expect(repaired.canvasOrchestrationSettings.poolAutomationTransitionId).toBe('crossfade')
  })

  it('sets Canvas Engine control scope from a click on either the CANVAS row or an individual layer, independent of selectedCanvasLayerId', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer('scope-media-a')
    const b = useReactStore.getState().addCanvasAuthoredLayer('scope-media-b')
    if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')

    useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: a.layer.id })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'layer', layerId: a.layer.id })

    useReactStore.getState().setCanvasControlScope({ kind: 'canvas' })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'canvas' })

    // An invalid/removed layer id can never become the live scope.
    useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: 'not-a-real-layer' })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'canvas' })
  })

  it('keeps Engine scope on Canvas with only one enabled authored layer even if a layer id is requested', () => {
    const only = useReactStore.getState().addCanvasAuthoredLayer('solo-authored-media')
    if (!only.ok) throw new Error('Expected one CANVAS layer')

    useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: only.layer.id })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'canvas' })
  })

  it('stores per-layer Engine overrides sparsely through the store action, resets one layer without disturbing another, and resets all layers together', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer('override-media-a')
    const b = useReactStore.getState().addCanvasAuthoredLayer('override-media-b')
    if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')

    const rotated = useReactStore.getState().updateCanvasLayerEngineOverrides(b.layer.id, { rotation: 25 })
    expect(rotated.ok).toBe(true)
    const findLayer = (layerId: string) => useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === layerId)
    expect(findLayer(b.layer.id)?.engineOverrides).toEqual({ rotation: 25 })
    expect(findLayer(a.layer.id)?.engineOverrides).toBeUndefined()

    const resetB = useReactStore.getState().resetCanvasLayerEngineOverrides(b.layer.id)
    expect(resetB.ok).toBe(true)
    expect(findLayer(b.layer.id)?.engineOverrides).toBeUndefined()

    useReactStore.getState().updateCanvasLayerEngineOverrides(a.layer.id, { scale: 0.5 })
    useReactStore.getState().updateCanvasLayerEngineOverrides(b.layer.id, { opacity: 0.4 })
    expect(findLayer(a.layer.id)?.engineOverrides).toEqual({ scale: 0.5 })
    expect(findLayer(b.layer.id)?.engineOverrides).toEqual({ opacity: 0.4 })

    useReactStore.getState().resetAllCanvasLayerEngineOverrides()
    expect(findLayer(a.layer.id)?.engineOverrides).toBeUndefined()
    expect(findLayer(b.layer.id)?.engineOverrides).toBeUndefined()

    const invalid = useReactStore.getState().updateCanvasLayerEngineOverrides('missing-layer', { rotation: 1 })
    expect(invalid.ok).toBe(false)
  })

  it('locks Canvas scope selection while any layer holds an Engine override, and unlocks once the final override clears', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer('lock-media-a')
    const b = useReactStore.getState().addCanvasAuthoredLayer('lock-media-b')
    if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
    useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: b.layer.id })

    useReactStore.getState().updateCanvasLayerEngineOverrides(b.layer.id, { rotation: 25 })
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.some(layer => (
      layer.engineOverrides != null && Object.keys(layer.engineOverrides).length > 0
    ))).toBe(true)

    // The store refuses to select Canvas scope while locked -- it stays on
    // the layer rather than silently normalizing the request away.
    useReactStore.getState().setCanvasControlScope({ kind: 'canvas' })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'layer', layerId: b.layer.id })

    useReactStore.getState().resetCanvasLayerEngineOverrides(b.layer.id)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.some(layer => layer.engineOverrides)).toBe(false)

    // Now that the last override is gone, Canvas scope becomes selectable again.
    useReactStore.getState().setCanvasControlScope({ kind: 'canvas' })
    expect(useReactStore.getState().canvasControlScope).toEqual({ kind: 'canvas' })
  })

  it('persists per-layer Engine overrides through a real JSON round-trip, and leaves old persisted layers without overrides valid', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer('persist-override-media-a')
    const b = useReactStore.getState().addCanvasAuthoredLayer('persist-override-media-b')
    if (!a.ok || !b.ok) throw new Error('Expected two CANVAS layers')
    useReactStore.getState().updateCanvasLayerEngineOverrides(a.layer.id, { rotation: 12, fitMode: 'cover' })

    const persisted = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState()))) as ReturnType<typeof reactStorePartialize>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    const restoredA = restored.canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === a.layer.id)
    const restoredB = restored.canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === b.layer.id)
    expect(restoredA?.engineOverrides).toEqual({ rotation: 12, fitMode: 'cover' })
    // A sibling layer with no overrides at all -- omitted by JSON, per the
    // sparse contract -- still loads as a fully valid layer.
    expect(restoredB?.engineOverrides).toBeUndefined()
    expect(restoredB?.mediaId).toBe('persist-override-media-b')

    // Simulate genuinely old saved state that predates engineOverrides
    // entirely (the key is absent from the object, not merely undefined).
    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    const legacyLayers = (legacy.canvasOrchestrationSettings as unknown as { authoredLayers: Array<Record<string, unknown>> }).authoredLayers
    for (const layer of legacyLayers) delete layer.engineOverrides
    const migrated = mergeReactStoreState(legacy, useReactStore.getState())
    expect(migrated.canvasOrchestrationSettings.authoredLayers).toHaveLength(2)
    expect(migrated.canvasOrchestrationSettings.authoredLayers.every(layer => layer.engineOverrides === undefined)).toBe(true)
    // Layer identity/effects (Add Effects) are unrelated to overrides and
    // still round-trip normally.
    expect(migrated.canvasOrchestrationSettings.authoredLayers.map(layer => layer.id).sort())
      .toEqual([a.layer.id, b.layer.id].sort())

    // Engine control scope is runtime-only (like selectedCanvasLayerId) and
    // is never restored from a persisted session.
    useReactStore.getState().setCanvasControlScope({ kind: 'layer', layerId: a.layer.id })
    const scopedPersisted = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState()))) as ReturnType<typeof reactStorePartialize>
    expect(scopedPersisted).not.toHaveProperty('canvasControlScope')
    const rehydratedScope = mergeReactStoreState(scopedPersisted, useReactStore.getState())
    expect(rehydratedScope.canvasControlScope).toEqual({ kind: 'canvas' })
  })

})
