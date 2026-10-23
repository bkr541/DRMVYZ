import { describe, expect, it } from 'vitest'
import { chartCinema2BlockshiftLedBars, writeCinema2BlockshiftLeds, CINEMA2_BLOCKSHIFT_LED_FLOATS } from '../modules/blockshift/Cinema2BlockshiftLeds'
import { CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, CINEMA2_BLOCKSHIFT_CUE_RELEASE, type Cinema2BlockshiftAudioChannels } from '../modules/blockshift/Cinema2BlockshiftAudio'
import { CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS } from '../modules/blockshift/Cinema2BlockshiftPerformance'

const base = { pattern: 'stagger' as const, phase: 0.213, reactivity: 1, audio: { channels: { ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS } as Cinema2BlockshiftAudioChannels, envelopes: Object.fromEntries(Object.keys(CINEMA2_BLOCKSHIFT_CUE_RELEASE).map(k => [k, 0])) as Record<keyof typeof CINEMA2_BLOCKSHIFT_CUE_RELEASE, number>, motionGain: 1, consumed: 0 }, director: { ...CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS }, macroWeight: 0 }

describe('BLOCKSHIFT physical LED bars', () => {
  it('charts original triangles along their real bar direction, retaining positions/normals and isolating circuit IDs', () => {
    const vertices = new Float32Array([-.5,.45,.5,0,0,1, .5,.45,.5,0,0,1, .5,.5,.5,0,0,1, -.5,.5,.5,0,0,1])
    const indices = new Uint16Array([0,1,2,0,2,3])
    const result = chartCinema2BlockshiftLedBars({ vertices, indices })
    expect(result.indices).toHaveLength(indices.length)
    indices.forEach((source, target) => expect(Array.from(result.vertices.slice(target * 6, target * 6 + 6))).toEqual(Array.from(vertices.slice(source * 6, source * 6 + 6))))
    expect(Array.from(result.ledCoordinates!)).toEqual([0,0,3, 1,0,3, 1,1,3, 0,0,3, 1,1,3, 0,1,3])
  })

  it('uses fifteen stable cube identities and twelve circuits each, with six different geometry-aware programs', () => {
    const programs = CINEMA2_BLOCKSHIFT_PATTERN_IDS.map(pattern => writeCinema2BlockshiftLeds({ ...base, pattern, audio: { ...base.audio, channels: { ...base.audio.channels, audioEnergy: 0.8, bassPressure: 0.9 } } }))
    expect(new Set(programs.map(p => JSON.stringify(Array.from(p))))).toHaveProperty('size', 6)
    for (const program of programs) {
      expect(program).toHaveLength(CINEMA2_BLOCKSHIFT_LED_FLOATS)
      expect(program.every(n => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true)
      expect(new Set(Array.from(program).filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(1)
    }
    const a = writeCinema2BlockshiftLeds({ ...base, audio: { ...base.audio, channels: { ...base.audio.channels, audioEnergy: 0.8 } } })
    expect(writeCinema2BlockshiftLeds({ ...base, phase: 0.73, audio: { ...base.audio, channels: { ...base.audio.channels, audioEnergy: 0.8 } } })).not.toEqual(a)
  })

  it('gives kick and snare different physical circuit groups, and responds to shared structural context', () => {
    const kick = writeCinema2BlockshiftLeds({ ...base, audio: { ...base.audio, envelopes: { ...base.audio.envelopes, kick: 1 } } })
    const snare = writeCinema2BlockshiftLeds({ ...base, audio: { ...base.audio, envelopes: { ...base.audio.envelopes, snare: 1 } } })
    expect(kick[4 * 4]).toBeGreaterThan(snare[4 * 4]!) // Cube 0, longitudinal circuit.
    expect(snare[(12 + 0) * 4]).toBeGreaterThan(kick[(12 + 0) * 4]!) // Cube 1, cross circuit.
    for (const kind of ['downbeat', 'bar', 'phrase', 'section', 'drop'] as const) expect(writeCinema2BlockshiftLeds({ ...base, audio: { ...base.audio, envelopes: { ...base.audio.envelopes, [kind]: 1 } } })).not.toEqual(writeCinema2BlockshiftLeds(base))
  })

  it('honors Audio Reactivity zero as steady LEDs, reuses fixed storage and bounds maximal shared inputs/Director/Auto', () => {
    const loud = { ...base, macroWeight: 0.35, director: { directorIntensity: 1, directorBuild: 1, directorImpact: 1 }, audio: { ...base.audio, channels: Object.fromEntries(Object.keys(base.audio.channels).map(k => [k, 1])) as typeof base.audio.channels, envelopes: Object.fromEntries(Object.keys(base.audio.envelopes).map(k => [k, 1])) as typeof base.audio.envelopes } }
    const storage = new Float32Array(CINEMA2_BLOCKSHIFT_LED_FLOATS)
    expect(writeCinema2BlockshiftLeds(loud, storage)).toBe(storage)
    expect(storage.every(n => Number.isFinite(n) && n >= 0 && n <= 1)).toBe(true)
    const zero = writeCinema2BlockshiftLeds({ ...loud, reactivity: 0 })
    expect(zero).toEqual(writeCinema2BlockshiftLeds({ ...base, reactivity: 0, phase: 0.9 }))
    for (let i = 0; i < 180; i++) expect(Array.from(zero.slice(i * 4, i * 4 + 4))).toEqual([expect.closeTo(0.36), 0, 1, 0])
  })
})
