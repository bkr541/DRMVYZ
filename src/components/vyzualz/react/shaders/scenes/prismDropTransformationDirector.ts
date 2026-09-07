export const PRISM_DROP_TRANSFORMATION_PARAMETER_ID = 'dropTransformation' as const

export const PRISM_DROP_TRANSFORMATION_LIMITS = Object.freeze({
  min: 0,
  max: 1,
  default: 1,
  maxDeltaTimeSec: 0.1,
  tensionSeconds: 0.07,
  impactSeconds: 0.13,
  bloomSeconds: 0.28,
  recoverySeconds: 0.52,
  tensionApertureOffset: -0.3,
  impactApertureOffset: 0.72,
  bloomApertureOffset: 0.42,
  torqueImpulse: 0.95,
  facetFlare: 1,
  echoBurst: 1,
})

export type PrismDropTransformationPhase = 'idle' | 'tension' | 'impact' | 'bloom' | 'recovery'

export interface PrismDropTransformationEvent {
  active: boolean
  eventId: string | null
}

export interface PrismDropTransformationInput {
  intensity: number
  deltaTimeSec: number
  reconstruct?: boolean
  dropStart?: Readonly<PrismDropTransformationEvent>
}

export interface PrismDropTransformationTargets {
  setApertureOffset(offset: number): void
  applyTorqueImpulse(amount: number): void
  requestFacetFlare(amount: number): void
  requestEchoBurst(amount: number): void
}

export interface PrismDropTransformationSnapshot {
  phase: PrismDropTransformationPhase
  phaseProgress: number
  activeIntensity: number
  apertureOffset: number
  facetAmountFloor: number
  acceptedEventId: string | null
}

/**
 * Runtime-only event orchestrator for Prism. It owns only phase/envelope state
 * and delegates all visual behavior to the public runtime seams from Stages
 * 2-5. Authored parameter values are never written here.
 */
export class PrismDropTransformationDirector {
  private phase: PrismDropTransformationPhase = 'idle'
  private phaseElapsedSec = 0
  private activeIntensity = 0
  private apertureOffset = 0
  private lastDropEventId: string | null = null
  private anonymousDropLatched = false
  private acceptedEventId: string | null = null

  reset(targets?: Readonly<PrismDropTransformationTargets>): void {
    this.phase = 'idle'
    this.phaseElapsedSec = 0
    this.activeIntensity = 0
    this.apertureOffset = 0
    this.lastDropEventId = null
    this.anonymousDropLatched = false
    this.acceptedEventId = null
    targets?.setApertureOffset(0)
  }

  step(
    input: Readonly<PrismDropTransformationInput>,
    targets: Readonly<PrismDropTransformationTargets>,
  ): PrismDropTransformationSnapshot {
    const intensity = clamp(
      finiteOr(input.intensity, PRISM_DROP_TRANSFORMATION_LIMITS.default),
      PRISM_DROP_TRANSFORMATION_LIMITS.min,
      PRISM_DROP_TRANSFORMATION_LIMITS.max,
    )
    const event = input.dropStart ?? { active: false, eventId: null }

    if (input.reconstruct) {
      this.reset(targets)
      this.rememberEvent(event)
      return this.snapshot()
    }

    if (this.acceptEvent(event)) {
      this.acceptedEventId = event.eventId
      if (intensity > 0) this.beginTransformation(intensity, targets)
    }

    if (this.phase === 'idle') {
      this.apertureOffset = 0
      targets.setApertureOffset(0)
      return this.snapshot()
    }

    const dt = clamp(
      finiteOr(input.deltaTimeSec, 0),
      0,
      PRISM_DROP_TRANSFORMATION_LIMITS.maxDeltaTimeSec,
    )
    this.advance(dt, targets)
    this.apertureOffset = this.resolveApertureOffset()
    targets.setApertureOffset(this.apertureOffset)
    return this.snapshot()
  }

  getSnapshot(): PrismDropTransformationSnapshot {
    return this.snapshot()
  }

  private beginTransformation(
    intensity: number,
    targets: Readonly<PrismDropTransformationTargets>,
  ): void {
    // A new canonical event restarts the authored gesture instead of stacking
    // another envelope on top of the active one. Reinforcement is bounded 0..1.
    this.activeIntensity = Math.max(this.activeIntensity, clamp01(intensity))
    this.phase = 'tension'
    this.phaseElapsedSec = 0
    this.apertureOffset = PRISM_DROP_TRANSFORMATION_LIMITS.tensionApertureOffset * this.activeIntensity
    targets.setApertureOffset(this.apertureOffset)
  }

  private advance(
    deltaTimeSec: number,
    targets: Readonly<PrismDropTransformationTargets>,
  ): void {
    let remaining = deltaTimeSec
    while (remaining > 0 && this.phase !== 'idle') {
      const duration = phaseDuration(this.phase)
      const available = Math.max(0, duration - this.phaseElapsedSec)
      const consumed = Math.min(remaining, available)
      this.phaseElapsedSec += consumed
      remaining -= consumed

      if (duration <= 0 || this.phaseElapsedSec + 1e-9 >= duration) {
        this.enterNextPhase(targets)
      } else {
        break
      }
    }
  }

