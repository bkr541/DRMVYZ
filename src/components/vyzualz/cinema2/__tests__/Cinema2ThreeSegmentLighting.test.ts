import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  CINEMA2_THREE_SEGMENT_GLSL,
  CINEMA2_THREE_SEGMENT_PATTERNS,
  Cinema2ThreeSegmentLighting,
  evaluateCinema2SegmentBrightness,
  readCinema2ThreeSegmentPattern,
  type Cinema2ThreeSegmentFrame,
  type Cinema2ThreeSegmentInputs,
  type Cinema2ThreeSegmentPattern,
  type Cinema2ThreeSegmentVertex,
} from '../modules/three/Cinema2ThreeSegmentLighting'

const DT = 1 / 60
const signal = (value: number) => ({ available: true, value })

interface Music { bass: number; energy: number; vocal?: number; build?: number; section?: string; sectionType?: string }

/** A 120 BPM track: two beats a second, bass hitting on each beat. */
function musicFrame(index: number, music: Music | null): Cinema2ModuleFrameReadContext {
  const t = index * DT
  const beatIndex = Math.floor(t * 2), phase = t * 2 - beatIndex
  return {
    frameId: index, timestampMs: t * 1000, deltaTimeSec: DT, elapsedTimeSec: t,
    viewport: { width: 1, height: 1, dpr: 1 } as never, contextGeneration: 0, director: null,
    transport: { sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 't', timeSec: t } as never,
    audio: music ? {
      upstream: { timeSec: t },
      bands: { bass: signal(music.bass * Math.exp(-phase * 5)), sub: signal(0) },
      features: { overallEnergy: signal(music.energy), buildProgress: signal(music.build ?? 0), vocalPresence: signal(music.vocal ?? 0) },
      rhythm: { bpm: signal(120), beatIndex: signal(beatIndex), beatPhase: signal(phase) },
      structure: {
        section: { available: true, value: { id: music.section ?? 'a', type: music.sectionType ?? 'verse' } },
        semanticMoments: { available: false, value: null },
      },
    } as never : null,
  }
}

function run(seconds: number, music: Music | null | ((t: number) => Music), inputs: Partial<Cinema2ThreeSegmentInputs> = {}) {
  const lighting = new Cinema2ThreeSegmentLighting()
  const frames: Readonly<Cinema2ThreeSegmentFrame>[] = []
  for (let index = 0; index <= Math.round(seconds / DT); index += 1) {
    const current = typeof music === 'function' ? music(index * DT) : music
    frames.push(lighting.update(musicFrame(index, current), { pattern: 'energyFlow', sync: true, flicker: 0, reactivity: 1, ...inputs }))
  }
  return frames
}

const LOUD: Music = { bass: 0.9, energy: 0.8 }
const last = <T>(list: readonly T[]): T => list[list.length - 1]!
const vertex = (partial: Partial<Cinema2ThreeSegmentVertex> = {}): Cinema2ThreeSegmentVertex => ({ group: 0, along: 0.5, side: -1, random: 0.37, phase: 0.5, ...partial })
/** A frame fully on one pattern, with no flicker. */
const frameOf = (base: Readonly<Cinema2ThreeSegmentFrame>, pattern: Cinema2ThreeSegmentPattern, extra: Partial<Cinema2ThreeSegmentFrame> = {}): Cinema2ThreeSegmentFrame => ({
  ...base,
  weights: CINEMA2_THREE_SEGMENT_PATTERNS.map(id => (id === pattern ? 1 : 0)) as unknown as Cinema2ThreeSegmentFrame['weights'],
  ...extra,
})

