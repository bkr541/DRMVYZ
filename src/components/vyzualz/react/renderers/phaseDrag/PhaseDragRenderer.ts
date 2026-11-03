import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { PhaseDragHistory, phaseDragSize, resolvePhaseDragPlan } from './PhaseDragHistory'
import { isPhaseDragClean, PHASE_DRAG_CURVES, PHASE_DRAG_DIRECTIONS, PHASE_DRAG_MODES, type CanvasPhaseDragSettings } from './PhaseDragSettings'
import { PHASE_DRAG_COPY, PHASE_DRAG_PRESENT, PHASE_DRAG_VERTEX } from './PhaseDragShaders'
import type { PhaseDragDecision } from './PhaseDragPerformance'

export type PhaseDragSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
export type PhaseDragTransform = { scale: number; positionX: number; positionY: number; rotation: number }
export interface PhaseDragFrame {
  source: PhaseDragSource | null
  settings: CanvasPhaseDragSettings
  timeSec: number
  fitMode: CanvasFitMode
  sourceTransform: PhaseDragTransform
  performance: PhaseDragDecision
  viewport: { width: number; height: number }
}

export class PhaseDragRenderer {
  private programs: ShaderProgram[] = []
  private vao: WebGLVertexArrayObject | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private texture: WebGLTexture | null = null
  private volume: WebGLTexture | null = null
  private history = new PhaseDragHistory()
  private source: PhaseDragSource | null = null
  private sourceTime: number | null = null
  private videoStamp: number | null = null
  private volumeKey = ''
  private uploadKey = ''
  private captureKey = ''
  private staging: HTMLCanvasElement | null = null
  private disposed = false
  private maxTexture: number
  private maxOutput: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    this.maxOutput = Math.min(this.maxTexture, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), 2560)
  }

  static create(canvas: HTMLCanvasElement): { renderer: PhaseDragRenderer | null; error: string | null } {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false })
    if (!gl) return { renderer: null, error: 'WebGL2 unavailable' }
    const renderer = new PhaseDragRenderer(canvas, gl)
    try {
      const compiler = new ShaderCompiler(gl)
      for (const fragSrc of [PHASE_DRAG_COPY, PHASE_DRAG_PRESENT]) {
        const result = ShaderProgram.create(gl, compiler, { label: 'Phase Drag', vertSrc: PHASE_DRAG_VERTEX, fragSrc })
        if (!result.program) throw new Error(result.error.log)
        renderer.programs.push(result.program)
      }
      renderer.vao = gl.createVertexArray()
      renderer.framebuffer = gl.createFramebuffer()
      renderer.texture = renderer.makeTexture(gl.TEXTURE_2D)
      if (!renderer.vao || !renderer.framebuffer) throw new Error('Phase Drag allocation failed')
      return { renderer, error: null }
    } catch (error) {
      renderer.dispose()
      return { renderer: null, error: error instanceof Error ? error.message : 'Phase Drag initialization failed' }
    }
  }

  resize(width: number, height: number) {
    const size = phaseDragSize(width, height, this.maxOutput)
    if (this.canvas.width === size.width && this.canvas.height === size.height) return
    this.canvas.width = size.width
    this.canvas.height = size.height
    this.resetHistory()
  }

  resetHistory() {
    this.history.reset()
    this.sourceTime = this.videoStamp = null
  }

  render(frame: PhaseDragFrame): boolean {
    const { source, settings, performance, sourceTransform: transform } = frame
    const gl = this.gl
    if (this.disposed || gl.isContextLost() || !source) return false
    const video = 'videoWidth' in source
    if (video && (source.seeking || source.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const width = video ? source.videoWidth : 'naturalWidth' in source ? source.naturalWidth : source.width
    const height = video ? source.videoHeight : 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!width || !height) return false

    const time = video ? source.currentTime : frame.timeSec
    const decoded = video ? source.getVideoPlaybackQuality?.().totalVideoFrames ?? 0 : 0
    const stamp = decoded > 0 ? decoded : time
    const plan = resolvePhaseDragPlan(settings, frame.viewport.width, frame.viewport.height)
    const size = phaseDragSize(width, height, Math.min(this.maxOutput, plan.historyEdge))
    const capacity = Math.min(plan.samples, gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS))
    if (capacity < 2) throw new Error('Phase Drag texture history is unavailable')
    const captureKey = [width, height, settings.historyWindow, settings.stillMovement, settings.deterministicSeed].join(':')
    const changedSource = this.source !== source
    if (changedSource || this.captureKey !== captureKey || performance.reset
      || (this.sourceTime !== null && (time < this.sourceTime - 1e-5 || time - this.sourceTime > 0.5))) this.resetHistory()
    this.source = source
    this.captureKey = captureKey

    const clean = isPhaseDragClean(settings, video)
    const volumeKey = `${size.width}:${size.height}:${capacity}`
    if (this.volumeKey !== volumeKey || !this.volume) {
      gl.deleteTexture(this.volume)
      this.volume = this.makeTexture(gl.TEXTURE_2D_ARRAY)
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, size.width, size.height, capacity)
      this.checkAllocation()
      this.volumeKey = volumeKey
      this.resetHistory()
    }

    const freshVideoFrame = video && stamp !== this.videoStamp
    const slot = !clean && (!video || freshVideoFrame) ? this.history.nextSlot(time, settings.historyWindow, capacity) : null
    if (changedSource || !this.uploadKey || freshVideoFrame || (!video && !('naturalWidth' in source) && slot !== null)) {
      this.upload(source, width, height)
      this.videoStamp = stamp
    }
    this.sourceTime = time

    const seed = (settings.deterministicSeed % 997) / 997 * Math.PI * 2
    const movement = video || clean ? 0 : settings.stillMovement
    const offsetX = Math.sin(frame.timeSec * 3.6 + seed) * movement * 0.32
    const offsetY = Math.cos(frame.timeSec * 2.4 + seed) * movement * 0.18
    if (slot !== null) {
      const copy = this.programs[0]
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.volume, 0, slot)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Phase Drag history framebuffer incomplete')
      gl.viewport(0, 0, size.width, size.height)
      this.bindSource(copy, offsetX, offsetY)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    const present = this.programs[1]
    this.bindSource(present, offsetX, offsetY)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.volume)
    present.setSampler('history', 1)
    const count = this.history.describe(time, capacity)
    gl.uniform2fv(present.getUniform('ages[0]'), this.history.uniforms)
    present.setInt('count', count)
    present.setInt('mode', PHASE_DRAG_MODES.indexOf(settings.scanMode))
    present.setInt('direction', PHASE_DRAG_DIRECTIONS.indexOf(performance.direction))
    present.setInt('curve', PHASE_DRAG_CURVES.indexOf(settings.timeCurve))
    present.setFloat('phase', performance.phase)
    present.setFloat('windowSeconds', settings.historyWindow)
    present.setFloat('width', performance.slitWidth)
    present.setFloat('ripple', performance.ripple)
    present.setFloat('depth', performance.depth)
    present.setFloat('amount', clean || count === 0 ? 0 : settings.amount)
    present.setFloat('reconstruction', performance.reconstruction)
    const output = this.canvas
    const fit = frame.fitMode === 'cover' ? Math.max(output.width / width, output.height / height) : Math.min(output.width / width, output.height / height)
    present.setVec2('outputSize', output.width, output.height)
    present.setVec2('fitSize', frame.fitMode === 'stretch' ? output.width : width * fit, frame.fitMode === 'stretch' ? output.height : height * fit)
    present.setVec2('position', output.width * transform.positionX / 100, -output.height * transform.positionY / 100)
    present.setFloat('scale', transform.scale)
    present.setFloat('rotation', transform.rotation * Math.PI / 180)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return true
  }

  private makeTexture(target: number) {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Phase Drag texture allocation failed')
    gl.bindTexture(target, texture)
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private upload(source: PhaseDragSource, width: number, height: number) {
    const gl = this.gl
    const size = phaseDragSize(width, height, Math.min(4096, this.maxTexture))
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Phase Drag source resize failed')
      context.clearRect(0, 0, size.width, size.height)
      context.drawImage(source, 0, 0, size.width, size.height)
      pixels = staging
    }
    const key = `${size.width}:${size.height}`
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    if (key !== this.uploadKey) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      this.checkAllocation()
      this.uploadKey = key
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    this.checkAllocation()
  }

  private bindSource(program: ShaderProgram, offsetX: number, offsetY: number) {
    const gl = this.gl
    program.activate()
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    program.setSampler('source', 0)
    program.setVec2('stillOffset', offsetX, offsetY)
  }

  private checkAllocation() {
    const error = this.gl.getError()
    if (error !== this.gl.NO_ERROR) throw new Error(`Phase Drag texture operation failed (${error})`)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const program of this.programs) program.dispose()
    this.gl.deleteTexture(this.texture)
    this.gl.deleteTexture(this.volume)
    this.gl.deleteFramebuffer(this.framebuffer)
    this.gl.deleteVertexArray(this.vao)
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
