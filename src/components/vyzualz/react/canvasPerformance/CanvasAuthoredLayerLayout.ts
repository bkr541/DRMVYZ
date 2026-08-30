export interface CanvasAuthoredLayerLayout {
  x: number
  y: number
  scaleX: number
  scaleY: number
}

/**
 * Multi-layer slots intentionally leave a small, deterministic gutter around
 * each source. The compositor's authored coordinates are normalized from -1 to
 * 1 around the Canvas center, so a 0.5 scale occupies one half of each axis.
 */
const CANVAS_AUTHORED_LAYOUT_INSET = 0.92

const FULL_CANVAS_LAYOUT: CanvasAuthoredLayerLayout = Object.freeze({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
})

function insetLayout(
  x: number,
  y: number,
  slotScaleX: number,
  slotScaleY: number,
): CanvasAuthoredLayerLayout {
  return {
    x,
    y,
    scaleX: slotScaleX * CANVAS_AUTHORED_LAYOUT_INSET,
    scaleY: slotScaleY * CANVAS_AUTHORED_LAYOUT_INSET,
  }
}

/**
 * Resolves transient authored-layer geometry from visible ordinal/count only.
 * Stable layer identity and persisted order are deliberately not part of this
 * helper, so removing or hiding a layer simply compacts the remaining ordinals.
 */
export function resolveCanvasAuthoredLayerLayout(
  layerCount: number,
  layerIndex: number,
): CanvasAuthoredLayerLayout | null {
  if (!Number.isInteger(layerCount) || !Number.isInteger(layerIndex)) return null
  if (layerCount < 1 || layerCount > 4 || layerIndex < 0 || layerIndex >= layerCount) return null

  if (layerCount === 1) return { ...FULL_CANVAS_LAYOUT }

  if (layerCount === 2) {
    return layerIndex === 0
      ? insetLayout(-0.5, -0.5, 0.5, 0.5)
      : insetLayout(0.5, 0.5, 0.5, 0.5)
  }

  if (layerCount === 3) {
    const x = [-2 / 3, 0, 2 / 3][layerIndex]
    return insetLayout(x, 0, 1 / 3, 1)
  }

  const positions = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
  ] as const
  const [x, y] = positions[layerIndex]
  return insetLayout(x, y, 0.5, 0.5)
}
