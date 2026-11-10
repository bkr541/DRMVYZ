import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../../cinema2/modules/Cinema2AfterhoursNativeModule'
import { deriveXyScopeEvents, hasXyScopeDiscontinuity, resolveXyScopeTriggerEventId } from './XyScopeEvents'

type ContextOverrides = Omit<Partial<SharedPerformanceContext>, 'boundaries'> & { boundaries?: Partial<SharedPerformanceContext['boundaries']> }

function context(overrides: ContextOverrides = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(10)
  const { boundaries, ...rest } = overrides
  return { ...base, ...rest, boundaries: { ...base.boundaries, ...boundaries } }
}

describe('deriveXyScopeEvents (kick and snare hits)', () => {
  it('produces nothing with no context or no hits', () => {
    expect(deriveXyScopeEvents(null, { audioReactivity: 1 }).events).toEqual([])
    expect(deriveXyScopeEvents(context(), { audioReactivity: 1 }).events).toEqual([])
  })

  it('maps kicks and snares with their strengths', () => {
    const { events } = deriveXyScopeEvents(context({ kick: true, kickStrength: 0.8, snare: true, snareStrength: 0.4 }), { audioReactivity: 1 })
    expect(events).toEqual([{ type: 'kick', strength: 0.8 }, { type: 'snare', strength: 0.4 }])
  })

  it('scales strength by Audio Reactivity and emits nothing at zero', () => {
    const hit = context({ kick: true, kickStrength: 1 })
    expect(deriveXyScopeEvents(hit, { audioReactivity: 0.5 }).events[0].strength).toBe(0.5)
    expect(deriveXyScopeEvents(hit, { audioReactivity: 0 }).events).toEqual([])
  })

  it('reports a seek, loop wrap or track change as a discontinuity without hits', () => {
    for (const key of ['seekDetected', 'loopWrapDetected', 'trackReplacementDetected'] as const) {
      const c = context({ [key]: true, kick: true, kickStrength: 1 })
      expect(hasXyScopeDiscontinuity(c)).toBe(true)
      const result = deriveXyScopeEvents(c, { audioReactivity: 1 })
      expect(result.discontinuity).toBe(true)
      expect(result.events).toEqual([])
    }
  })
})

describe('resolveXyScopeTriggerEventId (the canonical Cinema 2.0 trigger set)', () => {
  const none = context()

  it('knows all eleven triggers and answers null for each when nothing happened', () => {
    expect(CINEMA2_AFTERHOURS_TRIGGER_IDS).toHaveLength(11)
    for (const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS) expect(resolveXyScopeTriggerEventId(none, none, trigger, 1)).toBeNull()
  })

  it('beat and bar follow the plain grid and give each event its own identity', () => {
    const beat = context({ beatIndex: 6, boundaries: { beatBoundary: true } })
    expect(resolveXyScopeTriggerEventId(beat, none, 'beat', 1)).toBe('beat:6')
    const next = context({ beatIndex: 7, boundaries: { beatBoundary: true } })
    expect(resolveXyScopeTriggerEventId(next, beat, 'beat', 2)).toBe('beat:7')
    const bar = context({ barIndex: 3, boundaries: { barBoundary: true } })
    expect(resolveXyScopeTriggerEventId(bar, none, 'bar', 1)).toBe('bar:3')
  })

  it('every 2 and every 4 beats fire only on their multiples', () => {
    const at = (beatIndex: number) => context({ beatIndex, boundaries: { beatBoundary: true } })
    expect(resolveXyScopeTriggerEventId(at(4), none, 'beat2', 1)).not.toBeNull()
    expect(resolveXyScopeTriggerEventId(at(5), none, 'beat2', 1)).toBeNull()
    expect(resolveXyScopeTriggerEventId(at(8), none, 'beat4', 1)).not.toBeNull()
    expect(resolveXyScopeTriggerEventId(at(6), none, 'beat4', 1)).toBeNull()
  })

  it('downbeat needs a beat on the first beat of a bar', () => {
    expect(resolveXyScopeTriggerEventId(context({ beatIndex: 8, downbeat: true, boundaries: { beatBoundary: true } }), none, 'downbeat', 1)).toBe('downbeat:8')
    expect(resolveXyScopeTriggerEventId(context({ beatIndex: 9, downbeat: false, boundaries: { beatBoundary: true } }), none, 'downbeat', 1)).toBeNull()
  })

  it('every 4 and every 8 bars use the bar grid', () => {
    expect(resolveXyScopeTriggerEventId(context({ barIndex: 8, boundaries: { fourBarBoundary: true } }), none, 'bar4', 1)).toBe('bar4:8')
    expect(resolveXyScopeTriggerEventId(context({ barIndex: 8, boundaries: { eightBarBoundary: true } }), none, 'bar8', 1)).toBe('bar8:8')
    expect(resolveXyScopeTriggerEventId(context({ barIndex: 8, boundaries: { fourBarBoundary: true } }), none, 'bar8', 1)).toBeNull()
  })

  it('kick and snare give each hit its own identity from the frame sequence', () => {
    const hit = context({ kick: true, snare: true })
    expect(resolveXyScopeTriggerEventId(hit, none, 'kick', 7)).toBe('kick:7')
    expect(resolveXyScopeTriggerEventId(hit, none, 'kick', 8)).toBe('kick:8')
    expect(resolveXyScopeTriggerEventId(hit, none, 'snare', 7)).toBe('snare:7')
  })

  it('phrase uses a new analysed phrase, or the 16-bar clock', () => {
    const before = context({ phraseIndex: 2 })
    expect(resolveXyScopeTriggerEventId(context({ phraseIndex: 3, barIndex: 12 }), before, 'phrase', 1)).toBe('phrase:3:12')
    expect(resolveXyScopeTriggerEventId(context({ phraseIndex: 2, barIndex: 16, boundaries: { sixteenBarBoundary: true } }), before, 'phrase', 1)).toBe('phrase:2:16')
    expect(resolveXyScopeTriggerEventId(context({ phraseIndex: 2 }), before, 'phrase', 1)).toBeNull()
  })

  it('drop fires on a new drop only', () => {
    const before = context({ dropOccurrence: 1 })
    expect(resolveXyScopeTriggerEventId(context({ dropOccurrence: 2 }), before, 'drop', 1)).toBe('drop:2')
    expect(resolveXyScopeTriggerEventId(context({ dropOccurrence: 1 }), before, 'drop', 1)).toBeNull()
    expect(resolveXyScopeTriggerEventId(context({ dropOccurrence: 2 }), null, 'drop', 1)).toBeNull()
  })

  it('never fires on a seek, loop wrap, track change, or with nothing loaded', () => {
    expect(resolveXyScopeTriggerEventId(null, null, 'bar', 1)).toBeNull()
    expect(resolveXyScopeTriggerEventId(context({ seekDetected: true, barIndex: 4, boundaries: { barBoundary: true } }), none, 'bar', 1)).toBeNull()
  })
})
