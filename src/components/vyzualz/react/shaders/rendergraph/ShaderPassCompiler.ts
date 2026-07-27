import type { ShaderDefinition, ShaderPassDef, ShaderPassInputBinding } from '../registry/shaderRegistryTypes'
import type { TextureFormat } from '../runtime/shaderRuntimeTypes'
import { ShaderCompiler } from '../runtime/ShaderCompiler'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import {
  detectShaderFloatTargetCapability,
  resolveShaderTextureFormat,
  type ShaderFloatTargetCapability,
} from '../runtime/ShaderCapabilities'
import type { QualityProfile } from '../performance/shaderPerformanceTypes'
import type {
  CompiledGraph,
  CompiledPassInputBinding,
  CompiledPassNode,
  GraphCompileResult,
} from './shaderRenderGraphTypes'

// ── Constants ─────────────────────────────────────────────────────────────────

export const PASS_SCALE_MIN = 0.05
export const PASS_SCALE_MAX = 4.0

function clampScale(s: number): number {
  return s < PASS_SCALE_MIN ? PASS_SCALE_MIN : s > PASS_SCALE_MAX ? PASS_SCALE_MAX : s
}

/**
 * How many of a scene's declared bloomTier passes are "active" at a given
 * quality profile. Derived directly from the existing, previously-unused
 * QualityProfile.bloomResolution field (0.25/0.5/0.75/1.0 across
 * low/medium/high/ultra) so bloom tiers degrade in lockstep with every other
 * quality-scaled effect.
 */
export function resolveActiveBloomTierCount(profile: QualityProfile): number {
  return Math.max(1, Math.min(3, Math.round(profile.bloomResolution * 4)))
}

// ── Topological sort ──────────────────────────────────────────────────────────

export type TopoSortResult =
  | { order: ShaderPassDef[]; cycle: null }
  | { order: null; cycle: string[] }

/**
 * Topologically sort shader passes by their dependsOn relationships.
 * Producers appear before consumers in the returned order.
 * Returns a cycle path if one is detected.
 */
export function topologicalSort(passes: ShaderPassDef[]): TopoSortResult {
  const passMap = new Map(passes.map(p => [p.id, p]))
  const visited   = new Set<string>()
  const inStack   = new Set<string>()
  const order: ShaderPassDef[] = []

  function visit(id: string, path: string[]): string[] | null {
    if (visited.has(id)) return null
    if (inStack.has(id)) return [...path, id]

    const pass = passMap.get(id)
    if (!pass) return null  // missing dep reported separately

    inStack.add(id)
    for (const dep of pass.dependsOn ?? []) {
      const cycle = visit(dep, [...path, id])
      if (cycle) return cycle
    }
    inStack.delete(id)
    visited.add(id)
    order.push(pass)
    return null
  }

  for (const pass of passes) {
    const cycle = visit(pass.id, [])
    if (cycle) return { order: null, cycle }
  }

  return { order, cycle: null }
}

// ── ShaderPassCompiler ────────────────────────────────────────────────────────

/**
 * Compiles a ShaderDefinition into a topologically-sorted CompiledGraph.
 *
 * Responsibilities:
 *   - Validate source availability and pass dependency references
 *   - Detect dependency cycles
 *   - Verify all pass inputs resolve to a textureInput or a prior pass output
 *   - Compile each pass's ShaderProgram
 *   - Clean up on partial failure (no GPU leaks)
 *
 * The compiler is bound to a single WebGL2 context at construction time.
 */
export class ShaderPassCompiler {
  private readonly _gl:           WebGL2RenderingContext
  private readonly _compiler:     ShaderCompiler
  private readonly _capability:   ShaderFloatTargetCapability

  constructor(gl: WebGL2RenderingContext) {
    this._gl         = gl
    this._compiler   = new ShaderCompiler(gl)
    this._capability = detectShaderFloatTargetCapability(gl)
  }

  /** Capability probe used to resolve rgba16f/rgba32f pass formats. Exposed for diagnostics. */
  get floatTargetCapability(): ShaderFloatTargetCapability { return this._capability }