describe('three-scene segment lighting', () => {
  it('reads the pattern dropdown, defaulting to Energy Flow', () => {
    for (const pattern of CINEMA2_THREE_SEGMENT_PATTERNS) expect(readCinema2ThreeSegmentPattern(pattern)).toBe(pattern)
    expect(readCinema2ThreeSegmentPattern('nope')).toBe('energyFlow')
  })

  it('Energy Flow: a pulse leaves the wall end of each tube on the beat, reaches the logo, then ripples out across the wall', () => {
    const frames = run(3, LOUD)
    const last = frames[frames.length - 1]!
    // At several moments within one beat the brightest tube point moves toward the logo, then the wall's brightest ring moves outward.
    const peakAlong = (role: 'feed' | 'field', frame: Readonly<Cinema2ThreeSegmentFrame>) => {
      let best = 0, bestPhase = 0
      for (let phase = 0; phase <= 1; phase += 0.02) {
        const value = evaluateCinema2SegmentBrightness(role, vertex({ phase }), frameOf(frame, 'energyFlow'))
        if (value > best) { best = value; bestPhase = phase }
      }
      return bestPhase
    }
    const withFront = (front: number) => ({ ...last, fronts: [front, -10, -10, -10], gains: [1, 0, 0, 0] })
    expect(peakAlong('feed', withFront(0.2))).toBeLessThan(peakAlong('feed', withFront(0.7)))
    expect(peakAlong('field', withFront(1.2))).toBeLessThan(peakAlong('field', withFront(1.8)))
    // The rim flares as the pulse arrives at the logo.
    const core = (front: number) => evaluateCinema2SegmentBrightness('core', vertex(), frameOf(withFront(front), 'energyFlow'))
    expect(core(1)).toBeGreaterThan(core(0.2) + 0.3)
    // One pulse a beat.
    expect(frames.some(frame => frame.fronts.some(front => front >= 0))).toBe(true)
  })

  it('Ring Chase: comets travel round the rings, neighbouring rings in opposite directions, faster when the music is loud', () => {
    const base = last(run(1, LOUD))
    // Each comet ends in a sharp head (bright to dark in one step); follow the first head round the ring as the chase advances.
    const headAt = (group: number, chase: number) => {
      const samples = 600
      const values = Array.from({ length: samples }, (_, k) => evaluateCinema2SegmentBrightness('field', vertex({ group, along: k / samples }), frameOf(base, 'ringChase', { chase })))
      let head = 0, drop = 0
      for (let k = samples * 0.1; k < samples * 0.43; k += 1) { // one head (at 1/3 of the ring) sits in this window
        const d = values[k]! - values[k + 1]!
        if (d > drop) { drop = d; head = k }
      }
      return head / samples
    }
    const moved = (group: number) => headAt(group, 0.03) - headAt(group, 0)
    expect(Math.abs(moved(0))).toBeGreaterThan(0.01)
    expect(Math.sign(moved(0))).toBe(-Math.sign(moved(1 / 7)))
    const chaseDistance = (music: Music) => {
      const frames = run(4, music, { pattern: 'ringChase' })
      let total = 0
      for (let i = 1; i < frames.length; i += 1) total += ((frames[i]!.chase - frames[i - 1]!.chase) % 1 + 1) % 1
      return total
    }
    expect(chaseDistance(LOUD)).toBeGreaterThan(chaseDistance({ bass: 0.1, energy: 0.1 }) * 1.4)
  })

  it('Split: the lit half trades sides, every beat when the music moves and every bar when it is calm; a drop lights both', () => {
    const loud = run(4, LOUD, { pattern: 'split' })
    const sideAt = (frames: readonly Readonly<Cinema2ThreeSegmentFrame>[], beat: number) => frames.find(frame => frame.beats >= beat)!.splitSide
    expect(sideAt(loud, 6.1)).not.toBe(sideAt(loud, 7.1))
    const calm = run(4, { bass: 0.1, energy: 0.2 }, { pattern: 'split' })
    expect(sideAt(calm, 4.1)).toBe(sideAt(calm, 5.1))
    expect(sideAt(calm, 4.1)).not.toBe(sideAt(calm, 0.1))
    const final = last(loud)
    const left = (drop: number) => evaluateCinema2SegmentBrightness('field', vertex({ side: -1 }), frameOf(final, 'split', { splitSide: 1, drop }))
    const right = evaluateCinema2SegmentBrightness('field', vertex({ side: 1 }), frameOf(final, 'split', { splitSide: 1, drop: 0 }))
    expect(right).toBeGreaterThan(left(0) + 0.2)
    expect(left(1)).toBeGreaterThan(0.95)
  })

  it('Pulse: the wall breathes with the beat, goes dark in a quiet or vocal passage while the tubes and logo stay lit, and a drop lights everything', () => {
    const quietFrames = run(4, { bass: 0.15, energy: 0.1 }, { pattern: 'pulse' })
    const quiet = last(quietFrames)
    expect(quiet.quiet).toBeGreaterThan(0.9)
    expect(evaluateCinema2SegmentBrightness('field', vertex(), frameOf(quiet, 'pulse'))).toBeLessThan(0.05)
    expect(evaluateCinema2SegmentBrightness('feed', vertex(), frameOf(quiet, 'pulse'))).toBeGreaterThan(0.1)
    expect(evaluateCinema2SegmentBrightness('core', vertex(), frameOf(quiet, 'pulse'))).toBeGreaterThan(0.1)
    const vocal = last(run(4, { bass: 0.5, energy: 0.4, vocal: 0.9 }, { pattern: 'pulse' }))
    expect(vocal.quiet).toBeGreaterThan(0.9)
    const dropped = last(run(4, t => (t < 3.5 ? LOUD : { ...LOUD, section: 'b', sectionType: 'drop' }), { pattern: 'pulse' }))
    expect(dropped.drop).toBeGreaterThan(0.5)
    expect(evaluateCinema2SegmentBrightness('field', vertex(), frameOf(dropped, 'pulse'))).toBeGreaterThan(0.85)
    const loud = run(4, LOUD, { pattern: 'pulse' })
    const values = loud.slice(-60).map(frame => evaluateCinema2SegmentBrightness('field', vertex(), frameOf(frame, 'pulse')))
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.2)
  })

  it('Auto Performance: the music picks the pattern, changing only on bar lines (at once on a drop)', () => {
    const auto = { auto: true, pattern: 'split' as const }
    const quiet = run(4, { bass: 0.1, energy: 0.1 }, auto)
    expect(last(quiet).pattern).toBe('pulse')
    const building = run(4, { bass: 0.6, energy: 0.6, build: 0.8 }, auto)
    expect(last(building).pattern).toBe('energyFlow')
    const groove = run(40, { bass: 0.7, energy: 0.7 }, auto)
    const picks = new Set(groove.map(frame => frame.pattern))
    expect(picks).toEqual(new Set(['ringChase', 'split', 'routeRelay', 'energyFlow']))
    // Changes land on bar lines (a multiple of 4 beats).
    for (let i = 1; i < groove.length; i += 1) {
      if (groove[i]!.pattern !== groove[i - 1]!.pattern) expect(groove[i]!.beats % 4).toBeLessThan(0.1)
    }
    const dropped = run(4, t => (t < 3.3 ? { bass: 0.7, energy: 0.7 } : { bass: 0.9, energy: 0.8, section: 'b', sectionType: 'drop' }), auto)
    const dropFrame = dropped.find(frame => frame.drop === 1)!
    expect(dropFrame.pattern).toBe('coreDischarge')
    // Off, the chosen pattern plays.
    expect(last(run(4, { bass: 0.1, energy: 0.1 }, { pattern: 'split' })).pattern).toBe('split')
  })

  it('crossfades to a new pattern instead of snapping', () => {
    const lighting = new Cinema2ThreeSegmentLighting()
    for (let index = 0; index < 60; index += 1) lighting.update(musicFrame(index, LOUD), { pattern: 'energyFlow', sync: true, flicker: 0, reactivity: 1 })
    const after = lighting.update(musicFrame(60, LOUD), { pattern: 'split', sync: true, flicker: 0, reactivity: 1 })
    expect(after.weights[0]).toBeGreaterThan(0.8)
    expect(after.weights[2]).toBeGreaterThan(0)
    let settled = after
    for (let index = 61; index < 180; index += 1) settled = lighting.update(musicFrame(index, LOUD), { pattern: 'split', sync: true, flicker: 0, reactivity: 1 })
    expect(settled.weights[2]).toBeGreaterThan(0.99)
  })

  it('Core Discharge stages an inward feed, white-hot core, outward chamber front, then afterglow', () => {
    const lighting = new Cinema2ThreeSegmentLighting()
    const inputs = { pattern: 'coreDischarge' as const, sync: true, flicker: 0, reactivity: 1, dropIntensity: 1 }
    for (let index = 0; index < 30; index += 1) lighting.update(musicFrame(index, LOUD), inputs)
    lighting.enqueueCue('drop', 'drop:1')
    const frames = Array.from({ length: 210 }, (_, offset) => lighting.update(musicFrame(30 + offset, LOUD), inputs))
    const charge = frames.find(frame => frame.dropCharge > 0.35 && frame.dropCharge < 0.65)!
    const core = frames.reduce((best, frame) => frame.dropCore > best.dropCore ? frame : best)
    const discharge = frames.find(frame => frame.dropDischarge > 0.45 && frame.dropDischarge < 0.65)!
    const afterglow = frames.find(frame => frame.dropAfterglow > 0.25 && frame.dropDischarge === 0)!
    const feedNearFront = evaluateCinema2SegmentBrightness('feed', vertex({ phase: charge.dropCharge }), frameOf(charge, 'coreDischarge'))
    const feedFar = evaluateCinema2SegmentBrightness('feed', vertex({ phase: 1 }), frameOf(charge, 'coreDischarge'))
    expect(feedNearFront).toBeGreaterThan(feedFar)
    expect(evaluateCinema2SegmentBrightness('core', vertex(), frameOf(core, 'coreDischarge'))).toBeGreaterThan(1.5)
    const fieldNearFront = evaluateCinema2SegmentBrightness('field', vertex({ phase: discharge.dropDischarge }), frameOf(discharge, 'coreDischarge'))
    const fieldFar = evaluateCinema2SegmentBrightness('field', vertex({ phase: 0 }), frameOf(discharge, 'coreDischarge'))
    expect(fieldNearFront).toBeGreaterThan(fieldFar)
    expect(evaluateCinema2SegmentBrightness('field', vertex(), frameOf(afterglow, 'coreDischarge'))).toBeGreaterThan(0.1)
  })

  it('Route Relay groups like routes and Route Density recruits neighboring groups', () => {
    const base = last(run(1, LOUD, { pattern: 'routeRelay' }))
    const relayed = frameOf(base, 'routeRelay', { relayGroup: 3, accents: [1, 0, 0, 0] })
    const exact = evaluateCinema2SegmentBrightness('field', vertex({ group: 3 / 7 }), { ...relayed, routeDensity: 0 })
    const neighborSparse = evaluateCinema2SegmentBrightness('field', vertex({ group: 4 / 7 }), { ...relayed, routeDensity: 0 })
    const neighborDense = evaluateCinema2SegmentBrightness('field', vertex({ group: 4 / 7 }), { ...relayed, routeDensity: 1 })
    expect(exact).toBeGreaterThan(neighborSparse)
    expect(neighborDense).toBeGreaterThan(neighborSparse)
  })

  it('Pattern Change advances once for each selected canonical trigger', () => {
    const lighting = new Cinema2ThreeSegmentLighting()
    const inputs = { pattern: 'energyFlow' as const, sync: true, flicker: 0, reactivity: 1, patternChange: true, trigger: 'kick' as const }
    expect(lighting.update(musicFrame(0, LOUD), inputs).pattern).toBe('energyFlow')
    lighting.enqueueCue('snare', 'snare:1')
    expect(lighting.update(musicFrame(1, LOUD), inputs).pattern).toBe('energyFlow')
    lighting.enqueueCue('kick', 'kick:1')
    expect(lighting.update(musicFrame(2, LOUD), inputs).pattern).toBe('ringChase')
    lighting.enqueueCue('kick', 'kick:1')
    expect(lighting.update(musicFrame(3, LOUD), inputs).pattern).toBe('ringChase')
    lighting.enqueueCue('kick', 'kick:2')
    expect(lighting.update(musicFrame(4, LOUD), inputs).pattern).toBe('split')
  })

  it('Flicker drops segments out on their own random beats; at zero nothing drops out', () => {
    const base = last(run(2, LOUD))
    const lit = (flicker: number, random: number, beats: number) => evaluateCinema2SegmentBrightness('field', vertex({ random }), frameOf(base, 'pulse', { flicker, beats, drop: 1 }))
    const samples = (flicker: number) => Array.from({ length: 200 }, (_, k) => lit(flicker, (k * 0.618) % 1, 10 + (k % 16) / 4))
    expect(samples(0).every(value => value > 0.9)).toBe(true)
    const dark = samples(0.8).filter(value => value < 0.1).length
    expect(dark).toBeGreaterThan(40)
    expect(dark).toBeLessThan(160)
  })

  it('holds a steady glow at zero reactivity, and stands still while paused', () => {
    const base = last(run(2, LOUD))
    for (const pattern of CINEMA2_THREE_SEGMENT_PATTERNS) {
      expect(evaluateCinema2SegmentBrightness('field', vertex(), frameOf(base, pattern, { reactivity: 0 }))).toBeCloseTo(0.35, 5)
    }
    const lighting = new Cinema2ThreeSegmentLighting()
    for (let index = 0; index < 60; index += 1) lighting.update(musicFrame(index, LOUD), { pattern: 'ringChase', sync: true, flicker: 0, reactivity: 1 })
    const paused = (index: number) => lighting.update({ ...musicFrame(index, LOUD), transport: { sourcePresent: true, playing: false, analysisActive: true, paused: true, animationActive: false, trackId: 't', timeSec: 1 } as never }, { pattern: 'ringChase', sync: true, flicker: 0, reactivity: 1 })
    const first = paused(60)
    const later = paused(200)
    expect(later.beats).toBe(first.beats)
    expect(later.chase).toBe(first.chase)
  })

  it('keeps the GLSL twin in step with the TypeScript function (same terms and constants)', () => {
    for (const term of ['0.12 : ( role < 1.5 ? 0.3 + 0.3 * level : 0.06 )', '/ routeWidth', '/ 0.3', '* 43758.5453', '113.1', '7.3', '0.35 + ( brightness - 0.35 )', 'exp( - fract( beats ) * 4.0 )', 'programDischarge', 'relayGate']) {
      expect(CINEMA2_THREE_SEGMENT_GLSL).toContain(term)
    }
  })
})
