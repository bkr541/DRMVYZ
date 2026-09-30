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
 * HDR bloom: the glow of real light sources. Built for float (`rgba16f`) scene targets, where a lit LED can be many times brighter
 * than white, but safe on 8-bit input too (it then only catches what is near white).
 *
 * Unlike the single-pass `bloom`, it works in linear light on a mip chain: a soft-knee threshold picks out only what is brighter than
 * `threshold` (so white letters and lit walls stay crisp while LEDs glow), each level halves the resolution, and the levels are summed
 * back up with a tent filter. The result is a tight hot halo that fades into a wide soft glow, tens of pixels across, at the cost of a
 * few small passes. `spread` sets how much of the wide glow survives; `levels` how far it reaches (capped per quality tier).
 *
 * Input and output are the engine's display-encoded values (gamma 2.2), unclamped; the glow is added in linear light and re-encoded, so
 * a later `cinematic-finish` tone curve rolls the bright cores to white.
 */
export const CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('hdr-bloom')
export const CINEMA2_HDR_BLOOM_EFFECT_VERSION = 1 as const

/** The deepest chain each tier builds (level 0 is half the viewport; each level halves again). */
export const CINEMA2_HDR_BLOOM_MAX_LEVELS: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 5, medium: 6, high: 7 })

const PREFILTER_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_threshold;
uniform float u_knee;
uniform float u_clampMax;
out vec4 outColor;
vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
vec3 tap(vec2 uv) { return toLinear(texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))).rgb); }
// Soft knee: nothing below threshold - knee, a quadratic ramp through the knee, then everything above the threshold.
vec3 bright(vec3 c) {
  c = min(c, vec3(u_clampMax));
  float peak = max(c.r, max(c.g, c.b));
  float ramp = clamp(peak - u_threshold + u_knee, 0.0, 2.0 * u_knee);
  ramp = ramp * ramp / (4.0 * u_knee + 1e-4);
  return c * (max(ramp, peak - u_threshold) / max(peak, 1e-4));
}
// Karis average: weights each group by 1 / (1 + luma), so a single hot pixel cannot flicker the whole halo as the camera moves.
float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec2 t = u_texel;
  vec3 a = bright(tap(v_uv + t * vec2(-2.0, 2.0)));
  vec3 b = bright(tap(v_uv + t * vec2(0.0, 2.0)));
  vec3 c = bright(tap(v_uv + t * vec2(2.0, 2.0)));
  vec3 d = bright(tap(v_uv + t * vec2(-2.0, 0.0)));
  vec3 e = bright(tap(v_uv));
  vec3 f = bright(tap(v_uv + t * vec2(2.0, 0.0)));
  vec3 g = bright(tap(v_uv + t * vec2(-2.0, -2.0)));
  vec3 h = bright(tap(v_uv + t * vec2(0.0, -2.0)));
  vec3 i = bright(tap(v_uv + t * vec2(2.0, -2.0)));
  vec3 j = bright(tap(v_uv + t * vec2(-1.0, 1.0)));
  vec3 k = bright(tap(v_uv + t * vec2(1.0, 1.0)));
  vec3 l = bright(tap(v_uv + t * vec2(-1.0, -1.0)));
  vec3 m = bright(tap(v_uv + t * vec2(1.0, -1.0)));
  vec3 g0 = (j + k + l + m) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25;
  vec3 g2 = (b + c + e + f) * 0.25;
  vec3 g3 = (d + e + g + h) * 0.25;
  vec3 g4 = (e + f + h + i) * 0.25;
  float w0 = karis(g0), w1 = karis(g1), w2 = karis(g2), w3 = karis(g3), w4 = karis(g4);
  vec3 sum = g0 * w0 * 0.5 + (g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) * 0.125;
  outColor = vec4(sum / (w0 * 0.5 + (w1 + w2 + w3 + w4) * 0.125), 1.0);
}`

// 13-tap downsample (Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare"): smooth, no aliasing shimmer.
const DOWNSAMPLE_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
out vec4 outColor;
vec3 tap(vec2 uv) { return texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))).rgb; }
void main() {
  vec2 t = u_texel;
  vec3 center = tap(v_uv) * 0.125;
  vec3 inner = (tap(v_uv + t * vec2(-1.0, 1.0)) + tap(v_uv + t * vec2(1.0, 1.0)) + tap(v_uv + t * vec2(-1.0, -1.0)) + tap(v_uv + t * vec2(1.0, -1.0))) * 0.125;
  vec3 corners = (tap(v_uv + t * vec2(-2.0, 2.0)) + tap(v_uv + t * vec2(2.0, 2.0)) + tap(v_uv + t * vec2(-2.0, -2.0)) + tap(v_uv + t * vec2(2.0, -2.0))) * 0.03125;
  vec3 edges = (tap(v_uv + t * vec2(0.0, 2.0)) + tap(v_uv + t * vec2(-2.0, 0.0)) + tap(v_uv + t * vec2(2.0, 0.0)) + tap(v_uv + t * vec2(0.0, -2.0))) * 0.0625;
  outColor = vec4(center + inner + corners + edges, 1.0);
}`

