import { describe, expect, it } from 'vitest'
import { AFTERHOURS_DEFAULTS, AFTERHOURS_TRIGGERS } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import { AfterhoursTriggerController, type AfterhoursTrigger } from './AfterhoursTriggerController'

type ClockName = 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase'
type ImpulseName = 'beat' | 'downbeat' | 'kick' | 'snare' | 'transient' | 'sectionStart' | 'dropStart'

function reactionFrame(input: {
  frameIndex?: number
  deltaTimeSec?: number
  transportTimeSec?: number
  playing?: boolean
  timingDiscontinuity?: boolean
  clock?: ClockName
  clockEventId?: string
  clockPhase?: number
  clockIndex?: number
  impulse?: ImpulseName
  impulseEventId?: string
  hasCanonical?: boolean
  beatHit?: boolean
  /** All canonical clocks report unavailable — simulates "no beat grid". */
  gridUnavailable?: boolean
  energy?: number
} = {}): CinematicFrameContext {
  const frameIndex = input.frameIndex ?? 0
  const clockEntry = (name: ClockName, spanBeats: number) => {
    const isTarget = input.clock === name
    return {
      available: input.gridUnavailable !== true,
      spanBeats,
      index: name === 'bar' ? (input.clockIndex ?? 0) : (isTarget ? frameIndex : 0),
      phase: name === 'bar' ? (input.clockPhase ?? 0) : 0,
      hit: isTarget,
      eventId: isTarget ? (input.clockEventId ?? `${name}-${frameIndex}`) : null,
    }
  }
  const impulse = (name: ImpulseName) => {
    const isTarget = input.impulse === name
    return { active: isTarget, eventId: isTarget ? (input.impulseEventId ?? `${name}-${frameIndex}`) : null }
  }
  const frame: Record<string, unknown> = {
    frameIndex,
    deltaTimeSec: input.deltaTimeSec ?? 1 / 60,
    transportTimeSec: input.transportTimeSec ?? frameIndex / 60,
    timingDiscontinuity: input.timingDiscontinuity ?? false,
    isPlaying: input.playing ?? true,
    beat: { hit: input.beatHit ?? false, downbeat: false, barIndex: -1, barProgress: 0 },
    musicalAudio: { isPlaying: input.playing ?? true, values: { overallEnergy: input.energy ?? 0.4 } },
  }
  if (input.hasCanonical !== false) {
    frame.canonicalMusic = {
      impulses: {
        beat: impulse('beat'),
        downbeat: impulse('downbeat'),
        kick: impulse('kick'),
        snare: impulse('snare'),
        transient: impulse('transient'),
        sectionStart: impulse('sectionStart'),
        dropStart: impulse('dropStart'),
      },
      clocks: {
        beat: clockEntry('beat', 1),
        beat2: clockEntry('beat2', 2),
        beat4: clockEntry('beat4', 4),
        bar: clockEntry('bar', 4),
        bar4: clockEntry('bar4', 16),
        bar8: clockEntry('bar8', 32),
        phrase: clockEntry('phrase', 32),
      },
      section: { id: 'section-a', type: 'verse', progress: 0.4 },
    }
  }
  return frame as unknown as CinematicFrameContext
}

const cfg = (overrides: Partial<typeof AFTERHOURS_DEFAULTS> = {}) => ({
  trigger: AFTERHOURS_DEFAULTS.trigger,
  bpmSync: AFTERHOURS_DEFAULTS.bpmSync,
  masterIntensity: AFTERHOURS_DEFAULTS.masterIntensity,
  pulseAmount: AFTERHOURS_DEFAULTS.pulseAmount,
  pulseDecay: AFTERHOURS_DEFAULTS.pulseDecay,
  motionAmount: AFTERHOURS_DEFAULTS.motionAmount,
  ...overrides,
})

describe('Afterhours Stage 4 — trigger enum', () => {
  it('covers exactly the eleven MVP trigger options and defaults to Beat', () => {
    expect(AFTERHOURS_TRIGGERS).toEqual(['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop'])
    expect(AFTERHOURS_DEFAULTS.trigger).toBe('beat')
  })

  it('normalizes an unknown trigger to Beat without throwing', () => {
    const controller = new AfterhoursTriggerController()
    const result = controller.update({ frame: reactionFrame(), settings: cfg({ trigger: 'boom' as AfterhoursTrigger }) })
    expect(Number.isFinite(result.intensity)).toBe(true)
  })
})

