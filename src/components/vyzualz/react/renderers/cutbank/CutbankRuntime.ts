import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasMediaItem } from '../../ReactTypes'
import type { CanvasMediaPool } from '../../canvasPerformance/CanvasPerformanceTypes'
import { resolveAutoCutbankLayout } from './CutbankAutoLayout'
import {
  cutRateToIntervalBeats, holdSliderToBeats, resolveCutbankClock, resolveCutbankEnergy, snapHoldBeats,
  type CutbankClock, type CutbankEnergyState,
} from './CutbankClock'
import { resolveCutbankContent, type CutbankContentItem, type CutbankContentSnapshot, type CutbankContentStatus } from './CutbankContent'
import {
  buildCutbankComposition, cutbankElementBudget, type CutbankComposition, type CutbankLayoutId, type CutbankPickWant,
} from './CutbankLayouts'
import { resolveCutbankPalette, type CutbankPalettePlan } from './CutbankPalette'
import { clamp, cutbankSeed, cutbankUnit, lerp } from './CutbankRandom'
import { pickCutbankItem, type CutbankSelectionIdentity } from './CutbankSelection'
import type { CanvasCutbankSettings } from './CutbankSettings'
import {
  cutbankTransitionDurationSec, evaluateCutbankTransition, resolveCutbankTransitionStyle, startCutbankTransition,
  type CutbankActiveTransition, type CutbankTransitionFrame,
} from './CutbankTransitions'
import {
  EMPTY_CUTBANK_IMPULSES, resolveCutbankMotion, resolveCutbankTreatment,
  type CutbankImpulses, type CutbankMotionPlan, type CutbankTreatmentPlan,
} from './CutbankTreatment'

export interface CutbankRuntimeInput {
  settings: CanvasCutbankSettings
  pool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
  context: SharedPerformanceContext
  /** Fresh transport time (seconds). Defaults to the context's audio time. */
  transportTimeSec?: number
  dtSec: number
  trackIdentity: string | null
  poolRevision: number
  /** Renderer-side decode readiness. Omitted means "assume ready" (tests). */
  isMediaReady?: (mediaId: string) => boolean
  failedMediaIds?: ReadonlySet<string>
  /** Wall-clock ms, only used to bound how long a cut may wait for media to decode. */
  nowMs?: number
}

export interface CutbankFramePlan {
  status: { kind: CutbankContentStatus; modeFallback: boolean; message: string | null }
  clock: CutbankClock
  energy: CutbankEnergyState
  sequenceIndex: number
  current: CutbankComposition | null
  outgoing: CutbankComposition | null
  transition: CutbankTransitionFrame | null
  treatment: CutbankTreatmentPlan
  motion: CutbankMotionPlan
  palette: CutbankPalettePlan
  impulses: CutbankImpulses
  /** Content keyed by `CutbankElement.itemKey`, for current + outgoing compositions. */
  items: ReadonlyMap<string, CutbankContentItem>
  /** Bounded set of media ids worth having decoded: current, outgoing, and the next cut. */
  preloadMediaIds: readonly string[]
  heldBeats: number
  holdBeats: number
  cutThisFrame: boolean
}

interface ActiveComposition {
  composition: CutbankComposition
  index: number
  startBeat: number
  startTimeSec: number
  holdBeats: number
  designKey: string
}

const MAX_DEFER_MS = 1500
const SMALL_POOL_PRELOAD = 6

const STATUS_MESSAGE: Record<CutbankContentStatus, string | null> = {
  ready: null,
  'no-pool': 'CUTBANK needs a Media Pool. Choose one in Design → Media Pool.',
  'empty-pool': 'This Media Pool is empty. Add media or text to it from the Media Library.',
  'no-available-content': 'None of this Pool\'s media is available right now.',
}

function holdBounds(settings: CanvasCutbankSettings): { min: number; max: number } {
  let min = holdSliderToBeats(settings.minimumHold)
  let max = Math.max(min, holdSliderToBeats(settings.maximumHold))
  if (settings.bpmSync) {
    min = snapHoldBeats(min)
    max = Math.max(min, snapHoldBeats(max))
  }
  return { min, max }
}

/**
 * How long the next composition holds, in beats. Cut Rate sets the cadence,
 * Auto Performance stretches it in quiet passages and compresses it on a drop,
 * Chaos jitters it — and Minimum/Maximum Hold always clamp the result.
 */
