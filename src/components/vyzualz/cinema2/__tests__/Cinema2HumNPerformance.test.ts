import { describe, expect, it } from 'vitest'
import {
  CINEMA2_HUMN_DROP_GESTURES,
  CINEMA2_HUMN_DROP_GESTURE_TIMINGS,
  CINEMA2_HUMN_HEAD_CRITICAL_POINTS,
  CINEMA2_HUMN_LUNGE_PEAK_GAIN,
  CINEMA2_HUMN_STRUCTURAL_TIMINGS,
  Cinema2HumNPerformanceRuntime,
  cinema2HumNAutoDropStrength,
  cinema2HumNEnvelope,
  cinema2HumNForwardPosePoint,
  cinema2HumNLungeScale,
  cinema2HumNLungeScaleCap,
  cinema2HumNProjectFigurePoint,
  cinema2HumNStructuralAmplitude,
  resolveCinema2HumNGestureUniforms,
  resolveCinema2HumNReachGeometry,
  selectCinema2HumNDropGesture,
  selectCinema2HumNStructuralVariant,
  type Cinema2HumNDirectorContext,
  type Cinema2HumNDropGesture,
  type Cinema2HumNPerformancePose,
} from '../modules/humn/Cinema2HumNPerformance'
import { resolveCinema2HumNFigureScale } from '../modules/Cinema2HumNNativeModule'

const VIEWPORTS = [
  { name: 'landscape', width: 1600, height: 900 },
  { name: 'square', width: 1024, height: 1024 },
  { name: 'portrait', width: 900, height: 1200 },
  { name: 'ultrawide', width: 2560, height: 1080 },
] as const

const BEAT = 0.5

const view = (viewport: typeof VIEWPORTS[number], motion = 0) => ({
  aspect: viewport.width / viewport.height,
  figureScale: resolveCinema2HumNFigureScale(1, viewport.width, viewport.height, motion),
})

const context = (overrides: Partial<Cinema2HumNDirectorContext>): Cinema2HumNDirectorContext => ({
  phase: 'steady', intensity: 0.5, momentum: 0.5, build: 0, impact: 0.5, variation: 0.2, sectionType: null, ...overrides,
})

function tally(count: number, pick: (unit: number) => string) {
  const result: Record<string, number> = {}
  for (let index = 0; index < count; index++) {
    const key = pick((index + 0.5) / count)
    result[key] = (result[key] ?? 0) + 1
  }
  return result
}

describe('HUM:N structural envelopes', () => {
  it('drop gestures stay inside the specified musical-time ranges', () => {
    for (const gesture of CINEMA2_HUMN_DROP_GESTURES) {
      const timing = CINEMA2_HUMN_DROP_GESTURE_TIMINGS[gesture]
      expect(timing.attack, gesture).toBeGreaterThanOrEqual(0.1)
      expect(timing.attack, gesture).toBeLessThanOrEqual(0.2)
      expect(timing.hold, gesture).toBeGreaterThanOrEqual(0.25)
      expect(timing.hold, gesture).toBeLessThanOrEqual(0.5)
      expect(timing.release, gesture).toBeGreaterThanOrEqual(1)
      expect(timing.release, gesture).toBeLessThanOrEqual(2)
    }
  })

  it('phrase/section variations run between 1 and 4 beats', () => {
    for (const [variant, timing] of Object.entries(CINEMA2_HUMN_STRUCTURAL_TIMINGS)) {
      const total = timing.attack + timing.hold + timing.release
      expect(total, variant).toBeGreaterThanOrEqual(1)
      expect(total, variant).toBeLessThanOrEqual(4)
    }
  })

  it('rises from exactly 0, holds at exactly 1, and returns to exactly 0', () => {
    const timing = CINEMA2_HUMN_DROP_GESTURE_TIMINGS.headGrab
    expect(cinema2HumNEnvelope(0, timing)).toBe(0)
    expect(cinema2HumNEnvelope(timing.attack * 0.5, timing)).toBeGreaterThan(0)
    expect(cinema2HumNEnvelope(timing.attack * 0.5, timing)).toBeLessThan(1)
    expect(cinema2HumNEnvelope(timing.attack + timing.hold * 0.5, timing)).toBe(1)
    expect(cinema2HumNEnvelope(timing.attack + timing.hold + timing.release * 0.5, timing)).toBeGreaterThan(0)
    expect(cinema2HumNEnvelope(timing.attack + timing.hold + timing.release, timing)).toBe(0)
    expect(cinema2HumNEnvelope(-1, timing)).toBe(0)
  })
})

