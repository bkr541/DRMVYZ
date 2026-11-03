import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { DataBleedPerformanceController } from './DataBleedPerformanceController'
import { DEFAULT_CANVAS_DATA_BLEED_SETTINGS as defaults, type CanvasDataBleedSettings } from './DataBleedSettings'
function context(time: number, patch: Partial<SharedPerformanceContext> = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, runtimeIdentity: 'track:analysis', trackIdentity: 'track', capabilities: { ...base.capabilities, liveBands: true, sections: true, beatGrid: true, rhythmEvents: true }, confidence: { ...base.confidence, overall: 1, section: 1, semantics: 1, grid: 1, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}
const update = (p: DataBleedPerformanceController, c: SharedPerformanceContext | null, settings: CanvasDataBleedSettings = defaults, paused = false) => p.update({ settings, context: c, timeSec: c?.audioTimeSec ?? 0, deltaSec: 0.05, paused, audioActive: true })
describe('Data Bleed musical modulation', () => {
  it('accepts separate live-input pulses at a stationary file clock using published frame identity', () => {
    const p = new DataBleedPerformanceController()
    update(p, context(0))
    const pulse = (frameId: number) => {
      const c = context(0, { kick: true, kickStrength: 1 })
      c.intelligence = { ...c.intelligence, frame: { ...c.intelligence.frame, frameId } }
      return c
    }
    const first = pulse(1)
    expect(update(p, first).events.kick).not.toBeNull()
    expect(update(p, first).events.kick).toBeNull()
    update(p, context(0))
    expect(update(p, pulse(2)).events.kick).not.toBeNull()
  })
  it('keeps BPM Sync independent of Audio Reactivity and does not manufacture a grid', () => {
    const c = context(2, { bpm: 240, absoluteBeat: 8 })
    const settings = { ...defaults, audioReactivity: 0 }
    const plain = update(new DataBleedPerformanceController(), c, settings)
    const synced = update(new DataBleedPerformanceController(), c, { ...settings, bpmSync: true })
    expect(plain.motionTimeSec).toBe(2); expect(synced.motionTimeSec).toBe(4)
    expect(synced.routing).toEqual({ kick: 0, tear: 0, detail: 0, edge: 0 })
    const fallback = update(new DataBleedPerformanceController(), createSharedPerformanceFallbackContext(2), { ...settings, bpmSync: true })
    expect(fallback.motionTimeSec).toBe(2)
  })
  it('keeps authored mode/settings and source independent of runtime routing', () => {
    const p = new DataBleedPerformanceController(), authored = { ...defaults, flowMode: 'motion' as const }
    const original = JSON.stringify(authored)
    update(p, context(0), authored)
    const active = update(p, context(0.1, { bass: 1, mid: 1, high: 1 }), authored)
    expect(active.settings.flowMode).toBe('motion'); expect(active.settings.amount).toBeGreaterThan(authored.amount)
    expect(active.settings.flowSpeed).toBeGreaterThan(authored.flowSpeed)
    expect(active.routing.detail).toBeGreaterThan(0); expect(active.routing.edge).toBeGreaterThan(0)
    expect(JSON.stringify(authored)).toBe(original)
  })
  it('deduplicates sticky kick/snare/drop events and never invents pulses on seek or first sample', () => {
    const p = new DataBleedPerformanceController()
    expect(update(p, context(0, { kick: true, dropImpact: 1 })).events.kick).toBeNull()
    update(p, context(0.05))
    const c = context(0.1, { kick: true, kickStrength: 1, snare: true, snareStrength: 1, dropImpact: 1 })
    const hit = update(p, c); expect(hit.events.kick).not.toBeNull(); expect(hit.events.snare).not.toBeNull(); expect(hit.events.drop).not.toBeNull()
    expect(hit.routing.kick).toBeGreaterThan(0)
    expect(update(p, c).events).toEqual({ kick: null, snare: null, drop: null })
    const seek = update(p, context(30, { seekDetected: true, kick: true, dropImpact: 1 }))
    expect(seek.reset).toBe(true); expect(seek.events.drop).toBeNull(); expect(seek.routing.kick).toBe(0)
  })
  it('routes intro/build/drop/breakdown with qualified sections and returns neutral at audio response zero', () => {
    const p = new DataBleedPerformanceController(); let last
    for (const [index, sectionType] of ['intro', 'build', 'drop', 'breakdown'].entries()) {
      for (let i = 0; i < 25; i++) last = update(p, context(index * 1.25 + i * 0.05, { sectionType: sectionType as SharedPerformanceContext['sectionType'], sectionProgress: i / 25, buildProgress: sectionType === 'build' ? 0.9 : 0 }))
      if (sectionType === 'intro' || sectionType === 'breakdown') expect(last!.settings.sourceMix).toBeGreaterThan(0.2)
      if (sectionType === 'build') expect(last!.settings.amount).toBeGreaterThan(defaults.amount)
      if (sectionType === 'drop') expect(last!.settings.sourceMix).toBeLessThan(0.05)
    }
    const off = { ...defaults, audioReactivity: 0 }
    expect(update(p, context(5.1, { bass: 1, mid: 1, high: 1, dropImpact: 1 }), off)).toMatchObject({ settings: off, routing: { kick: 0, tear: 0, detail: 0, edge: 0 } })
  })
  it('freezes advancement during pause and authored Freeze, then reconstructs paused small seeks once', () => {
    const p = new DataBleedPerformanceController(); update(p, context(4))
    const held = update(p, context(4), defaults, true), repeated = update(p, context(4), defaults, true)
    expect(repeated.motionTimeSec).toBe(held.motionTimeSec)
    const sought = update(p, context(4.125), defaults, true)
    expect(sought.positionReset).toBe(true); expect(sought.motionTimeSec).toBe(4.125)
    const frozen = { ...defaults, freezeHistory: true }
    const a = update(p, context(4.15), frozen), b = update(p, context(4.2, { dropImpact: 1 }), frozen)
    expect(b.motionTimeSec).toBe(a.motionTimeSec); expect(b.events.drop).toBeNull()
    expect(update(p, context(4.25), defaults).reset).toBe(true)
  })
  it('uses capability fallback and deterministic transport/seed reconstruction without private clocks', () => {
    const a = new DataBleedPerformanceController(), b = new DataBleedPerformanceController()
    const c = createSharedPerformanceFallbackContext(8)
    const s = { ...defaults, bpmSync: true, autoPerformance: true }
    expect(update(a, c, s).settings).toEqual(s)
    expect(update(a, context(3, { seekDetected: true }), s).motionTimeSec).toBe(update(b, context(3), s).motionTimeSec)
    for (const patch of [{ loopWrapDetected: true }, { trackIdentity: 'replacement', trackReplacementDetected: true }, { timingDiscontinuityIdentity: 'new', runtimeIdentity: 'new-runtime' }]) expect(update(a, context(3.1, patch), s).positionReset).toBe(true)
    expect(update(a, context(3.2), { ...s, deterministicSeed: 9 }).positionReset).toBe(true)
  })
})
