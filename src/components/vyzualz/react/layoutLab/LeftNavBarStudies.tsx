import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { VyzualzSidebarLayout } from '../../VyzualzSidebarLayout'
import type { AppView } from '../../appView'
import { NotificationBellIcon } from '../../shared/NotificationDrawer'
import appIconStyles from '../../../shared/icons/appIcon.css?inline'
import medallionStyles from '../../navMedallionIcons.css?inline'
import sidebarStyles from '../../../../styles/sidebar.css?inline'
import floatingStyles from '../../../../styles/floatingWorkspace.css?inline'
import studyStyles from './leftNavBarStudies.css?inline'

function SidebarPreview({ initiallyCollapsed }: { initiallyCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed)
  const [view, setView] = useState<AppView>('react')
  return <div className="fw-app-navigation">
    <VyzualzSidebarLayout floating isCollapsed={collapsed} appView={view} onAppViewChange={setView}
      toggleCollapsed={() => setCollapsed(value => !value)}
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
  return <div className="ll-ln-studies" aria-label="Current left navigation bar" data-workspace-layout="floating">
    <style>{appIconStyles + medallionStyles + sidebarStyles + floatingStyles + studyStyles}</style>
    <section aria-labelledby="ll-ln-expanded" data-left-nav-study="expanded">
      <h2 id="ll-ln-expanded">Expanded</h2>
      <SidebarPreview initiallyCollapsed={false} />
    </section>
    <section aria-labelledby="ll-ln-collapsed" data-left-nav-study="collapsed">
      <h2 id="ll-ln-collapsed">Collapsed</h2>
      <SidebarPreview initiallyCollapsed />
    </section>
  </div>
}
