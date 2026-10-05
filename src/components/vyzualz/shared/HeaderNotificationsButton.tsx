import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotificationAttention, usePageNotificationEntries } from '../../../stores/notificationStore'
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
  const [open, setOpen] = useState(false)
  const [ringing, setRinging] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const attentionCount = entries.filter(entry => entry.tone === 'warning' || entry.tone === 'error').length
  const previousAttentionCount = useRef(attentionCount)
  useEffect(() => {
    const increased = attentionCount > previousAttentionCount.current
    previousAttentionCount.current = attentionCount
    if (!increased) return
    setRinging(true)
    const timer = window.setTimeout(() => setRinging(false), RING_MS)
    return () => window.clearTimeout(timer)
  }, [attentionCount])

  const label = entries.length === 0 ? 'Notifications' : `Notifications (${entries.length})`

  return (
    <>
      <button
        type="button"
        className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--square vz-header-notifications"
        data-attention={attention ?? undefined}
        data-ringing={ringing ? 'true' : undefined}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <NotificationBellIcon />
        {attention && <span className="vz-header-notifications-dot" data-tone={attention} aria-hidden="true" />}
      </button>
      {open && <NotificationDrawer page={page} scope="viewport" onClose={close} />}
    </>
  )
}
