import { describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { MutagenPerformanceController } from './MutagenPerformanceController'
import { CANVAS_PRESET_BY_ID } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { mergeReactStoreState, normalizeCanvasPresetSettings, useReactStore } from '../../../../../stores/reactStore'
import { DEFAULT_CANVAS_MUTAGEN_SETTINGS as defaults, MUTAGEN_PATTERNS, MUTAGEN_SETTINGS_VERSION, normalizeCanvasMutagenSettings } from './MutagenSettings'
import { MutagenPatternTransition, resolveMutagenFramePlan, resolveMutagenQualityPlan } from './MutagenRenderPlan'
import { MutagenRenderer, type MutagenFrame } from './MutagenRenderer'

describe('MUTAGEN pattern recipes and resource plans', () => {
  it('has eight stable validated IDs and migrates every Phase 1 authored value', () => {
    expect(MUTAGEN_PATTERNS).toEqual(['liquify', 'vortex', 'particulate', 'terraform', 'fracture', 'spectralTear', 'recursion', 'morph'])
    for (const pattern of MUTAGEN_PATTERNS) expect(normalizeCanvasMutagenSettings({ pattern }).pattern).toBe(pattern)
    const old = { version: 1, pattern: 'liquify', mutation: 0.31, flowSpeed: 2, feedback: 0.2, sourceMix: 0.4, preserveColors: false, quality: 'low' }
    expect(normalizeCanvasMutagenSettings(old)).toEqual({ ...defaults, ...old, version: MUTAGEN_SETTINGS_VERSION })
    const hydrated = mergeReactStoreState({ selectedCanvasPresetId: 'canvas-mutagen', canvasPresetSettings: { schemaVersion: 14, mutagen: old } }, useReactStore.getState())
    expect(hydrated.canvasPresetSettings.mutagen).toEqual(normalizeCanvasMutagenSettings(old))
    expect(hydrated.canvasPresetSettings.schemaVersion).toBe(14)
  })

  it('clamps new controls strictly, including integer mode limits and Auto quality', () => {
    expect(normalizeCanvasMutagenSettings({ pattern: 'wrong', quality: 'auto', glow: 2, transitionDuration: 0, terrainHeight: NaN, tearBands: 1000, recursionDepth: -1, cellSize: '0.2', vortexTwist: -4 })).toMatchObject({
      pattern: 'liquify', quality: 'auto', glow: 1, transitionDuration: 0.1, terrainHeight: defaults.terrainHeight, tearBands: 48, recursionDepth: 1, cellSize: defaults.cellSize, vortexTwist: 0,
    })
  })

  it('tracks every new field in canonical provenance', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-mutagen'], exact = normalizeCanvasPresetSettings(preset.settings)
    for (const patch of [{ pattern: 'terraform' as const }, { transitionDuration: 1 }, { glow: 1 }, { terrainHeight: 1 }, { cellSize: 1 }, { vortexTwist: 1 }, { fractureSpread: 1 }, { tearBands: 4 }, { recursionDepth: 1 }, { morphScale: 1 }]) {
      expect(resolveCanvasPresetProvenance(preset, { ...exact, mutagen: { ...exact.mutagen, ...patch } }).status).toBe('modified')
    }
  })

  it.each(['low', 'balanced', 'high', 'auto'] as const)('bounds %s rendering and each specialized algorithm', quality => {
    const plan = resolveMutagenFramePlan({ ...defaults, quality, tearBands: 48, recursionDepth: 6, feedback: 1 }, 1920, 1080)
    expect(plan.heightSteps).toBeLessThanOrEqual(24)
    expect(plan.voronoiCells).toBeLessThanOrEqual(11)
    expect(plan.cells).toBeLessThanOrEqual(120)
    expect(plan.tearBands).toBeLessThanOrEqual(plan.maxTearBands)
    expect(plan.recursionDepth).toBeLessThanOrEqual(plan.maxRecursionDepth)
    expect(plan.feedbackPasses).toBe(1)
    expect(plan.feedback).toBeLessThanOrEqual(0.85)
    expect(plan.maxTargets).toBe(4)
    expect(resolveMutagenQualityPlan('auto', 3840, 2160).tier).toBe('low')
  })

  it('bypasses glow and history for every clean pattern, and history for crossfades', () => {
    for (const pattern of MUTAGEN_PATTERNS) for (const clean of [{ mutation: 0 }, { sourceMix: 1 }]) {
      expect(resolveMutagenFramePlan({ ...defaults, pattern, feedback: 1, glow: 1, ...clean }, 640, 360, true)).toMatchObject({ clean: true, feedbackPasses: 0, feedback: 0, glow: 0, maxDrawPasses: 1 })
    }
    expect(resolveMutagenFramePlan({ ...defaults, feedback: 1 }, 640, 360, true)).toMatchObject({ feedbackPasses: 0, maxDrawPasses: 3 })
  })
})

