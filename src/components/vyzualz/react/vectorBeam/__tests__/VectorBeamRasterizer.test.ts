import { describe, expect, it, vi } from 'vitest'
import {
  rasterizeVectorBeamSegments,
  resolveVectorBeamOpticalProfile,
  resolveVectorBeamSegmentAppearance,
  resolveVectorBeamSegmentExposure,
} from '../VectorBeamRasterizer'
import type { VectorBeamColor, VectorBeamSegment } from '../VectorBeamTypes'

const CYAN: VectorBeamColor = { r: 0, g: 200 / 255, b: 220 / 255, a: 1 }
const AMBER: VectorBeamColor = { r: 240 / 255, g: 180 / 255, b: 40 / 255, a: 1 }

function segment(color: VectorBeamColor, overrides: Partial<VectorBeamSegment> = {}): VectorBeamSegment {
  return {
    origin: { x: 0, y: 0 },
    target: { x: 10, y: 0 },
    color,
    density: 1,
    dwellWeight: 0.5,
    velocityRatio: 0.5,
    historyWeight: 1,
    ...overrides,
  }
}

function parseRgba(css: string): { r: number; g: number; b: number; a: number } {
  const match = /rgba?\(([^)]+)\)/.exec(css)
  if (!match) throw new Error(`not an rgba() string: ${css}`)
  const [r, g, b, a] = match[1].split(',').map(v => parseFloat(v.trim()))
  return { r, g, b, a: a ?? 1 }
}

function chroma(css: string): number {
  const { r, g, b } = parseRgba(css)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

describe('resolveVectorBeamOpticalProfile', () => {
  it('returns a valid optical profile shape across the exposure range', () => {
    for (const exposure of [0, 0.25, 0.5, 0.75, 1]) {
      const profile = resolveVectorBeamOpticalProfile(exposure)
      expect(profile.width).toBeGreaterThan(0)
      expect(profile.scatterEnvelopeWidth).toBeGreaterThan(profile.width)
      expect(profile.opacity).toBeGreaterThanOrEqual(0)
      expect(profile.opacity).toBeLessThanOrEqual(1)
      expect(profile.coreIntensity).toBeGreaterThanOrEqual(0)
      expect(profile.coreIntensity).toBeLessThanOrEqual(1)
    }
  })

  it('higher exposure resolves to higher core intensity', () => {
    const low = resolveVectorBeamOpticalProfile(0.1)
    const high = resolveVectorBeamOpticalProfile(0.9)
    expect(high.coreIntensity).toBeGreaterThan(low.coreIntensity)
  })
})

describe('resolveVectorBeamSegmentExposure', () => {
  it('is 0..1 and increases with density and dwellWeight', () => {
    const low = resolveVectorBeamSegmentExposure(segment(CYAN, { density: 0.2, dwellWeight: 0 }))
    const high = resolveVectorBeamSegmentExposure(segment(CYAN, { density: 1, dwellWeight: 1 }))
    expect(low).toBeGreaterThanOrEqual(0)
    expect(high).toBeLessThanOrEqual(1)
    expect(high).toBeGreaterThan(low)
  })

  it('scales down with a lower master intensity', () => {
    const full = resolveVectorBeamSegmentExposure(segment(CYAN), 1)
    const half = resolveVectorBeamSegmentExposure(segment(CYAN), 0.5)
    expect(half).toBeLessThan(full)
  })
})

describe('resolveVectorBeamSegmentAppearance — core/halo falloff', () => {
  it('halo stroke is wider than core stroke', () => {
    const appearance = resolveVectorBeamSegmentAppearance(segment(CYAN, { density: 1, dwellWeight: 1 }))
    expect(appearance.haloWidthPx).toBeGreaterThan(appearance.coreWidthPx)
  })

  it('core is more desaturated (whiter) than halo for a cyan base — matches the additive-accumulation signature', () => {
    const highExposure = segment(CYAN, { density: 1, dwellWeight: 1 })
    const appearance = resolveVectorBeamSegmentAppearance(highExposure)
    expect(chroma(appearance.coreColor)).toBeLessThan(chroma(appearance.haloColor))
  })

  it('core is more desaturated (whiter) than halo for an amber base too', () => {
    const highExposure = segment(AMBER, { density: 1, dwellWeight: 1 })
    const appearance = resolveVectorBeamSegmentAppearance(highExposure)
    expect(chroma(appearance.coreColor)).toBeLessThan(chroma(appearance.haloColor))
  })

  it('amber R/G ratio is lower at the whitened core than at the more-natural-hue halo (climbs outward)', () => {
    const highExposure = segment(AMBER, { density: 1, dwellWeight: 1 })
    const appearance = resolveVectorBeamSegmentAppearance(highExposure)
    const core = parseRgba(appearance.coreColor)
    const halo = parseRgba(appearance.haloColor)
    const coreRatio = core.r / Math.max(1, core.g)
    const haloRatio = halo.r / Math.max(1, halo.g)
    expect(haloRatio).toBeGreaterThan(coreRatio)
  })

  it('halo alpha is dimmer than core alpha (readable but faint tail, not a bright duplicate)', () => {
    const appearance = resolveVectorBeamSegmentAppearance(segment(CYAN, { density: 1, dwellWeight: 1 }))
    expect(parseRgba(appearance.haloColor).a).toBeLessThan(parseRgba(appearance.coreColor).a)
  })

  it('scales stroke widths with baseWidthPx', () => {
    const s = segment(CYAN)
    const narrow = resolveVectorBeamSegmentAppearance(s, { baseWidthPx: 1 })
    const wide = resolveVectorBeamSegmentAppearance(s, { baseWidthPx: 4 })
    expect(wide.coreWidthPx).toBeGreaterThan(narrow.coreWidthPx)
    expect(wide.haloWidthPx).toBeGreaterThan(narrow.haloWidthPx)
  })

  it('near-zero exposure produces a near-transparent, unwhitened appearance', () => {
    const appearance = resolveVectorBeamSegmentAppearance(segment(CYAN, { density: 0, dwellWeight: 0 }))
    expect(parseRgba(appearance.coreColor).a).toBeCloseTo(0, 1)
  })
})

interface RecordingContext extends CanvasRenderingContext2D {
  stroke: ReturnType<typeof vi.fn>
}

function recordingContext(): RecordingContext {
  const context: Partial<RecordingContext> & Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  }
  return context as unknown as RecordingContext
}

