import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import type { DirectWebGLSource, DirectWebGLTransform } from '../CanvasDirectWebGLLayer'
import type { DivinityFrame } from './DivinityPerformance'
import { boundDivinitySize, resolveDivinityQuality, type CanvasDivinitySettings } from './DivinitySettings'
import { DIVINITY_MASK, DIVINITY_PRESENT, DIVINITY_VERTEX } from './DivinityShaders'

export class DivinityRenderer {
  private programs: ShaderProgram[] = []
  private vao: WebGLVertexArrayObject | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private sourceTexture: ShaderTexture
  private maskTexture: ShaderTexture
  private source: DirectWebGLSource | null = null
  private uploadStamp = ''
  private maskKey = ''
  private staging: HTMLCanvasElement | null = null
  private lastSettings: CanvasDivinitySettings | null = null
  private lastFrame = ''
  private maxSourceEdge: number
  private maxOutputEdge: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.sourceTexture = new ShaderTexture(gl)
    this.maskTexture = new ShaderTexture(gl)
    this.maxSourceEdge = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.maxOutputEdge = Math.min(2560, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    const renderer = new DivinityRenderer(canvas, gl)
    try {
      const compiler = new ShaderCompiler(gl)
      for (const [label, fragSrc] of [['Mask', DIVINITY_MASK], ['Scattering', DIVINITY_PRESENT]]) {
        const result = ShaderProgram.create(gl, compiler, { label: `Divinity ${label}`, vertSrc: DIVINITY_VERTEX, fragSrc })
        if (!result.program) throw new Error(result.error.log)
        renderer.programs.push(result.program)
      }
      renderer.vao = gl.createVertexArray()
      renderer.framebuffer = gl.createFramebuffer()
      if (!renderer.vao || !renderer.framebuffer) throw new Error('Divinity allocation failed')
      return renderer
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  render({ source, settings, frame, fitMode, transform, viewport, dpr }: {
    source: DirectWebGLSource | null; settings: CanvasDivinitySettings; frame: DivinityFrame
    fitMode: CanvasFitMode; transform: DirectWebGLTransform; viewport: { width: number; height: number }; dpr: number
  }) {
    const gl = this.gl
    if (!source || !this.programs.length || gl.isContextLost()) return false
    const video = 'videoWidth' in source
    if (video && (source.seeking || source.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const width = video ? source.videoWidth : 'naturalWidth' in source ? source.naturalWidth : source.width
    const height = video ? source.videoHeight : 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!width || !height) return false

    const decoded = video ? source.getVideoPlaybackQuality?.().totalVideoFrames ?? 0 : 0
    const stamp = video ? `${width}:${height}:${decoded > 0 && !source.paused ? decoded : source.currentTime}`
      : 'naturalWidth' in source ? `${width}:${height}:${source.currentSrc}` : ''
    const fresh = source !== this.source || stamp !== this.uploadStamp || stamp === ''
    if (fresh) {
      this.upload(source, width, height)
      this.source = source
      this.uploadStamp = stamp
      this.maskKey = ''
    }

    const quality = resolveDivinityQuality(settings.quality, viewport.width, viewport.height)
    const density = Math.min(2, Math.max(1, dpr))
    const output = boundDivinitySize(viewport.width * density, viewport.height * density, Math.min(this.maxOutputEdge, quality.outputEdge))
    const ratio = fitMode === 'cover' ? Math.max(viewport.width / width, viewport.height / height) : Math.min(viewport.width / width, viewport.height / height)
    const fitWidth = fitMode === 'stretch' ? viewport.width : width * ratio
    const fitHeight = fitMode === 'stretch' ? viewport.height : height * ratio
    const key = [output.width, output.height, viewport.width, viewport.height, fitWidth, fitHeight, transform.scale,
      transform.rotation, transform.positionX, transform.positionY, quality.tier, frame.amount, frame.length, frame.spread,
      frame.density, frame.originX, frame.originY, frame.detail].join(':')
    if (!fresh && this.lastSettings === settings && this.lastFrame === key) return true
    if (this.canvas.width !== output.width) this.canvas.width = output.width
    if (this.canvas.height !== output.height) this.canvas.height = output.height

    gl.bindVertexArray(this.vao)
    const mask = boundDivinitySize(this.sourceTexture.width, this.sourceTexture.height, quality.maskEdge)
    const maskKey = `${mask.width}:${mask.height}:${settings.mask}:${settings.mask === 'luminance' ? settings.threshold : ''}`
    if (maskKey !== this.maskKey) {
      this.renderMask(mask.width, mask.height, settings)
      this.maskKey = maskKey
    }

    const program = this.programs[1]
    gl.viewport(0, 0, output.width, output.height)
    program.activate()
    this.sourceTexture.bind(0)
    this.maskTexture.bind(1)
    program.setSampler('source', 0)
    program.setSampler('maskTexture', 1)
    program.setVec2('viewportSize', viewport.width, viewport.height)
    program.setVec2('fitSize', fitWidth, fitHeight)
    program.setVec2('position', viewport.width * transform.positionX / 100, -viewport.height * transform.positionY / 100)
    program.setFloat('transformScale', transform.scale)
    program.setFloat('rotation', transform.rotation * Math.PI / 180)
    program.setVec2('origin', frame.originX, 1 - frame.originY)
    program.setFloat('amount', frame.amount)
    program.setFloat('rayLength', frame.length)
    program.setFloat('spread', frame.spread)
    program.setFloat('density', frame.density)
    program.setFloat('decay', settings.decay)
    program.setFloat('detail', frame.detail)
    program.setInt('tapCount', quality.taps)
    program.setBool('manualColor', settings.colorMode === 'manual')
    program.setBool('clipToAlpha', settings.clipToAlpha)
    const rgb = Number.parseInt(settings.color.slice(1), 16)
    program.setVec3('rayColor', (rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.lastSettings = settings
    this.lastFrame = key
    return true
  }

  private renderMask(width: number, height: number, settings: CanvasDivinitySettings) {
    const gl = this.gl, program = this.programs[0]
    this.maskTexture.unbind(1)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    if (this.maskTexture.width !== width || this.maskTexture.height !== height) {
      const texture = this.maskTexture.asRenderTarget(width, height)
      this.maskTexture.bind(1)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      this.maskTexture.unbind(1)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Divinity mask framebuffer incomplete')
    }
    gl.viewport(0, 0, width, height)
    program.activate()
    this.sourceTexture.bind(0)
    program.setSampler('source', 0)
    program.setVec2('maskTexel', 1 / width, 1 / height)
    program.setBool('alphaMask', settings.mask === 'alpha')
    program.setFloat('threshold', settings.threshold)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.maskTexture.bind(1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.generateMipmap(gl.TEXTURE_2D)
    const error = gl.getError()
    if (error !== gl.NO_ERROR) throw new Error(`Divinity mask generation failed (${error})`)
  }

  private upload(source: DirectWebGLSource, width: number, height: number) {
    const gl = this.gl
    const size = boundDivinitySize(width, height, this.maxSourceEdge)
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Divinity source resize unavailable')
      context.clearRect(0, 0, size.width, size.height)
      context.drawImage(source, 0, 0, size.width, size.height)
      pixels = staging
    }
    gl.activeTexture(gl.TEXTURE0)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    if ('videoWidth' in pixels || 'naturalWidth' in pixels) this.sourceTexture.uploadImage(pixels)
    else {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      this.sourceTexture.uploadCanvas(pixels)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    }
    const error = gl.getError()
    if (error !== gl.NO_ERROR) throw new Error(`Divinity source upload failed (${error})`)
  }

  dispose() {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(null)
    gl.bindVertexArray(null)
    for (const program of this.programs) program.dispose()
    this.programs = []
    this.sourceTexture.dispose()
    this.maskTexture.dispose()
    gl.deleteFramebuffer(this.framebuffer)
    gl.deleteVertexArray(this.vao)
    this.framebuffer = this.vao = null
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
