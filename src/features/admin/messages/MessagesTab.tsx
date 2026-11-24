import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { Collapsible, TextAreaRow, TextInputRow, ToggleRow } from '../../../components/vyzualz/react/ReactControlRows'
import type { Announcement } from '../../announcements/announcements'
import { DateTimeRow } from '../AdminFields'
import { formatDateTime } from '../formatting'
import {
  announcementState, draftFromAnnouncement, emptyDraft, validateDraft,
  type AnnouncementDraft, type AnnouncementStats,
} from './announcementForm'
import { deleteAnnouncement, loadAnnouncements, loadAnnouncementStats, saveAnnouncement, setAnnouncementActive, uploadAnnouncementImage } from './messagesApi'

const TONE = { active: 'loaded', scheduled: 'selected', inactive: 'legacy' } as const
const LABEL = { active: 'Active', scheduled: 'Scheduled', inactive: 'Inactive' } as const

function Stats({ stats }: { stats: AnnouncementStats | undefined }) {
  if (!stats) return <span className="adm-muted">—</span>
  return (
    <dl className="adm-stats" aria-label="Acknowledgment statistics">
      <div><dt>Eligible</dt><dd>{stats.eligible.toLocaleString()}</dd></div>
      <div><dt>Acknowledged</dt><dd>{stats.acknowledged.toLocaleString()}</dd></div>
      <div><dt>Not yet</dt><dd>{stats.pending.toLocaleString()}</dd></div>
    </dl>
  )
}

