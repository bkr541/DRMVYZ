import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useLyricsStore } from '../../stores/lyricsStore'
import { getLyricDocumentsForUser } from '../../lib/lyricsDb'
import type { LyricCue, LyricDocument, CreateLyricCueInput } from '../../types/lyrics'
import type { LyricDocumentImportResult } from './utils/lyricDocumentImport'
import { LyricManagerHeader }    from './components/LyricManagerHeader'
import { LyricDocumentSidebar }  from './components/LyricDocumentSidebar'
import { ManualLyricEditor }     from './components/ManualLyricEditor'
import { JsonLyricImporter }     from './components/JsonLyricImporter'
import { AiLyricExtractor }      from './components/AiLyricExtractor'
import { LyricPreviewPanel }     from './components/LyricPreviewPanel'

type WorkflowTab = 'manual' | 'json' | 'ai'

interface Props {
  onBack: () => void
}

const TAB_LABELS: { id: WorkflowTab; label: string }[] = [
  { id: 'manual', label: 'Manual Entry' },
  { id: 'json',   label: 'JSON Import'  },
  { id: 'ai',     label: 'AI Extract'   },
]

// Generate a local-only cue id
function nextCueId(index: number): string {
  return `cue_${String(index + 1).padStart(3, '0')}_${Math.random().toString(36).slice(2, 6)}`
}

