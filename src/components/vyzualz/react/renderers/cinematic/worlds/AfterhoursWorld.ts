import { resolveAfterhoursSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicWebGLWorldDefinition,
} from '../../CinematicWorldRenderer'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import {
  AFTERHOURS_MAX_BEAMS,
  generateAfterhoursBeams,
  resolveAfterhoursBeamCount,
} from './AfterhoursBeamGeometry'
import {
  AFTERHOURS_DEFAULT_BACKGROUND,
  type AfterhoursRgb,
  parseAfterhoursHexColor,
  resolveAfterhoursPalette,
} from './AfterhoursColor'
import { AFTERHOURS_FRAGMENT_SOURCE } from './AfterhoursShader'
import { AfterhoursTriggerController } from './AfterhoursTriggerController'
import { FullscreenCinematicWorld } from './FullscreenCinematicWorld'

const UNIFORMS = [
  'uAfterhoursBackground',
  'uAfterhoursPrimary',
  'uAfterhoursAccent',
  'uAfterhoursAtmosphere',
  'uAfterhoursIntensity',
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeam${index}`),
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeamMeta${index}`),
] as const

function setRgb(program: ShaderProgram, uniform: string, color: AfterhoursRgb): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

class AfterhoursWorld extends FullscreenCinematicWorld {
  private readonly triggers = new AfterhoursTriggerController()

  constructor() {
    super('afterhours', AFTERHOURS_FRAGMENT_SOURCE, UNIFORMS)
  }

  override reset(reason: CinematicRendererResetReason): void {
    super.reset(reason)
    this.triggers.reset()
  }

  override onContextLost(): void {
    this.triggers.reset()
    super.onContextLost()
  }

  override dispose(): void {
    this.triggers.reset()
    super.dispose()
  }

  protected setWorldUniforms(program: ShaderProgram, frame: CinematicFrameContext): void {
    const settings = resolveAfterhoursSettings(frame.config.worldSettings)

    // Background stays independent of Color Mode. The laser palette is resolved
    // per-frame: Manual uses the persisted hues, Auto derives an active pair
    // from the stable Cinema preset palette without touching the saved fields.
    setRgb(program, 'uAfterhoursBackground', parseAfterhoursHexColor(settings.backgroundColor, AFTERHOURS_DEFAULT_BACKGROUND))
    const presetPalette = frame.preset?.palette
    const palette = resolveAfterhoursPalette(
      { colorMode: settings.colorMode, primaryColor: settings.primaryColor, accentColor: settings.accentColor },
      settings.colorMode === 'auto' && presetPalette
        ? { primary: presetPalette.primary, accent: presetPalette.accent, secondary: presetPalette.secondary }
        : null,
    )
    setRgb(program, 'uAfterhoursPrimary', palette.primary)
    setRgb(program, 'uAfterhoursAccent', palette.accent)
    program.setFloat('uAfterhoursAtmosphere', Math.max(0, Math.min(1, Number.isFinite(settings.atmosphere) ? settings.atmosphere : 0)))

    // Stage 4: one canonical Trigger drives the whole reaction. The controller
    // owns no clock/FFT — it consumes frame.canonicalMusic / musicalAudio only.
    const reaction = this.triggers.update({
      frame,
      settings: {
        trigger: settings.trigger,
        bpmSync: settings.bpmSync,
        masterIntensity: settings.masterIntensity,
        pulseAmount: settings.pulseAmount,
        pulseDecay: settings.pulseDecay,
        motionAmount: settings.motionAmount,
      },
    })
    program.setFloat('uAfterhoursIntensity', reaction.intensity)

    // Reaction modifiers are derived, never written back to persisted settings.
    // Active-beam utilisation is bounded by the user's global Beam Count and the
    // 16-slot cap; Drop biases it toward the full budget without exceeding it.
    const beamCount = resolveAfterhoursBeamCount(settings.beamCount)
    const activeCount = Math.max(2, Math.min(beamCount, Math.round(beamCount * reaction.beamUtilization)))
    const beams = generateAfterhoursBeams(
      {
        ...settings,
        beamCount: activeCount,
        spread: Math.max(0, Math.min(1, settings.spread + reaction.spreadDelta)),
      },
      { motionPhase: reaction.motionPhase, motionAuthority: reaction.motionAuthority },
    )
    for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
      const beam = beams[index]
      if (!beam.active) {
        program.setVec4(`uAfterhoursBeam${index}`, 0, 0, 0, 0)
        program.setVec2(`uAfterhoursBeamMeta${index}`, 0, 0)
        continue
      }
      program.setVec4(`uAfterhoursBeam${index}`, beam.origin.x, beam.origin.y, beam.target.x, beam.target.y)
      program.setVec2(`uAfterhoursBeamMeta${index}`, 1, beam.accent ? 1 : 0)
    }
  }
}

const afterhoursDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked'],
  safeCameraRange: {
    minDistance: 1.7,
    maxDistance: 1.9,
    maxLateral: 0,
    minElevation: 0,
    maxElevation: 0,
    minFieldOfView: 58,
    maxFieldOfView: 58,
  },
  shots: [
    { id: 'afterhours-screen', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 1.8 }, fieldOfView: 58 } },
  ],
  dropActions: ['hold'],
  revealActions: ['hold'],
  retreatActions: ['hold'],
})

export const afterhoursWorldDefinition: CinematicWebGLWorldDefinition = {
  id: 'afterhours',
  label: 'Afterhours',
  backend: 'webgl2',
  direction: afterhoursDirection,
  capabilities: {
    backend: 'webgl2',
    cameraRigs: ['locked'],
    modulationTargets: [],
    paletteRoles: [],
    supportsGeometryPasses: false,
    supportsFullscreenPasses: true,
    supportsTextureInputs: false,
    supportsPostProcessing: false,
    supportsFeedback: false,
  },
  create: () => new AfterhoursWorld(),
}
