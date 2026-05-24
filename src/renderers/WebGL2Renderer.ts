/**
 * WebGL2Renderer — GPU compositor for DRMVYZ live visual output.
 *
 * Rendering architecture:
 *   1. Upload active media element as a TEXTURE_2D (video or image).
 *   2. Render video into scene FBO with background fill and aspect-ratio draw rect.
 *   3. Optional RGB Split pass (scene FBO → rgb FBO).
 *   4. Optional Bloom passes:
 *      a. Threshold + downsample (half-res)
 *      b. Horizontal Gaussian blur
 *      c. Vertical Gaussian blur
 *      d. Screen-composite bloom onto scene
 *   5. Blit final scene to canvas (null FBO).
 *
 * The renderer owns its own HTMLCanvasElement (never attached to DOM).
 * The caller composites it into the main Canvas 2D output via ctx.drawImage().
 *
 * WebGL2 is chosen because it is widely supported in modern browsers, provides
 * a practical real-time shader path for video textures, and avoids the
 * compatibility risk of WebGPU during this first production performance pass.
 */

import {
  VERT_SRC,
  VIDEO_FRAG,
  RGBSPLIT_FRAG,
  BLOOM_THRESHOLD_FRAG,
  BLOOM_BLUR_FRAG,
  BLOOM_COMPOSITE_FRAG,
  PASS_FRAG,
  POST_PROCESS_FRAG,
} from './shaders'

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Discriminated-union result from WebGL2Renderer.create().
 * On failure, `error` is a human-readable description of why creation failed.
 */
export type WebGL2CreateResult =
  | { renderer: WebGL2Renderer; error: null }
  | { renderer: null; error: string }

export interface RenderFrameParams {
  /** Active media element to render. Null = skip (caller draws background). */
  mediaEl: HTMLImageElement | HTMLVideoElement | null
  /** Canvas output dimensions in device pixels. */
  canvasW: number
  canvasH: number
  /** Draw rect in canvas pixels (from computeDrawRect in LiveVisualCanvas). */
  ox: number; oy: number; sw: number; sh: number
  /** RGB Split: horizontal pixel shift. 0 = disabled. */
  rgbShiftPx: number
  /** Bloom: blur radius in pixels (at full res; halved at half-res buffer). 0 = disabled. */
  bloomBlurPx: number
  /** Bloom composite strength 0..1 */
  bloomAmount: number
  /** Background colour — normalised linear RGB. Fragments outside draw rect use this. */
  bgR: number; bgG: number; bgB: number
  /** Grain intensity 0..1 (Noise Fog GPU path). 0 = disabled — pass skipped. */
  grainAmount: number
  /** Scanline darkness 0..1 (Scanlines GPU path). 0 = disabled. */
  scanAlpha: number
  /** Pixel stride between darkened scanline rows (from quality.scanlineStep). */
  scanStep: number
}

export interface WebGL2Diagnostics {
  rendererType: 'webgl2'
  canvasW: number
  canvasH: number
  activeEffects: string[]
  contextLost: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.error('[WebGL2Renderer] shader compile:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram | null {
  const p = gl.createProgram()
  if (!p) return null
  gl.attachShader(p, vert)
  gl.attachShader(p, frag)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.error('[WebGL2Renderer] program link:', gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}

/** Create an RGBA8 texture and set sensible defaults (clamp, linear). */
function makeTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return t
}

/** Create FBO backed by a RGBA8 texture. */
function makeFBO(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number, h: number,
): WebGLFramebuffer {
  const fb = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return fb
}

/** Resize an existing FBO texture to new dimensions. */
function resizeFBOTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number, h: number,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
}

// ── Uniform location bundles ──────────────────────────────────────────────────

