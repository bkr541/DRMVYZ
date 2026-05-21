import { useState } from 'react'
import type { VzSession } from '../../../stores/visualStore'

type SessionPanelProps = {
  sessions: VzSession[]
  sessionsLoading: boolean
  sessionSyncError: string | null
  onSave: () => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onClearSyncError: () => void
  defaultOpen?: boolean
  hideToggle?: boolean
}

export function SessionPanel({
  sessions, sessionsLoading, sessionSyncError,
  onSave, onLoad, onDelete, onRename, onClearSyncError,
  defaultOpen = false, hideToggle = false,
}: SessionPanelProps) {
  const [open, setOpen]             = useState(defaultOpen)
  const [confirmId, setConfirmId]   = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal]   = useState('')

  function fmtDate(ts: number) {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  function startRename(s: VzSession) {
    setRenamingId(s.id)
    setRenameVal(s.name)
    setConfirmId(null)
  }

  function commitRename(id: string) {
    const trimmed = renameVal.trim()
    if (trimmed) onRename(id, trimmed)
    setRenamingId(null)
  }

  return (
    <div className="vz-session-panel">
      {!hideToggle && (sessions.length > 0 || sessionsLoading) && (
        <button
          className={`vz-session-load-btn ${open ? 'vz-session-load-btn--open' : ''}`}
          onClick={() => setOpen(v => !v)}
          title="Load a saved session"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
          </svg>
          {sessionsLoading ? 'Syncing…' : `Sessions (${sessions.length})`}
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ marginLeft: 3, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      )}

      {(open || hideToggle) && (
        <div className="vz-session-list">
          {sessionSyncError && (
            <div className="vz-session-sync-error">
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠ {sessionSyncError}</span>
              <button className="vz-session-row-del" onClick={onClearSyncError}>✕</button>
            </div>
          )}
          {sessions.length === 0 && !sessionsLoading && (
            <div style={{ padding: '8px 10px', fontSize: 10, color: 'rgba(245,248,250,0.35)' }}>No sessions saved yet</div>
          )}
          {sessions.map(s => (
            <div key={s.id} className="vz-session-row">
              {confirmId === s.id ? (
                <>
                  <span className="vz-session-confirm-msg">Delete "{s.name}"?</span>
                  <button className="vz-session-confirm-yes" onClick={() => { onDelete(s.id); setConfirmId(null) }}>Yes</button>
                  <button className="vz-session-confirm-no"  onClick={() => setConfirmId(null)}>No</button>
                </>
              ) : renamingId === s.id ? (
                <>
                  <input
                    className="vz-session-rename-input"
                    value={renameVal}
                    autoFocus
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(s.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <button className="vz-session-confirm-yes" onMouseDown={() => commitRename(s.id)}>✓</button>
                </>
              ) : (
                <>
                  <span
                    className={`vz-session-source-badge vz-session-source-badge--${s.source}`}
                    title={s.source === 'cloud' ? 'Saved to cloud' : 'Local only'}
                  >
                    {s.source === 'cloud' ? '☁' : '○'}
                  </span>
                  <button
                    className="vz-session-row-name"
                    onClick={() => { onLoad(s.id); setOpen(false) }}
                    title={`Load "${s.name}"`}
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ marginRight: 4, opacity: 0.5, flexShrink: 0 }}>
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    {s.name}
                  </button>
                  <span className="vz-session-row-meta">{fmtDate(s.updatedAt ?? s.createdAt)}</span>
                  <button
                    className="vz-session-row-action"
                    onClick={() => startRename(s)}
                    title="Rename"
                  >✎</button>
                  <button
                    className="vz-session-row-del"
                    onClick={() => setConfirmId(s.id)}
                    title="Delete session"
                  >✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
