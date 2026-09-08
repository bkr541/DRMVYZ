import { resolveAfterhoursSettings } from '../../../CinematicWorldSettings'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type {
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicViewport,
  CinematicWebGLWorldDefinition,
} from '../../CinematicWorldRenderer'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'
import {
  AFTERHOURS_MAX_BEAMS,
  generateAfterhoursBeams,
} from './AfterhoursBeamGeometry'
import { blendAfterhoursBeamFrames } from './AfterhoursBeamMorph'
import { AfterhoursAudioIntelligenceDirector } from './AfterhoursAudioIntelligenceDirector'
import {
  AFTERHOURS_DEFAULT_BACKGROUND,
  type AfterhoursRgb,
  parseAfterhoursHexColor,
  resolveAfterhoursPalette,
} from './AfterhoursColor'
import { AFTERHOURS_FRAGMENT_SOURCE } from './AfterhoursShader'
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
  ...Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `uAfterhoursBeamHistory${index}`),
] as const

/** Per-slot fade rate (1/e per this many seconds) for membership changes. */
const SLOT_FADE_HZ = 30
const TEMPORAL_EXPOSURE_SEC = 0.075
const TEMPORAL_HISTORY_WINDOW_SEC = 0.12
const TEMPORAL_HISTORY_MAX_SAMPLES = 10
const TEMPORAL_MAX_MIX = 0.24

interface AfterhoursTemporalSample {
  readonly timeSec: number
  readonly originX: number
  readonly originY: number
  readonly endpointX: number
  readonly endpointY: number
}

function setRgb(program: ShaderProgram, uniform: string, color: AfterhoursRgb): void {
  program.setVec3(uniform, color.r, color.g, color.b)
}

class AfterhoursWorld extends FullscreenCinematicWorld {
  private readonly director = new AfterhoursAudioIntelligenceDirector()
  // Per-slot render weight + last-known geometry. Eases each slot toward its
  // target weight so a beam entering/leaving the authored budget or a topology
  // morph fades instead of popping. Fixed-size, no churn.
  // Plain f64 arrays: geometry is forwarded verbatim, not pre-quantised.
  private primed = false
  private readonly slotWeight = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotOriginX = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotOriginY = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotEndpointX = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotEndpointY = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly slotAccent = new Array<number>(AFTERHOURS_MAX_BEAMS).fill(0)
  private readonly temporalHistory = Array.from({ length: AFTERHOURS_MAX_BEAMS }, () => [] as AfterhoursTemporalSample[])
  private lastTransportTimeSec: number | null = null
  private lastTopologyIdentity: string | null = null

  constructor() {
    super('afterhours', AFTERHOURS_FRAGMENT_SOURCE, UNIFORMS)
  }

  private resetTemporalHistory(): void {
    for (const history of this.temporalHistory) history.length = 0
    this.lastTransportTimeSec = null
    this.lastTopologyIdentity = null
  }

  private resetSlots(): void {
    this.primed = false
    this.slotWeight.fill(0)
    this.resetTemporalHistory()
  }

  private resolveTemporalExposure(
    index: number,
    beam: Readonly<{ active: boolean; blanked: boolean; origin: { x: number; y: number }; endpoint: { x: number; y: number } }>,
    timeSec: number,
    motionAuthority: number,
  ): { endpointX: number; endpointY: number; mix: number } {
    const history = this.temporalHistory[index]
    if (!beam.active || beam.blanked || motionAuthority <= 0) {
      history.length = 0
      return { endpointX: beam.endpoint.x, endpointY: beam.endpoint.y, mix: 0 }
    }

    const cutoff = timeSec - TEMPORAL_HISTORY_WINDOW_SEC
    while (history.length > 0 && history[0]!.timeSec < cutoff) history.shift()
    const compatible = history.filter(sample => (
      Math.abs(sample.originX - beam.origin.x) <= 1e-7
      && Math.abs(sample.originY - beam.origin.y) <= 1e-7
      && sample.timeSec <= timeSec
    ))
    const targetAge = TEMPORAL_EXPOSURE_SEC
    const historical = compatible.reduce<AfterhoursTemporalSample | null>((best, sample) => {
      const age = timeSec - sample.timeSec
      if (age <= 0) return best
      if (best == null) return sample
      return Math.abs(age - targetAge) < Math.abs((timeSec - best.timeSec) - targetAge) ? sample : best
    }, null)

    history.push({
      timeSec,
      originX: beam.origin.x,
      originY: beam.origin.y,
      endpointX: beam.endpoint.x,
      endpointY: beam.endpoint.y,
    })
    if (history.length > TEMPORAL_HISTORY_MAX_SAMPLES) history.splice(0, history.length - TEMPORAL_HISTORY_MAX_SAMPLES)

    if (!historical) return { endpointX: beam.endpoint.x, endpointY: beam.endpoint.y, mix: 0 }
    const age = Math.max(0, timeSec - historical.timeSec)
    const ageAuthority = Math.min(1, age / TEMPORAL_EXPOSURE_SEC)
    return {
      endpointX: historical.endpointX,
      endpointY: historical.endpointY,
      mix: Math.min(TEMPORAL_MAX_MIX, TEMPORAL_MAX_MIX * ageAuthority * Math.max(0, Math.min(1, motionAuthority))),
    }
  }

