import type { CinemaColor } from './CinemaDomain'

export type CinemaCompositorBlendMode =
  | 'normal'
  | 'add'
  | 'screen'
  | 'multiply'
  | 'lighten'
  | 'darken'
  | 'difference'
  | 'overlay'

export type CinemaMaskSamplingMode = 'alpha' | 'luminance'
export type CinemaCompositionTransitionKind = 'crossfade' | 'wipe' | 'radial' | 'dissolve' | 'slide' | 'zoom'

export interface CinemaTransitionClockSnapshot {
  readonly token: string | null
  readonly generation: number
  readonly startedAtSec: number
  readonly durationSec: number
  readonly initialProgress: number
  readonly progress: number
  readonly active: boolean
}

/**
 * Deterministic runtime-only transition clock. Interruptions retain the sampled
 * progress instead of snapping to either source, and no state is persisted.
 */
export class CinemaCompositionTransitionClock {
  private token: string | null = null
  private generation = 0
  private startedAtSec = 0
  private durationSec = 0
  private initialProgress = 0

  begin(token: string, nowSec: number, durationSec: number): CinemaTransitionClockSnapshot {
    const normalizedNow = finite(nowSec, 0)
    const current = this.sample(normalizedNow)
    const changed = token !== this.token
    if (changed) {
      this.token = token
      this.generation += 1
      this.startedAtSec = normalizedNow
      this.durationSec = Math.max(0, finite(durationSec, 0))
      this.initialProgress = current.active ? current.progress : 0
    } else if (Math.max(0, finite(durationSec, 0)) !== this.durationSec) {
      this.startedAtSec = normalizedNow
      this.durationSec = Math.max(0, finite(durationSec, 0))
      this.initialProgress = current.progress
    }
    return this.sample(normalizedNow)
  }

  sample(nowSec: number): CinemaTransitionClockSnapshot {
    if (this.token == null) return this.snapshot(1, false)
    if (this.durationSec <= 0) return this.snapshot(1, false)
    const elapsed = Math.max(0, finite(nowSec, this.startedAtSec) - this.startedAtSec)
    const local = clamp01(elapsed / this.durationSec)
    const progress = clamp01(this.initialProgress + (1 - this.initialProgress) * local)
    return this.snapshot(progress, progress < 1)
  }

  reset(): void {
    this.token = null
    this.generation = 0
    this.startedAtSec = 0
    this.durationSec = 0
    this.initialProgress = 0
  }

  private snapshot(progress: number, active: boolean): CinemaTransitionClockSnapshot {
    return Object.freeze({
      token: this.token,
      generation: this.generation,
      startedAtSec: this.startedAtSec,
      durationSec: this.durationSec,
      initialProgress: this.initialProgress,
      progress: clamp01(progress),
      active,
    })
  }
}

/** CPU reference used by validation tests for premultiplied-alpha blend equations. */
export function blendCinemaPremultiplied(
  background: CinemaColor,
  foreground: CinemaColor,
  mode: CinemaCompositorBlendMode,
  opacity = 1,
): CinemaColor {
  const backgroundAlpha = clamp01(background[3])
  const sourceOpacity = clamp01(opacity)
  const foregroundAlpha = clamp01(foreground[3]) * sourceOpacity
  const backgroundStraight = unpremultiply(background)
  const foregroundStraight = unpremultiply(foreground)
  const blended = blendStraightRgb(backgroundStraight, foregroundStraight, mode)
  const outputAlpha = foregroundAlpha + backgroundAlpha * (1 - foregroundAlpha)
  const sourcePremultiplied: readonly [number, number, number] = [
    foregroundStraight[0] * foregroundAlpha,
    foregroundStraight[1] * foregroundAlpha,
    foregroundStraight[2] * foregroundAlpha,
  ]
  const backgroundPremultiplied: readonly [number, number, number] = [
    backgroundStraight[0] * backgroundAlpha,
    backgroundStraight[1] * backgroundAlpha,
    backgroundStraight[2] * backgroundAlpha,
  ]
  return Object.freeze([
    clamp01((1 - foregroundAlpha) * backgroundPremultiplied[0]
      + (1 - backgroundAlpha) * sourcePremultiplied[0]
      + backgroundAlpha * foregroundAlpha * blended[0]),
    clamp01((1 - foregroundAlpha) * backgroundPremultiplied[1]
      + (1 - backgroundAlpha) * sourcePremultiplied[1]
      + backgroundAlpha * foregroundAlpha * blended[1]),
    clamp01((1 - foregroundAlpha) * backgroundPremultiplied[2]
      + (1 - backgroundAlpha) * sourcePremultiplied[2]
      + backgroundAlpha * foregroundAlpha * blended[2]),
    clamp01(outputAlpha),
  ]) as CinemaColor
}

export function resolveCinemaMaskWeight(
  sample: CinemaColor,
  mode: CinemaMaskSamplingMode,
  invert = false,
): number {
  const straight = unpremultiply(sample)
  const weight = mode === 'luminance'
    ? clamp01(straight[0] * 0.2126 + straight[1] * 0.7152 + straight[2] * 0.0722)
    : clamp01(sample[3])
  return invert ? 1 - weight : weight
}

export function linearizeCinemaSrgb(value: number): number {
  const normalized = clamp01(value)
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

export function encodeCinemaSrgb(value: number): number {
  const normalized = Math.max(0, finite(value, 0))
  return normalized <= 0.0031308
    ? normalized * 12.92
    : 1.055 * Math.pow(normalized, 1 / 2.4) - 0.055
}

/** Converts linear Display-P3 primaries into the internal linear-sRGB gamut. */
export function convertCinemaLinearDisplayP3ToLinearSrgb(
  color: readonly [number, number, number],
): readonly [number, number, number] {
  const red = finite(color[0], 0)
  const green = finite(color[1], 0)
  const blue = finite(color[2], 0)
  return Object.freeze([
    1.224745 * red - 0.224904 * green,
    -0.042058 * red + 1.042081 * green,
    -0.019642 * red - 0.078655 * green + 1.098537 * blue,
  ])
}

function unpremultiply(color: CinemaColor): readonly [number, number, number] {
  const alpha = clamp01(color[3])
  if (alpha <= 0.000001) return [0, 0, 0]
  return [
    clamp01(color[0] / alpha),
    clamp01(color[1] / alpha),
    clamp01(color[2] / alpha),
  ]
}

function blendStraightRgb(
  background: readonly [number, number, number],
  foreground: readonly [number, number, number],
  mode: CinemaCompositorBlendMode,
): readonly [number, number, number] {
  return [0, 1, 2].map(index => blendChannel(background[index], foreground[index], mode)) as unknown as readonly [number, number, number]
}

function blendChannel(background: number, foreground: number, mode: CinemaCompositorBlendMode): number {
  switch (mode) {
    case 'normal': return foreground
    case 'add': return Math.min(1, background + foreground)
    case 'screen': return 1 - (1 - background) * (1 - foreground)
    case 'multiply': return background * foreground
    case 'lighten': return Math.max(background, foreground)
    case 'darken': return Math.min(background, foreground)
    case 'difference': return Math.abs(background - foreground)
    case 'overlay': return background <= 0.5
      ? 2 * background * foreground
      : 1 - 2 * (1 - background) * (1 - foreground)
  }
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, finite(value, 0)))
}
