import type { ShaderAudioUniformFrame, ShaderTimingUniformFrame } from '../audio/shaderAudioTypes'
import type { ShaderRuntimeFloatUniformValues } from '../registry/shaderRegistryTypes'
import { PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT } from './prismRadialTopology'

export const PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID = 'facetChoreography' as const
export const PRISM_FACET_FLARE_RUNTIME_COMMAND_ID = 'facetIlluminationFlare' as const

export const PRISM_FACET_CHOREOGRAPHY_LIMITS = Object.freeze({
  min: 0,
  max: 1,
  default: 0,
  maxDeltaTimeSec: 0.1,
  alternateDecaySeconds: 0.24,
  opposingDecaySeconds: 0.28,
  flareDecaySeconds: 0.32,
})

export const PRISM_FACET_RUNTIME_UNIFORMS = Object.freeze({
  chaseIndex: 'uFacetChaseIndex',
  chaseStrength: 'uFacetChaseStrength',
  alternate: 'uFacetAlternate',
  opposing: 'uFacetOpposing',
  flare: 'uFacetFlare',
} as const)

export interface PrismFacetIlluminationSnapshot {
  amount: number
  chaseIndex: number
  chaseStrength: number
  alternate: number
  opposing: number
  flare: number
  direction: -1 | 1
}

export interface PrismFacetIlluminationStepInput {
  amount: number
  audio?: Readonly<ShaderAudioUniformFrame>
  timing?: Readonly<ShaderTimingUniformFrame>
  deltaTimeSec?: number
  rotationDirection?: -1 | 0 | 1
  reconstruct?: boolean
}

/**
 * Runtime-only Prism illumination choreography. Stable facet identity comes
 * from Stage 1; this owner only derives bounded musical envelopes and a logical
 * chase address. No per-frame lighting state is persisted.
 */
export class PrismFacetIlluminationChoreographer {
  private chaseIndex = 0
  private chaseStrength = 0
  private alternate = 0
  private opposing = 0
  private flare = 0
  private pendingFlare = 0
  private lastBeatIndex: number | null = null
  private beatLatched = false
  private direction: -1 | 1 = 1

  reset(): void {
    this.chaseIndex = 0
    this.chaseStrength = 0
    this.alternate = 0
    this.opposing = 0
    this.flare = 0
    this.pendingFlare = 0
    this.lastBeatIndex = null
    this.beatLatched = false
    this.direction = 1
  }

  /** Future Drop Director hook: request a runtime-only coherent all-facet flare. */
  requestAllFacetFlare(amount = 1): void {
    this.pendingFlare = Math.max(this.pendingFlare, clamp01(finiteOr(amount, 0)))
  }

  step(input: Readonly<PrismFacetIlluminationStepInput>): PrismFacetIlluminationSnapshot {
    const amount = clamp(
      finiteOr(input.amount, PRISM_FACET_CHOREOGRAPHY_LIMITS.default),
      PRISM_FACET_CHOREOGRAPHY_LIMITS.min,
      PRISM_FACET_CHOREOGRAPHY_LIMITS.max,
    )
    this.direction = input.rotationDirection === -1 ? -1 : 1

    const beatIndex = normalizedBeatIndex(input.timing?.beatIndex)
    const beatHit = clamp01(input.audio?.beatHit ?? 0)

    if (input.reconstruct) {
      this.reset()
      this.direction = input.rotationDirection === -1 ? -1 : 1
      this.lastBeatIndex = beatIndex
      this.chaseIndex = beatIndex == null
        ? 0
        : wrapFacetIndex(beatIndex * this.direction)
      this.beatLatched = beatHit >= 0.35
      return this.snapshot(amount)
    }

    const beatChanged = beatIndex != null
      && this.lastBeatIndex != null
      && beatIndex !== this.lastBeatIndex
    const beatRising = beatHit >= 0.35 && !this.beatLatched

    if (beatChanged && beatIndex != null) {
      this.chaseIndex = wrapFacetIndex(beatIndex * this.direction)
    } else if (this.lastBeatIndex == null && beatIndex != null) {
      // Prefer the shared beat identity on the first frame so entering Prism
      // mid-track is deterministic and does not manufacture a transient step.
      this.chaseIndex = wrapFacetIndex(beatIndex * this.direction)
    } else if (beatRising) {
      this.chaseIndex = wrapFacetIndex(this.chaseIndex + this.direction)
    }

    this.lastBeatIndex = beatIndex
    this.beatLatched = beatHit >= 0.2

    const dt = clamp(
      finiteOr(input.deltaTimeSec ?? input.timing?.deltaTime ?? 0, 0),
      0,
      PRISM_FACET_CHOREOGRAPHY_LIMITS.maxDeltaTimeSec,
    )
    const audio = input.audio
    this.chaseStrength = clamp01(
      beatHit * 0.62
      + clamp01(audio?.bass ?? 0) * 0.22
      + clamp01(audio?.energy ?? 0) * 0.12
      + clamp01(audio?.buildProgress ?? 0) * 0.16,
    )

    const alternateTrigger = Math.max(
      clamp01(audio?.snareHit ?? 0) * 0.95,
      clamp01(audio?.hatHit ?? 0) * 0.42,
    )
    const opposingTrigger = Math.max(
      clamp01(audio?.downbeatHit ?? 0) * 0.95,
      clamp01(audio?.kickHit ?? 0) * 0.68,
    )
    const flareTrigger = Math.max(
      this.pendingFlare,
      clamp01(audio?.kickHit ?? 0) * 0.22,
      clamp01(audio?.dropImpact ?? 0) * 0.82,
    )
    this.pendingFlare = 0

    this.alternate = Math.max(
      decayEnvelope(this.alternate, dt, PRISM_FACET_CHOREOGRAPHY_LIMITS.alternateDecaySeconds),
      alternateTrigger,
    )
    this.opposing = Math.max(
      decayEnvelope(this.opposing, dt, PRISM_FACET_CHOREOGRAPHY_LIMITS.opposingDecaySeconds),
      opposingTrigger,
    )
    this.flare = Math.max(
      decayEnvelope(this.flare, dt, PRISM_FACET_CHOREOGRAPHY_LIMITS.flareDecaySeconds),
      flareTrigger,
    )

    return this.snapshot(amount)
  }