describe('MUTAGEN bounded pattern transitions', () => {
  it('starts at the old image, reaches both endpoints, and coalesces rapid input without snapping', () => {
    const transition = new MutagenPatternTransition()
    expect(transition.update('liquify', 0, 1)).toMatchObject({ active: false })
    expect(transition.update('vortex', 1, 1)).toEqual({ from: 'liquify', to: 'vortex', mix: 0, active: true })
    expect(transition.update('fracture', 1.5, 1)).toEqual({ from: 'liquify', to: 'vortex', mix: 0.5, active: true })
    expect(transition.update('morph', 2, 1)).toEqual({ from: 'vortex', to: 'morph', mix: 0, active: true })
    expect(transition.update('morph', 3, 1)).toEqual({ from: 'morph', to: 'morph', mix: 1, active: false })
    transition.reset()
    expect(transition.update('terraform', 0, 1)).toMatchObject({ from: 'terraform', to: 'terraform', active: false })
  })
})

function gpu() {
  let id = 0
  const calls: Record<string, ReturnType<typeof vi.fn>> = {}
  const constants: Record<string, number> = {}
  const gl = new Proxy({}, { get(_target, key: string) {
    if (/^[A-Z_0-9]+$/.test(key)) return constants[key] ??= ++id
    return calls[key] ??= vi.fn((...args: unknown[]) => {
      if (key.startsWith('create')) return { id: ++id }
      if (key === 'getShaderParameter' || key === 'getProgramParameter') return true
      if (key === 'getParameter') return 4096
      if (key === 'getUniformLocation') return { name: args[1] }
      if (key === 'checkFramebufferStatus') return constants.FRAMEBUFFER_COMPLETE ??= ++id
      if (key === 'isContextLost') return false
    })
  } }) as WebGL2RenderingContext
  const canvas = { width: 640, height: 360, getContext: vi.fn(() => gl) } as unknown as HTMLCanvasElement
  const source = { width: 640, height: 360 } as HTMLCanvasElement
  const frame: MutagenFrame = { source, settings: { ...defaults, feedback: 0.5 }, timeSec: 0, fitMode: 'contain', sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 } }
  return { gl, calls, canvas, frame }
}

