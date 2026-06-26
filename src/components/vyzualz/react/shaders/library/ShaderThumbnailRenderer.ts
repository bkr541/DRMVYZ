import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { ShaderFramebuffer } from '../runtime/ShaderFramebuffer'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { ShaderCompiler } from '../runtime/ShaderCompiler'

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

// ── ShaderThumbnailRenderer ───────────────────────────────────────────────────

/**
 * Renders small preview thumbnails for shader scenes.
 *
 * Each thumbnail is rendered at 128×128 into an isolated offscreen canvas
 * using a dedicated (not shared) WebGL2 context.  Deterministic time and
 * seed values are used so the same scene always produces the same thumbnail.
 *
 * Thumbnails are never rendered into the live rendering context — this class
 * always creates its own canvas and context.
 *
 * The in-memory cache is keyed by scene ID.  It is intentionally not
 * persisted as a WebGL object; callers should persist the data URL strings
 * separately (e.g. in ShaderLibraryStore.thumbnailCache).
 */
export class ShaderThumbnailRenderer {
  private readonly _cache = new Map<string, ThumbnailResult>()
  private _disposed = false

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Return a cached thumbnail for `sceneId`, or `null` if not yet rendered.
   */
  getCached(sceneId: string): ThumbnailResult | null {
    return this._cache.get(sceneId) ?? null
  }

  /**
   * Render a thumbnail for the given definition.
   *
   * Creates an isolated offscreen canvas and WebGL2 context, renders one
   * frame at deterministic time/seed, and returns a PNG data URL.
   *
   * Returns `null` when:
   *   - The environment does not support OffscreenCanvas or WebGL2.
   *   - The definition's shader source fails to compile.
   *   - Any other rendering error occurs.
   *
   * Results are cached in memory; call `clearCache(id)` to force a re-render.
   */
  async render(def: ShaderDefinition): Promise<ThumbnailResult | null> {
    if (this._disposed) return null

    const cached = this._cache.get(def.id)
    if (cached) return cached

    // Determine the fragment source to render (single-pass only; multi-pass
    // scenes fall back to the first pass or the top-level fragSrc).
    const fragSrc = def.fragSrc ?? def.passes?.[0]?.fragSrc
    if (!fragSrc) return null

    try {
      const result = await this._renderOnce(def.id, fragSrc)
      if (result) this._cache.set(def.id, result)
      return result
    } catch {
      return null
    }
  }

  /** Remove a single cached entry (forces re-render on next call). */
  clearCache(sceneId?: string): void {
    if (sceneId) {
      this._cache.delete(sceneId)
    } else {
      this._cache.clear()
    }
  }

  /** All currently cached scene IDs. */
  get cachedIds(): string[] { return Array.from(this._cache.keys()) }

  dispose(): void {
    this._disposed = true
    this._cache.clear()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async _renderOnce(sceneId: string, fragSrc: string): Promise<ThumbnailResult | null> {
    // Use OffscreenCanvas when available (workers-friendly).
    let canvas: HTMLCanvasElement | OffscreenCanvas

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(THUMB_W, THUMB_H)
    } else if (typeof document !== 'undefined') {
      const el = document.createElement('canvas')
      el.width  = THUMB_W
      el.height = THUMB_H
      canvas = el
    } else {
      return null
    }

    const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
      alpha:                true,
      antialias:            false,
      depth:                false,
      stencil:              false,
      premultipliedAlpha:   false,
      preserveDrawingBuffer: true,  // needed to read pixels
    }) as WebGL2RenderingContext | null

    if (!gl) return null

    const compiler = new ShaderCompiler(gl)
    const result   = ShaderProgram.create(gl, compiler, {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc,
      label:   `thumb:${sceneId}`,
      optionalUniforms: ['u_time', 'u_seed', 'u_resolution', 'u_aspect'],
    })

    if (result.error) return null

    const prog   = result.program!
    const fsPass = new FullscreenPass(gl)

    // Render to the default framebuffer (the offscreen canvas itself).
    gl.viewport(0, 0, THUMB_W, THUMB_H)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    prog.activate()
    prog.setFloat('u_time', PREVIEW_TIME_SEC)
    prog.setFloat('u_seed', PREVIEW_SEED)
    prog.setFloat('u_aspect', THUMB_W / THUMB_H)

    fsPass.run(prog, null, THUMB_W, THUMB_H, [])

    prog.dispose()
    fsPass.dispose()

    // Extract PNG data URL.
    let dataUrl: string
    if (canvas instanceof OffscreenCanvas) {
      const imageData = gl.readPixels !== undefined
        ? null  // handled below
        : null
      void imageData // unused path — use convertToBlob
      const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' })
      dataUrl = await blobToDataUrl(blob)
    } else {
      dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png')
    }

    return {
      dataUrl,
      sceneId,
      cachedAt: new Date().toISOString(),
    }
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
