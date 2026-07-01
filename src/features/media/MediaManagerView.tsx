import { useAudioStore } from '../../stores/audioStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useVisualStore } from '../../stores/visualStore'
import type { PerformanceAppView } from '../../components/vyzualz/appView'
import { APP_VIEW_LABELS } from '../../components/vyzualz/appView'
import { MediaLibraryBrowser } from '../../components/vyzualz/media/MediaLibraryBrowser'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'

interface MediaManagerViewProps {
  onBack: () => void
  returnView: PerformanceAppView
}

export function MediaManagerView({ onBack, returnView }: MediaManagerViewProps) {
  const activeMediaId = useVisualStore(state => state.activeMediaId)
  const setActiveMedia = useVisualStore(state => state.setActiveMedia)
  const mediaCount = useMediaStore(state => state.items.length)
  const collectionCount = useMediaStore(state => state.collections.length)
  const trackCount = useAudioStore(state => state.savedTracks.length)

  return (
    <main className="mmv-root" aria-labelledby="media-manager-title">
      <header className="mmv-header">
        <div className="mmv-header-left">
          <button
            type="button"
            className="lmv-back-btn"
            onClick={onBack}
            aria-label={`Return to ${APP_VIEW_LABELS[returnView]}`}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z" />
            </svg>
            {APP_VIEW_LABELS[returnView]}
          </button>
          <div className="mmv-header-title-group">
            <h1 id="media-manager-title" className="mmv-header-title">Media Manager</h1>
            <p className="mmv-header-subtitle">
              Browse, preview, organize, and load the media shared by every DRMVYZ performance view.
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
        <div className="mmv-guidance">
          <div>
            <strong>One library, two stages.</strong>
            <span>Changes here use the same media, audio, upload, preview, and collection state as Visualizer and React.</span>
          </div>
          <span className="mmv-foundation-badge">Foundation mode</span>
        </div>
        <MediaLibraryBrowser
          activeMediaId={activeMediaId}
          onSelect={setActiveMedia}
          context="manager"
          title="Media Library"
          capabilities={MEDIA_MANAGER_CAPABILITIES}
        />
      </section>
    </main>
  )
}
