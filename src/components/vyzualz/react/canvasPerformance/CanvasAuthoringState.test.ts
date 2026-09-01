import { describe, expect, it } from 'vitest'
import { createCanvasAuthoringMediaDeletionGuard } from './CanvasAuthoringMediaDeletion'
import {
  CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
  hasAnyCanvasLayerEngineOverrides,
  normalizeCanvasAuthoringState,
  normalizeCanvasAuthoredLayers,
  normalizeCanvasControlScope,
  isCanvasMediaPoolNameAvailable,
  resetAllCanvasLayerEngineOverridesState,
  resetCanvasLayerEngineOverridesState,
  resolveActiveCanvasMediaPool,
  resolveCanvasEnabledAuthoredLayers,
  resolveCanvasLayerEffectiveEngineSettings,
  reorderCanvasAuthoredLayers,
  isCanvasAuthoredLayerRenderEligible,
  resolveCanvasEffectiveAuthoredLayers,
  setCanvasAuthoredLayerSoloState,
  updateCanvasLayerEngineOverridesState,
} from './CanvasAuthoringState'
import { MAX_CANVAS_AUTHORED_LAYERS, MAX_CANVAS_PERFORMANCE_LAYERS, type CanvasAuthoredLayer } from './CanvasPerformanceTypes'

function makeLayer(overrides: Partial<CanvasAuthoredLayer> & { id: string; mediaId: string }): CanvasAuthoredLayer {
  return {
    effects: [],
    order: 0,
    enabled: true,
    solo: false,
    ownership: 'manual',
    pinned: true,
    ...overrides,
  }
}

