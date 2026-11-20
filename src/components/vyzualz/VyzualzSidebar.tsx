import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { HeaderNotificationsButton } from './shared/HeaderNotificationsButton'
import type { AppPageId } from '../../stores/pageActivityStore'
import { VyzualzProfileControl } from './shared/VyzualzProfileControl'
import { useAdminAccess } from '../../lib/adminAccess'
import type { AppView } from './appView'
import { VyzualzSidebarLayout } from './VyzualzSidebarLayout'
export { VyzualzBrandToggle } from './VyzualzSidebarLayout'

const NOTIFICATION_PAGES: Record<AppView, AppPageId> = { react: 'react', performanceManager: 'performance-manager', presetManager: 'preset-manager', showManager: 'show-manager', lyrics: 'lyric-manager', media: 'media-manager', admin: 'admin' }

type Props = {
  variant?: 'legacy' | 'floating'
  appView?: AppView
  onAppViewChange?: (v: AppView) => void
  utilityControls?: ReactNode
}

export function VyzualzSidebar(props: Props) {
  const { appView, onAppViewChange } = props
  const notificationPage = NOTIFICATION_PAGES[appView ?? 'react']
  // Shown only to a server-verified admin; the Admin view checks again on its own.
  const isAdmin = useAdminAccess()
  const engine = useSharedAudio()
  const showManagerUnavailable = engine.source === 'microphone'
  const asideRef = useRef<HTMLElement>(null)

  // Keep the dock aligned and the notch centered on the actual selected button,
  // including Admin in the account area and after window-height changes.
  useLayoutEffect(() => {
    const aside = asideRef.current
    const root = aside?.closest<HTMLElement>('.az-root')
    if (!aside) return
    const publish = () => {
      const bounds = aside.getBoundingClientRect()
      root?.style.setProperty('--vz-sidebar-width', `${bounds.width}px`)
      const selected = aside.querySelector<HTMLElement>('.az-nav-item[aria-current="page"]')
      if (selected) {
        const item = selected.getBoundingClientRect()
        aside.style.setProperty('--az-sidebar-selected-y', `${item.top - bounds.top + item.height / 2}px`)
      }
    }
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(aside)
    aside.querySelectorAll('.az-nav, .az-sidebar-account').forEach(element => observer?.observe(element))
    return () => {
      observer?.disconnect()
      root?.style.removeProperty('--vz-sidebar-width')
    }
  }, [appView, isAdmin])

  return (
    <VyzualzSidebarLayout
      asideRef={asideRef}
      isCollapsed
      notched
      floating={props.variant === 'floating'}
      appView={appView}
      onAppViewChange={onAppViewChange}
      showManagerUnavailable={showManagerUnavailable}
      isAdmin={isAdmin}
      utilityControls={props.utilityControls}
      notifications={<HeaderNotificationsButton key={notificationPage} page={notificationPage} iconOnly className="az-sidebar-notifications" />}
      profile={<VyzualzProfileControl />}
    />
  )
}
