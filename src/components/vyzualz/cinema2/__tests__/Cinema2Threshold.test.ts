import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { CINEMA2_DESIGN_PARENT_GROUP_IDS } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import {
  CINEMA2_THRESHOLD_NATIVE_MODULE_TYPE_ID,
  cinema2ThresholdNativeModuleDefinition,
} from '../modules/Cinema2ThresholdNativeModule'
import {
  THRESHOLD_INSTANCE_FLOATS,
  THRESHOLD_PERIOD,
  THRESHOLD_RING_CENTER,
  THRESHOLD_ZONE_CORRIDOR,
  THRESHOLD_ZONE_FIELD,
  THRESHOLD_ZONE_RING,
  buildThresholdLayout,
  packThresholdInstances,
  thresholdPeriodIndices,
  THRESHOLD_INSTANCE_BUDGETS,
  THRESHOLD_PUFF_FLOATS,
  THRESHOLD_TIER_BY_QUALITY,
  buildThresholdChunks,
  buildThresholdDetail,
  buildThresholdSmoke,
  countThresholdInstances,
  packThresholdPuffs,
  visibleThresholdRanges,
} from '../modules/threshold/Cinema2ThresholdLayout'
import { ThresholdReactiveState } from '../modules/threshold/Cinema2ThresholdReactiveState'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import {
  CINEMA2_THRESHOLD_BPM_SYNC_ID,
  CINEMA2_THRESHOLD_CAMERA_ID,
  CINEMA2_THRESHOLD_CAMERA_MOTION_ID,
  CINEMA2_THRESHOLD_INTENSITY_ID,
  CINEMA2_THRESHOLD_PRESET_ID,
  CINEMA2_THRESHOLD_PRESET_MANIFEST,
} from '../presets/Cinema2ThresholdPreset'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { humMusicFrame, type HumFrameInput } from './support/Cinema2HumNFrameFactory'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat', 'music.downbeat',
  'music.rhythm-events', 'music.phrase', 'music.drop', 'visual-director.significance',
] as const

// ── Layout ────────────────────────────────────────────────────────────────────────────────────

/** World-space direction of an instance's LED face (local +Z) after Ry(yaw) * Rx(pitch) * Rz(roll). */
function faceNormal(instance: ReturnType<typeof buildThresholdLayout>[number]): [number, number, number] {
  const [yaw, pitch, roll] = instance.rotation
  // Rz(roll) leaves +Z unchanged; Rx(pitch) then Ry(yaw).
  const y1 = -Math.sin(pitch)
  const z1 = Math.cos(pitch)
  void roll
  return [Math.sin(yaw) * z1, y1, Math.cos(yaw) * z1]
}

function lowestPoint(instance: ReturnType<typeof buildThresholdLayout>[number]): number {
  const [yaw, pitch, roll] = instance.rotation
  const [w, h, d] = instance.size
  let lowest = Infinity
  for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    let [x, y, z] = [sx * w, sy * h, sz * d]
    ;[x, y] = [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll)]
    ;[y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)]
    void yaw
    lowest = Math.min(lowest, instance.position[1] + y)
  }
  return lowest
}

