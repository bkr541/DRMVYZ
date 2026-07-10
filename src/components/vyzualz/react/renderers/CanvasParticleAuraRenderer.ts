import type { CanvasParticleQuality, CanvasPresetColorMode, CanvasPresetSettings } from '../ReactTypes'
import { ShaderCompiler } from '../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../shaders/runtime/ShaderProgram'

type CanvasParticleSourceElement = HTMLVideoElement | HTMLImageElement

export type CanvasParticlePoint = {
  baseX: number
  baseY: number
  luma: number
  alpha: number
  r: number
  g: number
  b: number
  seed: number
}

export type CanvasParticleQualityProfile = {
  sampleWidth: number
  sampleHeight: number
  minParticles: number
  maxParticles: number
  maxDpr: number
  videoSampleIntervalMs: number
  staticSampleIntervalMs: number
  areaDivisor: number
}

export type CanvasParticleAudioFrame = {
  bass: number
  high: number
  beat: number
}

export const CANVAS_PARTICLE_QUALITY_PROFILES: Record<CanvasParticleQuality, CanvasParticleQualityProfile> = {
  low: {
    sampleWidth: 88,
    sampleHeight: 50,
    minParticles: 360,
    maxParticles: 1200,
    maxDpr: 1,
    videoSampleIntervalMs: 320,
    staticSampleIntervalMs: 1100,
    areaDivisor: 620,
  },
  balanced: {
    sampleWidth: 128,
    sampleHeight: 72,
    minParticles: 720,
    maxParticles: 2600,
    maxDpr: 1.5,
    videoSampleIntervalMs: 220,
    staticSampleIntervalMs: 900,
    areaDivisor: 360,
  },
  high: {
    sampleWidth: 180,
    sampleHeight: 102,
    minParticles: 1200,
    maxParticles: 4200,
    maxDpr: 2,
    videoSampleIntervalMs: 150,
    staticSampleIntervalMs: 760,
    areaDivisor: 220,
  },
}

export function resolveCanvasParticleQualityProfile(quality: CanvasParticleQuality): CanvasParticleQualityProfile {
  return CANVAS_PARTICLE_QUALITY_PROFILES[quality] ?? CANVAS_PARTICLE_QUALITY_PROFILES.balanced
}

export function clampCanvasParticleRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function seededCanvasParticleNoise(seed: number): number {
  const value = Math.sin(seed * 128.317 + 19.19) * 43758.5453
  return value - Math.floor(value)
}

export function isCanvasParticleSourceReady(source: CanvasParticleSourceElement | null): boolean {
  if (!source) return false
  if (source instanceof HTMLVideoElement) return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0
  return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
}

export function getCanvasParticleSourceSize(source: CanvasParticleSourceElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  return { width: source.naturalWidth, height: source.naturalHeight }
}

export function resolveCanvasParticleBudget(
  settings: CanvasPresetSettings,
  profile: CanvasParticleQualityProfile,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const areaBudget = Math.max(profile.minParticles, Math.floor((viewportWidth * viewportHeight) / profile.areaDivisor))
  const maxParticles = Math.min(profile.maxParticles, areaBudget)
  const target = profile.minParticles + settings.particleDensity * (maxParticles - profile.minParticles)
  return clampCanvasParticleRange(Math.round(target), profile.minParticles, maxParticles)
}

function createCanvasParticleFallbackPoints(targetCount: number): CanvasParticlePoint[] {
  const points: CanvasParticlePoint[] = []
  const safeCount = Math.max(1, Math.round(targetCount))
  for (let index = 0; index < safeCount; index += 1) {
    const seed = index + 1
    const angle = seed * 2.399963
    const radius = Math.sqrt((index + 0.5) / safeCount) * 0.44
    const luma = 0.42 + seededCanvasParticleNoise(seed * 3.7) * 0.58
    points.push({
      baseX: 0.5 + Math.cos(angle) * radius,
      baseY: 0.5 + Math.sin(angle) * radius,
      luma,
      alpha: 0.72,
      r: 100 + Math.round(luma * 116),
      g: 205 + Math.round(luma * 38),
      b: 220 + Math.round(luma * 35),
      seed,
    })
  }
  return points
}

