import { resolveInfiniteCorridorSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { INFINITE_CORRIDOR_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
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

const infiniteCorridorDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['dolly', 'flyThrough', 'handheld', 'autoDirector'],
  safeCameraRange: { minDistance: 0.35, maxDistance: 5.8, maxLateral: 0.95, minElevation: -0.55, maxElevation: 0.8 },
  shots: [
    { id: 'corridor-establish', rig: 'dolly', sections: ['intro', 'breakdown', 'outro'], action: 'establish', pose: { position: { z: 4.6 }, fieldOfView: 72 } },
    { id: 'corridor-dolly', rig: 'dolly', sections: ['verse', 'build', 'bridge'], action: 'approach', weight: 1.4 },
    { id: 'corridor-tension', rig: 'handheld', sections: ['preDrop'], action: 'focus', pose: { position: { z: 1.15 }, fieldOfView: 48 } },
    { id: 'corridor-flight', rig: 'flyThrough', sections: ['drop'], action: 'travel', weight: 1.6, minimumDurationSec: 4 },
    { id: 'corridor-fallback', rig: 'dolly', sections: ['unknown'], action: 'hold' },
  ],
  dropActions: ['travel', 'impact', 'reveal'],
  revealActions: ['travel', 'open'],
  retreatActions: ['retreat', 'close'],
  flyThroughPaths: [[
    { position: { x: 0, y: 0.08, z: 5.4 }, fieldOfView: 72 },
    { position: { x: -0.32, y: 0.02, z: 3.2 }, rotation: { z: -0.04 }, fieldOfView: 64 },
    { position: { x: 0.24, y: -0.04, z: 1.5 }, rotation: { z: 0.05 }, fieldOfView: 58 },
    { position: { x: 0, y: 0, z: 0.48 }, fieldOfView: 68 },
  ]],
})

export const infiniteCorridorWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'infiniteCorridor',
  label: 'Infinite Corridor',
  backend: 'webgl2',
  direction: infiniteCorridorDirection,
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
