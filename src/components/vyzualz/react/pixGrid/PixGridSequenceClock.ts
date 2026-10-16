import type { SharedPerformanceContext } from '../../../../features/performanceCore/context'
import { createPerformanceDeterministicSeed } from '../../../../features/performanceCore/determinism'
import type { ReactSectionType } from '../ReactTypes'
import type { PixGridActionCue, PixGridCueQuantization } from './PixGridActionCues'
import type { PixGridDeckConcreteTransitionMode, PixGridPreparedFrameSet } from './PixGridDeckCompilerContracts'
import type {
  PixGridDeckDefinition,
  PixGridDeckItemDefinition,
  PixGridDeckPlaybackOrder,
  PixGridDeckPreDropBehavior,
  PixGridDeckMusicalArrivalAnchor,
  PixGridDeckTransitionAnchorMode,
  PixGridDeckTransitionMode,
} from './PixGridDeckDomain'
import { resolvePixGridDeckTransitionPairPolicy, resolvePixGridDeckTransitionPolicy } from './PixGridDeckDomain'
import { quantizePixGridDeckTransitionDuration } from './PixGridDeckTransitionPlanner'
import type { PixGridAudioFrame, PixGridSectionBarSpan } from './PixGridTypes'

const EPSILON = 1e-8
const DEFAULT_BEATS_PER_BAR = 4
const MAX_SEQUENCE_TRANSITIONS = 250_000

export const PIX_GRID_SEQUENCE_CLOCK_ID = 'PixGridSequenceClock' as const

export const PIX_GRID_DECK_SECTION_CADENCE_BARS: Readonly<Record<ReactSectionType, number | null>> = Object.freeze({
  intro: 8,
  verse: 4,
  build: 2,
  preDrop: null,
  drop: 1,
  breakdown: 8,
  bridge: 4,
  outro: 8,
  unknown: 4,
})

export type PixGridSequenceBoundaryKind = 'phrase' | 'section' | 'audio' | 'trackMap'
export type PixGridSequenceBoundaryBehavior = 'force' | 'arm'
export type PixGridSequenceBoundaryQuantization = 'beat' | 'bar' | 'fourBars' | 'phrase' | 'section'
export type PixGridTransitionLifecycle = 'scheduled' | 'preparing' | 'active' | 'completing' | 'completed' | 'interrupted' | 'cancelled'
export type PixGridTransitionInterruptionPolicy = 'finishCurrent' | 'queueNext' | 'continueFromDisplayed'

export interface PixGridSequenceBoundarySignal {
  id: string
  bar: number
  kind: PixGridSequenceBoundaryKind
  behavior: PixGridSequenceBoundaryBehavior
  quantization: PixGridSequenceBoundaryQuantization
  arrivalBar?: number
  arrivalAnchor?: PixGridDeckMusicalArrivalAnchor
}

export interface PixGridSequencePreparedFrameIdentity {
  itemId: string
  frameId: string
}

export interface PixGridSequencePlannerTimeline {
  /** Authoritative transport position used for diagnostics and seek reconstruction. */
  absoluteBar: number
  /** Motion-integrated position. Equal to absoluteBar for direct reconstruction. */
  sequenceBar?: number
  sectionType?: ReactSectionType | null
  sectionId?: string | null
  sectionOccurrence?: number
  sectionBarTimeline?: readonly PixGridSectionBarSpan[]
  /** Authoritative musical beats per bar. Falls back to 4 for legacy projects. */
  beatsPerBar?: number
  sceneId?: string | null
  trackIdentity?: string | null
  presetId?: string | null
  timelineRevision?: string | null
  phraseIndex?: number
  phraseLengthBars?: number
  phraseProgress?: number
}

export interface PixGridSequencePlannerInput {
  deck: PixGridDeckDefinition
  preparedFrames: readonly PixGridSequencePreparedFrameIdentity[]
  timeline: PixGridSequencePlannerTimeline
  boundarySignals?: readonly PixGridSequenceBoundarySignal[]
  /** Auto Performance owns section cadence and pre-drop choreography when enabled. */
  autoPerformanceEnabled?: boolean
  motion?: number
  transportMode?: 'live' | 'reconstruct'
  /** Optional Stage 5 plan lookup. Automatic hard cuts become instantaneous once compiled. */
  transitionModeResolver?: (sourceItemId: string, targetItemId: string) => PixGridDeckConcreteTransitionMode | null
}

export type PixGridSequenceHoldReason = 'preDrop' | 'motionZero' | 'terminal' | 'singleFrame' | null
export type PixGridSequenceEffect = 'none' | 'dim' | 'disperse' | 'previewNext'
export type PixGridSequenceTimingSource = 'itemOverride' | 'sectionOverride' | 'automaticCadence' | 'deckDefault' | 'held'

