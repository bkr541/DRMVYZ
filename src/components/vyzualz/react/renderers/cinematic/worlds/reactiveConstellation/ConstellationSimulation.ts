import type { ReactiveConstellationSettings } from '../../../../CinematicWorldSettings'
import {
  buildConstellationGraph,
  type ConstellationGraph,
} from './ConstellationGraphBuilder'
import { clamp, hashSeed, seededUnit } from './ConstellationMath'
import {
  FixedStepSimulationClock,
  VisualSimulationLifecycleController,
  createVisualSimulationStructuralSignature,
  type VisualSimulationTimingSynchronization,
} from '../../../../../../../features/visualSimulation'

export const CONSTELLATION_FIXED_TIMESTEP_SEC = 1 / 120
export const CONSTELLATION_MAX_SUBSTEPS = 8
export const CONSTELLATION_MAX_FRAME_DELTA_SEC = 0.1
const CONSTELLATION_MAX_ACCUMULATOR_SEC = CONSTELLATION_FIXED_TIMESTEP_SEC * CONSTELLATION_MAX_SUBSTEPS
const CONSTELLATION_MAX_POSITION_RADIUS = 18
const EMPTY_GRAPH: ConstellationGraph = { nodes: [], edges: [] }

export interface ConstellationSimulationConfigureInput {
  seed: number
  nodeCount: number
  settings: ReactiveConstellationSettings
}


interface ConstellationStructuralConfig {
  seed: number
  nodeCount: number
  topologyStyle: ReactiveConstellationSettings['topologyStyle']
  polyhedronStyle: ReactiveConstellationSettings['polyhedronStyle']
  neighborCount: number
  networkSpread: number
  depthSpread: number
  nodeScaleVariation: number
}

function structuralConfig(input: ConstellationSimulationConfigureInput): ConstellationStructuralConfig {
  return {
    seed: Math.trunc(input.seed),
    nodeCount: Math.max(1, Math.floor(input.nodeCount)),
    topologyStyle: input.settings.topologyStyle,
    polyhedronStyle: input.settings.polyhedronStyle,
    neighborCount: input.settings.neighborCount,
    networkSpread: input.settings.networkSpread,
    depthSpread: input.settings.depthSpread,
    nodeScaleVariation: input.settings.nodeScaleVariation,
  }
}

export interface ConstellationSimulationUpdateInput {
  deltaTimeSec: number
  isPlaying: boolean
  timingDiscontinuity?: boolean
  motionScale?: number
  impact?: number
  networkSpreadScale?: number
  expansionTarget?: number
  nodeScaleMultiplier?: number
  nodeSpinOffset?: number
  springTension?: number
  collapseForce?: number
  burstImpulse?: number
  radialBurstImpulse?: number
  burstSequence?: number
  topologyMorph?: number
}

export interface ConstellationSimulationConfigureResult {
  rebuilt: boolean
  structureRevision: number
}

export interface ConstellationSimulationStateView {
  graph: ConstellationGraph
  positions: Float32Array
  previousPositions: Float32Array
  anchors: Float32Array
  velocities: Float32Array
  rotations: Float32Array
  angularVelocities: Float32Array
  scaleVariations: Float32Array
  expansionProgress: Float32Array
  expansionVelocity: Float32Array
  radialStagger: Float32Array
  meanExpansionProgress: number
  meanExpansionVelocity: number
  expansionElapsedSec: number
  lastBurstSequence: number | null
  interpolationAlpha: number
  simulationTimeSec: number
  structureRevision: number
  activeSeed: number
  randomState: number
}

export function constellationStructuralSignature(input: ConstellationSimulationConfigureInput): string {
  return createVisualSimulationStructuralSignature(structuralConfig(input))
}

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampMagnitude3(values: Float32Array, offset: number, maximum: number): void {
  const x = finite(values[offset])
  const y = finite(values[offset + 1])
  const z = finite(values[offset + 2])
  const length = Math.hypot(x, y, z)
  if (length > maximum && length > 0) {
    const scale = maximum / length
    values[offset] = x * scale
    values[offset + 1] = y * scale
    values[offset + 2] = z * scale
  } else {
    values[offset] = x
    values[offset + 1] = y
    values[offset + 2] = z
  }
}

function clampPosition3(values: Float32Array, offset: number): void {
  clampMagnitude3(values, offset, CONSTELLATION_MAX_POSITION_RADIUS)
}

