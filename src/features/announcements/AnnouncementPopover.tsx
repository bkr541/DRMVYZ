import { useEffect } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { ConfirmDialog } from '../../components/vyzualz/react/controls/ConfirmDialog'
import { selectCurrentAnnouncement, useAnnouncementStore } from './announcementStore'
import './announcements.css'

/**
 * New-feature announcements, shown when a signed-in user opens the app. One at a time, oldest first. "Got It" records the acknowledgment for this user and
 * moves on to the next; closing without it hides the announcement for this session only, so it returns at the next sign-in.
 */
export function AnnouncementPopover() {
  const current = useAnnouncementStore(selectCurrentAnnouncement)
  const busy = useAnnouncementStore(state => state.busy)
  const error = useAnnouncementStore(state => state.error)

  useEffect(() => {
    if (!supabaseConfigured) return
    void useAnnouncementStore.getState().load()
    // A different account signing in on this window is a different set of acknowledgments.
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') { useAnnouncementStore.getState().reset(); void useAnnouncementStore.getState().load() }
      if (event === 'SIGNED_OUT') useAnnouncementStore.getState().reset()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!current) return null
  return (
    <ConfirmDialog
      key={current.id}
      title={current.title}
      message={<span className="ann-body">{current.body}</span>}
      confirmLabel="Got It"
      busyLabel="Saving…"
      cancelLabel="Close"
      danger={false}
      confirmTone="primary"
      iconTone="neutral"
      busy={busy}
      onCancel={() => useAnnouncementStore.getState().close(current.id)}
      onConfirm={() => { void useAnnouncementStore.getState().acknowledge(current.id) }}
    >
      {current.image_url && <img className="ann-image" src={current.image_url} alt="" loading="lazy" />}
      {current.link_url && current.link_label && (
        <a className="ann-link" href={current.link_url} target="_blank" rel="noopener noreferrer">{current.link_label}</a>
      )}
      {error && <p className="ann-error" role="alert">{error}</p>}
    </ConfirmDialog>
  )
}