export interface PixGridSequenceTransitionWindow {
  lifecycle: PixGridTransitionLifecycle
  interruptionPolicy: PixGridTransitionInterruptionPolicy
  permitted: boolean
  active: boolean
  startBar: number | null
  endBar: number | null
  progress: number
  boundaryIdentity: string | null
  quantization: PixGridSequenceBoundaryQuantization | null
  /** Authored pair policy. Never replaced by compiler output. */
  requestedMode: PixGridDeckTransitionMode
  /** Concrete compiler result when already available; null while pending. */
  resolvedMode: PixGridDeckConcreteTransitionMode | null
  durationBeats: number
  durationFraction: number
  pairOverride: boolean
  anchorMode: PixGridDeckTransitionAnchorMode
  arrivalAnchor: PixGridDeckMusicalArrivalAnchor
  arrivalBar: number | null
  queuedBoundaryIdentity: string | null
}

export interface PixGridSequencePlan {
  clockId: typeof PIX_GRID_SEQUENCE_CLOCK_ID
  deckId: string
  presetId: string
  order: PixGridDeckPlaybackOrder
  absoluteBar: number
  sequenceBar: number
  frameEpoch: number
  sequenceCycle: number
  activeItemId: string
  activeFrameId: string
  nextItemId: string
  nextFrameId: string
  sourceItemId: string
  sourceFrameId: string
  targetItemId: string
  targetFrameId: string
  eligibleItemIds: readonly string[]
  eligibleFrameIds: readonly string[]
  boundaryIdentity: string | null
  transitionArmedBy: string | null
  transitionWindow: PixGridSequenceTransitionWindow
  hold: Readonly<{
    active: boolean
    reason: PixGridSequenceHoldReason
    behavior: PixGridDeckPreDropBehavior | null
  }>
  effect: PixGridSequenceEffect
  timingPolicy: Readonly<{
    source: PixGridSequenceTimingSource
    beatsPerBar: number
    itemDurationBeats: number | null
  }>
}

interface ResolvedFrameItem {
  item: PixGridDeckItemDefinition
  frameId: string
}

interface ResolvedSectionSegment {
  id: string
  type: ReactSectionType
  occurrence: number
  startBar: number
  endBar: number
  sceneId: string | null
}

interface TransitionRecord {
  bar: number
  sourceItemId: string
  targetItemId: string
  boundaryIdentity: string
  quantization: PixGridSequenceBoundaryQuantization | null
  completionBar: number | null
  arrivalAnchor: PixGridDeckMusicalArrivalAnchor | null
}

interface PlannerState {
  epoch: number
  itemId: string
  phase: number
  lastTransition: TransitionRecord | null
  latestBoundaryIdentity: string | null
  armedBoundaryIdentity: string | null
  transitionCount: number
  previousDurationBars: number
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : fallback)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function normalizedSectionTimeline(
  targetBar: number,
  timeline: readonly PixGridSectionBarSpan[] | undefined,
  fallbackType: ReactSectionType,
  fallbackId: string,
  fallbackOccurrence: number,
): ResolvedSectionSegment[] {
  const spans = [...(timeline ?? [])]
    .map(span => ({
      id: span.id,
      type: span.type,
      startBar: finiteNonNegative(span.startBar),
      endBar: Math.max(finiteNonNegative(span.startBar), finiteNonNegative(span.endBar)),
      sceneId: typeof span.sceneId === 'string' ? span.sceneId : null,
    }))
    .filter(span => span.endBar > span.startBar + EPSILON)
    .sort((left, right) => left.startBar - right.startBar || left.endBar - right.endBar || left.id.localeCompare(right.id))

  if (spans.length === 0) {
    return [{
      id: fallbackId,
      type: fallbackType,
      occurrence: fallbackOccurrence,
      startBar: 0,
      endBar: Math.max(targetBar + 1, 1),
      sceneId: null,
    }]
  }

  const result: ResolvedSectionSegment[] = []
  const occurrences = new Map<ReactSectionType, number>()
  let cursor = 0
  for (const span of spans) {
    if (span.startBar > cursor + EPSILON) {
      const occurrence = occurrences.get('unknown') ?? 0
      result.push({ id: `unknown-gap:${cursor}`, type: 'unknown', occurrence, startBar: cursor, endBar: span.startBar, sceneId: null })
      occurrences.set('unknown', occurrence + 1)
    }
    const occurrence = occurrences.get(span.type) ?? 0
    result.push({ ...span, occurrence })
    occurrences.set(span.type, occurrence + 1)
    cursor = Math.max(cursor, span.endBar)
  }
  if (cursor < targetBar + EPSILON) {
    const occurrence = occurrences.get('unknown') ?? 0
    result.push({ id: `unknown-tail:${cursor}`, type: 'unknown', occurrence, startBar: cursor, endBar: targetBar + 1, sceneId: null })
  }
  return result
}

function assignmentItemIds(
  deck: PixGridDeckDefinition,
  sectionType: ReactSectionType,
  sceneId: string | null,
): readonly string[] | null {
  const sceneAssignment = sceneId ? (deck.configuration.sceneItemAssignments ?? {})[sceneId] : undefined
  if (sceneAssignment?.length) return sceneAssignment
  const sectionAssignment = deck.configuration.sectionItemAssignments[sectionType]
  return sectionAssignment?.length ? sectionAssignment : null
}

