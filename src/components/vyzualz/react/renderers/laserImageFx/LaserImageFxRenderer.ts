import type {
  CanvasFitMode,
  CanvasLaserColorEffect,
  CanvasLaserImageEffect,
  CanvasPresetSettings,
} from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'

export type LaserImageFxSourceElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

export type LaserImageFxAudioFrame = {
  bass: number
  mid: number
  high: number
  beat: number
  bpm: number
  absoluteBeat: number
}

export type LaserImageFxSourceTransform = {
  scale: number
  positionX: number
  positionY: number
  rotation: number
}

export type LaserImageFxRenderParams = {
  source: LaserImageFxSourceElement | null
  settings: CanvasPresetSettings
  fitMode: CanvasFitMode
  sourceTransform: LaserImageFxSourceTransform
  audio: LaserImageFxAudioFrame
  timeSec: number
}

export type LaserImageFxCreateResult = {
  renderer: LaserImageFxRenderer | null
  error: string | null
}

type RenderTarget = {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

const GRID_COLUMNS = 40
const GRID_ROWS = 24

const GEOMETRY_VERTEX_SRC = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
uniform int uImageEffect;
uniform vec2 uFitScale;
uniform vec2 uSourcePosition;
uniform float uSourceScale;
uniform float uSourceRotation;
uniform float uPhase;
uniform float uWarp;
uniform float uPerspective;
uniform float uIntensity;
uniform float uBass;
uniform float uBeat;

vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

void main() {
  vUv = aUv;
  vec3 p = vec3(aPosition * uFitScale, 0.0);
  float amount = clamp(uWarp * (0.68 + uIntensity * 0.46) + uBass * 0.12, 0.0, 1.4);

  if (uImageEffect == 1) {
    // Cube A: fold the outer thirds around two vertical hinges so the artwork
    // remains continuous while reading as a shallow, breathing cube wrap.
    float side = sign(aPosition.x);
    float fold = smoothstep(0.24, 1.0, abs(aPosition.x));
    float hinge = side * 0.24 * uFitScale.x;
    float localX = p.x - hinge;
    float angle = side * fold * (0.46 + amount * 0.92) * (0.82 + 0.18 * sin(uPhase));
    float c = cos(angle);
    float s = sin(angle);
    p.x = hinge + localX * c;
    p.z = -abs(localX) * abs(s);
    p = rotateX(p, sin(uPhase * 0.71) * 0.12 * amount);
  } else if (uImageEffect == 2) {
    // Flip B: reversible multi-axis perspective flip rather than a 2D scale.
    float angle = sin(uPhase) * (0.48 + amount * 1.05);
    p = rotateY(p, angle);
    p = rotateX(p, sin(uPhase * 0.63 + 0.7) * amount * 0.24);
  } else if (uImageEffect == 3) {
    // 3D Spin: rigid rotating artwork plane. At +/- 90deg its projected X
    // extent genuinely approaches a thin sliver.
    p = rotateY(p, uPhase);
    p = rotateX(p, sin(uPhase * 0.5) * (0.08 + amount * 0.18));
  } else if (uImageEffect == 4) {
    // Twist B: each horizontal slice receives a different Y-axis rotation.
    float twist = aPosition.y * (0.8 + amount * 2.25);
    float angle = sin(uPhase + twist * 0.52) * twist * 0.72;
    p = rotateY(p, angle);
    p.z += sin(aPosition.y * 3.14159265 + uPhase * 0.45) * amount * 0.08;
  }

  float zPerspective = clamp(p.z * uPerspective * 0.72, -0.68, 0.68);
  float perspectiveScale = 1.0 / (1.0 + zPerspective);
  p.xy *= perspectiveScale;

  float zr = uSourceRotation;
  float cz = cos(zr);
  float sz = sin(zr);
  p.xy = mat2(cz, -sz, sz, cz) * p.xy;
  p.xy *= max(0.01, uSourceScale);
  p.xy += uSourcePosition;

  // Beat impulse adds depth without breaking deterministic geometry.
  p.xy *= 1.0 + uBeat * uIntensity * 0.018;
  gl_Position = vec4(p.xy, 0.0, 1.0);
}
`

const GEOMETRY_FRAGMENT_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec2 uSourceResolution;
uniform int uImageEffect;
uniform int uColorEffect;
uniform float uPhase;
uniform float uWarp;
uniform float uIntensity;
uniform float uColorAmount;
uniform float uLaserize;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uBeat;

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec2 deformUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float amount = uWarp * (0.42 + uIntensity * 0.58) * (1.0 + uBass * 0.22);
  if (uImageEffect == 5) {
    // Rubber: continuous elastic breathing with no discontinuous glitch jumps.
    uv.x += sin(uv.y * 8.0 + uPhase * 1.17) * amount * 0.055;
    uv.y += sin(uv.x * 7.0 - uPhase * 0.91) * amount * 0.045;
  } else if (uImageEffect == 6) {
    // Stripe: neighboring bands offset in opposite directions while retaining
    // source continuity at low/medium amounts.
    float bands = 8.0 + floor(amount * 8.0);
    float band = floor(uv.y * bands);
    float direction = mod(band, 2.0) < 1.0 ? -1.0 : 1.0;
    uv.x += direction * sin(uPhase + band * 0.71) * amount * 0.075;
  } else if (uImageEffect == 8 || uImageEffect == 9) {
    float radius = uImageEffect == 8
      ? abs(p.x) + abs(p.y)
      : max(abs(p.x), abs(p.y));
    float contour = 0.34 - radius * 0.24 + sin(uPhase * 0.72 + radius * 5.0) * 0.055;
    float scale = max(0.62, 1.0 + contour * amount);
    p /= scale;
    uv = p * 0.5 + 0.5;
  }
  return uv;
}

vec3 colorTreatment(vec3 sourceColor, vec2 uv) {
  if (uColorEffect == 0) return sourceColor;
  vec3 hsv = rgb2hsv(sourceColor);
  if (uColorEffect == 1 || uColorEffect == 2) {
    float variant = uColorEffect == 1 ? 1.0 : -1.0;
    float envelope = pow(clamp(uBeat, 0.0, 1.0), 0.62);
    float spatial = (uv.x - 0.5) * variant * 0.075 * uColorAmount;
    hsv.x = fract(hsv.x + variant * (0.035 + envelope * 0.12) * uColorAmount + spatial);
    hsv.y = clamp(hsv.y * (1.0 + uColorAmount * (0.42 + envelope * (uColorEffect == 1 ? 1.25 : 0.82))), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + envelope * uColorAmount * 0.48 + uHigh * 0.08), 0.0, 2.2);
    return hsv2rgb(hsv);
  }

  float variantPhase = uColorEffect == 3 ? 0.0 : 2.17;
  float f1 = sin((uv.x * 3.1 + uv.y * 1.7) * 3.14159 + uPhase * 0.22 + variantPhase);
  float f2 = sin((uv.x * -1.9 + uv.y * 3.6) * 3.14159 - uPhase * 0.17 + variantPhase * 1.31);
  float field = 0.5 + 0.25 * f1 + 0.25 * f2;
  float hue = fract((uColorEffect == 3 ? 0.48 : 0.88) + field * (uColorEffect == 3 ? 0.22 : -0.27) + uPhase * 0.008);
  vec3 blob = hsv2rgb(vec3(hue, 0.78 + uHigh * 0.16, 1.0));
  return mix(sourceColor, sourceColor * blob * 1.65, clamp(uColorAmount * (0.72 + uMid * 0.28), 0.0, 1.0));
}

void main() {
  vec2 uv = deformUv(vUv);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    outColor = vec4(0.0);
    return;
  }

  vec4 source = texture(uSource, uv);
  float sourceLuma = luma(source.rgb);

  vec2 texel = 1.0 / max(uSourceResolution, vec2(1.0));
  vec4 leftSample = texture(uSource, uv - vec2(texel.x, 0.0));
  vec4 rightSample = texture(uSource, uv + vec2(texel.x, 0.0));
  vec4 downSample = texture(uSource, uv - vec2(0.0, texel.y));
  vec4 upSample = texture(uSource, uv + vec2(0.0, texel.y));
  float colorEdge = abs(luma(rightSample.rgb) - luma(leftSample.rgb)) + abs(luma(upSample.rgb) - luma(downSample.rgb));
  float alphaEdge = abs(rightSample.a - leftSample.a) + abs(upSample.a - downSample.a);
  float edge = smoothstep(0.035, 0.32, colorEdge + alphaEdge * 0.85);
  float brightMask = smoothstep(0.004, 0.055, max(max(source.r, source.g), source.b));
  // Preserve transparent/alpha-authored line art even when its stroke color is
  // black, while an opaque black raster background still contributes no mask.
  float alphaLineMask = smoothstep(0.02, 0.32, alphaEdge) * source.a;
  float sourceMask = source.a * max(brightMask, alphaLineMask);
  float laserMask = mix(sourceMask, source.a * edge, clamp(uLaserize, 0.0, 1.0));

  if (uImageEffect == 7) {
    vec2 centered = vUv * 2.0 - 1.0;
    float vignette = smoothstep(1.08, 0.28, length(centered * vec2(0.88, 1.0)));
    laserMask *= mix(1.0, vignette, clamp(uWarp, 0.0, 1.0));
  }

  if (laserMask <= 0.0005) {
    outColor = vec4(0.0);
    return;
  }

  vec3 treated = colorTreatment(source.rgb, uv);
  // White-hot laser core with source chroma retained around it.
  float hot = max(
    smoothstep(0.12, 0.92, sourceLuma + edge * uLaserize * 0.72),
    alphaLineMask * 0.72
  );
  vec3 core = mix(treated * (1.18 + uIntensity * 1.72), vec3(1.0) * (1.4 + uIntensity * 1.35), hot * (0.18 + uIntensity * 0.34));
  core *= 1.0 + uBeat * 0.34 + uBass * 0.12;
  float alpha = clamp(laserMask * (0.52 + uIntensity * 0.68), 0.0, 1.0);
  outColor = vec4(core * alpha, alpha);
}
`

const FULLSCREEN_VERTEX_SRC = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const BLUR_FRAGMENT_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uDirection;
uniform float uRadius;
void main() {
  vec2 stepUv = uTexel * uDirection * max(0.5, uRadius);
  vec4 sum = texture(uSource, vUv) * 0.20;
  sum += texture(uSource, vUv + stepUv * 1.0) * 0.16;
  sum += texture(uSource, vUv - stepUv * 1.0) * 0.16;
  sum += texture(uSource, vUv + stepUv * 2.2) * 0.12;
  sum += texture(uSource, vUv - stepUv * 2.2) * 0.12;
  sum += texture(uSource, vUv + stepUv * 4.6) * 0.075;
  sum += texture(uSource, vUv - stepUv * 4.6) * 0.075;
  sum += texture(uSource, vUv + stepUv * 8.2) * 0.045;
  sum += texture(uSource, vUv - stepUv * 8.2) * 0.045;
  outColor = sum;
}
`

const COMPOSITE_FRAGMENT_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uCore;
uniform sampler2D uBloom;
uniform float uBloomAmount;
uniform float uBeat;
void main() {
  vec4 core = texture(uCore, vUv);
  vec4 bloom = texture(uBloom, vUv);
  float bloomGain = uBloomAmount * (0.8 + uBeat * 0.42);
  vec3 rgb = core.rgb + bloom.rgb * bloomGain * 1.65;
  float alpha = clamp(max(core.a, bloom.a * bloomGain * 0.9), 0.0, 1.0);
  outColor = vec4(rgb, alpha);
}
`

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function laserImageEffectToUniform(effect: CanvasLaserImageEffect): number {
  switch (effect) {
    case 'cubeA': return 1
    case 'flipB': return 2
    case 'spin3d': return 3
    case 'twistB': return 4
    case 'rubber': return 5
    case 'stripe': return 6
    case 'vignette': return 7
    case 'warpDiamond': return 8
    case 'warpSquare': return 9
    default: return 0
  }
}

export function laserColorEffectToUniform(effect: CanvasLaserColorEffect): number {
  switch (effect) {
    case 'beatSaturateA': return 1
    case 'beatSaturateB': return 2
    case 'colorBlobsA': return 3
    case 'colorBlobsB': return 4
    default: return 0
  }
}

export function resolveLaserImageFxPhase(input: {
  timeSec: number
  bpmSync: boolean
  speed: number
  bpm: number
  absoluteBeat: number
}): number {
  const speed = Math.max(0, Math.min(4, Number.isFinite(input.speed) ? input.speed : 1))
  if (input.bpmSync && input.bpm > 0 && Number.isFinite(input.absoluteBeat)) {
    // One rotation cycle per four beats at speed 1.
    return input.absoluteBeat * speed * Math.PI * 0.5
  }
  return Math.max(0, Number.isFinite(input.timeSec) ? input.timeSec : 0) * speed * 0.9
}

export function resolveLaserImageFxFitScale(
  fitMode: CanvasFitMode,
  sourceAspect: number,
  canvasAspect: number,
): { x: number; y: number } {
  const safeSource = Math.max(0.001, sourceAspect)
  const safeCanvas = Math.max(0.001, canvasAspect)
  if (fitMode === 'stretch') return { x: 1, y: 1 }
  if (fitMode === 'contain') {
    return safeSource > safeCanvas
      ? { x: 1, y: safeCanvas / safeSource }
      : { x: safeSource / safeCanvas, y: 1 }
  }
  return safeSource > safeCanvas
    ? { x: safeSource / safeCanvas, y: 1 }
    : { x: 1, y: safeCanvas / safeSource }
}

function sourceReady(source: LaserImageFxSourceElement | null): source is LaserImageFxSourceElement {
  if (!source) return false
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return source.width > 0 && source.height > 0
  }
  const image = source as HTMLImageElement
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
}

