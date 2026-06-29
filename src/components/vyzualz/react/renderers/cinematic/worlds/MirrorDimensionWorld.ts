import { resolveMirrorDimensionSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { MIRROR_DIMENSION_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uRecursionDepth', settings.recursionDepth)
    program.setFloat('uChamberDepth', settings.chamberDepth)
    program.setFloat('uMirrorScale', settings.mirrorScale)
    program.setFloat('uFeedbackAmount', settings.feedbackAmount)
    program.setFloat('uFeedbackDrift', settings.feedbackDrift)
    program.setFloat('uSnapStrength', settings.snapStrength)
    program.setFloat('uFoldStrength', settings.foldStrength)
    program.setFloat('uRotationSpeed', settings.rotationSpeed)
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
    modulationTargets: ['depth', 'feedback', 'distortion', 'chromaticAberration', 'glow', 'portalPulse'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new MirrorDimensionWorld(),
}
