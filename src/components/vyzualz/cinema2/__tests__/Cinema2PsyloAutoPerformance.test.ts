import { describe, expect, it } from 'vitest'
import { psyloChoreographyHarness } from '../../../../test/support/PsyloChoreographyHarness'
import { Cinema2PsyloAutoPerformance } from '../modules/psylo/Cinema2PsyloAutoPerformance'
import { PsyloPatternController } from '../modules/psylo/Cinema2PsyloAudio'
import type { PsyloFixtureOptions } from '../../../../test/support/PsyloMusicFixture'
function harness() {
  const h = psyloChoreographyHarness(true), auto = new Cinema2PsyloAutoPerformance()
  let time: number | null = null
  const update = (beats: number, o: Partial<PsyloFixtureOptions> = {}, opts: { enabled?: boolean; manual?: boolean; base?: number; latch?: boolean; paused?: boolean; missing?: boolean } = {}) => {
    const { frame } = h.publish(o)
    if (opts.paused) frame.transport = { ...frame.transport!, paused: true, playing: false }
    if (opts.missing) { frame.audio = null; frame.director = null }
    const result = auto.update({ frame, base: opts.base ?? 0, enabled: opts.enabled ?? true, manual: opts.manual ?? false,
      reset: frame.audio?.discontinuity.occurred ?? false, latch: opts.latch ?? false, beats, previousTime: time })
    time = frame.transport!.timeSec; return result
  }
  return { update }
}
describe('PSYLO scoped Auto Performance', () => {
  it('latches enabling/activation and permits only a subsequent build episode', () => {
    const { update } = harness()
    expect(update(0, { build: 1 }, { enabled: false }).kind).toBeNull()
    expect(update(1, { build: 1 }).kind).toBeNull()
    update(2)
    expect(update(3, { build: 1 }).pattern).toBe(3)
    expect(update(11, { build: 1 }, { base: 5 }).pattern).toBe(5)
    expect(update(12, { build: 1 }).kind).toBeNull()
  })
  it('restores the independently advanced base after four beats of drop override', () => {
    const { update } = harness(), base = new PsyloPatternController()
    update(0); base.update(0, true, 'kick', null, 0, true, false)
    expect(update(1, { event: 'drop', eventId: 5 }).pattern).toBe(7)
    const next = base.update(0, true, 'kick', 'a', 0, false, false)
    expect(update(2, {}, { base: next }).pattern).toBe(7)
    const current = base.update(0, true, 'kick', 'b', 0, false, false)
    expect(update(5, {}, { base: current }).pattern).toBe(2)
    expect(update(6, { event: 'drop', eventId: 5 }).kind).toBeNull()
  })
  it('manual edits/reselection cancel current moments without disabling permission or replaying them', () => {
    const { update } = harness(); update(0); update(1, { build: 1 })
    expect(update(2, { build: 1 }, { manual: true, base: 5 })).toMatchObject({ pattern: 5, kind: null, immediate: true })
    expect(update(3, { build: 1 }, { base: 5 }).pattern).toBe(5)
    expect(update(4, { event: 'drop', eventId: 1 }, { manual: true, base: 5 }).pattern).toBe(5)
    expect(update(5, { event: 'drop', eventId: 1 }, { base: 5 }).pattern).toBe(5)
    expect(update(6, { event: 'drop', eventId: 2 }, { base: 5 }).pattern).toBe(7)
  })
  it('holds an override through the actual host pause gate and clears on missing playing audio/resume latches', () => {
    const { update } = harness(); update(0); update(1, { event: 'drop', eventId: 1 })
    expect(update(1, {}, { paused: true, missing: true }).pattern).toBe(7)
    expect(update(2, { event: 'drop', eventId: 2 }, { latch: true }).kind).toBe('drop')
    expect(update(3, { event: 'drop', eventId: 3 }).pattern).toBe(7)
    expect(update(4, {}, { missing: true }).kind).toBeNull()
  })
  it('OFF, seek, track and refresh reset presentation immediately and latch active moments', () => {
    const { update } = harness(); update(0); update(1, { build: 1 })
    expect(update(2, { build: 1 }, { enabled: false, base: 4 })).toMatchObject({ pattern: 4, immediate: true })
    expect(update(3, { build: 1 }).kind).toBeNull()
    expect(update(0, { timeSec: 0, event: 'drop', eventId: 5 }).kind).toBeNull()
    expect(update(1, { trackId: 'other', build: 1 }).kind).toBeNull()
    expect(update(2, { build: 1 }, { latch: true }).kind).toBeNull()
  })
})
