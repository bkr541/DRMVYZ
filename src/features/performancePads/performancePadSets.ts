import { DEFAULT_PERFORMANCE_PADS, type ReactPerformancePad, type ReactEngineDestination } from '../../components/vyzualz/react/ReactTypes'
import { migrateLegacyPerformancePadsToCinema2 } from '../../components/vyzualz/cinema2/migration/Cinema2LegacyStateMigration'

/** Version of the pad record shape stored in `performance_pad_sets`. */
export const PAD_SET_SCHEMA_VERSION = 1
export const MAX_SYNCED_PADS = 64

const text = (value: unknown, max: number): string | null => typeof value === 'string' && value.length <= max ? value : null

function sanitizeDestination(value: unknown): ReactEngineDestination | null | undefined {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const engineId = text(record.engineId, 40)
  const presetId = text(record.presetId, 200)
  if (!engineId || !presetId || record.schemaVersion !== 1) return undefined
  const destination: ReactEngineDestination = { schemaVersion: 1, engineId: engineId as ReactEngineDestination['engineId'], presetId }
  const variantId = text(record.variantId, 200)
  if (variantId) destination.variantId = variantId
  if (record.parameterPatch && typeof record.parameterPatch === 'object' && !Array.isArray(record.parameterPatch)) {
    destination.parameterPatch = record.parameterPatch as Record<string, unknown>
  }
  return destination
}

/** Accepts one pad from untrusted storage. Returns a pad containing only known fields, or null when it is unusable. */
export function sanitizePad(value: unknown): ReactPerformancePad | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const id = text(record.id, 40)
  const label = text(record.label, 80)
  const color = text(record.color, 32)
  const keyBinding = text(record.keyBinding, 8)
  if (!id || !/^pad-\d{1,3}$/.test(id) || label === null || !color || keyBinding === null) return null
  const presetId = record.presetId === null ? null : text(record.presetId, 200)
  if (presetId === null && record.presetId !== null) return null
  const transition = typeof record.transitionTimeMs === 'number' && Number.isFinite(record.transitionTimeMs)
    ? Math.min(60_000, Math.max(0, Math.round(record.transitionTimeMs))) : 0
  const pad: ReactPerformancePad = { id, presetId, label, color, keyBinding, transitionTimeMs: transition }
  const destination = sanitizeDestination(record.destination)
  if (destination === undefined && record.destination !== undefined) return null
  if (destination !== undefined) pad.destination = destination
  if (record.colorAssigned === true) pad.colorAssigned = true
  if (record.assignmentOverridesAction === true) pad.assignmentOverridesAction = true
  return pad
}

/** A whole pad set from the cloud: every entry must be usable, ids must be unique, and the count must be sensible. Otherwise null. */
export function sanitizePadSet(value: unknown): ReactPerformancePad[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SYNCED_PADS) return null
  const pads: ReactPerformancePad[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    const pad = sanitizePad(entry)
    if (!pad || seen.has(pad.id)) return null
    seen.add(pad.id)
    pads.push(pad)
  }
  return pads
}

/** A stable fingerprint of a pad set (cyrb53 over its canonical JSON). Used only to tell "changed" from "unchanged". */
export function padSetFingerprint(pads: readonly ReactPerformancePad[]): string {
  const canonical = JSON.stringify((sanitizePadSet(pads) ?? pads).map(pad => ({
    id: pad.id, presetId: pad.presetId, destination: pad.destination ?? null, label: pad.label, color: pad.color,
    keyBinding: pad.keyBinding, transitionTimeMs: pad.transitionTimeMs, colorAssigned: pad.colorAssigned === true,
    assignmentOverridesAction: pad.assignmentOverridesAction === true,
  })))
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

export const DEFAULT_PAD_SET_FINGERPRINT = padSetFingerprint(DEFAULT_PERFORMANCE_PADS)

/**
 * The stock pads as a new account or a fresh install starts with them: the shipped list after its Cinema 2.0 migration, which is what
 * the React store holds before anyone edits a pad (and the raw shipped list, for older saved states).
 */
const STOCK_PAD_SET_FINGERPRINTS: ReadonlySet<string> = new Set([
  DEFAULT_PAD_SET_FINGERPRINT,
  padSetFingerprint(migrateLegacyPerformancePadsToCinema2(DEFAULT_PERFORMANCE_PADS)),
])

/** True for an unedited stock pad set, which the sync never pushes (a fresh device must not overwrite an account's custom pads). */
export function isStockPadSetFingerprint(fingerprint: string): boolean {
  return STOCK_PAD_SET_FINGERPRINTS.has(fingerprint)
}

/** A pad the phone can perform: it loads a Cinema 2.0 preset. Pads for other engines are shown but disabled on mobile. */
export function isMobileUsablePad(pad: ReactPerformancePad): boolean {
  return pad.destination?.engineId === 'cinema2'
}
