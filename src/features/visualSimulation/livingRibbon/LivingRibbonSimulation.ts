import { FixedStepSimulationClock } from '../clock'
import {
  VisualSimulationLifecycleController,
  type VisualSimulationConfigureResult,
  type VisualSimulationRuntimeMode,
  type VisualSimulationTimingReason,
  type VisualSimulationTimingSynchronization,
} from '../lifecycle'
import { clampSimulationNumber, finiteSimulationNumber } from '../math'
import { clampVisualSimulationResourceBudget, type VisualSimulationQualityTier } from '../quality'
import {
  hashVisualSimulationString,
  mixVisualSimulationHash,
  sampleVisualSimulationVectorNoise3D,
  visualSimulationDeterministicSigned,
  visualSimulationDeterministicUnit,
} from '../random'
import { createVisualSimulationStructuralSignature } from '../signature'

export const LIVING_RIBBON_FIXED_TIMESTEP_SEC = 1 / 120
export const LIVING_RIBBON_MAX_SUBSTEPS = 8
export const LIVING_RIBBON_MAX_FRAME_DELTA_SEC = 0.1
const LIVING_RIBBON_MAX_ACCUMULATOR_SEC = LIVING_RIBBON_FIXED_TIMESTEP_SEC * LIVING_RIBBON_MAX_SUBSTEPS
const MIN_POINT_COUNT = 8
const MAX_IMPULSE_STRENGTH = 4
const MAX_REMEMBERED_IMPULSES = 256
const EPSILON = 1e-6

export type LivingRibbonInitializationMode = 'line' | 'arc' | 'wave' | 'spiral'

export interface LivingRibbonStructuralSettings {
  pointCount: number
  totalLength: number
  baseSeed: number
  initializationMode: LivingRibbonInitializationMode
  fieldScale: number
  boundarySize: number
  qualityTier?: VisualSimulationQualityTier
}

export interface LivingRibbonRuntimeControls {
  drive: number
  turbulence: number
  tension: number
  damping: number
  spread: number
  centerAttraction: number
  widthTarget: number
  twist: number
  radialPressure: number
  collapseAmount: number
  releaseAmount: number
  directionalDrift: number
  heatDecay: number
}

export interface LivingRibbonConfigureInput {
  structural: LivingRibbonStructuralSettings
  controls: LivingRibbonRuntimeControls
  mode?: VisualSimulationRuntimeMode
}

export interface LivingRibbonUpdateInput {
  deltaTimeSec: number
}

export interface LivingRibbonImpulseInput {
  identity: string | number
  strength: number
  direction?: readonly [number, number, number]
}

export interface LivingRibbonLocalizedImpulseInput extends LivingRibbonImpulseInput {
  /** Normalized position along the ribbon, from 0 at the first point to 1 at the last. */
  location: number
  radius?: number
}

export interface LivingRibbonRenderView {
  readonly positions: Float32Array
  readonly previousPositions: Float32Array
  readonly velocities: Float32Array
  readonly speedMagnitudes: Float32Array
  readonly heat: Float32Array
  readonly widths: Float32Array
  readonly activePointCount: number
  readonly interpolationAlpha: number
  readonly structuralSignature: string
  readonly structureRevision: number
  readonly baseSeed: number
  readonly restSpacing: number
  readonly boundarySize: number
  readonly simulationTimeSec: number
  readonly runtimeMode: VisualSimulationRuntimeMode
}

interface NormalizedLivingRibbonStructuralSettings extends LivingRibbonStructuralSettings {
  qualityTier: VisualSimulationQualityTier
}

type ImpulseKind =
  | 'radialImpact'
  | 'lateralShock'
  | 'fineRipple'
  | 'collapseImpulse'
  | 'releaseBurst'
  | 'twistImpulse'
  | 'localizedImpulse'

const MODE_POINT_CAPS: Readonly<Record<VisualSimulationRuntimeMode, number>> = {
  live: 256,
  preview: 128,
  thumbnail: 64,
}

const QUALITY_POINT_CAPS: Readonly<Record<VisualSimulationQualityTier, number>> = {
  low: 64,
  medium: 128,
  high: 256,
  auto: 192,
}

const DEFAULT_CONTROLS: LivingRibbonRuntimeControls = {
  drive: 0.15,
  turbulence: 0.18,
  tension: 0.62,
  damping: 0.52,
  spread: 0.5,
  centerAttraction: 0.2,
  widthTarget: 0.5,
  twist: 0.08,
  radialPressure: 0,
  collapseAmount: 0,
  releaseAmount: 0,
  directionalDrift: 0.08,
  heatDecay: 0.45,
}

function normalizedMode(mode: VisualSimulationRuntimeMode | undefined): VisualSimulationRuntimeMode {
  return mode ?? 'live'
}

