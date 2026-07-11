import type { UploadedMedia } from '../../../stores/mediaStore'
import { isUnifiedSvgMediaItem, resolveUnifiedSvgSource } from './svgSourceLifecycle'
import type { OscillatorSettings, ReactEngineId } from './ReactTypes'

export type ReactMediaSourceCapability = 'soundDrawingSvg'

export function getReactMediaSourceCapability(
  engineId: ReactEngineId,
): ReactMediaSourceCapability | null {
  return engineId === 'oscilloscope' ? 'soundDrawingSvg' : null
}

export function getReactMediaSourceId(
  capability: ReactMediaSourceCapability | null,
  oscillatorSettings: OscillatorSettings,
): string | null {
  if (capability !== 'soundDrawingSvg') return null
  return resolveUnifiedSvgSource(oscillatorSettings)?.mediaId ?? null
}

export function getReactMediaDisabledReason(
  capability: ReactMediaSourceCapability | null,
  media: UploadedMedia,
): string | null {
  if (capability === 'soundDrawingSvg') {
    return isUnifiedSvgMediaItem(media)
      ? null
      : 'Sound Drawing accepts SVG media only.'
  }
  return 'The active React engine does not consume generic media.'
}