export function resolveCutbankHoldBeats(settings: CanvasCutbankSettings, energy: CutbankEnergyState, sequenceIndex: number): number {
  const { min, max } = holdBounds(settings)
  const interval = cutRateToIntervalBeats(settings.cutRate)
  const factor = settings.autoPerformance ? lerp(2, 0.5, energy.level) * (energy.drop ? 0.6 : 1) : 1
  const jitter = 1 + (cutbankUnit('hold-jitter', sequenceIndex) * 2 - 1) * settings.chaos * 0.5
  let hold = clamp(interval * factor * jitter, min, max)
  if (settings.bpmSync) hold = clamp(snapHoldBeats(hold), min, max)
  return hold
}

function poolContentKey(pool: CanvasMediaPool): string {
  return `${pool.name}|${pool.mediaIds.join(',')}|${pool.textItems.map(t => `${t.id}=${t.text}`).join('|')}`
}

const IMPULSE_TAU = { kick: 0.12, snare: 0.1, hat: 0.06, downbeat: 0.22, bass: 0.18, high: 0.08, transient: 0.08 } as const

/**
 * Deterministic CUTBANK director. It owns *no timers, listeners, or resources*:
 * callers feed it the shared performance context each frame and read back a
 * plan. All selection is a pure function of (track, pool, revision, sequence
 * index), so seeks/loops/restarts reconstruct the same compositions.
 */
export class CutbankRuntime {
  private active: ActiveComposition | null = null
  private outgoingComposition: CutbankComposition | null = null
  private transition: CutbankActiveTransition | null = null
  private pending: { active: ActiveComposition; sinceMs: number } | null = null
  private sequenceIndex = 0
  private identityKey = ''
  private lastBeatInt = Number.NaN
  private lastBar = Number.NaN
  private lastBeat = Number.NaN
  private lastContext: SharedPerformanceContext | null = null
  private lastLayout: CutbankLayoutId | null = null
  private impulses: CutbankImpulses = { ...EMPTY_CUTBANK_IMPULSES }
  private contentCache: {
    pool: CanvasMediaPool | null
    poolContentKey: string
    mediaItems: readonly CanvasMediaItem[]
    failed: ReadonlySet<string> | undefined
    mode: CanvasCutbankSettings['mediaMode']
    snapshot: CutbankContentSnapshot
  } | null = null
  private preloadCache: { key: string; ids: string[] } | null = null
  private itemMap = new Map<string, CutbankContentItem>()
  private itemMapSignature = ''

  reset(): void {
    this.active = null
    this.outgoingComposition = null
    this.transition = null
    this.pending = null
    this.identityKey = ''
    this.lastBeatInt = Number.NaN
    this.lastBar = Number.NaN
    this.lastBeat = Number.NaN
    this.lastContext = null
    this.lastLayout = null
    this.impulses = { ...EMPTY_CUTBANK_IMPULSES }
    this.contentCache = null
    this.preloadCache = null
    this.itemMap.clear()
    this.itemMapSignature = ''
  }

  private resolveContent(input: CutbankRuntimeInput): CutbankContentSnapshot {
    // Identity-keyed so a large media library is never re-scanned per frame.
    const cache = this.contentCache
    if (
      cache
      && cache.pool === input.pool
      && cache.poolContentKey === (input.pool ? poolContentKey(input.pool) : '')
      && cache.mediaItems === input.mediaItems
      && cache.failed === input.failedMediaIds
      && cache.mode === input.settings.mediaMode
    ) return cache.snapshot
    const snapshot = resolveCutbankContent({
      pool: input.pool,
      mediaItems: input.mediaItems,
      mode: input.settings.mediaMode,
      failedMediaIds: input.failedMediaIds,
    })
    this.contentCache = {
      pool: input.pool,
      poolContentKey: input.pool ? poolContentKey(input.pool) : '',
      mediaItems: input.mediaItems,
      failed: input.failedMediaIds,
      mode: input.settings.mediaMode,
      snapshot,
    }
    return snapshot
  }

