import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { XyScopeTextV2Performance, selectTextV2Word, TEXT_V2_MANUAL_CONTROLS } from './XyScopeTextV2Performance'
import { DEFAULT_TEXT_V2_SETTINGS, normalizeTextV2Settings } from './XyScopeTextV2Settings'

const config = { ...DEFAULT_TEXT_V2_SETTINGS }
function context(patch: Partial<SharedPerformanceContext> = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(0)
  return { ...base, trackIdentity: 'track', energy: .65, bass: .7, mid: .55, high: .35,
    confidence: { ...base.confidence, overall: .8, phrase: .8, rhythm: .8 }, ...patch }
}
function settle(controller: XyScopeTextV2Performance, settings = config, c = context(), playing = true) {
  let result = controller.update(settings, c, true, playing, 1 / 60, 0)
  for (let i = 0; i < 180; i++) result = controller.update(settings, c, false, playing, 1 / 60, 0)
  return result
}

describe('Text V2 persisted compact settings', () => {
  it('defaults to both groupings and repairs invalid settings', () => {
    expect(normalizeTextV2Settings(undefined)).toEqual(DEFAULT_TEXT_V2_SETTINGS)
    expect(normalizeTextV2Settings({ grouping: 'invalid', abstraction: 99, response: -4, autoPerformance: 'yes', manualStyle: 'noise' }))
      .toEqual({ ...DEFAULT_TEXT_V2_SETTINGS, abstraction: 1, response: 0 })
    expect(normalizeTextV2Settings({ grouping: 'letters', autoPerformance: false, manualStyle: 'impact' }))
      .toMatchObject({ grouping: 'letters', autoPerformance: false, manualStyle: 'impact' })
  })
})

describe('Text V2 musical decisions', () => {
  it('never emits a word change from elapsed time, repeated frames, or ordinary beats alone', () => {
    const controller = new XyScopeTextV2Performance()
    for (let i = 0; i < 300; i++) {
      const c = context({ audioTimeSec: i * 10, absoluteBeat: i * 20, barIndex: i })
      c.boundaries.barBoundary = true
      expect(controller.update(config, c, true, true, .05, 0).wordEventId).toBeNull()
    }
  })
  it.each(['section', 'phrase', 'drop'] as const)('consumes each confident %s change once', kind => {
    const controller = new XyScopeTextV2Performance()
    controller.update(config, context(), true, true, .016, 0)
    const c = kind === 'section' ? context({ sectionIdentity: 'new-section', sectionConfidence: .8 })
      : kind === 'phrase' ? context({ phraseIndex: 1 }) : context({ dropOccurrence: 1, dropImpact: .9 })
    expect(controller.update(config, c, true, true, .016, 0).wordEventId).toMatch(new RegExp(`^${kind}:`))
    expect(controller.update(config, c, true, true, .016, 0).wordEventId).toBeNull()
    expect(controller.update(config, c, false, true, .016, 0).wordEventId).toBeNull()
  })
  it('requires confidence for structure and significant spectral/energy evidence for a fallback bar decision', () => {
    const controller = new XyScopeTextV2Performance()
    controller.update(config, context(), true, true, .016, 0)
    const c = context({ sectionIdentity: 'uncertain', sectionConfidence: .1, phraseIndex: 1 })
    c.confidence.phrase = .1
    expect(controller.update(config, c, true, true, .016, 0).wordEventId).toBeNull()
    const energetic = context({ energy: .95, spectralFlux: .7, barIndex: 3, phraseIndex: 1, sectionIdentity: 'uncertain' })
    energetic.boundaries.barBoundary = true
    expect(controller.update(config, energetic, true, true, .016, 0).wordEventId).toBe('energy:3')
  })
  it('ignores boundaries on pause, resume, seeks, loops and track replacement', () => {
    const controller = new XyScopeTextV2Performance()
    controller.update(config, context(), true, true, .016, 0)
    const paused = context({ phraseIndex: 1 })
    expect(controller.update(config, paused, true, false, .016, 0).wordEventId).toBeNull()
    expect(controller.update(config, paused, true, true, .016, 0).wordEventId).toBeNull()
    for (const flag of ['seekDetected', 'loopWrapDetected', 'trackReplacementDetected'] as const) {
      expect(controller.update(config, context({ [flag]: true, phraseIndex: 20 }), true, true, .016, 0).wordEventId).toBeNull()
    }
    expect(controller.update(config, context({ trackIdentity: 'other', phraseIndex: 40 }), true, true, .016, 0).wordEventId).toBeNull()
  })
  it('selects a stable different word without changing the editable entries', () => {
    const words = ['A', 'BB', 'CCC']
    const selected = selectTextV2Word(words, 'A', 'phrase:8', 19)
    expect(selected).not.toBe('A')
    expect(selectTextV2Word(words, 'A', 'phrase:8', 19)).toBe(selected)
    expect(selectTextV2Word(['A'], 'A', 'phrase:8', 19)).toBe('A')
    expect(words).toEqual(['A', 'BB', 'CCC'])
  })
})

