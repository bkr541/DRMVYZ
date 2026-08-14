import { describe, expect, it } from 'vitest'
import { createCanvasAuthoringMediaDeletionGuard } from './CanvasAuthoringMediaDeletion'
import {
  CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
  normalizeCanvasAuthoringState,
  normalizeCanvasAuthoredLayers,
  isCanvasMediaPoolNameAvailable,
  resolveActiveCanvasMediaPool,
  reorderCanvasAuthoredLayers,
  isCanvasAuthoredLayerRenderEligible,
  setCanvasAuthoredLayerSoloState,
} from './CanvasAuthoringState'
import { MAX_CANVAS_AUTHORED_LAYERS, MAX_CANVAS_PERFORMANCE_LAYERS } from './CanvasPerformanceTypes'

describe('CANVAS canonical authoring state', () => {
  it('normalizes authored layer identity, duplicate media references, order, and the four-layer cap', () => {
    const normalized = normalizeCanvasAuthoredLayers([
      { id: 'layer-c', mediaId: 'media-shared', order: 3, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-a', mediaId: 'media-shared', order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', order: 2, enabled: false, solo: true, ownership: 'automatic', pinned: false },
      { id: 'layer-d', mediaId: 'media-d', order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-e', mediaId: 'media-e', order: 4, enabled: true, solo: false, ownership: 'manual', pinned: true },
    ])

    expect(MAX_CANVAS_AUTHORED_LAYERS).toBe(4)
    expect(MAX_CANVAS_PERFORMANCE_LAYERS).toBe(4)
    expect(normalized).toHaveLength(4)
    expect(normalized.map(layer => layer.id)).toEqual(['layer-a', 'layer-d', 'layer-b', 'layer-c'])
    expect(normalized.map(layer => layer.order)).toEqual([0, 1, 2, 3])
    expect(normalized.filter(layer => layer.mediaId === 'media-shared')).toHaveLength(2)
  })

  it('reorders by layer instance identity without changing media identity', () => {
    const layers = normalizeCanvasAuthoredLayers([
      { id: 'layer-a', mediaId: 'media-a', order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', order: 1, enabled: true, solo: false, ownership: 'automatic', pinned: false },
      { id: 'layer-c', mediaId: 'media-c', order: 2, enabled: true, solo: false, ownership: 'manual', pinned: true },
    ])

    const reordered = reorderCanvasAuthoredLayers(layers, 'layer-a', 2)
    expect(reordered?.map(layer => layer.id)).toEqual(['layer-b', 'layer-c', 'layer-a'])
    expect(reordered?.map(layer => layer.order)).toEqual([0, 1, 2])
    expect(reordered?.find(layer => layer.id === 'layer-a')?.mediaId).toBe('media-a')
  })

  it('applies a single-solo contract without destroying enabled state and exposes canonical render eligibility', () => {
    const layers = normalizeCanvasAuthoredLayers([
      { id: 'layer-a', mediaId: 'media-a', order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-b', mediaId: 'media-b', order: 1, enabled: false, solo: false, ownership: 'manual', pinned: true },
      { id: 'layer-c', mediaId: 'media-c', order: 2, enabled: true, solo: false, ownership: 'automatic', pinned: false },
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

    const unsoloed = setCanvasAuthoredLayerSoloState(soloed ?? [], 'layer-c', false)
    expect(unsoloed?.find(layer => layer.id === 'layer-b')?.enabled).toBe(false)
    expect(isCanvasAuthoredLayerRenderEligible(unsoloed ?? [], 'layer-a')).toBe(true)
    expect(isCanvasAuthoredLayerRenderEligible(unsoloed ?? [], 'layer-b')).toBe(false)
  })

  it('blocks shared-library deletion for layer references while pool-only references clean transactionally', () => {
    const layerGuard = createCanvasAuthoringMediaDeletionGuard(() => ({
      canvasOrchestrationSettings: {
        authoredLayers: [
          { id: 'layer-a', mediaId: 'media-a', order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'layer-b', mediaId: 'media-a', order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
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
})