describe('Threshold layout', () => {
  const layout = buildThresholdLayout(1337, { extras: false })

  it('is deterministic and packs to the vertex layout', () => {
    expect(buildThresholdLayout(1337, { extras: false })).toEqual(layout)
    expect(buildThresholdLayout(7, { extras: false })).not.toEqual(layout)
    const packed = packThresholdInstances(layout)
    expect(packed.length).toBe(layout.length * THRESHOLD_INSTANCE_FLOATS)
    expect(packed.every(Number.isFinite)).toBe(true)
    expect(layout.length).toBeGreaterThan(40)
  })

  it('contains all three scenes inside one period along the flight direction', () => {
    const zones = new Set(layout.map(instance => instance.zone))
    expect([...zones].sort()).toEqual([THRESHOLD_ZONE_CORRIDOR, THRESHOLD_ZONE_FIELD, THRESHOLD_ZONE_RING])
    for (const instance of layout) {
      expect(-instance.position[2]).toBeGreaterThan(0)
      expect(-instance.position[2]).toBeLessThan(THRESHOLD_PERIOD + 5)
      expect(instance.rank).toBeGreaterThanOrEqual(0)
      expect(instance.rank).toBeLessThan(1)
    }
    // The three scenes appear in order down the lap.
    const meanDistance = (zone: number) => {
      const members = layout.filter(instance => instance.zone === zone)
      return members.reduce((sum, instance) => sum - instance.position[2], 0) / members.length
    }
    expect(meanDistance(THRESHOLD_ZONE_CORRIDOR)).toBeLessThan(meanDistance(THRESHOLD_ZONE_FIELD))
    expect(meanDistance(THRESHOLD_ZONE_FIELD)).toBeLessThan(meanDistance(THRESHOLD_ZONE_RING))
  })

  it('turns corridor LED faces toward the aisle and ring LED faces toward the flight path', () => {
    for (const instance of layout.filter(entry => entry.zone === THRESHOLD_ZONE_CORRIDOR && entry.role > 0)) {
      const normal = faceNormal(instance)
      expect(Math.sign(normal[0])).toBe(-Math.sign(instance.position[0]))
    }
    for (const instance of layout.filter(entry => entry.zone === THRESHOLD_ZONE_RING)) {
      const normal = faceNormal(instance)
      const towardCentre: [number, number] = [-instance.position[0], -(instance.position[2] + THRESHOLD_RING_CENTER)]
      const length = Math.hypot(...towardCentre)
      const alignment = (normal[0] * towardCentre[0] + normal[2] * towardCentre[1]) / (length * Math.hypot(normal[0], normal[2]))
      expect(alignment).toBeGreaterThan(0.95)
    }
    for (const instance of layout.filter(entry => entry.zone === THRESHOLD_ZONE_FIELD)) {
      // Faces of hanging monoliths point back toward the camera (+Z).
      expect(faceNormal(instance)[2]).toBeGreaterThan(0)
    }
  })

  it('stands standing monoliths on the floor and keeps the flight path clear of every monolith', () => {
    for (const instance of layout.filter(entry => entry.zone !== THRESHOLD_ZONE_FIELD)) {
      expect(lowestPoint(instance)).toBeGreaterThan(-0.05)
    }
    // The camera sways within ~1.5 units of x = 0; nothing may sit in that lane or block the ring centre.
    for (const instance of layout) {
      if (instance.zone === THRESHOLD_ZONE_RING) continue
      expect(Math.abs(instance.position[0]) - instance.size[0]).toBeGreaterThan(3)
    }
  })

  it('builds the corridor as an evenly spaced, perfectly mirrored colonnade of tall white-capable panels with no clutter', () => {
    const corridorAll = layout.filter(entry => entry.zone === THRESHOLD_ZONE_CORRIDOR)
    // Main LED screens plus the hardware that holds them (housing tower, bezel, plinth, status lights): no random rear towers or loose support panels.
    expect(corridorAll.every(entry => entry.role >= 1)).toBe(true)
    const corridor = corridorAll.filter(entry => entry.role === 1)
    const pairs = new Map<number, typeof corridor>()
    for (const entry of corridor) pairs.set(entry.row, [...(pairs.get(entry.row) ?? []), entry])
    expect(pairs.size).toBeGreaterThanOrEqual(7)
    const distances: number[] = []
    for (const [, pair] of [...pairs.entries()].sort((a, b) => a[0] - b[0])) {
      expect(pair).toHaveLength(2)
      const [left, right] = pair[0].position[0] < 0 ? pair : [pair[1], pair[0]]
      // Mirrored: same height, size, distance, rank; opposite x.
      expect(left.position[0]).toBeCloseTo(-right.position[0])
      expect(left.position[1]).toBeCloseTo(right.position[1])
      expect(left.position[2]).toBeCloseTo(right.position[2])
      expect(left.size).toEqual(right.size)
      expect(left.rank).toBe(right.rank)
      expect(left.size[1]).toBeGreaterThanOrEqual(30)
      distances.push(-left.position[2])
    }
    const gaps = distances.slice(1).map((distance, index) => distance - distances[index])
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-9)
    // Far pairs open last, so the set opens symmetrically from the camera outward.
    const ranks = [...pairs.entries()].sort((a, b) => a[0] - b[0]).map(([, pair]) => pair[0].rank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('seats every corridor screen in a housing tower with a bezel, plinth and status lights, standing on the floor', () => {
    const corridor = layout.filter(entry => entry.zone === THRESHOLD_ZONE_CORRIDOR)
    const screens = corridor.filter(entry => entry.role === 1)
    for (const screen of screens) {
      const same = corridor.filter(entry => entry.row === screen.row && entry.side === screen.side)
      const housing = same.filter(entry => entry.role === 3)
      expect(housing).toHaveLength(1)
      // Behind the screen (further from the aisle), touching its back face, taller than it, standing on the floor.
      const backFace = Math.abs(screen.position[0]) + screen.size[2] / 2
      const frontOfHousing = Math.abs(housing[0]!.position[0]) - housing[0]!.size[2] / 2
      expect(frontOfHousing).toBeCloseTo(backFace)
      expect(housing[0]!.size[1]).toBeGreaterThan(screen.size[1])
      expect(housing[0]!.position[1] - housing[0]!.size[1] / 2).toBeCloseTo(0)
      // Four bezel bars and a plinth (role 4), and two status lights (role 2).
      expect(same.filter(entry => entry.role === 4)).toHaveLength(5)
      expect(same.filter(entry => entry.role === 2)).toHaveLength(2)
      // The screen sits above the plinth, and the plinth never rises above the screen's lower edge.
      const plinth = same.filter(entry => entry.role === 4).sort((a, b) => b.size[0] - a.size[0])[0]!
      expect(plinth.position[1] + plinth.size[1] / 2).toBeLessThan(screen.position[1] - screen.size[1] / 2 + 1e-6)
    }
    // Housings are close together (a dense colonnade) but never overlap their neighbours.
    const housings = corridor.filter(entry => entry.role === 3 && entry.side === 0).sort((a, b) => b.position[2] - a.position[2])
    for (let index = 1; index < housings.length; index += 1) {
      const gap = housings[index - 1]!.position[2] - housings[index]!.position[2] - housings[index]!.size[0]
      expect(gap).toBeGreaterThan(0)
    }
  })

  it('draws the current lap and its neighbours, so the flight can repeat endlessly', () => {
    expect(thresholdPeriodIndices(0)).toEqual([-1, 0, 1])
    expect(thresholdPeriodIndices(-THRESHOLD_PERIOD * 3.4)).toEqual([2, 3, 4])
  })
})

// ── Reactive state ───────────────────────────────────────────────────────────────────────────

function reactiveHarness() {
  const state = new ThresholdReactiveState()
  const director = new Cinema2VisualDirector()
  let sequence = 1
  let source = humMusicFrame({ frameId: 1, timeSec: 0 })
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => source,
    getPublicationMeta: () => ({ sequence, publishedAtMs: source.timeSec * 1000, publisherId: 'threshold-test', kind: 'frame' as const }),
  })
  let visualFrameId = 0
  let previousMs = 0
  const BPM = 120
  const beatSec = 60 / BPM

  function step(beats: number, extra: Partial<Omit<HumFrameInput, 'frameId' | 'timeSec'>> = {}, options: { reactivity?: number; bpmSync?: boolean; bpm?: number; transport?: Partial<NonNullable<Cinema2ModuleFrameReadContext['transport']>> } = {}) {
    const beatIndex = Math.floor(beats)
    const onBeat = Math.abs(beats - beatIndex) < 1e-9
    sequence += 1
    const timeSec = beats * beatSec
    const music = humMusicFrame({ ...extra, frameId: source.frameId + 1, timeSec, beat: onBeat, downbeat: onBeat && beatIndex % 4 === 0, bpm: options.bpm ?? BPM })
    source = {
      ...music,
      rhythm: {
        ...music.rhythm,
        bpm: options.bpm ?? BPM,
        beatIndex,
        beatPhase: beats - beatIndex,
        beatInBar: beatIndex % 4,
        barIndex: Math.floor(beatIndex / 4),
        beatHit: onBeat,
        downbeatHit: onBeat && beatIndex % 4 === 0,
        phrase16Hit: onBeat && beatIndex % 16 === 0,
        beatEventTimeSec: timeSec,
      },
    }
    const audio = bridge.capture(++visualFrameId)
    const timestampMs = timeSec * 1000
    const frame = Object.freeze({
      frameId: visualFrameId,
      timestampMs,
      deltaTimeSec: Math.max(0, (timestampMs - previousMs) / 1000),
      elapsedTimeSec: timestampMs / 1000,
      viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
      contextGeneration: 1,
      transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'track', timeSec, bpmSync: options.bpmSync ?? false, ...options.transport },
      audio,
      director: director.capture(audio),
    }) as Readonly<Cinema2ModuleFrameReadContext>
    previousMs = timestampMs
    return state.update(frame, options.reactivity ?? 1, options.bpmSync ?? false)
  }
  return { state, step }
}

