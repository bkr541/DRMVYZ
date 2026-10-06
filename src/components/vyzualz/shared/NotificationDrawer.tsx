import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NoticeCard } from '../react/controls/NoticeCard'
import { useNotificationStore, usePageNotificationEntries, usePageNotificationEvents } from '../../../stores/notificationStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import './notificationDrawer.css'

export function NotificationBellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5" />
      <path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

const EXIT_FALLBACK_MS = 450

/** A fixed card handed straight to the drawer (the Track Timeline's analysis notices). */
export interface NotificationCard {
  id: string
  tone: 'info' | 'warning' | 'error' | 'success'
  title: ReactNode
  body: ReactNode
  role?: 'status' | 'alert'
  onDismiss?: () => void
}

interface NotificationDrawerProps {
  /** Fixed cards listed first (Track Timeline). */
  cards?: readonly NotificationCard[]
  /** A page whose registered DrawerNotices are listed after the fixed cards (page headers). */
  page?: AppPageId
  /** Called once the exit animation has finished (close button, scrim click or Escape). The parent then stops rendering the drawer. */
  onClose: () => void
  /**
   * `container`: fills the nearest positioned ancestor (the Track Timeline window). `viewport`: covers the whole app window
   * (page headers), rendered through a portal so no page layout can clip it.
   */
  scope?: 'container' | 'viewport'
  /** Where to portal a `viewport` drawer (defaults to document.body). */
  portalTarget?: HTMLElement
}

/**
 * The right-edge Notifications drawer: a dark scrim over the whole surface and a drawer of NoticeCards that slides in,
 * staggered. Production source of truth for the Track Timeline's notifications drawer, now shared by every page header.
 * Render it only while open; closing plays the reverse animation and then calls `onClose`.
 */
/** One registered notice's slot: the DrawerNotice portals its NoticeCard into this element while the drawer is open. */
function NotificationSlot({ entryKey, index }: { entryKey: string; index: number }) {
  const setSlot = useNotificationStore(state => state.setSlot)
  const ref = useCallback((element: HTMLDivElement | null) => setSlot(entryKey, element), [entryKey, setSlot])
  return <div ref={ref} className="vz-notifications-card" style={{ '--vz-notif-index': index } as CSSProperties} />
}

export function NotificationDrawer({ cards = [], page, onClose, scope = 'container', portalTarget }: NotificationDrawerProps) {
  const entries = usePageNotificationEntries(page ?? 'react')
  const registered = page ? entries : []
  const events = usePageNotificationEvents(page ?? 'react')
  const pageEvents = page ? events : []
  const dismissEvent = useNotificationStore(state => state.dismissEvent)
  const [closing, setClosing] = useState(false)
  const requestClose = useCallback(() => setClosing(true), [])

  useEffect(() => {
    const ownerDocument = (portalTarget ?? document.body).ownerDocument
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setClosing(true)
    }
    ownerDocument.addEventListener('keydown', onKeyDown)
    return () => ownerDocument.removeEventListener('keydown', onKeyDown)
  }, [portalTarget])

  // The exit animation's end event normally unmounts the drawer; this is the fallback for when no animation runs (e.g. animations disabled).
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(onClose, EXIT_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [closing, onClose])

  const drawer = (
    <div className={`vz-notifications-overlay vz-notifications-overlay--${scope}${closing ? ' is-closing' : ''}`}>
      <button type="button" className="vz-notifications-scrim" aria-label="Close notifications" onClick={requestClose} />
      <aside
        className="vz-notifications-drawer"
        role="dialog"
        aria-label="Notifications"
        onAnimationEnd={event => {
          if (event.target === event.currentTarget && closing) onClose()
        }}
      >
        <header className="vz-notifications-header">
          <span>Notifications</span>
          <button type="button" className="vz-notifications-close" onClick={requestClose} aria-label="Close notifications">×</button>
        </header>
        <div className="vz-notifications-list">
          {cards.length + registered.length + pageEvents.length === 0 && <p className="vz-notifications-empty">Nothing needs your attention.</p>}
          {cards.map((card, index) => (
            <div key={card.id} className="vz-notifications-card" style={{ '--vz-notif-index': index } as CSSProperties}>
              <NoticeCard tone={card.tone} role={card.role ?? 'status'} title={card.title} onDismiss={card.onDismiss}>{card.body}</NoticeCard>
            </div>
          ))}
          {registered.map((entry, index) => <NotificationSlot key={entry.key} entryKey={entry.key} index={cards.length + index} />)}
          {pageEvents.map((event, index) => (
            <div key={event.id} className="vz-notifications-card" style={{ '--vz-notif-index': cards.length + registered.length + index } as CSSProperties}>
              <NoticeCard
                tone={event.tone}
                role={event.tone === 'error' ? 'alert' : 'status'}
                title={event.title}
                onDismiss={() => dismissEvent(page as AppPageId, event.id)}
              >
                {event.message}
              </NoticeCard>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )

  return scope === 'viewport' ? createPortal(drawer, portalTarget ?? document.body) : drawer
}
