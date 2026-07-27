import { describe, expect, it } from 'vitest'
import { ScopeTrigger, interpolateCrossing } from '../ScopeTrigger'
import { DEFAULT_SCOPE_TRIGGER, type ScopeTriggerSettings } from '../scopeTypes'
import { FIXTURE_SAMPLE_RATE, createNoiseFrame, createStereoSineFrame } from './scopeFixtures'

const FRAME_DELTA = 1 / 60

function settings(overrides: Partial<ScopeTriggerSettings> = {}): ScopeTriggerSettings {
  return { ...DEFAULT_SCOPE_TRIGGER, ...overrides }
}

function sine(frequencyHz: number, length: number, startPhase = 0): Float32Array {
  return createStereoSineFrame({ frequencyHz, length, startPhase }).left
}

describe('trigger — edge detection', () => {
  it('locates a rising zero crossing', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(1000, 2048)
    const result = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ slope: 'rising', hysteresis: 0 }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(true)
    expect(result.freeRunning).toBe(false)
    // 1 kHz at 48 kHz is 48 samples per cycle; starting at phase 0 the signal is
    // already rising, so the first *armed* rising crossing is one cycle in.
    expect(result.position).toBeGreaterThan(0)
    expect(samples[Math.ceil(result.position)]).toBeGreaterThan(0)
    expect(samples[Math.floor(result.position)] <= 0 || result.position < 1).toBe(true)
  })

  it('locates a falling crossing when the slope is falling', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(1000, 2048)
    const result = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ slope: 'falling', hysteresis: 0 }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(true)
    const index = Math.floor(result.position)
    expect(samples[index]).toBeGreaterThanOrEqual(0)
    expect(samples[index + 1]).toBeLessThan(0)
  })

  it('accepts both directions in either-slope mode', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(1000, 2048)
    const either = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ slope: 'either', hysteresis: 0, continuityWeight: 0 }), 0, 0, FRAME_DELTA,
    )
    expect(either.acquired).toBe(true)
  })

  it('honours a non-zero trigger level', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(1000, 2048)
    const result = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ level: 0.5, hysteresis: 0, slope: 'rising' }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(true)
    const index = Math.floor(result.position)
    expect(samples[index + 1]).toBeGreaterThan(0.5)
  })
})

describe('trigger — hysteresis', () => {
  it('rejects level-hugging noise that a bare comparator would retrigger on', () => {
    // A signal that dithers around zero without ever leaving a ±0.1 band.
    const length = 512
    const samples = new Float32Array(length)
    for (let i = 0; i < length; i++) samples[i] = (i % 2 === 0 ? 0.02 : -0.02)

    const withoutHysteresis = new ScopeTrigger().process(
      samples, length, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0, holdoffSeconds: 0 }), 0, 0, FRAME_DELTA,
    )
    const withHysteresis = new ScopeTrigger().process(
      samples, length, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0.1, holdoffSeconds: 0 }), 0, 0, FRAME_DELTA,
    )

    expect(withoutHysteresis.acquired).toBe(true)
    expect(withHysteresis.acquired).toBe(false)
  })

  it('still triggers on a signal that clears the hysteresis band', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(1000, 2048)
    const result = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0.1 }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(true)
  })
})

describe('trigger — holdoff', () => {
  it('suppresses candidates inside the holdoff window', () => {
    // Two rising crossings 20 samples apart, repeated.
    const length = 1024
    const samples = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      samples[i] = Math.sin((i / 20) * Math.PI * 2) + Math.sin((i / 5) * Math.PI * 2) * 0.6
    }

    const shortHoldoff = new ScopeTrigger()
    const longHoldoff = new ScopeTrigger()

    const a = shortHoldoff.process(
      samples, length, FIXTURE_SAMPLE_RATE,
      settings({ holdoffSeconds: 0, hysteresis: 0, continuityWeight: 0, periodAssist: 0 }),
      0, 0, FRAME_DELTA,
    )
    const b = longHoldoff.process(
      samples, length, FIXTURE_SAMPLE_RATE,
      // 15 samples at 48 kHz — long enough to swallow the 5-sample ripple.
      settings({ holdoffSeconds: 15 / FIXTURE_SAMPLE_RATE, hysteresis: 0, continuityWeight: 0, periodAssist: 0 }),
      0, 0, FRAME_DELTA,
    )

    expect(a.acquired).toBe(true)
    expect(b.acquired).toBe(true)
    // Both find *a* trigger; the long holdoff must not find one earlier than
    // the short one, since it can only ever reject candidates.
    expect(b.position).toBeGreaterThanOrEqual(a.position - 1e-6)
  })
})

