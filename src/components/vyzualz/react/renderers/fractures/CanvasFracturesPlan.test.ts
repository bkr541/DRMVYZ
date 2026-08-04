import { describe, expect, it } from 'vitest'
import { generateCanvasFracturesPlan, resolveCanvasFracturesFragmentCount } from './CanvasFracturesPlan'
import { isConvexCanvasFractureQuad, resolveCanvasFracturesSourcePath } from './CanvasFracturesTransforms'
import type { CanvasFracturesPlanInput } from './CanvasFracturesTypes'

function planInput(overrides: Partial<CanvasFracturesPlanInput> = {}): CanvasFracturesPlanInput {
  return {
    presetId: 'canvas-fractures',
    sourceIdentity: 'media:image:revision:3',
    mediaType: 'image',
    mediaRevision: 3,
    trackIdentity: 'track:test',
    transportPositionSec: 12.5,
    variationSeed: 1337,
    topologyRevision: 0,
    layoutRevision: 0,
    mode: 'mixed',
    intensity: 0.5,
    focusProtection: 0.7,
    focusX: 0.5,
    focusY: 0.5,
    composition: 0.25,
    placementMode: 'balanced',
    quality: 'balanced',
    anchorMode: 'alwaysVisible',
    ...overrides,
  }
}

function focusArea(input: CanvasFracturesPlanInput): number {
  const focus = generateCanvasFracturesPlan(input).fragments.find(fragment => fragment.anchorRole === 'focus')
  if (!focus) return 0
  return focus.crop.width * focus.crop.height
}