interface VideoLocs { u_tex: WebGLUniformLocation; u_rect: WebGLUniformLocation; u_bg: WebGLUniformLocation }
interface RgbLocs   { u_tex: WebGLUniformLocation; u_shift: WebGLUniformLocation }
interface ThreshLocs { u_tex: WebGLUniformLocation }
interface BlurLocs  { u_tex: WebGLUniformLocation; u_dir: WebGLUniformLocation; u_radius: WebGLUniformLocation }
interface BloomCompLocs { u_scene: WebGLUniformLocation; u_bloom: WebGLUniformLocation; u_amount: WebGLUniformLocation }
interface PassLocs  { u_tex: WebGLUniformLocation }
interface PostLocs  {
  u_tex: WebGLUniformLocation
  u_time: WebGLUniformLocation
  u_grainAmount: WebGLUniformLocation
  u_scanAlpha: WebGLUniformLocation
  u_scanStep: WebGLUniformLocation
  u_resolution: WebGLUniformLocation
}

function getVideoLocs(gl: WebGL2RenderingContext, p: WebGLProgram): VideoLocs {
  return {
    u_tex:  gl.getUniformLocation(p, 'u_tex')!,
    u_rect: gl.getUniformLocation(p, 'u_rect')!,
    u_bg:   gl.getUniformLocation(p, 'u_bg')!,
  }
}

// ── WebGL2Renderer ────────────────────────────────────────────────────────────

export class WebGL2Renderer {
  private readonly _canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext

  // Programs
  private videoProg:  WebGLProgram
  private rgbProg:    WebGLProgram
  private threshProg: WebGLProgram
  private blurProg:   WebGLProgram
  private bloomProg:  WebGLProgram
  private passProg:   WebGLProgram
  private postProg:   WebGLProgram

  // Shared vertex shader
  private vertShader: WebGLShader

  // Uniform locations
  private videoLocs:  VideoLocs
  private rgbLocs:    RgbLocs
  private threshLocs: ThreshLocs
  private blurLocs:   BlurLocs
  private bloomLocs:  BloomCompLocs
  private passLocs:   PassLocs
  private postLocs:   PostLocs

  // Geometry
  private vao: WebGLVertexArrayObject
  private vbo: WebGLBuffer

  // Textures and FBOs
  private videoTex:  WebGLTexture   // per-frame upload from media element
  private videoTexW = 0; private videoTexH = 0

  private sceneTex:  WebGLTexture;  private sceneFBO:  WebGLFramebuffer
  private rgbTex:    WebGLTexture;  private rgbFBO:    WebGLFramebuffer
  private bloom1Tex: WebGLTexture;  private bloom1FBO: WebGLFramebuffer
  private bloom2Tex: WebGLTexture;  private bloom2FBO: WebGLFramebuffer
  // Post-process FBO: holds pre-final output when grain or scanlines are active
  private postTex:   WebGLTexture;  private postFBO:   WebGLFramebuffer

  // Tracked canvas dimensions
  private canvasW = 0; private canvasH = 0
  private bloomW  = 0; private bloomH  = 0

  private _contextLost = false

  // Stored so dispose() can remove them before calling loseContext()
  private _contextLostHandler!:    (e: Event) => void
  private _contextRestoredHandler!: () => void

  // ── Factory ────────────────────────────────────────────────────────────────