function eligibleItemsFor(
  deck: PixGridDeckDefinition,
  available: readonly ResolvedFrameItem[],
  sectionType: ReactSectionType,
  sceneId: string | null,
): ResolvedFrameItem[] {
  const assignment = assignmentItemIds(deck, sectionType, sceneId)
  if (!assignment) return [...available]
  const byId = new Map(available.map(frame => [frame.item.id, frame] as const))
  const assigned = assignment.flatMap(itemId => {
    const frame = byId.get(itemId)
    return frame ? [frame] : []
  })
  return assigned.length > 0 ? assigned : [...available]
}

function xorshift32(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items]
  const random = xorshift32(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const value = result[index]!
    result[index] = result[swapIndex]!
    result[swapIndex] = value
  }
  return result
}

function pingPongOrder<T>(items: readonly T[]): T[] {
  if (items.length <= 2) return [...items]
  return [...items, ...items.slice(1, -1).reverse()]
}

function orderedItems(
  order: PixGridDeckPlaybackOrder,
  eligible: readonly ResolvedFrameItem[],
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
  epoch: number,
): ResolvedFrameItem[] {
  if (eligible.length <= 1) return [...eligible]
  if (order === 'reverse') return [...eligible].reverse()
  if (order === 'pingPong') return pingPongOrder(eligible)
  if (order === 'shuffle') {
    const cycle = Math.floor(Math.max(0, epoch) / eligible.length)
    const seed = createPerformanceDeterministicSeed(
      PIX_GRID_SEQUENCE_CLOCK_ID,
      deck.id,
      timeline.presetId ?? deck.generatedPresetId,
      timeline.trackIdentity ?? 'no-track',
      timeline.timelineRevision ?? 'no-timeline',
      section.id,
      section.occurrence,
      cycle,
    )
    return shuffled(eligible, seed)
  }
  // sectionAssigned uses the assignment order already projected into eligible.
  return [...eligible]
}

function itemAtEpoch(
  order: PixGridDeckPlaybackOrder,
  eligible: readonly ResolvedFrameItem[],
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
  epoch: number,
): ResolvedFrameItem {
  const ordered = orderedItems(order, eligible, deck, timeline, section, epoch)
  if (deck.configuration.loop === false) return ordered[Math.min(Math.max(0, epoch), ordered.length - 1)]!
  return ordered[((epoch % ordered.length) + ordered.length) % ordered.length]!
}

function nextItem(
  currentItemId: string,
  stateEpoch: number,
  order: PixGridDeckPlaybackOrder,
  eligible: readonly ResolvedFrameItem[],
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
): ResolvedFrameItem {
  if (eligible.length <= 1) return eligible[0]!
  const nextEpoch = stateEpoch + 1
  const ordered = orderedItems(order, eligible, deck, timeline, section, nextEpoch)
  const startIndex = deck.configuration.loop === false
    ? Math.min(nextEpoch, ordered.length - 1)
    : ((nextEpoch % ordered.length) + ordered.length) % ordered.length
  for (let offset = 0; offset < ordered.length; offset += 1) {
    const index = deck.configuration.loop === false
      ? Math.min(startIndex + offset, ordered.length - 1)
      : (startIndex + offset) % ordered.length
    const candidate = ordered[index]!
    if (candidate.item.id !== currentItemId) return candidate
    if (deck.configuration.loop === false && index === ordered.length - 1) break
  }
  return eligible.find(frame => frame.item.id === currentItemId) ?? ordered[startIndex]!
}

function durationBarsFor(
  frame: ResolvedFrameItem,
  deck: PixGridDeckDefinition,
  sectionType: ReactSectionType,
  previousDurationBars: number,
  autoPerformanceEnabled = true,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): number | null {
  if (!autoPerformanceEnabled) {
    if (frame.item.timingOverrideBeats != null) return Math.max(EPSILON, frame.item.timingOverrideBeats / beatsPerBar)
    return Math.max(EPSILON, deck.configuration.defaultItemDurationBeats / beatsPerBar)
  }
  if (sectionType === 'preDrop' && deck.configuration.preDropBehavior !== 'continue') return null
  if (frame.item.timingOverrideBeats != null) {
    return Math.max(EPSILON, frame.item.timingOverrideBeats / beatsPerBar)
  }
  const configured = deck.configuration.sectionTimingBeats[sectionType]
  if (configured != null) return Math.max(EPSILON, configured / beatsPerBar)
  if (sectionType === 'preDrop') return Math.max(EPSILON, previousDurationBars)
  return PIX_GRID_DECK_SECTION_CADENCE_BARS[sectionType]
    ?? Math.max(EPSILON, deck.configuration.defaultItemDurationBeats / beatsPerBar)
}

function effectForPreDrop(behavior: PixGridDeckPreDropBehavior): PixGridSequenceEffect {
  if (behavior === 'dim') return 'dim'
  if (behavior === 'disperse') return 'disperse'
  if (behavior === 'previewNext') return 'previewNext'
  return 'none'
}

