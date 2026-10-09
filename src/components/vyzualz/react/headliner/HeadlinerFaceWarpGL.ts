// The Face Warp renderer: a small WebGL pass that bends the camera picture inside an oval around the face
// and leaves everything outside it alone. It draws only a patch around the face (not the whole frame), at
// canvas resolution, so the rest of the picture stays exactly the live camera and the cost follows the size
// of the face. The 2D effect processor draws the finished patch over the live picture.

import type { HeadlinerFaceBox } from './HeadlinerFaceTracking'

export const HEADLINER_FACE_WARP_STYLES = ['bulge', 'pinch', 'twist', 'stretch', 'liquify', 'prism', 'wobble'] as const
export type HeadlinerFaceWarpStyle = typeof HEADLINER_FACE_WARP_STYLES[number]

export interface HeadlinerFaceWarpParams {
  style: HeadlinerFaceWarpStyle
  /** 0..1.5; 0 leaves the picture untouched. */
  amount: number
  timeSec: number
  /** Fraction of the oval's radius that fades from full warp to none. */
  softness: number
  tint: { mode: 'original' | 'tint' | 'gradient'; primary: readonly number[]; secondary: readonly number[]; amount: number }
}

export interface HeadlinerFaceWarpFrame {
  video: HTMLVideoElement
  sourceRect: { sx: number; sy: number; sw: number; sh: number }
  canvasWidth: number
  canvasHeight: number
  /** The face, in canvas pixels, already enlarged to the region to warp (radii are half the width/height). */
  face: HeadlinerFaceBox
  params: HeadlinerFaceWarpParams
}

export interface HeadlinerFaceWarpPatch {
  canvas: HTMLCanvasElement
  /** Top-left of the patch on the output canvas. */
  x: number
  y: number
}

/** What the processor needs from a renderer, so tests can substitute one. */
export interface HeadlinerFaceWarpRenderer {
  render(frame: HeadlinerFaceWarpFrame): HeadlinerFaceWarpPatch | null
  dispose(): void
}

const MAX_PATCH = 1280

