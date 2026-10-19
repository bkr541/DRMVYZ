import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import {
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  type CanvasShiftgridPattern,
  type CanvasShiftgridReconstructionMode,
  type CanvasShiftgridSettings,
  type CanvasShiftgridTrigger,
} from './ShiftgridSettings'

export const SHIFTGRID_TRIGGER_IDS = Object.freeze([
  'beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
] as const satisfies readonly CanvasShiftgridTrigger[])

export type ShiftgridPatternAuthority = 'manual' | 'patternChange' | 'autoPerformance'

export interface ShiftgridMusicalEvents {
  readonly beat: string | null
  readonly kick: string | null
  readonly snare: string | null
  readonly downbeat: string | null
  readonly bar: string | null
  readonly phrase: string | null
  readonly section: string | null
  readonly drop: string | null
}

export interface ShiftgridAudioRouting {
  /** Kick-owned horizontal travel impulse. */
  readonly horizontalImpulse: number
  /** Snare-owned vertical exchange impulse. */
  readonly verticalImpulse: number
  readonly snapAccent: number
  /** Bass/sub controls travel amplitude and the short grid pulse. */
  readonly movementAmplitude: number
  readonly gridPulse: number
  /** Midrange controls how many tiles may participate. */
  readonly movementDensity: number
  /** High-frequency content only feeds a restrained edge treatment. */
  readonly edgeShimmer: number
  readonly puzzleComplexity: number
  readonly preDropHold: boolean
}

export interface ShiftgridPerformanceDecision {
  readonly authority: ShiftgridPatternAuthority
  readonly activePattern: CanvasShiftgridPattern
  readonly patternChanged: boolean
  readonly patternStartBeat: number
  readonly reset: boolean
  readonly triggerEventId: string | null
  readonly events: ShiftgridMusicalEvents
  readonly routing: ShiftgridAudioRouting
  readonly reconstructNow: boolean
  readonly advanceMosaic: boolean
}

export interface ShiftgridPatternControllerInput {
  readonly authoredPattern: CanvasShiftgridPattern
  readonly patternChange: boolean
  readonly trigger: CanvasShiftgridTrigger
  readonly triggerEventId: string | null
  readonly absoluteBeat: number
  readonly reset?: boolean
}

export interface ShiftgridPatternSelection {
  readonly activePattern: CanvasShiftgridPattern
  readonly patternStartBeat: number
  readonly changed: boolean
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

/** 120 BPM is the authored 1x timing reference; invalid/missing grids keep authored timing. */
export function resolveShiftgridBpmDurationScale(context: SharedPerformanceContext | null, bpmSync: boolean): number {
  if (!bpmSync || !context?.capabilities.beatGrid || !Number.isFinite(context.bpm) || context.bpm <= 0) return 1
  return Math.min(2, Math.max(0.5, 120 / context.bpm))
}

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5
  return (value >>> 0) / 0x100000000
}