function normalizeStructural(
  value: LivingRibbonStructuralSettings,
  mode: VisualSimulationRuntimeMode,
): NormalizedLivingRibbonStructuralSettings {
  const qualityTier = value.qualityTier ?? 'auto'
  const sharedCap = clampVisualSimulationResourceBudget(
    { simulationPointCount: Math.max(MIN_POINT_COUNT, finiteSimulationNumber(value.pointCount, 96)) },
    qualityTier,
  ).simulationPointCount
  const pointCount = Math.max(
    MIN_POINT_COUNT,
    Math.min(
      MODE_POINT_CAPS[mode],
      QUALITY_POINT_CAPS[qualityTier],
      sharedCap,
      Math.floor(finiteSimulationNumber(value.pointCount, 96)),
    ),
  )
  const boundarySize = clampSimulationNumber(finiteSimulationNumber(value.boundarySize, 8), 0.5, 64)
  return {
    pointCount,
    totalLength: Math.min(
      boundarySize * 1.8,
      clampSimulationNumber(finiteSimulationNumber(value.totalLength, 8), 0.25, 64),
    ),
    baseSeed: Math.trunc(finiteSimulationNumber(value.baseSeed)) >>> 0,
    initializationMode: value.initializationMode ?? 'wave',
    fieldScale: clampSimulationNumber(finiteSimulationNumber(value.fieldScale, 0.42), 0.01, 8),
    boundarySize,
    qualityTier,
  }
}

function normalizeControls(value: Partial<LivingRibbonRuntimeControls>): LivingRibbonRuntimeControls {
  return {
    drive: clampSimulationNumber(finiteSimulationNumber(value.drive, DEFAULT_CONTROLS.drive), 0, 1),
    turbulence: clampSimulationNumber(finiteSimulationNumber(value.turbulence, DEFAULT_CONTROLS.turbulence), 0, 1),
    tension: clampSimulationNumber(finiteSimulationNumber(value.tension, DEFAULT_CONTROLS.tension), 0, 1),
    damping: clampSimulationNumber(finiteSimulationNumber(value.damping, DEFAULT_CONTROLS.damping), 0, 1),
    spread: clampSimulationNumber(finiteSimulationNumber(value.spread, DEFAULT_CONTROLS.spread), 0, 1),
    centerAttraction: clampSimulationNumber(finiteSimulationNumber(value.centerAttraction, DEFAULT_CONTROLS.centerAttraction), 0, 1),
    widthTarget: clampSimulationNumber(finiteSimulationNumber(value.widthTarget, DEFAULT_CONTROLS.widthTarget), 0, 1),
    twist: clampSimulationNumber(finiteSimulationNumber(value.twist, DEFAULT_CONTROLS.twist), -1, 1),
    radialPressure: clampSimulationNumber(finiteSimulationNumber(value.radialPressure, DEFAULT_CONTROLS.radialPressure), -1, 1),
    collapseAmount: clampSimulationNumber(finiteSimulationNumber(value.collapseAmount, DEFAULT_CONTROLS.collapseAmount), 0, 1),
    releaseAmount: clampSimulationNumber(finiteSimulationNumber(value.releaseAmount, DEFAULT_CONTROLS.releaseAmount), 0, 1),
    directionalDrift: clampSimulationNumber(finiteSimulationNumber(value.directionalDrift, DEFAULT_CONTROLS.directionalDrift), -1, 1),
    heatDecay: clampSimulationNumber(finiteSimulationNumber(value.heatDecay, DEFAULT_CONTROLS.heatDecay), 0, 1),
  }
}

function impulseIdentity(kind: ImpulseKind, identity: string | number): string {
  return `${kind}|${String(identity)}`
}

function clampStrength(value: number): number {
  return clampSimulationNumber(finiteSimulationNumber(value), 0, MAX_IMPULSE_STRENGTH)
}

function normalizeDirection(
  input: readonly [number, number, number] | undefined,
  fallbackSeed: number,
  output: Float32Array,
): void {
  let x = finiteSimulationNumber(input?.[0], visualSimulationDeterministicSigned(fallbackSeed, 0))
  let y = finiteSimulationNumber(input?.[1], visualSimulationDeterministicSigned(fallbackSeed, 1))
  let z = finiteSimulationNumber(input?.[2], visualSimulationDeterministicSigned(fallbackSeed, 2))
  let length = Math.hypot(x, y, z)
  if (length < EPSILON) {
    x = 1
    y = 0
    z = 0
    length = 1
  }
  output[0] = x / length
  output[1] = y / length
  output[2] = z / length
}

/**
 * Music-agnostic, renderer-independent ribbon physics. The class consumes only
 * normalized physical controls and explicit physical impulses.
 */
