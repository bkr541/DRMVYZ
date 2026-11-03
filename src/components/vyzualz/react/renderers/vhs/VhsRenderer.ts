import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import type { DirectWebGLSource, DirectWebGLTransform } from '../CanvasDirectWebGLLayer'
import type { VhsFrame } from './VhsPerformance'
import { boundVhsSize, resolveVhsQuality, VHS_HISTORY_WARMUP_FRAMES, type CanvasVhsSettings } from './VhsSettings'
import { VHS_SIGNAL, VHS_PRESENT, VHS_VERTEX } from './VhsShaders'

export class VhsRenderer {
  private programs: ShaderProgram[] = []
  private vao: WebGLVertexArrayObject | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private sourceTexture: ShaderTexture
  private history: [ShaderTexture, ShaderTexture] | null = null
  private historyIndex = 0
  private warmup = VHS_HISTORY_WARMUP_FRAMES
  private source: DirectWebGLSource | null = null
  private video: HTMLVideoElement | null = null
  private pendingSeek = false
  private lastVideoTime: number | null = null
  private uploadStamp = ''
  private geometry = ''
  private lastSettings: CanvasVhsSettings | null = null
  private lastFrame = ''
  private idleFrames = 0
  private staging: HTMLCanvasElement | null = null
  private maxSourceEdge: number
  private maxOutputEdge: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.sourceTexture = new ShaderTexture(gl)
    this.maxSourceEdge = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.maxOutputEdge = Math.min(2560, this.maxSourceEdge, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    const renderer = new VhsRenderer(canvas, gl)
    try {
      const compiler = new ShaderCompiler(gl)
      for (const [label, fragSrc] of [['Signal', VHS_SIGNAL], ['Presentation', VHS_PRESENT]]) {
        const result = ShaderProgram.create(gl, compiler, { label: `VHS ${label}`, vertSrc: VHS_VERTEX, fragSrc })
        if (!result.program) throw new Error(result.error.log)
        renderer.programs.push(result.program)
      }
      renderer.vao = gl.createVertexArray()
      renderer.framebuffer = gl.createFramebuffer()
      if (!renderer.vao || !renderer.framebuffer) throw new Error('VHS allocation failed')
      return renderer
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  private onSeek = () => { this.pendingSeek = true }

  render({ source, settings, frame, fitMode, transform, viewport, dpr }: {
    source: DirectWebGLSource | null; settings: CanvasVhsSettings; frame: VhsFrame
    fitMode: CanvasFitMode; transform: DirectWebGLTransform; viewport: { width: number; height: number }; dpr: number
  }) {
    const gl = this.gl
    if (!source || !this.programs.length || gl.isContextLost()) return false
    const video = 'videoWidth' in source ? source : null
    if (video && (video.seeking || video.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const width = video?.videoWidth ?? ('naturalWidth' in source ? source.naturalWidth : source.width)
    const height = video?.videoHeight ?? ('naturalHeight' in source ? source.naturalHeight : source.height)
    if (!width || !height) return false

    const replaced = source !== this.source
    if (video !== this.video) {
      this.video?.removeEventListener('seeking', this.onSeek)
      video?.addEventListener('seeking', this.onSeek)
      this.video = video
      this.lastVideoTime = null
    }
    const videoTime = video?.currentTime ?? null
    const videoJump = videoTime !== null && this.lastVideoTime !== null
      && (videoTime < this.lastVideoTime - 1e-5 || videoTime - this.lastVideoTime > 0.5)
    this.lastVideoTime = videoTime
    const decoded = video?.getVideoPlaybackQuality?.().totalVideoFrames ?? 0
    const stamp = video ? `${width}:${height}:${decoded > 0 && !video.paused ? decoded : videoTime}`
      : 'naturalWidth' in source ? `${width}:${height}:${source.currentSrc}` : ''
    const revision = stamp !== this.uploadStamp
    const fresh = replaced || this.pendingSeek || videoJump || revision || stamp === ''
    if (fresh) {
      this.upload(source, width, height)
      this.source = source
      this.uploadStamp = stamp
    }

    const quality = resolveVhsQuality(settings.quality, viewport.width, viewport.height)
    const density = Math.min(2, Math.max(1, dpr))
    const output = boundVhsSize(viewport.width * density, viewport.height * density, Math.min(this.maxOutputEdge, quality.outputEdge))
    const ratio = fitMode === 'cover' ? Math.max(viewport.width / width, viewport.height / height) : Math.min(viewport.width / width, viewport.height / height)
    const fitWidth = fitMode === 'stretch' ? viewport.width : width * ratio
    const fitHeight = fitMode === 'stretch' ? viewport.height : height * ratio
    const geometry = [width, height, output.width, output.height, viewport.width, viewport.height, fitWidth, fitHeight, transform.scale,
      transform.rotation, transform.positionX, transform.positionY, quality.tier, settings.treatment, settings.seed].join(':')
    const reset = frame.resetHistory || replaced || this.pendingSeek || videoJump || geometry !== this.geometry
      || (revision && !video && 'naturalWidth' in source)
    if (reset) this.warmup = VHS_HISTORY_WARMUP_FRAMES
    this.pendingSeek = false
    this.geometry = geometry

    const key = [frame.phase, frame.amount, frame.damage, frame.tracking, frame.roll, frame.dropout,
      frame.texture, frame.glow, frame.persistence].join(':')
    const unchanged = !reset && !fresh && this.lastSettings === settings && this.lastFrame === key
    this.idleFrames = unchanged ? Math.min(41, this.idleFrames + 1) : 0
    const persistent = settings.treatment !== 'tape' && frame.persistence > 0 && frame.amount > 0
    if (unchanged && (frame.paused || !persistent || this.idleFrames > 40)) return true
    if (this.canvas.width !== output.width) this.canvas.width = output.width
    if (this.canvas.height !== output.height) this.canvas.height = output.height
    this.ensureHistory(persistent, output.width, output.height)

    gl.bindVertexArray(this.vao)
    gl.viewport(0, 0, output.width, output.height)
    const program = this.programs[0]
    program.activate()
    this.sourceTexture.bind(0)
    program.setSampler('source', 0)
    const next = 1 - this.historyIndex
    if (this.history) {
      const target = this.history[next]
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.handle, 0)
      this.history[this.historyIndex].bind(1)
    } else {
      this.sourceTexture.bind(1)
    }
    program.setSampler('history', 1)
    program.setFloat('historyWeight', this.history && !frame.paused && this.warmup === 0
      ? Math.pow(frame.persistence, Math.max(1, frame.dt * 60)) : 0)
    program.setVec2('viewportSize', viewport.width, viewport.height)
    program.setVec2('outputSize', output.width, output.height)
    program.setVec2('fitSize', fitWidth, fitHeight)
    program.setVec2('position', viewport.width * transform.positionX / 100, -viewport.height * transform.positionY / 100)
    program.setFloat('transformScale', transform.scale)
    program.setFloat('rotation', transform.rotation * Math.PI / 180)
    program.setFloat('amount', frame.amount)
    program.setFloat('phase', frame.phase)
    program.setFloat('damage', frame.damage)
    program.setFloat('tracking', frame.tracking)
    program.setFloat('dropout', frame.dropout)
    program.setFloat('bleed', settings.bleed)
    program.setFloat('roll', frame.roll)
    program.setFloat('grain', settings.grain)
    program.setFloat('scanlines', settings.scanlines)
    program.setFloat('curvature', settings.curvature)
    program.setFloat('phosphor', settings.phosphor)
    program.setFloat('misalignment', settings.misalignment)
    program.setFloat('audioTexture', frame.texture)
    program.setFloat('glow', frame.glow)
    program.setInt('seed', settings.seed)
    program.setInt('chromaTaps', quality.chromaTaps)
    program.setInt('lineLimit', quality.crtLines)
    program.setBool('tape', settings.treatment !== 'crt')
    program.setBool('crt', settings.treatment !== 'tape')
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    if (this.history) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      const present = this.programs[1]
      present.activate()
      this.history[next].bind(0)
      present.setSampler('processed', 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.historyIndex = next
      if (!frame.paused && this.warmup > 0) this.warmup--
    }
    this.lastSettings = settings
    this.lastFrame = key
    return true
  }

  private ensureHistory(enabled: boolean, width: number, height: number) {
    if (enabled && this.history?.[0].width === width && this.history[0].height === height) return
    if (this.history) {
      const gl = this.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      for (const texture of this.history) texture.dispose()
      this.history = null
    }
    if (!enabled) return
    const gl = this.gl
    this.history = [new ShaderTexture(gl), new ShaderTexture(gl)]
    this.historyIndex = 0
    this.warmup = VHS_HISTORY_WARMUP_FRAMES
    gl.activeTexture(gl.TEXTURE1)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    for (const texture of this.history) {
      const target = texture.asRenderTarget(width, height)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('VHS phosphor framebuffer incomplete')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private upload(source: DirectWebGLSource, width: number, height: number) {
    const gl = this.gl
    const size = boundVhsSize(width, height, this.maxSourceEdge)
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('VHS source resize unavailable')
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
    if (error !== gl.NO_ERROR) throw new Error(`VHS source upload failed (${error})`)
  }

  dispose() {
    const gl = this.gl
    this.video?.removeEventListener('seeking', this.onSeek)
    this.video = null
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.useProgram(null)
    gl.bindVertexArray(null)
    for (const program of this.programs) program.dispose()
    this.programs = []
    this.sourceTexture.dispose()
    this.history?.forEach(texture => texture.dispose())
    this.history = null
    gl.deleteFramebuffer(this.framebuffer)
    gl.deleteVertexArray(this.vao)
    this.framebuffer = this.vao = null
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
