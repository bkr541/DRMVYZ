/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID,
  CINEMA2_HUMN_FACET_FILL_ID,
  CINEMA2_HUMN_FLICKER_AMOUNT_ID,
  CINEMA2_HUMN_FRAGMENTATION_ID,
  CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID,
  CINEMA2_HUMN_FRAGMENT_JITTER_ID,
  CINEMA2_HUMN_LINE_PRESENCE_ID,
  CINEMA2_HUMN_MASTER_REACTIVITY_ID,
  CINEMA2_HUMN_MOTION_AMOUNT_ID,
  CINEMA2_HUMN_PRESET_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  cinema2NativePresetRegistry,
} from '..'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { HUM_BPM } from './support/Cinema2HumNFrameFactory'
import { createHarness, type Harness } from './support/Cinema2HumNHarness'

// ── Harness ─────────────────────────────────────────────────────────────────
// Everything below drives the PRODUCTION runtime: Audio Intelligence bridge ->
// Visual Director -> Choreography -> canonical targets -> native HUM:N module ->
// shader uniforms. Nothing here reads parameter state as a shortcut.

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

const closeTo = (value: number, expected: number, digits = 4) => expect(value).toBeCloseTo(expected, digits)

// ── Manifest / structural contract ──────────────────────────────────────────

describe('HUM:N reactive manifest contract', () => {
  it('is manifest revision 21 and compiles with only render.webgl2 available', () => {
    expect(CINEMA2_HUMN_PRESET_MANIFEST.revision).toBe(21)
    const compiled = cinema2NativePresetRegistry.compile(CINEMA2_HUMN_PRESET_ID, { availableCapabilities: ['render.webgl2'] })
    expect(compiled.ok).toBe(true)
  })

  it('exposes the four new user controls with the specified defaults, ranges, and hierarchy', () => {
    const byId = new Map((CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).map(parameter => [parameter.id, parameter]))
    const expectFloat = (id: Cinema2ParameterId, label: string, parent: string, group?: string) => {
      expect(byId.get(id)).toMatchObject({ label, type: 'float', defaultValue: 0, min: 0, max: 1, step: 0.01, designParentGroup: parent, persistence: 'preset' })
      if (group) expect(byId.get(id)).toMatchObject({ group })
    }
    expectFloat(CINEMA2_HUMN_MASTER_REACTIVITY_ID, 'Master Reactivity', 'master-controls')
    expect(byId.get(CINEMA2_HUMN_MASTER_REACTIVITY_ID)).not.toHaveProperty('group')
    expectFloat(CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID, 'Color Shift Amount', 'palette', 'Color Behavior')
    expectFloat(CINEMA2_HUMN_FLICKER_AMOUNT_ID, 'Flicker Amount', 'effects', 'Fragment Behavior')
    expectFloat(CINEMA2_HUMN_FRAGMENT_JITTER_ID, 'Fragment Jitter', 'effects', 'Fragment Behavior')
  })

  it('keeps the rhythm-event trigger hidden and runtime-only so it never reaches the Inspector or presets', () => {
    const intent = (CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []).find(parameter => parameter.id === CINEMA2_HUMN_FRAGMENT_EVENT_INTENT_ID)
    expect(intent).toMatchObject({ type: 'trigger', exposure: 'hidden', persistence: 'runtime-only' })
  })

  it('uses beat-timed envelopes with the specified attack/hold/release for every rhythmic rule', () => {
    const rules = CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []
    const envelopeOf = (ruleId: string) => rules.find(rule => rule.id === ruleId)?.actions.find(action => action.operation === 'envelope')?.envelope
    expect(envelopeOf('hum-n-beat-flicker')).toEqual({ attack: 0, hold: 0.02, release: 0.35, unit: 'beats' })
    expect(envelopeOf('hum-n-downbeat-reveal')).toEqual({ attack: 0, hold: 0.05, release: 0.5, unit: 'beats' })
    expect(envelopeOf('hum-n-kick-jitter')).toEqual({ attack: 0, hold: 0.02, release: 0.5, unit: 'beats' })
    expect(envelopeOf('hum-n-snare-eye-cheek')).toEqual({ attack: 0, hold: 0.02, release: 0.25, unit: 'beats' })
  })

  it('has no Math.random and never scans audio events inside the HUM:N module', () => {
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toMatch(/Math\.random/)
  })
})

// ── Master Reactivity 0 hard-disable ────────────────────────────────────────

