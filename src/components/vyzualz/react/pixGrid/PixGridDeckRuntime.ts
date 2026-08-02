import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION,
  type PixGridDeckConcreteTransitionMode,
  type PixGridDeckGeneratedMaskName,
  type PixGridDeckTransitionPlan,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameSet,
} from './PixGridDeckCompilerContracts'
import { createPixGridDeckItemCompilerCacheKey } from './PixGridDeckCompilerCore'
import type { PixGridDeckDefinition, PixGridDeckItemDefinition } from './PixGridDeckDomain'
import { createPixGridDeckTransitionCacheKey } from './PixGridDeckTransitionPlanner'
import type { PixGridSequencePlan } from './PixGridSequenceClock'
import type { PixGridGroup } from './PixGridTypes'

export type PixGridDeckRuntimeStatus =
  | 'ready'
  | 'ready-fallback'
  | 'missing-deck'
  | 'not-ready'
  | 'revision-mismatch'
  | 'resolution-mismatch'
  | 'sequence-mismatch'
  | 'missing-frame'

export interface PixGridDeckRuntimeFrameSource {
  kind: 'deck'
  deckId: string
  deckRevision: number
  width: number
  height: number
  sourceItemId: string
  targetItemId: string
  sourceFrame: PixGridPreparedFrame
  targetFrame: PixGridPreparedFrame
  transitionPlan: PixGridDeckTransitionPlan | null
  transitionMode: PixGridDeckConcreteTransitionMode
  transitionProgress: number
  transitionActive: boolean
  boundaryIdentity: string | null
  frameEpoch: number
  identity: string
  fallbackReason: string | null
}

