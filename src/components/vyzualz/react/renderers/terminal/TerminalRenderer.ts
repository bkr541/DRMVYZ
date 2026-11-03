import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { createTerminalAtlas } from './TerminalAtlas'
import type { TerminalFrame } from './TerminalPerformance'
import { terminalBoundedSize, resolveTerminalGrid, resolveTerminalPlan, type CanvasTerminalSettings } from './TerminalSettings'
import { TERMINAL_VERTEX, TERMINAL_FRAGMENT } from './TerminalShaders'

export type TerminalSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
export type TerminalTransform = { scale: number; positionX: number; positionY: number; rotation: number }

export class TerminalRenderer {
  private program: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private sourceTexture: WebGLTexture | null = null
  private atlasTexture: WebGLTexture | null = null
  private source: TerminalSource | null = null
  private sourceSize = ''
  private videoStamp = ''
  private lastSettings: CanvasTerminalSettings | null = null
  private lastFrame = ''
  private staging: HTMLCanvasElement | null = null
  private maxTexture: number
  private maxOutput: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.maxTexture = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.maxOutput = Math.min(2560, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    const renderer = new TerminalRenderer(canvas, gl)
    try {
      const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'Terminal', vertSrc: TERMINAL_VERTEX, fragSrc: TERMINAL_FRAGMENT })
      if (!result.program) throw new Error(result.error.log)
      renderer.program = result.program
      renderer.vao = gl.createVertexArray()
      renderer.sourceTexture = renderer.createTexture()
      renderer.atlasTexture = renderer.createTexture()
      if (!renderer.vao) throw new Error('Terminal vertex allocation failed')
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, createTerminalAtlas())
      renderer.checkUpload()
      return renderer
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  render(input: {
    source: TerminalSource | null
    settings: CanvasTerminalSettings
    frame: TerminalFrame
    fitMode: CanvasFitMode
    transform: TerminalTransform
    viewport: { width: number; height: number }
    dpr: number
  }) {
    const { source, settings, frame, fitMode, transform, viewport } = input
    const gl = this.gl, program = this.program
    if (!program || gl.isContextLost() || !source) return false
    const video = 'videoWidth' in source
    if (video && (source.seeking || source.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const width = video ? source.videoWidth : 'naturalWidth' in source ? source.naturalWidth : source.width
    const height = video ? source.videoHeight : 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!width || !height) return false

    const stamp = video ? `${source.currentTime}:${source.getVideoPlaybackQuality?.().totalVideoFrames ?? 0}` : ''
    const sizeKey = `${width}:${height}`
    const fresh = source !== this.source || sizeKey !== this.sourceSize || stamp !== this.videoStamp
      || (!video && !('naturalWidth' in source))
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    if (fresh) {
      this.upload(source, width, height)
      this.source = source
      this.sourceSize = sizeKey
      this.videoStamp = stamp
    }

    const plan = resolveTerminalPlan(settings.quality, viewport.width, viewport.height)
    const dpr = Math.max(1, Math.min(2, input.dpr))
    const output = terminalBoundedSize(viewport.width * dpr, viewport.height * dpr, Math.min(this.maxOutput, plan.outputEdge))
    const fit = fitMode === 'cover' ? Math.max(viewport.width / width, viewport.height / height) : Math.min(viewport.width / width, viewport.height / height)
    const fitWidth = fitMode === 'stretch' ? viewport.width : width * fit
    const fitHeight = fitMode === 'stretch' ? viewport.height : height * fit
    const key = [output.width, output.height, fitWidth, fitHeight, transform.scale, transform.positionX,
      transform.positionY, transform.rotation, frame.family, frame.amount, frame.edge, frame.brightness, frame.epoch, frame.variation].join(':')
    if (!fresh && this.lastSettings === settings && this.lastFrame === key) return true
    this.lastSettings = settings
    this.lastFrame = key
    if (this.canvas.width !== output.width) this.canvas.width = output.width
    if (this.canvas.height !== output.height) this.canvas.height = output.height

    const grid = resolveTerminalGrid(fitWidth * transform.scale, fitHeight * transform.scale, settings.cellSize, plan.columns, plan.rows)
    program.activate()
    gl.bindVertexArray(this.vao)
    gl.viewport(0, 0, output.width, output.height)
    program.setSampler('source', 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture)
    program.setSampler('atlas', 1)
    program.setVec2('outputSize', viewport.width, viewport.height)
    program.setVec2('fitSize', fitWidth, fitHeight)
    program.setVec2('position', viewport.width * transform.positionX / 100, -viewport.height * transform.positionY / 100)
    program.setVec2('grid', grid.columns, grid.rows)
    program.setFloat('scale', transform.scale)
    program.setFloat('rotation', transform.rotation * Math.PI / 180)
    program.setFloat('amount', frame.amount)
    program.setFloat('contrast', settings.contrast)
    program.setFloat('brightness', frame.brightness)
    program.setFloat('edge', frame.edge)
    program.setFloat('variation', frame.variation)
    program.setFloat('backgroundFill', settings.background)
    program.setFloat('glow', settings.glow)
    program.setInt('family', frame.family)
    program.setInt('seed', settings.seed)
    program.setInt('epoch', frame.epoch)
    const rgb = Number.parseInt(settings.color.slice(1), 16)
    program.setVec3('inkColor', (rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255)
    program.setBool('monochrome', settings.colorMode === 'monochrome')
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return true
  }

  private createTexture() {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Terminal texture allocation failed')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private uploadedSize = ''
  private upload(source: TerminalSource, width: number, height: number) {
    const gl = this.gl
    const size = terminalBoundedSize(width, height, this.maxTexture)
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Terminal source resize unavailable')
      context.clearRect(0, 0, size.width, size.height)
      context.drawImage(source, 0, 0, size.width, size.height)
      pixels = staging
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    const key = `${size.width}:${size.height}`
    if (key !== this.uploadedSize) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      this.uploadedSize = key
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    }
    this.checkUpload()
  }

  private checkUpload() {
    const error = this.gl.getError()
    if (error !== this.gl.NO_ERROR) throw new Error(`Terminal texture upload failed (${error})`)
  }

  dispose() {
    const gl = this.gl
    gl.useProgram(null)
    gl.bindVertexArray(null)
    this.program?.dispose()
    this.program = null
    gl.deleteTexture(this.sourceTexture)
    gl.deleteTexture(this.atlasTexture)
    gl.deleteVertexArray(this.vao)
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