describe('Master Reactivity = 0', () => {
  it('reproduces the exact authored static uniforms under maximal music while parameter state never changes', () => {
    const h = harness({ state: { [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: 1 } })
    h.step({ energy: 0, complexity: 1, trackCurve: 1, tension: 1, buildProgress: 1, buildConfidence: 1, vocal: 1, high: 1, air: 1, frames: 20 })
    expect(h.uniform('u_linePresence')).toBe(1)
    expect(h.uniform('u_fragmentation')).toBeCloseTo(0.55, 6)
    expect(h.uniform('u_facetFill')).toBe(0)
    expect(h.uniform('u_motionAmount')).toBe(0)
    expect(h.uniform('u_colorShift')).toBe(0)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBe(0)
    expect(h.get(CINEMA2_HUMN_MASTER_REACTIVITY_ID)).toBe(0)
  })

  it('keeps the four continuous mappings exactly at the authored base for a non-default user base', () => {
    const h = harness({ state: { [CINEMA2_HUMN_LINE_PRESENCE_ID]: 0.6, [CINEMA2_HUMN_FRAGMENTATION_ID]: 0.7, [CINEMA2_HUMN_FACET_FILL_ID]: 0.4, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.3 } })
    const before = h.snapshot()
    h.step({ energy: 0, complexity: 0, trackCurve: 0, tension: 1, buildProgress: 1, buildConfidence: 1, vocal: 1, frames: 20 })
    expect(h.uniform('u_linePresence')).toBeCloseTo(0.6, 6)
    expect(h.uniform('u_fragmentation')).toBeCloseTo(0.7, 6)
    expect(h.uniform('u_facetFill')).toBeCloseTo(0.4, 6)
    expect(h.uniform('u_motionAmount')).toBeCloseTo(0.3, 6)
    expect(h.snapshot()).toBe(before)
  })
})

// ── Continuous appearance ───────────────────────────────────────────────────

describe('continuous appearance Audio Intelligence', () => {
  const reactive = (state: Record<string, number> = {}) => harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, ...state } })

  it('Overall Energy only lowers Line Presence: 0.55x at silence, toward 1x at full energy, never above the user base', () => {
    for (const [energy, expected] of [[0, 0.55], [0.5, 0.775], [1, 1]] as const) {
      const h = reactive()
      h.step({ energy, frames: 3 })
      closeTo(h.uniform('u_linePresence'), expected)
    }
    const scaled = reactive({ [CINEMA2_HUMN_LINE_PRESENCE_ID]: 0.6 })
    scaled.step({ energy: 0, frames: 3 })
    closeTo(scaled.uniform('u_linePresence'), 0.6 * 0.55)
    scaled.step({ energy: 1, frames: 3 })
    expect(scaled.uniform('u_linePresence')).toBeLessThanOrEqual(0.6 + 1e-9)
  })

  it('scales the Line Presence dip linearly with Master Reactivity', () => {
    const half = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 0.5 } })
    half.step({ energy: 0, frames: 3 })
    closeTo(half.uniform('u_linePresence'), 1 - 0.45 * 0.5)
  })

  it('falls back to the user Line Presence when energy is unavailable', () => {
    const h = reactive({ [CINEMA2_HUMN_LINE_PRESENCE_ID]: 0.8 })
    h.step({ energy: 0, live: false, frames: 3 })
    closeTo(h.uniform('u_linePresence'), 0.8)
  })

  it('Complexity centers on 0.5 and adds at most +/-0.18 around the Fragmentation base', () => {
    for (const [complexity, expected] of [[0, 0.55 - 0.18], [0.5, 0.55], [1, 0.55 + 0.18]] as const) {
      const h = reactive()
      h.step({ complexity, frames: 3 })
      closeTo(h.uniform('u_fragmentation'), expected)
    }
  })

  it('clamps Fragmentation to 0..1 and ignores unavailable complexity', () => {
    const high = reactive({ [CINEMA2_HUMN_FRAGMENTATION_ID]: 1 })
    high.step({ complexity: 1, frames: 3 })
    expect(high.uniform('u_fragmentation')).toBe(1)
    const low = reactive({ [CINEMA2_HUMN_FRAGMENTATION_ID]: 0 })
    low.step({ complexity: 0, frames: 3 })
    expect(low.uniform('u_fragmentation')).toBe(0)
    const missing = reactive({ [CINEMA2_HUMN_FRAGMENTATION_ID]: 0.4 })
    missing.step({ complexity: 1, live: false, frames: 3 })
    closeTo(missing.uniform('u_fragmentation'), 0.4)
  })

  it('Track Energy adds up to +0.35 Facet Fill on top of the user base and clamps at 1', () => {
    for (const [trackCurve, expected] of [[0, 0], [0.5, 0.175], [1, 0.35]] as const) {
      const h = reactive()
      h.step({ trackCurve, frames: 3 })
      closeTo(h.uniform('u_facetFill'), expected)
    }
    const base = reactive({ [CINEMA2_HUMN_FACET_FILL_ID]: 0.8 })
    base.step({ trackCurve: 1, frames: 3 })
    expect(base.uniform('u_facetFill')).toBe(1)
  })

  it('leaves Facet Fill at the user base when the track energy curve is unavailable (no fabricated fallback)', () => {
    const h = reactive({ [CINEMA2_HUMN_FACET_FILL_ID]: 0.25 })
    h.step({ energy: 1, trackCurve: null, frames: 3 })
    closeTo(h.uniform('u_facetFill'), 0.25)
  })

  it('returns to the authored base when a signal disappears', () => {
    const h = reactive()
    h.step({ trackCurve: 1, energy: 0, frames: 3 })
    expect(h.uniform('u_facetFill')).toBeGreaterThan(0.3)
    h.step({ trackCurve: null, energy: 0, live: false, frames: 3 })
    expect(h.uniform('u_facetFill')).toBe(0)
    expect(h.uniform('u_linePresence')).toBe(1)
  })

  it('never writes music into persisted parameter state', () => {
    const h = reactive({ [CINEMA2_HUMN_FACET_FILL_ID]: 0.2 })
    const before = h.snapshot()
    h.step({ energy: 0, trackCurve: 1, complexity: 1, frames: 10 })
    expect(h.snapshot()).toBe(before)
    expect(h.uniform('u_facetFill')).toBeGreaterThan(0.2)
  })
})

