import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../features/performanceCore'
import { TEXT_V2_IDLE_PLAN } from './XyScopeTextV2Plan'
import { XyScopeTextV2Trajectory } from './XyScopeTextV2Trajectory'
import { TEXT_V2_MANUAL_CONTROLS, type TextV2PerformanceFrame } from './XyScopeTextV2Performance'
function performance(event: string | null = null): TextV2PerformanceFrame {
  return { controls: { ...TEXT_V2_MANUAL_CONTROLS }, weights: new Float32Array([1, 0, 0, 0, 0]), style: 'contour', state: 'Groove', level: .8, bass: .7, mid: .5, high: .4, impact: .4, amount: 1, phase: 1, scanPhase: .2, wordEventId: event, variation: 1, plan: { ...TEXT_V2_IDLE_PLAN } }
}
function beat(index: number) {
  const c = createSharedPerformanceFallbackContext(index * .5)
  c.bpm = 120; c.beatIndex = index; c.energy = .8; c.confidence.rhythm = .9; c.boundaries.beatBoundary = true
  return c
}
describe('Text V2 lettering / oscillator lifecycle', () => {
  it('queues the new word until lettering has completely become the oscillator', () => {
    const conductor = new XyScopeTextV2Trajectory()
    let step = conductor.update(performance('phrase:1'), beat(0), true, true, 1 / 60)
    expect(step.phase).toBe('depart'); expect(step.commitWordEvent).toBeNull()
    for (let i = 0; i < 50; i++) {
      step = conductor.update(performance(), null, false, true, 1 / 60)
      if (step.commitWordEvent) { expect(step.morph).toBe(1); expect(step.phase).toBe('formation'); break }
      expect(step.commitWordEvent).toBeNull()
    }
    expect(step.commitWordEvent).toBe('phrase:1')
    expect(conductor.update(performance(), null, false, true, 1 / 60).commitWordEvent).toBeNull()
  })
  it('holds a fully non-text formation until a musical return cue and then reforms', () => {
    const conductor = new XyScopeTextV2Trajectory()
    let step = conductor.update(performance(), beat(0), true, true, 1 / 60)
    for (let i = 0; i < 400; i++) step = conductor.update(performance(), null, false, true, .05)
    expect(step).toMatchObject({ phase: 'formation', morph: 1 })
    step = conductor.update(performance(), beat(1), true, true, 1 / 60)
    expect(step.phase).toBe('formation')
    step = conductor.update({ ...performance(), plan: { ...TEXT_V2_IDLE_PLAN, id: 'release:1', intent: 'reform' } }, beat(2), true, true, 1 / 60)
    expect(step.phase).toBe('reform')
    for (let i = 0; i < 60; i++) step = conductor.update(performance(), null, false, true, 1 / 60)
    expect(step).toMatchObject({ phase: 'word', morph: 0 })
  })
  it('can form a different word while fully in a formation without restarting the path', () => {
    const conductor = new XyScopeTextV2Trajectory()
    for (let i = 0; i < 80; i++) conductor.update(performance(), null, false, true, 1 / 60)
    const step = conductor.update(performance('section:new'), beat(4), true, true, 1 / 60)
    expect(step.morph).toBe(1); expect(step.commitWordEvent).toBe('section:new')
  })
  it('returns the current word on pause without committing a queued change, and clears stale seek cues', () => {
    const conductor = new XyScopeTextV2Trajectory()
    conductor.update(performance('phrase:1'), beat(0), true, true, .016)
    for (let i = 0; i < 10; i++) conductor.update(performance(), null, false, true, .016)
    let step = conductor.update(performance(), null, false, false, .016)
    for (let i = 0; i < 30; i++) {
      step = conductor.update(performance(), null, false, false, .016)
      expect(step.commitWordEvent).toBeNull()
    }
    expect(step).toMatchObject({ phase: 'word', morph: 0 })
    const seek = beat(50); seek.seekDetected = true
    expect(conductor.update(performance('phrase:seek'), seek, true, true, .016)).toMatchObject({ phase: 'word', morph: 0, commitWordEvent: null })
  })
})