/** The pixel rectangle that holds the rotated oval, with a small margin, clipped to the canvas. */
export function resolveFaceWarpPatchRect(
  face: HeadlinerFaceBox,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; width: number; height: number } | null {
  const rx = face.width / 2
  const ry = face.height / 2
  const cos = Math.cos(face.roll)
  const sin = Math.sin(face.roll)
  const halfX = Math.hypot(rx * cos, ry * sin) * 1.18 + 2
  const halfY = Math.hypot(rx * sin, ry * cos) * 1.18 + 2
  const x0 = Math.max(0, Math.floor(face.cx - halfX))
  const y0 = Math.max(0, Math.floor(face.cy - halfY))
  const x1 = Math.min(canvasWidth, Math.ceil(face.cx + halfX))
  const y1 = Math.min(canvasHeight, Math.ceil(face.cy + halfY))
  const width = Math.min(MAX_PATCH, x1 - x0)
  const height = Math.min(MAX_PATCH, y1 - y0)
  if (width < 2 || height < 2) return null
  return { x: x0, y: y0, width, height }
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uCanvas;
uniform vec2 uPatchOrigin;
uniform float uPatchHeight;
uniform vec4 uSource;
uniform vec2 uCenter;
uniform vec2 uRadii;
uniform float uRoll;
uniform float uMode;
uniform float uAmount;
uniform float uTime;
uniform float uSoft;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform float uTintAmount;
uniform float uTintMode;

vec3 sampleAt(vec2 faceQ, float c, float s) {
  vec2 d = vec2(c * faceQ.x - s * faceQ.y, s * faceQ.x + c * faceQ.y);
  vec2 p = uCenter + d;
  return texture2D(uVideo, uSource.xy + (p / uCanvas) * uSource.zw).rgb;
}

vec2 rotate2(vec2 v, float a) {
  float ca = cos(a);
  float sa = sin(a);
  return vec2(ca * v.x - sa * v.y, sa * v.x + ca * v.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uPatchHeight - gl_FragCoord.y) + uPatchOrigin;
  vec2 d = p - uCenter;
  float c = cos(uRoll);
  float s = sin(uRoll);
  vec2 q = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
  vec2 n = q / uRadii;
  float r = length(n);
  float w = 1.0 - smoothstep(1.0 - uSoft, 1.0, r);
  float a = uAmount;
  vec3 color;

  if (uMode < 0.5) {
    color = sampleAt(q * (1.0 - clamp(a * 0.55, 0.0, 0.9) * w), c, s);
  } else if (uMode < 1.5) {
    color = sampleAt(q * (1.0 + a * 0.75 * w), c, s);
  } else if (uMode < 2.5) {
    color = sampleAt(rotate2(q, a * 3.2 * w * w), c, s);
  } else if (uMode < 3.5) {
    color = sampleAt(vec2(q.x * (1.0 + a * 0.25 * w), q.y * (1.0 - clamp(a * 0.55, 0.0, 0.85) * w)), c, s);
  } else if (uMode < 4.5) {
    vec2 flow = vec2(
      sin(n.y * 5.0 + uTime * 1.7) + sin(n.x * 3.0 - uTime * 1.1),
      cos(n.x * 5.0 + uTime * 1.3) + cos(n.y * 4.0 + uTime * 0.9)
    );
    color = sampleAt(q + uRadii * flow * (a * 0.07 * w), c, s);
  } else if (uMode < 5.5) {
    float theta = atan(q.y, q.x);
    float seg = 6.2831853 / 6.0;
    float folded = abs(mod(theta + 3.1415926, seg) - seg * 0.5);
    vec2 facet = length(q) * vec2(cos(folded), sin(folded));
    vec2 base = mix(q, facet, clamp(a * 0.45, 0.0, 0.8) * w);
    float spread = a * 0.12 * w;
    color = vec3(
      sampleAt(base * (1.0 - spread), c, s).r,
      sampleAt(base, c, s).g,
      sampleAt(base * (1.0 + spread), c, s).b
    );
  } else {
    vec2 sway = vec2(sin(uTime * 3.0), cos(uTime * 2.3));
    color = sampleAt(q + uRadii * sway * (a * 0.22 * w), c, s);
  }

  if (uTintMode > 0.5) {
    float mixAcross = uTintMode > 1.5 ? clamp(0.5 + n.y * 0.5, 0.0, 1.0) : 0.0;
    vec3 tint = mix(uTintA, uTintB, mixAcross);
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, clamp(tint * (0.25 + luma * 1.35), 0.0, 1.0), uTintAmount * w);
  }

  float alpha = 1.0 - smoothstep(1.0, 1.14, r);
  gl_FragColor = vec4(color * alpha, alpha);
}
`

const STYLE_INDEX: Readonly<Record<HeadlinerFaceWarpStyle, number>> = {
  bulge: 0, pinch: 1, twist: 2, stretch: 3, liquify: 4, prism: 5, wobble: 6,
}

type UniformName =
  | 'uVideo' | 'uCanvas' | 'uPatchOrigin' | 'uPatchHeight' | 'uSource' | 'uCenter' | 'uRadii' | 'uRoll'
  | 'uMode' | 'uAmount' | 'uTime' | 'uSoft' | 'uTintA' | 'uTintB' | 'uTintAmount' | 'uTintMode'

export class FaceWarpGlRenderer implements HeadlinerFaceWarpRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly texture: WebGLTexture
  private readonly buffer: WebGLBuffer
  private readonly uniforms = new Map<UniformName, WebGLUniformLocation | null>()

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, buffer: WebGLBuffer) {
    this.canvas = canvas
    this.gl = gl
    this.program = program
    this.texture = texture
    this.buffer = buffer
  }

  /** Returns null where WebGL is unavailable, so the effect simply shows the live picture. */
  static create(): FaceWarpGlRenderer | null {
    if (typeof document === 'undefined') return null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 2
      const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }) as WebGLRenderingContext | null
      if (!gl || typeof gl.createShader !== 'function') return null
      const compile = (type: number, source: string): WebGLShader => {
        const shader = gl.createShader(type)
        if (!shader) throw new Error('shader allocation failed')
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed')
        return shader
      }
      const program = gl.createProgram()
      const texture = gl.createTexture()
      const buffer = gl.createBuffer()
      if (!program || !texture || !buffer) return null
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return new FaceWarpGlRenderer(canvas, gl, program, texture, buffer)
    } catch (error) {
      console.warn('[Headliner] Face Warp could not start WebGL:', error)
      return null
    }
  }

  private uniform(name: UniformName): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name))
    return this.uniforms.get(name) ?? null
  }

  render(frame: HeadlinerFaceWarpFrame): HeadlinerFaceWarpPatch | null {
    const { gl } = this
    const { video, face, params } = frame
    if (gl.isContextLost() || video.videoWidth <= 0 || video.videoHeight <= 0) return null
    const rect = resolveFaceWarpPatchRect(face, frame.canvasWidth, frame.canvasHeight)
    if (!rect) return null

    if (this.canvas.width !== rect.width || this.canvas.height !== rect.height) {
      this.canvas.width = rect.width
      this.canvas.height = rect.height
    }
    gl.viewport(0, 0, rect.width, rect.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
    } catch {
      return null
    }

    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const position = gl.getAttribLocation(this.program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const { sx, sy, sw, sh } = frame.sourceRect
    const tint = params.tint
    gl.uniform1i(this.uniform('uVideo'), 0)
    gl.uniform2f(this.uniform('uCanvas'), frame.canvasWidth, frame.canvasHeight)
    gl.uniform2f(this.uniform('uPatchOrigin'), rect.x, rect.y)
    gl.uniform1f(this.uniform('uPatchHeight'), rect.height)
    gl.uniform4f(this.uniform('uSource'), sx / video.videoWidth, sy / video.videoHeight, sw / video.videoWidth, sh / video.videoHeight)
    gl.uniform2f(this.uniform('uCenter'), face.cx, face.cy)
    gl.uniform2f(this.uniform('uRadii'), Math.max(1, face.width / 2), Math.max(1, face.height / 2))
    gl.uniform1f(this.uniform('uRoll'), face.roll)
    gl.uniform1f(this.uniform('uMode'), STYLE_INDEX[params.style] ?? 0)
    gl.uniform1f(this.uniform('uAmount'), params.amount)
    gl.uniform1f(this.uniform('uTime'), params.timeSec)
    gl.uniform1f(this.uniform('uSoft'), Math.min(0.95, Math.max(0.05, params.softness)))
    gl.uniform3f(this.uniform('uTintA'), tint.primary[0] / 255, tint.primary[1] / 255, tint.primary[2] / 255)
    gl.uniform3f(this.uniform('uTintB'), tint.secondary[0] / 255, tint.secondary[1] / 255, tint.secondary[2] / 255)
    gl.uniform1f(this.uniform('uTintAmount'), tint.amount)
    gl.uniform1f(this.uniform('uTintMode'), tint.mode === 'tint' ? 1 : tint.mode === 'gradient' ? 2 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    return { canvas: this.canvas, x: rect.x, y: rect.y }
  }

  dispose(): void {
    const { gl } = this
    if (!gl.isContextLost()) {
      gl.deleteTexture(this.texture)
      gl.deleteBuffer(this.buffer)
      gl.deleteProgram(this.program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    this.canvas.width = 0
    this.canvas.height = 0
  }
}