export class LivingRibbonSimulation {
  private structural: NormalizedLivingRibbonStructuralSettings | null = null
  private controls: LivingRibbonRuntimeControls = { ...DEFAULT_CONTROLS }
  private runtimeMode: VisualSimulationRuntimeMode = 'live'
  private positions = new Float32Array(0)
  private previousPositions = new Float32Array(0)
  private velocities = new Float32Array(0)
  private forces = new Float32Array(0)
  private anchors = new Float32Array(0)
  private phases = new Float32Array(0)
  private widths = new Float32Array(0)
  private heat = new Float32Array(0)
  private speedMagnitudes = new Float32Array(0)
  private readonly noiseScratch = new Float32Array(3)
  private readonly directionScratch = new Float32Array(3)
  private rememberedImpulseIdentities = new Set<string>()
  private rememberedImpulseOrder: string[] = []
  private rememberedImpulseCursor = 0
  private lastTimingIdentity: string | number | null | undefined
  private lastTimingReason: VisualSimulationTimingReason | null = null
  private interpolationAlpha = 1
  private structuralSignature = ''
  private structureRevision = 0
  private restSpacing = 1
  private disposed = false
  private readonly clock = new FixedStepSimulationClock({
    fixedTimestepSec: LIVING_RIBBON_FIXED_TIMESTEP_SEC,
    maxFrameDeltaSec: LIVING_RIBBON_MAX_FRAME_DELTA_SEC,
    maxSubsteps: LIVING_RIBBON_MAX_SUBSTEPS,
    maxAccumulatorSec: LIVING_RIBBON_MAX_ACCUMULATOR_SEC,
  })
  private readonly lifecycle: VisualSimulationLifecycleController<NormalizedLivingRibbonStructuralSettings, LivingRibbonRuntimeControls>
  private readonly renderView: LivingRibbonRenderView = {
    positions: this.positions,
    previousPositions: this.previousPositions,
    velocities: this.velocities,
    speedMagnitudes: this.speedMagnitudes,
    heat: this.heat,
    widths: this.widths,
    activePointCount: 0,
    interpolationAlpha: 1,
    structuralSignature: '',
    structureRevision: 0,
    baseSeed: 0,
    restSpacing: 1,
    boundarySize: 1,
    simulationTimeSec: 0,
    runtimeMode: 'live',
  }

  constructor() {
    this.lifecycle = new VisualSimulationLifecycleController({
      rebuild: (structural, controls, mode) => this.rebuild(structural, controls, mode),
      updateParameters: (controls, mode) => {
        this.controls = controls
        this.runtimeMode = mode
      },
      reset: input => this.resetState(input.seed, input.identity),
      synchronizeTiming: input => this.synchronizeTimingState(input),
      pause: () => this.clock.pause(),
      resume: () => this.clock.resume(),
      setRuntimeMode: mode => {
        this.runtimeMode = mode
      },
      releaseResources: () => this.releaseResources(),
    })
  }

  configure(input: LivingRibbonConfigureInput): VisualSimulationConfigureResult {
    const mode = normalizedMode(input.mode)
    const structural = normalizeStructural(input.structural, mode)
    const controls = normalizeControls(input.controls)
    const result = this.lifecycle.configure({ structural, parameters: controls, mode })
    this.structuralSignature = result.structuralSignature
    this.structureRevision = result.structureRevision
    this.updateRenderView()
    return result
  }

  updateParameters(controls: LivingRibbonRuntimeControls): VisualSimulationConfigureResult {
    if (!this.structural) throw new Error('Living Ribbon must be configured before parameters can be updated.')
    return this.configure({ structural: this.structural, controls, mode: this.runtimeMode })
  }

  update(input: LivingRibbonUpdateInput): number {
    if (this.disposed || !this.structural || this.positions.length === 0) return 0
    const frame = this.clock.advance(input.deltaTimeSec, (dt, simulationTimeSec) => {
      this.integrateStep(dt, simulationTimeSec)
    })
    this.interpolationAlpha = frame.steps > 0 ? frame.interpolationAlpha : 1
    this.updateRenderView()
    return frame.steps
  }

  deterministicReset(seed = this.structural?.baseSeed ?? 0, identity?: string | number | null): void {
    this.lifecycle.reset({ seed, identity })
  }

  pause(): void {
    this.lifecycle.pause()
    this.updateRenderView()
  }

  resume(): void {
    this.lifecycle.resume()
    this.updateRenderView()
  }

  seek(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.seek(timeSec, identity)
  }

  backwardSeek(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.backwardSeek(timeSec, identity)
  }

  synchronizeTiming(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.synchronizeTiming({ reason: 'timingDiscontinuity', timeSec, identity })
  }

  loopWrap(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.loopWrap(timeSec, identity)
  }

