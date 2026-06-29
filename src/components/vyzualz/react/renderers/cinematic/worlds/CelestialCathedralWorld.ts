import { resolveCelestialCathedralSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { CELESTIAL_CATHEDRAL_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uCathedralScale', settings.cathedralScale)
    program.setFloat('uArchCount', settings.archCount)
    program.setFloat('uPillarCount', settings.pillarCount)
    program.setFloat('uRibDensity', settings.ribDensity)
    program.setFloat('uAisleDepth', settings.aisleDepth)
    program.setFloat('uLightShaftIntensity', settings.lightShaftIntensity)
    program.setFloat('uStarDensity', settings.starDensity)
    program.setFloat('uMajesticSpeed', settings.majesticSpeed)
    program.setFloat('uCameraDrift', settings.cameraDrift)
    program.setFloat('uIlluminationResponse', settings.illuminationResponse)
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
    modulationTargets: ['depth', 'fog', 'atmosphere', 'bloom', 'glow', 'cameraMotion'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new CelestialCathedralWorld(),
}
