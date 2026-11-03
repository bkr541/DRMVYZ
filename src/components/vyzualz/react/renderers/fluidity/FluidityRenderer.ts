import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import type { DirectWebGLSource, DirectWebGLTransform } from '../CanvasDirectWebGLLayer'
import type { FluidityFrame } from './FluidityPerformance'
import { boundFluiditySize, resolveFluidityQuality, type CanvasFluiditySettings } from './FluiditySettings'
import { FLUIDITY_VERTEX, FLUIDITY_FRAGMENT } from './FluidityShaders'

export class FluidityRenderer {
  private program: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private texture: ShaderTexture
  private source: DirectWebGLSource | null = null
  private uploadStamp = ''
  private staging: HTMLCanvasElement | null = null
  private lastSettings: CanvasFluiditySettings | null = null
  private lastFrame = ''
  private maxSourceEdge: number
  private maxOutputEdge: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.texture = new ShaderTexture(gl)
    this.maxSourceEdge = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.maxOutputEdge = Math.min(2560, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    const renderer = new FluidityRenderer(canvas, gl)
    try {
      const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'Fluidity', vertSrc: FLUIDITY_VERTEX, fragSrc: FLUIDITY_FRAGMENT })
      if (!result.program) throw new Error(result.error.log)
      renderer.program = result.program
      renderer.vao = gl.createVertexArray()
      if (!renderer.vao) throw new Error('Fluidity vertex allocation failed')
      return renderer
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  render({ source, settings, frame, fitMode, transform, viewport, dpr }: {
    source: DirectWebGLSource | null; settings: CanvasFluiditySettings; frame: FluidityFrame
    fitMode: CanvasFitMode; transform: DirectWebGLTransform; viewport: { width: number; height: number }; dpr: number
  }) {
    const gl = this.gl, program = this.program
    if (!source || !program || gl.isContextLost()) return false
    const video = 'videoWidth' in source
    if (video && (source.seeking || source.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const width = video ? source.videoWidth : 'naturalWidth' in source ? source.naturalWidth : source.width
    const height = video ? source.videoHeight : 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!width || !height) return false

    const stamp = video ? `${width}:${height}:${source.currentTime}:${source.getVideoPlaybackQuality?.().totalVideoFrames ?? 0}`
      : 'naturalWidth' in source ? `${width}:${height}:${source.currentSrc}` : ''
    const fresh = source !== this.source || stamp !== this.uploadStamp || stamp === ''
    if (fresh) {
      this.upload(source, width, height)
      this.source = source
      this.uploadStamp = stamp
    }

    const quality = resolveFluidityQuality(settings.quality, viewport.width, viewport.height)
    const density = Math.min(2, Math.max(1, dpr))
    const output = boundFluiditySize(viewport.width * density, viewport.height * density, Math.min(this.maxOutputEdge, quality.outputEdge))
    const fit = fitMode === 'cover' ? Math.max(viewport.width / width, viewport.height / height) : Math.min(viewport.width / width, viewport.height / height)
    const fitWidth = fitMode === 'stretch' ? viewport.width : width * fit
    const fitHeight = fitMode === 'stretch' ? viewport.height : height * fit
    const key = [output.width, output.height, viewport.width, viewport.height, fitWidth, fitHeight, transform.scale, transform.rotation,
      transform.positionX, transform.positionY, quality.tier, frame.amount, frame.motion, frame.refraction, frame.highlight, frame.detail,
      frame.pressure, frame.pressure > 0.001 ? frame.pressureAge : 0].join(':')
    if (!fresh && this.lastSettings === settings && this.lastFrame === key) return true
    this.lastSettings = settings
    this.lastFrame = key
    if (this.canvas.width !== output.width) this.canvas.width = output.width
    if (this.canvas.height !== output.height) this.canvas.height = output.height
    gl.viewport(0, 0, output.width, output.height)
    program.activate()
    gl.bindVertexArray(this.vao)
    this.texture.bind(0)
    program.setSampler('source', 0)
    program.setVec2('sourceTexel', 1 / this.texture.width, 1 / this.texture.height)
    program.setVec2('viewportSize', viewport.width, viewport.height)
    program.setVec2('fitSize', fitWidth, fitHeight)
    program.setVec2('position', viewport.width * transform.positionX / 100, -viewport.height * transform.positionY / 100)
    program.setFloat('transformScale', transform.scale)
    program.setFloat('rotation', transform.rotation * Math.PI / 180)
    program.setFloat('motion', frame.motion)
    program.setFloat('amount', frame.amount)
    program.setFloat('refraction', frame.refraction)
    program.setFloat('surfaceScale', settings.surfaceScale)
    program.setFloat('bevel', settings.bevel)
    program.setFloat('frost', settings.frost)
    program.setFloat('highlight', frame.highlight)
    program.setFloat('dispersion', settings.preserveColors ? 0 : settings.dispersion)
    program.setFloat('lightAngle', settings.lightAngle * Math.PI / 180)
    program.setFloat('pressure', frame.pressure)
    program.setFloat('pressureAge', frame.pressureAge)
    program.setFloat('detail', frame.detail)
    program.setInt('surface', frame.surface)
    program.setInt('seed', settings.seed)
    program.setInt('frostTaps', quality.frostTaps)
    program.setInt('qualityDetail', quality.detail)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return true
  }

  private upload(source: DirectWebGLSource, width: number, height: number) {
    const gl = this.gl
    const size = boundFluiditySize(width, height, this.maxSourceEdge)
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Fluidity source resize unavailable')
      context.clearRect(0, 0, size.width, size.height)
      context.drawImage(source, 0, 0, size.width, size.height)
      pixels = staging
    }
    gl.activeTexture(gl.TEXTURE0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    if ('videoWidth' in pixels || 'naturalWidth' in pixels) this.texture.uploadImage(pixels)
    else {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      this.texture.uploadCanvas(pixels)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    }
    const error = gl.getError()
    if (error !== gl.NO_ERROR) throw new Error(`Fluidity source upload failed (${error})`)
  }

  dispose() {
    this.gl.useProgram(null)
    this.gl.bindVertexArray(null)
    this.program?.dispose()
    this.program = null
    this.texture.dispose()
    this.gl.deleteVertexArray(this.vao)
    this.vao = null
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