function timingSourceFor(
  frame: ResolvedFrameItem,
  deck: PixGridDeckDefinition,
  sectionType: ReactSectionType,
  autoPerformanceEnabled: boolean,
): PixGridSequenceTimingSource {
  if (frame.item.timingOverrideBeats != null) return 'itemOverride'
  if (autoPerformanceEnabled && sectionType === 'preDrop' && deck.configuration.preDropBehavior !== 'continue') return 'held'
  if (autoPerformanceEnabled && deck.configuration.sectionTimingBeats[sectionType] != null) return 'sectionOverride'
  if (autoPerformanceEnabled && PIX_GRID_DECK_SECTION_CADENCE_BARS[sectionType] != null) return 'automaticCadence'
  return 'deckDefault'
}

function quantizeBar(bar: number, quantization: PixGridSequenceBoundaryQuantization, beatsPerBar: number): number {
  const safe = finiteNonNegative(bar)
  if (quantization === 'beat') return Math.round(safe * beatsPerBar) / beatsPerBar
  if (quantization === 'bar') return Math.round(safe)
  if (quantization === 'fourBars') return Math.round(safe / 4) * 4
  return safe
}

function normalizedBoundarySignals(
  signals: readonly PixGridSequenceBoundarySignal[] | undefined,
  targetBar: number,
  beatsPerBar: number,
): PixGridSequenceBoundarySignal[] {
  const grouped = new Map<string, PixGridSequenceBoundarySignal[]>()
  for (const signal of signals ?? []) {
    if (!signal.id.trim()) continue
    const bar = quantizeBar(signal.bar, signal.quantization, beatsPerBar)
    if (bar <= EPSILON || bar > targetBar + EPSILON) continue
    const key = bar.toFixed(8)
    const bucket = grouped.get(key) ?? []
    bucket.push({ ...signal, bar })
    grouped.set(key, bucket)
  }
  return [...grouped.values()]
    .map(bucket => {
      const ordered = [...bucket].sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
      const force = ordered.some(signal => signal.behavior === 'force')
      const quantization = ordered.some(signal => signal.quantization === 'section')
        ? 'section'
        : ordered.some(signal => signal.quantization === 'phrase')
          ? 'phrase'
          : ordered[0]!.quantization
      return {
        id: ordered.map(signal => signal.id).join('+'),
        bar: ordered[0]!.bar,
        kind: ordered[0]!.kind,
        behavior: force ? 'force' : 'arm',
        quantization,
      } satisfies PixGridSequenceBoundarySignal
    })
    .sort((left, right) => left.bar - right.bar || left.id.localeCompare(right.id))
}

function signalMatchesArrivalAnchor(
  signal: PixGridSequenceBoundarySignal,
  anchor: PixGridDeckMusicalArrivalAnchor,
): boolean {
  if (anchor === 'beat') return signal.quantization === 'beat'
  if (anchor === 'bar') return signal.quantization === 'bar' || signal.quantization === 'fourBars'
  if (anchor === 'phrase') return signal.kind === 'phrase'
  if (anchor === 'section') return signal.kind === 'section' || signal.quantization === 'section'
  if (anchor === 'trackMap') return signal.kind === 'trackMap'
  if (anchor === 'dropImpact' || anchor === 'buildCompletion') return signal.id.startsWith('drop-impact:')
  return false
}

function scheduleArrivalSignals(
  signals: readonly PixGridSequenceBoundarySignal[],
  anchor: PixGridDeckMusicalArrivalAnchor,
  leadBars: number,
  targetBar: number,
): PixGridSequenceBoundarySignal[] {
  return signals
    .map(signal => signal.behavior === 'force' && signalMatchesArrivalAnchor(signal, anchor)
      ? {
          ...signal,
          bar: Math.max(0, signal.bar - leadBars),
          arrivalBar: signal.bar,
          arrivalAnchor: anchor,
        }
      : signal)
    .filter(signal => signal.bar <= targetBar + EPSILON)
    .sort((left, right) => left.bar - right.bar || left.id.localeCompare(right.id))
}

function recordTransition(
  state: PlannerState,
  bar: number,
  targetItemId: string,
  boundaryIdentity: string,
  quantization: PixGridSequenceBoundaryQuantization | null,
  completionBar: number | null = null,
  arrivalAnchor: PixGridDeckMusicalArrivalAnchor | null = null,
): void {
  if (targetItemId === state.itemId) return
  const sourceItemId = state.itemId
  state.itemId = targetItemId
  state.epoch += 1
  state.phase = 0
  state.transitionCount += 1
  state.lastTransition = { bar, sourceItemId, targetItemId, boundaryIdentity, quantization, completionBar, arrivalAnchor }
  state.latestBoundaryIdentity = boundaryIdentity
}

