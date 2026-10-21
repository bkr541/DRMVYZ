import { describe, expect, it } from 'vitest'
import {
  BWC_AUTO_BUILD_MAX_BEATS,
  BWC_AUTO_BUILD_OFF,
  BWC_AUTO_BUILD_ON,
  BWC_AUTO_BUILD_PATTERN,
  BWC_AUTO_DROP_BEATS,
  BWC_AUTO_DROP_PATTERN,
  Cinema2BwcAutoPerformance,
  type Cinema2BwcAutoPerformanceInput,
} from '../modules/bwc/Cinema2BwcAutoPerformance'

const idle: Cinema2BwcAutoPerformanceInput = { enabled: true, absoluteBeat: 0, buildCharge: 0, dropEventId: null, patternEdited: false, reset: false }
const step = (controller: Cinema2BwcAutoPerformance, beat: number, change: Partial<Cinema2BwcAutoPerformanceInput> = {}) => controller.update({ ...idle, absoluteBeat: beat, ...change })

describe('BWC Auto Performance', () => {
  it('puts Surge and Core Burst on stage for builds and drops, and nothing otherwise', () => {
    expect(BWC_AUTO_BUILD_PATTERN).toBe('surge')
    expect(BWC_AUTO_DROP_PATTERN).toBe('core-burst')
    expect(step(new Cinema2BwcAutoPerformance(), 4)).toMatchObject({ pattern: null, reason: null })
  })

  describe('a buildup', () => {
    it('takes Surge when a confident buildup starts to charge, and gives the stage back when it ends', () => {
      const c = new Cinema2BwcAutoPerformance()
      expect(step(c, 1, { buildCharge: BWC_AUTO_BUILD_ON - 0.01 }).pattern).toBeNull()
      expect(step(c, 2, { buildCharge: BWC_AUTO_BUILD_ON })).toMatchObject({ pattern: 'surge', reason: 'build', startBeat: 2 })
      expect(step(c, 5, { buildCharge: 0.6 })).toMatchObject({ pattern: 'surge', startBeat: 2 })
      expect(step(c, 9, { buildCharge: BWC_AUTO_BUILD_OFF - 0.01 }).pattern).toBeNull()
    })

    it('does not flap: it holds between the on and off thresholds and needs the charge to fall away before it can begin again', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 1, { buildCharge: 0.5 })
      expect(step(c, 2, { buildCharge: 0.08 }).pattern).toBe('surge')
      expect(step(c, 3, { buildCharge: 0.01 }).pattern).toBeNull()
      expect(step(c, 4, { buildCharge: 0.08 }).pattern).toBeNull()
      expect(step(c, 5, { buildCharge: 0.3 }).pattern).toBe('surge')
    })

    it('is bounded: after the maximum it hands back, and a build that never ends does not take the stage again', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 0, { buildCharge: 0.5 })
      expect(step(c, BWC_AUTO_BUILD_MAX_BEATS - 1, { buildCharge: 0.5 }).pattern).toBe('surge')
      expect(step(c, BWC_AUTO_BUILD_MAX_BEATS, { buildCharge: 0.5 }).pattern).toBeNull()
      expect(step(c, BWC_AUTO_BUILD_MAX_BEATS + 8, { buildCharge: 0.5 }).pattern).toBeNull()
      step(c, BWC_AUTO_BUILD_MAX_BEATS + 9, { buildCharge: 0 })
      expect(step(c, BWC_AUTO_BUILD_MAX_BEATS + 10, { buildCharge: 0.5 }).pattern).toBe('surge')
    })
  })

  describe('a drop', () => {
    it('takes Core Burst from the drop for two bars, then gives the stage back', () => {
      const c = new Cinema2BwcAutoPerformance()
      expect(step(c, 10, { dropEventId: 'drop:1' })).toMatchObject({ pattern: 'core-burst', reason: 'drop', startBeat: 10 })
      expect(step(c, 10 + BWC_AUTO_DROP_BEATS - 0.5).pattern).toBe('core-burst')
      expect(step(c, 10 + BWC_AUTO_DROP_BEATS).pattern).toBeNull()
    })

    it('uses each drop once: a repeated identity does not restart it, a new one does', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 10, { dropEventId: 'drop:1' })
      expect(step(c, 12, { dropEventId: 'drop:1' }).startBeat).toBe(10)
      expect(step(c, 30, { dropEventId: 'drop:1' }).pattern).toBeNull()
      expect(step(c, 40, { dropEventId: 'drop:2' })).toMatchObject({ pattern: 'core-burst', startBeat: 40 })
    })

    it('takes the stage from a buildup that it ends, and that buildup does not come back after the drop', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 1, { buildCharge: 0.7 })
      expect(step(c, 6, { buildCharge: 0.9, dropEventId: 'drop:1' }).pattern).toBe('core-burst')
      expect(step(c, 6 + BWC_AUTO_DROP_BEATS, { buildCharge: 0.5 }).pattern).toBeNull()
      expect(step(c, 20, { buildCharge: 0.5 }).pattern).toBeNull()
    })
  })

  describe('manual authority', () => {
    it('ends an override the moment the Pattern is edited, and the same buildup or drop does not take it back', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 1, { buildCharge: 0.6 })
      expect(step(c, 2, { buildCharge: 0.6, patternEdited: true }).pattern).toBeNull()
      expect(step(c, 3, { buildCharge: 0.6 }).pattern).toBeNull()
      const d = new Cinema2BwcAutoPerformance()
      step(d, 10, { dropEventId: 'drop:1' })
      expect(step(d, 11, { patternEdited: true }).pattern).toBeNull()
      expect(step(d, 12, { dropEventId: 'drop:1' }).pattern).toBeNull()
    })

    it('lets the next separately qualifying event override again', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 1, { buildCharge: 0.6 })
      step(c, 2, { buildCharge: 0.6, patternEdited: true })
      expect(step(c, 5, { dropEventId: 'drop:9' }).pattern).toBe('core-burst')
      const d = new Cinema2BwcAutoPerformance()
      step(d, 1, { buildCharge: 0.6 })
      step(d, 2, { buildCharge: 0.6, patternEdited: true })
      step(d, 3, { buildCharge: 0 })
      expect(step(d, 4, { buildCharge: 0.6 }).pattern).toBe('surge')
    })

    it('does not let an edit and a drop on the same frame override the edit, and the drop is not replayed afterwards', () => {
      const c = new Cinema2BwcAutoPerformance()
      expect(step(c, 10, { dropEventId: 'drop:1', patternEdited: true }).pattern).toBeNull()
      expect(step(c, 11, { dropEventId: 'drop:1' }).pattern).toBeNull()
    })

    it('does nothing while disabled, ends an override when turned off, and does not take a buildup already under way when turned on', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 1, { buildCharge: 0.6 })
      expect(step(c, 2, { buildCharge: 0.6, enabled: false }).pattern).toBeNull()
      expect(step(c, 3, { dropEventId: 'drop:1', buildCharge: 0.6, enabled: false }).pattern).toBeNull()
      expect(step(c, 4, { buildCharge: 0.6 }).pattern).toBeNull()
      // Neither the old drop nor the buildup in progress is replayed on enabling; the next ones are.
      expect(step(c, 5, { dropEventId: 'drop:1', buildCharge: 0.6 }).pattern).toBeNull()
      step(c, 6, { buildCharge: 0 })
      expect(step(c, 7, { buildCharge: 0.6 }).pattern).toBe('surge')
    })
  })

  describe('resets', () => {
    it('clears everything on a discontinuity, so an old drop identity may fire again in a new playback', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 10, { dropEventId: 'drop:1' })
      expect(step(c, 2, { reset: true }).pattern).toBeNull()
      expect(step(c, 3, { dropEventId: 'drop:1' }).pattern).toBe('core-burst')
    })

    it('drops a stale override when the beat clock runs backward, and survives hostile input', () => {
      const c = new Cinema2BwcAutoPerformance()
      step(c, 50, { dropEventId: 'drop:1' })
      expect(step(c, 3).pattern).toBeNull()
      expect(() => step(c, Number.NaN, { buildCharge: Number.NaN })).not.toThrow()
      expect(() => step(c, -5, { buildCharge: 7 })).not.toThrow()
      c.reset()
      expect(step(c, 1).pattern).toBeNull()
    })
  })
})
