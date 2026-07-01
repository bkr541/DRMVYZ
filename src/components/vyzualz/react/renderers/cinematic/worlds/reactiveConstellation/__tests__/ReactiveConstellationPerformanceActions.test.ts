import { describe, expect, it } from 'vitest'
import type { ReactPerformanceActionEvent } from '../../../../../ReactPerformanceActions'
import {
  ReactiveConstellationPerformanceActionRuntime,
  resolvePerformanceActionEnvelope,
} from '../ReactiveConstellationPerformanceActions'

const target = { engineId: 'cinematicPortal', worldId: 'reactiveConstellation' } as const

function event(
  actionId: string,
  sequence: number,
  toggleState?: boolean,
): ReactPerformanceActionEvent {
  return { actionId, sequence, target, triggeredAtMs: sequence * 100, ...(toggleState == null ? {} : { toggleState }) }
}

describe('Reactive Constellation performance action runtime', () => {
  it('consumes one-shot reseed events exactly once, including across a seek reset', () => {
    const runtime = new ReactiveConstellationPerformanceActionRuntime()
    const reseed = event('reactiveConstellation.reseed', 7)
    expect(runtime.update({ event: reseed, deltaTimeSec: 1 / 60 }).reseedSequence).toBe(7)
    expect(runtime.update({ event: reseed, deltaTimeSec: 1 / 60 }).reseedSequence).toBeNull()

    runtime.reset({ preserveConsumedSequence: true })
    expect(runtime.update({ event: reseed, deltaTimeSec: 1 / 60, timingDiscontinuity: true }).reseedSequence).toBeNull()
    expect(runtime.consumedSequence).toBe(7)
  })

  it('keeps toggle state visible until an explicit release event', () => {
    const runtime = new ReactiveConstellationPerformanceActionRuntime()
    expect(runtime.update({
      event: event('reactiveConstellation.freeze', 1, true),
      toggleStates: { 'reactiveConstellation.freeze': true },
      deltaTimeSec: 1 / 60,
    }).freeze).toBe(true)
    expect(runtime.update({
      event: event('reactiveConstellation.freeze', 1, true),
      toggleStates: { 'reactiveConstellation.freeze': true },
      deltaTimeSec: 0,
    }).freeze).toBe(true)
    expect(runtime.update({
      event: event('reactiveConstellation.freeze', 2, false),
      toggleStates: { 'reactiveConstellation.freeze': false },
      deltaTimeSec: 1 / 60,
    }).freeze).toBe(false)
  })

  it('advances bounded momentary envelopes independently of transport and clears them on seek', () => {
    const runtime = new ReactiveConstellationPerformanceActionRuntime()
    const burst = event('reactiveConstellation.burst', 3)
    const launched = runtime.update({ event: burst, deltaTimeSec: 0.05 })
    expect(launched.burstSequence).toBe(3)
    const active = runtime.update({ event: burst, deltaTimeSec: 0 })
    expect(active.burstSequence).toBeNull()
    expect(active.offsets.burstImpulse).toBeGreaterThan(0)
    expect(active.offsets.burstImpulse).toBeLessThanOrEqual(2.5)

    const afterSeek = runtime.update({ event: burst, deltaTimeSec: 0, timingDiscontinuity: true })
    expect(afterSeek.offsets.burstImpulse ?? 0).toBe(0)
  })


  it('consumes every buffered action in sequence once when several arrive between frames', () => {
    const runtime = new ReactiveConstellationPerformanceActionRuntime()
    const events = [
      event('reactiveConstellation.collapse', 10),
      event('reactiveConstellation.reseed', 11),
      event('reactiveConstellation.freeze', 12, true),
    ]
    const first = runtime.update({
      events,
      toggleStates: { 'reactiveConstellation.freeze': true },
      deltaTimeSec: 1 / 60,
    })
    expect(first.offsets.collapseForce).toBeGreaterThanOrEqual(0)
    expect(first.reseedSequence).toBe(11)
    expect(first.freeze).toBe(true)
    expect(runtime.consumedSequence).toBe(12)

    const second = runtime.update({
      events,
      toggleStates: { 'reactiveConstellation.freeze': true },
      deltaTimeSec: 1 / 60,
    })
    expect(second.reseedSequence).toBeNull()
    expect(runtime.consumedSequence).toBe(12)
  })

  it('treats an empty store toggle map as an explicit release', () => {
    const runtime = new ReactiveConstellationPerformanceActionRuntime()
    expect(runtime.update({
      event: event('reactiveConstellation.blackout', 20, true),
      toggleStates: { 'reactiveConstellation.blackout': true },
      deltaTimeSec: 0,
    }).blackout).toBe(true)
    expect(runtime.update({ toggleStates: {}, deltaTimeSec: 0 }).blackout).toBe(false)
  })

  it('keeps attack-hold-release values finite and clamped for unsafe time inputs', () => {
    const envelope = { attackMs: 50, holdMs: 100, releaseMs: 250 }
    const samples = [-100, 0, 25, 50, 150, 275, 400, Number.NaN, Number.POSITIVE_INFINITY]
      .map(age => resolvePerformanceActionEnvelope(age, envelope))
    expect(samples.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true)
    expect(resolvePerformanceActionEnvelope(25, envelope)).toBeCloseTo(0.5)
    expect(resolvePerformanceActionEnvelope(100, envelope)).toBe(1)
    expect(resolvePerformanceActionEnvelope(400, envelope)).toBe(0)
  })
})
