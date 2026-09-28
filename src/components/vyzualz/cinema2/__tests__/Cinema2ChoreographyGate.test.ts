import { describe, expect, it } from 'vitest'
import { gateGain } from '../choreography/Cinema2ChoreographyRuntime'

const BEAT = 0.5 // 120 BPM

describe('choreography step gate', () => {
  it('is always open without a gate or without beat timing', () => {
    expect(gateGain(undefined, 0.3, BEAT)).toBe(1)
    expect(gateGain({ stepsPerBeat: 4, pattern: 'x...' }, 0.3, null)).toBe(1)
  })

  it('reads the pattern one step at a time from when the action fired, looping, lit for the duty fraction of an on step', () => {
    const gate = { stepsPerBeat: 4, pattern: 'x..x' } // 16th steps of 0.125 s
    const at = (step: number, within = 0.25) => gateGain(gate, (step + within) * (BEAT / 4), BEAT)
    expect(at(0)).toBe(1)
    expect(at(0, 0.75)).toBe(0) // past the default 50% duty
    expect(at(1)).toBe(0)
    expect(at(2)).toBe(0)
    expect(at(3)).toBe(1)
    expect(at(4)).toBe(1) // loops
    expect(at(5)).toBe(0)
  })

  it('makes a 16th-note strobe from a single on step', () => {
    const strobe = { stepsPerBeat: 4, pattern: 'x', duty: 0.3 }
    const samples = Array.from({ length: 16 }, (_, index) => gateGain(strobe, (index * BEAT) / 16, BEAT))
    expect(samples.filter(value => value === 1).length).toBe(8) // two samples per step, one of them inside the 30% duty
  })
})
