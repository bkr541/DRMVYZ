import {
  CanvasFracturesImagePaletteCache,
  packCanvasFracturesEffectParams,
  resolveCanvasFracturesPalette,
  type CanvasFracturesPackedEffectParams,
} from './CanvasFracturesEffects'
import {
  isCanvasFracturesSourceReady,
  resolveCanvasFracturesFitRect,
} from './CanvasFracturesTransforms'
import type {
  CanvasFractureEffectAssignment,
  CanvasFractureFragment,
  CanvasFracturePoint,
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
  CanvasFracturesResolvedPalette,
} from './CanvasFracturesTypes'

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec2 aUv;
in vec2 aLocal;
out vec2 vUv;
out vec2 vLocal;
void main() {
  vUv = aUv;
  vLocal = aLocal;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vLocal;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDpr;
uniform vec2 uCropMin;
uniform vec2 uCropMax;
uniform vec2 uDirection;
uniform float uPhase;
uniform float uOpacity;
uniform int uRole;
uniform float uIntensity;
uniform float uOutlineThickness;
uniform float uOutlineIntensity;
uniform float uBloomIntensity;
uniform float uRgbSplit;
uniform float uLumaThreshold;
uniform int uLumaMode;
uniform float uDisplacement;
uniform float uPixelation;
uniform float uScanlines;
uniform float uNoise;
uniform int uQuality;
uniform vec3 uPrimary;
uniform vec3 uSupporting;
uniform vec3 uAccent;

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 value) {
  value = fract(value * vec2(123.34, 456.21));
  value += dot(value, value + 45.32 + uPhase * 17.0);
  return fract(value.x * value.y);
}

vec2 safeUv(vec2 uv) {
  vec2 edge = uTexel * 0.55;
  return clamp(uv, uCropMin + edge, uCropMax - edge);
}

vec4 sampleSource(vec2 uv) {
  return texture(uSource, safeUv(uv));
}

float edgeSignal(vec2 uv, float radius) {
  vec4 center = sampleSource(uv);
  float centreSignal = max(center.a, luminance(center.rgb) * center.a);
  vec2 px = uTexel * radius;
  vec4 left = sampleSource(uv - vec2(px.x, 0.0));
  vec4 right = sampleSource(uv + vec2(px.x, 0.0));
  vec4 up = sampleSource(uv - vec2(0.0, px.y));
  vec4 down = sampleSource(uv + vec2(0.0, px.y));
  float neighborhood = max(max(left.a, right.a), max(up.a, down.a));
  float lumaDelta = max(
    max(abs(luminance(left.rgb) - luminance(center.rgb)), abs(luminance(right.rgb) - luminance(center.rgb))),
    max(abs(luminance(up.rgb) - luminance(center.rgb)), abs(luminance(down.rgb) - luminance(center.rgb)))
  );
  return clamp(max(neighborhood - centreSignal, lumaDelta * center.a * 1.7), 0.0, 1.0);
}

vec4 bloomColor(vec2 uv, float amount) {
  float qualityRadius = uQuality == 0 ? 0.72 : (uQuality == 2 ? 1.28 : 1.0);
  vec2 px = uTexel * (2.0 + amount * 16.0) * qualityRadius;
  vec2 perpendicular = vec2(-uDirection.y, uDirection.x);
  vec4 sum = sampleSource(uv) * 0.24;
  sum += sampleSource(uv + uDirection * px) * 0.12;
  sum += sampleSource(uv - uDirection * px) * 0.12;
  sum += sampleSource(uv + perpendicular * px) * 0.12;
  sum += sampleSource(uv - perpendicular * px) * 0.12;
  sum += sampleSource(uv + (uDirection + perpendicular) * px * 0.7) * 0.07;
  sum += sampleSource(uv - (uDirection + perpendicular) * px * 0.7) * 0.07;
  sum += sampleSource(uv + (uDirection - perpendicular) * px * 0.7) * 0.07;
  sum += sampleSource(uv - (uDirection - perpendicular) * px * 0.7) * 0.07;
  return sum;
}

