import type { QualityTier, ShaderRuntimeFloatUniformValues } from '../registry/shaderRegistryTypes'

export const PRISM_ECHO_AMOUNT_PARAMETER_ID = 'echoAmount' as const
export const PRISM_ECHO_COUNT_PARAMETER_ID = 'echoCount' as const
export const PRISM_ECHO_SPACING_PARAMETER_ID = 'echoSpacing' as const
export const PRISM_ECHO_DECAY_PARAMETER_ID = 'echoDecay' as const
export const PRISM_ECHO_BURST_RUNTIME_COMMAND_ID = 'prismEchoBurst' as const

export const PRISM_ECHO_MAX_SLOTS = 4 as const

export const PRISM_ECHO_LIMITS = Object.freeze({
  amount: Object.freeze({ min: 0, max: 1, default: 0 }),
  count: Object.freeze({ min: 0, max: PRISM_ECHO_MAX_SLOTS, default: 3 }),
  spacing: Object.freeze({ min: 0.03, max: 0.5, default: 0.12 }),
  decay: Object.freeze({ min: 0.15, max: 1, default: 0.62 }),
  burstDecaySeconds: 0.42,
  maxDeltaTimeSec: 0.1,
})

export const PRISM_ECHO_QUALITY_CAPS: Readonly<Record<QualityTier, number>> = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  ultra: PRISM_ECHO_MAX_SLOTS,
})

export interface PrismEchoStructuralSnapshot {
  rotation: number
  rotationMotion: number
  aperture: number
  baseRadius: number
  curvature: number
  facetAmount: number
  chaseIndex: number
  chaseStrength: number
  alternate: number
  opposing: number
  flare: number
}

export interface PrismEchoStepInput {
  amount: number
  count: number
  spacingSec: number
  decay: number
  qualityTier?: QualityTier
  deltaTimeSec: number
  reconstruct?: boolean
  state: Readonly<PrismEchoStructuralSnapshot>
}

interface PrismEchoHistoryEntry extends PrismEchoStructuralSnapshot {
  valid: boolean
  sequence: number
}

const ECHO_FIELDS = Object.freeze([
  'Rotation',
  'RotationMotion',
  'Aperture',
  'BaseRadius',
  'Curvature',
  'FacetAmount',
  'ChaseIndex',
  'ChaseStrength',
  'Alternate',
  'Opposing',
  'Flare',
] as const)

type EchoField = typeof ECHO_FIELDS[number]

export const PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM = 'uPrismEchoRuntimeAmount' as const

export function prismEchoRuntimeUniformName(slot: number, field: EchoField | 'Opacity'): string {
  return `uPrismEcho${field}${slot}`
}

function createEmptyHistoryEntry(): PrismEchoHistoryEntry {
  return {
    valid: false,
    sequence: -1,
    rotation: 0,
    rotationMotion: 0,
    aperture: 1,
    baseRadius: 0.9,
    curvature: 0.6,
    facetAmount: 0,
    chaseIndex: 0,
    chaseStrength: 0,
    alternate: 0,
    opposing: 0,
    flare: 0,
  }
}

function createRuntimeUniformValues(): Record<string, number> {
  const values: Record<string, number> = { [PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM]: 0 }
  for (let slot = 0; slot < PRISM_ECHO_MAX_SLOTS; slot += 1) {
    values[prismEchoRuntimeUniformName(slot, 'Opacity')] = 0
    for (const field of ECHO_FIELDS) values[prismEchoRuntimeUniformName(slot, field)] = 0
  }
  return values
}

/**
 * Bounded runtime-only structural history for Prism. It stores only the small
 * numeric descriptor required to reconstruct prior radial states in the shader;
 * no framebuffers, GPU handles, or authored settings are retained here.
 */
export class PrismEchoSystem {
  private readonly history: PrismEchoHistoryEntry[] = Array.from(
    { length: PRISM_ECHO_MAX_SLOTS },
    () => createEmptyHistoryEntry(),
  )
  private readonly runtimeUniforms = createRuntimeUniformValues()
  private writeIndex = 0
  private size = 0
  private sequence = 0
  private sampleAccumulatorSec = 0
  private burstAmount = 0

