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
  readEffectColor,
  readEffectNumber as number,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'

/**
 * Glare: star-shaped glints on the brightest highlights (the glints on cut crystal, a strobe head, the hottest glowing leaves), like a camera
 * lens with a star filter. Built for HDR scenes: only what is far brighter than white (`threshold`, in linear light) glints, so ordinary
 * highlights stay clean. The bright points are picked out at half resolution, streaked along `streaks` directions (4 = a cross, 6 = a snowflake)
 * rotated by `rotation` degrees, each streak fading along its `length` (a fraction of the frame height), and added back in linear light. Low
 * quality skips it.
 */
export const CINEMA2_GLARE_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('glare')
export const CINEMA2_GLARE_EFFECT_VERSION = 1 as const

/** Taps along each streak (both ways) per tier; 0 skips the effect. */
export const CINEMA2_GLARE_TAPS: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 0, medium: 8, high: 14 })

const PREFILTER_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_threshold;
out vec4 outColor;
vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 bright(vec2 uv) {
  vec3 c = min(toLinear(texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))).rgb), vec3(64.0));
  float peak = max(c.r, max(c.g, c.b));
  return c * (max(peak - u_threshold, 0.0) / max(peak, 1e-4));
}
void main() {
  vec2 t = u_texel * 0.5;
  outColor = vec4((bright(v_uv + vec2(-t.x, -t.y)) + bright(v_uv + vec2(t.x, -t.y)) + bright(v_uv + vec2(-t.x, t.y)) + bright(v_uv + vec2(t.x, t.y))) * 0.25, 1.0);
}`

const STREAK_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_bright;
uniform vec2 u_aspect;
uniform float u_length;
uniform int u_taps;
uniform int u_streaks;
uniform float u_rotation;
out vec4 outColor;
void main() {
  vec3 sum = vec3(0.0);
  for (int s = 0; s < 8; s++) {
    if (s >= u_streaks) break;
    // Opposite directions share a streak, so half the count covers the full star.
    float angle = u_rotation + 3.14159265 * float(s) / float(u_streaks);
    vec2 dir = vec2(cos(angle), sin(angle)) * u_aspect * (u_length / float(max(u_taps, 1)));
    for (int k = 1; k <= 16; k++) {
      if (k > u_taps) break;
      float w = pow(1.0 - float(k) / float(u_taps + 1), 2.0);
      sum += (texture(u_bright, clamp(v_uv + dir * float(k), vec2(0.0), vec2(1.0))).rgb + texture(u_bright, clamp(v_uv - dir * float(k), vec2(0.0), vec2(1.0))).rgb) * w;
    }
  }
  outColor = vec4(sum / float(max(u_taps, 1)), 1.0);
}`

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_streaks;
uniform float u_intensity;
uniform float u_mix;
uniform vec3 u_tint;
out vec4 outColor;
void main() {
  vec4 base = texture(u_source, v_uv);
  vec3 glare = texture(u_streaks, v_uv).rgb * u_tint * u_intensity;
  vec3 linear = pow(max(base.rgb, vec3(0.0)), vec3(2.2)) + glare;
  outColor = vec4(mix(base.rgb, pow(linear, vec3(1.0 / 2.2)), clamp(u_mix, 0.0, 1.0)), base.a);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['threshold', 0, 64],
  ['intensity', 0, 8],
  ['length', 0, 0.5],
  ['streaks', 2, 8],
  ['rotation', -180, 180],
])

const WHITE: readonly [number, number, number] = Object.freeze([1, 1, 1]) as readonly [number, number, number]

function createProgram(gl: WebGL2RenderingContext, label: string, fragSrc: string, required: string[], optional: string[] = []): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label, vertSrc: FULLSCREEN_VERT_SRC, fragSrc, requiredUniforms: required, optionalUniforms: optional })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

interface Surface { texture: WebGLTexture; framebuffer: WebGLFramebuffer }

