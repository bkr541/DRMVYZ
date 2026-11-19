import { describe, expect, it } from 'vitest'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { DEFAULT_PHASE_PORTAL_SETTINGS, PHASE_PORTAL_PRESET_ID } from './XyScopePhasePortalSettings'
import { PhasePortalScope } from './XyScopePhasePortal'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

function drawing() {
  const strokes: { color: string; points: [number, number][] }[] = []
  let points: [number, number][] = []
  const point = (x: number, y: number) => points.push([x, y])
  const ctx = {
    canvas: { width: 800, height: 600 }, strokeStyle: '',
    save() {}, restore() {}, fillRect() {}, strokeRect() {}, rect() {}, clip() {}, setTransform() {},
    beginPath() { points = [] }, moveTo: point, lineTo: point, closePath() {},
    stroke() { strokes.push({ color: this.strokeStyle, points }) },
  }
  return { strokes, ctx: ctx as unknown as CanvasRenderingContext2D }
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
    expect(points.at(-1)![0]).toBeGreaterThan(400 + 600 * .85 / 2) // The display clips at its boundary.
  })

  it('centers the typed outline in the XY display and updates it even without a stereo trace', () => {
    const scope = new PhasePortalScope()
    const { ctx, strokes } = drawing()
    scope.update(capture(1))
    expect(scope.source).toBe('mono')
    const settings = { ...DEFAULT_PHASE_PORTAL_SETTINGS, grid: false }
    scope.setText('D', getDefaultXyScopeFont(), settings.values.textSize)
    scope.draw(ctx, settings, 1)
    expect(strokes).toHaveLength(3) // Three passes over the lettering, with no manufactured XY path.
    const before = strokes.at(-1)!.points
    expect((Math.min(...before.map(([x]) => x)) + Math.max(...before.map(([x]) => x))) / 2).toBeCloseTo(400)
    expect((Math.min(...before.map(([, y]) => y)) + Math.max(...before.map(([, y]) => y))) / 2).toBeCloseTo(300)
    scope.setText('ABCDEFGH12345678', getDefaultXyScopeFont(), settings.values.textSize)
    scope.draw(ctx, settings, 1)
    const after = strokes.at(-1)!.points
    expect(after).not.toEqual(before)
    expect(after.every(([x]) => Math.abs(x - 400) <= 600 * .85 * .39 + .001)).toBe(true)
  })
})
