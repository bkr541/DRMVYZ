import { describe, expect, it } from 'vitest'
import { psyloChoreographyHarness } from '../../../../test/support/PsyloChoreographyHarness'
import { Cinema2PsyloDirector } from '../modules/psylo/Cinema2PsyloDirector'
import { PSYLO_CHOREOGRAPHY_DEFAULTS, PSYLO_EVENT_ACTIONS } from '../presets/Cinema2PsyloChoreography'
import { PSYLO_MUSIC_DEFAULTS } from '../modules/psylo/Cinema2PsyloAudio'

const input = { energy: .5, bass: .5, high: .5, sectionIntensity: .5 }
describe('PSYLO Director significance through shared targets', () => {
  it('visibly scoped channels change macro range/build/light without mutating facts or saved design', () => {
    const h = psyloChoreographyHarness(true), saved = h.state.getSnapshot().persistentValues
    h.publish({ timeSec: 0, ...input })
    const r = h.publish({ timeSec: .5, ...input, sectionBuild: true, sectionProgress: 1, sectionIntensity: .95, spectralFlux: 1, tension: 1 })
    expect(r.channels.choreoDirectorIntensity).toBeGreaterThan(0)
    expect(r.channels.choreoDirectorMomentum).toBeGreaterThan(0)
    expect(r.directed.musicBuild).toBeGreaterThan(r.output.musicBuild)
    expect(r.directed.musicLight).toBeLessThan(r.output.musicLight)
    expect(r.frame.audio!.features.overallEnergy.value).toBe(.5)
    expect(h.state.getSnapshot().persistentValues).toEqual(saved)
  })
  it('preserves exact Phase 4 output when Director context or routes are unavailable', () => {
    const h = psyloChoreographyHarness(true)
    const r = h.publish({ timeSec: .1, ...input })
    const c = h.directorConsumer
    expect(c.apply({ ...r.frame, director: null }, 1, r.output, r.channels, false)).toEqual(r.output)
    expect(c.apply(r.frame, 1, r.output, { ...PSYLO_CHOREOGRAPHY_DEFAULTS }, false)).toEqual(r.output)
    const mismatched = { ...r.frame.director!, visualFrameId: -1 }
    expect(c.apply({ ...r.frame, director: mismatched }, 1, r.output, r.channels, false)).toEqual(r.output)
    expect(c.apply({ ...r.frame, director: { ...r.frame.director!, discontinuityGeneration: -1 } }, 1, r.output, r.channels, false)).toEqual(r.output)
  })
  it('rejects unsupported confidence and treats missing continuous channels as neutral', () => {
    const h = psyloChoreographyHarness(true), r = h.publish({ timeSec: .1, ...input })
    const unavailable = { available: false, value: null, confidence: null, evidence: [] }
    const d = { ...r.frame.director!, continuous: { intensity: unavailable, momentum: unavailable }, context: { ...r.frame.director!.context, build: unavailable } }
    const channels = { ...r.channels, choreoDirectorImpact: -1, choreoDirectorTransition: 0 }
    expect(new Cinema2PsyloDirector().apply({ ...r.frame, director: d }, 1, r.output, channels, false)).toEqual(r.output)
    const low = { ...d, continuous: { intensity: { ...r.frame.director!.continuous.intensity, confidence: .1 }, momentum: unavailable } }
    expect(new Cinema2PsyloDirector().apply({ ...r.frame, director: low }, 1, r.output, channels, false)).toEqual(r.output)
  })
  it('qualifies fresh impact once, amplifies existing envelopes within their maxima and returns to base', () => {
    const h = psyloChoreographyHarness(true)
    h.publish({ timeSec: 0, ...input })
    h.publish({ timeSec: .1, ...input, event: 'kick' })
    const r = h.publish({ timeSec: .2, ...input })
    expect(r.directed.musicKick).toBeGreaterThan(r.output.musicKick)
    expect(r.directed.musicKick).toBeLessThanOrEqual(PSYLO_EVENT_ACTIONS.kick.maximum)
    const released = h.publish({ timeSec: 1.1, ...input })
    expect(released.directed.musicKick).toBe(0)
    expect(released.directed.musicDrop).toBe(0) // Intensity/impact cannot invent a semantic drop.
  })
  it('latches activation, reset and resume identities; Music Response zero wins immediately', () => {
    const h = psyloChoreographyHarness(true)
    const activation = h.publish({ timeSec: .1, ...input, event: 'kick' })
    expect(activation.directed.musicKick).toBe(0)
    h.publish({ timeSec: .2, ...input, event: 'kick' })
    const active = h.publish({ timeSec: .22, ...input })
    const paused = { ...active.frame, audio: null, director: null, transport: { ...active.frame.transport!, paused: true, playing: false } }
    expect(h.directorConsumer.apply(paused, 1, active.output, active.channels, false)).toEqual(active.directed)
    expect(h.directorConsumer.apply(paused, 0, { ...PSYLO_MUSIC_DEFAULTS }, active.channels, false)).toEqual(PSYLO_MUSIC_DEFAULTS)
    const fresh = h.publish({ timeSec: .3, ...input, event: 'kick' })
    const held = h.directorConsumer.apply(fresh.frame, 1, fresh.output, fresh.channels, true, true)
    expect(held.musicKick).toBe(fresh.output.musicKick)
  })
  it('gives fresh section changes a shared finite accent and clears it on context loss', () => {
    const h = psyloChoreographyHarness(true)
    h.publish({ timeSec: 0, ...input })
    h.publish({ timeSec: .1, ...input, sectionBuild: true })
    const r = h.publish({ timeSec: .22, ...input, sectionBuild: true })
    expect(r.channels.choreoDirectorTransition).toBeGreaterThan(0)
    expect(r.directed.musicBeat).toBeGreaterThan(r.output.musicBeat)
    const invalid = { ...r.frame, director: null }
    expect(h.directorConsumer.apply(invalid, 1, r.output, r.channels, false)).toEqual(r.output)
    expect(h.directorConsumer.apply(r.frame, 1, r.output, r.channels, false).musicBeat).toBe(r.output.musicBeat)
    const released = h.publish({ timeSec: 1, ...input, sectionBuild: true })
    expect(released.directed.musicBeat).toBe(0)
  })
  it('keeps intense builds/impacts bounded and preserves vocal restraint', () => {
    const h = psyloChoreographyHarness(true)
    h.publish({ timeSec: 0, energy: 1, bass: 1, high: 1, build: 1 })
    h.publish({ timeSec: .1, energy: 1, bass: 1, high: 1, build: 1, event: 'drop' })
    const loud = h.publish({ timeSec: .3, energy: 1, bass: 1, high: 1, build: 1 }).directed
    const vocal = h.publish({ timeSec: 1, energy: 1, bass: 1, high: 1, build: 1, vocal: 1 }).directed
    expect(vocal.musicRange).toBeLessThan(loud.musicRange)
    expect(vocal.musicSpore).toBeLessThan(loud.musicSpore)
    expect(Object.values(vocal).every(v => v >= 0 && v <= 1)).toBe(true)
    expect(loud.musicBuild).toBeLessThanOrEqual(.15); expect(loud.musicDrop).toBeLessThanOrEqual(.25)
    expect(h.publish({ timeSec: 1.1, energy: 1, build: 1 }, 0).directed).toEqual(PSYLO_MUSIC_DEFAULTS)
  })
})