  // Afterhours computes every animated value on the CPU (hierarchical reaction,
  // topology morph, blackout, per-slot fade) and pushes its own uAfterhours*
  // uniforms; its shader declares none of the shared time/audio/palette/camera
  // uniforms, so the base class should not spend the per-frame work setting them.
  protected override consumesSharedFrameUniforms(): boolean {
    return false
  }

  override resize(viewport: CinematicViewport): void {
    super.resize(viewport)
    // Aspect changes invalidate stored viewport endpoints; never expose a stale
    // pre-resize ray through the temporal shutter history.
    this.resetTemporalHistory()
  }

  override reset(reason: CinematicRendererResetReason): void {
    super.reset(reason)
    this.director.reset()
    this.resetSlots()
  }

  override onContextLost(): void {
    this.director.reset()
    this.resetSlots()
    super.onContextLost()
  }

  override dispose(): void {
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

    // Stage 6: one hierarchy owner conducts the already-authored Stage 2-5
    // rig/scenes/scanner from canonical Music Intelligence. It reconstructs
    // scene + structure from absolute musical position, then layers bounded
    // kick/snare/downbeat/Trigger accents without running a second analyzer.
    const direction = this.director.update({
      frame,
      settings: {
        pattern: settings.pattern,
        patternChange: settings.patternChange,
        trigger: settings.trigger,
        bpmSync: settings.bpmSync,
        masterIntensity: settings.masterIntensity,
        pulseAmount: settings.pulseAmount,
        pulseDecay: settings.pulseDecay,
        motionAmount: settings.motionAmount,
        blackoutAmount: settings.blackoutAmount,
        beamCount: settings.beamCount,
        spread: settings.spread,
        sideLasers: settings.sideLasers,
        topLasers: settings.topLasers,
      },
    })
    program.setFloat('uAfterhoursIntensity', direction.intensity)
    program.setFloat('uAfterhoursBlackout', direction.blackout)

    // A seek/loop discontinuity reconstructs a new authored cue immediately.
    // Clear Stage 5 slot-fade/morph history as well as temporal exposure so no
    // retiring beam from the previous song position can ghost into that cue.
    if (frame.timingDiscontinuity) this.resetSlots()

    // Stage 5 temporal exposure is renderer-owned, bounded, and disposable. A
    // seek/loop discontinuity, topology switch, backwards transport, long frame
    // gap, world reset, or context reset must never smear stale rays forward.
    const transportTimeSec = Number.isFinite(frame.transportTimeSec) ? frame.transportTimeSec : frame.elapsedTimeSec
    const topologyIdentity = `${direction.pattern}:${direction.variation}`
    const temporalDiscontinuity = frame.timingDiscontinuity
      || (this.lastTransportTimeSec != null && (transportTimeSec < this.lastTransportTimeSec - 1e-6
        || transportTimeSec - this.lastTransportTimeSec > 0.25))
      || (this.lastTopologyIdentity != null && this.lastTopologyIdentity !== topologyIdentity)
    if (temporalDiscontinuity) this.resetTemporalHistory()
    this.lastTransportTimeSec = transportTimeSec
    this.lastTopologyIdentity = topologyIdentity

    // Stage 6 modifiers are derived, never written back to persisted settings.
    // Beam Count remains the user-owned maximum; the hierarchy may recruit a
    // smaller authored subset for quiet/vocal passages, then return to that cap.
    const genSettings = {
      ...settings,
      pattern: direction.pattern,
      beamCount: direction.beamCount,
      spread: direction.spread,
      sideLasers: direction.sideLasers,
      topLasers: direction.topLasers,
    }
    // Use the persisted world seed, not Cinema's musical-position seed. The latter
    // intentionally changes across beat-phase buckets and would turn authored scan
    // motion into unrelated per-frame endpoint randomization.
    const viewportAspectRatio = this.viewport.width / Math.max(1, this.viewport.height)
    const stableWorldSeed = Number.isFinite(frame.config.seed) ? frame.config.seed : frame.randomSeed
    const genOptions = {
      seed: stableWorldSeed,
      motionPhase: direction.motionPhase,
      motionAuthority: direction.motionAuthority,
      viewportAspectRatio,
    }

    // Settled: one generation (meta.x targets 1 for active slots). Mid-morph:
    // blend the previous and next topology frames. Fixed emitter origins never
    // interpolate; ray directions morph and are re-projected to the viewport
    // edge so no transition can create a floating finite segment.
    const settled = direction.transition >= 1
    const nextBeams = generateAfterhoursBeams(genSettings, { ...genOptions, variation: direction.variation })
    const previousBeams = settled
      ? nextBeams
      : generateAfterhoursBeams(
        { ...genSettings, pattern: direction.previousPattern },
        { ...genOptions, variation: direction.previousVariation },
      )
    const blended = settled
      ? null
      : blendAfterhoursBeamFrames(
        previousBeams,
        nextBeams,
        direction.transition,
        viewportAspectRatio,
      )

    const dt = Math.max(0, Math.min(0.1, Number.isFinite(frame.deltaTimeSec) ? frame.deltaTimeSec : 1 / 60))
    const fade = 1 - Math.exp(-SLOT_FADE_HZ * dt)

    for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
      const morphBeam = blended?.[index]
      const beam = morphBeam ?? nextBeams[index]
      const rawWeight = morphBeam ? morphBeam.weight : 1
      const active = beam.active && !beam.blanked && rawWeight > 0
      const beamBank = nextBeams[index].active ? nextBeams[index].bank : previousBeams[index].bank
      const bankWeight = beamBank === 'bottom'
        ? direction.bankWeights.bottom
        : beamBank === 'left'
          ? direction.bankWeights.left
          : beamBank === 'right'
            ? direction.bankWeights.right
            : direction.bankWeights.top
      const targetWeight = active ? Math.max(0, Math.min(1, rawWeight * bankWeight)) : 0
      const exposure = this.resolveTemporalExposure(index, beam, transportTimeSec, direction.motionAuthority)
      // Refresh the remembered geometry only while the slot is real, so a slot
      // that is fading OUT dims from its last position rather than the origin.
      if (active) {
        this.slotOriginX[index] = beam.origin.x
        this.slotOriginY[index] = beam.origin.y
        this.slotEndpointX[index] = beam.endpoint.x
        this.slotEndpointY[index] = beam.endpoint.y
        this.slotAccent[index] = beam.accent ? 1 : 0
      }
      // First frame after (re)start shows the full rig; only *changes* fade.
      let weight = beam.blanked
        ? 0
        : this.primed
          ? this.slotWeight[index] + (targetWeight - this.slotWeight[index]) * fade
          : targetWeight
      if (Math.abs(weight - targetWeight) < 1e-3) weight = targetWeight
      this.slotWeight[index] = weight

      if (weight <= 0) {
        program.setVec4(`uAfterhoursBeam${index}`, 0, 0, 0, 0)
        program.setVec2(`uAfterhoursBeamMeta${index}`, 0, 0)
        program.setVec4(`uAfterhoursBeamHistory${index}`, 0, 0, 0, 0)
      } else {
        program.setVec4(
          `uAfterhoursBeam${index}`,
          this.slotOriginX[index], this.slotOriginY[index],
          this.slotEndpointX[index], this.slotEndpointY[index],
        )
        program.setVec2(`uAfterhoursBeamMeta${index}`, weight, this.slotAccent[index])
        program.setVec4(
          `uAfterhoursBeamHistory${index}`,
          exposure.endpointX, exposure.endpointY, exposure.mix, 0,
        )
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