  private makeComposition(
    index: number,
    content: CutbankContentSnapshot,
    settings: CanvasCutbankSettings,
    energy: CutbankEnergyState,
    identity: CutbankSelectionIdentity,
  ): CutbankComposition {
    const items = content.eligible
    const seed = cutbankSeed(identity.trackIdentity ?? 'unloaded', identity.poolId ?? 'none', identity.poolRevision, 'composition', index)
    const requested = settings.layoutMode
    const layout: CutbankLayoutId = requested === 'auto'
      ? resolveAutoCutbankLayout({
        energy,
        freedom: settings.compositionFreedom,
        complexity: settings.layoutComplexity,
        layerCount: settings.layerCount,
        items,
        unit: cutbankUnit('layout', seed),
        previous: this.lastLayout,
      })
      : requested
    const pick = (slot: number, want: CutbankPickWant): CutbankContentItem | null => {
      const filtered = want === 'any' ? items
        : want === 'text' ? items.filter(item => item.kind === 'text')
          : want === 'svg' ? items.filter(item => item.kind === 'svg')
            : items.filter(item => item.kind !== 'text')
      return pickCutbankItem({ items: filtered, mode: settings.selectionMode, identity, sequenceIndex: index, slot })
    }
    const composition = buildCutbankComposition({
      layout,
      requestedLayout: requested,
      seed,
      freedom: settings.compositionFreedom,
      complexity: settings.layoutComplexity,
      layerCount: settings.layerCount,
      pick,
    })
    return composition
  }

  private designKey(settings: CanvasCutbankSettings, content: CutbankContentSnapshot): string {
    return [
      settings.layoutMode, settings.mediaMode, settings.selectionMode, settings.layerCount,
      settings.layoutComplexity.toFixed(2), settings.compositionFreedom.toFixed(2), content.signature,
    ].join('|')
  }

