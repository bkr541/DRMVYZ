/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CINEMA2_HUMN_PRESET_MANIFEST } from '..'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HUMN_BONE, CINEMA2_HUMN_BONE_PIVOTS } from '../modules/humn/Cinema2HumNMesh'
import { HUM_BPM } from './support/Cinema2HumNFrameFactory'
import { createHarness, type Harness } from './support/Cinema2HumNHarness'

// The music-driven behaviour of HUM:N through the PRODUCTION runtime: Audio Intelligence bridge -> Visual Director -> Choreography ->
// canonical targets -> native module -> renderer uniforms.

const live: Harness[] = []
function harness(options?: Parameters<typeof createHarness>[0]): Harness {
  const created = createHarness(options)
  live.push(created)
  return created
}
afterEach(() => {
  while (live.length > 0) live.pop()?.dispose()
  vi.restoreAllMocks()
})

const id = (name: string) => `hum-n-${name}` as Cinema2ParameterId
const FILL = id('facet-fill')
const FRAG = id('fragmentation')
const INTENSITY = id('master-intensity')
const AUTO = id('auto-performance')
const MOTION = id('motion-amount')
const FLICKER = id('flicker-amount')
const JITTER = id('fragment-jitter')
const SYNC = id('bpm-sync')
const closeTo = (value: number, expected: number, digits = 4) => expect(value).toBeCloseTo(expected, digits)

// ── Continuous audio intelligence ───────────────────────────────────────────

describe('continuous appearance audio intelligence', () => {
  const at = (state: Record<string, number | boolean>, frame: Record<string, unknown>, frames = 60) => {
    const h = harness({ state: { [AUTO]: false, ...state } })
    h.step({ frames, ...frame } as never)
    return h
  }

  it('Complexity centres on 0.5 and adds at most +/-0.18 around the Fragmentation base, scaled by Master Intensity', () => {
    closeTo(at({ [FRAG]: 0.3, [INTENSITY]: 1 }, { complexity: 0.5 }).uniform('u_fragmentation'), 0.3, 3)
    closeTo(at({ [FRAG]: 0.3, [INTENSITY]: 1 }, { complexity: 1 }).uniform('u_fragmentation'), 0.48, 2)
    closeTo(at({ [FRAG]: 0.3, [INTENSITY]: 1 }, { complexity: 0 }).uniform('u_fragmentation'), 0.12, 2)
    closeTo(at({ [FRAG]: 0.3, [INTENSITY]: 0 }, { complexity: 1 }).uniform('u_fragmentation'), 0.3, 4)
    closeTo(at({ [FRAG]: 0.3, [INTENSITY]: 0.5 }, { complexity: 1 }).uniform('u_fragmentation'), 0.39, 2)
  })

  it('clamps Fragmentation to 0..1', () => {
    expect(at({ [FRAG]: 0.95, [INTENSITY]: 1 }, { complexity: 1 }).uniform('u_fragmentation')).toBeLessThanOrEqual(1)
    expect(at({ [FRAG]: 0, [INTENSITY]: 1 }, { complexity: 0 }).uniform('u_fragmentation')).toBeGreaterThanOrEqual(0)
  })

  it('returns to the authored value when a signal disappears', () => {
    const h = harness({ state: { [AUTO]: false, [FILL]: 0.2, [INTENSITY]: 1 } })
    h.step({ energy: 0.5, trackCurve: 1, frames: 60 })
    expect(h.uniform('u_fill')).toBeGreaterThan(0.5)
    h.step({ energy: 0.5, trackCurve: null as never, frames: 80 })
    closeTo(h.uniform('u_fill'), 0.2, 2)
  })

  it('leaves Facet Fill at the user value when the track energy curve is unavailable (no fabricated fallback)', () => {
    closeTo(at({ [FILL]: 0.3, [INTENSITY]: 1 }, { energy: 0.9 }).uniform('u_fill'), 0.3, 3)
  })
})

// ── Rhythmic events ─────────────────────────────────────────────────────────

