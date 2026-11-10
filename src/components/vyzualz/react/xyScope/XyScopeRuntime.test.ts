// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings, type XyScopeSettings } from './XyScopeSettings'
import { XyScopeRuntime } from './XyScopeRuntime'

let stroke: ReturnType<typeof vi.fn>

beforeEach(() => {
  stroke = vi.fn()
  vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over',
      setTransform: vi.fn(), fillRect: vi.fn(), stroke,
    } as unknown as CanvasRenderingContext2D
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function settingsWith(parameters: Record<string, unknown>, text = 'DRMVYZ'): XyScopeSettings {
  return normalizeXyScopeSettings({ ...DEFAULT_XY_SCOPE_SETTINGS, text, parameters: { ...DEFAULT_XY_SCOPE_SETTINGS.parameters, ...parameters } })
}

function makeRuntime(settings: XyScopeSettings): XyScopeRuntime {
  const runtime = new XyScopeRuntime(document.createElement('canvas'))
  runtime.resize(900, 600, 1)
  runtime.setSettings(settings, null)
  return runtime
}

type Overrides = Omit<Partial<SharedPerformanceContext>, 'boundaries'> & { boundaries?: Partial<SharedPerformanceContext['boundaries']> }
function context(overrides: Overrides = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(10)
  const { boundaries, ...rest } = overrides
  return { ...base, bpm: 120, ...rest, boundaries: { ...base.boundaries, ...boundaries } }
}

/** Feeds one fresh audio frame per call and runs a few quiet frames after it. */
function pump(runtime: XyScopeRuntime, clock: { t: number }, ctx: SharedPerformanceContext | null, quietFrames = 3) {
  clock.t += 1 / 60
  runtime.renderFrame({ nowSec: clock.t, context: ctx, fresh: true, stereo: null })
  for (let i = 0; i < quietFrames; i += 1) { clock.t += 1 / 60; runtime.renderFrame({ nowSec: clock.t, context: ctx, fresh: false, stereo: null }) }
}

function barEvent(bar: number): SharedPerformanceContext {
  return context({ barIndex: bar, boundaries: { barBoundary: true } })
}

describe('Sound Drawing XY choreography runtime', () => {
  it('draws the word and stays in the letters when Pattern Change is off', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: false }))
    const clock = { t: 0 }
    for (let bar = 1; bar <= 6; bar += 1) pump(runtime, clock, barEvent(bar))
    expect(runtime.getStatus().pattern).toBe('word')
    expect(runtime.getStatus().letters).toBe(6)
    expect(stroke).toHaveBeenCalled()
  })

  it('steps through every pattern on each Trigger and comes back to the letters at the end of the cycle', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true, trigger: 'bar' }))
    const clock = { t: 0 }
    pump(runtime, clock, context())
    const seen: string[] = [runtime.getStatus().pattern]
    for (let bar = 1; bar <= 7; bar += 1) { pump(runtime, clock, barEvent(bar)); seen.push(runtime.getStatus().pattern) }
    expect(seen).toEqual(['word', 'waveform', 'scope', 'ring', 'rosette', 'weave', 'pinwheel', 'word'])
  })

  it('advances once per event, however many frames carry it', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true, trigger: 'bar' }))
    const clock = { t: 0 }
    pump(runtime, clock, context())
    const ev = barEvent(1)
    pump(runtime, clock, ev)
    // The same bar boundary seen again on later frames must not advance again.
    for (let i = 0; i < 5; i += 1) { clock.t += 1 / 60; runtime.renderFrame({ nowSec: clock.t, context: ev, fresh: true, stereo: null }) }
    expect(runtime.getStatus().pattern).toBe('waveform')
  })

  it('only the chosen Trigger changes the pattern', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true, trigger: 'phrase' }))
    const clock = { t: 0 }
    pump(runtime, clock, context())
    for (let bar = 1; bar <= 5; bar += 1) pump(runtime, clock, barEvent(bar))
    expect(runtime.getStatus().pattern).toBe('word')
    pump(runtime, clock, context({ barIndex: 16, phraseIndex: 1, boundaries: { sixteenBarBoundary: true } }))
    expect(runtime.getStatus().pattern).toBe('waveform')
  })

  it('a manual Pattern change takes effect at once and does not turn Pattern Change off', () => {
    const settings = settingsWith({ patternChange: true, trigger: 'bar', pattern: 'word' })
    const runtime = makeRuntime(settings)
    const clock = { t: 0 }
    pump(runtime, clock, context())
    runtime.setSettings(settingsWith({ patternChange: true, trigger: 'bar', pattern: 'rosette' }), null)
    pump(runtime, clock, context())
    expect(runtime.getStatus().pattern).toBe('rosette')
    // The next Trigger continues from the chosen pattern.
    pump(runtime, clock, barEvent(1))
    expect(runtime.getStatus().pattern).toBe('weave')
  })

  it('does not consume an event already present on the frame Pattern Change is switched on', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: false, trigger: 'bar' }))
    const clock = { t: 0 }
    pump(runtime, clock, barEvent(1))
    runtime.setSettings(settingsWith({ patternChange: true, trigger: 'bar' }), null)
    pump(runtime, clock, barEvent(1))
    expect(runtime.getStatus().pattern).toBe('word')
    pump(runtime, clock, barEvent(2))
    expect(runtime.getStatus().pattern).toBe('waveform')
  })

  it('a seek returns to the authored pattern and never advances', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true, trigger: 'bar' }))
    const clock = { t: 0 }
    pump(runtime, clock, context())
    pump(runtime, clock, barEvent(1))
    pump(runtime, clock, barEvent(2))
    expect(runtime.getStatus().pattern).toBe('scope')
    pump(runtime, clock, context({ seekDetected: true, barIndex: 40, boundaries: { barBoundary: true } }))
    expect(runtime.getStatus().pattern).toBe('word')
  })

  it('keeps drawing with no track loaded and never throws on missing audio', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true }))
    const clock = { t: 0 }
    expect(() => { for (let i = 0; i < 30; i += 1) pump(runtime, clock, null, 0) }).not.toThrow()
    expect(stroke).toHaveBeenCalled()
    runtime.dispose()
    expect(() => pump(runtime, clock, null)).not.toThrow()
  })
})