  reset(): void {
    this.writeIndex = 0
    this.size = 0
    this.sequence = 0
    this.sampleAccumulatorSec = 0
    this.burstAmount = 0
    for (const entry of this.history) {
      entry.valid = false
      entry.sequence = -1
    }
    this.clearRuntimeUniforms()
  }

  requestBurst(amount = 1): void {
    this.burstAmount = Math.max(this.burstAmount, clamp01(finiteOr(amount, 0)))
  }

  step(input: Readonly<PrismEchoStepInput>): ShaderRuntimeFloatUniformValues {
    if (input.reconstruct) this.reset()

    const dt = clamp(finiteOr(input.deltaTimeSec, 0), 0, PRISM_ECHO_LIMITS.maxDeltaTimeSec)
    if (this.burstAmount > 0 && dt > 0) {
      this.burstAmount = clamp01(
        this.burstAmount * Math.exp(-dt / PRISM_ECHO_LIMITS.burstDecaySeconds),
      )
    }

    const authoredAmount = clamp(
      finiteOr(input.amount, PRISM_ECHO_LIMITS.amount.default),
      PRISM_ECHO_LIMITS.amount.min,
      PRISM_ECHO_LIMITS.amount.max,
    )
    const effectiveAmount = Math.max(authoredAmount, this.burstAmount)
    const requestedCount = Math.floor(clamp(
      finiteOr(input.count, PRISM_ECHO_LIMITS.count.default),
      PRISM_ECHO_LIMITS.count.min,
      PRISM_ECHO_LIMITS.count.max,
    ))
    const qualityCap = PRISM_ECHO_QUALITY_CAPS[input.qualityTier ?? 'medium']
    const visibleCount = Math.min(requestedCount, qualityCap, PRISM_ECHO_MAX_SLOTS)

    if (effectiveAmount <= 1e-5 || visibleCount <= 0) {
      // Zero amount/count is a true fast path. History is discarded so the
      // next enable/re-entry begins from a valid current-state baseline.
      this.writeIndex = 0
      this.size = 0
      this.sampleAccumulatorSec = 0
      for (const entry of this.history) entry.valid = false
      this.clearRuntimeUniforms()
      return this.runtimeUniforms
    }

    const decay = clamp(
      finiteOr(input.decay, PRISM_ECHO_LIMITS.decay.default),
      PRISM_ECHO_LIMITS.decay.min,
      PRISM_ECHO_LIMITS.decay.max,
    )
    this.populateRuntimeUniforms(effectiveAmount, visibleCount, decay)

    if (!input.reconstruct) {
      const spacingSec = clamp(
        finiteOr(input.spacingSec, PRISM_ECHO_LIMITS.spacing.default),
        PRISM_ECHO_LIMITS.spacing.min,
        PRISM_ECHO_LIMITS.spacing.max,
      )
      if (this.size === 0) {
        this.push(input.state)
        this.sampleAccumulatorSec = 0
      } else {
        this.sampleAccumulatorSec += dt
        if (this.sampleAccumulatorSec >= spacingSec) {
          this.push(input.state)
          this.sampleAccumulatorSec %= spacingSec
        }
      }
    }

    return this.runtimeUniforms
  }

  getRuntimeFloatUniformValues(): ShaderRuntimeFloatUniformValues {
    return this.runtimeUniforms
  }

  /** Test/diagnostic copy only; production rendering reads preallocated uniforms. */
  getHistorySnapshot(): readonly Readonly<PrismEchoStructuralSnapshot>[] {
    const result: PrismEchoStructuralSnapshot[] = []
    for (let offset = 0; offset < this.size; offset += 1) {
      const index = positiveMod(this.writeIndex - 1 - offset, PRISM_ECHO_MAX_SLOTS)
      const entry = this.history[index]
      if (!entry.valid) continue
      result.push(copyStructuralSnapshot(entry))
    }
    return result
  }

