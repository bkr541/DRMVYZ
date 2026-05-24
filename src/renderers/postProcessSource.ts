/**
 * Pure utility for post-processing source selection.
 *
 * When a displacement or ghost/echo effect reads from the composited frame,
 * this resolves the correct source in priority order:
 *   1. srcSnap   — Canvas 2D snapshot (full W×H, no draw-rect needed)
 *   2. gpuCanvas — GPU compositor offscreen canvas (full W×H)
 *   3. mediaEl   — raw media element (caller must supply draw-rect ox/oy/sw/sh)
 *
 * fullFrame=true  → draw at (offX, offY)
 * fullFrame=false → draw at (ox+offX, oy+offY, sw, sh)
 */
export function selectPostProcessSource(
  srcSnap: HTMLCanvasElement | null,
  isGpu: boolean,
  gpuCanvas: HTMLCanvasElement | null,
  mediaEl: HTMLImageElement | HTMLVideoElement | null,
): {
  src: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null
  fullFrame: boolean
} {
  if (srcSnap)             return { src: srcSnap,   fullFrame: true  }
  if (isGpu && gpuCanvas)  return { src: gpuCanvas, fullFrame: true  }
  return                          { src: mediaEl,   fullFrame: false }
}
