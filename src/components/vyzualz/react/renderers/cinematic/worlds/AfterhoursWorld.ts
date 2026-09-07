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
import { AfterhoursPatternDirector, blendAfterhoursBeamFrames } from './AfterhoursPatternDirector'
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
  'uAfterhoursBlackout',
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeam${index}`),
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeamMeta${index}`),
] as const

/** Per-slot fade rate (1/e per this many seconds) for membership changes. */
const SLOT_FADE_HZ = 30

function setRgb(program: ShaderProgram, uniform: string, color: AfterhoursRgb): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

class AfterhoursWorld extends FullscreenCinematicWorld {
  private readonly triggers = new AfterhoursTriggerController()
  private readonly director = new AfterhoursPatternDirector()
  // Per-slot render weight + last-known geometry. Eases each slot toward its
  // target weight so a beam entering/leaving the active budget (reaction
  // envelope, pattern morph) fades instead of popping. Fixed-size, no churn.
  // Plain f64 arrays: geometry is forwarded verbatim, not pre-quantised.
  private primed = false
  private readonly slotWeight = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotOriginX = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotOriginY = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotTargetX = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotTargetY = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotAccent = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)

  constructor() {
    super('afterhours', AFTERHOURS_FRAGMENT_SOURCE, UNIFORMS)
  }

  private resetSlots(): void {
    this.primed = false
    this.slotWeight.fill(0)
  }

  override reset(reason: CinematicRendererResetReason): void {
    super.reset(reason)
    this.triggers.reset()
    this.director.reset()
    this.resetSlots()
  }

  override onContextLost(): void {
    this.triggers.reset()
    this.director.reset()
    this.resetSlots()
    super.onContextLost()
  }

  override dispose(): void {
    this.triggers.reset()
    this.director.reset()
    this.resetSlots()
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

    // Stage 5: the pattern director cycles deterministic variations of the
    // selected family at the chosen Pattern Change boundary, morphs between
    // them, and schedules deliberate musical blackouts. It owns no clock/analysis
    // and writes nothing persisted.
    const direction = this.director.update({
      frame,
      settings: {
        patternChange: settings.patternChange,
        blackoutAmount: settings.blackoutAmount,
        bpmSync: settings.bpmSync,
      },
    })
    program.setFloat('uAfterhoursBlackout', direction.blackout)

    // Reaction modifiers are derived, never written back to persisted settings.
    // Active-beam utilisation is bounded by the user's global Beam Count and the
    // 16-slot cap; Drop biases it toward the full budget without exceeding it.
    const beamCount = resolveAfterhoursBeamCount(settings.beamCount)
    const activeCount = Math.max(2, Math.min(beamCount, Math.round(beamCount * reaction.beamUtilization)))
    const genSettings = {
      ...settings,
      beamCount: activeCount,
      spread: Math.max(0, Math.min(1, settings.spread + reaction.spreadDelta)),
    }
    const genOptions = { motionPhase: reaction.motionPhase, motionAuthority: reaction.motionAuthority }

    // Settled: one generation (meta.x targets 1 for active slots). Mid-morph:
    // blend the previous and next variation of the *same* family — fixed emitter
    // origins never interpolate, only targets lerp.
    const settled = direction.transition >= 1
    const nextBeams = generateAfterhoursBeams(genSettings, { ...genOptions, variation: direction.variation })
    const blended = settled
      ? null
      : blendAfterhoursBeamFrames(
        generateAfterhoursBeams(genSettings, { ...genOptions, variation: direction.previousVariation }),
        nextBeams,
        direction.transition,
      )

    const dt = Math.max(0, Math.min(0.1, Number.isFinite(frame.deltaTimeSec) ? frame.deltaTimeSec : 1 / 60))
    const fade = 1 - Math.exp(-SLOT_FADE_HZ * dt)

    for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
      const morphBeam = blended?.[index]
      const beam = morphBeam ?? nextBeams[index]
      const rawWeight = morphBeam ? morphBeam.weight : 1
      const active = beam.active && rawWeight > 0
      const targetWeight = active ? Math.max(0, Math.min(1, rawWeight)) : 0
      // Refresh the remembered geometry only while the slot is real, so a slot
      // that is fading OUT dims from its last position rather than the origin.
      if (active) {
        this.slotOriginX[index] = beam.origin.x
        this.slotOriginY[index] = beam.origin.y
        this.slotTargetX[index] = beam.target.x
        this.slotTargetY[index] = beam.target.y
        this.slotAccent[index] = beam.accent ? 1 : 0
      }
      // First frame after (re)start shows the full rig; only *changes* fade.
      let weight = this.primed
        ? this.slotWeight[index] + (targetWeight - this.slotWeight[index]) * fade
        : targetWeight
      if (Math.abs(weight - targetWeight) < 1e-3) weight = targetWeight
      this.slotWeight[index] = weight

      if (weight <= 0) {
        program.setVec4(`uAfterhoursBeam${index}`, 0, 0, 0, 0)
        program.setVec2(`uAfterhoursBeamMeta${index}`, 0, 0)
      } else {
        program.setVec4(
          `uAfterhoursBeam${index}`,
          this.slotOriginX[index], this.slotOriginY[index],
          this.slotTargetX[index], this.slotTargetY[index],
        )
        program.setVec2(`uAfterhoursBeamMeta${index}`, weight, this.slotAccent[index])
      }
    }
    this.primed = true
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
