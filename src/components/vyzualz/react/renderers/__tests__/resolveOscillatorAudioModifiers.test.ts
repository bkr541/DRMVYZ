import { describe, it, expect } from 'vitest'
import { resolveOscillatorAudioModifiers } from '../SoundDrawingRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from '../reactRenderUtils'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseOsc = { ...DEFAULT_OSCILLATOR_SETTINGS }
const baseParams: ReactRenderParams = {
  ...DEFAULT_REACT_RENDER_PARAMS,
  oscillator: baseOsc,
}

function makeFrame(overrides: {
  bass?:    number
  mid?:     number
  high?:    number
  volume?:  number
  beatHit?: boolean
  t?:       number
} = {}): ReactFrameContext {
  return {
    W: 800, H: 600, dpr: 1,
    t:         overrides.t       ?? 0,
    audioTime: 0,
    bpm:       120,
    beatPhase: 0,
    beatHit:   overrides.beatHit ?? false,
    isPlaying: true,
    audio: {
      bass:   overrides.bass   ?? 0,
      mid:    overrides.mid    ?? 0,
      high:   overrides.high   ?? 0,
      volume: overrides.volume ?? 0,
    },
    freqData:          null,
    timeDomainData:    null,
    musicIntelligence: null,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveOscillatorAudioModifiers', () => {
  it('returns all finite values with silent audio', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame(), baseParams, 0)
    for (const [key, val] of Object.entries(am)) {
      expect(isFinite(val as number), `${key} should be finite`).toBe(true)
    }
  })

  it('bassPulse is >= 1.0 for any audio level', () => {
    for (const bass of [0, 0.1, 0.3, 0.6, 1.0]) {
      const am = resolveOscillatorAudioModifiers(makeFrame({ bass }), baseParams, 0)
      expect(am.bassPulse, `bassPulse for bass=${bass}`).toBeGreaterThanOrEqual(1.0)
    }
  })

  it('bassPulse does not grow past 1.6 (clamp guards against runaway scale)', () => {
    const extremeParams = {
      ...baseParams,
      bassReactivity: 10,
      oscillator: { ...baseOsc, bassScale: 10 },
    }
    const am = resolveOscillatorAudioModifiers(makeFrame({ bass: 1.0 }), extremeParams, 0)
    expect(am.bassPulse).toBeLessThanOrEqual(1.6 + 1e-9)
  })

  it('beatPulse equals the passed beatEnvelope exactly', () => {
    expect(resolveOscillatorAudioModifiers(makeFrame(), baseParams, 0).beatPulse).toBe(0)
    expect(resolveOscillatorAudioModifiers(makeFrame(), baseParams, 1).beatPulse).toBe(1)
    expect(resolveOscillatorAudioModifiers(makeFrame(), baseParams, 0.5).beatPulse).toBe(0.5)
  })

  it('displacementAmount does not exceed 0.25 under any audio+settings combo', () => {
    const extremeParams = {
      ...baseParams,
      oscillator: { ...baseOsc, audioDisplacement: 10 },
    }
    const am = resolveOscillatorAudioModifiers(makeFrame({ bass: 1.0 }), extremeParams, 1)
    expect(am.displacementAmount).toBeLessThanOrEqual(0.25 + 1e-9)
  })

  it('displacementAmount is >= 0', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame({ bass: 0 }), baseParams, 0)
    expect(am.displacementAmount).toBeGreaterThanOrEqual(0)
  })

  it('highJitterAmount does not exceed 0.25 under any settings combo', () => {
    const extremeParams = {
      ...baseParams,
      oscillator: { ...baseOsc, highJitter: 100 },
    }
    const am = resolveOscillatorAudioModifiers(makeFrame({ high: 1.0 }), extremeParams, 0)
    expect(am.highJitterAmount).toBeLessThanOrEqual(0.25 + 1e-9)
  })

  it('highJitterAmount is 0 when high is 0', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame({ high: 0 }), baseParams, 0)
    expect(am.highJitterAmount).toBe(0)
  })

  it('lineWidthBoost is >= 1.0 for any audio input', () => {
    for (const [bass, env] of [[0, 0], [0.5, 0], [1.0, 1.0], [0, 1.0]] as const) {
      const am = resolveOscillatorAudioModifiers(makeFrame({ bass }), baseParams, env)
      expect(am.lineWidthBoost, `lineWidthBoost for bass=${bass} env=${env}`).toBeGreaterThanOrEqual(1.0)
    }
  })

  it('glowBoost is >= 0 for any audio input', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame(), baseParams, 0)
    expect(am.glowBoost).toBeGreaterThanOrEqual(0)
  })

  it('glowBoost increases with volume and beatEnvelope', () => {
    const silent  = resolveOscillatorAudioModifiers(makeFrame({ volume: 0 }),   baseParams, 0)
    const loud    = resolveOscillatorAudioModifiers(makeFrame({ volume: 0.8 }), baseParams, 0)
    const onBeat  = resolveOscillatorAudioModifiers(makeFrame({ volume: 0 }),   baseParams, 1)
    expect(loud.glowBoost).toBeGreaterThan(silent.glowBoost)
    expect(onBeat.glowBoost).toBeGreaterThan(silent.glowBoost)
  })

  it('rotationBoost is exactly 1.0 when mid=0 or beatEnvelope=0', () => {
    const noMid  = resolveOscillatorAudioModifiers(makeFrame({ mid: 0 }),   baseParams, 1.0)
    const noBeat = resolveOscillatorAudioModifiers(makeFrame({ mid: 1.0 }), baseParams, 0)
    expect(noMid.rotationBoost).toBeCloseTo(1.0, 8)
    expect(noBeat.rotationBoost).toBeCloseTo(1.0, 8)
  })

  it('rotationBoost increases above 1.0 when mid > 0 and beatEnvelope > 0', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame({ mid: 1.0 }), baseParams, 1.0)
    expect(am.rotationBoost).toBeGreaterThan(1.0)
  })

  it('midTwistAmount is 0 when mid is 0', () => {
    const am = resolveOscillatorAudioModifiers(makeFrame({ mid: 0 }), baseParams, 0)
    expect(am.midTwistAmount).toBe(0)
  })

  it('midTwistAmount is 0 when osc.midTwist is 0', () => {
    const noTwist = { ...baseParams, oscillator: { ...baseOsc, midTwist: 0 } }
    const am = resolveOscillatorAudioModifiers(makeFrame({ mid: 1.0 }), noTwist, 1)
    expect(am.midTwistAmount).toBe(0)
  })

  it('midTwistAmount increases on beat when mid is active', () => {
    const noBeat  = resolveOscillatorAudioModifiers(makeFrame({ mid: 0.5 }), baseParams, 0)
    const onBeat  = resolveOscillatorAudioModifiers(makeFrame({ mid: 0.5 }), baseParams, 1.0)
    expect(onBeat.midTwistAmount).toBeGreaterThan(noBeat.midTwistAmount)
  })

  it('is deterministic: same inputs produce identical outputs', () => {
    const frame = makeFrame({ bass: 0.4, mid: 0.3, high: 0.2, volume: 0.5 })
    const a = resolveOscillatorAudioModifiers(frame, baseParams, 0.7)
    const b = resolveOscillatorAudioModifiers(frame, baseParams, 0.7)
    expect(a).toEqual(b)
  })
})