class GlareEffectInstance implements Cinema2EffectInstance {
  private readonly prefilter: ShaderProgram
  private readonly streak: ShaderProgram
  private readonly composite: ShaderProgram
  private readonly pass: FullscreenPass
  private readonly floatTargets: boolean
  private surfaces: Surface[] = []
  private size = ''
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    const label = `Cinema2/Effect/Glare/${effect.id}`
    this.prefilter = createProgram(gl, `${label}/prefilter`, PREFILTER_SOURCE, ['u_source'], ['u_texel', 'u_threshold'])
    this.streak = createProgram(gl, `${label}/streak`, STREAK_SOURCE, ['u_bright'], ['u_aspect', 'u_length', 'u_taps', 'u_streaks', 'u_rotation'])
    this.composite = createProgram(gl, `${label}/composite`, COMPOSITE_SOURCE, ['u_source', 'u_streaks'], ['u_intensity', 'u_mix', 'u_tint'])
    this.pass = new FullscreenPass(gl)
    this.floatTargets = typeof gl.getExtension === 'function' && gl.getExtension('EXT_color_buffer_float') != null
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl } = this
    const p = context.parameters
    const taps = CINEMA2_GLARE_TAPS[context.quality]
    const intensity = clamp(number(p, 'intensity', 1), 0, 8)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)
    const tint = readEffectColor(p.tint, WHITE)

    if (taps > 0 && intensity > 0) {
      const w = Math.max(1, Math.floor(context.width / 2)), h = Math.max(1, Math.floor(context.height / 2))
      const [bright, streaks] = this.ensureSurfaces(w, h)
      this.prefilter.activate()
      this.prefilter.setVec2('u_texel', 1 / context.width, 1 / context.height)
      this.prefilter.setFloat('u_threshold', clamp(number(p, 'threshold', 4), 0, 64))
      this.pass.run(this.prefilter, bright!.framebuffer, w, h, [{ unit: 0, texture: context.input.texture, uniformName: 'u_source' }])
      this.streak.activate()
      // Length is a fraction of the frame height; x is scaled so a streak is as long across as it is up.
      this.streak.setVec2('u_aspect', context.height / Math.max(1, context.width), 1)
      this.streak.setFloat('u_length', clamp(number(p, 'length', 0.06), 0, 0.5))
      this.streak.setInt('u_taps', taps)
      this.streak.setInt('u_streaks', Math.max(1, Math.round(clamp(number(p, 'streaks', 4), 2, 8) / 2)))
      this.streak.setFloat('u_rotation', (clamp(number(p, 'rotation', 45), -180, 180) * Math.PI) / 180)
      this.pass.run(this.streak, streaks!.framebuffer, w, h, [{ unit: 0, texture: bright!.texture, uniformName: 'u_bright' }])
    }

    this.composite.activate()
    this.composite.setFloat('u_intensity', taps > 0 ? intensity : 0)
    this.composite.setFloat('u_mix', context.mix)
    this.composite.setVec3('u_tint', tint[0], tint[1], tint[2])
    const streakTexture = taps > 0 && this.surfaces[1] ? this.surfaces[1].texture : context.input.texture
    this.pass.run(this.composite, context.target, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      { unit: 1, texture: streakTexture, uniformName: 'u_streaks' },
    ])
    assertCinema2NoGlErrors(gl, 'Glare draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.release()
    this.pass.dispose()
    this.prefilter.dispose()
    this.streak.dispose()
    this.composite.dispose()
  }

  private ensureSurfaces(width: number, height: number): Surface[] {
    const key = `${width}x${height}`
    if (key === this.size) return this.surfaces
    this.release()
    this.size = key
    this.surfaces = [this.createSurface(width, height), this.createSurface(width, height)]
    return this.surfaces
  }

  private createSurface(width: number, height: number): Surface {
    const { gl } = this
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) throw new Error('Cinema 2.0 glare could not allocate a surface.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (this.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { texture, framebuffer }
  }

  private release(): void {
    for (const surface of this.surfaces) {
      this.gl.deleteTexture(surface.texture)
      this.gl.deleteFramebuffer(surface.framebuffer)
    }
    this.surfaces = []
    this.size = ''
  }
}

export const cinema2GlareEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_GLARE_EFFECT_TYPE_ID,
  version: CINEMA2_GLARE_EFFECT_VERSION,
  label: 'Glare',
  validate: (effect: Readonly<Cinema2EffectManifest>) => validateEffectParameters(effect, NUMERIC, ['tint']),
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new GlareEffectInstance(gl, effect),
})
