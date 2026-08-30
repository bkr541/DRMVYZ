import {
  CanvasFracturesImagePaletteCache,
  packCanvasFracturesEffectParams,
  resolveCanvasFracturesEffectMacros,
  resolveCanvasFracturesFragmentEffects,
  resolveCanvasFracturesPalette,
  resolveCanvasFracturesTrailBufferSize,
  resolveCanvasFracturesUvTransform,
  type CanvasFracturesPackedEffectParams,
} from './CanvasFracturesEffects'
import {
  isCanvasFracturesSourceReady,
  resolveCanvasFracturesFitRect,
} from './CanvasFracturesTransforms'
import {
  modulateCanvasFracturesFragmentTransform,
  protectCanvasFracturesFragmentEffects,
} from './CanvasFracturesAudio'
import { selectCanvasFracturesStableSubset } from './CanvasFracturesAdaptiveQuality'
import type {
  CanvasFractureBlendMode,
  CanvasFractureEffectAssignment,
  CanvasFractureFragment,
  CanvasFracturePoint,
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
  CanvasFracturesResolvedEffectSettings,
  CanvasFracturesResolvedFragmentEffects,
  CanvasFracturesResolvedPalette,
  CanvasFracturesSourceElement,
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
uniform int uPassMode;
uniform int uShadowOnly;
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
uniform float uPosterization;
uniform float uPosterizeLevels;
uniform float uHueShift;
uniform float uDuotone;
uniform float uFlash;
uniform float uBlur;
uniform float uSharpen;
uniform float uDissolve;
uniform float uShadowBlur;
uniform int uQuality;
uniform vec3 uPrimary;
uniform vec3 uSupporting;
uniform vec3 uAccent;
uniform vec3 uShadowColor;

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 value) {
  value = fract(value * vec2(123.34, 456.21));
  value += dot(value, value + 45.32 + uPhase * 17.0);
  return fract(value.x * value.y);
}

vec2 safeUv(vec2 uv) {
  vec2 edge = min(uTexel * 0.55, max(vec2(0.0), (uCropMax - uCropMin) * 0.25));
  return clamp(uv, uCropMin + edge, uCropMax - edge);
}

vec4 sampleSource(vec2 uv) {
  return texture(uSource, safeUv(uv));
}

vec4 filteredSource(vec2 uv) {
  vec4 center = sampleSource(uv);
  if (uBlur <= 0.0001 && uSharpen <= 0.0001) return center;
  float qualityRadius = uQuality == 0 ? 0.75 : (uQuality == 2 ? 1.35 : 1.0);
  vec2 px = uTexel * (1.0 + uBlur * 5.0) * qualityRadius;
  vec4 neighborhood = (
    sampleSource(uv + vec2(px.x, 0.0))
    + sampleSource(uv - vec2(px.x, 0.0))
    + sampleSource(uv + vec2(0.0, px.y))
    + sampleSource(uv - vec2(0.0, px.y))
  ) * 0.25;
  vec4 blurred = mix(center, neighborhood, clamp(uBlur, 0.0, 1.0) * 0.82);
  vec3 sharpened = clamp(center.rgb + (center.rgb - neighborhood.rgb) * uSharpen * 1.8, 0.0, 1.0);
  return vec4(mix(blurred.rgb, sharpened, clamp(uSharpen, 0.0, 1.0)), mix(center.a, blurred.a, clamp(uBlur, 0.0, 1.0)));
}

vec3 rotateHue(vec3 color, float amount) {
  float angle = amount * 6.28318530718;
  float c = cos(angle);
  float s = sin(angle);
  mat3 matrix = mat3(
    0.213 + c * 0.787 - s * 0.213,
    0.213 - c * 0.213 + s * 0.143,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 - s * 0.715,
    0.715 + c * 0.285 + s * 0.140,
    0.715 - c * 0.715 + s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.072 - c * 0.072 - s * 0.283,
    0.072 + c * 0.928 + s * 0.072
  );
  return clamp(matrix * color, 0.0, 1.0);
}

