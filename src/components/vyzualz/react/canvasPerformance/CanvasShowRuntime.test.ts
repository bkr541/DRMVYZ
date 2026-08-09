import { describe, expect, it } from 'vitest'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY,
  CANVAS_SHOW_MANAGER_DEFAULT_FX,
  CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION,
  createCanvasShowManagerShow,
  type CanvasShowManagerMediaElement,
} from '../../showManager/CanvasShowManagerDomain'
import type { CanvasMediaItem } from '../ReactTypes'
import { resolveCanvasShowRuntimeFrame } from './CanvasShowRuntime'

const context = { audioTimeSec: 0 } as SharedPerformanceContext
const video = (id: string, durationSec = 12): CanvasMediaItem => ({
  id,
  name: id,
  type: 'video',
  objectUrl: `blob:${id}`,
  durationSec,
} as CanvasMediaItem)

function element(id: string, mediaId: string, layer: 0 | 1 | 2 | 3, start: number, end: number, sourceIn = 0, sourceOut = 4): CanvasShowManagerMediaElement {
  return {
    id,
    mediaId,
    layer,
    showStartSec: start,
    showEndSec: end,
    sourceInSec: sourceIn,
    sourceOutSec: sourceOut,
    display: { ...CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY },
    transitions: {
      in: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION },
      out: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION },
    },
    fx: { ...CANVAS_SHOW_MANAGER_DEFAULT_FX },
  }
}

describe('Canvas Show production frame resolver', () => {
  it('uses start-inclusive/end-exclusive adjacency with no double-active frame', () => {
    const show = createCanvasShowManagerShow('Adjacency')
    show.mediaElements = [element('a', 'one', 0, 0, 8), element('b', 'two', 0, 8, 16)]
    const before = resolveCanvasShowRuntimeFrame({ show, showTimeSec: 7.999, mediaItems: [video('one'), video('two')], context })!
    const boundary = resolveCanvasShowRuntimeFrame({ show, showTimeSec: 8, mediaItems: [video('one'), video('two')], context })!
    expect(before.layers.map(layer => layer.id)).toEqual(['a'])
    expect(boundary.layers.map(layer => layer.id)).toEqual(['b'])
  })

  it('derives trimmed source time deterministically across seeks and loops', () => {
    const show = createCanvasShowManagerShow('Trim loop')
    show.mediaElements = [element('clip', 'video', 0, 2, 18, 3, 7)]
    const resolve = (time: number) => resolveCanvasShowRuntimeFrame({ show, showTimeSec: time, mediaItems: [video('video')], context })!.layers[0]!.playback.phaseSec
    expect(resolve(2)).toBe(3)
    expect(resolve(7.5)).toBe(4.5)
    expect(resolve(15.5)).toBe(4.5)
    expect(resolve(3)).toBe(4)
  })

  it('orders four simultaneous layers bottom-to-top and isolates missing media', () => {
    const show = createCanvasShowManagerShow('Four')
    show.mediaElements = [0, 1, 2, 3].map(layer => element(`e${layer}`, `m${layer}`, layer as 0 | 1 | 2 | 3, 0, 8))
    const frame = resolveCanvasShowRuntimeFrame({ show, showTimeSec: 1, mediaItems: [video('m0'), video('m1'), video('m2')], context })!
    expect(frame.layers.map(layer => layer.zIndex)).toEqual([0, 1, 2, 3])
    expect(frame.layers[3]!.enabled).toBe(false)
    expect(frame.layers.slice(0, 3).every(layer => layer.enabled)).toBe(true)
    expect(frame.diagnostics).toContain('Missing media for Layer 4: m3')
  })

  it('resolves Display, transition, and FX independently for each authored layer', () => {
    const show = createCanvasShowManagerShow('Isolated treatment')
    const treated = element('treated', 'one', 0, 0, 8)
    treated.display = { scale: 1.5, x: 0.25, y: -0.4, brightness: 1.2, opacity: 0.8, rotation: 35 }
    treated.transitions.in = { type: 'fade', durationSec: 2, direction: 'left' }
    treated.fx = { blur: 4, contrast: 1.3, saturation: 0.7, hue: 40, glow: 0.5 }
    const neutral = element('neutral', 'two', 1, 0, 8)
    show.mediaElements = [treated, neutral]

    const frame = resolveCanvasShowRuntimeFrame({ show, showTimeSec: 1, mediaItems: [video('one'), video('two')], context })!
    expect(frame.layers[0]).toMatchObject({
      id: 'treated', x: 0.25, y: -0.4, scaleX: 1.5, scaleY: 1.5, rotation: 35, opacity: 0.4,
      showElementTreatment: {
        brightness: 1.2, blurPx: 4, contrast: 1.3, saturation: 0.7, hueDeg: 40, glow: 0.5,
        transitionInProgress: 0.5,
      },
    })
    expect(frame.layers[0]!.showElementTreatment?.compositorFilter).toContain('brightness(1.200)')
    expect(frame.layers[1]).toMatchObject({
      id: 'neutral', x: 0, y: 0, scaleX: 1, rotation: 0, opacity: 1,
      showElementTreatment: { compositorFilter: 'none', glow: 0 },
    })
  })

  it('keeps the terminal Show boundary on the final authored frame', () => {
    const show = createCanvasShowManagerShow('Terminal')
    show.mediaElements = [element('last', 'still', 3, 48, 56)]
    const still = { ...video('still'), type: 'image' } as CanvasMediaItem
    expect(resolveCanvasShowRuntimeFrame({ show, showTimeSec: 56, mediaItems: [still], context })!.layers[0]!.id).toBe('last')
  })
})
