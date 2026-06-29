import { resolveMirrorDimensionSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { MIRROR_DIMENSION_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uSymmetryCount',
  'uRecursionDepth',
  'uChamberDepth',
  'uMirrorScale',
  'uFeedbackAmount',
  'uFeedbackDrift',
  'uSnapStrength',
  'uFoldStrength',
  'uRotationSpeed',
  'uStructureStyle',
] as const

class MirrorDimensionWorld extends FullscreenCinematicWorld {
  constructor() {
    super('mirrorDimension', MIRROR_DIMENSION_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveMirrorDimensionSettings(frame.config.worldSettings)
    program.setFloat('uSymmetryCount', settings.symmetryCount)
    program.setFloat('uRecursionDepth', applyCinematicModulation(settings.recursionDepth, frame.modulation, 'depth', 2.5, 1, 10))
    program.setFloat('uChamberDepth', applyCinematicModulation(settings.chamberDepth, frame.modulation, 'depth', 1.1, 0.2, 4))
    program.setFloat('uMirrorScale', settings.mirrorScale)
    program.setFloat('uFeedbackAmount', applyCinematicModulation(settings.feedbackAmount, frame.modulation, 'feedback', 0.42, 0, 0.85))
    program.setFloat('uFeedbackDrift', settings.feedbackDrift)
    program.setFloat('uSnapStrength', applyCinematicModulation(settings.snapStrength, frame.modulation, 'impact', 1.1, 0, 2.5))
    program.setFloat('uFoldStrength', applyCinematicModulation(settings.foldStrength, frame.modulation, 'distortion', 0.9, 0, 2.5))
    program.setFloat('uRotationSpeed', applyCinematicModulation(settings.rotationSpeed, frame.modulation, 'geometryRotation', 1.4, -3, 3))
    program.setFloat('uStructureStyle', settings.structureStyle)
  }
}

export const mirrorDimensionWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'mirrorDimension',
  label: 'Mirror Dimension',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'autoDirector'],
    modulationTargets: ['depth', 'geometryRotation', 'feedback', 'distortion', 'chromaticAberration', 'environmentBrightness', 'bloom', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new MirrorDimensionWorld(),
}
