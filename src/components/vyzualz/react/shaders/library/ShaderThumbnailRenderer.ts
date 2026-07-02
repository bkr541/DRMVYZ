import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { ShaderCompiler } from '../runtime/ShaderCompiler'
import {
  MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
  claimDrmvyzThumbnailWebGLContext,
  registerDrmvyzWebGLContext,
  releaseDrmvyzThumbnailWebGLContext,
  retireDrmvyzWebGLContext,
  serializeDrmvyzThumbnailWebGLWork,
  type DrmvyzThumbnailWebGLContextLease,
  type WebGLContextDiagnosticHandle,
} from '../runtime/WebGLContextLifecycle'

// ── Constants ─────────────────────────────────────────────────────────────────

const THUMB_W = 128
const THUMB_H = 128

// Deterministic "frozen" time used for all thumbnails.
const PREVIEW_TIME_SEC = 4.0
const PREVIEW_SEED     = 42

// ── ThumbnailResult ───────────────────────────────────────────────────────────

export interface ThumbnailResult {
  dataUrl:  string      // PNG data URL
  sceneId:  string
  cachedAt: string      // ISO 8601
}

type ThumbnailCanvas = HTMLCanvasElement | OffscreenCanvas

interface SharedShaderThumbnailPool {
  canvas: ThumbnailCanvas
  gl: WebGL2RenderingContext
  compiler: ShaderCompiler
  fullscreenPass: FullscreenPass
  diagnostics: WebGLContextDiagnosticHandle | null
  lease: DrmvyzThumbnailWebGLContextLease
}

let sharedPool: SharedShaderThumbnailPool | null = null
let sharedRenderTail: Promise<void> = Promise.resolve()
let activeSharedJobs = 0
let retireSharedPoolWhenIdle = false
const activeRendererOwners = new Set<ShaderThumbnailRenderer>()

// ── ShaderThumbnailRenderer ───────────────────────────────────────────────────

/**
 * Renders small deterministic previews for shader scenes.
 *
 * Every renderer instance shares one serialized transient WebGL2 context. The
 * context is reused across scene jobs and terminally retired when the final
 * owner is disposed, keeping DRMVYZ's shader-thumbnail context count at one.
 */
export class ShaderThumbnailRenderer {
  private readonly _cache = new Map<string, ThumbnailResult>()
  private _disposed = false

  constructor() {
    activeRendererOwners.add(this)
    retireSharedPoolWhenIdle = false
  }

  /** Return a cached thumbnail for `sceneId`, or `null` if not yet rendered. */
  getCached(sceneId: string): ThumbnailResult | null {
    return this._cache.get(sceneId) ?? null
  }

  /** Render one frame using the shared, bounded thumbnail context. */
  async render(def: ShaderDefinition): Promise<ThumbnailResult | null> {
    if (this._disposed) return null

    const cached = this._cache.get(def.id)
    if (cached) return cached

    const fragSrc = def.fragSrc ?? def.passes?.[0]?.fragSrc
    if (!fragSrc) return null

    const result = await enqueueSharedShaderThumbnail(() => (
      serializeDrmvyzThumbnailWebGLWork(async () => {
        if (this._disposed) return null
        return this._renderOnce(def.id, fragSrc)
      })
    ))
    if (result && !this._disposed) this._cache.set(def.id, result)
    return this._disposed ? null : result
  }

  /** Remove a single cached entry (forces re-render on next call). */
  clearCache(sceneId?: string): void {
    if (sceneId) this._cache.delete(sceneId)
    else this._cache.clear()
  }