export function createShiftgridPerformancePatternCycle(seed: number): readonly CanvasShiftgridPattern[] {
  const cycle = CANVAS_SHIFTGRID_PATTERN_OPTIONS.map(option => option.value)
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(seed, index) * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

export function nextShiftgridPerformancePattern(
  cycle: readonly CanvasShiftgridPattern[],
  current: CanvasShiftgridPattern,
): CanvasShiftgridPattern {
  if (cycle.length < 2) return current
  const index = cycle.indexOf(current)
  const next = cycle[(index < 0 ? 0 : index + 1) % cycle.length]
  return next === current ? cycle[(index + 2) % cycle.length] ?? 'rowRunner' : next ?? 'rowRunner'
}

/** Runtime-only authority; it never writes the authored Canvas settings. */
export class ShiftgridPatternController {
  private activePattern: CanvasShiftgridPattern
  private authoredPattern: CanvasShiftgridPattern | null = null
  private patternChange: boolean | null = null
  private trigger: CanvasShiftgridTrigger | null = null
  private patternStartBeat = 0
  private lastTriggerEventId: string | null = null

  constructor(
    private readonly cycle: readonly CanvasShiftgridPattern[],
    initialPattern: CanvasShiftgridPattern = 'rowRunner',
  ) {
    this.activePattern = initialPattern
  }

  update(input: Readonly<ShiftgridPatternControllerInput>): Readonly<ShiftgridPatternSelection> {
    const absoluteBeat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const authoredChanged = this.authoredPattern != null && input.authoredPattern !== this.authoredPattern
    const toggled = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    let changed = false

    if (input.reset || authoredChanged || toggled || this.authoredPattern == null) {
      changed = this.activePattern !== input.authoredPattern || authoredChanged || toggled
      this.activePattern = input.authoredPattern
      this.patternStartBeat = this.authoredPattern == null && !input.reset ? 0 : absoluteBeat
      this.lastTriggerEventId = input.triggerEventId
    } else if (triggerChanged) {
      this.lastTriggerEventId = input.triggerEventId
    } else if (!input.patternChange) {
      if (this.activePattern !== input.authoredPattern) {
        this.activePattern = input.authoredPattern
        this.patternStartBeat = absoluteBeat
        changed = true
      }
      this.lastTriggerEventId = input.triggerEventId
    } else if (input.triggerEventId && input.triggerEventId !== this.lastTriggerEventId) {
      this.activePattern = nextShiftgridPerformancePattern(this.cycle, this.activePattern)
      this.patternStartBeat = absoluteBeat
      this.lastTriggerEventId = input.triggerEventId
      changed = true
    }

    this.authoredPattern = input.authoredPattern
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    return Object.freeze({ activePattern: this.activePattern, patternStartBeat: this.patternStartBeat, changed })
  }

  reset(): void {
    this.authoredPattern = null
    this.patternChange = null
    this.trigger = null
    this.patternStartBeat = 0
    this.lastTriggerEventId = null
  }
}

function eventId(context: SharedPerformanceContext, kind: string, index: number | string): string {
  return `${context.runtimeIdentity}:${kind}:${index}`
}

/**
 * Adapts only events already published by SharedPerformanceContext. There is no
 * private preview metronome and no fallback clock when the shared beat grid is
 * unavailable.
 */
export function resolveShiftgridMusicalEvents(
  context: SharedPerformanceContext | null,
  previous: SharedPerformanceContext | null,
  active: boolean,
): ShiftgridMusicalEvents {
  const empty: ShiftgridMusicalEvents = Object.freeze({ beat: null, kick: null, snare: null, downbeat: null, bar: null, phrase: null, section: null, drop: null })
  if (!active || !context || context.boundaries.timingDiscontinuity) return empty
  const hasGrid = context.capabilities.beatGrid
  const beatIndex = Math.floor(context.absoluteBeat + 1e-6)
  const barIndex = Math.floor(context.absoluteBar + 1e-6)
  const beat = hasGrid && context.boundaries.beatBoundary ? eventId(context, 'beat', beatIndex) : null
  const bar = hasGrid && context.boundaries.barBoundary ? eventId(context, 'bar', barIndex) : null
  const kick = context.capabilities.rhythmEvents && context.kick && !previous?.kick
    ? eventId(context, 'kick', Math.round(context.audioTimeSec * 1000)) : null
  const snare = context.capabilities.rhythmEvents && context.snare && !previous?.snare
    ? eventId(context, 'snare', Math.round(context.audioTimeSec * 1000)) : null
  const downbeat = hasGrid && context.capabilities.beatGrid && context.boundaries.barBoundary && context.downbeat
    ? eventId(context, 'downbeat', barIndex) : null
  const phrase = hasGrid && context.boundaries.barBoundary && previous != null && context.phraseIndex !== previous.phraseIndex
    ? eventId(context, 'phrase', context.phraseIndex) : null
  const section = context.capabilities.sections && context.boundaries.sectionEntry
    ? eventId(context, 'section', `${context.sectionId ?? context.sectionType ?? 'unknown'}:${context.sectionOccurrence}`) : null
  const semanticDrop = context.confidence.semantics > 0 && context.dropImpact > 0.55 && (previous?.dropImpact ?? 0) <= 0.55
  const sectionDrop = context.capabilities.sections && context.boundaries.sectionEntry && context.sectionType === 'drop'
  const drop = sectionDrop || semanticDrop
    ? eventId(context, 'drop', `${context.dropOccurrence}:${Math.round(context.audioTimeSec * 1000)}`) : null
  return Object.freeze({ beat, kick, snare, downbeat, bar, phrase, section, drop })
}

export function resolveShiftgridTriggerEventIdentity(
  context: SharedPerformanceContext | null,
  previous: SharedPerformanceContext | null,
  trigger: CanvasShiftgridTrigger,
  active: boolean,
): string | null {
  const events = resolveShiftgridMusicalEvents(context, previous, active)
  if (!context) return null
  if (trigger === 'kick' || trigger === 'snare' || trigger === 'downbeat' || trigger === 'phrase' || trigger === 'drop') return events[trigger]
  if (trigger === 'beat') return events.beat
  if (trigger === 'beat2' || trigger === 'beat4') {
    if (!events.beat) return null
    const divisor = trigger === 'beat2' ? 2 : 4
    const beatIndex = Math.floor(context.absoluteBeat + 1e-6)
    return beatIndex % divisor === 0 ? `${events.beat}:${trigger}:${Math.floor(beatIndex / divisor)}` : null
  }
  if (!events.bar) return null
  if (trigger === 'bar') return events.bar
  const divisor = trigger === 'bar4' ? 4 : 8
  const barIndex = Math.floor(context.absoluteBar + 1e-6)
  return barIndex % divisor === 0 ? `${events.bar}:${trigger}:${Math.floor(barIndex / divisor)}` : null
}

function patternForAutoContext(context: SharedPerformanceContext, seed: number): CanvasShiftgridPattern {
  const type = context.sectionType ?? context.macroSectionType ?? 'unknown'
  if (type === 'intro') return 'rowRunner'
  if (type === 'verse') return context.sceneLocalVariationIndex % 2 === 0 ? 'checkerShift' : 'columnCascade'
  if (type === 'breakdown' || type === 'outro') return 'magneticResolve'
  if (type === 'build') return context.buildProgress > 0.66 ? 'waveRelay' : context.buildProgress > 0.33 ? 'dominoChain' : 'edgeExpansion'
  if (type === 'preDrop') return 'centerCollapse'
  if (type === 'drop') return context.sectionPhase === 'entry' ? 'edgeExpansion' : context.sceneLocalVariationIndex % 2 === 0 ? 'waveRelay' : 'columnCascade'
  if (type === 'bridge') return 'centerCollapse'
  const cycle = createShiftgridPerformancePatternCycle(seed ^ context.deterministicVariationSeed)
  return cycle[Math.abs(context.performanceFourBarBlockIndex) % cycle.length] ?? 'rowRunner'
}

function reconstructionEvent(mode: CanvasShiftgridReconstructionMode, events: ShiftgridMusicalEvents): boolean {
  if (mode === 'phraseResolve') return events.phrase != null
  if (mode === 'dropResolve') return events.drop != null
  if (mode === 'progressiveResolve') return events.bar != null
  return false
}

/** One decision per frame, with Pattern Change > Auto Performance > Manual authority. */
export class ShiftgridPerformanceController {
  private readonly patternController: ShiftgridPatternController
  private previousContext: SharedPerformanceContext | null = null
  private previousAuthority: ShiftgridPatternAuthority | null = null
  private autoPattern: CanvasShiftgridPattern
  private autoPatternStartBeat = 0
  private lastAutoStructuralEvent: string | null = null

  constructor(private readonly seed: number, initialPattern: CanvasShiftgridPattern = 'rowRunner') {
    this.patternController = new ShiftgridPatternController(createShiftgridPerformancePatternCycle(seed), initialPattern)
    this.autoPattern = initialPattern
  }

  update(input: Readonly<{
    settings: CanvasShiftgridSettings
    context: SharedPerformanceContext | null
    audioActive: boolean
    paused: boolean
  }>): ShiftgridPerformanceDecision {
    const { settings, context } = input
    const eventActive = input.audioActive && !input.paused
    const runtimeChanged = Boolean(this.previousContext && context && this.previousContext.runtimeIdentity !== context.runtimeIdentity)
    const reset = Boolean(context?.boundaries.timingDiscontinuity || context?.seekDetected || context?.loopWrapDetected || context?.trackReplacementDetected || runtimeChanged)
    const events = resolveShiftgridMusicalEvents(context, this.previousContext, eventActive)
    const triggerEventId = resolveShiftgridTriggerEventIdentity(context, this.previousContext, settings.trigger, eventActive)
    const authority: ShiftgridPatternAuthority = settings.patternChange
      ? 'patternChange'
      : settings.autoPerformance ? 'autoPerformance' : 'manual'
    const firstUpdate = this.previousAuthority == null
    const authorityChanged = this.previousAuthority != null && authority !== this.previousAuthority
    const absoluteBeat = context?.absoluteBeat ?? 0
    let activePattern: CanvasShiftgridPattern
    let patternChanged = false
    let patternStartBeat = absoluteBeat

    if (authority === 'autoPerformance') {
      const structuralEvent = events.drop ?? events.section ?? events.phrase ?? (context?.boundaries.performanceFourBarBoundary ? eventId(context, 'performance4bar', context.performanceFourBarBlockIndex) : null)
      const next = context ? patternForAutoContext(context, this.seed) : settings.choreographyPattern
      if (reset || authorityChanged || firstUpdate) {
        this.autoPattern = next
        this.autoPatternStartBeat = absoluteBeat
        this.lastAutoStructuralEvent = structuralEvent
        patternChanged = true
      } else if (structuralEvent && structuralEvent !== this.lastAutoStructuralEvent && next !== this.autoPattern) {
        this.autoPattern = next
        this.autoPatternStartBeat = absoluteBeat
        this.lastAutoStructuralEvent = structuralEvent
        patternChanged = true
      }
      activePattern = this.autoPattern
      patternStartBeat = this.autoPatternStartBeat
      // Keep manual controller state synchronized without granting it runtime authority.
      this.patternController.update({ authoredPattern: settings.choreographyPattern, patternChange: false, trigger: settings.trigger, triggerEventId, absoluteBeat, reset: reset || authorityChanged })
    } else {
      const selected = this.patternController.update({
        authoredPattern: settings.choreographyPattern,
        patternChange: authority === 'patternChange',
        trigger: settings.trigger,
        triggerEventId,
        absoluteBeat,
        reset: reset || authorityChanged,
      })
      activePattern = selected.activePattern
      patternStartBeat = selected.patternStartBeat
      patternChanged = selected.changed
    }

    const bass = eventActive && context ? clamp01(context.bass) : 0
    const mid = eventActive && context ? clamp01(context.mid) : 0
    const high = eventActive && context ? clamp01(context.high) : 0
    const build = eventActive && context ? clamp01(context.buildProgress) : 0
    const routing: ShiftgridAudioRouting = Object.freeze({
      horizontalImpulse: events.kick ? clamp01(context?.kickStrength ?? 0) : 0,
      verticalImpulse: events.snare ? clamp01(context?.snareStrength ?? 0) : 0,
      snapAccent: events.snare ? clamp01(0.45 + (context?.snareStrength ?? 0) * 0.55) : 0,
      movementAmplitude: bass,
      gridPulse: events.beat ? clamp01(0.3 + bass * 0.7) : 0,
      movementDensity: mid,
      edgeShimmer: high * 0.35,
      puzzleComplexity: clamp01(build * 0.75 + (context?.complexity ?? 0) * 0.25),
      preDropHold: authority === 'autoPerformance' && context?.sectionType === 'preDrop' && context.sectionProgress > 0.55,
    })
    const reconstructNow = reconstructionEvent(settings.reconstructionMode, events)
      || (authority === 'autoPerformance' && events.drop != null && settings.reconstructionMode !== 'manualResolve')
      || (authority === 'autoPerformance' && context?.sectionType === 'outro' && events.section != null && settings.reconstructionMode !== 'manualResolve')
    const advanceMosaic = authority === 'autoPerformance' && settings.mosaicType !== 'singleImage'
      && (events.drop != null || events.phrase != null || events.section != null)

    this.previousContext = context
    this.previousAuthority = authority
    return Object.freeze({ authority, activePattern, patternChanged, patternStartBeat, reset, triggerEventId, events, routing, reconstructNow, advanceMosaic })
  }

  reset(): void {
    this.patternController.reset()
    this.previousContext = null
    this.previousAuthority = null
    this.autoPattern = 'rowRunner'
    this.autoPatternStartBeat = 0
    this.lastAutoStructuralEvent = null
  }
}