vec4 extendedTreatment(vec4 color) {
  float levels = max(2.0, uPosterizeLevels);
  vec3 quantized = floor(color.rgb * (levels - 1.0) + 0.5) / (levels - 1.0);
  color.rgb = mix(color.rgb, quantized, clamp(uPosterization, 0.0, 1.0));
  color.rgb = rotateHue(color.rgb, uHueShift);
  float luma = luminance(color.rgb);
  vec3 duo = mix(uPrimary, uSupporting, luma);
  color.rgb = mix(color.rgb, duo, clamp(uDuotone, 0.0, 1.0));
  if (uDissolve > 0.0001) {
    float grid = uQuality == 0 ? 72.0 : (uQuality == 2 ? 180.0 : 120.0);
    float pattern = hash21(floor(vLocal * grid) + vec2(uPhase * 37.0, uPhase * 19.0));
    float mask = smoothstep(uDissolve - 0.08, uDissolve + 0.08, pattern);
    color.a *= mask;
  }
  float flash = clamp(uFlash, 0.0, 0.52);
  color.rgb = mix(color.rgb, vec3(1.0), flash);
  return color;
}

float edgeSignal(vec2 uv, float radius) {
  vec4 center = filteredSource(uv);
  float centreSignal = max(center.a, luminance(center.rgb) * center.a);
  vec2 px = uTexel * radius;
  vec4 left = filteredSource(uv - vec2(px.x, 0.0));
  vec4 right = filteredSource(uv + vec2(px.x, 0.0));
  vec4 up = filteredSource(uv - vec2(0.0, px.y));
  vec4 down = filteredSource(uv + vec2(0.0, px.y));
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
  vec4 sum = filteredSource(uv) * 0.24;
  sum += filteredSource(uv + uDirection * px) * 0.12;
  sum += filteredSource(uv - uDirection * px) * 0.12;
  sum += filteredSource(uv + perpendicular * px) * 0.12;
  sum += filteredSource(uv - perpendicular * px) * 0.12;
  sum += filteredSource(uv + (uDirection + perpendicular) * px * 0.7) * 0.07;
  sum += filteredSource(uv - (uDirection + perpendicular) * px * 0.7) * 0.07;
  sum += filteredSource(uv + (uDirection - perpendicular) * px * 0.7) * 0.07;
  sum += filteredSource(uv - (uDirection - perpendicular) * px * 0.7) * 0.07;
  return sum;
}

