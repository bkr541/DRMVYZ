import { lerp, clamp01 } from './CutbankRandom'

/**
 * Composition Freedom is ONE macro. Every layout reads its cropping, overscan,
 * scale spread, rotation, negative space, and layout reinterpretation from this
 * envelope — none of them exist as separate controls or settings.
 *
 *   offset        max distance of an element centre from canvas centre
 *                 (fraction of the canvas; > 0.5 lets a centre leave the frame)
 *   scaleLo/Hi    multiplicative spread around a layout's base size
 *   rotation      max absolute rotation (radians)
 *   overscan      extra bleed beyond the frame edges (fraction of canvas)
 *   cropZoom      max zoom into a source when cropping to a window
 *   negativeSpace fraction of the canvas sparse layouts try to leave empty
 *   variety       how far Auto may reinterpret layouts (flattens layout weights)
 *   legibility    text alignment/rotation safety (1 = strict, 0 = free)
 */
export interface CutbankFreedomEnvelope {
  offset: number
  scaleLo: number
  scaleHi: number
  rotation: number
  overscan: number
  cropZoom: number
  negativeSpace: number
  variety: number
  legibility: number
}

export function resolveCutbankFreedomEnvelope(freedom: number): CutbankFreedomEnvelope {
  const f = clamp01(freedom)
  return {
    offset: lerp(0.06, 0.55, f),
    scaleLo: lerp(0.92, 0.3, f),
    scaleHi: lerp(1.08, 2.4, f),
    rotation: lerp(0.02, 0.62, f),
    overscan: lerp(0, 0.5, f),
    cropZoom: lerp(1, 2.4, f),
    negativeSpace: lerp(0.15, 0.85, f),
    variety: lerp(0.1, 1, f),
    legibility: 1 - f,
  }
}
