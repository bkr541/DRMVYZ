import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ReviewNote } from './reviewNotesFormat'
import { captureCanvasStill, reviewNotesClient, type ReviewNotePreset } from './reviewNotesClient'
import './reviewNotes.css'

export interface ReviewNotesButtonProps {
  engine: string
  presetId: string | null
  presetName: string
  /** The stage's output canvas; with none, a screenshot cannot be attached. */
  canvas: HTMLCanvasElement | null
  /** What the screen is showing right now (playing, tempo, the preset's control values), saved with each note. */
  getContext: () => Record<string, unknown>
}

/**
 * Development-only floating button, bottom right of the visualizer: opens a panel to type a note about the preset on screen, optionally with a still of the
 * canvas. Notes are saved to `.review-notes/` by the dev server so they can be read and worked through later. Never rendered in a production build.
 */
export function ReviewNotesButton({ engine, presetId, presetName, canvas, getContext }: ReviewNotesButtonProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<ReviewNote[]>([])
  const [text, setText] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const [attach, setAttach] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement | null>(null)
  const preset: ReviewNotePreset | null = presetId ? { engine, presetId, presetName } : null
  const key = preset ? `${preset.engine}:${preset.presetId}` : ''

  const refresh = useCallback(() => {
    if (!preset) { setNotes([]); return }
    reviewNotesClient.list(preset).then(setNotes, error => setMessage(error instanceof Error ? error.message : 'Could not load notes.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => { setAttach(false); setShot(null); setMessage(null); refresh() }, [key, refresh])
  useEffect(() => { if (open) area.current?.focus() }, [open])

  const take = useCallback(async () => {
    if (!canvas) { setMessage('This view has no canvas to capture.'); setAttach(false); return }
    const still = await captureCanvasStill(canvas)
    if (!still) { setMessage('Could not read the canvas.'); setAttach(false); setShot(null); return }
    setShot(still); setMessage(null)
  }, [canvas])
  const toggleAttach = (next: boolean) => { setAttach(next); if (next) void take(); else setShot(null) }

  const save = async () => {
    if (!preset || !text.trim() || busy) return
    setBusy(true); setMessage(null)
    try {
      setNotes(await reviewNotesClient.add(preset, text, attach ? shot : null, getContext()))
      setText(''); setShot(null); setAttach(false)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the note.') } finally { setBusy(false) }
  }
  const change = async (work: () => Promise<ReviewNote[]>) => {
    try { setNotes(await work()); setMessage(null) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update the note.') }
  }
  // Typing in the panel must never reach the app's own shortcuts (Space plays and pauses, for one).
  const keep = (event: KeyboardEvent) => event.stopPropagation()
  const onKey = (event: KeyboardEvent) => {
    event.stopPropagation()
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save() }
    if (event.key === 'Escape') setOpen(false)
  }

  const openCount = notes.filter(note => note.status === 'open').length
  return (
    <div className="rn-root" data-review-notes>
      {open && (
        <section className="rn-panel" aria-label="Review notes" onKeyDown={keep} onKeyUp={keep} onKeyPress={keep}>
          <header className="rn-head">
            <span className="rn-title">Review notes</span>
            <button type="button" className="rn-icon" aria-label="Close review notes" onClick={() => setOpen(false)}>×</button>
          </header>
          <p className="rn-preset">{preset ? <>{presetName} <span className="rn-engine">{engine}</span></> : 'No preset on screen.'}</p>
          <textarea ref={area} className="rn-text" value={text} onChange={event => setText(event.target.value)} onKeyDown={onKey} disabled={!preset}
            placeholder="What needs to change about this preset?" aria-label="Note" rows={4} />
          <label className="rn-attach">
            <input type="checkbox" checked={attach} disabled={!canvas || !preset} onChange={event => toggleAttach(event.target.checked)} />
            <span>Attach a screenshot of the current frame</span>
            {attach && <button type="button" className="rn-link" onClick={() => void take()}>Retake</button>}
          </label>
          {attach && shot && <img className="rn-shot" src={shot} alt="Screenshot that will be attached" />}
          {message && <p className="rn-message" role="alert">{message}</p>}
          <div className="rn-actions">
            <span className="rn-hint">⌘/Ctrl + Enter saves</span>
            <button type="button" className="rn-save" disabled={!preset || !text.trim() || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save note'}</button>
          </div>
          {notes.length > 0 && (
            <ul className="rn-list">
              {[...notes].reverse().map(note => (
                <li key={note.id} className="rn-note" data-status={note.status}>
                  <div className="rn-note-top">
                    <span className="rn-chip">{note.status}</span>
                    <time className="rn-time" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </div>
                  <p className="rn-note-text">{note.text}</p>
                  {note.screenshot && <a href={reviewNotesClient.screenshotUrl(note.screenshot)} target="_blank" rel="noreferrer"><img className="rn-thumb" src={reviewNotesClient.screenshotUrl(note.screenshot)} alt="Attached screenshot" /></a>}
                  {note.resolution && <p className="rn-resolution">Done: {note.resolution}</p>}
                  <div className="rn-note-actions">
                    <button type="button" className="rn-link" onClick={() => preset && void change(() => reviewNotesClient.setStatus(preset, note.id, note.status === 'open' ? 'done' : 'open'))}>{note.status === 'open' ? 'Mark done' : 'Reopen'}</button>
                    <button type="button" className="rn-link" onClick={() => preset && void change(() => reviewNotesClient.remove(preset, note.id))}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <button type="button" className="rn-fab" aria-label={`Review notes${openCount ? `, ${openCount} open` : ''}`} aria-expanded={open} title="Review notes (development only)" onClick={() => { setOpen(value => !value); if (!open) refresh() }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 8.5l3 3" />
        </svg>
        {openCount > 0 && <span className="rn-badge">{openCount}</span>}
      </button>
    </div>
  )
}
