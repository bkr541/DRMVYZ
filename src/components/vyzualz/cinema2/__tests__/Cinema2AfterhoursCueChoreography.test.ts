import { describe, expect, it } from 'vitest'
import {
  CINEMA2_AFTERHOURS_CUE_MAX_PERIOD_BEATS,
  evaluateCinema2AfterhoursCueGate,
  evaluateCinema2AfterhoursCues,
  planCinema2AfterhoursCueScene,
  type Cinema2AfterhoursCueBeam,
  type Cinema2AfterhoursCueSceneId,
} from '../modules/afterhours/Cinema2AfterhoursCueChoreography'
import { resolveCinema2AfterhoursCueBeat } from '../modules/Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

/** `pairs` mirrored pairs, each pair one unit; slots run left, right per pair. */
function rig(pairs: number, topologyId = 'wideFan'): Cinema2AfterhoursCueBeam[] {
  return Array.from({ length: pairs * 2 }, (_, slot) => ({
    fixtureId: `f${slot}`,
    slot,
    unitKey: `pair-${Math.floor(slot / 2)}`,
    side: (slot % 2 === 0 ? -1 : 1) as -1 | 1,
    yawAuthorityDeg: 34,
    pitchAuthorityDeg: 18,
    topologyId,
  }))
}

const input = (overrides: Partial<Parameters<typeof evaluateCinema2AfterhoursCues>[0]> = {}) => ({
  beams: rig(4), beat: 0, sceneKey: 'track:wideFan:0', seed: 'seed', intensity: 0.5, peak: 0, motion: 0.8, ...overrides,
})

const ALL_SCENES: Cinema2AfterhoursCueSceneId[] = ['chase', 'alternate', 'stab', 'roll', 'barHits', 'wash', 'strobe']

describe('Afterhours laser cue scenes', () => {
  it('never lets a laser stay lit or dark for longer than a bar: every period is 1..4 beats and every burst is shorter than its period', () => {
    const seen = new Set<Cinema2AfterhoursCueSceneId>()
    for (let key = 0; key < 400; key += 1) {
      const scene = planCinema2AfterhoursCueScene(1 + (key % 8), `scene-${key}`, 'seed', (key % 10) / 10, 0)
      seen.add(scene.id)
      expect(scene.groupCount).toBeGreaterThanOrEqual(1)
      expect(scene.groupCount).toBeLessThanOrEqual(4)
      for (const program of scene.programs) {
        expect(program.period).toBeGreaterThanOrEqual(1)
        expect(program.period).toBeLessThanOrEqual(CINEMA2_AFTERHOURS_CUE_MAX_PERIOD_BEATS)
        expect(program.on).toBeGreaterThan(0)
        expect(program.on).toBeLessThan(program.period)
        // Dark for the rest of the period, which is therefore also at most a bar.
        expect(program.period - program.on).toBeLessThanOrEqual(CINEMA2_AFTERHOURS_CUE_MAX_PERIOD_BEATS)
        expect(program.offset).toBeLessThan(program.period)
      }
    }
    // Every scene except the peak strobe is reachable on ordinary music.
    for (const id of ALL_SCENES.filter(candidate => candidate !== 'strobe')) expect(seen.has(id), id).toBe(true)
    expect(seen.has('strobe')).toBe(false)
  })

  it('switches to the unison strobe on a structural peak, and lower energy prefers the calmer scenes', () => {
    expect(planCinema2AfterhoursCueScene(4, 'a', 'seed', 0.5, 0.9).id).toBe('strobe')
    const share = (intensity: number, ids: Cinema2AfterhoursCueSceneId[]) => {
      let hits = 0
      for (let key = 0; key < 600; key += 1) if (ids.includes(planCinema2AfterhoursCueScene(4, `k${key}`, 'seed', intensity, 0).id)) hits += 1
      return hits / 600
    }
    expect(share(0, ['wash', 'alternate'])).toBeGreaterThan(share(1, ['wash', 'alternate']))
    expect(share(1, ['roll'])).toBeGreaterThan(share(0, ['roll']))
  })

  it('is deterministic for a given seed and scene key', () => {
    expect(planCinema2AfterhoursCueScene(4, 'k', 'seed', 0.4, 0)).toEqual(planCinema2AfterhoursCueScene(4, 'k', 'seed', 0.4, 0))
    const keys = Array.from({ length: 40 }, (_, index) => planCinema2AfterhoursCueScene(4, `k${index}`, 'seed', 0.4, 0).id)
    expect(new Set(keys).size).toBeGreaterThan(2)
  })
})

describe('Afterhours laser cue gate', () => {
  const program = { group: 0, period: 4, on: 1.5, offset: 1, sweep: false }

  it('is dark outside the burst, snaps on at the beat and closes at the end of the burst', () => {
    expect(evaluateCinema2AfterhoursCueGate(program, 0).gate).toBe(0)
    expect(evaluateCinema2AfterhoursCueGate(program, 0.99).gate).toBe(0)
    expect(evaluateCinema2AfterhoursCueGate(program, 1).gate).toBeGreaterThanOrEqual(0.5)
    expect(evaluateCinema2AfterhoursCueGate(program, 1.2).gate).toBe(1)
    expect(evaluateCinema2AfterhoursCueGate(program, 2.4).gate).toBeGreaterThan(0)
    expect(evaluateCinema2AfterhoursCueGate(program, 2.4).gate).toBeLessThan(1)
    expect(evaluateCinema2AfterhoursCueGate(program, 2.5).gate).toBe(0)
    expect(evaluateCinema2AfterhoursCueGate(program, 4.99).gate).toBe(0)
    // And repeats every period.
    expect(evaluateCinema2AfterhoursCueGate(program, 5.2).gate).toBe(1)
  })

  it('reports the burst number so a burst can pick its own position', () => {
    expect(evaluateCinema2AfterhoursCueGate(program, 1.2).cycle).toBe(0)
    expect(evaluateCinema2AfterhoursCueGate(program, 5.2).cycle).toBe(1)
    expect(evaluateCinema2AfterhoursCueGate(program, 0.5).cycle).toBe(-1)
  })
})

