import type { ReactSectionType } from '../ReactTypes'

export const PIX_GRID_DECK_SCHEMA_VERSION = 1 as const
export const PIX_GRID_DECK_MIN_ITEMS = 2
export const PIX_GRID_DECK_MAX_ITEMS = 12
export const PIX_GRID_DECK_NAME_MAX_LENGTH = 80
export const PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX = 'pix-grid-deck:' as const
export const PIX_GRID_DECK_PATTERN_ID = 'mediaDeck' as const
export const PIX_GRID_DECK_FRAME_SOURCE_KIND = 'deck' as const
export const PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID = 'pix-grid-media-deck-performance' as const

export type PixGridDeckPlaybackOrder =
  | 'forward'
  | 'reverse'
  | 'pingPong'
  | 'shuffle'
  | 'sectionAssigned'

export type PixGridDeckTransitionStyle = 'cut' | 'crossfade' | 'pixelDissolve' | 'wipe' | 'blackout'
export type PixGridDeckPreDropBehavior = 'inherit' | 'hold' | 'accelerate' | 'blackout'

export interface PixGridDeckTransitionPolicy {
  style: PixGridDeckTransitionStyle
  durationBeats: number
}

export interface PixGridDeckSourceSnapshot {
  mediaRevision: number
  fingerprint: string
  fileName: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  hasAlpha: boolean
  transparentBackground: string
}

export interface PixGridDeckItemDefinition {
  id: string
  mediaId: string
  enabled: boolean
  order: number
  revision: number
  timingOverrideBeats: number | null
  /** Immutable source identity captured when this Deck item is linked. */
  source: PixGridDeckSourceSnapshot
}

export interface PixGridDeckConfiguration {
  playbackOrder: PixGridDeckPlaybackOrder
  reactionProfileId: string | null
  transitionPolicy: PixGridDeckTransitionPolicy
  defaultItemDurationBeats: number
  sectionTimingBeats: Partial<Record<ReactSectionType, number>>
  sectionItemAssignments: Partial<Record<ReactSectionType, string[]>>
  preDropBehavior: PixGridDeckPreDropBehavior
}

export interface PixGridDeckDefinition {
  schemaVersion: typeof PIX_GRID_DECK_SCHEMA_VERSION
  id: string
  name: string
  revision: number
  generatedPresetId: string
  items: PixGridDeckItemDefinition[]
  configuration: PixGridDeckConfiguration
}

/** Transient creation contract. Drafts may be incomplete and are never persisted. */
export interface PixGridDeckDraft {
  id: string
  name: string
  items: Array<Partial<PixGridDeckItemDefinition> & Pick<PixGridDeckItemDefinition, 'mediaId'>>
  configuration: PixGridDeckConfiguration
}

export interface PixGridDeckItemInput {
  id?: string
  mediaId: string
  enabled?: boolean
  timingOverrideBeats?: number | null
  revision?: number
  source?: Partial<PixGridDeckSourceSnapshot>
}

export interface PixGridDeckCreateInput {
  id?: string
  name: string
  items: PixGridDeckItemInput[]
  configuration?: PixGridDeckConfigurationPatch
}

export type PixGridDeckConfigurationPatch =
  & Partial<Omit<PixGridDeckConfiguration, 'transitionPolicy'>>
  & { transitionPolicy?: Partial<PixGridDeckTransitionPolicy> }

export interface PixGridDeckUpdatePatch {
  name?: string
  items?: PixGridDeckItemDefinition[]
  configuration?: PixGridDeckConfigurationPatch
}

export type PixGridDeckValidationCode =
  | 'invalid-deck'
  | 'unsupported-schema'
  | 'invalid-id'
  | 'invalid-name'
  | 'duplicate-name'
  | 'invalid-item-count'
  | 'duplicate-item-id'
  | 'duplicate-media-id'
  | 'deck-not-found'

export interface PixGridDeckValidationError {
  code: PixGridDeckValidationCode
  message: string
  path?: string
}

export type PixGridDeckMutationResult =
  | { ok: true; deckId: string }
  | { ok: false; error: PixGridDeckValidationError }

export interface PixGridDeckNormalizationIssue extends PixGridDeckValidationError {
  severity: 'repaired' | 'rejected'
}