  replaceTrack(seed = this.structural?.baseSeed ?? 0, identity?: string | number | null): void {
    if (this.structural && seed !== this.structural.baseSeed) {
      this.configure({
        structural: { ...this.structural, baseSeed: seed },
        controls: this.controls,
        mode: this.runtimeMode,
      })
    }
    this.lifecycle.replaceTrack(0, identity)
  }

  warmStart(durationSec = 0.15, maximumSteps = 24): number {
    if (!this.structural || this.clock.isPaused() || this.clock.isFrozen()) return 0
    const requested = Math.max(0, Math.floor(durationSec / LIVING_RIBBON_FIXED_TIMESTEP_SEC))
    const bounded = Math.min(Math.max(0, Math.floor(maximumSteps)), requested)
    let completed = 0
    for (let index = 0; index < bounded; index += 1) {
      completed += this.update({ deltaTimeSec: LIVING_RIBBON_FIXED_TIMESTEP_SEC })
    }
    return completed
  }

  radialImpact(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('radialImpact', input, (index, offset, strength) => {
      const x = this.positions[offset]
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const length = Math.hypot(x, y, z) || 1
      const falloff = 0.65 + this.phases[index * 2] * 0.35
      this.addVelocity(offset, x / length * strength * falloff, y / length * strength * falloff, z / length * strength * falloff)
      this.heat[index] = Math.min(1, this.heat[index] + strength * 0.25)
    })
  }

  lateralShock(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('lateralShock', input, (_index, offset, strength, direction) => {
      this.addVelocity(offset, direction[0] * strength, direction[1] * strength, direction[2] * strength)
    })
  }

  fineRipple(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('fineRipple', input, (index, offset, strength, direction) => {
      const wave = Math.sin(this.phases[index * 2 + 1] * Math.PI * 2 + index * 1.618)
      const amount = strength * wave * 0.42
      this.addVelocity(offset, direction[0] * amount, direction[1] * amount, direction[2] * amount)
      this.heat[index] = Math.min(1, this.heat[index] + Math.abs(amount) * 0.2)
    })
  }

  collapseImpulse(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('collapseImpulse', input, (_index, offset, strength) => {
      const x = this.positions[offset]
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const length = Math.hypot(x, y, z) || 1
      this.addVelocity(offset, -x / length * strength, -y / length * strength, -z / length * strength)
    })
  }

  releaseBurst(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('releaseBurst', input, (index, offset, strength) => {
      const anchorOffset = index * 3
      let x = this.positions[offset] - this.anchors[anchorOffset]
      let y = this.positions[offset + 1] - this.anchors[anchorOffset + 1]
      let z = this.positions[offset + 2] - this.anchors[anchorOffset + 2]
      let length = Math.hypot(x, y, z)
      if (length < EPSILON) {
        x = visualSimulationDeterministicSigned(this.structural?.baseSeed ?? 0, index * 3)
        y = visualSimulationDeterministicSigned(this.structural?.baseSeed ?? 0, index * 3 + 1)
        z = visualSimulationDeterministicSigned(this.structural?.baseSeed ?? 0, index * 3 + 2)
        length = Math.hypot(x, y, z) || 1
      }
      this.addVelocity(offset, x / length * strength, y / length * strength, z / length * strength)
      this.heat[index] = Math.min(1, this.heat[index] + strength * 0.3)
    })
  }

  twistImpulse(input: LivingRibbonImpulseInput): boolean {
    return this.applyImpulse('twistImpulse', input, (_index, offset, strength, direction) => {
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const handedness = direction[0] >= 0 ? 1 : -1
      this.addVelocity(offset, 0, -z * strength * handedness, y * strength * handedness)
    })
  }

  localizedImpulse(input: LivingRibbonLocalizedImpulseInput): boolean {
    const location = clampSimulationNumber(finiteSimulationNumber(input.location, 0.5), 0, 1)
    const radius = clampSimulationNumber(finiteSimulationNumber(input.radius, 0.15), 0.01, 1)
    return this.applyImpulse('localizedImpulse', input, (index, offset, strength, direction) => {
      const normalizedIndex = this.positions.length <= 3 ? 0 : index / (this.positions.length / 3 - 1)
      const distance = Math.abs(normalizedIndex - location)
      if (distance > radius) return
      const falloff = 1 - distance / radius
      const amount = strength * falloff * falloff
      this.addVelocity(offset, direction[0] * amount, direction[1] * amount, direction[2] * amount)
      this.heat[index] = Math.min(1, this.heat[index] + amount * 0.35)
    })
  }

  getRenderView(): LivingRibbonRenderView {
    this.updateRenderView()
    return this.renderView
  }

  getStructuralSignature(): string {
    return this.structuralSignature
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.lifecycle.dispose()
  }