function processDuration(
  state: PlannerState,
  fromBar: number,
  toBar: number,
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
  eligible: readonly ResolvedFrameItem[],
  includeEndBoundary = true,
  autoPerformanceEnabled = true,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): void {
  let cursor = fromBar
  while (cursor < toBar - EPSILON && state.transitionCount < MAX_SEQUENCE_TRANSITIONS) {
    const current = eligible.find(frame => frame.item.id === state.itemId) ?? eligible[0]!
    const durationBars = durationBarsFor(current, deck, section.type, state.previousDurationBars, autoPerformanceEnabled, beatsPerBar)
    if (durationBars == null) return
    state.previousDurationBars = durationBars
    const remainingFraction = Math.max(EPSILON, 1 - state.phase)
    const boundaryDistance = remainingFraction * durationBars
    const transitionBar = cursor + boundaryDistance
    if (transitionBar > toBar + EPSILON || (!includeEndBoundary && transitionBar >= toBar - EPSILON)) {
      state.phase = clamp(state.phase + (toBar - cursor) / durationBars, 0, includeEndBoundary ? 1 - EPSILON : 1)
      return
    }
    const target = nextItem(state.itemId, state.epoch, deck.configuration.playbackOrder, eligible, deck, timeline, section)
    if (target.item.id === state.itemId) {
      state.phase = 0
      return
    }
    const armedIdentity = state.armedBoundaryIdentity
    recordTransition(
      state,
      transitionBar,
      target.item.id,
      armedIdentity ?? `cadence:${section.id}:${state.epoch + 1}`,
      armedIdentity ? 'beat' : null,
    )
    state.armedBoundaryIdentity = null
    cursor = transitionBar
  }
}

function applyEligibilityBoundary(
  state: PlannerState,
  bar: number,
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
  eligible: readonly ResolvedFrameItem[],
): void {
  if (eligible.some(frame => frame.item.id === state.itemId)) return
  const target = itemAtEpoch(deck.configuration.playbackOrder, eligible, deck, timeline, section, state.epoch + 1)
  recordTransition(state, bar, target.item.id, `eligibility:${section.id}`, 'section')
}

function applyForcedBoundary(
  state: PlannerState,
  signal: PixGridSequenceBoundarySignal,
  deck: PixGridDeckDefinition,
  timeline: PixGridSequencePlannerTimeline,
  section: ResolvedSectionSegment,
  eligible: readonly ResolvedFrameItem[],
  autoPerformanceEnabled = true,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): void {
  state.latestBoundaryIdentity = signal.id
  if (signal.behavior === 'arm') {
    state.armedBoundaryIdentity = signal.id
    return
  }
  const activeCompletionBar = state.lastTransition
    ? state.lastTransition.completionBar ?? (() => {
        const source = eligible.find(frame => frame.item.id === state.lastTransition!.sourceItemId)
        if (!source) return state.lastTransition!.bar
        const policy = resolvePixGridDeckTransitionPairPolicy(
          deck.configuration.transitionPolicy,
          state.lastTransition!.sourceItemId,
          state.lastTransition!.targetItemId,
        )
        const durationBars = durationBarsFor(
          source, deck, section.type, state.previousDurationBars, autoPerformanceEnabled, beatsPerBar,
        ) ?? 0
        return state.lastTransition!.bar + quantizePixGridDeckTransitionDuration({
          itemDurationBeats: durationBars * beatsPerBar,
          durationFraction: policy.durationFraction,
          beatGridBeats: 0.25,
          mode: policy.mode,
        }) / beatsPerBar
      })()
    : null
  if (activeCompletionBar != null && signal.bar < activeCompletionBar - EPSILON) {
    // Deterministic interruption policy: finish the current arrival-anchored
    // transform, then consume the newest event at the next cadence boundary.
    state.armedBoundaryIdentity = signal.id
    return
  }
  if (autoPerformanceEnabled && section.type === 'preDrop' && deck.configuration.preDropBehavior !== 'continue') {
    state.armedBoundaryIdentity = signal.id
    return
  }
  if (state.lastTransition && Math.abs(state.lastTransition.bar - signal.bar) <= EPSILON) return
  const target = nextItem(state.itemId, state.epoch, deck.configuration.playbackOrder, eligible, deck, timeline, section)
  if (target.item.id === state.itemId) return
  recordTransition(
    state,
    signal.bar,
    target.item.id,
    signal.id,
    signal.quantization,
    signal.arrivalBar ?? null,
    signal.arrivalAnchor ?? null,
  )
  state.armedBoundaryIdentity = null
}

function sectionAt(segments: readonly ResolvedSectionSegment[], bar: number): ResolvedSectionSegment {
  return segments.find(segment => bar >= segment.startBar - EPSILON && bar < segment.endBar - EPSILON)
    ?? segments[segments.length - 1]!
}

export function createPixGridPreparedSequenceFrames(
  deck: PixGridDeckDefinition,
  frameSet: PixGridPreparedFrameSet | null | undefined,
): PixGridSequencePreparedFrameIdentity[] {
  if (!frameSet || frameSet.deckId !== deck.id || frameSet.deckRevision !== deck.revision) return []
  const enabled = deck.items.filter(item => item.enabled).sort((left, right) => left.order - right.order)
  return enabled.flatMap((item, index) => {
    const frame = frameSet.frames[index]
    const frameId = frameSet.frameCacheKeys[index] ?? frame?.cacheKey
    if (!frame || !frameId || frame.cacheKey !== frameId || frame.mediaId !== item.mediaId) return []
    return [{ itemId: item.id, frameId }]
  })
}

