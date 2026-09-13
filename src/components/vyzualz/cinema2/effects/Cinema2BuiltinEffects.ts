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
export const CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('feedback-trails')
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

const FEEDBACK_TRAILS_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_history;
uniform float u_mix;
uniform float u_persistence;
uniform float u_historyValid;
out vec4 outColor;
void main() {
  vec4 base = texture(u_source, v_uv);
  vec4 prior = texture(u_history, v_uv);
  vec4 history = mix(base, prior, step(0.5, u_historyValid));
  vec4 trailed = mix(base, history, clamp(u_persistence, 0.0, 1.0));
  outColor = mix(base, trailed, clamp(u_mix, 0.0, 1.0));
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

class HistoryFeedbackEffectInstance implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private readonly historyName: string
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly history: Cinema2EffectCreateContext['history'],
    effect: Readonly<Cinema2EffectManifest>,
  ) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: `Cinema2/Effect/FeedbackTrails/${effect.id}`,
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FEEDBACK_TRAILS_FRAGMENT_SOURCE,
      requiredUniforms: ['u_source', 'u_history', 'u_mix', 'u_persistence', 'u_historyValid'],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    this.pass = new FullscreenPass(gl)
    this.historyName = `effect.${effect.id}.feedback-trails`
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const persistence = clamp(numberValue(context.parameters, 'persistence', 0.85), 0, 1)
    const historyFrame = this.history.beginFrame(this.historyName, context.width, context.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    this.program.activate()
    this.program.setFloat('u_mix', context.mix)
    this.program.setFloat('u_persistence', persistence)
    this.program.setFloat('u_historyValid', historyFrame?.valid ? 1 : 0)

    if (!historyFrame) {
      this.pass.run(this.program, context.target, context.width, context.height, [
        { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
        { unit: 1, texture: context.input.texture, uniformName: 'u_history' },
      ])
      return
    }

    this.pass.run(this.program, historyFrame.write.framebuffer, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      { unit: 1, texture: historyFrame.read.colorTexture, uniformName: 'u_history' },
    ])
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, historyFrame.write.framebuffer)
    this.gl.readBuffer(this.gl.COLOR_ATTACHMENT0)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, context.target)
    this.gl.blitFramebuffer(
      0, 0, context.width, context.height,
      0, 0, context.width, context.height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.NEAREST,
    )
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, null)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null)
    this.history.commit(this.historyName)
  }

  handleAction(action: string): void {
    if (this.disposed || action !== 'reset') return
    this.history.resetBuffer(this.historyName, 'manual')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.history.releaseBuffer(this.historyName)
    this.pass.dispose()
    this.program.dispose()
  }
}

export const cinema2FeedbackTrailsEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID,
  version: CINEMA2_BUILTIN_EFFECT_VERSION,
  label: 'Feedback / Trails',
  validate: (effect: Readonly<Cinema2EffectManifest>) => Object.freeze([
    ...validateCommon(effect),
    ...validateNumeric(effect, 'persistence', 0, 1),
  ]),
  create: ({ gl, effect, history }: Readonly<Cinema2EffectCreateContext>) => new HistoryFeedbackEffectInstance(gl, history, effect),
})

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