// ── Color Shift + motion ────────────────────────────────────────────────────

describe('palette role movement and motion Audio Intelligence', () => {
  const shifted = (amount: number, mr = 1) => harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: mr, [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: amount } })

  it('weights high 0.65 and air 0.35 into the effective color shift', () => {
    for (const [high, air, expected] of [[1, 0, 0.65], [0, 1, 0.35], [1, 1, 1], [0.5, 0.5, 0.5], [0, 0, 0]] as const) {
      const h = shifted(1)
      h.step({ high, air, frames: 3 })
      closeTo(h.uniform('u_colorShift'), expected)
    }
  })

  it('scales with Color Shift Amount and is exactly zero at amount 0, Master Reactivity 0, or with no bands', () => {
    const half = shifted(0.5)
    half.step({ high: 1, air: 1, frames: 3 })
    closeTo(half.uniform('u_colorShift'), 0.5)
    const noAmount = shifted(0)
    noAmount.step({ high: 1, air: 1, frames: 3 })
    expect(noAmount.uniform('u_colorShift')).toBe(0)
    const noReactivity = shifted(1, 0)
    noReactivity.step({ high: 1, air: 1, frames: 3 })
    expect(noReactivity.uniform('u_colorShift')).toBe(0)
    const noBands = shifted(1)
    noBands.step({ high: 1, air: 1, live: false, frames: 3 })
    expect(noBands.uniform('u_colorShift')).toBe(0)
  })

  it('is deterministic between frames: identical input yields identical shift', () => {
    const a = shifted(1)
    const b = shifted(1)
    a.step({ high: 0.7, air: 0.3, frames: 6 })
    b.step({ high: 0.7, air: 0.3, frames: 6 })
    expect(a.uniform('u_colorShift')).toBe(b.uniform('u_colorShift'))
  })

  it('only ever redistributes authored colors: the shader has no hue math and the palette uniforms stay untouched', () => {
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('vec3 shiftedSlotColor(int slot)')
    for (const forbidden of ['hsv', 'hsl', 'hue', 'rainbow', 'u_time']) expect(CINEMA2_HUMN_FRAGMENT_SOURCE.toLowerCase()).not.toContain(forbidden)
    const h = shifted(1)
    const authored = ['u_skinPrimary', 'u_skinSecondary', 'u_skinAccent', 'u_patternInk', 'u_backgroundColor'] as const
    h.step({ high: 0, air: 0, frames: 3 })
    const before = authored.map(name => h.vec4(name))
    h.step({ high: 1, air: 1, frames: 6 })
    expect(authored.map(name => h.vec4(name))).toEqual(before)
  })

  it('Tension lifts motion up to +0.25 above the user base and clamps to 0..1', () => {
    const h = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.2 } })
    h.step({ tension: 0, frames: 3 })
    closeTo(h.uniform('u_motionAmount'), 0.2)
    h.step({ tension: 1, frames: 30, dt: 0.1 })
    closeTo(h.uniform('u_motionAmount'), 0.45, 3)
    const capped = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.95 } })
    capped.step({ tension: 1, frames: 3 })
    expect(capped.uniform('u_motionAmount')).toBe(1)
  })

  it('vocal presence restrains only the intelligence-added motion and never the user base', () => {
    const base = 0.6
    const h = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: base } })
    // Vocals with no tension: the user's 0.60 must be untouched.
    h.step({ tension: 0, vocal: 1, frames: 8 })
    closeTo(h.uniform('u_motionAmount'), base)
    // Tension + full vocals: added portion is 0.25 * (1 - 0.25) = 0.1875.
    const restrained = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.2 } })
    restrained.step({ tension: 1, vocal: 1, frames: 30, dt: 0.1 })
    closeTo(restrained.uniform('u_motionAmount'), 0.2 + 0.25 * 0.75, 3)
    const free = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.2 } })
    free.step({ tension: 1, vocal: 0, frames: 30, dt: 0.1 })
    expect(restrained.uniform('u_motionAmount')).toBeGreaterThan(0.2)
    expect(restrained.uniform('u_motionAmount')).toBeLessThan(free.uniform('u_motionAmount'))
  })

  it('keeps the BPM Sync / Motion Rate clock: motion time keeps advancing and is not driven by music energy', () => {
    const a = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.5 } })
    const b = harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 0.5 } })
    a.step({ tension: 0, energy: 0.1, frames: 12 })
    b.step({ tension: 1, energy: 0.9, frames: 12 })
    expect(a.uniform('u_motionTime')).toBe(b.uniform('u_motionTime'))
    expect(a.uniform('u_motionTime')).toBeGreaterThan(0)
  })
})

