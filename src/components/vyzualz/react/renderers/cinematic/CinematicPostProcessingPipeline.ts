import type { CinematicFrameContext } from '../CinematicWorldRenderer'
import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderFramebuffer } from '../../shaders/runtime/ShaderFramebuffer'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { cinematicModulationValue } from './CinematicAudioModulation'
import {
  CINEMATIC_POST_PROCESS_PASS_SOURCES,
  type CinematicPostProcessProgramName,
} from '../../../shared/CinematicPostProcessPasses'
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

/**
 * Reusable lazy post stack. Programs compile only when their pass is first
 * enabled, while framebuffers are retained and resized only when dimensions
 * change. No GPU objects are allocated from render().
 */
export class CinematicPostProcessingPipeline {
  private readonly fullscreen: FullscreenPass
  private readonly compiler: ShaderCompiler
  private readonly programs = new Map<CinematicPostProcessProgramName, ShaderProgram>()
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
    name: CinematicPostProcessProgramName,
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

  private getProgram(name: CinematicPostProcessProgramName): ShaderProgram {
    const existing = this.programs.get(name)
    if (existing) return existing
    const result = ShaderProgram.create(this.gl, this.compiler, {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: CINEMATIC_POST_PROCESS_PASS_SOURCES[name],
      label: `cinematic/post/${name}`,
    })
    if (!result.program) {
      throw new Error(`Cinematic post-processing pass "${name}" failed: ${result.error.log}`)
    }
    this.programs.set(name, result.program)
    return result.program
  }
}
