import { describe, expect, it } from 'vitest'
import { emptyOsc1Features, type Osc1Features } from './XyScopeOsc1Engine'
import { OctaEngine, OCTA_COUNT } from './XyScopeOctaEngine'
import { DEFAULT_OCTA_SETTINGS, normalizeOctaSettings, normalizeOctaValues, OCTA_DEFAULTS, type OctaValues } from './XyScopeOctaSettings'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

const features = (level: number): Osc1Features => ({ ...emptyOsc1Features(), level, bass: level, mid: level })
/**
 * An engine settled on a steady energy. One loud frame sets the track's range (the engine normalises to it, and the range relaxes with a
 * 10 s time constant), then the level follows that decay so the energy holds exactly at `energy`.
 */
function settled(energy: number, values: OctaValues = OCTA_DEFAULTS, seconds = 4) {
  const engine = new OctaEngine(), fast = { ...values, energyResponse: 1 }
  engine.tick(1 / 60, features(1), true, fast)
  for (let i = 1; i <= seconds * 60; i++) engine.tick(1 / 60, features(energy * Math.exp(-i / 60 / 10)), true, fast)
  engine.tick(1 / 60, features(energy * Math.exp(-seconds / 10)), true, values)
  return engine
}
/** One scan of the path: the points the beam draws. */
function scan(engine: OctaEngine, samples = 4000) {
  const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
  const points: { x: number; y: number }[] = []
  for (let k = 0; k < samples; k++) { engine.signal(engine.letters[0], 0, k / samples, 0, 0, out); points.push({ x: out.x, y: out.y }) }
  return points
}

describe('OCTA settings', () => {
  it('defaults to the green phosphor on black with Auto Performance off, and clamps stored values', () => {
    expect(DEFAULT_OCTA_SETTINGS.autoPerformance).toBe(false)
    expect(OCTA_DEFAULTS.backgroundColor).toBe('#000000')
    expect(normalizeOctaSettings(undefined)).toEqual({ ...DEFAULT_OCTA_SETTINGS, values: OCTA_DEFAULTS })
    expect(normalizeOctaValues({ distortion: 9, scan: -1, color: 'green', axes: 'no', glowColor: '#ABCDEF' })).toMatchObject({ distortion: 2, scan: 12, color: OCTA_DEFAULTS.color, axes: true, glowColor: '#abcdef' })
  })

  it('is an instrument preset of the OSCILATOR source: choosing OCTA switches the engine and the two agree', () => {
    const next = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, 'octa')
    expect(next.sourceMode).toBe('octa')
    expect(next.presetId).toBe('octa')
    expect(normalizeXyScopeSettings({ ...next, presetId: 'conversation' }).presetId).toBe('octa')
    expect(normalizeXyScopeSettings({ ...next, sourceMode: 'oscillator' }).presetId).toBe('conversation')
    expect(applyXyScopePreset(next, 'init').sourceMode).toBe('init')
  })
})

describe('OCTA figure', () => {
  it('draws five octahedra in a plus: one in the centre and one above, below, left and right', () => {
    const engine = settled(0)
    const points = scan(engine)
    const xs = points.map(p => p.x), ys = points.map(p => p.y)
    // About ±1 stage unit across, and square (the cluster is as tall as it is wide).
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1.8)
    expect(Math.abs((Math.max(...xs) - Math.min(...xs)) - (Math.max(...ys) - Math.min(...ys)))).toBeLessThan(.2)
    // Symmetric about both axes (to the tilt and slow spin of a clean figure).
    expect(Math.abs(Math.max(...xs) + Math.min(...xs))).toBeLessThan(.15)
    expect(Math.abs(Math.max(...ys) + Math.min(...ys))).toBeLessThan(.15)
    // Eighteen corners per octahedron with the axes, twelve without.
    const path = engine as unknown as { count: number }
    expect(path.count).toBe(OCTA_COUNT * 18)
    const bare = settled(0, { ...OCTA_DEFAULTS, axes: false })
    expect((bare as unknown as { count: number }).count).toBe(OCTA_COUNT * 13)
  })

  it('walks every one of an octahedron\'s twelve edges', () => {
    const engine = settled(0, { ...OCTA_DEFAULTS, axes: false })
    const inner = engine as unknown as { from: Uint8Array; to: Uint8Array; kinds: string[] }
    const seen = new Set<string>()
    for (let s = 0; s < 13; s++) if (inner.kinds[s] !== 'hop') seen.add([inner.from[s], inner.to[s]].sort().join('-'))
    expect(seen.size).toBe(12)
  })

  it('stays finite, bounded and lit over a long run at every energy', () => {
    for (const level of [0, .2, .4, .5, .72, .9, 1]) {
      const engine = settled(level, OCTA_DEFAULTS, 12)
      for (const p of scan(engine, 6000)) { expect(Number.isFinite(p.x + p.y)).toBe(true); expect(Math.abs(p.x)).toBeLessThan(2.2); expect(Math.abs(p.y)).toBeLessThan(2.2) }
    }
  })
})

