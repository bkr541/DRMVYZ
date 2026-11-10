import { describe, expect, it } from 'vitest'
import { XyScopeConversation } from './XyScopeConversation'

const params = { dissolveDepth: 1, answerDelayMs: 50 }

function run(conversation: XyScopeConversation, seconds: number, startSec = 0, step = 1 / 60): number {
  let now = startSec
  const end = startSec + seconds
  while (now < end - 1e-9) { now += step; conversation.update(step, now, params) }
  return now
}

describe('XyScopeConversation', () => {
  it('rings letters left to right on a kick', () => {
    const c = new XyScopeConversation()
    c.reset(4)
    c.push({ type: 'kick', strength: 1 }, 0, params)
    c.update(1 / 60, 0.001, params)
    expect(c.states[0].vibration).toBeGreaterThan(0.5)
    expect(c.states[3].vibration).toBe(0)
    run(c, 0.2, 0.001)
    expect(c.states[3].vibration).toBeGreaterThan(0.1)
    // The wave reached the last letter later than the first.
    expect(c.states[0].vibration).toBeLessThan(0.9)
  })

  it('answers a snare right to left', () => {
    const c = new XyScopeConversation()
    c.reset(4)
    c.push({ type: 'snare', strength: 1 }, 0, params)
    c.update(1 / 60, 0.001, params)
    expect(c.states[3].ripple).toBeGreaterThan(0.5)
    expect(c.states[0].ripple).toBe(0)
  })

  it('keeps kicks and snares to a light fray so the word stays readable', () => {
    const c = new XyScopeConversation()
    c.reset(3)
    for (let i = 0; i < 6; i += 1) {
      c.push({ type: 'kick', strength: 1 }, i * 0.2, params)
      c.push({ type: 'snare', strength: 1 }, i * 0.2 + 0.1, params)
    }
    let peak = 0
    let now = 0
    while (now < 1.4) { now += 1 / 60; c.update(1 / 60, now, params); for (let g = 0; g < 3; g += 1) peak = Math.max(peak, c.dissolve(g)) }
    expect(peak).toBeLessThan(0.2)
  })

  it('never frays with zero depth, and ignores zero-strength events', () => {
    const c = new XyScopeConversation()
    c.reset(3)
    const flat = { dissolveDepth: 0, answerDelayMs: 0 }
    c.push({ type: 'snare', strength: 1 }, 0, flat)
    c.update(1 / 60, 0.1, flat)
    expect(c.dissolve(0) + c.dissolve(1) + c.dissolve(2)).toBe(0)
    c.reset(3)
    c.push({ type: 'kick', strength: 0 }, 0, params)
    c.update(1 / 60, 0.1, params)
    expect(c.states[0].vibration).toBe(0)
  })

  it('settles every effect to rest and resets cleanly', () => {
    const c = new XyScopeConversation()
    c.reset(3)
    c.push({ type: 'kick', strength: 1 }, 0, params)
    c.push({ type: 'snare', strength: 1 }, 0.1, params)
    run(c, 4)
    for (const state of c.states) {
      expect(state.dissolveHit).toBe(0)
      expect(state.flash).toBeLessThan(1e-3)
      expect(state.vibration).toBeLessThan(1e-3)
    }
    c.push({ type: 'snare', strength: 1 }, 5, params)
    c.reset(2)
    expect(c.states).toHaveLength(2)
    c.update(1 / 60, 6, params)
    expect(c.dissolve(0)).toBe(0)
  })

  it('bounds the pending queue', () => {
    const c = new XyScopeConversation()
    c.reset(8)
    for (let i = 0; i < 400; i += 1) c.push({ type: 'kick', strength: 1 }, 1000 + i, params)
    c.update(1 / 60, 0, params)
    expect((c as unknown as { pending: unknown[] }).pending.length).toBeLessThanOrEqual(512)
  })
})
