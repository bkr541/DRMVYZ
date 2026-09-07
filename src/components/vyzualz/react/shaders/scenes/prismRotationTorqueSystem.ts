import type {
  ShaderParamValue,
  ShaderRuntimeParameterController,
  ShaderRuntimeParameterControllerInput,
  ShaderRuntimeFloatUniformValues,
} from '../registry/shaderRegistryTypes'
import { PRISM_APERTURE_PARAMETER_ID, PrismApertureController } from './prismApertureController'
import {
  PRISM_ECHO_AMOUNT_PARAMETER_ID,
  PRISM_ECHO_BURST_RUNTIME_COMMAND_ID,
  PRISM_ECHO_COUNT_PARAMETER_ID,
  PRISM_ECHO_DECAY_PARAMETER_ID,
  PRISM_ECHO_LIMITS,
  PRISM_ECHO_SPACING_PARAMETER_ID,
  PrismEchoSystem,
} from './prismEchoSystem'
import {
  PRISM_FACET_CHOREOGRAPHY_LIMITS,
  PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID,
  PRISM_FACET_FLARE_RUNTIME_COMMAND_ID,
  PrismFacetIlluminationChoreographer,
} from './prismFacetIlluminationChoreographer'

export const PRISM_ROTATION_PARAMETER_ID = 'rotation' as const
export const PRISM_ROTATION_DRIVE_PARAMETER_ID = 'rotationDrive' as const
export const PRISM_ROTATION_TORQUE_PARAMETER_ID = 'rotationTorque' as const
export const PRISM_ROTATION_DRAG_PARAMETER_ID = 'rotationDrag' as const

export const PRISM_ROTATION_LIMITS = Object.freeze({
  drive: Object.freeze({ min: -1.5, max: 1.5, default: 0.15 }),
  torque: Object.freeze({ min: 0, max: 1, default: 0.45 }),
  drag: Object.freeze({ min: 0, max: 1, default: 0.55 }),
  maxAngularVelocity: 4,
  maxImpulseVelocity: 2.5,
  driveResponsePerSec: 4,
  maxDeltaTimeSec: 0.05,
  impulseVelocityPerUnit: 2.4,
  phraseImpulseAmount: 0.32,
})

export interface PrismRotationTorqueSettings {
  drive: number
  torque: number
  drag: number
}

export interface PrismRotationTorqueSnapshot {
  angle: number
  angularVelocity: number
  baseVelocity: number
  impulseVelocity: number
  direction: -1 | 0 | 1
}

/**
 * Runtime-only rotational simulation for Prism's radial form. Authored drive,
 * torque, drag, and orientation stay in canonical Shader/Cinema parameter
 * state; only the derived angle/velocities live here.
 */
export class PrismRotationTorqueSystem {
  private angle = 0
  private baseVelocity = 0
  private impulseVelocity = 0
  private pendingImpulse = 0
  private phrase8Latched = false

  reset(): void {
    this.angle = 0
    this.baseVelocity = 0
    this.impulseVelocity = 0
    this.pendingImpulse = 0
    this.phrase8Latched = false
  }

  /** Queue a normalized signed torque impulse for the next integration step. */
  applyTorqueImpulse(amount: number): void {
    this.pendingImpulse = clamp(
      this.pendingImpulse + finiteOr(amount, 0),
      -1,
      1,
    )
  }

