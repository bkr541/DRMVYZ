import { resolveStormGatewaySettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { STORM_GATEWAY_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uStormIntensity',
  'uCloudDensity',
  'uCloudLayers',
  'uVortexStrength',
  'uWindSpeed',
  'uDebrisDensity',
  'uLightningFrequency',
  'uLightningBranching',
  'uGatewayRadius',
  'uAtmosphericDepth',
  'uTurbulence',
  'uLightningResponse',
] as const

class StormGatewayWorld extends FullscreenCinematicWorld {
  constructor() {
    super('stormGateway', STORM_GATEWAY_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveStormGatewaySettings(frame.config.worldSettings)
    program.setFloat('uStormIntensity', applyCinematicModulation(settings.stormIntensity, frame.modulation, 'distortion', 0.8, 0, 2))
    program.setFloat('uCloudDensity', applyCinematicModulation(settings.cloudDensity, frame.modulation, 'fogDensity', 0.55, 0, 1.5))
    program.setFloat('uCloudLayers', settings.cloudLayers)
    program.setFloat('uVortexStrength', applyCinematicModulation(settings.vortexStrength, frame.modulation, 'portalAperture', 0.9, 0, 2.5))
    program.setFloat('uWindSpeed', settings.windSpeed)
    program.setFloat('uDebrisDensity', applyCinematicModulation(settings.debrisDensity, frame.modulation, 'particleEmission', 0.9, 0, 2))
    program.setFloat('uLightningFrequency', applyCinematicModulation(settings.lightningFrequency, frame.modulation, 'lightning', 1.8, 0, 4))
    program.setFloat('uLightningBranching', settings.lightningBranching)
    program.setFloat('uGatewayRadius', settings.gatewayRadius)
    program.setFloat('uAtmosphericDepth', applyCinematicModulation(settings.atmosphericDepth, frame.modulation, 'depth', 0.85, 0, 2.5))
    program.setFloat('uTurbulence', applyCinematicModulation(settings.turbulence, frame.modulation, 'distortion', 1.2, 0, 3))
    program.setFloat('uLightningResponse', applyCinematicModulation(settings.lightningResponse, frame.modulation, 'lightning', 1.2, 0, 2.5))
  }
}

export const stormGatewayWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'stormGateway',
  label: 'Storm Gateway',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['portalAperture', 'depth', 'cameraPunch', 'fogDensity', 'particleEmission', 'lightning', 'environmentBrightness', 'distortion', 'bloom', 'chromaticAberration', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new StormGatewayWorld(),
}
