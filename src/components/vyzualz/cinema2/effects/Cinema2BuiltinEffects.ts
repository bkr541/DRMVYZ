import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
  type Cinema2JsonValue,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectDiagnostic,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'

export const CINEMA2_BLUR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('blur')
export const CINEMA2_BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')
export const CINEMA2_BUILTIN_EFFECT_VERSION = 1 as const

const BLUR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_mix;
uniform float u_radius;
out vec4 outColor;
vec4 sampleSource(vec2 uv) { return texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))); }
void main() {
  vec2 px = max(u_radius, 0.0) / max(u_resolution, vec2(1.0));
  vec4 base = sampleSource(v_uv);
  if (u_radius <= 0.0001) { outColor = base; return; }
  vec4 blurred = base * 0.227027;
  blurred += sampleSource(v_uv + vec2(px.x, 0.0) * 1.384615) * 0.158108;
  blurred += sampleSource(v_uv - vec2(px.x, 0.0) * 1.384615) * 0.158108;
  blurred += sampleSource(v_uv + vec2(0.0, px.y) * 1.384615) * 0.158108;
  blurred += sampleSource(v_uv - vec2(0.0, px.y) * 1.384615) * 0.158108;
  blurred += sampleSource(v_uv + px * 3.230769) * 0.070811;
  blurred += sampleSource(v_uv - px * 3.230769) * 0.070811;
  outColor = mix(base, blurred, clamp(u_mix, 0.0, 1.0));
}`

const BLOOM_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_mix;
uniform float u_threshold;
uniform float u_radius;
uniform float u_intensity;
out vec4 outColor;
vec4 sampleSource(vec2 uv) { return texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))); }
float luma(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec2 px = max(u_radius, 0.0) / max(u_resolution, vec2(1.0));
  vec4 base = sampleSource(v_uv);
  vec4 taps[9];
  taps[0] = base;
  taps[1] = sampleSource(v_uv + vec2(px.x, 0.0));
  taps[2] = sampleSource(v_uv - vec2(px.x, 0.0));
  taps[3] = sampleSource(v_uv + vec2(0.0, px.y));
  taps[4] = sampleSource(v_uv - vec2(0.0, px.y));
  taps[5] = sampleSource(v_uv + px);
  taps[6] = sampleSource(v_uv - px);
  taps[7] = sampleSource(v_uv + vec2(px.x, -px.y));
  taps[8] = sampleSource(v_uv + vec2(-px.x, px.y));
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    vec3 bright = max(taps[i].rgb - vec3(u_threshold), vec3(0.0));
    glow += bright * smoothstep(min(u_threshold, 0.9999), 1.0, luma(taps[i].rgb));
  }
  glow /= 9.0;
  vec4 bloomed = vec4(base.rgb + glow * max(u_intensity, 0.0), base.a);
  outColor = mix(base, bloomed, clamp(u_mix, 0.0, 1.0));
}`

function numericParameter(
  effect: Readonly<Cinema2EffectManifest>,
  name: string,
  fallback: number,
): number {
  const value = effect.parameters?.[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function validateCommon(effect: Readonly<Cinema2EffectManifest>): Cinema2EffectDiagnostic[] {
  const diagnostics: Cinema2EffectDiagnostic[] = []
  const mix = effect.parameters?.mix
  if (typeof mix !== 'number' || !Number.isFinite(mix) || mix < 0 || mix > 1) {
    diagnostics.push({ code: 'CINEMA2_EFFECT_MIX_INVALID', path: '$.parameters.mix', message: 'Effect mix must be a finite number between 0 and 1.' })
  }
  return diagnostics
}

function validateNumeric(
  effect: Readonly<Cinema2EffectManifest>,
  name: string,
  min: number,
  max: number,
): Cinema2EffectDiagnostic[] {
  const value = effect.parameters?.[name]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return [{ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: `$.parameters.${name}`, message: `Effect parameter "${name}" must be between ${min} and ${max}.` }]
  }
  return []
}

class SinglePassEffectInstance implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    label: string,
    fragmentSource: string,
    private readonly configure: (program: ShaderProgram, context: Readonly<Cinema2EffectRenderExecutionContext>) => void,
  ) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label,
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: fragmentSource,
      requiredUniforms: ['u_source', 'u_resolution', 'u_mix'],
      optionalUniforms: ['u_radius', 'u_threshold', 'u_intensity'],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    this.pass = new FullscreenPass(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    this.program.activate()
    this.program.setVec2('u_resolution', context.width, context.height)
    this.program.setFloat('u_mix', context.mix)
    this.configure(this.program, context)
    this.pass.run(this.program, context.target, context.width, context.height, [{ unit: 0, texture: context.input.texture, uniformName: 'u_source' }])
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pass.dispose()
    this.program.dispose()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function numberValue(values: Readonly<Record<string, Cinema2JsonValue>>, name: string, fallback: number): number {
  const value = values[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const cinema2BlurEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_BLUR_EFFECT_TYPE_ID,
  version: CINEMA2_BUILTIN_EFFECT_VERSION,
  label: 'Blur',
  validate: (effect: Readonly<Cinema2EffectManifest>) => Object.freeze([
    ...validateCommon(effect),
    ...validateNumeric(effect, 'radius', 0, 32),
  ]),
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new SinglePassEffectInstance(
    gl,
    `Cinema2/Effect/Blur/${effect.id}`,
    BLUR_FRAGMENT_SOURCE,
    (program, context) => program.setFloat('u_radius', clamp(numberValue(context.parameters, 'radius', numericParameter(effect, 'radius', 2)), 0, 32)),
  ),
})

export const cinema2BloomEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID,
  version: CINEMA2_BUILTIN_EFFECT_VERSION,
  label: 'Bloom',
  validate: (effect: Readonly<Cinema2EffectManifest>) => Object.freeze([
    ...validateCommon(effect),
    ...validateNumeric(effect, 'threshold', 0, 1),
    ...validateNumeric(effect, 'radius', 0, 32),
    ...validateNumeric(effect, 'intensity', 0, 8),
  ]),
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new SinglePassEffectInstance(
    gl,
    `Cinema2/Effect/Bloom/${effect.id}`,
    BLOOM_FRAGMENT_SOURCE,
    (program, context) => {
      program.setFloat('u_threshold', clamp(numberValue(context.parameters, 'threshold', numericParameter(effect, 'threshold', 0.65)), 0, 1))
      program.setFloat('u_radius', clamp(numberValue(context.parameters, 'radius', numericParameter(effect, 'radius', 2)), 0, 32))
      program.setFloat('u_intensity', clamp(numberValue(context.parameters, 'intensity', numericParameter(effect, 'intensity', 1)), 0, 8))
    },
  ),
})