export function sampleCanvasParticleSource({
  source,
  settings,
  sampleCanvas,
  profile,
  targetCount,
}: {
  source: CanvasParticleSourceElement | null
  settings: CanvasPresetSettings
  sampleCanvas: HTMLCanvasElement
  profile: CanvasParticleQualityProfile
  targetCount: number
}): CanvasParticlePoint[] {
  const safeTargetCount = Math.max(1, Math.round(targetCount))
  if (!source || !isCanvasParticleSourceReady(source)) return createCanvasParticleFallbackPoints(safeTargetCount)

  const sampleWidth = profile.sampleWidth
  const sampleHeight = profile.sampleHeight
  sampleCanvas.width = sampleWidth
  sampleCanvas.height = sampleHeight
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return createCanvasParticleFallbackPoints(safeTargetCount)

  sampleContext.clearRect(0, 0, sampleWidth, sampleHeight)
  const sourceSize = getCanvasParticleSourceSize(source)
  const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height)
  const sampleAspect = sampleWidth / sampleHeight
  let drawWidth = sampleWidth
  let drawHeight = sampleHeight
  let drawX = 0
  let drawY = 0
  if (sourceAspect > sampleAspect) {
    drawHeight = sampleWidth / sourceAspect
    drawY = (sampleHeight - drawHeight) / 2
  } else {
    drawWidth = sampleHeight * sourceAspect
    drawX = (sampleWidth - drawWidth) / 2
  }

  try {
    sampleContext.drawImage(source, drawX, drawY, drawWidth, drawHeight)
  } catch {
    // Local library media and object URLs are normally readable. If a video, image,
    // or SVG taints/block pixel access, keep Particle Aura alive with a procedural
    // source-shaped cloud instead of crashing the live output.
    return createCanvasParticleFallbackPoints(safeTargetCount)
  }

  let imageData: ImageData
  try {
    imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight)
  } catch {
    // SVGs containing external references can taint Canvas2D. The WebGL renderer
    // still runs, but without per-pixel luma/alpha emission from that file.
    return createCanvasParticleFallbackPoints(safeTargetCount)
  }

  const candidates: CanvasParticlePoint[] = []
  const threshold = 0.035 + settings.lumaThreshold * 0.11 + settings.turbulence * 0.12
  const stride = profile.maxParticles >= 4000 && settings.particleDensity > 0.74 ? 1 : 2
  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = (y * sampleWidth + x) * 4
      const r = imageData.data[index]
      const g = imageData.data[index + 1]
      const b = imageData.data[index + 2]
      const alpha = imageData.data[index + 3] / 255
      const luma = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
      const visible = alpha * (luma * 0.82 + alpha * 0.18)
      if (visible <= threshold) continue
      const seed = (x + 1) * 0.731 + (y + 1) * 1.371 + candidates.length * 0.113
      if (seededCanvasParticleNoise(seed) < settings.turbulence * 0.18) continue
      candidates.push({
        baseX: (x + 0.5) / sampleWidth,
        baseY: (y + 0.5) / sampleHeight,
        luma,
        alpha,
        r,
        g,
        b,
        seed,
      })
    }
  }

  if (candidates.length === 0) return createCanvasParticleFallbackPoints(safeTargetCount)

  const points: CanvasParticlePoint[] = []
  for (let index = 0; index < safeTargetCount; index += 1) {
    const pick = Math.floor(seededCanvasParticleNoise(index * 9.17 + candidates.length * 0.27) * candidates.length)
    const candidate = candidates[pick] ?? candidates[index % candidates.length]
    const jitter = 0.0015 + settings.turbulence * 0.013
    points.push({
      ...candidate,
      baseX: clampCanvasParticleRange(candidate.baseX + (seededCanvasParticleNoise(index * 2.1) - 0.5) * jitter, 0, 1),
      baseY: clampCanvasParticleRange(candidate.baseY + (seededCanvasParticleNoise(index * 3.4) - 0.5) * jitter, 0, 1),
      seed: candidate.seed + index * 0.019,
    })
  }
  return points
}

