import { useEffect, useId, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { NoticeCard, type NoticeCardProps } from '../react/controls/NoticeCard'
import { useNotificationPage, useNotificationStore } from '../../../stores/notificationStore'

const stop = (event: SyntheticEvent) => event.stopPropagation()

/**
 * Drop-in replacement for <NoticeCard> wherever a page shows a notification: instead of drawing the card in place, it
 * lists it in the page's Notifications drawer (the header bell) for exactly as long as it is mounted — the same
 * condition that used to show the card inline. It takes NoticeCard's props; `className` is ignored because that only
 * positioned the card where it used to sit.
 *
 * Outside a page (no NotificationPageProvider above it) it renders the NoticeCard inline, unchanged.
 */
export function DrawerNotice(props: NoticeCardProps) {
  const page = useNotificationPage()
  const key = useId()
  const tone = props.tone ?? 'info'
  const slot = useNotificationStore(state => state.slots[key] ?? null)

  useEffect(() => {
    if (!page) return
    useNotificationStore.getState().register(page, key, tone)
    return () => useNotificationStore.getState().unregister(page, key)
  }, [page, key, tone])

  if (!page) return <NoticeCard {...props} />
  if (!slot) return null

  const { className: _className, ...card } = props
  // React events from a portal bubble to the notice's React parents; keep clicks in the drawer from reaching them.
  return createPortal(
    <div onClick={stop} onPointerDown={stop} onMouseDown={stop} onKeyDown={stop}>
      <NoticeCard {...card} />
    </div>,
    slot,
  )
}
