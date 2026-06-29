import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useLyricsStore } from '../../stores/lyricsStore'
import {
  deleteLyricDocument,
  getFullLyricDocument,
  updateLyricDocument,
} from '../../lib/lyricsDb'
import { useAudioStore } from '../../stores/audioStore'
import type { SavedAudioTrack } from '../../stores/audioStore'
import { useSharedAudio } from '../../context/AudioEngineContext'
import type { LyricSectionType } from '../../types/lyrics'
import type { LyricDocumentImportResult } from './utils/lyricDocumentImport'
import type {
  LyricDocumentVersion,
  LyricManagerTrack,
} from './lyricManagerTypes'
import {
  getLegacyLyricDocumentVersions,
  getLyricDocumentVersionsForTracks,
  loadLyricManagerTrackPage,
} from './services/lyricManagerData'
import { LyricManagerHeader } from './components/LyricManagerHeader'
import { LyricTrackBrowser } from './components/LyricTrackBrowser'
import { LyricDocumentSidebar } from './components/LyricDocumentSidebar'
import { ManualLyricEditor } from './components/ManualLyricEditor'
import { JsonLyricImporter } from './components/JsonLyricImporter'
import { AiLyricExtractor } from './components/AiLyricExtractor'
import { LyricPreviewPanel } from './components/LyricPreviewPanel'
import { UnsavedLyricChangesDialog } from './components/UnsavedLyricChangesDialog'
import { ConfirmLyricDeleteDialog } from './components/ConfirmLyricDeleteDialog'
import { MediaUploadModal } from '../../components/vyzualz/MediaUploadModal'

type WorkflowTab = 'manual' | 'json' | 'ai'

interface Props {
  onBack: () => void
}

const PAGE_SIZE = 18

const TAB_LABELS: { id: WorkflowTab; label: string }[] = [
  { id: 'manual', label: 'Manual Entry' },
  { id: 'json', label: 'Import Lyrics' },
  { id: 'ai', label: 'AI Extract' },
]

function toLyricSectionType(type: string): LyricSectionType {
  if (type === 'preDrop') return 'build'
  if (
    type === 'intro' || type === 'verse' || type === 'build' ||
    type === 'drop' || type === 'breakdown' || type === 'bridge' || type === 'outro'
  ) return type
  return 'unknown'
}

function uploadedTrackToManager(track: SavedAudioTrack): LyricManagerTrack {
  return {
    ...track,
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  }
}

