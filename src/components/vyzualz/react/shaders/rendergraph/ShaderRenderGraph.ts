import type { RuntimeDimensions } from '../runtime/shaderRuntimeTypes'
import type { ShaderProgram } from '../runtime/ShaderProgram'
import { ShaderFramebuffer } from '../runtime/ShaderFramebuffer'
import { FullscreenPass } from '../runtime/FullscreenPass'
import type { CompiledGraph, RenderGraphInfo, RenderPassInfo } from './shaderRenderGraphTypes'
import { ShaderFramebufferPool } from './ShaderFramebufferPool'
import { ShaderRenderPass } from './ShaderRenderPass'
import { ShaderPingPongBuffer } from '../feedback/ShaderPingPongBuffer'

// ── ShaderRenderGraph ─────────────────────────────────────────────────────────

/**
 * Executes a CompiledGraph each render frame.
 *
 * Resource ownership:
 *   - Temporary FBOs borrow from ShaderFramebufferPool and are returned after
 *     every frame — no pool allocation in the hot path once warm.
 *   - Persistent FBOs (pass.persistent) are owned directly and survive frames.
 *   - Ping-pong buffers (pass.pingPong) use ShaderPingPongBuffer and are NEVER
 *     passed to the pool.  They survive frames and are disposed on loadGraph().
 *   - Programs are owned by CompiledPassNode; dispose via
 *     ShaderPassCompiler.disposeGraph() when swapping scenes.
 *
 * Ping-pong protocol (per frame per ping-pong pass):
 *   1. Seed texMap with readTexture (prev frame) under the pass's outputName —
 *      this lets the pass read its own prior output as an input.
 *   2. Render to writeFbo.
 *   3. Call swap() — write becomes read for the next frame.
 *   4. Update texMap with the new readTexture so downstream passes see the
 *      freshly written result.
 *
 * Input texture naming:
 *   CompiledPassNode.inputs is a list of logical names.  Each is used as both
 *   the texMap key and the GLSL sampler uniform name (hyphens → underscores).
 */
export class ShaderRenderGraph {
  private readonly _pool:   ShaderFramebufferPool
  private readonly _fsPass: FullscreenPass

  private _passes:      ShaderRenderPass[] = []
  private _activeGraph: CompiledGraph | null = null

  // Persistent single FBOs keyed by outputName.
  private readonly _persistentFbos  = new Map<string, ShaderFramebuffer>()
  // Ping-pong pairs keyed by outputName. Never released to pool.
  private readonly _pingPongBuffers = new Map<string, ShaderPingPongBuffer>()

