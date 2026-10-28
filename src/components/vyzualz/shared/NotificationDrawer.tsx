import { AppIcon } from '../../shared/icons/AppIcon'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NoticeCard } from '../react/controls/NoticeCard'
import { useNotificationStore, usePageNotificationEntries, usePageNotificationEvents } from '../../../stores/notificationStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import './notificationDrawer.css'

export function NotificationBellIcon() {
  // Artwork: Bell--Streamline-Solar.svg supplied by the user (streamlinehq.com).
  // Inherit the control color so the original black strokes remain visible in dark themes.
  return (
    <svg className="app-icon" data-app-icon="bell" xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden="true" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" opacity={0.55} d="M7.5 19c0.65503 1.7478 2.42246 3 4.5 3 2.0775 0 3.845 -1.2522 4.5 -3" />
      <path d="M18.7491 9.70957v-0.7046C18.7491 5.13623 15.7274 2 12 2 8.27256 2 5.25087 5.13623 5.25087 9.00497v0.7046c0 0.84563 -0.24115 1.67223 -0.69307 2.37583l-1.10744 1.7241c-1.01154 1.5748 -0.23931 3.7154 1.52 4.2134 4.60238 1.3028 9.45694 1.3028 14.05924 0 1.7594 -0.498 2.5316 -2.6386 1.52 -4.2134l-1.1074 -1.7241c-0.4519 -0.7036 -0.6931 -1.5302 -0.6931 -2.37583Z" />
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
  const navigationClose = useNotificationStore(state => page ? state.drawerCloseRequests[page] ?? 0 : 0)
  const lastNavigationClose = useRef(navigationClose)
  useEffect(() => {
    if (navigationClose === lastNavigationClose.current) return
    lastNavigationClose.current = navigationClose
    // Close immediately for navigation so keyboard focus lands on visible content.
    onClose()
  }, [navigationClose, onClose])

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
          <button type="button" className="vz-notifications-close" onClick={requestClose} aria-label="Close notifications"><AppIcon kind="close" size={12} /></button>
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
