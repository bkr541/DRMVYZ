import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ThreeAudioGlow, readCinema2ThreeGlowMode, type Cinema2ThreeGlowMode } from '../modules/three/Cinema2ThreeAudioGlow'

const DT = 1 / 60

/** A frame with no audio analysis: the glow's beat clock free-runs at 120 BPM (2 beats a second). */
function frame(index: number): Cinema2ModuleFrameReadContext {
  return {
    frameId: index, timestampMs: index * DT * 1000, deltaTimeSec: DT, elapsedTimeSec: index * DT,
    viewport: { width: 1, height: 1, dpr: 1 } as never, contextGeneration: 0, audio: null, director: null,
  }
}

function run(mode: Cinema2ThreeGlowMode, seconds: number, reactivity = 1) {
  const glow = new Cinema2ThreeAudioGlow()
  const frames = []
  for (let index = 0; index < Math.round(seconds / DT); index += 1) frames.push(glow.update(frame(index), { mode, sync: true, reactivity }))
  return frames
}

const activeWaves = (entry: { fronts: readonly number[]; gains: readonly number[] }) => entry.fronts.filter((front, index) => front >= 0 && entry.gains[index]! > 0).length

describe('three-scene audio glow', () => {
  it('reads the dropdown value, defaulting to both', () => {
    expect(readCinema2ThreeGlowMode('energy')).toBe('energy')
    expect(readCinema2ThreeGlowMode('breathing')).toBe('breathing')
    expect(readCinema2ThreeGlowMode('both')).toBe('both')
    expect(readCinema2ThreeGlowMode(undefined)).toBe('both')
  })

  it('energy: a pulse starts on every beat and climbs from the root tips (0) past the top (1), with no breath beyond the resting glow', () => {
    const frames = run('energy', 3)
    expect(frames.some(entry => activeWaves(entry) > 0)).toBe(true)
    expect(new Set(frames.map(entry => entry.breath.toFixed(4))).size).toBe(1) // steady resting glow only
    const fronts = frames.map(entry => entry.fronts[0]!).filter(front => front >= 0)
    expect(Math.min(...fronts)).toBeLessThan(0.1)
    expect(Math.max(...fronts)).toBeGreaterThan(1)
  })

  it('breathing: the whole glow swells and settles on the beat with no climbing pulses', () => {
    const frames = run('breathing', 3)
    expect(frames.every(entry => activeWaves(entry) === 0)).toBe(true)
    const breaths = frames.map(entry => entry.breath)
    expect(Math.max(...breaths) - Math.min(...breaths)).toBeGreaterThan(0.05)
  })

  it('both: breathes and pulses; at zero reactivity it only rests', () => {
    const frames = run('both', 3)
    expect(frames.some(entry => activeWaves(entry) > 0)).toBe(true)
    expect(Math.max(...frames.map(entry => entry.breath)) - Math.min(...frames.map(entry => entry.breath))).toBeGreaterThan(0.05)
    const resting = run('both', 3, 0)
    expect(resting.every(entry => entry.gains.every(gain => gain === 0))).toBe(true)
    expect(new Set(resting.map(entry => entry.breath.toFixed(4))).size).toBe(1)
  })
})
