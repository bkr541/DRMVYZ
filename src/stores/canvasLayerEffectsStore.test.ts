import { beforeEach, describe, expect, it } from 'vitest'
import { mergeReactStoreState, reactStorePartialize, useReactStore } from './reactStore'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
})

describe('CANVAS per-layer effect store and persistence', () => {
  it('gives single-media output a stable effect owner and preserves it through first Add as Layer promotion', () => {
    useReactStore.getState().selectCanvasMediaItem('primary-media')
    const primary = useReactStore.getState().getCanvasPrimaryLayer()
    expect(primary).not.toBeNull()
    if (!primary) throw new Error('Expected primary CANVAS layer owner')

    expect(useReactStore.getState().addCanvasLayerEffect(primary.id, 'bloom').ok).toBe(true)
    expect(useReactStore.getState().addCanvasLayerEffect(primary.id, 'echo').ok).toBe(true)
    expect(useReactStore.getState().getCanvasPrimaryLayer()?.effects).toEqual(['bloom', 'echo'])

    const added = useReactStore.getState().addCanvasAuthoredLayer('secondary-media', { preserveActiveSource: true })
    if (!added.ok) throw new Error('Expected Add as Layer promotion to succeed')

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.authoredLayers.map(layer => layer.mediaId)).toEqual([
      'primary-media',
      'secondary-media',
    ])
    expect(state.canvasOrchestrationSettings.authoredLayers[0]).toMatchObject({
      id: primary.id,
      effects: ['bloom', 'echo'],
    })
    expect(state.canvasOrchestrationSettings.primaryLayer).toEqual({ kind: 'authored', layerId: primary.id })
  })

  it('enforces per-layer uniqueness while allowing identical effects on different stable layer instances', () => {
    const first = useReactStore.getState().addCanvasAuthoredLayer('shared-media')
    const second = useReactStore.getState().addCanvasAuthoredLayer('shared-media')
    if (!first.ok || !second.ok) throw new Error('Expected duplicate-media layer instances')

    for (const effectId of ['bloom', 'echo', 'glitch', 'melt', 'stutter']) {
      expect(useReactStore.getState().addCanvasLayerEffect(first.layer.id, effectId).ok).toBe(true)
    }
    expect(useReactStore.getState().addCanvasLayerEffect(first.layer.id, 'bloom')).toMatchObject({
      ok: false,
      code: 'duplicate-effect',
    })
    expect(useReactStore.getState().addCanvasLayerEffect(second.layer.id, 'bloom').ok).toBe(true)
    expect(useReactStore.getState().getAvailableCanvasLayerEffects(second.layer.id)).not.toContain('bloom')

    expect(useReactStore.getState().removeCanvasLayerEffectAt(first.layer.id, 1).ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === first.layer.id)?.effects)
      .toEqual(['bloom', 'glitch', 'melt', 'stutter'])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === second.layer.id)?.effects)
      .toEqual(['bloom'])
  })

  it('keeps effect ownership attached to stable IDs when a middle layer is deleted and visible ordinals reflow', () => {
    const layers = ['a', 'b', 'c', 'd'].map(mediaId => useReactStore.getState().addCanvasAuthoredLayer(mediaId))
    if (layers.some(result => !result.ok)) throw new Error('Expected four layers')
    const [a, b, c, d] = layers
    if (!a.ok || !b.ok || !c.ok || !d.ok) throw new Error('Expected four layers')

    useReactStore.getState().addCanvasLayerEffect(a.layer.id, 'bloom')
    useReactStore.getState().addCanvasLayerEffect(b.layer.id, 'echo')
    useReactStore.getState().addCanvasLayerEffect(b.layer.id, 'glitch')
    useReactStore.getState().addCanvasLayerEffect(c.layer.id, 'melt')
    useReactStore.getState().addCanvasLayerEffect(d.layer.id, 'stutter')

    expect(useReactStore.getState().removeCanvasAuthoredLayer(b.layer.id).ok).toBe(true)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => ({
      id: layer.id,
      order: layer.order,
      effects: layer.effects,
    }))).toEqual([
      { id: a.layer.id, order: 0, effects: ['bloom'] },
      { id: c.layer.id, order: 1, effects: ['melt'] },
      { id: d.layer.id, order: 2, effects: ['stutter'] },
    ])
  })

  it('round-trips effect stacks and safely migrates missing/malformed persisted values', () => {
    const first = useReactStore.getState().addCanvasAuthoredLayer('persist-a')
    const second = useReactStore.getState().addCanvasAuthoredLayer('persist-b')
    if (!first.ok || !second.ok) throw new Error('Expected persistence layers')
    useReactStore.getState().addCanvasLayerEffect(first.layer.id, 'echo')
    useReactStore.getState().addCanvasLayerEffect(first.layer.id, 'bloom')
    useReactStore.getState().addCanvasLayerEffect(second.layer.id, 'melt')

    const persisted = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState()))) as ReturnType<typeof reactStorePartialize>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.canvasOrchestrationSettings.authoredLayers.map(layer => layer.effects)).toEqual([
      ['echo', 'bloom'],
      ['melt'],
    ])

    const legacy = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    for (const layer of legacy.canvasOrchestrationSettings.authoredLayers as unknown as Array<Record<string, unknown>>) {
      delete layer.effects
    }
    const legacyRestored = mergeReactStoreState(legacy, useReactStore.getState())
    expect(legacyRestored.canvasOrchestrationSettings.authoredLayers.map(layer => layer.effects)).toEqual([[], []])

    const malformed = JSON.parse(JSON.stringify(persisted)) as typeof persisted
    ;(malformed.canvasOrchestrationSettings.authoredLayers[0] as unknown as Record<string, unknown>).effects = [
      'bloom', 'future-effect', 'bloom', 'echo', 'glitch', 'melt', 'stutter', 'echo',
    ]
    const normalized = mergeReactStoreState(malformed, useReactStore.getState())
    expect(normalized.canvasOrchestrationSettings.authoredLayers[0]?.effects).toEqual([
      'bloom', 'echo', 'glitch', 'melt', 'stutter',
    ])
  })

  it('replaces detached primary effect ownership when Make Active starts a new single-media composition', () => {
    useReactStore.getState().selectCanvasMediaItem('single-a')
    const primary = useReactStore.getState().getCanvasPrimaryLayer()
    if (!primary) throw new Error('Expected detached primary')
    useReactStore.getState().addCanvasLayerEffect(primary.id, 'stutter')

    useReactStore.getState().selectCanvasMediaItem('single-b')
    const replacement = useReactStore.getState().getCanvasPrimaryLayer()
    expect(replacement).toMatchObject({ mediaId: 'single-b', effects: [] })
    expect(replacement?.id).not.toBe(primary.id)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])

    const persisted = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState()))) as ReturnType<typeof reactStorePartialize>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(restored.canvasOrchestrationSettings.primaryLayer).toMatchObject({
      kind: 'detached',
      layer: { id: replacement?.id, mediaId: 'single-b', effects: [] },
    })
  })
})