function mixCanvasParticleChannel(a: number, b: number, amount: number): number {
  return Math.round(a + (b - a) * clampCanvasParticleRange(amount, 0, 1))
}

function getCanvasParticleChannels(
  point: CanvasParticlePoint,
  mode: CanvasPresetColorMode,
  bass: number,
  high: number,
): [number, number, number] {
  if (mode === 'original') return [point.r / 255, point.g / 255, point.b / 255]

  if (mode === 'palette') {
    const mix = clampCanvasParticleRange(point.luma * 0.72 + seededCanvasParticleNoise(point.seed) * 0.28, 0, 1)
    return [
      mixCanvasParticleChannel(74, 97, mix) / 255,
      mixCanvasParticleChannel(199, 214, mix) / 255,
      mixCanvasParticleChannel(219, 170, mix) / 255,
    ]
  }

  const energy = clampCanvasParticleRange(bass * 0.65 + high * 0.6, 0, 1)
  return [
    mixCanvasParticleChannel(74, 255, high * 0.82) / 255,
    mixCanvasParticleChannel(199, 97, bass * 0.45) / 255,
    mixCanvasParticleChannel(219, 216, energy) / 255,
  ]
}

const QUAD_VERT = new Float32Array([
  -1, -1, 0, 0,
   1, -1, 1, 0,
  -1,  1, 0, 1,
   1,  1, 1, 1,
])

const FULLSCREEN_VERTEX_SRC = /* glsl */`#version 300 es
in vec2 aPos;
in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FEEDBACK_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevious;
uniform float uDecay;
uniform float uZoom;
uniform vec2 uSmear;
out vec4 fragColor;
void main() {
  vec2 uv = (vUv - 0.5) / max(0.001, uZoom) + 0.5 + uSmear;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0);
    return;
  }
  vec4 prev = texture(uPrevious, uv);
  fragColor = vec4(prev.rgb * uDecay, prev.a * uDecay);
}
`

const BLIT_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uOutputAlpha;
out vec4 fragColor;
void main() {
  vec4 c = texture(uTex, vUv);
  fragColor = vec4(c.rgb * uOutputAlpha, c.a * uOutputAlpha);
}
`

const PARTICLE_VERTEX_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 aBase;
in vec4 aColorAlpha;
in vec2 aLumaSeed;
uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uBeat;
uniform float uIntensity;
uniform float uTurbulence;
uniform float uParticleSize;
uniform float uGlow;
uniform float uBassReactivity;
uniform float uBeatPulse;
uniform float uMotionAmount;
uniform float uPixelRatio;
out vec4 vColorAlpha;
out float vLuma;
out float vSparkle;

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453123); }

void main() {
  float luma = aLumaSeed.x;
  float seed = aLumaSeed.y;
  vec2 centered = aBase - vec2(0.5);
  float dist = max(0.08, length(centered));
  vec2 normal = centered / dist;
  float n1 = sin(uTime * (0.65 + luma * 0.55) + seed * 10.1);
  float n2 = cos(uTime * (0.72 + aColorAlpha.a * 0.32) + seed * 7.7);
  float n3 = sin(uTime * (1.45 + uHigh * 2.2) + seed * 4.3);
  float outward = uBass * uBassReactivity * uIntensity * (0.045 + uBeat * 0.028);
  vec2 turbulent = vec2(n1, n2) * uTurbulence * (0.010 + uHigh * 0.028 + uBass * 0.018);
  vec2 shimmer = vec2(n3, -n1) * uMotionAmount * (0.002 + uHigh * 0.01);
  vec2 pos = aBase + normal * outward + turbulent + shimmer;
  pos += normal * uBeat * uBeatPulse * (0.006 + luma * 0.012);

  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);

  float beatScale = 1.0 + uBeat * uBeatPulse * 0.7;
  float highSpark = 0.85 + abs(sin(uTime * 18.0 + seed * 12.0)) * uHigh * 0.65;
  float size = uParticleSize * uPixelRatio * (0.65 + luma * 1.45 + uGlow * 0.45) * beatScale * highSpark;
  gl_PointSize = clamp(size, 0.75, 34.0 * uPixelRatio);

  vColorAlpha = aColorAlpha;
  vLuma = luma;
  vSparkle = highSpark;
}
`

