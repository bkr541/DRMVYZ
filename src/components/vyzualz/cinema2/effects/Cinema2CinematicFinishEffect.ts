import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
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
  readEffectColor,
  readEffectNumber as number,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'

/**
 * Cinematic finishing: the last pass of a look. Exposure, a filmic tone curve, white balance, contrast,
 * saturation, split-toning, lens fringing, vignette and animated grain in one draw.
 *
 * Every control is optional and the defaults are a restrained filmic look, so a preset can opt in with
 * just `{ mix: 1 }`. Place it after bloom. Inputs are the engine's display-referred 8-bit targets, so
 * the tone curve shapes highlight roll-off and contrast rather than recovering clipped detail.
 */
export const CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('cinematic-finish')
export const CINEMA2_CINEMATIC_FINISH_EFFECT_VERSION = 1 as const

/** `toneMap` values. */
export const CINEMA2_TONE_MAP = Object.freeze({ none: 0, filmic: 1, soft: 2 } as const)

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_mix;
uniform float u_time;
uniform float u_exposure;
uniform int u_toneMap;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform vec3 u_shadowTint;
uniform vec3 u_highlightTint;
uniform float u_tintAmount;
uniform float u_vignette;
uniform float u_vignetteSoftness;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_aberration;
out vec4 outColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 toDisplay(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
// Narkowicz ACES fit.
vec3 filmic(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 softShoulder(vec3 x) { return x / (1.0 + x * 0.6) * 1.35; }
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float gradientNoise(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 base = texture(u_source, v_uv);
  vec2 centered = v_uv - 0.5;
  // Lens fringing grows with the square of the distance from the centre.
  vec2 fringe = centered * dot(centered, centered) * u_aberration * 0.09;
  vec3 color = vec3(
    texture(u_source, clamp(v_uv + fringe, vec2(0.0), vec2(1.0))).r,
    base.g,
    texture(u_source, clamp(v_uv - fringe, vec2(0.0), vec2(1.0))).b
  );

  vec3 lin = toLinear(color) * u_exposure;
  lin *= vec3(1.0 + 0.2 * u_temperature, 1.0 - 0.12 * u_tint, 1.0 - 0.2 * u_temperature);
  if (u_toneMap == 1) lin = filmic(lin);
  else if (u_toneMap == 2) lin = softShoulder(lin);
  float l = luma(lin);
  lin = mix(vec3(l), lin, u_saturation);

  vec3 display = toDisplay(clamp(lin, 0.0, 1.0));
  // Contrast is a display-space S-curve blend, so deep shadows are shaped but never clipped to black
  // (a linear-light pivot would erase everything under ~0.016 on a dark stage).
  vec3 curved = display * display * (3.0 - 2.0 * display);
  display = u_contrast >= 1.0 ? mix(display, curved, clamp(u_contrast - 1.0, 0.0, 1.0)) : 0.5 + (display - 0.5) * u_contrast;
  float ld = luma(display);
  float shadowWeight = 1.0 - smoothstep(0.0, 0.5, ld);
  float highlightWeight = smoothstep(0.5, 1.0, ld);
  vec3 shift = (u_shadowTint - luma(u_shadowTint)) * shadowWeight + (u_highlightTint - luma(u_highlightTint)) * highlightWeight;
  display *= 1.0 + shift * 2.0 * u_tintAmount;

  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  float dist = length(centered * aspect) * 1.4;
  float inner = mix(0.85, 0.15, u_vignetteSoftness);
  display *= 1.0 - u_vignette * smoothstep(inner, 1.25, dist);

  // Animated grain, strongest in the mid-tones and quiet in deep shadow and clipped highlight.
  vec2 cell = floor(gl_FragCoord.xy / max(u_grainSize, 0.5));
  float noise = (hash21(cell + fract(u_time * 0.37) * 611.0) + hash21(cell.yx + fract(u_time * 0.53) * 379.0)) - 1.0;
  float midtone = 0.35 + 0.65 * 4.0 * ld * (1.0 - ld);
  display += noise * u_grain * 0.11 * midtone;
  display += (gradientNoise(gl_FragCoord.xy + 5.0) - 0.5) / 255.0;

  float m = clamp(u_mix, 0.0, 1.0);
  outColor = vec4(mix(base.rgb, clamp(display, 0.0, 1.0), m), base.a);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['exposure', 0.1, 4],
  ['toneMap', 0, 2],
  ['contrast', 0.5, 2],
  ['saturation', 0, 2],
  ['temperature', -1, 1],
  ['tint', -1, 1],
  ['tintAmount', 0, 1],
  ['vignette', 0, 1],
  ['vignetteSoftness', 0, 1],
  ['grain', 0, 1],
  ['grainSize', 0.5, 4],
  ['aberration', 0, 1],
])

const NEUTRAL_TINT: readonly [number, number, number] = Object.freeze([0.5, 0.5, 0.5]) as readonly [number, number, number]

function validate(effect: Readonly<Cinema2EffectManifest>) {
  const diagnostics = [...validateEffectParameters(effect, NUMERIC, ['shadowTint', 'highlightTint'])]
  const toneMap = effect.parameters?.toneMap
  if (toneMap !== undefined && typeof toneMap === 'number' && !Number.isInteger(toneMap)) {
    diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.toneMap', message: 'Effect parameter "toneMap" must be 0 (none), 1 (filmic) or 2 (soft).' })
  }
  return Object.freeze(diagnostics)
}

class CinematicFinishEffectInstance implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: `Cinema2/Effect/CinematicFinish/${effect.id}`,
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_source', 'u_mix'],
      optionalUniforms: [
        'u_resolution', 'u_time', 'u_exposure', 'u_toneMap', 'u_contrast', 'u_saturation', 'u_temperature', 'u_tint',
        'u_shadowTint', 'u_highlightTint', 'u_tintAmount', 'u_vignette', 'u_vignetteSoftness', 'u_grain', 'u_grainSize', 'u_aberration',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    this.pass = new FullscreenPass(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl, program } = this
    const p = context.parameters
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)
    program.activate()
    program.setVec2('u_resolution', context.width, context.height)
    program.setFloat('u_mix', context.mix)
    program.setFloat('u_time', context.frame.elapsedTimeSec)
    program.setFloat('u_exposure', clamp(number(p, 'exposure', 1), 0.1, 4))
    program.setInt('u_toneMap', Math.round(clamp(number(p, 'toneMap', CINEMA2_TONE_MAP.filmic), 0, 2)))
    program.setFloat('u_contrast', clamp(number(p, 'contrast', 1.08), 0.5, 2))
    program.setFloat('u_saturation', clamp(number(p, 'saturation', 1.05), 0, 2))
    program.setFloat('u_temperature', clamp(number(p, 'temperature', 0), -1, 1))
    program.setFloat('u_tint', clamp(number(p, 'tint', 0), -1, 1))
    const shadow = readEffectColor(p.shadowTint, NEUTRAL_TINT)
    const highlight = readEffectColor(p.highlightTint, NEUTRAL_TINT)
    program.setVec3('u_shadowTint', shadow[0], shadow[1], shadow[2])
    program.setVec3('u_highlightTint', highlight[0], highlight[1], highlight[2])
    program.setFloat('u_tintAmount', clamp(number(p, 'tintAmount', 0), 0, 1))
    program.setFloat('u_vignette', clamp(number(p, 'vignette', 0.35), 0, 1))
    program.setFloat('u_vignetteSoftness', clamp(number(p, 'vignetteSoftness', 0.6), 0, 1))
    program.setFloat('u_grain', clamp(number(p, 'grain', 0.25), 0, 1))
    program.setFloat('u_grainSize', clamp(number(p, 'grainSize', 1.5), 0.5, 4))
    program.setFloat('u_aberration', clamp(number(p, 'aberration', 0.25), 0, 1))
    this.pass.run(program, context.target, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
    ])
    assertCinema2NoGlErrors(gl, 'Cinematic finish draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pass.dispose()
    this.program.dispose()
  }
}

export const cinema2CinematicFinishEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
  version: CINEMA2_CINEMATIC_FINISH_EFFECT_VERSION,
  label: 'Cinematic Finish',
  validate,
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new CinematicFinishEffectInstance(gl, effect),
})