  private rebuild(
    structural: NormalizedLivingRibbonStructuralSettings,
    controls: LivingRibbonRuntimeControls,
    mode: VisualSimulationRuntimeMode,
  ): void {
    this.structural = structural
    this.controls = controls
    this.runtimeMode = mode
    const vectorLength = structural.pointCount * 3
    this.positions = new Float32Array(vectorLength)
    this.previousPositions = new Float32Array(vectorLength)
    this.velocities = new Float32Array(vectorLength)
    this.forces = new Float32Array(vectorLength)
    this.anchors = new Float32Array(vectorLength)
    this.phases = new Float32Array(structural.pointCount * 2)
    this.widths = new Float32Array(structural.pointCount)
    this.heat = new Float32Array(structural.pointCount)
    this.speedMagnitudes = new Float32Array(structural.pointCount)
    this.restSpacing = structural.totalLength / Math.max(1, structural.pointCount - 1)
    this.initializeGeometry(structural.baseSeed, null)
    this.clearRememberedImpulses()
    this.lastTimingIdentity = undefined
    this.lastTimingReason = null
    this.clock.synchronize('manual', 0)
    this.interpolationAlpha = 1
    this.updateRenderView()
  }

  private resetState(seed: number, identity?: string | number | null): void {
    if (!this.structural) return
    const identityHash = identity == null ? 0 : hashVisualSimulationString(String(identity))
    const resetSeed = identity == null
      ? Math.trunc(seed) >>> 0
      : mixVisualSimulationHash((Math.trunc(seed) >>> 0) ^ identityHash)
    this.initializeGeometry(resetSeed, identity)
    this.clearRememberedImpulses()
    this.clock.synchronize('manual', 0)
    this.interpolationAlpha = 1
    this.updateRenderView()
  }

  private initializeGeometry(seed: number, _identity?: string | number | null): void {
    if (!this.structural) return
    const count = this.structural.pointCount
    const halfLength = this.structural.totalLength * 0.5
    for (let index = 0; index < count; index += 1) {
      const t = count <= 1 ? 0 : index / (count - 1)
      const centered = t * 2 - 1
      const phase = visualSimulationDeterministicUnit(seed, index * 2)
      const phase2 = visualSimulationDeterministicUnit(seed, index * 2 + 1)
      let x = centered * halfLength
      let y = 0
      let z = 0
      switch (this.structural.initializationMode) {
        case 'arc': {
          const angle = centered * Math.PI * 0.7
          const radius = this.structural.totalLength / Math.PI
          x = Math.sin(angle) * radius
          y = (1 - Math.cos(angle)) * radius * 0.55
          break
        }
        case 'wave':
          y = Math.sin(t * Math.PI * 2 + phase * 0.35) * this.restSpacing * 1.5
          z = Math.cos(t * Math.PI * 1.5 + phase2 * 0.3) * this.restSpacing * 0.6
          break
        case 'spiral': {
          const angle = centered * Math.PI * 2.2
          const radius = this.restSpacing * (1.2 + Math.abs(centered) * 1.4)
          y = Math.sin(angle) * radius
          z = Math.cos(angle) * radius
          break
        }
        case 'line':
          break
      }
      const initialRadius = Math.hypot(x, y, z)
      if (initialRadius > this.structural.boundarySize * 0.9 && initialRadius > 0) {
        const initialScale = this.structural.boundarySize * 0.9 / initialRadius
        x *= initialScale
        y *= initialScale
        z *= initialScale
      }
      const offset = index * 3
      this.anchors[offset] = x
      this.anchors[offset + 1] = y
      this.anchors[offset + 2] = z
      this.positions[offset] = x
      this.positions[offset + 1] = y
      this.positions[offset + 2] = z
      this.previousPositions[offset] = x
      this.previousPositions[offset + 1] = y
      this.previousPositions[offset + 2] = z
      this.phases[index * 2] = phase
      this.phases[index * 2 + 1] = phase2
      this.widths[index] = 0.25 + this.controls.widthTarget * 0.75
      this.heat[index] = 0
      this.speedMagnitudes[index] = 0
    }
    this.velocities.fill(0)
    this.forces.fill(0)
  }