describe('rhythmic events', () => {
  const armed = () => harness({ state: { [FLICKER]: 1, [JITTER]: 1 } })
  const cases = [
    { name: 'beat', uniform: 'u_flicker', input: { beat: true }, hold: 0.02, release: 0.35 },
    { name: 'downbeat', uniform: 'u_flickerDown', input: { downbeat: true }, hold: 0.05, release: 0.5 },
    { name: 'kick', uniform: 'u_kickJitter', input: { kick: 1 }, hold: 0.02, release: 0.5 },
    { name: 'snare', uniform: 'u_snare', input: { snare: 1 }, hold: 0.02, release: 0.25 },
  ] as const

  it('uses beat-timed envelopes with the specified attack/hold/release for every rhythmic rule', () => {
    const rules = CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []
    const envelopeOf = (ruleId: string) => rules.find(rule => rule.id === ruleId)?.actions.find(action => action.operation === 'envelope')?.envelope
    expect(envelopeOf('hum-n-beat-flicker')).toEqual({ attack: 0, hold: 0.02, release: 0.35, unit: 'beats' })
    expect(envelopeOf('hum-n-downbeat-reveal')).toEqual({ attack: 0, hold: 0.05, release: 0.5, unit: 'beats' })
    expect(envelopeOf('hum-n-kick-jitter')).toEqual({ attack: 0, hold: 0.02, release: 0.5, unit: 'beats' })
    expect(envelopeOf('hum-n-snare-eye-cheek')).toEqual({ attack: 0, hold: 0.02, release: 0.25, unit: 'beats' })
  })

  for (const item of cases) {
    it(`${item.name}: fires instantly at full strength, releases over its beat window and returns to exactly zero`, () => {
      const h = armed()
      h.step({ frames: 2 })
      expect(h.uniform(item.uniform)).toBe(0)
      h.step({ ...item.input, frames: 1 })
      closeTo(h.uniform(item.uniform), 1, 5)
      const beatSec = 60 / HUM_BPM
      const peak = h.uniform(item.uniform)
      h.step({ dt: beatSec * (item.hold + item.release * 0.5), frames: 1 })
      expect(h.uniform(item.uniform)).toBeGreaterThan(0.05)
      expect(h.uniform(item.uniform)).toBeLessThan(peak)
      h.step({ dt: beatSec * (item.hold + item.release), frames: 1 })
      expect(h.uniform(item.uniform)).toBe(0)
    })
  }

  it('scales the event value by the event\'s own strength', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 0.5, frames: 1 })
    closeTo(h.uniform('u_kickJitter'), 0.5, 3)
  })

  it('ignores a repeated event id instead of restarting or double-firing it', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, frames: 1 })
    const seed = h.uniform('u_kickSeed')
    h.step({ kick: 0, dt: 0.05, frames: 1 })
    expect(h.uniform('u_kickSeed')).toBe(seed)
  })

  it('a seek clears in-flight events and their seeds', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, snare: 1, frames: 1 })
    expect(h.uniform('u_kickJitter')).toBeGreaterThan(0.9)
    expect(h.uniform('u_kickSeed')).toBeGreaterThan(0)
    h.step({ timeSec: 3, frames: 1 })
    h.step({ frames: 1 })
    expect(h.uniform('u_kickJitter')).toBe(0)
    expect(h.uniform('u_snare')).toBe(0)
    expect(h.uniform('u_kickSeed')).toBe(0)
    expect(h.uniform('u_downSeed')).toBe(0)
  })

  it('a source change clears in-flight events and their seeds', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, frames: 1 })
    h.step({ trackId: 'a-different-track', frames: 2 })
    expect(h.uniform('u_kickJitter')).toBe(0)
    expect(h.uniform('u_kickSeed')).toBe(0)
  })

  it('holds an in-flight envelope while the transport is paused and resumes it afterwards', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, frames: 1 })
    h.step({ dt: 0.1, frames: 1 })
    const beforePause = h.uniform('u_kickJitter')
    expect(beforePause).toBeLessThan(1)
    h.pause(true)
    h.step({ frames: 6 })
    expect(h.uniform('u_kickJitter')).toBe(beforePause)
    h.pause(false)
    h.step({ dt: 0.2, frames: 1 })
    expect(h.uniform('u_kickJitter')).toBeLessThan(beforePause)
  })

  it('does nothing without a beat grid (no fabricated timing)', () => {
    const h = armed()
    h.step({ frames: 2, rhythm: false })
    h.step({ kick: 1, beat: true, rhythm: false, frames: 2 })
    expect(h.uniform('u_kickJitter')).toBe(0)
    expect(h.uniform('u_flicker')).toBe(0)
  })
})

// ── Build choreography ──────────────────────────────────────────────────────