/** In-app announcements: write, activate and deactivate, edit and delete them, and see who has acknowledged each. */
export function MessagesTab() {
  const [items, setItems] = useState<readonly Announcement[]>([])
  const [stats, setStats] = useState<ReadonlyMap<string, AnnouncementStats>>(new Map())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<AnnouncementDraft>(() => emptyDraft())
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setStatus('loading'); setError(null)
    Promise.all([loadAnnouncements(), loadAnnouncementStats()])
      .then(([rows, counts]) => { setItems(rows); setStats(new Map(counts.map(entry => [entry.announcement_id, entry]))); setStatus('ready') })
      .catch((reason: Error) => { setError(reason.message); setStatus('error') })
  }, [])
  useEffect(load, [load])

  const errors = useMemo(() => validateDraft(draft), [draft])
  const startNew = () => { setEditingId('new'); setDraft(emptyDraft()); setShowErrors(false); setNotice(null) }
  const startEdit = (item: Announcement) => { setEditingId(item.id); setDraft(draftFromAnnouncement(item)); setShowErrors(false); setNotice(null) }
  const patch = (value: Partial<AnnouncementDraft>) => setDraft(current => ({ ...current, ...value }))

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setNotice(null)
    try { await work() } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'That did not work.') } finally { setBusy(false) }
  }

  const save = () => {
    setShowErrors(true)
    if (Object.keys(errors).length > 0) return
    void run(async () => {
      const saved = await saveAnnouncement(editingId === 'new' ? null : editingId, draft)
      setItems(current => (editingId === 'new' ? [saved, ...current] : current.map(item => (item.id === saved.id ? saved : item))))
      setEditingId(saved.id)
      load()
    })
  }
  const toggle = (item: Announcement) => run(async () => {
    const saved = await setAnnouncementActive(item.id, !item.is_active)
    setItems(current => current.map(entry => (entry.id === saved.id ? saved : entry)))
    if (editingId === saved.id) patch({ isActive: saved.is_active })
  })
  const upload = (file: File | undefined) => {
    if (!file) return
    void run(async () => { patch({ imageUrl: await uploadAnnouncementImage(file) }) })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="adm-split">
      <section className="adm-main" aria-label="Announcements">
        <div className="adm-toolbar">
          <IconChipButton tone="primary" onClick={startNew}>New Announcement</IconChipButton>
          <span className="adm-count" role="status"><strong>{items.length}</strong> announcement{items.length === 1 ? '' : 's'}</span>
        </div>
        {status === 'error' && <NoticeCard tone="warning" title="Announcements could not be loaded" role="alert">{error} <IconChipButton onClick={load}>Try again</IconChipButton></NoticeCard>}
        {status === 'loading' && <p className="adm-empty" role="status">Loading announcements…</p>}
        {status === 'ready' && items.length === 0 && <p className="adm-empty">No announcements yet. Create one to show users what is new.</p>}
        <ul className="adm-cards">
          {items.map(item => {
            const state = announcementState(item)
            return (
              <li key={item.id} className={`adm-card${editingId === item.id ? ' is-selected' : ''}`}>
                <div className="adm-card-head">
                  <strong>{item.title}</strong>
                  <StatusBadge tone={TONE[state]}>{LABEL[state]}</StatusBadge>
                </div>
                <p className="adm-card-body">{item.body}</p>
                <div className="adm-card-meta"><span>Publishes {formatDateTime(item.publish_at)}</span><Stats stats={stats.get(item.id)} /></div>
                <div className="adm-card-actions">
                  <IconChipButton onClick={() => startEdit(item)}>Edit</IconChipButton>
                  <IconChipButton disabled={busy} onClick={() => void toggle(item)}>{item.is_active ? 'Deactivate' : 'Activate'}</IconChipButton>
                  <IconChipButton className="dv-icon-chip--danger" disabled={busy} onClick={() => setPendingDelete(item)}>Delete</IconChipButton>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      <aside className="adm-detail" aria-label="Announcement editor">
        {editingId === null
          ? <p className="adm-empty">Select an announcement to edit it, or create a new one.</p>
          : (
            <div className="rv-workspace-panel">
              <div className="rv-workspace-panel-body">
                <div className="rv-inspector rv-inspector-scroll">
                  <div className="rv-ctrl-group">
                    <Collapsible label={editingId === 'new' ? 'New Announcement' : 'Edit Announcement'}>
                      <TextInputRow label="Title" value={draft.title} onChange={value => patch({ title: value })} maxLength={160} placeholder="What is new" />
                      {showErrors && errors.title && <p className="adm-field-error" role="alert">{errors.title}</p>}
                      <TextAreaRow label="Message" value={draft.body} onChange={value => patch({ body: value })} rows={5} spellCheck placeholder="Tell users about the feature" error={showErrors ? errors.body : null} />
                      <DateTimeRow label="Publish Date" value={draft.publishAt} onChange={value => patch({ publishAt: value })} description="Your local time. Nobody sees it before this moment." />
                      {showErrors && errors.publishAt && <p className="adm-field-error" role="alert">{errors.publishAt}</p>}
                      <ToggleRow label="Active" value={draft.isActive} onChange={value => patch({ isActive: value })} description="Only active, published announcements are shown to users." />
                    </Collapsible>
                    <Collapsible label="Image (optional)">
                      <TextInputRow label="Image Address" value={draft.imageUrl} onChange={value => patch({ imageUrl: value })} maxLength={1000} placeholder="https://" />
                      {showErrors && errors.imageUrl && <p className="adm-field-error" role="alert">{errors.imageUrl}</p>}
                      <div className="adm-inline-actions">
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={event => upload(event.target.files?.[0])} aria-label="Choose an image to upload" />
                        <IconChipButton disabled={busy} onClick={() => fileRef.current?.click()}>Upload Image</IconChipButton>
                        {draft.imageUrl && <IconChipButton onClick={() => patch({ imageUrl: '' })}>Remove</IconChipButton>}
                      </div>
                      {draft.imageUrl && <img className="adm-preview" src={draft.imageUrl} alt="Announcement preview" />}
                    </Collapsible>
                    <Collapsible label="Button (optional)">
                      <TextInputRow label="Button Label" value={draft.linkLabel} onChange={value => patch({ linkLabel: value })} maxLength={40} placeholder="See what is new" />
                      {showErrors && errors.linkLabel && <p className="adm-field-error" role="alert">{errors.linkLabel}</p>}
                      <TextInputRow label="Button Address" value={draft.linkUrl} onChange={value => patch({ linkUrl: value })} maxLength={1000} placeholder="https://" />
                      {showErrors && errors.linkUrl && <p className="adm-field-error" role="alert">{errors.linkUrl}</p>}
                    </Collapsible>
                  </div>
                  {notice && <NoticeCard tone="warning" title="Not saved" role="alert">{notice}</NoticeCard>}
                  <div className="adm-form-actions">
                    <IconChipButton onClick={() => setEditingId(null)} disabled={busy}>Close</IconChipButton>
                    <IconChipButton tone="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</IconChipButton>
                  </div>
                </div>
              </div>
            </div>
          )}
      </aside>
      {pendingDelete && (
        <ConfirmDialog
          title="Delete announcement?"
          message={<>“{pendingDelete.title}” will be removed for everyone, along with its acknowledgments. This cannot be undone.</>}
          confirmLabel="Delete" busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const target = pendingDelete
            void run(async () => {
              await deleteAnnouncement(target.id)
              setItems(current => current.filter(item => item.id !== target.id))
              if (editingId === target.id) setEditingId(null)
              setPendingDelete(null)
            })
          }}
        />
      )}
    </div>
  )
}
