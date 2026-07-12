import type { CanvasEngineSettings, CanvasPresetSettings } from './ReactTypes'

const CANVAS_RENDER_EPSILON = 0.001

function isNonZero(value: number): boolean {
  return Math.abs(value) > CANVAS_RENDER_EPSILON
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
 * Returns true only when the source itself needs CSS/canvas filter processing.
 * Keeping neutral playback on `filter: none` preserves Chromium's direct video
 * presentation path, especially on high-DPI displays.
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

export function hasCanvasSourceTransform(
  engineSettings: CanvasEngineSettings,
  presetSettings: CanvasPresetSettings,
): boolean {
  const hasStaticTransform = (
    isNonZero(engineSettings.positionX) ||
    isNonZero(engineSettings.positionY) ||
    isNonZero(engineSettings.rotation) ||
    isNonZero(engineSettings.scale - 1)
  )
  const hasReactiveTransform = (
    isNonZero(presetSettings.bassReactivity * presetSettings.intensity) ||
    isNonZero(presetSettings.beatPulse * presetSettings.intensity) ||
    isNonZero(presetSettings.glitchAmount * presetSettings.intensity) ||
    isNonZero(presetSettings.motionAmount)
  )
  return hasStaticTransform || hasReactiveTransform
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
