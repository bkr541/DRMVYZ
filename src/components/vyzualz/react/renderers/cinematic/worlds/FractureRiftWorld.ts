import { resolveFractureRiftSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { FRACTURE_RIFT_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

const UNIFORMS = [
  'uOpeningAmount',
  'uEdgeComplexity',
  'uShardDensity',
  'uCrackPropagation',
  'uFractureMotion',
  'uInnerDepth',
  'uShardDrift',
  'uOpeningShape',
  'uInnerSurface',
] as const

class FractureRiftWorld extends FullscreenCinematicWorld {
  constructor() {
    super('fractureRift', FRACTURE_RIFT_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveFractureRiftSettings(frame.config.worldSettings)
    program.setFloat('uOpeningAmount', settings.openingAmount)
    program.setFloat('uEdgeComplexity', settings.edgeComplexity)
    program.setFloat('uShardDensity', settings.shardDensity)
    program.setFloat('uCrackPropagation', settings.crackPropagation)
    program.setFloat('uFractureMotion', settings.fractureMotion)
    program.setFloat('uInnerDepth', settings.innerDepth)
    program.setFloat('uShardDrift', settings.shardDrift)
    program.setFloat('uOpeningShape', settings.openingShape)
    program.setFloat('uInnerSurface', settings.innerSurface)
  }
}

export const fractureRiftWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'fractureRift',
  label: 'Fracture Rift',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['depth', 'debris', 'distortion', 'refraction', 'chromaticAberration', 'glow'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new FractureRiftWorld(),
}