describe('CANVAS canonical authoring state', () => {
  it('normalizes stored authored layer identity, duplicate media references, and canonical order independently of the four-active-media cap', () => {
    const normalized = normalizeCanvasAuthoredLayers([
      { id: 'layer-c', mediaId: 'media-shared', effects: [], order: 3, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-a', mediaId: 'media-shared', effects: [], order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', effects: [], order: 2, enabled: false, solo: true, ownership: 'automatic', pinned: false },
      { id: 'layer-d', mediaId: 'media-d', effects: [], order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-e', mediaId: 'media-e', effects: [], order: 4, enabled: true, solo: false, ownership: 'manual', pinned: true },
    ])

    expect(MAX_CANVAS_AUTHORED_LAYERS).toBe(4)
    expect(MAX_CANVAS_PERFORMANCE_LAYERS).toBe(4)
    expect(normalized).toHaveLength(5)
    expect(normalized.map(layer => layer.id)).toEqual(['layer-a', 'layer-d', 'layer-b', 'layer-c', 'layer-e'])
    expect(normalized.map(layer => layer.order)).toEqual([0, 1, 2, 3, 4])
    expect(normalized.filter(layer => layer.mediaId === 'media-shared')).toHaveLength(2)
  })

  it('reorders by layer instance identity without changing media identity', () => {
    const layers = normalizeCanvasAuthoredLayers([
      { id: 'layer-a', mediaId: 'media-a', effects: [], order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', effects: [], order: 1, enabled: true, solo: false, ownership: 'automatic', pinned: false },
      { id: 'layer-c', mediaId: 'media-c', effects: [], order: 2, enabled: true, solo: false, ownership: 'manual', pinned: true },
    ])

    const reordered = reorderCanvasAuthoredLayers(layers, 'layer-a', 2)
    expect(reordered?.map(layer => layer.id)).toEqual(['layer-b', 'layer-c', 'layer-a'])
    expect(reordered?.map(layer => layer.order)).toEqual([0, 1, 2])
    expect(reordered?.find(layer => layer.id === 'layer-a')?.mediaId).toBe('media-a')
  })

  it('applies a single-solo contract without destroying enabled state and exposes canonical render eligibility', () => {
    const layers = normalizeCanvasAuthoredLayers([
      { id: 'layer-a', mediaId: 'media-a', effects: [], order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', effects: [], order: 1, enabled: false, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-c', mediaId: 'media-c', effects: [], order: 2, enabled: true, solo: false, ownership: 'automatic', pinned: false },
    ])

    const soloed = setCanvasAuthoredLayerSoloState(layers, 'layer-c', true)
    expect(soloed?.map(layer => ({ id: layer.id, enabled: layer.enabled, solo: layer.solo }))).toEqual([
      { id: 'layer-a', enabled: true, solo: false },
      { id: 'layer-b', enabled: false, solo: false },
      { id: 'layer-c', enabled: true, solo: true },
    ])
    expect(isCanvasAuthoredLayerRenderEligible(soloed ?? [], 'layer-a')).toBe(false)
    expect(isCanvasAuthoredLayerRenderEligible(soloed ?? [], 'layer-b')).toBe(false)
    expect(isCanvasAuthoredLayerRenderEligible(soloed ?? [], 'layer-c')).toBe(true)
    expect(resolveCanvasEffectiveAuthoredLayers(soloed ?? []).map(layer => layer.id)).toEqual(['layer-c'])

    const unsoloed = setCanvasAuthoredLayerSoloState(soloed ?? [], 'layer-c', false)
    expect(unsoloed?.find(layer => layer.id === 'layer-b')?.enabled).toBe(false)
    expect(isCanvasAuthoredLayerRenderEligible(unsoloed ?? [], 'layer-a')).toBe(true)
    expect(isCanvasAuthoredLayerRenderEligible(unsoloed ?? [], 'layer-b')).toBe(false)
    expect(resolveCanvasEffectiveAuthoredLayers(unsoloed ?? []).map(layer => layer.id)).toEqual(['layer-a', 'layer-c'])
  })

  it('blocks shared-library deletion for layer references while pool-only references clean transactionally', () => {
    const layerGuard = createCanvasAuthoringMediaDeletionGuard(() => ({
      canvasOrchestrationSettings: {
        authoredLayers: [
          { id: 'layer-a', mediaId: 'media-a', effects: [], order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'layer-b', mediaId: 'media-a', effects: [], order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
        ],
        mediaPools: [{ id: 'pool-a', name: 'Main', mediaIds: ['media-a'] }],
        activeMediaPoolId: 'pool-a',
      },
    }))

    const referenced = layerGuard({ id: 'media-a' } as Parameters<typeof layerGuard>[0])
    expect(referenced.allowed).toBe(false)
    if (referenced.allowed) throw new Error('Expected CANVAS authoring deletion refusal')
    expect(referenced.warning.message).toContain('2 CANVAS layers and 1 Media Pool')

    let mediaPools = [
      { id: 'pool-a', name: 'Main', mediaIds: ['media-a', 'media-b'] },
      { id: 'pool-b', name: 'Drop', mediaIds: ['media-a'] },
    ]
    const poolGuard = createCanvasAuthoringMediaDeletionGuard(() => ({
      canvasOrchestrationSettings: { authoredLayers: [], mediaPools, activeMediaPoolId: 'pool-a' },
      setCanvasOrchestrationSettings: patch => {
        if (patch.mediaPools) mediaPools = patch.mediaPools
      },
    }))
    const cleanup = poolGuard({ id: 'media-a' } as Parameters<typeof poolGuard>[0])
    expect(cleanup.allowed).toBe(true)
    if (!cleanup.allowed) throw new Error(cleanup.warning.message)
    expect(cleanup.apply?.()).toBe(true)
    expect(mediaPools.map(pool => pool.mediaIds)).toEqual([['media-b'], []])
    cleanup.rollback?.()
    expect(mediaPools.map(pool => pool.mediaIds)).toEqual([['media-a', 'media-b'], ['media-a']])

    expect(poolGuard({ id: 'media-c' } as Parameters<typeof poolGuard>[0])).toEqual({ allowed: true })
  })

  it('resolves the canonical active Pool and applies case-insensitive name availability without conflating ids', () => {
    const pools = [
      { id: 'pool-a', name: 'Warmup', mediaIds: ['media-a'] },
      { id: 'pool-b', name: 'Drop', mediaIds: ['media-b'] },
    ]
    expect(resolveActiveCanvasMediaPool({ mediaPools: pools, activeMediaPoolId: 'pool-b' })?.mediaIds).toEqual(['media-b'])
    expect(resolveActiveCanvasMediaPool({ mediaPools: pools, activeMediaPoolId: 'missing' })).toBeNull()
    expect(isCanvasMediaPoolNameAvailable(pools, '  warmup  ')).toBe(false)
    expect(isCanvasMediaPoolNameAvailable(pools, 'WARMUP', 'pool-a')).toBe(true)
    expect(isCanvasMediaPoolNameAvailable(pools, 'Build')).toBe(true)
    expect(isCanvasMediaPoolNameAvailable(pools, '   ')).toBe(false)
  })

  it('migrates a legacy flat pool once and derives compatibility ids from the active named pool', () => {
    const migrated = normalizeCanvasAuthoringState({ mediaPoolIds: ['media-a', 'media-b', 'media-a'] })
    expect(migrated.mediaPools).toEqual([{
      id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
      name: 'Performance Pool',
      mediaIds: ['media-a', 'media-b'],
    }])
    expect(migrated.activeMediaPoolId).toBe(CANVAS_LEGACY_COMPATIBILITY_POOL_ID)
    expect(migrated.mediaPoolIds).toEqual(['media-a', 'media-b'])

    const named = normalizeCanvasAuthoringState({
      mediaPools: [
        { id: 'pool-a', name: 'A', mediaIds: ['media-a'] },
        { id: 'pool-b', name: 'B', mediaIds: ['media-b'] },
      ],
      activeMediaPoolId: 'pool-b',
      mediaPoolIds: ['stale-legacy-id'],
    })
    expect(named.mediaPoolIds).toEqual(['media-b'])

    const corruptActive = normalizeCanvasAuthoringState({
      mediaPools: [{ id: 'pool-a', name: 'A', mediaIds: ['media-a'] }],
      activeMediaPoolId: 'missing-pool',
    })
    expect(corruptActive.activeMediaPoolId).toBeNull()
    expect(corruptActive.mediaPoolIds).toEqual([])

    const intentionallyEmptyCanonical = normalizeCanvasAuthoringState({
      mediaPools: [],
      activeMediaPoolId: null,
      mediaPoolIds: ['stale-derived-id'],
    })
    expect(intentionallyEmptyCanonical.mediaPools).toEqual([])
    expect(intentionallyEmptyCanonical.mediaPoolIds).toEqual([])
  })

  it('normalizes engineOverrides sparsely, dropping invalid fields and empty results while preserving effects', () => {
    const layers = normalizeCanvasAuthoredLayers([
      {
        ...makeLayer({ id: 'layer-a', mediaId: 'media-a', effects: ['bloom', 'echo'] }),
        // Deliberately malformed like corrupt persisted data -- `scale`
        // should be dropped without poisoning the sibling valid fields.
        engineOverrides: { rotation: 25, scale: 'not-a-number', fitMode: 'contain' },
      },
      makeLayer({ id: 'layer-b', mediaId: 'media-b', engineOverrides: {} }),
      makeLayer({ id: 'layer-c', mediaId: 'media-c', engineOverrides: { scale: 999, positionX: -500, opacity: 2 } }),
      makeLayer({ id: 'layer-d', mediaId: 'media-d' }),
    ])

    const a = layers.find(layer => layer.id === 'layer-a')
    // Only the valid keys survive; invalid `scale` is dropped without
    // poisoning the rest of the record, and effects are untouched.
    expect(a?.engineOverrides).toEqual({ rotation: 25, fitMode: 'contain' })
    expect(a?.effects).toEqual(['bloom', 'echo'])

    // An empty overrides object normalizes to undefined, not `{}`.
    expect(layers.find(layer => layer.id === 'layer-b')?.engineOverrides).toBeUndefined()

    // Out-of-range numeric overrides clamp to the same bounds as the Canvas
    // baseline (CanvasEngineSettings) rather than being silently accepted.
    expect(layers.find(layer => layer.id === 'layer-c')?.engineOverrides).toEqual({ scale: 4, positionX: -100, opacity: 1 })

    // Layers with no override data at all remain valid with the field absent.
    expect(layers.find(layer => layer.id === 'layer-d')?.engineOverrides).toBeUndefined()

    expect(hasAnyCanvasLayerEngineOverrides(layers)).toBe(true)
    expect(hasAnyCanvasLayerEngineOverrides(layers.filter(layer => layer.id !== 'layer-a' && layer.id !== 'layer-c'))).toBe(false)
  })

  it('keeps enabled-layer counting independent of Solo for Canvas-row/scope eligibility', () => {
    const layers = normalizeCanvasAuthoredLayers([
      makeLayer({ id: 'layer-a', mediaId: 'media-a', solo: true }),
      makeLayer({ id: 'layer-b', mediaId: 'media-b' }),
      makeLayer({ id: 'layer-c', mediaId: 'media-c', enabled: false }),
    ])

    // Soloing layer-a narrows the effective renderer to one layer...
    expect(resolveCanvasEffectiveAuthoredLayers(layers).map(layer => layer.id)).toEqual(['layer-a'])
    // ...but both enabled layers still count for the editing surface.
    expect(resolveCanvasEnabledAuthoredLayers(layers).map(layer => layer.id)).toEqual(['layer-a', 'layer-b'])
  })

  it('validates control scope: requires the target layer to exist and at least two enabled layers', () => {
    const twoLayers = normalizeCanvasAuthoredLayers([
      makeLayer({ id: 'layer-a', mediaId: 'media-a' }),
      makeLayer({ id: 'layer-b', mediaId: 'media-b' }),
    ])
    const oneLayer = normalizeCanvasAuthoredLayers([makeLayer({ id: 'layer-a', mediaId: 'media-a' })])

    expect(normalizeCanvasControlScope({ kind: 'layer', layerId: 'layer-a' }, twoLayers)).toEqual({ kind: 'layer', layerId: 'layer-a' })
    expect(normalizeCanvasControlScope({ kind: 'layer', layerId: 'missing' }, twoLayers)).toEqual({ kind: 'canvas' })
    // Single-Layer Behavior: with fewer than two enabled layers, layer scope
    // is not a real concept even if the layer id itself is valid.
    expect(normalizeCanvasControlScope({ kind: 'layer', layerId: 'layer-a' }, oneLayer)).toEqual({ kind: 'canvas' })
    expect(normalizeCanvasControlScope({ kind: 'canvas' }, twoLayers)).toEqual({ kind: 'canvas' })
    expect(normalizeCanvasControlScope(null, twoLayers)).toEqual({ kind: 'canvas' })
    expect(normalizeCanvasControlScope('garbage', twoLayers)).toEqual({ kind: 'canvas' })
  })

  it('merges sparse per-layer overrides, supports single-field clearing, and isolates other layers', () => {
    const layers = normalizeCanvasAuthoredLayers([
      makeLayer({ id: 'layer-a', mediaId: 'media-a' }),
      makeLayer({ id: 'layer-b', mediaId: 'media-b' }),
    ])

    const rotated = updateCanvasLayerEngineOverridesState(layers, 'layer-b', { rotation: 25 })
    if (!rotated.ok) throw new Error('Expected override update to succeed')
    expect(rotated.layer.engineOverrides).toEqual({ rotation: 25 })
    // Do NOT populate redundant copies of the other Display fields.
    expect(Object.keys(rotated.layer.engineOverrides ?? {})).toEqual(['rotation'])
    expect(rotated.authoredLayers.find(layer => layer.id === 'layer-a')?.engineOverrides).toBeUndefined()

    const scaled = updateCanvasLayerEngineOverridesState(rotated.authoredLayers, 'layer-b', { scale: 0.6 })
    if (!scaled.ok) throw new Error('Expected second override update to succeed')
    expect(scaled.layer.engineOverrides).toEqual({ rotation: 25, scale: 0.6 })

    // Explicitly clearing one field (undefined) removes just that key.
    const clearedRotation = updateCanvasLayerEngineOverridesState(scaled.authoredLayers, 'layer-b', { rotation: undefined })
    if (!clearedRotation.ok) throw new Error('Expected field-clear update to succeed')
    expect(clearedRotation.layer.engineOverrides).toEqual({ scale: 0.6 })

    expect(updateCanvasLayerEngineOverridesState(layers, 'missing-layer', { rotation: 1 })).toEqual({ ok: false, code: 'layer-not-found' })
  })

  it('refuses to create an override while fewer than two layers are enabled', () => {
    const oneLayer = normalizeCanvasAuthoredLayers([makeLayer({ id: 'layer-a', mediaId: 'media-a' })])
    expect(updateCanvasLayerEngineOverridesState(oneLayer, 'layer-a', { rotation: 10 })).toEqual({
      ok: false,
      code: 'layer-scope-unavailable',
    })
  })

  it('resets one layer without disturbing another, and resets all layers together', () => {
    const initial = normalizeCanvasAuthoredLayers([
      makeLayer({ id: 'layer-a', mediaId: 'media-a', effects: ['glitch'] }),
      makeLayer({ id: 'layer-b', mediaId: 'media-b' }),
    ])
    const afterA = updateCanvasLayerEngineOverridesState(initial, 'layer-a', { rotation: 10 })
    if (!afterA.ok) throw new Error('Expected layer-a override to succeed')
    const afterB = updateCanvasLayerEngineOverridesState(afterA.authoredLayers, 'layer-b', { scale: 0.5 })
    if (!afterB.ok) throw new Error('Expected layer-b override to succeed')
    const layers = afterB.authoredLayers
    expect(hasAnyCanvasLayerEngineOverrides(layers)).toBe(true)

    const resetA = resetCanvasLayerEngineOverridesState(layers, 'layer-a')
    if (!resetA.ok) throw new Error('Expected reset to succeed')
    expect(resetA.layer.engineOverrides).toBeUndefined()
    expect(resetA.layer.effects).toEqual(['glitch']) // effects (Add Effects) are untouched by Engine override resets
    expect(resetA.authoredLayers.find(layer => layer.id === 'layer-b')?.engineOverrides).toEqual({ scale: 0.5 })
    expect(hasAnyCanvasLayerEngineOverrides(resetA.authoredLayers)).toBe(true)

    const resetAll = resetAllCanvasLayerEngineOverridesState(resetA.authoredLayers)
    expect(hasAnyCanvasLayerEngineOverrides(resetAll)).toBe(false)
    expect(resetAll.every(layer => layer.engineOverrides === undefined)).toBe(true)

    expect(resetCanvasLayerEngineOverridesState(layers, 'missing-layer')).toEqual({ ok: false, code: 'layer-not-found' })
  })

  it('resolves per-layer effective Engine settings: baseline when no override exists, per-field override otherwise (Phase 2 inheritance)', () => {
    const baseline = { fitMode: 'contain' as const, scale: 1, positionX: 0, positionY: 0, rotation: 0, opacity: 1 }

    // No override at all -- every field inherits the Canvas baseline exactly.
    expect(resolveCanvasLayerEffectiveEngineSettings(baseline, undefined)).toEqual(baseline)

    // A sparse override supplies only the fields it customizes; the rest
    // still resolve straight from the baseline.
    const partial = resolveCanvasLayerEffectiveEngineSettings(baseline, { scale: 0.65, rotation: 25 })
    expect(partial).toEqual({ fitMode: 'contain', scale: 0.65, positionX: 0, positionY: 0, rotation: 25, opacity: 1 })

    // A non-default Canvas baseline still shows through for every
    // non-overridden field.
    const customBaseline = { fitMode: 'cover' as const, scale: 1.4, positionX: -20, positionY: 10, rotation: 5, opacity: 0.8 }
    expect(resolveCanvasLayerEffectiveEngineSettings(customBaseline, { opacity: 0.3 })).toEqual({
      ...customBaseline,
      opacity: 0.3,
    })

    // A full override on every field ignores the baseline entirely.
    const fullOverride = { fitMode: 'stretch' as const, scale: 0.5, positionX: 30, positionY: -30, rotation: 90, opacity: 0.2 }
    expect(resolveCanvasLayerEffectiveEngineSettings(baseline, fullOverride)).toEqual(fullOverride)
  })
})
