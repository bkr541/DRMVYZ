import type { CinematicFrameContext } from '../CinematicWorldRenderer'
import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderFramebuffer } from '../../shaders/runtime/ShaderFramebuffer'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { cinematicModulationValue } from './CinematicAudioModulation'
import {
  cinematicQualityProfile,
  resolveEventHorizonSettings,
  resolveMirrorDimensionSettings,
} from '../../CinematicWorldSettings'

export interface CinematicPostProcessSettings {
  bloom: number
  vignette: number
  chromaticAberration: number
  filmGrain: number
  feedback: number
  toneMapping: boolean
  exposure: number
}

export function resolveCinematicPostProcessSettings(
  frame: CinematicFrameContext,
): CinematicPostProcessSettings {
  const material = frame.config.material
  const eventHorizon = frame.config.worldMode === 'eventHorizon'
    ? resolveEventHorizonSettings(frame.config.worldSettings)
    : null
  const mirror = frame.config.worldMode === 'mirrorDimension'
    ? resolveMirrorDimensionSettings(frame.config.worldSettings)
    : null
  const quality = cinematicQualityProfile(frame.config.qualityTier)
  const mappedBloom = cinematicModulationValue(frame.modulation, 'bloom')
  const mappedChromatic = cinematicModulationValue(frame.modulation, 'chromaticAberration')
  const mappedFeedback = cinematicModulationValue(frame.modulation, 'feedback')
  const mappedDepth = cinematicModulationValue(frame.modulation, 'depth')
  const mappedParticles = cinematicModulationValue(frame.modulation, 'particleEmission')
  const mappedFog = cinematicModulationValue(frame.modulation, 'fogDensity')
  const mappedBrightness = cinematicModulationValue(frame.modulation, 'environmentBrightness')
  const requestedFeedback = (mirror
    ? Math.max(material.feedback, mirror.feedbackAmount)
    : material.feedback) + mappedFeedback * 0.3

  return {
    bloom: Math.min(1.6, Math.max(material.bloom, material.glow * 0.65) + (eventHorizon?.bloomBoost ?? 0) + mappedBloom * 0.7),
    vignette: Math.min(0.65, (frame.config.environment.depth + mappedDepth * 0.5 + mappedFog * 0.18) * 0.28),
    chromaticAberration: Math.min(
      1,
      material.chromaticAberration + (eventHorizon?.chromaticAberrationBoost ?? 0) + mappedChromatic * 0.65,
    ),
    filmGrain: Math.min(0.18, (frame.config.environment.atmosphere + mappedParticles * 0.35 + mappedFog * 0.16) * 0.07 * (0.65 + quality.particleScale * 0.35)),
    // Feedback is deliberately capped and quality-scaled so recursive worlds
    // stay readable instead of accumulating into a permanent full-frame smear.
    feedback: Math.min(
      (mirror ? 0.48 : 0.62) * quality.feedbackScale,
      requestedFeedback * quality.feedbackScale,
    ),
    toneMapping: true,
    exposure: 0.85 + frame.params.intensity * 0.5 + mappedBrightness * 0.35,
  }
}

const COMMON_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uTime;
`

const PASS_SOURCES = {
  copy: `${COMMON_HEADER}
void main() { outColor = texture(uSource, v_uv); }
`,
  bloom: `${COMMON_HEADER}
void main() {
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  vec3 base = texture(uSource, v_uv).rgb;
  vec3 glow = vec3(0.0);
  glow += texture(uSource, v_uv + vec2( px.x, 0.0) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(-px.x, 0.0) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(0.0,  px.y) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(0.0, -px.y) * 2.0).rgb;
  glow *= 0.25;
  glow = max(glow - vec3(0.28), vec3(0.0));
  outColor = vec4(base + glow * (0.5 + uAmount * 1.7), 1.0);
}
`,
  vignette: `${COMMON_HEADER}
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float edge = smoothstep(1.25, 0.2, dot(p, p));
  vec3 color = texture(uSource, v_uv).rgb;
  outColor = vec4(color * mix(1.0, edge, uAmount), 1.0);
}
`,
  chromatic: `${COMMON_HEADER}