void main() {
  vec4 source = sampleSource(vUv);
  float intensity = clamp(uIntensity, 0.0, 1.0);

  if (uRole == 1) {
    float edge = edgeSignal(vUv, 1.0 + uOutlineThickness * 6.0) * uOutlineIntensity * intensity;
    vec3 outlined = source.rgb + uPrimary * edge * (0.8 + uOutlineIntensity * 1.4);
    outColor = vec4(outlined, max(source.a, edge) * uOpacity);
    return;
  }

  if (uRole == 2) {
    float amount = uBloomIntensity * intensity;
    vec4 blurred = bloomColor(vUv, amount);
    float alphaHalo = max(0.0, blurred.a - source.a);
    float emissive = max(luminance(blurred.rgb), alphaHalo * 0.75) * amount;
    vec3 bloom = uSupporting * emissive * (0.8 + amount * 1.6);
    outColor = vec4(source.rgb + bloom, max(source.a, emissive * 0.75) * uOpacity);
    return;
  }

  if (uRole == 3) {
    float amount = uRgbSplit * intensity;
    vec2 shift = uDirection * uTexel * (1.0 + amount * 22.0);
    float band = floor(vLocal.y * 13.0 + uPhase * 7.0);
    float bandSign = hash21(vec2(band, uPhase)) > 0.5 ? 1.0 : -1.0;
    vec2 sliceShift = vec2(shift.x * bandSign * amount * 1.7, shift.y * bandSign * amount * 0.35);
    vec4 redSample = sampleSource(vUv + shift + sliceShift);
    vec4 greenSample = sampleSource(vUv);
    vec4 blueSample = sampleSource(vUv - shift + sliceShift);
    vec3 split = vec3(redSample.r, greenSample.g, blueSample.b);
    float alpha = max(redSample.a, max(greenSample.a, blueSample.a));
    outColor = vec4(mix(source.rgb, split, amount), alpha * uOpacity);
    return;
  }

  if (uRole == 4) {
    float luma = luminance(source.rgb);
    float softness = 0.04 + (1.0 - intensity) * 0.08;
    float mask = 0.0;
    if (uLumaMode == 1) mask = 1.0 - smoothstep(uLumaThreshold - softness, uLumaThreshold + softness, luma);
    else if (uLumaMode == 2) mask = 1.0 - smoothstep(softness, softness * 3.0, abs(luma - uLumaThreshold));
    else mask = smoothstep(uLumaThreshold - softness, uLumaThreshold + softness, luma);
    vec3 isolated = mix(source.rgb, uAccent * (0.45 + luma), intensity * 0.45);
    outColor = vec4(isolated, source.a * mask * uOpacity);
    return;
  }

  if (uRole == 5) {
    float amount = uDisplacement * intensity;
    float slices = uQuality == 0 ? 7.0 : (uQuality == 2 ? 17.0 : 11.0);
    float band = floor((abs(uDirection.x) >= abs(uDirection.y) ? vLocal.y : vLocal.x) * slices + uPhase * 5.0);
    float signValue = hash21(vec2(band, uPhase)) > 0.5 ? 1.0 : -1.0;
    vec2 axis = abs(uDirection.x) >= abs(uDirection.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 displacedUv = vUv + axis * uTexel * signValue * (2.0 + amount * 28.0);
    vec4 displaced = sampleSource(displacedUv);
    outColor = vec4(displaced.rgb, displaced.a * uOpacity);
    return;
  }

  if (uRole == 6) {
    float qualityScale = uQuality == 0 ? 0.65 : (uQuality == 2 ? 1.35 : 1.0);
    float blockCount = mix(180.0 * qualityScale, 10.0, uPixelation * intensity);
    vec2 cropSize = max(uCropMax - uCropMin, uTexel * 2.0);
    vec2 pixelLocal = (floor(vLocal * blockCount) + 0.5) / blockCount;
    vec2 pixelUv = uCropMin + pixelLocal * cropSize;
    vec4 textured = sampleSource(pixelUv);
    float spacing = mix(11.0, 3.0, uScanlines * intensity);
    float scan = step(0.55, fract((gl_FragCoord.y / max(1.0, uDpr) + uPhase * spacing * 9.0) / spacing));
    float scanAmount = uScanlines * intensity * 0.35;
    textured.rgb = mix(textured.rgb, textured.rgb * 0.42 + uSupporting * 0.14, scan * scanAmount);
    float noise = hash21(floor(vLocal * vec2(240.0, 135.0)) + uPhase * 31.0) - 0.5;
    textured.rgb += uAccent * noise * uNoise * intensity * 0.28;
    outColor = vec4(textured.rgb, textured.a * uOpacity);
    return;
  }

  outColor = vec4(source.rgb, source.a * uOpacity);
}`

interface Uniforms {
  source: WebGLUniformLocation | null
  texel: WebGLUniformLocation | null
  dpr: WebGLUniformLocation | null
  cropMin: WebGLUniformLocation | null
  cropMax: WebGLUniformLocation | null
  direction: WebGLUniformLocation | null
  phase: WebGLUniformLocation | null
  opacity: WebGLUniformLocation | null
  role: WebGLUniformLocation | null
  intensity: WebGLUniformLocation | null
  outlineThickness: WebGLUniformLocation | null
  outlineIntensity: WebGLUniformLocation | null
  bloomIntensity: WebGLUniformLocation | null
  rgbSplit: WebGLUniformLocation | null
  lumaThreshold: WebGLUniformLocation | null
  lumaMode: WebGLUniformLocation | null
  displacement: WebGLUniformLocation | null
  pixelation: WebGLUniformLocation | null
  scanlines: WebGLUniformLocation | null
  noise: WebGLUniformLocation | null
  quality: WebGLUniformLocation | null
  primary: WebGLUniformLocation | null
  supporting: WebGLUniformLocation | null
  accent: WebGLUniformLocation | null
}

const CLEAN_ASSIGNMENT: CanvasFractureEffectAssignment = {
  role: 'clean',
  seed: 0,
  directionX: 1,
  directionY: 0,
  phase: 0,
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to allocate Fractures shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to allocate Fractures program')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'Unknown program link error'
    gl.deleteProgram(program)
    throw new Error(info)
  }
  return program
}

function sourceSize(source: HTMLVideoElement | HTMLImageElement): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth), height: Math.max(1, source.videoHeight) }
  }
  const image = source as HTMLImageElement
  return { width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export class CanvasFracturesWebGLRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly paletteCache = new CanvasFracturesImagePaletteCache()
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private vao: WebGLVertexArrayObject | null = null
  private texture: WebGLTexture | null = null
  private uniforms: Uniforms | null = null
  private plan: CanvasFracturesPlan | null = null
  private orderedFragments: readonly CanvasFractureFragment[] = []
  private cssWidth = 1
  private cssHeight = 1
  private dpr = 1
  private disposed = false
  private contextLost = false
  private uploadedSource: CanvasImageSource | null = null
  private uploadedIdentity = ''
  private readonly vertexData = new Float32Array(36)

  static create(canvas: HTMLCanvasElement): CanvasFracturesWebGLRenderer | null {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return null
    try {
      return new CanvasFracturesWebGLRenderer(canvas, gl)
    } catch {
      return null
    }
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ) {
    this.gl = gl
    this.initializeResources()
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost as EventListener)
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored as EventListener)
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.contextLost = true
    this.program = null
    this.buffer = null
    this.vao = null
    this.texture = null
    this.uniforms = null
  }

  private readonly handleContextRestored = () => {
    if (this.disposed) return
    this.contextLost = false
    this.uploadedSource = null
    this.uploadedIdentity = ''
    try {
      this.initializeResources()
    } catch {
      this.contextLost = true
    }
  }

  setPlan(plan: CanvasFracturesPlan): void {
    if (this.disposed || this.plan?.id === plan.id) return
    this.plan = plan
    this.orderedFragments = [...plan.fragments].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
  }

  get planIdentity(): string | null {
    return this.plan?.id ?? null
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (this.disposed) return
    this.cssWidth = Math.max(1, Math.round(cssWidth))
    this.cssHeight = Math.max(1, Math.round(cssHeight))
    this.dpr = Math.min(2, Math.max(1, dpr || 1))
    const pixelWidth = Math.max(1, Math.round(this.cssWidth * this.dpr))
    const pixelHeight = Math.max(1, Math.round(this.cssHeight * this.dpr))
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth
      this.canvas.height = pixelHeight
    }
  }

  render(params: CanvasFracturesRenderParams): boolean {
    if (this.disposed || this.contextLost || !this.plan || !this.program || !this.buffer || !this.vao || !this.texture || !this.uniforms) return false
    if (!isCanvasFracturesSourceReady(params.source)) return false
    const source = params.source
    const dimensions = sourceSize(source)
    if (!this.uploadSource(source, dimensions.width, dimensions.height)) return false

    const gl = this.gl
    const fitRect = resolveCanvasFracturesFitRect({
      outputWidth: this.cssWidth,
      outputHeight: this.cssHeight,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      fitMode: params.fitMode,
    })
    const sampled = params.effects.colorSourceMode === 'imageSampled'
      ? this.paletteCache.sample(source, this.plan.sourceIdentity, this.plan.mediaRevision)
      : []
    const palette = resolveCanvasFracturesPalette({
      mode: params.effects.colorSourceMode,
      manualPrimary: params.effects.manualPrimaryColor,
      manualSupporting: params.effects.manualSupportingColor,
      brandKit: params.brandKit,
      sampled,
    })

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(this.uniforms.source, 0)
    gl.uniform2f(this.uniforms.texel, 1 / dimensions.width, 1 / dimensions.height)
    gl.uniform1f(this.uniforms.dpr, this.dpr)

    const outputOpacity = clamp01(params.outputOpacity ?? 1)
    if (this.plan.anchor.visible && this.plan.anchor.opacity > 0) {
      this.drawQuad({
        corners: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        crop: { x: 0, y: 0, width: 1, height: 1 },
        centerX: fitRect.x + fitRect.width * 0.5,
        centerY: fitRect.y + fitRect.height * 0.5,
        destinationWidth: fitRect.width,
        destinationHeight: fitRect.height,
        scaleX: this.plan.anchor.scale,
        scaleY: this.plan.anchor.scale,
        rotationDeg: 0,
        assignment: CLEAN_ASSIGNMENT,
        opacity: outputOpacity * this.plan.anchor.opacity,
        params,
        palette,
      })
    }

    for (const fragment of this.orderedFragments) {
      this.drawFragment(fragment, fitRect, outputOpacity, params, palette)
    }
    gl.bindVertexArray(null)
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost as EventListener)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored as EventListener)
    this.paletteCache.clear()
    if (!this.contextLost) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      if (this.buffer) this.gl.deleteBuffer(this.buffer)
      if (this.vao) this.gl.deleteVertexArray(this.vao)
      if (this.program) this.gl.deleteProgram(this.program)
      this.gl.clearColor(0, 0, 0, 0)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
    this.texture = null
    this.buffer = null
    this.vao = null
    this.program = null
    this.uniforms = null
    this.plan = null
    this.orderedFragments = []
  }

  private initializeResources(): void {
    const gl = this.gl
    const program = createProgram(gl)
    const buffer = gl.createBuffer()
    const vao = gl.createVertexArray()
    const texture = gl.createTexture()
    if (!buffer || !vao || !texture) throw new Error('Unable to allocate Fractures WebGL resources')

    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW)
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT
    const position = gl.getAttribLocation(program, 'aPosition')
    const uv = gl.getAttribLocation(program, 'aUv')
    const local = gl.getAttribLocation(program, 'aLocal')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(uv)
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.enableVertexAttribArray(local)
    gl.vertexAttribPointer(local, 2, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindVertexArray(null)

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

    this.program = program
    this.buffer = buffer
    this.vao = vao
    this.texture = texture
    this.uniforms = {
      source: gl.getUniformLocation(program, 'uSource'),
      texel: gl.getUniformLocation(program, 'uTexel'),
      dpr: gl.getUniformLocation(program, 'uDpr'),
      cropMin: gl.getUniformLocation(program, 'uCropMin'),
      cropMax: gl.getUniformLocation(program, 'uCropMax'),
      direction: gl.getUniformLocation(program, 'uDirection'),
      phase: gl.getUniformLocation(program, 'uPhase'),
      opacity: gl.getUniformLocation(program, 'uOpacity'),
      role: gl.getUniformLocation(program, 'uRole'),
      intensity: gl.getUniformLocation(program, 'uIntensity'),
      outlineThickness: gl.getUniformLocation(program, 'uOutlineThickness'),
      outlineIntensity: gl.getUniformLocation(program, 'uOutlineIntensity'),
      bloomIntensity: gl.getUniformLocation(program, 'uBloomIntensity'),
      rgbSplit: gl.getUniformLocation(program, 'uRgbSplit'),
      lumaThreshold: gl.getUniformLocation(program, 'uLumaThreshold'),
      lumaMode: gl.getUniformLocation(program, 'uLumaMode'),
      displacement: gl.getUniformLocation(program, 'uDisplacement'),
      pixelation: gl.getUniformLocation(program, 'uPixelation'),
      scanlines: gl.getUniformLocation(program, 'uScanlines'),
      noise: gl.getUniformLocation(program, 'uNoise'),
      quality: gl.getUniformLocation(program, 'uQuality'),
      primary: gl.getUniformLocation(program, 'uPrimary'),
      supporting: gl.getUniformLocation(program, 'uSupporting'),
      accent: gl.getUniformLocation(program, 'uAccent'),
    }
  }

  private uploadSource(source: HTMLVideoElement | HTMLImageElement, width: number, height: number): boolean {
    if (!this.texture || !this.plan) return false
    const identity = `${this.plan.sourceIdentity}|${this.plan.mediaRevision}|${width}x${height}`
    const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
    if (!isVideo && source === this.uploadedSource && identity === this.uploadedIdentity) return true
    try {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source)
      this.uploadedSource = source
      this.uploadedIdentity = identity
      return true
    } catch {
      return false
    }
  }

  private drawFragment(
    fragment: CanvasFractureFragment,
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
    params: CanvasFracturesRenderParams,
    palette: CanvasFracturesResolvedPalette,
  ): void {
    this.drawQuad({
      corners: fragment.localCorners,
      crop: fragment.crop,
      centerX: fitRect.x + fragment.currentTransform.centerX * fitRect.width,
      centerY: fitRect.y + fragment.currentTransform.centerY * fitRect.height,
      destinationWidth: Math.max(0.5, fitRect.width * fragment.crop.width),
      destinationHeight: Math.max(0.5, fitRect.height * fragment.crop.height),
      scaleX: fragment.currentTransform.scale * (fragment.mirrorX ? -1 : 1),
      scaleY: fragment.currentTransform.scale * (fragment.mirrorY ? -1 : 1),
      rotationDeg: fragment.currentTransform.rotationDeg,
      assignment: fragment.effectAssignment,
      opacity: outputOpacity * fragment.opacity,
      params,
      palette,
    })
  }

  private drawQuad(input: {
    corners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
    crop: { x: number; y: number; width: number; height: number }
    centerX: number
    centerY: number
    destinationWidth: number
    destinationHeight: number
    scaleX: number
    scaleY: number
    rotationDeg: number
    assignment: CanvasFractureEffectAssignment
    opacity: number
    params: CanvasFracturesRenderParams
    palette: CanvasFracturesResolvedPalette
  }): void {
    if (!this.buffer || !this.uniforms) return
    const order = [0, 1, 2, 0, 2, 3] as const
    const radians = input.rotationDeg * Math.PI / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    for (let vertex = 0; vertex < 6; vertex += 1) {
      const corner = input.corners[order[vertex]]
      let x = (corner.x - 0.5) * input.destinationWidth * input.scaleX
      let y = (corner.y - 0.5) * input.destinationHeight * input.scaleY
      const rotatedX = x * cos - y * sin
      const rotatedY = x * sin + y * cos
      x = input.centerX + rotatedX
      y = input.centerY + rotatedY
      const transformed = this.applySourceTransform(x, y, input.params)
      const offset = vertex * 6
      this.vertexData[offset] = transformed.x / this.cssWidth * 2 - 1
      this.vertexData[offset + 1] = 1 - transformed.y / this.cssHeight * 2
      this.vertexData[offset + 2] = input.crop.x + corner.x * input.crop.width
      this.vertexData[offset + 3] = input.crop.y + corner.y * input.crop.height
      this.vertexData[offset + 4] = corner.x
      this.vertexData[offset + 5] = corner.y
    }
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData)
    const packed = packCanvasFracturesEffectParams({
      assignment: input.assignment,
      settings: input.params.effects,
      palette: input.palette,
    })
    this.applyUniforms(packed, input.crop, input.opacity)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private applySourceTransform(x: number, y: number, params: CanvasFracturesRenderParams): { x: number; y: number } {
    const scale = Math.max(0.01, params.sourceTransform.scale)
    const radians = params.sourceTransform.rotation * Math.PI / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const localX = (x - this.cssWidth * 0.5) * scale
    const localY = (y - this.cssHeight * 0.5) * scale
    return {
      x: this.cssWidth * 0.5 + this.cssWidth * (params.sourceTransform.positionX / 100) + localX * cos - localY * sin,
      y: this.cssHeight * 0.5 + this.cssHeight * (params.sourceTransform.positionY / 100) + localX * sin + localY * cos,
    }
  }

  private applyUniforms(
    packed: CanvasFracturesPackedEffectParams,
    crop: { x: number; y: number; width: number; height: number },
    opacity: number,
  ): void {
    const gl = this.gl
    const uniforms = this.uniforms!
    gl.uniform2f(uniforms.cropMin, crop.x, crop.y)
    gl.uniform2f(uniforms.cropMax, crop.x + crop.width, crop.y + crop.height)
    gl.uniform2f(uniforms.direction, packed.directionX, packed.directionY)
    gl.uniform1f(uniforms.phase, packed.phase)
    gl.uniform1f(uniforms.opacity, clamp01(opacity))
    gl.uniform1i(uniforms.role, packed.role)
    gl.uniform1f(uniforms.intensity, packed.intensity)
    gl.uniform1f(uniforms.outlineThickness, packed.outlineThickness)
    gl.uniform1f(uniforms.outlineIntensity, packed.outlineIntensity)
    gl.uniform1f(uniforms.bloomIntensity, packed.bloomIntensity)
    gl.uniform1f(uniforms.rgbSplit, packed.rgbSplit)
    gl.uniform1f(uniforms.lumaThreshold, packed.lumaThreshold)
    gl.uniform1i(uniforms.lumaMode, packed.lumaMode)
    gl.uniform1f(uniforms.displacement, packed.displacement)
    gl.uniform1f(uniforms.pixelation, packed.pixelation)
    gl.uniform1f(uniforms.scanlines, packed.scanlines)
    gl.uniform1f(uniforms.noise, packed.noise)
    gl.uniform1i(uniforms.quality, packed.quality)
    gl.uniform3f(uniforms.primary, ...packed.primary)
    gl.uniform3f(uniforms.supporting, ...packed.supporting)
    gl.uniform3f(uniforms.accent, ...packed.accent)
  }
}
