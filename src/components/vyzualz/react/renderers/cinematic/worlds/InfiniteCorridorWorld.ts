import { resolveInfiniteCorridorSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { INFINITE_CORRIDOR_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

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
    program.setFloat('uCorridorDensity', settings.corridorDensity)
    program.setFloat('uTravelSpeed', settings.travelSpeed)
    program.setFloat('uTunnelWidth', settings.tunnelWidth)
    program.setFloat('uArchThickness', settings.archThickness)
    program.setFloat('uAlternatingLights', settings.alternatingLights)
    program.setFloat('uFogDensity', settings.fogDensity)
    program.setFloat('uCameraSway', settings.cameraSway)
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
    modulationTargets: ['depth', 'fog', 'atmosphere', 'glow', 'cameraMotion'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new InfiniteCorridorWorld(),
}
