import type { BuiltinModel } from '../models/domain/builtinModels'
import { AppIcon } from '../../components/shared/icons/AppIcon'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useAudioStore } from '../../stores/audioStore'
import { useMediaStore } from '../../stores/mediaStore'
import { useSharedDataActivity } from '../../stores/useSharedDataActivity'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'
import { ApplicationHeaderControls } from '../../components/vyzualz/layout/ApplicationWorkspaceFrame'
import { RailWindowHeader } from '../../components/vyzualz/layout/RailWindowHeader'
import { MediaLibraryBrowser } from '../../components/vyzualz/media/MediaLibraryBrowser'
import { MediaManagerStage } from '../../components/vyzualz/media/MediaManagerStage'
import { MediaManagerInspector, type MediaHeaderActions } from '../../components/vyzualz/media/MediaManagerInspector'
import { UnsavedMediaChangesDialog } from '../../components/vyzualz/media/UnsavedMediaChangesDialog'
import { selectMediaEditNeedsGuard, useMediaEditStore } from '../../stores/mediaEditStore'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { HeaderControlGroup } from '../../components/vyzualz/layout/HeaderControlGroup'
import { HeaderIconKey } from '../../components/vyzualz/layout/HeaderIconKey'
import { HeaderActionIcon } from '../../components/vyzualz/layout/HeaderActionIcon'
import { SaveGlyph, SaveAsGlyph } from '../../components/vyzualz/layout/HeaderGlyphs'
import { SaveAsPopover, type SaveAsInput } from '../../components/vyzualz/media/SaveAsPopover'
import { VyzualzHeaderActions } from '../../components/vyzualz/shared/VyzualzHeaderActions'
import type { LyricManagerNavigationIntent } from '../lyrics/lyricNavigation'
import { selectBuiltinModelEdited, selectModelCanGenerate, selectModelCanRevert, selectModelCanSave, selectModelCanSaveAs, selectModelEditorNeedsGuard, useModelEditorStore } from '../models/state/modelEditorStore'
import { fitModelViewport, resetModelCamera } from '../models/state/modelViewportBridge'
import type { MediaManagerSelection, ModelAsset } from '../models/domain/modelAssetTypes'
import type { UploadedMedia } from '../../stores/mediaStore'
import { UnsavedModelChangesDialog } from '../../components/vyzualz/media/UnsavedModelChangesDialog'
import { ConfirmDialog } from '../../components/vyzualz/react/controls/ConfirmDialog'
import { ModelCreateInspector } from '../../components/vyzualz/media/ModelCreateInspector'
import type { OscillatorFontAsset } from '../../components/vyzualz/react/ReactTypes'

const ModelEditorStage = lazy(() => import('../../components/vyzualz/media/ModelEditorStage').then(module => ({ default: module.ModelEditorStage })))

interface MediaManagerViewProps {
  onOpenLyricManager: (intent: LyricManagerNavigationIntent) => void
}

/** A model's title must be present and fit the stored limit. */
function validateModelName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a name for the new model.'
  return trimmed.length > 200 ? 'Use 200 characters or fewer.' : null
}

