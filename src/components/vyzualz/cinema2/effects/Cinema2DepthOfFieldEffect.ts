import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'
import {
  clampEffectValue as clamp,
  readEffectNumber as number,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'
import { invertCinema2Matrix4 } from './Cinema2VolumetricAtmosphereEffect'

/**
 * Depth of field: blurs by distance from the camera, from the scene depth every frame already has. Everything within `focusRange` of
 * `focusDistance` (world units from the camera) stays sharp; beyond it the blur grows over `falloff` units to `farBlur` pixels (at 1080p; it
 * scales with the frame), and in front of it to `nearBlur`. A golden-angle disc gathers the blur; each sample counts only as far as its own blur
 * reaches, so a sharp subject does not smear onto the soft background behind it. Needs the depth input and a world camera; without them (and on
 * low quality) it passes the image through.
 */
export const CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('depth-of-field')
export const CINEMA2_DEPTH_OF_FIELD_EFFECT_VERSION = 1 as const

/** Disc samples per tier; 0 passes the image through. */
export const CINEMA2_DEPTH_OF_FIELD_SAMPLES: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 0, medium: 12, high: 20 })

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_depth;
uniform mat4 u_invViewProj;
uniform vec3 u_cameraPosition;
uniform vec2 u_resolution;
uniform float u_focusDistance;
uniform float u_focusRange;
uniform float u_falloff;
uniform float u_farBlur;
uniform float u_nearBlur;
uniform int u_samples;
uniform float u_mix;
out vec4 outColor;

float distanceAt(vec2 uv) {
  float d = texture(u_depth, uv).r;
  if (d >= 0.99999) return 1.0e4;
  vec4 p = u_invViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return length(p.xyz / p.w - u_cameraPosition);
}
// Blur radius in pixels at this distance.
float blurAt(float dist) {
  float away = dist - u_focusDistance;
  float over = max(abs(away) - u_focusRange, 0.0) / max(u_falloff, 0.001);
  return min(over, 1.0) * (away > 0.0 ? u_farBlur : u_nearBlur);
}
void main() {
  vec4 base = texture(u_source, v_uv);
  float radius = blurAt(distanceAt(v_uv));
  if (u_samples <= 0 || radius < 0.5) { outColor = base; return; }
  vec2 px = 1.0 / u_resolution;
  vec3 sum = base.rgb;
  float total = 1.0;
  for (int i = 0; i < 32; i++) {
    if (i >= u_samples) break;
    float r = sqrt((float(i) + 0.5) / float(u_samples)) * radius;
    float a = float(i) * 2.39996323;
    vec2 uv = clamp(v_uv + vec2(cos(a), sin(a)) * r * px, vec2(0.0), vec2(1.0));
    // A sample counts only as far as its own blur reaches (a sharp subject in front does not bleed onto the blurred background).
    float w = clamp(blurAt(distanceAt(uv)) - r + 1.0, 0.0, 1.0);
    sum += texture(u_source, uv).rgb * w;
    total += w;
  }
  outColor = vec4(mix(base.rgb, sum / total, clamp(u_mix, 0.0, 1.0)), base.a);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['focusDistance', 0.1, 500],
  ['focusRange', 0, 500],
  ['falloff', 0.01, 500],
  ['farBlur', 0, 40],
  ['nearBlur', 0, 40],
])

class DepthOfFieldEffectInstance implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: `Cinema2/Effect/DepthOfField/${effect.id}`,
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_source'],
      optionalUniforms: ['u_depth', 'u_invViewProj', 'u_cameraPosition', 'u_resolution', 'u_focusDistance', 'u_focusRange', 'u_falloff', 'u_farBlur', 'u_nearBlur', 'u_samples', 'u_mix'],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    this.pass = new FullscreenPass(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl, program } = this
    const p = context.parameters
    const depthInput = context.inputs.find(input => input.attachment === 'depth') ?? null
    const camera = context.camera
    const inverse = camera ? invertCinema2Matrix4(camera.viewProjectionMatrix) : null
    const samples = depthInput && camera && inverse ? CINEMA2_DEPTH_OF_FIELD_SAMPLES[context.quality] : 0
    // Blur sizes are authored at 1080p and scale with the frame.
    const scale = context.height / 1080
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)
    program.activate()
    if (camera && inverse) {
      program.setMat4('u_invViewProj', inverse)
      program.setVec3('u_cameraPosition', camera.position[0], camera.position[1], camera.position[2])
    }
    program.setVec2('u_resolution', context.width, context.height)
    program.setFloat('u_focusDistance', clamp(number(p, 'focusDistance', 5), 0.1, 500))
    program.setFloat('u_focusRange', clamp(number(p, 'focusRange', 1.5), 0, 500))
    program.setFloat('u_falloff', clamp(number(p, 'falloff', 6), 0.01, 500))
    program.setFloat('u_farBlur', clamp(number(p, 'farBlur', 6), 0, 40) * scale)
    program.setFloat('u_nearBlur', clamp(number(p, 'nearBlur', 0), 0, 40) * scale)
    program.setInt('u_samples', samples)
    program.setFloat('u_mix', context.mix)
    this.pass.run(program, context.target, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      // Without depth the depth sampler just re-binds the color texture; zero samples keep the shader from reading it.
      { unit: 1, texture: depthInput?.texture ?? context.input.texture, uniformName: 'u_depth' },
    ])
    assertCinema2NoGlErrors(gl, 'Depth of field draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pass.dispose()
    this.program.dispose()
  }
}

export const cinema2DepthOfFieldEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID,
  version: CINEMA2_DEPTH_OF_FIELD_EFFECT_VERSION,
  label: 'Depth of Field',
  validate: (effect: Readonly<Cinema2EffectManifest>) => validateEffectParameters(effect, NUMERIC),
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new DepthOfFieldEffectInstance(gl, effect),
})
