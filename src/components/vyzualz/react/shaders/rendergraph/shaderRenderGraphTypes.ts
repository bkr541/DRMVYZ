import type { ShaderProgramError } from '../runtime/shaderRuntimeTypes'
import type { BlendMode, FilterMode, WrapMode } from '../registry/shaderRegistryTypes'
import type { ShaderProgram } from '../runtime/ShaderProgram'

export type { BlendMode, FilterMode, WrapMode }

// ── Compile errors ────────────────────────────────────────────────────────────

export type RenderGraphErrorCode =
  | 'NO_SOURCE'            // neither fragSrc nor passes[] provided
  | 'MISSING_DEPENDENCY'   // dependsOn references a pass that does not exist
  | 'DEPENDENCY_CYCLE'     // cyclic pass dependency detected
  | 'INVALID_INPUT'        // input name not found in textureInputs or any pass output
  | 'PROGRAM_COMPILE_FAIL' // GLSL compile or link error in a pass

export interface RenderGraphError {
  shaderId: string
  passId?: string
  code: RenderGraphErrorCode
  message: string
  programError?: ShaderProgramError
}

// ── Compiled graph ────────────────────────────────────────────────────────────

/** Explicit binding from a texture source to a GLSL sampler uniform. */
export interface CompiledPassInputBinding {
  /** Key in the texMap (logical output name or textureInput name). */
  source: string
  /** Exact GLSL sampler2D uniform name in the pass program. */
  uniformName: string
}

export interface CompiledPassNode {
  passId: string
  program: ShaderProgram
  /**
   * Explicit input bindings for this pass.
   * Each binding maps a texture source (texMap key) to a GLSL sampler uniform.
   */
  inputs: CompiledPassInputBinding[]
  /**
   * Logical output name for intermediate passes.
   * null on the last pass — it renders directly to the default framebuffer.
   */
  outputName: string | null
  resolutionScale: number   // clamped to [0.05, 4.0]
  clearBeforeRender: boolean
  blendMode: BlendMode
  filter: FilterMode
  wrap: WrapMode
  persistent: boolean       // keep this FBO alive between frames
  pingPong: boolean         // use a ShaderPingPongBuffer instead of a single FBO
}

export interface CompiledGraph {
  shaderId: string
  /** Passes in topological execution order. Last entry renders to screen. */
  passes: CompiledPassNode[]
  isSinglePass: boolean
}

export type GraphCompileResult =
  | { graph: CompiledGraph; error: null }
  | { graph: null; error: RenderGraphError }

// ── Debug info ────────────────────────────────────────────────────────────────

export interface RenderPassInfo {
  passId: string
  dimensions: { w: number; h: number }
  /** Human-readable "source → uniformName" strings, one per input binding. */
  inputs: string[]
  outputTarget: 'screen' | 'framebuffer'
  persistent: boolean
  pingPong: boolean
  lastDurationMs: number | null
}

export interface RenderGraphResourceStats {
  /** Temporary FBOs currently checked out from the pool. */
  tempFboCount:        number
  /** Persistent single FBOs owned by the graph. */
  persistentFboCount:  number
  /** Ping-pong buffer PAIRS (each pair = 2 FBOs). */
  pingPongPairCount:   number
}

export interface RenderGraphInfo {
  shaderId: string
  passCount: number
  passes: RenderPassInfo[]
  /** Total live render target count (temp + persistent + ping-pong×2). */
  pooledResourceCount: number
  resourceStats: RenderGraphResourceStats
  lastExecutionMs: number | null
}
