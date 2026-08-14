import { describe, expect, it } from 'vitest'
import { createCanvasAuthoringMediaDeletionGuard } from './CanvasAuthoringMediaDeletion'
import {
  CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
  normalizeCanvasAuthoringState,
  normalizeCanvasAuthoredLayers,
  reorderCanvasAuthoredLayers,
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

  it('blocks shared-library deletion while canonical layer or pool references exist', () => {
    const guard = createCanvasAuthoringMediaDeletionGuard(() => ({
      canvasOrchestrationSettings: {
        authoredLayers: [
          { id: 'layer-a', mediaId: 'media-a', order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'layer-b', mediaId: 'media-a', order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
        ],
        mediaPools: [{ id: 'pool-a', name: 'Main', mediaIds: ['media-a'] }],
      },
    }))

    const referenced = guard({ id: 'media-a' } as Parameters<typeof guard>[0])
    expect(referenced.allowed).toBe(false)
    if (referenced.allowed) throw new Error('Expected CANVAS authoring deletion refusal')
    expect(referenced.warning.message).toContain('2 CANVAS layers and 1 Media Pool')

    expect(guard({ id: 'media-b' } as Parameters<typeof guard>[0])).toEqual({ allowed: true })
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

    const intentionallyEmptyCanonical = normalizeCanvasAuthoringState({
      mediaPools: [],
      activeMediaPoolId: null,
      mediaPoolIds: ['stale-derived-id'],
    })
    expect(intentionallyEmptyCanonical.mediaPools).toEqual([])
    expect(intentionallyEmptyCanonical.mediaPoolIds).toEqual([])
  })
})