describe('Threshold reactive state', () => {
  it('pulses support screens on the kick and lets the pulse decay', () => {
    const { step } = reactiveHarness()
    expect(step(0.25).kick).toBe(0)
    step(0.75)
    const hit = step(1, { kick: 0.9 })
    expect(hit.kick).toBeGreaterThan(0.6)
    let later = hit
    for (let beat = 1.25; beat <= 2; beat += 0.25) later = step(beat)
    expect(later.kick).toBeLessThan(hit.kick * 0.2)
  })

  it('does not retrigger a held event: an event id is acted on once', () => {
    const { step } = reactiveHarness()
    step(1, { kick: 1 })
    const decayed = step(1.05, {}, {})
    const again = step(1.1, {})
    expect(again.kick).toBeLessThan(decayed.kick)
  })

  it('flashes on the snare, alternates rows with beat pairs, and launches a sweep on each downbeat', () => {
    const { step } = reactiveHarness()
    step(0.5)
    expect(step(1, { snare: 0.8 }).snare).toBeGreaterThan(0.5)
    let frame = step(1)
    const parityAt: Record<number, number> = {}
    for (let beat = 1.25; beat <= 8; beat += 0.25) {
      frame = step(beat)
      if (Number.isInteger(beat)) parityAt[beat] = frame.beatParity
    }
    expect(parityAt[1]).toBeUndefined()
    expect(parityAt[2]).toBe(1)
    expect(parityAt[4]).toBe(0)
    expect(parityAt[6]).toBe(1)
    const start = step(8)
    expect(start.sweepFront).toBeLessThan(1)
    expect(start.sweepStrength).toBeGreaterThan(0.4)
    let later = start
    for (let beat = 8.25; beat <= 9; beat += 0.25) later = step(beat)
    expect(later.sweepFront).toBeGreaterThan(start.sweepFront + 10)
    expect(later.sweepStrength).toBeGreaterThan(0)
  })

  it('locks sweep speed to the track tempo only when BPM Sync is on', () => {
    const front = (bpmSync: boolean) => {
      const { step } = reactiveHarness()
      step(0, {}, { bpmSync, bpm: 180, transport: { bpmSync } })
      step(4, {}, { bpmSync, bpm: 180, transport: { bpmSync } })
      return step(5, {}, { bpmSync, bpm: 180, transport: { bpmSync } })
    }
    const synced = front(true)
    const free = front(false)
    expect(synced.syncEnabled).toBe(true)
    expect(free.syncEnabled).toBe(false)
    // 180 BPM sweeps at 1.5x the 120 BPM reference speed when synced.
    expect(synced.sweepFront).toBeGreaterThan(free.sweepFront * 1.3)
  })

  it('swaps the leading side every phrase', () => {
    const { step } = reactiveHarness()
    let side = step(0).phraseSide
    const sides: number[] = [side]
    // Step beat by beat: a jump of many seconds is (correctly) treated as a seek and resets the state.
    for (let beat = 1; beat <= 33; beat += 1) {
      side = step(beat).phraseSide
      if (beat === 15 || beat === 16 || beat === 31 || beat === 32) sides.push(side)
    }
    const [atStart, beforeFirst, afterFirst, beforeSecond, afterSecond] = sides
    expect(beforeFirst).toBe(atStart)
    expect(afterFirst).not.toBe(beforeFirst)
    expect(beforeSecond).toBe(afterFirst)
    expect(afterSecond).not.toBe(beforeSecond)
  })

  it('opens more screens as a build climbs and flashes everything on a drop', () => {
    const quiet = reactiveHarness()
    const building = reactiveHarness()
    let quietFrame = quiet.step(0)
    let buildFrame = building.step(0)
    for (let beat = 0.25; beat <= 8; beat += 0.25) {
      quietFrame = quiet.step(beat, { buildProgress: 0, energy: 0.1 })
      buildFrame = building.step(beat, { buildProgress: 1, buildConfidence: 1, energy: 0.9, tension: 1, sectionType: 'build' })
    }
    expect(buildFrame.arc).toBeGreaterThan(quietFrame.arc + 0.05)
    expect(buildFrame.energy).toBeGreaterThan(quietFrame.energy)

    const { step } = reactiveHarness()
    step(0, { dropConfidence: 0.02 })
    expect(step(1, { dropConfidence: 0.95 }).drop).toBeGreaterThan(0.5)
    let released = step(1)
    for (let beat = 1.25; beat <= 6; beat += 0.25) released = step(beat, { dropConfidence: 0.95 })
    expect(released.drop).toBeLessThan(0.15)
  })

  it('never leaves the set dark while music plays: quiet, low-energy passages keep the near screens open and the level above half', () => {
    for (const energy of [0, 0.05, 0.12, 0.3]) {
      const { step } = reactiveHarness()
      let frame = step(0)
      for (let beat = 0.25; beat <= 12; beat += 0.25) frame = step(beat, { energy, buildProgress: 0, sectionType: 'verse' })
      // The Visual Director calls very quiet passages 'low' (held at half); anything with some energy stays mostly open and bright.
      expect(frame.arc, `arc at energy ${energy}`).toBeGreaterThanOrEqual(energy >= 0.3 ? 0.6 : 0.48)
      expect(frame.level, `level at energy ${energy}`).toBeGreaterThanOrEqual(energy >= 0.3 ? 0.7 : 0.48)
    }
    // Even a breakdown holds half the corridor open and the level at half.
    const { step } = reactiveHarness()
    let frame = step(0)
    for (let beat = 0.25; beat <= 16; beat += 0.25) frame = step(beat, { energy: 0.02, buildProgress: 0, sectionType: 'breakdown' })
    expect(frame.arc).toBeGreaterThanOrEqual(0.48)
    expect(frame.level).toBeGreaterThanOrEqual(0.48)
    expect(frame.level).toBeLessThan(0.75)
  })

  it('holds a drop SECTION at full brightness with a beat-by-beat strobe, long after the drop moment has decayed', () => {
    const verse = reactiveHarness()
    const drop = reactiveHarness()
    let verseFrame = verse.step(0)
    let dropFrame = drop.step(0)
    for (let beat = 0.25; beat <= 24; beat += 0.25) {
      verseFrame = verse.step(beat, { energy: 0.15, buildProgress: 0, sectionType: 'verse', dropConfidence: 0.02 })
      dropFrame = drop.step(beat, { energy: 0.15, buildProgress: 0, sectionType: 'drop', dropConfidence: 0.3 })
    }
    expect(dropFrame.drop).toBeLessThan(0.05) // the one-shot flash is long gone...
    expect(dropFrame.dropHold).toBeGreaterThan(0.9) // ...but the section is still a drop
    expect(dropFrame.level).toBeGreaterThan(0.95)
    expect(dropFrame.level).toBeGreaterThan(verseFrame.level)
    expect(verseFrame.dropHold).toBeLessThan(0.05)
    // The strobe flips every beat.
    const flips = new Set<number>()
    for (let beat = 24.25; beat <= 28; beat += 0.25) if (Number.isInteger(beat)) flips.add(drop.step(beat, { energy: 0.15, sectionType: 'drop', dropConfidence: 0.3 }).beatFlip)
    expect(flips.size).toBe(2)
  })

  it('BPM Sync ON pulses the screens on every beat of the grid and sweeps every bar even when no events were detected; OFF reacts to events only', () => {
    const run = (bpmSync: boolean) => {
      const { step } = reactiveHarness()
      const pulses: number[] = []
      const sweeps: number[] = []
      step(0, {}, { bpmSync })
      for (let beat = 0.25; beat <= 12; beat += 0.25) {
        // The grid runs but the beat / downbeat / kick events are not reported (a detector that misses them).
        const frame = step(beat + 0.001, { beat: false, downbeat: false, kick: 0, snare: 0, energy: 0.2, buildProgress: 0 }, { bpmSync })
        pulses.push(frame.beatPulse)
        sweeps.push(frame.sweepStrength)
      }
      return { pulses, sweeps }
    }
    const locked = run(true)
    const free = run(false)
    expect(Math.max(...locked.pulses)).toBeGreaterThan(0.6)
    expect(Math.max(...locked.sweeps)).toBeGreaterThan(0.3)
    // (The very first step carries a detected beat; look past its decay.)
    expect(Math.max(...free.pulses.slice(8))).toBeLessThan(0.05)
    expect(Math.max(...free.sweeps.slice(30))).toBe(0)
    // Every beat of the grid restarts the pulse: 12 beats -> 12 rising edges.
    const edges = locked.pulses.filter((value, index) => index > 0 && value > locked.pulses[index - 1]! + 0.3).length
    expect(edges).toBeGreaterThanOrEqual(10)
  })

  it('BPM Sync is Threshold\'s own switch: the host dock Sync neither enables nor disables it', () => {
    const state = (presetSync: boolean, dockSync: boolean) => {
      const { step } = reactiveHarness()
      step(0, {}, { bpmSync: presetSync, bpm: 150, transport: { bpmSync: dockSync } })
      return step(1, {}, { bpmSync: presetSync, bpm: 150, transport: { bpmSync: dockSync } })
    }
    expect(state(true, false)).toMatchObject({ syncEnabled: true, locked: true })
    expect(state(true, true)).toMatchObject({ syncEnabled: true, locked: true })
    expect(state(false, true)).toMatchObject({ syncEnabled: false, locked: false })
    expect(state(false, false)).toMatchObject({ syncEnabled: false, locked: false })
  })

  it('steps support screens back for vocals and shimmers with the highs', () => {
    const { step } = reactiveHarness()
    let frame = step(0)
    for (let beat = 0.25; beat <= 4; beat += 0.25) frame = step(beat, { vocal: 1, high: 0.9 })
    expect(frame.vocal).toBeGreaterThan(0.4)
    expect(frame.highs).toBeGreaterThan(0.3)
  })

  it('is full white and symmetric at idle, and lets music dim the set and energy bring it back', () => {
    const idle = new ThresholdReactiveState()
    const idleFrame = idle.update(Object.freeze({
      frameId: 1, timestampMs: 0, deltaTimeSec: 1 / 60, elapsedTimeSec: 0, viewport: { width: 1280, height: 720, dpr: 1 },
      contextGeneration: 1, audio: null, director: null,
    }) as Readonly<Cinema2ModuleFrameReadContext>, 1, false)
    expect(idleFrame).toMatchObject({ level: 1, arc: 1, phraseSide: -1, audioActive: false })

    const quiet = reactiveHarness()
    const loud = reactiveHarness()
    let quietFrame = quiet.step(0)
    let loudFrame = loud.step(0)
    for (let beat = 0.25; beat <= 8; beat += 0.25) {
      quietFrame = quiet.step(beat, { buildProgress: 0, energy: 0.05 })
      loudFrame = loud.step(beat, { buildProgress: 1, buildConfidence: 1, energy: 0.95, tension: 1, sectionType: 'build' })
    }
    expect(quietFrame.level).toBeLessThan(0.8)
    expect(loudFrame.level).toBeGreaterThan(quietFrame.level + 0.1)
  })

  it('collapses to the idle look at zero reactivity, and with no source or after a seek', () => {
    const muted = reactiveHarness()
    let frame = muted.step(0, {}, { reactivity: 0 })
    for (const beat of [1, 2, 3, 4]) frame = muted.step(beat, { kick: 1, snare: 1, energy: 1, dropConfidence: 0.95 }, { reactivity: 0 })
    expect(frame).toMatchObject({ kick: 0, snare: 0, beat: 0, drop: 0, energy: 0, sweepStrength: 0 })

    const { step } = reactiveHarness()
    step(1, { kick: 1 })
    const silent = step(2, {}, { transport: { sourcePresent: false } })
    expect(silent.audioActive).toBe(false)
    expect(silent.kick).toBeLessThan(0.3)
    expect(silent.arc).toBeGreaterThan(0.5)
  })
})

