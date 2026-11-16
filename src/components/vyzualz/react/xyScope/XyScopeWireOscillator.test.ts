import { describe, expect, it } from 'vitest'
import { emptyWireCue } from './XyScopeWireCues'
import { WireEngine, type WireTick } from './XyScopeWireEngine'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { WIRE_DEFAULTS, type WireValues } from './XyScopeWireSettings'

type Internals = {
  clock: Float32Array; rest: Float32Array; kinds: number[]; ripple: Float32Array; edgeOf: Int16Array; reversed: Uint8Array; px: Float32Array; py: Float32Array
  edgeCycles: Float32Array; edgePhase: Float32Array; edgeChaos: Float32Array
}
const internals = (e: WireEngine) => e as unknown as Internals

function loud(frame: number): WireReading {
  const swing = .5 + .5 * Math.sin(frame / 60 * 7)
  return {
    ...silentReading(), playing: true, confidence: .9,
    features: { sub: swing, bass: swing, lowMid: swing, mid: swing * .8, air: swing * .6, flux: swing, level: .4 + swing * .5 },
    available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
    hits: { kick: frame % 30 === 0 ? 1 : 0, snare: frame % 60 === 30 ? .9 : 0, hat: 0 },
  }
}
const tick = (over: Partial<WireTick> = {}): WireTick => ({ dt: 1 / 60, reading: loud(0), cue: emptyWireCue(), values: WIRE_DEFAULTS, auto: false, discontinuity: false, ...over })

/** An engine without a real capture (so the lines are the oscillators), run for a while on a loud, pulsing track. */
function driven(over: Partial<WireValues> = {}, frames = 120, reading: (f: number) => WireReading = loud): WireEngine {
  const e = new WireEngine()
  for (let f = 0; f < frames; f++) e.tick(tick({ reading: reading(f), values: { ...WIRE_DEFAULTS, satellites: 0, outline: false, ...over } }))
  return e
}
function at(e: WireEngine, s: number, p: number) {
  const i = internals(e), out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
  const u = i.clock[s] + (i.clock[s + 1] - i.clock[s]) * (i.rest[s] + p * (1 - 2 * i.rest[s]))
  e.signal(e.letters[0], 0, u, 0, 0, out)
  return { x: out.x, y: out.y }
}
const rippled = (e: WireEngine) => [...internals(e).ripple.keys()].filter(s => internals(e).kinds[s] === 0 && internals(e).ripple[s] > 0)
/** The signed sideways offset of the line from the straight edge, sampled along segment `s`. */
function profile(e: WireEngine, straight: WireEngine, s: number, samples = 64): number[] {
  const i = internals(e), n = (s + 1) % e.pointCount
  const dx = i.px[n] - i.px[s], dy = i.py[n] - i.py[s], length = Math.hypot(dx, dy)
  const out: number[] = []
  for (let k = 1; k < samples; k++) {
    const a = at(e, s, k / samples), b = at(straight, s, k / samples)
    out.push(((a.x - b.x) * -dy + (a.y - b.y) * dx) / length)
  }
  return out
}
const roughness = (xs: number[]) => xs.slice(2).reduce((sum, x, k) => sum + Math.abs(x - 2 * xs[k + 1] + xs[k]), 0)

describe('every edge is a sine oscillator', () => {
  it('draws each line as its own sine wave, sideways to the edge, at the pitch and phase its oscillator has', () => {
    const e = driven({ waveOscillator: 1, chaos: 0 }), straight = driven({ waveOscillator: 1, chaos: 0, waveAmount: 0 })
    const i = internals(e)
    let checked = 0
    for (const s of rippled(e).slice(0, 10)) {
      const reversed = i.reversed[s] === 1
      for (const p of [.2, .35, .6, .8]) {
        const q = reversed ? 1 - p : p
        const edge = i.edgeOf[s]
        const expected = i.ripple[s] * Math.sin(2 * Math.PI * (i.edgeCycles[edge] * q + i.edgePhase[edge])) * Math.sin(Math.PI * q)
        const a = at(e, s, p), b = at(straight, s, p)
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(Math.abs(expected), 5)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('gives the edges different pitches (the seed spreads them), and a different seed spreads them differently', () => {
    const cycles = (seed: number) => { const e = driven({ chaos: 0, seed }); return [...internals(e).edgeCycles.slice(0, 12)].map(c => Math.round(c * 100)) }
    expect(new Set(cycles(7)).size).toBeGreaterThan(6)
    expect(cycles(7)).toEqual(cycles(7))
    expect(cycles(7)).not.toEqual(cycles(8))
  })

  it('runs the oscillators: the same edge draws a different curve a moment later, because its phase is moving', () => {
    const e = driven({ waveOscillator: 1, chaos: 0 }, 60)
    const straight = driven({ waveOscillator: 1, chaos: 0, waveAmount: 0 }, 60)
    const s = rippled(e)[0]
    const first = profile(e, straight, s)
    for (let f = 60; f < 75; f++) e.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, satellites: 0, outline: false, waveOscillator: 1, chaos: 0 } }))
    const later = profile(e, straight, rippled(e)[0])
    const gap = Math.max(...first.map((v, k) => Math.abs(v - later[k])))
    expect(gap).toBeGreaterThan(.002)
  })

  it('speeds the oscillators with the band that drives them: a track of pure highs turns the z edges faster than the x edges', () => {
    const highs = (f: number): WireReading => ({ ...loud(f), features: { sub: 0, bass: 0, lowMid: 0, mid: 0, air: .9, flux: .5, level: .5 }, hits: { kick: 0, snare: 0, hat: 0 } })
    const e = driven({ chaos: 0 }, 1, highs), before = Float32Array.from(internals(e).edgePhase)
    for (let f = 1; f < 90; f++) e.tick(tick({ reading: highs(f), values: { ...WIRE_DEFAULTS, satellites: 0, outline: false, chaos: 0 } }))
    const axis = e.shape.edgeAxis, move = (a: number) => { let sum = 0, n = 0; for (let k = 0; k < 12; k++) if (axis[k] === a) { const d = (internals(e).edgePhase[k] - before[k] + 1) % 1; sum += Math.min(d, 1 - d); n++ } return sum / Math.max(1, n) }
    expect(move(2)).toBeGreaterThanOrEqual(0)
    // The x edges are barely driven by highs, the z edges are, so their phases have travelled a different distance.
    expect(Math.abs(move(2) - move(0))).toBeGreaterThan(.02)
  })

  it('is exactly straight in silence, whatever the oscillators and chaos are set to', () => {
    const quiet = driven({ chaos: 1, waveOscillator: 1, waveDepth: .6 }, 90, () => silentReading())
    const straight = driven({ chaos: 1, waveOscillator: 1, waveAmount: 0 }, 90)
    expect(rippled(quiet)).toHaveLength(0)
    expect(rippled(straight)).toHaveLength(0)
  })
})