  private _lastExecMs:     number | null = null
  private _lastPassDims:  Map<string, { w: number; h: number }> = new Map()
  // When set, the final screen pass renders to this FBO instead of the canvas.
  // Used exclusively by ShaderTransitionRenderer to capture scene output during transitions.
  private _outputFboOverride: WebGLFramebuffer | null | undefined = undefined

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._pool   = new ShaderFramebufferPool(_gl)
    this._fsPass = new FullscreenPass(_gl)
  }

  /**
   * Redirect the final screen pass to the given FBO instead of the canvas.
   * Pass `undefined` (or call with no argument) to restore normal screen rendering.
   * Used exclusively by ShaderTransitionRenderer during dual-scene capture.
   */
  setOutputFbo(fbo: WebGLFramebuffer | null | undefined): void {
    this._outputFboOverride = fbo
  }

  /**
   * Load a new compiled graph.  Call when a scene is activated or recompiled.
   * Disposes all ping-pong and persistent FBOs from the previous scene.
   */
  loadGraph(compiled: CompiledGraph): void {
    this._passes      = compiled.passes.map(n => new ShaderRenderPass(this._gl, this._fsPass, n))
    this._activeGraph = compiled
    this._disposePersistentFbos()
    this._disposePingPongBuffers()
  }

  /**
   * Execute the active graph for one frame.
   *
   * @param dims              Current render target dimensions.
   * @param externalTextures  Logical name → WebGLTexture for declared textureInputs.
   * @param applyUniforms     Called on each pass's ShaderProgram after activation.
   */
  execute(
    dims:             RuntimeDimensions,
    externalTextures: ReadonlyMap<string, WebGLTexture>,
    applyUniforms:    (program: ShaderProgram) => void,
  ): void {
    if (this._passes.length === 0) {
      this._renderBlack(dims)
      return
    }

    const t0 = performance.now()

    const texMap = new Map<string, WebGLTexture>(
      externalTextures as ReadonlyMap<string, WebGLTexture>,
    )
    const frameAllocated: ShaderFramebuffer[] = []
    // Track pass pixel dimensions for debug info
    const passDims = new Map<string, { w: number; h: number }>()

    for (const rp of this._passes) {
      const node     = rp.node
      const passW    = Math.max(1, Math.round(dims.W * node.resolutionScale))
      const passH    = Math.max(1, Math.round(dims.H * node.resolutionScale))
      const isScreen = node.outputName === null

      // Track this pass's actual pixel dimensions
      passDims.set(node.passId, { w: passW, h: passH })

      let targetFbo: WebGLFramebuffer | null = null
      let pingPong:  ShaderPingPongBuffer | null = null
      let currentOutputTexture: WebGLTexture | null = null

      // When a capture FBO is set, redirect the final screen pass to it.
      if (isScreen && this._outputFboOverride !== undefined) {
        targetFbo = this._outputFboOverride
      }

      if (!isScreen) {
        if (node.pingPong) {
          // ── Ping-pong path ───────────────────────────────────────────────
          pingPong = this._getOrCreatePingPong(node.outputName!, passW, passH, node)

          // Seed texMap with the PREVIOUS frame's read texture so the pass
          // can sample its own prior output (self-referential input).
          const prevRead = pingPong.readTexture
          if (prevRead) texMap.set(node.outputName!, prevRead)

          targetFbo = pingPong.writeFbo
        } else if (node.persistent) {
          // ── Persistent single-FBO path ───────────────────────────────────
          const pfbo = this._getPersistentFbo(node.outputName!, passW, passH, node)
          targetFbo  = pfbo.framebuffer
          currentOutputTexture = pfbo.texture
        } else {
          // ── Temporary pool path ──────────────────────────────────────────
          const tfbo = this._pool.acquire(passW, passH, 'rgba8', node.filter, node.wrap)
          frameAllocated.push(tfbo)
          targetFbo = tfbo.framebuffer
          currentOutputTexture = tfbo.texture
        }
      }

      // Build input bindings from texMap using explicit source→uniformName pairs.
      const inputs = node.inputs
        .map((binding, unit) => {
          const tex = texMap.get(binding.source)
          if (!tex) return null
          return { unit, texture: tex, uniformName: binding.uniformName }
        })
        .filter((b): b is NonNullable<typeof b> => b !== null)

      const drawW = isScreen ? dims.W : passW
      const drawH = isScreen ? dims.H : passH

      rp.execute(targetFbo, drawW, drawH, inputs, applyUniforms)

      // Post-draw: update texMap so downstream passes see the output.
      if (!isScreen) {
        if (pingPong) {
          // Swap write→read.  texMap gets the newly written frame.
          pingPong.swap()
          const newRead = pingPong.readTexture
          if (newRead) {
            texMap.set(node.outputName!, newRead)
            currentOutputTexture = newRead
          }
        } else if (currentOutputTexture) {
          // For persistent and temporary FBOs, use the texture reference
          // captured when the FBO was allocated — not a global last-frame lookup.
          texMap.set(node.outputName!, currentOutputTexture)
        }
      }
    }

    // Release temporary FBOs back to pool.
    for (const fbo of frameAllocated) this._pool.release(fbo)
    this._lastPassDims = passDims

    this._lastExecMs = performance.now() - t0
  }

  /** Debug snapshot of the active graph's resource state. */
  get info(): RenderGraphInfo {
    if (!this._activeGraph) {
      return { shaderId: '', passCount: 0, passes: [], pooledResourceCount: 0, lastExecutionMs: null }
    }
    return {
      shaderId:   this._activeGraph.shaderId,
      passCount:  this._passes.length,
      passes:     this._passes.map(rp => {
        const d = this._lastPassDims.get(rp.node.passId) ?? { w: 0, h: 0 }
        return rp.info(d)
      }),
      pooledResourceCount: this._pool.totalCount + this._persistentFbos.size + this._pingPongBuffers.size * 2,
      lastExecutionMs: this._lastExecMs,
    }
  }

  dispose(): void {
    this._pool.disposeAll()
    this._fsPass.dispose()
    this._disposePersistentFbos()
    this._disposePingPongBuffers()
    this._passes      = []
    this._activeGraph = null
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _getOrCreatePingPong(
    outputName: string,
    w: number, h: number,
    node: import('./shaderRenderGraphTypes').CompiledPassNode,
  ): ShaderPingPongBuffer {
    let pp = this._pingPongBuffers.get(outputName)
    if (!pp) {
      pp = new ShaderPingPongBuffer(this._gl, 'rgba8', node.filter, node.wrap)
      this._pingPongBuffers.set(outputName, pp)
    }
    pp.resize(w, h)
    return pp
  }

  private _getPersistentFbo(
    outputName: string,
    w: number, h: number,
    node: import('./shaderRenderGraphTypes').CompiledPassNode,
  ): ShaderFramebuffer {
    let fbo = this._persistentFbos.get(outputName)
    if (!fbo) {
      fbo = new ShaderFramebuffer(this._gl, { format: 'rgba8', filter: node.filter, wrap: node.wrap })
      this._persistentFbos.set(outputName, fbo)
    }
    if (fbo.width !== w || fbo.height !== h) fbo.resize(w, h)
    return fbo
  }

  private _disposePersistentFbos(): void {
    for (const fbo of this._persistentFbos.values()) fbo.dispose()
    this._persistentFbos.clear()
  }

  private _disposePingPongBuffers(): void {
    for (const pp of this._pingPongBuffers.values()) pp.dispose()
    this._pingPongBuffers.clear()
  }

  private _renderBlack(dims: RuntimeDimensions): void {
    const gl = this._gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, dims.W, dims.H)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}

