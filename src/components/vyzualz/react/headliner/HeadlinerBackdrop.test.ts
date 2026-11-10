// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fitBackdrop, HeadlinerBackdropLoader } from './HeadlinerBackdrop'
import { createVirtualBackdropProcessor } from './HeadlinerBackdropEffect'
import { resolveHeadlinerParameters } from './HeadlinerEffectCatalog'
import { HEADLINER_IDLE_TIMING } from './HeadlinerTiming'
import type { HeadlinerEffectRenderArgs } from './HeadlinerEffectKit'
import type { HeadlinerSegmentSample, HeadlinerSegmentSource } from './HeadlinerSegmentation'

describe('fitBackdrop', () => {
  it('fills the frame by cropping the overflow, centred', () => {
    expect(fitBackdrop({ width: 1000, height: 1000 }, { width: 1600, height: 900 }, 'cover'))
      .toEqual({ x: 0, y: -350, width: 1600, height: 1600 })
  })

  it('fits inside the frame with bars, centred', () => {
    expect(fitBackdrop({ width: 1000, height: 1000 }, { width: 1600, height: 900 }, 'contain'))
      .toEqual({ x: 350, y: 0, width: 900, height: 900 })
  })
})

describe('HeadlinerBackdropLoader', () => {
  it('has no frame until something is chosen and loaded, and clears on null', () => {
    const loader = new HeadlinerBackdropLoader()
    expect(loader.getFrame()).toBeNull()
    loader.setMedia({ id: 'm1', url: 'https://example.test/a.png', kind: 'image', revision: '1' })
    // jsdom never fires the image's load event, so it stays not-ready rather than handing out a half-loaded picture.
    expect(loader.getFrame()).toBeNull()
    loader.setMedia(null)
    expect(loader.getFrame()).toBeNull()
    loader.dispose()
  })
})

interface DrawCall { source: unknown; composite: string }

let draws: DrawCall[]
let fills: string[]
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()

beforeEach(() => {
  draws = []
  fills = []
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    const existing = contexts.get(this)
    if (existing) return existing as never
    const context = {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      fillRect: function fillRect(this: { fillStyle: string }) { fills.push(String(this.fillStyle)) },
      drawImage: function drawImage(this: { globalCompositeOperation: string }, source: unknown) {
        draws.push({ source, composite: this.globalCompositeOperation })
      },
    }
    contexts.set(this, context as unknown as CanvasRenderingContext2D)
    return context as never
  })
})

afterEach(() => vi.restoreAllMocks())

function stubSegmenter(mask: HTMLCanvasElement | null): () => HeadlinerSegmentSource {
  const sample: HeadlinerSegmentSample = { status: mask ? 'ready' : 'loading', mask, sequence: 1 }
  return () => ({ acquire: () => undefined, release: () => undefined, sample: () => sample })
}

function renderArgs(overrides: Record<string, number | string>, backdrop: HeadlinerEffectRenderArgs['backdrop']): { args: HeadlinerEffectRenderArgs; canvas: HTMLCanvasElement; video: HTMLVideoElement } {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const video = document.createElement('video')
  return {
    canvas,
    video,
    args: {
      context: canvas.getContext('2d')!,
      canvas,
      video,
      sourceRect: { sx: 0, sy: 0, sw: 1280, sh: 720 },
      parameters: resolveHeadlinerParameters('virtual-backdrop', overrides),
      timing: HEADLINER_IDLE_TIMING,
      backdrop,
    },
  }
}

describe('Virtual Backdrop effect', () => {
  const backdrop = { source: document.createElement('canvas'), width: 1600, height: 900 }

  it('draws the chosen background first and the masked person over it', () => {
    const mask = document.createElement('canvas')
    const processor = createVirtualBackdropProcessor({ segmenter: stubSegmenter(mask) })
    const { args, video } = renderArgs({}, backdrop)
    processor.render(args)

    const sources = draws.map(call => call.source)
    expect(sources[0]).toBe(video)
    const backdropIndex = sources.indexOf(backdrop.source)
    expect(backdropIndex).toBeGreaterThan(0)
    // After the background, the person layer (a work canvas, not the video) is composited normally on top.
    const lastDraw = draws[draws.length - 1]!
    expect(lastDraw.source).not.toBe(backdrop.source)
    expect(lastDraw.source).not.toBe(video)
    expect(lastDraw.composite).toBe('source-over')
    expect(draws.findIndex(call => call.source === mask)).toBeGreaterThan(-1)
    processor.dispose()
  })

  it('shows the backdrop colour behind the person while no background has loaded', () => {
    const processor = createVirtualBackdropProcessor({ segmenter: stubSegmenter(document.createElement('canvas')) })
    const { args } = renderArgs({ backdropColor: '#ff0000' }, null)
    processor.render(args)
    expect(fills.some(fill => fill.includes('255, 0, 0'))).toBe(true)
    expect(draws.some(call => call.source === backdrop.source)).toBe(false)
    processor.dispose()
  })

  it('leaves the plain camera at 0% intensity, and until the person mask exists', () => {
    const off = createVirtualBackdropProcessor({ segmenter: stubSegmenter(document.createElement('canvas')) })
    off.render(renderArgs({ masterIntensity: 0 }, backdrop).args)
    expect(draws.some(call => call.source === backdrop.source)).toBe(false)
    off.dispose()

    draws = []
    const waiting = createVirtualBackdropProcessor({ segmenter: stubSegmenter(null) })
    waiting.render(renderArgs({}, backdrop).args)
    expect(draws.some(call => call.source === backdrop.source)).toBe(false)
    expect(draws).toHaveLength(1)
    waiting.dispose()
  })
})