// ── Preset contract ──────────────────────────────────────────────────────────────────────────

describe('Threshold preset', () => {
  const manifest = CINEMA2_THRESHOLD_PRESET_MANIFEST

  it('registers as a visible first-party keeper that passes the authoring gate and the native compiler', () => {
    expect(cinema2NativePresetRegistry.get(CINEMA2_THRESHOLD_PRESET_ID)?.metadata.name).toBe('Threshold')
    expect(manifest.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest })).toMatchObject({ ok: true })
    expect(compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES }).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.get(CINEMA2_THRESHOLD_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
  })

  it('places every Design control under one of the four parent groups and meets the shared control requirements', () => {
    const designControls = (manifest.parameters ?? []).filter(parameter => parameter.section === 'Design')
    expect(designControls.length).toBeGreaterThan(10)
    for (const parameter of designControls) expect(CINEMA2_DESIGN_PARENT_GROUP_IDS).toContain(parameter.designParentGroup)
    const inGroup = (group: string) => designControls.filter(parameter => parameter.designParentGroup === group)
    expect(new Set(designControls.map(parameter => parameter.designParentGroup))).toEqual(new Set(CINEMA2_DESIGN_PARENT_GROUP_IDS))

    const master = inGroup('master-controls')
    expect(master.find(parameter => parameter.id === CINEMA2_THRESHOLD_INTENSITY_ID)).toMatchObject({ type: 'float', min: 0, max: 1 })
    expect(master.find(parameter => parameter.id === CINEMA2_THRESHOLD_BPM_SYNC_ID)).toMatchObject({ type: 'boolean' })
    const palette = inGroup('palette').filter(parameter => parameter.type === 'color')
    expect(palette.length).toBeGreaterThanOrEqual(4)
    expect(palette.map(parameter => parameter.label)).toEqual(expect.arrayContaining(['Primary', 'Accent', 'Atmosphere']))
  })

  it('gives BPM Sync and Master Intensity real consumers', () => {
    const module = manifest.modules!.find(entry => entry.typeId === CINEMA2_THRESHOLD_NATIVE_MODULE_TYPE_ID)!
    expect(module.parameterBindings?.bpmSync?.$ref).toBe(CINEMA2_THRESHOLD_BPM_SYNC_ID)
    expect(module.parameterBindings?.intensity?.$ref).toBe(CINEMA2_THRESHOLD_INTENSITY_ID)
    const boundEffects = (manifest.effects ?? []).filter(effect => Object.values(effect.parameterBindings ?? {}).some(ref => ref.$ref === CINEMA2_THRESHOLD_INTENSITY_ID))
    expect(boundEffects.length).toBeGreaterThanOrEqual(2)
  })

  it('flies dead centre down the corridor with a wide lens, with camera motion large enough to see and scaled by Camera Motion', () => {
    const camera = manifest.cameras!.find(entry => entry.id === CINEMA2_THRESHOLD_CAMERA_ID)!
    expect(camera.fovDegrees).toBeGreaterThanOrEqual(65)
    const points = (camera.rig as { points: readonly { position: readonly number[]; target?: readonly number[] }[] }).points
    const corridorPoints = points.filter(point => -point.position[2] <= 90)
    expect(corridorPoints.length).toBeGreaterThanOrEqual(3)
    for (const point of corridorPoints) {
      expect(point.position[0]).toBe(0)
      expect(point.target?.[0]).toBe(0)
    }
    // Sized for a 52-unit-wide aisle: the old 'steady' amplitudes (0.04 units) were invisible, which made the Camera Motion slider look dead.
    expect(camera.motion?.drift?.position).toBeGreaterThanOrEqual(0.5)
    expect(camera.motion?.bank?.maxDegrees).toBeGreaterThanOrEqual(3)
    expect(camera.motion?.tempo).toMatchObject({ flightSpeed: true })
    expect(camera.motion?.tempo?.weave).toBeGreaterThanOrEqual(1)
    expect(camera.motion?.tempo?.punch).toBeGreaterThan(0)
    // Both switches reach the runtime: the slider scales the motion, BPM Sync locks it to the track.
    expect(camera.controls).toMatchObject({ motionAmount: { $ref: CINEMA2_THRESHOLD_CAMERA_MOTION_ID }, tempoSync: { $ref: CINEMA2_THRESHOLD_BPM_SYNC_ID } })
  })

  it('grades neutrally: no filmic curve to grey the whites, low saturation, minimal fringing and grain', () => {
    const finish = manifest.effects!.find(entry => entry.typeId === 'cinematic-finish')!
    const parameters = finish.parameters as Record<string, number>
    expect(parameters.toneMap).toBe(0)
    expect(parameters.saturation).toBeLessThanOrEqual(0.6)
    expect(parameters.aberration).toBeLessThanOrEqual(0.05)
    expect(parameters.grain).toBeLessThanOrEqual(0.1)
  })

  it('flies an endless three-scene path and chains floor, atmosphere, bloom and finish', () => {
    const camera = manifest.cameras!.find(entry => entry.id === CINEMA2_THRESHOLD_CAMERA_ID)!
    expect(camera.rig).toMatchObject({ kind: 'fly', loop: true, repeatOffset: [0, 0, -THRESHOLD_PERIOD] })
    expect(camera.motion?.interpolation).toBe('spline')
    const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const order = compiled.plan.render.passOrder.map(id => compiled.plan.render.passes.find(pass => pass.id === id)?.effect?.id ?? 'scene')
    expect(order).toEqual(['scene', 'threshold-floor', 'threshold-atmosphere', 'threshold-bloom', 'threshold-finish'])
  })
})

