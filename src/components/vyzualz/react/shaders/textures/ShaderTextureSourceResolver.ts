import type { ShaderTexSourceSelection, ResolvedShaderTexture, ShaderTextureMeta } from './shaderTextureInputTypes'
import { FALLBACK_TEX_META } from './shaderTextureInputTypes'

// ── Duck-type element detection ───────────────────────────────────────────────
// Uses property presence rather than instanceof so that test mocks work without
// a full jsdom environment.

function isImageLike(el: object): el is HTMLImageElement {
  return 'naturalWidth' in el && 'complete' in el
}

function isVideoLike(el: object): el is HTMLVideoElement {
  return 'videoWidth' in el && 'readyState' in el
}

function isCanvasLike(el: object): el is HTMLCanvasElement {
  return 'getContext' in el
}

// ── Internal per-input state ──────────────────────────────────────────────────

interface TexEntry {
  texture: WebGLTexture
  meta:    ShaderTextureMeta
  /** Key that identifies the current source (changes force a re-upload). */
  sourceKey:    string
  lastVideoTime: number
  lastElemW:     number
  lastElemH:     number
}

// ── ShaderTextureSourceResolver ───────────────────────────────────────────────

/**
 * Manages per-input WebGL texture lifecycle for media-backed sources
 * (images, videos, canvases).  Generated sources (noise, mask, solid) are
 * handled directly by ShaderTextureInputManager.
 *
 * Design:
 *   - One TexEntry per input name; entry survives across frames for the same source.
 *   - Image: uploaded once on first resolve when complete; re-uploaded on URL change.
 *   - Video/canvas: initial upload via texImage2D, subsequent frames via texSubImage2D
 *     (no reallocation while dimensions are stable).
 *   - Source change detected by comparing (sourceType + assetUrl) — cheap and reliable.
 *   - The 1×1 opaque-black fallback texture is always available (never released).
 *   - Maximum texture size is read from the GL context at construction; images that
 *     exceed the limit are scaled down via an off-screen canvas before upload.
 */
