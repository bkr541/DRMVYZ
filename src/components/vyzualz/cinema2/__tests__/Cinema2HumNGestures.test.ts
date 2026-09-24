/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_HUMN_AUTO_PERFORMANCE_ID,
  CINEMA2_HUMN_BACKGROUND_ID,
  CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID,
  CINEMA2_HUMN_FACET_FILL_ID,
  CINEMA2_HUMN_FIGURE_SCALE_ID,
  CINEMA2_HUMN_FLICKER_AMOUNT_ID,
  CINEMA2_HUMN_FRAGMENT_JITTER_ID,
  CINEMA2_HUMN_GESTURE_INTENSITY_ID,
  CINEMA2_HUMN_LINE_PRESENCE_ID,
  CINEMA2_HUMN_MASTER_REACTIVITY_ID,
  CINEMA2_HUMN_MOTION_AMOUNT_ID,
  CINEMA2_HUMN_MOTION_RATE_ID,
  CINEMA2_HUMN_PRESET_MANIFEST,
  CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID,
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  createCinema2DesignParentGroupModel,
} from '..'
import { createHarness, type Harness } from './support/Cinema2HumNHarness'
import { CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS } from './support/Cinema2HumNGestureFixtures'

const G = CINEMA2_HUMN_GESTURE_INTENSITY_ID
const MR = CINEMA2_HUMN_MASTER_REACTIVITY_ID
const AUTO = CINEMA2_HUMN_AUTO_PERFORMANCE_ID

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

const FAMILY_UNIFORM = { reach: 'u_gReach', shock: 'u_gShock', headGrab: 'u_gGrab', lunge: 'u_gLunge' } as const
type Family = keyof typeof FAMILY_UNIFORM
const FAMILIES = Object.keys(FAMILY_UNIFORM) as Family[]

const BEAT_SEC = 0.5

/** Plays a drop and returns the harness parked at the gesture's hold (peak). */
function playDrop(h: Harness, id: string, options: { settleFrames?: number } = {}) {
  h.step({ frames: 3 })
  h.step({ dropMoments: [{ id, timeSec: 10.12 }], frames: 1 })
  h.step({ frames: options.settleFrames ?? 4, dt: 0.05 })
}

function activeFamilies(h: Harness): Family[] {
  return FAMILIES.filter(family => h.uniform(FAMILY_UNIFORM[family]) > 0.02)
}

function poseSignature(h: Harness): string {
  return JSON.stringify({
    reach: h.uniform('u_gReach'), shock: h.uniform('u_gShock'), grab: h.uniform('u_gGrab'), lunge: h.uniform('u_gLunge'),
    scale: h.uniform('u_lungeScale'), yaw: h.uniform('u_lookYaw'), turn: h.uniform('u_bodyTurn'), nod: h.uniform('u_nod'),
    hand: h.vec4('u_reachHand'),
  })
}

function neutral(h: Harness) {
  for (const name of ['u_gReach', 'u_gShock', 'u_gGrab', 'u_gLunge', 'u_lookYaw', 'u_bodyTurn', 'u_nod']) expect(h.uniform(name), name).toBe(0)
  expect(h.uniform('u_lungeScale')).toBe(1)
  expect(h.vec4('u_reachHand')[2]).toBe(0)
}

