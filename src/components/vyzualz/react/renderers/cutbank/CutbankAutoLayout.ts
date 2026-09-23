import type { CutbankEnergyState } from './CutbankClock'
import { CUTBANK_LAYOUT_IDS, CUTBANK_MULTI_LAYER_LAYOUTS, type CutbankLayoutId } from './CutbankLayouts'
import { lerp } from './CutbankRandom'
import type { CutbankContentItem } from './CutbankContent'

interface AutoLayoutInput {
  energy: CutbankEnergyState
  freedom: number
  complexity: number
  layerCount: number
  items: readonly CutbankContentItem[]
  /** Deterministic 0..1 draw. */
  unit: number
  /** Layout used by the previous composition, to encourage variation. */
  previous: CutbankLayoutId | null
}

/**
 * Internal (non user-facing) layout weights. Authored rules, deterministic draw:
 * quiet passages lean sparse, drops lean aggressive, and Composition Freedom /
 * Layer Count / pool contents gate what is eligible at all.
 */
export function resolveAutoCutbankLayout(input: AutoLayoutInput): CutbankLayoutId {
  const { energy, freedom, complexity, layerCount, items, unit, previous } = input
  const hasText = items.some(item => item.kind === 'text')
  const hasVisual = items.some(item => item.kind !== 'text')
  const hasSvg = items.some(item => item.kind === 'svg')
  const weights: Partial<Record<CutbankLayoutId, number>> = {}
  const add = (id: CutbankLayoutId, w: number) => { weights[id] = (weights[id] ?? 0) + w }

  const e = energy.level
  const low = 1 - Math.min(1, e / 0.5)
  const high = Math.max(0, (e - 0.4) / 0.6)

  add('hero', 1.2)
  add('void', 0.2 + low * 1.6)
  add('microtype', (0.2 + low * 1.4) * (hasText ? 1.3 : 0.5))
  add('edgeCrop', 0.4 + freedom * 0.9)
  add('overscan', freedom > 0.3 ? (0.2 + high * 1.6) * freedom * 1.6 : 0)
  add('verticalType', hasText ? 0.4 + 0.8 * (1 - low) : 0)
  add('poster', hasText && hasVisual ? 0.6 + energy.vocal * 1.2 + (1 - low) * 0.5 : hasText ? 0.5 : 0.2)
  add('logoHit', hasSvg ? 0.5 + high * 0.9 : 0.1)
  if (layerCount >= 2) {
    add('stack', (0.3 + complexity * 1.1) * (0.5 + e))
    add('split', (0.25 + complexity * 0.9) * (0.4 + e * 1.2))
    add('tunnel', high * 1.2 * (0.4 + complexity))
    add('fragment', freedom > 0.25 ? (0.2 + high * 1.4) * (0.4 + complexity) : 0)
  }
  if (energy.drop) {
    add('overscan', 0.8)
    add('fragment', layerCount >= 2 ? 0.8 : 0)
    add('hero', 0.4)
  }
  if (!hasVisual) {
    // Text-only pools: favour layouts whose content is typography.
    add('verticalType', 0.6)
    add('poster', 0.4)
  }

  const entries = CUTBANK_LAYOUT_IDS
    .filter(id => layerCount >= 2 || !CUTBANK_MULTI_LAYER_LAYOUTS.includes(id))
    .map(id => {
      let w = weights[id] ?? 0
      // Low Composition Freedom flattens toward conventional layouts and away from reinterpretation.
      const variety = lerp(0.35, 1, freedom)
      w = Math.pow(Math.max(0, w), variety)
      if (id === previous) w *= 0.35
      return [id, w] as const
    })
    .filter(([, w]) => w > 0)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  if (total <= 0) return 'hero'
  let cursor = unit * total
  for (const [id, w] of entries) {
    cursor -= w
    if (cursor <= 0) return id
  }
  return entries[entries.length - 1][0]
}
