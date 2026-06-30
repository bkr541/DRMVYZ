import {
  getReactPerformanceAction,
  isReactPerformanceActionCompatible,
  type ReactPerformanceActionEvent,
  type ReactPerformanceActionEnvelope,
  type ReactPerformanceActionTarget,
} from '../../../../ReactPerformanceActions'
import type { ReactiveConstellationRuntimeOffsets } from './ReactiveConstellationChoreography'

const TARGET: ReactPerformanceActionTarget = {
  engineId: 'cinematicPortal',
  worldId: 'reactiveConstellation',
}

interface ActiveMomentaryAction {
  actionId: string
  ageMs: number
  envelope: ReactPerformanceActionEnvelope
}

export interface ReactiveConstellationPerformanceFrame {
  offsets: ReactiveConstellationRuntimeOffsets
  freeze: boolean
  crystalOnly: boolean
  edgesOnly: boolean
  paletteFlip: boolean
  blackout: boolean
  whiteFlash: number
  reseedSequence: number | null
}

const EMPTY_FRAME: ReactiveConstellationPerformanceFrame = {
  offsets: {},
  freeze: false,
  crystalOnly: false,
  edgesOnly: false,
  paletteFlip: false,
  blackout: false,
  whiteFlash: 0,
  reseedSequence: null,
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Bounded attack-hold-release envelope used by momentary visual actions. */
export function resolvePerformanceActionEnvelope(
  ageMs: number,
  envelope: ReactPerformanceActionEnvelope,
): number {
  const attack = Math.max(0, envelope.attackMs)
  const hold = Math.max(0, envelope.holdMs)
  const release = Math.max(1, envelope.releaseMs)
  const age = Math.max(0, Number.isFinite(ageMs) ? ageMs : 0)
  if (attack > 0 && age < attack) return clamp01(age / attack)
  if (age < attack + hold) return 1
  return clamp01(1 - (age - attack - hold) / release)
}

function addOffset(
  offsets: ReactiveConstellationRuntimeOffsets,
  key: keyof ReactiveConstellationRuntimeOffsets,
  value: number,
): void {
  offsets[key] = (offsets[key] ?? 0) + value
}

export class ReactiveConstellationPerformanceActionRuntime {
  private lastConsumedSequence = -1
  private readonly momentary = new Map<string, ActiveMomentaryAction>()
  private readonly toggles = new Map<string, boolean>()
  private pendingReseedSequence: number | null = null

  get consumedSequence(): number {
    return this.lastConsumedSequence
  }

  update(input: {
    event?: ReactPerformanceActionEvent | null
    events?: readonly ReactPerformanceActionEvent[]
    toggleStates?: Readonly<Record<string, boolean>>
    deltaTimeSec: number
    timingDiscontinuity?: boolean
  }): ReactiveConstellationPerformanceFrame {
    if (input.timingDiscontinuity) this.momentary.clear()
    this.syncToggleStates(input.toggleStates)
    const events = input.events && input.events.length > 0
      ? [...input.events].sort((a, b) => a.sequence - b.sequence)
      : input.event ? [input.event] : []
    for (const event of events) this.consume(event)

    const deltaMs = Math.min(100, Math.max(0, Number.isFinite(input.deltaTimeSec) ? input.deltaTimeSec * 1000 : 0))
    const offsets: ReactiveConstellationRuntimeOffsets = {}
    let whiteFlash = 0

    for (const [actionId, active] of this.momentary) {
      const value = resolvePerformanceActionEnvelope(active.ageMs, active.envelope)
      switch (actionId) {
        case 'reactiveConstellation.collapse':
          addOffset(offsets, 'networkSpread', -0.78 * value)
          addOffset(offsets, 'collapseForce', 1.55 * value)
          addOffset(offsets, 'springStrength', 0.5 * value)
          addOffset(offsets, 'edgeBrightness', 0.55 * value)
          break
        case 'reactiveConstellation.burst':
          addOffset(offsets, 'networkSpread', 0.58 * value)
          addOffset(offsets, 'burstImpulse', 2.5 * value)
          addOffset(offsets, 'edgeBrightness', 1.45 * value)
          addOffset(offsets, 'edgeWidth', 1.1 * value)
          addOffset(offsets, 'nodeScale', 0.032 * value)
          break
        case 'reactiveConstellation.whiteFlash':
          whiteFlash = Math.max(whiteFlash, value)
          addOffset(offsets, 'edgeBrightness', 1.9 * value)
          addOffset(offsets, 'internalGlow', 0.42 * value)
          addOffset(offsets, 'rimIntensity', 0.42 * value)
          break
      }

      active.ageMs += deltaMs
      if (resolvePerformanceActionEnvelope(active.ageMs, active.envelope) <= 0) this.momentary.delete(actionId)
    }

    if (this.toggles.get('reactiveConstellation.beamFan') === true) {
      addOffset(offsets, 'trailLength', 12)
      addOffset(offsets, 'edgeBrightness', 0.9)
      addOffset(offsets, 'edgeWidth', 0.85)
      addOffset(offsets, 'cameraOrbit', 0.08)
    }

    const frame: ReactiveConstellationPerformanceFrame = {
      offsets,
      freeze: this.toggles.get('reactiveConstellation.freeze') === true,
      crystalOnly: this.toggles.get('reactiveConstellation.crystalOnly') === true,
      edgesOnly: this.toggles.get('reactiveConstellation.edgesOnly') === true,
      paletteFlip: this.toggles.get('reactiveConstellation.paletteFlip') === true,
      blackout: this.toggles.get('reactiveConstellation.blackout') === true,
      whiteFlash,
      reseedSequence: this.pendingReseedSequence,
    }
    this.pendingReseedSequence = null
    return frame
  }

  reset(options: { preserveConsumedSequence?: boolean } = {}): void {
    this.momentary.clear()
    this.toggles.clear()
    this.pendingReseedSequence = null
    if (options.preserveConsumedSequence !== true) this.lastConsumedSequence = -1
  }

  private consume(event: ReactPerformanceActionEvent | null | undefined): void {
    if (!event || event.sequence <= this.lastConsumedSequence) return
    // Advance even for an incompatible event so a stale store object cannot be retried every frame.
    this.lastConsumedSequence = event.sequence
    const action = getReactPerformanceAction(event.actionId)
    if (!action || !isReactPerformanceActionCompatible(action, TARGET) || !isReactPerformanceActionCompatible(action, event.target)) return

    if (action.behavior === 'toggle') {
      this.toggles.set(action.id, event.toggleState === true)
      return
    }
    if (action.id === 'reactiveConstellation.reseed') {
      this.pendingReseedSequence = event.sequence
      return
    }
    if (action.behavior === 'momentary' && action.envelope) {
      this.momentary.set(action.id, { actionId: action.id, ageMs: 0, envelope: action.envelope })
    }
  }

  private syncToggleStates(toggleStates: Readonly<Record<string, boolean>> | undefined): void {
    if (!toggleStates) return
    // Store toggle state is authoritative. Clearing or switching context must not
    // leave a renderer-local toggle latched behind an empty object.
    this.toggles.clear()
    for (const [actionId, enabled] of Object.entries(toggleStates)) {
      const action = getReactPerformanceAction(actionId)
      if (enabled === true && action?.behavior === 'toggle' && isReactPerformanceActionCompatible(action, TARGET)) {
        this.toggles.set(actionId, true)
      }
    }
  }
}

export function createEmptyReactiveConstellationPerformanceFrame(): ReactiveConstellationPerformanceFrame {
  return { ...EMPTY_FRAME, offsets: {} }
}