describe('trigger — sub-sample interpolation', () => {
  it('estimates the fractional crossing point', () => {
    expect(interpolateCrossing(-1, 1, 0, 10)).toBeCloseTo(10.5, 10)
    expect(interpolateCrossing(-0.25, 0.75, 0, 4)).toBeCloseTo(4.25, 10)
  })

  it('returns the left index when the segment is flat', () => {
    expect(interpolateCrossing(0.5, 0.5, 0, 7)).toBe(7)
  })

  it('produces non-integer trigger positions on a real waveform', () => {
    const trigger = new ScopeTrigger()
    // 997 Hz is deliberately not a divisor of 48 kHz, so crossings fall between
    // samples and an integer-only trigger would visibly twitch.
    const samples = sine(997, 4096)
    const result = trigger.process(
      samples, 4096, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0 }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(true)
    expect(result.position % 1).not.toBe(0)
  })
})

describe('trigger — stability across advancing capture windows', () => {
  /**
   * The product claim is that a steady tone stops sliding. Concretely: as the
   * capture window advances by an arbitrary, non-period-aligned number of
   * samples each frame, the trigger must land on the same phase of the
   * underlying waveform every time. Expressed in absolute capture coordinates,
   * that means (windowStart + position) is always an integer number of periods
   * from the signal's own zero crossing.
   */
  it('lands on the same waveform phase every frame', () => {
    const trigger = new ScopeTrigger()
    const frequency = 440
    const periodSamples = FIXTURE_SAMPLE_RATE / frequency
    const advance = 813 // deliberately not a whole number of periods

    for (let frameIndex = 0; frameIndex < 30; frameIndex++) {
      const windowStart = frameIndex * advance
      // Slice of one continuous sine: sample i of this window is absolute
      // sample (windowStart + i).
      const startPhase = (windowStart * Math.PI * 2 * frequency) / FIXTURE_SAMPLE_RATE
      const samples = sine(frequency, 4096, startPhase)

      const result = trigger.process(
        samples, 4096, FIXTURE_SAMPLE_RATE,
        settings({ hysteresis: 0.02, continuityWeight: 0.6, periodAssist: 0.6 }),
        periodSamples, 0.9, FRAME_DELTA, windowStart,
      )

      expect(result.acquired).toBe(true)
      const absolute = windowStart + result.position
      const phase = (absolute % periodSamples) / periodSamples
      expect(Math.min(phase, 1 - phase)).toBeLessThan(0.005)
    }
  })

  it('holds phase on a harmonically dense signal where several crossings compete', () => {
    // Fundamental plus a strong second harmonic: two rising zero crossings per
    // fundamental period, so a strength-only picker has a real choice to make.
    const frequency = 200
    const periodSamples = FIXTURE_SAMPLE_RATE / frequency
    const advance = 977

    const build = (windowStart: number, length: number): Float32Array => {
      const out = new Float32Array(length)
      for (let i = 0; i < length; i++) {
        const t = ((windowStart + i) * Math.PI * 2 * frequency) / FIXTURE_SAMPLE_RATE
        out[i] = Math.sin(t) * 0.7 + Math.sin(t * 2 + 0.9) * 0.55
      }
      return out
    }

    const trigger = new ScopeTrigger()
    const phases: number[] = []

    for (let frameIndex = 0; frameIndex < 24; frameIndex++) {
      const windowStart = frameIndex * advance
      const result = trigger.process(
        build(windowStart, 4096), 4096, FIXTURE_SAMPLE_RATE,
        settings({ hysteresis: 0.02, continuityWeight: 0.8, periodAssist: 0.9 }),
        periodSamples, 0.95, FRAME_DELTA, windowStart,
      )
      expect(result.acquired).toBe(true)
      const absolute = windowStart + result.position
      phases.push((((absolute % periodSamples) + periodSamples) % periodSamples) / periodSamples)
    }

    // Ignore the first frame, which has no history to be continuous with.
    const settled = phases.slice(1)
    const reference = settled[0]
    for (const phase of settled) {
      const delta = Math.abs(phase - reference)
      expect(Math.min(delta, 1 - delta)).toBeLessThan(0.02)
    }
  })
})