describe('Afterhours Stage 4 — canonical event de-duplication', () => {
  it('fires once per canonical event id, then again on the next id', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'beat-a' }), settings: s }).fired).toBe(true)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'beat', clockEventId: 'beat-a' }), settings: s }).fired).toBe(false)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 3 }), settings: s }).fired).toBe(false)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 4, clock: 'beat', clockEventId: 'beat-b' }), settings: s }).fired).toBe(true)
  })

  it('does not re-fire when the id is unchanged but the phase advances', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'bar' })
    controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1', clockPhase: 0.1 }), settings: s })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'bar', clockEventId: 'bar-1', clockPhase: 0.6 }), settings: s }).fired).toBe(false)
  })

  it('maps Kick / Snare / Downbeat / Drop to canonical impulses and clock triggers to clocks', () => {
    for (const [trigger, impulse] of [['kick', 'kick'], ['snare', 'snare'], ['downbeat', 'downbeat'], ['drop', 'dropStart']] as const) {
      const controller = new AfterhoursTriggerController()
      const s = cfg({ trigger })
      expect(controller.update({ frame: reactionFrame({ frameIndex: 1, impulse, impulseEventId: `${impulse}-a` }), settings: s }).fired).toBe(true)
      expect(controller.update({ frame: reactionFrame({ frameIndex: 2, impulse, impulseEventId: `${impulse}-a` }), settings: s }).fired).toBe(false)
    }
    for (const clock of ['beat2', 'beat4', 'bar4', 'bar8', 'phrase'] as const) {
      const controller = new AfterhoursTriggerController()
      const s = cfg({ trigger: clock })
      expect(controller.update({ frame: reactionFrame({ frameIndex: 1, clock, clockEventId: `${clock}-a` }), settings: s }).fired).toBe(true)
      expect(controller.update({ frame: reactionFrame({ frameIndex: 2, clock, clockEventId: `${clock}-a` }), settings: s }).fired).toBe(false)
    }
  })

  it('falls back to a rising edge when no canonical identity exists', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, hasCanonical: false, beatHit: true }), settings: s }).fired).toBe(true)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, hasCanonical: false, beatHit: true }), settings: s }).fired).toBe(false)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 3, hasCanonical: false, beatHit: false }), settings: s }).fired).toBe(false)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 4, hasCanonical: false, beatHit: true }), settings: s }).fired).toBe(true)
  })
})

describe('Afterhours Stage 4 — envelope bounds and Pulse Decay', () => {
  it('snaps to 1 on a hit and decays monotonically toward 0', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }), settings: s }).envelope).toBe(1)
    let previous = 1
    for (let i = 2; i < 40; i += 1) {
      const env = controller.update({ frame: reactionFrame({ frameIndex: i }), settings: s }).envelope
      expect(env).toBeGreaterThanOrEqual(0)
      expect(env).toBeLessThanOrEqual(previous + 1e-9)
      previous = env
    }
    expect(previous).toBeLessThan(0.2)
  })

  it('Pulse Decay 1 sustains longer than Pulse Decay 0', () => {
    const run = (pulseDecay: number) => {
      const controller = new AfterhoursTriggerController()
      const s = cfg({ trigger: 'beat', pulseDecay })
      controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }), settings: s })
      let env = 1
      for (let i = 2; i < 32; i += 1) env = controller.update({ frame: reactionFrame({ frameIndex: i }), settings: s }).envelope
      return env
    }
    expect(run(1)).toBeGreaterThan(run(0))
  })

  it('Pulse Amount 0 removes the trigger reaction but keeps a stable base intensity', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat', pulseAmount: 0 })
    const rest = controller.update({ frame: reactionFrame({ frameIndex: 1 }), settings: s })
    const hit = controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'beat', clockEventId: 'b1' }), settings: s })
    expect(hit.intensity).toBeCloseTo(rest.intensity, 6)
    expect(hit.spreadDelta).toBe(0)
    expect(rest.intensity).toBeGreaterThan(0)
  })
})

