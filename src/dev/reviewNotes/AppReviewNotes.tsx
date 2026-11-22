import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { captureWindow } from './reviewNotesCapture'
import { reviewNotesClient, type ReviewNotePlace, type ReviewNotesEntry } from './reviewNotesClient'
import { REVIEW_NOTES_APP_ENGINE, REVIEW_NOTE_KINDS, REVIEW_NOTE_KIND_LABELS, REVIEW_NOTES_MAX_AREA, type ReviewNote, type ReviewNoteKind } from './reviewNotesFormat'
import { useReviewNotesScene } from './reviewNotesSceneStore'
import './reviewNotes.css'

export interface AppReviewNotesProps {
  /** The page the app is showing: its id (`media`, `admin`, ...) and its name. */
  page: { id: string; label: string }
}

type PlaceId = 'preset' | 'page' | 'general'
const PANEL_WIDTH = 360
const sameplace = (a: ReviewNotePlace, b: ReviewNotePlace) => a.engine === b.engine && a.presetId === b.presetId
const openOf = (entries: readonly ReviewNotesEntry[]) => entries.reduce((sum, entry) => sum + entry.notes.filter(note => note.status === 'open').length, 0)

/**
 * Development-only review notes for the whole app, a button in the middle of the app header. A note is about the preset on stage (when the visualizer is showing one),
 * the page you are on, or the whole app, and says whether it is a bug, a gap, a change or an idea. It can carry a screenshot of the current window. Notes are saved to
 * `.review-notes/` by the dev server so they can be worked through later. Never rendered in a production build.
 */
