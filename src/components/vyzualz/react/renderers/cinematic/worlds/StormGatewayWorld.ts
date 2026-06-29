import { resolveStormGatewaySettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { STORM_GATEWAY_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uStormIntensity', settings.stormIntensity)
    program.setFloat('uCloudDensity', settings.cloudDensity)
    program.setFloat('uCloudLayers', settings.cloudLayers)
    program.setFloat('uVortexStrength', settings.vortexStrength)
    program.setFloat('uWindSpeed', settings.windSpeed)
    program.setFloat('uDebrisDensity', settings.debrisDensity)
    program.setFloat('uLightningFrequency', settings.lightningFrequency)
    program.setFloat('uLightningBranching', settings.lightningBranching)
    program.setFloat('uGatewayRadius', settings.gatewayRadius)
    program.setFloat('uAtmosphericDepth', settings.atmosphericDepth)
    program.setFloat('uTurbulence', settings.turbulence)
    program.setFloat('uLightningResponse', settings.lightningResponse)
  }
}

export const stormGatewayWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'stormGateway',
  label: 'Storm Gateway',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'],
    modulationTargets: ['depth', 'fog', 'debris', 'atmosphere', 'distortion', 'bloom', 'cameraMotion'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new StormGatewayWorld(),
}
