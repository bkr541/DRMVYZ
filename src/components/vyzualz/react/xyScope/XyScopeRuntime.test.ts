// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings, type XyScopeSettings } from './XyScopeSettings'
import { XyScopeBeamRenderer } from './XyScopeBeam'
import { XY_SCOPE_PATTERN_IDS } from './XyScopePatterns'
import { compileXyScopeSvg } from './XyScopeSvg'
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
  it.each(['text'] as const)('randomly changes words in %s only during playback, skips blanks and duplicates, and preserves the pattern', sourceMode => {
    const settings = normalizeXyScopeSettings({ sourceMode, text: 'A', additionalTexts: [' ', ' a ', 'BB', 'CCC'] })
    const runtime = makeRuntime(settings)
    const clock = { t: 0 }
    const advance = (playing: boolean, frames = 81) => {
      for (let i = 0; i < frames; i += 1) {
        clock.t += 0.05
        runtime.renderFrame({ nowSec: clock.t, context: null, fresh: false, stereo: null, playing })
      }
    }
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    pump(runtime, clock, context())
    pump(runtime, clock, barEvent(1))
    expect(runtime.getStatus().pattern).toBe('waveform')
    advance(false)
    expect(runtime.getStatus().text).toBe('A')
    expect(random).not.toHaveBeenCalled()
    advance(true)
    expect(runtime.getStatus()).toMatchObject({ text: 'CCC', letters: 3, pattern: 'waveform' })
    advance(false)
    expect(runtime.getStatus().text).toBe('CCC')
    random.mockReturnValue(0)
    advance(true)
    expect(runtime.getStatus().text).toBe('A')
    advance(true)
    expect(runtime.getStatus().text).toBe('BB')
    runtime.reset()
    expect(runtime.getStatus().text).toBe('A')
    expect(settings.text).toBe('A')
    expect(settings.additionalTexts).toEqual([' ', ' a ', 'BB', 'CCC'])
  })

  it('holds a single nonblank word and updates the active layout when words are edited or cleared', () => {
    const runtime = makeRuntime(normalizeXyScopeSettings({ text: '', additionalTexts: ['BB', '', 'bb'] }))
    const random = vi.spyOn(Math, 'random')
    for (let i = 0; i < 90; i += 1) runtime.renderFrame({ nowSec: i * 0.05, context: null, fresh: false, stereo: null, playing: true })
    expect(runtime.getStatus()).toMatchObject({ text: 'BB', letters: 2 })
    expect(random).not.toHaveBeenCalled()
    runtime.setSettings(normalizeXyScopeSettings({ text: 'EDITED', additionalTexts: ['CCC'] }), null)
    expect(runtime.getStatus()).toMatchObject({ text: 'EDITED', letters: 6 })
    runtime.setSettings(normalizeXyScopeSettings({ text: '', additionalTexts: [''] }), null)
    expect(runtime.getStatus()).toMatchObject({ text: '', letters: 0 })
  })

  it('draws the word and stays in the letters when Pattern Change is off', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: false }))
    const clock = { t: 0 }
    for (let bar = 1; bar <= 6; bar += 1) pump(runtime, clock, barEvent(bar))
    expect(runtime.getStatus().pattern).toBe('word')
    expect(runtime.getStatus().letters).toBe(6)
    expect(stroke).toHaveBeenCalled()
  })

  it.each(XY_SCOPE_PATTERN_IDS)('fully departs, blanks and redraws in fixed %s without Pattern Change or drum hits', pattern => {
    const runtime = makeRuntime(settingsWith({ pattern, patternChange: false, motionAmount: 0.7, vibration: 0, dissolveDepth: 0 }))
    const samples: { xs: number[]; ys: number[]; form: number; gap: number }[] = []
    const draw = XyScopeBeamRenderer.prototype.draw
    vi.spyOn(XyScopeBeamRenderer.prototype, 'draw').mockImplementation(function (this: XyScopeBeamRenderer, ...args) {
      samples.push({ xs: Array.from(args[1][0].x), ys: Array.from(args[1][0].y), form: Math.max(...args[1][0].form), gap: Math.min(...args[1][0].gap) })
      return draw.apply(this, args)
    })
    for (let frame = 0; frame <= 1080; frame += 1) {
      const t = frame / 60
      runtime.renderFrame({ nowSec: t, context: context({ absoluteBeat: t * 2 }), fresh: true, stereo: null, playing: true })
    }
    const home = samples[0]
    const distance = (sample: typeof home) => Math.max(...sample.xs.map((x, i) => Math.hypot(x - home.xs[i], sample.ys[i] - home.ys[i])))
    expect(Math.max(...samples.map(distance))).toBeGreaterThan(40)
    for (const frame of [360, 720, 1080]) expect(distance(samples[frame])).toBeLessThan(0.01)
    expect(samples.some(sample => sample.form === 1)).toBe(true)
    expect(samples.some(sample => sample.gap > 0.8)).toBe(true)
    expect(runtime.getStatus().pattern).toBe(pattern)
  })

  it('finishes the current departure before accepting an automatically selected routine', () => {
    const runtime = makeRuntime(settingsWith({ patternChange: true, trigger: 'beat' }))
    runtime.renderFrame({ nowSec: 0, context: context({ absoluteBeat: 0 }), fresh: true, stereo: null, playing: true })
    runtime.renderFrame({ nowSec: 0.5, context: context({ absoluteBeat: 1, beatIndex: 1, boundaries: { beatBoundary: true } }), fresh: true, stereo: null, playing: true })
    expect(runtime.getStatus().pattern).toBe('waveform')
    expect(runtime.getStatus().performingPattern).toBe('word')
    for (let i = 31; i <= 370; i += 1) runtime.renderFrame({ nowSec: i / 60, context: context({ absoluteBeat: i / 30 }), fresh: true, stereo: null, playing: true })
    expect(runtime.getStatus().performingPattern).toBe('waveform')
  })

  it('settles to the word on pause and with Motion Amount or Audio Reactivity at zero', () => {
    const runtime = makeRuntime(settingsWith({ pattern: 'ring', patternChange: false, motionAmount: 1, vibration: 0, dissolveDepth: 0 }))
    const positions: number[][] = []
    const draw = XyScopeBeamRenderer.prototype.draw
    vi.spyOn(XyScopeBeamRenderer.prototype, 'draw').mockImplementation(function (this: XyScopeBeamRenderer, ...args) {
      positions.push(Array.from(args[1][0].y))
      return draw.apply(this, args)
    })
    const render = (frame: number, playing: boolean) => runtime.renderFrame({ nowSec: frame / 60, context: context({ absoluteBeat: Math.min(frame / 30, 3) }), fresh: true, stereo: null, playing })
    render(0, true)
    const home = positions[0]
    for (let i = 1; i <= 90; i += 1) render(i, true)
    for (let i = 91; i <= 360; i += 1) render(i, false)
    expect(positions.at(-1)!.every((y, i) => Math.abs(y - home[i]) < 0.01)).toBe(true)
    for (const parameter of ['motionAmount', 'audioReactivity']) {
      runtime.setSettings(settingsWith({ pattern: 'ring', patternChange: false, vibration: 0, dissolveDepth: 0, [parameter]: 0 }), null)
      for (let i = 361; i <= 660; i += 1) render(i, true)
      expect(positions.at(-1)!.every((y, i) => Math.abs(y - home[i]) < 0.01)).toBe(true)
    }
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

describe('uploaded SVG runtime', () => {
  it('renders selected SVG contours, clears missing geometry, and uses the existing choreography without Pattern Change', () => {
    const source = compileXyScopeSvg('svg-1', '<svg><path d="M0 0L100 0L100 100Z"/><path d="M150 0L170 70"/></svg>')
    const settings = normalizeXyScopeSettings({ ...DEFAULT_XY_SCOPE_SETTINGS, sourceMode:'svg', svgMediaId:'svg-1', parameters: { ...DEFAULT_XY_SCOPE_SETTINGS.parameters, patternChange:false, bpmSync:false, minPieceSize:0 } })
    const runtime = makeRuntime(settings)
    expect(runtime.getStatus().points).toBe(0)
    runtime.setSettings(settings,null,source)
    expect(runtime.getStatus().letters).toBe(2)
    expect(runtime.getStatus().points).toBeGreaterThan(100)
    const draw = vi.spyOn(XyScopeBeamRenderer.prototype,'draw')
    runtime.renderFrame({nowSec:0,context:null,fresh:false,stereo:null,playing:false})
    const still = Array.from(draw.mock.calls.at(-1)![1][0].x)
    for(let i=1;i<180;i++) runtime.renderFrame({nowSec:i/60,context:context(),fresh:true,stereo:null,playing:true})
    const moving = Array.from(draw.mock.calls.at(-1)![1][0].x)
    expect(moving).not.toEqual(still)
    expect(runtime.getStatus().pattern).toBe('word')
    runtime.setSettings(settings,null,null)
    expect(runtime.getStatus().points).toBe(0)
    runtime.dispose()
  })
})

it('respects the Audio Intelligence kick-response gain for SVG beam hits', () => {
  const svg=compileXyScopeSvg('hit-svg','<svg><path d="M0 0L100 0L100 100Z"/></svg>')
  const flashes: number[]=[]
  for(const gain of [0,1]) {
    const settings=normalizeXyScopeSettings({...DEFAULT_XY_SCOPE_SETTINGS,sourceMode:'svg',svgMediaId:'hit-svg',parameters:{...DEFAULT_XY_SCOPE_SETTINGS.parameters,kickResponse:gain,patternChange:false}})
    const runtime=makeRuntime(settings);runtime.setSettings(settings,null,svg)
    const draw=vi.spyOn(XyScopeBeamRenderer.prototype,'draw')
    runtime.renderFrame({nowSec:1,context:context({kick:true,kickStrength:.8}),fresh:true,stereo:null,playing:true})
    flashes.push(draw.mock.calls.at(-1)![2][0]);runtime.dispose();draw.mockRestore()
  }
  expect(flashes[0]).toBe(0);expect(flashes[1]).toBeGreaterThan(0)
})


describe('Text V2 runtime integration', () => {
  it('changes words from musical evidence, holds on pause and skips the legacy repeating choreography', () => {
    const settings = normalizeXyScopeSettings({ sourceMode: 'textV2', text: 'AA', additionalTexts: ['BBB', 'CCCC'] })
    const runtime = makeRuntime(settings)
    const draw = vi.spyOn(XyScopeBeamRenderer.prototype, 'draw')
    const c = context({ energy: .7, bass: .8 })
    c.confidence.phrase = .9
    runtime.renderFrame({ nowSec: 0, context: c, fresh: true, stereo: null, playing: true })
    for (let i = 1; i < 20; i++) runtime.renderFrame({ nowSec: i * 10, context: c, fresh: true, stereo: null, playing: true })
    expect(runtime.getStatus().text).toBe('AA')
    const phrase = { ...c, phraseIndex: c.phraseIndex + 1 }
    runtime.renderFrame({ nowSec: 201, context: phrase, fresh: true, stereo: null, playing: true })
    expect(runtime.getStatus().text).not.toBe('AA')
    expect(runtime.getStatus().textV2).toMatchObject({ grouping: 'both', autoPerformance: true })
    const selected = runtime.getStatus().text
    const paused = { ...phrase, phraseIndex: phrase.phraseIndex + 1 }
    runtime.renderFrame({ nowSec: 202, context: paused, fresh: true, stereo: null, playing: false })
    runtime.renderFrame({ nowSec: 203, context: paused, fresh: true, stereo: null, playing: true })
    expect(runtime.getStatus().text).toBe(selected)
    const buffers = draw.mock.calls.at(-1)![1]
    expect(buffers.every(buffer => buffer.form.every(value => value === 0) && buffer.gap.every(value => value === 0))).toBe(true)
    expect(draw.mock.calls.at(-1)![4]).toMatchObject({ widthPx: expect.any(Number), scanPhase: expect.any(Number) })
    expect(settings.text).toBe('AA')
    expect(settings.additionalTexts).toEqual(['BBB', 'CCCC'])
    runtime.reset()
    expect(runtime.getStatus().text).toBe('AA')
  })
})
