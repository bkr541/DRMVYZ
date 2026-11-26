import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import type { DirectWebGLSource, DirectWebGLTransform } from '../CanvasDirectWebGLLayer'
import type { MorphFrame } from './MorphPerformance'
import { boundMorphSize, morphOutputEdge, MORPH_DIRECTIONS, MORPH_PALETTES, type CanvasMorphSettings } from './MorphSettings'
import { MORPH_VERTEX, MORPH_FRAGMENT, MORPH_BLUR, MORPH_COMPOSITE } from './MorphShaders'

export class MorphRenderer {
  private program: ShaderProgram | null = null
  private blur: ShaderProgram | null = null
  private composite: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private texture: ShaderTexture
  private source: DirectWebGLSource | null = null
  private uploadStamp = ''
  private staging: HTMLCanvasElement | null = null
  private lastSettings: CanvasMorphSettings | null = null
  private lastFrame = ''
  private history: WebGLTexture[] = []
  private targets: WebGLFramebuffer[] = []
  private bloomTextures: WebGLTexture[] = []
  private bloomTargets: WebGLFramebuffer[] = []
  private readIndex = 0
  private targetSize = ''
  private lastMode = -1
  private lastSourceGeometry = ''
  private maxSourceEdge: number
  private maxOutputEdge: number

  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.texture = new ShaderTexture(gl)
    this.maxSourceEdge = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.maxOutputEdge = Math.min(2560, this.maxSourceEdge, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    const renderer = new MorphRenderer(canvas, gl)
    try {
      const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'Morph', vertSrc: MORPH_VERTEX, fragSrc: MORPH_FRAGMENT })
      if (!result.program) throw new Error(result.error.log)
      renderer.program = result.program
      for (const [label, fragSrc] of [['blur', MORPH_BLUR], ['composite', MORPH_COMPOSITE]] as const) {
        const pass = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: `Morph/${label}`, vertSrc: MORPH_VERTEX, fragSrc })
        if (!pass.program) throw new Error(pass.error.log)
        if (label === 'blur') renderer.blur = pass.program
        else renderer.composite = pass.program
      }
      renderer.vao = gl.createVertexArray()
      if (!renderer.vao) throw new Error('Morph vertex allocation failed')
      return renderer
    } catch (error) {
      renderer.dispose()
      throw error
    }
  }

  render({ source, settings, frame, fitMode, transform, viewport, dpr }: {
    source: DirectWebGLSource | null; settings: CanvasMorphSettings; frame: MorphFrame
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
    const changedSource = source !== this.source || (!video && 'naturalWidth' in source && stamp !== this.uploadStamp)
    const fresh = changedSource || stamp !== this.uploadStamp || stamp === ''
    if (fresh) {
      this.upload(source, width, height)
      this.source = source
      this.uploadStamp = stamp
    }

    const edge = morphOutputEdge(settings.quality, viewport.width, viewport.height)
    const density = Math.min(2, Math.max(1, dpr))
    const output = boundMorphSize(viewport.width * density, viewport.height * density, Math.min(this.maxOutputEdge, edge))
    const fit = fitMode === 'cover' ? Math.max(viewport.width / width, viewport.height / height) : Math.min(viewport.width / width, viewport.height / height)
    const fitWidth = fitMode === 'stretch' ? viewport.width : width * fit
    const fitHeight = fitMode === 'stretch' ? viewport.height : height * fit
    const geometry = [width, height, viewport.width, viewport.height, fitWidth, fitHeight, transform.scale, transform.rotation,
      transform.positionX, transform.positionY].join(':')
    const key = [output.width, output.height, geometry, frame.mode, frame.amount, frame.motion, frame.hit, frame.accent, frame.energy, frame.paused, frame.fromMode, frame.blend, frame.pattern, frame.trail].join(':')
    if (!fresh && !frame.reset && this.lastSettings === settings && this.lastFrame === key) return true
    const resetHistory = changedSource || frame.reset || frame.mode !== this.lastMode || geometry !== this.lastSourceGeometry
      || frame.amount <= 0.00001 || settings.feedback === 0 || this.lastSettings?.feedback === 0
    this.lastSettings = settings
    this.lastFrame = key
    this.lastMode = frame.mode
    this.lastSourceGeometry = geometry
    if (this.canvas.width !== output.width) this.canvas.width = output.width
    if (this.canvas.height !== output.height) this.canvas.height = output.height
    this.ensureTargets(output.width, output.height)
    if (resetHistory) this.clearHistory()
    const write = 1 - this.readIndex
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[write])
    gl.viewport(0, 0, output.width, output.height)
    program.activate()
    gl.bindVertexArray(this.vao)
    this.texture.bind(0)
    program.setSampler('source', 0)
    program.setVec2('viewportSize', viewport.width, viewport.height)
    program.setVec2('fitSize', fitWidth, fitHeight)
    program.setVec2('position', viewport.width * transform.positionX / 100, -viewport.height * transform.positionY / 100)
    program.setFloat('transformScale', transform.scale)
    program.setFloat('rotation', transform.rotation * Math.PI / 180)
    program.setFloat('motion', frame.motion)
    program.setFloat('amount', frame.amount)
    program.setInt('mode', frame.mode)
    program.setInt('fromMode', frame.fromMode ?? frame.mode)
    program.setFloat('modeBlend', frame.blend ?? 1)
    program.setInt('pattern', frame.pattern ?? 0)
    program.setInt('flowDirection', MORPH_DIRECTIONS.indexOf(settings.direction))
    program.setInt('palette', settings.preserveColors ? 0 : MORPH_PALETTES.indexOf(settings.palette))
    program.setFloat('complexity', settings.complexity)
    program.setFloat('depth', settings.depth)
    program.setFloat('spin', settings.rotation)
    program.setFloat('brightness', settings.brightness)
    program.setFloat('turbulence', settings.turbulence)
    program.setFloat('delta', frame.delta)
    program.setFloat('dotDensity', settings.dotDensity)
    program.setFloat('dotSize', settings.dotSize)
    program.setFloat('tunnelDepth', settings.tunnelDepth)
    program.setFloat('twist', settings.twist)
    program.setFloat('sourceMix', settings.sourceMix)
    program.setFloat('hit', frame.hit)
    program.setFloat('accent', frame.accent)
    program.setFloat('energy', frame.energy)
    program.setFloat('phase', (settings.seed % 997) / 997 * Math.PI * 2)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.history[this.readIndex])
    program.setSampler('history', 1)
    // Frame-rate-independent decay, with no retained history when editing a paused frame.
    program.setFloat('feedback', resetHistory || frame.paused ? 0 : Math.pow(Math.min(.995, settings.feedback * (frame.trail ?? 1) * .995), Math.max(0.25, frame.delta * 60)))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const strength = settings.glow * frame.amount * (frame.mode === 1 ? 0.65 : 1.45)
    if (strength > 0.0001 && this.blur && this.composite) {
      const bw = Math.max(1, Math.ceil(output.width / 4)), bh = Math.max(1, Math.ceil(output.height / 4))
      this.blur.activate()
      this.blur.setSampler('inputImage', 0)
      gl.activeTexture(gl.TEXTURE0)
      for (let pass = 0; pass < 2; pass++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomTargets[pass])
        gl.viewport(0, 0, bw, bh)
        gl.bindTexture(gl.TEXTURE_2D, pass === 0 ? this.history[write] : this.bloomTextures[0])
        this.blur.setInt('threshold', pass === 0 ? 1 : 0)
        this.blur.setVec2('direction', pass === 0 ? 1.4 / bw : 0, pass === 1 ? 1.4 / bh : 0)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, output.width, output.height)
      this.composite.activate()
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.history[write])
      this.composite.setSampler('imageTexture', 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.bloomTextures[1])
      this.composite.setSampler('bloomTexture', 1)
      this.composite.setFloat('strength', strength)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.targets[write])
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
      gl.blitFramebuffer(0, 0, output.width, output.height, 0, 0, output.width, output.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const error = gl.getError()
    if (error !== gl.NO_ERROR) throw new Error(`Morph render failed (${error})`)
    this.readIndex = write
    return true
  }

  private ensureTargets(width: number, height: number) {
    const gl = this.gl, key = `${width}:${height}`
    if (key === this.targetSize) return
    this.releaseTargets()
    for (let i = 0; i < 4; i++) {
      const bloom = i >= 2
      const texture = gl.createTexture(), target = gl.createFramebuffer()
      if (texture) (bloom ? this.bloomTextures : this.history).push(texture)
      if (target) (bloom ? this.bloomTargets : this.targets).push(target)
      if (!texture || !target) throw new Error('Morph history allocation failed')
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bloom ? Math.max(1, Math.ceil(width / 4)) : width, bloom ? Math.max(1, Math.ceil(height / 4)) : height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError() !== gl.NO_ERROR)
        throw new Error('Morph history framebuffer incomplete')
    }
    this.targetSize = key
    this.clearHistory()
  }

  private clearHistory() {
    const gl = this.gl
    gl.clearColor(0, 0, 0, 0)
    for (const target of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.readIndex = 0
  }

  private releaseTargets() {
    const gl = this.gl
    for (const target of [...this.targets, ...this.bloomTargets]) gl.deleteFramebuffer(target)
    for (const texture of [...this.history, ...this.bloomTextures]) gl.deleteTexture(texture)
    this.targets = []; this.history = []; this.bloomTextures = []; this.bloomTargets = []; this.targetSize = ''
  }

  private upload(source: DirectWebGLSource, width: number, height: number) {
    const gl = this.gl
    const size = boundMorphSize(width, height, this.maxSourceEdge)
    let pixels = source
    if (size.width !== width || size.height !== height) {
      const staging = this.staging ??= document.createElement('canvas')
      if (staging.width !== size.width) staging.width = size.width
      if (staging.height !== size.height) staging.height = size.height
      const context = staging.getContext('2d')
      if (!context) throw new Error('Morph source resize unavailable')
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
    if (error !== gl.NO_ERROR) throw new Error(`Morph source upload failed (${error})`)
  }

  dispose() {
    this.gl.useProgram(null)
    this.gl.bindVertexArray(null)
    this.program?.dispose()
    this.program = null
    this.blur?.dispose(); this.blur = null
    this.composite?.dispose(); this.composite = null
    this.releaseTargets()
    this.texture.dispose()
    this.gl.deleteVertexArray(this.vao)
    this.vao = null
    if (this.staging) this.staging.width = this.staging.height = 0
    this.source = null
  }
}