  private push(state: Readonly<PrismEchoStructuralSnapshot>): void {
    const target = this.history[this.writeIndex]
    target.valid = true
    target.sequence = this.sequence
    target.rotation = finiteOr(state.rotation, 0)
    target.rotationMotion = finiteOr(state.rotationMotion, 0)
    target.aperture = finiteOr(state.aperture, 1)
    target.baseRadius = finiteOr(state.baseRadius, 0.9)
    target.curvature = finiteOr(state.curvature, 0.6)
    target.facetAmount = finiteOr(state.facetAmount, 0)
    target.chaseIndex = finiteOr(state.chaseIndex, 0)
    target.chaseStrength = finiteOr(state.chaseStrength, 0)
    target.alternate = finiteOr(state.alternate, 0)
    target.opposing = finiteOr(state.opposing, 0)
    target.flare = finiteOr(state.flare, 0)
    this.sequence += 1
    this.writeIndex = (this.writeIndex + 1) % PRISM_ECHO_MAX_SLOTS
    this.size = Math.min(PRISM_ECHO_MAX_SLOTS, this.size + 1)
  }

  private populateRuntimeUniforms(amount: number, visibleCount: number, decay: number): void {
    this.runtimeUniforms[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM] = amount
    for (let slot = 0; slot < PRISM_ECHO_MAX_SLOTS; slot += 1) {
      const opacityName = prismEchoRuntimeUniformName(slot, 'Opacity')
      if (slot >= visibleCount || slot >= this.size) {
        this.runtimeUniforms[opacityName] = 0
        continue
      }
      const index = positiveMod(this.writeIndex - 1 - slot, PRISM_ECHO_MAX_SLOTS)
      const entry = this.history[index]
      if (!entry.valid) {
        this.runtimeUniforms[opacityName] = 0
        continue
      }
      this.runtimeUniforms[opacityName] = 0.52 * Math.pow(decay, slot)
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Rotation')] = entry.rotation
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'RotationMotion')] = entry.rotationMotion
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Aperture')] = entry.aperture
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'BaseRadius')] = entry.baseRadius
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Curvature')] = entry.curvature
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'FacetAmount')] = entry.facetAmount
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'ChaseIndex')] = entry.chaseIndex
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'ChaseStrength')] = entry.chaseStrength
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Alternate')] = entry.alternate
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Opposing')] = entry.opposing
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Flare')] = entry.flare
    }
  }

  private clearRuntimeUniforms(): void {
    this.runtimeUniforms[PRISM_ECHO_RUNTIME_AMOUNT_UNIFORM] = 0
    for (let slot = 0; slot < PRISM_ECHO_MAX_SLOTS; slot += 1) {
      this.runtimeUniforms[prismEchoRuntimeUniformName(slot, 'Opacity')] = 0
    }
  }
}

