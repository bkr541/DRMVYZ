import { resolveEventHorizonSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { EVENT_HORIZON_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uCoreRadius',
  'uRingRadius',
  'uRingThickness',
  'uAccretionTilt',
  'uLensingStrength',
  'uDepthLayers',
  'uRotationSpeed',
  'uShockwaveStrength',
  'uDropExpansion',
] as const

class EventHorizonWorld extends FullscreenCinematicWorld {
  constructor() {
    super('eventHorizon', EVENT_HORIZON_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveEventHorizonSettings(frame.config.worldSettings)
    program.setFloat('uCoreRadius', applyCinematicModulation(settings.coreRadius, frame.modulation, 'portalAperture', 0.18, 0.05, 0.9))
    program.setFloat('uRingRadius', applyCinematicModulation(settings.ringRadius, frame.modulation, 'portalAperture', 0.25, 0.08, 1.4))
    program.setFloat('uRingThickness', applyCinematicModulation(settings.ringThickness, frame.modulation, 'distortion', 0.22, 0.01, 0.8))
    program.setFloat('uAccretionTilt', settings.accretionTilt)
    program.setFloat('uLensingStrength', applyCinematicModulation(settings.lensingStrength, frame.modulation, 'lensing', 1.1, 0, 2.5))
    program.setFloat('uDepthLayers', applyCinematicModulation(settings.depthLayers, frame.modulation, 'depth', 3, 1, 12))
    program.setFloat('uRotationSpeed', applyCinematicModulation(settings.rotationSpeed, frame.modulation, 'geometryRotation', 1.2, -3, 3))
    program.setFloat('uShockwaveStrength', applyCinematicModulation(settings.shockwaveStrength, frame.modulation, 'impact', 1.35, 0, 2.5))
    program.setFloat('uDropExpansion', settings.dropExpansion)
  }
}

const eventHorizonDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'orbit', 'autoDirector'],
  safeCameraRange: { minDistance: 0.8, maxDistance: 4.6, maxLateral: 1.1 },
  shots: [
    { id: 'horizon-establish', rig: 'locked', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 3.4 }, fieldOfView: 72 } },
    { id: 'horizon-slow-orbit', rig: 'orbit', sections: ['verse', 'build', 'bridge'], action: 'orbit', weight: 1.4 },
    { id: 'horizon-focus', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { z: 1.08 }, fieldOfView: 43 } },
    { id: 'horizon-reveal', rig: 'orbit', sections: ['drop'], action: 'reveal', pose: { fieldOfView: 68 }, minimumDurationSec: 4 },
    { id: 'horizon-hold', rig: 'locked', sections: ['unknown'], action: 'hold' },
  ],
  dropActions: ['impact', 'reveal', 'open'],
  revealActions: ['reveal', 'open'],
  retreatActions: ['retreat', 'close'],
})

export const eventHorizonWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'eventHorizon',
  label: 'Event Horizon',
  backend: 'webgl2',
  direction: eventHorizonDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'autoDirector'],
    modulationTargets: ['portalAperture', 'depth', 'lensing', 'distortion', 'geometryRotation', 'bloom', 'chromaticAberration', 'environmentBrightness', 'feedback', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new EventHorizonWorld(),
}
