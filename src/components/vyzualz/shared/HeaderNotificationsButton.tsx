import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotificationAttention, useNotificationStore, usePageNotificationEntries, usePageNotificationEvents } from '../../../stores/notificationStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import { NotificationBellIcon, NotificationDrawer } from './NotificationDrawer'

const RING_MS = 1400

/**
 * The Notifications bell in every page header (the last chip before the profile icon). It opens the same right-hand
 * Notifications drawer the Track Timeline Visualizer has, listing every DrawerNotice currently showing on the page.
 * While any notice is a warning (yellow) or an error (red) the bell carries a pulsing dot, and the bell itself rings
 * once each time a new warning or error appears.
 */
export function HeaderNotificationsButton({ page }: { page: AppPageId }) {
  const entries = usePageNotificationEntries(page)
  const attention = useNotificationAttention(page)
  const events = usePageNotificationEvents(page)
  const markEventsRead = useNotificationStore(state => state.markEventsRead)
  const unreadCount = events.filter(event => event.unread).length
  const [open, setOpen] = useState(false)
  const [ringing, setRinging] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const attentionCount = entries.filter(entry => entry.tone === 'warning' || entry.tone === 'error').length + unreadCount
  const previousAttentionCount = useRef(attentionCount)
  useEffect(() => {
    const increased = attentionCount > previousAttentionCount.current
    previousAttentionCount.current = attentionCount
    if (!increased) return
    setRinging(true)
    const timer = window.setTimeout(() => setRinging(false), RING_MS)
    return () => window.clearTimeout(timer)
  }, [attentionCount])

  // Messages that arrive while the drawer is open are already being read.
  useEffect(() => {
    if (open && unreadCount > 0) markEventsRead(page)
  }, [open, unreadCount, markEventsRead, page])

  const total = entries.length + events.length
  const label = total === 0 ? 'Notifications' : `Notifications (${total})`
  const unreadTone = events.find(event => event.unread)?.tone

  return (
    <>
      <button
        type="button"
        className={`vsm-settings-btn vz-header-status-chip vz-header-chip ${page === 'react' ? 'vz-header-chip--labeled' : 'vz-header-chip--square'} vz-header-notifications`}
        data-attention={attention ?? (unreadCount > 0 ? 'unread' : undefined)}
        data-ringing={ringing ? 'true' : undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {page === 'react' && <span className="vz-header-state-label">Notifications</span>}
        <NotificationBellIcon />
        {(attention || unreadCount > 0) && <span className="vz-header-notifications-dot" data-tone={attention ?? unreadTone ?? 'info'} aria-hidden="true" />}
      </button>
      {open && <NotificationDrawer page={page} scope="viewport" onClose={close} />}
    </>
  )
}
