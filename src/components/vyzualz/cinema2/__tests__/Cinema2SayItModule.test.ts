import { describe, expect, it, vi } from 'vitest'
import type { Cinema2JsonValue } from '../contracts/Cinema2NativePresetManifest'
import { cinema2SayItNativeModuleDefinition, createCinema2SayItNativeModuleDefinition, type Cinema2SayItModuleInspection } from '../modules/Cinema2SayItNativeModule'
import type { Cinema2ModuleCreateContext, Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from '../presets/Cinema2SayItPreset'

const frame: Readonly<Cinema2ModuleFrameReadContext> = Object.freeze({
  frameId: 1,
  timestampMs: 16,
  deltaTimeSec: 1 / 60,
  elapsedTimeSec: 1,
  viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
  contextGeneration: 1,
  audio: null,
  director: null,
})

describe('Cinema 2.0 SAY IT native module text updates', () => {
  it('reflows live one/two-line edits and reports bounded fallback behavior before GPU loading', () => {
    const moduleManifest = CINEMA2_SAY_IT_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    const parameters = {
      get: (name: string) => values.get(name),
      getAuthored: (name: string) => values.get(name),
      resolve: () => null,
    }
    const instance = cinema2SayItNativeModuleDefinition.create({
      module: moduleManifest,
      parameters,
      targets: {},
      media: {},
      resources: {},
      randomness: {},
    } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof cinema2SayItNativeModuleDefinition.create> & { inspect(): Cinema2SayItModuleInspection }

    values.set('line1Text', 'HELLO')
    values.set('line2Text', 'WORLD')
    values.set('motionProgram', 'hinge')
    values.set('motionSafety', 'reduced')
    values.set('materialStyle', 'neon')
    instance.lifecycle.update({ frame, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({
      state: 'idle', text: 'HELLO\nWORLD', lineCount: 2, visibleGlyphCount: 10,
      motionProgram: 'hinge', motionSafety: 'reduced', materialStyle: 'neon',
      truncated: false, replacementCount: 0,
    })

    values.set('lineMode', 'one')
    values.set('line1Text', 'ABCDEFGHIJKLM 🚀')
    instance.lifecycle.update({ frame: { ...frame, frameId: 2 }, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({ text: 'ABCDEFGHIJKL', lineCount: 1, visibleGlyphCount: 12, truncated: true })
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_TEXT_TRUNCATED' }),
    ]))

    values.set('lineMode', 'two')
    values.set('line1Text', 'GO')
    values.set('line2Text', '🚀')
    instance.lifecycle.update({ frame: { ...frame, frameId: 3 }, parameters, targets: {} as never })
    expect(instance.inspect()).toMatchObject({ text: 'GO\n?', replacementCount: 1, truncated: false })
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_UNSUPPORTED_CHARACTERS' }),
    ]))
    instance.lifecycle.dispose()
  })

  it('prewarms before the first visible frame, applies quality budgets and releases resources', async () => {
    const moduleManifest = CINEMA2_SAY_IT_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    const parameters = {
      get: (name: string) => values.get(name),
      getAuthored: (name: string) => values.get(name),
      resolve: () => null,
    }
    values.set('line1Text', 'ABCDEFGHIJKL')
    values.set('line2Text', '12345678')

    const release = vi.fn()
    const disposeBridge = vi.fn()
    const draw = vi.fn()
    const prewarm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    const reportGpuBytes = vi.fn()
    const bridge = { prewarm, draw, dispose: disposeBridge, estimateGpuBytes: () => 6 * 1024 * 1024 }
    const asset = { id: 'cinema2-say-it-glyphs', scene: {} as never, triangleCount: 57_482, gpuBytes: 2_000_000 }
    let disposeLease: (() => void) | null = null
    let clock = 0
    const definition = createCinema2SayItNativeModuleDefinition({
      assets: { acquire: vi.fn().mockResolvedValue(asset), release },
      loadLibrary: vi.fn().mockResolvedValue({} as never),
      createBridge: () => bridge,
      now: () => ++clock,
    })
    const resources = {
      acquire: (_key: string, _kind: string, create: (gl: WebGL2RenderingContext) => typeof bridge, dispose: (value: typeof bridge) => void) => {
        const value = create({} as WebGL2RenderingContext)
        disposeLease = () => dispose(value)
        return value
      },
      reportGpuBytes,
      getSnapshot: () => ({ activeLeaseCount: 1, disposedLeaseCount: 0, estimatedGpuBytes: 0 }),
    }
    const instance = definition.create({
      module: moduleManifest,
      parameters,
      targets: {},
      media: {},
      resources,
      randomness: {},
    } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof definition.create> & { inspect(): Cinema2SayItModuleInspection }
    instance.lifecycle.update({ frame, parameters, targets: {} as never })

    const lowExecution = { depthAvailable: true, lightingEnvironment: { quality: 'low' } } as never
    instance.render!.providers[0]!.execute(lowExecution)
    await vi.waitFor(() => expect(instance.inspect().state).toBe('building'))
    instance.render!.providers[0]!.execute(lowExecution)
    expect(instance.inspect().state).toBe('prewarming')
    expect(draw).not.toHaveBeenCalled()

    instance.render!.providers[0]!.execute(lowExecution)
    expect(draw).toHaveBeenCalledTimes(1)
    expect(draw.mock.calls[0]?.[1].poses).toHaveLength(20)
    expect(instance.inspect()).toMatchObject({
      state: 'ready', quality: 'low', visibleGlyphCount: 20, renderedGlyphCount: 20,
      performance: { drawSampleCount: 1, estimatedGpuBytes: 6 * 1024 * 1024 },
    })
    expect(instance.getDiagnostics?.()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_QUALITY_GLYPH_BUDGET' }),
    ]))
    expect(reportGpuBytes).toHaveBeenCalledWith(6 * 1024 * 1024)

    instance.lifecycle.dispose()
    expect(disposeLease).not.toBeNull()
    disposeLease!()
    expect(disposeBridge).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledWith(asset)
  })

  it('fails gracefully with a stable diagnostic when the glyph asset cannot load', async () => {
    const moduleManifest = CINEMA2_SAY_IT_PRESET_MANIFEST.modules![0]!
    const values = new Map<string, Cinema2JsonValue>(Object.entries(moduleManifest.parameters ?? {}))
    const parameters = {
      get: (name: string) => values.get(name),
      getAuthored: (name: string) => values.get(name),
      resolve: () => null,
    }
    const definition = createCinema2SayItNativeModuleDefinition({
      assets: { acquire: vi.fn().mockRejectedValue(new Error('offline')), release: vi.fn() },
      loadLibrary: vi.fn().mockResolvedValue({} as never),
    })
    const instance = definition.create({
      module: moduleManifest,
      parameters,
      targets: {},
      media: {},
      resources: { reportGpuBytes: vi.fn() },
      randomness: {},
    } as unknown as Cinema2ModuleCreateContext) as ReturnType<typeof definition.create> & { inspect(): Cinema2SayItModuleInspection }

    instance.render!.providers[0]!.execute({ lightingEnvironment: { quality: 'high' } } as never)
    await vi.waitFor(() => expect(instance.inspect().state).toBe('failed'))
    expect(instance.getDiagnostics?.()).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_SAY_IT_LOAD_FAILED', message: expect.stringContaining('offline') }),
    ]))
    instance.lifecycle.dispose()
  })
})
