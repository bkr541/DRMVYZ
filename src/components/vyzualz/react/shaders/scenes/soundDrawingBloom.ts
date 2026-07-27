// ── soundDrawingBloom ─────────────────────────────────────────────────────────
//
// Pure, GL-free reference math for the Sound Drawing vectorscope scene's
// three-tier chromatic bloom chain and HDR tone-mapping pass. These functions
// are the testable source of truth for the numbers the GLSL bloom/composite
// passes (soundDrawingVectorscope.ts) implement — GLSL itself can't run
// inside a unit test, so the intended behavior is pinned here and the shader
// source is hand-transcribed to match.
//
// Target radial falloff (reverse-engineered from reference footage), px:
//   0-1:222  1-2:159  2-3:92  3-5:63  5-8:44  8-12:31  12-18:27  25-40:24  40-60:20  60-100:13
// One blur radius cannot produce both the tight core and the 40px+ tail, so
// three additive downsampled passes are composited (sigma ~2/10/40px, weights
// ~1.0/0.35/0.15) rather than one.
//
// Chromatic bloom: red blurs tightest, blue widest, roughly 1.0/1.5/2.5x the
// tier's base sigma — red barely blooms, blue dominates the far tail.

export interface BloomTierConfig {
  /** Base Gaussian sigma in px for this tier (before per-channel scaling). */
  sigmaPx: number
  /** Contribution weight when compositing this tier into the accumulation buffer. */
  weight: number
  /** Per-channel [r,g,b] multiplier applied to sigmaPx — red tightest, blue widest. */
  channelRadiusScale: readonly [number, number, number]
}

export const SOUND_DRAWING_BLOOM_CHANNEL_SCALE: readonly [number, number, number] = [1.0, 1.5, 2.5]

export const SOUND_DRAWING_BLOOM_TIERS: readonly BloomTierConfig[] = [
  { sigmaPx: 2, weight: 1.00, channelRadiusScale: SOUND_DRAWING_BLOOM_CHANNEL_SCALE },
  { sigmaPx: 10, weight: 0.35, channelRadiusScale: SOUND_DRAWING_BLOOM_CHANNEL_SCALE },
  { sigmaPx: 40, weight: 0.15, channelRadiusScale: SOUND_DRAWING_BLOOM_CHANNEL_SCALE },
]

export type BloomChannel = 0 | 1 | 2 // r, g, b

/** Normalized 1D Gaussian falloff at a given radial distance. */
export function gaussianFalloff(distancePx: number, sigmaPx: number): number {
  if (sigmaPx <= 0) return distancePx === 0 ? 1 : 0
  return Math.exp(-(distancePx * distancePx) / (2 * sigmaPx * sigmaPx))
}

/**
 * Composite falloff for one color channel at a given radial distance: the
 * weighted sum of all three bloom tiers, each with that channel's own
 * (wider-for-blue) effective sigma.
 */
export function resolveBloomChannelFalloff(
  distancePx: number,
  channel: BloomChannel,
  tiers: readonly BloomTierConfig[] = SOUND_DRAWING_BLOOM_TIERS,
): number {
  let sum = 0
  for (const tier of tiers) {
    const effectiveSigma = tier.sigmaPx * tier.channelRadiusScale[channel]
    sum += tier.weight * gaussianFalloff(distancePx, effectiveSigma)
  }
  return sum
}

export interface BloomRgb { r: number; g: number; b: number }

/** Composite bloom falloff applied to a base RGB color at a given radial distance. */
export function resolveBloomColorAtDistance(base: BloomRgb, distancePx: number, tiers?: readonly BloomTierConfig[]): BloomRgb {
  return {
    r: base.r * resolveBloomChannelFalloff(distancePx, 0, tiers),
    g: base.g * resolveBloomChannelFalloff(distancePx, 1, tiers),
    b: base.b * resolveBloomChannelFalloff(distancePx, 2, tiers),
  }
}

// ── Tone mapping ──────────────────────────────────────────────────────────────
//
// Maps HDR accumulation to a displayable 0..1 range with Reinhard-style
// compression, then desaturates toward the pixel's own luma in proportion to
// how bright it is — a dense, high-energy core (many overlapping additive
// strokes) pulls toward white, while a dim halo sample retains its base hue.

function luma(c: BloomRgb): number {
  return c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
}

function reinhard(v: number): number {
  return v / (1 + v)
}

/**
 * @param hdr             Linear HDR accumulation (unbounded, ≥0 per channel).
 * @param whitenStrength  0..1+ multiplier on how strongly luma drives
 *                        desaturation. 1.0 = a pixel at display-luma 1.0 is
 *                        fully desaturated to gray; lower values hold onto
 *                        more hue at the same brightness.
 */
export function resolveSoundDrawingToneMap(hdr: BloomRgb, whitenStrength = 1.0): BloomRgb {
  const mapped: BloomRgb = { r: reinhard(hdr.r), g: reinhard(hdr.g), b: reinhard(hdr.b) }
  const l = luma(mapped)
  const whiten = Math.max(0, Math.min(1, l * whitenStrength))
  return {
    r: mapped.r + (l - mapped.r) * whiten,
    g: mapped.g + (l - mapped.g) * whiten,
    b: mapped.b + (l - mapped.b) * whiten,
  }
}

/** Chroma (max-min channel spread) — a simple, dependency-free saturation proxy for tests. */
export function chroma(c: BloomRgb): number {
  return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)
}