export interface PixGridDeckNormalizationResult {
  deck: PixGridDeckDefinition | null
  issues: PixGridDeckNormalizationIssue[]
}

export interface PixGridDeckCollectionNormalizationResult {
  decks: PixGridDeckDefinition[]
  rejected: Array<{
    index: number
    id: string | null
    issues: PixGridDeckNormalizationIssue[]
  }>
}

const SECTION_TYPES = new Set<ReactSectionType>([
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
])
const PLAYBACK_ORDERS = new Set<PixGridDeckPlaybackOrder>([
  'forward', 'reverse', 'pingPong', 'shuffle', 'sectionAssigned',
])
const TRANSITION_STYLES = new Set<PixGridDeckTransitionStyle>([
  'cut', 'crossfade', 'pixelDissolve', 'wipe', 'blackout',
])
const PRE_DROP_BEHAVIORS = new Set<PixGridDeckPreDropBehavior>([
  'inherit', 'hold', 'accelerate', 'blackout',
])
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const MAX_REVISION = 2_147_483_647
const MIN_DURATION_BEATS = 0.25
const MAX_DURATION_BEATS = 1024

export const DEFAULT_PIX_GRID_DECK_CONFIGURATION: Readonly<PixGridDeckConfiguration> = Object.freeze({
  playbackOrder: 'forward',
  reactionProfileId: null,
  transitionPolicy: Object.freeze({ style: 'cut', durationBeats: 0 }),
  defaultItemDurationBeats: 4,
  sectionTimingBeats: Object.freeze({}),
  sectionItemAssignments: Object.freeze({}),
  preDropBehavior: 'inherit',
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  return Number.isFinite(candidate) ? candidate : fallback
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)))
}

function normalizeRevision(value: unknown): number {
  return Math.round(clamp(value, 1, MAX_REVISION, 1))
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return SAFE_ID.test(trimmed) ? trimmed : null
}

function normalizeNullableIdentifier(value: unknown): string | null {
  if (value == null || value === '') return null
  return normalizeIdentifier(value)
}

export function normalizePixGridDeckName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, PIX_GRID_DECK_NAME_MAX_LENGTH)
}

export function pixGridDeckNameKey(value: unknown): string {
  return normalizePixGridDeckName(value).toLocaleLowerCase('en-US')
}

export function generatedPixGridDeckPresetId(deckId: string): string {
  return `${PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX}${deckId}`
}

function secureUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  throw new Error('Secure UUID generation is unavailable in this runtime.')
}

export function createPixGridDeckId(): string {
  return secureUuid()
}

