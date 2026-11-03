import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import type { CanvasDataBleedSettings } from './DataBleedSettings'
import { DATA_BLEED_MAX_SOURCE_EDGE, DATA_BLEED_MAX_TRANSIENT_BYTES, dataBleedSize, resolveDataBleedPlan } from './DataBleedRenderPlan'
import { DATA_BLEED_COPY, DATA_BLEED_FEEDBACK, DATA_BLEED_PRESENT, DATA_BLEED_VERTEX } from './DataBleedShaders'
import type { DataBleedDecision } from './DataBleedPerformanceController'
export type DataBleedSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
export type DataBleedTransform = { scale: number; positionX: number; positionY: number; rotation: number }
export interface DataBleedFrame {
  source: DataBleedSource | null
  settings: CanvasDataBleedSettings
  timeSec: number
  deltaSec: number
  fitMode: CanvasFitMode
  sourceTransform: DataBleedTransform
  performance?: DataBleedDecision
  /** Canvas fixtures can publish explicit frame identity; video uses currentTime. */
  sourceFrameId?: number
  viewport?: { width: number; height: number }
}
type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number }
export function dataBleedSourceSize(source: DataBleedSource | null) {
  if (!source) return null
  if ('videoWidth' in source) return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0 ? { width: source.videoWidth, height: source.videoHeight } : null
  if ('naturalWidth' in source) return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0 ? { width: source.naturalWidth, height: source.naturalHeight } : null
  return source.width > 0 && source.height > 0 ? { width: source.width, height: source.height } : null
}
/** One current source texture, two original-frame targets and two feedback targets.
 * Source and video motion never sample the recursively processed history. */
