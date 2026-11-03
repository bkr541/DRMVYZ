import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { cellularSize, isCellularClean, resolveCellularPlan, type CanvasCellularSettings } from './CellularSettings'
import { CELLULAR_STEP, CELLULAR_PRESENT, CELLULAR_VERTEX } from './CellularShaders'
import type { CellularDecision } from './CellularPerformance'

export type CellularSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
export type CellularTransform = { scale: number; positionX: number; positionY: number; rotation: number }
export interface CellularFrame {
  source: CellularSource | null
  settings: CanvasCellularSettings
  timeSec: number
  fitMode: CanvasFitMode
  sourceTransform: CellularTransform
  performance: CellularDecision
  viewport: { width: number; height: number }
}

export class CellularRenderer {
  private programs: ShaderProgram[] = []
  private vao: WebGLVertexArrayObject | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private texture: WebGLTexture | null = null
  private fields: WebGLTexture[] = []
  private currentField = 0
  private fieldReady = false
  private source: CellularSource | null = null
  private sourceTime: number | null = null
  private videoStamp: number | null = null
  private fieldKey = ''
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

  static create(canvas: HTMLCanvasElement): { renderer: CellularRenderer | null; error: string | null } {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false })
    if (!gl) return { renderer: null, error: 'WebGL2 unavailable' }
    const renderer = new CellularRenderer(canvas, gl)
    try {
      // The packed field relies on exact byte writes.
      gl.disable(gl.DITHER)
      const compiler = new ShaderCompiler(gl)
      for (const fragSrc of [CELLULAR_STEP, CELLULAR_PRESENT]) {
        const result = ShaderProgram.create(gl, compiler, { label: 'Cellular', vertSrc: CELLULAR_VERTEX, fragSrc })
        if (!result.program) throw new Error(result.error.log)
        renderer.programs.push(result.program)
      }
      renderer.vao = gl.createVertexArray()
      renderer.framebuffer = gl.createFramebuffer()
      renderer.texture = renderer.makeTexture(gl.TEXTURE_2D)
      if (!renderer.vao || !renderer.framebuffer) throw new Error('Cellular allocation failed')
      return { renderer, error: null }
    } catch (error) {
      renderer.dispose()
      return { renderer: null, error: error instanceof Error ? error.message : 'Cellular initialization failed' }
    }
  }

  resize(width: number, height: number) {
    const size = cellularSize(width, height, this.maxOutput)
    if (this.canvas.width === size.width && this.canvas.height === size.height) return
    this.canvas.width = size.width
    this.canvas.height = size.height
    this.resetHistory()
  }

  resetHistory() {
    this.fieldReady = false
    this.sourceTime = this.videoStamp = null
  }

  render(frame: CellularFrame): boolean {
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
    const plan = resolveCellularPlan(settings, frame.viewport.width, frame.viewport.height)
    const fieldEdge = Math.min(plan.fieldEdge, this.maxOutput, Math.max(96, Math.round(plan.fieldEdge * 12 / settings.cellScale)))
    const size = cellularSize(width, height, fieldEdge)
    const captureKey = [width, height, settings.seed, settings.cellScale, settings.expandAlpha].join(':')
    const changedSource = this.source !== source
    if (changedSource || this.captureKey !== captureKey || performance.reset
      || (this.sourceTime !== null && (time < this.sourceTime - 1e-5 || time - this.sourceTime > 0.5))) this.resetHistory()
    this.source = source
    this.captureKey = captureKey
    const freshVideoFrame = video && stamp !== this.videoStamp
    if (changedSource || !this.uploadKey || freshVideoFrame || (!video && !('naturalWidth' in source))) {
      this.upload(source, width, height)
      this.videoStamp = stamp
    }
    this.sourceTime = time

    const key = `${size.width}:${size.height}`
    if (this.fieldKey !== key) {
      for (const texture of this.fields) gl.deleteTexture(texture)
      this.fields = []
      for (let i = 0; i < 2; i++) {
        gl.activeTexture(gl.TEXTURE1)
        const texture = this.makeTexture(gl.TEXTURE_2D)
        this.fields.push(texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        this.checkAllocation()
      }
      this.fieldKey = key
      this.fieldReady = false
    }

    const clean = isCellularClean(settings)
    if (clean) this.fieldReady = false
    if (!clean && (!this.fieldReady || performance.step > 0)) {
      const target = 1 - this.currentField
      const update = this.programs[0]
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fields[target], 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Cellular field framebuffer incomplete')
      gl.viewport(0, 0, size.width, size.height)
      this.bindTextures(update, this.fields[this.currentField])
      update.setVec2('fieldSize', size.width, size.height)
      update.setFloat('seed', settings.seed % 16777216)
      update.setFloat('spacing', Math.max(5, Math.min(32, settings.cellScale * size.width / width)))
      update.setFloat('feed', settings.feed)
      update.setFloat('kill', settings.kill)
      update.setFloat('diffusion', settings.diffusion)
      update.setFloat('injection', settings.injection)
      update.setFloat('pulse', performance.pulse)
      update.setFloat('stepSize', performance.step)
      update.setBool('initializeField', !this.fieldReady)
      update.setBool('expandAlpha', settings.expandAlpha)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.currentField = target
      this.fieldReady = true
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    const present = this.programs[1]
    this.bindTextures(present, this.fields[this.currentField])
    present.setVec2('fieldSize', size.width, size.height)
    present.setFloat('amount', clean ? 0 : performance.amount)
    present.setFloat('reconstruction', performance.reconstruction)
    present.setFloat('edge', performance.edge)
    present.setBool('duotone', settings.colorMode === 'duotone')
    present.setBool('expandAlpha', settings.expandAlpha)
    this.setColor(present, 'colorA', settings.colorA)
    this.setColor(present, 'colorB', settings.colorB)
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
    if (!texture) throw new Error('Cellular texture allocation failed')
    gl.bindTexture(target, texture)
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private upload(source: CellularSource, width: number, height: number) {
    const gl = this.gl
    const size = cellularSize(width, height, Math.min(4096, this.maxTexture))
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Cellular source resize failed')
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

  private bindTextures(program: ShaderProgram, field: WebGLTexture) {
    const gl = this.gl
    program.activate()
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    program.setSampler('source', 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, field)
    program.setSampler('field', 1)
  }

  private setColor(program: ShaderProgram, uniform: string, hex: string) {
    const rgb = Number.parseInt(hex.slice(1), 16)
    program.setVec3(uniform, (rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255)
  }

  private checkAllocation() {
    const error = this.gl.getError()
    if (error !== this.gl.NO_ERROR) throw new Error(`Cellular texture operation failed (${error})`)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const program of this.programs) program.dispose()
    this.gl.deleteTexture(this.texture)
    for (const texture of this.fields) this.gl.deleteTexture(texture)
    this.fields = []
    this.gl.deleteFramebuffer(this.framebuffer)
    this.gl.deleteVertexArray(this.vao)
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