  /**
   * Returns true if WebGL2 can be obtained in this browser without creating
   * a full renderer. Cheaper than create() — use for early capability checks.
   */
  static probeSupport(): boolean {
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      if (!gl) return false
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
      return true
    } catch {
      return false
    }
  }

  /**
   * Attempt to create a WebGL2Renderer on an offscreen canvas.
   *
   * Returns a discriminated-union result so callers always receive a
   * human-readable error string instead of an unexplained null:
   *
   *   { renderer: WebGL2Renderer; error: null }   — success
   *   { renderer: null; error: string }            — failure with reason
   *
   * Failure reasons include at minimum:
   *   'WebGL2 context unavailable'
   *   'vertex shader compilation failed'
   *   'fragment shader(s) compilation failed'
   *   'program link failed'
   *
   * @param callbacks.onContextLost     — called with a reason string when the context is lost
   * @param callbacks.onContextRestored — called when the context is restored (browser-driven)
   */
  static create(callbacks?: {
    onContextLost?: (reason: string) => void
    onContextRestored?: () => void
  }): WebGL2CreateResult {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null
    if (!gl) {
      if (import.meta.env.DEV) console.warn('[WebGL2Renderer] WebGL2 context unavailable')
      return { renderer: null, error: 'WebGL2 context unavailable' }
    }
    try {
      return { renderer: new WebGL2Renderer(canvas, gl, callbacks), error: null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WebGL2 initialisation failed'
      if (import.meta.env.DEV) console.error('[WebGL2Renderer] init failed:', msg)
      return { renderer: null, error: msg }
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    callbacks?: { onContextLost?: (reason: string) => void; onContextRestored?: () => void },
  ) {
    this._canvas = canvas
    this.gl = gl

    // ── Compile shaders ──────────────────────────────────────────────────
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
    if (!vert) throw new Error('vertex shader failed')
    this.vertShader = vert

    const fragVideo  = compileShader(gl, gl.FRAGMENT_SHADER, VIDEO_FRAG)
    const fragRgb    = compileShader(gl, gl.FRAGMENT_SHADER, RGBSPLIT_FRAG)
    const fragThresh = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_THRESHOLD_FRAG)
    const fragBlur   = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_BLUR_FRAG)
    const fragBloom  = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_COMPOSITE_FRAG)
    const fragPass   = compileShader(gl, gl.FRAGMENT_SHADER, PASS_FRAG)
    const fragPost   = compileShader(gl, gl.FRAGMENT_SHADER, POST_PROCESS_FRAG)

    if (!fragVideo || !fragRgb || !fragThresh || !fragBlur || !fragBloom || !fragPass || !fragPost) {
      throw new Error('fragment shader compilation failed')
    }

    const vP = linkProgram(gl, vert, fragVideo)
    const rP = linkProgram(gl, vert, fragRgb)
    const tP = linkProgram(gl, vert, fragThresh)
    const bP = linkProgram(gl, vert, fragBlur)
    const cP = linkProgram(gl, vert, fragBloom)
    const pP = linkProgram(gl, vert, fragPass)
    const ppP = linkProgram(gl, vert, fragPost)

    if (!vP || !rP || !tP || !bP || !cP || !pP || !ppP) throw new Error('program link failed')

    this.videoProg  = vP;  this.rgbProg   = rP
    this.threshProg = tP;  this.blurProg  = bP
    this.bloomProg  = cP;  this.passProg  = pP
    this.postProg   = ppP

    // ── Uniform locations ─────────────────────────────────────────────────
    this.videoLocs = getVideoLocs(gl, vP)
    this.rgbLocs   = { u_tex: gl.getUniformLocation(rP, 'u_tex')!, u_shift: gl.getUniformLocation(rP, 'u_shift')! }
    this.threshLocs = { u_tex: gl.getUniformLocation(tP, 'u_tex')! }
    this.blurLocs  = { u_tex: gl.getUniformLocation(bP, 'u_tex')!, u_dir: gl.getUniformLocation(bP, 'u_dir')!, u_radius: gl.getUniformLocation(bP, 'u_radius')! }
    this.bloomLocs = { u_scene: gl.getUniformLocation(cP, 'u_scene')!, u_bloom: gl.getUniformLocation(cP, 'u_bloom')!, u_amount: gl.getUniformLocation(cP, 'u_amount')! }
    this.passLocs  = { u_tex: gl.getUniformLocation(pP, 'u_tex')! }
    this.postLocs  = {
      u_tex:         gl.getUniformLocation(ppP, 'u_tex')!,
      u_time:        gl.getUniformLocation(ppP, 'u_time')!,
      u_grainAmount: gl.getUniformLocation(ppP, 'u_grainAmount')!,
      u_scanAlpha:   gl.getUniformLocation(ppP, 'u_scanAlpha')!,
      u_scanStep:    gl.getUniformLocation(ppP, 'u_scanStep')!,
      u_resolution:  gl.getUniformLocation(ppP, 'u_resolution')!,
    }

    // ── Fullscreen quad ───────────────────────────────────────────────────
    // Interleaved [x, y, u, v], two triangles covering [-1,1]² NDC.
    const verts = new Float32Array([
      // pos        uv
      -1, -1,      0, 0,
       1, -1,      1, 0,
      -1,  1,      0, 1,
       1, -1,      1, 0,
       1,  1,      1, 1,
      -1,  1,      0, 1,
    ])
    this.vao = gl.createVertexArray()!
    this.vbo = gl.createBuffer()!
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    const stride = 4 * 4  // 4 floats × 4 bytes
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8)
    gl.bindVertexArray(null)
    // Bind attributes by index to match GLSL `in` declarations (location 0=a_pos, 1=a_uv)
    gl.bindAttribLocation(vP,  0, 'a_pos'); gl.bindAttribLocation(vP,  1, 'a_uv')
    gl.bindAttribLocation(rP,  0, 'a_pos'); gl.bindAttribLocation(rP,  1, 'a_uv')
    gl.bindAttribLocation(tP,  0, 'a_pos'); gl.bindAttribLocation(tP,  1, 'a_uv')
    gl.bindAttribLocation(bP,  0, 'a_pos'); gl.bindAttribLocation(bP,  1, 'a_uv')
    gl.bindAttribLocation(cP,  0, 'a_pos'); gl.bindAttribLocation(cP,  1, 'a_uv')
    gl.bindAttribLocation(pP,  0, 'a_pos'); gl.bindAttribLocation(pP,  1, 'a_uv')
    gl.bindAttribLocation(ppP, 0, 'a_pos'); gl.bindAttribLocation(ppP, 1, 'a_uv')
    // Relink after attrib binding
    ;[vP, rP, tP, bP, cP, pP, ppP].forEach(prog => { gl.linkProgram(prog) })

    // ── Video texture (placeholder 1×1 black) ─────────────────────────────
    this.videoTex = makeTexture(gl)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]))
    gl.bindTexture(gl.TEXTURE_2D, null)

    // ── Scene + effect FBOs (placeholder 1×1) ────────────────────────────
    this.sceneTex  = makeTexture(gl); this.sceneFBO  = makeFBO(gl, this.sceneTex,  1, 1)
    this.rgbTex    = makeTexture(gl); this.rgbFBO    = makeFBO(gl, this.rgbTex,    1, 1)
    this.bloom1Tex = makeTexture(gl); this.bloom1FBO = makeFBO(gl, this.bloom1Tex, 1, 1)
    this.bloom2Tex = makeTexture(gl); this.bloom2FBO = makeFBO(gl, this.bloom2Tex, 1, 1)
    this.postTex   = makeTexture(gl); this.postFBO   = makeFBO(gl, this.postTex,   1, 1)

    // ── Context loss handling ─────────────────────────────────────────────
    // Store handler references so dispose() can remove them before calling
    // loseContext() — prevents the dispose path from re-triggering callbacks.
    this._contextLostHandler = (e: Event) => {
      e.preventDefault()
      this._contextLost = true
      if (import.meta.env.DEV) console.warn('[WebGL2Renderer] context lost')
      callbacks?.onContextLost?.('WebGL2 context lost during playback')
    }
    this._contextRestoredHandler = () => {
      this._contextLost = false
      if (import.meta.env.DEV) console.log('[WebGL2Renderer] context restored')
      callbacks?.onContextRestored?.()
    }
    canvas.addEventListener('webglcontextlost', this._contextLostHandler)
    canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler)

    if (import.meta.env.DEV) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) console.log('[WebGL2Renderer] GPU:', gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    }
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  private resize(w: number, h: number): void {
    const gl = this.gl
    this._canvas.width  = w
    this._canvas.height = h
    this.canvasW = w; this.canvasH = h

    resizeFBOTexture(gl, this.sceneTex, w, h)
    resizeFBOTexture(gl, this.rgbTex,   w, h)
    resizeFBOTexture(gl, this.postTex,  w, h)

    this.bloomW = Math.max(1, Math.ceil(w / 2))
    this.bloomH = Math.max(1, Math.ceil(h / 2))
    resizeFBOTexture(gl, this.bloom1Tex, this.bloomW, this.bloomH)
    resizeFBOTexture(gl, this.bloom2Tex, this.bloomW, this.bloomH)
  }

  // ── Video texture upload ─────────────────────────────────────────────────────

  private uploadVideoTexture(el: HTMLImageElement | HTMLVideoElement): boolean {
    const gl = this.gl
    // Guard: video must have renderable data
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2 || el.videoWidth === 0 || el.videoHeight === 0) return false
    } else {
      if (!el.complete || el.naturalWidth === 0) return false
    }

    const elW = el instanceof HTMLVideoElement ? el.videoWidth  : el.naturalWidth
    const elH = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight

    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    try {
      if (this.videoTexW !== elW || this.videoTexH !== elH) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el)
        this.videoTexW = elW; this.videoTexH = elH
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el)
      }
    } catch {
      // CORS or decode error — leave placeholder texture
      gl.bindTexture(gl.TEXTURE_2D, null)
      return false
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
    return true
  }

  // ── Draw fullscreen quad ─────────────────────────────────────────────────────

  private drawQuad(): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  renderFrame(p: RenderFrameParams): void {
    if (this._contextLost) return

    const gl = this.gl
    const { canvasW: W, canvasH: H } = p

    // Resize FBOs if canvas dimensions changed
    if (W !== this.canvasW || H !== this.canvasH) this.resize(W, H)
    if (W === 0 || H === 0) return

    // Upload media texture
    const uploaded = p.mediaEl ? this.uploadVideoTexture(p.mediaEl) : false

    // ── Stage 1: render video to scene FBO ─────────────────────────────────
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO)
    gl.viewport(0, 0, W, H)
    gl.useProgram(this.videoProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
    gl.uniform1i(this.videoLocs.u_tex, 0)
    if (uploaded) {
      gl.uniform4f(this.videoLocs.u_rect, p.ox / W, p.oy / H, p.sw / W, p.sh / H)
    } else {
      // No media ready: fill entirely with background
      gl.uniform4f(this.videoLocs.u_rect, 0, 0, 0, 0)
    }
    gl.uniform4f(this.videoLocs.u_bg, p.bgR, p.bgG, p.bgB, 1.0)
    this.drawQuad()

    // Track which texture holds the "current scene" (RGB split may change this)
    let curSceneTex = this.sceneTex

    // ── Stage 2: RGB Split (optional) ──────────────────────────────────────
    if (p.rgbShiftPx > 0 && uploaded) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.rgbFBO)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.rgbProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
      gl.uniform1i(this.rgbLocs.u_tex, 0)
      gl.uniform1f(this.rgbLocs.u_shift, p.rgbShiftPx / W)
      this.drawQuad()
      curSceneTex = this.rgbTex
    }

    // Whether a post-process pass (grain / scanlines) follows the main pipeline.
    // When true, the bloom/pass step writes to postFBO instead of null (canvas).
    const needsPost = p.grainAmount > 0 || p.scanAlpha > 0

    // ── Stage 3: Bloom (optional, three passes) ────────────────────────────
    if (p.bloomBlurPx > 0 && p.bloomAmount > 0 && uploaded) {
      const bW = this.bloomW, bH = this.bloomH

      // 3a. Threshold + downsample → bloom1FBO (half-res)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom1FBO)
      gl.viewport(0, 0, bW, bH)
      gl.useProgram(this.threshProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, curSceneTex)
      gl.uniform1i(this.threshLocs.u_tex, 0)
      this.drawQuad()

      // 3b. Horizontal blur: bloom1 → bloom2
      const sigma = Math.max(0.5, p.bloomBlurPx / 2)  // half-res = half the blur radius
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom2FBO)
      gl.viewport(0, 0, bW, bH)
      gl.useProgram(this.blurProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.bloom1Tex)
      gl.uniform1i(this.blurLocs.u_tex, 0)
      gl.uniform2f(this.blurLocs.u_dir, 1.0 / bW, 0)
      gl.uniform1f(this.blurLocs.u_radius, sigma)
      this.drawQuad()

      // 3c. Vertical blur: bloom2 → bloom1
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom1FBO)
      gl.viewport(0, 0, bW, bH)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.bloom2Tex)
      gl.uniform2f(this.blurLocs.u_dir, 0, 1.0 / bH)
      this.drawQuad()

      // 3d. Composite: scene + bloom1 → postFBO (if post pass follows) or canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, needsPost ? this.postFBO : null)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.bloomProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, curSceneTex)
      gl.uniform1i(this.bloomLocs.u_scene, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.bloom1Tex)
      gl.uniform1i(this.bloomLocs.u_bloom, 1)
      gl.uniform1f(this.bloomLocs.u_amount, p.bloomAmount)
      this.drawQuad()
    } else {
      // No bloom: passthrough to postFBO (if post pass follows) or canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, needsPost ? this.postFBO : null)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.passProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, curSceneTex)
      gl.uniform1i(this.passLocs.u_tex, 0)
      this.drawQuad()
    }

    // ── Stage 4: Post-process — grain + scanlines (optional) ──────────────
    // Reads postTex (written in stage 3) and outputs to the canvas (null FBO).
    // Skipped entirely when both grainAmount and scanAlpha are zero, preserving
    // the existing two-pass minimum for the no-effects path.
    if (needsPost) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.postProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.postTex)
      gl.uniform1i(this.postLocs.u_tex, 0)
      gl.uniform1f(this.postLocs.u_time,        performance.now())
      gl.uniform1f(this.postLocs.u_grainAmount, p.grainAmount)
      gl.uniform1f(this.postLocs.u_scanAlpha,   p.scanAlpha)
      gl.uniform1f(this.postLocs.u_scanStep,    p.scanStep)
      gl.uniform2f(this.postLocs.u_resolution,  W, H)
      this.drawQuad()
    }

    // Clean up active texture bindings
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null)

    gl.flush()
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  /** The offscreen canvas that holds the GPU-rendered output. */
  get outputCanvas(): HTMLCanvasElement { return this._canvas }

  get contextLost(): boolean { return this._contextLost }

  getDiagnostics(activeEffects: string[]): WebGL2Diagnostics {
    return {
      rendererType: 'webgl2',
      canvasW: this.canvasW,
      canvasH: this.canvasH,
      activeEffects,
      contextLost: this._contextLost,
    }
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────

  dispose(): void {
    // Remove event listeners FIRST so the loseContext() call below cannot
    // re-trigger the onContextLost callback on the caller.
    this._canvas.removeEventListener('webglcontextlost',    this._contextLostHandler)
    this._canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler)

    const gl = this.gl
    ;[this.videoProg, this.rgbProg, this.threshProg, this.blurProg, this.bloomProg, this.passProg, this.postProg]
      .forEach(p => gl.deleteProgram(p))
    gl.deleteShader(this.vertShader)
    gl.deleteBuffer(this.vbo)
    gl.deleteVertexArray(this.vao)
    ;[this.videoTex, this.sceneTex, this.rgbTex, this.bloom1Tex, this.bloom2Tex, this.postTex]
      .forEach(t => gl.deleteTexture(t))
    ;[this.sceneFBO, this.rgbFBO, this.bloom1FBO, this.bloom2FBO, this.postFBO]
      .forEach(f => gl.deleteFramebuffer(f))
    // Release GPU context via WEBGL_lose_context if available
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}