describe('Afterhours Stage 4 — Drop weighting', () => {
  it('produces a stronger intensity reaction than an ordinary trigger without changing Beam Count authority', () => {
    const beat = new AfterhoursTriggerController()
    const drop = new AfterhoursTriggerController()
    const beatHit = beat.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }), settings: cfg({ trigger: 'beat', masterIntensity: 0.3 }) })
    const dropHit = drop.update({ frame: reactionFrame({ frameIndex: 1, impulse: 'dropStart', impulseEventId: 'd1' }), settings: cfg({ trigger: 'drop', masterIntensity: 0.3 }) })
    expect(dropHit.intensity).toBeGreaterThan(beatHit.intensity)
    expect(dropHit.dropWeight).toBeGreaterThan(0)
  })

  it('never latches — the drop weight relaxes to ~0 without another drop event', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'drop' })
    controller.update({ frame: reactionFrame({ frameIndex: 1, impulse: 'dropStart', impulseEventId: 'd1' }), settings: s })
    let out = controller.update({ frame: reactionFrame({ frameIndex: 2 }), settings: s })
    for (let i = 3; i < 200; i += 1) out = controller.update({ frame: reactionFrame({ frameIndex: i }), settings: s })
    expect(out.dropWeight).toBeLessThan(0.02)
  })
})

describe('Afterhours Stage 4 — BPM Sync motion phase', () => {
  it('ON derives a frame-rate-independent musical phase from the canonical bar clock', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ bpmSync: true })
    const a = controller.update({ frame: reactionFrame({ frameIndex: 10, clockIndex: 3, clockPhase: 0.5, deltaTimeSec: 1 / 30 }), settings: s }).motionPhase
    const b = controller.update({ frame: reactionFrame({ frameIndex: 11, clockIndex: 3, clockPhase: 0.5, deltaTimeSec: 1 / 120 }), settings: s }).motionPhase
    expect(a).toBe(3.5)
    expect(b).toBe(3.5)
  })

  it('OFF uses continuous transport time and advances with it', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ bpmSync: false })
    const a = controller.update({ frame: reactionFrame({ frameIndex: 1, transportTimeSec: 2 }), settings: s }).motionPhase
    const b = controller.update({ frame: reactionFrame({ frameIndex: 2, transportTimeSec: 4 }), settings: s }).motionPhase
    expect(b).toBeGreaterThan(a)
  })

  it('Motion Amount 0 suppresses motion authority while intensity reaction still occurs', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat', motionAmount: 0 })
    const rest = controller.update({ frame: reactionFrame({ frameIndex: 1 }), settings: s })
    const hit = controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'beat', clockEventId: 'b1' }), settings: s })
    expect(rest.motionAuthority).toBe(0)
    expect(hit.motionAuthority).toBe(0)
    expect(hit.intensity).toBeGreaterThan(rest.intensity)
  })
})

describe('Afterhours Stage 2 — literal control authority', () => {
  it('Master Intensity 0 is exact zero even on a trigger hit, while 1 exposes full resting authority', () => {
    const off = new AfterhoursTriggerController()
    const offHit = off.update({
      frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }),
      settings: cfg({ masterIntensity: 0, trigger: 'beat', pulseAmount: 1 }),
    })
    expect(offHit.intensity).toBe(0)

    const full = new AfterhoursTriggerController()
    const rest = full.update({ frame: reactionFrame({ frameIndex: 1 }), settings: cfg({ masterIntensity: 1, pulseAmount: 0 }) })
    expect(rest.intensity).toBe(1)
  })

  it('Motion Amount maps exactly to normalized authority at both boundaries', () => {
    const zero = new AfterhoursTriggerController().update({
      frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }),
      settings: cfg({ motionAmount: 0, pulseAmount: 1 }),
    })
    const full = new AfterhoursTriggerController().update({
      frame: reactionFrame({ frameIndex: 1 }),
      settings: cfg({ motionAmount: 1, pulseAmount: 0 }),
    })
    expect(zero.motionAuthority).toBe(0)
    expect(full.motionAuthority).toBe(1)
  })
})

