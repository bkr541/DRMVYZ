import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import type { Cinema2LayerBlendMode } from '../contracts/Cinema2NativePresetManifest'

export interface Cinema2CompositorSource {
  texture: WebGLTexture
  opacity: number
  blendMode: Cinema2LayerBlendMode
}

const COMPOSITOR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform float u_opacity;
out vec4 outColor;
void main() {
  vec4 source = texture(u_source, v_uv);
  float alpha = clamp(source.a * u_opacity, 0.0, 1.0);
  outColor = vec4(source.rgb * alpha, alpha);
}`

/** Shared Cinema 2.0 fullscreen compositor. Programs/geometry are created once per runtime. */
export class Cinema2Compositor {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Compositor',
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: COMPOSITOR_FRAGMENT_SOURCE,
      requiredUniforms: ['u_source', 'u_opacity'],
    })
    if (!result.program) {
      throw new Error(`Cinema 2.0 compositor shader failed at ${result.error.stage}: ${result.error.log}`)
    }
    this.program = result.program
    this.pass = new FullscreenPass(gl)
  }

  clear(target: WebGLFramebuffer | null, width: number, height: number): void {
    if (this.disposed) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target)
    gl.viewport(0, 0, width, height)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.colorMask(true, true, true, true)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  draw(
    source: Readonly<Cinema2CompositorSource>,
    target: WebGLFramebuffer | null,
    width: number,
    height: number,
  ): void {
    if (this.disposed || source.opacity <= 0) return
    const gl = this.gl
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.colorMask(true, true, true, true)
    gl.enable(gl.BLEND)
    configureBlend(gl, source.blendMode)
    this.program.activate()
    this.program.setFloat('u_opacity', clamp01(source.opacity))
    this.pass.run(this.program, target, width, height, [{ unit: 0, texture: source.texture, uniformName: 'u_source' }])
    gl.disable(gl.BLEND)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pass.dispose()
    this.program.dispose()
  }
}

function configureBlend(gl: WebGL2RenderingContext, mode: Cinema2LayerBlendMode): void {
  const blendFuncSeparate = typeof gl.blendFuncSeparate === 'function'
    ? gl.blendFuncSeparate.bind(gl)
    : null
  const set = (srcRgb: number, dstRgb: number) => {
    if (blendFuncSeparate) blendFuncSeparate(srcRgb, dstRgb, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    else gl.blendFunc(srcRgb, dstRgb)
  }
  switch (mode) {
    case 'add':
      set(gl.ONE, gl.ONE)
      return
    case 'screen':
      set(gl.ONE, gl.ONE_MINUS_SRC_COLOR)
      return
    case 'multiply':
      set(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA)
      return
    case 'normal':
    default:
      set(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1))
}
