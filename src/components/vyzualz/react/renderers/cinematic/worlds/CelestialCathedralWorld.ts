import { resolveCelestialCathedralSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { CELESTIAL_CATHEDRAL_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
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

const celestialCathedralDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked', 'dolly', 'flyThrough', 'autoDirector'],
  safeCameraRange: { minDistance: 0.45, maxDistance: 6.2, maxLateral: 1.3, minElevation: -0.4, maxElevation: 1.8, maxFieldOfView: 86 },
  shots: [
    { id: 'cathedral-establish', rig: 'locked', sections: ['intro', 'breakdown'], action: 'establish', pose: { position: { y: 0.35, z: 5.2 }, fieldOfView: 78 } },
    { id: 'cathedral-dolly', rig: 'dolly', sections: ['verse', 'build', 'bridge'], action: 'approach', weight: 1.4 },
    { id: 'cathedral-focus', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { y: 0.1, z: 1.3 } } },
    { id: 'cathedral-flight', rig: 'flyThrough', sections: ['drop'], action: 'reveal', minimumDurationSec: 5 },
    { id: 'cathedral-retreat', rig: 'dolly', sections: ['outro'], action: 'retreat', pose: { position: { z: 5.7 }, fieldOfView: 80 } },
    { id: 'cathedral-fallback', rig: 'locked', sections: ['unknown'], action: 'hold' },
  ],
  dropActions: ['reveal', 'travel', 'impact'],
  revealActions: ['reveal', 'open'],
  retreatActions: ['retreat', 'close'],
  flyThroughPaths: [[
    { position: { x: 0, y: 0.45, z: 6.0 }, fieldOfView: 80 },
    { position: { x: -0.5, y: 0.28, z: 4.0 }, rotation: { z: -0.04 }, fieldOfView: 70 },
    { position: { x: 0.4, y: 0.16, z: 2.0 }, rotation: { z: 0.04 }, fieldOfView: 62 },
    { position: { x: 0, y: 0.08, z: 0.58 }, fieldOfView: 72 },
  ]],
})

export const celestialCathedralWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'celestialCathedral',
  label: 'Celestial Cathedral',
  backend: 'webgl2',
  direction: celestialCathedralDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'flyThrough', 'autoDirector'],
    modulationTargets: ['depth', 'cameraTravel', 'fogDensity', 'particleEmission', 'environmentBrightness', 'bloom', 'impact'],
    paletteRoles: ['primary', 'secondary', 'accent'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new CelestialCathedralWorld(),
}
