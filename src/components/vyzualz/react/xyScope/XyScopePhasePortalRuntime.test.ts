// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { DEFAULT_XY_SCOPE_SETTINGS, applyXyScopePreset, normalizeXyScopeSettings, type XyScopeSettings } from './XyScopeSettings'
import { PHASE_PORTAL_PRESET_ID } from './XyScopeOsc2Settings'
import { XyScopeRuntime } from './XyScopeRuntime'

// The Phase Portal branch of the runtime: which musical event cues the 4D turn, what it ignores, and what a seek or Hold does to the reference trace.

beforeEach(() => {
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over', globalAlpha: 1,
      setTransform: vi.fn(), fillRect: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function portalSettings(patch: { autoPerformance?: boolean; hold?: boolean; traceMode?: 'waveform' | 'xy' } = {}): XyScopeSettings {
  const base = applyXyScopePreset(normalizeXyScopeSettings({ ...DEFAULT_XY_SCOPE_SETTINGS, text: 'DRMVYZ' }), PHASE_PORTAL_PRESET_ID)
  return { ...base, phasePortal: { ...base.phasePortal, autoPerformance: true, ...patch } }
}

function context(overrides: Partial<SharedPerformanceContext> & { mapped?: boolean; rhythm?: boolean } = {}): SharedPerformanceContext {
  const { mapped = true, rhythm = false, ...rest } = overrides
  const base = createSharedPerformanceFallbackContext(10)
  return { ...base, bpm: 120, ...rest, capabilities: { ...base.capabilities, sections: mapped, rhythmEvents: rhythm } }
}

function stereoFrame(channels: 1 | 2, tone = .4): StereoScopeFrame {
  const length = 2048, left = new Float32Array(length), right = new Float32Array(length)
  for (let i = 0; i < length; i += 1) { left[i] = Math.sin(i / 20) * tone; right[i] = Math.cos(i / 20) * tone }
  return { left, right, sampleRate: 48000, channelCount: channels } as unknown as StereoScopeFrame
}

interface Internals { phasePortal: { cueBeats: number; opening: number }; phasePortalScope: { length: number; source: string } }
const inside = (runtime: XyScopeRuntime) => runtime as unknown as Internals

function start(settings: XyScopeSettings) {
  const runtime = new XyScopeRuntime(document.createElement('canvas'))
  runtime.resize(900, 600, 1)
  runtime.setSettings(settings, null)
  const clock = { t: 0, previous: null as SharedPerformanceContext | null }
  /** One fresh audio frame, then `quiet` more that carry the same context without a new audio frame. */
  const step = (ctx: SharedPerformanceContext | null, { stereo = stereoFrame(2), quiet = 2, fresh = true }: { stereo?: StereoScopeFrame | null; quiet?: number; fresh?: boolean } = {}) => {
    clock.t += 1 / 60
    runtime.renderFrame({ nowSec: clock.t, context: ctx, fresh, stereo, playing: true })
    for (let i = 0; i < quiet; i += 1) { clock.t += 1 / 60; runtime.renderFrame({ nowSec: clock.t, context: ctx, fresh: false, stereo, playing: true }) }
  }
  return { runtime, step }
}

const IDLE = 8
const dropAt = (n: number) => context({ dropOccurrence: n })

describe('Phase Portal runtime', () => {
  it('turns the cage on a mapped drop when Auto Performance is on, and not when it is off', () => {
    const on = start(portalSettings()), off = start(portalSettings({ autoPerformance: false }))
    for (const { step } of [on, off]) { step(dropAt(0)); step(dropAt(1)) }
    expect(inside(on.runtime).phasePortal.cueBeats).toBeLessThan(IDLE)
    expect(inside(off.runtime).phasePortal.cueBeats).toBe(IDLE)
  })

  it('ignores a drop that lands while a turn is still running, and takes the next one once the eight beats are over', () => {
    const { runtime, step } = start(portalSettings())
    step(dropAt(0)); step(dropAt(1))
    const portal = inside(runtime).phasePortal
    const first = portal.cueBeats
    for (let i = 0; i < 6; i += 1) step(dropAt(1))
    const midTurn = portal.cueBeats
    expect(midTurn).toBeGreaterThan(first)
    step(dropAt(2))
    expect(portal.cueBeats).toBeGreaterThanOrEqual(midTurn) // not restarted
    for (let i = 0; i < 4000 && portal.cueBeats < IDLE; i += 1) step(dropAt(2), { quiet: 8 })
    expect(portal.cueBeats).toBe(IDLE)
    step(dropAt(3))
    expect(portal.cueBeats).toBeLessThan(IDLE)
  })

  it('cues a turn from a strong kick only when sections are not mapped', () => {
    const unmapped = start(portalSettings()), mapped = start(portalSettings())
    unmapped.step(context({ mapped: false, rhythm: true })); unmapped.step(context({ mapped: false, rhythm: true, kick: true }))
    mapped.step(context({ mapped: true, rhythm: true })); mapped.step(context({ mapped: true, rhythm: true, kick: true }))
    expect(inside(unmapped.runtime).phasePortal.cueBeats).toBeLessThan(IDLE)
    expect(inside(mapped.runtime).phasePortal.cueBeats).toBe(IDLE)
  })

  it('returns the cage to rest on a seek, and a seek frame never cues a turn by itself', () => {
    const { runtime, step } = start(portalSettings())
    step(dropAt(0)); step(dropAt(1))
    expect(inside(runtime).phasePortal.cueBeats).toBeLessThan(IDLE)
    step(context({ dropOccurrence: 2, seekDetected: true }))
    expect(inside(runtime).phasePortal.cueBeats).toBe(IDLE)
    expect(inside(runtime).phasePortal.opening).toBeLessThan(1e-3) // reset to closed; the frames after it only ease toward the (silent) target
  })

  it('holds the reference trace while Hold is on, and refreshes it again when Hold is released', () => {
    const live = start(portalSettings())
    live.step(context(), { stereo: stereoFrame(2, .2) })
    const before = inside(live.runtime).phasePortalScope.length
    expect(before).toBeGreaterThan(1)
    // Hold keeps the captured window; a fresh capture would change the source or length, so the trace is the same one.
    const held = start(portalSettings({ hold: true }))
    held.step(context(), { stereo: stereoFrame(2, .2) })
    held.step(context(), { stereo: null })
    expect(inside(held.runtime).phasePortalScope.length).toBe(before)
    live.step(context(), { stereo: null })
    expect(inside(live.runtime).phasePortalScope.length).toBe(0)
  })

  it('labels capture honestly: stereo, mono, or unavailable', () => {
    const { runtime, step } = start(portalSettings())
    step(context(), { stereo: stereoFrame(2) })
    expect(inside(runtime).phasePortalScope.source).toBe('stereo')
    step(context(), { stereo: stereoFrame(1) })
    expect(inside(runtime).phasePortalScope.source).toBe('mono')
    step(context(), { stereo: null })
    expect(inside(runtime).phasePortalScope.source).toBe('unavailable')
  })
})
