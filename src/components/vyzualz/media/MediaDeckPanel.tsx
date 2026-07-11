import { memo } from 'react'
import { MediaLibraryBrowser } from './MediaLibraryBrowser'
import { MEDIA_DECK_CAPABILITIES } from './mediaLibraryCapabilities'
import type { UploadedMedia } from '../../../stores/mediaStore'

export interface MediaDeckPanelProps {
  activeMediaId: string | null
  onSelect: (id: string) => void
  mode?: 'visualizer' | 'react'
  onOpenMediaManager?: () => void
  title?: string
  getDisabledReason?: (media: UploadedMedia) => string | null
}

/**
 * Performance-deck adapter around the shared media-library browser.
 *
 * Keep this wrapper intentionally small so Visualizer and React always share
 * the same performance-only capability contract.
 */
export const MediaDeckPanel = memo(function MediaDeckPanel({
  activeMediaId,
  onSelect,
  mode = 'visualizer',
  onOpenMediaManager,
  title = 'Media Deck',
  getDisabledReason,
}: MediaDeckPanelProps) {
  return (
    <MediaLibraryBrowser
      activeMediaId={activeMediaId}
      onSelect={onSelect}
      context={mode}
      title={title}
      capabilities={MEDIA_DECK_CAPABILITIES}
      onOpenMediaManager={onOpenMediaManager}
      getDisabledReason={getDisabledReason}
    />
  )
})