export class ConstellationSimulation {
  private settings: ReactiveConstellationSettings | null = null
  private requestedStructuralSignature = ''
  private graph: ConstellationGraph = EMPTY_GRAPH
  private positions = new Float32Array(0)
  private previousPositions = new Float32Array(0)
  private anchors = new Float32Array(0)
  private velocities = new Float32Array(0)
  private rotations = new Float32Array(0)
  private initialRotations = new Float32Array(0)
  private angularVelocities = new Float32Array(0)
  private scaleVariations = new Float32Array(0)
  private baseScaleVariations = new Float32Array(0)
  private forces = new Float32Array(0)
  private driftPhases = new Float32Array(0)
  private expansionProgress = new Float32Array(0)
  private expansionVelocity = new Float32Array(0)
  private radialStagger = new Float32Array(0)
  private expansionLaunched = new Uint8Array(0)
  private expansionElapsedSec = 0
  private meanExpansionProgress = 0
  private meanExpansionVelocity = 0
  private lastBurstSequence: number | null = null
  private readonly clock = new FixedStepSimulationClock({
    fixedTimestepSec: CONSTELLATION_FIXED_TIMESTEP_SEC,
    maxFrameDeltaSec: CONSTELLATION_MAX_FRAME_DELTA_SEC,
    maxSubsteps: CONSTELLATION_MAX_SUBSTEPS,
    maxAccumulatorSec: CONSTELLATION_MAX_ACCUMULATOR_SEC,
  })
  private readonly lifecycle: VisualSimulationLifecycleController<ConstellationStructuralConfig, ReactiveConstellationSettings>
  private playbackPaused = false
  private interpolationAlpha = 1
  private structureRevision = 0
  private activeSeed = 0
  private randomState = 0
  constructor() {
    this.lifecycle = new VisualSimulationLifecycleController({
      rebuild: (structural, parameters) => {
        this.settings = parameters
        this.rebuild(structural.seed, structural.nodeCount)
      },
      updateParameters: parameters => {
        this.settings = parameters
      },
      reset: () => this.resetExpansionState(),
      synchronizeTiming: input => this.synchronizeTimingState(input),
      pause: () => this.clock.pause(),
      resume: () => this.clock.resume(),
      releaseResources: () => this.releaseResources(),
    })
  }

  private readonly stateView: ConstellationSimulationStateView = {
    graph: EMPTY_GRAPH,
    positions: this.positions,
    previousPositions: this.previousPositions,
    anchors: this.anchors,
    velocities: this.velocities,
    rotations: this.rotations,
    angularVelocities: this.angularVelocities,
    scaleVariations: this.scaleVariations,
    expansionProgress: this.expansionProgress,
    expansionVelocity: this.expansionVelocity,
    radialStagger: this.radialStagger,
    meanExpansionProgress: 0,
    meanExpansionVelocity: 0,
    expansionElapsedSec: 0,
    lastBurstSequence: null,
    interpolationAlpha: 1,
    simulationTimeSec: 0,
    structureRevision: 0,
    activeSeed: 0,
    randomState: 0,
  }

  configure(input: ConstellationSimulationConfigureInput): ConstellationSimulationConfigureResult {
    const result = this.lifecycle.configure({
      structural: structuralConfig(input),
      parameters: input.settings,
      mode: 'live',
    })
    this.requestedStructuralSignature = result.structuralSignature
    return { rebuilt: result.rebuilt, structureRevision: this.structureRevision }
  }

  update(input: ConstellationSimulationUpdateInput): number {
    if (input.timingDiscontinuity) {
      this.lifecycle.synchronizeTiming({ reason: 'timingDiscontinuity' })
      this.updateStateView()
      return 0
    }
    if (!input.isPlaying) {
      if (!this.playbackPaused) {
        this.lifecycle.pause()
        this.playbackPaused = true
      }
      this.updateStateView()
      return 0
    }
    if (this.playbackPaused) {
      this.lifecycle.resume()
      this.playbackPaused = false
    }
    if (this.clock.isFrozen() || !this.settings || this.graph.nodes.length === 0) {
      this.updateStateView()
      return 0
    }

    if (input.burstSequence != null) {
      this.applyRadialBurst(
        finite(input.radialBurstImpulse, finite(input.burstImpulse, this.settings.expansionBurstImpulse)),
        Math.trunc(input.burstSequence),
      )
    }

    const delta = clamp(finite(input.deltaTimeSec), 0, CONSTELLATION_MAX_FRAME_DELTA_SEC)
    if (delta <= 0) {
      this.interpolationAlpha = 1
      this.updateStateView()
      return 0
    }

    const motionScale = clamp(finite(input.motionScale, 1), 0, 2)
    const impact = clamp(finite(input.impact), 0, 2)
    const frame = this.clock.advance(delta, (dt, simulationTimeSec) => {
      this.integrateStep(dt, motionScale, impact, input, simulationTimeSec - dt)
    })
    this.interpolationAlpha = frame.steps > 0 ? frame.interpolationAlpha : 1
    this.updateStateView()
    return frame.steps
  }

