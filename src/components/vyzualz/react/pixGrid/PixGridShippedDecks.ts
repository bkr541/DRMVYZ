import { MAX_PIX_GRID_SEQUENCE_OCCURRENCES } from './PixGridLimits'
import type { PixGridDeckSourceSnapshot } from './PixGridDeckDomain'
import type { PixGridSequenceDefinition } from './PixGridSequenceDefinition'

/**
 * PixGrid Decks that ship with the app. A shipped Deck is a built-in image-sequence preset: its images are bundled files (`public/pixgrid-decks/<slug>/`),
 * not Media Library items, so it works for every user with no upload. It runs through the same compiler, transitions and clock as a user's Deck.
 * Manifests are written by the Deck Builder's "Export for shipping…" (development builds) into `./shippedDecks/<slug>.json`.
 */
export const PIX_GRID_SHIPPED_DECK_SCHEMA_VERSION = 1 as const
export const PIX_GRID_SHIPPED_DECK_PATH_PREFIX = 'pixgrid-decks/' as const
export const PIX_GRID_SHIPPED_PRESET_ID_PREFIX = 'pix-grid-shipped-' as const
export const PIX_GRID_SHIPPED_DECK_MAX_IMAGE_SIDE = 512

const SHIPPED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/
const FINGERPRINT = /^sha256:[0-9a-f]{64}$/

export interface PixGridShippedDeckSource {
  id: string
  /** Relative to the app base URL, always `pixgrid-decks/<slug>/<file>`. */
  path: string
  mimeType: string
  fileName: string
  width: number | null
  height: number | null
  hasAlpha: boolean
  fingerprint: string
}

export interface PixGridShippedDeckManifest {
  schemaVersion: typeof PIX_GRID_SHIPPED_DECK_SCHEMA_VERSION
  slug: string
  name: string
  description?: string
  /** Bump when the images or settings change, so compiled frames and thumbnails refresh. */
  revision: number
  sources: PixGridShippedDeckSource[]
  items: Array<{ id: string; sourceId: string; enabled?: boolean; durationBeats?: number | null }>
  configuration: Pick<PixGridSequenceDefinition,
    'playbackOrder' | 'loop' | 'defaultItemDurationBeats' | 'sectionTimingBeats' | 'sectionItemAssignments' | 'transitionPolicy'
    | 'reactionProfileId' | 'preDropBehavior' | 'motionProfileId' | 'sceneMotionProfileIds'>
}

export function pixGridShippedPresetId(slug: string): string {
  return `${PIX_GRID_SHIPPED_PRESET_ID_PREFIX}${slug}`
}

