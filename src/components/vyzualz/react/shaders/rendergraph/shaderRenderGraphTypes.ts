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

export interface CompiledPassNode {
  passId: string
  program: ShaderProgram
  /**
   * Logical input names from ShaderPassDef.inputs, in declaration order.
   * Each maps to a GLSL sampler uniform of the same name (hyphens → underscores).
   */
  inputs: string[]
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
  inputs: string[]
  outputTarget: 'screen' | 'framebuffer'
  lastDurationMs: number | null
}

export interface RenderGraphInfo {
  shaderId: string
  passCount: number
  passes: RenderPassInfo[]
  pooledResourceCount: number
  lastExecutionMs: number | null
}