describe('structural gestures through the production path', () => {
  it('the recorded fixture event ids still resolve to their families (guards the browser acceptance suite)', () => {
    for (const family of FAMILIES) {
      const h = harness({ state: { [G]: 1 } })
      playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS[family])
      expect(activeFamilies(h), family).toEqual([family])
    }
  })

  it('selects exactly one family per drop, deterministically from event identity, and reaches all four', () => {
    const seen = new Set<Family>()
    for (let index = 0; index < 30; index++) {
      const a = harness({ state: { [G]: 1 } })
      const b = harness({ state: { [G]: 1 } })
      playDrop(a, `select-${index}`)
      playDrop(b, `select-${index}`)
      expect(activeFamilies(a).length).toBe(1)
      expect(activeFamilies(a)).toEqual(activeFamilies(b))
      expect(poseSignature(a)).toBe(poseSignature(b))
      seen.add(activeFamilies(a)[0]!)
    }
    expect([...seen].sort()).toEqual([...FAMILIES].sort())
  })

  it('does not depend on the frame counter: a later replay of the same event id picks the same family', () => {
    const first = harness({ state: { [G]: 1 } })
    playDrop(first, 'stable-id')
    const second = harness({ state: { [G]: 1 } })
    second.step({ frames: 40 })
    second.step({ dropMoments: [{ id: 'stable-id', timeSec: second.uniform('u_motionTime') > -1 ? 11.5 : 0 }], frames: 1 })
    second.step({ frames: 4, dt: 0.05 })
    expect(activeFamilies(second)).toEqual(activeFamilies(first))
  })

  it('Gesture Intensity 0 produces no large gestures for any drop', () => {
    for (let index = 0; index < 12; index++) {
      const h = harness({ state: { [G]: 0 } })
      playDrop(h, `zero-${index}`)
      neutral(h)
    }
  })

  it('scales peak with Gesture Intensity (0, mid, max) for every family', () => {
    for (const family of FAMILIES) {
      const id = CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS[family]
      const values = [0, 0.5, 1].map(level => {
        const h = harness({ state: { [G]: level } })
        playDrop(h, id)
        return h.uniform(FAMILY_UNIFORM[family])
      })
      expect(values[0], family).toBe(0)
      expect(values[1], family).toBeGreaterThan(0.3)
      expect(values[1], family).toBeLessThan(values[2]!)
      expect(values[2], family).toBeGreaterThan(0.85)
      expect(values[2], family).toBeLessThanOrEqual(1)
    }
  })

  it('Reach projects a foreground hand of ~30-40% of frame width at peak and none at 0', () => {
    const h = harness({ state: { [G]: 1 } })
    playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.reach)
    const hand = h.vec4('u_reachHand')
    const aspect = 640 / 360
    const frameWidth = (2 * aspect) / 1.02
    const handWidth = hand[2]! * 1.44
    expect(handWidth / frameWidth).toBeGreaterThan(0.27)
    expect(handWidth / frameWidth).toBeLessThan(0.4)
    const arm = h.vec4('u_reachArm')
    expect(Math.hypot(arm[0]! - arm[2]!, arm[1]! - arm[3]!)).toBeGreaterThan(0.05)
  })

  it('Lunge scales figure geometry only: the resolved Figure Scale uniform and the grid path are untouched', () => {
    const baseline = harness({ state: { [G]: 1 } })
    baseline.step({ frames: 6 })
    const h = harness({ state: { [G]: 1 } })
    playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.lunge)
    expect(h.uniform('u_lungeScale')).toBeGreaterThan(1.2)
    expect(h.uniform('u_lungeScale')).toBeLessThanOrEqual(1.35 + 1e-9)
    expect(h.uniform('u_figureScale')).toBe(baseline.uniform('u_figureScale'))
    expect(h.get(CINEMA2_HUMN_FIGURE_SCALE_ID)).toBe(baseline.get(CINEMA2_HUMN_FIGURE_SCALE_ID))
    // The grid is derived from screen pixels; no gesture term may appear in it.
    const gridBlock = CINEMA2_HUMN_FRAGMENT_SOURCE.slice(
      CINEMA2_HUMN_FRAGMENT_SOURCE.indexOf('vec2 gridCell'),
      CINEMA2_HUMN_FRAGMENT_SOURCE.indexOf('float vignette'),
    )
    expect(gridBlock).toContain('gl_FragCoord')
    expect(gridBlock).not.toMatch(/u_lunge|u_gReach|u_gShock|u_gGrab|u_lookYaw|u_bodyTurn/)
  })

  it('releases every gesture to exactly neutral and returns the temporary lunge scale to the user Figure Scale', () => {
    for (const family of FAMILIES) {
      const h = harness({ state: { [G]: 1 } })
      playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS[family])
      expect(activeFamilies(h)).toEqual([family])
      // Walk the clock in sub-0.75s steps so the release plays out (a bigger jump is a seek).
      h.step({ dt: 0.3, frames: 8 })
      h.step({ frames: 2 })
      neutral(h)
    }
  })

  it('never writes gesture state into persisted parameters', () => {
    const h = harness({ state: { [G]: 1 } })
    const before = h.snapshot()
    playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.lunge)
    expect(h.snapshot()).toBe(before)
    expect(h.runtime.getParameterState().getValue(CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID)).not.toBe(true)
  })

  it('deduplicates a repeated event id: the gesture decays instead of restarting', () => {
    const h = harness({ state: { [G]: 1 } })
    playDrop(h, 'dedup-a')
    const hit = Math.max(...FAMILIES.map(family => h.uniform(FAMILY_UNIFORM[family])))
    h.step({ dt: BEAT_SEC * 0.8, frames: 1 })
    const decaying = Math.max(...FAMILIES.map(family => h.uniform(FAMILY_UNIFORM[family])))
    expect(decaying).toBeLessThan(hit)
    h.step({ dt: BEAT_SEC * 0.3, frames: 1 })
    expect(Math.max(...FAMILIES.map(family => h.uniform(FAMILY_UNIFORM[family])))).toBeLessThan(decaying)
  })

  it('a second distinct drop retriggers: the new gesture takes over and the old one releases', () => {
    const h = harness({ state: { [G]: 1 } })
    const { reach, shock } = CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS
    playDrop(h, reach)
    expect(activeFamilies(h)).toEqual(['reach'])
    h.step({ dropMoments: [{ id: reach, timeSec: 10.12 }, { id: shock, timeSec: 10.4 }], frames: 1, dt: 0.15 })
    h.step({ frames: 2, dt: 0.05 })
    expect(h.uniform('u_gShock')).toBeGreaterThan(0.3)
    h.step({ dt: BEAT_SEC, frames: 1 })
    h.step({ frames: 1 })
    expect(h.uniform('u_gReach')).toBe(0)
  })

  it('resets on seek, loop, source change and audio discontinuity', () => {
    const scenarios: Array<[string, (h: Harness) => void]> = [
      ['seek', h => h.step({ timeSec: 3, frames: 1 })],
      ['loop restart', h => h.step({ timeSec: 0.05, frames: 1 })],
      ['source change', h => h.step({ trackId: 'replacement-track', frames: 1 })],
      ['forward jump', h => h.step({ timeSec: 40, frames: 1 })],
    ]
    for (const [name, disturb] of scenarios) {
      const h = harness({ state: { [G]: 1 } })
      playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.headGrab)
      expect(activeFamilies(h), name).toEqual(['headGrab'])
      disturb(h)
      h.step({ frames: 2 })
      neutral(h)
    }
  })

  it('holds while paused and finishes only after resuming', () => {
    const h = harness({ state: { [G]: 1 } })
    playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.reach, { settleFrames: 2 })
    h.step({ dt: BEAT_SEC * 0.6, frames: 1 })
    const before = poseSignature(h)
    h.pause(true)
    h.step({ frames: 8 })
    expect(poseSignature(h)).toBe(before)
    h.pause(false)
    // Walk the clock in sub-0.75s steps so the release plays out (a bigger jump is a seek).
    h.step({ dt: 0.3, frames: 8 })
    h.step({ frames: 2 })
    neutral(h)
  })

  it('does nothing without a tempo, without drop confidence, or without a drop marker (no fabricated events)', () => {
    const noTempo = harness({ state: { [G]: 1 } })
    noTempo.step({ frames: 3, rhythm: false })
    noTempo.step({ dropMoments: [{ id: 'x', timeSec: 10.12 }], frames: 1, rhythm: false })
    noTempo.step({ frames: 4, dt: 0.05, rhythm: false })
    neutral(noTempo)

    const lowConfidence = harness({ state: { [G]: 1 } })
    lowConfidence.step({ frames: 3 })
    lowConfidence.step({ dropMoments: [{ id: 'y', timeSec: 10.12 }], dropConfidence: 0.1, frames: 1 })
    lowConfidence.step({ frames: 4, dt: 0.05 })
    neutral(lowConfidence)

    const noMarker = harness({ state: { [G]: 1 } })
    noMarker.step({ frames: 20, energy: 1, kick: 1, tension: 1 })
    neutral(noMarker)
  })

  it('re-entry starts from the authored neutral pose', () => {
    const first = harness({ state: { [G]: 1 } })
    playDrop(first, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.lunge)
    first.dispose()
    const second = harness({ state: { [G]: 1 } })
    second.step({ frames: 3 })
    neutral(second)
  })

  it('the four families produce four different poses', () => {
    const signatures = new Set<string>()
    for (const family of FAMILIES) {
      const h = harness({ state: { [G]: 1 } })
      playDrop(h, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS[family])
      signatures.add(poseSignature(h))
    }
    expect(signatures.size).toBe(4)
  })
})

