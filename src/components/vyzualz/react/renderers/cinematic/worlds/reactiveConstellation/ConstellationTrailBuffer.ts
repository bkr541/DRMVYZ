import { clamp } from './ConstellationMath'

export interface ConstellationTrailConfigureInput {
  edgeCount: number
  sampleCapacity: number
  topologyRevision: number
}

export interface ConstellationTrailCaptureInput {
  endpoints: Float32Array
  deltaTimeSec: number
  spacingSec: number
  isPlaying: boolean
}

const ENDPOINT_FLOATS_PER_EDGE = 6

export function constellationTrailAgeWeight(age: number, decay: number): number {
  if (age <= 0) return 1
  return Math.pow(clamp(Number.isFinite(decay) ? decay : 0.78, 0.02, 0.995), age)
}

/**
 * Fixed-capacity endpoint history. Samples are written into a preallocated ring
 * and exposed newest-first without allocating per frame.
 */
export class ConstellationTrailBuffer {
  private edgeCount = 0
  private sampleCapacity = 0
  private topologyRevision = -1
  private samples = new Float32Array(0)
  private writeIndex = 0
  private sampleCount = 0
  private spacingAccumulatorSec = 0
  private mutationRevision = 0

  configure(input: ConstellationTrailConfigureInput): boolean {
    const edgeCount = Math.max(0, Math.floor(input.edgeCount))
    const sampleCapacity = Math.max(0, Math.floor(input.sampleCapacity))
    const changed = edgeCount !== this.edgeCount
      || sampleCapacity !== this.sampleCapacity
      || input.topologyRevision !== this.topologyRevision
    if (!changed) return false

    this.edgeCount = edgeCount
    this.sampleCapacity = sampleCapacity
    this.topologyRevision = input.topologyRevision
    this.samples = new Float32Array(edgeCount * sampleCapacity * ENDPOINT_FLOATS_PER_EDGE)
    this.writeIndex = 0
    this.sampleCount = 0
    this.spacingAccumulatorSec = 0
    this.mutationRevision += 1
    return true
  }

  capture(input: ConstellationTrailCaptureInput): boolean {
    if (!input.isPlaying || this.edgeCount === 0 || this.sampleCapacity === 0) return false
    if (input.endpoints.length < this.edgeCount * ENDPOINT_FLOATS_PER_EDGE) return false

    const spacing = Math.max(0.001, Number.isFinite(input.spacingSec) ? input.spacingSec : 0.03)
    if (this.sampleCount > 0) {
      this.spacingAccumulatorSec += Math.max(0, Number.isFinite(input.deltaTimeSec) ? input.deltaTimeSec : 0)
      if (this.spacingAccumulatorSec < spacing) return false
      this.spacingAccumulatorSec %= spacing
    } else {
      this.spacingAccumulatorSec = 0
    }

    const sampleOffset = this.writeIndex * this.edgeCount * ENDPOINT_FLOATS_PER_EDGE
    const sampleLength = this.edgeCount * ENDPOINT_FLOATS_PER_EDGE
    for (let index = 0; index < sampleLength; index += 1) {
      this.samples[sampleOffset + index] = input.endpoints[index]
    }

    this.writeIndex = (this.writeIndex + 1) % this.sampleCapacity
    this.sampleCount = Math.min(this.sampleCapacity, this.sampleCount + 1)
    this.mutationRevision += 1
    return true
  }

  reset(): void {
    this.writeIndex = 0
    this.sampleCount = 0
    this.spacingAccumulatorSec = 0
    this.samples.fill(0)
    this.mutationRevision += 1
  }

  dispose(): void {
    this.edgeCount = 0
    this.sampleCapacity = 0
    this.topologyRevision = -1
    this.samples = new Float32Array(0)
    this.writeIndex = 0
    this.sampleCount = 0
    this.spacingAccumulatorSec = 0
    this.mutationRevision += 1
  }

  getSampleOffset(age: number): number {
    if (age < 0 || age >= this.sampleCount || this.sampleCapacity === 0) return -1
    const slot = (this.writeIndex - 1 - Math.floor(age) + this.sampleCapacity) % this.sampleCapacity
    return slot * this.edgeCount * ENDPOINT_FLOATS_PER_EDGE
  }

  getStorage(): Float32Array {
    return this.samples
  }

  getEdgeCount(): number {
    return this.edgeCount
  }

  getSampleCount(): number {
    return this.sampleCount
  }

  getCapacity(): number {
    return this.sampleCapacity
  }

  getTopologyRevision(): number {
    return this.topologyRevision
  }

  getMutationRevision(): number {
    return this.mutationRevision
  }
}
