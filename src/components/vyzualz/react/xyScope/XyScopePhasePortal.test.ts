import { describe, expect, it } from 'vitest'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { DEFAULT_PHASE_PORTAL_SETTINGS, PHASE_PORTAL_PRESET_ID } from './XyScopePhasePortalSettings'
import { PhasePortalScope } from './XyScopePhasePortal'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

function drawing() {
  const strokes: { color: string; width: number; points: [number, number][] }[] = []
  const fills: number[][] = []
  const borders: number[][] = []
  const traceLimits: number[][] = []
  let points: [number, number][] = []
  const point = (x: number, y: number) => points.push([x, y])
  const ctx = {
    canvas: { width: 800, height: 600 }, strokeStyle: '', lineWidth: 1,
    save() {}, restore() {}, setTransform() {},
    fillRect(...box: number[]) { fills.push(box) }, strokeRect(...box: number[]) { borders.push(box) },
    rect(...box: number[]) { traceLimits.push(box) }, clip() {},
    beginPath() { points = [] }, moveTo: point, lineTo: point, closePath() {},
    stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, points }) },
  }
  return { strokes, fills, borders, traceLimits, ctx: ctx as unknown as CanvasRenderingContext2D }
}

function capture(channelCount = 2): StereoScopeFrame {
  const left = Float32Array.from({ length: 2048 }, (_, i) => i / 4096)
  const right = Float32Array.from(left, sample => sample * -.5)
  return { left, right, sampleRate: 48_000, startFrame: 0, sequenceNumber: 1, audioTimeSeconds: 0, channelCount }
}

