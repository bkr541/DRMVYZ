import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { deriveXyScopeEvents } from './XyScopeEvents'

const params = { audioReactivity: 1, phraseDissolve: true, phraseLength: 'bar4' as const, dropDissolve: true }

type ContextOverrides = Omit<Partial<SharedPerformanceContext>, 'boundaries'> & { boundaries?: Partial<SharedPerformanceContext['boundaries']> }

function context(overrides: ContextOverrides = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(10)
  const { boundaries, ...rest } = overrides
  return { ...base, ...rest, boundaries: { ...base.boundaries, ...boundaries } }
}

describe('deriveXyScopeEvents', () => {
  it('produces nothing with no context or no hits', () => {
    expect(deriveXyScopeEvents(null, null, params).events).toEqual([])
    expect(deriveXyScopeEvents(context(), null, params).events).toEqual([])
  })

  it('maps kicks and snares with their strengths', () => {
    const { events } = deriveXyScopeEvents(context({ kick: true, kickStrength: 0.8, snare: true, snareStrength: 0.4 }), null, params)
    expect(events).toEqual([{ type: 'kick', strength: 0.8 }, { type: 'snare', strength: 0.4 }])
  })

  it('scales strength by Audio Reactivity and emits nothing at zero', () => {
    const hit = context({ kick: true, kickStrength: 1 })
    expect(deriveXyScopeEvents(hit, null, { ...params, audioReactivity: 0.5 }).events[0].strength).toBe(0.5)
    expect(deriveXyScopeEvents(hit, null, { ...params, audioReactivity: 0 }).events).toEqual([])
  })

  it('dissolves on the chosen phrase length only, counting plain bars when no sections are analysed', () => {
    const fourBar = context({ boundaries: { fourBarBoundary: true } })
    expect(deriveXyScopeEvents(fourBar, null, params).events.map(e => e.type)).toEqual(['phrase'])
    expect(deriveXyScopeEvents(fourBar, null, { ...params, phraseLength: 'bar8' }).events).toEqual([])
    const eight = context({ boundaries: { eightBarBoundary: true } })
    expect(deriveXyScopeEvents(eight, null, { ...params, phraseLength: 'bar8' }).events.map(e => e.type)).toEqual(['phrase'])
    const sixteen = context({ boundaries: { sixteenBarBoundary: true } })
    expect(deriveXyScopeEvents(sixteen, null, { ...params, phraseLength: 'bar16' }).events.map(e => e.type)).toEqual(['phrase'])
    expect(deriveXyScopeEvents(fourBar, null, { ...params, phraseDissolve: false }).events).toEqual([])
  })

  it('aligns phrases to section starts when the track has analysed sections', () => {
    const section = { id: 's1' } as unknown as NonNullable<SharedPerformanceContext['resolvedMacroSection']>
    const aligned = context({ resolvedMacroSection: section, boundaries: { performanceFourBarBoundary: true } })
    expect(deriveXyScopeEvents(aligned, null, params).events.map(e => e.type)).toEqual(['phrase'])
    // The raw bar grid is ignored once sections decide where phrases start.
    const rawOnly = context({ resolvedMacroSection: section, boundaries: { fourBarBoundary: true } })
    expect(deriveXyScopeEvents(rawOnly, null, params).events).toEqual([])
  })

  it('dissolves on a new drop and counts a phrase boundary plus a drop on one frame once', () => {
    const before = context({ dropOccurrence: 1 })
    const drop = context({ dropOccurrence: 2 })
    expect(deriveXyScopeEvents(drop, before, params).events.map(e => e.type)).toEqual(['phrase'])
    expect(deriveXyScopeEvents(drop, before, { ...params, dropDissolve: false }).events).toEqual([])
    expect(deriveXyScopeEvents(drop, null, params).events).toEqual([])
    const both = context({ dropOccurrence: 2, boundaries: { fourBarBoundary: true } })
    expect(deriveXyScopeEvents(both, before, params).events.filter(e => e.type === 'phrase')).toHaveLength(1)
  })

  it('reports a seek, loop wrap or track change as a discontinuity without events', () => {
    for (const key of ['seekDetected', 'loopWrapDetected', 'trackReplacementDetected'] as const) {
      const result = deriveXyScopeEvents(context({ [key]: true, kick: true, kickStrength: 1 }), null, params)
      expect(result.discontinuity).toBe(true)
      expect(result.events).toEqual([])
    }
  })
})
