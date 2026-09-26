import { useCallback, useEffect, useState } from 'react'
import { Layers01Icon, FolderAddIcon, Add01Icon, Delete02Icon } from 'hugeicons-react'
import { useAudioStore } from '../../stores/audioStore'
import { useMediaStore } from '../../stores/mediaStore'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'
import { RailWindowHeader } from '../../components/vyzualz/layout/RailWindowHeader'
import { MediaLibraryBrowser } from '../../components/vyzualz/media/MediaLibraryBrowser'
import { MediaManagerStage } from '../../components/vyzualz/media/MediaManagerStage'
import { PageHeadingPlate, MediaHeadingIcon } from '../../components/vyzualz/layout/PageHeadingPlate'
import { MediaManagerInspector, type MediaHeaderActions } from '../../components/vyzualz/media/MediaManagerInspector'
import { UnsavedMediaChangesDialog } from '../../components/vyzualz/media/UnsavedMediaChangesDialog'
import { selectMediaEditNeedsGuard, useMediaEditStore } from '../../stores/mediaEditStore'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { HeaderControlGroup } from '../../components/vyzualz/layout/HeaderControlGroup'
import { VyzualzHeaderActions } from '../../components/vyzualz/shared/VyzualzHeaderActions'
import { IconChipButton } from '../../components/vyzualz/react/controls/IconChipButton'
import type { LyricManagerNavigationIntent } from '../lyrics/lyricNavigation'

interface MediaManagerViewProps {
  onOpenLyricManager: (intent: LyricManagerNavigationIntent) => void
}

export function MediaManagerView({ onOpenLyricManager }: MediaManagerViewProps) {
  const mediaItems = useMediaStore(state => state.items)
  const savedTracks = useAudioStore(state => state.savedTracks)
  const openCollectionEditor = useMediaStore(state => state.openCollectionEditor)
  const openImportMediaModal = useMediaStore(state => state.openImportMediaModal)

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  // A selection that would replace unsaved edits waits here until the user decides.
  const [pendingSelection, setPendingSelection] = useState<{ mediaId: string | null; trackId: string | null } | null>(null)
  const needsGuard = useMediaEditStore(selectMediaEditNeedsGuard)
  // The Info tab owns the draft; the header's centre group owns the buttons that act on it.
  const [headerActions, setHeaderActions] = useState<MediaHeaderActions | null>(null)

  const selectedMedia = selectedMediaId ? mediaItems.find(item => item.id === selectedMediaId) ?? null : null
  const selectedTrack = selectedTrackId ? savedTracks.find(track => track.id === selectedTrackId) ?? null : null

  /** Loads a selection and starts its edit session from a clean baseline. */
  const commitSelection = useCallback((mediaId: string | null, trackId: string | null) => {
    setSelectedMediaId(mediaId)
    setSelectedTrackId(trackId)
    useMediaEditStore.getState().beginSession(mediaId)
  }, [])

  const requestSelection = useCallback((mediaId: string | null, trackId: string | null) => {
    const store = useMediaEditStore.getState()
    const sameMedia = mediaId !== null && mediaId === store.mediaId
    if (selectMediaEditNeedsGuard(store) && !sameMedia) {
      setPendingSelection({ mediaId, trackId })
      return
    }
    commitSelection(mediaId, trackId)
  }, [commitSelection])

  // The edited item disappearing (deleted elsewhere) ends its session.
  useEffect(() => {
    if (selectedMediaId && !selectedMedia) commitSelection(null, selectedTrackId)
  }, [selectedMedia, selectedMediaId, selectedTrackId, commitSelection])

  // Leaving Media Manager for good drops the session; the navigation guard has already resolved any edits.
  useEffect(() => () => { useMediaEditStore.getState().endSession() }, [])

  // Closing or reloading the window with unsaved edits asks for confirmation.
  useEffect(() => {
    if (!needsGuard) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [needsGuard])

  return (
    <main className="mmv-root" aria-labelledby="media-manager-title">
      <header className="mmv-header">
        <div className="mmv-header-left">
          <PageHeadingPlate titleAs="h1" titleId="media-manager-title" title="Media Manager" icon={<MediaHeadingIcon />} />
        </div>
        <HeaderControlGroup label="Media Manager controls">
          <IconChipButton
            tone="primary"
            onClick={() => headerActions?.onSave()}
            disabled={!headerActions || headerActions.saving}
            title="Save the changes made on the Info tab"
          >
            {headerActions?.saving ? 'Saving…' : 'Save Changes'}
          </IconChipButton>
          <IconChipButton
            className="dv-icon-chip--danger"
            icon={<Delete02Icon size={13} color="currentColor" />}
            onClick={() => headerActions?.onDelete?.()}
            disabled={!headerActions?.onDelete || headerActions.deleting}
            title="Delete this media item"
          >
            Delete Media
          </IconChipButton>
        </HeaderControlGroup>
        <div className="mmv-summary">
          <VyzualzHeaderActions />
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
            className="rw-frame--left"
          >
            <RailWindowHeader
              side="left"
              icon={<Layers01Icon size={15} color="currentColor" aria-hidden="true" />}
              label="Media Library"
              actions={
                <>
                  <IconChipButton
                    icon={<FolderAddIcon size={14} color="currentColor" />}
                    onClick={() => openCollectionEditor()}
                    title="New Collection"
                    aria-label="New Collection"
                  />
                  <IconChipButton
                    tone="primary"
                    icon={<Add01Icon size={14} color="currentColor" />}
                    onClick={() => openImportMediaModal()}
                    title="New Media"
                    aria-label="New Media"
                  />
                </>
              }
            />
            <MediaLibraryBrowser
              activeMediaId={selectedMediaId}
              onSelect={id => requestSelection(id, null)}
              activeTrackId={selectedTrackId}
              onSelectTrack={track => requestSelection(null, track.id)}
              context="manager"
              title="Media Library"
              hideInternalHeader
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
            className="rw-frame--right"
          >
            <MediaManagerInspector
              media={selectedMedia}
              track={selectedTrack}
              onMediaCreated={id => commitSelection(id, null)}
              onHeaderActions={setHeaderActions}
            />
          </WorkspaceRail>
        </div>
      </section>
      <UnsavedMediaChangesDialog
        open={pendingSelection !== null}
        onCancel={() => setPendingSelection(null)}
        onProceed={() => {
          const next = pendingSelection
          setPendingSelection(null)
          if (next) commitSelection(next.mediaId, next.trackId)
        }}
      />
    </main>
  )
}
