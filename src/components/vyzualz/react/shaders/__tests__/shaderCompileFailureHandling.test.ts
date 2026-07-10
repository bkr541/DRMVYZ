import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShaderEngineRenderer } from '../ShaderEngineRenderer'
import { shaderRegistry } from '../registry'
import type { CompiledGraph, RenderGraphError } from '../rendergraph/shaderRenderGraphTypes'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Shader scene compile failure handling', () => {
  it('logs scene identity, stage, and compiler error without replacing the active valid graph', () => {
    const requested = shaderRegistry.get('shader-riddim-railgun-sequencer')!
    const currentGraph = { shaderId: 'shader-neon-tunnel', passes: [], isSinglePass: true } satisfies CompiledGraph
    const currentDef = shaderRegistry.get('shader-neon-tunnel')!
    const compileError: RenderGraphError = {
      shaderId: requested.id,
      passId: '__single__',
      code: 'PROGRAM_COMPILE_FAIL',
      message: `Shader "${requested.id}" single-pass program failed to compile.`,
      programError: {
        stage: 'fragment',
        label: `${requested.id}/__single__/frag`,
        log: "ERROR: 0:42: 'active' : Reserved word.",
      },
    }

    const renderer = Object.create(ShaderEngineRenderer.prototype) as unknown as {
      _compiler: { compile: () => { graph: null; error: RenderGraphError } }
      _activeGraph: CompiledGraph
      _activeSceneId: string
      _activeDef: typeof currentDef
      _activateScene: (id: string, store: unknown) => void
    }
    renderer._compiler = { compile: () => ({ graph: null, error: compileError }) }
    renderer._activeGraph = currentGraph
    renderer._activeSceneId = currentDef.id
    renderer._activeDef = currentDef

    const store = {
      setCompileStatus: vi.fn(),
      setCompileError: vi.fn(),
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderer._activateScene(requested.id, store)

    expect(renderer._activeGraph).toBe(currentGraph)
    expect(renderer._activeSceneId).toBe(currentDef.id)
    expect(renderer._activeDef).toBe(currentDef)
    expect(store.setCompileError).toHaveBeenCalledWith(compileError.programError!.log)
    expect(store.setCompileStatus).toHaveBeenLastCalledWith({
      state: 'error',
      errorLog: compileError.programError!.log,
      compiledDefId: requested.id,
    })

    const diagnostic = String(consoleError.mock.calls[0]?.[0])
    expect(diagnostic).toContain(`Scene ID: ${requested.id}`)
    expect(diagnostic).toContain(`Scene name: ${requested.name}`)
    expect(diagnostic).toContain('Shader stage: fragment')
    expect(diagnostic).toContain(`Compiler error: ${compileError.programError!.log}`)
  })
})