describe('Text V2 coordinated performance', () => {
  it('conducts every hidden control from audio evidence and keeps all values finite', () => {
    const controller = new XyScopeTextV2Performance()
    const serialized = JSON.stringify(config)
    const quiet = { ...settle(controller, config, context({ energy: .05, bass: .05, mid: .05, high: .05 })).controls }
    let frame = controller.update(config, context(), false, true, 1 / 60, 0)
    const changed = new Set<string>()
    for (let i = 0; i < 180; i++) {
      const c = context({ energy: .95, bass: .9, mid: .85, high: .8, kick: i % 30 === 0, kickStrength: 1, dropImpact: .9, dropOccurrence: 2, buildProgress: .7 })
      frame = controller.update(config, c, true, true, 1 / 60, 0)
      for (const key of Object.keys(TEXT_V2_MANUAL_CONTROLS) as (keyof typeof TEXT_V2_MANUAL_CONTROLS)[]) {
        expect(Number.isFinite(frame.controls[key]), key).toBe(true)
        if (Math.abs(frame.controls[key] - quiet[key]) > .001) changed.add(key)
      }
    }
    expect(frame.plan.intent).toBe('depart')
    expect([...changed].sort()).toEqual(Object.keys(TEXT_V2_MANUAL_CONTROLS).sort())
    expect(frame.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
    expect(JSON.stringify(config)).toBe(serialized)
  })
  it('randomizes effect targets on new audio evidence, deterministically and without frame jitter', () => {
    const a = new XyScopeTextV2Performance(), b = new XyScopeTextV2Performance()
    const plans = new Set<string>(), families = new Set<string>()
    for (let i = 0; i < 32; i++) {
      const c = context({ beatIndex: i, audioTimeSec: i * .5, kick: true, kickStrength: .9, spectralFlux: .6, deterministicVariationSeed: i * 17 })
      const x = a.update(config, c, true, true, .05, .7), y = b.update(config, c, true, true, .05, .7)
      expect(x.plan).toEqual(y.plan); expect(x.style).toBe(y.style)
      plans.add(JSON.stringify(x.plan.choices)); families.add(x.style)
      const held = a.update(config, c, true, true, .016, .7)
      b.update(config, c, true, true, .016, .7)
      expect(held.plan).toBe(x.plan)
    }
    expect(plans.size).toBe(32); expect(families.size).toBeGreaterThan(2)
  })
  it('keeps manual audio response, restores manual defaults when Auto is disabled, and settles on pause', () => {
    const controller = new XyScopeTextV2Performance()
    settle(controller, config, context({ buildProgress: .8 }))
    const manual = { ...config, autoPerformance: false, manualStyle: 'reform' as const }
    let frame = settle(controller, manual)
    expect(frame.style).toBe('reform')
    expect(frame.amount).toBeGreaterThan(.3)
    expect(frame.controls.trailMs).toBeCloseTo(TEXT_V2_MANUAL_CONTROLS.trailMs, 2)
    const phase = frame.phase
    frame = settle(controller, manual, context(), false)
    expect(frame.amount).toBeLessThan(.001)
    expect(frame.phase).toBe(phase)
  })
  it('rests without music and honors zero response', () => {
    const controller = new XyScopeTextV2Performance()
    expect(controller.update(config, null, true, true, .016, 0)).toMatchObject({ amount: 0, state: 'Rest' })
    expect(settle(controller, { ...config, response: 0 }).amount).toBe(0)
  })
})