  applyRadialBurst(strength = this.settings?.burstStrength ?? 1, sequence?: number): boolean {
    if (sequence != null) {
      const normalizedSequence = Math.trunc(sequence)
      if (normalizedSequence === this.lastBurstSequence) return false
      this.lastBurstSequence = normalizedSequence
    }
    const impulse = clamp(finite(strength), 0, 4)
    if (impulse <= 0) return false
    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const offset = index * 3
      let x = this.anchors[offset]
      let y = this.anchors[offset + 1]
      let z = this.anchors[offset + 2]
      let length = Math.hypot(x, y, z)
      if (length < 0.0001) {
        const phase = this.driftPhases[offset]
        x = Math.cos(phase)
        y = Math.sin(this.driftPhases[offset + 1]) * 0.5
        z = Math.sin(phase)
        length = Math.hypot(x, y, z) || 1
      }
      const prominence = this.graph.nodes[index].prominence
      const amount = impulse * (0.55 + prominence * 0.75)
      this.velocities[offset] += x / length * amount
      this.velocities[offset + 1] += y / length * amount
      this.velocities[offset + 2] += z / length * amount
      this.expansionVelocity[index] = finite(this.expansionVelocity[index]) + amount * 0.46
      clampMagnitude3(this.velocities, offset, 5)
      this.expansionVelocity[index] = clamp(this.expansionVelocity[index], -5, 8)
    }
    this.updateExpansionMeans()
    this.updateStateView()
    return true
  }

  applyCollapseImpulse(strength = this.settings?.collapseAmount ?? 1): void {
    const impulse = clamp(finite(strength), 0, 4)
    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const offset = index * 3
      const x = this.positions[offset]
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const length = Math.hypot(x, y, z) || 1
      this.velocities[offset] -= x / length * impulse
      this.velocities[offset + 1] -= y / length * impulse
      this.velocities[offset + 2] -= z / length * impulse
      this.expansionVelocity[index] = clamp(this.expansionVelocity[index] - impulse * 0.34, -5, 8)
      clampMagnitude3(this.velocities, offset, 5)
    }
    this.updateExpansionMeans()
    this.updateStateView()
  }

  reseed(seed?: number): number {
    if (!this.settings || this.graph.nodes.length === 0) return this.activeSeed
    const nextSeed = seed == null ? this.nextRandomUint() : Math.trunc(seed)
    this.rebuild(nextSeed, this.graph.nodes.length)
    return this.activeSeed
  }

  freeze(): void {
    this.clock.freeze()
  }

  unfreeze(): void {
    this.clock.unfreeze()
    this.updateStateView()
  }

  isFrozen(): boolean {
    return this.clock.isFrozen()
  }

  resetExpansion(): void {
    this.lifecycle.reset({ seed: this.activeSeed, identity: 'expansion-reset' })
  }

  private resetExpansionState(): void {
    if (!this.settings) return
    const initialExpansion = clamp(this.settings.initialExpansion, 0.01, 1)
    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const offset = index * 3
      this.positions[offset] = this.anchors[offset] * initialExpansion
      this.positions[offset + 1] = this.anchors[offset + 1] * initialExpansion
      this.positions[offset + 2] = this.anchors[offset + 2] * initialExpansion
      this.previousPositions[offset] = this.positions[offset]
      this.previousPositions[offset + 1] = this.positions[offset + 1]
      this.previousPositions[offset + 2] = this.positions[offset + 2]
      this.expansionProgress[index] = initialExpansion
      this.expansionVelocity[index] = 0
      this.expansionLaunched[index] = 0
    }
    this.velocities.fill(0)
    this.rotations.set(this.initialRotations)
    this.angularVelocities.fill(0)
    this.scaleVariations.set(this.baseScaleVariations)
    this.forces.fill(0)
    this.clock.synchronize('manual', 0)
    this.expansionElapsedSec = 0
    this.lastBurstSequence = null
    this.interpolationAlpha = 1
    this.updateExpansionMeans()
    this.updateStateView()
  }

  resetToAnchors(): void {
    const target = clamp(this.settings?.expansionTarget ?? 1, 0, 1.35)
    this.positions.set(this.anchors)
    this.previousPositions.set(this.anchors)
    this.velocities.fill(0)
    this.rotations.set(this.initialRotations)
    this.angularVelocities.fill(0)
    this.scaleVariations.set(this.baseScaleVariations)
    this.forces.fill(0)
    this.expansionProgress.fill(target)
    this.expansionVelocity.fill(0)
    this.expansionLaunched.fill(1)
    this.clock.synchronize('manual', 0)
    this.expansionElapsedSec = Math.max(0, this.settings?.radialStaggerSec ?? 0)
    this.lastBurstSequence = null
    this.interpolationAlpha = 1
    this.updateExpansionMeans()
    this.updateStateView()
  }

  synchronizeTiming(): void {
    this.lifecycle.synchronizeTiming({ reason: 'timingDiscontinuity' })
  }

  seek(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.seek(timeSec, identity)
  }

  loopWrap(timeSec?: number, identity?: string | number | null): void {
    this.lifecycle.loopWrap(timeSec, identity)
  }

  replaceTrack(identity?: string | number | null): void {
    this.lifecycle.replaceTrack(0, identity)
  }

  dispose(): void {
    this.lifecycle.dispose()
  }

  getState(): ConstellationSimulationStateView {
    this.updateStateView()
    return this.stateView
  }

  private rebuild(seed: number, nodeCount: number): void {
    if (!this.settings) return
    this.activeSeed = seed >>> 0
    this.randomState = hashSeed(this.activeSeed, 0x51f15e)
    this.graph = buildConstellationGraph({ seed: this.activeSeed, nodeCount, settings: this.settings })
    const vectorLength = this.graph.nodes.length * 3
    this.positions = new Float32Array(vectorLength)
    this.previousPositions = new Float32Array(vectorLength)
    this.anchors = new Float32Array(vectorLength)
    this.velocities = new Float32Array(vectorLength)
    this.rotations = new Float32Array(vectorLength)
    this.initialRotations = new Float32Array(vectorLength)
    this.angularVelocities = new Float32Array(vectorLength)
    this.scaleVariations = new Float32Array(this.graph.nodes.length)
    this.baseScaleVariations = new Float32Array(this.graph.nodes.length)
    this.forces = new Float32Array(vectorLength)
    this.driftPhases = new Float32Array(vectorLength)
    this.expansionProgress = new Float32Array(this.graph.nodes.length)
    this.expansionVelocity = new Float32Array(this.graph.nodes.length)
    this.radialStagger = new Float32Array(this.graph.nodes.length)
    this.expansionLaunched = new Uint8Array(this.graph.nodes.length)

    const initialExpansion = clamp(this.settings.initialExpansion, 0.01, 1)
    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const node = this.graph.nodes[index]
      const offset = index * 3
      this.anchors[offset] = node.position.x
      this.anchors[offset + 1] = node.position.y
      this.anchors[offset + 2] = node.position.z
      this.positions[offset] = node.position.x * initialExpansion
      this.positions[offset + 1] = node.position.y * initialExpansion
      this.positions[offset + 2] = node.position.z * initialExpansion
      this.previousPositions[offset] = this.positions[offset]
      this.previousPositions[offset + 1] = this.positions[offset + 1]
      this.previousPositions[offset + 2] = this.positions[offset + 2]
      this.rotations[offset] = node.rotation.x
      this.rotations[offset + 1] = node.rotation.y
      this.rotations[offset + 2] = node.rotation.z
      this.initialRotations[offset] = node.rotation.x
      this.initialRotations[offset + 1] = node.rotation.y
      this.initialRotations[offset + 2] = node.rotation.z
      this.scaleVariations[index] = node.scaleVariation
      this.baseScaleVariations[index] = node.scaleVariation
      this.driftPhases[offset] = seededUnit(hashSeed(this.activeSeed, index * 3 + 101)) * Math.PI * 2
      this.driftPhases[offset + 1] = seededUnit(hashSeed(this.activeSeed, index * 3 + 102)) * Math.PI * 2
      this.driftPhases[offset + 2] = seededUnit(hashSeed(this.activeSeed, index * 3 + 103)) * Math.PI * 2
      this.expansionProgress[index] = initialExpansion
      this.radialStagger[index] = seededUnit(hashSeed(this.activeSeed, index + 0x7a31))
    }

    this.clock.synchronize('manual', 0)
    this.expansionElapsedSec = 0
    this.lastBurstSequence = null
    this.interpolationAlpha = 1
    this.structureRevision += 1
    this.updateExpansionMeans()
    this.updateStateView()
  }

  private synchronizeTimingState(input: VisualSimulationTimingSynchronization): void {
    this.clock.synchronize(input.reason, input.timeSec)
    this.previousPositions.set(this.positions)
    this.interpolationAlpha = 1
    this.updateStateView()
  }

  private releaseResources(): void {
    this.clock.dispose()
    this.settings = null
    this.requestedStructuralSignature = ''
    this.graph = EMPTY_GRAPH
    this.positions = new Float32Array(0)
    this.previousPositions = new Float32Array(0)
    this.anchors = new Float32Array(0)
    this.velocities = new Float32Array(0)
    this.rotations = new Float32Array(0)
    this.initialRotations = new Float32Array(0)
    this.angularVelocities = new Float32Array(0)
    this.scaleVariations = new Float32Array(0)
    this.baseScaleVariations = new Float32Array(0)
    this.forces = new Float32Array(0)
    this.driftPhases = new Float32Array(0)
    this.expansionProgress = new Float32Array(0)
    this.expansionVelocity = new Float32Array(0)
    this.radialStagger = new Float32Array(0)
    this.expansionLaunched = new Uint8Array(0)
    this.interpolationAlpha = 1
    this.updateExpansionMeans()
    this.updateStateView()
  }

  private integrateStep(
    dt: number,
    motionScale: number,
    impact: number,
    runtime: ConstellationSimulationUpdateInput,
    simulationTimeSec: number,
  ): void {
    const settings = this.settings
    if (!settings) return
    this.previousPositions.set(this.positions)
    this.forces.fill(0)
    this.integrateExpansionStep(dt, runtime.expansionTarget)

    const springStrength = clamp(finite(runtime.springTension, settings.springStrength), 0, 2)
    const spreadScale = clamp(finite(runtime.networkSpreadScale, 1), 0.18, 5.4)
    const topologyMorph = clamp(finite(runtime.topologyMorph), -1, 1)
    const collapseForce = clamp(finite(runtime.collapseForce, settings.collapseAmount), 0, 1.5)
    const burstEnvelope = clamp(finite(runtime.burstImpulse), 0, 2.5)
    const burstDeformationScale = 1 + burstEnvelope * 0.06
    const nodeSpinOffset = clamp(finite(runtime.nodeSpinOffset), -1.5, 1.5)
    const nodeScaleMultiplier = clamp(finite(runtime.nodeScaleMultiplier, 1), 0.15, 6.25)
    const springCoefficient = (5 + springStrength * 27) * (0.72 + settings.topologyStability * 0.62)
    const anchorCoefficient = (0.6 + settings.topologyStability * 11) * (0.35 + springStrength * 0.65)
    const centralCoefficient = settings.centralGravity * 3.2 + collapseForce * 2.4
    const driftCoefficient = settings.driftAmount * motionScale
    const turbulenceCoefficient = settings.turbulence * motionScale
    const orbitCoefficient = settings.orbitAmount * motionScale
    const impactCoefficient = impact * settings.burstStrength * 1.2
    const time = simulationTimeSec

    for (const edge of this.graph.edges) {
      const aOffset = edge.a * 3
      const bOffset = edge.b * 3
      const dx = this.positions[bOffset] - this.positions[aOffset]
      const dy = this.positions[bOffset + 1] - this.positions[aOffset + 1]
      const dz = this.positions[bOffset + 2] - this.positions[aOffset + 2]
      const distance = Math.hypot(dx, dy, dz)
      if (!Number.isFinite(distance) || distance < 0.00001) continue
      const edgeMorph = 1 + topologyMorph * Math.sin((edge.a + 1) * 1.73 + (edge.b + 1) * 0.91) * 0.08
      const expansion = Math.max(0.01, (this.expansionProgress[edge.a] + this.expansionProgress[edge.b]) * 0.5)
      const targetDistance = edge.distance * spreadScale * expansion * edgeMorph
        * burstDeformationScale
      const stretch = clamp(distance - targetDistance, -0.95, 0.95)
      const force = clamp(stretch * springCoefficient, -14, 14) / distance
      const fx = dx * force
      const fy = dy * force
      const fz = dz * force
      this.forces[aOffset] += fx
      this.forces[aOffset + 1] += fy
      this.forces[aOffset + 2] += fz
      this.forces[bOffset] -= fx
      this.forces[bOffset + 1] -= fy
      this.forces[bOffset + 2] -= fz
    }

    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const offset = index * 3
      const x = this.positions[offset]
      const y = this.positions[offset + 1]
      const z = this.positions[offset + 2]
      const expansion = clamp(finite(this.expansionProgress[index], settings.initialExpansion), 0, 2.1)
      const deformedExpansion = expansion * burstDeformationScale
      const effectScale = 0.18 + Math.min(1, expansion) * 0.82
      const morphPhase = this.driftPhases[offset] + this.driftPhases[offset + 1] * 0.37
      const morphAmount = topologyMorph * settings.networkSpread * 0.12 * deformedExpansion
      const ax = this.anchors[offset] * spreadScale * deformedExpansion + Math.cos(morphPhase) * morphAmount
      const ay = this.anchors[offset + 1] * spreadScale * deformedExpansion + Math.sin(morphPhase * 1.31) * morphAmount * 0.65
      const az = this.anchors[offset + 2] * spreadScale * deformedExpansion + Math.sin(morphPhase) * morphAmount
      const radialLength = Math.hypot(x, y, z) || 1
      const phaseX = this.driftPhases[offset]
      const phaseY = this.driftPhases[offset + 1]
      const phaseZ = this.driftPhases[offset + 2]
      const driftX = Math.sin(time * 0.73 + phaseX) * driftCoefficient * effectScale
      const driftY = Math.sin(time * 0.61 + phaseY) * driftCoefficient * effectScale
      const driftZ = Math.sin(time * 0.83 + phaseZ) * driftCoefficient * effectScale
      const turbulenceX = Math.sin(time * 2.17 + phaseY + y * 2.4) * turbulenceCoefficient * effectScale
      const turbulenceY = Math.cos(time * 1.91 + phaseZ + z * 2.1) * turbulenceCoefficient * effectScale
      const turbulenceZ = Math.sin(time * 2.43 + phaseX + x * 2.6) * turbulenceCoefficient * effectScale

      this.forces[offset] += (ax - x) * anchorCoefficient - x * centralCoefficient + driftX + turbulenceX
      this.forces[offset + 1] += (ay - y) * anchorCoefficient - y * centralCoefficient + driftY + turbulenceY
      this.forces[offset + 2] += (az - z) * anchorCoefficient - z * centralCoefficient + driftZ + turbulenceZ
      this.forces[offset] += -z * orbitCoefficient * effectScale
      this.forces[offset + 2] += x * orbitCoefficient * effectScale
      this.forces[offset] += x / radialLength * impactCoefficient
      this.forces[offset + 1] += y / radialLength * impactCoefficient
      this.forces[offset + 2] += z / radialLength * impactCoefficient
    }

    const baseMinimumDistance = Math.max(0.035, settings.nodeScale * 1.15)
    for (let a = 0; a < this.graph.nodes.length; a += 1) {
      const aOffset = a * 3
      for (let b = a + 1; b < this.graph.nodes.length; b += 1) {
        const bOffset = b * 3
        const dx = this.positions[bOffset] - this.positions[aOffset]
        const dy = this.positions[bOffset + 1] - this.positions[aOffset + 1]
        const dz = this.positions[bOffset + 2] - this.positions[aOffset + 2]
        const distanceSquared = dx * dx + dy * dy + dz * dz
        const expansion = Math.max(0.08, Math.min(this.expansionProgress[a], this.expansionProgress[b]))
        const minimumDistance = baseMinimumDistance * expansion
        const minimumDistanceSquared = minimumDistance * minimumDistance
        if (!Number.isFinite(distanceSquared) || distanceSquared >= minimumDistanceSquared) continue
        const distance = Math.sqrt(Math.max(distanceSquared, 0.0000001))
        const separation = (minimumDistance - distance) * 18 / distance
        const fx = dx * separation
        const fy = dy * separation
        const fz = dz * separation
        this.forces[aOffset] -= fx
        this.forces[aOffset + 1] -= fy
        this.forces[aOffset + 2] -= fz
        this.forces[bOffset] += fx
        this.forces[bOffset + 1] += fy
        this.forces[bOffset + 2] += fz
      }
    }

    const dampingRate = (0.7 + settings.damping * 8.5) * (1 - settings.elasticity * 0.48)
    const damping = Math.exp(-dampingRate * dt)
    const maximumVelocity = 2.2 + settings.elasticity * 2.8 + motionScale * 0.8
    const spinTarget = (settings.nodeSpin + nodeSpinOffset) * motionScale

    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      const offset = index * 3
      this.velocities[offset] = (this.velocities[offset] + finite(this.forces[offset]) * dt) * damping
      this.velocities[offset + 1] = (this.velocities[offset + 1] + finite(this.forces[offset + 1]) * dt) * damping
      this.velocities[offset + 2] = (this.velocities[offset + 2] + finite(this.forces[offset + 2]) * dt) * damping
      clampMagnitude3(this.velocities, offset, maximumVelocity)

      this.positions[offset] += this.velocities[offset] * dt
      this.positions[offset + 1] += this.velocities[offset + 1] * dt
      this.positions[offset + 2] += this.velocities[offset + 2] * dt
      clampPosition3(this.positions, offset)

      const expansion = clamp(finite(this.expansionProgress[index], settings.initialExpansion), 0, 2.1)
      const deformedExpansion = expansion * burstDeformationScale
      const morphPhase = this.driftPhases[offset] + this.driftPhases[offset + 1] * 0.37
      const morphAmount = topologyMorph * settings.networkSpread * 0.12 * deformedExpansion
      const targetAnchorX = this.anchors[offset] * spreadScale * deformedExpansion + Math.cos(morphPhase) * morphAmount
      const targetAnchorY = this.anchors[offset + 1] * spreadScale * deformedExpansion + Math.sin(morphPhase * 1.31) * morphAmount * 0.65
      const targetAnchorZ = this.anchors[offset + 2] * spreadScale * deformedExpansion + Math.sin(morphPhase) * morphAmount
      const dx = this.positions[offset] - targetAnchorX
      const dy = this.positions[offset + 1] - targetAnchorY
      const dz = this.positions[offset + 2] - targetAnchorZ
      const displacement = Math.hypot(dx, dy, dz)
      if (!Number.isFinite(displacement)) {
        this.restoreNode(index, targetAnchorX, targetAnchorY, targetAnchorZ)
        continue
      }
      const maximumDisplacement = 0.38 + settings.networkSpread * spreadScale * (
        0.3 + settings.elasticity * 0.48 + Math.min(1.35, expansion) * 0.28
      )
      if (displacement > maximumDisplacement && displacement > 0) {
        const scale = maximumDisplacement / displacement
        this.positions[offset] = targetAnchorX + dx * scale
        this.positions[offset + 1] = targetAnchorY + dy * scale
        this.positions[offset + 2] = targetAnchorZ + dz * scale
        this.velocities[offset] *= 0.35
        this.velocities[offset + 1] *= 0.35
        this.velocities[offset + 2] *= 0.35
      }

      const palette = this.graph.nodes[index].paletteMix
      const targetX = spinTarget * (0.45 + palette * 0.35)
      const targetY = spinTarget * (0.75 + palette * 0.5)
      const targetZ = -spinTarget * (0.3 + palette * 0.25)
      const angularResponse = 1 - Math.exp(-dt * (2.2 + settings.elasticity * 3.4))
      this.angularVelocities[offset] += (targetX - this.angularVelocities[offset]) * angularResponse
      this.angularVelocities[offset + 1] += (targetY - this.angularVelocities[offset + 1]) * angularResponse
      this.angularVelocities[offset + 2] += (targetZ - this.angularVelocities[offset + 2]) * angularResponse
      this.rotations[offset] = finite(this.rotations[offset] + this.angularVelocities[offset] * dt, this.initialRotations[offset])
      this.rotations[offset + 1] = finite(this.rotations[offset + 1] + this.angularVelocities[offset + 1] * dt, this.initialRotations[offset + 1])
      this.rotations[offset + 2] = finite(this.rotations[offset + 2] + this.angularVelocities[offset + 2] * dt, this.initialRotations[offset + 2])

      const speed = Math.hypot(this.velocities[offset], this.velocities[offset + 1], this.velocities[offset + 2])
      const targetScale = this.baseScaleVariations[index] * nodeScaleMultiplier * (
        1 + Math.min(0.22, speed * 0.045 * settings.elasticity)
        + (impact * settings.burstStrength + burstEnvelope) * 0.018
      )
      const scaleResponse = 1 - Math.exp(-dt * 8)
      this.scaleVariations[index] = finite(
        this.scaleVariations[index] + (targetScale - this.scaleVariations[index]) * scaleResponse,
        this.baseScaleVariations[index],
      )
    }

    this.expansionElapsedSec += dt
    this.updateExpansionMeans()
  }

  private integrateExpansionStep(dt: number, runtimeTarget?: number): void {
    const settings = this.settings
    if (!settings) return
    const initial = clamp(settings.initialExpansion, 0.01, 1)
    const target = clamp(finite(runtimeTarget, settings.expansionTarget), 0, 1.35)
    const overshoot = clamp(settings.expansionOvershoot, 0, 0.75)
    const staggerSec = clamp(settings.radialStaggerSec, 0, 1.5)
    const launchImpulse = clamp(settings.expansionBurstImpulse, 0, 2.5)

    for (let index = 0; index < this.graph.nodes.length; index += 1) {
      let progress = finite(this.expansionProgress[index], initial)
      let velocity = finite(this.expansionVelocity[index])
      const delay = this.radialStagger[index] * staggerSec
      const active = this.expansionElapsedSec + dt >= delay
      const nodeTarget = active ? target : initial

      if (active && this.expansionLaunched[index] === 0) {
        this.expansionLaunched[index] = 1
        velocity += launchImpulse * (0.72 + this.graph.nodes[index].prominence * 0.5)
      }

      const responseSec = Math.max(0.08, nodeTarget >= progress ? settings.expansionAttackSec : settings.expansionReleaseSec)
      const omega = clamp((4 + settings.expansionSpringStrength * 8) / responseSec, 1.5, 42)
      const dampingRatio = clamp(
        0.94 + settings.expansionDamping * 0.3 - overshoot * 1.12,
        0.16,
        1.35,
      )
      const acceleration = (nodeTarget - progress) * omega * omega - 2 * dampingRatio * omega * velocity
      velocity = clamp(velocity + finite(acceleration) * dt, -5, 8)
      progress += velocity * dt

      const lowerBound = 0
      const upperBound = Math.max(initial, target) + overshoot
      if (!Number.isFinite(progress) || !Number.isFinite(velocity)) {
        progress = initial
        velocity = 0
        this.expansionLaunched[index] = active ? 1 : 0
      } else if (progress < lowerBound) {
        progress = lowerBound
        velocity = Math.max(0, velocity * -0.18)
      } else if (progress > upperBound) {
        progress = upperBound
        velocity = Math.min(0, velocity * -0.18)
      }

      if (active && Math.abs(nodeTarget - progress) < 0.00005 && Math.abs(velocity) < 0.0005) {
        progress = nodeTarget
        velocity = 0
      }
      this.expansionProgress[index] = progress
      this.expansionVelocity[index] = velocity
    }
  }

  private restoreNode(index: number, targetX: number, targetY: number, targetZ: number): void {
    const offset = index * 3
    this.positions[offset] = finite(targetX)
    this.positions[offset + 1] = finite(targetY)
    this.positions[offset + 2] = finite(targetZ)
    this.previousPositions[offset] = this.positions[offset]
    this.previousPositions[offset + 1] = this.positions[offset + 1]
    this.previousPositions[offset + 2] = this.positions[offset + 2]
    this.velocities[offset] = 0
    this.velocities[offset + 1] = 0
    this.velocities[offset + 2] = 0
    this.rotations[offset] = this.initialRotations[offset]
    this.rotations[offset + 1] = this.initialRotations[offset + 1]
    this.rotations[offset + 2] = this.initialRotations[offset + 2]
    this.angularVelocities[offset] = 0
    this.angularVelocities[offset + 1] = 0
    this.angularVelocities[offset + 2] = 0
    this.scaleVariations[index] = this.baseScaleVariations[index]
  }

  private updateExpansionMeans(): void {
    if (this.expansionProgress.length === 0) {
      this.meanExpansionProgress = 0
      this.meanExpansionVelocity = 0
      return
    }
    let progress = 0
    let velocity = 0
    for (let index = 0; index < this.expansionProgress.length; index += 1) {
      progress += finite(this.expansionProgress[index])
      velocity += finite(this.expansionVelocity[index])
    }
    this.meanExpansionProgress = progress / this.expansionProgress.length
    this.meanExpansionVelocity = velocity / this.expansionProgress.length
  }

  private nextRandomUint(): number {
    let value = this.randomState || 0x6d2b79f5
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.randomState = value >>> 0
    return this.randomState
  }

  private updateStateView(): void {
    this.stateView.graph = this.graph
    this.stateView.positions = this.positions
    this.stateView.previousPositions = this.previousPositions
    this.stateView.anchors = this.anchors
    this.stateView.velocities = this.velocities
    this.stateView.rotations = this.rotations
    this.stateView.angularVelocities = this.angularVelocities
    this.stateView.scaleVariations = this.scaleVariations
    this.stateView.expansionProgress = this.expansionProgress
    this.stateView.expansionVelocity = this.expansionVelocity
    this.stateView.radialStagger = this.radialStagger
    this.stateView.meanExpansionProgress = this.meanExpansionProgress
    this.stateView.meanExpansionVelocity = this.meanExpansionVelocity
    this.stateView.expansionElapsedSec = this.expansionElapsedSec
    this.stateView.lastBurstSequence = this.lastBurstSequence
    this.stateView.interpolationAlpha = this.interpolationAlpha
    this.stateView.simulationTimeSec = this.clock.getSimulationTimeSec()
    this.stateView.structureRevision = this.structureRevision
    this.stateView.activeSeed = this.activeSeed
    this.stateView.randomState = this.randomState
  }
}
