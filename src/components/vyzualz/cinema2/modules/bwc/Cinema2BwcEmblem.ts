import { BWC_EMBLEM_INTERIORS, BWC_EMBLEM_OUTLINE, BWC_EMBLEM_VIEW_BOX } from './Cinema2BwcEmblem.generated'
import { BWC_CAN_HEIGHT_M } from './Cinema2BwcCanModel'

/**
 * The three-claw emblem printed on the BWC cans. The artwork is `docs/BWC/Claw_Marks_Filled.svg` (see
 * `Cinema2BwcEmblem.generated.ts`); it is drawn once into a texture and wrapped around the can body.
 */

/** Size of the emblem texture: exactly twice the SVG's own 256 x 376 view box. */
export const BWC_EMBLEM_TEXTURE_WIDTH = 512
export const BWC_EMBLEM_TEXTURE_HEIGHT = 752
/** Mip chain included; RGBA8. */
export const BWC_EMBLEM_TEXTURE_BYTES = Math.ceil(BWC_EMBLEM_TEXTURE_WIDTH * BWC_EMBLEM_TEXTURE_HEIGHT * 4 * (4 / 3))

const ASPECT = BWC_EMBLEM_VIEW_BOX[2] / BWC_EMBLEM_VIEW_BOX[3]
/** Printed height on the can (m, in the 168 mm can's own space): most of the straight body, which runs 4.45 to 156.57 mm. */
export const BWC_EMBLEM_HEIGHT_M = 0.095
export const BWC_EMBLEM_WIDTH_M = BWC_EMBLEM_HEIGHT_M * ASPECT
/** Height of the middle of the emblem: the middle of the straight body. */
export const BWC_EMBLEM_CENTER_Y_M = ((4.45 + 156.568) / 2) * 0.001
/** Radius used to turn arc length on the body into an angle: between the 18-gon's flat (apothem) and corner (radius). */
export const BWC_EMBLEM_WRAP_RADIUS_M = 0.0306

export type BwcEmblemCanvas = HTMLCanvasElement | OffscreenCanvas

/**
 * Draws the emblem with its transparent background: the interiors first, then the black compound outline on top
 * (even-odd, so its inner contours leave the claw interiors showing). Returns null where there is no canvas (tests
 * without a DOM); callers then print nothing.
 */
export function rasterizeBwcEmblem(width = BWC_EMBLEM_TEXTURE_WIDTH, height = BWC_EMBLEM_TEXTURE_HEIGHT): BwcEmblemCanvas | null {
  if (typeof Path2D === 'undefined') return null
  const canvas: BwcEmblemCanvas | null = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width, height }) : null
  const context = canvas?.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined
  if (!canvas || !context) return null
  const [x, y, w, h] = BWC_EMBLEM_VIEW_BOX
  context.clearRect(0, 0, width, height)
  context.scale(width / w, height / h)
  context.translate(-x, -y)
  for (const interior of BWC_EMBLEM_INTERIORS) {
    context.fillStyle = interior.fill
    context.fill(new Path2D(interior.d))
  }
  context.fillStyle = BWC_EMBLEM_OUTLINE.fill
  context.fill(new Path2D(BWC_EMBLEM_OUTLINE.d), BWC_EMBLEM_OUTLINE.fillRule)
  return canvas
}

const f = (value: number): string => value.toFixed(6)

/** GLSL constants for placing the emblem on the can (can space: metres, origin at the base centre). */
export function bwcEmblemGlsl(): string {
  return `
const float EMBLEM_HEIGHT = ${f(BWC_EMBLEM_HEIGHT_M)};
const float EMBLEM_WIDTH = ${f(BWC_EMBLEM_WIDTH_M)};
const float EMBLEM_CENTER_Y = ${f(BWC_EMBLEM_CENTER_Y_M)};
const float EMBLEM_WRAP_RADIUS = ${f(BWC_EMBLEM_WRAP_RADIUS_M)};
const float CAN_HEIGHT = ${f(BWC_CAN_HEIGHT_M)};
`
}
