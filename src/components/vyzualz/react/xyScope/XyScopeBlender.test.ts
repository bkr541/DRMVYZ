import { describe, expect, it } from 'vitest'
import { XyScopeBlender } from './XyScopeBlender'
import { xyScopePatternIndex } from './XyScopePatterns'

function run(blender: XyScopeBlender, seconds: number, startSec = 0, duration = 0.6, step = 1 / 60): number {
  let now = startSec
  const end = startSec + seconds
  while (now < end - 1e-9) { now += step; blender.update(step, now, duration) }
  return now
}

const w = (blender: XyScopeBlender, glyph: number, pattern: Parameters<typeof xyScopePatternIndex>[0]) => blender.weights[glyph][xyScopePatternIndex(pattern)]

describe('XyScopeBlender', () => {
  it('starts every letter fully in the given pattern', () => {
    const b = new XyScopeBlender()
    b.reset(4, 'word')
    for (let g = 0; g < 4; g += 1) expect(w(b, g, 'word')).toBe(1)
  })

  it('carries a change across the word letter by letter, left to right', () => {
    const b = new XyScopeBlender()
    b.reset(4, 'word')
    b.setTarget('ring', 0, 100, false)
    run(b, 0.15)
    expect(w(b, 0, 'ring')).toBeGreaterThan(0.3)
    expect(w(b, 3, 'ring')).toBe(0) // the last letter has not started: it waits 300 ms
    run(b, 1.2, 0.15)
    for (let g = 0; g < 4; g += 1) expect(w(b, g, 'ring')).toBeGreaterThan(0.97)
  })

  it('takes about the Transition Length to land', () => {
    const fast = new XyScopeBlender()
    fast.reset(1, 'word')
    fast.setTarget('weave', 0, 0, false)
    run(fast, 0.3, 0, 0.3)
    const slow = new XyScopeBlender()
    slow.reset(1, 'word')
    slow.setTarget('weave', 0, 0, false)
    run(slow, 0.3, 0, 2)
    expect(w(fast, 0, 'weave')).toBeGreaterThan(0.9)
    expect(w(slow, 0, 'weave')).toBeLessThan(0.5)
  })

  it('snaps at once when asked (Motion Amount zero)', () => {
    const b = new XyScopeBlender()
    b.reset(3, 'word')
    b.setTarget('rosette', 0, 80, true)
    for (let g = 0; g < 3; g += 1) { expect(w(b, g, 'rosette')).toBe(1); expect(w(b, g, 'word')).toBe(0) }
  })

  it('never pops when a change is interrupted: weights stay continuous and sum to one', () => {
    const b = new XyScopeBlender()
    b.reset(2, 'word')
    b.setTarget('ring', 0, 40, false)
    let now = run(b, 0.12)
    const before = Array.from(b.weights[0])
    b.setTarget('pinwheel', now, 40, false)
    b.update(1 / 60, now + 1 / 60, 0.6)
    now += 1 / 60
    const after = Array.from(b.weights[0])
    for (let p = 0; p < before.length; p += 1) expect(Math.abs(after[p] - before[p])).toBeLessThan(0.2)
    for (let g = 0; g < 2; g += 1) expect(Array.from(b.weights[g]).reduce((a, c) => a + c, 0)).toBeCloseTo(1, 4)
    run(b, 1.5, now)
    expect(w(b, 0, 'pinwheel')).toBeGreaterThan(0.97)
    expect(w(b, 0, 'ring')).toBe(0)
  })

  it('returns to the letters and ends fully crisp', () => {
    const b = new XyScopeBlender()
    b.reset(3, 'word')
    b.setTarget('scope', 0, 50, false)
    let now = run(b, 1.5)
    b.setTarget('word', now, 50, false)
    now = run(b, 1.5, now)
    for (let g = 0; g < 3; g += 1) expect(w(b, g, 'word')).toBeGreaterThan(0.99)
    expect(b.targetOf(0)).toBe('word')
    expect(b.targetOf(9)).toBeNull()
  })

  it('bounds its queue', () => {
    const b = new XyScopeBlender()
    b.reset(32, 'word')
    for (let i = 0; i < 40; i += 1) b.setTarget(i % 2 ? 'ring' : 'weave', 1000 + i, 100, false)
    expect((b as unknown as { pending: unknown[] }).pending.length).toBeLessThanOrEqual(256)
  })
})
