import {
  PIX_GRID_DECK_MIN_ITEMS,
  PIX_GRID_DECK_SECTION_TYPES,
  type PixGridDeckConfigurationPatch,
  type PixGridDeckDefinition,
  type PixGridDeckMusicalArrivalAnchor,
  type PixGridDeckPlaybackOrder,
  type PixGridDeckPreDropBehavior,
  type PixGridDeckReactionProfileId,
  type PixGridDeckTransitionAnchorMode,
  type PixGridDeckTransitionMode,
  type PixGridDeckTransitionPairOverride,
  type PixGridDeckUpdatePatch,
} from './PixGridDeckDomain'
import type { PixGridDeckPresetReadiness } from './PixGridDeckPreset'

/**
 * The PixGrid Deck popover's view model. The popover is a controlled component: it never sees a `PixGridDeckDefinition`. Preset Manager adapts
 * the real Deck to this shape (`toPopoverDeck`) and turns the popover's settings edits back into a Deck update (`popoverSettingsToUpdate`);
 * the Layout Lab study feeds it local fixtures instead.
 */
export type PopoverSectionType = typeof PIX_GRID_DECK_SECTION_TYPES[number]

/** The value every override control uses for "inherit / use the default". */
export const POPOVER_INHERIT = 'default'

export interface PopoverItem {
  id: string
  name: string
  enabled: boolean
  /** Beats; null follows the Deck default. */
  duration: number | null
  revision: number
}

export interface PopoverPair { mode: string; motion: string; length: number | null }
export interface PopoverSection { beats: number | null; item: string; motion: string }

export interface PopoverDeck {
  name: string
  items: PopoverItem[]
  playback: PixGridDeckPlaybackOrder
  defaultDuration: number
  loop: boolean
  reaction: PixGridDeckReactionProfileId
  motion: string
  transitionMode: PixGridDeckTransitionMode
  transitionLength: number
  anchorMode: PixGridDeckTransitionAnchorMode
  arrivalAnchor: PixGridDeckMusicalArrivalAnchor
  /** Keyed by `popoverPairKey(sourceItemId, targetItemId)`; only pairs with at least one override are present. */
  pairs: Record<string, PopoverPair>
  preDrop: PixGridDeckPreDropBehavior
  sections: Record<PopoverSectionType, PopoverSection>
}

/** Everything the Playback, Transitions and Sections screens can change. Images and the name have their own callbacks. */
export type PopoverSettingsPatch = Partial<Omit<PopoverDeck, 'name' | 'items'>>

export interface PopoverUpload {
  active: boolean
  phase: string
  error: string | null
  warnings: readonly string[]
}

export interface PopoverReadiness {
  level: 'invalid' | 'preparing' | 'ready' | 'error'
  frameProgress: number
  transitionProgress: number
  message: string
  errors: readonly string[]
}

export interface PopoverShip {
  busy: boolean
  message: string | null
  error: string | null
  onExport: () => void
}

export const popoverPairKey = (sourceItemId: string, targetItemId: string) => `${sourceItemId}:${targetItemId}`

export function emptyPopoverSections(): Record<PopoverSectionType, PopoverSection> {
  return Object.fromEntries(
    PIX_GRID_DECK_SECTION_TYPES.map(type => [type, { beats: null, item: '', motion: POPOVER_INHERIT }]),
  ) as Record<PopoverSectionType, PopoverSection>
}

export const sceneMotionKey = (deckId: string, type: PopoverSectionType) => `pix-grid-deck-scene:${deckId}:${type}`

/** The directed pairs a Deck can override: each enabled image to the next, and the last back to the first when it loops. */
export function popoverTransitionPairs(deck: Pick<PopoverDeck, 'items' | 'loop'>): Array<{ key: string; from: number; to: number; source: PopoverItem; target: PopoverItem }> {
  const enabled = deck.items.filter(item => item.enabled)
  return enabled.flatMap((source, index) => {
    const target = enabled[index + 1] ?? (deck.loop ? enabled[0] : null)
    return target && target.id !== source.id
      ? [{ key: popoverPairKey(source.id, target.id), from: index + 1, to: enabled.indexOf(target) + 1, source, target }]
      : []
  })
}

/** The open Deck as the popover shows it. Items are in Deck order and named after their source file. */
export function toPopoverDeck(deck: PixGridDeckDefinition, draftName: string): PopoverDeck {
  const configuration = deck.configuration
  const policy = configuration.transitionPolicy
  const items = [...deck.items].sort((left, right) => left.order - right.order).map((item, index): PopoverItem => ({
    id: item.id,
    name: item.source.fileName ?? `Image ${index + 1}`,
    enabled: item.enabled,
    duration: item.timingOverrideBeats,
    revision: item.revision,
  }))
  const sections = emptyPopoverSections()
  for (const type of PIX_GRID_DECK_SECTION_TYPES) {
    sections[type] = {
      beats: configuration.sectionTimingBeats[type] ?? null,
      item: configuration.sectionItemAssignments[type]?.[0] ?? '',
      motion: configuration.sceneMotionProfileIds?.[sceneMotionKey(deck.id, type)] ?? POPOVER_INHERIT,
    }
  }
  const pairs: Record<string, PopoverPair> = {}
  for (const override of policy.pairOverrides ?? []) {
    pairs[popoverPairKey(override.sourceItemId, override.targetItemId)] = {
      mode: override.mode,
      motion: override.motionProfileId ?? POPOVER_INHERIT,
      length: override.durationFraction ?? null,
    }
  }
  return {
    name: draftName,
    items,
    playback: configuration.playbackOrder,
    defaultDuration: configuration.defaultItemDurationBeats,
    loop: configuration.loop,
    reaction: configuration.reactionProfileId,
    motion: configuration.motionProfileId ?? 'balanced',
    transitionMode: policy.mode ?? 'auto',
    transitionLength: policy.durationFraction ?? 0.25,
    anchorMode: policy.anchorMode ?? 'onset',
    arrivalAnchor: policy.arrivalAnchor ?? 'dropImpact',
    pairs,
    preDrop: configuration.preDropBehavior,
    sections,
  }
}