export function MediaManagerView({ onOpenLyricManager }: MediaManagerViewProps) {
  useSharedDataActivity('media-manager', ['media', 'audio'])
  const mediaItems = useMediaStore(state => state.items)
  const savedTracks = useAudioStore(state => state.savedTracks)
  const openCollectionEditor = useMediaStore(state => state.openCollectionEditor)
  const openImportMediaModal = useMediaStore(state => state.openImportMediaModal)

  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [selection, setSelection] = useState<MediaManagerSelection | null>(null)
  const [selectedFont, setSelectedFont] = useState<OscillatorFontAsset | null>(null)
  const [pending, setPending] = useState<{ commit(): void } | null>(null)
  const needsMediaGuard = useMediaEditStore(selectMediaEditNeedsGuard)
  const modelCanSave = useModelEditorStore(selectModelCanSave)
  const builtinModel = useModelEditorStore(state => state.builtinModel)
  const builtinEdited = useModelEditorStore(selectBuiltinModelEdited)
  const builtinExporting = useModelEditorStore(state => state.builtinExporting)
  const modelLoaded = useModelEditorStore(state => !!state.model)
  const modelGenerationPending = useModelEditorStore(state => state.generationPending)
  const modelCanGenerate = useModelEditorStore(selectModelCanGenerate)
  const modelId = useModelEditorStore(state => state.id), modelStatus = useModelEditorStore(state => state.status), modelAsset = useModelEditorStore(state => state.asset)
  const modelPendingSave = useModelEditorStore(state => !!state.publishedVersion || !!state.pendingOperationId || (!!state.saveTarget && state.saveTarget.id !== state.asset?.id))
  const modelError = useModelEditorStore(state => state.error)
  const [deleteModelOpen, setDeleteModelOpen] = useState(false)
  const [revertModelOpen, setRevertModelOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  // What a model copy starts from is read when the popover opens, so the view does not follow the model's tags and name while it is closed.
  const [modelCopyStart, setModelCopyStart] = useState<SaveAsInput>({ name: '', tags: [], collectionIds: [] })
  const modelCanSaveAs = useModelEditorStore(selectModelCanSaveAs)
  const modelCanRevert = useModelEditorStore(selectModelCanRevert)
  const needsModelGuard = useModelEditorStore(selectModelEditorNeedsGuard)
  const accountId = useMediaStore(state => state.accountId)
  const previousAccount = useRef(accountId)
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : 'none'
  const [headerState, setHeaderState] = useState<{ owner: string; actions: MediaHeaderActions | null } | null>(null)
  const receiveHeaderActions = useCallback((actions: MediaHeaderActions | null) => setHeaderState({ owner: selectionKey, actions }), [selectionKey])
  const headerActions = selection?.kind !== 'model' && headerState?.owner === selectionKey ? headerState.actions : null
  const mediaSaveAs = headerActions?.saveAs ?? null
  const selectedMediaId = selection?.kind === 'media' ? selection.id : null
  const selectedTrackId = selection?.kind === 'track' ? selection.id : null
  const selectedMedia = selectedMediaId ? mediaItems.find(item => item.id === selectedMediaId) ?? null : null
  const selectedTrack = selectedTrackId ? savedTracks.find(track => track.id === selectedTrackId) ?? null : null
  const modelSelected = selection?.kind === 'model'
  const modelBusy = modelStatus === 'saving' || modelStatus === 'deleting'
  // Save As and Revert are offered for images, videos and 3D models (not audio tracks or fonts); a shipped 3D model has neither (it has Restore Original).
  const showSaveAs = modelSelected ? !builtinModel : !!mediaSaveAs
  const showRevert = modelSelected ? !builtinModel : !!headerActions?.onRevert
  const modelDownloadDisabled = !modelLoaded || modelBusy || modelStatus === 'loading-model'
  const builtinActionsDisabled = !builtinEdited || builtinExporting || modelStatus === 'saving'
  const commitSelection = useCallback((next: MediaManagerSelection | null, font: OscillatorFontAsset | null = null) => {
    useModelEditorStore.getState().reset()
    setSelection(next); setSelectedFont(font)
    useMediaEditStore.getState().beginSession(next?.kind === 'media' ? next.id : null)
  }, [])
  const requestTransition = useCallback((commit: () => void) => {
    if (selectModelEditorNeedsGuard(useModelEditorStore.getState()) || selectMediaEditNeedsGuard(useMediaEditStore.getState())) setPending({ commit })
    else commit()
  }, [])
  const requestSelection = (next: MediaManagerSelection, font: OscillatorFontAsset | null = null) => {
    if (selection?.kind === next.kind && selection.id === next.id) return
    requestTransition(() => commitSelection(next, font))
  }
  const createFromImage = (media: UploadedMedia) => requestTransition(() => {
    useMediaEditStore.getState().endSession()
    const id = useModelEditorStore.getState().begin(media)
    setSelection({ kind: 'model', id }); setSelectedFont(null)
  })
  const selectBuiltinModel = (model: BuiltinModel) => {
    if (selection?.kind === 'model' && selection.id === model.id && useModelEditorStore.getState().status !== 'error') return
    requestTransition(() => {
      useMediaEditStore.getState().endSession()
      useModelEditorStore.getState().loadBuiltin(model); setSelection({kind:'model',id:model.id}); setSelectedFont(null)
    })
  }
  const selectModel = (asset: ModelAsset) => {
    if (selection?.kind === 'model' && selection.id === asset.id) return
    requestTransition(() => {
      useMediaEditStore.getState().endSession()
      useModelEditorStore.getState().load(asset); setSelection({ kind: 'model', id: asset.id }); setSelectedFont(null)
    })
  }
  useEffect(() => { setSaveAsOpen(false) }, [selectionKey])
  useEffect(() => { if (modelSelected && modelId !== selection.id) setSelection(modelId ? { kind: 'model', id: modelId } : null) }, [modelSelected, modelId, selection])
  const proceed = () => { const next = pending; setPending(null); next?.commit() }
  useEffect(() => {
    if (selectedMediaId && !selectedMedia) commitSelection(null)
  }, [selectedMedia, selectedMediaId, commitSelection])
  useEffect(() => {
    if (previousAccount.current !== accountId) { previousAccount.current = accountId; setPending(null); commitSelection(null) }
  }, [accountId, commitSelection])
  useEffect(() => () => { useMediaEditStore.getState().endSession(); useModelEditorStore.getState().reset() }, [])
  useEffect(() => {
    if (!needsMediaGuard && !needsModelGuard) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [needsMediaGuard, needsModelGuard])


  return (
    <main className="mmv-root" aria-label="Media Manager">
      <ApplicationHeaderControls fallbackWhenUnavailable>
        <header className="mmv-header">
          <HeaderControlGroup label="Media Manager controls">
            <HeaderIconKey
              label="New Collection"
              icon={<HeaderActionIcon action="createCollection" />}
              onClick={() => openCollectionEditor()}
            />
            <HeaderIconKey
              label="New Media"
              title="Add Media"
              icon={<HeaderActionIcon action="create" />}
              onClick={() => openImportMediaModal()}
            />
            {modelSelected && <>
              {!builtinModel && <HeaderIconKey label={modelLoaded ? 'Regenerate 3D Model' : 'Generate 3D Model'} title={modelCanGenerate ? undefined : 'Available once the source is prepared (and its foreground confirmed)'} icon={<AppIcon kind="wand" size={15} />} disabled={!modelCanGenerate} onClick={() => { void useModelEditorStore.getState().generate() }} />}
              <HeaderIconKey label="Fit Model" title="Fit the model in the viewport" icon={<AppIcon kind="cameraFocus" size={15} />} disabled={!modelLoaded} onClick={fitModelViewport} />
              <HeaderIconKey label="Reset Camera" title="Reset the viewport camera" icon={<HeaderActionIcon action="reset" />} disabled={!modelLoaded} onClick={resetModelCamera} />
            </>}
            <HeaderIconKey
              label="Save Changes"
              title={modelSelected ? modelStatus === 'saving' ? 'Saving model…' : builtinModel ? 'Save model tags and collections' : 'Save model changes' : headerActions?.saving ? 'Saving…' : 'Save the changes made on the Info tab'}
              icon={<SaveGlyph />}
              disabled={modelSelected ? !modelCanSave : !headerActions || headerActions.saving || !headerActions.canSave}
              onClick={() => { if (modelSelected) void useModelEditorStore.getState().save(); else headerActions?.onSave() }}
            />
            {showSaveAs && <HeaderIconKey
              label="Save As"
              title={modelSelected ? (modelCanSaveAs ? 'Save as a new model; the original stays as it is' : 'Save As is available once the model is ready') : (mediaSaveAs?.unavailable ?? 'Save the edited result as a new item; the original stays as it is')}
              icon={<SaveAsGlyph />}
              disabled={modelSelected ? !modelCanSaveAs : !mediaSaveAs || mediaSaveAs.unavailable !== null || mediaSaveAs.busy}
              onClick={() => {
                if (!saveAsOpen) {
                  mediaSaveAs?.clearError()
                  if (modelSelected) {
                    const state = useModelEditorStore.getState()
                    const twoSided = state.asset?.kind === 'imported' ? !!state.builtinEdit?.values.twoSided : !!state.recipe?.twoSided
                    setModelCopyStart({ name: `${state.name}${twoSided ? ' (two-sided)' : ' copy'}`, tags: [...state.tags], collectionIds: [...state.collectionIds] })
                  }
                }
                setSaveAsOpen(open => !open)
              }}
            />}
            {showRevert && <HeaderIconKey
              label="Revert"
              title={modelSelected ? (modelAsset ? 'Revert to the saved version, discarding unsaved changes' : 'Reset the model, discarding unsaved changes') : 'Discard unsaved changes to this item'}
              icon={<HeaderActionIcon action="restore" />}
              disabled={modelSelected ? !(modelCanRevert || (!!modelError && !!modelAsset && !modelBusy)) : !headerActions?.canRevert}
              onClick={() => { if (modelSelected) setRevertModelOpen(true); else headerActions?.onRevert?.() }}
            />}
            <HeaderIconKey
              label="Delete Media"
              title={modelSelected ? 'Delete this model and its versions' : 'Delete this media item'}
              icon={<HeaderActionIcon action="delete" />}
              danger
              disabled={modelSelected ? !modelAsset || modelBusy || modelPendingSave : !headerActions?.onDelete || headerActions.deleting}
              onClick={() => { if (modelSelected) setDeleteModelOpen(true); else headerActions?.onDelete?.() }}
            />
            {modelSelected && builtinModel && <>
              <HeaderIconKey
                label="Download Edited GLB"
                title={builtinExporting ? 'Preparing GLB…' : undefined}
                icon={<HeaderActionIcon action="download" />}
                disabled={builtinActionsDisabled}
                onClick={() => { void useModelEditorStore.getState().download('glb') }}
              />
              <HeaderIconKey
                label="Restore Original"
                icon={<HeaderActionIcon action="restore" />}
                disabled={builtinActionsDisabled}
                onClick={() => useModelEditorStore.getState().resetBuiltinEdits()}
              />
            </>}
            {modelSelected && !builtinModel && <>
              <HeaderIconKey
                label={modelAsset?.kind === 'imported' ? (builtinEdited ? 'Download Edited GLB' : 'Download Original GLB') : 'Download GLB'}
                icon={<HeaderActionIcon action="download" />}
                disabled={modelDownloadDisabled || modelGenerationPending}
                onClick={() => { void useModelEditorStore.getState().download('glb') }}
              />
              <HeaderIconKey
                label="Download Preview PNG"
                icon={<HeaderActionIcon action="capture" />}
                disabled={modelDownloadDisabled}
                onClick={() => { void useModelEditorStore.getState().download('png') }}
              />
            </>}
          </HeaderControlGroup>
          <div className="mmv-summary">
            <VyzualzHeaderActions page="media-manager" />
          </div>
        </header>
      </ApplicationHeaderControls>

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
            className="rw-frame--left fw-surface"
          >
            <RailWindowHeader
              side="left"
              icon={<AppIcon kind="layers" size={15} color="currentColor" aria-hidden="true" />}
              label="Media Library"
            />
            <MediaLibraryBrowser
              activeMediaId={selectedMediaId}
              onSelect={id => requestSelection({ kind: 'media', id })}
              activeModelId={modelSelected ? selection.id : null}
              onSelectModel={selectModel}
              onSelectBuiltinModel={selectBuiltinModel}
              activeTrackId={selectedTrackId}
              onSelectTrack={track => requestSelection({ kind: 'track', id: track.id })}
              activeFontId={selection?.kind === 'font' ? selection.id : null}
              onSelectFont={font => requestSelection({ kind: 'font', id: font.id }, font)}
              context="manager"
              title="Media Library"
              hideInternalHeader
              capabilities={MEDIA_MANAGER_CAPABILITIES}
              onOpenLyricManager={onOpenLyricManager}
            />
          </WorkspaceRail>

          <div className="mmv-stage-area fw-surface" aria-label="Selected media preview">
            {modelSelected ? <Suspense fallback={<div role="status">Loading 3D viewport…</div>}><ModelEditorStage /></Suspense> : <MediaManagerStage media={selectedMedia} track={selectedTrack} font={selectedFont} />}
          </div>

          <WorkspaceRail
            side="right"
            label="Media Manager details"
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed(value => !value)}
            className="rw-frame--right fw-surface"
          >
            {modelSelected ? <ModelCreateInspector onSelectSource={mediaItems.some(item => item.dbId === useModelEditorStore.getState().sourceMediaId) ? () => { const source = mediaItems.find(item => item.dbId === useModelEditorStore.getState().sourceMediaId); if (source) requestSelection({ kind: 'media', id: source.id }) } : undefined} /> : <MediaManagerInspector
              media={selectedMedia}
              track={selectedTrack}
              font={selectedFont}
              onMediaCreated={id => commitSelection({ kind: 'media', id })}
              onCreateModel={createFromImage}
              onFontRenamed={setSelectedFont}
              onHeaderActions={receiveHeaderActions}
            />}
          </WorkspaceRail>
        </div>
      </section>
      {showSaveAs && saveAsOpen && <SaveAsPopover
        description={modelSelected ? 'Create a separate model with its own version history. The original stays exactly as it is.' : 'Save the edited result as a new media item. The original stays exactly as it is.'}
        initial={modelSelected ? modelCopyStart : mediaSaveAs?.initial ?? { name: '', tags: [], collectionIds: [] }}
        validateName={modelSelected ? validateModelName : name => mediaSaveAs?.validateName(name) ?? null}
        busy={modelSelected ? modelStatus === 'saving' : !!mediaSaveAs?.busy}
        error={modelSelected ? modelError : mediaSaveAs?.error ?? null}
        onCancel={() => setSaveAsOpen(false)}
        onSubmit={(input: SaveAsInput) => {
          if (modelSelected) void useModelEditorStore.getState().save(input.name, { tags: input.tags, collectionIds: input.collectionIds }).then(outcome => { if (outcome.ok) setSaveAsOpen(false) })
          else void mediaSaveAs?.submit(input).then(saved => { if (saved) setSaveAsOpen(false) })
        }}
      />}
      {revertModelOpen && <ConfirmDialog title={modelAsset ? 'Revert to saved version?' : 'Reset model?'} message="Your unsaved changes to this model will be discarded." confirmLabel={modelAsset ? 'Revert' : 'Reset'}
        onCancel={() => setRevertModelOpen(false)}
        onConfirm={() => { const state = useModelEditorStore.getState(); if (state.error && state.asset) void state.reloadLatest(); else state.revert(); setRevertModelOpen(false) }} />}
      {deleteModelOpen && <ConfirmDialog title="Delete 3D Model" message="Delete this model, all versions and unsaved edits? Projects or presets referring to it will show a missing-model warning."
        confirmLabel={modelAsset?.status === 'deletion_pending' ? 'Retry Delete' : 'Delete'} busy={modelStatus === 'deleting'} notice={modelError ?? undefined} noticeTitle="Deletion incomplete" noticeTone="error"
        onCancel={() => setDeleteModelOpen(false)} onConfirm={() => { void useModelEditorStore.getState().deleteModel().then(ok => { if (ok) setDeleteModelOpen(false) }) }} />}
      {needsModelGuard ? <UnsavedModelChangesDialog open={pending !== null} onCancel={() => setPending(null)} onProceed={proceed} />
        : <UnsavedMediaChangesDialog open={pending !== null} onCancel={() => setPending(null)} onProceed={proceed} />}

    </main>
  )
}