export class ShaderTextureSourceResolver {
  private readonly _fallbackTex:    WebGLTexture
  private readonly _fallbackResult: ResolvedShaderTexture
  private readonly _entries = new Map<string, TexEntry>()
  private readonly _maxTexSize: number

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._maxTexSize = (_gl.getParameter(_gl.MAX_TEXTURE_SIZE) as number | undefined) ?? 4096
    this._fallbackTex    = this._create1x1(0, 0, 0, 255)
    this._fallbackResult = { texture: this._fallbackTex, meta: { ...FALLBACK_TEX_META } }
  }

  get fallback(): ResolvedShaderTexture { return this._fallbackResult }
  get entryCount(): number { return this._entries.size }

  /**
   * Resolve a media-backed selection for a given input.
   * Returns the cached texture when the source key is unchanged.
   * Returns the fallback when the source is missing or not yet ready.
   */
  resolve(inputName: string, sel: ShaderTexSourceSelection): ResolvedShaderTexture {
    const el = sel.mediaElement
    if (!el) {
      this.release(inputName)
      return this._fallbackResult
    }

    const sourceKey = `${sel.sourceType}:${sel.assetUrl ?? ''}`
    const existing  = this._entries.get(inputName)

    if (isImageLike(el)) {
      // Image: upload once when complete; re-upload on source change.
      if (!el.complete || el.naturalWidth === 0) return this._fallbackResult
      if (existing?.sourceKey === sourceKey) return { texture: existing.texture, meta: existing.meta }
      if (existing) this._deleteEntry(existing)

      const w   = Math.min(el.naturalWidth,  this._maxTexSize)
      const h   = Math.min(el.naturalHeight, this._maxTexSize)
      const tex = this._uploadImage(el, w, h)
      const meta = this._makeMeta(w, h, sel.sourceType, false)
      this._entries.set(inputName, { texture: tex, meta, sourceKey, lastVideoTime: -1, lastElemW: w, lastElemH: h })
      return { texture: tex, meta }
    }

    if (isVideoLike(el)) {
      if (el.readyState < 2 || el.videoWidth === 0) return this._fallbackResult
      if (existing?.sourceKey === sourceKey) return { texture: existing.texture, meta: existing.meta }
      if (existing) this._deleteEntry(existing)

      const w   = Math.min(el.videoWidth,  this._maxTexSize)
      const h   = Math.min(el.videoHeight, this._maxTexSize)
      const tex = this._uploadTexSource(el)
      const meta = this._makeMeta(w, h, sel.sourceType, true)
      this._entries.set(inputName, { texture: tex, meta, sourceKey, lastVideoTime: el.currentTime, lastElemW: w, lastElemH: h })
      return { texture: tex, meta }
    }

    if (isCanvasLike(el)) {
      if (el.width === 0 || el.height === 0) return this._fallbackResult
      if (existing?.sourceKey === sourceKey) return { texture: existing.texture, meta: existing.meta }
      if (existing) this._deleteEntry(existing)

      const w   = Math.min(el.width,  this._maxTexSize)
      const h   = Math.min(el.height, this._maxTexSize)
      const tex = this._uploadTexSource(el)
      const meta = this._makeMeta(w, h, sel.sourceType, true)
      this._entries.set(inputName, { texture: tex, meta, sourceKey, lastVideoTime: -1, lastElemW: w, lastElemH: h })
      return { texture: tex, meta }
    }

    return this._fallbackResult
  }

  /**
   * Upload the next video frame for a dynamic input.
   * Uses texSubImage2D when dimensions are stable (no reallocation).
   * Returns true if the GPU texture was updated.
   */
  updateVideoFrame(inputName: string, el: HTMLVideoElement): boolean {
    const entry = this._entries.get(inputName)
    if (!entry) return false
    if ((el.readyState as number) < 2 || el.videoWidth === 0) return false
    // Skip redundant uploads when video is paused on the same frame.
    if (el.paused && el.currentTime === entry.lastVideoTime) return false

    const gl  = this._gl
    const vw  = el.videoWidth, vh = el.videoHeight

    if (vw !== entry.lastElemW || vh !== entry.lastElemH) {
      // Dimensions changed — reallocate storage via texImage2D.
      const newW = Math.min(vw, this._maxTexSize)
      const newH = Math.min(vh, this._maxTexSize)
      gl.bindTexture(gl.TEXTURE_2D, entry.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el as TexImageSource)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.bindTexture(gl.TEXTURE_2D, null)
      entry.lastElemW = newW
      entry.lastElemH = newH
      entry.meta = this._makeMeta(newW, newH, entry.meta.sourceType, true)
    } else {
      // Same dimensions — update in place (no reallocation).
      gl.bindTexture(gl.TEXTURE_2D, entry.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el as TexImageSource)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }

    entry.lastVideoTime = el.currentTime
    return true
  }

  /**
   * Upload the next canvas frame for a dynamic input.
   * Uses texSubImage2D when dimensions are stable.
   */
  updateCanvasFrame(inputName: string, el: HTMLCanvasElement): void {
    const entry = this._entries.get(inputName)
    if (!entry || el.width === 0 || el.height === 0) return

    const gl = this._gl

    if (el.width !== entry.lastElemW || el.height !== entry.lastElemH) {
      const newW = Math.min(el.width,  this._maxTexSize)
      const newH = Math.min(el.height, this._maxTexSize)
      gl.bindTexture(gl.TEXTURE_2D, entry.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el as TexImageSource)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.bindTexture(gl.TEXTURE_2D, null)
      entry.lastElemW = newW
      entry.lastElemH = newH
      entry.meta = this._makeMeta(newW, newH, entry.meta.sourceType, true)
    } else {
      gl.bindTexture(gl.TEXTURE_2D, entry.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el as TexImageSource)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
  }

  /** Release the texture for a single input. Idempotent. */
  release(inputName: string): void {
    const entry = this._entries.get(inputName)
    if (!entry) return
    this._deleteEntry(entry)
    this._entries.delete(inputName)
  }

  /** Release textures for inputs no longer present in the active definition. */
  releaseUnreferenced(activeInputNames: ReadonlySet<string>): void {
    for (const [name, entry] of this._entries) {
      if (!activeInputNames.has(name)) {
        this._deleteEntry(entry)
        this._entries.delete(name)
      }
    }
  }

  dispose(): void {
    for (const entry of this._entries.values()) this._deleteEntry(entry)
    this._entries.clear()
    this._gl.deleteTexture(this._fallbackTex)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _create1x1(r: number, g: number, b: number, a: number): WebGLTexture {
    const gl  = this._gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('[ShaderTextureSourceResolver] createTexture failed')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  private _uploadImage(el: HTMLImageElement, targetW: number, targetH: number): WebGLTexture {
    let source: TexImageSource = el as unknown as TexImageSource
    if (el.naturalWidth > this._maxTexSize || el.naturalHeight > this._maxTexSize) {
      const canvas = document.createElement('canvas')
      canvas.width = targetW; canvas.height = targetH
      canvas.getContext('2d')?.drawImage(el as unknown as CanvasImageSource, 0, 0, targetW, targetH)
      source = canvas
    }
    return this._uploadTexSource(source)
  }

  private _uploadTexSource(source: unknown): WebGLTexture {
    const gl  = this._gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('[ShaderTextureSourceResolver] createTexture failed')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  private _makeMeta(
    w: number, h: number,
    sourceType: ShaderTextureMeta['sourceType'],
    dynamic: boolean,
  ): ShaderTextureMeta {
    return {
      w, h, aspectRatio: w / (h || 1),
      uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0,
      sourceType, available: true, dynamic,
    }
  }

  private _deleteEntry(entry: TexEntry): void {
    this._gl.deleteTexture(entry.texture)
  }
}
