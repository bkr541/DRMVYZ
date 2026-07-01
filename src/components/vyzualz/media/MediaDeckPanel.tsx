import { memo } from 'react'
import { MediaLibraryBrowser } from './MediaLibraryBrowser'
import { MEDIA_DECK_CAPABILITIES } from './mediaLibraryCapabilities'

export interface MediaDeckPanelProps {
  activeMediaId: string | null
  onSelect: (id: string) => void
  mode?: 'visualizer' | 'react'
}

/**
 * Performance-deck adapter around the shared media-library browser.
 *
 * Keep this wrapper intentionally small: Visualizer and React retain the
 * complete legacy deck capability set while Media Manager can reuse the same
 * browser with a management-oriented shell.
 */
export const MediaDeckPanel = memo(function MediaDeckPanel({
  activeMediaId,
  onSelect,
  mode = 'visualizer',
}: MediaDeckPanelProps) {
  return (
    <MediaLibraryBrowser
      activeMediaId={activeMediaId}
      onSelect={onSelect}
      context={mode}
      title="Media Deck"
      capabilities={MEDIA_DECK_CAPABILITIES}
    />
  )
})