/** A popover with no Deck behind it yet (the "New Deck" state before the first upload creates one). */
export function newPopoverDeck(name: string): PopoverDeck {
  return {
    name, items: [], playback: 'forward', defaultDuration: 4, loop: true, reaction: 'balanced', motion: 'balanced',
    transitionMode: 'auto', transitionLength: 0.25, anchorMode: 'onset', arrivalAnchor: 'dropImpact',
    pairs: {}, preDrop: 'hold', sections: emptyPopoverSections(),
  }
}

/** The Deck update for one settings edit from the popover, in the same shapes the Deck Builder inspector writes. */
export function popoverSettingsToUpdate(deck: PixGridDeckDefinition, patch: PopoverSettingsPatch): PixGridDeckUpdatePatch {
  const configuration: PixGridDeckConfigurationPatch = {}
  const transitionPolicy: NonNullable<PixGridDeckConfigurationPatch['transitionPolicy']> = {}

  if (patch.playback !== undefined) configuration.playbackOrder = patch.playback
  if (patch.defaultDuration !== undefined) configuration.defaultItemDurationBeats = patch.defaultDuration
  if (patch.loop !== undefined) configuration.loop = patch.loop
  if (patch.reaction !== undefined) configuration.reactionProfileId = patch.reaction
  if (patch.motion !== undefined) configuration.motionProfileId = patch.motion
  if (patch.preDrop !== undefined) configuration.preDropBehavior = patch.preDrop
  if (patch.transitionMode !== undefined) transitionPolicy.mode = patch.transitionMode
  if (patch.transitionLength !== undefined) transitionPolicy.durationFraction = patch.transitionLength
  if (patch.anchorMode !== undefined) transitionPolicy.anchorMode = patch.anchorMode
  if (patch.arrivalAnchor !== undefined) transitionPolicy.arrivalAnchor = patch.arrivalAnchor

  if (patch.pairs !== undefined) {
    const current = deck.configuration.transitionPolicy
    const defaultMode = patch.transitionMode ?? current.mode ?? 'auto'
    const enabled = [...deck.items].sort((left, right) => left.order - right.order).filter(item => item.enabled)
    const lookup = new Map<string, { sourceItemId: string; targetItemId: string }>()
    for (const source of enabled) for (const target of enabled) {
      if (source.id !== target.id) lookup.set(popoverPairKey(source.id, target.id), { sourceItemId: source.id, targetItemId: target.id })
    }
    // Overrides for pairs the popover cannot show (an image switched off, say) are not its to change.
    const untouched = (current.pairOverrides ?? []).filter(override => !lookup.has(popoverPairKey(override.sourceItemId, override.targetItemId)))
    const edited = Object.entries(patch.pairs).flatMap(([key, entry]): PixGridDeckTransitionPairOverride[] => {
      const ids = lookup.get(key)
      if (!ids || (entry.mode === POPOVER_INHERIT && entry.motion === POPOVER_INHERIT && entry.length == null)) return []
      return [{
        ...ids,
        mode: (entry.mode === POPOVER_INHERIT ? defaultMode : entry.mode) as PixGridDeckTransitionMode,
        ...(entry.length == null ? {} : { durationFraction: entry.length }),
        ...(entry.motion === POPOVER_INHERIT ? {} : { motionProfileId: entry.motion }),
      }]
    })
    transitionPolicy.pairOverrides = [...untouched, ...edited]
  }

  if (patch.sections !== undefined) {
    const timing = { ...deck.configuration.sectionTimingBeats }
    const assignments = { ...deck.configuration.sectionItemAssignments }
    const scenes = { ...(deck.configuration.sceneMotionProfileIds ?? {}) }
    for (const type of PIX_GRID_DECK_SECTION_TYPES) {
      const section = patch.sections[type]
      if (!section) continue
      if (section.beats == null) delete timing[type]
      else timing[type] = section.beats
      if (!section.item) delete assignments[type]
      else assignments[type] = [section.item]
      const sceneId = sceneMotionKey(deck.id, type)
      if (section.motion === POPOVER_INHERIT) delete scenes[sceneId]
      else scenes[sceneId] = section.motion
    }
    configuration.sectionTimingBeats = timing
    configuration.sectionItemAssignments = assignments
    configuration.sceneMotionProfileIds = scenes
  }

  if (Object.keys(transitionPolicy).length > 0) configuration.transitionPolicy = transitionPolicy
  return { configuration }
}

/** What the Review screen's Compile Readiness card shows for the real compiler's status. */
export function toPopoverReadiness(readiness: PixGridDeckPresetReadiness | null, enabledItemCount: number): PopoverReadiness {
  if (enabledItemCount < PIX_GRID_DECK_MIN_ITEMS) {
    return { level: 'invalid', frameProgress: 0, transitionProgress: 0, message: 'Enable at least two images.', errors: [] }
  }
  if (!readiness) {
    return { level: 'preparing', frameProgress: 0, transitionProgress: 0, message: 'Compiler status is not available yet.', errors: [] }
  }
  const errors = readiness.errors ?? []
  const level = readiness.errorCount > 0 ? 'error' : readiness.ready ? 'ready' : 'preparing'
  return { level, frameProgress: readiness.frameProgress, transitionProgress: readiness.transitionProgress, message: readiness.message, errors }
}
