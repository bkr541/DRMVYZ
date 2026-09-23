import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Delete02Icon, PencilEdit01Icon } from 'hugeicons-react'
import { useReactStore } from '../../../stores/reactStore'
import type { CanvasMediaPool } from '../react/canvasPerformance/CanvasPerformanceTypes'
import { MAX_CANVAS_POOL_TEXT_LENGTH } from '../react/canvasPerformance/CanvasPerformanceTypes'
import { Badge } from '../react/controls/Badge'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'

const TEXT_BADGE_TONE = '#d8b95a'

/**
 * Authoring UI for the CANVAS-native text entries stored on a named Media
 * Pool (`CanvasMediaPool.textItems`). Text is not media: it lives on the pool
 * itself and is rendered natively by CUTBANK, so it is added, edited, and
 * deleted here rather than through the Media Manager.
 */
export function PoolTextEntries({ pool, query }: { pool: CanvasMediaPool; query: string }) {
  const { addCanvasPoolText, updateCanvasPoolText, removeCanvasPoolText } = useReactStore(useShallow(state => ({
    addCanvasPoolText: state.addCanvasPoolText,
    updateCanvasPoolText: state.updateCanvasPoolText,
    removeCanvasPoolText: state.removeCanvasPoolText,
  })))
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? pool.textItems.filter(item => item.text.toLowerCase().includes(needle))
    : pool.textItems

  const submitNew = () => {
    if (!draft.trim()) return
    const result = addCanvasPoolText(pool.id, draft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setDraft('')
    setError(null)
  }

  const submitEdit = () => {
    if (!editingId) return
    const result = updateCanvasPoolText(pool.id, editingId, editDraft)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditingId(null)
    setEditDraft('')
    setError(null)
  }

  return (
    <div className="vz-pool-text" aria-label={`Text entries in ${pool.name}`}>
      <div className="vz-pool-create" onPointerDown={event => event.stopPropagation()}>
        <DreamVizTextInput
          className="vz-pool-create__input"
          value={draft}
          maxLength={MAX_CANVAS_POOL_TEXT_LENGTH}
          placeholder="Type a phrase to add to this pool…"
          aria-label="New pool text"
          onChange={event => { setDraft(event.target.value); setError(null) }}
          onKeyDown={event => { if (event.key === 'Enter') submitNew() }}
        />
        <IconChipButton onClick={submitNew} disabled={draft.trim().length === 0} aria-label="Add text to pool">
          Add Text
        </IconChipButton>
      </div>
      {error && <div className="vz-pool-create__error" role="alert">{error}</div>}
      {visible.length > 0 && (
        <div className="vz-pool-text__list" role="list">
          {visible.map(item => (
            <div key={item.id} className="vz-pool-text__row" role="listitem">
              <Badge label="TEXT" tone={TEXT_BADGE_TONE} />
              {editingId === item.id ? (
                <>
                  <DreamVizTextInput
                    className="vz-pool-text__edit"
                    value={editDraft}
                    maxLength={MAX_CANVAS_POOL_TEXT_LENGTH}
                    aria-label={`Edit text ${item.text}`}
                    autoFocus
                    onChange={event => { setEditDraft(event.target.value); setError(null) }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') submitEdit()
                      if (event.key === 'Escape') { setEditingId(null); setError(null) }
                    }}
                  />
                  <IconChipButton onClick={submitEdit}>Save</IconChipButton>
                  <IconChipButton onClick={() => { setEditingId(null); setError(null) }}>Cancel</IconChipButton>
                </>
              ) : (
                <>
                  <span className="vz-pool-text__value" title={item.text}>{item.text}</span>
                  <button
                    type="button"
                    className="vz-media-edit-btn"
                    title="Edit text"
                    aria-label={`Edit text ${item.text}`}
                    onClick={() => { setEditingId(item.id); setEditDraft(item.text); setError(null) }}
                  >
                    <PencilEdit01Icon size={11} color="currentColor" />
                  </button>
                  <button
                    type="button"
                    className="vz-media-remove"
                    title="Delete text"
                    aria-label={`Delete text ${item.text}`}
                    onClick={() => {
                      if (editingId === item.id) setEditingId(null)
                      const result = removeCanvasPoolText(pool.id, item.id)
                      setError(result.ok ? null : result.message)
                    }}
                  >
                    <Delete02Icon size={12} color="currentColor" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
