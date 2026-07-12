import type { CanvasEngineSettings, CanvasPresetSettings } from './ReactTypes'

const CANVAS_RENDER_EPSILON = 0.001

function isNonZero(value: number): boolean {
  return Math.abs(value) > CANVAS_RENDER_EPSILON
}

function clampCanvasFidelityValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

/**
 * CANVAS must prefer the original signed asset for live playback. A proxy is a
 * compatibility fallback only, because future proxy/transcode assets may be
 * intentionally lower resolution.
 */
export function resolveCanvasPlaybackUrl(media: { url?: string; proxyUrl?: string }): string {
  return media.url || media.proxyUrl || ''
}

/**
 * The browser-owned video/image element is the fidelity anchor. Presets must
 * never apply blur, color filters, glow filters, or stutter filter animation to
 * that element. This helper therefore describes the separate additive effect
 * pass, not permission to filter the source element itself.
 */
export function hasCanvasSourceFilter(settings: CanvasPresetSettings): boolean {
  return (
    isNonZero(settings.glow) ||
    isNonZero(settings.trailAmount) ||
    isNonZero(settings.rgbSplit) ||
    isNonZero(settings.glitchAmount) ||
    isNonZero(settings.motionAmount) ||
    isNonZero(settings.bassReactivity * settings.intensity)
  )
}

export function hasCanvasSourceAnimation(settings: CanvasPresetSettings): boolean {
  return settings.stutterRate > 0.2
}

export function hasCanvasBaseTransform(engineSettings: CanvasEngineSettings): boolean {
  return (
    isNonZero(engineSettings.positionX) ||
    isNonZero(engineSettings.positionY) ||
    isNonZero(engineSettings.rotation) ||
    isNonZero(engineSettings.scale - 1)
  )
}

export function hasCanvasReactiveTransform(presetSettings: CanvasPresetSettings): boolean {
  return (
    isNonZero(presetSettings.bassReactivity * presetSettings.intensity) ||
    isNonZero(presetSettings.beatPulse * presetSettings.intensity) ||
    isNonZero(presetSettings.glitchAmount * presetSettings.intensity) ||
    isNonZero(presetSettings.motionAmount)
  )
}

export function hasCanvasSourceTransform(
  engineSettings: CanvasEngineSettings,
  presetSettings: CanvasPresetSettings,
): boolean {
  return hasCanvasBaseTransform(engineSettings) || hasCanvasReactiveTransform(presetSettings)
}

/**
 * Preset processing is rendered into a high-DPI transparent canvas above the
 * pristine browser video/image. This keeps a sharp source visible beneath every
 * recipe while preserving glow, smear, RGB, and reactive-motion character.
 */
export function hasCanvasEffectPass(presetSettings: CanvasPresetSettings): boolean {
  return hasCanvasSourceFilter(presetSettings) || hasCanvasReactiveTransform(presetSettings)
}

export function resolveCanvasEffectOpacity(settings: CanvasPresetSettings): number {
  if (!hasCanvasSourceFilter(settings) && !hasCanvasReactiveTransform(settings)) return 0

  const opacity = (
    settings.glow * 0.35 +
    settings.trailAmount * 0.18 +
    settings.rgbSplit * 0.18 +
    settings.glitchAmount * 0.2 +
    settings.motionAmount * 0.18 +
    settings.bassReactivity * settings.intensity * 0.18 +
    settings.beatPulse * settings.intensity * 0.08
  )

  return clampCanvasFidelityValue(opacity, 0.18, 0.72)
}

export function makeCanvasCaptureFilter(
  settings: CanvasPresetSettings,
  bass: number,
  high: number,
): string {
  if (!hasCanvasSourceFilter(settings)) return 'none'

  const blur = settings.motionAmount * 3.2 + settings.trailAmount * 1.4
  const brightness = 1 + settings.glow * 0.12 + bass * settings.bassReactivity * settings.intensity * 0.34
  const contrast = 1 + settings.glitchAmount * 0.16 + (1 - settings.lumaThreshold) * settings.motionAmount * 0.28
  const saturation = 1 + high * settings.rgbSplit * 0.9 + settings.glow * 0.14

  return `blur(${blur.toFixed(2)}px) brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)})`
}
