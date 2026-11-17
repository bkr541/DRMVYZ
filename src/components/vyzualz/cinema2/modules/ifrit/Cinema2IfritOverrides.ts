import { IFRIT_RING_SLOTS, IFRIT_SECTORS } from './Cinema2IfritDomain'

/** One persistent, per-part creative patch. Every field is optional and bounds-checked. */
export interface IfritElementPatch {
  readonly enabled?: boolean
  /** Radians. Gear/blade/spoke tilt, or a shard's initial tumble. */
  readonly rotationOffset?: number
  /** Spoke extension, blade sweep amplitude, or satellite radius, as an additive offset. */
  readonly extensionOffset?: number
  /** Shard displacement and satellite orbit radius multiplier. */
  readonly spreadMultiplier?: number
  /** Gear, blade, satellite or shard-spin angular rate multiplier. */
  readonly angularVelocityMultiplier?: number
  /** Radians of phase (a shard's fracture delay is phaseOffset / 2π of the range). */
  readonly phaseOffset?: number
  readonly scaleMultiplier?: number
}
export type IfritElementOverrides = ReadonlyMap<string, IfritElementPatch>

const TAU = Math.PI * 2
const FIELD_BOUNDS = {
  rotationOffset: [-TAU, TAU], extensionOffset: [-1, 1], spreadMultiplier: [0, 4], angularVelocityMultiplier: [-4, 4], phaseOffset: [-TAU, TAU], scaleMultiplier: [0.25, 3],
} as const
export const IFRIT_EMPTY_OVERRIDES: IfritElementOverrides = new Map()
/** Valid keys: a ring (`ring-01`), a sector (`ring-01/sector-4`), a group (`.../blade`) or one part (`.../blade-2`). */
const KEY = /^ring-(\d\d)(?:\/sector-([0-5])(?:\/(spoke|gear|blade|satellite|shard)(?:-(\d))?)?)?$/

/** Parses the persisted JSON map. Unknown keys, unknown ids, non-finite numbers and malformed JSON are ignored safely; values are clamped. */
export function parseIfritElementOverrides(text: unknown): IfritElementOverrides {
  if (typeof text !== 'string' || text.trim() === '' || text.trim() === '{}') return IFRIT_EMPTY_OVERRIDES
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return IFRIT_EMPTY_OVERRIDES }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return IFRIT_EMPTY_OVERRIDES
  const out = new Map<string, IfritElementPatch>()
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const match = KEY.exec(key)
    if (!match || Number(match[1]) >= IFRIT_RING_SLOTS || typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const patch: { -readonly [K in keyof IfritElementPatch]: IfritElementPatch[K] } = {}
    const source = value as Record<string, unknown>
    if (typeof source.enabled === 'boolean') patch.enabled = source.enabled
    for (const [field, [lo, hi]] of Object.entries(FIELD_BOUNDS)) {
      const candidate = source[field]
      if (typeof candidate === 'number' && Number.isFinite(candidate)) (patch as Record<string, number>)[field] = Math.min(hi, Math.max(lo, candidate))
    }
    if (Object.keys(patch).length > 0) out.set(key, Object.freeze(patch))
  }
  return out.size === 0 ? IFRIT_EMPTY_OVERRIDES : out
}

const NEUTRAL: IfritElementPatch = Object.freeze({})
/** ring, then sector, then group, then the exact part: later scopes override earlier ones field by field. */
export function resolveIfritElementPatch(overrides: IfritElementOverrides, id: string): IfritElementPatch {
  if (overrides.size === 0) return NEUTRAL
  const [ring, sector, part] = id.split('/')
  const group = part?.replace(/-\d$/, '')
  const keys = [ring, `${ring}/${sector}`, group && group !== part ? `${ring}/${sector}/${group}` : null, id]
  let merged: IfritElementPatch | null = null
  for (const key of keys) {
    const patch = key == null ? undefined : overrides.get(key)
    if (patch) merged = { ...(merged ?? {}), ...patch }
  }
  return merged ?? NEUTRAL
}
export const IFRIT_SECTOR_COUNT = IFRIT_SECTORS