export function resolvePixGridSequencePlan(input: PixGridSequencePlannerInput): PixGridSequencePlan | null {
  const frameByItemId = new Map(input.preparedFrames.map(frame => [frame.itemId, frame.frameId] as const))
  const available: ResolvedFrameItem[] = input.deck.items
    .filter(item => item.enabled && frameByItemId.has(item.id))
    .sort((left, right) => left.order - right.order)
    .map(item => ({ item, frameId: frameByItemId.get(item.id)! }))
  if (available.length === 0) return null

  const absoluteBar = finiteNonNegative(input.timeline.absoluteBar)
  const sequenceBar = finiteNonNegative(input.timeline.sequenceBar, absoluteBar)
  const fallbackType = input.timeline.sectionType ?? 'unknown'
  const fallbackId = input.timeline.sectionId ?? `section:${fallbackType}`
  const beatsPerBar = clamp(Math.round(finiteNonNegative(input.timeline.beatsPerBar, DEFAULT_BEATS_PER_BAR)), 1, 32)
  const sections = normalizedSectionTimeline(
    Math.max(sequenceBar, absoluteBar),
    input.timeline.sectionBarTimeline,
    fallbackType,
    fallbackId,
    Math.max(0, Math.floor(input.timeline.sectionOccurrence ?? 0)),
  )
  const firstSection = sectionAt(sections, 0)
  const firstEligible = eligibleItemsFor(input.deck, available, firstSection.type, firstSection.sceneId ?? input.timeline.sceneId ?? null)
  const firstItem = itemAtEpoch(input.deck.configuration.playbackOrder, firstEligible, input.deck, input.timeline, firstSection, 0)
  const initialDuration = durationBarsFor(firstItem, input.deck, firstSection.type, input.deck.configuration.defaultItemDurationBeats / beatsPerBar, input.autoPerformanceEnabled !== false, beatsPerBar)
  const state: PlannerState = {
    epoch: 0,
    itemId: firstItem.item.id,
    phase: 0,
    lastTransition: null,
    latestBoundaryIdentity: null,
    armedBoundaryIdentity: null,
    transitionCount: 0,
    previousDurationBars: initialDuration ?? input.deck.configuration.defaultItemDurationBeats / beatsPerBar,
  }
  const resolvedTransitionPolicy = resolvePixGridDeckTransitionPolicy(input.deck.configuration.transitionPolicy)
  const arrivalLeadBeats = quantizePixGridDeckTransitionDuration({
    itemDurationBeats: input.deck.configuration.defaultItemDurationBeats,
    durationFraction: resolvedTransitionPolicy.durationFraction,
    beatGridBeats: 0.25,
    mode: resolvedTransitionPolicy.mode,
  })
  const arrivalLeadBars = arrivalLeadBeats / beatsPerBar
  const signalHorizon = sequenceBar + (resolvedTransitionPolicy.anchorMode === 'arrival' ? arrivalLeadBars : 0)
  const normalizedSignals = normalizedBoundarySignals(input.boundarySignals, signalHorizon, beatsPerBar)
  const signals = resolvedTransitionPolicy.anchorMode === 'arrival'
    ? scheduleArrivalSignals(normalizedSignals, resolvedTransitionPolicy.arrivalAnchor, arrivalLeadBars, sequenceBar)
    : normalizedSignals
  let signalIndex = 0
  let cursor = 0

  for (const section of sections) {
    if (section.startBar > sequenceBar + EPSILON) break
    const segmentStart = Math.max(cursor, section.startBar)
    const segmentEnd = Math.min(sequenceBar, section.endBar)
    if (segmentEnd < segmentStart - EPSILON) continue
    const eligible = eligibleItemsFor(input.deck, available, section.type, section.sceneId ?? input.timeline.sceneId ?? null)
    applyEligibilityBoundary(state, segmentStart, input.deck, input.timeline, section, eligible)

    const nextSectionStartsHere = sections.some(candidate => candidate.startBar >= section.endBar - EPSILON
      && candidate.startBar <= section.endBar + EPSILON
      && candidate.id !== section.id)
    while (signalIndex < signals.length && signals[signalIndex]!.bar < segmentStart - EPSILON) signalIndex += 1
    let localCursor = segmentStart
    while (signalIndex < signals.length && signals[signalIndex]!.bar <= segmentEnd + EPSILON) {
      const signal = signals[signalIndex]!
      if (nextSectionStartsHere
        && segmentEnd >= section.endBar - EPSILON
        && signal.bar >= section.endBar - EPSILON) break
      processDuration(state, localCursor, signal.bar, input.deck, input.timeline, section, eligible, true, input.autoPerformanceEnabled !== false, beatsPerBar)
      applyForcedBoundary(state, signal, input.deck, input.timeline, section, eligible, input.autoPerformanceEnabled !== false, beatsPerBar)
      localCursor = signal.bar
      signalIndex += 1
    }
    processDuration(
      state,
      localCursor,
      segmentEnd,
      input.deck,
      input.timeline,
      section,
      eligible,
      !(nextSectionStartsHere && segmentEnd >= section.endBar - EPSILON),
      input.autoPerformanceEnabled !== false,
      beatsPerBar,
    )
    cursor = segmentEnd
    if (cursor >= sequenceBar - EPSILON
      && !(nextSectionStartsHere && sequenceBar >= section.endBar - EPSILON)) break
  }

  const currentSection = sectionAt(sections, absoluteBar)
  const eligible = eligibleItemsFor(input.deck, available, currentSection.type, currentSection.sceneId ?? input.timeline.sceneId ?? null)
  applyEligibilityBoundary(state, sequenceBar, input.deck, input.timeline, currentSection, eligible)
  const active = eligible.find(frame => frame.item.id === state.itemId) ?? eligible[0]!
  const next = nextItem(active.item.id, state.epoch, input.deck.configuration.playbackOrder, eligible, input.deck, input.timeline, currentSection)
  const preDropHold = input.autoPerformanceEnabled !== false
    && currentSection.type === 'preDrop'
    && input.deck.configuration.preDropBehavior !== 'continue'
  const motionFrozen = input.transportMode === 'live' && finiteNonNegative(input.motion, 1) <= EPSILON
  const terminal = input.deck.configuration.loop === false && next.item.id === active.item.id
  const singleFrame = eligible.length === 1
  const holdReason: PixGridSequenceHoldReason = preDropHold
    ? 'preDrop'
    : motionFrozen
      ? 'motionZero'
      : terminal
        ? 'terminal'
        : singleFrame
          ? 'singleFrame'
          : null
  const transition = state.lastTransition
  const recordedTransitionSource = transition
    ? available.find(frame => frame.item.id === transition.sourceItemId) ?? active
    : active
  const recordedTransitionTarget = transition
    ? available.find(frame => frame.item.id === transition.targetItemId) ?? active
    : active
  const pairPolicy = resolvePixGridDeckTransitionPairPolicy(
    input.deck.configuration.transitionPolicy,
    recordedTransitionSource.item.id,
    recordedTransitionTarget.item.id,
  )
  const sourceDurationBars = durationBarsFor(
    recordedTransitionSource,
    input.deck,
    currentSection.type,
    state.previousDurationBars,
    input.autoPerformanceEnabled !== false,
    beatsPerBar,
  ) ?? Math.max(EPSILON, input.deck.configuration.defaultItemDurationBeats / beatsPerBar)
  const resolvedMode = input.transitionModeResolver?.(
    recordedTransitionSource.item.id,
    recordedTransitionTarget.item.id,
  ) ?? null
  const transitionDurationBeats = quantizePixGridDeckTransitionDuration({
    itemDurationBeats: sourceDurationBars * beatsPerBar,
    durationFraction: pairPolicy.durationFraction,
    beatGridBeats: 0.25,
    mode: resolvedMode ?? pairPolicy.mode,
  })
  const transitionDurationBars = transition?.completionBar != null
    ? Math.max(0, transition.completionBar - transition.bar)
    : transitionDurationBeats / beatsPerBar
  const transitionActive = Boolean(
    transition
    && !preDropHold
    && transitionDurationBars > EPSILON
    && sequenceBar >= transition.bar - EPSILON
    && sequenceBar < transition.bar + transitionDurationBars - EPSILON,
  )
  const transitionProgress = transitionActive && transition
    ? clamp((sequenceBar - transition.bar) / transitionDurationBars, 0, 1)
    : 1
  const transitionObservable = Boolean(
    transition && (transitionActive || Math.abs(sequenceBar - transition.bar) <= EPSILON),
  )
  const transitionSource = transitionObservable && transition
    ? available.find(frame => frame.item.id === transition.sourceItemId) ?? active
    : active
  let transitionTarget = transitionObservable && transition
    ? available.find(frame => frame.item.id === transition.targetItemId) ?? active
    : active
  if (preDropHold && input.deck.configuration.preDropBehavior === 'previewNext') transitionTarget = next

  const orderLength = orderedItems(
    input.deck.configuration.playbackOrder,
    eligible,
    input.deck,
    input.timeline,
    currentSection,
    state.epoch,
  ).length
  const activeDurationBars = durationBarsFor(
    active, input.deck, currentSection.type, state.previousDurationBars, input.autoPerformanceEnabled !== false, beatsPerBar,
  )
  const lifecycle: PixGridTransitionLifecycle = transitionActive
    ? state.armedBoundaryIdentity
      ? 'interrupted'
      : transitionProgress >= 0.9
        ? 'completing'
        : transitionProgress <= EPSILON
          ? 'preparing'
          : 'active'
    : transition
      ? 'completed'
      : holdReason != null
        ? 'cancelled'
        : 'scheduled'

  return {
    clockId: PIX_GRID_SEQUENCE_CLOCK_ID,
    deckId: input.deck.id,
    presetId: input.timeline.presetId ?? input.deck.generatedPresetId,
    order: input.deck.configuration.playbackOrder,
    absoluteBar,
    sequenceBar,
    frameEpoch: state.epoch,
    sequenceCycle: Math.floor(state.epoch / Math.max(1, orderLength)),
    activeItemId: active.item.id,
    activeFrameId: active.frameId,
    nextItemId: next.item.id,
    nextFrameId: next.frameId,
    sourceItemId: transitionSource.item.id,
    sourceFrameId: transitionSource.frameId,
    targetItemId: transitionTarget.item.id,
    targetFrameId: transitionTarget.frameId,
    eligibleItemIds: eligible.map(frame => frame.item.id),
    eligibleFrameIds: eligible.map(frame => frame.frameId),
    boundaryIdentity: state.latestBoundaryIdentity,
    transitionArmedBy: state.armedBoundaryIdentity,
    transitionWindow: {
      lifecycle,
      interruptionPolicy: state.armedBoundaryIdentity ? 'queueNext' : 'finishCurrent',
      permitted: !preDropHold && !motionFrozen && !terminal && !singleFrame,
      active: transitionActive,
      startBar: transition?.bar ?? null,
      endBar: transition ? transition.bar + transitionDurationBars : null,
      progress: transitionProgress,
      boundaryIdentity: transition?.boundaryIdentity ?? null,
      quantization: transition?.quantization ?? null,
      requestedMode: pairPolicy.mode,
      resolvedMode,
      durationBeats: transitionDurationBars * beatsPerBar,
      durationFraction: pairPolicy.durationFraction,
      pairOverride: pairPolicy.overridden,
      anchorMode: pairPolicy.anchorMode,
      arrivalAnchor: pairPolicy.arrivalAnchor,
      arrivalBar: transition?.completionBar ?? null,
      queuedBoundaryIdentity: state.armedBoundaryIdentity,
    },
    hold: {
      active: holdReason != null,
      reason: holdReason,
      behavior: preDropHold ? input.deck.configuration.preDropBehavior : null,
    },
    effect: input.autoPerformanceEnabled !== false && currentSection.type === 'preDrop'
      ? effectForPreDrop(input.deck.configuration.preDropBehavior)
      : 'none',
    timingPolicy: {
      source: timingSourceFor(active, input.deck, currentSection.type, input.autoPerformanceEnabled !== false),
      beatsPerBar,
      itemDurationBeats: activeDurationBars == null ? null : activeDurationBars * beatsPerBar,
    },
  }
}