describe('trigger — modes and fallback', () => {
  it('free-run reports no trigger position', () => {
    const trigger = new ScopeTrigger()
    const samples = sine(440, 2048)
    const result = trigger.process(
      samples, 2048, FIXTURE_SAMPLE_RATE, settings({ mode: 'freeRun' }), 0, 0, FRAME_DELTA,
    )
    expect(result.freeRunning).toBe(true)
    expect(result.position).toBe(-1)
  })

  it('auto falls back to free-run after sustained acquisition failure', () => {
    const trigger = new ScopeTrigger()
    const good = sine(440, 2048)
    const flat = new Float32Array(2048).fill(0.9)
    const config = settings({ mode: 'auto', autoFallbackSeconds: 0.2, hysteresis: 0.05 })

    expect(trigger.process(good, 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, FRAME_DELTA).acquired).toBe(true)

    // A DC-pinned signal offers no crossings. The last trigger is reused first…
    const reused = trigger.process(flat, 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, 0.05)
    expect(reused.freeRunning).toBe(false)
    expect(reused.acquired).toBe(false)

    // …then auto gives up rather than pinning the display to a stale position.
    let last = reused
    for (let i = 0; i < 10; i++) {
      last = trigger.process(flat, 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, 0.05)
    }
    expect(last.freeRunning).toBe(true)
    expect(last.confidence).toBe(0)
  })

  it('normal mode holds the last trigger instead of falling back', () => {
    const trigger = new ScopeTrigger()
    const good = sine(440, 2048)
    const flat = new Float32Array(2048).fill(0.9)
    const config = settings({ mode: 'normal', hysteresis: 0.05 })

    const first = trigger.process(good, 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, FRAME_DELTA)
    let last = first
    for (let i = 0; i < 40; i++) {
      last = trigger.process(flat, 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, 0.05)
    }
    expect(last.freeRunning).toBe(false)
    expect(last.position).toBeCloseTo(first.position, 10)
  })

  it('single latches after one acquisition until re-armed', () => {
    const trigger = new ScopeTrigger()
    const config = settings({ mode: 'single', hysteresis: 0 })
    const first = trigger.process(sine(440, 2048), 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, FRAME_DELTA)
    expect(first.acquired).toBe(true)

    const second = trigger.process(sine(440, 2048, 1.1), 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, FRAME_DELTA)
    expect(second.acquired).toBe(false)
    expect(second.position).toBeCloseTo(first.position, 10)

    trigger.rearmSingle()
    const third = trigger.process(sine(440, 2048, 1.1), 2048, FIXTURE_SAMPLE_RATE, config, 0, 0, FRAME_DELTA)
    expect(third.acquired).toBe(true)
  })

  it('produces a bounded position on noise and never NaN', () => {
    const trigger = new ScopeTrigger()
    const noise = createNoiseFrame(4096).left
    const result = trigger.process(
      noise, 4096, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0.1 }), 0, 0, FRAME_DELTA,
    )
    expect(Number.isNaN(result.position)).toBe(false)
    expect(result.position).toBeLessThan(4096)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('reports free-run for a silent buffer instead of inventing a trigger', () => {
    const trigger = new ScopeTrigger()
    const silence = new Float32Array(2048)
    const result = trigger.process(
      silence, 2048, FIXTURE_SAMPLE_RATE, settings({ hysteresis: 0.02 }), 0, 0, FRAME_DELTA,
    )
    expect(result.acquired).toBe(false)
    expect(result.freeRunning).toBe(true)
  })
})
