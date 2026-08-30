import { describe, expect, it } from 'vitest'
import {
  addCanvasLayerEffectState,
  clearCanvasLayerEffectsState,
  getAvailableCanvasLayerEffects,
  normalizeCanvasAuthoredLayers,
  normalizeCanvasLayerEffects,
  removeCanvasLayerEffectAtState,
  setCanvasLayerEffectState,
} from './CanvasAuthoringState'
import {
  CANVAS_LAYER_EFFECT_IDS,
  type CanvasAuthoredLayer,
} from './CanvasPerformanceTypes'

function layer(id: string, effects: CanvasAuthoredLayer['effects'] = []): CanvasAuthoredLayer {
  return {
    id,
    mediaId: `media-${id}`,
    effects,
    order: 0,
    enabled: true,
    solo: false,
    ownership: 'manual',
    pinned: true,
  }
}

describe('CANVAS per-layer effect state', () => {
  it('normalizes missing, unknown, duplicate, and over-limit persisted effects deterministically', () => {
    expect(normalizeCanvasLayerEffects(undefined)).toEqual([])
    expect(normalizeCanvasLayerEffects([
      'bloom',
      'future-effect',
      'bloom',
      'echo',
      'glitch',
      'melt',
      'stutter',
      'echo',
    ])).toEqual(['bloom', 'echo', 'glitch', 'melt', 'stutter'])

    const [legacy] = normalizeCanvasAuthoredLayers([{
      id: 'legacy-layer',
      mediaId: 'legacy-media',
      order: 0,
      enabled: true,
      ownership: 'manual',
      pinned: true,
    }])
    expect(legacy?.effects).toEqual([])
  })

  it('adds up to the five-value vocabulary, rejects duplicates/sixth selections, and derives availability', () => {
    let authoredLayers = [layer('a')]
    for (const effectId of CANVAS_LAYER_EFFECT_IDS) {
      const mutation = addCanvasLayerEffectState(authoredLayers, null, 'a', effectId)
      expect(mutation.ok).toBe(true)
      if (!mutation.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
      authoredLayers = mutation.authoredLayers
    }

    expect(authoredLayers[0]?.effects).toEqual(CANVAS_LAYER_EFFECT_IDS)
    expect(getAvailableCanvasLayerEffects(authoredLayers, null, 'a')).toEqual([])
    expect(addCanvasLayerEffectState(authoredLayers, null, 'a', 'bloom')).toMatchObject({
      ok: false,
      code: 'duplicate-effect',
    })
    expect(addCanvasLayerEffectState(authoredLayers, null, 'a', 'unknown')).toMatchObject({
      ok: false,
      code: 'invalid-effect-id',
    })
  })

  it('keeps identical effects independent across layers and preserves stack order through replacement/removal', () => {
    let authoredLayers = [layer('a'), { ...layer('b'), order: 1 }]

    const bloomA = addCanvasLayerEffectState(authoredLayers, null, 'a', 'bloom')
    if (!bloomA.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    authoredLayers = bloomA.authoredLayers
    const echoA = addCanvasLayerEffectState(authoredLayers, null, 'a', 'echo')
    if (!echoA.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    authoredLayers = echoA.authoredLayers
    const glitchA = addCanvasLayerEffectState(authoredLayers, null, 'a', 'glitch')
    if (!glitchA.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    authoredLayers = glitchA.authoredLayers

    const bloomB = addCanvasLayerEffectState(authoredLayers, null, 'b', 'bloom')
    if (!bloomB.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    authoredLayers = bloomB.authoredLayers

    const replaced = setCanvasLayerEffectState(authoredLayers, null, 'a', 1, 'melt')
    if (!replaced.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    expect(replaced.layer.effects).toEqual(['bloom', 'melt', 'glitch'])
    expect(replaced.authoredLayers.find(candidate => candidate.id === 'b')?.effects).toEqual(['bloom'])

    const removed = removeCanvasLayerEffectAtState(replaced.authoredLayers, null, 'a', 1)
    if (!removed.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    expect(removed.layer.effects).toEqual(['bloom', 'glitch'])

    const cleared = clearCanvasLayerEffectsState(removed.authoredLayers, null, 'a')
    if (!cleared.ok) throw new Error('Expected CANVAS layer effect mutation to succeed')
    expect(cleared.layer.effects).toEqual([])
    expect(cleared.authoredLayers.find(candidate => candidate.id === 'b')?.effects).toEqual(['bloom'])
  })
})
