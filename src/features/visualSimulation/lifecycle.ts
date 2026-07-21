import { createVisualSimulationStructuralSignature } from './signature'

export type VisualSimulationRuntimeMode = 'live' | 'preview' | 'thumbnail'
export type VisualSimulationTimingReason =
  | 'timingDiscontinuity'
  | 'seek'
  | 'backwardSeek'
  | 'loopWrap'
  | 'trackReplacement'

export interface VisualSimulationConfigureInput<TStructuralConfig, TParameters> {
  structural: TStructuralConfig
  parameters: TParameters
  mode?: VisualSimulationRuntimeMode
}

export interface VisualSimulationConfigureResult {
  rebuilt: boolean
  parameterOnlyUpdate: boolean
  structuralSignature: string
  structureRevision: number
}

export interface VisualSimulationResetInput {
  seed: number
  identity?: string | number | null
}

export interface VisualSimulationTimingSynchronization {
  reason: VisualSimulationTimingReason
  timeSec?: number
  identity?: string | number | null
}

/** Engine-owned simulation domain hooks. Implementations own all typed arrays and renderer resources. */
export interface VisualSimulationDomainAdapter<TStructuralConfig, TParameters> {
  rebuild(structural: TStructuralConfig, parameters: TParameters, mode: VisualSimulationRuntimeMode): void
  updateParameters(parameters: TParameters, mode: VisualSimulationRuntimeMode): void
  reset(input: VisualSimulationResetInput): void
  synchronizeTiming(input: VisualSimulationTimingSynchronization): void
  pause(): void
  resume(): void
  setRuntimeMode?(mode: VisualSimulationRuntimeMode): void
  /** Must release typed arrays, internal buffers, and renderer-owned resources. */
  releaseResources(): void
}

/**
 * Small lifecycle coordinator that separates structural rebuilds from cheap
 * parameter updates. It owns no global state and performs no simulation steps.
 */
export class VisualSimulationLifecycleController<TStructuralConfig, TParameters> {
  private structuralSignature = ''
  private structureRevision = 0
  private mode: VisualSimulationRuntimeMode = 'live'
  private configured = false
  private paused = false
  private disposed = false

  constructor(private readonly adapter: VisualSimulationDomainAdapter<TStructuralConfig, TParameters>) {}

  configure(input: VisualSimulationConfigureInput<TStructuralConfig, TParameters>): VisualSimulationConfigureResult {
    if (this.disposed) throw new Error('Cannot configure a disposed visual simulation lifecycle.')
    const nextMode = input.mode ?? this.mode
    const nextSignature = createVisualSimulationStructuralSignature(input.structural)
    const rebuilt = !this.configured || nextSignature !== this.structuralSignature
    this.mode = nextMode
    this.adapter.setRuntimeMode?.(nextMode)
    if (rebuilt) {
      this.adapter.rebuild(input.structural, input.parameters, nextMode)
      this.structuralSignature = nextSignature
      this.structureRevision += 1
      this.configured = true
    } else {
      this.adapter.updateParameters(input.parameters, nextMode)
    }
    return {
      rebuilt,
      parameterOnlyUpdate: !rebuilt,
      structuralSignature: this.structuralSignature,
      structureRevision: this.structureRevision,
    }
  }

  reset(input: VisualSimulationResetInput): void {
    if (this.disposed) return
    this.adapter.reset(input)
  }

  synchronizeTiming(input: VisualSimulationTimingSynchronization): void {
    if (this.disposed) return
    this.adapter.synchronizeTiming(input)
  }

  seek(timeSec?: number, identity?: string | number | null): void {
    this.synchronizeTiming({ reason: 'seek', timeSec, identity })
  }

  backwardSeek(timeSec?: number, identity?: string | number | null): void {
    this.synchronizeTiming({ reason: 'backwardSeek', timeSec, identity })
  }

  loopWrap(timeSec?: number, identity?: string | number | null): void {
    this.synchronizeTiming({ reason: 'loopWrap', timeSec, identity })
  }

  replaceTrack(timeSec = 0, identity?: string | number | null): void {
    this.synchronizeTiming({ reason: 'trackReplacement', timeSec, identity })
  }

  pause(): void {
    if (this.disposed || this.paused) return
    this.paused = true
    this.adapter.pause()
  }

  resume(): void {
    if (this.disposed || !this.paused) return
    this.paused = false
    this.adapter.resume()
  }

  setRuntimeMode(mode: VisualSimulationRuntimeMode): void {
    if (this.disposed || mode === this.mode) return
    this.mode = mode
    this.adapter.setRuntimeMode?.(mode)
  }

  getStructuralSignature(): string {
    return this.structuralSignature
  }

  getStructureRevision(): number {
    return this.structureRevision
  }

  getRuntimeMode(): VisualSimulationRuntimeMode {
    return this.mode
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.configured = false
    this.paused = true
    this.structuralSignature = ''
    this.adapter.releaseResources()
  }
}