describe('chaos', () => {
  const setup = (chaos: number, extra: Partial<WireValues> = {}) => ({ e: driven({ chaos, waveOscillator: 1, waveDepth: .3, ...extra }, 150), straight: driven({ chaos, waveOscillator: 1, waveAmount: 0, ...extra }, 150) })

  it('makes the lines more chaotic: the same edges are rougher at full chaos than at none', () => {
    const calm = setup(0), wild = setup(1)
    let calmRough = 0, wildRough = 0, edges = 0
    for (const s of rippled(calm.e).slice(0, 14)) {
      calmRough += roughness(profile(calm.e, calm.straight, s))
      wildRough += roughness(profile(wild.e, wild.straight, s))
      edges++
    }
    expect(edges).toBeGreaterThan(8)
    expect(wildRough).toBeGreaterThan(calmRough * 1.3)
  })

  it('still never pushes a line past Wave Depth, and the corners never move, however wild', () => {
    const { e, straight } = setup(1)
    const i = internals(e)
    for (const s of rippled(e)) {
      const n = (s + 1) % e.pointCount, length = Math.hypot(i.px[n] - i.px[s], i.py[n] - i.py[s])
      for (const p of [0, 1]) { const a = at(e, s, p), b = at(straight, s, p); expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-5) }
      for (const offset of profile(e, straight, s)) expect(Math.abs(offset)).toBeLessThanOrEqual(.3 * length * 1.001 + 1e-6)
    }
  })

  it('is chaotic but repeatable: the same seed always gives the same lines, another seed gives others', () => {
    const state = (seed: number) => Array.from(internals(driven({ chaos: 1, seed }, 200)).edgeChaos.slice(0, 12), v => Math.round(v * 1e4))
    expect(state(7)).toEqual(state(7))
    expect(state(7)).not.toEqual(state(8))
    expect(new Set(state(7)).size).toBeGreaterThan(8)
  })

  it('keeps the chaotic map inside (0, 1) however long it runs', () => {
    const e = driven({ chaos: 1 }, 1800)
    for (const v of internals(e).edgeChaos) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1) }
  })

  it('steps at a fixed rate, so a fast screen and a slow one see the same lines', () => {
    const run = (dt: number) => { const e = new WireEngine(); for (let t = 0; t < 3; t += dt) e.tick(tick({ dt, reading: loud(Math.floor(t * 60)), values: { ...WIRE_DEFAULTS, satellites: 0, chaos: 1 } })); return Array.from(internals(e).edgeChaos.slice(0, 8)) }
    const a = run(1 / 60), b = run(1 / 120)
    // The map is chaotic, so only the way it is stepped is compared: both visit values across the same interval.
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(.1)
    expect(Math.max(...b) - Math.min(...b)).toBeGreaterThan(.1)
  })

  it('loosens the figure itself a little: the satellite\'s distance from the core wanders more with chaos', () => {
    const wander = (chaos: number) => {
      const e = new WireEngine(), distances: number[] = []
      for (let f = 0; f < 900; f++) {
        e.tick(tick({ reading: loud(f), values: { ...WIRE_DEFAULTS, satellites: 1, chaos, maxDisplacement: 0 } }))
        if (f > 120) { let x = 0, y = 0, z = 0; for (let v = 8; v < 16; v++) { x += e.base[v * 3] / 8; y += e.base[v * 3 + 1] / 8; z += e.base[v * 3 + 2] / 8 } distances.push(Math.hypot(x, y, z)) }
      }
      const mean = distances.reduce((a, b) => a + b, 0) / distances.length
      return Math.sqrt(distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length)
    }
    expect(wander(1)).toBeGreaterThan(wander(0) * 1.15)
  })
})
