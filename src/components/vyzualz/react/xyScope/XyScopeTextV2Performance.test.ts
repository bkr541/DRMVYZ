import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { buildXyScopeLayout, getDefaultXyScopeFont } from './XyScopeGeometry'
import { createXyScopePointBuffers, createXyScopeScopeFrame } from './XyScopeMotion'
import { computeTextV2GlyphPoints } from './XyScopeTextV2Geometry'
import { XyScopeTextV2Performance, selectTextV2Word, TEXT_V2_MANUAL_CONTROLS } from './XyScopeTextV2Performance'
import { DEFAULT_TEXT_V2_SETTINGS, normalizeTextV2Settings, TEXT_V2_STYLES } from './XyScopeTextV2Settings'

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
    expect(frame.style).toBe('impact')
    expect([...changed].sort()).toEqual(Object.keys(TEXT_V2_MANUAL_CONTROLS).sort())
    expect(frame.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
    expect(JSON.stringify(config)).toBe(serialized)
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

describe('Text V2 signed oscillator geometry and legibility', () => {
  const layout = buildXyScopeLayout({ text: 'DVYDRM', font: getDefaultXyScopeFont(), width: 1000, height: 600, size: .84, letterSpacing: .024, minPieceSize: .07 })
  const glyph = layout.glyphs[2]
  const scope = createXyScopeScopeFrame()
  scope.source = 'stereo'
  for (let i = 0; i < 512; i++) { scope.trace[i] = Math.sin(i * .09) * .5; scope.cloudX[i] = Math.sin(i * .07) * .4; scope.cloudY[i] = Math.cos(i * .08) * .5 }
  it('draws original font contours exactly when at rest, including letter positions', () => {
    const frame = new XyScopeTextV2Performance().update(config, null, true, false, .016, 0)
    const out = createXyScopePointBuffers(glyph.count)
    computeTextV2GlyphPoints(glyph, 2, 6, scope, frame, config, out, 1000, 600)
    for (let i = 0; i < glyph.count; i++) {
      expect(out.x[i]).toBeCloseTo(glyph.centerX + glyph.x[i], 4)
      expect(out.y[i]).toBeCloseTo(glyph.y[i], 4)
    }
  })
  it.each(TEXT_V2_STYLES.map(style => style.value))('keeps %s coherent and bounded at maximum abstraction, with no gaps or point scatter', manualStyle => {
    const settings = { ...config, abstraction: 1, response: 1.5, autoPerformance: false, manualStyle }
    const frame = settle(new XyScopeTextV2Performance(), settings, context({ kick: true, kickStrength: 1, transient: 1, transientConfidence: 1 }))
    const out = createXyScopePointBuffers(glyph.count)
    computeTextV2GlyphPoints(glyph, 2, 6, scope, frame, settings, out, 1000, 600)
    let max = 0
    for (let i = 0; i < glyph.count; i++) {
      expect(Number.isFinite(out.x[i] + out.y[i])).toBe(true)
      max = Math.max(max, Math.hypot(out.x[i] - glyph.centerX - glyph.x[i], out.y[i] - glyph.y[i]))
      expect(out.gap[i] + out.form[i] + out.dissolved[i]).toBe(0)
    }
    expect(max).toBeGreaterThan(.1)
    expect(max).toBeLessThan(glyph.heightPx * .34)
    const repeated = createXyScopePointBuffers(glyph.count)
    computeTextV2GlyphPoints(glyph, 2, 6, scope, frame, settings, repeated, 1000, 600)
    expect(repeated.x).toEqual(out.x)
  })
  it('uses the actual sign of stereo samples and provides three distinct grouping responses', () => {
    const frame = settle(new XyScopeTextV2Performance())
    const results = (['word', 'letters', 'both'] as const).map(grouping => {
      const out = createXyScopePointBuffers(glyph.count)
      computeTextV2GlyphPoints(glyph, 2, 6, scope, frame, { ...config, grouping }, out, 1000, 600)
      return Array.from(out.x)
    })
    expect(results[0]).not.toEqual(results[1]); expect(results[2]).not.toEqual(results[0]); expect(results[2]).not.toEqual(results[1])
    const reversed = { ...scope, trace: Float32Array.from(scope.trace, x => -x), cloudX: Float32Array.from(scope.cloudX, x => -x), cloudY: Float32Array.from(scope.cloudY, x => -x) }
    const out = createXyScopePointBuffers(glyph.count)
    computeTextV2GlyphPoints(glyph, 2, 6, reversed, frame, config, out, 1000, 600)
    expect(Array.from(out.x)).not.toEqual(results[2])
  })
})