// ── Rhythmic events ─────────────────────────────────────────────────────────

describe('rhythmic fragment events', () => {
  const armed = () => harness({ state: { [CINEMA2_HUMN_FLICKER_AMOUNT_ID]: 1, [CINEMA2_HUMN_FRAGMENT_JITTER_ID]: 1 } })
  const cases = [
    { name: 'beat', uniform: 'u_beatFlicker', input: { beat: true }, hold: 0.02, release: 0.35 },
    { name: 'downbeat', uniform: 'u_downbeatReveal', input: { downbeat: true }, hold: 0.05, release: 0.5 },
    { name: 'kick', uniform: 'u_kickJitter', input: { kick: 1 }, hold: 0.02, release: 0.5 },
    { name: 'snare', uniform: 'u_snareEyeCheek', input: { snare: 1 }, hold: 0.02, release: 0.25 },
  ] as const

  for (const item of cases) {
    it(`${item.name}: fires instantly at full strength, holds, releases over its beat window, and returns to exactly zero`, () => {
      const h = armed()
      h.step({ frames: 2 })
      expect(h.uniform(item.uniform)).toBe(0)
      h.step({ ...item.input, frames: 1 })
      expect(h.uniform(item.uniform)).toBeCloseTo(1, 5)
      const beatSec = 60 / HUM_BPM
      const start = h.uniform(item.uniform)
      // Mid-release is strictly between 0 and 1.
      const midRelease = beatSec * (item.hold + item.release * 0.5)
      h.step({ dt: midRelease, frames: 1 })
      expect(h.uniform(item.uniform)).toBeGreaterThan(0.05)
      expect(h.uniform(item.uniform)).toBeLessThan(start)
      // Past the window it is exactly back to base.
      h.step({ dt: beatSec * (item.hold + item.release), frames: 1 })
      expect(h.uniform(item.uniform)).toBe(0)
    })
  }

  it('scales the event value by event strength', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 0.5, frames: 1 })
    closeTo(h.uniform('u_kickJitter'), 0.5, 3)
  })

  it('deduplicates a repeated event id instead of restarting or double-firing its envelope', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, frames: 1 })
    const seedA = h.uniform('u_kickSeed')
    // Re-present the same upstream frame: same event id, must be ignored.
    const runtime = h.runtime
    const before = runtime.getSnapshot().frameCount
    h.step({ kick: 0, dt: 0.05, frames: 1 })
    expect(runtime.getSnapshot().frameCount).toBeGreaterThan(before)
    expect(h.uniform('u_kickSeed')).toBe(seedA)
  })

  it('picks the same fragment subset for the same event identity and a different one for a different event', () => {
    const first = harness({ seed: 'seed-A' })
    const second = harness({ seed: 'seed-A' })
    const other = harness({ seed: 'seed-B' })
    for (const h of [first, second, other]) {
      h.step({ frames: 2 })
      h.step({ kick: 1, snare: 1, beat: true, downbeat: true, frames: 1 })
    }
    for (const name of ['u_kickSeed', 'u_snareSeed', 'u_beatSeed', 'u_downbeatSeed']) {
      expect(first.uniform(name)).toBe(second.uniform(name))
      expect(first.uniform(name)).toBeGreaterThanOrEqual(0)
      expect(first.uniform(name)).toBeLessThan(1)
      expect(first.uniform(name)).not.toBe(other.uniform(name))
    }
    const later = harness({ seed: 'seed-A' })
    later.step({ frames: 2 })
    later.step({ kick: 1, frames: 1 })
    const firstKick = later.uniform('u_kickSeed')
    later.step({ dt: 1, frames: 1 })
    later.step({ kick: 1, frames: 1 })
    expect(later.uniform('u_kickSeed')).not.toBe(firstKick)
  })

  it('does not depend on the frame counter: identical event streams at different absolute times share seeds only through event identity', () => {
    const a = harness({ seed: 'seed-C' })
    a.step({ frames: 2 })
    a.step({ kick: 1, frames: 1 })
    expect(a.uniform('u_kickSeed')).toBeGreaterThan(0)
  })

  it('never writes rhythmic state into persisted parameters', () => {
    const h = armed()
    const before = h.snapshot()
    h.step({ frames: 2 })
    h.step({ kick: 1, snare: 1, beat: true, downbeat: true, frames: 4 })
    expect(h.snapshot()).toBe(before)
  })

  it('a seek clears in-flight events and their seeds', () => {
    const h = armed()
    h.step({ frames: 2 })
    h.step({ kick: 1, snare: 1, frames: 1 })
    expect(h.uniform('u_kickJitter')).toBeGreaterThan(0.9)
    expect(h.uniform('u_kickSeed')).toBeGreaterThan(0)
    h.step({ timeSec: 3, frames: 1 }) // backwards seek
    h.step({ frames: 1 })
    expect(h.uniform('u_kickJitter')).toBe(0)
    expect(h.uniform('u_snareEyeCheek')).toBe(0)
    expect(h.uniform('u_kickSeed')).toBe(0)
    expect(h.uniform('u_snareSeed')).toBe(0)
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

  it('does not produce rhythmic uniforms beyond zero when there is no beat grid (no fabricated timing)', () => {
    const h = armed()
    h.step({ frames: 2, rhythm: false })
    h.step({ kick: 1, beat: true, rhythm: false, frames: 2 })
    expect(h.uniform('u_kickJitter')).toBe(0)
    expect(h.uniform('u_beatFlicker')).toBe(0)
  })
})