void main() {
  vec2 p = v_uv - 0.5;
  vec2 shift = normalize(p + vec2(0.0001)) * (uAmount * 0.008);
  float r = texture(uSource, v_uv + shift).r;
  float g = texture(uSource, v_uv).g;
  float b = texture(uSource, v_uv - shift).b;
  outColor = vec4(r, g, b, 1.0);
}
`,
  grain: `${COMMON_HEADER}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 19.19) * 43758.5453);
}
void main() {
  vec3 color = texture(uSource, v_uv).rgb;
  float grain = (hash(gl_FragCoord.xy) - 0.5) * uAmount;
  outColor = vec4(color + grain, 1.0);
}
`,
  feedback: `${COMMON_HEADER}
uniform sampler2D uHistory;
void main() {
  vec2 centered = v_uv - 0.5;
  vec2 drift = vec2(sin(uTime * 0.17), cos(uTime * 0.13)) * 0.0012 * uAmount;
  vec2 historyUv = 0.5 + centered * (1.0 + 0.008 * uAmount) + drift;
  vec3 current = texture(uSource, v_uv).rgb;
  vec3 history = texture(uHistory, clamp(historyUv, vec2(0.001), vec2(0.999))).rgb * 0.925;
  float currentLuma = dot(current, vec3(0.2126, 0.7152, 0.0722));
  float historyLuma = dot(history, vec3(0.2126, 0.7152, 0.0722));
  float readability = smoothstep(0.02, 0.22, currentLuma + historyLuma * 0.35);
  float blend = uAmount * 0.72 * readability;
  outColor = vec4(mix(current, current + history * 0.62, blend), 1.0);
}
`,
  tone: `${COMMON_HEADER}
uniform float uExposure;
void main() {
  vec3 color = max(texture(uSource, v_uv).rgb * uExposure, vec3(0.0));
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}
`,
  final: `${COMMON_HEADER}