export function LyricManagerView({ onBack }: Props) {
  const {
    lyricsEnabled, setLyricsEnabled,
    activeDocument, activeDocumentId,
    cues: storeCues, setCues,
    isLoading, isSaving,
    error, setError,
    draftTitle, draftArtist, globalOffsetMs,
    setDraftTitle, setDraftArtist, setGlobalOffsetMs,
    updateDraftDefaultStyle, updateDraftDefaultAnimation, updateDraftDefaultEffects,
    saveActiveLyricDocument, replaceActiveCues,
    setActiveDocument,
  } = useLyricsStore()

  // Local draft cues (editable in this view, not yet saved)
  const [draftCues, setDraftCues] = useState<LyricCue[]>(() => storeCues)

  // Document library
  const [documents, setDocuments]           = useState<LyricDocument[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)

  // Workflow
  const [activeTab, setActiveTab]       = useState<WorkflowTab>('manual')
  const [selectedCue, setSelectedCue]   = useState<LyricCue | null>(null)
  const [statusMsg, setStatusMsg]       = useState<string | null>(null)

  // Sync draft cues from store when store cues change externally
  useEffect(() => {
    setDraftCues(storeCues)
  }, [storeCues])

  // Load document library on mount
  useEffect(() => {
    if (!supabaseConfigured) return
    setDocumentsLoading(true)
    supabase.auth.getUser()
      .then(({ data }) => data.user ? getLyricDocumentsForUser(data.user.id) : [])
      .then(docs => setDocuments(docs))
      .catch(() => {})
      .finally(() => setDocumentsLoading(false))
  }, [])

  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(null), 3000)
  }, [])

  // ── Document actions ───────────────────────────────────────────────────

  const handleSelectDocument = useCallback((doc: LyricDocument) => {
    // In a full implementation this would also load cues from Supabase
    setActiveDocument(doc, draftCues)
  }, [draftCues, setActiveDocument])

  const handleNewDocument = useCallback(() => {
    setActiveDocument(null, [])
    setDraftCues([])
    setDraftTitle('')
    setDraftArtist('')
  }, [setActiveDocument, setDraftTitle, setDraftArtist])

  // ── Save actions ───────────────────────────────────────────────────────

  const doSave = useCallback(async () => {
    setError(null)
    await saveActiveLyricDocument()
    if (useLyricsStore.getState().error) return

    if (draftCues.length > 0) {
      const docId = useLyricsStore.getState().activeDocumentId
      if (docId) {
        const inputs: CreateLyricCueInput[] = draftCues.map((c, i) => ({
          lyricDocumentId: docId,
          startMs:  c.startMs,
          endMs:    c.endMs,
          text:     c.text,
          style:    c.style,
          animation: c.animation,
          effects:   c.effects,
          words:     c.words,
          groups:    c.groups,
          sortOrder: i,
        }))
        await replaceActiveCues(inputs)
      }
    }
    showStatus('Saved')
  }, [saveActiveLyricDocument, replaceActiveCues, draftCues, setError, showStatus])

  const doSaveAndEnable = useCallback(async () => {
    await doSave()
    if (!useLyricsStore.getState().error) {
      setLyricsEnabled(true)
      showStatus('Saved and enabled')
    }
  }, [doSave, setLyricsEnabled, showStatus])

  // ── Draft cue mutations ────────────────────────────────────────────────

  const handleAddCue = useCallback((cue: Omit<LyricCue, 'id'>) => {
    setDraftCues(prev => {
      const next = [...prev, { ...cue, id: nextCueId(prev.length) }]
      next.sort((a, b) => a.startMs - b.startMs)
      return next
    })
  }, [])

  const handleUpdateCue = useCallback((index: number, cue: Omit<LyricCue, 'id'>) => {
    setDraftCues(prev => {
      const next = [...prev]
      next[index] = { ...cue, id: prev[index].id }
      next.sort((a, b) => a.startMs - b.startMs)
      return next
    })
  }, [])

  const handleDeleteCue = useCallback((index: number) => {
    setDraftCues(prev => prev.filter((_, i) => i !== index))
    setSelectedCue(null)
  }, [])

  const handleDuplicateCue = useCallback((index: number) => {
    setDraftCues(prev => {
      const cue = prev[index]
      const copy: LyricCue = {
        ...cue,
        id: nextCueId(prev.length),
        startMs: cue.endMs,
        endMs:   cue.endMs + (cue.endMs - cue.startMs),
      }
      const next = [...prev, copy]
      next.sort((a, b) => a.startMs - b.startMs)
      return next
    })
  }, [])

  // ── JSON / AI import ───────────────────────────────────────────────────

  const handleImportToDraft = useCallback((result: LyricDocumentImportResult) => {
    if (result.errors.length > 0) return

    setDraftCues(result.cues)
    setCues(result.cues) // push to store for immediate preview

    const patch = result.documentPatch
    if (patch.title)            setDraftTitle(patch.title)
    if (patch.artist)           setDraftArtist(patch.artist)
    if (patch.globalOffsetMs !== undefined) setGlobalOffsetMs(patch.globalOffsetMs)
    if (patch.defaultStyle)     updateDraftDefaultStyle(patch.defaultStyle)
    if (patch.defaultAnimation) updateDraftDefaultAnimation(patch.defaultAnimation)
    if (patch.defaultEffects)   updateDraftDefaultEffects(patch.defaultEffects)

    showStatus(`Imported ${result.cues.length} cues as draft`)
    setActiveTab('manual')
  }, [
    setCues, setDraftTitle, setDraftArtist, setGlobalOffsetMs,
    updateDraftDefaultStyle, updateDraftDefaultAnimation, updateDraftDefaultEffects,
    showStatus,
  ])

  // ── Preview in visualizer ──────────────────────────────────────────────

  const handlePreviewInVisualizer = useCallback(() => {
    setCues(draftCues)
    onBack()
  }, [draftCues, setCues, onBack])

  return (
    <div className="lmv-root">

      <LyricManagerHeader
        isSaving={isSaving}
        lyricsEnabled={lyricsEnabled}
        hasDocument={!!activeDocument}
        draftTitle={draftTitle}
        onBack={onBack}
        onToggleLyricsEnabled={() => setLyricsEnabled(!lyricsEnabled)}
        onSave={doSave}
        onSaveAndEnable={doSaveAndEnable}
      />

      {(error || statusMsg) && (
        <div className={`lmv-status-bar${error ? ' lmv-status-bar--error' : ' lmv-status-bar--ok'}`}>
          {error ?? statusMsg}
          {error && (
            <button className="lmv-status-dismiss" onClick={() => setError(null)}>×</button>
          )}
        </div>
      )}

      <div className="lmv-body">

        {/* Left: document library */}
        <LyricDocumentSidebar
          documents={documents}
          loading={documentsLoading || isLoading}
          activeDocumentId={activeDocumentId}
          onSelectDocument={handleSelectDocument}
          onNewDocument={handleNewDocument}
        />

        {/* Center: workflow */}
        <div className="lmv-center">
          <div className="lmv-tab-bar">
            {TAB_LABELS.map(t => (
              <button
                key={t.id}
                className={`lmv-tab-btn${activeTab === t.id ? ' lmv-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="lmv-tab-content">
            {activeTab === 'manual' && (
              <ManualLyricEditor
                draftTitle={draftTitle}
                draftArtist={draftArtist}
                globalOffsetMs={globalOffsetMs}
                cues={draftCues}
                onUpdateTitle={setDraftTitle}
                onUpdateArtist={setDraftArtist}
                onUpdateGlobalOffset={setGlobalOffsetMs}
                onAddCue={handleAddCue}
                onUpdateCue={handleUpdateCue}
                onDeleteCue={handleDeleteCue}
                onDuplicateCue={handleDuplicateCue}
              />
            )}
            {activeTab === 'json' && (
              <JsonLyricImporter onImportToDraft={handleImportToDraft} />
            )}
            {activeTab === 'ai' && (
              <AiLyricExtractor onImportToDraft={handleImportToDraft} />
            )}
          </div>
        </div>

        {/* Right: preview + validation */}
        <LyricPreviewPanel
          cues={draftCues}
          document={activeDocument}
          selectedCue={selectedCue}
          onPreviewInVisualizer={handlePreviewInVisualizer}
        />

      </div>
    </div>
  )
}