  /**
   * @param qualityProfile  When supplied, any pass with `bloomTier` beyond
   *   what this profile affords (see resolveActiveBloomTierCount) has its
   *   resolutionScale floored to PASS_SCALE_MIN rather than removed from the
   *   graph — the pass still executes (dependency wiring stays valid) but at
   *   a near-free resolution. Omitting this parameter preserves every pass's
   *   authored resolutionScale unchanged.
   */
  compile(def: ShaderDefinition, qualityProfile?: QualityProfile): GraphCompileResult {
    const shaderId = def.id

    if (!def.fragSrc && (!def.passes || def.passes.length === 0)) {
      return {
        graph: null,
        error: {
          shaderId,
          code: 'NO_SOURCE',
          message: `Shader "${shaderId}" has neither fragSrc nor a passes[] array.`,
        },
      }
    }

    return def.passes && def.passes.length > 0
      ? this._compileMultiPass(def, qualityProfile)
      : this._compileSinglePass(def)
  }

  // ── Single-pass ───────────────────────────────────────────────────────────

  private _compileSinglePass(def: ShaderDefinition): GraphCompileResult {
    const shaderId = def.id
    const label    = `${shaderId}/__single__`
    const vertSrc  = resolveVertSrc(def.vertSrc)

    const result = ShaderProgram.create(this._gl, this._compiler, {
      vertSrc, fragSrc: def.fragSrc!, label,
    })

    if (result.program === null) {
      return {
        graph: null,
        error: {
          shaderId,
          passId: '__single__',
          code: 'PROGRAM_COMPILE_FAIL',
          message: `Shader "${shaderId}" single-pass program failed to compile.`,
          programError: result.error,
        },
      }
    }

    const node: CompiledPassNode = {
      passId:            '__single__',
      program:           result.program,
      inputs:            (def.textureInputs ?? []).map(ti => normalizeInput(ti.name)),
      outputName:        null,  // → default framebuffer (screen)
      resolutionScale:   1.0,
      clearBeforeRender: true,
      blendMode:         'none',
      filter:            'linear',
      wrap:              'clamp',
      persistent:        false,
      pingPong:          false,
      format:            'rgba8', // renders to screen — format is inert but kept defined for type completeness
      drawKind:          'fullscreen',
      bloomTier:         null,
    }

    return { graph: { shaderId, passes: [node], isSinglePass: true }, error: null }
  }

  // ── Multi-pass ────────────────────────────────────────────────────────────

