import { resolveMonolithGateSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { MONOLITH_GATE_FRAGMENT_SOURCE } from './CinematicWorldShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

const UNIFORMS = [
  'uGateScale',
  'uColumnCount',
  'uSlabDepth',
  'uRingCount',
  'uLightShaftIntensity',
  'uGlyphDensity',
  'uOpeningAmount',
  'uLockStrength',
  'uCameraTravel',
  'uArchitectureStyle',
] as const

function sectionGateState(frame: CinematicFrameContext, openingAmount: number, lockStrength: number): {
  opening: number
  lock: number
} {
  const progress = frame.section.progress >= 0 && frame.section.progress <= 1
    ? frame.section.progress
    : 0.5
  switch (frame.section.type) {
    case 'intro': return { opening: openingAmount * 0.28, lock: 1 }
    case 'build': return { opening: Math.max(openingAmount, progress * 0.86), lock: 1 - progress }
    case 'drop': return { opening: 1, lock: 0 }
    case 'breakdown': return { opening: openingAmount * 0.62, lock: lockStrength * 0.45 }
    case 'outro': return { opening: openingAmount * (1 - progress) * 0.42, lock: Math.max(lockStrength, progress) }
    default: return { opening: openingAmount, lock: lockStrength }
  }
}

class MonolithGateWorld extends FullscreenCinematicWorld {
  constructor() {
    super('monolithGate', MONOLITH_GATE_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveMonolithGateSettings(frame.config.worldSettings)
    const gateState = sectionGateState(frame, settings.openingAmount, settings.lockStrength)
    program.setFloat('uGateScale', settings.gateScale)
    program.setFloat('uColumnCount', settings.columnCount)
    program.setFloat('uSlabDepth', settings.slabDepth)
    program.setFloat('uRingCount', settings.ringCount)
    program.setFloat('uLightShaftIntensity', settings.lightShaftIntensity)
    program.setFloat('uGlyphDensity', settings.glyphDensity)
    program.setFloat('uOpeningAmount', gateState.opening)
    program.setFloat('uLockStrength', gateState.lock)
    program.setFloat('uCameraTravel', settings.cameraTravel)
    program.setFloat('uArchitectureStyle', settings.architectureStyle)
  }
}

export const monolithGateWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'monolithGate',
  label: 'Monolith Gate',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'],
    modulationTargets: ['depth', 'fog', 'atmosphere', 'bloom', 'glow', 'cameraMotion'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new MonolithGateWorld(),
}