  step(
    settings: Readonly<PrismRotationTorqueSettings>,
    deltaTimeSec: number,
    options: Readonly<{ phrase8Hit?: boolean; reconstruct?: boolean }> = {},
  ): PrismRotationTorqueSnapshot {
    const drive = clamp(
      finiteOr(settings.drive, PRISM_ROTATION_LIMITS.drive.default),
      PRISM_ROTATION_LIMITS.drive.min,
      PRISM_ROTATION_LIMITS.drive.max,
    )
    const torque = clamp01(finiteOr(settings.torque, PRISM_ROTATION_LIMITS.torque.default))
    const drag = clamp01(finiteOr(settings.drag, PRISM_ROTATION_LIMITS.drag.default))
    const phrase8Hit = options.phrase8Hit === true

    if (options.reconstruct) {
      this.reset()
      this.phrase8Latched = phrase8Hit
      return this.snapshot()
    }

    if (phrase8Hit && !this.phrase8Latched) {
      const direction = signedDirection(drive, this.baseVelocity + this.impulseVelocity)
      this.applyTorqueImpulse(PRISM_ROTATION_LIMITS.phraseImpulseAmount * direction)
    }
    this.phrase8Latched = phrase8Hit

    const dt = clamp(
      finiteOr(deltaTimeSec, 0),
      0,
      PRISM_ROTATION_LIMITS.maxDeltaTimeSec,
    )

    const impulseDelta = this.pendingImpulse
      * torque
      * PRISM_ROTATION_LIMITS.impulseVelocityPerUnit
    this.pendingImpulse = 0
    const impulseStart = clamp(
      this.impulseVelocity + impulseDelta,
      -PRISM_ROTATION_LIMITS.maxImpulseVelocity,
      PRISM_ROTATION_LIMITS.maxImpulseVelocity,
    )

    if (dt <= 0) {
      this.impulseVelocity = impulseStart
      return this.snapshot()
    }

    const driveResponse = PRISM_ROTATION_LIMITS.driveResponsePerSec
    const driveDecay = Math.exp(-driveResponse * dt)
    const baseStart = this.baseVelocity
    const baseEnd = drive + (baseStart - drive) * driveDecay
    const baseIntegral = drive * dt
      + (baseStart - drive) * (1 - driveDecay) / driveResponse

    const dragPerSec = drag * 8
    const impulseDecay = dragPerSec > 0 ? Math.exp(-dragPerSec * dt) : 1
    const impulseEnd = impulseStart * impulseDecay
    const impulseIntegral = dragPerSec > 0
      ? impulseStart * (1 - impulseDecay) / dragPerSec
      : impulseStart * dt

    this.baseVelocity = clamp(
      baseEnd,
      PRISM_ROTATION_LIMITS.drive.min,
      PRISM_ROTATION_LIMITS.drive.max,
    )
    this.impulseVelocity = clamp(
      impulseEnd,
      -PRISM_ROTATION_LIMITS.maxImpulseVelocity,
      PRISM_ROTATION_LIMITS.maxImpulseVelocity,
    )
    this.angle = wrapAngle(this.angle + baseIntegral + impulseIntegral)

    return this.snapshot()
  }

  getSnapshot(): PrismRotationTorqueSnapshot {
    return this.snapshot()
  }

  private snapshot(): PrismRotationTorqueSnapshot {
    const angularVelocity = clamp(
      this.baseVelocity + this.impulseVelocity,
      -PRISM_ROTATION_LIMITS.maxAngularVelocity,
      PRISM_ROTATION_LIMITS.maxAngularVelocity,
    )
    return {
      angle: this.angle,
      angularVelocity,
      baseVelocity: this.baseVelocity,
      impulseVelocity: this.impulseVelocity,
      direction: angularVelocity > 1e-5 ? 1 : angularVelocity < -1e-5 ? -1 : 0,
    }
  }
}

/**
 * Prism's single runtime-parameter owner composes Stage 2 aperture smoothing,
 * Stage 3 rotational physics, Stage 4 facet illumination choreography, and
 * Stage 5 structural echo history. No
 * runtime state is written back to the authored parameter object.
 */
export class PrismRuntimeParameterController implements ShaderRuntimeParameterController {
  readonly rotation = new PrismRotationTorqueSystem()
  readonly illumination = new PrismFacetIlluminationChoreographer()
  readonly echoes = new PrismEchoSystem()
  private readonly aperture = new PrismApertureController()
  private readonly runtimeFloatUniforms: Record<string, number> = {}

  reset(): void {
    this.aperture.reset()
    this.rotation.reset()
    this.illumination.reset()
    this.echoes.reset()
  }

  setTemporaryOffset(parameterId: string, offset: number): void {
    this.aperture.setTemporaryOffset(parameterId, offset)
  }

  clearTemporaryOffset(parameterId: string): void {
    this.aperture.clearTemporaryOffset(parameterId)
  }

