import type {
  CanvasFractureQualityMode,
  CanvasFractureResolvedQualityTier,
} from '../../ReactTypes'

export interface CanvasFracturesQualityProfile {
  tier: CanvasFractureResolvedQualityTier
  fragmentCap: number
  dprCap: number
}

const QUALITY_ORDER: readonly CanvasFractureResolvedQualityTier[] = [
  'low',
  'balanced',
  'high',
  'ultra',
]

const QUALITY_PROFILES: Readonly<Record<CanvasFractureResolvedQualityTier, CanvasFracturesQualityProfile>> = {
  low: { tier: 'low', fragmentCap: 24, dprCap: 1 },
  balanced: { tier: 'balanced', fragmentCap: 48, dprCap: 1.25 },
  high: { tier: 'high', fragmentCap: 80, dprCap: 1.5 },
  ultra: { tier: 'ultra', fragmentCap: 112, dprCap: 2 },
}

const DEFAULT_AUTO_TIER: CanvasFractureResolvedQualityTier = 'balanced'
const DOWNSHIFT_FRAME_MS = 20.5
const UPSHIFT_FRAME_MS = 14.5
const DOWNSHIFT_PRESSURE_MS = 900
const UPSHIFT_HEADROOM_MS = 5000

function clampFrameMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(100, value))
    : 16.67
}

function stableSubsetHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function resolveCanvasFracturesQualityProfile(
  tier: CanvasFractureResolvedQualityTier,
): CanvasFracturesQualityProfile {
  return { ...QUALITY_PROFILES[tier] }
}

/**
 * Reduces work without changing the deterministic topology. Focus fragments
 * are retained first, then remaining fragments are ranked by stable identity.
 * Returning items in input order preserves renderer depth ordering.
 */
export function selectCanvasFracturesStableSubset<
  T extends { id: string; anchorRole?: string },
>(items: readonly T[], requestedCap: number): readonly T[] {
  if (items.length === 0) return []
  const cap = Math.max(1, Math.min(items.length, Math.floor(Number.isFinite(requestedCap) ? requestedCap : items.length)))
  if (cap >= items.length) return items

  const focus = items.filter(item => item.anchorRole === 'focus')
  const selectedIds = new Set(focus.slice(0, cap).map(item => item.id))
  const remainingSlots = cap - selectedIds.size
  if (remainingSlots > 0) {
    const ranked = items
      .filter(item => !selectedIds.has(item.id))
      .map(item => ({ item, rank: stableSubsetHash(`fractures-quality:${item.id}`) }))
      .sort((a, b) => a.rank - b.rank || a.item.id.localeCompare(b.item.id))
    for (const candidate of ranked.slice(0, remainingSlots)) selectedIds.add(candidate.item.id)
  }
  return items.filter(item => selectedIds.has(item.id))
}

/**
 * Auto quality uses time-based hysteresis so a single slow frame cannot alter
 * visual density and sustained headroom is required before increasing cost.
 * Explicit quality modes bypass adaptation entirely.
 */
export class CanvasFracturesAdaptiveQualityController {
  private resolved: CanvasFractureResolvedQualityTier = DEFAULT_AUTO_TIER
  private pressureMs = 0
  private headroomMs = 0

  reset(mode: CanvasFractureQualityMode): CanvasFractureResolvedQualityTier {
    this.pressureMs = 0
    this.headroomMs = 0
    this.resolved = mode === 'auto' ? DEFAULT_AUTO_TIER : mode
    return this.resolved
  }

  sample(mode: CanvasFractureQualityMode, frameMs: number): CanvasFractureResolvedQualityTier {
    if (mode !== 'auto') {
      if (this.resolved !== mode) this.reset(mode)
      return mode
    }

    const sampleMs = clampFrameMs(frameMs)
    if (sampleMs >= DOWNSHIFT_FRAME_MS) {
      this.pressureMs += sampleMs
      this.headroomMs = Math.max(0, this.headroomMs - sampleMs * 2)
    } else if (sampleMs <= UPSHIFT_FRAME_MS) {
      this.headroomMs += sampleMs
      this.pressureMs = Math.max(0, this.pressureMs - sampleMs * 2)
    } else {
      this.pressureMs = Math.max(0, this.pressureMs - sampleMs)
      this.headroomMs = Math.max(0, this.headroomMs - sampleMs)
    }

    const currentIndex = QUALITY_ORDER.indexOf(this.resolved)
    if (this.pressureMs >= DOWNSHIFT_PRESSURE_MS && currentIndex > 0) {
      this.resolved = QUALITY_ORDER[currentIndex - 1]
      this.pressureMs = 0
      this.headroomMs = 0
    } else if (this.headroomMs >= UPSHIFT_HEADROOM_MS && currentIndex < QUALITY_ORDER.length - 1) {
      this.resolved = QUALITY_ORDER[currentIndex + 1]
      this.pressureMs = 0
      this.headroomMs = 0
    }
    return this.resolved
  }
}