  private enterNextPhase(targets: Readonly<PrismDropTransformationTargets>): void {
    this.phaseElapsedSec = 0
    switch (this.phase) {
      case 'tension':
        this.phase = 'impact'
        targets.applyTorqueImpulse(PRISM_DROP_TRANSFORMATION_LIMITS.torqueImpulse * this.activeIntensity)
        targets.requestFacetFlare(PRISM_DROP_TRANSFORMATION_LIMITS.facetFlare * this.activeIntensity)
        targets.requestEchoBurst(PRISM_DROP_TRANSFORMATION_LIMITS.echoBurst * this.activeIntensity)
        return
      case 'impact':
        this.phase = 'bloom'
        return
      case 'bloom':
        this.phase = 'recovery'
        return
      case 'recovery':
        this.phase = 'idle'
        this.activeIntensity = 0
        this.apertureOffset = 0
        targets.setApertureOffset(0)
        return
      case 'idle':
        return
    }
  }

  private resolveApertureOffset(): number {
    const progress = phaseProgress(this.phase, this.phaseElapsedSec)
    const strength = this.activeIntensity
    switch (this.phase) {
      case 'tension':
        return PRISM_DROP_TRANSFORMATION_LIMITS.tensionApertureOffset * strength
      case 'impact':
        return lerp(
          PRISM_DROP_TRANSFORMATION_LIMITS.impactApertureOffset * strength,
          PRISM_DROP_TRANSFORMATION_LIMITS.bloomApertureOffset * strength,
          easeOutCubic(progress),
        )
      case 'bloom':
        return lerp(
          PRISM_DROP_TRANSFORMATION_LIMITS.bloomApertureOffset * strength,
          PRISM_DROP_TRANSFORMATION_LIMITS.bloomApertureOffset * 0.46 * strength,
          easeOutCubic(progress),
        )
      case 'recovery':
        return lerp(
          PRISM_DROP_TRANSFORMATION_LIMITS.bloomApertureOffset * 0.46 * strength,
          0,
          easeOutCubic(progress),
        )
      case 'idle':
        return 0
    }
  }

  private resolveFacetAmountFloor(): number {
    const progress = phaseProgress(this.phase, this.phaseElapsedSec)
    const strength = this.activeIntensity
    switch (this.phase) {
      case 'tension': return lerp(0.18, 0.42, easeOutCubic(progress)) * strength
      case 'impact': return lerp(1, 0.86, easeOutCubic(progress)) * strength
      case 'bloom': return lerp(0.86, 0.58, easeOutCubic(progress)) * strength
      case 'recovery': return lerp(0.58, 0, easeOutCubic(progress)) * strength
      case 'idle': return 0
    }
  }

  private acceptEvent(event: Readonly<PrismDropTransformationEvent>): boolean {
    if (!event.active) {
      this.anonymousDropLatched = false
      return false
    }

    if (event.eventId) {
      if (event.eventId === this.lastDropEventId) return false
      this.lastDropEventId = event.eventId
      this.anonymousDropLatched = true
      return true
    }

    if (this.anonymousDropLatched) return false
    this.anonymousDropLatched = true
    return true
  }

  private rememberEvent(event: Readonly<PrismDropTransformationEvent>): void {
    if (!event.active) return
    if (event.eventId) this.lastDropEventId = event.eventId
    this.anonymousDropLatched = true
  }

  private snapshot(): PrismDropTransformationSnapshot {
    return {
      phase: this.phase,
      phaseProgress: phaseProgress(this.phase, this.phaseElapsedSec),
      activeIntensity: this.activeIntensity,
      apertureOffset: this.apertureOffset,
      facetAmountFloor: this.resolveFacetAmountFloor(),
      acceptedEventId: this.acceptedEventId,
    }
  }
}

function phaseDuration(phase: PrismDropTransformationPhase): number {
  switch (phase) {
    case 'tension': return PRISM_DROP_TRANSFORMATION_LIMITS.tensionSeconds
    case 'impact': return PRISM_DROP_TRANSFORMATION_LIMITS.impactSeconds
    case 'bloom': return PRISM_DROP_TRANSFORMATION_LIMITS.bloomSeconds
    case 'recovery': return PRISM_DROP_TRANSFORMATION_LIMITS.recoverySeconds
    case 'idle': return 0
  }
}

function phaseProgress(phase: PrismDropTransformationPhase, elapsedSec: number): number {
  const duration = phaseDuration(phase)
  if (duration <= 0) return 0
  return clamp01(elapsedSec / duration)
}

function easeOutCubic(value: number): number {
  const inverse = 1 - clamp01(value)
  return 1 - inverse * inverse * inverse
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
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
