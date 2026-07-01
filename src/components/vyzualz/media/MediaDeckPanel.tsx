import { memo } from 'react'
import { MediaLibraryBrowser } from './MediaLibraryBrowser'
import { MEDIA_DECK_CAPABILITIES } from './mediaLibraryCapabilities'

export interface MediaDeckPanelProps {
  activeMediaId: string | null
  onSelect: (id: string) => void
  mode?: 'visualizer' | 'react'
  onOpenMediaManager?: () => void
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
}: MediaDeckPanelProps) {
  return (
    <MediaLibraryBrowser
      activeMediaId={activeMediaId}
      onSelect={onSelect}
      context={mode}
      title="Media Deck"
      capabilities={MEDIA_DECK_CAPABILITIES}
      onOpenMediaManager={onOpenMediaManager}
    />
  )
})