function copyStructuralSnapshot(entry: Readonly<PrismEchoStructuralSnapshot>): PrismEchoStructuralSnapshot {
  return {
    rotation: entry.rotation,
    rotationMotion: entry.rotationMotion,
    aperture: entry.aperture,
    baseRadius: entry.baseRadius,
    curvature: entry.curvature,
    facetAmount: entry.facetAmount,
    chaseIndex: entry.chaseIndex,
    chaseStrength: entry.chaseStrength,
    alternate: entry.alternate,
    opposing: entry.opposing,
    flare: entry.flare,
  }
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
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

export const PRISM_ECHO_GLSL = `
uniform float uPrismEchoRuntimeAmount;

uniform float uPrismEchoOpacity0;
uniform float uPrismEchoRotation0;
uniform float uPrismEchoRotationMotion0;
uniform float uPrismEchoAperture0;
uniform float uPrismEchoBaseRadius0;
uniform float uPrismEchoCurvature0;
uniform float uPrismEchoFacetAmount0;
uniform float uPrismEchoChaseIndex0;
uniform float uPrismEchoChaseStrength0;
uniform float uPrismEchoAlternate0;
uniform float uPrismEchoOpposing0;
uniform float uPrismEchoFlare0;

uniform float uPrismEchoOpacity1;
uniform float uPrismEchoRotation1;
uniform float uPrismEchoRotationMotion1;
uniform float uPrismEchoAperture1;
uniform float uPrismEchoBaseRadius1;
uniform float uPrismEchoCurvature1;
uniform float uPrismEchoFacetAmount1;
uniform float uPrismEchoChaseIndex1;
uniform float uPrismEchoChaseStrength1;
uniform float uPrismEchoAlternate1;
uniform float uPrismEchoOpposing1;
uniform float uPrismEchoFlare1;

uniform float uPrismEchoOpacity2;
uniform float uPrismEchoRotation2;
uniform float uPrismEchoRotationMotion2;
uniform float uPrismEchoAperture2;
uniform float uPrismEchoBaseRadius2;
uniform float uPrismEchoCurvature2;
uniform float uPrismEchoFacetAmount2;
uniform float uPrismEchoChaseIndex2;
uniform float uPrismEchoChaseStrength2;
uniform float uPrismEchoAlternate2;
uniform float uPrismEchoOpposing2;
uniform float uPrismEchoFlare2;

uniform float uPrismEchoOpacity3;
uniform float uPrismEchoRotation3;
uniform float uPrismEchoRotationMotion3;
uniform float uPrismEchoAperture3;
uniform float uPrismEchoBaseRadius3;
uniform float uPrismEchoCurvature3;
uniform float uPrismEchoFacetAmount3;
uniform float uPrismEchoChaseIndex3;
uniform float uPrismEchoChaseStrength3;
uniform float uPrismEchoAlternate3;
uniform float uPrismEchoOpposing3;
uniform float uPrismEchoFlare3;

vec3 prismStructuralEcho(
  vec2 uv,
  float opacity,
  float rotation,
  float rotationMotion,
  float aperture,
  float baseRadius,
  float curvature,
  float facetAmount,
  float chaseIndex,
  float chaseStrength,
  float alternateEnvelope,
  float opposingEnvelope,
  float flareEnvelope,
  vec3 primary,
  vec3 secondary
) {
  float echoAmount = max(clamp(uEchoAmount, 0.0, 1.0), clamp(uPrismEchoRuntimeAmount, 0.0, 1.0));
  float resolvedOpacity = clamp(opacity, 0.0, 1.0) * echoAmount;
  if (resolvedOpacity <= 0.0001) return vec3(0.0);

  float rotAng = rotation + rotationMotion * uMasterMotion;
  float cs = cos(rotAng);
  float sn = sin(rotAng);
  vec2 radialUv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);
  PrismRadialElement element = prismTopologyAt(radialUv, baseRadius, curvature);
  element = prismApplyAperture(element, baseRadius, aperture);
  float illumination = prismFacetIlluminationWeight(
    element,
    facetAmount,
    chaseIndex,
    chaseStrength,
    alternateEnvelope,
    opposingEnvelope,
    flareEnvelope
  );

  float sectorAngle = PRISM_TOPOLOGY_TAU / float(PRISM_TOPOLOGY_ELEMENT_COUNT);
  float local = element.localAngle / (sectorAngle * 0.5);
  float angularCore = 1.0 - smoothstep(0.58, 1.0, abs(local));
  float angularEdge = smoothstep(0.72, 0.96, abs(local)) * (1.0 - smoothstep(0.96, 1.0, abs(local)));
  float radius = length(radialUv);
  float shapedRadius = radius + sin(local * 1.57079632679) * curvature * 0.055 + element.curvature * 0.014;
  float innerFeather = max(0.012, baseRadius * 0.035);
  float outerFeather = max(0.02, baseRadius * 0.05);
  float insideOuter = 1.0 - smoothstep(element.outerRadius - outerFeather, element.outerRadius + outerFeather, shapedRadius);
  float outsideInner = smoothstep(element.innerRadius - innerFeather, element.innerRadius + innerFeather, shapedRadius);
  float facetMask = insideOuter * outsideInner * angularCore;
  float span = max(element.outerRadius - element.innerRadius, 0.001);
  float radialT = clamp((shapedRadius - element.innerRadius) / span, 0.0, 1.0);
  float paletteMix = 0.5 + 0.5 * sin(element.normalizedIndex * PRISM_TOPOLOGY_TAU * 2.0 + radialT * 3.0);
  vec3 facetColor = mix(primary, secondary, paletteMix);
  float halo = exp(-abs(radius - element.innerRadius) * (14.0 / max(baseRadius, 0.2)));
  float structure = facetMask * (0.26 + angularEdge * 0.48) + halo * facetMask * 0.18;
  return facetColor * structure * illumination * resolvedOpacity;
}
`