export function createPixGridDeckItemId(): string {
  return secureUuid()
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function recoveredItemId(deckId: string, mediaId: string, index: number): string {
  return `deck-item:${fnv1a(`${deckId}\u0000${mediaId}\u0000${index}`)}`
}

function normalizeSourceSnapshot(value: unknown, mediaId: string, itemRevision: number): PixGridDeckSourceSnapshot {
  const source = isRecord(value) ? value : {}
  const width = finiteNumber(source.width, Number.NaN)
  const height = finiteNumber(source.height, Number.NaN)
  const rawFingerprint = typeof source.fingerprint === 'string' ? source.fingerprint.trim() : ''
  const fingerprint = /^sha256:[0-9a-f]{64}$/i.test(rawFingerprint)
    ? rawFingerprint.toLowerCase()
    : /^legacy:[A-Za-z0-9._:-]{1,128}$/.test(rawFingerprint)
      ? rawFingerprint
      : `legacy:${fnv1a(`${mediaId}\u0000${itemRevision}`)}`
  const transparentBackground = typeof source.transparentBackground === 'string'
    && /^#[0-9a-f]{6}$/i.test(source.transparentBackground.trim())
      ? source.transparentBackground.trim().toUpperCase()
      : '#000000'
  return {
    mediaRevision: normalizeRevision(source.mediaRevision ?? source.revision ?? itemRevision),
    fingerprint,
    fileName: typeof source.fileName === 'string' && source.fileName.trim() ? source.fileName.trim().slice(0, 255) : null,
    mimeType: typeof source.mimeType === 'string' && source.mimeType.trim() ? source.mimeType.trim().toLowerCase().slice(0, 120) : null,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    hasAlpha: source.hasAlpha === true,
    transparentBackground,
  }
}

function rejectedIssue(
  code: PixGridDeckValidationCode,
  message: string,
  path?: string,
): PixGridDeckNormalizationIssue {
  return { code, message, path, severity: 'rejected' }
}

function repairedIssue(
  code: PixGridDeckValidationCode,
  message: string,
  path?: string,
): PixGridDeckNormalizationIssue {
  return { code, message, path, severity: 'repaired' }
}

function normalizeSectionTiming(value: unknown): Partial<Record<ReactSectionType, number>> {
  if (!isRecord(value)) return {}
  const normalized: Partial<Record<ReactSectionType, number>> = {}
  for (const [sectionType, rawDuration] of Object.entries(value)) {
    if (!SECTION_TYPES.has(sectionType as ReactSectionType)) continue
    const duration = finiteNumber(rawDuration, Number.NaN)
    if (!Number.isFinite(duration) || duration <= 0) continue
    normalized[sectionType as ReactSectionType] = clamp(duration, MIN_DURATION_BEATS, MAX_DURATION_BEATS, 4)
  }
  return normalized
}

function normalizeSectionAssignments(
  value: unknown,
  itemIds: ReadonlySet<string>,
): Partial<Record<ReactSectionType, string[]>> {
  if (!isRecord(value)) return {}
  const normalized: Partial<Record<ReactSectionType, string[]>> = {}
  for (const [sectionType, rawItemIds] of Object.entries(value)) {
    if (!SECTION_TYPES.has(sectionType as ReactSectionType) || !Array.isArray(rawItemIds)) continue
    const seen = new Set<string>()
    const assignment = rawItemIds.flatMap(rawItemId => {
      const itemId = normalizeIdentifier(rawItemId)
      if (!itemId || !itemIds.has(itemId) || seen.has(itemId)) return []
      seen.add(itemId)
      return [itemId]
    })
    if (assignment.length > 0) normalized[sectionType as ReactSectionType] = assignment
  }
  return normalized
}

export function normalizePixGridDeckConfiguration(
  value: unknown,
  itemIds: ReadonlySet<string> = new Set(),
): PixGridDeckConfiguration {
  const source = isRecord(value) ? value : {}
  const rawTransition = isRecord(source.transitionPolicy) ? source.transitionPolicy : {}
  const style = TRANSITION_STYLES.has(rawTransition.style as PixGridDeckTransitionStyle)
    ? rawTransition.style as PixGridDeckTransitionStyle
    : DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy.style
  const durationBeats = style === 'cut'
    ? 0
    : clamp(rawTransition.durationBeats, MIN_DURATION_BEATS, 32, 0.5)
  return {
    playbackOrder: PLAYBACK_ORDERS.has(source.playbackOrder as PixGridDeckPlaybackOrder)
      ? source.playbackOrder as PixGridDeckPlaybackOrder
      : DEFAULT_PIX_GRID_DECK_CONFIGURATION.playbackOrder,
    reactionProfileId: normalizeNullableIdentifier(source.reactionProfileId),
    transitionPolicy: { style, durationBeats },
    defaultItemDurationBeats: clamp(
      source.defaultItemDurationBeats,
      MIN_DURATION_BEATS,
      MAX_DURATION_BEATS,
      DEFAULT_PIX_GRID_DECK_CONFIGURATION.defaultItemDurationBeats,
    ),
    sectionTimingBeats: normalizeSectionTiming(source.sectionTimingBeats),
    sectionItemAssignments: normalizeSectionAssignments(source.sectionItemAssignments, itemIds),
    preDropBehavior: PRE_DROP_BEHAVIORS.has(source.preDropBehavior as PixGridDeckPreDropBehavior)
      ? source.preDropBehavior as PixGridDeckPreDropBehavior
      : DEFAULT_PIX_GRID_DECK_CONFIGURATION.preDropBehavior,
  }
}

function normalizeDeckItems(
  rawItems: unknown[],
  deckId: string,
  issues: PixGridDeckNormalizationIssue[],
): PixGridDeckItemDefinition[] | null {
  const sortable = rawItems.flatMap((rawItem, sourceIndex) => {
    if (!isRecord(rawItem)) {
      issues.push(repairedIssue('invalid-deck', 'Removed a non-object Deck item.', `items.${sourceIndex}`))
      return []
    }
    const mediaId = normalizeIdentifier(rawItem.mediaId ?? rawItem.imageId)
    if (!mediaId) {
      issues.push(repairedIssue('invalid-deck', 'Removed a Deck item without a valid media ID.', `items.${sourceIndex}.mediaId`))
      return []
    }
    const explicitId = normalizeIdentifier(rawItem.id)
    const id = explicitId ?? recoveredItemId(deckId, mediaId, sourceIndex)
    if (!explicitId) {
      issues.push(repairedIssue('invalid-deck', 'Recovered a stable Deck item ID.', `items.${sourceIndex}.id`))
    }
    const rawOrder = finiteNumber(rawItem.order, sourceIndex)
    const revision = normalizeRevision(rawItem.revision)
    return [{
      sourceIndex,
      rawOrder,
      item: {
        id,
        mediaId,
        enabled: typeof rawItem.enabled === 'boolean' ? rawItem.enabled : true,
        order: 0,
        revision,
        timingOverrideBeats: rawItem.timingOverrideBeats == null && rawItem.durationBeats == null
          ? null
          : clamp(
              rawItem.timingOverrideBeats ?? rawItem.durationBeats,
              MIN_DURATION_BEATS,
              MAX_DURATION_BEATS,
              4,
            ),
        source: normalizeSourceSnapshot(rawItem.source ?? rawItem.sourceSnapshot, mediaId, revision),
      } satisfies PixGridDeckItemDefinition,
    }]
  })

  if (sortable.length < PIX_GRID_DECK_MIN_ITEMS || sortable.length > PIX_GRID_DECK_MAX_ITEMS) {
    issues.push(rejectedIssue(
      'invalid-item-count',
      `A committed PixGrid Deck requires ${PIX_GRID_DECK_MIN_ITEMS}–${PIX_GRID_DECK_MAX_ITEMS} items.`,
      'items',
    ))
    return null
  }

  const itemIds = new Set<string>()
  const mediaIds = new Set<string>()
  for (const { item } of sortable) {
    if (itemIds.has(item.id)) {
      issues.push(rejectedIssue('duplicate-item-id', `Duplicate Deck item ID: ${item.id}`, 'items'))
      return null
    }
    if (mediaIds.has(item.mediaId)) {
      issues.push(rejectedIssue('duplicate-media-id', `Duplicate Deck media ID: ${item.mediaId}`, 'items'))
      return null
    }
    itemIds.add(item.id)
    mediaIds.add(item.mediaId)
  }

  sortable.sort((left, right) => left.rawOrder - right.rawOrder || left.sourceIndex - right.sourceIndex)
  return sortable.map(({ item }, order) => ({ ...item, order }))
}

export function normalizePixGridDeckDefinition(value: unknown): PixGridDeckNormalizationResult {
  const issues: PixGridDeckNormalizationIssue[] = []
  if (!isRecord(value)) {
    return { deck: null, issues: [rejectedIssue('invalid-deck', 'Deck definition must be an object.')] }
  }

  const schemaVersion = value.schemaVersion ?? PIX_GRID_DECK_SCHEMA_VERSION
  if (schemaVersion !== PIX_GRID_DECK_SCHEMA_VERSION) {
    return {
      deck: null,
      issues: [rejectedIssue('unsupported-schema', `Unsupported PixGrid Deck schema version: ${String(schemaVersion)}`, 'schemaVersion')],
    }
  }

  const id = normalizeIdentifier(value.id ?? value.deckId)
  if (!id) {
    return { deck: null, issues: [rejectedIssue('invalid-id', 'Deck ID is missing or invalid.', 'id')] }
  }

  const name = normalizePixGridDeckName(value.name ?? value.title)
  if (!name) {
    return { deck: null, issues: [rejectedIssue('invalid-name', 'Deck name is required.', 'name')] }
  }
  if (typeof (value.name ?? value.title) === 'string' && name !== (value.name ?? value.title)) {
    issues.push(repairedIssue('invalid-name', 'Deck name was trimmed and normalized.', 'name'))
  }

  const rawItems = Array.isArray(value.items)
    ? value.items
    : (Array.isArray(value.images) ? value.images : null)
  if (!rawItems) {
    return { deck: null, issues: [rejectedIssue('invalid-item-count', 'Deck items are missing.', 'items')] }
  }
  const items = normalizeDeckItems(rawItems, id, issues)
  if (!items) return { deck: null, issues }

  const itemIds = new Set(items.map(item => item.id))
  const rawConfiguration = value.configuration ?? value.config ?? value
  const deck: PixGridDeckDefinition = {
    schemaVersion: PIX_GRID_DECK_SCHEMA_VERSION,
    id,
    name,
    revision: normalizeRevision(value.revision),
    generatedPresetId: generatedPixGridDeckPresetId(id),
    items,
    configuration: normalizePixGridDeckConfiguration(rawConfiguration, itemIds),
  }
  return { deck, issues }
}

export function normalizePixGridDeckCollectionDetailed(
  value: unknown,
): PixGridDeckCollectionNormalizationResult {
  if (!Array.isArray(value)) return { decks: [], rejected: [] }
  const decks: PixGridDeckDefinition[] = []
  const rejected: PixGridDeckCollectionNormalizationResult['rejected'] = []
  const ids = new Set<string>()
  const names = new Set<string>()

  value.forEach((rawDeck, index) => {
    const result = normalizePixGridDeckDefinition(rawDeck)
    if (!result.deck) {
      rejected.push({
        index,
        id: isRecord(rawDeck) ? normalizeIdentifier(rawDeck.id ?? rawDeck.deckId) : null,
        issues: result.issues,
      })
      return
    }
    const nameKey = pixGridDeckNameKey(result.deck.name)
    if (ids.has(result.deck.id)) {
      rejected.push({
        index,
        id: result.deck.id,
        issues: [rejectedIssue('invalid-id', `Duplicate Deck ID: ${result.deck.id}`, 'id')],
      })
      return
    }
    if (names.has(nameKey)) {
      rejected.push({
        index,
        id: result.deck.id,
        issues: [rejectedIssue('duplicate-name', `Duplicate Deck name: ${result.deck.name}`, 'name')],
      })
      return
    }
    ids.add(result.deck.id)
    names.add(nameKey)
    decks.push(result.deck)
  })

  return { decks, rejected }
}

export function normalizePixGridDeckCollection(value: unknown): PixGridDeckDefinition[] {
  return normalizePixGridDeckCollectionDetailed(value).decks
}

export function pixGridDeckCollectionsEqual(
  left: readonly PixGridDeckDefinition[],
  right: readonly PixGridDeckDefinition[],
): boolean {
  return JSON.stringify(normalizePixGridDeckCollection(left))
    === JSON.stringify(normalizePixGridDeckCollection(right))
}

export function findPixGridDeckNameConflict(
  decks: readonly PixGridDeckDefinition[],
  name: unknown,
  exceptDeckId?: string,
): PixGridDeckDefinition | null {
  const key = pixGridDeckNameKey(name)
  if (!key) return null
  return decks.find(deck => deck.id !== exceptDeckId && pixGridDeckNameKey(deck.name) === key) ?? null
}

export function createPixGridDeckDefinition(
  input: PixGridDeckCreateInput,
): PixGridDeckNormalizationResult {
  const id = input.id ?? createPixGridDeckId()
  return normalizePixGridDeckDefinition({
    schemaVersion: PIX_GRID_DECK_SCHEMA_VERSION,
    id,
    name: input.name,
    revision: 1,
    generatedPresetId: generatedPixGridDeckPresetId(id),
    items: input.items.map((item, order) => ({
      ...item,
      id: item.id ?? createPixGridDeckItemId(),
      order,
      revision: item.revision ?? 1,
    })),
    configuration: {
      ...DEFAULT_PIX_GRID_DECK_CONFIGURATION,
      ...input.configuration,
      transitionPolicy: {
        ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy,
        ...input.configuration?.transitionPolicy,
      },
    },
  })
}

export function createPixGridDeckDraft(name = ''): PixGridDeckDraft {
  return {
    id: createPixGridDeckId(),
    name: normalizePixGridDeckName(name),
    items: [],
    configuration: normalizePixGridDeckConfiguration(DEFAULT_PIX_GRID_DECK_CONFIGURATION),
  }
}
