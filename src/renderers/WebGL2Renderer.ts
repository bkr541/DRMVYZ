/**
 * WebGL2Renderer — GPU compositor for DRMVYZ live visual output.
 *
 * Initialization is transactional: all GPU resources are tracked during
 * construction and cleaned up atomically on any failure (see InitResourceTracker).
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
  DISPLACEMENT_FRAG,
  GPU_TRANSITION_FRAG,
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
  /** Displacement ghost: horizontal pixel offset (may be negative). 0 = pass is identity. */
  dispOffXPx: number
  /** Displacement ghost: vertical pixel offset (may be negative). 0 = pass is identity. */
  dispOffYPx: number
  /** Displacement ghost intensity 0..1. Ghost alpha = 0.35 × amount. 0 = pass disabled. */
  dispAmount: number
  /** Hue rotation for displacement ghost in radians (0 = no rotation). */
  dispHueRad: number
}

/**
 * Parameters for a GPU-composited clip transition.
 * Effect params (rgb, bloom, grain, etc.) are applied identically to both sources.
 * Progress must already be eased — call getEasedProgress() before passing here.
 */
export interface RenderTransitionParams {
  canvasW: number; canvasH: number
  outEl: HTMLImageElement | HTMLVideoElement | null
  outOx: number; outOy: number; outSw: number; outSh: number
  inEl:  HTMLImageElement | HTMLVideoElement | null
  inOx:  number; inOy:  number; inSw:  number; inSh:  number
  /** Shared effect params — applied to both sources. */
  rgbShiftPx: number
  bloomBlurPx: number; bloomAmount: number
  bgR: number; bgG: number; bgB: number
  grainAmount: number; scanAlpha: number; scanStep: number
  dispOffXPx: number; dispOffYPx: number; dispAmount: number; dispHueRad: number
  /** GPU_TRANSITION_TYPES index (0-9). */
  transitionType: number
  /** Eased progress 0..1. */
  progress: number
}

export interface WebGL2Diagnostics {
  rendererType: 'webgl2'
  canvasW: number
  canvasH: number
  activeEffects: string[]
  contextLost: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Compile a single shader stage.  Throws with a human-readable message (including
 * the info log) on creation failure or compilation failure so the caller's
 * try/catch cleanup path always receives a typed error.
 */
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
  label: string,
): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error(`WebGL2 shader creation failed for ${label}`)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? ''
    if (import.meta.env.DEV) console.error(`[WebGL2Renderer] shader compile (${label}):`, log)
    gl.deleteShader(s)
    throw new Error(`WebGL2 shader compilation failed for ${label}: ${log}`)
  }
  return s
}

/**
 * Create a program and attach shaders without linking.
 * Attribute locations must be bound before linkChecked() is called.
 * Throws only if createProgram() fails (GPU resource exhaustion).
 */
function makeProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
  label: string,
): WebGLProgram {
  const p = gl.createProgram()
  if (!p) throw new Error(`WebGL2 program creation failed for ${label}`)
  gl.attachShader(p, vert)
  gl.attachShader(p, frag)
  return p
}

/**
 * Link a program and validate the result.
 * The program must already be tracked by InitResourceTracker — cleanup on
 * failure is the tracker's responsibility, not this function's.
 */
function linkChecked(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  label: string,
): void {
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? ''
    if (import.meta.env.DEV) console.error(`[WebGL2Renderer] program link (${label}):`, log)
    throw new Error(`WebGL2 program link failed for ${label}: ${log}`)
  }
}

/** Create an RGBA8 texture and set sensible defaults (clamp, linear).  Throws on allocation failure. */
function makeTexture(gl: WebGL2RenderingContext, label: string): WebGLTexture {
  const t = gl.createTexture()
  if (!t) throw new Error(`WebGL2 texture allocation failed for ${label}`)
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return t
}

/**
 * Create a framebuffer backed by an existing RGBA8 texture.
 * Throws on allocation failure or if the framebuffer is not complete after
 * attachment — an incomplete framebuffer would silently produce black output.
 * The caller is responsible for the texture lifetime; this function only
 * deletes the framebuffer object itself on completeness failure.
 */