describe('Phase Portal', () => {
  it('keeps legacy presets selected and retains compatible controls independently of OSC 2', () => {
    const applied = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, PHASE_PORTAL_PRESET_ID)
    const saved = normalizeXyScopeSettings({
      ...applied, text: 'AB', phasePortal: { traceMode: 'waveform', hold: true, bpmSync: false, values: { depth: .4, color: '#11CCDD' } },
    })
    expect(saved).toMatchObject({ sourceMode: 'osc2', presetId: PHASE_PORTAL_PRESET_ID, text: 'AB' })
    expect(saved.phasePortal).toEqual({
      ...DEFAULT_PHASE_PORTAL_SETTINGS, hold: true, bpmSync: false,
      values: { ...DEFAULT_PHASE_PORTAL_SETTINGS.values, color: '#11ccdd' },
    })
    const osc2 = applyXyScopePreset(saved, 'osc2')
    expect(osc2.osc2).toEqual(DEFAULT_XY_SCOPE_SETTINGS.osc2)
    expect(applyXyScopePreset(osc2, PHASE_PORTAL_PRESET_ID).phasePortal).toEqual(saved.phasePortal)
  })

  it('plots the latest synchronized samples without normalization or clipping the underlying coordinates', () => {
    const scope = new PhasePortalScope()
    const frame = capture()
    const start = frame.left.length - 960
    const first = frame.left[start], last = frame.left.at(-1)!
    scope.update(frame)
    frame.left.fill(0) // The captured window remains available for Hold.
    const { ctx, strokes } = drawing()
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false, values: { ...DEFAULT_PHASE_PORTAL_SETTINGS.values, gain: 3 } }
    scope.draw(ctx, settings, 1)

    expect(scope.source).toBe('stereo')
    expect(scope.length).toBe(960)
    const points = strokes.at(-1)!.points
    const scale = 600 * .85 / 2 * 3
    expect(points[0]).toEqual([400 + first * scale, 300 + first * scale * .5])
    expect(points.at(-1)).toEqual([400 + last * scale, 300 + last * scale * .5])
    expect(points.at(-1)![0]).toBeGreaterThan(400 + 600 * .85 / 2) // Gain can move samples outside the graticule.
  })

  it('centers the lettering horizontally and keeps its position even without a stereo trace', () => {
    const scope = new PhasePortalScope()
    const { ctx, strokes } = drawing()
    scope.update(capture(1))
    expect(scope.source).toBe('mono')
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false }
    scope.setTexts(['D'], getDefaultXyScopeFont(), settings.values.textSize)
    scope.draw(ctx, settings, 1)
    expect(strokes).toHaveLength(3)
    const before = strokes[1].points
    expect((Math.min(...before.map(([x]) => x)) + Math.max(...before.map(([x]) => x))) / 2).toBeCloseTo(400)
    expect((Math.min(...before.map(([, y]) => y)) + Math.max(...before.map(([, y]) => y))) / 2).toBeCloseTo(72)
    scope.setTexts(['ABCDEFGH12345678'], getDefaultXyScopeFont(), settings.values.textSize)
    scope.draw(ctx, settings, 1)
    const after = strokes.at(-2)!.points
    expect(after).not.toEqual(before)
    expect(after.every(([x]) => Math.abs(x - 400) <= 600 * .85 * .39 + .001)).toBe(true)
  })

  it('plots the live trace between both words while the beam scans the lettering in place', () => {
    const scope = new PhasePortalScope()
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false }
    scope.setTexts(['Phase', '', 'Portal'], getDefaultXyScopeFont(), settings.values.textSize)
    const frame = capture()
    scope.update(frame)
    const draw = (dt: number, hold = false) => {
      scope.advance(dt, 1, 0)
      const { ctx, strokes, fills, borders, traceLimits } = drawing()
      scope.draw(ctx, { ...settings, hold }, 1, true)
      expect(fills).toEqual([[0, 0, 800, 600]])
      expect(borders).toEqual([])
      const trace = strokes.find(stroke => stroke.width === 1.35)?.points
      const [upper, lower] = traceLimits.length ? [traceLimits[0][1], traceLimits[0][1] + traceLimits[0][3]] : [0, 600]
      return { trace, upper, lower, beam: strokes[2]?.points, head: strokes[3]?.points }
    }
    expect(scope.text).toBe('PHASE\nPORTAL')
    let previous = draw(0)
    const gain = 600 * .56 / 2 * settings.values.gain
    const firstSample = frame.left[frame.left.length - 960]
    expect(previous.trace?.[0]).toEqual([400 + firstSample * gain, 300 + firstSample * gain / 2])
    for (let i = 0; i < 40; i++) {
      const next = draw(.08)
      expect(next.trace).toHaveLength(960)
      expect(next.trace).toEqual(previous.trace)
      expect(next.beam).toHaveLength(scope.points)
      expect(next.beam?.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
      expect(next.beam?.some(([, y]) => y < next.upper)).toBe(true)
      expect(next.beam?.some(([, y]) => y > next.lower)).toBe(true)
      expect(next.beam?.every(([, y]) => y < next.upper || y > next.lower)).toBe(true)
      expect(next.head?.length).toBeGreaterThan(0)
      expect(next.head).not.toEqual(previous.head)
      expect(next.beam).toEqual(previous.beam)
      previous = next
    }
    scope.update({ ...frame, left: Float32Array.from(frame.left, value => -value) })
    const changed = draw(.08)
    expect(changed.trace).not.toEqual(previous.trace)
    expect(changed.beam).not.toEqual(previous.beam)
    const held = draw(0, true)
    expect(held.trace).toHaveLength(960)
    expect(held.beam).toBeUndefined()
  })

  it('advances the sweep during playback without plotting an unavailable or mono trace', () => {
    const scope = new PhasePortalScope()
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false }
    scope.setTexts(['DVYDRM', 'GOONZ'], getDefaultXyScopeFont(), settings.values.textSize)
    for (const frame of [null, capture(1)]) {
      scope.reset()
      scope.update(frame)
      const early = drawing(), later = drawing(), paused = drawing()
      scope.advance(.3, 1, 0)
      scope.draw(early.ctx, settings, 1, true)
      scope.advance(.3, 2, 0)
      scope.draw(later.ctx, settings, 1, true)
      scope.draw(paused.ctx, settings, 1)
      expect(later.strokes).toHaveLength(3)
      expect(later.strokes[1].points).toEqual(early.strokes[1].points)
      expect(paused.strokes[1].points).toEqual(later.strokes[1].points)
      expect(later.strokes[2].points).not.toEqual(early.strokes[2].points)
    }
  })

  it('applies the left and right samples to the lettering only on their respective axes', () => {
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false }
    const draw = (left: number, right: number, traceCoupling = 1) => {
      const scope = new PhasePortalScope()
      scope.setTexts(['PORTAL'], getDefaultXyScopeFont(), settings.values.textSize)
      const frame = capture()
      frame.left.fill(left)
      frame.right.fill(right)
      scope.update(frame)
      scope.advance(.85, 1, 0)
      const { ctx, strokes } = drawing()
      scope.draw(ctx, { ...settings, values: { ...settings.values, traceCoupling } }, 1, true)
      return strokes[2].points
    }
    const neutral = draw(0, 0), left = draw(1, 0), right = draw(0, 1)
    expect(draw(1, 1, 0)).toEqual(neutral)
    const expectedDelta = 600 * .85 * .0075 * 1.5 / 2.5
    for (let i = 0; i < neutral.length; i++) {
      const [x, y] = neutral[i]
      expect(left[i][0]).toBeCloseTo(x + expectedDelta, 3)
      expect(left[i][1]).toEqual(y)
      expect(right[i][0]).toEqual(x)
      expect(right[i][1]).toBeCloseTo(y - expectedDelta, 3)
    }
  })
})