  private integrateStep(dt: number, simulationTimeSec: number): void {
    const structural = this.structural
    if (!structural) return
    const count = structural.pointCount
    this.previousPositions.set(this.positions)
    this.forces.fill(0)

    const springStrength = 24 + this.controls.tension * 96
    const bendStrength = 2 + this.controls.tension * 18
    for (let index = 0; index < count - 1; index += 1) {
      const a = index * 3
      const b = a + 3
      const dx = this.positions[b] - this.positions[a]
      const dy = this.positions[b + 1] - this.positions[a + 1]
      const dz = this.positions[b + 2] - this.positions[a + 2]
      const distance = Math.hypot(dx, dy, dz) || EPSILON
      const force = (distance - this.restSpacing) * springStrength
      const fx = dx / distance * force
      const fy = dy / distance * force
      const fz = dz / distance * force
      this.forces[a] += fx
      this.forces[a + 1] += fy
      this.forces[a + 2] += fz
      this.forces[b] -= fx
      this.forces[b + 1] -= fy
      this.forces[b + 2] -= fz
    }

    for (let index = 1; index < count - 1; index += 1) {
      const previous = (index - 1) * 3
      const offset = index * 3
      const next = (index + 1) * 3
      this.forces[offset] += ((this.positions[previous] + this.positions[next]) * 0.5 - this.positions[offset]) * bendStrength
      this.forces[offset + 1] += ((this.positions[previous + 1] + this.positions[next + 1]) * 0.5 - this.positions[offset + 1]) * bendStrength
      this.forces[offset + 2] += ((this.positions[previous + 2] + this.positions[next + 2]) * 0.5 - this.positions[offset + 2]) * bendStrength
    }

    const driftSeed = mixVisualSimulationHash(structural.baseSeed ^ 0x4d2c6df1)
    const driftX = visualSimulationDeterministicSigned(driftSeed, 0)
    const driftY = visualSimulationDeterministicSigned(driftSeed, 1)
    const driftZ = visualSimulationDeterministicSigned(driftSeed, 2)
    const driftLength = Math.hypot(driftX, driftY, driftZ) || 1
    const spreadScale = 0.45 + this.controls.spread * 1.1
    const anchorStrength = 0.8 + this.controls.tension * 5.5
    const centerStrength = this.controls.centerAttraction * 4.5
    const turbulenceStrength = this.controls.turbulence * 7
    const driveStrength = this.controls.drive * 3.5
    const radialStrength = this.controls.radialPressure * 4.5
      - this.controls.collapseAmount * 6
      + this.controls.releaseAmount * 3
    const twistStrength = this.controls.twist * 4.5
    const driftStrength = this.controls.directionalDrift * 2.5
    const fieldScale = structural.fieldScale

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      const x = this.positions[offset]
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const anchorX = this.anchors[offset] * spreadScale
      const anchorY = this.anchors[offset + 1] * spreadScale
      const anchorZ = this.anchors[offset + 2] * spreadScale
      this.forces[offset] += (anchorX - x) * anchorStrength - x * centerStrength
      this.forces[offset + 1] += (anchorY - y) * anchorStrength - y * centerStrength
      this.forces[offset + 2] += (anchorZ - z) * anchorStrength - z * centerStrength

      sampleVisualSimulationVectorNoise3D(
        x * fieldScale + simulationTimeSec * 0.19,
        y * fieldScale - simulationTimeSec * 0.13,
        z * fieldScale + this.phases[index * 2] * 3,
        structural.baseSeed,
        this.noiseScratch,
      )
      this.forces[offset] += this.noiseScratch[0] * turbulenceStrength
      this.forces[offset + 1] += this.noiseScratch[1] * turbulenceStrength
      this.forces[offset + 2] += this.noiseScratch[2] * turbulenceStrength

      const previousOffset = Math.max(0, index - 1) * 3
      const nextOffset = Math.min(count - 1, index + 1) * 3
      let tangentX = this.positions[nextOffset] - this.positions[previousOffset]
      let tangentY = this.positions[nextOffset + 1] - this.positions[previousOffset + 1]
      let tangentZ = this.positions[nextOffset + 2] - this.positions[previousOffset + 2]
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1
      tangentX /= tangentLength
      tangentY /= tangentLength
      tangentZ /= tangentLength
      const drivePhase = Math.sin(simulationTimeSec * 1.7 + this.phases[index * 2 + 1] * Math.PI * 2)
      this.forces[offset] += (tangentX * 0.2 + this.noiseScratch[1]) * driveStrength * drivePhase
      this.forces[offset + 1] += (tangentY * 0.2 - this.noiseScratch[0]) * driveStrength * drivePhase
      this.forces[offset + 2] += (tangentZ * 0.2 + this.noiseScratch[2]) * driveStrength * drivePhase

      const radius = Math.hypot(x, y, z) || 1
      this.forces[offset] += x / radius * radialStrength
      this.forces[offset + 1] += y / radius * radialStrength
      this.forces[offset + 2] += z / radius * radialStrength
      this.forces[offset + 1] += -z * twistStrength
      this.forces[offset + 2] += y * twistStrength
      this.forces[offset] += driftX / driftLength * driftStrength
      this.forces[offset + 1] += driftY / driftLength * driftStrength
      this.forces[offset + 2] += driftZ / driftLength * driftStrength
    }