function makeFBO(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number, h: number,
  label: string,
): WebGLFramebuffer {
  const fb = gl.createFramebuffer()
  if (!fb) throw new Error(`WebGL2 framebuffer allocation failed for ${label}`)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(fb)
    throw new Error(`WebGL2 framebuffer incomplete for ${label}: status 0x${status.toString(16)}`)
  }
  return fb
}

/**
 * Transactional initialization resource tracker.
 *
 * Every WebGL object created during renderer construction is registered here.
 * If construction fails at any point:
 *   1. The catch block calls tracker.cleanup() which deletes all tracked objects.
 *   2. The error propagates to create() which returns a typed failure result.
 *
 * On successful construction, releaseOwnership() is called so the tracker's
 * cleanup becomes a no-op — dispose() then owns the full resource lifetime.
 */
class InitResourceTracker {
  private readonly gl: WebGL2RenderingContext
  private readonly shaders:      WebGLShader[]             = []
  private readonly programs:     WebGLProgram[]            = []
  private readonly textures:     WebGLTexture[]            = []
  private readonly framebuffers: WebGLFramebuffer[]        = []
  private readonly buffers:      WebGLBuffer[]             = []
  private readonly vertexArrays: WebGLVertexArrayObject[]  = []
  private released = false

  constructor(gl: WebGL2RenderingContext) { this.gl = gl }

  trackShader(s: WebGLShader):             WebGLShader             { this.shaders.push(s);      return s }
  trackProgram(p: WebGLProgram):           WebGLProgram            { this.programs.push(p);     return p }
  trackTexture(t: WebGLTexture):           WebGLTexture            { this.textures.push(t);     return t }
  trackFBO(f: WebGLFramebuffer):           WebGLFramebuffer        { this.framebuffers.push(f); return f }
  trackBuffer(b: WebGLBuffer):             WebGLBuffer             { this.buffers.push(b);      return b }
  trackVAO(v: WebGLVertexArrayObject):     WebGLVertexArrayObject  { this.vertexArrays.push(v); return v }

  /** Transfer ownership to the renderer instance — cleanup becomes a no-op. */
  releaseOwnership(): void { this.released = true }

  /**
   * Delete every tracked resource.  Safe to call on any partially-initialised
   * tracker — already-released trackers are ignored (prevents double-delete
   * if cleanup() is somehow called after releaseOwnership()).
   */
  cleanup(): void {
    if (this.released) return
    const gl = this.gl
    this.shaders.forEach(s      => gl.deleteShader(s))
    this.programs.forEach(p     => gl.deleteProgram(p))
    this.textures.forEach(t     => gl.deleteTexture(t))
    this.framebuffers.forEach(f => gl.deleteFramebuffer(f))
    this.buffers.forEach(b      => gl.deleteBuffer(b))
    this.vertexArrays.forEach(v => gl.deleteVertexArray(v))
    this.released = true  // prevent accidental second call
  }
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
interface DispLocs  {
  u_tex: WebGLUniformLocation
  u_dispOffX: WebGLUniformLocation
  u_dispOffY: WebGLUniformLocation
  u_dispAmount: WebGLUniformLocation
  u_dispHueRad: WebGLUniformLocation
}
interface TxLocs {
  u_out: WebGLUniformLocation
  u_in: WebGLUniformLocation
  u_progress: WebGLUniformLocation
  u_type: WebGLUniformLocation
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
  private videoProg!:  WebGLProgram
  private rgbProg!:    WebGLProgram
  private threshProg!: WebGLProgram
  private blurProg!:   WebGLProgram
  private bloomProg!:  WebGLProgram
  private passProg!:   WebGLProgram
  private postProg!:   WebGLProgram
  private dispProg!:   WebGLProgram
  private txProg!:     WebGLProgram

  // Uniform locations
  private videoLocs!:  VideoLocs
  private rgbLocs!:    RgbLocs
  private threshLocs!: ThreshLocs
  private blurLocs!:   BlurLocs
  private bloomLocs!:  BloomCompLocs
  private passLocs!:   PassLocs
  private postLocs!:   PostLocs
  private dispLocs!:   DispLocs
  private txLocs!:     TxLocs