describe('Afterhours Stage 4 — reset / replay / no-music', () => {
  it('replays the same event id after a timing discontinuity (seek)', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }), settings: s }).fired).toBe(true)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'beat', clockEventId: 'b1', timingDiscontinuity: true }), settings: s }).fired).toBe(true)
  })

  it('reset() clears consumed identities and the envelope', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    controller.update({ frame: reactionFrame({ frameIndex: 1, clock: 'beat', clockEventId: 'b1' }), settings: s })
    controller.reset()
    const after = controller.update({ frame: reactionFrame({ frameIndex: 2, clock: 'beat', clockEventId: 'b1' }), settings: s })
    expect(after.fired).toBe(true)
    expect(after.envelope).toBe(1)
  })

  it('degrades to a stable non-reactive state when music is not playing', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    const out = controller.update({ frame: reactionFrame({ frameIndex: 1, playing: false, clock: 'beat', clockEventId: 'b1' }), settings: s })
    expect(out.fired).toBe(false)
    expect(out.envelope).toBe(0)
    expect(Number.isFinite(out.intensity) && Number.isFinite(out.motionPhase)).toBe(true)
  })
})

describe('Afterhours Stage 4 — energy-onset fallback with no beat grid', () => {
  it('fires on an energy swell when the selected clock trigger has no canonical grid', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    // Quiet -> no fire even though the grid is gone.
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, gridUnavailable: true, energy: 0.4 }), settings: s }).fired).toBe(false)
    // Swell past the fire threshold -> one fire.
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, gridUnavailable: true, energy: 0.8 }), settings: s }).fired).toBe(true)
    // Held high -> does not re-fire (arm hysteresis is the de-dup).
    expect(controller.update({ frame: reactionFrame({ frameIndex: 3, gridUnavailable: true, energy: 0.85 }), settings: s }).fired).toBe(false)
    // Drop below the rearm threshold, then swell again -> fires again.
    expect(controller.update({ frame: reactionFrame({ frameIndex: 4, gridUnavailable: true, energy: 0.5 }), settings: s }).fired).toBe(false)
    expect(controller.update({ frame: reactionFrame({ frameIndex: 5, gridUnavailable: true, energy: 0.9 }), settings: s }).fired).toBe(true)
  })

  it('never uses the energy fallback while the canonical clock IS available', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    // Grid present, loud energy, but no beat-clock hit -> stays quiet (no double path).
    for (let i = 1; i < 8; i += 1) {
      expect(controller.update({ frame: reactionFrame({ frameIndex: i, energy: 0.95 }), settings: s }).fired).toBe(false)
    }
    // The real clock identity still fires normally.
    expect(controller.update({ frame: reactionFrame({ frameIndex: 8, clock: 'beat', clockEventId: 'b1', energy: 0.95 }), settings: s }).fired).toBe(true)
  })

  it('impulse triggers (Kick/Snare) stay quiet without onsets — the fallback only covers clock triggers', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'kick' })
    for (let i = 1; i < 6; i += 1) {
      expect(controller.update({ frame: reactionFrame({ frameIndex: i, gridUnavailable: true, energy: 0.95 }), settings: s }).fired).toBe(false)
    }
  })

  it('re-arms the energy fallback on reset and on a timing discontinuity', () => {
    const controller = new AfterhoursTriggerController()
    const s = cfg({ trigger: 'beat' })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 1, gridUnavailable: true, energy: 0.9 }), settings: s }).fired).toBe(true)
    controller.reset()
    expect(controller.update({ frame: reactionFrame({ frameIndex: 2, gridUnavailable: true, energy: 0.9 }), settings: s }).fired).toBe(true)
    // Held high across a seek -> the discontinuity re-arms so it fires again.
    controller.update({ frame: reactionFrame({ frameIndex: 3, gridUnavailable: true, energy: 0.9 }), settings: s })
    expect(controller.update({ frame: reactionFrame({ frameIndex: 4, gridUnavailable: true, energy: 0.9, timingDiscontinuity: true }), settings: s }).fired).toBe(true)
  })
})
