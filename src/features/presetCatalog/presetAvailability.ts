import { presetMetadataKey, type PresetMetadataRow } from './presetMetadata'

/**
 * Whether the signed-in user may see and use a shipped preset, from the admin's catalog metadata (Admin Console > Preset Catalog).
 *
 * | Admin setting          | Admins                     | Everyone else |
 * | ---------------------- | -------------------------- | ------------- |
 * | Switched off           | hidden, cannot be used     | same          |
 * | Archived               | hidden, cannot be used     | same          |
 * | Designing, Draft       | listed and usable (marked) | hidden        |
 * | Published, or not set  | listed and usable          | same          |
 *
 * "Switched off" is the emergency off switch: it takes a preset out of every app (pads, cues and saved work included) without a new build, whatever
 * its status, and its status is kept for when it is switched back on. With no metadata (signed out, offline before the first load, or no row) every
 * preset is available, as it always was.
 */

/** The catalog engines the Admin Console keys presets by (Preset Manager `artwork`). */
export type PresetCatalogEngine = 'cinema2' | 'canvas' | 'laserDmx' | 'pixGrid' | 'headliner'

const CATALOG_ENGINE_BY_APP_ENGINE: Readonly<Record<string, PresetCatalogEngine>> = Object.freeze({
  cinema2: 'cinema2',
  canvas: 'canvas',
  laserDmx: 'laserDmx',
  pixGrid: 'pixGrid',
  headliner: 'headliner',
})

/** The catalog engine an app engine id (React engine, Presets tab, Performance Manager) maps to, or null when the Admin Console does not govern it. */
export function catalogEngineFor(appEngineId: string): PresetCatalogEngine | null {
  return CATALOG_ENGINE_BY_APP_ENGINE[appEngineId] ?? null
}

export type PresetUnavailableReason = 'switched-off' | 'archived' | 'unreleased'

export interface PresetAvailability {
  /** Shown in preset lists, search and pickers. */
  listed: boolean
  /** May become the active preset (by a click, a pad, a cue, automation or a saved project). */
  usable: boolean
  /** Why it is hidden, or (for an admin) why it is marked; null when it is simply available. */
  reason: PresetUnavailableReason | null
  /** The admin's note for a switched-off preset, if any. */
  note: string | null
}

const AVAILABLE: PresetAvailability = Object.freeze({ listed: true, usable: true, reason: null, note: null })

export function resolvePresetAvailability(row: Pick<PresetMetadataRow, 'publication_status' | 'disabled' | 'disabled_reason'> | null | undefined, viewerIsAdmin: boolean): PresetAvailability {
  if (!row) return AVAILABLE
  if (row.disabled === true) return { listed: false, usable: false, reason: 'switched-off', note: row.disabled_reason?.trim() || null }
  if (row.publication_status === 'archived') return { listed: false, usable: false, reason: 'archived', note: null }
  if (row.publication_status === 'designing' || row.publication_status === 'draft') {
    return viewerIsAdmin ? { listed: true, usable: true, reason: 'unreleased', note: null } : { listed: false, usable: false, reason: 'unreleased', note: null }
  }
  return AVAILABLE
}

/** Availability of one preset, given the metadata index (`<engine>:<preset key>`), the app engine it belongs to and the viewer. */
export function presetAvailabilityFor(
  index: ReadonlyMap<string, PresetMetadataRow>,
  appEngineId: string,
  presetKey: string,
  viewerIsAdmin: boolean,
): PresetAvailability {
  const engine = catalogEngineFor(appEngineId)
  if (!engine || index.size === 0) return AVAILABLE
  return resolvePresetAvailability(index.get(presetMetadataKey(engine, presetKey)), viewerIsAdmin)
}

/** A user-facing sentence for why a preset could not be used. */
export function presetUnavailableMessage(name: string, availability: PresetAvailability): string {
  if (availability.reason === 'switched-off') return `${name} has been switched off for now${availability.note ? `: ${availability.note}` : '.'}`
  if (availability.reason === 'archived') return `${name} has been retired and is no longer available.`
  return `${name} is not available yet.`
}
