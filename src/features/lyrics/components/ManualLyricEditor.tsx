import { useState, useCallback } from 'react'
import type { LyricCue } from '../../../types/lyrics'
import { formatMs } from '../../../lib/lyricsImport'

interface CueFormState {
  text: string
  startMs: string
  endMs: string
}

const EMPTY_FORM: CueFormState = { text: '', startMs: '', endMs: '' }

interface Props {
  draftTitle: string
  draftArtist: string
  globalOffsetMs: number
  cues: LyricCue[]
  onUpdateTitle: (v: string) => void
  onUpdateArtist: (v: string) => void
  onUpdateGlobalOffset: (v: number) => void
  onAddCue: (cue: Omit<LyricCue, 'id'>) => void
  onUpdateCue: (index: number, cue: Omit<LyricCue, 'id'>) => void
  onDeleteCue: (index: number) => void
  onDuplicateCue: (index: number) => void
  onSelectCue?: (cue: LyricCue | null) => void
  currentAudioTimeMs?: number
}

function parseMsField(v: string): number | null {
  const n = parseFloat(v)
  return isFinite(n) && n >= 0 ? Math.round(n) : null
}

export function ManualLyricEditor({
  draftTitle, draftArtist, globalOffsetMs, cues,
  onUpdateTitle, onUpdateArtist, onUpdateGlobalOffset,
  onAddCue, onUpdateCue, onDeleteCue, onDuplicateCue,
  onSelectCue, currentAudioTimeMs,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [editForm, setEditForm]           = useState<CueFormState>(EMPTY_FORM)
  const [isAdding, setIsAdding]           = useState(false)
  const [addForm, setAddForm]             = useState<CueFormState>(EMPTY_FORM)
  const [styleOpen, setStyleOpen]         = useState(false)

  const selectCue = useCallback((index: number) => {
    const cue = cues[index]
    if (!cue) return
    setSelectedIndex(index)
    setEditForm({
      text:    cue.text,
      startMs: String(cue.startMs),
      endMs:   String(cue.endMs),
    })
    setIsAdding(false)
    onSelectCue?.(cue)
  }, [cues, onSelectCue])

  const handleSaveEdit = useCallback(() => {
    if (selectedIndex === null) return
    const startMs = parseMsField(editForm.startMs)
    const endMs   = parseMsField(editForm.endMs)
    if (startMs === null || endMs === null || endMs <= startMs || !editForm.text.trim()) return
    onUpdateCue(selectedIndex, { text: editForm.text.trim(), startMs, endMs })
    setSelectedIndex(null)
    setEditForm(EMPTY_FORM)
  }, [selectedIndex, editForm, onUpdateCue])

  const handleAddCue = useCallback(() => {
    const startMs = parseMsField(addForm.startMs)
    const endMs   = parseMsField(addForm.endMs)
    if (startMs === null || endMs === null || endMs <= startMs || !addForm.text.trim()) return
    onAddCue({ text: addForm.text.trim(), startMs, endMs })
    setAddForm(EMPTY_FORM)
    setIsAdding(false)
  }, [addForm, onAddCue])

  const setCurrentTimeAsStart = (setter: (f: CueFormState) => void, prev: CueFormState) => {
    if (currentAudioTimeMs !== undefined) {
      setter({ ...prev, startMs: String(Math.round(currentAudioTimeMs)) })
    }
  }
  const setCurrentTimeAsEnd = (setter: (f: CueFormState) => void, prev: CueFormState) => {
    if (currentAudioTimeMs !== undefined) {
      setter({ ...prev, endMs: String(Math.round(currentAudioTimeMs)) })
    }
  }

  const hasAudioTime = currentAudioTimeMs !== undefined

  return (
    <div className="lmv-workflow-content">

      {/* Document info */}
      <div className="lmv-section-label">DOCUMENT INFO</div>
      <div className="lmv-grid2">
        <div className="lmv-field">
          <label className="lmv-field-label">TITLE</label>
          <input className="lmv-input" placeholder="Song Title" value={draftTitle}
            onChange={e => onUpdateTitle(e.target.value)} />
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">ARTIST</label>
          <input className="lmv-input" placeholder="Artist Name" value={draftArtist}
            onChange={e => onUpdateArtist(e.target.value)} />
        </div>
      </div>
      <div className="lmv-field lmv-field--short">
        <label className="lmv-field-label">GLOBAL OFFSET MS</label>
        <input className="lmv-num" type="number" step={10} placeholder="0"
          value={globalOffsetMs}
          onChange={e => onUpdateGlobalOffset(parseInt(e.target.value, 10) || 0)} />
        <span className="lmv-field-hint">Shifts all cue timestamps at render time</span>
      </div>

      {/* Style defaults (collapsible) */}
      <button
        className="lmv-collapsible-toggle"
        onClick={() => setStyleOpen(o => !o)}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"
          style={{ transform: styleOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        Default Style / Animation / Effects
      </button>
      {styleOpen && (
        <div className="lmv-defaults-section">
          <div className="lmv-defaults-hint">
            Default style, animation, and effects are configured in the document info section.
            Use Save to persist changes.
          </div>
        </div>
      )}

      {/* Cue list */}
      <div className="lmv-cue-list-header">
        <div className="lmv-section-label">
          CUE TIMELINE
          <span className="lmv-cue-count-badge">{cues.length}</span>
        </div>
        <button
          className="lmv-btn lmv-btn--ghost lmv-add-cue-btn"
          onClick={() => { setIsAdding(true); setSelectedIndex(null) }}
        >
          + Add Cue
        </button>
      </div>

      {/* Add cue form */}
      {isAdding && (
        <div className="lmv-cue-editor lmv-cue-editor--inline">
          <div className="lmv-cue-editor-title">NEW CUE</div>
          <textarea
            className="lmv-textarea lmv-cue-text-input"
            rows={2}
            placeholder="Cue text…"
            value={addForm.text}
            onChange={e => setAddForm(f => ({ ...f, text: e.target.value }))}
          />
          <div className="lmv-time-row">
            <div className="lmv-field">
              <label className="lmv-field-label">START MS</label>
              <input className="lmv-num" type="number" min={0} step={100}
                placeholder="0" value={addForm.startMs}
                onChange={e => setAddForm(f => ({ ...f, startMs: e.target.value }))} />
              {hasAudioTime && (
                <button className="lmv-time-set-btn" onClick={() => setCurrentTimeAsStart(setAddForm, addForm)}>
                  Set to current
                </button>
              )}
            </div>
            <div className="lmv-field">
              <label className="lmv-field-label">END MS</label>
              <input className="lmv-num" type="number" min={0} step={100}
                placeholder="0" value={addForm.endMs}
                onChange={e => setAddForm(f => ({ ...f, endMs: e.target.value }))} />
              {hasAudioTime && (
                <button className="lmv-time-set-btn" onClick={() => setCurrentTimeAsEnd(setAddForm, addForm)}>
                  Set to current
                </button>
              )}
            </div>
          </div>
          <div className="lmv-cue-editor-actions">
            <button className="lmv-btn lmv-btn--ghost" onClick={() => { setIsAdding(false); setAddForm(EMPTY_FORM) }}>
              Cancel
            </button>
            <button
              className="lmv-btn lmv-btn--primary"
              disabled={!addForm.text.trim() || !addForm.startMs || !addForm.endMs}
              onClick={handleAddCue}
            >
              Add Cue
            </button>
          </div>
        </div>
      )}

      {/* Cue rows */}
      <div className="lmv-cue-rows">
        {cues.length === 0 && !isAdding && (
          <div className="lmv-cue-empty">No cues yet. Click "+ Add Cue" to start.</div>
        )}
        {cues.map((cue, i) => (
          <div key={cue.id} className={`lmv-cue-row${selectedIndex === i ? ' lmv-cue-row--selected' : ''}`}>
            {selectedIndex === i ? (
              <div className="lmv-cue-editor lmv-cue-editor--inline">
                <div className="lmv-cue-editor-title">EDIT CUE {i + 1}</div>
                <textarea
                  className="lmv-textarea lmv-cue-text-input"
                  rows={2}
                  value={editForm.text}
                  onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))}
                />
                <div className="lmv-time-row">
                  <div className="lmv-field">
                    <label className="lmv-field-label">START MS</label>
                    <input className="lmv-num" type="number" min={0} step={100}
                      value={editForm.startMs}
                      onChange={e => setEditForm(f => ({ ...f, startMs: e.target.value }))} />
                    {hasAudioTime && (
                      <button className="lmv-time-set-btn" onClick={() => setCurrentTimeAsStart(setEditForm, editForm)}>
                        Set to current
                      </button>
                    )}
                  </div>
                  <div className="lmv-field">
                    <label className="lmv-field-label">END MS</label>
                    <input className="lmv-num" type="number" min={0} step={100}
                      value={editForm.endMs}
                      onChange={e => setEditForm(f => ({ ...f, endMs: e.target.value }))} />
                    {hasAudioTime && (
                      <button className="lmv-time-set-btn" onClick={() => setCurrentTimeAsEnd(setEditForm, editForm)}>
                        Set to current
                      </button>
                    )}
                  </div>
                </div>
                <div className="lmv-cue-editor-actions">
                  <button className="lmv-btn lmv-btn--ghost" onClick={() => setSelectedIndex(null)}>Cancel</button>
                  <button
                    className="lmv-btn lmv-btn--primary"
                    disabled={!editForm.text.trim()}
                    onClick={handleSaveEdit}
                  >
                    Save Cue
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="lmv-cue-row-main">
                  <span className="lmv-cue-num">{i + 1}</span>
                  <div className="lmv-cue-row-body">
                    <span className="lmv-cue-row-text">{cue.text}</span>
                    <span className="lmv-cue-row-timing">
                      {formatMs(cue.startMs)} → {formatMs(cue.endMs)}
                    </span>
                  </div>
                  {cue.words && cue.words.length > 0 && (
                    <span className="lmv-cue-badge">w:{cue.words.length}</span>
                  )}
                </div>
                <div className="lmv-cue-row-actions">
                  <button className="lmv-icon-btn" title="Edit" onClick={() => selectCue(i)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                  <button className="lmv-icon-btn" title="Duplicate" onClick={() => onDuplicateCue(i)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  </button>
                  <button className="lmv-icon-btn lmv-icon-btn--danger" title="Delete" onClick={() => onDeleteCue(i)}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