  private _compileMultiPass(def: ShaderDefinition, qualityProfile?: QualityProfile): GraphCompileResult {
    const shaderId = def.id
    const passes   = def.passes!
    const defaultFloatFormat: TextureFormat = def.quality?.requiresFloatTarget ? 'rgba16f' : 'rgba8'
    const activeBloomTiers = qualityProfile ? resolveActiveBloomTierCount(qualityProfile) : Infinity
    const devWarn = (message: string) => {
      if (import.meta.env.DEV) console.warn(message)
    }

    // Build output-owner map: output name → the pass that produces it
    const outputOwner = new Map<string, string>(passes.map(p => [p.output, p.id]))

    // Validate that all dependsOn references exist
    const passIds = new Set(passes.map(p => p.id))
    for (const pass of passes) {
      for (const dep of pass.dependsOn ?? []) {
        if (!passIds.has(dep)) {
          return {
            graph: null,
            error: {
              shaderId,
              passId: pass.id,
              code: 'MISSING_DEPENDENCY',
              message: `Pass "${pass.id}" in shader "${shaderId}" has dependsOn "${dep}" which does not exist.`,
            },
          }
        }
      }
    }

    // Validate that all inputs resolve to a textureInput name or a pass output
    const textureInputNames = new Set((def.textureInputs ?? []).map(ti => ti.name))
    const passOutputNames   = new Set(passes.map(p => p.output))
    for (const pass of passes) {
      for (const raw of pass.inputs) {
        const src = typeof raw === 'string' ? raw : raw.source
        if (!textureInputNames.has(src) && !passOutputNames.has(src)) {
          return {
            graph: null,
            error: {
              shaderId,
              passId: pass.id,
              code: 'INVALID_INPUT',
              message: `Input "${src}" in pass "${pass.id}" of shader "${shaderId}" is not declared in textureInputs or produced by any pass.`,
            },
          }
        }
      }
    }

    // Augment dependsOn with implicit deps inferred from inputs:
    // if pass B reads input X and pass A produces output X, B implicitly depends on A.
    const augmented = passes.map(pass => {
      const implicit = pass.inputs
        .map(raw => outputOwner.get(typeof raw === 'string' ? raw : raw.source))
        .filter((id): id is string => id !== undefined && id !== pass.id)
      if (implicit.length === 0) return pass
      const merged = [...new Set([...(pass.dependsOn ?? []), ...implicit])]
      return { ...pass, dependsOn: merged }
    })

    // Topological sort
    const topo = topologicalSort(augmented)
    if (topo.cycle !== null) {
      return {
        graph: null,
        error: {
          shaderId,
          code: 'DEPENDENCY_CYCLE',
          message: `Dependency cycle in shader "${shaderId}": ${topo.cycle.join(' → ')}.`,
        },
      }
    }

    const sorted    = topo.order
    const defVertSrc = resolveVertSrc(def.vertSrc)
    const compiled: CompiledPassNode[] = []

    for (let i = 0; i < sorted.length; i++) {
      const pass   = sorted[i]
      const isLast = i === sorted.length - 1
      const label  = `${shaderId}/${pass.id}`
      const vertSrc = pass.vertSrc ? resolveVertSrc(pass.vertSrc) : defVertSrc

      const result = ShaderProgram.create(this._gl, this._compiler, {
        vertSrc, fragSrc: pass.fragSrc, label,
      })

      if (result.program === null) {
        // Prevent GPU leaks on partial failure
        for (const node of compiled) node.program.dispose()
        return {
          graph: null,
          error: {
            shaderId,
            passId: pass.id,
            code: 'PROGRAM_COMPILE_FAIL',
            message: `Pass "${pass.id}" in shader "${shaderId}" failed to compile.`,
            programError: result.error,
          },
        }
      }

      const blendMode = pass.blendMode ?? 'none'
      const requestedFormat = pass.format ?? defaultFloatFormat
      const resolvedFormat = isLast
        ? 'rgba8' // last pass always renders to the screen's default framebuffer
        : resolveShaderTextureFormat(requestedFormat, blendMode !== 'none', this._capability, devWarn)

      const bloomTier = pass.bloomTier ?? null
      const scaleFlooredForQuality = bloomTier !== null && bloomTier > activeBloomTiers
      const resolutionScale = scaleFlooredForQuality
        ? PASS_SCALE_MIN
        : clampScale(pass.resolutionScale ?? 1.0)

      compiled.push({
        passId:            pass.id,
        program:           result.program,
        inputs:            pass.inputs.map(normalizeInput),
        outputName:        isLast ? null : pass.output,
        resolutionScale,
        clearBeforeRender: pass.clearBeforeRender ?? true,
        blendMode,
        filter:            pass.filter     ?? 'linear',
        wrap:              pass.wrap       ?? 'clamp',
        persistent:        pass.persistent ?? false,
        pingPong:          pass.pingPong   ?? false,
        format:            resolvedFormat,
        drawKind:          pass.drawKind   ?? 'fullscreen',
        bloomTier,
      })
    }

    return { graph: { shaderId, passes: compiled, isSinglePass: false }, error: null }
  }

  // ── Static helpers ────────────────────────────────────────────────────────

  /** Dispose all ShaderPrograms in a compiled graph. */
  static disposeGraph(graph: CompiledGraph): void {
    for (const node of graph.passes) node.program.dispose()
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function resolveVertSrc(vertSrc?: string | 'shared'): string {
  return (!vertSrc || vertSrc === 'shared') ? FULLSCREEN_VERT_SRC : vertSrc
}

/** Convert hyphens to underscores so logical names become valid GLSL identifiers. */
function sanitizeUniform(name: string): string {
  return name.replace(/-/g, '_')
}

/** Normalize a raw pass input (string or explicit binding) to a CompiledPassInputBinding. */
function normalizeInput(raw: string | ShaderPassInputBinding): CompiledPassInputBinding {
  if (typeof raw === 'string') {
    return { source: raw, uniformName: sanitizeUniform(raw) }
  }
  return { source: raw.source, uniformName: raw.uniformName }
}
