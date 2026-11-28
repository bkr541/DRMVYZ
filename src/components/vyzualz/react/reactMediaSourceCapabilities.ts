import type { UploadedMedia } from '../../../stores/mediaStore'
import type { ReactEngineId } from './ReactTypes'
import type { PixGridState } from './pixGrid/PixGridTypes'
import { getPixGridMediaDisabledReason } from './pixGrid/PixGridMediaCapabilities'

export type ReactMediaSourceCapability = 'pixGridStill'

export function getReactMediaSourceCapability(
  engineId: ReactEngineId,
): ReactMediaSourceCapability | null {
  if (engineId === 'pixGrid') return 'pixGridStill'
  return null
}

export function getReactMediaSourceId(
  capability: ReactMediaSourceCapability | null,
  pixGridState?: PixGridState,
): string | null {
  if (capability === 'pixGridStill') return pixGridState?.conversion.selectedMediaId ?? null
  return null
}

export function getReactMediaDisabledReason(
  capability: ReactMediaSourceCapability | null,
  media: UploadedMedia,
): string | null {
  if (capability === 'pixGridStill') return getPixGridMediaDisabledReason(media)
  return 'The active React engine does not consume generic media.'
}
