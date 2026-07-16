import type { UploadedMedia } from '../../../stores/mediaStore'
import { isUnifiedSvgMediaItem, resolveUnifiedSvgSource } from './svgSourceLifecycle'
import type { OscillatorSettings, ReactEngineId } from './ReactTypes'
import type { PixGridState } from './pixGrid/PixGridTypes'
import { getPixGridMediaDisabledReason } from './pixGrid/PixGridMediaCapabilities'

export type ReactMediaSourceCapability = 'soundDrawingSvg' | 'pixGridStill'

export function getReactMediaSourceCapability(
  engineId: ReactEngineId,
): ReactMediaSourceCapability | null {
  if (engineId === 'oscilloscope') return 'soundDrawingSvg'
  if (engineId === 'pixGrid') return 'pixGridStill'
  return null
}

export function getReactMediaSourceId(
  capability: ReactMediaSourceCapability | null,
  oscillatorSettings: OscillatorSettings,
  pixGridState?: PixGridState,
): string | null {
  if (capability === 'soundDrawingSvg') return resolveUnifiedSvgSource(oscillatorSettings)?.mediaId ?? null
  if (capability === 'pixGridStill') return pixGridState?.conversion.selectedMediaId ?? null
  return null
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
  if (capability === 'pixGridStill') return getPixGridMediaDisabledReason(media)
  return 'The active React engine does not consume generic media.'
}
