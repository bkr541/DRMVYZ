import { describe, expect, it, vi } from 'vitest'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { emptyOsc1Features } from './XyScopeOsc1Engine'
import { createOsc1GlyphSource } from './XyScopeOsc1Glyphs'
import { Osc2Engine } from './XyScopeOsc2Engine'
import { DEFAULT_PHASE_PORTAL_SETTINGS, PHASE_PORTAL_PRESET_ID } from './XyScopeOsc2Settings'
import { PhasePortal, PhasePortalScope } from './XyScopePhasePortal'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

function capture(channelCount = 2): StereoScopeFrame {
  const left = Float32Array.from({ length: 2048 }, (_, i) => i % 48 < 24 ? -.4 + i % 24 / 100 : .15 + i % 24 / 100)
  const right = Float32Array.from(left, sample => sample * -.5)
  return { left, right, sampleRate: 48_000, startFrame: 0, sequenceNumber: 1, audioTimeSeconds: 0, channelCount }
}

describe('Phase Portal', () => {
  it('is a text preset with settings and capture mode independent of OSC 2', () => {
    const on = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, PHASE_PORTAL_PRESET_ID)
    expect(on).toMatchObject({ sourceMode: 'osc2', presetId: PHASE_PORTAL_PRESET_ID, phasePortal: DEFAULT_PHASE_PORTAL_SETTINGS })
    const edited = normalizeXyScopeSettings({ ...on, phasePortal: { traceMode: 'xy', values: { depth: .4 } } })
    const osc2 = applyXyScopePreset(edited, 'osc2')
    expect(osc2.osc2).toEqual(DEFAULT_XY_SCOPE_SETTINGS.osc2)
    expect(applyXyScopePreset(osc2, PHASE_PORTAL_PRESET_ID).phasePortal).toEqual(edited.phasePortal)
    expect(applyXyScopePreset(edited, 'storm').sourceMode).toBe('text')
  })

  it('turns and resolves the cage around a fixed, brighter letter pass', () => {
    const portal = new PhasePortal()
    const engine = new Osc2Engine(createOsc1GlyphSource(getDefaultXyScopeFont()))
    engine.setPhasePortal(portal)
    engine.setText('AB')
    const letter = engine.streams[0]
    const cage = engine.streams.find(stream => stream.kind === 'portal')!
    const sampleCage = () => Array.from({ length: 256 }, (_, i) => engine.signal(cage, 0, i / 256))
    const advance = (beats: number, drop = false) => portal.tick(beats, 0, 0, drop, false, engine.fitWidth)
    advance(0)
    const rest = sampleCage()
    const front = engine.signal(letter, 0, .12)
    expect(rest.some(point => point.z > 0)).toBe(true)
    expect(rest.some(point => Math.abs(point.y) < .5 && Math.abs(point.x) < .7 && point.z === 0)).toBe(true)

    advance(0, true)
    advance(2)
    const turning = sampleCage()
    expect(turning).not.toEqual(rest)
    engine.setSettings({ ...DEFAULT_PHASE_PORTAL_SETTINGS.values, elevation: 50, orbitRange: 70 }, true)
    for (let i = 0; i < 30; i++) engine.tick(1 / 60, { ...emptyOsc1Features(), bass: 1, level: 1 }, true)
    expect(engine.signal(letter, 0, .12)).toEqual(front)
    expect(front.energy).toBeGreaterThan(Math.max(...turning.map(point => point.energy)))
    advance(2)
    expect(sampleCage()).not.toEqual(rest)
    advance(4)
    expect(sampleCage()).toEqual(rest)
    engine.setPhasePortal(null)
    expect(engine.streams.some(stream => stream.kind === 'portal')).toBe(false)
  })

  it('preserves the captured samples and uses true stereo XY coordinates', () => {
    const scope = new PhasePortalScope()
    const frame = capture()
    scope.update(frame)
    expect(scope.source).toBe('stereo')
    expect(scope.length).toBe(481)
    const start = frame.left.findIndex((sample, i) => i > 0 && sample > 0 && frame.left[i - 1] <= 0)
    expect(scope.left.slice(0, 48)).toEqual(frame.left.slice(start, start + 48))
    expect(scope.right.slice(0, 48)).toEqual(frame.right.slice(start, start + 48))
    frame.left.fill(0)
    expect(scope.left.some(sample => sample > 0)).toBe(true)

    const lineTo = vi.fn()
    const ctx = {
      canvas: { width: 800, height: 600 }, save() {}, restore() {}, fillRect() {},
      beginPath() {}, moveTo() {}, lineTo, stroke() {},
    } as unknown as CanvasRenderingContext2D
    scope.draw(ctx, 'xy', '#aaffee', 1)
    const [[x, y]] = lineTo.mock.calls.slice(3)
    expect(x).toBeGreaterThan(400)
    // Right is -0.5 times left. Both axes have the same gain; Canvas signs positive Y upward.
    expect(y - (600 * .73 + 600 * .27 * .46)).toBeCloseTo((x - 400) * .5)
    scope.update(capture(1))
    expect(scope.source).toBe('mono')
    lineTo.mockClear()
    scope.draw(ctx, 'xy', '#aaffee', 1)
    expect(lineTo).toHaveBeenCalledTimes(3) // Divider and the two axes, with no stereo path.
    scope.update(null)
    expect(scope.source).toBe('unavailable')
    expect(scope.length).toBe(0)
  })
})