export class DataBleedRenderer {
  private programs: ShaderProgram[] = []
  private sourceTexture: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject | null = null
  private motion: Target[] = []
  private history: Target[] = []
  private motionIndex = 0
  private historyIndex = 0
  private motionValid = false
  private motionPair = false
  private historyValid = false
  private warmup = 6
  private input: DataBleedSource | null = null
  private inputUrl = ''
  private sourceSize = { width: 1, height: 1 }
  private uploadSize = { width: 0, height: 0 }
  private sourceStamp: number | null = null
  private sourceTime: number | null = null
  private sourceDelta = 1 / 30
  private staging: HTMLCanvasElement | null = null
  private targetKey = ''
  private modeKey = ''
  private lastTime: number | null = null
  private disposed = false
  private sourceUploads = 0
  private feedbackUpdates = 0
  private allocations = 0
  private tier: 'low' | 'balanced' | 'high' = 'balanced'
  private drawPasses = 0
  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {}
  static create(canvas: HTMLCanvasElement): { renderer: DataBleedRenderer | null; error: string | null } {
    let renderer: DataBleedRenderer | null = null
    try {
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: false })
      if (!gl) return { renderer: null, error: 'WebGL2 unavailable' }
      renderer = new DataBleedRenderer(canvas, gl)
      for (const [label, fragSrc] of [['copy', DATA_BLEED_COPY], ['feedback', DATA_BLEED_FEEDBACK], ['present', DATA_BLEED_PRESENT]]) {
        const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { vertSrc: DATA_BLEED_VERTEX, fragSrc, label: `Data Bleed/${label}` })
        if (!result.program) throw new Error(result.error.log)
        renderer.programs.push(result.program)
      }
      renderer.sourceTexture = renderer.texture()
      renderer.vao = gl.createVertexArray()
      if (!renderer.vao) throw new Error('Data Bleed vertex allocation failed')
      return { renderer, error: null }
    } catch (error) { renderer?.dispose(); return { renderer: null, error: error instanceof Error ? error.message : 'Data Bleed initialization failed' } }
  }
  resize(width: number, height: number): void {
    if (this.disposed) return
    const edge = Math.min(2560, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE))
    const size = dataBleedSize(width, height, edge)
    if (size.width === this.canvas.width && size.height === this.canvas.height) return
    this.canvas.width = size.width; this.canvas.height = size.height
    this.releaseTargets()
  }
  resetHistory(refreshVideo = true): void {
    this.historyValid = false; this.motionValid = false; this.motionPair = false
    this.warmup = 6; this.lastTime = null
    if (refreshVideo && this.input && 'videoWidth' in this.input) this.sourceStamp = null
  }
  render(frame: DataBleedFrame): boolean {
    const { source, performance: decision } = frame
    const dimensions = dataBleedSourceSize(source)
    if (this.disposed || this.gl.isContextLost() || !source || !dimensions) return false
    this.drawPasses = 0
    const gl = this.gl, authored = frame.settings, settings = decision?.settings ?? authored
    const time = decision?.motionTimeSec ?? frame.timeSec
    const viewport = frame.viewport ?? this.canvas
    const plan = resolveDataBleedPlan(settings, viewport.width, viewport.height)
    this.tier = plan.tier
    const isVideo = 'videoWidth' in source
    const mediaTime = isVideo ? source.currentTime : 'naturalWidth' in source ? 0 : frame.sourceFrameId ?? frame.timeSec
    const decodedFrames = isVideo && typeof source.getVideoPlaybackQuality === 'function' ? source.getVideoPlaybackQuality().totalVideoFrames : 0
    const sourceStamp = decodedFrames > 0 ? decodedFrames : mediaTime
    const url = 'currentSrc' in source ? source.currentSrc || source.src : ''
    const newInput = this.input !== source || this.inputUrl !== url || dimensions.width !== this.sourceSize.width || dimensions.height !== this.sourceSize.height
    if (newInput) {
      this.input = source; this.inputUrl = url; this.sourceStamp = null; this.sourceTime = null; this.sourceSize = dimensions
      this.releaseTargets()
    }
    const sourceDiscontinuity = isVideo && this.sourceTime !== null && (mediaTime < this.sourceTime - 1e-5 || mediaTime - this.sourceTime > 0.5)
    if (sourceDiscontinuity) this.resetHistory()
    if (decision?.reset || (this.lastTime !== null && (time < this.lastTime || time - this.lastTime > 0.5))) this.resetHistory()
    this.lastTime = time
    const mode = !isVideo || settings.flowMode === 'procedural' ? 1 : settings.flowMode === 'motion' ? 0 : 2
    const modeKey = `${mode}:${settings.deterministicSeed}`
    if (modeKey !== this.modeKey) { this.resetHistory(); this.modeKey = modeKey }
    if (!newInput && !plan.clean && settings.freezeHistory && this.historyValid && !decision?.positionReset) {
      this.present(frame, this.history[this.historyIndex].texture, settings.amount * (1 - settings.sourceMix)); return true
    }
    let fresh = this.sourceStamp !== sourceStamp || sourceDiscontinuity
    if (fresh) {
      this.upload(source, dimensions)
      this.sourceDelta = this.sourceTime === null ? 1 / 30 : Math.max(1 / 240, Math.min(0.25, Math.abs(mediaTime - this.sourceTime)))
      this.sourceStamp = sourceStamp; this.sourceTime = mediaTime
    }
    if (plan.clean) {
      this.resetHistory(); this.present(frame, this.sourceTexture!, 0)
      return true
    }
    const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
    const historySize = dataBleedSize(dimensions.width, dimensions.height, Math.min(limit, plan.historyEdge))
    const motionSize = dataBleedSize(dimensions.width, dimensions.height, Math.min(limit, plan.motionEdge))
    const key = `${historySize.width}:${historySize.height}:${motionSize.width}:${motionSize.height}`
    if (key !== this.targetKey) {
      this.releaseTargets()
      try {
        for (let i = 0; i < 2; i++) this.motion.push(this.target(motionSize.width, motionSize.height))
        for (let i = 0; i < 2; i++) this.history.push(this.target(historySize.width, historySize.height))
        this.targetKey = key
      } catch (error) { this.releaseTargets(); throw error }
      fresh = true
    }
    if (fresh || !this.motionValid) {
      const hadPrevious = this.motionValid
      const target = this.motion[1 - this.motionIndex]
      this.draw(this.programs[0], target)
      this.bind(this.programs[0], 'uSource', this.sourceTexture!, 0)
      this.triangle()
      this.motionIndex = 1 - this.motionIndex
      this.motionPair = hadPrevious && isVideo
      this.motionValid = true
      if (!hadPrevious) {
        const previous = this.motion[1 - this.motionIndex]
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer)
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previous.framebuffer)
        gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, previous.width, previous.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      }
    }
    const program = this.programs[1], write = this.history[1 - this.historyIndex]
    this.draw(program, write)
    this.bind(program, 'uSource', this.sourceTexture!, 0)
    this.bind(program, 'uCurrent', this.motion[this.motionIndex].texture, 1)
    this.bind(program, 'uPrevious', this.motion[1 - this.motionIndex].texture, 2)
    this.bind(program, 'uHistory', this.historyValid ? this.history[this.historyIndex].texture : this.motion[this.motionIndex].texture, 3)
    program.setVec2('uSourceSize', dimensions.width, dimensions.height)
    program.setVec2('uMotionTexel', 1 / motionSize.width, 1 / motionSize.height)
    program.setFloat('uTime', time * settings.flowSpeed)
    program.setFloat('uDelta', Math.max(0.05, Math.min(6, frame.deltaSec * 60)))
    program.setFloat('uMotionRatio', Math.max(0, Math.min(3, frame.deltaSec / this.sourceDelta)))
    program.setFloat('uAmount', settings.amount * (1 - settings.sourceMix))
    program.setFloat('uBlockSize', settings.blockSize)
    program.setFloat('uSensitivity', settings.motionSensitivity)
    program.setFloat('uSpeed', settings.flowSpeed)
    program.setFloat('uRetention', this.historyValid && this.warmup === 0 && plan.feedbackPasses ? settings.historyRetention : 0)
    program.setFloat('uRefresh', settings.sourceRefresh)
    program.setFloat('uDirection', settings.directionBias * Math.PI / 180)
    program.setFloat('uSeed', settings.deterministicSeed % 65536)
    program.setInt('uMode', mode); program.setBool('uMotionReady', this.motionPair)
    const audio = decision?.routing
    program.setVec4('uAudio', audio?.kick ?? 0, audio?.tear ?? 0, audio?.detail ?? 0, audio?.edge ?? 0)
    this.triangle(); this.feedbackUpdates++
    this.historyIndex = 1 - this.historyIndex; this.historyValid = true
    this.warmup = Math.max(0, this.warmup - 1)
    this.present(frame, write.texture, settings.amount * (1 - settings.sourceMix))
    return true
  }
  private upload(source: DataBleedSource, size: { width: number; height: number }) {
    const gl = this.gl, dimensions = dataBleedSize(size.width, size.height, Math.min(DATA_BLEED_MAX_SOURCE_EDGE, gl.getParameter(gl.MAX_TEXTURE_SIZE)))
    let input: DataBleedSource = source
    if (dimensions.width !== size.width || dimensions.height !== size.height) {
      this.staging ??= document.createElement('canvas')
      if (this.staging.width !== dimensions.width || this.staging.height !== dimensions.height) { this.staging.width = dimensions.width; this.staging.height = dimensions.height }
      const ctx = this.staging.getContext('2d', { alpha: true })
      if (!ctx) throw new Error('Data Bleed source resize unavailable')
      ctx.clearRect(0, 0, dimensions.width, dimensions.height); ctx.drawImage(source, 0, 0, dimensions.width, dimensions.height)
      input = this.staging
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    try {
      // Define storage explicitly before DOM/video uploads. A first decoded
      // frame must not leave the next texSubImage2D without a defined level 0.
      if (this.uploadSize.width !== dimensions.width || this.uploadSize.height !== dimensions.height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, dimensions.width, dimensions.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        this.allocationCheck()
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, input)
    } finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false) }
    this.allocationCheck(); this.uploadSize = dimensions; this.sourceUploads++
  }
  private present(frame: DataBleedFrame, texture: WebGLTexture, amount: number) {
    const program = this.programs[2], t = frame.sourceTransform
    this.draw(program, null)
    this.bind(program, 'uSource', this.sourceTexture!, 0); this.bind(program, 'uProcessed', texture, 1)
    const { width, height } = this.canvas, source = this.sourceSize
    const k = frame.fitMode === 'cover' ? Math.max(width / source.width, height / source.height) : Math.min(width / source.width, height / source.height)
    program.setVec2('uResolution', width, height)
    program.setVec2('uFitSize', frame.fitMode === 'stretch' ? width : source.width * k, frame.fitMode === 'stretch' ? height : source.height * k)
    program.setVec2('uPosition', width * t.positionX / 100, -height * t.positionY / 100)
    program.setFloat('uScale', t.scale); program.setFloat('uRotation', t.rotation * Math.PI / 180)
    program.setFloat('uAmount', amount); this.triangle()
  }
  private draw(program: ShaderProgram, target: Target | null) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null)
    gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height)
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST)
    program.activate(); gl.bindVertexArray(this.vao)
  }
  private triangle() { this.gl.drawArrays(this.gl.TRIANGLES, 0, 3); this.gl.bindVertexArray(null); this.drawPasses++ }
  private bind(program: ShaderProgram, name: string, texture: WebGLTexture, unit: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit); this.gl.bindTexture(this.gl.TEXTURE_2D, texture); program.setSampler(name, unit)
  }
  private texture() {
    const gl = this.gl, texture = gl.createTexture()
    if (!texture) throw new Error('Data Bleed texture allocation failed')
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }
  private target(width: number, height: number): Target {
    const gl = this.gl
    const bytes = [...this.motion, ...this.history].reduce((sum, t) => sum + t.width * t.height * 4, 0) + width * height * 4
    if (bytes > DATA_BLEED_MAX_TRANSIENT_BYTES) throw new Error('Data Bleed transient texture budget exceeded')
    const texture = this.texture(), framebuffer = gl.createFramebuffer()
    if (!framebuffer) { gl.deleteTexture(texture); throw new Error('Data Bleed framebuffer allocation failed') }
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); this.allocationCheck()
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Data Bleed framebuffer incomplete')
    } catch (error) { gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer); throw error }
    this.allocations++; return { texture, framebuffer, width, height }
  }
  private allocationCheck() { const error = this.gl.getError(); if (error !== this.gl.NO_ERROR) throw new Error(`Data Bleed GPU allocation/upload failed (${error})`) }
  private releaseTargets() {
    for (const t of [...this.motion, ...this.history]) { this.gl.deleteTexture(t.texture); this.gl.deleteFramebuffer(t.framebuffer) }
    this.motion = []; this.history = []; this.targetKey = ''; this.motionIndex = 0; this.historyIndex = 0; this.resetHistory(false)
  }
  getDiagnostics() {
    return { disposed: this.disposed, quality: this.tier, output: { width: this.canvas.width, height: this.canvas.height },
      sourceUploads: this.sourceUploads, sourceBytes: this.uploadSize.width * this.uploadSize.height * 4,
      targets: this.motion.length + this.history.length, transientBytes: [...this.motion, ...this.history].reduce((sum, t) => sum + t.width * t.height * 4, 0),
      feedbackUpdates: this.feedbackUpdates, warmupFrames: this.warmup, motionPairReady: this.motionPair, allocations: this.allocations, programs: this.programs.length, drawPasses: this.drawPasses }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true; this.releaseTargets()
    for (const program of this.programs) program.dispose()
    this.programs = []; this.gl.deleteTexture(this.sourceTexture); this.gl.deleteVertexArray(this.vao)
    this.sourceTexture = null; this.vao = null; this.input = null; this.uploadSize = { width: 0, height: 0 }
    if (this.staging) { this.staging.width = 0; this.staging.height = 0; this.staging = null }
  }
}