describe('deterministic gesture selection', () => {
  it('manual selection is a pure function of the event draw and reaches all four families', () => {
    const counts = tally(400, unit => selectCinema2HumNDropGesture(unit))
    expect(Object.keys(counts).sort()).toEqual([...CINEMA2_HUMN_DROP_GESTURES].sort())
    for (const gesture of CINEMA2_HUMN_DROP_GESTURES) expect(counts[gesture], gesture).toBeGreaterThan(60)
    expect(selectCinema2HumNDropGesture(0.37)).toBe(selectCinema2HumNDropGesture(0.37))
  })

  it('Auto Performance re-weights the same four families by Director context', () => {
    const peak = tally(400, unit => selectCinema2HumNDropGesture(unit, { auto: context({ phase: 'peak', impact: 0.95, momentum: 0.9 }) }))
    const release = tally(400, unit => selectCinema2HumNDropGesture(unit, { auto: context({ phase: 'release', impact: 0.4, momentum: 0.2 }) }))
    const building = tally(400, unit => selectCinema2HumNDropGesture(unit, { auto: context({ phase: 'building', build: 0.9 }) }))
    expect((peak.lunge ?? 0) + (peak.reach ?? 0)).toBeGreaterThan((release.lunge ?? 0) + (release.reach ?? 0))
    expect((release.shock ?? 0) + (release.headGrab ?? 0)).toBeGreaterThan((peak.shock ?? 0) + (peak.headGrab ?? 0))
    expect(building.reach ?? 0).toBeGreaterThan(building.headGrab ?? 0)
    for (const counts of [peak, release, building]) {
      expect(Object.keys(counts).every(key => (CINEMA2_HUMN_DROP_GESTURES as readonly string[]).includes(key))).toBe(true)
    }
  })

  it('every Director phase resolves to an authored family (low/steady/rising/building/peak/release)', () => {
    for (const phase of ['low', 'steady', 'rising', 'building', 'peak', 'release'] as const) {
      const counts = tally(100, unit => selectCinema2HumNDropGesture(unit, { auto: context({ phase }) }))
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  it('high variation authority never repeats the previous family; low variation may', () => {
    const noRepeat = tally(200, unit => selectCinema2HumNDropGesture(unit, { auto: context({ variation: 0.9 }), previous: 'reach' }))
    expect(noRepeat.reach).toBeUndefined()
    const mayRepeat = tally(200, unit => selectCinema2HumNDropGesture(unit, { auto: context({ variation: 0.1 }), previous: 'reach' }))
    expect(mayRepeat.reach).toBeGreaterThan(0)
  })

  it('structural variants are deterministic; Reset/Center is section-only', () => {
    const phrase = tally(300, unit => selectCinema2HumNStructuralVariant('phrase', unit, null))
    const section = tally(300, unit => selectCinema2HumNStructuralVariant('section', unit, null))
    expect(phrase.center).toBeUndefined()
    expect(section.center).toBeGreaterThan(0)
    for (const variant of ['lookLeft', 'bodyTurn', 'scan']) expect(phrase[variant], variant).toBeGreaterThan(0)
    expect(selectCinema2HumNStructuralVariant('section', 0.4, null)).toBe(selectCinema2HumNStructuralVariant('section', 0.4, null))
    const releasing = tally(300, unit => selectCinema2HumNStructuralVariant('section', unit, context({ phase: 'release' })))
    expect(releasing.center ?? 0).toBeGreaterThan(section.center ?? 0)
    const building = tally(300, unit => selectCinema2HumNStructuralVariant('phrase', unit, context({ phase: 'building' })))
    expect(building.scan ?? 0).toBeGreaterThan(phrase.scan ?? 0)
  })
})

describe('Auto Performance impact gating', () => {
  it('impact authority gates weak drops and scales strong ones, and is absent without a Director', () => {
    expect(cinema2HumNAutoDropStrength(0.9, null)).toBe(0.9)
    expect(cinema2HumNAutoDropStrength(0.9, 0.05)).toBeNull()
    const mid = cinema2HumNAutoDropStrength(1, 0.5)!
    const strong = cinema2HumNAutoDropStrength(1, 1)!
    expect(mid).toBeGreaterThan(0.6)
    expect(strong).toBe(1)
    expect(mid).toBeLessThan(strong)
  })
})

describe('structural authority', () => {
  it('phrase is bounded by ~35% Gesture Intensity / ~50% Motion Amount; section by ~60% / ~70%', () => {
    expect(cinema2HumNStructuralAmplitude('phrase', { gestureIntensity: 1, motionAmount: 0 })).toBeCloseTo(0.35, 6)
    expect(cinema2HumNStructuralAmplitude('phrase', { gestureIntensity: 0, motionAmount: 1 })).toBeCloseTo(0.5, 6)
    expect(cinema2HumNStructuralAmplitude('section', { gestureIntensity: 1, motionAmount: 0 })).toBeCloseTo(0.6, 6)
    expect(cinema2HumNStructuralAmplitude('section', { gestureIntensity: 0, motionAmount: 1 })).toBeCloseTo(0.7, 6)
    expect(cinema2HumNStructuralAmplitude('phrase', { gestureIntensity: 1, motionAmount: 1 })).toBeLessThanOrEqual(0.5)
    expect(cinema2HumNStructuralAmplitude('section', { gestureIntensity: 1, motionAmount: 1 })).toBeLessThanOrEqual(0.7)
  })

  it('is silent at Motion Amount 0 and Gesture Intensity 0, and calmer than a drop', () => {
    for (const kind of ['phrase', 'section'] as const) expect(cinema2HumNStructuralAmplitude(kind, { gestureIntensity: 0, motionAmount: 0 })).toBe(0)
    expect(cinema2HumNStructuralAmplitude('section', { gestureIntensity: 1, motionAmount: 1 })).toBeLessThan(1)
  })
})

describe('Cinema2HumNPerformanceRuntime', () => {
  const ceilings = { gestureIntensity: 1, motionAmount: 0 }
  const dropAt = (gesture: Cinema2HumNDropGesture, eventId: string, startSec = 10, strength = 1) => ({
    eventId, kind: 'drop' as const, gesture, strength, startSec, beatSec: BEAT,
  })

  it('peaks, releases, and finishes at exactly the neutral pose with no stuck state', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    expect(runtime.trigger(dropAt('reach', 'a'), 10)).toBe(true)
    const timing = CINEMA2_HUMN_DROP_GESTURE_TIMINGS.reach
    expect(runtime.evaluate(10, ceilings).reach).toBe(0)
    expect(runtime.evaluate(10 + BEAT * (timing.attack + timing.hold * 0.5), ceilings).reach).toBe(1)
    const mid = runtime.evaluate(10 + BEAT * (timing.attack + timing.hold + timing.release * 0.5), ceilings).reach
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    const end = runtime.evaluate(10 + BEAT * (timing.attack + timing.hold + timing.release) + 0.01, ceilings)
    expect(end).toEqual({ reach: 0, shock: 0, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0 })
    expect(runtime.activeCount).toBe(0)
  })

  it('scales peak by Gesture Intensity and event strength, and applies live ceilings', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger(dropAt('lunge', 'a', 10, 0.8), 10)
    const now = 10 + BEAT * 0.4
    expect(runtime.evaluate(now, { gestureIntensity: 1, motionAmount: 0 }).lunge).toBeCloseTo(0.8, 6)
    expect(runtime.evaluate(now, { gestureIntensity: 0.5, motionAmount: 0 }).lunge).toBeCloseTo(0.4, 6)
    expect(runtime.evaluate(now, { gestureIntensity: 0, motionAmount: 1 }).lunge).toBe(0)
  })

  it('deduplicates by event id and drops events it cannot time', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    expect(runtime.trigger(dropAt('shock', 'same'), 10)).toBe(true)
    expect(runtime.trigger(dropAt('shock', 'same'), 10.1)).toBe(false)
    expect(runtime.trigger({ ...dropAt('shock', 'no-tempo'), beatSec: 0 }, 10)).toBe(false)
    expect(runtime.activeCount).toBe(1)
  })

  it('retrigger releases the older gesture smoothly instead of popping', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger(dropAt('reach', 'first', 10), 10)
    expect(runtime.evaluate(10.2, ceilings).reach).toBe(1)
    runtime.trigger(dropAt('headGrab', 'second', 10.2), 10.2)
    const justAfter = runtime.evaluate(10.2, ceilings)
    expect(justAfter.reach).toBeCloseTo(1, 6)
    const later = runtime.evaluate(10.2 + BEAT * 0.25, ceilings)
    expect(later.reach).toBeLessThan(1)
    expect(later.reach).toBeGreaterThan(0)
    expect(later.headGrab).toBeGreaterThan(0)
    expect(runtime.evaluate(10.2 + BEAT * 0.6, ceilings).reach).toBe(0)
  })

  it('a clock that runs backwards past an event start drops it (seek/loop)', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger(dropAt('reach', 'a', 10), 10)
    expect(runtime.evaluate(10.2, ceilings).reach).toBe(1)
    expect(runtime.evaluate(4, ceilings).reach).toBe(0)
    expect(runtime.activeCount).toBe(0)
  })

  it('reset clears everything including dedupe memory', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger(dropAt('reach', 'a', 10), 10)
    runtime.reset()
    expect(runtime.evaluate(10.2, ceilings).reach).toBe(0)
    expect(runtime.trigger(dropAt('reach', 'a', 10), 10)).toBe(true)
  })

  it('phrase and section moves stay silent at zero ceilings and clean up within four beats', () => {
    const silent = new Cinema2HumNPerformanceRuntime()
    silent.trigger({ eventId: 'p', kind: 'phrase', variant: 'lookRight', sign: 1, strength: 1, startSec: 10, beatSec: BEAT }, 10)
    silent.trigger({ eventId: 's', kind: 'section', variant: 'scan', sign: 1, strength: 1, startSec: 10, beatSec: BEAT }, 10)
    for (let beat = 0; beat <= 4; beat += 0.25) {
      const pose = silent.evaluate(10 + beat * BEAT, { gestureIntensity: 0, motionAmount: 0 })
      expect(pose.lookYaw).toBe(0)
      expect(pose.bodyTurn).toBe(0)
    }
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger({ eventId: 'p', kind: 'phrase', variant: 'lookRight', sign: 1, strength: 1, startSec: 10, beatSec: BEAT }, 10)
    runtime.trigger({ eventId: 's', kind: 'section', variant: 'scan', sign: -1, strength: 1, startSec: 10, beatSec: BEAT }, 10)
    let peak = 0
    for (let beat = 0; beat < 4; beat += 0.1) peak = Math.max(peak, Math.abs(runtime.evaluate(10 + beat * BEAT, { gestureIntensity: 1, motionAmount: 1 }).lookYaw))
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(1)
    const after = runtime.evaluate(10 + BEAT * 4.01, { gestureIntensity: 1, motionAmount: 1 })
    expect(after.lookYaw).toBe(0)
    expect(after.bodyTurn).toBe(0)
    expect(runtime.activeCount).toBe(0)
  })

  it('Look, Body Turn, Scan and Reset/Center produce four distinct motions', () => {
    const at = (variant: 'lookLeft' | 'bodyTurn' | 'scan' | 'center', beats: number) => {
      const runtime = new Cinema2HumNPerformanceRuntime()
      runtime.trigger({ eventId: variant, kind: 'section', variant, sign: 1, alt: 0.9, strength: 1, startSec: 10, beatSec: BEAT }, 10)
      return runtime.evaluate(10 + beats * BEAT, { gestureIntensity: 1, motionAmount: 1 })
    }
    const look = at('lookLeft', 0.8)
    const turn = at('bodyTurn', 1.5)
    expect(look.lookYaw).toBeGreaterThan(0.2)
    expect(look.bodyTurn).toBeLessThan(look.lookYaw)
    expect(turn.bodyTurn).toBeGreaterThan(0.3)
    expect(turn.bodyTurn).toBeGreaterThan(turn.lookYaw * 0.9)
    // Scan is two-stage: the head goes one way and then across to the other side.
    const scanPositive = Math.max(...[0.3, 0.6, 0.9, 1.2, 1.5].map(beats => at('scan', beats).lookYaw))
    const scanNegative = Math.min(...[2.1, 2.4, 2.7, 3, 3.3].map(beats => at('scan', beats).lookYaw))
    expect(scanPositive).toBeGreaterThan(0.2)
    expect(scanNegative).toBeLessThan(-0.2)
    const center = at('center', 0.7)
    expect(center.nod).toBeGreaterThan(0.3)
    expect(center.lookYaw).toBe(0)
  })

  it('Reset/Center pulls an in-flight look back toward the centre line', () => {
    const runtime = new Cinema2HumNPerformanceRuntime()
    runtime.trigger({ eventId: 'look', kind: 'phrase', variant: 'lookRight', sign: 1, strength: 1, startSec: 10, beatSec: BEAT }, 10)
    const free = runtime.evaluate(10 + BEAT * 0.8, { gestureIntensity: 1, motionAmount: 1 }).lookYaw
    runtime.trigger({ eventId: 'center', kind: 'section', variant: 'center', strength: 1, startSec: 10 + BEAT * 0.4, beatSec: BEAT }, 10 + BEAT * 0.4)
    const centered = runtime.evaluate(10 + BEAT * 0.8, { gestureIntensity: 1, motionAmount: 1 }).lookYaw
    expect(Math.abs(centered)).toBeLessThan(Math.abs(free))
  })
})

