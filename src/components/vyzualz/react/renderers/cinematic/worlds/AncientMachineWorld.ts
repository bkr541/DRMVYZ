import { resolveAncientMachineSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLWorldDefinition } from '../../CinematicWorldRenderer'
import { ANCIENT_MACHINE_FRAGMENT_SOURCE } from './CinematicWorldPackBShaders'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

const UNIFORMS = [
  'uGateRadius',
  'uRingCount',
  'uGearCount',
  'uGlyphDensity',
  'uRotationSpeed',
  'uLockProgress',
  'uUnlockResponse',
  'uRadialComplexity',
  'uMechanicalDepth',
  'uMechanicalProgress',
  'uUnlockState',
  'uToothDensity',
] as const

function trustedBarProgress(frame: CinematicFrameContext): number | null {
  return frame.beat.barIndex >= 0 && frame.beat.beatInBar >= 0
    ? frame.beat.barProgress
    : null
}

function mechanicalProgress(frame: CinematicFrameContext, mode: number): number {
  const bar = trustedBarProgress(frame)
  if (mode === 1) return frame.beat.phase
  if (mode === 2 && frame.section.progress >= 0 && frame.section.progress <= 1) {
    return frame.section.progress
  }
  return bar ?? frame.beat.phase
}

function unlockState(frame: CinematicFrameContext, lockProgress: number, response: number): number {
  const progress = frame.section.progress >= 0 && frame.section.progress <= 1
    ? frame.section.progress
    : 0.5
  let sectionUnlock = 1 - lockProgress
  switch (frame.section.type) {
    case 'intro': sectionUnlock = Math.min(sectionUnlock, 0.12); break
    case 'verse': sectionUnlock = Math.max(sectionUnlock, 0.24); break
    case 'build': sectionUnlock = Math.max(sectionUnlock, progress * response); break
    case 'drop': sectionUnlock = 1; break
    case 'breakdown': sectionUnlock = Math.max(sectionUnlock, 0.52); break
    case 'outro': sectionUnlock = Math.max(0.08, 1 - progress); break
  }
  return Math.min(1, Math.max(0, sectionUnlock + (frame.beat.downbeat ? 0.08 : 0)))
}

class AncientMachineWorld extends FullscreenCinematicWorld {
  constructor() {
    super('ancientMachine', ANCIENT_MACHINE_FRAGMENT_SOURCE, UNIFORMS)
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveAncientMachineSettings(frame.config.worldSettings)
    program.setFloat('uGateRadius', settings.gateRadius)
    program.setFloat('uRingCount', settings.ringCount)
    program.setFloat('uGearCount', settings.gearCount)
    program.setFloat('uGlyphDensity', settings.glyphDensity)
    program.setFloat('uRotationSpeed', settings.rotationSpeed)
    program.setFloat('uLockProgress', settings.lockProgress)
    program.setFloat('uUnlockResponse', settings.unlockResponse)
    program.setFloat('uRadialComplexity', settings.radialComplexity)
    program.setFloat('uMechanicalDepth', settings.mechanicalDepth)
    program.setFloat('uMechanicalProgress', mechanicalProgress(frame, settings.progressionMode))
    program.setFloat('uUnlockState', unlockState(frame, settings.lockProgress, settings.unlockResponse))
    program.setFloat('uToothDensity', settings.toothDensity)
  }
}

export const ancientMachineWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'ancientMachine',
  label: 'Ancient Machine',
  backend: 'webgl2',
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'],
    modulationTargets: ['depth', 'atmosphere', 'bloom', 'glow', 'portalPulse', 'cameraMotion'],
    supportsGeometryPasses: true,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: true,
    supportsFeedback: false,
  },
  create: () => new AncientMachineWorld(),
}
