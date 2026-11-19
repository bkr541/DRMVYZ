import { useState, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { VyzualzSidebarLayout } from '../../VyzualzSidebarLayout'
import { APP_VIEWS, type AppView } from '../../appView'
import { NotificationBellIcon } from '../../shared/NotificationDrawer'
import { IconChipButton } from '../controls/IconChipButton'
import appIconStyles from '../../../shared/icons/appIcon.css?inline'
import medallionStyles from '../../navMedallionIcons.css?inline'
import sidebarStyles from '../../../../styles/sidebar.css?inline'
import floatingStyles from '../../../../styles/floatingWorkspace.css?inline'
import studyStyles from './leftNavBarStudies.css?inline'

const SIDEBAR_PREVIEWS = [
  { id: 1, style: 'notched', name: 'Notch' },
  { id: 2, style: 'track', name: 'Track' },
  { id: 3, style: 'shutter', name: 'Shutter' },
  { id: 4, style: 'signal', name: 'Signal' },
  { id: 5, style: 'brackets', name: 'Brackets' },
] as const

type SidebarStudy = typeof SIDEBAR_PREVIEWS[number]
type SidebarPreviewId = SidebarStudy['id']

function SidebarPreview({ collapsed, toggleCollapsed, study }: { collapsed: boolean; toggleCollapsed(): void; study: SidebarStudy }) {
  const [view, setView] = useState<AppView>('react')
  return <div
    className={`fw-app-navigation ll-ln-${study.style}`}
    style={{ '--ll-ln-selected-index': APP_VIEWS.indexOf(view) } as CSSProperties}
  >
    <VyzualzSidebarLayout floating isCollapsed={collapsed} appView={view} onAppViewChange={setView}
      toggleCollapsed={toggleCollapsed}
      utilityControls={<>
        <span className="az-sidebar-utility" aria-hidden="true"><AppIcon kind="mobileApp" size={20} /></span>
        <span className="az-sidebar-utility" aria-hidden="true"><AppIcon kind="sliders" size={20} /></span>
        <span className="az-sidebar-utility" aria-hidden="true"><AppIcon kind="mobilePreview" size={20} /></span>
      </>}
      notifications={<span className="az-sidebar-utility az-sidebar-notifications" aria-hidden="true"><NotificationBellIcon /></span>}
      profile={<span className="az-nav-item vz-profile-control" aria-hidden="true">
        <span className="vz-header-avatar"><AppIcon kind="settings" size={18} /></span>
        <span className="az-nav-label">Profile</span>
      </span>} />
  </div>
}

export function LeftNavBarStudies() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<SidebarPreviewId>>(() => new Set())
  const toggle = (id: SidebarPreviewId) => setCollapsed(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return <div className="ll-ln-studies" aria-label="Left navigation bar studies" data-workspace-layout="floating">
    <style>{appIconStyles + medallionStyles + sidebarStyles + floatingStyles + studyStyles}</style>
    <div className="ll-ln-actions" role="group" aria-label="Sidebar preview controls">
      <IconChipButton onClick={() => setCollapsed(new Set())}>Expand All</IconChipButton>
      <IconChipButton onClick={() => setCollapsed(new Set(SIDEBAR_PREVIEWS.map(study => study.id)))}>Collapse All</IconChipButton>
    </div>
    <div className="ll-ln-columns">
      {SIDEBAR_PREVIEWS.map(study => <section className="ll-ln-study" key={study.id} aria-labelledby={`ll-ln-preview-${study.id}`} data-left-nav-study={study.id}>
        <h2 id={`ll-ln-preview-${study.id}`}>Preview {study.id} · {study.name}</h2>
        <SidebarPreview collapsed={collapsed.has(study.id)} toggleCollapsed={() => toggle(study.id)} study={study} />
      </section>)}
    </div>
  </div>
}
