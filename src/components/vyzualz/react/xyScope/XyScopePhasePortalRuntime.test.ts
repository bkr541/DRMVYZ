// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { DEFAULT_XY_SCOPE_SETTINGS, applyXyScopePreset } from './XyScopeSettings'
import { PHASE_PORTAL_PRESET_ID } from './XyScopePhasePortalSettings'
import { XyScopeRuntime } from './XyScopeRuntime'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this, setTransform() {}, fillRect() {}, stroke() {}, save() {}, restore() {}, beginPath() {},
      moveTo() {}, lineTo() {}, closePath() {}, strokeRect() {}, rect() {}, clip() {},
    } as unknown as CanvasRenderingContext2D
  })
})
afterEach(() => { vi.restoreAllMocks() })

function start() {
  const settings = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, PHASE_PORTAL_PRESET_ID)
  const runtime = new XyScopeRuntime(document.createElement('canvas'))
  runtime.resize(900, 600, 1)
  runtime.setSettings(settings, null)
  let frame = 0
  const step = (stereo: StereoScopeFrame | null, context: SharedPerformanceContext | null = null, fresh = true) => {
    runtime.renderFrame({ nowSec: frame++ / 60, context, fresh, stereo, playing: true })
  }
  return { runtime, settings, step }
}

function capture(channelCount: 1 | 2): StereoScopeFrame {
  return {
    left: Float32Array.from({ length: 2_048 }, (_, i) => .4 * Math.sin(i / 20)),
    right: Float32Array.from({ length: 2_048 }, (_, i) => .4 * Math.cos(i / 20)),
    sampleRate: 48_000, startFrame: 0, sequenceNumber: 1, audioTimeSeconds: 0, channelCount,
  }
}

describe('Phase Portal runtime', () => {
  it('holds, releases, and clears captured samples on transport discontinuities', () => {
    const { runtime, settings, step } = start()
    step(capture(2))
    expect(runtime.getStatus().scopeSource).toBe('stereo')
    runtime.setSettings({ ...settings, phasePortal: { ...settings.phasePortal, hold: true } }, null)
    step(null)
    expect(runtime.getStatus().scopeSource).toBe('stereo')
    step(capture(2), { ...createSharedPerformanceFallbackContext(1), seekDetected: true })
    expect(runtime.getStatus().scopeSource).toBe('fallback')
    runtime.setSettings(settings, null)
    step(capture(1))
    expect(runtime.getStatus().scopeSource).toBe('mono')
    step(null)
    expect(runtime.getStatus().scopeSource).toBe('fallback')
  })

  it('adds a text accent on fresh hits only when Auto Performance is enabled', () => {
    const { runtime, settings, step } = start()
    const kick = { ...createSharedPerformanceFallbackContext(0), kick: true, kickStrength: .8 }
    step(capture(2), kick)
    expect(runtime.getOsc2Live()?.state).toBe('MANUAL')
    runtime.setSettings({ ...settings, phasePortal: { ...settings.phasePortal, autoPerformance: true } }, null)
    step(capture(2), kick, false)
    expect(runtime.getOsc2Live()?.state).toBe('LISTENING')
    step(capture(2), kick)
    expect(runtime.getOsc2Live()).toMatchObject({ state: 'ACCENT', source: 'stereo' })
  })

  it('lays out every populated input in order, including repeat entries and text without stereo', () => {
    const { runtime, settings, step } = start()
    runtime.setSettings({ ...settings, text: 'Phase', additionalTexts: ['', 'Portal', 'Phase'] }, null)
    step(null)
    expect(runtime.getStatus()).toMatchObject({ scopeSource: 'fallback', text: 'PHASE\nPORTAL\nPHASE', letters: 16 })
    runtime.setSettings({ ...settings, text: '', additionalTexts: ['Portal'] }, null)
    step(capture(2))
    expect(runtime.getStatus()).toMatchObject({ scopeSource: 'stereo', text: 'PORTAL', letters: 6 })
  })
})
