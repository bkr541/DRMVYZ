import { resolveInfiniteCorridorSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { INFINITE_CORRIDOR_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { applyCinematicModulation } from '../CinematicAudioModulation'

const UNIFORMS = [
  'uCorridorDensity',
  'uTravelSpeed',
  'uTunnelWidth',
  'uArchThickness',
  'uAlternatingLights',
  'uFogDensity',
  'uCameraSway',
  'uVanishingOffset',
  'uStructureStyle',
] as const

class InfiniteCorridorWorld extends FullscreenCinematicWorld {
  constructor() {
    super('infiniteCorridor', INFINITE_CORRIDOR_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveInfiniteCorridorSettings(frame.config.worldSettings)
    program.setFloat('uCorridorDensity', applyCinematicModulation(settings.corridorDensity, frame.modulation, 'depth', 1.6, 1, 12))
    program.setFloat('uTravelSpeed', applyCinematicModulation(settings.travelSpeed, frame.modulation, 'cameraTravel', 2.1, 0, 6))
    program.setFloat('uTunnelWidth', settings.tunnelWidth)
    program.setFloat('uArchThickness', settings.archThickness)
    program.setFloat('uAlternatingLights', applyCinematicModulation(settings.alternatingLights, frame.modulation, 'environmentBrightness', 0.9, 0, 2))
    program.setFloat('uFogDensity', applyCinematicModulation(settings.fogDensity, frame.modulation, 'fogDensity', 0.45, 0, 1))
    program.setFloat('uCameraSway', applyCinematicModulation(settings.cameraSway, frame.modulation, 'cameraPunch', 0.38, 0, 1.5))
    program.setFloat('uVanishingOffset', settings.vanishingOffset)
    program.setFloat('uStructureStyle', settings.structureStyle)
  }
}

export const infiniteCorridorWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'infiniteCorridor',
  label: 'Infinite Corridor',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['dolly', 'flyThrough', 'handheld', 'autoDirector'],
    modulationTargets: ['depth', 'cameraPunch', 'cameraTravel', 'fogDensity', 'environmentBrightness', 'bloom', 'impact'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new InfiniteCorridorWorld(),
}
