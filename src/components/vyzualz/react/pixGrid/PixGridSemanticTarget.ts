import { samplePixGridBuiltInAsset } from './PixGridArtwork'
import type { PixGridState } from './PixGridTypes'

const MARQUEE_LAYER_PREFIX = 'marquee-'
const MARQUEE_PRESET_ID = 'pix-grid-neon-marquee-cycle'

export interface PixGridSemanticTargetCell {
  x: number
  y: number
}

export function isPixGridSemanticTargetActive(state: PixGridState): boolean {
  const selectedLayerId = state.editor.selectedLayerId
  return state.selectedPresetId === MARQUEE_PRESET_ID
    && selectedLayerId != null
    && selectedLayerId.startsWith(MARQUEE_LAYER_PREFIX)
    && state.layers.some(layer => layer.id === selectedLayerId)
}

/**
 * Resolves the exact source-alpha membership of the selected semantic layer at
 * the currently displayed sign frame. This is an editing overlay only and does
 * not alter the compositor, saved pixels, Smart Groups, or performance output.
 */
export function resolvePixGridSemanticTargetCells(
  state: PixGridState,
  frameIndex: number,
): readonly PixGridSemanticTargetCell[] {
  const selectedLayerId = state.editor.selectedLayerId
  const layer = selectedLayerId ? state.layers.find(candidate => candidate.id === selectedLayerId) : null
  if (!layer || !isPixGridSemanticTargetActive(state)) return []

  const cells: PixGridSemanticTargetCell[] = []
  for (let y = 0; y < state.matrixHeight; y += 1) {
    const v = (y + 0.5) / state.matrixHeight
    for (let x = 0; x < state.matrixWidth; x += 1) {
      const u = (x + 0.5) / state.matrixWidth
      const sample = samplePixGridBuiltInAsset(layer.assetId, u, v, frameIndex, layer.seed)
      if (sample.alpha > 0) cells.push({ x, y })
    }
  }
  return cells
}