  getSnapshot(amount: number = PRISM_FACET_CHOREOGRAPHY_LIMITS.default): PrismFacetIlluminationSnapshot {
    return this.snapshot(clamp01(amount))
  }

  getRuntimeFloatUniformValues(): ShaderRuntimeFloatUniformValues {
    return Object.freeze({
      [PRISM_FACET_RUNTIME_UNIFORMS.chaseIndex]: this.chaseIndex,
      [PRISM_FACET_RUNTIME_UNIFORMS.chaseStrength]: this.chaseStrength,
      [PRISM_FACET_RUNTIME_UNIFORMS.alternate]: this.alternate,
      [PRISM_FACET_RUNTIME_UNIFORMS.opposing]: this.opposing,
      [PRISM_FACET_RUNTIME_UNIFORMS.flare]: this.flare,
    })
  }

  private snapshot(amount: number): PrismFacetIlluminationSnapshot {
    return {
      amount,
      chaseIndex: this.chaseIndex,
      chaseStrength: this.chaseStrength,
      alternate: this.alternate,
      opposing: this.opposing,
      flare: this.flare,
      direction: this.direction,
    }
  }
}

/** CPU mirror of the production GLSL weighting used by tests and future tools. */
export function resolvePrismFacetIlluminationWeight(
  facetIndex: number,
  snapshot: Readonly<PrismFacetIlluminationSnapshot>,
): number {
  const amount = clamp01(snapshot.amount)
  if (amount <= 0) return 1

  const index = wrapFacetIndex(facetIndex)
  const center = wrapFacetIndex(snapshot.chaseIndex)
  const opposite = wrapFacetIndex(center + PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT / 2)
  const chase = facetPulse(index, center) * clamp01(snapshot.chaseStrength)
  const alternatingMask = positiveMod(index + Math.floor(center), 2) < 1 ? 1 : 0
  const alternating = alternatingMask * clamp01(snapshot.alternate)
  const opposing = Math.max(facetPulse(index, center), facetPulse(index, opposite)) * clamp01(snapshot.opposing)
  const flare = clamp01(snapshot.flare)

  const boost = chase * 0.58 + alternating * 0.42 + opposing * 0.68 + flare * 0.9
  return 1 + amount * boost
}

function facetPulse(index: number, center: number): number {
  const distance = circularFacetDistance(index, center)
  return 1 - smoothstep(0.15, 1.85, distance)
}

function circularFacetDistance(left: number, right: number): number {
  const count = PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT
  const raw = Math.abs(left - right)
  return Math.min(raw, count - raw)
}

function normalizedBeatIndex(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, Math.floor(value))
}

function wrapFacetIndex(value: number): number {
  return positiveMod(Math.floor(finiteOr(value, 0)), PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT)
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function decayEnvelope(value: number, dt: number, seconds: number): number {
  if (value <= 0 || dt <= 0) return clamp01(value)
  return clamp01(value * Math.exp(-dt / Math.max(0.001, seconds)))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return clamp(finiteOr(value, 0), 0, 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Shader-side procedural weights: bounded, facet-indexed, and rotation-stable. */
export const PRISM_FACET_ILLUMINATION_GLSL = `
float prismFacetCircularDistance(float leftIndex, float rightIndex) {
  float raw = abs(leftIndex - rightIndex);
  return min(raw, float(PRISM_TOPOLOGY_ELEMENT_COUNT) - raw);
}

float prismFacetPulse(float facetIndex, float centerIndex) {
  float distance = prismFacetCircularDistance(facetIndex, centerIndex);
  return 1.0 - smoothstep(0.15, 1.85, distance);
}

float prismFacetIlluminationWeight(
  PrismRadialElement element,
  float amount,
  float chaseIndex,
  float chaseStrength,
  float alternateEnvelope,
  float opposingEnvelope,
  float flareEnvelope
) {
  float resolvedAmount = clamp(amount, 0.0, 1.0);
  if (resolvedAmount <= 0.0) return 1.0;

  float center = mod(floor(chaseIndex), float(PRISM_TOPOLOGY_ELEMENT_COUNT));
  float opposite = mod(center + float(PRISM_TOPOLOGY_ELEMENT_COUNT) * 0.5, float(PRISM_TOPOLOGY_ELEMENT_COUNT));
  float chase = prismFacetPulse(element.index, center) * clamp(chaseStrength, 0.0, 1.0);
  float alternatingMask = 1.0 - step(1.0, mod(element.index + floor(center), 2.0));
  float alternating = alternatingMask * clamp(alternateEnvelope, 0.0, 1.0);
  float opposing = max(prismFacetPulse(element.index, center), prismFacetPulse(element.index, opposite))
    * clamp(opposingEnvelope, 0.0, 1.0);
  float flare = clamp(flareEnvelope, 0.0, 1.0);

  float boost = chase * 0.58 + alternating * 0.42 + opposing * 0.68 + flare * 0.9;
  return 1.0 + resolvedAmount * boost;
}
`