const PARTICLE_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec4 vColorAlpha;
in float vLuma;
in float vSparkle;
uniform float uGlow;
uniform float uIntensity;
uniform float uBass;
uniform float uHigh;
out vec4 fragColor;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p) * 2.0;
  float core = smoothstep(0.62, 0.0, d);
  float halo = smoothstep(1.0, 0.08, d) * (0.22 + uGlow * 0.78);
  float rim = smoothstep(1.0, 0.72, d) * smoothstep(0.20, 0.95, d) * uHigh * 0.36;
  float alpha = (core * 0.82 + halo * 0.52 + rim) * vColorAlpha.a * uIntensity * (0.72 + vLuma * 0.72) * vSparkle;
  alpha = clamp(alpha, 0.0, 1.0);
  vec3 color = vColorAlpha.rgb * (0.78 + vLuma * 0.8 + uGlow * 1.25 + uBass * 0.45);
  fragColor = vec4(color, alpha);
}
`

const POINT_FLOATS = 8
const POINT_STRIDE = POINT_FLOATS * Float32Array.BYTES_PER_ELEMENT

export type CanvasParticleAuraRenderParams = {
  settings: CanvasPresetSettings
  audio: CanvasParticleAudioFrame
  timeSec: number
  pixelRatio: number
}

export type CanvasParticleAuraCreateResult =
  | { renderer: CanvasParticleAuraRenderer; error: null }
  | { renderer: null; error: string }


export function compositeCanvasParticleLayerToCapture({
  context,
  particleCanvas,
  settings,
  width,
  height,
}: {
  context: CanvasRenderingContext2D
  particleCanvas: HTMLCanvasElement | null
  settings: CanvasPresetSettings
  width: number
  height: number
}): boolean {
  if (!particleCanvas?.width || !particleCanvas.height || settings.particleDensity <= 0.02) return false
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = clampCanvasParticleRange(settings.intensity * 0.9 + settings.glow * 0.18, 0, 1)
  context.filter = `blur(${(settings.glow * 0.65).toFixed(2)}px)`
  try {
    context.drawImage(particleCanvas, 0, 0, width, height)
  } catch {
    context.restore()
    return false
  }
  context.restore()
  return true
}

export class CanvasParticleAuraRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly feedbackProgram: ShaderProgram
  private readonly blitProgram: ShaderProgram
  private readonly particleProgram: ShaderProgram
  private readonly quadVao: WebGLVertexArrayObject
  private readonly quadBuffer: WebGLBuffer
  private readonly particleVao: WebGLVertexArrayObject
  private readonly particleBuffer: WebGLBuffer
  private previousTexture: WebGLTexture | null = null
  private currentTexture: WebGLTexture | null = null
  private previousFbo: WebGLFramebuffer | null = null
  private currentFbo: WebGLFramebuffer | null = null
  private width = 1
  private height = 1
  private pointCount = 0
  private pointUploadBuffer = new Float32Array(0)
  private disposed = false
  private initialized = false

  static create(canvas: HTMLCanvasElement): CanvasParticleAuraCreateResult {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null

    if (!gl) return { renderer: null, error: 'WebGL2 unavailable for CANVAS Particle Aura' }

    try {
      return { renderer: new CanvasParticleAuraRenderer(canvas, gl), error: null }
    } catch (error) {
      // Constructor failures can occur after shaders or buffers were allocated.
      // This canvas is replaced by the compatibility renderer, so explicitly
      // retire the failed context and let the browser release partial resources.
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // Context retirement is best-effort; the replacement canvas still owns the fallback path.
      }
      const message = error instanceof Error ? error.message : 'Particle Aura WebGL initialization failed'
      return { renderer: null, error: message }
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
    const compiler = new ShaderCompiler(gl)
    const feedback = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-feedback',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: FEEDBACK_FRAGMENT_SRC,
      attributes: { aPos: 0, aUv: 1 },
      requiredUniforms: ['uPrevious', 'uDecay', 'uZoom', 'uSmear'],
    })
    if (!feedback.program) throw new Error(`Particle Aura feedback shader failed: ${feedback.error.log}`)
    this.feedbackProgram = feedback.program

    const blit = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-blit',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: BLIT_FRAGMENT_SRC,
      attributes: { aPos: 0, aUv: 1 },
      requiredUniforms: ['uTex', 'uOutputAlpha'],
    })
    if (!blit.program) throw new Error(`Particle Aura blit shader failed: ${blit.error.log}`)
    this.blitProgram = blit.program

    const particle = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-particles',
      vertSrc: PARTICLE_VERTEX_SRC,
      fragSrc: PARTICLE_FRAGMENT_SRC,
      attributes: { aBase: 0, aColorAlpha: 1, aLumaSeed: 2 },
      requiredUniforms: [
        'uTime', 'uBass', 'uHigh', 'uBeat', 'uIntensity', 'uTurbulence', 'uParticleSize',
        'uGlow', 'uBassReactivity', 'uBeatPulse', 'uMotionAmount', 'uPixelRatio',
      ],
    })
    if (!particle.program) throw new Error(`Particle Aura particle shader failed: ${particle.error.log}`)
    this.particleProgram = particle.program

    const quadVao = gl.createVertexArray()
    const quadBuffer = gl.createBuffer()
    const particleVao = gl.createVertexArray()
    const particleBuffer = gl.createBuffer()
    if (!quadVao || !quadBuffer || !particleVao || !particleBuffer) {
      throw new Error('Particle Aura could not allocate WebGL buffers')
    }
    this.quadVao = quadVao
    this.quadBuffer = quadBuffer
    this.particleVao = particleVao
    this.particleBuffer = particleBuffer

    gl.bindVertexArray(this.quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERT, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT)

    gl.bindVertexArray(this.particleVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, POINT_STRIDE, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, POINT_STRIDE, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, POINT_STRIDE, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, POINT_STRIDE, 6 * Float32Array.BYTES_PER_ELEMENT)

    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
  }

  uploadPoints(points: CanvasParticlePoint[], settings: CanvasPresetSettings, audio: CanvasParticleAudioFrame): void {
    if (this.disposed) return
    const gl = this.gl
    const requiredLength = points.length * POINT_FLOATS
    if (this.pointUploadBuffer.length < requiredLength) {
      this.pointUploadBuffer = new Float32Array(requiredLength)
    }
    const data = this.pointUploadBuffer.subarray(0, requiredLength)
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      const [r, g, b] = getCanvasParticleChannels(point, settings.particleColorMode, audio.bass, audio.high)
      const offset = index * POINT_FLOATS
      data[offset] = point.baseX
      data[offset + 1] = point.baseY
      data[offset + 2] = r
      data[offset + 3] = g
      data[offset + 4] = b
      data[offset + 5] = clampCanvasParticleRange(point.alpha * (0.72 + point.luma * 0.54), 0, 1)
      data[offset + 6] = point.luma
      data[offset + 7] = point.seed
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.pointCount = points.length
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, Math.floor(width))
    const safeHeight = Math.max(1, Math.floor(height))
    if (this.width === safeWidth && this.height === safeHeight && this.previousTexture && this.currentTexture) return
    this.width = safeWidth
    this.height = safeHeight
    this.canvas.width = safeWidth
    this.canvas.height = safeHeight
    this.releaseFramebuffers()
    this.previousTexture = this.createRenderTexture(safeWidth, safeHeight)
    this.currentTexture = this.createRenderTexture(safeWidth, safeHeight)
    this.previousFbo = this.createFramebuffer(this.previousTexture)
    this.currentFbo = this.createFramebuffer(this.currentTexture)
    this.initialized = false
  }

  render(params: CanvasParticleAuraRenderParams): void {
    if (this.disposed || !this.previousTexture || !this.currentTexture || !this.previousFbo || !this.currentFbo) return
    const gl = this.gl
    const { settings, audio, timeSec, pixelRatio } = params
    gl.viewport(0, 0, this.width, this.height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)

    if (!this.initialized || settings.trailAmount <= 0.01) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.previousFbo)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFbo)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      this.initialized = true
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFbo)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const decay = clampCanvasParticleRange(settings.trailAmount * (0.66 + settings.intensity * 0.32), 0.02, 0.96)
    const feedbackZoom = 1 + settings.trailAmount * settings.turbulence * 0.014 + audio.bass * settings.bassReactivity * 0.012
    const smearX = Math.sin(timeSec * (0.53 + settings.turbulence)) * settings.motionAmount * settings.trailAmount * 0.003
    const smearY = Math.cos(timeSec * (0.47 + settings.turbulence * 1.2)) * settings.motionAmount * settings.trailAmount * 0.003
    gl.disable(gl.BLEND)
    this.feedbackProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.previousTexture)
    this.feedbackProgram.setSampler('uPrevious', 0)
    this.feedbackProgram.setFloat('uDecay', decay)
    this.feedbackProgram.setFloat('uZoom', feedbackZoom)
    this.feedbackProgram.setVec2('uSmear', smearX, smearY)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    if (this.pointCount > 0) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      this.particleProgram.activate()
      this.particleProgram.setFloat('uTime', timeSec)
      this.particleProgram.setFloat('uBass', audio.bass)
      this.particleProgram.setFloat('uHigh', audio.high)
      this.particleProgram.setFloat('uBeat', audio.beat)
      this.particleProgram.setFloat('uIntensity', settings.intensity)
      this.particleProgram.setFloat('uTurbulence', settings.turbulence)
      this.particleProgram.setFloat('uParticleSize', settings.particleSize)
      this.particleProgram.setFloat('uGlow', settings.glow)
      this.particleProgram.setFloat('uBassReactivity', settings.bassReactivity)
      this.particleProgram.setFloat('uBeatPulse', settings.beatPulse)
      this.particleProgram.setFloat('uMotionAmount', settings.motionAmount)
      this.particleProgram.setFloat('uPixelRatio', pixelRatio)
      gl.bindVertexArray(this.particleVao)
      gl.drawArrays(gl.POINTS, 0, this.pointCount)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)
    this.blitProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture)
    this.blitProgram.setSampler('uTex', 0)
    this.blitProgram.setFloat('uOutputAlpha', clampCanvasParticleRange(settings.intensity * 1.18 + settings.glow * 0.12, 0, 1.35))
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.BLEND)
    this.swapFeedbackTargets()
  }

  clear(): void {
    if (this.disposed) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.previousFbo)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFbo)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.initialized = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    this.releaseFramebuffers()
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteBuffer(this.particleBuffer)
    gl.deleteVertexArray(this.quadVao)
    gl.deleteVertexArray(this.particleVao)
    this.feedbackProgram.dispose()
    this.blitProgram.dispose()
    this.particleProgram.dispose()
    this.pointCount = 0
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.useProgram(null)
  }

  private createRenderTexture(width: number, height: number): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Particle Aura texture allocation failed')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new Error('Particle Aura framebuffer allocation failed')
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fbo)
      throw new Error('Particle Aura framebuffer is incomplete')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return fbo
  }

  private releaseFramebuffers(): void {
    const gl = this.gl
    if (this.previousFbo) gl.deleteFramebuffer(this.previousFbo)
    if (this.currentFbo) gl.deleteFramebuffer(this.currentFbo)
    if (this.previousTexture) gl.deleteTexture(this.previousTexture)
    if (this.currentTexture) gl.deleteTexture(this.currentTexture)
    this.previousFbo = null
    this.currentFbo = null
    this.previousTexture = null
    this.currentTexture = null
  }

  private swapFeedbackTargets(): void {
    ;[this.previousTexture, this.currentTexture] = [this.currentTexture, this.previousTexture]
    ;[this.previousFbo, this.currentFbo] = [this.currentFbo, this.previousFbo]
  }
}
