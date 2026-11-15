import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../features/performanceCore'
import { buildXyScopeLayout, getDefaultXyScopeFont } from './XyScopeGeometry'
import { createXyScopeScopeFrame } from './XyScopeMotion'
import { XyScopeTextV2BeamPath, TEXT_V2_BEAM_SAMPLES, TEXT_V2_WORD_SAMPLES } from './XyScopeTextV2Geometry'
import { XyScopeTextV2Performance } from './XyScopeTextV2Performance'
import { DEFAULT_TEXT_V2_SETTINGS, TEXT_V2_STYLES, type TextV2Style } from './XyScopeTextV2Settings'
const settings = { ...DEFAULT_TEXT_V2_SETTINGS, grouping: 'word' as const, autoPerformance: false }
const layout = (text: string) => buildXyScopeLayout({ text, font: getDefaultXyScopeFont(), width: 1000, height: 600, size: .84, letterSpacing: .024, minPieceSize: .07 })
const scope = createXyScopeScopeFrame(); scope.source = 'stereo'
for (let i = 0; i < 512; i++) { scope.trace[i] = Math.sin(i * .09) * .5; scope.cloudX[i] = Math.sin(i * .07) * .4 }
function frame(style: TextV2Style = 'contour') {
  const controller = new XyScopeTextV2Performance(), context = createSharedPerformanceFallbackContext(0)
  context.energy = .8; context.bass = .7; context.mid = .5; context.high = .4
  let result = controller.update({ ...settings, manualStyle: style }, context, true, true, 1 / 60, .7)
  for (let i = 0; i < 180; i++) result = controller.update({ ...settings, manualStyle: style }, context, false, true, 1 / 60, .7)
  return result
}
const formation = { phase: 'formation' as const, morph: 1, cycle: 1, commitWordEvent: null }
describe('one oscillator beam with lettering as a target formation', () => {
  it('resamples all font strokes into one stream, lifting the beam between contours', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('DVYDRM'))
    path.render(scope, { ...frame(), amount: 0 }, { ...formation, phase: 'word', morph: 0 }, settings, 1000, 600, 0)
    expect(path.buffer.x).toEqual(path.glyph.x); expect(path.buffer.y).toEqual(path.glyph.y)
    expect(path.buffer.gap.some(x => x === 1)).toBe(true)
    expect(path.glyph.count).toBe(TEXT_V2_BEAM_SAMPLES)
  })
  it.each(TEXT_V2_STYLES.map(s => s.value))('fully becomes the %s oscillator with no retained letter samples', style => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('DVYDRM'))
    path.render(scope, frame(style), formation, settings, 1000, 600, 0)
    const oscillatorX = path.buffer.x.slice(), oscillatorY = path.buffer.y.slice()
    expect(path.buffer.form.every(x => x === 1)).toBe(true)
    expect(path.buffer.gap.slice(0, TEXT_V2_WORD_SAMPLES).filter(x => x === 1).length).toBe(1)
    // At full formation even a completely different word cannot affect the rendered beam.
    path.setLayout(layout('B2B'))
    path.render(scope, frame(style), formation, settings, 1000, 600, 0)
    expect(path.buffer.x).toEqual(oscillatorX); expect(path.buffer.y).toEqual(oscillatorY)
    expect(Math.max(...path.buffer.x) - Math.min(...path.buffer.x)).toBeGreaterThan(400)
    for (let i = 0; i < TEXT_V2_BEAM_SAMPLES; i++) {
      expect(Number.isFinite(path.buffer.x[i] + path.buffer.y[i])).toBe(true)
      expect(Math.abs(path.buffer.x[i])).toBeLessThanOrEqual(470)
      expect(Math.abs(path.buffer.y[i])).toBeLessThanOrEqual(282)
      if (i > 0 && path.buffer.gap[i - 1] < .5) expect(Math.hypot(path.buffer.x[i] - path.buffer.x[i - 1], path.buffer.y[i] - path.buffer.y[i - 1])).toBeLessThan(28)
    }
  })
  it('morphs the same samples continuously into the next word and back into oscillator formations', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('DVYDRM'))
    const f = frame(); path.render(scope, f, formation, settings, 1000, 600, 0)
    const x = path.buffer.x.slice(); path.setLayout(layout('GOONZ'))
    path.render(scope, f, { ...formation, phase: 'reform', morph: .999 }, settings, 1000, 600, 0)
    expect(Math.max(...path.buffer.x.map((value, i) => Math.abs(value - x[i])))).toBeLessThan(1)
    path.render(scope, { ...f, amount: 0 }, { ...formation, phase: 'word', morph: 0 }, settings, 1000, 600, 0)
    expect(path.buffer.x).toEqual(path.glyph.x)
    expect(path.buffer.y).toEqual(path.glyph.y)
  })
  it('uses the musical plan for Both grouping instead of alternating a fixed sequence', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('DVYDRM'))
    const f = frame()
    path.render(scope, f, formation, settings, 1000, 600, 4)
    const wordX = path.buffer.x.slice()
    path.render(scope, f, formation, { ...settings, grouping: 'letters' }, 1000, 600, 4)
    const letterX = path.buffer.x.slice()
    expect(letterX).not.toEqual(wordX)
    path.render(scope, { ...f, plan: { ...f.plan, grouping: 0 } }, { ...formation, cycle: 3 }, { ...settings, grouping: 'both' }, 1000, 600, 4)
    expect(Math.max(...path.buffer.x.map((value, i) => Math.abs(value - wordX[i])))).toBeLessThan(.01)
    path.render(scope, { ...f, plan: { ...f.plan, grouping: 1 } }, { ...formation, cycle: 5 }, { ...settings, grouping: 'both' }, 1000, 600, 4)
    expect(Math.max(...path.buffer.x.map((value, i) => Math.abs(value - letterX[i])))).toBeLessThan(.01)
  })
  it('vibrates and expands readable text from signed audio, including at zero departure', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('DVYDRM'))
    const f = frame(), word = { ...formation, phase: 'word' as const, morph: 0 }
    path.render(scope, f, word, settings, 1000, 600, .016)
    const moving = path.buffer.y.slice(0, TEXT_V2_WORD_SAMPLES)
    expect(Math.max(...moving.map((y, i) => Math.abs(y - path.glyph.y[i])))).toBeGreaterThan(5)
    path.render({ ...scope, trace: Float32Array.from(scope.trace, x => -x) }, f, word, settings, 1000, 600, 0)
    expect(path.buffer.y.slice(0, TEXT_V2_WORD_SAMPLES)).not.toEqual(moving)
    path.render(scope, { ...f, amount: 0 }, word, settings, 1000, 600, 0)
    expect(path.buffer.y).toEqual(path.glyph.y)
    expect(path.buffer.x).toEqual(path.glyph.x)
  })
  it('fills all four stage quadrants with lifted signal channels even during readable text', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('XY'))
    path.render(scope, frame(), { ...formation, phase: 'word', morph: 0 }, settings, 1000, 600, .016)
    const quadrants = new Set<string>()
    for (let i = TEXT_V2_WORD_SAMPLES; i < TEXT_V2_BEAM_SAMPLES; i++) {
      if (path.buffer.gap[i] === 1) continue
      if (Math.abs(path.buffer.x[i]) > 200 && Math.abs(path.buffer.y[i]) > 100) quadrants.add(`${Math.sign(path.buffer.x[i])},${Math.sign(path.buffer.y[i])}`)
    }
    expect(quadrants.size).toBe(4)
    expect(path.buffer.gap[TEXT_V2_WORD_SAMPLES - 1]).toBe(1)
  })
  it('uses signed audio samples to shape the oscillator without producing a random point cloud', () => {
    const path = new XyScopeTextV2BeamPath(); path.setLayout(layout('XY'))
    const f = frame(); path.render(scope, f, formation, settings, 1000, 600, 0)
    const x = path.buffer.x.slice()
    path.render({ ...scope, trace: Float32Array.from(scope.trace, x => -x) }, f, formation, settings, 1000, 600, 0)
    expect(path.buffer.x).not.toEqual(x)
  })
})