describe('Canvas Fractures deterministic planner', () => {
  it('produces structurally identical plans for identical inputs', () => {
    const first = generateCanvasFracturesPlan(planInput())
    const second = generateCanvasFracturesPlan(planInput())

    expect(second).toEqual(first)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })

  it('changes topology for a seed variation while preserving deterministic reconstruction', () => {
    const first = generateCanvasFracturesPlan(planInput({ variationSeed: 17 }))
    const second = generateCanvasFracturesPlan(planInput({ variationSeed: 18 }))

    expect(second.topologyIdentity).not.toBe(first.topologyIdentity)
    expect(second.fragments).not.toEqual(first.fragments)
    expect(generateCanvasFracturesPlan(planInput({ variationSeed: 18 }))).toEqual(second)
  })

  it('keeps source crops and UV corners inside normalized source bounds', () => {
    for (const mode of ['rectangles', 'horizontalSlices', 'verticalSlices', 'angledQuads', 'mixed'] as const) {
      const plan = generateCanvasFracturesPlan(planInput({ mode, intensity: 1, quality: 'high' }))
      for (const fragment of plan.fragments) {
        expect(fragment.crop.x).toBeGreaterThanOrEqual(0)
        expect(fragment.crop.y).toBeGreaterThanOrEqual(0)
        expect(fragment.crop.x + fragment.crop.width).toBeLessThanOrEqual(1.000001)
        expect(fragment.crop.y + fragment.crop.height).toBeLessThanOrEqual(1.000001)
        for (const corner of fragment.sourceCorners) {
          expect(corner.x).toBeGreaterThanOrEqual(0)
          expect(corner.x).toBeLessThanOrEqual(1)
          expect(corner.y).toBeGreaterThanOrEqual(0)
          expect(corner.y).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('generates convex angled quadrilaterals and keeps them a minority in mixed mode', () => {
    const angled = generateCanvasFracturesPlan(planInput({ mode: 'angledQuads', intensity: 0.7 }))
    expect(angled.fragments.every(fragment => isConvexCanvasFractureQuad(fragment.localCorners))).toBe(true)

    const mixed = generateCanvasFracturesPlan(planInput({ mode: 'mixed', intensity: 0.8, quality: 'high' }))
    const families = new Set(mixed.fragments.map(fragment => fragment.shapeFamily))
    const angledCount = mixed.fragments.filter(fragment => fragment.shapeFamily === 'angledQuads').length
    expect(families).toEqual(new Set(['rectangles', 'horizontalSlices', 'verticalSlices', 'angledQuads']))
    expect(angledCount / mixed.fragments.length).toBeLessThanOrEqual(0.15)
  })

  it('maps intensity to increasing fragment density within quality caps', () => {
    const low = resolveCanvasFracturesFragmentCount(0, 'balanced')
    const medium = resolveCanvasFracturesFragmentCount(0.5, 'balanced')
    const high = resolveCanvasFracturesFragmentCount(1, 'balanced')

    expect(low).toBeGreaterThanOrEqual(6)
    expect(medium).toBeGreaterThan(low)
    expect(high).toBeGreaterThan(medium)
    expect(high).toBeLessThanOrEqual(48)
    expect(resolveCanvasFracturesFragmentCount(1, 'low')).toBeLessThan(high)
    expect(resolveCanvasFracturesFragmentCount(1, 'high')).toBeGreaterThan(high)
  })

  it('uses focus protection to preserve a larger central readable fragment', () => {
    const unprotected = focusArea(planInput({ focusProtection: 0 }))
    const protectedArea = focusArea(planInput({ focusProtection: 1 }))
    expect(protectedArea).toBeGreaterThan(unprotected * 2)
  })

  it('resolves every anchor mode to a distinct visual baseline', () => {
    const plans = ['alwaysVisible', 'reactive', 'fadeWithMusic', 'fullyFragmented'].map(anchorMode =>
      generateCanvasFracturesPlan(planInput({ anchorMode: anchorMode as CanvasFracturesPlanInput['anchorMode'] })),
    )
    expect(plans.map(plan => plan.anchor)).toEqual([
      { mode: 'alwaysVisible', visible: true, opacity: 0.72, scale: 1 },
      { mode: 'reactive', visible: true, opacity: 0.44, scale: 0.985 },
      { mode: 'fadeWithMusic', visible: true, opacity: 0.18, scale: 1.025 },
      { mode: 'fullyFragmented', visible: false, opacity: 0, scale: 1 },
    ])
  })

  it('changes layout without changing topology and excludes resize from plan identity', () => {
    const base = generateCanvasFracturesPlan(planInput())
    const shuffled = generateCanvasFracturesPlan(planInput({ layoutRevision: 1 }))

    expect(shuffled.topologyIdentity).toBe(base.topologyIdentity)
    expect(shuffled.layoutIdentity).not.toBe(base.layoutIdentity)
    expect(shuffled.fragments.map(fragment => fragment.crop)).toEqual(base.fragments.map(fragment => fragment.crop))
  })

  it('invalidates the plan when the media revision changes', () => {
    const first = generateCanvasFracturesPlan(planInput({ mediaRevision: 4 }))
    const replacement = generateCanvasFracturesPlan(planInput({ mediaRevision: 5 }))
    expect(replacement.topologyIdentity).not.toBe(first.topologyIdentity)
    expect(replacement.sourceIdentity).toBe(first.sourceIdentity)
  })

  it('reconstructs the same plan after backward seeking to the same transport state', () => {
    const atTwelve = generateCanvasFracturesPlan(planInput({ transportPositionSec: 12 }))
    const atForty = generateCanvasFracturesPlan(planInput({ transportPositionSec: 40 }))
    const backAtTwelve = generateCanvasFracturesPlan(planInput({ transportPositionSec: 12 }))
    expect(atForty.id).not.toBe(atTwelve.id)
    expect(backAtTwelve).toEqual(atTwelve)
  })

  it('invalidates safely across image, video, SVG, and image source replacement', () => {
    const sequence = [
      generateCanvasFracturesPlan(planInput({ sourceIdentity: 'image:a:1', mediaType: 'image', mediaRevision: 1 })),
      generateCanvasFracturesPlan(planInput({ sourceIdentity: 'video:b:2', mediaType: 'video', mediaRevision: 2 })),
      generateCanvasFracturesPlan(planInput({ sourceIdentity: 'svg:c:3', mediaType: 'svg', mediaRevision: 3 })),
      generateCanvasFracturesPlan(planInput({ sourceIdentity: 'image:d:4', mediaType: 'image', mediaRevision: 4 })),
    ]
    expect(new Set(sequence.map(plan => plan.topologyIdentity)).size).toBe(sequence.length)
    expect(sequence.map(plan => plan.sourcePath)).toEqual([
      'raster-image',
      'video-frame',
      'svg-raster-image',
      'raster-image',
    ])
  })

  it('selects the existing image, SVG-image, and synchronized video source paths', () => {
    expect(resolveCanvasFracturesSourcePath('image')).toBe('raster-image')
    expect(resolveCanvasFracturesSourcePath('svg')).toBe('svg-raster-image')
    expect(resolveCanvasFracturesSourcePath('video')).toBe('video-frame')
  })
})
