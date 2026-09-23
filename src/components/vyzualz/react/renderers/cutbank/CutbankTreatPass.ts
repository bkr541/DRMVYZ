import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import type { CutbankPalettePlan } from './CutbankPalette'
import type { CutbankTreatmentPlan } from './CutbankTreatment'

const VERTEX_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

/**
 * CUTBANK treat pass. One fragment shader composes the print / analog / digital /
 * deformation vocabulary from the plan's strengths, then applies the palette.
 * Every uniform below is fed by CutbankTreatmentPlan / CutbankPalettePlan.
 */
export const CUTBANK_TREAT_FRAGMENT_SRC = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uScene;
uniform sampler2D uHistory;
uniform vec2 uRes;
uniform float uTime;
uniform float uSeed;

uniform int uPaletteMode;
uniform float uSourceAmt;
uniform float uSat;
uniform float uContrast;
uniform float uExposure;
uniform float uBlack;
uniform float uWhite;
uniform vec3 uTint;
uniform float uTintAmt;
uniform vec3 uAccent1;
uniform vec3 uAccent2;
uniform float uColorize;
uniform float uInvert;

uniform float uThreshold;
uniform float uThresholdLevel;
uniform int uThresholdStyle;
uniform float uPosterize;
uniform float uGrain;
uniform float uScan;
uniform float uLens;
uniform float uSignal;
uniform float uJitter;
uniform float uRoll;
uniform float uRgb;
uniform float uDistort;
uniform float uRipple;
uniform float uSmear;
uniform float uSmearAngle;
uniform float uFeedback;
uniform float uFlashWhite;
uniform float uFlashBlack;
uniform float uExposureBurn;
uniform float uHasHistory;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float lumaOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 paletteMap(vec3 rgb) {
  float l = lumaOf(rgb);
  vec3 base = (uPaletteMode == 1) ? vec3(l) : mix(vec3(l), rgb, uSourceAmt);
  if (uPaletteMode == 2) {
    vec3 duo = mix(uAccent2 * 0.35, mix(uAccent2, uAccent1, smoothstep(0.25, 0.85, l)), smoothstep(0.0, 0.2, l));
    base = mix(base, duo, uColorize);
  }
  float bl = lumaOf(base);
  base = mix(vec3(bl), base, uSat);
  vec3 tinted = mix(vec3(0.0), uTint, clamp(lumaOf(base) * 1.15, 0.0, 1.0));
  base = mix(base, tinted, uTintAmt);
  return base;
}

float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int idx = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[idx]) + 0.5) / 16.0;
}