// ── Detail, smoke, budgets and culling (roadmap #9, native half) ────────────────────────────────

describe('Threshold hanging field', () => {
  it('is dense enough to read as an environment and turned toward the aisle, so the flight never sees black planks', () => {
    const field = buildThresholdLayout(1337, { extras: false }).filter(entry => entry.zone === THRESHOLD_ZONE_FIELD)
    expect(field.length).toBeGreaterThanOrEqual(18)
    expect(field.filter(entry => entry.role >= 1).length).toBeGreaterThanOrEqual(15)
    for (const entry of field) expect(Math.abs(entry.rotation[0])).toBeLessThanOrEqual(0.52)
  })
})

describe('Threshold detail layout', () => {
  const base = buildThresholdLayout(1337, { extras: false })
  const full = buildThresholdLayout(1337)
  const detail = buildThresholdDetail(1337)

  it('appends detail after an untouched base layout, deterministically, from its own seeded stream', () => {
    expect(full.slice(0, base.length)).toEqual(base)
    expect(full.slice(base.length)).toEqual(detail)
    expect(buildThresholdDetail(1337)).toEqual(detail)
    expect(buildThresholdDetail(7)).not.toEqual(detail)
    expect(buildThresholdSmoke(1337)).toEqual(buildThresholdSmoke(1337))
    expect(buildThresholdSmoke(7)).not.toEqual(buildThresholdSmoke(1337))
  })

  it('is plain dark structure (outer towers and an overhead grid) that never enters the flight lane', () => {
    expect(detail.length).toBeGreaterThan(60)
    expect(detail.every(instance => instance.role === 0 && instance.zone === THRESHOLD_ZONE_CORRIDOR)).toBe(true)
    // Anything that crosses the flight lane (|x| < 8) hangs far above the camera; everything else on the floor is outside the housings.
    for (const instance of detail) {
      const crossesLane = Math.abs(instance.position[0]) - instance.size[0] / 2 < 8
      if (crossesLane) expect(instance.position[1] - instance.size[1] / 2).toBeGreaterThan(20)
    }
    expect(detail.filter(instance => instance.position[1] - instance.size[1] / 2 < 0.05 && instance.position[1] > 0).every(instance => Math.abs(instance.position[0]) > 37.8)).toBe(true)
  })

  it('gates detail by quality tier: medium adds the outer rank and the main beams, high adds chords, struts and cables', () => {
    const tierOf = (instance: (typeof detail)[number]) => instance.minTier ?? 0
    expect(detail.every(instance => tierOf(instance) >= 1)).toBe(true)
    const counts = ([0, 1, 2] as const).map(tier => countThresholdInstances(full, tier))
    expect(counts[0]).toBe(base.length)
    expect(counts[1]).toBeGreaterThan(counts[0]!)
    expect(counts[2]).toBeGreaterThan(counts[1]!)
    const puffs = buildThresholdSmoke(1337)
    const puffCounts = ([0, 1, 2] as const).map(tier => countThresholdInstances(puffs, tier))
    expect(puffCounts[0]).toBeGreaterThan(0)
    expect(puffCounts[1]).toBeGreaterThan(puffCounts[0]!)
    expect(puffCounts[2]).toBeGreaterThan(puffCounts[1]!)
  })

  it('stays within the declared instance budget of every quality tier', () => {
    const puffs = buildThresholdSmoke(1337)
    for (const quality of ['low', 'medium', 'high'] as const) {
      const tier = THRESHOLD_TIER_BY_QUALITY[quality]
      expect(countThresholdInstances(full, tier), `${quality} boxes`).toBeLessThanOrEqual(THRESHOLD_INSTANCE_BUDGETS[quality].boxes)
      expect(countThresholdInstances(puffs, tier), `${quality} puffs`).toBeLessThanOrEqual(THRESHOLD_INSTANCE_BUDGETS[quality].puffs)
    }
    expect(THRESHOLD_INSTANCE_BUDGETS.low.boxes).toBeLessThan(THRESHOLD_INSTANCE_BUDGETS.medium.boxes)
    expect(THRESHOLD_INSTANCE_BUDGETS.medium.boxes).toBeLessThan(THRESHOLD_INSTANCE_BUDGETS.high.boxes)
  })

  it('sorts smoke farthest first, keeps puffs at the tower bases, and packs three vec4s per puff', () => {
    const puffs = buildThresholdSmoke(1337)
    for (let index = 1; index < puffs.length; index += 1) expect(puffs[index]!.position[2]).toBeGreaterThanOrEqual(puffs[index - 1]!.position[2])
    expect(puffs.every(puff => puff.position[1] > 0.5 && puff.position[1] < 6)).toBe(true)
    expect(puffs.every(puff => Math.abs(puff.position[0]) < 26)).toBe(true)
    const packed = packThresholdPuffs(puffs)
    expect(packed.length).toBe(puffs.length * THRESHOLD_PUFF_FLOATS)
    expect(Array.from(packed.slice(0, 4))).toEqual([puffs[0]!.position[0], puffs[0]!.position[1], puffs[0]!.position[2], puffs[0]!.size].map(Math.fround))
    expect(packed[11]).toBe(puffs[0]!.minTier)
  })
})