export interface PixGridDeckRuntimeResolution {
  status: PixGridDeckRuntimeStatus
  source: PixGridDeckRuntimeFrameSource | null
  diagnostic: string | null
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function frameForKey(frameSet: PixGridPreparedFrameSet, cacheKey: string): PixGridPreparedFrame | null {
  const index = frameSet.frameCacheKeys.indexOf(cacheKey)
  const frame = index >= 0 ? frameSet.frames[index] : frameSet.frames.find(candidate => candidate.cacheKey === cacheKey)
  return frame?.cacheKey === cacheKey ? frame : null
}

function validFrame(
  frame: PixGridPreparedFrame,
  item: PixGridDeckItemDefinition,
  width: number,
  height: number,
): boolean {
  const cellCount = width * height
  return frame.schemaVersion === PIX_GRID_DECK_COMPILER_SCHEMA_VERSION
    && frame.cacheKey === createPixGridDeckItemCompilerCacheKey(item, width, height)
    && frame.mediaId === item.mediaId
    && frame.sourceFingerprint === item.source.fingerprint
    && frame.sourceRevision === item.source.mediaRevision
    && frame.width === width
    && frame.height === height
    && frame.pixels.length === cellCount * 4
    && PIX_GRID_DECK_GENERATED_MASK_NAMES.every(name => frame.masks[name].length === cellCount)
}

const validatedTransitionPlans = new WeakMap<PixGridDeckTransitionPlan, string>()

function validTransitionPlan(
  plan: PixGridDeckTransitionPlan,
  source: PixGridPreparedFrame,
  target: PixGridPreparedFrame,
  sequencePlan: PixGridSequencePlan,
): boolean {
  const validationIdentity = [
    source.cacheKey,
    target.cacheKey,
    `${source.width}x${source.height}`,
    sequencePlan.sourceItemId,
    sequencePlan.targetItemId,
    sequencePlan.transitionWindow.mode,
    sequencePlan.transitionWindow.durationFraction,
  ].join(':')
  if (validatedTransitionPlans.get(plan) === validationIdentity) return true
  if (
    plan.schemaVersion !== PIX_GRID_DECK_COMPILER_SCHEMA_VERSION
    || plan.algorithmVersion !== PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION
    || plan.width !== source.width
    || plan.height !== source.height
    || plan.sourceFrameCacheKey !== source.cacheKey
    || plan.targetFrameCacheKey !== target.cacheKey
    || plan.requestedMode !== sequencePlan.transitionWindow.mode
    || (sequencePlan.transitionWindow.mode !== 'auto' && plan.mode !== sequencePlan.transitionWindow.mode)
    || plan.cacheKey !== createPixGridDeckTransitionCacheKey({
      sourceFrameCacheKey: source.cacheKey,
      targetFrameCacheKey: target.cacheKey,
      settings: {
        requestedMode: plan.requestedMode,
        sourceItemId: sequencePlan.sourceItemId,
        targetItemId: sequencePlan.targetItemId,
        durationFraction: sequencePlan.transitionWindow.durationFraction,
      },
    })
  ) return false
  if (plan.mode !== 'pixelTransport') {
    validatedTransitionPlans.set(plan, validationIdentity)
    return true
  }
  const cellCount = plan.width * plan.height
  if (plan.matchedSourceIndices.length !== plan.matchedTargetIndices.length) return false
  const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < cellCount
  for (const indices of [plan.matchedSourceIndices, plan.matchedTargetIndices, plan.deathSourceIndices, plan.birthTargetIndices]) {
    for (let index = 0; index < indices.length; index += 1) {
      if (!validIndex(indices[index]!)) return false
    }
  }
  validatedTransitionPlans.set(plan, validationIdentity)
  return true
}

function fallbackTransitionMode(plan: PixGridSequencePlan): PixGridDeckConcreteTransitionMode {
  const requested = plan.transitionWindow.mode
  if (requested === 'pixelTransport') return 'pixelDissolve'
  if (requested === 'auto') return 'hardCut'
  return requested
}

export function resolvePixGridDeckRuntimeFrameSource(input: {
  deck: PixGridDeckDefinition | null | undefined
  preparedFrameSet: PixGridPreparedFrameSet | null | undefined
  sequencePlan: PixGridSequencePlan | null | undefined
  transitionPlan: PixGridDeckTransitionPlan | null | undefined
  width: number
  height: number
}): PixGridDeckRuntimeResolution {
  const deck = input.deck
  if (!deck) return { status: 'missing-deck', source: null, diagnostic: 'No Deck owns the active PixGrid preset.' }
  const frameSet = input.preparedFrameSet
  if (!frameSet) return { status: 'not-ready', source: null, diagnostic: 'The active Deck has no complete prepared frame set.' }
  if (frameSet.schemaVersion !== PIX_GRID_DECK_COMPILER_SCHEMA_VERSION) {
    return { status: 'revision-mismatch', source: null, diagnostic: 'The prepared frame set schema is not compatible with the runtime.' }
  }
  if (frameSet.deckId !== deck.id || frameSet.deckRevision !== deck.revision) {
    return { status: 'revision-mismatch', source: null, diagnostic: 'The prepared frame set does not match the active Deck revision.' }
  }
  const width = Math.max(1, Math.floor(input.width))
  const height = Math.max(1, Math.floor(input.height))
  if (frameSet.width !== width || frameSet.height !== height) {
    return { status: 'resolution-mismatch', source: null, diagnostic: 'The prepared Deck resolution does not match the active PixGrid matrix.' }
  }
  const sequencePlan = input.sequencePlan
  if (!sequencePlan || sequencePlan.deckId !== deck.id || sequencePlan.presetId !== deck.generatedPresetId) {
    return { status: 'sequence-mismatch', source: null, diagnostic: 'The Deck sequence clock result does not match the active Deck and preset.' }
  }
  const sourceFrame = frameForKey(frameSet, sequencePlan.sourceFrameId)
  const targetFrame = frameForKey(frameSet, sequencePlan.targetFrameId)
  const sourceItem = deck.items.find(item => item.id === sequencePlan.sourceItemId)
  const targetItem = deck.items.find(item => item.id === sequencePlan.targetItemId)
  if (
    !sourceFrame
    || !targetFrame
    || !sourceItem
    || !targetItem
    || !validFrame(sourceFrame, sourceItem, width, height)
    || !validFrame(targetFrame, targetItem, width, height)
  ) return { status: 'missing-frame', source: null, diagnostic: 'The sequence clock selected a missing or stale prepared Deck frame.' }

  const requestedPlan = input.transitionPlan ?? null
  const transitionPlan = requestedPlan && validTransitionPlan(requestedPlan, sourceFrame, targetFrame, sequencePlan)
    ? requestedPlan
    : null
  const transitionNeedsPairPlan = sourceFrame.cacheKey !== targetFrame.cacheKey
    && sequencePlan.transitionWindow.active
  const fallbackReason = transitionNeedsPairPlan && !transitionPlan
    ? requestedPlan
      ? 'invalid-transition-plan'
      : 'missing-transition-plan'
    : null
  const transitionMode = transitionPlan?.mode ?? fallbackTransitionMode(sequencePlan)
  const transitionProgress = sourceFrame.cacheKey === targetFrame.cacheKey
    ? 1
    : clamp01(sequencePlan.transitionWindow.progress)
  const status: PixGridDeckRuntimeStatus = fallbackReason ? 'ready-fallback' : 'ready'
  return {
    status,
    diagnostic: fallbackReason === 'invalid-transition-plan'
      ? 'The precompiled Deck transition plan was stale or invalid; a deterministic fallback is active.'
      : fallbackReason === 'missing-transition-plan'
        ? 'The Deck transition plan is not ready; a deterministic fallback is active.'
        : null,
    source: {
      kind: 'deck',
      deckId: deck.id,
      deckRevision: deck.revision,
      width,
      height,
      sourceItemId: sequencePlan.sourceItemId,
      targetItemId: sequencePlan.targetItemId,
      sourceFrame,
      targetFrame,
      transitionPlan,
      transitionMode,
      transitionProgress,
      transitionActive: sourceFrame.cacheKey !== targetFrame.cacheKey && transitionProgress < 1,
      boundaryIdentity: sequencePlan.transitionWindow.boundaryIdentity,
      frameEpoch: sequencePlan.frameEpoch,
      identity: [
        deck.id,
        deck.revision,
        width,
        height,
        sourceFrame.cacheKey,
        targetFrame.cacheKey,
        transitionMode,
        sequencePlan.frameEpoch,
        sequencePlan.transitionWindow.boundaryIdentity ?? 'none',
      ].join(':'),
      fallbackReason,
    },
  }
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function pixGridDeckGeneratedGroupId(
  deckId: string,
  layerId: string,
  maskName: PixGridDeckGeneratedMaskName,
): string {
  return `pix-grid-deck-group:${shortHash(deckId)}:${shortHash(layerId)}:${maskName}`
}

const MASK_DISPLAY: Readonly<Record<PixGridDeckGeneratedMaskName, Readonly<{ name: string; source: PixGridGroup['source']; color: string }>>> = {
  foreground: { name: 'Deck Foreground', source: 'foregroundBackground', color: '#f8fafc' },
  background: { name: 'Deck Background', source: 'foregroundBackground', color: '#334155' },
  border: { name: 'Deck Border', source: 'border', color: '#22d3ee' },
  highlights: { name: 'Deck Highlights', source: 'luminanceRange', color: '#fef08a' },
  shadows: { name: 'Deck Shadows', source: 'luminanceRange', color: '#818cf8' },
  center: { name: 'Deck Center', source: 'center', color: '#34d399' },
}

const generatedGroupCache = new Map<string, readonly PixGridGroup[]>()
const MAX_GENERATED_GROUP_CACHE_ENTRIES = 128

export function createPixGridDeckGeneratedGroups(deckId: string, layerId: string): readonly PixGridGroup[] {
  const cacheKey = `${deckId.length}:${deckId}${layerId.length}:${layerId}`
  const cached = generatedGroupCache.get(cacheKey)
  if (cached) return cached
  const groups: readonly PixGridGroup[] = Object.freeze(PIX_GRID_DECK_GENERATED_MASK_NAMES.map((maskName, index) => {
    const display = MASK_DISPLAY[maskName]
    return {
      id: pixGridDeckGeneratedGroupId(deckId, layerId, maskName),
      name: display.name,
      source: display.source,
      mask: { kind: 'runs' as const, runs: [] },
      cellRuns: [],
      layerId,
      layerScope: [layerId],
      smartRuleId: `deck:${deckId}:${maskName}`,
      enabled: true,
      visible: true,
      contentVisible: true,
      priority: index,
      overlapBehavior: 'stack' as const,
      reactions: [],
      displayColor: display.color,
    }
  }))
  generatedGroupCache.set(cacheKey, groups)
  if (generatedGroupCache.size > MAX_GENERATED_GROUP_CACHE_ENTRIES) {
    generatedGroupCache.delete(generatedGroupCache.keys().next().value as string)
  }
  return groups
}