function cueQuantization(quantization: PixGridCueQuantization): PixGridSequenceBoundaryQuantization {
  if (quantization === 'fourBars') return 'fourBars'
  if (quantization === 'bar') return 'bar'
  return 'beat'
}

function cueBar(context: SharedPerformanceContext, cue: PixGridActionCue): number {
  const barsPerSecond = context.bpm / (60 * Math.max(1, context.timeSignature))
  const gridOffsetBars = context.absoluteBar - context.audioTimeSec * barsPerSecond
  return cue.timeSec * barsPerSecond + gridOffsetBars
}

export function createPixGridSequenceBoundarySignals(
  context: SharedPerformanceContext,
  cues: readonly PixGridActionCue[],
  options: { includeTrackMapCues?: boolean; includePhrases?: boolean; includeSections?: boolean } = {},
): PixGridSequenceBoundarySignal[] {
  const signals: PixGridSequenceBoundarySignal[] = []
  if (options.includeSections !== false) {
    for (const section of context.sectionBarTimeline) {
      if (section.startBar <= EPSILON) continue
      signals.push({
        id: section.type === 'drop' ? `drop-impact:${section.id}` : `section:${section.id}`,
        bar: section.startBar,
        kind: section.type === 'drop' ? 'audio' : 'section',
        behavior: 'force',
        quantization: 'section',
      })
    }
  }
  if (options.includePhrases !== false && context.phraseLengthBars > EPSILON) {
    const currentStart = context.absoluteBar - context.phraseProgress * context.phraseLengthBars
    const origin = currentStart - Math.max(0, context.phraseIndex) * context.phraseLengthBars
    for (let index = 0; index <= Math.max(0, context.phraseIndex); index += 1) {
      signals.push({
        id: `phrase:${index}`,
        bar: origin + index * context.phraseLengthBars,
        kind: 'phrase',
        behavior: 'force',
        quantization: 'phrase',
      })
    }
  }
  if (options.includeTrackMapCues !== false) {
    for (const cue of cues) {
      if (!cue.enabled) continue
      signals.push({
        id: `track-map:${cue.id}`,
        bar: cueBar(context, cue),
        kind: 'trackMap',
        behavior: 'force',
        quantization: cueQuantization(cue.quantization),
      })
    }
  }
  return signals
}

export function resolvePixGridDeckSequencePosition(
  frame: PixGridAudioFrame,
  context: SharedPerformanceContext,
): Readonly<{ absoluteBar: number; sequenceBar: number; transportMode: 'live' | 'reconstruct' }> {
  const absoluteBar = Number.isFinite(frame.previewElapsedBar)
    ? finiteNonNegative(frame.previewElapsedBar)
    : finiteNonNegative(context.absoluteBar)
  const reconstruct = frame.timingDiscontinuity === true
    || frame.stableInspectionFrame === true
    || frame.transportState === 'stopped'
  if (reconstruct) return { absoluteBar, sequenceBar: absoluteBar, transportMode: 'reconstruct' }
  const sequenceBar = Number.isFinite(frame.previewElapsedBar)
    ? finiteNonNegative(frame.motionClockSectionBar, absoluteBar)
    : finiteNonNegative(frame.motionClockBar, absoluteBar)
  return { absoluteBar, sequenceBar, transportMode: 'live' }
}