  update(input: CutbankRuntimeInput): CutbankFramePlan {
    const { settings, context } = input
    const transportTimeSec = input.transportTimeSec ?? context.audioTimeSec
    const clock = resolveCutbankClock(context, { bpmSync: settings.bpmSync, transportTimeSec })
    const energy = resolveCutbankEnergy(context, settings.autoPerformance)
    const content = this.resolveContent(input)
    const identity: CutbankSelectionIdentity = {
      trackIdentity: input.trackIdentity,
      poolId: content.poolId,
      poolRevision: input.poolRevision,
    }
    const identityKey = `${identity.trackIdentity}|${identity.poolId}|${identity.poolRevision}`

    this.updateImpulses(context, clock, input.dtSec)
    const palette = resolveCutbankPalette(settings, clock, cutbankSeed(identity.trackIdentity ?? 'unloaded', 'palette'))

    if (content.eligible.length === 0) {
      this.active = null
      this.outgoingComposition = null
      this.transition = null
      this.pending = null
      this.identityKey = identityKey
      this.lastBeatInt = Math.floor(clock.beat)
      this.lastBar = clock.bar
      this.lastBeat = clock.beat
      this.lastContext = context
      return {
        status: { kind: content.status, modeFallback: false, message: STATUS_MESSAGE[content.status] },
        clock, energy, sequenceIndex: this.sequenceIndex, current: null, outgoing: null, transition: null,
        treatment: resolveCutbankTreatment({ settings, energy, impulses: this.impulses, transition: null, seed: 0, epoch: 0, clock }),
        motion: resolveCutbankMotion({ settings, energy, impulses: this.impulses, clock, transition: null }),
        palette, impulses: this.impulses, items: this.itemMap, preloadMediaIds: [], heldBeats: 0, holdBeats: 0, cutThisFrame: false,
      }
    }

    if (this.itemMapSignature !== content.signature) {
      this.itemMap = new Map(content.all.map(item => [item.key, item]))
      this.itemMapSignature = content.signature
    }

    const beatInt = Math.floor(clock.beat)
    const discontinuity = !this.active
      || this.identityKey !== identityKey
      || context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected
      || context.boundaries.timingDiscontinuity
      || !Number.isFinite(this.lastBeat)
      || Math.abs(clock.beat - this.lastBeat) > 8
    const newBeat = !discontinuity && beatInt !== this.lastBeatInt
    const newBar = !discontinuity && clock.bar !== this.lastBar
    let cutThisFrame = false

    if (discontinuity) {
      this.identityKey = identityKey
      this.transition = null
      this.outgoingComposition = null
      this.pending = null
      // Re-anchor on the musical position so the same seek target rebuilds the same composition.
      this.sequenceIndex = Math.max(0, clock.bar) * 4
      this.lastLayout = null
      this.active = this.buildActive(this.sequenceIndex, content, settings, energy, identity, clock)
      cutThisFrame = true
    } else if (this.active) {
      const active = this.active
      const key = this.designKey(settings, content)
      if (active.designKey !== key) {
        // Design controls / pool edits changed: rebuild the same sequence step in place (no transition).
        active.composition = this.makeComposition(active.index, content, settings, energy, identity)
        active.designKey = key
      }
      const { min, max } = holdBounds(settings)
      const held = clock.beat - active.startBeat
      const holdNow = clamp(active.holdBeats, min, max)
      const due = held >= holdNow
      const overdue = held >= max
      const canonicalBoundary = settings.bpmSync ? (holdNow >= 2 ? newBar : newBeat) : true
      const interrupt = newBeat && held >= min && settings.chaos > 0
        && cutbankUnit('interrupt', active.index, beatInt) < settings.chaos * 0.2 * (energy.level + 0.3)
      if (!this.pending && ((due && canonicalBoundary) || (overdue && (newBeat || !settings.bpmSync)) || interrupt)) {
        const nextIndex = this.sequenceIndex + 1
        this.pending = { active: this.buildActive(nextIndex, content, settings, energy, identity, clock), sinceMs: input.nowMs ?? 0 }
      }
      if (this.pending) {
        const ready = this.mediaReady(this.pending.active.composition, input)
        const waited = (input.nowMs ?? 0) - this.pending.sinceMs
        if (ready || waited >= MAX_DEFER_MS) {
          const next = this.pending.active
          this.pending = null
          this.sequenceIndex = next.index
          next.startBeat = clock.beat
          next.startTimeSec = clock.timeSec
          this.beginTransition(active, next, settings, energy, context, clock)
          this.active = next
          cutThisFrame = true
        }
      }
    }

    if (this.active) this.lastLayout = this.active.composition.layout
    this.lastBeatInt = beatInt
    this.lastBar = clock.bar
    this.lastBeat = clock.beat
    this.lastContext = context

    let transitionFrame: CutbankTransitionFrame | null = null
    if (this.transition) {
      transitionFrame = evaluateCutbankTransition(this.transition, clock.timeSec, clamp(settings.transitionIntensity, 0, 1))
      if (transitionFrame.complete) {
        this.transition = null
        this.outgoingComposition = null
        transitionFrame = null
      }
    }

    const active = this.active!
    const epoch = active.index * 8 + Math.floor(clock.beat / Math.max(1, Math.round(lerp(16, 2, settings.chaos))))
    const treatment = resolveCutbankTreatment({
      settings, energy, impulses: this.impulses, transition: transitionFrame, seed: active.composition.seed, epoch, clock,
    })
    const motion = resolveCutbankMotion({ settings, energy, impulses: this.impulses, clock, transition: transitionFrame })

    return {
      status: { kind: 'ready', modeFallback: content.modeFallback, message: content.modeFallback ? `No ${settings.mediaMode} entries in this Pool — using all Pool content.` : null },
      clock, energy, sequenceIndex: this.sequenceIndex,
      current: active.composition,
      outgoing: transitionFrame ? this.outgoingComposition : null,
      transition: transitionFrame,
      treatment, motion, palette, impulses: this.impulses,
      items: this.itemMap,
      preloadMediaIds: this.collectPreload(content, settings, identity, active, this.outgoingComposition),
      heldBeats: clock.beat - active.startBeat,
      holdBeats: active.holdBeats,
      cutThisFrame,
    }
  }

  private buildActive(
    index: number,
    content: CutbankContentSnapshot,
    settings: CanvasCutbankSettings,
    energy: CutbankEnergyState,
    identity: CutbankSelectionIdentity,
    clock: CutbankClock,
  ): ActiveComposition {
    return {
      composition: this.makeComposition(index, content, settings, energy, identity),
      index,
      startBeat: clock.beat,
      startTimeSec: clock.timeSec,
      holdBeats: resolveCutbankHoldBeats(settings, energy, index),
      designKey: this.designKey(settings, content),
    }
  }

  private mediaReady(composition: CutbankComposition, input: CutbankRuntimeInput): boolean {
    if (!input.isMediaReady) return true
    for (const el of composition.elements) {
      const item = this.itemMap.get(el.itemKey)
      if (item?.mediaId && !input.isMediaReady(item.mediaId)) return false
    }
    return true
  }

