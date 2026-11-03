import type { CanvasFitMode, CanvasMediaItem } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import type { CanvasMutagenSettings, MutagenPattern } from './MutagenSettings'
import { MUTAGEN_MAX_SOURCE_EDGE, MUTAGEN_MAX_OUTPUT_EDGE, MUTAGEN_MAX_TARGET_EDGE, MutagenPatternTransition, resolveMutagenFramePlan, resolveMutagenQualityPlan } from './MutagenRenderPlan'
import { resolveMutagenReactiveSettings, type MutagenPerformanceDecision } from './MutagenPerformanceController'
import { createMutagenFragment, MUTAGEN_COMPOSITE, MUTAGEN_VERTEX } from './MutagenShaders'

export type MutagenSource = HTMLImageElement | HTMLCanvasElement
export type MutagenTransform = { scale: number; positionX: number; positionY: number; rotation: number }
export type MutagenFrame = {
  source: MutagenSource | null
  settings: CanvasMutagenSettings
  fitMode: CanvasFitMode
  sourceTransform: MutagenTransform
  timeSec: number
  /** UI transition time may advance while musical motion is paused. */
  transitionTimeSec?: number
  qualityViewport?: { width: number; height: number }
  performance?: MutagenPerformanceDecision
}

/** Primary media-slot eligibility, deliberately independent of overlay admission. */
export function isMutagenSource(item: CanvasMediaItem | null): boolean {
  return item?.type === 'image' || item?.type === 'svg'
}

export function resolveMutagenFitSize(fit: CanvasFitMode, sw: number, sh: number, width: number, height: number) {
  if (fit === 'stretch') return { width, height }
  const scale = fit === 'contain' ? Math.min(width / sw, height / sh) : Math.max(width / sw, height / sh)
  return { width: sw * scale, height: sh * scale }
}