describe('phrase and section-change body language through the production path', () => {
  const phrase = (h: Harness, id = 'phrase-a', frames = 4) => {
    h.step({ frames: 3 })
    h.step({ phrases: [{ id, timeSec: 10.12 }], frames: 1 })
    h.step({ frames, dt: 0.1 })
  }
  const section = (h: Harness, frames = 4) => {
    h.step({ frames: 3, sectionType: 'verse', sectionStartSec: 0 })
    h.step({ sectionType: 'chorus', sectionStartSec: 10.12, frames: 1 })
    h.step({ frames, dt: 0.1 })
  }
  const magnitude = (h: Harness) => Math.max(Math.abs(h.uniform('u_lookYaw')), Math.abs(h.uniform('u_bodyTurn')), h.uniform('u_nod'))

  it('a phrase boundary creates a modest look/turn only when Motion Amount or Gesture Intensity allows it', () => {
    const silent = harness()
    phrase(silent)
    neutral(silent)

    const withMotion = harness({ state: { [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
    phrase(withMotion)
    expect(magnitude(withMotion)).toBeGreaterThan(0.05)
    expect(magnitude(withMotion)).toBeLessThanOrEqual(0.5 + 1e-9)

    const withGesture = harness({ state: { [G]: 1 } })
    phrase(withGesture)
    expect(magnitude(withGesture)).toBeGreaterThan(0.05)
    expect(magnitude(withGesture)).toBeLessThanOrEqual(0.35 + 1e-9)
    expect(activeFamilies(withGesture)).toEqual([])
  })

  it('a section change is stronger than a phrase but stays far calmer than a drop and creates no drop pose', () => {
    const sectionHarness = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
    section(sectionHarness)
    const phraseHarness = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
    phrase(phraseHarness)
    expect(magnitude(sectionHarness)).toBeLessThanOrEqual(0.7 + 1e-9)
    expect(activeFamilies(sectionHarness)).toEqual([])
    expect(magnitude(sectionHarness)).toBeGreaterThan(0)
    expect(magnitude(phraseHarness)).toBeGreaterThan(0)
  })

  it('is deterministic from event identity and covers look, body turn, scan and recentre across events', () => {
    const signatures = new Set<string>()
    for (let index = 0; index < 40; index++) {
      const a = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
      const b = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
      phrase(a, `ph-${index}`, 8)
      phrase(b, `ph-${index}`, 8)
      expect(poseSignature(a)).toBe(poseSignature(b))
      signatures.add(`${Math.sign(a.uniform('u_lookYaw'))}:${Math.sign(a.uniform('u_bodyTurn'))}:${a.uniform('u_nod') > 0}`)
    }
    expect(signatures.size).toBeGreaterThan(2)
  })

  it('cleans up within four beats and never stays stuck', () => {
    for (const play of [phrase, section]) {
      const h = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
      play(h)
      h.step({ dt: 0.3, frames: 8 })
      h.step({ frames: 2 })
      neutral(h)
    }
  })

  it('is silent at both Motion Amount 0 and Gesture Intensity 0 for every structural event', () => {
    for (let index = 0; index < 10; index++) {
      const h = harness()
      phrase(h, `silent-${index}`)
      section(h)
      neutral(h)
    }
  })

  it('does nothing when the structural capabilities are unavailable', () => {
    const h = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
    h.step({ frames: 3, rhythm: false, structural: false })
    h.step({ phrases: [{ id: 'nope', timeSec: 10.12 }], frames: 1, rhythm: false, structural: false })
    h.step({ frames: 4, dt: 0.1, rhythm: false, structural: false })
    neutral(h)
  })

  it('does not fire on every beat', () => {
    const h = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
    h.step({ frames: 3 })
    let fired = 0
    for (let beat = 0; beat < 12; beat++) {
      h.step({ beat: true, frames: 1, dt: BEAT_SEC })
      if (magnitude(h) > 0) fired += 1
    }
    expect(fired).toBe(0)
  })

  it('resets on seek and source change', () => {
    for (const disturb of [(h: Harness) => h.step({ timeSec: 3, frames: 1 }), (h: Harness) => h.step({ trackId: 'other', frames: 1 })]) {
      const h = harness({ state: { [G]: 1, [CINEMA2_HUMN_MOTION_AMOUNT_ID]: 1 } })
      phrase(h, 'phrase-a', 2)
      expect(magnitude(h)).toBeGreaterThan(0)
      disturb(h)
      h.step({ frames: 2 })
      neutral(h)
    }
  })
})

describe('Inspector hierarchy', () => {
  it('keeps Master Controls flat with the four direct controls, puts Gesture Intensity in Design > Performance Motion, and never shows the runtime triggers', () => {
    const h = harness()
    const plan = h.runtime.getCompiledPresetPlan()
    const model = createCinema2DesignParentGroupModel(plan, h.runtime.getParameterState().getSnapshot())
    const master = model.find(parent => parent.id === 'master-controls')!
    expect(master.groups).toEqual([])
    expect(master.controls.map(control => control.definition.label)).toEqual(['Master Intensity', 'BPM Sync', 'Master Reactivity', 'Auto Performance'])
    const design = model.find(parent => parent.id === 'design')!
    const motion = design.groups.find(group => group.label === 'Performance Motion')!
    expect(motion.controls.map(control => control.definition.label)).toEqual(['Gesture Intensity'])
    expect(design.groups.map(group => group.label)).toEqual(expect.arrayContaining(['Composition', 'Motion', 'Stage', 'Figure Construction', 'Performance Motion']))
    const everyLabel = model.flatMap(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)]).map(control => control.definition.id)
    expect(everyLabel).not.toContain(CINEMA2_HUMN_STRUCTURAL_EVENT_INTENT_ID)
    expect(everyLabel.some(id => String(id).includes('event-intent'))).toBe(false)
  })
})

describe('Auto Performance', () => {
  const low = { energy: 0.05, trackCurve: 0.05 }
  const high = { energy: 0.95, trackCurve: 0.95 }
  const settle = (h: Harness, music: { energy: number; trackCurve: number }, frames = 14) => h.step({ ...music, frames, dt: 0.05 })

  it('defaults OFF and is a flat Master Controls boolean next to Master Intensity, Master Reactivity and BPM Sync', () => {
    const parameters = CINEMA2_HUMN_PRESET_MANIFEST.parameters ?? []
    const auto = parameters.find(parameter => parameter.id === AUTO)
    expect(auto).toMatchObject({ label: 'Auto Performance', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', persistence: 'preset' })
    expect(auto).not.toHaveProperty('group')
    const masterControls = parameters.filter(parameter => parameter.designParentGroup === 'master-controls').map(parameter => parameter.label).sort()
    expect(masterControls).toEqual(['Auto Performance', 'BPM Sync', 'Master Intensity', 'Master Reactivity'])
    expect(harness().get(AUTO)).toBe(false)
  })

  it('Auto OFF parity: the auto rules contribute nothing when the switch is off', () => {
    const off = harness({ state: { [MR]: 1 } })
    settle(off, high)
    const reference = harness({ state: { [MR]: 1 } })
    settle(reference, high)
    expect(off.uniform('u_facetFill')).toBe(reference.uniform('u_facetFill'))
    expect(off.uniform('u_linePresence')).toBe(reference.uniform('u_linePresence'))
  })

  it('emphasizes skin at high intensity and sparse lines at low intensity, bounded by Master Reactivity', () => {
    const off = harness({ state: { [MR]: 1 } })
    const on = harness({ state: { [MR]: 1, [AUTO]: true } })
    settle(off, high)
    settle(on, high)
    expect(on.uniform('u_facetFill')).toBeGreaterThan(off.uniform('u_facetFill'))
    expect(on.uniform('u_facetFill') - off.uniform('u_facetFill')).toBeLessThanOrEqual(0.2 + 1e-6)

    const offLow = harness({ state: { [MR]: 1 } })
    const onLow = harness({ state: { [MR]: 1, [AUTO]: true } })
    settle(offLow, low)
    settle(onLow, low)
    expect(onLow.uniform('u_linePresence')).toBeLessThan(offLow.uniform('u_linePresence'))
    expect(onLow.uniform('u_linePresence')).toBeGreaterThanOrEqual(0.55 - 1e-6)
  })

  it('cannot turn a deliberately zeroed authorization into an effect', () => {
    const on = harness({ state: { [AUTO]: true } }) // Master Reactivity 0
    settle(on, high)
    expect(on.uniform('u_facetFill')).toBe(0)
    expect(on.uniform('u_linePresence')).toBe(1)
    expect(on.uniform('u_colorShift')).toBe(0)

    const noFlicker = harness({ state: { [AUTO]: true, [MR]: 1 } })
    settle(noFlicker, high)
    expect(noFlicker.uniform('u_flickerAmount')).toBe(0)
    expect(noFlicker.uniform('u_fragmentJitter')).toBe(0)

    const noGesture = harness({ state: { [AUTO]: true, [MR]: 1 } })
    playDrop(noGesture, CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.reach)
    neutral(noGesture)
  })

  it('only scales user ceilings down: Gesture Intensity, Flicker, Jitter and Color Shift never exceed their user values', () => {
    const user = { [G]: 0.8, [CINEMA2_HUMN_FLICKER_AMOUNT_ID]: 0.7, [CINEMA2_HUMN_FRAGMENT_JITTER_ID]: 0.6, [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: 0.9, [MR]: 1 }
    for (const music of [low, high]) {
      const on = harness({ state: { ...user, [AUTO]: true } })
      settle(on, music)
      expect(on.uniform('u_flickerAmount')).toBeLessThanOrEqual(0.7 + 1e-6)
      expect(on.uniform('u_fragmentJitter')).toBeLessThanOrEqual(0.6 + 1e-6)
      const off = harness({ state: user })
      settle(off, music)
      expect(off.uniform('u_flickerAmount')).toBeCloseTo(0.7, 6)
      expect(off.uniform('u_fragmentJitter')).toBeCloseTo(0.6, 6)
    }
    const calm = harness({ state: { ...user, [AUTO]: true } })
    settle(calm, low)
    expect(calm.uniform('u_flickerAmount')).toBeLessThan(0.7)

    const id = CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.reach
    const manual = harness({ state: { [G]: 0.8 } })
    playDrop(manual, id)
    const auto = harness({ state: { [G]: 0.8, [AUTO]: true } })
    auto.step({ ...low, frames: 12, dt: 0.05 })
    auto.step({ ...low, dropMoments: [{ id, timeSec: 10.62 }], frames: 1 })
    auto.step({ ...low, frames: 4, dt: 0.05 })
    expect(manual.uniform('u_gReach')).toBeGreaterThan(0.5)
    expect(auto.uniform('u_gReach')).toBeGreaterThan(0)
    for (const name of ['u_gReach', 'u_gShock', 'u_gGrab', 'u_gLunge']) expect(auto.uniform(name)).toBeLessThanOrEqual(manual.uniform(name) + 1e-9)
  })

  it('never changes authored colors: palette emphasis goes through the existing role mixer only', () => {
    const on = harness({ state: { [AUTO]: true, [MR]: 1, [CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID]: 1 } })
    const authored = ['u_skinPrimary', 'u_skinSecondary', 'u_skinAccent', 'u_patternInk', 'u_backgroundColor', 'u_wireframeColor'] as const
    settle(on, low)
    const before = authored.map(name => on.vec4(name))
    on.step({ ...high, high: 1, air: 1, frames: 14, dt: 0.05 })
    expect(authored.map(name => on.vec4(name))).toEqual(before)
    expect(on.uniform('u_colorShift')).toBeGreaterThan(0)
  })

  it('auto gesture-family selection is deterministic and differs from manual only where the Director context allows', () => {
    const familyOf = (auto: boolean, music: typeof low, id: string) => {
      const h = harness({ state: { [G]: 1, [AUTO]: auto } })
      h.step({ ...music, frames: 12, dt: 0.05 })
      h.step({ ...music, dropMoments: [{ id, timeSec: 10.62 }], frames: 1 })
      h.step({ ...music, frames: 3, dt: 0.05 })
      return activeFamilies(h)
    }
    let differs = 0
    for (let index = 0; index < 24; index++) {
      const id = `auto-${index}`
      const onHigh = familyOf(true, high, id)
      expect(onHigh).toEqual(familyOf(true, high, id))
      if (onHigh.length === 1 && JSON.stringify(onHigh) !== JSON.stringify(familyOf(false, high, id))) differs += 1
    }
    expect(differs).toBeGreaterThan(0)
  })

  it('manual takeover: editing an auto-influenced control turns Auto Performance off immediately and Auto stops fighting the user value', () => {
    const h = harness({ state: { [AUTO]: true, [MR]: 1 } })
    settle(h, high)
    expect(h.get(AUTO)).toBe(true)
    const autoFill = h.uniform('u_facetFill')
    h.set(CINEMA2_HUMN_FACET_FILL_ID, 0.3)
    expect(h.get(AUTO)).toBe(false)
    expect(h.get(CINEMA2_HUMN_FACET_FILL_ID)).toBe(0.3)
    settle(h, high)
    // Only the reactive (non-auto) contribution remains: exactly what Auto OFF gives.
    const reference = harness({ state: { [MR]: 1, [CINEMA2_HUMN_FACET_FILL_ID]: 0.3 } })
    settle(reference, high)
    expect(h.uniform('u_facetFill')).toBeCloseTo(reference.uniform('u_facetFill'), 9)
    expect(autoFill).not.toBe(h.uniform('u_facetFill'))
  })

  it('every auto-influenced control takes over; hard user-owned controls and invalid edits do not touch Auto Performance', () => {
    const takeover = [G, CINEMA2_HUMN_LINE_PRESENCE_ID, CINEMA2_HUMN_FACET_FILL_ID, CINEMA2_HUMN_COLOR_SHIFT_AMOUNT_ID, CINEMA2_HUMN_FLICKER_AMOUNT_ID, CINEMA2_HUMN_FRAGMENT_JITTER_ID]
    for (const id of takeover) {
      const h = harness({ state: { [AUTO]: true } })
      h.set(id, 0.5)
      expect(h.get(AUTO), id).toBe(false)
    }
    const owned: Array<[typeof CINEMA2_HUMN_BACKGROUND_ID | typeof CINEMA2_HUMN_MOTION_RATE_ID | typeof MR, number | string | number[]]> = [
      [CINEMA2_HUMN_BACKGROUND_ID, [0.1, 0.1, 0.1, 1] as unknown as number],
      [CINEMA2_HUMN_MOTION_RATE_ID, '2x'],
      [MR, 0.4],
    ]
    for (const [id, value] of owned) {
      const h = harness({ state: { [AUTO]: true } })
      expect(h.runtime.getParameterState().setPersistentValue(id, value)).toMatchObject({ ok: true })
      expect(h.get(AUTO), String(id)).toBe(true)
    }
    const invalid = harness({ state: { [AUTO]: true } })
    expect(invalid.runtime.getParameterState().setPersistentValue(CINEMA2_HUMN_FACET_FILL_ID, 'not-a-number')).toMatchObject({ ok: false })
    expect(invalid.get(AUTO)).toBe(true)
  })

  it('Auto Performance rules only target the four allowed decision domains and never a hard user-owned control', () => {
    const auto = (CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []).filter(rule => rule.enabledParameter?.$ref === AUTO)
    expect(auto.length).toBeGreaterThan(0)
    const allowed = new Set(['facetFill', 'autoLineSparse', 'gestureIntensity', 'colorShiftAmount', 'flickerAmount', 'fragmentJitter'])
    for (const rule of auto) {
      for (const action of rule.actions) {
        const property = (action.target as { property?: string }).property ?? ''
        expect(allowed.has(property), `${rule.id}:${property}`).toBe(true)
        if (action.operation === 'multiply') expect(Number(action.value), `${rule.id}:${property} must scale down`).toBeLessThanOrEqual(1)
      }
    }
    const forbidden = new Set(['backgroundColor', 'wireframeColor', 'skinPrimary', 'skinSecondary', 'skinAccent', 'patternInk', 'lineWeight', 'meshDetail', 'fillStyle', 'figureScale', 'gridPresence', 'motionRate', 'bpmSync', 'masterIntensity', 'masterReactivity', 'autoPerformance'])
    for (const rule of CINEMA2_HUMN_PRESET_MANIFEST.choreography?.rules ?? []) {
      for (const action of rule.actions) expect(forbidden.has((action.target as { property?: string }).property ?? ''), `${rule.id}`).toBe(false)
    }
  })

  it('resets cleanly on seek/source change and starts neutral after re-entry', () => {
    const h = harness({ state: { [G]: 1, [AUTO]: true } })
    h.step({ ...high, frames: 12, dt: 0.05 })
    h.step({ ...high, dropMoments: [{ id: CINEMA2_HUMN_GESTURE_FIXTURE_EVENT_IDS.reach, timeSec: 10.62 }], frames: 1 })
    h.step({ ...high, frames: 3, dt: 0.05 })
    h.step({ ...high, timeSec: 2, frames: 1 })
    h.step({ ...high, frames: 2 })
    neutral(h)
    h.dispose()
    const again = harness({ state: { [G]: 1, [AUTO]: true } })
    again.step({ ...high, frames: 3 })
    neutral(again)
  })
})
