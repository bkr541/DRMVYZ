import { useState } from 'react'
import { useAudioStore } from '../../stores/audioStore'
import { useMediaStore } from '../../stores/mediaStore'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'
import { MediaLibraryBrowser } from '../../components/vyzualz/media/MediaLibraryBrowser'
import { MediaManagerStage } from '../../components/vyzualz/media/MediaManagerStage'
import { MediaManagerInspector } from '../../components/vyzualz/media/MediaManagerInspector'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { IconChipButton } from '../../components/vyzualz/react/controls/IconChipButton'
import type { LyricManagerNavigationIntent } from '../lyrics/lyricNavigation'

interface MediaManagerViewProps {
  onOpenLyricManager: (intent: LyricManagerNavigationIntent) => void
}

export function MediaManagerView({ onOpenLyricManager }: MediaManagerViewProps) {
  const mediaCount = useMediaStore(state => state.items.length)
  const collectionCount = useMediaStore(state => state.collections.length)
  const trackCount = useAudioStore(state => state.savedTracks.length)
  const mediaItems = useMediaStore(state => state.items)
  const savedTracks = useAudioStore(state => state.savedTracks)
  const openCollectionEditor = useMediaStore(state => state.openCollectionEditor)
  const openImportMediaModal = useMediaStore(state => state.openImportMediaModal)

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

  const selectedMedia = selectedMediaId ? mediaItems.find(item => item.id === selectedMediaId) ?? null : null
  const selectedTrack = selectedTrackId ? savedTracks.find(track => track.id === selectedTrackId) ?? null : null

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
          <IconChipButton onClick={() => openCollectionEditor()}>New Collection</IconChipButton>
          <IconChipButton
            tone="primary"
            onClick={() => openImportMediaModal()}
            icon={
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            }
          >
            New Media
          </IconChipButton>
        </div>
      </header>

      <section className="mmv-workspace" aria-label="Media management workspace">
        <div
          className="vz-content mmv-content"
          data-left-collapsed={leftCollapsed ? 'true' : 'false'}
          data-right-collapsed={rightCollapsed ? 'true' : 'false'}
        >
          <WorkspaceRail
            side="left"
            label="Media Manager library"
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed(value => !value)}
          >
            <MediaLibraryBrowser
              activeMediaId={selectedMediaId}
              onSelect={id => { setSelectedMediaId(id); setSelectedTrackId(null) }}
              activeTrackId={selectedTrackId}
              onSelectTrack={track => { setSelectedTrackId(track.id); setSelectedMediaId(null) }}
              context="manager"
              title="Media Library"
              capabilities={MEDIA_MANAGER_CAPABILITIES}
              onOpenLyricManager={onOpenLyricManager}
            />
          </WorkspaceRail>

          <div className="mmv-stage-area" aria-label="Selected media preview">
            <MediaManagerStage media={selectedMedia} track={selectedTrack} />
          </div>

          <WorkspaceRail
            side="right"
            label="Media Manager details"
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed(value => !value)}
          >
            <MediaManagerInspector media={selectedMedia} track={selectedTrack} />
          </WorkspaceRail>
        </div>
      </section>
    </main>
  )
}