// Upsample: a 3x3 tent of the coarser level blended with this level's own downsample.
const UPSAMPLE_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_coarse;
uniform sampler2D u_fine;
uniform vec2 u_texel;
uniform float u_spread;
out vec4 outColor;
vec3 tap(vec2 uv) { return texture(u_coarse, clamp(uv, vec2(0.0), vec2(1.0))).rgb; }
void main() {
  vec2 t = u_texel;
  vec3 tent = tap(v_uv) * 4.0;
  tent += (tap(v_uv + vec2(t.x, 0.0)) + tap(v_uv - vec2(t.x, 0.0)) + tap(v_uv + vec2(0.0, t.y)) + tap(v_uv - vec2(0.0, t.y))) * 2.0;
  tent += tap(v_uv + t) + tap(v_uv - t) + tap(v_uv + vec2(t.x, -t.y)) + tap(v_uv + vec2(-t.x, t.y));
  outColor = vec4(mix(texture(u_fine, v_uv).rgb, tent / 16.0, u_spread), 1.0);
}`

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_bloom;
uniform vec2 u_texel;
uniform float u_intensity;
uniform float u_mix;
uniform vec3 u_tint;
out vec4 outColor;
vec3 tap(vec2 uv) { return texture(u_bloom, clamp(uv, vec2(0.0), vec2(1.0))).rgb; }
void main() {
  vec4 base = texture(u_source, v_uv);
  vec2 t = u_texel;
  vec3 glow = tap(v_uv) * 4.0;
  glow += (tap(v_uv + vec2(t.x, 0.0)) + tap(v_uv - vec2(t.x, 0.0)) + tap(v_uv + vec2(0.0, t.y)) + tap(v_uv - vec2(0.0, t.y))) * 2.0;
  glow += tap(v_uv + t) + tap(v_uv - t) + tap(v_uv + vec2(t.x, -t.y)) + tap(v_uv + vec2(-t.x, t.y));
  glow *= u_tint * (u_intensity / 16.0);
  vec3 linear = pow(max(base.rgb, vec3(0.0)), vec3(2.2)) + glow;
  vec3 bloomed = pow(linear, vec3(1.0 / 2.2));
  outColor = vec4(mix(base.rgb, bloomed, clamp(u_mix, 0.0, 1.0)), base.a);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['threshold', 0, 64],
  ['knee', 0, 16],
  ['intensity', 0, 8],
  ['spread', 0, 1],
  ['levels', 1, 8],
  ['clampMax', 1, 1024],
])

const WHITE: readonly [number, number, number] = Object.freeze([1, 1, 1]) as readonly [number, number, number]

interface Level {
  width: number
  height: number
  down: WebGLTexture
  downFramebuffer: WebGLFramebuffer
  up: WebGLTexture
  upFramebuffer: WebGLFramebuffer
}

function createProgram(gl: WebGL2RenderingContext, label: string, fragSrc: string, required: string[], optional: string[] = []): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label, vertSrc: FULLSCREEN_VERT_SRC, fragSrc, requiredUniforms: required, optionalUniforms: optional })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

class HdrBloomEffectInstance implements Cinema2EffectInstance {
  private readonly prefilter: ShaderProgram
  private readonly downsample: ShaderProgram
  private readonly upsample: ShaderProgram
  private readonly composite: ShaderProgram
  private readonly pass: FullscreenPass
  private readonly floatTargets: boolean
  private levels: Level[] = []
  private chainKey = ''
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    const label = `Cinema2/Effect/HdrBloom/${effect.id}`
    this.prefilter = createProgram(gl, `${label}/prefilter`, PREFILTER_SOURCE, ['u_source'], ['u_texel', 'u_threshold', 'u_knee', 'u_clampMax'])
    this.downsample = createProgram(gl, `${label}/downsample`, DOWNSAMPLE_SOURCE, ['u_source'], ['u_texel'])
    this.upsample = createProgram(gl, `${label}/upsample`, UPSAMPLE_SOURCE, ['u_coarse', 'u_fine'], ['u_texel', 'u_spread'])
    this.composite = createProgram(gl, `${label}/composite`, COMPOSITE_SOURCE, ['u_source', 'u_bloom'], ['u_texel', 'u_intensity', 'u_mix', 'u_tint'])
    this.pass = new FullscreenPass(gl)
    // Half-float levels keep the LEDs' brightness through the chain; without float render support the chain is 8-bit (the glow then
    // only reaches what the scene clipped to white).
    this.floatTargets = typeof gl.getExtension === 'function' && gl.getExtension('EXT_color_buffer_float') != null
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl } = this
    const p = context.parameters
    const threshold = clamp(number(p, 'threshold', 1.5), 0, 64)
    const knee = clamp(number(p, 'knee', threshold * 0.5), 0.0001, 16)
    const intensity = clamp(number(p, 'intensity', 1), 0, 8)
    const spread = clamp(number(p, 'spread', 0.7), 0, 1)
    const clampMax = clamp(number(p, 'clampMax', 64), 1, 1024)
    const tint = readEffectColor(p.tint, WHITE)
    const levelCount = Math.min(Math.round(clamp(number(p, 'levels', 6), 1, 8)), CINEMA2_HDR_BLOOM_MAX_LEVELS[context.quality])

    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)

    const levels = this.ensureChain(context.width, context.height, levelCount)
    if (levels.length === 0 || intensity <= 0) {
      this.runComposite(context, null, 0, tint)
      return
    }

    // Prefilter into level 0 (half resolution), reading the full-resolution scene.
    this.prefilter.activate()
    this.prefilter.setVec2('u_texel', 1 / context.width, 1 / context.height)
    this.prefilter.setFloat('u_threshold', threshold)
    this.prefilter.setFloat('u_knee', knee)
    this.prefilter.setFloat('u_clampMax', clampMax)
    this.pass.run(this.prefilter, levels[0]!.downFramebuffer, levels[0]!.width, levels[0]!.height, [{ unit: 0, texture: context.input.texture, uniformName: 'u_source' }])

    this.downsample.activate()
    for (let index = 1; index < levels.length; index += 1) {
      const from = levels[index - 1]!
      const to = levels[index]!
      this.downsample.setVec2('u_texel', 1 / from.width, 1 / from.height)
      this.pass.run(this.downsample, to.downFramebuffer, to.width, to.height, [{ unit: 0, texture: from.down, uniformName: 'u_source' }])
    }

    // Sum back up: each level blends its own downsample with the tent-filtered level below it.
    this.upsample.activate()
    this.upsample.setFloat('u_spread', spread)
    for (let index = levels.length - 2; index >= 0; index -= 1) {
      const coarse = levels[index + 1]!
      const fine = levels[index]!
      const coarseTexture = index + 1 === levels.length - 1 ? coarse.down : coarse.up
      this.upsample.setVec2('u_texel', 1 / coarse.width, 1 / coarse.height)
      this.pass.run(this.upsample, fine.upFramebuffer, fine.width, fine.height, [
        { unit: 0, texture: coarseTexture, uniformName: 'u_coarse' },
        { unit: 1, texture: fine.down, uniformName: 'u_fine' },
      ])
    }

    const top = levels[0]!
    this.runComposite(context, levels.length === 1 ? top.down : top.up, intensity, tint, top)
    assertCinema2NoGlErrors(gl, 'HDR bloom draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseChain()
    this.pass.dispose()
    this.prefilter.dispose()
    this.downsample.dispose()
    this.upsample.dispose()
    this.composite.dispose()
  }

  private runComposite(
    context: Readonly<Cinema2EffectRenderExecutionContext>,
    bloom: WebGLTexture | null,
    intensity: number,
    tint: readonly [number, number, number],
    top?: Level,
  ): void {
    const program = this.composite
    program.activate()
    program.setVec2('u_texel', top ? 1 / top.width : 0, top ? 1 / top.height : 0)
    program.setFloat('u_intensity', bloom ? intensity : 0)
    program.setFloat('u_mix', context.mix)
    program.setVec3('u_tint', tint[0], tint[1], tint[2])
    this.pass.run(program, context.target, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      // With no chain the bloom sampler still needs a valid texture; intensity 0 keeps it from contributing.
      { unit: 1, texture: bloom ?? context.input.texture, uniformName: 'u_bloom' },
    ])
  }

  private ensureChain(width: number, height: number, levelCount: number): Level[] {
    const key = `${width}x${height}x${levelCount}`
    if (key === this.chainKey) return this.levels
    this.releaseChain()
    this.chainKey = key
    const levels: Level[] = []
    let w = Math.max(1, Math.floor(width / 2))
    let h = Math.max(1, Math.floor(height / 2))
    try {
      for (let index = 0; index < levelCount; index += 1) {
        const down = this.createSurface(w, h)
        const up = this.createSurface(w, h)
        levels.push({ width: w, height: h, down: down.texture, downFramebuffer: down.framebuffer, up: up.texture, upFramebuffer: up.framebuffer })
        if (w <= 2 || h <= 2) break
        w = Math.max(1, Math.floor(w / 2))
        h = Math.max(1, Math.floor(h / 2))
      }
    } catch (error) {
      this.levels = levels
      this.releaseChain()
      throw error
    }
    this.levels = levels
    return levels
  }

  private createSurface(width: number, height: number): { texture: WebGLTexture; framebuffer: WebGLFramebuffer } {
    const { gl } = this
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture)
      if (framebuffer) gl.deleteFramebuffer(framebuffer)
      throw new Error('Cinema 2.0 HDR bloom could not allocate a mip level.')
    }
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
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
      throw new Error(`Cinema 2.0 HDR bloom mip level ${width}x${height} is incomplete (status 0x${status.toString(16)}).`)
    }
    return { texture, framebuffer }
  }

  private releaseChain(): void {
    const { gl } = this
    for (const level of this.levels) {
      gl.deleteTexture(level.down)
      gl.deleteTexture(level.up)
      gl.deleteFramebuffer(level.downFramebuffer)
      gl.deleteFramebuffer(level.upFramebuffer)
    }
    this.levels = []
    this.chainKey = ''
  }
}

export const cinema2HdrBloomEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
  version: CINEMA2_HDR_BLOOM_EFFECT_VERSION,
  label: 'HDR Bloom',
  validate: (effect: Readonly<Cinema2EffectManifest>) => validateEffectParameters(effect, NUMERIC, ['tint']),
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new HdrBloomEffectInstance(gl, effect),
})