export function resolveMutagenRenderSize(width: number, height: number, dpr: number, quality: CanvasMutagenSettings['quality']) {
  const plan = resolveMutagenQualityPlan(quality, width, height)
  const scale = Math.min(Math.max(1, dpr) * plan.renderScale, plan.maxEdge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number }

/** Extends the Phase 1 source/lifecycle with eight cached programs, one bounded
 * transition pair, and the existing two-target/one-pass temporal history. */
export class MutagenRenderer {
  private programs = new Map<MutagenPattern, ShaderProgram>()
  private compositeProgram: ShaderProgram | null = null
  private transition = new MutagenPatternTransition()
  private transitionTargets: Target[] = []
  private transitionKey = ''
  private frozenTransitionFrom = false
  private sourceTexture: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject | null = null
  private targets: Target[] = []
  private historyIndex = 0
  private historyValid = false
  private historyWarmupFrames = 6
  private uploadedSource: MutagenSource | null = null
  private uploadedUrl = ''
  private sourceWidth = 1
  private sourceHeight = 1
  private uploadedWidth = 0
  private uploadedHeight = 0
  private qualityTier = 'balanced' as 'low' | 'balanced' | 'high'
  private disposed = false
  private lastTime: number | null = null
  private transformKey = ''

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {}

  static create(canvas: HTMLCanvasElement): { renderer: MutagenRenderer | null; error: string | null } {
    let renderer: MutagenRenderer | null = null
    try {
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false })
      if (!gl) return { renderer: null, error: 'WebGL2 unavailable' }
      renderer = new MutagenRenderer(canvas, gl)
      renderer.getPatternProgram('liquify')
      renderer.sourceTexture = renderer.createTexture()
      renderer.vao = gl.createVertexArray()
      if (!renderer.vao) throw new Error('MUTAGEN vertex array allocation failed')
      return { renderer, error: null }
    } catch (error) {
      renderer?.dispose()
      return { renderer: null, error: error instanceof Error ? error.message : 'MUTAGEN initialization failed' }
    }
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const max = Math.min(MUTAGEN_MAX_OUTPUT_EDGE, this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE), this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE))
    const scale = Math.min(1, max / Math.max(1, width, height))
    width = Math.max(1, Math.round(width * scale)); height = Math.max(1, Math.round(height * scale))
    if (this.canvas.width === width && this.canvas.height === height) return
    this.canvas.width = width; this.canvas.height = height
    this.releaseTargets()
  }

  resetHistory(): void { this.historyValid = false; this.lastTime = null; this.historyWarmupFrames = 6 }

  render(authoredFrame: MutagenFrame): boolean {
    const performance = authoredFrame.performance
    const recipe = resolveMutagenReactiveSettings(authoredFrame.settings, performance)
    const expansion = performance ? 1 + (performance.routing.expansion - 1) * recipe.mutation * (1 - recipe.sourceMix) : 1
    const frame: MutagenFrame = performance ? {
      ...authoredFrame, settings: recipe,
      timeSec: performance.motionTimeSec,
      transitionTimeSec: performance.transitionTimeSec,
      sourceTransform: { ...authoredFrame.sourceTransform, scale: authoredFrame.sourceTransform.scale * expansion },
    } : authoredFrame
    if (performance?.reset) {
      this.resetHistory(); this.transition.reset(); this.transitionKey = ''; this.frozenTransitionFrom = false
    }
    const { source, settings, fitMode, sourceTransform: transform, timeSec } = frame
    const gl = this.gl
    if (this.disposed || gl.isContextLost() || !source) return false
    const sw = 'naturalWidth' in source ? source.naturalWidth : source.width
    const sh = 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!sw || !sh || ('complete' in source && !source.complete)) return false
    const url = 'currentSrc' in source ? source.currentSrc || source.src : ''
    if (this.uploadedSource !== source || this.uploadedUrl !== url) {
      let input: MutagenSource = source
      const max = Math.min(MUTAGEN_MAX_SOURCE_EDGE, gl.getParameter(gl.MAX_TEXTURE_SIZE))
      if (Math.max(sw, sh) > max) {
        const staging = document.createElement('canvas')
        const scale = max / Math.max(sw, sh)
        staging.width = Math.max(1, Math.round(sw * scale)); staging.height = Math.max(1, Math.round(sh * scale))
        const context = staging.getContext('2d')
        if (!context) throw new Error('MUTAGEN source resize failed')
        context.drawImage(source, 0, 0, staging.width, staging.height)
        input = staging
      }
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input) }
      finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false) }
      this.checkAllocationError('source upload')
      this.uploadedWidth = 'naturalWidth' in input ? input.naturalWidth : input.width
      this.uploadedHeight = 'naturalHeight' in input ? input.naturalHeight : input.height
      this.uploadedSource = source; this.uploadedUrl = url
      this.sourceWidth = sw; this.sourceHeight = sh
      this.transition.reset()
      this.resetHistory()
    }
    const baseTransform = authoredFrame.sourceTransform
    const key = `${fitMode}:${baseTransform.scale}:${baseTransform.positionX}:${baseTransform.positionY}:${baseTransform.rotation}`
    if (key !== this.transformKey || (this.lastTime !== null && (timeSec < this.lastTime || timeSec - this.lastTime > 0.5))) this.resetHistory()
    this.transformKey = key; this.lastTime = timeSec
    const transition = this.transition.update(settings.pattern, frame.transitionTimeSec ?? timeSec, settings.transitionDuration)
    const transitionKey = `${transition.from}:${transition.to}:${transition.active}`
    const viewport = frame.qualityViewport ?? this.canvas
    const plan = resolveMutagenFramePlan(settings, viewport.width, viewport.height, transition.active)
    this.qualityTier = plan.tier
    if (transitionKey !== this.transitionKey) {
      this.frozenTransitionFrom = false
      // Snapshot the last history-backed output before clearing it. Trails fade
      // out with the outgoing mode; the new mode never reads its history.
      if (transition.active && !plan.clean && this.historyValid) {
        const previous = this.targets[this.historyIndex]
        this.ensureTransitionTargets()
        const frozen = this.transitionTargets[0]
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous.framebuffer)
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, frozen.framebuffer)
        gl.blitFramebuffer(0, 0, previous.width, previous.height, 0, 0, frozen.width, frozen.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
        this.frozenTransitionFrom = true
      }
      this.resetHistory()
    }
    this.transitionKey = transitionKey
    if (transition.active && !plan.clean) {
      this.ensureTransitionTargets()
      if (!this.frozenTransitionFrom) this.drawPattern(frame, transition.from, this.transitionTargets[0], 0, this.sourceTexture)
      this.drawPattern(frame, transition.to, this.transitionTargets[1], 0, this.sourceTexture)
      this.composite(this.transitionTargets[0], this.transitionTargets[1], transition.mix, plan.glow)
      return true
    }
    const feedback = plan.feedback
    const historyScale = Math.min(plan.feedbackScale, MUTAGEN_MAX_TARGET_EDGE / Math.max(this.canvas.width, this.canvas.height))
    const historyWidth = Math.max(1, Math.round(this.canvas.width * historyScale))
    const historyHeight = Math.max(1, Math.round(this.canvas.height * historyScale))
    if (feedback > 0 && this.targets.length && (this.targets[0].width !== historyWidth || this.targets[0].height !== historyHeight)) this.releaseHistoryTargets()
    if (feedback > 0 && !this.targets.length) {
      try { this.targets.push(this.createTarget(historyWidth, historyHeight)); this.targets.push(this.createTarget(historyWidth, historyHeight)) }
      catch (error) { this.releaseTargets(); throw error }
    }
    if (feedback === 0) this.resetHistory()
    let target = feedback > 0 ? this.targets[1 - this.historyIndex] : null
    if (!target && plan.glow > 0) {
      this.ensureTransitionTargets()
      target = this.transitionTargets[1]
    }
    const history = this.historyValid ? this.targets[this.historyIndex].texture : this.sourceTexture
    this.drawPattern(frame, transition.to, target, this.historyValid && this.historyWarmupFrames === 0 ? feedback : 0, history)
    if (target) {
      if (plan.glow > 0) this.composite(target, target, 1, plan.glow)
      else {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer)
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
        gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      }
      if (feedback > 0) { this.historyIndex = 1 - this.historyIndex; this.historyValid = true; this.historyWarmupFrames = Math.max(0, this.historyWarmupFrames - 1) }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindVertexArray(null)
    return true
  }

  private getPatternProgram(pattern: MutagenPattern): ShaderProgram {
    const cached = this.programs.get(pattern)
    if (cached) return cached
    const result = ShaderProgram.create(this.gl, new ShaderCompiler(this.gl), { vertSrc: MUTAGEN_VERTEX, fragSrc: createMutagenFragment(pattern), label: `MUTAGEN/${pattern}` })
    if (!result.program) throw new Error(result.error.log)
    this.programs.set(pattern, result.program)
    return result.program
  }

  private drawPattern(frame: MutagenFrame, pattern: MutagenPattern, target: Target | null, feedback: number, history: WebGLTexture | null): void {
    const { settings, fitMode, sourceTransform: transform, timeSec } = frame
    const gl = this.gl, program = this.getPatternProgram(pattern)
    const viewport = frame.qualityViewport ?? this.canvas
    const plan = resolveMutagenFramePlan(settings, viewport.width, viewport.height)
    const detail = pattern === 'vortex' ? settings.vortexTwist : pattern === 'terraform' ? settings.terrainHeight : pattern === 'fracture' ? settings.fractureSpread : settings.morphScale
    const fit = resolveMutagenFitSize(fitMode, this.sourceWidth, this.sourceHeight, this.canvas.width, this.canvas.height)
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null)
    gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height)
    program.activate()
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, history)
    program.setSampler('uSource', 0); program.setSampler('uHistory', 1)
    program.setVec2('uResolution', this.canvas.width, this.canvas.height)
    program.setVec2('uFitSize', fit.width, fit.height)
    program.setVec2('uSourceTexel', 1 / this.sourceWidth, 1 / this.sourceHeight)
    program.setVec2('uPosition', this.canvas.width * transform.positionX / 100, -this.canvas.height * transform.positionY / 100)
    program.setFloat('uScale', Math.max(0.01, transform.scale))
    program.setFloat('uRotation', transform.rotation * Math.PI / 180)
    program.setFloat('uTime', timeSec * settings.flowSpeed)
    program.setFloat('uMutation', settings.mutation)
    program.setFloat('uSourceMix', settings.sourceMix)
    program.setFloat('uFeedback', feedback)
    program.setBool('uPreserveColors', settings.preserveColors)
    program.setFloat('uDetail', detail)
    const routing = frame.performance?.routing
    program.setVec4('uAudio', routing?.kickImpulse ?? 0, routing?.tearAccent ?? 0, routing?.density ?? 0, routing?.edgeDetail ?? 0)
    program.setFloat('uCells', Math.min(plan.maxCells, plan.cells * (1 + (routing?.density ?? 0) * 0.35)))
    program.setInt('uHeightSteps', plan.heightSteps)
    program.setFloat('uVoronoiCells', Math.max(3, plan.voronoiCells - (routing?.density ?? 0) * 2))
    program.setFloat('uBands', plan.tearBands)
    program.setInt('uDepth', plan.recursionDepth)
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private ensureTransitionTargets(): void {
    if (this.transitionTargets.length) return
    const scale = Math.min(1, MUTAGEN_MAX_TARGET_EDGE / Math.max(this.canvas.width, this.canvas.height))
    const width = Math.max(1, Math.round(this.canvas.width * scale)), height = Math.max(1, Math.round(this.canvas.height * scale))
    try { this.transitionTargets.push(this.createTarget(width, height)); this.transitionTargets.push(this.createTarget(width, height)) }
    catch (error) { this.releaseTargets(); throw error }
  }

  private composite(from: Target, to: Target, mix: number, glow: number): void {
    const gl = this.gl
    if (!this.compositeProgram) {
      const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { vertSrc: MUTAGEN_VERTEX, fragSrc: MUTAGEN_COMPOSITE, label: 'MUTAGEN/crossfade-glow' })
      if (!result.program) throw new Error(result.error.log)
      this.compositeProgram = result.program
    }
    const program = this.compositeProgram
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    program.activate()
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, from.texture)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, to.texture)
    program.setSampler('uFrom', 0); program.setSampler('uTo', 1)
    program.setFloat('uMix', mix); program.setFloat('uGlow', glow)
    program.setVec2('uTexel', 1 / to.width, 1 / to.height)
    gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  /** Allocation checks only, not synchronous GPU queries/readback in every frame. */
  private checkAllocationError(stage: string): void {
    const error = this.gl.getError?.()
    if (typeof error === 'number' && error !== this.gl.NO_ERROR) throw new Error(`MUTAGEN ${stage} failed (WebGL ${error})`)
  }

  getDiagnostics() {
    const targets = [...this.targets, ...this.transitionTargets]
    return {
      width: this.canvas.width, height: this.canvas.height, quality: this.qualityTier,
      sourceWidth: this.uploadedWidth, sourceHeight: this.uploadedHeight,
      sourceTextureBytes: this.uploadedWidth * this.uploadedHeight * 4,
      targetBytes: targets.reduce((sum, target) => sum + target.width * target.height * 4, 0),
      feedbackTargets: this.targets.length, transitionTargets: this.transitionTargets.length,
      programs: this.programs.size + (this.compositeProgram ? 1 : 0),
      disposed: this.disposed,
    }
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl, texture = gl.createTexture()
    if (!texture) throw new Error('MUTAGEN texture allocation failed')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }

  private createTarget(width = this.canvas.width, height = this.canvas.height): Target {
    const gl = this.gl, texture = this.createTexture(), framebuffer = gl.createFramebuffer()
    if (!framebuffer) { gl.deleteTexture(texture); throw new Error('MUTAGEN framebuffer allocation failed') }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    try { this.checkAllocationError('target allocation') }
    catch (error) { gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer); throw error }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer)
      throw new Error('MUTAGEN framebuffer incomplete')
    }
    return { texture, framebuffer, width, height }
  }

  private releaseHistoryTargets(): void {
    for (const target of this.targets) { this.gl.deleteFramebuffer(target.framebuffer); this.gl.deleteTexture(target.texture) }
    this.targets = []; this.historyIndex = 0; this.resetHistory()
  }

  private releaseTargets(): void {
    this.releaseHistoryTargets()
    for (const target of this.transitionTargets) { this.gl.deleteFramebuffer(target.framebuffer); this.gl.deleteTexture(target.texture) }
    this.transitionTargets = []
    this.frozenTransitionFrom = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseTargets()
    this.gl.deleteTexture(this.sourceTexture)
    this.gl.deleteVertexArray(this.vao)
    for (const program of this.programs.values()) program.dispose()
    this.programs.clear()
    this.compositeProgram?.dispose()
    this.compositeProgram = null; this.sourceTexture = null; this.uploadedSource = null
    this.uploadedWidth = 0; this.uploadedHeight = 0
  }
}
