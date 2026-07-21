import { clampSimulationNumber, finiteSimulationNumber } from './math'

export type VisualSimulationClockSynchronizationReason =
  | 'manual'
  | 'timingDiscontinuity'
  | 'seek'
  | 'backwardSeek'
  | 'loopWrap'
  | 'trackReplacement'

export interface FixedStepSimulationClockOptions {
  fixedTimestepSec?: number
  maxFrameDeltaSec?: number
  maxSubsteps?: number
  maxAccumulatorSec?: number
}

export interface FixedStepSimulationFrameResult {
  steps: number
  interpolationAlpha: number
  acceptedDeltaSec: number
  droppedTimeSec: number
  simulationTimeSec: number
  paused: boolean
  frozen: boolean
}

export type FixedStepSimulationStep = (fixedTimestepSec: number, simulationTimeSec: number) => void

const DEFAULT_FIXED_TIMESTEP_SEC = 1 / 120
const DEFAULT_MAX_FRAME_DELTA_SEC = 0.1
const DEFAULT_MAX_SUBSTEPS = 8
const MIN_TIMESTEP_SEC = 1 / 1000

/** Renderer-owned fixed-step clock with bounded catch-up and no framework dependencies. */
export class FixedStepSimulationClock {
  readonly fixedTimestepSec: number
  readonly maxFrameDeltaSec: number
  readonly maxSubsteps: number
  readonly maxAccumulatorSec: number

  private accumulatorSec = 0
  private simulationTimeSec = 0
  private paused = false
  private frozen = false
  private disposed = false
  private readonly frameResult: FixedStepSimulationFrameResult = {
    steps: 0,
    interpolationAlpha: 1,
    acceptedDeltaSec: 0,
    droppedTimeSec: 0,
    simulationTimeSec: 0,
    paused: false,
    frozen: false,
  }

  constructor(options: FixedStepSimulationClockOptions = {}) {
    this.fixedTimestepSec = Math.max(MIN_TIMESTEP_SEC, finiteSimulationNumber(options.fixedTimestepSec, DEFAULT_FIXED_TIMESTEP_SEC))
    this.maxFrameDeltaSec = Math.max(this.fixedTimestepSec, finiteSimulationNumber(options.maxFrameDeltaSec, DEFAULT_MAX_FRAME_DELTA_SEC))
    this.maxSubsteps = Math.max(1, Math.floor(finiteSimulationNumber(options.maxSubsteps, DEFAULT_MAX_SUBSTEPS)))
    const defaultAccumulator = this.fixedTimestepSec * this.maxSubsteps
    this.maxAccumulatorSec = Math.max(
      this.fixedTimestepSec,
      Math.min(
        this.maxFrameDeltaSec,
        finiteSimulationNumber(options.maxAccumulatorSec, defaultAccumulator),
      ),
    )
  }

  advance(frameDeltaSec: number, step: FixedStepSimulationStep): FixedStepSimulationFrameResult {
    if (this.disposed || this.paused || this.frozen) {
      return this.setFrameResult(0, 1, 0, Math.max(0, finiteSimulationNumber(frameDeltaSec)))
    }

    const rawDeltaSec = Math.max(0, finiteSimulationNumber(frameDeltaSec))
    const acceptedDeltaSec = Math.min(rawDeltaSec, this.maxFrameDeltaSec)
    let droppedTimeSec = rawDeltaSec - acceptedDeltaSec
    const nextAccumulator = this.accumulatorSec + acceptedDeltaSec
    if (nextAccumulator > this.maxAccumulatorSec) droppedTimeSec += nextAccumulator - this.maxAccumulatorSec
    this.accumulatorSec = Math.min(this.maxAccumulatorSec, nextAccumulator)

    let steps = 0
    while (this.accumulatorSec + Number.EPSILON >= this.fixedTimestepSec && steps < this.maxSubsteps) {
      this.simulationTimeSec += this.fixedTimestepSec
      step(this.fixedTimestepSec, this.simulationTimeSec)
      this.accumulatorSec = Math.max(0, this.accumulatorSec - this.fixedTimestepSec)
      steps += 1
    }
    if (steps >= this.maxSubsteps && this.accumulatorSec >= this.fixedTimestepSec) {
      droppedTimeSec += this.accumulatorSec
      this.accumulatorSec = 0
    }
    const alpha = clampSimulationNumber(this.accumulatorSec / this.fixedTimestepSec, 0, 1)
    return this.setFrameResult(steps, alpha, acceptedDeltaSec, droppedTimeSec)
  }

  pause(): void {
    if (this.disposed || this.paused) return
    this.paused = true
    this.clearAccumulator()
  }

  resume(): void {
    if (this.disposed || !this.paused) return
    this.paused = false
    this.clearAccumulator()
  }

  freeze(): void {
    if (this.disposed || this.frozen) return
    this.frozen = true
    this.clearAccumulator()
  }

  unfreeze(): void {
    if (this.disposed || !this.frozen) return
    this.frozen = false
    this.clearAccumulator()
  }

  synchronize(_reason: VisualSimulationClockSynchronizationReason = 'manual', simulationTimeSec?: number): void {
    if (this.disposed) return
    if (simulationTimeSec != null) this.simulationTimeSec = Math.max(0, finiteSimulationNumber(simulationTimeSec))
    this.clearAccumulator()
  }

  seek(simulationTimeSec?: number): void {
    this.synchronize('seek', simulationTimeSec)
  }

  backwardSeek(simulationTimeSec?: number): void {
    this.synchronize('backwardSeek', simulationTimeSec)
  }

  loopWrap(simulationTimeSec?: number): void {
    this.synchronize('loopWrap', simulationTimeSec)
  }

  replaceTrack(simulationTimeSec = 0): void {
    this.synchronize('trackReplacement', simulationTimeSec)
  }

  reset(simulationTimeSec = 0): void {
    if (this.disposed) return
    this.simulationTimeSec = Math.max(0, finiteSimulationNumber(simulationTimeSec))
    this.paused = false
    this.frozen = false
    this.clearAccumulator()
  }

  getInterpolationAlpha(): number {
    return this.frameResult.interpolationAlpha
  }

  getSimulationTimeSec(): number {
    return this.simulationTimeSec
  }

  isPaused(): boolean {
    return this.paused
  }

  isFrozen(): boolean {
    return this.frozen
  }

  dispose(): void {
    this.disposed = true
    this.paused = true
    this.frozen = true
    this.accumulatorSec = 0
    this.simulationTimeSec = 0
    this.setFrameResult(0, 1, 0, 0)
  }

  private clearAccumulator(): void {
    this.accumulatorSec = 0
    this.setFrameResult(0, 1, 0, 0)
  }

  private setFrameResult(
    steps: number,
    interpolationAlpha: number,
    acceptedDeltaSec: number,
    droppedTimeSec: number,
  ): FixedStepSimulationFrameResult {
    this.frameResult.steps = steps
    this.frameResult.interpolationAlpha = interpolationAlpha
    this.frameResult.acceptedDeltaSec = acceptedDeltaSec
    this.frameResult.droppedTimeSec = droppedTimeSec
    this.frameResult.simulationTimeSec = this.simulationTimeSec
    this.frameResult.paused = this.paused
    this.frameResult.frozen = this.frozen
    return this.frameResult
  }
}