void main() {
  if (uPassMode == 1) {
    vec4 history = texture(uSource, clamp(vUv, vec2(0.0), vec2(1.0)));
    outColor = vec4(history.rgb, history.a * uOpacity);
    return;
  }

  if (uShadowOnly == 1) {
    float radius = 1.0 + uShadowBlur * 0.35;
    vec2 px = uTexel * radius;
    float alpha = filteredSource(vUv).a * 0.36;
    alpha += filteredSource(vUv + vec2(px.x, 0.0)).a * 0.16;
    alpha += filteredSource(vUv - vec2(px.x, 0.0)).a * 0.16;
    alpha += filteredSource(vUv + vec2(0.0, px.y)).a * 0.16;
    alpha += filteredSource(vUv - vec2(0.0, px.y)).a * 0.16;
    outColor = vec4(uShadowColor, clamp(alpha, 0.0, 1.0) * uOpacity);
    return;
  }

  vec4 source = filteredSource(vUv);
  float intensity = clamp(uIntensity, 0.0, 1.0);
  vec4 result = source;

  if (uRole == 1) {
    float edge = edgeSignal(vUv, 1.0 + uOutlineThickness * 6.0) * uOutlineIntensity;
    vec3 outlined = source.rgb + uPrimary * edge * (0.8 + uOutlineIntensity * 1.4);
    result = vec4(outlined, max(source.a, edge));
  } else if (uRole == 2) {
    float amount = uBloomIntensity;
    vec4 blurred = bloomColor(vUv, amount);
    float alphaHalo = max(0.0, blurred.a - source.a);
    float emissive = max(luminance(blurred.rgb), alphaHalo * 0.75) * amount;
    vec3 bloom = uSupporting * emissive * (0.8 + amount * 1.6);
    result = vec4(source.rgb + bloom, max(source.a, emissive * 0.75));
  } else if (uRole == 3) {
    float amount = uRgbSplit;
    vec2 shift = uDirection * uTexel * (1.0 + amount * 22.0);
    float band = floor(vLocal.y * 13.0 + uPhase * 7.0);
    float bandSign = hash21(vec2(band, uPhase)) > 0.5 ? 1.0 : -1.0;
    vec2 sliceShift = vec2(shift.x * bandSign * amount * 1.7, shift.y * bandSign * amount * 0.35);
    vec4 redSample = filteredSource(vUv + shift + sliceShift);
    vec4 greenSample = filteredSource(vUv);
    vec4 blueSample = filteredSource(vUv - shift + sliceShift);
    vec3 split = vec3(redSample.r, greenSample.g, blueSample.b);
    float alpha = max(redSample.a, max(greenSample.a, blueSample.a));
    result = vec4(mix(source.rgb, split, amount), alpha);
  } else if (uRole == 4) {
    float luma = luminance(source.rgb);
    float softness = 0.04 + (1.0 - intensity) * 0.08;
    float mask = 0.0;
    if (uLumaMode == 1) mask = 1.0 - smoothstep(uLumaThreshold - softness, uLumaThreshold + softness, luma);
    else if (uLumaMode == 2) mask = 1.0 - smoothstep(softness, softness * 3.0, abs(luma - uLumaThreshold));
    else mask = smoothstep(uLumaThreshold - softness, uLumaThreshold + softness, luma);
    vec3 isolated = mix(source.rgb, uAccent * (0.45 + luma), intensity * 0.45);
    result = vec4(isolated, source.a * mask);
  } else if (uRole == 5) {
    float amount = uDisplacement;
    float slices = uQuality == 0 ? 7.0 : (uQuality == 2 ? 17.0 : 11.0);
    float band = floor((abs(uDirection.x) >= abs(uDirection.y) ? vLocal.y : vLocal.x) * slices + uPhase * 5.0);
    float signValue = hash21(vec2(band, uPhase)) > 0.5 ? 1.0 : -1.0;
    vec2 axis = abs(uDirection.x) >= abs(uDirection.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 displacedUv = vUv + axis * uTexel * signValue * (2.0 + amount * 28.0);
    result = filteredSource(displacedUv);
  } else if (uRole == 6) {
    float qualityScale = uQuality == 0 ? 0.65 : (uQuality == 2 ? 1.35 : 1.0);
    float blockCount = mix(180.0 * qualityScale, 10.0, uPixelation);
    vec2 cropSize = max(uCropMax - uCropMin, uTexel * 2.0);
    vec2 pixelLocal = (floor(vLocal * blockCount) + 0.5) / blockCount;
    vec2 pixelUv = uCropMin + pixelLocal * cropSize;
    vec4 textured = filteredSource(pixelUv);
    float spacing = mix(11.0, 3.0, uScanlines);
    float scan = step(0.55, fract((gl_FragCoord.y / max(1.0, uDpr) + uPhase * spacing * 9.0) / spacing));
    textured.rgb = mix(textured.rgb, textured.rgb * 0.42 + uSupporting * 0.14, scan * uScanlines * 0.35);
    float noise = hash21(floor(vLocal * vec2(240.0, 135.0)) + uPhase * 31.0) - 0.5;
    textured.rgb += uAccent * noise * uNoise * 0.28;
    result = textured;
  }

  result = extendedTreatment(result);
  outColor = vec4(result.rgb, result.a * uOpacity);
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
  passMode: WebGLUniformLocation | null
  shadowOnly: WebGLUniformLocation | null
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
  posterization: WebGLUniformLocation | null
  posterizeLevels: WebGLUniformLocation | null
  hueShift: WebGLUniformLocation | null
  duotone: WebGLUniformLocation | null
  flash: WebGLUniformLocation | null
  blur: WebGLUniformLocation | null
  sharpen: WebGLUniformLocation | null
  dissolve: WebGLUniformLocation | null
  shadowBlur: WebGLUniformLocation | null
  quality: WebGLUniformLocation | null
  primary: WebGLUniformLocation | null
  supporting: WebGLUniformLocation | null
  accent: WebGLUniformLocation | null
  shadowColor: WebGLUniformLocation | null
}

const CLEAN_ASSIGNMENT: CanvasFractureEffectAssignment = {
  role: 'clean',
  seed: 0,
  directionX: 1,
  directionY: 0,
  phase: 0,
  modifiers: 0,
  blendMode: 'normal',
}

const CLEAN_FRAGMENT_EFFECTS: CanvasFracturesResolvedFragmentEffects = {
  blendMode: 'normal',
  posterization: 0,
  posterizeLevels: 16,
  hueShift: 0,
  duotone: 0,
  shadow: 0,
  shadowOffsetPx: 0,
  shadowBlurPx: 0,
  duplicateCount: 0,
  copyOpacity: 0,
  copyOffsetPx: 0,
  flash: 0,
  blur: 0,
  sharpen: 0,
  dissolve: 0,
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

function sourceSize(source: CanvasFracturesSourceElement): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth), height: Math.max(1, source.videoHeight) }
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return { width: Math.max(1, source.width), height: Math.max(1, source.height) }
  }
  const image = source as HTMLImageElement
  return { width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export function applyCanvasFracturesWebGLBlendMode(
  gl: WebGL2RenderingContext,
  mode: CanvasFractureBlendMode,
): void {
  const equationSeparate = gl.blendEquationSeparate?.bind(gl)
  const funcSeparate = gl.blendFuncSeparate?.bind(gl)
  const one = gl.ONE
  const oneMinusSrcColor = gl.ONE_MINUS_SRC_COLOR
  const oneMinusDstColor = gl.ONE_MINUS_DST_COLOR
  if (mode === 'additive') {
    equationSeparate ? equationSeparate(gl.FUNC_ADD, gl.FUNC_ADD) : gl.blendEquation(gl.FUNC_ADD)
    funcSeparate ? funcSeparate(gl.SRC_ALPHA, one, one, gl.ONE_MINUS_SRC_ALPHA) : gl.blendFunc(gl.SRC_ALPHA, one)
    return
  }
  if (mode === 'screen') {
    equationSeparate ? equationSeparate(gl.FUNC_ADD, gl.FUNC_ADD) : gl.blendEquation(gl.FUNC_ADD)
    funcSeparate
      ? funcSeparate(gl.SRC_ALPHA, oneMinusSrcColor, one, gl.ONE_MINUS_SRC_ALPHA)
      : gl.blendFunc(gl.SRC_ALPHA, oneMinusSrcColor)
    return
  }
  if (mode === 'difference') {
    equationSeparate
      ? equationSeparate(gl.FUNC_REVERSE_SUBTRACT, gl.FUNC_ADD)
      : gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT)
    funcSeparate ? funcSeparate(gl.SRC_ALPHA, one, one, gl.ONE_MINUS_SRC_ALPHA) : gl.blendFunc(gl.SRC_ALPHA, one)
    return
  }
  if (mode === 'exclusion') {
    equationSeparate ? equationSeparate(gl.FUNC_ADD, gl.FUNC_ADD) : gl.blendEquation(gl.FUNC_ADD)
    funcSeparate
      ? funcSeparate(oneMinusDstColor, oneMinusSrcColor, one, gl.ONE_MINUS_SRC_ALPHA)
      : gl.blendFunc(oneMinusDstColor, oneMinusSrcColor)
    return
  }
  equationSeparate ? equationSeparate(gl.FUNC_ADD, gl.FUNC_ADD) : gl.blendEquation(gl.FUNC_ADD)
  funcSeparate
    ? funcSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, one, gl.ONE_MINUS_SRC_ALPHA)
    : gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
}

export class CanvasFracturesWebGLRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly paletteCache = new CanvasFracturesImagePaletteCache()
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private vao: WebGLVertexArrayObject | null = null
  private texture: WebGLTexture | null = null
  private uniforms: Uniforms | null = null
  private historyTextures: [WebGLTexture | null, WebGLTexture | null] = [null, null]
  private historyFramebuffers: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null]
  private historyIndex = 0
  private historyWidth = 0
  private historyHeight = 0
  private historyValid = false
  private historyBudgetKey = ''
  private trailsPreviouslyEnabled = false
  private plan: CanvasFracturesPlan | null = null
  private orderedFragments: readonly CanvasFractureFragment[] = []
  private minDepth = 0
  private maxDepth = 1
  private lastFramePositionSec: number | null = null
  private cssWidth = 1
  private cssHeight = 1
  private dpr = 1
  private disposed = false
  private contextLost = false
  private restoreFailed = false
  private uploadedSource: CanvasImageSource | null = null
  private uploadedIdentity = ''
  private readonly vertexData = new Float32Array(36)
  private activeFragments: readonly CanvasFractureFragment[] = []

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
    this.restoreFailed = false
    this.program = null
    this.buffer = null
    this.vao = null
    this.texture = null
    this.uniforms = null
    this.historyTextures = [null, null]
    this.historyFramebuffers = [null, null]
    this.historyValid = false
    this.historyBudgetKey = ''
  }

  private readonly handleContextRestored = () => {
    if (this.disposed) return
    this.contextLost = false
    this.restoreFailed = false
    this.uploadedSource = null
    this.uploadedIdentity = ''
    this.historyWidth = 0
    this.historyHeight = 0
    this.historyValid = false
    this.historyBudgetKey = ''
    try {
      this.initializeResources()
    } catch {
      this.contextLost = true
      this.restoreFailed = true
    }
  }

  get health(): 'ready' | 'recovering' | 'failed' {
    if (this.restoreFailed) return 'failed'
    return this.contextLost ? 'recovering' : 'ready'
  }

  setPlan(plan: CanvasFracturesPlan): void {
    if (this.disposed || this.plan?.id === plan.id) return
    const invalidatesFeedback = Boolean(this.plan && (
      this.plan.sourceIdentity !== plan.sourceIdentity
      || this.plan.mediaRevision !== plan.mediaRevision
      || this.plan.topologyIdentity !== plan.topologyIdentity
    ))
    this.plan = plan
    this.orderedFragments = [...plan.fragments].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    this.minDepth = this.orderedFragments[0]?.depth ?? 0
    this.maxDepth = this.orderedFragments[this.orderedFragments.length - 1]?.depth ?? this.minDepth + 1
    if (invalidatesFeedback) this.invalidateFeedback()
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
      this.invalidateFeedback()
    }
  }

  render(params: CanvasFracturesRenderParams): boolean {
    if (this.disposed || this.contextLost || !this.plan || !this.program || !this.buffer || !this.vao || !this.texture || !this.uniforms) return false
    if (!isCanvasFracturesSourceReady(params.source)) return false
    const source = params.source
    const dimensions = sourceSize(source)
    const framePositionSec = typeof params.framePositionSec === 'number' && Number.isFinite(params.framePositionSec)
      ? Math.max(0, params.framePositionSec)
      : null
    if (framePositionSec !== null && this.lastFramePositionSec !== null) {
      const delta = framePositionSec - this.lastFramePositionSec
      if (delta < -0.05 || delta > 1) this.invalidateFeedback()
    }
    if (!this.uploadSource(source, dimensions.width, dimensions.height)) return false

    const resolved = resolveCanvasFracturesEffectMacros(params.effects)
    this.activeFragments = selectCanvasFracturesStableSubset(this.orderedFragments, params.effects.activeFragmentCap ?? this.orderedFragments.length)
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

    gl.enable(gl.BLEND)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(this.uniforms.source, 0)
    gl.uniform2f(this.uniforms.texel, 1 / dimensions.width, 1 / dimensions.height)
    gl.uniform1f(this.uniforms.dpr, this.dpr)

    const trailsEnabled = resolved.trailOpacity > 1e-4 && this.ensureHistoryResources(resolved)
    if (!trailsEnabled && this.trailsPreviouslyEnabled) this.invalidateFeedback()
    this.trailsPreviouslyEnabled = trailsEnabled

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (trailsEnabled && this.historyValid) {
      this.drawHistory(this.historyTextures[this.historyIndex], resolved.trailOpacity)
    }
    this.bindSourceTexture()
    this.renderScene(fitRect, clamp01(params.outputOpacity ?? 1), params, palette, resolved)

    if (trailsEnabled) {
      const nextIndex = this.historyIndex === 0 ? 1 : 0
      const framebuffer = this.historyFramebuffers[nextIndex]
      if (framebuffer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.viewport(0, 0, this.historyWidth, this.historyHeight)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        if (this.historyValid) this.drawHistory(this.historyTextures[this.historyIndex], resolved.trailPersistence)
        this.bindSourceTexture()
        this.renderScene(fitRect, clamp01(params.outputOpacity ?? 1), params, palette, resolved)
        this.historyIndex = nextIndex
        this.historyValid = true
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }

    applyCanvasFracturesWebGLBlendMode(gl, 'normal')
    gl.bindVertexArray(null)
    this.lastFramePositionSec = framePositionSec
    return true
  }

  invalidateFeedback(): void {
    this.historyValid = false
    this.lastFramePositionSec = null
    if (this.contextLost || this.disposed) return
    const gl = this.gl
    for (const framebuffer of this.historyFramebuffers) {
      if (!framebuffer) continue
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.viewport(0, 0, Math.max(1, this.historyWidth), Math.max(1, this.historyHeight))
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost as EventListener)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored as EventListener)
    this.paletteCache.clear()
    if (!this.contextLost) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      for (const texture of this.historyTextures) if (texture) this.gl.deleteTexture(texture)
      for (const framebuffer of this.historyFramebuffers) if (framebuffer) this.gl.deleteFramebuffer(framebuffer)
      if (this.buffer) this.gl.deleteBuffer(this.buffer)
      if (this.vao) this.gl.deleteVertexArray(this.vao)
      if (this.program) this.gl.deleteProgram(this.program)
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
      this.gl.clearColor(0, 0, 0, 0)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    }
    this.texture = null
    this.historyTextures = [null, null]
    this.historyFramebuffers = [null, null]
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
      passMode: gl.getUniformLocation(program, 'uPassMode'),
      shadowOnly: gl.getUniformLocation(program, 'uShadowOnly'),
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
      posterization: gl.getUniformLocation(program, 'uPosterization'),
      posterizeLevels: gl.getUniformLocation(program, 'uPosterizeLevels'),
      hueShift: gl.getUniformLocation(program, 'uHueShift'),
      duotone: gl.getUniformLocation(program, 'uDuotone'),
      flash: gl.getUniformLocation(program, 'uFlash'),
      blur: gl.getUniformLocation(program, 'uBlur'),
      sharpen: gl.getUniformLocation(program, 'uSharpen'),
      dissolve: gl.getUniformLocation(program, 'uDissolve'),
      shadowBlur: gl.getUniformLocation(program, 'uShadowBlur'),
      quality: gl.getUniformLocation(program, 'uQuality'),
      primary: gl.getUniformLocation(program, 'uPrimary'),
      supporting: gl.getUniformLocation(program, 'uSupporting'),
      accent: gl.getUniformLocation(program, 'uAccent'),
      shadowColor: gl.getUniformLocation(program, 'uShadowColor'),
    }
  }

  private ensureHistoryResources(resolved: CanvasFracturesResolvedEffectSettings): boolean {
    const desired = resolveCanvasFracturesTrailBufferSize({
      pixelWidth: this.canvas.width,
      pixelHeight: this.canvas.height,
      budget: resolved.budget,
    })
    const budgetKey = [
      resolved.quality,
      resolved.budget.trailScale,
      resolved.budget.trailMaxWidth,
      resolved.budget.trailMaxHeight,
    ].join('|')
    if (
      this.historyTextures[0]
      && this.historyTextures[1]
      && this.historyFramebuffers[0]
      && this.historyFramebuffers[1]
      && this.historyWidth === desired.width
      && this.historyHeight === desired.height
      && this.historyBudgetKey === budgetKey
    ) return true

    const gl = this.gl
    for (const texture of this.historyTextures) if (texture) gl.deleteTexture(texture)
    for (const framebuffer of this.historyFramebuffers) if (framebuffer) gl.deleteFramebuffer(framebuffer)
    this.historyTextures = [null, null]
    this.historyFramebuffers = [null, null]
    this.historyWidth = desired.width
    this.historyHeight = desired.height
    this.historyBudgetKey = budgetKey
    this.historyIndex = 0
    this.historyValid = false

    try {
      for (let index = 0; index < 2; index += 1) {
        const texture = gl.createTexture()
        const framebuffer = gl.createFramebuffer()
        if (!texture || !framebuffer) throw new Error('Unable to allocate Fractures feedback resources')
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, desired.width, desired.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
        if (typeof gl.checkFramebufferStatus === 'function' && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error('Incomplete Fractures feedback framebuffer')
        }
        this.historyTextures[index] = texture
        this.historyFramebuffers[index] = framebuffer
      }
      this.invalidateFeedback()
      return true
    } catch {
      for (const texture of this.historyTextures) if (texture) gl.deleteTexture(texture)
      for (const framebuffer of this.historyFramebuffers) if (framebuffer) gl.deleteFramebuffer(framebuffer)
      this.historyTextures = [null, null]
      this.historyFramebuffers = [null, null]
      this.historyWidth = 0
      this.historyHeight = 0
      this.historyBudgetKey = ''
      this.historyValid = false
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return false
    }
  }

  private uploadSource(source: CanvasFracturesSourceElement, width: number, height: number): boolean {
    if (!this.texture || !this.plan) return false
    const identity = `${this.plan.sourceIdentity}|${this.plan.mediaRevision}|${width}x${height}`
    const isVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
    if (!isVideo && source === this.uploadedSource && identity === this.uploadedIdentity) return true
    if (identity !== this.uploadedIdentity) this.invalidateFeedback()
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

  private bindSourceTexture(): void {
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
  }

  private renderScene(
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
    params: CanvasFracturesRenderParams,
    palette: CanvasFracturesResolvedPalette,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    if (!this.plan) return
    if (this.plan.anchor.visible && this.plan.anchor.opacity > 0) {
      const vocalProtection = clamp01(params.audio?.vocalProtection ?? 0)
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
        scale: this.plan.anchor.scale * (1 + vocalProtection * 0.025),
        rotationDeg: 0,
        mirrorX: false,
        mirrorY: false,
        assignment: CLEAN_ASSIGNMENT,
        fragmentEffects: CLEAN_FRAGMENT_EFFECTS,
        resolved,
        opacity: outputOpacity * clamp01(this.plan.anchor.opacity + vocalProtection * 0.18),
        params,
        palette,
        shadowOnly: false,
        hueOffset: 0,
      })
    }

    this.activeFragments.forEach((fragment, ordinal) => {
      this.drawFragment(fragment, ordinal, fitRect, outputOpacity, params, palette, resolved)
    })
  }

  private drawFragment(
    fragment: CanvasFractureFragment,
    ordinal: number,
    fitRect: { x: number; y: number; width: number; height: number },
    outputOpacity: number,
    params: CanvasFracturesRenderParams,
    palette: CanvasFracturesResolvedPalette,
    resolved: CanvasFracturesResolvedEffectSettings,
  ): void {
    const effects = protectCanvasFracturesFragmentEffects({
      fragment,
      effects: resolveCanvasFracturesFragmentEffects({
        assignment: fragment.effectAssignment,
        settings: resolved,
        fragmentOrdinal: ordinal,
      }),
      audio: params.audio,
    })
    const depthSpan = Math.max(1, this.maxDepth - this.minDepth)
    const depthNorm = clamp01((fragment.depth - this.minDepth) / depthSpan)
    const depthBias = depthNorm - 0.5
    const baseCenterX = fitRect.x + fragment.currentTransform.centerX * fitRect.width
      + fragment.effectAssignment.directionX * resolved.parallaxPx * depthBias
    const baseCenterY = fitRect.y + fragment.currentTransform.centerY * fitRect.height
      + fragment.effectAssignment.directionY * resolved.parallaxPx * depthBias
    const baseScale = fragment.currentTransform.scale * (1 + depthBias * resolved.depthScale)
    const audioTransform = modulateCanvasFracturesFragmentTransform({
      fragment,
      centerX: baseCenterX,
      centerY: baseCenterY,
      scale: baseScale,
      fitWidth: fitRect.width,
      fitHeight: fitRect.height,
      framePositionSec: params.framePositionSec,
      audio: params.audio,
    })
    const baseOpacity = outputOpacity * fragment.opacity
    const common = {
      corners: fragment.localCorners,
      crop: fragment.crop,
      destinationWidth: Math.max(0.5, fitRect.width * fragment.crop.width),
      destinationHeight: Math.max(0.5, fitRect.height * fragment.crop.height),
      rotationDeg: fragment.currentTransform.rotationDeg,
      mirrorX: fragment.mirrorX,
      mirrorY: fragment.mirrorY,
      assignment: fragment.effectAssignment,
      resolved,
      params,
      palette,
    }

    if (effects.shadow > 1e-4) {
      this.drawQuad({
        ...common,
        centerX: audioTransform.centerX + fragment.effectAssignment.directionX * effects.shadowOffsetPx,
        centerY: audioTransform.centerY + fragment.effectAssignment.directionY * effects.shadowOffsetPx,
        scale: audioTransform.scale * (1 + effects.shadow * 0.02),
        fragmentEffects: effects,
        opacity: baseOpacity * resolved.shadowOpacity * effects.shadow,
        shadowOnly: true,
        hueOffset: 0,
      })
    }

    for (let copy = effects.duplicateCount; copy >= 1; copy -= 1) {
      const perpendicularX = -fragment.effectAssignment.directionY
      const perpendicularY = fragment.effectAssignment.directionX
      const distance = effects.copyOffsetPx * copy
      const side = (fragment.effectAssignment.seed + copy) % 2 === 0 ? 1 : -1
      this.drawQuad({
        ...common,
        centerX: audioTransform.centerX + fragment.effectAssignment.directionX * distance + perpendicularX * distance * 0.25 * side,
        centerY: audioTransform.centerY + fragment.effectAssignment.directionY * distance + perpendicularY * distance * 0.25 * side,
        scale: audioTransform.scale * Math.max(0.82, 1 - copy * 0.035),
        fragmentEffects: effects,
        opacity: baseOpacity * effects.copyOpacity / (1 + copy * 0.32),
        shadowOnly: false,
        hueOffset: side * copy * 0.045,
      })
    }

    this.drawQuad({
      ...common,
      centerX: audioTransform.centerX,
      centerY: audioTransform.centerY,
      scale: audioTransform.scale,
      fragmentEffects: effects,
      opacity: baseOpacity,
      shadowOnly: false,
      hueOffset: 0,
    })
  }

  private drawQuad(input: {
    corners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
    crop: { x: number; y: number; width: number; height: number }
    centerX: number
    centerY: number
    destinationWidth: number
    destinationHeight: number
    scale: number
    rotationDeg: number
    mirrorX: boolean
    mirrorY: boolean
    assignment: CanvasFractureEffectAssignment
    fragmentEffects: CanvasFracturesResolvedFragmentEffects
    resolved: CanvasFracturesResolvedEffectSettings
    opacity: number
    params: CanvasFracturesRenderParams
    palette: CanvasFracturesResolvedPalette
    shadowOnly: boolean
    hueOffset: number
  }): void {
    if (!this.buffer || !this.uniforms) return
    const order = [0, 1, 2, 0, 2, 3] as const
    const radians = input.rotationDeg * Math.PI / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    for (let vertex = 0; vertex < 6; vertex += 1) {
      const corner = input.corners[order[vertex]]
      let x = (corner.x - 0.5) * input.destinationWidth * input.scale
      let y = (corner.y - 0.5) * input.destinationHeight * input.scale
      const rotatedX = x * cos - y * sin
      const rotatedY = x * sin + y * cos
      x = input.centerX + rotatedX
      y = input.centerY + rotatedY
      const transformed = this.applySourceTransform(x, y, input.params)
      const uv = resolveCanvasFracturesUvTransform(corner.x, corner.y, input.mirrorX, input.mirrorY)
      const offset = vertex * 6
      this.vertexData[offset] = transformed.x / this.cssWidth * 2 - 1
      this.vertexData[offset + 1] = 1 - transformed.y / this.cssHeight * 2
      this.vertexData[offset + 2] = input.crop.x + uv.x * input.crop.width
      this.vertexData[offset + 3] = input.crop.y + uv.y * input.crop.height
      this.vertexData[offset + 4] = corner.x
      this.vertexData[offset + 5] = corner.y
    }
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData)
    const packed = packCanvasFracturesEffectParams({
      assignment: input.assignment,
      settings: input.resolved,
      fragmentEffects: {
        ...input.fragmentEffects,
        hueShift: input.fragmentEffects.hueShift + input.hueOffset,
      },
      palette: input.palette,
    })
    this.applyUniforms(packed, input.crop, input.opacity, input.shadowOnly, input.fragmentEffects.shadowBlurPx)
    applyCanvasFracturesWebGLBlendMode(gl, input.shadowOnly ? 'normal' : input.fragmentEffects.blendMode)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    applyCanvasFracturesWebGLBlendMode(gl, 'normal')
  }

  private drawHistory(texture: WebGLTexture | null, opacity: number): void {
    if (!texture || !this.buffer || !this.uniforms) return
    const positions = [
      -1, -1, 0, 0, 0, 0,
      1, -1, 1, 0, 1, 0,
      1, 1, 1, 1, 1, 1,
      -1, -1, 0, 0, 0, 0,
      1, 1, 1, 1, 1, 1,
      -1, 1, 0, 1, 0, 1,
    ]
    this.vertexData.set(positions)
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.uniforms.passMode, 1)
    gl.uniform1i(this.uniforms.shadowOnly, 0)
    gl.uniform1f(this.uniforms.opacity, clamp01(opacity))
    applyCanvasFracturesWebGLBlendMode(gl, 'normal')
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.uniform1i(this.uniforms.passMode, 0)
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
    shadowOnly: boolean,
    shadowBlurPx: number,
  ): void {
    const gl = this.gl
    const uniforms = this.uniforms!
    gl.uniform1i(uniforms.passMode, 0)
    gl.uniform1i(uniforms.shadowOnly, shadowOnly ? 1 : 0)
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
    gl.uniform1f(uniforms.posterization, packed.posterization)
    gl.uniform1f(uniforms.posterizeLevels, packed.posterizeLevels)
    gl.uniform1f(uniforms.hueShift, packed.hueShift)
    gl.uniform1f(uniforms.duotone, packed.duotone)
    gl.uniform1f(uniforms.flash, packed.flash)
    gl.uniform1f(uniforms.blur, packed.blur)
    gl.uniform1f(uniforms.sharpen, packed.sharpen)
    gl.uniform1f(uniforms.dissolve, packed.dissolve)
    gl.uniform1f(uniforms.shadowBlur, Math.max(0, shadowBlurPx))
    gl.uniform1i(uniforms.quality, packed.quality)
    gl.uniform3f(uniforms.primary, ...packed.primary)
    gl.uniform3f(uniforms.supporting, ...packed.supporting)
    gl.uniform3f(uniforms.accent, ...packed.accent)
    gl.uniform3f(
      uniforms.shadowColor,
      packed.primary[0] * 0.12 + packed.supporting[0] * 0.035,
      packed.primary[1] * 0.12 + packed.supporting[1] * 0.035,
      packed.primary[2] * 0.12 + packed.supporting[2] * 0.035,
    )
  }
}