  // Geometry
  private vao!: WebGLVertexArrayObject
  private vbo!: WebGLBuffer

  // Textures and FBOs
  private videoTex!: WebGLTexture   // per-frame upload from media element
  private videoTexW = 0; private videoTexH = 0

  private sceneTex!:  WebGLTexture;  private sceneFBO!:  WebGLFramebuffer
  private rgbTex!:    WebGLTexture;  private rgbFBO!:    WebGLFramebuffer
  private bloom1Tex!: WebGLTexture;  private bloom1FBO!: WebGLFramebuffer
  private bloom2Tex!: WebGLTexture;  private bloom2FBO!: WebGLFramebuffer
  // Post-process FBO: holds pre-final output when grain or scanlines are active
  private postTex!:   WebGLTexture;  private postFBO!:   WebGLFramebuffer
  // Displacement FBO: holds pre-displacement output when the displacement pass is active
  private dispTex!:   WebGLTexture;  private dispFBO!:   WebGLFramebuffer
  // Transition FBOs: hold GPU-rendered out/in sources during clip transitions
  private txOutTex!:  WebGLTexture;  private txOutFBO!:  WebGLFramebuffer
  private txInTex!:   WebGLTexture;  private txInFBO!:   WebGLFramebuffer

  private disposed = false

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