describe('Threshold module detail switch', () => {
  it('validates the extras flag and the seed', () => {
    const module = (config: Record<string, unknown>) => ({ id: 'm', typeId: 'threshold-native-render', config }) as never
    const validate = cinema2ThresholdNativeModuleDefinition.validate!
    expect(validate(module({ seed: 1, extras: false }))).toEqual([])
    expect(validate(module({ extras: 'yes' })).map(item => item.code)).toEqual(['CINEMA2_THRESHOLD_EXTRAS_INVALID'])
    expect(validate(module({ seed: 'x' })).map(item => item.code)).toEqual(['CINEMA2_THRESHOLD_SEED_INVALID'])
  })
})

describe('Threshold lap chunk culling', () => {
  const layout = buildThresholdLayout(1337)
  const chunks = buildThresholdChunks(layout)

  it('covers every instance exactly once with a conservative z extent', () => {
    expect(chunks.reduce((sum, chunk) => sum + chunk.count, 0)).toBe(layout.length)
    chunks.forEach((chunk, index) => {
      expect(chunk.start).toBe(index === 0 ? 0 : chunks[index - 1]!.start + chunks[index - 1]!.count)
      for (const instance of layout.slice(chunk.start, chunk.start + chunk.count)) {
        expect(instance.position[2]).toBeGreaterThanOrEqual(chunk.zMin)
        expect(instance.position[2]).toBeLessThanOrEqual(chunk.zMax)
      }
    })
  })

  it('skips the lap behind the camera, keeps the current and next laps, and drops chunks beyond the view distance', () => {
    const period = THRESHOLD_PERIOD
    const cameraZ = -20
    const total = (lap: number, viewFar: number) => visibleThresholdRanges(chunks, lap, period, cameraZ, viewFar, 8).reduce((sum, range) => sum + range.count, 0)
    expect(total(-1, 380)).toBe(0)
    expect(total(0, 380)).toBeGreaterThan(layout.length / 2)
    expect(total(1, 380)).toBeGreaterThan(0)
    expect(total(1, 30)).toBeLessThan(total(1, 380))
    expect(total(2, 380)).toBe(0)
    // Every instance whose box overlaps the visible window is inside a returned range.
    const ranges = visibleThresholdRanges(chunks, 0, period, cameraZ, 100, 8)
    const drawn = new Set(ranges.flatMap(range => Array.from({ length: range.count }, (_, offset) => range.start + offset)))
    layout.forEach((instance, index) => {
      const reach = Math.hypot(...instance.size) / 2
      const near = instance.position[2] + reach >= cameraZ - 100 && instance.position[2] - reach <= cameraZ + 8
      if (near) expect(drawn.has(index)).toBe(true)
    })
    // Adjacent chunks are merged into one draw range.
    expect(ranges.every((range, index) => index === 0 || range.start > ranges[index - 1]!.start + ranges[index - 1]!.count)).toBe(true)
  })
})