describe('build choreography', () => {
  // BPM Sync off and Auto Performance off so nothing but the build reaches the values under test.
  const building = (state: Record<string, number | boolean> = {}) => harness({ state: { [INTENSITY]: 1, [AUTO]: false, [SYNC]: false, [FILL]: 0.1, ...state } })
  const build = (h: Harness, progress: number, frames = 40) => h.step({ buildProgress: progress, buildConfidence: progress, tension: 0, energy: 0.5, frames, dt: 0.1 })

  it('does nothing without a build', () => {
    const h = building()
    build(h, 0)
    closeTo(h.uniform('u_fill'), 0.1, 3)
    closeTo(h.uniform('u_fragmentation'), 0.12, 2)
    expect(h.uniform('u_edgeGlow')).toBe(0)
  })

  it('progressively coalesces the figure: fill and edge glow rise while fragmentation falls', () => {
    const early = building()
    build(early, 0.3)
    const late = building()
    build(late, 1)
    expect(late.uniform('u_fill')).toBeGreaterThan(early.uniform('u_fill'))
    expect(late.uniform('u_fill')).toBeGreaterThan(0.1)
    expect(late.uniform('u_edgeGlow')).toBeGreaterThan(early.uniform('u_edgeGlow'))
    expect(late.uniform('u_fragmentation')).toBeLessThan(early.uniform('u_fragmentation'))
  })

  it('never exceeds the specified maximum contributions', () => {
    const h = building()
    build(h, 1, 120)
    expect(h.uniform('u_fill')).toBeLessThanOrEqual(0.1 + 0.25 + 1e-6)
    expect(h.uniform('u_edgeGlow')).toBeLessThanOrEqual(0.2 + 1e-6)
  })

  it('releases smoothly back to the user values after the build ends without a drop', () => {
    const h = building()
    build(h, 1)
    expect(h.uniform('u_fill')).toBeGreaterThan(0.25)
    h.step({ buildProgress: 0, buildConfidence: 0, frames: 200, dt: 0.1 })
    closeTo(h.uniform('u_fill'), 0.1, 2)
    expect(h.uniform('u_edgeGlow')).toBeLessThan(0.005)
  })

  it('does nothing when the build capability is missing (loudness is never reinterpreted as a build)', () => {
    const h = building()
    h.step({ energy: 1, buildProgress: 1, buildConfidence: 1, structural: false, frames: 40, dt: 0.1 })
    closeTo(h.uniform('u_fill'), 0.1, 3)
    expect(h.uniform('u_edgeGlow')).toBe(0)
  })

  it('is hard-disabled at Master Intensity 0', () => {
    const h = building({ [INTENSITY]: 0 })
    build(h, 1, 60)
    closeTo(h.uniform('u_fill'), 0.1, 3)
    expect(h.uniform('u_edgeGlow')).toBe(0)
  })
})

// ── Motion lifts ────────────────────────────────────────────────────────────

describe('tension and vocals shape the body motion', () => {
  const sway = (frame: Record<string, unknown>) => {
    const h = harness({ state: { [INTENSITY]: 1, [MOTION]: 0.2, [AUTO]: false, [SYNC]: false } })
    h.step({ frames: 40, dt: 0.1, ...frame } as never)
    const m = h.matrix('u_bones').slice(CINEMA2_HUMN_BONE.head * 16, CINEMA2_HUMN_BONE.head * 16 + 16)
    const p = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.head]!
    const tip = [p[0], p[1] + 0.25, p[2]]
    const moved = [0, 1, 2].map(r => m[r]! * tip[0]! + m[4 + r]! * tip[1]! + m[8 + r]! * tip[2]! + m[12 + r]!)
    return Math.hypot(moved[0]! - tip[0]!, moved[1]! - tip[1]!, moved[2]! - tip[2]!)
  }

  it('tension lifts the motion above the user\'s base', () => {
    expect(sway({ tension: 1 })).toBeGreaterThan(sway({ tension: 0 }) * 1.2)
  })

  it('vocal presence restrains only the added motion, never the user\'s base', () => {
    const base = sway({ tension: 0, vocal: 1 })
    expect(base).toBeCloseTo(sway({ tension: 0, vocal: 0 }), 6)
    const restrained = sway({ tension: 1, vocal: 1 })
    const free = sway({ tension: 1, vocal: 0 })
    expect(restrained).toBeGreaterThan(base)
    expect(restrained).toBeLessThan(free)
  })
})