function sourceSize(source: LaserImageFxSourceElement): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height }
  }
  const image = source as HTMLImageElement
  return { width: image.naturalWidth, height: image.naturalHeight }
}

function buildGrid(): { vertices: Float32Array; indices: Uint16Array } {
  const vertices = new Float32Array((GRID_COLUMNS + 1) * (GRID_ROWS + 1) * 4)
  let cursor = 0
  for (let y = 0; y <= GRID_ROWS; y += 1) {
    const v = y / GRID_ROWS
    for (let x = 0; x <= GRID_COLUMNS; x += 1) {
      const u = x / GRID_COLUMNS
      vertices[cursor++] = u * 2 - 1
      vertices[cursor++] = v * 2 - 1
      vertices[cursor++] = u
      vertices[cursor++] = v
    }
  }
  const indices = new Uint16Array(GRID_COLUMNS * GRID_ROWS * 6)
  cursor = 0
  const stride = GRID_COLUMNS + 1
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {
      const a = y * stride + x
      const b = a + 1
      const c = a + stride
      const d = c + 1
      indices[cursor++] = a
      indices[cursor++] = c
      indices[cursor++] = b
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }
  return { vertices, indices }
}

const FULLSCREEN_VERTICES = new Float32Array([
  -1, -1, 0, 0,
   1, -1, 1, 0,
  -1,  1, 0, 1,
   1,  1, 1, 1,
])