function mergeTracks(
  current: LyricManagerTrack[],
  incoming: LyricManagerTrack[],
): LyricManagerTrack[] {
  const merged = new Map(current.map((track) => [track.dbId, track]))
  for (const track of incoming) merged.set(track.dbId, track)
  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export function LyricManagerView({ onBack }: Props) {
  const {
    lyricsEnabled,
    setLyricsEnabled,
    activeDocument,
    activeDocumentId,
    cues: storeCues,
    setCues,
    selectedCueId,
    selectCue,
    isLoading,
    isSaving,
    error,
    setError,
    draftTitle,
    draftArtist,
    globalOffsetMs,
    setDraftTitle,
    setDraftArtist,
    setGlobalOffsetMs,
    updateDraftDefaultStyle,
    updateDraftDefaultAnimation,
    updateDraftDefaultEffects,
    saveActiveLyricDocument,
    setActiveDocument,
    loadLyricDocument,
    setDraftSourceMeta,
    activateLyricDocument,
    beginEditorSession,
    endEditorSession,
    editorDirty,
    markEditorDirty,
    preserveDraftForNextEditorExit,
  } = useLyricsStore()

  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine
  const getSignedUrl = useAudioStore((state) => state.getSignedUrl)

  const [currentAudioTimeMs, setCurrentAudioTimeMs] = useState<number | null>(null)
  const [tracks, setTracks] = useState<LyricManagerTrack[]>([])
  const [trackTotal, setTrackTotal] = useState(0)
  const [trackSearch, setTrackSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tracksLoading, setTracksLoading] = useState(false)
  const [tracksError, setTracksError] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<LyricManagerTrack | null>(
    null,
  )
  const [documents, setDocuments] = useState<LyricDocumentVersion[]>([])
  const [legacyDocuments, setLegacyDocuments] = useState<
    LyricDocumentVersion[]
  >([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkflowTab>('manual')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [pendingTransition, setPendingTransition] = useState<{
    message: string
    action: () => void | Promise<void>
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LyricDocumentVersion | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const loadGeneration = useRef(0)

  useEffect(() => {
    beginEditorSession()
    return () => endEditorSession()
  }, [beginEditorSession, endEditorSession])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useLyricsStore.getState().editorDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const currentEngine = engineRef.current
      setCurrentAudioTimeMs(
        currentEngine.duration > 0
          ? Math.round(currentEngine.currentTime * 1000)
          : null,
      )
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(trackSearch.trim()), 250)
    return () => clearTimeout(id)
  }, [trackSearch])

  const showStatus = useCallback((message: string) => {
    setStatusMsg(message)
    window.setTimeout(() => setStatusMsg(null), 3000)
  }, [])

  const prepareTrackDraft = useCallback(
    (
      track: LyricManagerTrack,
      dirty = false,
      activateOnSave = track.activeLyricDocumentId === null,
    ) => {
      setActiveDocument(null, [], track.dbId)
      useLyricsStore.setState({
        draftTitle: track.title,
        draftArtist: track.artist ?? '',
        draftSourceType: null,
        draftSourceFormat: null,
        draftRawSourceText: null,
        draftMetadata: null,
        editorDirty: dirty,
        draftActivateOnSave: activateOnSave,
      })
      selectCue(null)
    },
    [selectCue, setActiveDocument],
  )

  const loadTracks = useCallback(
    async (reset: boolean) => {
      if (!supabaseConfigured) {
        setTracksError('Supabase is not configured.')
        return
      }
      const generation = ++loadGeneration.current
      setTracksLoading(true)
      setTracksError(null)
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) throw new Error('Sign in to view stored audio tracks.')
        const offset = reset ? 0 : tracks.length
        const page = await loadLyricManagerTrackPage(data.user.id, {
          offset,
          limit: PAGE_SIZE,
          search: debouncedSearch,
        })
        if (generation !== loadGeneration.current) return
        setTrackTotal(page.total)
        setTracks((current) =>
          reset ? page.tracks : mergeTracks(current, page.tracks),
        )
      } catch (loadError) {
        if (generation !== loadGeneration.current) return
        setTracksError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load stored tracks.',
        )
      } finally {
        if (generation === loadGeneration.current) setTracksLoading(false)
      }
    },
    [debouncedSearch, tracks.length],
  )

  useEffect(() => {
    void loadTracks(true)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      try {
        setLegacyDocuments(await getLegacyLyricDocumentVersions(data.user.id))
      } catch {
        // Legacy documents are supplementary; track-first loading should still work.
      }
    })
  }, [])

  const refreshDocuments = useCallback(
    async (track: LyricManagerTrack, selectPreferred = false) => {
      setDocumentsLoading(true)
      try {
        const nextDocuments = await getLyricDocumentVersionsForTracks([
          track.dbId,
        ])
        setDocuments(nextDocuments)
        setTracks((current) =>
          current.map((item) => {
            if (item.dbId !== track.dbId) return item
            const active =
              nextDocuments.find((document) => document.isActive) ?? null
            return {
              ...item,
              lyricVersionCount: nextDocuments.length,
              activeLyricDocumentId: active?.id ?? null,
              activeLyricDocumentName: active?.title ?? null,
            }
          }),
        )

        if (selectPreferred) {
          const preferred =
            nextDocuments.find((document) => document.isActive) ??
            nextDocuments[0]
          if (preferred) await loadLyricDocument(preferred.id)
          else prepareTrackDraft(track, false)
        }
        return nextDocuments
      } catch (documentError) {
        setError(
          documentError instanceof Error
            ? documentError.message
            : 'Failed to load lyric versions.',
        )
        return []
      } finally {
        setDocumentsLoading(false)
      }
    },
    [loadLyricDocument, prepareTrackDraft, setError],
  )

  const requestTransition = useCallback(
    (message: string, action: () => void | Promise<void>) => {
      if (!useLyricsStore.getState().editorDirty) {
        void action()
        return
      }
      setPendingTransition({ message, action })
    },
    [],
  )

  const doSave = useCallback(async (): Promise<boolean> => {
    setError(null)
    const result = await saveActiveLyricDocument(storeCues)
    if (!result?.ok) return false
    markEditorDirty(false)
    showStatus('Saved')
    if (selectedTrack) await refreshDocuments(selectedTrack)
    return true
  }, [
    storeCues,
    markEditorDirty,
    refreshDocuments,
    saveActiveLyricDocument,
    selectedTrack,
    setError,
    showStatus,
  ])

  const handleSelectTrack = useCallback(
    (track: LyricManagerTrack) => {
      if (selectedTrack?.dbId === track.dbId) return
      requestTransition(
        `Save changes before selecting “${track.title}”?`,
        async () => {
          markEditorDirty(false)
          setSelectedTrack(track)
          prepareTrackDraft(track, false)
          setActiveTab('manual')
          await refreshDocuments(track, true)
        },
      )
    },
    [
      markEditorDirty,
      prepareTrackDraft,
      refreshDocuments,
      requestTransition,
      selectedTrack?.dbId,
    ],
  )

  const handleSelectDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (document.id === activeDocumentId) return
      requestTransition(
        `Save changes before opening “${document.title}”?`,
        async () => {
          markEditorDirty(false)
          if (!document.audioTrackId) {
            setSelectedTrack(null)
            setDocuments([])
          }
          await loadLyricDocument(document.id)
          setActiveTab('manual')
        },
      )
    },
    [activeDocumentId, loadLyricDocument, markEditorDirty, requestTransition],
  )

  const handleNewDocument = useCallback(() => {
    if (!selectedTrack) return
    requestTransition(
      'Save changes before creating a blank lyric version?',
      () => {
        prepareTrackDraft(
          selectedTrack,
          true,
          !documents.some((document) => document.isActive),
        )
        setActiveTab('manual')
        showStatus('Blank lyric version ready to edit')
      },
    )
  }, [
    documents,
    prepareTrackDraft,
    requestTransition,
    selectedTrack,
    showStatus,
  ])

  const handleImportDocument = useCallback(() => {
    if (!selectedTrack) return
    requestTransition(
      'Save changes before importing a new lyric version?',
      () => {
        prepareTrackDraft(
          selectedTrack,
          true,
          !documents.some((document) => document.isActive),
        )
        setActiveTab('json')
      },
    )
  }, [documents, prepareTrackDraft, requestTransition, selectedTrack])

  const handleDuplicateDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (!selectedTrack) return
      requestTransition(
        `Save changes before duplicating “${document.title}”?`,
        async () => {
          const full = await getFullLyricDocument(document.id)
          setActiveDocument(null, full.cues, selectedTrack.dbId)
          useLyricsStore.setState({
            draftTitle: `${document.title} Copy`,
            draftArtist: document.artist,
            draftDefaultStyle: document.defaultStyle,
            draftDefaultAnimation: document.defaultAnimation,
            draftDefaultEffects: document.defaultEffects,
            globalOffsetMs: document.globalOffsetMs,
            draftSourceType: document.sourceType,
            draftSourceFormat: document.sourceFormat,
            draftRawSourceText: document.rawSourceText ?? null,
            draftMetadata: {
              ...document.metadata,
              duplicatedFrom: document.id,
            },
            editorDirty: true,
            draftActivateOnSave: false,
          })
          setActiveTab('manual')
          showStatus('Duplicated as a new draft')
        },
      )
    },
    [requestTransition, selectedTrack, setActiveDocument, showStatus],
  )

  const handleRenameDocument = useCallback(
    async (document: LyricDocumentVersion, title: string) => {
      if (document.id === activeDocumentId && editorDirty) {
        setDraftTitle(title)
        showStatus('Rename staged with unsaved changes')
        return
      }
      try {
        const updated = await updateLyricDocument(document.id, { title })
        if (document.id === activeDocumentId)
          setActiveDocument(updated, storeCues)
        if (selectedTrack) await refreshDocuments(selectedTrack)
        else {
          const { data } = await supabase.auth.getUser()
          if (data.user)
            setLegacyDocuments(
              await getLegacyLyricDocumentVersions(data.user.id),
            )
        }
        showStatus('Version renamed')
      } catch (renameError) {
        setError(
          renameError instanceof Error
            ? renameError.message
            : 'Failed to rename lyric version.',
        )
      }
    },
    [
      activeDocumentId,
      editorDirty,
      storeCues,
      refreshDocuments,
      selectedTrack,
      setActiveDocument,
      setDraftTitle,
      setError,
      showStatus,
    ],
  )

  const handleActivateDocument = useCallback(
    (document: LyricDocumentVersion) => {
      requestTransition(
        `Save changes before activating “${document.title}”?`,
        async () => {
          const result = await activateLyricDocument(document.id)
          if (!result?.ok) return
          if (selectedTrack) await refreshDocuments(selectedTrack)
          showStatus('Active lyric version updated')
        },
      )
    },
    [
      activateLyricDocument,
      refreshDocuments,
      requestTransition,
      selectedTrack,
      showStatus,
    ],
  )

  const handleRequestDelete = useCallback(
    (document: LyricDocumentVersion) => {
      const openConfirmation = () => setDeleteTarget(document)
      if (document.id === activeDocumentId) {
        requestTransition(
          `Save changes before deleting “${document.title}”?`,
          openConfirmation,
        )
      } else {
        openConfirmation()
      }
    },
    [activeDocumentId, requestTransition],
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const deletingCurrent = deleteTarget.id === activeDocumentId
      await deleteLyricDocument(deleteTarget.id)
      setDeleteTarget(null)
      markEditorDirty(false)
      if (selectedTrack) {
        const remaining = await refreshDocuments(selectedTrack)
        if (deletingCurrent) {
          const preferred =
            remaining.find((document) => document.isActive) ?? remaining[0]
          if (preferred) await loadLyricDocument(preferred.id)
          else prepareTrackDraft(selectedTrack, false)
        }
      } else {
        const { data } = await supabase.auth.getUser()
        if (data.user)
          setLegacyDocuments(await getLegacyLyricDocumentVersions(data.user.id))
        if (deletingCurrent) setActiveDocument(null, [])
      }
      showStatus('Lyric version deleted')
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete lyric version.',
      )
    } finally {
      setDeleting(false)
    }
  }, [
    activeDocumentId,
    deleteTarget,
    loadLyricDocument,
    markEditorDirty,
    prepareTrackDraft,
    refreshDocuments,
    selectedTrack,
    setActiveDocument,
    setError,
    showStatus,
  ])

  const handleOpenCompletedDraft = useCallback(
    (documentId: string) => {
      requestTransition(
        'Save changes before opening the extracted lyric draft?',
        async () => {
          markEditorDirty(false)
          await loadLyricDocument(documentId)
          if (selectedTrack) await refreshDocuments(selectedTrack)
          setActiveTab('manual')
          showStatus('Extracted draft opened for review')
        },
      )
    },
    [loadLyricDocument, markEditorDirty, refreshDocuments, requestTransition, selectedTrack, showStatus],
  )

  const handleActivateCompletedDraft = useCallback(
    (documentId: string) => {
      requestTransition(
        'Save changes before activating the extracted lyric version?',
        async () => {
          const result = await activateLyricDocument(documentId)
          if (!result?.ok) return
          if (selectedTrack) await refreshDocuments(selectedTrack)
          await loadLyricDocument(documentId)
          setActiveTab('manual')
          showStatus('Extracted lyric version activated')
        },
      )
    },
    [activateLyricDocument, loadLyricDocument, refreshDocuments, requestTransition, selectedTrack, showStatus],
  )

  const applyDraftCues = useCallback((next: typeof storeCues) => setCues(next), [setCues])

  const handleImportToDraft = useCallback(
    (result: LyricDocumentImportResult) => {
      if (result.errors.length > 0) return
      applyDraftCues(result.cues)
      const patch = result.documentPatch
      if (patch.title) setDraftTitle(patch.title)
      if (patch.artist) setDraftArtist(patch.artist)
      if (patch.globalOffsetMs !== undefined)
        setGlobalOffsetMs(patch.globalOffsetMs)
      if (patch.defaultStyle) updateDraftDefaultStyle(patch.defaultStyle)
      if (patch.defaultAnimation)
        updateDraftDefaultAnimation(patch.defaultAnimation)
      if (patch.defaultEffects) updateDraftDefaultEffects(patch.defaultEffects)
      setDraftSourceMeta({
        sourceType: patch.sourceType ?? null,
        sourceFormat: patch.sourceFormat ?? null,
        rawSourceText: patch.rawSourceText ?? null,
        metadata: patch.metadata ?? null,
      })
      showStatus(`Imported ${result.cues.length} cues as a new draft`)
      setActiveTab('manual')
    },
    [
      applyDraftCues,
      setDraftArtist,
      setDraftSourceMeta,
      setDraftTitle,
      setGlobalOffsetMs,
      showStatus,
      updateDraftDefaultAnimation,
      updateDraftDefaultEffects,
      updateDraftDefaultStyle,
    ],
  )

  const handleLoadSelectedTrack = useCallback(async () => {
    if (!selectedTrack?.storagePath) return
    setLoadingTrackId(selectedTrack.dbId)
    try {
      const url = await getSignedUrl(selectedTrack.storagePath)
      if (!url)
        throw new Error('Unable to create a signed preview URL for this track.')
      const trackEntry = {
        name: selectedTrack.fileName || selectedTrack.title,
        title: selectedTrack.title,
        artist: selectedTrack.artist,
        url,
        dbId: selectedTrack.dbId,
        storagePath: selectedTrack.storagePath,
        duration: selectedTrack.durationSec,
        persistedMetadata: {
          bpm: selectedTrack.bpm,
          musicalKey: selectedTrack.musicalKey,
          genre: selectedTrack.genre,
          sampleRate: selectedTrack.sampleRate,
          channels: selectedTrack.channels,
        },
      }
      if (engine.tracks.length > 0) engine.replaceTrackUrls([trackEntry])
      else engine.addTrackUrls([trackEntry])
      if (engine.source !== 'file') engine.setSource('file')
      showStatus('Track loaded to the audio deck without starting playback')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load track preview.',
      )
    } finally {
      setLoadingTrackId(null)
    }
  }, [engine, getSignedUrl, selectedTrack, setError, showStatus])

  const handleTogglePlayback = useCallback(() => {
    if (!selectedTrack || engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus('Load the selected track to the deck before previewing it.')
      return
    }
    if (engine.isPlaying) engine.pause()
    else engine.play()
  }, [engine, selectedTrack, showStatus])

  const handlePreviewInVisualizer = useCallback(() => {
    const timedCues = storeCues.filter((cue) => cue.endMs > cue.startMs)
    if (timedCues.length === 0) {
      showStatus('Timed cues are required before previewing in the visualizer.')
      return
    }
    if (editorDirty) {
      showStatus(
        'Save or discard unsaved changes before opening the visualizer preview.',
      )
      return
    }
    if (selectedTrack && engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus(
        'Load the selected track to the deck before opening the visualizer preview.',
      )
      return
    }
    preserveDraftForNextEditorExit()
    setLyricsEnabled(true)
    onBack()
  }, [
    editorDirty,
    storeCues,
    engine.currentAudioTrackId,
    onBack,
    preserveDraftForNextEditorExit,
    selectedTrack,
    setLyricsEnabled,
    showStatus,
  ])

  const handleUploaded = useCallback(
    (uploaded: SavedAudioTrack[]) => {
      const newest = uploaded[0]
      if (!newest) return
      const managerTrack = uploadedTrackToManager(newest)
      setTracks((current) =>
        mergeTracks(current, uploaded.map(uploadedTrackToManager)),
      )
      setTrackTotal((current) => current + uploaded.length)
      requestTransition(
        `Save changes before selecting the newly uploaded track “${managerTrack.title}”?`,
        () => {
          setSelectedTrack(managerTrack)
          setDocuments([])
          prepareTrackDraft(managerTrack, false, true)
          setActiveTab('ai')
          showStatus('Track uploaded. Automatic lyric extraction is ready.')
        },
      )
    },
    [prepareTrackDraft, requestTransition, showStatus],
  )

  const selectedTrackLoaded = selectedTrack?.dbId === engine.currentAudioTrackId
  const selectedTrackPlaying = selectedTrackLoaded && engine.isPlaying
  const selectedCue = storeCues.find((cue) => cue.id === selectedCueId) ?? null
  const runtimeTrackId = selectedTrackLoaded ? engine.currentTrackId : null
  const runtimeTrackUrl = selectedTrackLoaded ? (engine.currentTrack?.url ?? null) : null
  const decodedBuffer = runtimeTrackId ? (engine.getDecodedBuffer(runtimeTrackId) ?? null) : null
  const editorDurationMs = Math.max(
    0,
    Math.round(
      selectedTrackLoaded && engine.duration > 0
        ? engine.duration * 1000
        : (selectedTrack?.durationSec ?? 0) * 1000,
    ),
  )
  const trustedBeatGridMs = selectedTrackLoaded && engine.currentAnalysisStatus === 'complete'
    ? (engine.currentEffectiveBeatGrid ?? engine.currentAnalysis?.beatGrid ?? [])
        .map((beat) => Math.round(beat.timeSec * 1000))
    : []
  const sectionOptions = selectedTrackLoaded
    ? (engine.currentAnalysis?.sections ?? []).map((section) => ({
        id: section.id,
        label: section.label,
        type: toLyricSectionType(section.type),
      }))
    : []
  const hasMore = tracks.length < trackTotal
  const selectedTrackName = selectedTrack?.title ?? null

  const editorPlaceholder = useMemo(() => {
    if (!selectedTrack && !activeDocument)
      return 'Select a track to begin editing lyrics.'
    if (selectedTrack && documents.length === 0 && !activeDocument)
      return 'This track has no lyrics yet.'
    return null
  }, [activeDocument, documents.length, selectedTrack])

  return (
    <div className="lmv-root">
      <LyricManagerHeader
        isSaving={isSaving}
        lyricsEnabled={lyricsEnabled}
        hasDocument={!!activeDocument}
        draftTitle={draftTitle}
        selectedTrackName={selectedTrackName}
        dirty={editorDirty}
        onBack={() =>
          requestTransition(
            'Save changes before leaving Lyric Manager?',
            onBack,
          )
        }
        onToggleLyricsEnabled={() => setLyricsEnabled(!lyricsEnabled)}
        onSave={() => {
          void doSave()
        }}
        onSaveAndEnable={() => {
          void doSave().then((saved) => {
            if (saved) setLyricsEnabled(true)
          })
        }}
      />

      {(error || statusMsg) && (
        <div
          className={`lmv-status-bar${error ? ' lmv-status-bar--error' : ' lmv-status-bar--ok'}`}
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
        >
          {error ?? statusMsg}
          {error && (
            <button
              type="button"
              className="lmv-status-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss lyric manager error"
            >
              ×
            </button>
          )}
        </div>
      )}

      <LyricTrackBrowser
        tracks={tracks}
        selectedTrackId={selectedTrack?.dbId ?? null}
        loadedAudioTrackId={engine.currentAudioTrackId}
        playingAudioTrackId={
          engine.isPlaying ? engine.currentAudioTrackId : null
        }
        search={trackSearch}
        loading={tracksLoading}
        error={tracksError}
        hasMore={hasMore}
        onSearchChange={setTrackSearch}
        onSelectTrack={handleSelectTrack}
        onLoadMore={() => {
          void loadTracks(false)
        }}
        onUpload={() => setUploadOpen(true)}
        onRetry={() => {
          void loadTracks(true)
        }}
      />

      {selectedTrack && (
        <div className="lmv-track-control-strip">
          <div>
            <strong>{selectedTrack.title}</strong>
            <span>{selectedTrack.artist || 'Unknown artist'}</span>
          </div>
          <div className="lmv-track-identity-status">
            <span>Editor: {selectedTrack.title}</span>
            <span>
              Deck:{' '}
              {selectedTrackLoaded
                ? selectedTrack.title
                : (engine.currentTrack?.displayName ?? 'None')}
            </span>
            <span>
              Playback:{' '}
              {selectedTrackPlaying
                ? 'Playing selected track'
                : engine.isPlaying
                  ? 'Playing another track'
                  : 'Stopped'}
            </span>
          </div>
          <button
            className="lmv-btn lmv-btn--ghost"
            onClick={() => {
              void handleLoadSelectedTrack()
            }}
            disabled={loadingTrackId === selectedTrack.dbId}
          >
            {loadingTrackId === selectedTrack.dbId
              ? 'Loading…'
              : selectedTrackLoaded
                ? 'Reload to Deck'
                : 'Load to Deck'}
          </button>
          <button
            className="lmv-btn lmv-btn--ghost"
            onClick={handleTogglePlayback}
            disabled={!selectedTrackLoaded}
          >
            {selectedTrackPlaying ? 'Pause Preview' : 'Play Preview'}
          </button>
        </div>
      )}

      <div className="lmv-body">
        <LyricDocumentSidebar
          documents={documents}
          legacyDocuments={legacyDocuments}
          loading={documentsLoading || isLoading}
          activeDocumentId={activeDocumentId}
          hasSelectedTrack={!!selectedTrack}
          onSelectDocument={handleSelectDocument}
          onNewDocument={handleNewDocument}
          onDuplicateDocument={handleDuplicateDocument}
          onRenameDocument={handleRenameDocument}
          onActivateDocument={handleActivateDocument}
          onDeleteDocument={handleRequestDelete}
          onImportDocument={handleImportDocument}
        />

        <div className="lmv-center">
          <div className="lmv-tab-bar" role="tablist" aria-label="Lyric workflow">
            {TAB_LABELS.map((tab) => {
              const disabled = tab.id === 'ai'
                ? !selectedTrack
                : (!selectedTrack && !activeDocument)
              return (
                <button
                  key={tab.id}
                  id={`lyric-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`lyric-panel-${tab.id}`}
                  className={`lmv-tab-btn${activeTab === tab.id ? ' lmv-tab-btn--active' : ''}${disabled ? ' lmv-tab-btn--disabled' : ''}`}
                  onClick={() => {
                    if (!disabled) setActiveTab(tab.id)
                  }}
                  disabled={disabled}
                  title={tab.id === 'ai' && !selectedTrack ? 'Select a stored track first' : undefined}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="lmv-tab-content" id={`lyric-panel-${activeTab}`} role="tabpanel" aria-labelledby={`lyric-tab-${activeTab}`}>
            {editorPlaceholder && activeTab === 'manual' ? (
              <div className="lmv-editor-placeholder">
                <div>{editorPlaceholder}</div>
                {selectedTrack && (
                  <div className="lmv-editor-placeholder-actions">
                    <button
                      className="lmv-btn lmv-btn--primary"
                      onClick={handleNewDocument}
                    >
                      Create Blank Lyrics
                    </button>
                    <button
                      className="lmv-btn lmv-btn--ghost"
                      onClick={handleImportDocument}
                    >
                      Import Lyrics
                    </button>
                  </div>
                )}
              </div>
            ) : activeTab === 'manual' ? (
              <ManualLyricEditor
                draftTitle={draftTitle}
                draftArtist={draftArtist}
                globalOffsetMs={globalOffsetMs}
                onUpdateTitle={setDraftTitle}
                onUpdateArtist={setDraftArtist}
                onUpdateGlobalOffset={setGlobalOffsetMs}
                trackId={runtimeTrackId}
                trackUrl={runtimeTrackUrl}
                decodedBuffer={decodedBuffer}
                durationMs={editorDurationMs}
                currentAudioTimeMs={selectedTrackLoaded ? currentAudioTimeMs : null}
                onSeek={(timeMs) => {
                  if (!selectedTrackLoaded) {
                    showStatus('Load the selected track to the deck before seeking.')
                    return
                  }
                  engine.seek(timeMs / 1000)
                }}
                beatGridMs={trustedBeatGridMs}
                sections={sectionOptions}
              />
            ) : activeTab === 'json' ? (
              <JsonLyricImporter onImportToDraft={handleImportToDraft} />
            ) : (
              <AiLyricExtractor
                selectedTrack={selectedTrack}
                existingDocumentCount={documents.length}
                onOpenCompletedDraft={handleOpenCompletedDraft}
                onActivateCompletedDraft={handleActivateCompletedDraft}
              />
            )}
          </div>
        </div>

        <LyricPreviewPanel
          cues={storeCues}
          document={activeDocument}
          selectedCue={selectedCue}
          onPreviewInVisualizer={handlePreviewInVisualizer}
        />
      </div>

      <UnsavedLyricChangesDialog
        open={pendingTransition !== null}
        busy={isSaving}
        message={pendingTransition?.message}
        onCancel={() => setPendingTransition(null)}
        onDiscard={() => {
          const pending = pendingTransition
          setPendingTransition(null)
          markEditorDirty(false)
          if (pending) void pending.action()
        }}
        onSave={() => {
          const pending = pendingTransition
          void doSave().then((saved) => {
            if (!saved || !pending) return
            setPendingTransition(null)
            void pending.action()
          })
        }}
      />

      <ConfirmLyricDeleteDialog
        title={deleteTarget?.title ?? null}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
      />

      {uploadOpen && (
        <MediaUploadModal
          audioOnly
          onAudioUploaded={handleUploaded}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  )
}
