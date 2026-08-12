import { useAudioStore } from '../../stores/audioStore'
import { useMediaStore } from '../../stores/mediaStore'
import { MediaLibraryBrowser } from '../../components/vyzualz/media/MediaLibraryBrowser'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import type { LyricManagerNavigationIntent } from '../lyrics/lyricNavigation'

interface MediaManagerViewProps {
  onOpenLyricManager: (intent: LyricManagerNavigationIntent) => void
}

export function MediaManagerView({ onOpenLyricManager }: MediaManagerViewProps) {
  const mediaCount = useMediaStore(state => state.items.length)
  const collectionCount = useMediaStore(state => state.collections.length)
  const trackCount = useAudioStore(state => state.savedTracks.length)

  return (
    <main className="mmv-root" aria-labelledby="media-manager-title">
      <header className="mmv-header">
        <div className="mmv-header-left">
          <div className="mmv-header-title-group">
            <h1 id="media-manager-title" className="mmv-header-title">Media Manager</h1>
            <p className="mmv-header-subtitle">
              Upload, preview, edit, organize, and safely remove the visual and audio media shared by every DRMVYZ performance view.
            </p>
          </div>
        </div>
        <div className="mmv-summary" aria-label="Media library summary">
          <span><strong>{mediaCount}</strong> visual {mediaCount === 1 ? 'asset' : 'assets'}</span>
          <span><strong>{trackCount}</strong> audio {trackCount === 1 ? 'track' : 'tracks'}</span>
          <span><strong>{collectionCount}</strong> {collectionCount === 1 ? 'collection' : 'collections'}</span>
        </div>
      </header>

      <section className="mmv-workspace" aria-label="Media management workspace">
        <MediaLibraryBrowser
          activeMediaId={null}
          context="manager"
          title="Media Library"
          capabilities={MEDIA_MANAGER_CAPABILITIES}
          onOpenLyricManager={onOpenLyricManager}
        />
      </section>
    </main>
  )
}