// ── Production path ──────────────────────────────────────────────────────────────────────────

describe('Threshold through the real Runtime path', () => {
  it('renders every pass, draws the monoliths in instanced laps, and releases every GL resource', () => {
    const gl = createCinemaMockWebGL()
    class FakeCanvas extends EventTarget {
      width = 640
      height = 360
      getContext = vi.fn(() => gl)
    }
    const frameCallback: { current: FrameRequestCallback | null } = { current: null }
    const created = Cinema2Runtime.create(new FakeCanvas() as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_THRESHOLD_PRESET_ID,
      requestAnimationFrame: (callback: FrameRequestCallback) => { frameCallback.current = callback; return 1 },
      cancelAnimationFrame: () => { frameCallback.current = null },
      renderQuality: 'high',
    })
    expect(created.error).toBeNull()
    if (!created.runtime) return
    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    frameCallback.current?.(1000)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0, executedPassCount: 5 })
    expect(created.runtime.getModuleRuntimeSnapshot().modules.map(module => module.status)).toEqual(['active'])
    // Lap copies that cannot be seen (here the one behind the camera) are culled, so a frame at the start of the flight submits two.
    expect(vi.mocked(gl.drawElementsInstanced).mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(created.runtime.getCameraRuntimeSnapshot().camera.rig).toBe('fly')
    created.runtime.dispose()
    expect(gl.__calls.createdBuffers).toBe(gl.__calls.deletedBuffers)
    expect(gl.__calls.createdVertexArrays).toBe(gl.__calls.deletedVertexArrays)
    expect(gl.__calls.createdPrograms).toBe(gl.__calls.deletedPrograms)
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
    expect(gl.__calls.createdFramebuffers).toBe(gl.__calls.deletedFramebuffers)
  })

  it('renders its towers into the engine shadow map on high and medium, and draws no shadows on low', () => {
    for (const [quality, resolution, instancedDraws] of [['high', 2048, 4], ['medium', 1024, 4], ['low', 0, 2]] as const) {
      const gl = createCinemaMockWebGL()
      // The shared GL mock predates depth-comparison textures; give it the few calls the shadow map needs.
      Object.assign(gl as unknown as Record<string, unknown>, {
        texStorage2D: vi.fn(), polygonOffset: vi.fn(), depthFunc: vi.fn(), isEnabled: vi.fn(() => false),
        FRAMEBUFFER: 0x8d40, TEXTURE_COMPARE_MODE: 0x884c, COMPARE_REF_TO_TEXTURE: 0x884e, TEXTURE_COMPARE_FUNC: 0x884d,
        POLYGON_OFFSET_FILL: 0x8037, VIEWPORT: 0x0ba2, DEPTH_WRITEMASK: 0x0b72, COLOR_WRITEMASK: 0x0c23, DEPTH_FUNC: 0x0b74,
        TEXTURE_BINDING_2D: 0x8069, TEXTURE_2D: 0x0de1, LINEAR: 0x2601, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
        TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
      })
      class FakeCanvas extends EventTarget {
        width = 640
        height = 360
        getContext = vi.fn(() => gl)
      }
      const frameCallback: { current: FrameRequestCallback | null } = { current: null }
      const created = Cinema2Runtime.create(new FakeCanvas() as unknown as HTMLCanvasElement, {
        presetId: CINEMA2_THRESHOLD_PRESET_ID,
        requestAnimationFrame: (callback: FrameRequestCallback) => { frameCallback.current = callback; return 1 },
        cancelAnimationFrame: () => { frameCallback.current = null },
        renderQuality: quality,
      })
      expect(created.error).toBeNull()
      if (!created.runtime) return
      created.runtime.resize({ width: 640, height: 360, dpr: 1 })
      created.runtime.start()
      frameCallback.current?.(1000)
      expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ failedPassCount: 0 })
      expect(created.runtime.getRenderGraphExecutorSnapshot().diagnostics).toEqual([])
      // One depth-only draw per visible lap for the shadow map plus one colour draw per visible lap (the lap behind the camera is culled).
      expect(vi.mocked(gl.drawElementsInstanced).mock.calls.length).toBe(instancedDraws)
      expect(created.runtime.getShadowServiceSnapshot()).toMatchObject({ active: resolution > 0, resolution, estimatedGpuBytes: resolution * resolution * 4 })
      created.runtime.dispose()
      expect(created.runtime.getShadowServiceSnapshot()).toMatchObject({ disposed: true, estimatedGpuBytes: 0 })
      expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
      expect(gl.__calls.createdFramebuffers).toBe(gl.__calls.deletedFramebuffers)
    }
  })
})
