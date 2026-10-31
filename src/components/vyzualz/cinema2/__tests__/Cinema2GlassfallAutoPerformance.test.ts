import { describe, it, expect } from 'vitest'
import { GlassfallAutoPerformance, type GlassfallAutoInput } from '../modules/glassfall/Cinema2GlassfallAutoPerformance'
const base: GlassfallAutoInput = { base: 'glassfall', editRevision: 0, enabled: true, playing: true, reset: false, time: 0, buildId: null, dropId: null }
describe('GLASSFALL Auto Performance authority', () => {
  it('allows bounded overrides and restores the currently progressed base', () => {
    const auto = new GlassfallAutoPerformance()
    auto.update({ ...base, reset: true })
    expect(auto.update({ ...base, time: .1, buildId: 'build' })).toBe('darkWindows')
    expect(auto.update({ ...base, time: .2, buildId: 'build', base: 'cascade' })).toBe('darkWindows')
    expect(auto.update({ ...base, time: .4, base: 'splitCurrent' })).toBe('splitCurrent')
    expect(auto.update({ ...base, time: .5, dropId: 'drop' })).toBe('prismRelay')
    expect(auto.update({ ...base, time: 1.8, base: 'cascade' })).toBe('cascade')
  })
  it('gives manual edits immediate authority and rejects the same active moment', () => {
    const auto = new GlassfallAutoPerformance(); auto.update(base)
    auto.update({ ...base, buildId: 'build' })
    const edit = { ...base, base: 'prismTrace' as const, editRevision: 1, buildId: 'build' }
    expect(auto.update(edit)).toBe('prismTrace'); expect(auto.update(edit)).toBe('prismTrace')
    expect(auto.update({ ...edit, dropId: 'fresh-drop' })).toBe('prismRelay')
    expect(auto.update({ ...edit, enabled: false })).toBe('prismTrace')
  })
  it('caps a held build, watermarks paused events and primes reset/enable', () => {
    const auto = new GlassfallAutoPerformance(); auto.update(base)
    expect(auto.update({ ...base, time: .1, buildId: 'build' })).toBe('darkWindows')
    expect(auto.update({ ...base, time: 4.2, buildId: 'build' })).toBe('glassfall')
    expect(auto.update({ ...base, dropId: 'paused', playing: false })).toBe('glassfall')
    expect(auto.update({ ...base, dropId: 'paused' })).toBe('glassfall')
    expect(auto.update({ ...base, reset: true, buildId: 'held' })).toBe('glassfall')
  })
})