    // All GPU resources are registered with the tracker as they are created.
    // If any allocation throws, the catch block calls tracker.cleanup() which
    // deletes every resource successfully created so far — no GPU memory leaks
    // from a partially-constructed renderer.
    const tracker = new InitResourceTracker(gl)
    try {
      // ── Compile shaders ──────────────────────────────────────────────────
      const vert     = tracker.trackShader(compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC,              'vertex shader'))
      const fragVideo  = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, VIDEO_FRAG,            'video fragment shader'))
      const fragRgb    = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, RGBSPLIT_FRAG,         'RGB split fragment shader'))
      const fragThresh = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_THRESHOLD_FRAG,  'bloom threshold fragment shader'))
      const fragBlur   = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_BLUR_FRAG,       'bloom blur fragment shader'))
      const fragBloom  = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_COMPOSITE_FRAG,  'bloom composite fragment shader'))
      const fragPass   = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, PASS_FRAG,             'passthrough fragment shader'))
      const fragPost   = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, POST_PROCESS_FRAG,     'post-process fragment shader'))
      const fragDisp   = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, DISPLACEMENT_FRAG,     'displacement fragment shader'))
      const fragTx     = tracker.trackShader(compileShader(gl, gl.FRAGMENT_SHADER, GPU_TRANSITION_FRAG,   'transition fragment shader'))

      // ── Create programs (no link yet — attribs bound before first link) ──
      const vP  = tracker.trackProgram(makeProgram(gl, vert, fragVideo,  'video draw'))
      const rP  = tracker.trackProgram(makeProgram(gl, vert, fragRgb,    'RGB split'))
      const tP  = tracker.trackProgram(makeProgram(gl, vert, fragThresh, 'bloom threshold'))
      const bP  = tracker.trackProgram(makeProgram(gl, vert, fragBlur,   'bloom blur'))
      const cP  = tracker.trackProgram(makeProgram(gl, vert, fragBloom,  'bloom composite'))
      const pP  = tracker.trackProgram(makeProgram(gl, vert, fragPass,   'passthrough'))
      const ppP = tracker.trackProgram(makeProgram(gl, vert, fragPost,   'post-process'))
      const dP  = tracker.trackProgram(makeProgram(gl, vert, fragDisp,   'displacement'))
      const txP = tracker.trackProgram(makeProgram(gl, vert, fragTx,     'transition composite'))

      this.videoProg  = vP;  this.rgbProg   = rP
      this.threshProg = tP;  this.blurProg  = bP
      this.bloomProg  = cP;  this.passProg  = pP
      this.postProg   = ppP; this.dispProg  = dP
      this.txProg     = txP

      // Bind attribute locations BEFORE the single link pass so no relink is needed.
      gl.bindAttribLocation(vP,  0, 'a_pos'); gl.bindAttribLocation(vP,  1, 'a_uv')
      gl.bindAttribLocation(rP,  0, 'a_pos'); gl.bindAttribLocation(rP,  1, 'a_uv')
      gl.bindAttribLocation(tP,  0, 'a_pos'); gl.bindAttribLocation(tP,  1, 'a_uv')
      gl.bindAttribLocation(bP,  0, 'a_pos'); gl.bindAttribLocation(bP,  1, 'a_uv')
      gl.bindAttribLocation(cP,  0, 'a_pos'); gl.bindAttribLocation(cP,  1, 'a_uv')
      gl.bindAttribLocation(pP,  0, 'a_pos'); gl.bindAttribLocation(pP,  1, 'a_uv')
      gl.bindAttribLocation(ppP, 0, 'a_pos'); gl.bindAttribLocation(ppP, 1, 'a_uv')
      gl.bindAttribLocation(dP,  0, 'a_pos'); gl.bindAttribLocation(dP,  1, 'a_uv')
      gl.bindAttribLocation(txP, 0, 'a_pos'); gl.bindAttribLocation(txP, 1, 'a_uv')

      // ── Link programs (single validated pass) ────────────────────────────
      linkChecked(gl, vP,  'video draw')
      linkChecked(gl, rP,  'RGB split')
      linkChecked(gl, tP,  'bloom threshold')
      linkChecked(gl, bP,  'bloom blur')
      linkChecked(gl, cP,  'bloom composite')
      linkChecked(gl, pP,  'passthrough')
      linkChecked(gl, ppP, 'post-process')
      linkChecked(gl, dP,  'displacement')
      linkChecked(gl, txP, 'transition composite')

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
      this.dispLocs  = {
        u_tex:         gl.getUniformLocation(dP, 'u_tex')!,
        u_dispOffX:    gl.getUniformLocation(dP, 'u_dispOffX')!,
        u_dispOffY:    gl.getUniformLocation(dP, 'u_dispOffY')!,
        u_dispAmount:  gl.getUniformLocation(dP, 'u_dispAmount')!,
        u_dispHueRad:  gl.getUniformLocation(dP, 'u_dispHueRad')!,
      }
      this.txLocs = {
        u_out:      gl.getUniformLocation(txP, 'u_out')!,
        u_in:       gl.getUniformLocation(txP, 'u_in')!,
        u_progress: gl.getUniformLocation(txP, 'u_progress')!,
        u_type:     gl.getUniformLocation(txP, 'u_type')!,
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
      const vao = gl.createVertexArray()
      if (!vao) throw new Error('WebGL2 vertex array allocation failed during geometry setup')
      this.vao = tracker.trackVAO(vao)

      const vbo = gl.createBuffer()
      if (!vbo) throw new Error('WebGL2 buffer allocation failed during geometry setup')
      this.vbo = tracker.trackBuffer(vbo)

      gl.bindVertexArray(this.vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
      const stride = 4 * 4  // 4 floats × 4 bytes
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8)
      gl.bindVertexArray(null)

      // Shaders are no longer needed once all programs are linked.
      // Programs retain the compiled binary; releasing the shader handles now
      // frees GPU memory without waiting for dispose().
      ;[vert, fragVideo, fragRgb, fragThresh, fragBlur, fragBloom, fragPass, fragPost, fragDisp, fragTx]
        .forEach(s => gl.deleteShader(s))

      // ── Video texture (placeholder 1×1 black) ─────────────────────────────
      this.videoTex = tracker.trackTexture(makeTexture(gl, 'video source texture'))
      gl.bindTexture(gl.TEXTURE_2D, this.videoTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]))
      gl.bindTexture(gl.TEXTURE_2D, null)

      // ── Scene + effect FBOs (placeholder 1×1) ────────────────────────────
      this.sceneTex  = tracker.trackTexture(makeTexture(gl, 'scene render target'))
      this.sceneFBO  = tracker.trackFBO(makeFBO(gl, this.sceneTex,  1, 1, 'scene render target'))
      this.rgbTex    = tracker.trackTexture(makeTexture(gl, 'RGB split render target'))
      this.rgbFBO    = tracker.trackFBO(makeFBO(gl, this.rgbTex,    1, 1, 'RGB split render target'))
      this.bloom1Tex = tracker.trackTexture(makeTexture(gl, 'bloom pass 1 render target'))
      this.bloom1FBO = tracker.trackFBO(makeFBO(gl, this.bloom1Tex, 1, 1, 'bloom pass 1 render target'))
      this.bloom2Tex = tracker.trackTexture(makeTexture(gl, 'bloom pass 2 render target'))
      this.bloom2FBO = tracker.trackFBO(makeFBO(gl, this.bloom2Tex, 1, 1, 'bloom pass 2 render target'))
      this.postTex   = tracker.trackTexture(makeTexture(gl, 'post-process render target'))
      this.postFBO   = tracker.trackFBO(makeFBO(gl, this.postTex,   1, 1, 'post-process render target'))
      this.dispTex   = tracker.trackTexture(makeTexture(gl, 'displacement render target'))
      this.dispFBO   = tracker.trackFBO(makeFBO(gl, this.dispTex,   1, 1, 'displacement render target'))
      this.txOutTex  = tracker.trackTexture(makeTexture(gl, 'transition out render target'))
      this.txOutFBO  = tracker.trackFBO(makeFBO(gl, this.txOutTex,  1, 1, 'transition out render target'))
      this.txInTex   = tracker.trackTexture(makeTexture(gl, 'transition in render target'))
      this.txInFBO   = tracker.trackFBO(makeFBO(gl, this.txInTex,   1, 1, 'transition in render target'))

      // All resources created successfully — transfer ownership to this instance.
      // dispose() is now responsible for cleanup; the tracker is done.
      tracker.releaseOwnership()

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
    } catch (e) {
      // Partial-initialisation cleanup: delete every GPU resource created so far.
      // This guarantees no leaked textures, FBOs, programs, or shaders when
      // create() returns a typed failure result instead of a renderer instance.
      tracker.cleanup()
      throw e
    }
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  private resize(w: number, h: number): void {
    const gl = this.gl
    this._canvas.width  = w
    this._canvas.height = h
    this.canvasW = w; this.canvasH = h

    resizeFBOTexture(gl, this.sceneTex,  w, h)
    resizeFBOTexture(gl, this.rgbTex,   w, h)
    resizeFBOTexture(gl, this.postTex,  w, h)
    resizeFBOTexture(gl, this.dispTex,  w, h)
    resizeFBOTexture(gl, this.txOutTex, w, h)
    resizeFBOTexture(gl, this.txInTex,  w, h)

    this.bloomW = Math.max(1, Math.ceil(w / 2))
    this.bloomH = Math.max(1, Math.ceil(h / 2))
    resizeFBOTexture(gl, this.bloom1Tex, this.bloomW, this.bloomH)
    resizeFBOTexture(gl, this.bloom2Tex, this.bloomW, this.bloomH)
  }

  // ── DOM media texture upload ─────────────────────────────────────────────────

  /**
   * Upload an HTMLImageElement or HTMLVideoElement into a WebGL texture.
   *
   * DOM elements use top-left (y=0=top) pixel ordering.  WebGL textures use
   * bottom-left (y=0=bottom) ordering.  Setting UNPACK_FLIP_Y_WEBGL before
   * the upload makes the GPU flip the rows automatically, so the texture
   * enters the pipeline in WebGL convention and the VIDEO_FRAG shader's
   * `1.0 - ry` sample correctly maps texture y=1 (image top) to canvas top.
   *
   * This method must ONLY be called for DOM-backed sources.  FBO textures,
   * sized-null allocations, and typed-array uploads must never go through here —
   * those already obey the WebGL bottom-left convention and must not be flipped.
   */
  private uploadDomMediaTexture(
    texture: WebGLTexture,
    source: HTMLImageElement | HTMLVideoElement,
    allocate: boolean,
  ): boolean {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    try {
      if (allocate) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source)
      }
      return true
    } catch {
      // CORS or decode error — leave placeholder texture
      return false
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
  }

  private uploadVideoTexture(el: HTMLImageElement | HTMLVideoElement): boolean {
    // Guard: element must have renderable data before upload
    if (el instanceof HTMLVideoElement) {
      if (el.readyState < 2 || el.videoWidth === 0 || el.videoHeight === 0) return false
    } else {
      if (!el.complete || el.naturalWidth === 0) return false
    }

    const elW = el instanceof HTMLVideoElement ? el.videoWidth  : el.naturalWidth
    const elH = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight
    const allocate = this.videoTexW !== elW || this.videoTexH !== elH

    const ok = this.uploadDomMediaTexture(this.videoTex, el, allocate)
    if (ok && allocate) {
      this.videoTexW = elW
      this.videoTexH = elH
    }
    return ok
  }

  // ── Draw fullscreen quad ─────────────────────────────────────────────────────

  private drawQuad(): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  /**
   * Renders p into outputFbo (null = outputCanvas).
   * Does NOT call gl.flush() — the public methods do that.
   */
  private _renderFrameToFbo(p: RenderFrameParams, outputFbo: WebGLFramebuffer | null): void {
    const gl = this.gl
    const { canvasW: W, canvasH: H } = p

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
      gl.uniform4f(this.videoLocs.u_rect, 0, 0, 0, 0)
    }
    gl.uniform4f(this.videoLocs.u_bg, p.bgR, p.bgG, p.bgB, 1.0)
    this.drawQuad()

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

    const needsPost = p.grainAmount > 0 || p.scanAlpha > 0
    const needsDisp = p.dispAmount > 0

    // ── Stage 3: Bloom (optional) ──────────────────────────────────────────
    const stage3Dest = needsPost ? this.postFBO : (needsDisp ? this.dispFBO : outputFbo)

    if (p.bloomBlurPx > 0 && p.bloomAmount > 0 && uploaded) {
      const bW = this.bloomW, bH = this.bloomH

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom1FBO)
      gl.viewport(0, 0, bW, bH)
      gl.useProgram(this.threshProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, curSceneTex)
      gl.uniform1i(this.threshLocs.u_tex, 0)
      this.drawQuad()

      const sigma = Math.max(0.5, p.bloomBlurPx / 2)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom2FBO)
      gl.viewport(0, 0, bW, bH)
      gl.useProgram(this.blurProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.bloom1Tex)
      gl.uniform1i(this.blurLocs.u_tex, 0)
      gl.uniform2f(this.blurLocs.u_dir, 1.0 / bW, 0)
      gl.uniform1f(this.blurLocs.u_radius, sigma)
      this.drawQuad()

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom1FBO)
      gl.viewport(0, 0, bW, bH)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.bloom2Tex)
      gl.uniform2f(this.blurLocs.u_dir, 0, 1.0 / bH)
      this.drawQuad()

      gl.bindFramebuffer(gl.FRAMEBUFFER, stage3Dest)
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
      gl.bindFramebuffer(gl.FRAMEBUFFER, stage3Dest)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.passProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, curSceneTex)
      gl.uniform1i(this.passLocs.u_tex, 0)
      this.drawQuad()
    }

    // ── Stage 4: Post-process — grain + scanlines (optional) ──────────────
    if (needsPost) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, needsDisp ? this.dispFBO : outputFbo)
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

    // ── Stage 5: Displacement ghost (optional) ────────────────────────────
    if (needsDisp) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.dispProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.dispTex)
      gl.uniform1i(this.dispLocs.u_tex,        0)
      gl.uniform1f(this.dispLocs.u_dispOffX,   p.dispOffXPx / W)
      gl.uniform1f(this.dispLocs.u_dispOffY,   p.dispOffYPx / H)
      gl.uniform1f(this.dispLocs.u_dispAmount, p.dispAmount)
      gl.uniform1f(this.dispLocs.u_dispHueRad, p.dispHueRad)
      this.drawQuad()
    }

    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null)
  }

  renderFrame(p: RenderFrameParams): void {
    if (this.disposed || this._contextLost) return
    const gl = this.gl
    const { canvasW: W, canvasH: H } = p
    if (W !== this.canvasW || H !== this.canvasH) this.resize(W, H)
    this._renderFrameToFbo(p, null)
    gl.flush()
  }

  /**
   * Render a GPU-composited clip transition directly to the output canvas.
   * Both sources are rendered through the full GPU pipeline (RGB Split, Bloom,
   * grain, scanlines, Displacement) into dedicated FBOs, then composited by
   * the transition shader.  No intermediate Canvas 2D copy is required.
   *
   * If inEl is null the outgoing source is rendered without transition.
   */
  renderTransition(p: RenderTransitionParams): void {
    if (this.disposed || this._contextLost) return
    const gl = this.gl
    const { canvasW: W, canvasH: H } = p
    if (W !== this.canvasW || H !== this.canvasH) this.resize(W, H)
    if (W === 0 || H === 0) return

    // Shared effect params template — only mediaEl and geometry differ per source.
    const shared: Omit<RenderFrameParams, 'mediaEl' | 'ox' | 'oy' | 'sw' | 'sh'> = {
      canvasW: W, canvasH: H,
      rgbShiftPx:  p.rgbShiftPx,
      bloomBlurPx: p.bloomBlurPx, bloomAmount: p.bloomAmount,
      bgR: p.bgR, bgG: p.bgG, bgB: p.bgB,
      grainAmount: p.grainAmount, scanAlpha: p.scanAlpha, scanStep: p.scanStep,
      dispOffXPx: p.dispOffXPx, dispOffYPx: p.dispOffYPx,
      dispAmount: p.dispAmount, dispHueRad: p.dispHueRad,
    }

    // Render outgoing source → txOutFBO
    this._renderFrameToFbo(
      { ...shared, mediaEl: p.outEl, ox: p.outOx, oy: p.outOy, sw: p.outSw, sh: p.outSh },
      this.txOutFBO,
    )

    if (p.inEl === null) {
      // No incoming clip: blit outgoing directly to canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, W, H)
      gl.useProgram(this.passProg)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.txOutTex)
      gl.uniform1i(this.passLocs.u_tex, 0)
      this.drawQuad()
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null)
      gl.flush()
      return
    }

    // Render incoming source → txInFBO
    this._renderFrameToFbo(
      { ...shared, mediaEl: p.inEl, ox: p.inOx, oy: p.inOy, sw: p.inSw, sh: p.inSh },
      this.txInFBO,
    )

    // Composite out + in → canvas using the GPU transition shader
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
    gl.useProgram(this.txProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.txOutTex)
    gl.uniform1i(this.txLocs.u_out, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.txInTex)
    gl.uniform1i(this.txLocs.u_in, 1)
    gl.uniform1f(this.txLocs.u_progress, p.progress)
    gl.uniform1i(this.txLocs.u_type,     p.transitionType)
    this.drawQuad()

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
    // Idempotency guard — safe to call multiple times (e.g. during context
    // restoration when the stale renderer is disposed after re-init succeeds).
    if (this.disposed) return
    this.disposed = true

    // Remove event listeners FIRST so the loseContext() call below cannot
    // re-trigger the onContextLost callback on the caller.
    this._canvas.removeEventListener('webglcontextlost',    this._contextLostHandler)
    this._canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler)

    const gl = this.gl
    ;[this.videoProg, this.rgbProg, this.threshProg, this.blurProg, this.bloomProg, this.passProg, this.postProg, this.dispProg, this.txProg]
      .forEach(p => gl.deleteProgram(p))
    gl.deleteBuffer(this.vbo)
    gl.deleteVertexArray(this.vao)
    ;[this.videoTex, this.sceneTex, this.rgbTex, this.bloom1Tex, this.bloom2Tex, this.postTex, this.dispTex, this.txOutTex, this.txInTex]
      .forEach(t => gl.deleteTexture(t))
    ;[this.sceneFBO, this.rgbFBO, this.bloom1FBO, this.bloom2FBO, this.postFBO, this.dispFBO, this.txOutFBO, this.txInFBO]
      .forEach(f => gl.deleteFramebuffer(f))
    // Release GPU context via WEBGL_lose_context if available
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}