describe('reach, lunge and pose geometry', () => {
  it('Reach draws a foreground hand of roughly 30-40% of frame width at full authority, never the whole canvas', () => {
    for (const viewport of VIEWPORTS) {
      const geometry = resolveCinema2HumNReachGeometry(1, view(viewport))
      expect(geometry.frameWidthShare, viewport.name).toBeGreaterThanOrEqual(0.3)
      expect(geometry.frameWidthShare, viewport.name).toBeLessThanOrEqual(0.4)
      expect(resolveCinema2HumNReachGeometry(0.5, view(viewport)).frameWidthShare, viewport.name).toBeLessThan(geometry.frameWidthShare)
      expect(resolveCinema2HumNReachGeometry(0, view(viewport)).handScale, viewport.name).toBe(0)
    }
  })

  it('Reach hand stays connected to the figure shoulder through a forearm and remains inside the frame', () => {
    for (const viewport of VIEWPORTS) {
      const geometry = resolveCinema2HumNReachGeometry(1, view(viewport))
      const halfWidth = view(viewport).aspect / 1.14 + 0.001
      expect(Math.abs(geometry.handX), viewport.name).toBeLessThan(halfWidth * 1.05)
      const shoulderToWrist = Math.hypot(geometry.wristX - geometry.shoulderX, geometry.wristY - geometry.shoulderY)
      expect(shoulderToWrist, viewport.name).toBeGreaterThan(0)
      expect(Number.isFinite(geometry.elbowX + geometry.elbowY)).toBe(true)
    }
  })

  it('Lunge peaks ~20-35% above the resolved figure scale in landscape and never leaves the head outside the frame', () => {
    const landscape = cinema2HumNLungeScale(1, view(VIEWPORTS[0]))
    expect(landscape).toBeGreaterThanOrEqual(1.2)
    expect(landscape).toBeLessThanOrEqual(1 + CINEMA2_HUMN_LUNGE_PEAK_GAIN + 1e-9)
    for (const viewport of VIEWPORTS) {
      const geometry = view(viewport)
      const scale = cinema2HumNLungeScale(1, geometry)
      expect(scale, viewport.name).toBeGreaterThanOrEqual(1)
      expect(cinema2HumNLungeScale(0, geometry), viewport.name).toBe(1)
      expect(cinema2HumNLungeScale(0.5, geometry), viewport.name).toBeLessThan(scale + 1e-9)
      const uniforms = resolveCinema2HumNGestureUniforms({ reach: 0, shock: 0, headGrab: 0, lunge: 1, lookYaw: 0, bodyTurn: 0, nod: 0 }, geometry)
      for (const point of CINEMA2_HUMN_HEAD_CRITICAL_POINTS) {
        const projected = cinema2HumNProjectFigurePoint(cinema2HumNForwardPosePoint(point, uniforms), geometry)
        expect(Math.abs(projected[0]), `${viewport.name} x ${point}`).toBeLessThanOrEqual(0.995)
        expect(Math.abs(projected[1]), `${viewport.name} y ${point}`).toBeLessThanOrEqual(0.995)
      }
      expect(cinema2HumNLungeScaleCap(geometry), viewport.name).toBe(scale)
    }
  })

  it('every gesture at maximum keeps the head critical points inside the frame in all four viewports', () => {
    const poses: Cinema2HumNPerformancePose[] = [
      { reach: 1, shock: 0, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0 },
      { reach: 0, shock: 1, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0 },
      { reach: 0, shock: 0, headGrab: 1, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0 },
      { reach: 0, shock: 0, headGrab: 0, lunge: 1, lookYaw: 1, bodyTurn: 1, nod: 1 },
      { reach: 1, shock: 1, headGrab: 1, lunge: 1, lookYaw: 1, bodyTurn: 1, nod: 1 },
    ]
    for (const viewport of VIEWPORTS) {
      const geometry = view(viewport, 1)
      for (const pose of poses) {
        const uniforms = resolveCinema2HumNGestureUniforms(pose, geometry)
        for (const point of CINEMA2_HUMN_HEAD_CRITICAL_POINTS) {
          const projected = cinema2HumNProjectFigurePoint(cinema2HumNForwardPosePoint(point, uniforms), geometry)
          expect(Math.abs(projected[0]), `${viewport.name} ${JSON.stringify(pose)} x`).toBeLessThanOrEqual(0.995)
          expect(Math.abs(projected[1]), `${viewport.name} ${JSON.stringify(pose)} y`).toBeLessThanOrEqual(0.995)
        }
      }
    }
  })

  it('the neutral pose is an exact identity', () => {
    const geometry = view(VIEWPORTS[0])
    const uniforms = resolveCinema2HumNGestureUniforms({ reach: 0, shock: 0, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0 }, geometry)
    expect(uniforms.lungeScale).toBe(1)
    for (const point of CINEMA2_HUMN_HEAD_CRITICAL_POINTS) {
      const moved = cinema2HumNForwardPosePoint(point, uniforms)
      expect(moved[0]).toBeCloseTo(point[0], 12)
      expect(moved[1]).toBeCloseTo(point[1], 12)
    }
  })
})