void main() { outColor = vec4(texture(uSource, v_uv).rgb, 1.0); }
`,
} as const

type ProgramName = keyof typeof PASS_SOURCES

/**
 * Reusable lazy post stack. Programs compile only when their pass is first
 * enabled, while framebuffers are retained and resized only when dimensions
 * change. No GPU objects are allocated from render().
 */
export class CinematicPostProcessingPipeline {
  private readonly fullscreen: FullscreenPass
  private readonly compiler: ShaderCompiler
  private readonly programs = new Map<ProgramName, ShaderProgram>()
  private readonly workA: ShaderFramebuffer
  private readonly workB: ShaderFramebuffer
  private readonly feedbackHistory: ShaderFramebuffer
  private width = 0
  private height = 0
  private feedbackReady = false
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.fullscreen = new FullscreenPass(gl)
    this.compiler = new ShaderCompiler(gl)
    this.workA = new ShaderFramebuffer(gl)
    this.workB = new ShaderFramebuffer(gl)
    this.feedbackHistory = new ShaderFramebuffer(gl)
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const W = Math.max(1, Math.floor(width))
    const H = Math.max(1, Math.floor(height))
    if (W === this.width && H === this.height) return
    this.width = W
    this.height = H
    this.workA.resize(W, H)
    this.workB.resize(W, H)
    this.feedbackHistory.resize(W, H)
    this.clearFeedback()
  }

  render(
    sourceTexture: WebGLTexture,
    frame: CinematicFrameContext,
    settings = resolveCinematicPostProcessSettings(frame),
  ): void {
    if (this.disposed || this.width <= 0 || this.height <= 0) return

    let source = sourceTexture
    let passIndex = 0

    if (settings.bloom > 0.001) {
      source = this.runSingle('bloom', source, this.workTarget(passIndex++), settings.bloom, frame.elapsedTimeSec)
    }
    if (settings.chromaticAberration > 0.001) {
      source = this.runSingle('chromatic', source, this.workTarget(passIndex++), settings.chromaticAberration, frame.elapsedTimeSec)
    }
    if (settings.vignette > 0.001) {
      source = this.runSingle('vignette', source, this.workTarget(passIndex++), settings.vignette, frame.elapsedTimeSec)
    }
    if (settings.filmGrain > 0.001) {
      source = this.runSingle('grain', source, this.workTarget(passIndex++), settings.filmGrain, frame.elapsedTimeSec)
    }
    if (settings.feedback > 0.001 && this.feedbackHistory.texture) {
      const target = this.workTarget(passIndex++)
      const program = this.getProgram('feedback')
      program.activate()
      program.setVec2('uResolution', this.width, this.height)
      program.setFloat('uAmount', settings.feedback)
      program.setFloat('uTime', frame.elapsedTimeSec)
      this.fullscreen.run(program, target.framebuffer, this.width, this.height, [
        { unit: 0, texture: source, uniformName: 'uSource' },
        { unit: 1, texture: this.feedbackHistory.texture, uniformName: 'uHistory' },
      ], { clear: true })
      source = target.texture ?? source
    }
    if (settings.toneMapping) {
      const target = this.workTarget(passIndex++)
      const program = this.getProgram('tone')
      program.activate()
      program.setVec2('uResolution', this.width, this.height)
      program.setFloat('uAmount', 1)
      program.setFloat('uTime', frame.elapsedTimeSec)
      program.setFloat('uExposure', settings.exposure)
      this.fullscreen.run(program, target.framebuffer, this.width, this.height, [
        { unit: 0, texture: source, uniformName: 'uSource' },
      ], { clear: true })
      source = target.texture ?? source
    }

    if (settings.feedback > 0.001) {
      this.copyTo(source, this.feedbackHistory)
      this.feedbackReady = true
    } else if (this.feedbackReady) {
      this.clearFeedback()
    }

    const finalProgram = this.getProgram('final')
    finalProgram.activate()
    finalProgram.setVec2('uResolution', this.width, this.height)
    finalProgram.setFloat('uAmount', 1)
    finalProgram.setFloat('uTime', frame.elapsedTimeSec)
    this.fullscreen.run(finalProgram, null, this.width, this.height, [
      { unit: 0, texture: source, uniformName: 'uSource' },
    ], { clear: true })
  }

  clearFeedback(): void {
    if (!this.feedbackHistory.framebuffer || this.width <= 0 || this.height <= 0) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.feedbackHistory.framebuffer)
    this.gl.viewport(0, 0, this.width, this.height)
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.feedbackReady = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const program of this.programs.values()) program.dispose()
    this.programs.clear()
    this.workA.dispose()
    this.workB.dispose()
    this.feedbackHistory.dispose()
    this.fullscreen.dispose()
  }

  private workTarget(index: number): ShaderFramebuffer {
    return index % 2 === 0 ? this.workA : this.workB
  }

  private runSingle(
    name: ProgramName,
    source: WebGLTexture,
    target: ShaderFramebuffer,
    amount: number,
    time: number,
  ): WebGLTexture {
    const program = this.getProgram(name)
    program.activate()
    program.setVec2('uResolution', this.width, this.height)
    program.setFloat('uAmount', amount)
    program.setFloat('uTime', time)
    this.fullscreen.run(program, target.framebuffer, this.width, this.height, [
      { unit: 0, texture: source, uniformName: 'uSource' },
    ], { clear: true })
    return target.texture ?? source
  }

  private copyTo(source: WebGLTexture, target: ShaderFramebuffer): void {
    const program = this.getProgram('copy')
    program.activate()
    program.setVec2('uResolution', this.width, this.height)
    program.setFloat('uAmount', 1)
    program.setFloat('uTime', 0)
    this.fullscreen.run(program, target.framebuffer, this.width, this.height, [
      { unit: 0, texture: source, uniformName: 'uSource' },
    ], { clear: true })
  }

  private getProgram(name: ProgramName): ShaderProgram {
    const existing = this.programs.get(name)
    if (existing) return existing
    const result = ShaderProgram.create(this.gl, this.compiler, {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: PASS_SOURCES[name],
      label: `cinematic/post/${name}`,
    })
    if (!result.program) {
      throw new Error(`Cinematic post-processing pass "${name}" failed: ${result.error.log}`)
    }
    this.programs.set(name, result.program)
    return result.program
  }
}