// ── Build choreography ──────────────────────────────────────────────────────

describe('build choreography', () => {
  const building = (state: Record<string, number> = {}) => harness({ state: { [CINEMA2_HUMN_MASTER_REACTIVITY_ID]: 1, ...state } })
  const build = (h: Harness, progress: number, frames = 40) => h.step({ buildProgress: progress, buildConfidence: progress, tension: 0, energy: 0.5, frames, dt: 0.1 })

  it('does nothing without a build', () => {
    const h = building()
    build(h, 0)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBe(0)
    expect(h.uniform('u_facetFill')).toBe(0)
    closeTo(h.uniform('u_fragmentation'), 0.55)
    expect(h.uniform('u_motionAmount')).toBe(0)
  })

  it('progressively coalesces the figure: facet fill and ghost emphasis rise, fragmentation falls, motion lifts', () => {
    const early = building()
    build(early, 0.3)
    const late = building()
    build(late, 1)
    expect(late.uniform('u_facetFill')).toBeGreaterThan(early.uniform('u_facetFill'))
    expect(late.uniform('u_facetFill')).toBeGreaterThan(0)
    expect(late.uniform('u_ghostEdgeEmphasis')).toBeGreaterThan(early.uniform('u_ghostEdgeEmphasis'))
    expect(late.uniform('u_fragmentation')).toBeLessThan(early.uniform('u_fragmentation'))
    expect(late.uniform('u_fragmentation')).toBeLessThan(0.55)
    expect(late.uniform('u_motionAmount')).toBeGreaterThan(early.uniform('u_motionAmount'))
  })

  it('never exceeds the specified maximum contributions', () => {
    const h = building()
    build(h, 1, 120)
    expect(h.uniform('u_facetFill')).toBeLessThanOrEqual(0.25 + 1e-6)
    expect(h.uniform('u_fragmentation')).toBeGreaterThanOrEqual(0.55 - 0.12 - 1e-6)
    expect(h.uniform('u_motionAmount')).toBeLessThanOrEqual(0.15 + 1e-6)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBeLessThanOrEqual(0.2 + 1e-6)
  })

  it('applies build color shift only through the authored role mixer (needs Color Shift Amount and high/air)', () => {
    const h = building({ [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: 0 })
    h.step({ buildProgress: 1, buildConfidence: 1, high: 1, air: 1, frames: 40, dt: 0.1 })
    // Amount 0 + a full build => resolved amount up to 0.20; high/air weight = 1.
    expect(h.uniform('u_colorShift')).toBeGreaterThan(0.1)
    expect(h.uniform('u_colorShift')).toBeLessThanOrEqual(0.2 + 1e-6)
    const none = building({ [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: 0 })
    none.step({ buildProgress: 0, buildConfidence: 0, high: 1, air: 1, frames: 40, dt: 0.1 })
    expect(none.uniform('u_colorShift')).toBe(0)
  })

  it('releases smoothly back to the user bases after the build ends without a drop', () => {
    const h = building({ [CINEMA2_HUMN_FACET_FILL_ID]: 0.1 })
    build(h, 1)
    const peak = h.uniform('u_facetFill')
    expect(peak).toBeGreaterThan(0.2)
    h.step({ buildProgress: 0, buildConfidence: 0, frames: 200, dt: 0.1 })
    closeTo(h.uniform('u_facetFill'), 0.1, 2)
    closeTo(h.uniform('u_fragmentation'), 0.55, 2)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBeLessThan(0.005)
  })

  it('does nothing when build capability is missing (loudness is never reinterpreted as a build)', () => {
    const h = building()
    h.step({ energy: 1, buildProgress: 1, buildConfidence: 1, structural: false, frames: 40, dt: 0.1 })
    expect(h.uniform('u_ghostEdgeEmphasis')).toBe(0)
    expect(h.uniform('u_facetFill')).toBe(0)
    closeTo(h.uniform('u_fragmentation'), 0.55)
  })

  it('is hard-disabled at Master Reactivity 0', () => {
    const h = harness()
    build(h, 1, 60)
    expect(h.uniform('u_ghostEdgeEmphasis')).toBe(0)
    expect(h.uniform('u_facetFill')).toBe(0)
    closeTo(h.uniform('u_fragmentation'), 0.55)
    expect(h.uniform('u_motionAmount')).toBe(0)
  })
})

// ── Zero-value hard disable of the event consumers ──────────────────────────

describe('event consumers are gated by their own amount controls', () => {
  it('routes the Flicker Amount and Fragment Jitter user values into the shader as independent gates', () => {
    const h = harness({ state: { [CINEMA2_HUMN_FLICKER_AMOUNT_ID]: 0.4, [CINEMA2_HUMN_FRAGMENT_JITTER_ID]: 0.7 } })
    h.step({ frames: 3 })
    closeTo(h.uniform('u_flickerAmount'), 0.4)
    closeTo(h.uniform('u_fragmentJitter'), 0.7)
    const off = harness()
    off.step({ frames: 3 })
    expect(off.uniform('u_flickerAmount')).toBe(0)
    expect(off.uniform('u_fragmentJitter')).toBe(0)
  })

  it('the shader multiplies every rhythmic effect by its gate and never adds to the whole frame', () => {
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('float beatLift = flickerAmt * clamp(u_beatFlicker, 0.0, 1.0) * 0.10;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('float downbeatLift = flickerAmt * clamp(u_downbeatReveal, 0.0, 1.0) * 0.25;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('float snareAmount = flickerAmt * clamp(u_snareEyeCheek, 0.0, 1.0) * 0.18;')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('float amount = clamp(u_fragmentJitter, 0.0, 1.0) * clamp(u_kickJitter, 0.0, 1.0);')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).toContain('vec2 shift = vec2(cos(angle), sin(angle)) * (0.012 * amount);')
    // The old global additive term must not come back.
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toContain('+ ghostFlicker')
    expect(CINEMA2_HUMN_FRAGMENT_SOURCE).not.toContain('p += vec2(jx, jy)')
  })
})