  applyImpulse(parameterId: string, amount: number): void {
    if (parameterId === PRISM_ECHO_BURST_RUNTIME_COMMAND_ID) {
      this.echoes.requestBurst(amount)
      return
    }
    if (parameterId === PRISM_FACET_FLARE_RUNTIME_COMMAND_ID) {
      this.illumination.requestAllFacetFlare(amount)
      return
    }
    if (parameterId !== PRISM_ROTATION_PARAMETER_ID && parameterId !== PRISM_ROTATION_DRIVE_PARAMETER_ID) return
    this.rotation.applyTorqueImpulse(amount)
  }

  getRuntimeFloatUniformValues(): ShaderRuntimeFloatUniformValues {
    Object.assign(
      this.runtimeFloatUniforms,
      this.illumination.getRuntimeFloatUniformValues(),
      this.echoes.getRuntimeFloatUniformValues(),
    )
    return this.runtimeFloatUniforms
  }

  resolve(input: ShaderRuntimeParameterControllerInput): Record<string, ShaderParamValue> {
    const apertureValues = this.aperture.resolve(input)
    const drive = numericValue(apertureValues[PRISM_ROTATION_DRIVE_PARAMETER_ID], PRISM_ROTATION_LIMITS.drive.default)
    const torque = numericValue(apertureValues[PRISM_ROTATION_TORQUE_PARAMETER_ID], PRISM_ROTATION_LIMITS.torque.default)
    const drag = numericValue(apertureValues[PRISM_ROTATION_DRAG_PARAMETER_ID], PRISM_ROTATION_LIMITS.drag.default)
    const motion = this.rotation.step(
      { drive, torque, drag },
      input.deltaTimeSec,
      {
        phrase8Hit: (input.timing?.phrase8Hit ?? 0) > 0.5,
        reconstruct: input.reconstruct,
      },
    )
    const choreographyAmount = numericValue(
      apertureValues[PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID],
      PRISM_FACET_CHOREOGRAPHY_LIMITS.default,
    )
    const illumination = this.illumination.step({
      amount: choreographyAmount,
      audio: input.audio,
      timing: input.timing,
      deltaTimeSec: input.deltaTimeSec,
      rotationDirection: motion.direction,
      reconstruct: input.reconstruct,
    })

    this.echoes.step({
      amount: numericValue(apertureValues[PRISM_ECHO_AMOUNT_PARAMETER_ID], PRISM_ECHO_LIMITS.amount.default),
      count: numericValue(apertureValues[PRISM_ECHO_COUNT_PARAMETER_ID], PRISM_ECHO_LIMITS.count.default),
      spacingSec: numericValue(apertureValues[PRISM_ECHO_SPACING_PARAMETER_ID], PRISM_ECHO_LIMITS.spacing.default),
      decay: numericValue(apertureValues[PRISM_ECHO_DECAY_PARAMETER_ID], PRISM_ECHO_LIMITS.decay.default),
      qualityTier: input.qualityTier,
      deltaTimeSec: input.deltaTimeSec,
      reconstruct: input.reconstruct,
      state: {
        rotation: numericValue(apertureValues[PRISM_ROTATION_PARAMETER_ID], 0),
        rotationMotion: motion.angle,
        aperture: numericValue(apertureValues[PRISM_APERTURE_PARAMETER_ID], 1),
        baseRadius: numericValue(apertureValues.tunnelRadius, 0.9),
        curvature: numericValue(apertureValues.warp, 0.6),
        facetAmount: choreographyAmount,
        chaseIndex: illumination.chaseIndex,
        chaseStrength: illumination.chaseStrength,
        alternate: illumination.alternate,
        opposing: illumination.opposing,
        flare: illumination.flare,
      },
    })

    return {
      ...apertureValues,
      // rotationDrive remains the persisted signed drive before this seam. Its
      // effective GPU value becomes only the runtime motion angle.
      [PRISM_ROTATION_DRIVE_PARAMETER_ID]: motion.angle,
    }
  }
}

export function createPrismRuntimeParameterController(): ShaderRuntimeParameterController {
  return new PrismRuntimeParameterController()
}

function numericValue(value: ShaderParamValue | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

function signedDirection(drive: number, velocity: number): -1 | 1 {
  if (drive > 1e-5) return 1
  if (drive < -1e-5) return -1
  return velocity < -1e-5 ? -1 : 1
}

function wrapAngle(value: number): number {
  const tau = Math.PI * 2
  if (!Number.isFinite(value)) return 0
  return ((value + Math.PI) % tau + tau) % tau - Math.PI
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
