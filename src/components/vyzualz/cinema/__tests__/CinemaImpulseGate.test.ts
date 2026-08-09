import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import { CinemaImpulseGate } from '../CinemaImpulseGate'
import type { CinemaFrameBuilderState } from '../CinemaFrameBuilder'

function buildFrame(
  audioTimeSec: number,
  previousState: Readonly<CinemaFrameBuilderState> | null,
  options: { kick?: boolean; beatIndex?: number; beatPhase?: number; seeking?: boolean } = {},
) {
  const mi: MusicIntelligenceFrame = {
    ...DEFAULT_MI_FRAME,
    frameId: Math.max(1, Math.round(audioTimeSec * 1000)),
    trackId: 'track-a',
    sourceId: 'track-a',
    timeSec: audioTimeSec,
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex: options.beatIndex ?? 0,
      beatPhase: options.beatPhase ?? 0,
      kickHit: options.kick === true,
    },
  }
  return buildCinemaWorkspaceFrameBridge({
    width: 1280,
    height: 720,
    dpr: 1,
    audioTimeSec,
    durationSec: 60,
    deltaTimeSec: 1 / 60,
    trackId: 'track-a',
    playing: true,
    paused: false,
    bpm: 120,
    musicIntelligence: mi,
    seeking: options.seeking,
    previousState,
  })
}

describe('Cinema impulse identity gate', () => {
  it('delivers one deterministic kick identity once to every downstream consumer', () => {
    const activation = buildFrame(0, null)
    const kick = buildFrame(0.25, activation.state, { kick: true, beatPhase: 0.5 })
    expect(kick.frame.impulses.kick).toBe(true)

    const gate = new CinemaImpulseGate()
    expect(gate.consume(kick.frame).impulses.kick).toBe(true)
    expect(gate.consume(kick.frame).impulses.kick).toBe(false)
    expect(gate.consume(kick.frame).music.clocks.states.beat.hit).toBe(false)
  })

  it('accepts two legitimate kick identities and suppresses reset-frame bursts', () => {
    const activation = buildFrame(0, null)
    const first = buildFrame(0.25, activation.state, { kick: true, beatPhase: 0.5 })
    const second = buildFrame(0.4, first.state, { kick: true, beatPhase: 0.8 })
    expect(first.frame.impulses.eventIds.kick).not.toBe(second.frame.impulses.eventIds.kick)

    const gate = new CinemaImpulseGate()
    expect(gate.consume(first.frame).impulses.kick).toBe(true)
    expect(gate.consume(second.frame).impulses.kick).toBe(true)
    const reset = buildFrame(10, second.state, { kick: true, seeking: true })
    expect(gate.consume(reset.frame).impulses.kick).toBe(false)
  })
})