  private beginTransition(
    from: ActiveComposition,
    to: ActiveComposition,
    settings: CanvasCutbankSettings,
    energy: CutbankEnergyState,
    context: SharedPerformanceContext,
    clock: CutbankClock,
  ): void {
    const style = resolveCutbankTransitionStyle({
      settings, energy, seed: to.composition.seed, styleSeed: `${context.sectionIdentity}|${context.macroSectionIdentity}`,
    })
    const durationSec = cutbankTransitionDurationSec(settings, context, clock.canonical)
    const started = startCutbankTransition({
      style,
      context: { ...context, audioTimeSec: clock.timeSec },
      durationSec,
      fromIdentity: `cutbank:${from.index}`,
      toIdentity: `cutbank:${to.index}`,
      flashAmount: settings.flashAmount,
    })
    this.transition = started
    this.outgoingComposition = started ? from.composition : null
  }

  private collectPreload(
    content: CutbankContentSnapshot,
    settings: CanvasCutbankSettings,
    identity: CutbankSelectionIdentity,
    active: ActiveComposition,
    outgoing: CutbankComposition | null,
  ): string[] {
    const cacheKey = `${content.signature}|${active.index}|${active.designKey}|${outgoing?.seed ?? '-'}|${this.pending?.active.index ?? '-'}|${settings.selectionMode}|${settings.layerCount}|${settings.layoutComplexity}`
    if (this.preloadCache?.key === cacheKey) return this.preloadCache.ids
    const ids = new Set<string>()
    const add = (composition: CutbankComposition | null) => {
      for (const el of composition?.elements ?? []) {
        const mediaId = this.itemMap.get(el.itemKey)?.mediaId
        if (mediaId) ids.add(mediaId)
      }
    }
    add(active.composition)
    add(outgoing)
    if (this.pending) add(this.pending.active.composition)
    const eligibleMedia = content.eligible.filter(item => item.mediaId)
    if (eligibleMedia.length <= SMALL_POOL_PRELOAD) {
      for (const item of eligibleMedia) ids.add(item.mediaId!)
    } else {
      // Large pools: only the next step's picks, never the whole library.
      const slots = cutbankElementBudget(settings.layoutComplexity, settings.layerCount)
      for (let slot = 0; slot < Math.min(4, slots + 1); slot += 1) {
        const item = pickCutbankItem({ items: eligibleMedia, mode: settings.selectionMode, identity, sequenceIndex: active.index + 1, slot })
        if (item?.mediaId) ids.add(item.mediaId)
      }
    }
    const result = [...ids]
    this.preloadCache = { key: cacheKey, ids: result }
    return result
  }

  private updateImpulses(context: SharedPerformanceContext, clock: CutbankClock, dtSec: number): void {
    const dt = clamp(dtSec, 0, 0.25)
    const decay = (value: number, tau: number) => value * Math.exp(-dt / tau)
    const i = this.impulses
    i.kick = decay(i.kick, IMPULSE_TAU.kick)
    i.snare = decay(i.snare, IMPULSE_TAU.snare)
    i.hat = decay(i.hat, IMPULSE_TAU.hat)
    i.downbeat = decay(i.downbeat, IMPULSE_TAU.downbeat)
    i.bass = decay(i.bass, IMPULSE_TAU.bass)
    i.high = decay(i.high, IMPULSE_TAU.high)
    i.transient = decay(i.transient, IMPULSE_TAU.transient)
    // Continuous bands follow the shared context every frame; discrete hits only when the context is new.
    i.bass = Math.max(i.bass, clamp(context.bass, 0, 1))
    i.high = Math.max(i.high, clamp(context.high, 0, 1) * 0.9)
    if (context !== this.lastContext) {
      if (context.kick) i.kick = Math.max(i.kick, clamp(context.kickStrength || 1, 0, 1))
      if (context.snare) i.snare = Math.max(i.snare, clamp(context.snareStrength || 1, 0, 1))
      if (context.hat) i.hat = Math.max(i.hat, clamp(context.hatStrength || 1, 0, 1))
      i.transient = Math.max(i.transient, clamp(context.transient, 0, 1))
    }
    if (Number.isFinite(this.lastBeat)) {
      if (Math.floor(clock.beat) !== this.lastBeatInt) i.kick = Math.max(i.kick, 0.5)
      if (clock.bar !== this.lastBar) i.downbeat = 1
    }
  }
}