export class LaserImageFxRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private geometryProgram: ShaderProgram | null = null
  private blurProgram: ShaderProgram | null = null
  private compositeProgram: ShaderProgram | null = null
  private meshVao: WebGLVertexArrayObject | null = null
  private meshVertexBuffer: WebGLBuffer | null = null
  private meshIndexBuffer: WebGLBuffer | null = null
  private quadVao: WebGLVertexArrayObject | null = null
  private quadBuffer: WebGLBuffer | null = null
  private sourceTexture: WebGLTexture | null = null
  private coreTarget: RenderTarget | null = null
  private bloomTargetA: RenderTarget | null = null
  private bloomTargetB: RenderTarget | null = null
  private sourceWidth = 1
  private sourceHeight = 1
  private uploadedSource: LaserImageFxSourceElement | null = null
  private uploadedSourceTime = Number.NEGATIVE_INFINITY
  private width = 0
  private height = 0
  private indexCount = 0
  private disposed = false

  static create(canvas: HTMLCanvasElement): LaserImageFxCreateResult {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return { renderer: null, error: 'WebGL2 unavailable for CANVAS Laser Image FX' }

    const renderer = new LaserImageFxRenderer(canvas, gl)
    try {
      renderer.initialize()
      return { renderer, error: null }
    } catch (error) {
      renderer.dispose()
      return {
        renderer: null,
        error: error instanceof Error ? error.message : 'Laser Image FX WebGL initialization failed',
      }
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
  }

  private initialize(): void {
    const gl = this.gl
    const compiler = new ShaderCompiler(gl)
    const geometry = ShaderProgram.create(gl, compiler, {
      label: 'canvas-laser-image-fx-geometry',
      vertSrc: GEOMETRY_VERTEX_SRC,
      fragSrc: GEOMETRY_FRAGMENT_SRC,
      attributes: { aPosition: 0, aUv: 1 },
    })
    if (!geometry.program) throw new Error(`Laser Image FX geometry shader failed: ${geometry.error.log}`)
    this.geometryProgram = geometry.program

    const blur = ShaderProgram.create(gl, compiler, {
      label: 'canvas-laser-image-fx-blur',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: BLUR_FRAGMENT_SRC,
      attributes: { aPosition: 0, aUv: 1 },
    })
    if (!blur.program) throw new Error(`Laser Image FX bloom shader failed: ${blur.error.log}`)
    this.blurProgram = blur.program

    const composite = ShaderProgram.create(gl, compiler, {
      label: 'canvas-laser-image-fx-composite',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: COMPOSITE_FRAGMENT_SRC,
      attributes: { aPosition: 0, aUv: 1 },
    })
    if (!composite.program) throw new Error(`Laser Image FX composite shader failed: ${composite.error.log}`)
    this.compositeProgram = composite.program

    const grid = buildGrid()
    this.indexCount = grid.indices.length
    this.meshVao = gl.createVertexArray()
    this.meshVertexBuffer = gl.createBuffer()
    this.meshIndexBuffer = gl.createBuffer()
    this.quadVao = gl.createVertexArray()
    this.quadBuffer = gl.createBuffer()
    this.sourceTexture = gl.createTexture()
    if (!this.meshVao || !this.meshVertexBuffer || !this.meshIndexBuffer || !this.quadVao || !this.quadBuffer || !this.sourceTexture) {
      throw new Error('Laser Image FX could not allocate WebGL resources')
    }

    gl.bindVertexArray(this.meshVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, grid.vertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshIndexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW)

    gl.bindVertexArray(this.quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_VERTICES, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT)

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, Math.floor(width))
    const safeHeight = Math.max(1, Math.floor(height))
    if (this.width === safeWidth && this.height === safeHeight && this.coreTarget && this.bloomTargetA && this.bloomTargetB) return
    this.width = safeWidth
    this.height = safeHeight
    this.canvas.width = safeWidth
    this.canvas.height = safeHeight
    this.releaseTargets()
    this.coreTarget = this.createTarget(safeWidth, safeHeight)
    const bloomWidth = Math.max(1, Math.floor(safeWidth / 2))
    const bloomHeight = Math.max(1, Math.floor(safeHeight / 2))
    this.bloomTargetA = this.createTarget(bloomWidth, bloomHeight)
    this.bloomTargetB = this.createTarget(bloomWidth, bloomHeight)
  }

  render(params: LaserImageFxRenderParams): boolean {
    if (this.disposed || !this.geometryProgram || !this.blurProgram || !this.compositeProgram || !this.sourceTexture || !this.meshVao || !this.quadVao || !this.coreTarget || !this.bloomTargetA || !this.bloomTargetB) return false
    const gl = this.gl
    const { source, settings, fitMode, sourceTransform, audio, timeSec } = params
    if (!this.updateSourceTexture(source)) {
      this.clear()
      return false
    }

    const fit = resolveLaserImageFxFitScale(fitMode, this.sourceWidth / Math.max(1, this.sourceHeight), this.width / Math.max(1, this.height))
    const phase = resolveLaserImageFxPhase({
      timeSec,
      bpmSync: settings.laserBpmSync,
      speed: settings.laserSpeed,
      bpm: audio.bpm,
      absoluteBeat: audio.absoluteBeat,
    })

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.BLEND)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.coreTarget.framebuffer)
    gl.viewport(0, 0, this.coreTarget.width, this.coreTarget.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.geometryProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    this.geometryProgram.setSampler('uSource', 0)
    this.geometryProgram.setVec2('uSourceResolution', this.sourceWidth, this.sourceHeight)
    this.geometryProgram.setInt('uImageEffect', laserImageEffectToUniform(settings.laserImageEffect))
    this.geometryProgram.setInt('uColorEffect', laserColorEffectToUniform(settings.laserColorEffect))
    this.geometryProgram.setVec2('uFitScale', fit.x, fit.y)
    this.geometryProgram.setVec2('uSourcePosition', sourceTransform.positionX / 100, -sourceTransform.positionY / 100)
    this.geometryProgram.setFloat('uSourceScale', Math.max(0.01, sourceTransform.scale))
    this.geometryProgram.setFloat('uSourceRotation', -sourceTransform.rotation * Math.PI / 180)
    this.geometryProgram.setFloat('uPhase', phase)
    this.geometryProgram.setFloat('uWarp', settings.laserWarpAmount)
    this.geometryProgram.setFloat('uPerspective', settings.laserPerspective)
    this.geometryProgram.setFloat('uIntensity', settings.intensity)
    this.geometryProgram.setFloat('uColorAmount', settings.laserColorAmount)
    this.geometryProgram.setFloat('uLaserize', settings.laserize)
    this.geometryProgram.setFloat('uBass', clamp01(audio.bass))
    this.geometryProgram.setFloat('uMid', clamp01(audio.mid))
    this.geometryProgram.setFloat('uHigh', clamp01(audio.high))
    this.geometryProgram.setFloat('uBeat', clamp01(audio.beat))
    gl.bindVertexArray(this.meshVao)
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0)

    const blurRadius = 0.9 + settings.laserBloom * 2.8
    this.drawBlur(this.coreTarget.texture, this.bloomTargetA, 1, 0, blurRadius)
    this.drawBlur(this.bloomTargetA.texture, this.bloomTargetB, 0, 1, blurRadius)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.compositeProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.coreTarget.texture)
    this.compositeProgram.setSampler('uCore', 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTargetB.texture)
    this.compositeProgram.setSampler('uBloom', 1)
    this.compositeProgram.setFloat('uBloomAmount', settings.laserBloom)
    this.compositeProgram.setFloat('uBeat', clamp01(audio.beat))
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0)
    return true
  }

  clear(): void {
    if (this.disposed) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, Math.max(1, this.width), Math.max(1, this.height))
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    this.releaseTargets()
    if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
    if (this.meshVertexBuffer) gl.deleteBuffer(this.meshVertexBuffer)
    if (this.meshIndexBuffer) gl.deleteBuffer(this.meshIndexBuffer)
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer)
    if (this.meshVao) gl.deleteVertexArray(this.meshVao)
    if (this.quadVao) gl.deleteVertexArray(this.quadVao)
    this.geometryProgram?.dispose()
    this.blurProgram?.dispose()
    this.compositeProgram?.dispose()
    this.sourceTexture = null
    this.meshVertexBuffer = null
    this.meshIndexBuffer = null
    this.quadBuffer = null
    this.meshVao = null
    this.quadVao = null
    this.geometryProgram = null
    this.blurProgram = null
    this.compositeProgram = null
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
    gl.useProgram(null)
  }

  private updateSourceTexture(source: LaserImageFxSourceElement | null): boolean {
    if (!this.sourceTexture || !sourceReady(source)) return false
    const sourceIsVideo = typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement
    const sourceIsCanvas = typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement
    const sourceTime = sourceIsVideo ? source.currentTime : 0
    // Authored-layer mode feeds the live multi-layer composition through a stable
    // HTMLCanvasElement. Its identity does not change as its pixels change, so it
    // must be re-uploaded every frame instead of taking the static-image fast path.
    if (!sourceIsCanvas && this.uploadedSource === source && Math.abs(sourceTime - this.uploadedSourceTime) < 0.00001) return true
    const gl = this.gl
    const size = sourceSize(source)
    try {
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.sourceWidth = Math.max(1, size.width)
      this.sourceHeight = Math.max(1, size.height)
      this.uploadedSource = source
      this.uploadedSourceTime = sourceTime
      return true
    } catch {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
      return false
    }
  }

  private drawBlur(sourceTexture: WebGLTexture, target: RenderTarget, directionX: number, directionY: number, radius: number): void {
    if (!this.blurProgram || !this.quadVao) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.blurProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    this.blurProgram.setSampler('uSource', 0)
    this.blurProgram.setVec2('uTexel', 1 / target.width, 1 / target.height)
    this.blurProgram.setVec2('uDirection', directionX, directionY)
    this.blurProgram.setFloat('uRadius', radius)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private createTarget(width: number, height: number): RenderTarget {
    const gl = this.gl
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture)
      if (framebuffer) gl.deleteFramebuffer(framebuffer)
      throw new Error('Laser Image FX framebuffer allocation failed')
    }
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      throw new Error('Laser Image FX framebuffer is incomplete')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return { texture, framebuffer, width, height }
  }

  private releaseTargets(): void {
    const gl = this.gl
    for (const target of [this.coreTarget, this.bloomTargetA, this.bloomTargetB]) {
      if (!target) continue
      gl.deleteFramebuffer(target.framebuffer)
      gl.deleteTexture(target.texture)
    }
    this.coreTarget = null
    this.bloomTargetA = null
    this.bloomTargetB = null
  }
}
