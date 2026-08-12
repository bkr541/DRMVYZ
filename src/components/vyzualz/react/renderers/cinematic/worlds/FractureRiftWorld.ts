import { resolveFractureRiftSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { FRACTURE_RIFT_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import { applyCinematicModulation } from '../CinematicAudioModulation'

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
    program.setFloat('uOpeningAmount', applyCinematicModulation(settings.openingAmount, frame.modulation, 'portalAperture', 0.65, 0, 1))
    program.setFloat('uEdgeComplexity', settings.edgeComplexity)
    program.setFloat('uShardDensity', applyCinematicModulation(settings.shardDensity, frame.modulation, 'particleEmission', 0.7, 0, 1.5))
    program.setFloat('uCrackPropagation', applyCinematicModulation(settings.crackPropagation, frame.modulation, 'fractureAmount', 0.8, 0, 1.6))
    program.setFloat('uFractureMotion', applyCinematicModulation(settings.fractureMotion, frame.modulation, 'fractureAmount', 1.1, 0, 2.5))
    program.setFloat('uInnerDepth', applyCinematicModulation(settings.innerDepth, frame.modulation, 'depth', 0.8, 0, 2))
    program.setFloat('uShardDrift', applyCinematicModulation(settings.shardDrift, frame.modulation, 'distortion', 0.9, 0, 2.5))
    program.setFloat('uOpeningShape', settings.openingShape)
    program.setFloat('uInnerSurface', applyCinematicModulation(settings.innerSurface, frame.modulation, 'refraction', 0.8, 0, 2))
  }
}

const fractureRiftDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
  safeCameraRange: { minDistance: 0.65, maxDistance: 4.1, maxLateral: 1.0 },
  shots: [
    { id: 'rift-distant', rig: 'locked', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 3.2 }, fieldOfView: 70 } },
    { id: 'rift-orbit', rig: 'orbit', sections: ['verse', 'build', 'bridge'], action: 'orbit' },
    { id: 'rift-tension', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { z: 1.12 }, fieldOfView: 44 } },
    { id: 'rift-impact', rig: 'handheld', sections: ['drop'], action: 'impact', minimumDurationSec: 4 },
    { id: 'rift-fallback', rig: 'locked', sections: ['unknown'], action: 'hold' },
  ],
  dropActions: ['impact', 'open', 'reveal'],
  revealActions: ['open', 'reveal'],
  retreatActions: ['retreat', 'close'],
})

export const fractureRiftWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'fractureRift',
  label: 'Fracture Rift',
  backend: 'webgl2',
  direction: fractureRiftDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['portalAperture', 'depth', 'fractureAmount', 'particleEmission', 'distortion', 'refraction', 'chromaticAberration', 'environmentBrightness', 'impact'],
    paletteRoles: ['primary', 'secondary', 'accent'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new FractureRiftWorld(),
}