vec3 sampleScene(vec2 uv) { return texture(uScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }

vec3 sampleSmear(vec2 uv) {
  if (uSmear < 0.002) return sampleScene(uv);
  vec2 dir = vec2(cos(uSmearAngle), sin(uSmearAngle)) * uSmear * 0.16;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    float t = float(i) / 7.0;
    float w = 1.0 - t * 0.7;
    acc += sampleScene(uv - dir * t) * w;
    wsum += w;
  }
  return acc / wsum;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  vec2 c = uv - 0.5;
  float aspect = uRes.x / max(uRes.y, 1.0);

  // Lens warp: barrel bend with a CRT-style edge falloff.
  float edge = 1.0;
  if (uLens > 0.002) {
    float r2 = dot(c * vec2(aspect, 1.0), c * vec2(aspect, 1.0));
    uv = 0.5 + c * (1.0 + uLens * 0.55 * r2 * 2.2) * (1.0 - uLens * 0.12);
    vec2 d = abs(uv - 0.5);
    edge = 1.0 - smoothstep(0.46, 0.5 + 0.02, max(d.x, d.y)) * uLens;
    edge *= 1.0 - dot(c, c) * uLens * 0.9;
  }

  // Deformation: displacement waves + shockwave ripple.
  if (uDistort > 0.002) {
    uv += vec2(sin(uv.y * 22.0 + t * 3.1 + uSeed), cos(uv.x * 17.0 + t * 2.3)) * 0.014 * uDistort;
    uv.y += sin(uv.x * 6.0 + t * 1.4) * 0.03 * uDistort * uDistort;
  }
  if (uRipple > 0.002) {
    vec2 rc = uv - 0.5;
    float d = length(rc * vec2(aspect, 1.0));
    uv += normalize(rc + 1e-5) * sin(d * 46.0 - t * 14.0) * exp(-d * 3.2) * 0.022 * uRipple;
  }

  // Digital: frame jitter, row tearing, vertical roll.
  if (uJitter > 0.002) {
    float tick = floor(t * 24.0);
    uv.x += (hash11(tick + uSeed) - 0.5) * 0.02 * uJitter;
    uv.y += (hash11(tick * 1.7 + 3.0 + uSeed) - 0.5) * 0.008 * uJitter;
  }
  if (uSignal > 0.002) {
    float rows = mix(28.0, 110.0, hash11(floor(t * 6.0) + uSeed));
    float rowId = floor(uv.y * rows);
    float rnd = hash21(vec2(rowId, floor(t * 14.0) + uSeed));
    float gate = step(1.0 - 0.06 - uSignal * 0.34, rnd);
    uv.x += (hash21(vec2(rowId, 41.0 + floor(t * 9.0))) - 0.5) * 0.28 * uSignal * gate;
  }
  if (uRoll > 0.002) {
    float rollGate = step(0.72, hash11(floor(t * 5.0) + uSeed));
    uv.y = fract(uv.y + rollGate * uRoll * 0.4 * fract(t * 1.3));
  }

  // Scene sampling with smear and RGB split / chromatic drag.
  vec2 splitDir = vec2(0.006 + uSignal * 0.006, 0.0) * mix(1.0, 1.6, step(0.5, hash11(floor(t * 10.0))));
  vec2 rgbOff = splitDir * uRgb * 2.4 + vec2(cos(uSmearAngle), sin(uSmearAngle)) * uSmear * uRgb * 0.02;
  vec3 col;
  if (uRgb > 0.002) {
    col = vec3(sampleSmear(uv + rgbOff).r, sampleSmear(uv).g, sampleSmear(uv - rgbOff).b);
  } else {
    col = sampleSmear(uv);
  }
  float sourceLuma = lumaOf(col);

  // Grade: exposure → levels → contrast (before palette so thresholds see the graded image).
  col *= exp2(uExposure);
  col = (col - uBlack) / max(uWhite - uBlack, 0.05);
  col = (col - 0.5) * uContrast + 0.5;
  col = clamp(col, 0.0, 1.0);

  vec3 graded = paletteMap(col);

  // Print: threshold family (hard / halftone / dither / edge trace) + posterize.
  if (uThreshold > 0.002) {
    float l = lumaOf(col);
    float bw;
    if (uThresholdStyle == 1) {
      vec2 cell = fract(gl_FragCoord.xy / 7.0) - 0.5;
      float dotR = length(cell) * 1.45;
      bw = step(dotR, l * 1.15 + (uThresholdLevel - 0.5) * 0.8);
    } else if (uThresholdStyle == 2) {
      bw = step(bayer4(gl_FragCoord.xy), clamp(l + (uThresholdLevel - 0.5) * 0.7, 0.0, 1.0));
    } else if (uThresholdStyle == 3) {
      vec2 px = 1.6 / uRes;
      float gx = lumaOf(sampleScene(uv + vec2(px.x, 0.0))) - lumaOf(sampleScene(uv - vec2(px.x, 0.0)));
      float gy = lumaOf(sampleScene(uv + vec2(0.0, px.y))) - lumaOf(sampleScene(uv - vec2(0.0, px.y)));
      float e = smoothstep(0.08, 0.3, length(vec2(gx, gy)));
      bw = clamp(e + step(uThresholdLevel + 0.22, l) * 0.35, 0.0, 1.0);
    } else {
      bw = step(uThresholdLevel, l);
    }
    graded = mix(graded, paletteMap(vec3(bw)), uThreshold);
  }
  if (uPosterize > 0.002) {
    float levels = mix(16.0, 3.0, uPosterize);
    graded = floor(graded * levels + 0.5) / levels;
  }

  vec3 outRgb = mix(graded, 1.0 - graded, uInvert);

  // Analog: film grain and scanlines.
  if (uGrain > 0.002) {
    float n = hash21(gl_FragCoord.xy + floor(t * 60.0) * 17.0) - 0.5;
    outRgb += n * uGrain * 0.42;
  }
  if (uScan > 0.002) {
    outRgb *= 1.0 - uScan * 0.28 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  }
  outRgb *= edge;

  // Feedback trails (bounded: exactly one history texture).
  if (uFeedback > 0.002 && uHasHistory > 0.5) {
    vec2 huv = 0.5 + (vUv - 0.5) * 0.996;
    vec3 hist = texture(uHistory, huv).rgb;
    outRgb = mix(outRgb, max(outRgb, hist * 0.94), clamp(uFeedback, 0.0, 0.95));
  }

  // Exposure burn and flash frames.
  outRgb += uExposureBurn * 1.6;
  outRgb = mix(outRgb, vec3(1.0), uFlashWhite);
  outRgb = mix(outRgb, vec3(0.0), uFlashBlack);
  outColor = vec4(clamp(outRgb, 0.0, 1.0), 1.0);
}
`

const QUAD = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1])

export interface CutbankTreatUniforms {
  treatment: CutbankTreatmentPlan
  palette: CutbankPalettePlan
  timeSec: number
  seed: number
}

export class CutbankTreatPass {
  private readonly gl: WebGL2RenderingContext
  private program: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffer: WebGLBuffer | null = null
  private sceneTexture: WebGLTexture | null = null
  private historyTexture: WebGLTexture | null = null
  private width = 0
  private height = 0
  private historyValid = false
  private disposed = false

  static create(canvas: HTMLCanvasElement): { pass: CutbankTreatPass | null; error: string | null } {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    })
    if (!gl) return { pass: null, error: 'WebGL2 unavailable for CUTBANK' }
    const pass = new CutbankTreatPass(gl)
    try {
      pass.initialize()
      return { pass, error: null }
    } catch (error) {
      pass.dispose()
      return { pass: null, error: error instanceof Error ? error.message : 'CUTBANK WebGL initialization failed' }
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  private initialize(): void {
    const gl = this.gl
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'canvas-cutbank-treat',
      vertSrc: VERTEX_SRC,
      fragSrc: CUTBANK_TREAT_FRAGMENT_SRC,
      attributes: { aPosition: 0, aUv: 1 },
    })
    if (!compiled.program) throw new Error(`CUTBANK treat shader failed: ${compiled.error.log}`)
    this.program = compiled.program
    this.vao = gl.createVertexArray()
    this.buffer = gl.createBuffer()
    this.sceneTexture = gl.createTexture()
    this.historyTexture = gl.createTexture()
    if (!this.vao || !this.buffer || !this.sceneTexture || !this.historyTexture) throw new Error('CUTBANK could not allocate WebGL resources')
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    for (const tex of [this.sceneTexture, this.historyTexture]) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.historyTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.historyValid = false
  }

  /** Uploads the composed frame and draws the treated result to the canvas. */
  render(scene: HTMLCanvasElement, u: CutbankTreatUniforms): boolean {
    if (this.disposed || !this.program || !this.vao || !this.sceneTexture || !this.historyTexture) return false
    const gl = this.gl
    const p = this.program
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.historyTexture)

    const t = u.treatment
    const pal = u.palette
    p.activate()
    p.setSampler('uScene', 0)
    p.setSampler('uHistory', 1)
    p.setVec2('uRes', this.width, this.height)
    p.setFloat('uTime', u.timeSec)
    p.setFloat('uSeed', (u.seed % 997) / 97)
    p.setInt('uPaletteMode', pal.modeCode)
    p.setFloat('uSourceAmt', pal.sourceAmount)
    p.setFloat('uSat', pal.saturation)
    p.setFloat('uContrast', pal.contrast)
    p.setFloat('uExposure', pal.exposureStops)
    p.setFloat('uBlack', pal.blackPoint)
    p.setFloat('uWhite', pal.whitePoint)
    p.setVec3('uTint', pal.tint[0], pal.tint[1], pal.tint[2])
    p.setFloat('uTintAmt', pal.tintAmount)
    p.setVec3('uAccent1', pal.accent1[0], pal.accent1[1], pal.accent1[2])
    p.setVec3('uAccent2', pal.accent2[0], pal.accent2[1], pal.accent2[2])
    p.setFloat('uColorize', pal.colorize)
    p.setFloat('uInvert', pal.invert ? 1 : 0)
    p.setFloat('uThreshold', t.threshold)
    p.setFloat('uThresholdLevel', t.thresholdLevel)
    p.setInt('uThresholdStyle', t.thresholdStyle)
    p.setFloat('uPosterize', t.posterize)
    p.setFloat('uGrain', t.grain)
    p.setFloat('uScan', t.scanlines)
    p.setFloat('uLens', t.lens)
    p.setFloat('uSignal', t.signal)
    p.setFloat('uJitter', t.jitter)
    p.setFloat('uRoll', t.roll)
    p.setFloat('uRgb', t.rgb)
    p.setFloat('uDistort', t.distortion)
    p.setFloat('uRipple', t.ripple)
    p.setFloat('uSmear', t.smear)
    p.setFloat('uSmearAngle', t.smearAngle)
    p.setFloat('uFeedback', t.feedback)
    p.setFloat('uFlashWhite', t.flashWhite)
    p.setFloat('uFlashBlack', t.flashBlack)
    p.setFloat('uExposureBurn', t.exposureBurn)
    p.setFloat('uHasHistory', this.historyValid ? 1 : 0)

    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindVertexArray(null)

    // One bounded history texture, refreshed only while feedback is in use.
    if (t.feedback > 0.002) {
      gl.bindTexture(gl.TEXTURE_2D, this.historyTexture)
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.width, this.height)
      this.historyValid = true
    } else {
      this.historyValid = false
    }
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0)
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    if (this.sceneTexture) gl.deleteTexture(this.sceneTexture)
    if (this.historyTexture) gl.deleteTexture(this.historyTexture)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.vao) gl.deleteVertexArray(this.vao)
    this.program?.dispose()
    this.program = null
    this.sceneTexture = null
    this.historyTexture = null
    this.buffer = null
    this.vao = null
  }
}
