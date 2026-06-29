import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLServices,
  CinematicWebGLWorldDefinition,
  CinematicWebGLWorldInitializeInput,
  CinematicWebGLWorldRenderer,
  CinematicWorldRenderTarget,
} from '../../CinematicWorldRenderer'
import { CINEMATIC_DIAGNOSTIC_WORLD_ID } from '../../CinematicWorldRenderer'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
uniform float uPulse;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vec2 p = aPosition * (0.72 + uPulse * 0.05);
  gl_Position = vec4(p, 0.0, 1.0);
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uSeed;
void main() {
  vec2 p = vUv - 0.5;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  p.x *= aspect;
  float radius = length(p);
  float spokes = 0.5 + 0.5 * cos(atan(p.y, p.x) * 8.0 + uTime * 0.8 + uSeed * 0.001);
  float ring = smoothstep(0.035, 0.0, abs(radius - (0.24 + uBass * 0.035)));
  float core = smoothstep(0.30, 0.02, radius);
  vec3 cyan = vec3(0.05, 0.95, 1.0);
  vec3 violet = vec3(0.55, 0.16, 1.0);
  vec3 color = mix(violet, cyan, spokes) * (core * 0.22 + ring * (1.2 + uBass));
  color += vec3(0.01, 0.02, 0.04);
  outColor = vec4(color, 1.0);
}
`

class DiagnosticCinematicWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private program: ShaderProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private viewport: CinematicViewport = { width: 1, height: 1, dpr: 1 }
  private resetPhase = 0

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    const { gl, resources } = input.services
    this.program = input.services.compileProgram({
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      label: 'cinematic/world/diagnostic',
      attributes: { aPosition: 0 },
    })

    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    if (!vao || !buffer) throw new Error('Diagnostic cinematic world could not allocate geometry')
    this.vao = resources.trackVAO(vao)
    resources.trackBuffer(buffer)

    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
  }

  resize(viewport: CinematicViewport): void {
    this.viewport = { ...viewport }
  }

  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (!this.services || !this.program || !this.vao) return
    const { gl } = this.services
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(0.002, 0.004, 0.012, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    this.program.activate()
    this.program.setVec2('uResolution', this.viewport.width, this.viewport.height)
    this.program.setFloat('uTime', frame.elapsedTimeSec + this.resetPhase)
    this.program.setFloat('uBass', frame.audio.smoothed.bass)
    this.program.setFloat('uSeed', frame.randomSeed)
    this.program.setFloat('uPulse', frame.beat.hit ? 1 : frame.beat.phase * 0.15)
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  reset(reason: CinematicRendererResetReason): void {
    if (reason !== 'dispose') this.resetPhase += 0.125
  }

  onContextLost(): void {
    this.vao = null
  }

  dispose(): void {
    this.program = null
    this.vao = null
    this.services = null
  }
}

const diagnosticDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked'],
  shots: [{ id: 'diagnostic-locked', rig: 'locked', sections: ['unknown'], action: 'hold' }],
  dropActions: ['impact'],
  revealActions: ['reveal'],
  retreatActions: ['retreat'],
})

export const diagnosticCinematicWorldDefinition: CinematicWebGLWorldDefinition = {
  id: CINEMATIC_DIAGNOSTIC_WORLD_ID,
  label: 'Cinematic Runtime Diagnostic',
  internal: true,
  backend: 'webgl2',
  direction: diagnosticDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked'],
    modulationTargets: ['depth', 'cameraPunch', 'fogDensity', 'particleEmission', 'bloom', 'chromaticAberration', 'environmentBrightness', 'feedback', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: true,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new DiagnosticCinematicWorld(),
}