    const dampingRate = 0.8 + this.controls.damping * 11
    const damping = Math.exp(-dampingRate * dt)
    const maximumVelocity = Math.min(8, 2 + this.controls.drive * 5 + this.controls.releaseAmount * 3)
    const maximumDisplacement = structural.boundarySize * (0.8 + this.controls.spread * 0.45)
    const widthTarget = 0.15 + this.controls.widthTarget * 1.85
    const widthResponse = 1 - Math.exp(-dt * 7)
    const heatDamping = Math.exp(-dt * (0.3 + this.controls.heatDecay * 8))

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      let vx = (finiteSimulationNumber(this.velocities[offset]) + finiteSimulationNumber(this.forces[offset]) * dt) * damping
      let vy = (finiteSimulationNumber(this.velocities[offset + 1]) + finiteSimulationNumber(this.forces[offset + 1]) * dt) * damping
      let vz = (finiteSimulationNumber(this.velocities[offset + 2]) + finiteSimulationNumber(this.forces[offset + 2]) * dt) * damping
      let speed = Math.hypot(vx, vy, vz)
      if (speed > maximumVelocity && speed > 0) {
        const velocityScale = maximumVelocity / speed
        vx *= velocityScale
        vy *= velocityScale
        vz *= velocityScale
        speed = maximumVelocity
      }
      let x = finiteSimulationNumber(this.positions[offset]) + vx * dt
      let y = finiteSimulationNumber(this.positions[offset + 1]) + vy * dt
      let z = finiteSimulationNumber(this.positions[offset + 2]) + vz * dt
      const anchorX = this.anchors[offset]
      const anchorY = this.anchors[offset + 1]
      const anchorZ = this.anchors[offset + 2]
      const dx = x - anchorX
      const dy = y - anchorY
      const dz = z - anchorZ
      const displacement = Math.hypot(dx, dy, dz)
      if (!Number.isFinite(displacement) || !Number.isFinite(speed)) {
        x = anchorX
        y = anchorY
        z = anchorZ
        vx = 0
        vy = 0
        vz = 0
        speed = 0
      } else if (displacement > maximumDisplacement && displacement > 0) {
        const positionScale = maximumDisplacement / displacement
        x = anchorX + dx * positionScale
        y = anchorY + dy * positionScale
        z = anchorZ + dz * positionScale
        vx *= 0.3
        vy *= 0.3
        vz *= 0.3
        speed = Math.hypot(vx, vy, vz)
      }

      const boundaryRadius = Math.hypot(x, y, z)
      if (boundaryRadius > structural.boundarySize && boundaryRadius > 0) {
        const boundaryScale = structural.boundarySize / boundaryRadius
        x *= boundaryScale
        y *= boundaryScale
        z *= boundaryScale
        vx *= 0.25
        vy *= 0.25
        vz *= 0.25
        speed = Math.hypot(vx, vy, vz)
      }