describe('rasterizeVectorBeamSegments', () => {
  it('does nothing for an empty segment array', () => {
    const ctx = recordingContext()
    rasterizeVectorBeamSegments(ctx, [])
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('sets the requested blend mode and strokes both a halo and a core pass', () => {
    const ctx = recordingContext()
    rasterizeVectorBeamSegments(ctx, [segment(CYAN)], { blendMode: 'lighter' })
    expect(ctx.globalCompositeOperation).toBe('lighter')
    expect(ctx.stroke).toHaveBeenCalled()
    // At minimum one halo + one core stroke for a single segment.
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('defaults to lighter (additive) blending when no blendMode is given', () => {
    const ctx = recordingContext()
    rasterizeVectorBeamSegments(ctx, [segment(CYAN)])
    expect(ctx.globalCompositeOperation).toBe('lighter')
  })

  it('batches a long run of identical, connected segments into a bounded number of stroke calls', () => {
    const ctx = recordingContext()
    const straightRun: VectorBeamSegment[] = Array.from({ length: 200 }, (_, i) => ({
      origin: { x: i, y: 0 },
      target: { x: i + 1, y: 0 },
      color: CYAN,
      density: 1,
      dwellWeight: 0, // perfectly straight — no corner anywhere
      velocityRatio: 1,
      historyWeight: 1,
    }))
    rasterizeVectorBeamSegments(ctx, straightRun)
    // A uniform straight run should collapse to a small, bounded number of
    // stroke() calls (halo + core), not one call per segment (200+).
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThan(10)
  })

  it('restores canvas state after drawing', () => {
    const ctx = recordingContext()
    rasterizeVectorBeamSegments(ctx, [segment(CYAN)])
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })
})
