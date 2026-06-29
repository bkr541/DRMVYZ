import { resolveCelestialCathedralSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { CELESTIAL_CATHEDRAL_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uCathedralScale',
  'uArchCount',
  'uPillarCount',
  'uRibDensity',
  'uAisleDepth',
  'uLightShaftIntensity',
  'uStarDensity',
  'uMajesticSpeed',
  'uCameraDrift',
  'uIlluminationResponse',
  'uArchitectureStyle',
] as const

class CelestialCathedralWorld extends FullscreenCinematicWorld {
  constructor() {
    super('celestialCathedral', CELESTIAL_CATHEDRAL_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveCelestialCathedralSettings(frame.config.worldSettings)
    program.setFloat('uCathedralScale', applyCinematicModulation(settings.cathedralScale, frame.modulation, 'depth', 0.6, 0.4, 3))
    program.setFloat('uArchCount', settings.archCount)
    program.setFloat('uPillarCount', settings.pillarCount)
    program.setFloat('uRibDensity', settings.ribDensity)
    program.setFloat('uAisleDepth', applyCinematicModulation(settings.aisleDepth, frame.modulation, 'depth', 1.2, 0.4, 5))
    program.setFloat('uLightShaftIntensity', applyCinematicModulation(settings.lightShaftIntensity, frame.modulation, 'environmentBrightness', 1.25, 0, 2.5))
    program.setFloat('uStarDensity', applyCinematicModulation(settings.starDensity, frame.modulation, 'particleEmission', 0.8, 0, 1.8))
    program.setFloat('uMajesticSpeed', settings.majesticSpeed)
    program.setFloat('uCameraDrift', applyCinematicModulation(settings.cameraDrift, frame.modulation, 'cameraTravel', 0.55, 0, 1.5))
    program.setFloat('uIlluminationResponse', applyCinematicModulation(settings.illuminationResponse, frame.modulation, 'impact', 0.8, 0, 2))
    program.setFloat('uArchitectureStyle', settings.architectureStyle)
  }
}

export const celestialCathedralWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'celestialCathedral',
  label: 'Celestial Cathedral',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'flyThrough', 'autoDirector'],
    modulationTargets: ['depth', 'cameraTravel', 'fogDensity', 'particleEmission', 'environmentBrightness', 'bloom', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new CelestialCathedralWorld(),
}