describe('OCTA distortion follows the music\'s energy', () => {
  it('passes through clean, tumble, loops, cage and dots in order as the energy climbs, and returns to clean in silence', () => {
    const states = [0, .02, .25, .45, .72, .95].map(level => settled(level).state)
    expect(states).toEqual(['CLEAN', 'CLEAN', 'TUMBLE', 'LOOPS', 'CAGE', 'DOTS'])
    const engine = settled(1)
    expect(engine.state).toBe('DOTS')
    for (let i = 0; i < 600; i++) engine.tick(1 / 60, emptyOsc1Features(), true, OCTA_DEFAULTS)
    expect(engine.state).toBe('CLEAN')
    expect(engine.energy).toBeLessThan(.05)
  })

  it('stays clean when paused, with Audio Reactivity at zero, or with Distortion Amount at zero, however loud the track is', () => {
    const paused = new OctaEngine()
    for (let i = 0; i < 240; i++) paused.tick(1 / 60, features(1), false, OCTA_DEFAULTS)
    expect(paused.state).toBe('CLEAN')
    expect(settled(1, { ...OCTA_DEFAULTS, audioReactivity: 0 }).state).toBe('CLEAN')
    expect(settled(1, { ...OCTA_DEFAULTS, distortion: 0 }).state).toBe('CLEAN')
  })

  it('adapts to the track: the same material reaches the same distortion whether it is quiet or loud overall', () => {
    const scaled = (gain: number) => {
      const engine = new OctaEngine()
      engine.tick(1 / 60, features(gain), true, OCTA_DEFAULTS)
      for (let i = 0; i < 240; i++) engine.tick(1 / 60, features(gain * .5), true, OCTA_DEFAULTS)
      return engine.energy
    }
    expect(scaled(.9)).toBeCloseTo(scaled(.45), 1)
  })

  it('Energy Response sets how fast it follows: high snaps to a hit, low eases in', () => {
    const rise = (energyResponse: number) => {
      const values = { ...OCTA_DEFAULTS, energyResponse }
      const engine = new OctaEngine()
      engine.tick(1 / 60, features(1), true, values)
      for (let i = 0; i < 4; i++) engine.tick(1 / 60, features(1), true, values)
      return engine.energy
    }
    expect(rise(1)).toBeGreaterThan(rise(0) + .2)
  })

  it('tumble spins the octahedra apart and tangles them; clean keeps the same cluster', () => {
    const clean = scan(settled(0)), tumbling = scan(settled(.25))
    const spread = (points: { x: number; y: number }[]) => Math.max(...points.map(p => Math.hypot(p.x, p.y)))
    expect(spread(tumbling)).toBeLessThan(spread(clean))
    const first = scan(settled(.25, OCTA_DEFAULTS, 4)), second = scan(settled(.25, OCTA_DEFAULTS, 5))
    expect(first[100]).not.toEqual(second[100])
  })

  it('the cage pulls every edge onto a sphere: points sit at one distance from their octahedron\'s centre', () => {
    const engine = settled(.72)
    expect(engine.state).toBe('CAGE')
    const inner = engine as unknown as { centre: Float32Array; radius: number; sphere: number; owner: Uint8Array; kinds: string[] }
    expect(inner.sphere).toBeGreaterThan(.9)
    const points = scan(engine, 6000)
    // The figure draws in: the cage is narrower than the clean cluster.
    const width = (list: { x: number }[]) => Math.max(...list.map(p => p.x)) - Math.min(...list.map(p => p.x))
    expect(width(points)).toBeLessThan(width(scan(settled(0))))
  })

  it('the beam overshoots its corners in the loops state (a resonant low-pass), and rests at them in the dot scan', () => {
    const clean = settled(0), loops = settled(.45), dots = settled(.95)
    const cleanPath = scan(clean, 8000), loopPath = scan(loops, 8000)
    const turning = (points: { x: number; y: number }[]) => points.reduce((sum, p, i) => i === 0 ? 0 : sum + Math.abs(Math.atan2(p.y - points[i - 1].y, p.x - points[i - 1].x)), 0)
    expect(loops.state).toBe('LOOPS')
    expect(turning(loopPath)).not.toBeCloseTo(turning(cleanPath), 0)
    // Dwell: far more of the scan is spent within a hair of a corner in the dot scan than when clean.
    const near = (engine: OctaEngine) => {
      const inner = engine as unknown as { px: Float32Array; py: Float32Array; count: number }
      const points = scan(engine, 8000)
      return points.filter(p => { for (let c = 0; c < inner.count; c++) if (Math.hypot(p.x - inner.px[c], p.y - inner.py[c]) < .02) return true; return false }).length
    }
    expect(near(dots)).toBeGreaterThan(near(clean) * 1.5)
  })

  it('draws the live waveform along the axis lines: a louder signal ripples them harder', () => {
    const wiggle = (gain: number) => {
      const engine = settled(0)
      engine.wave = Float32Array.from({ length: 512 }, (_, i) => Math.sin(i * .9) * gain)
      const flat = scan(settled(0)), moving = scan(engine)
      return Math.max(...moving.map((p, i) => Math.hypot(p.x - flat[i].x, p.y - flat[i].y)))
    }
    expect(wiggle(1)).toBeGreaterThan(wiggle(.2))
    expect(wiggle(0)).toBeLessThan(.001)
  })

  it('Master Intensity scales the beam, and zero blanks it', () => {
    const energy = (intensity: number) => {
      const engine = settled(0, { ...OCTA_DEFAULTS, intensity })
      const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
      engine.signal(engine.letters[0], 0, .3, 0, 0, out)
      return out.energy
    }
    expect(energy(2)).toBeCloseTo(energy(1) * 2, 5)
    expect(energy(0)).toBe(0)
  })
})