      this.positions[offset] = x
      this.positions[offset + 1] = y
      this.positions[offset + 2] = z
      this.velocities[offset] = vx
      this.velocities[offset + 1] = vy
      this.velocities[offset + 2] = vz
      this.speedMagnitudes[index] = speed
      this.heat[index] = Math.max(0, finiteSimulationNumber(this.heat[index]) * heatDamping)
      const heatWidth = Math.min(0.75, this.heat[index] * 0.5)
      this.widths[index] = finiteSimulationNumber(this.widths[index], widthTarget)
        + (widthTarget + heatWidth - finiteSimulationNumber(this.widths[index], widthTarget)) * widthResponse
    }
  }

  private applyImpulse(
    kind: ImpulseKind,
    input: LivingRibbonImpulseInput,
    apply: (
      index: number,
      offset: number,
      strength: number,
      direction: Float32Array,
    ) => void,
  ): boolean {
    if (!this.structural || this.disposed) return false
    const strength = clampStrength(input.strength)
    if (strength <= 0) return false
    const key = impulseIdentity(kind, input.identity)
    if (this.rememberedImpulseIdentities.has(key)) return false
    const identitySeed = mixVisualSimulationHash(
      this.structural.baseSeed ^ hashVisualSimulationString(key),
    )
    normalizeDirection(input.direction, identitySeed, this.directionScratch)
    for (let index = 0; index < this.structural.pointCount; index += 1) {
      apply(index, index * 3, strength, this.directionScratch)
      this.clampVelocity(index * 3)
    }
    this.rememberImpulse(key)
    this.updateRenderView()
    return true
  }

  private addVelocity(offset: number, x: number, y: number, z: number): void {
    this.velocities[offset] = finiteSimulationNumber(this.velocities[offset]) + finiteSimulationNumber(x)
    this.velocities[offset + 1] = finiteSimulationNumber(this.velocities[offset + 1]) + finiteSimulationNumber(y)
    this.velocities[offset + 2] = finiteSimulationNumber(this.velocities[offset + 2]) + finiteSimulationNumber(z)
  }

  private clampVelocity(offset: number): void {
    const maximum = 8
    const x = finiteSimulationNumber(this.velocities[offset])
    const y = finiteSimulationNumber(this.velocities[offset + 1])
    const z = finiteSimulationNumber(this.velocities[offset + 2])
    const length = Math.hypot(x, y, z)
    if (!Number.isFinite(length)) {
      this.velocities[offset] = 0
      this.velocities[offset + 1] = 0
      this.velocities[offset + 2] = 0
      return
    }
    if (length > maximum && length > 0) {
      const scale = maximum / length
      this.velocities[offset] = x * scale
      this.velocities[offset + 1] = y * scale
      this.velocities[offset + 2] = z * scale
    }
  }

  private rememberImpulse(identity: string): void {
    if (this.rememberedImpulseIdentities.has(identity)) return
    if (this.rememberedImpulseOrder.length < MAX_REMEMBERED_IMPULSES) {
      this.rememberedImpulseOrder.push(identity)
    } else {
      const replaced = this.rememberedImpulseOrder[this.rememberedImpulseCursor]
      if (replaced != null) this.rememberedImpulseIdentities.delete(replaced)
      this.rememberedImpulseOrder[this.rememberedImpulseCursor] = identity
      this.rememberedImpulseCursor = (this.rememberedImpulseCursor + 1) % MAX_REMEMBERED_IMPULSES
    }
    this.rememberedImpulseIdentities.add(identity)
  }

  private clearRememberedImpulses(): void {
    this.rememberedImpulseIdentities.clear()
    this.rememberedImpulseOrder.length = 0
    this.rememberedImpulseCursor = 0
  }

  private synchronizeTimingState(input: VisualSimulationTimingSynchronization): void {
    const repeatedIdentity = input.identity != null
      && input.identity === this.lastTimingIdentity
      && input.reason === this.lastTimingReason
    if (repeatedIdentity) return
    this.lastTimingIdentity = input.identity
    this.lastTimingReason = input.reason
    this.clock.synchronize(input.reason, input.timeSec)
    this.previousPositions.set(this.positions)
    this.interpolationAlpha = 1
    this.clearRememberedImpulses()
    if (input.reason === 'trackReplacement' && this.structural) {
      this.initializeGeometry(this.structural.baseSeed, input.identity)
    }
    this.updateRenderView()
  }

  private releaseResources(): void {
    this.clock.dispose()
    this.structural = null
    this.positions = new Float32Array(0)
    this.previousPositions = new Float32Array(0)
    this.velocities = new Float32Array(0)
    this.forces = new Float32Array(0)
    this.anchors = new Float32Array(0)
    this.phases = new Float32Array(0)
    this.widths = new Float32Array(0)
    this.heat = new Float32Array(0)
    this.speedMagnitudes = new Float32Array(0)
    this.clearRememberedImpulses()
    this.structuralSignature = ''
    this.interpolationAlpha = 1
    this.updateRenderView()
  }

  private updateRenderView(): void {
    const mutable = this.renderView as {
      positions: Float32Array
      previousPositions: Float32Array
      velocities: Float32Array
      speedMagnitudes: Float32Array
      heat: Float32Array
      widths: Float32Array
      activePointCount: number
      interpolationAlpha: number
      structuralSignature: string
      structureRevision: number
      baseSeed: number
      restSpacing: number
      boundarySize: number
      simulationTimeSec: number
      runtimeMode: VisualSimulationRuntimeMode
    }
    mutable.positions = this.positions
    mutable.previousPositions = this.previousPositions
    mutable.velocities = this.velocities
    mutable.speedMagnitudes = this.speedMagnitudes
    mutable.heat = this.heat
    mutable.widths = this.widths
    mutable.activePointCount = this.structural?.pointCount ?? 0
    mutable.interpolationAlpha = this.interpolationAlpha
    mutable.structuralSignature = this.structuralSignature
    mutable.structureRevision = this.structureRevision
    mutable.baseSeed = this.structural?.baseSeed ?? 0
    mutable.restSpacing = this.restSpacing
    mutable.boundarySize = this.structural?.boundarySize ?? 0
    mutable.simulationTimeSec = this.clock.getSimulationTimeSec()
    mutable.runtimeMode = this.runtimeMode
  }
}

export function livingRibbonStructuralSignature(
  structural: LivingRibbonStructuralSettings,
  mode: VisualSimulationRuntimeMode = 'live',
): string {
  return createVisualSimulationStructuralSignature(normalizeStructural(structural, mode))
}
