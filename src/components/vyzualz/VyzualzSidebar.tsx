import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  compact?: boolean
  appView?: AppView
  onAppViewChange?: (v: AppView) => void
  utilityControls?: ReactNode
} & (
  | { variant?: 'legacy'; collapsed?: never; onCollapsedChange?: never }
  | { variant: 'floating'; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }
)

export function VyzualzSidebar(props: Props) {
  const { compact = false, appView, onAppViewChange } = props
  const notificationPage = NOTIFICATION_PAGES[appView ?? 'react']
  // Shown only to a server-verified admin; the Admin view checks again on its own.
  const isAdmin = useAdminAccess()
  const engine = useSharedAudio()
  const [legacyCollapsed, setLegacyCollapsed] = useState(compact)
  const isCollapsed = props.variant === 'floating' ? props.collapsed : legacyCollapsed
  const toggleCollapsed = () => {
    if (props.variant === 'floating') props.onCollapsedChange(!props.collapsed)
    else setLegacyCollapsed(value => !value)
  }
  const showManagerUnavailable = engine.source === 'microphone'
  const asideRef = useRef<HTMLElement>(null)

  // Publish the sidebar's live width (it animates between collapsed and expanded) so
  // anything laid out beside it, such as the bottom audio dock, starts at its right edge.
  useEffect(() => {
    const aside = asideRef.current
    const root = aside?.closest<HTMLElement>('.az-root')
    if (!aside || !root) return
    const publish = () => root.style.setProperty('--vz-sidebar-width', `${aside.getBoundingClientRect().width}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(aside)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--vz-sidebar-width')
    }
  }, [])

  return (
    <VyzualzSidebarLayout
      asideRef={asideRef}
      isCollapsed={isCollapsed}
      floating={props.variant === 'floating'}
      appView={appView}
      onAppViewChange={onAppViewChange}
      toggleCollapsed={toggleCollapsed}
      showManagerUnavailable={showManagerUnavailable}
      isAdmin={isAdmin}
      utilityControls={props.utilityControls}
      notifications={<HeaderNotificationsButton key={notificationPage} page={notificationPage} iconOnly className="az-sidebar-notifications" />}
      profile={<VyzualzProfileControl />}
    />
  )
}
