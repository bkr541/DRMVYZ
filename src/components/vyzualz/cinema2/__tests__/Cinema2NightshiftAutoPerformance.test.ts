import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2NightshiftAutoPerformance } from '../modules/nightshift/Cinema2NightshiftAutoPerformance'
import { NightshiftPatternController, type NightshiftPattern } from '../modules/nightshift/Cinema2NightshiftDomain'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { nightshiftMusicFixture, type NightshiftFixtureOptions } from '../../../../test/support/NightshiftMusicFixture'

function harness() {
  let sequence = 1, previousTime: number | null = null
  let upstream = nightshiftMusicFixture({ timeSec: 0, frameId: 1 })
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publisherId: 'nightshift-auto-test', kind: 'frame', publishedAtMs: 0 }) })
  const director = new Cinema2VisualDirector(), performance = new Cinema2NightshiftAutoPerformance()
  const update = (beats: number, o: Partial<NightshiftFixtureOptions> = {}, opts: { enabled?: boolean; manual?: boolean; paused?: boolean; base?: NightshiftPattern; absent?: boolean } = {}) => {
    upstream = nightshiftMusicFixture({ timeSec: sequence / 10, frameId: ++sequence, ...o })
    const audio = bridge.capture(sequence)
    const frame: Cinema2ModuleFrameReadContext = { frameId: sequence, timestampMs: upstream.timeSec * 1000, elapsedTimeSec: upstream.timeSec,
      deltaTimeSec: opts.paused ? 0 : .1, viewport: { width: 1280, height: 720, dpr: 1 }, contextGeneration: 1,
      audio: opts.absent ? null : audio, director: director.capture(audio),
      transport: { sourcePresent: !opts.absent, playing: !opts.paused, analysisActive: !opts.absent, paused: opts.paused ?? false,
        animationActive: !opts.paused, trackId: upstream.trackId, timeSec: upstream.timeSec } }
    const value = performance.update({ frame, base: opts.base ?? 'nightshift', enabled: opts.enabled ?? true,
      manual: opts.manual ?? false, reset: audio.discontinuity.occurred, beats, previousTime })
    previousTime = upstream.timeSec
    return value
  }
  return { update }
}

describe('NIGHTSHIFT scoped Auto Performance', () => {
  it('defaults to no override and latches a build already active when enabled', () => {
    const { update } = harness()
    expect(update(0, {}, { enabled: false }).pattern).toBe('nightshift')
    expect(update(1, { build: 1 }, { enabled: false }).kind).toBeNull()
    expect(update(2, { build: 1 }).kind).toBeNull()
    expect(update(3, { build: 1 }).kind).toBeNull()
    update(4)
    expect(update(5, { build: 1 }).pattern).toBe('diagonal-relay')
  })

  it('ends a build when meaning ends or eight clock beats elapse, without reusing the active build', () => {
    const { update } = harness()
    update(0)
    expect(update(1, { build: 1 }).pattern).toBe('diagonal-relay')
    expect(update(8.99, { build: 1 }).kind).toBe('build')
    expect(update(9, { build: 1 }, { base: 'runway' }).pattern).toBe('runway')
    expect(update(10, { build: 1 }).kind).toBeNull()
    update(11)
    expect(update(12, { build: 1 }).kind).toBe('build')
    expect(update(13, {}, { base: 'diamond-ripple' }).pattern).toBe('diamond-ripple')
  })

  it('gives a fresh drop priority for four beats and never replays a duplicate semantic identity', () => {
    const { update } = harness()
    update(0)
    update(1, { build: 1 })
    expect(update(2, { build: 1, event: 'drop', eventId: 1 }).pattern).toBe('full-house')
    expect(update(5.9, { build: 1 }).kind).toBe('drop')
    expect(update(6, { build: 1 }, { base: 'runway' }).pattern).toBe('runway')
    expect(update(7, { build: 1, event: 'drop', eventId: 1 }).kind).toBeNull()
    expect(update(8, { event: 'drop', eventId: 2 }).kind).toBe('drop')
    expect(update(12).kind).toBeNull()
    expect(update(13, { event: 'drop', eventId: 3, eventTime: 0 }).kind).toBeNull()
  })

  it('manual reselect cancels and consumes current build/drop while permitting a separate future event', () => {
    const { update } = harness()
    update(0)
    update(1, { build: 1 })
    expect(update(2, { build: 1 }, { manual: true })).toMatchObject({ pattern: 'nightshift', kind: null, immediate: true })
    expect(update(3, { build: 1 }).kind).toBeNull()
    expect(update(4, { build: 1, event: 'drop', eventId: 1 }, { manual: true }).kind).toBeNull()
    expect(update(5, { build: 1, event: 'drop', eventId: 1 }).kind).toBeNull()
    expect(update(6, { build: 1, event: 'drop', eventId: 2 }).kind).toBe('drop')
  })

  it('keeps base progression independent behind overrides and restores the latest base', () => {
    const { update } = harness(), base = new NightshiftPatternController()
    let selected = base.update('nightshift', true, 'kick', null, 0, true)
    update(0, {}, { base: selected })
    update(1, { event: 'drop', eventId: 1 }, { base: selected })
    selected = base.update('nightshift', true, 'kick', 'kick-a', 0, false)
    expect(update(2, {}, { base: selected }).pattern).toBe('full-house')
    selected = base.update('nightshift', true, 'kick', 'kick-b', 0, false)
    expect(update(5, {}, { base: selected }).pattern).toBe('runway')
  })

  it('OFF restores immediately and cannot rearm the same build by toggling ON', () => {
    const { update } = harness()
    update(0)
    update(1, { build: 1 })
    expect(update(2, { build: 1 }, { enabled: false, base: 'runway' })).toMatchObject({ pattern: 'runway', immediate: true })
    expect(update(3, { build: 1 }).kind).toBeNull()
    expect(update(4, { build: 1 }).kind).toBeNull()
  })

  it('holds on pause, consumes paused drop identities and resumes with the existing budget', () => {
    const { update } = harness()
    update(0)
    update(1, { event: 'drop', eventId: 1 })
    expect(update(10, { event: 'drop', eventId: 2 }, { paused: true }).kind).toBe('drop')
    expect(update(2, { event: 'drop', eventId: 2 }).kind).toBe('drop')
    expect(update(5).kind).toBeNull()
    expect(update(6, { event: 'drop', eventId: 2 }).kind).toBeNull()
  })

  it('clears and latches on seek, track changes, missing audio and fresh activation', () => {
    const { update } = harness()
    expect(update(0, { build: 1 }).kind).toBeNull()
    update(1)
    update(2, { event: 'drop', eventId: 1 })
    expect(update(0, { timeSec: 0, event: 'drop', eventId: 2 }).kind).toBeNull()
    expect(update(1, { timeSec: .1, trackId: 'other-track', build: 1 }).kind).toBeNull()
    expect(update(2, {}, { absent: true }).kind).toBeNull()
  })
})