describe('Afterhours laser cue evaluation', () => {
  it('fires mirrored pairs together and keeps every unit in one group', () => {
    for (let beat = 0; beat < 32; beat += 0.25) {
      const result = evaluateCinema2AfterhoursCues(input({ beat }))
      for (let pair = 0; pair < 4; pair += 1) {
        expect(result.get(`f${pair * 2}`)!.gate, `${beat}`).toBe(result.get(`f${pair * 2 + 1}`)!.gate)
        expect(result.get(`f${pair * 2}`)!.group).toBe(result.get(`f${pair * 2 + 1}`)!.group)
      }
    }
  })

  it('goes dark between bursts (not every beam on at every moment) but each beam does fire within a scene', () => {
    const lit = new Map<string, number>()
    let darkMoments = 0
    for (let beat = 0; beat < 16; beat += 0.125) {
      const result = evaluateCinema2AfterhoursCues(input({ beat }))
      let all = true
      for (const [id, cue] of result) {
        if (cue.gate > 0) lit.set(id, (lit.get(id) ?? 0) + 1); else all = false
      }
      if (!all) darkMoments += 1
    }
    expect(lit.size).toBe(8)
    expect(darkMoments).toBeGreaterThan(0)
  })

  it('moves a burst to a new aim while it is dark, and mirrors the sideways move for the other side of a pair', () => {
    const aims = new Set<string>()
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const result = evaluateCinema2AfterhoursCues(input({ beat: 0.3 + cycle * 4, motion: 1 }))
      const left = result.get('f0')!
      const right = result.get('f1')!
      aims.add(`${left.offsetX.toFixed(2)},${left.offsetY.toFixed(2)}`)
      expect(right.offsetX).toBeCloseTo(-left.offsetX, 9)
      expect(right.offsetY).toBeCloseTo(left.offsetY, 9)
    }
    expect(aims.size).toBeGreaterThan(2)
  })

  it('crossCanopy crosses the two sides over, and motion 0 puts every burst on the home aim', () => {
    const plain = evaluateCinema2AfterhoursCues(input({ beat: 0.3, motion: 1 })).get('f0')!
    const crossed = evaluateCinema2AfterhoursCues(input({ beat: 0.3, motion: 1, beams: rig(4, 'crossCanopy') })).get('f0')!
    expect(crossed.offsetX).toBeCloseTo(-plain.offsetX, 9)
    for (let beat = 0; beat < 8; beat += 0.5) {
      for (const cue of evaluateCinema2AfterhoursCues(input({ beat, motion: 0 })).values()) {
        expect(cue.offsetX).toBe(0)
        expect(cue.offsetY).toBe(0)
      }
    }
  })

  it('handles an empty rig, non-finite beats and a single unit without throwing', () => {
    expect(evaluateCinema2AfterhoursCues(input({ beams: [] })).size).toBe(0)
    expect(evaluateCinema2AfterhoursCues(input({ beat: Number.NaN })).size).toBe(8)
    expect(evaluateCinema2AfterhoursCues(input({ beams: rig(1) })).size).toBe(2)
  })
})

describe('Afterhours cue clock', () => {
  const signal = (value: number | null) => ({ available: value != null, value })
  const frame = (rhythm: Record<string, unknown> | null) => ({ audio: rhythm ? { rhythm } : null }) as unknown as Readonly<Cinema2ModuleFrameReadContext>

  it('counts bars and beats-in-bar from the track grid when it provides them', () => {
    const beat = resolveCinema2AfterhoursCueBeat(frame({ barIndex: signal(3), beatInBar: signal(2), beatIndex: signal(14), beatPhase: signal(0.5) }), 99, true)
    expect(beat).toBeCloseTo(3 * 4 + 2 + 0.5, 9)
  })

  it('falls back to the beat index plus its phase, then to a steady 120 BPM from the clock', () => {
    expect(resolveCinema2AfterhoursCueBeat(frame({ beatIndex: signal(14), beatPhase: signal(0.25) }), 99, true)).toBeCloseTo(14.25, 9)
    expect(resolveCinema2AfterhoursCueBeat(frame({ beatIndex: signal(null), beatPhase: signal(null) }), 5, true)).toBeCloseTo(10, 9)
    expect(resolveCinema2AfterhoursCueBeat(frame(null), 5, true)).toBeCloseTo(10, 9)
  })

  it('ignores the track grid entirely when BPM Sync is off, and gives nothing for a bad clock', () => {
    expect(resolveCinema2AfterhoursCueBeat(frame({ barIndex: signal(3), beatInBar: signal(2), beatIndex: signal(14), beatPhase: signal(0.5) }), 5, false)).toBeCloseTo(10, 9)
    expect(resolveCinema2AfterhoursCueBeat(frame(null), Number.NaN, false)).toBeNull()
  })
})
