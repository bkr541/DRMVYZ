import type { CanvasCutbankSelectionMode } from './CutbankSettings'
import type { CutbankContentItem } from './CutbankContent'
import { cutbankSeed, cutbankUnit, shuffleDeterministic } from './CutbankRandom'

export const CUTBANK_SELECTION_SLOTS = 4

export interface CutbankSelectionIdentity {
  trackIdentity: string | null
  poolId: string | null
  poolRevision: number
}

/**
 * Pure function of (identity, sequenceIndex, slot): the same inputs always
 * select the same entry, so seeks, loops, and restarts reconstruct exactly.
 *
 * Random  — independent deterministic draw per (sequence, slot).
 * Shuffle — walks a deterministic shuffled ordering of the eligible list and
 *           reshuffles (new cycle) once every entry has been shown.
 */
export function pickCutbankItem({
  items,
  mode,
  identity,
  sequenceIndex,
  slot,
}: {
  items: readonly CutbankContentItem[]
  mode: CanvasCutbankSelectionMode
  identity: CutbankSelectionIdentity
  sequenceIndex: number
  slot: number
}): CutbankContentItem | null {
  if (items.length === 0) return null
  if (items.length === 1) return items[0]
  const base = [identity.trackIdentity ?? 'unloaded', identity.poolId ?? 'none', identity.poolRevision] as const
  if (mode === 'random') {
    const unit = cutbankUnit(...base, 'random', sequenceIndex, slot, items.length)
    return items[Math.min(items.length - 1, Math.floor(unit * items.length))]
  }
  const position = Math.max(0, sequenceIndex) * CUTBANK_SELECTION_SLOTS + slot
  const cycle = Math.floor(position / items.length)
  const order = shuffleDeterministic(items, cutbankSeed(...base, 'shuffle', cycle, items.length))
  return order[position % items.length]
}
