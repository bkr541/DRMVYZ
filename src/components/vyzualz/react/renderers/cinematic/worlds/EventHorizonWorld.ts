import { resolveEventHorizonSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { EVENT_HORIZON_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uCoreRadius', settings.coreRadius)
    program.setFloat('uRingRadius', settings.ringRadius)
    program.setFloat('uRingThickness', settings.ringThickness)
    program.setFloat('uAccretionTilt', settings.accretionTilt)
    program.setFloat('uLensingStrength', settings.lensingStrength)
    program.setFloat('uDepthLayers', settings.depthLayers)
    program.setFloat('uRotationSpeed', settings.rotationSpeed)
    program.setFloat('uShockwaveStrength', settings.shockwaveStrength)
    program.setFloat('uDropExpansion', settings.dropExpansion)
  }
}

export const eventHorizonWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'eventHorizon',
  label: 'Event Horizon',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'autoDirector'],
    modulationTargets: ['depth', 'distortion', 'bloom', 'chromaticAberration', 'glow', 'portalPulse'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: true,
  },
  create: () => new EventHorizonWorld(),
}