describe('MUTAGEN renderer programs and cleanup', () => {
  it('retains one source upload, at most four targets and nine programs across all switches, then releases everything once', () => {
    const { calls, canvas, frame } = gpu()
    const { renderer } = MutagenRenderer.create(canvas)
    expect(renderer).not.toBeNull()
    renderer!.render(frame)
    for (const [index, pattern] of MUTAGEN_PATTERNS.entries()) {
      for (const offset of [0, 0.7]) renderer!.render({ ...frame, settings: { ...frame.settings, pattern, glow: 0.2 }, timeSec: 2 + index * 2 + offset })
    }
    expect(calls.createTexture).toHaveBeenCalledTimes(5)
    expect(calls.createFramebuffer).toHaveBeenCalledTimes(4)
    expect(calls.createProgram).toHaveBeenCalledTimes(9)
    expect(calls.texImage2D).toHaveBeenCalledTimes(5)
    renderer!.resize(320, 180)
    expect(calls.deleteFramebuffer).toHaveBeenCalledTimes(4)
    renderer!.dispose(); renderer!.dispose()
    expect(calls.deleteTexture).toHaveBeenCalledTimes(5)
    expect(calls.deleteProgram).toHaveBeenCalledTimes(9)
    expect(calls.deleteVertexArray).toHaveBeenCalledTimes(1)
    expect(renderer!.render(frame)).toBe(false)
  })

  it('never reads old-pattern history during a crossfade, and requests premultiplied output alpha', () => {
    const { calls, canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    expect(canvas.getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({ alpha: true, premultipliedAlpha: true }))
    renderer!.render(frame)
    calls.uniform1f.mockClear()
    renderer!.render({ ...frame, settings: { ...frame.settings, pattern: 'terraform' }, timeSec: 1 })
    const historyWeights = calls.uniform1f.mock.calls.filter(([location]) => location.name === 'uFeedback').map(([, value]) => value)
    expect(historyWeights.length).toBeGreaterThan(0)
    expect(historyWeights.every(weight => weight === 0)).toBe(true)
    renderer!.dispose()
  })

  it('maps materially different shared bands into displacement while keeping the exact source texture and authored recipe', () => {
    const { calls, canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    frame.settings = { ...defaults, mutation: 0.35, feedback: 0, audioReactivity: 1 }
    const source = frame.source, authored = JSON.stringify(frame.settings)
    const base = createSharedPerformanceFallbackContext(2)
    const quiet = { ...base, capabilities: { ...base.capabilities, liveBands: true }, confidence: { ...base.confidence, overall: 1 } }
    const loud = { ...quiet, bass: 1, mid: 1, high: 1, intelligence: { ...quiet.intelligence, bands: { ...quiet.intelligence.bands, normalized: { ...quiet.intelligence.bands.normalized, normalizedSub: 1 } } } }
    const decision = (context: typeof quiet) => new MutagenPerformanceController().update({ settings: frame.settings, context, audioActive: true, paused: false, timeSec: 2, deltaSec: 0.05 })
    renderer!.render({ ...frame, performance: decision(quiet) })
    const uniform = (name: string) => calls.uniform1f.mock.calls.filter(([location]) => location.name === name).at(-1)?.[1] as number
    const quietMutation = uniform('uMutation'), quietScale = uniform('uScale')
    renderer!.render({ ...frame, performance: decision(loud) })
    expect(uniform('uMutation')).toBeGreaterThan(quietMutation * 1.3)
    expect(uniform('uScale')).toBeGreaterThan(quietScale)
    expect(calls.texImage2D).toHaveBeenCalledTimes(1)
    expect(frame.source).toBe(source)
    expect(JSON.stringify(frame.settings)).toBe(authored)
    renderer!.dispose()
  })

  it('cold-starts temporal history for exactly six feedback renders after reset', () => {
    const { calls, canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    const weights: number[] = []
    for (let i = 0; i < 8; i++) {
      renderer!.render({ ...frame, timeSec: i / 60 })
      weights.push(calls.uniform1f.mock.calls.filter(([location]) => location.name === 'uFeedback').at(-1)?.[1] as number)
    }
    expect(weights.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
    expect(weights[6]).toBeGreaterThan(0)
    renderer!.resetHistory()
    renderer!.render(frame)
    expect(calls.uniform1f.mock.calls.filter(([location]) => location.name === 'uFeedback').at(-1)?.[1]).toBe(0)
    renderer!.dispose()
  })

  it('uses output viewport quality instead of upgrading a downscaled 4K Auto frame, and exposes bounded accounting', () => {
    const { canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    renderer!.resize(960, 540)
    renderer!.render({ ...frame, settings: { ...frame.settings, quality: 'auto' }, qualityViewport: { width: 3840, height: 2160 } })
    expect(renderer!.getDiagnostics()).toMatchObject({ quality: 'low', sourceTextureBytes: 640 * 360 * 4, feedbackTargets: 2, targetBytes: 2 * 480 * 270 * 4 })
    renderer!.dispose()
    expect(renderer!.getDiagnostics()).toMatchObject({ sourceTextureBytes: 0, targetBytes: 0, programs: 0, disposed: true })
  })

  it('fails source allocation locally instead of publishing a successful black texture', () => {
    const { gl, canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    vi.mocked(gl.getError).mockReturnValueOnce(gl.OUT_OF_MEMORY)
    expect(() => renderer!.render(frame)).toThrow('source upload failed')
    renderer!.dispose()
  })

  it('cleans a partially allocated framebuffer on failure', () => {
    const { gl, calls, canvas, frame } = gpu(), { renderer } = MutagenRenderer.create(canvas)
    vi.mocked(gl.checkFramebufferStatus).mockReturnValueOnce(-1)
    expect(() => renderer!.render(frame)).toThrow('framebuffer incomplete')
    renderer!.dispose()
    expect(calls.deleteTexture).toHaveBeenCalledTimes(2)
    expect(calls.deleteFramebuffer).toHaveBeenCalledTimes(1)
  })
})