  /** All currently cached scene IDs. */
  get cachedIds(): string[] { return Array.from(this._cache.keys()) }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._cache.clear()
    activeRendererOwners.delete(this)
    if (activeRendererOwners.size === 0) {
      retireSharedPoolWhenIdle = true
      if (activeSharedJobs === 0) terminallyDisposeSharedShaderThumbnailPool()
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _renderOnce(sceneId: string, fragSrc: string): Promise<ThumbnailResult | null> {
    const pool = acquireSharedShaderThumbnailPool()
    if (!pool) return null

    const { canvas, gl, compiler, fullscreenPass } = pool
    let program: ShaderProgram | null = null
    let terminalFailure = false
    try {
      resetSharedShaderThumbnailState(gl)
      const result = ShaderProgram.create(gl, compiler, {
        vertSrc: FULLSCREEN_VERT_SRC,
        fragSrc,
        label: `thumb:${sceneId}`,
        optionalUniforms: ['u_time', 'u_seed', 'u_resolution', 'u_aspect'],
      })
      if (!result.program) return null
      program = result.program

      gl.viewport(0, 0, THUMB_W, THUMB_H)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      program.activate()
      program.setFloat('u_time', PREVIEW_TIME_SEC)
      program.setFloat('u_seed', PREVIEW_SEED)
      program.setVec2('u_resolution', THUMB_W, THUMB_H)
      program.setFloat('u_aspect', THUMB_W / THUMB_H)
      fullscreenPass.run(program, null, THUMB_W, THUMB_H, [])
      gl.flush()

      const dataUrl = await thumbnailCanvasToDataUrl(canvas)
      return { dataUrl, sceneId, cachedAt: new Date().toISOString() }
    } catch {
      // Unexpected canvas/context failures can leave opaque driver state behind.
      // Retire rather than returning a potentially corrupted shared context.
      terminalFailure = true
      return null
    } finally {
      try { program?.dispose() } catch { /* Context may already be lost. */ }
      if (terminalFailure) terminallyDisposeSharedShaderThumbnailPool(pool)
      else if (sharedPool === pool) resetSharedShaderThumbnailState(gl)
    }
  }
}

// ── Shared pool ───────────────────────────────────────────────────────────────

function enqueueSharedShaderThumbnail<T>(work: () => Promise<T>): Promise<T> {
  const run = async () => {
    activeSharedJobs += 1
    try {
      return await work()
    } finally {
      activeSharedJobs = Math.max(0, activeSharedJobs - 1)
      if (retireSharedPoolWhenIdle && activeSharedJobs === 0) {
        terminallyDisposeSharedShaderThumbnailPool()
      }
    }
  }
  const task = sharedRenderTail.then(run, run)
  sharedRenderTail = task.then(() => undefined, () => undefined)
  return task
}

function acquireSharedShaderThumbnailPool(): SharedShaderThumbnailPool | null {
  if (sharedPool) return sharedPool

  const lease = claimDrmvyzThumbnailWebGLContext(
    'shader-scene-thumbnail',
    () => terminallyDisposeSharedShaderThumbnailPool(),
  )
  const canvas = createThumbnailCanvas()
  if (!canvas) {
    releaseDrmvyzThumbnailWebGLContext(lease)
    return null
  }
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null
  if (!gl) {
    releaseDrmvyzThumbnailWebGLContext(lease)
    return null
  }

  try {
    sharedPool = {
      canvas,
      gl,
      compiler: new ShaderCompiler(gl),
      fullscreenPass: new FullscreenPass(gl),
      diagnostics: registerDrmvyzWebGLContext(gl, {
        lifetime: 'transient-thumbnail',
        role: 'shader-scene-thumbnail',
        engine: 'shader-engine',
        expectedMaxActive: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
      }),
      lease,
    }
    return sharedPool
  } catch {
    try { gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* Best effort. */ }
    releaseDrmvyzThumbnailWebGLContext(lease)
    try {
      canvas.width = 1
      canvas.height = 1
    } catch { /* Offscreen canvas may already be detached. */ }
    return null
  }
}

function terminallyDisposeSharedShaderThumbnailPool(
  expectedPool: SharedShaderThumbnailPool | null = sharedPool,
): void {
  const pool = sharedPool
  if (!pool || (expectedPool && expectedPool !== pool)) return
  sharedPool = null
  retireSharedPoolWhenIdle = false

  try { pool.fullscreenPass.dispose() } catch { /* Best effort. */ }
  try { pool.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* Already lost or unsupported. */ }
  retireDrmvyzWebGLContext(pool.diagnostics, 'terminal-retire')
  releaseDrmvyzThumbnailWebGLContext(pool.lease)
  try {
    pool.canvas.width = 1
    pool.canvas.height = 1
  } catch { /* Offscreen canvas may already be detached. */ }
}

function createThumbnailCanvas(): ThumbnailCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(THUMB_W, THUMB_H)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  return canvas
}

function resetSharedShaderThumbnailState(gl: WebGL2RenderingContext): void {
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    gl.useProgram(null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.STENCIL_TEST)
    gl.colorMask(true, true, true, true)
    gl.depthMask(true)
    gl.stencilMask(0xffffffff)
    gl.viewport(0, 0, THUMB_W, THUMB_H)
    gl.scissor(0, 0, THUMB_W, THUMB_H)
    gl.clearColor(0, 0, 0, 1)
    gl.clearDepth(1)
    gl.clearStencil(0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
  } catch {
    // Context loss makes state repair illegal; terminal retirement handles it.
  }
}

async function thumbnailCanvasToDataUrl(canvas: ThumbnailCanvas): Promise<string> {
  if (isOffscreenCanvas(canvas)) {
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return blobToDataUrl(blob)
  }
  return canvas.toDataURL('image/png')
}

function isOffscreenCanvas(canvas: ThumbnailCanvas): canvas is OffscreenCanvas {
  return typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

export function getShaderThumbnailContextDiagnosticsForTests(): Readonly<{
  activeContextCount: number
  contextLimit: number
  ownerCount: number
}> {
  return {
    activeContextCount: sharedPool ? 1 : 0,
    contextLimit: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
    ownerCount: activeRendererOwners.size,
  }
}