export function AppReviewNotes({ page }: AppReviewNotesProps) {
  const scene = useReviewNotesScene()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ReviewNotesEntry[]>([])
  const [placeId, setPlaceId] = useState<PlaceId>('page')
  const [everything, setEverything] = useState(false)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ReviewNoteKind>('change')
  const [area, setArea] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number }>({ top: 56, left: 16 })
  const button = useRef<HTMLButtonElement | null>(null)
  const field = useRef<HTMLTextAreaElement | null>(null)

  const places = useMemo<{ id: PlaceId; label: string; ref: ReviewNotePlace }[]>(() => [
    ...(scene ? [{ id: 'preset' as const, label: `This preset: ${scene.presetName}`, ref: { engine: scene.engine, presetId: scene.presetId, presetName: scene.presetName } }] : []),
    { id: 'page', label: `This page: ${page.label}`, ref: { engine: REVIEW_NOTES_APP_ENGINE, presetId: page.id, presetName: page.label } },
    { id: 'general', label: 'The whole app', ref: { engine: REVIEW_NOTES_APP_ENGINE, presetId: 'general', presetName: 'General' } },
  ], [scene, page.id, page.label])
  const place = places.find(entry => entry.id === placeId) ?? places[0]!
  // Notes default to the preset when one is on stage, else to the page; moving to another page or preset starts from that again.
  const defaultPlace: PlaceId = scene ? 'preset' : 'page'
  useEffect(() => { setPlaceId(defaultPlace); setShot(null); setMessage(null) }, [defaultPlace, page.id, scene?.presetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => { reviewNotesClient.listAll().then(setEntries, error => setMessage(error instanceof Error ? error.message : 'Could not load notes.')) }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { if (open) { refresh(); field.current?.focus() } }, [open, refresh])

  // The panel hangs from the button, wherever the header puts it.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = button.current?.getBoundingClientRect()
      if (!rect) return
      setAnchor({ top: rect.bottom + 8, left: Math.max(8, Math.min(window.innerWidth - PANEL_WIDTH - 8, rect.left + rect.width / 2 - PANEL_WIDTH / 2)) })
    }
    place(); window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  const take = async () => {
    setCapturing(true); setMessage(null)
    const still = await captureWindow()
    setCapturing(false)
    if (!still) setMessage('Could not take a screenshot of this window.')
    else setShot(still)
  }
  const context = (): Record<string, unknown> => ({
    page: page.id, route: `${location.pathname}${location.search}`, viewport: { width: window.innerWidth, height: window.innerHeight },
    theme: document.documentElement.getAttribute('data-theme') ?? document.querySelector('[data-theme]')?.getAttribute('data-theme') ?? null,
    ...(scene ? scene.getContext() : {}),
  })
  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true); setMessage(null)
    try {
      await reviewNotesClient.add(place.ref, text, { kind, area: area.trim(), screenshot: shot, context: context() })
      setText(''); setShot(null); setArea(''); refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the note.') } finally { setBusy(false) }
  }
  const change = async (work: () => Promise<void>) => {
    try { await work(); setMessage(null); refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update the note.') }
  }
  // Typing in the panel must never reach the app's own shortcuts (Space plays and pauses, for one).
  const keep = (event: KeyboardEvent) => event.stopPropagation()
  const onKey = (event: KeyboardEvent) => {
    event.stopPropagation()
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save() }
    if (event.key === 'Escape') setOpen(false)
  }

  const here = entries.find(entry => sameplace(entry, place.ref))?.notes ?? []
  const shown: { place: ReviewNotePlace; note: ReviewNote }[] = everything
    ? entries.flatMap(entry => entry.notes.filter(note => note.status === 'open').map(note => ({ place: entry as ReviewNotePlace, note })))
    : [...here].reverse().map(note => ({ place: place.ref, note }))
  const total = openOf(entries)

  const panel = open && createPortal(
    <section className="rn-panel" data-review-notes style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }} aria-label="Review notes" onKeyDown={keep} onKeyUp={keep} onKeyPress={keep}>
      <header className="rn-head">
        <span className="rn-title">Review notes</span>
        <button type="button" className="rn-icon" aria-label="Close review notes" onClick={() => setOpen(false)}>×</button>
      </header>
      <fieldset className="rn-places" aria-label="What the note is about">
        {places.map(entry => (
          <label key={entry.id} className="rn-place"><input type="radio" name="rn-place" checked={entry.id === place.id} onChange={() => { setPlaceId(entry.id); setEverything(false) }} /><span>{entry.label}</span></label>
        ))}
      </fieldset>
      <div className="rn-kinds" role="radiogroup" aria-label="Kind of note">
        {REVIEW_NOTE_KINDS.map(value => <button key={value} type="button" role="radio" aria-checked={kind === value} data-kind={value} onClick={() => setKind(value)}>{REVIEW_NOTE_KIND_LABELS[value]}</button>)}
      </div>
      <textarea ref={field} className="rn-text" value={text} onChange={event => setText(event.target.value)} onKeyDown={onKey} placeholder="What needs to change, or what is wrong?" aria-label="Note" rows={4} />
      <input className="rn-area" value={area} maxLength={REVIEW_NOTES_MAX_AREA} onChange={event => setArea(event.target.value)} onKeyDown={onKey} placeholder="Where in the page? (optional: “upload modal”, “header”)" aria-label="Area" />
      <div className="rn-capture">
        <button type="button" className="rn-capture-button" onClick={() => void take()} disabled={capturing}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
          {capturing ? 'Capturing…' : shot ? 'Retake screenshot' : 'Screenshot this window'}
        </button>
        {shot && <button type="button" className="rn-link" onClick={() => setShot(null)}>Remove</button>}
      </div>
      {shot && <img className="rn-shot" src={shot} alt="Screenshot that will be attached" />}
      {message && <p className="rn-message" role="alert">{message}</p>}
      <div className="rn-actions">
        <span className="rn-hint">⌘/Ctrl + Enter saves</span>
        <button type="button" className="rn-save" disabled={!text.trim() || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save note'}</button>
      </div>
      <div className="rn-scope" role="group" aria-label="Which notes to list">
        <button type="button" aria-pressed={!everything} onClick={() => setEverything(false)}>Here ({here.length})</button>
        <button type="button" aria-pressed={everything} onClick={() => setEverything(true)}>Everything open ({total})</button>
      </div>
      {shown.length > 0 && (
        <ul className="rn-list">
          {shown.map(({ place: of, note }) => (
            <li key={`${of.engine}:${of.presetId}:${note.id}`} className="rn-note" data-status={note.status}>
              <div className="rn-note-top">
                <span className="rn-chip">{note.status}</span>
                {note.kind && <span className="rn-kind" data-kind={note.kind}>{REVIEW_NOTE_KIND_LABELS[note.kind]}</span>}
                <time className="rn-time" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
              </div>
              {(everything || note.area) && <p className="rn-where">{everything ? `${of.presetName}${of.engine === REVIEW_NOTES_APP_ENGINE ? ' (app)' : ''}` : ''}{everything && note.area ? ' · ' : ''}{note.area ?? ''}</p>}
              <p className="rn-note-text">{note.text}</p>
              {note.screenshot && <a href={reviewNotesClient.screenshotUrl(note.screenshot)} target="_blank" rel="noreferrer"><img className="rn-thumb" src={reviewNotesClient.screenshotUrl(note.screenshot)} alt="Attached screenshot" /></a>}
              {note.resolution && <p className="rn-resolution">Done: {note.resolution}</p>}
              <div className="rn-note-actions">
                <button type="button" className="rn-link" onClick={() => void change(() => reviewNotesClient.setStatus(of, note.id, note.status === 'open' ? 'done' : 'open'))}>{note.status === 'open' ? 'Mark done' : 'Reopen'}</button>
                <button type="button" className="rn-link" onClick={() => void change(() => reviewNotesClient.remove(of, note.id))}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>, document.body)

  return (
    <>
      <button ref={button} type="button" className="rn-header-button" data-review-notes aria-label={`Review notes${total ? `, ${total} open` : ''}`} aria-expanded={open} title="Review notes (development only)" onClick={() => setOpen(value => !value)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 8.5l3 3" /></svg>
        {total > 0 && <span className="rn-badge">{total}</span>}
      </button>
      {panel}
    </>
  )
}