export function pixGridShippedSequenceId(slug: string): string {
  return `shipped-${slug}`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Structural check for a manifest read from disk. Returns the first problem in plain words. */
export function validatePixGridShippedDeckManifest(value: unknown): { ok: true; manifest: PixGridShippedDeckManifest } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'The manifest is not an object.' }
  if (value.schemaVersion !== PIX_GRID_SHIPPED_DECK_SCHEMA_VERSION) return { ok: false, error: `Unsupported schema version ${String(value.schemaVersion)}.` }
  const { slug, name, revision, sources, items, configuration } = value
  if (typeof slug !== 'string' || !SLUG.test(slug)) return { ok: false, error: 'The slug must be lowercase letters, digits and hyphens.' }
  if (typeof name !== 'string' || !name.trim() || name.length > 80) return { ok: false, error: 'The name is required and at most 80 characters.' }
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) return { ok: false, error: 'The revision must be a whole number from 1.' }
  if (!Array.isArray(sources) || !Array.isArray(items) || !isRecord(configuration)) return { ok: false, error: 'Sources, items and configuration are required.' }
  if (items.length < 2 || items.length > MAX_PIX_GRID_SEQUENCE_OCCURRENCES) return { ok: false, error: `A Deck needs 2 to ${MAX_PIX_GRID_SEQUENCE_OCCURRENCES} images.` }
  const sourceIds = new Set<string>()
  for (const source of sources) {
    if (!isRecord(source) || typeof source.id !== 'string' || sourceIds.has(source.id)) return { ok: false, error: 'Every source needs a unique id.' }
    sourceIds.add(source.id)
    const path = source.path
    if (typeof path !== 'string' || !path.startsWith(`${PIX_GRID_SHIPPED_DECK_PATH_PREFIX}${slug}/`) || path.includes('..') || !/^[\w./-]+$/.test(path)) {
      return { ok: false, error: `Source "${source.id}" must be a file under ${PIX_GRID_SHIPPED_DECK_PATH_PREFIX}${slug}/.` }
    }
    if (typeof source.mimeType !== 'string' || !SHIPPED_MIME_TYPES.has(source.mimeType)) return { ok: false, error: `Source "${source.id}" has an unsupported type.` }
    if (typeof source.fingerprint !== 'string' || !FINGERPRINT.test(source.fingerprint)) return { ok: false, error: `Source "${source.id}" needs a sha256 fingerprint.` }
  }
  const itemIds = new Set<string>()
  for (const item of items) {
    if (!isRecord(item) || typeof item.id !== 'string' || itemIds.has(item.id)) return { ok: false, error: 'Every item needs a unique id.' }
    itemIds.add(item.id)
    if (typeof item.sourceId !== 'string' || !sourceIds.has(item.sourceId)) return { ok: false, error: `Item "${item.id}" references an unknown source.` }
  }
  return { ok: true, manifest: value as unknown as PixGridShippedDeckManifest }
}

export function pixGridShippedDeckToSequence(manifest: PixGridShippedDeckManifest): PixGridSequenceDefinition {
  return {
    schemaVersion: 1,
    id: pixGridShippedSequenceId(manifest.slug),
    revision: manifest.revision,
    name: manifest.name,
    sources: manifest.sources.map(source => {
      const snapshot: PixGridDeckSourceSnapshot = {
        mediaRevision: manifest.revision,
        fingerprint: source.fingerprint,
        fileName: source.fileName,
        mimeType: source.mimeType,
        width: source.width,
        height: source.height,
        hasAlpha: source.hasAlpha,
        transparentBackground: '#000000',
      }
      return { id: source.id, kind: 'bundled' as const, path: source.path, mimeType: source.mimeType, snapshot }
    }),
    items: manifest.items.map(item => ({
      id: item.id,
      sourceId: item.sourceId,
      enabled: item.enabled !== false,
      durationBeats: item.durationBeats ?? null,
    })),
    ...manifest.configuration,
  }
}

/** Reads every manifest module, keeping the valid ones. Invalid files are reported by name and never reach the registry. */
export function loadPixGridShippedDeckManifests(modules: Readonly<Record<string, unknown>>): {
  manifests: PixGridShippedDeckManifest[]
  errors: Array<{ file: string; error: string }>
} {
  const manifests: PixGridShippedDeckManifest[] = []
  const errors: Array<{ file: string; error: string }> = []
  const slugs = new Set<string>()
  for (const [file, value] of Object.entries(modules).sort(([left], [right]) => left.localeCompare(right))) {
    const result = validatePixGridShippedDeckManifest(value)
    if (!result.ok) { errors.push({ file, error: result.error }); continue }
    if (slugs.has(result.manifest.slug)) { errors.push({ file, error: `The slug "${result.manifest.slug}" is already used.` }); continue }
    slugs.add(result.manifest.slug)
    manifests.push(result.manifest)
  }
  return { manifests, errors }
}

const loaded = loadPixGridShippedDeckManifests(import.meta.glob('./shippedDecks/*.json', { eager: true, import: 'default' }))
export const PIX_GRID_SHIPPED_DECKS: readonly PixGridShippedDeckManifest[] = Object.freeze(loaded.manifests)
export const PIX_GRID_SHIPPED_DECK_ERRORS: readonly { file: string; error: string }[] = Object.freeze(loaded.errors)
