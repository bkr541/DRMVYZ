import { useState } from 'react'
import { AdminHeaderActionsContext } from './AdminHeaderActions'
import { ApplicationHeaderControls } from '../../components/vyzualz/layout/ApplicationWorkspaceFrame'
import { HeaderControlGroup } from '../../components/vyzualz/layout/HeaderControlGroup'
import { VyzualzHeaderActions } from '../../components/vyzualz/shared/VyzualzHeaderActions'
import { WorkspaceSurface } from '../../components/vyzualz/layout/FloatingWorkspace'
import { UnderlineTabs } from '../../components/vyzualz/react/controls/UnderlineTabs'
import { useAdminAccess } from '../../lib/adminAccess'
import { MessagesTab } from './messages/MessagesTab'
import { PresetsTab } from './presets/PresetsTab'
import { UsersTab } from './users/UsersTab'
import '../../styles/reactView.css'
import './admin.css'

type AdminTab = 'users' | 'presets' | 'messages'
const TABS = [{ id: 'users', label: 'User Accounts' }, { id: 'presets', label: 'Preset Catalog' }, { id: 'messages', label: 'Message Center' }] as const

/**
 * The Admin Console. It checks admin access itself (the sidebar button and the navigation also do), so a stale or forced navigation to it shows nothing to
 * anyone who is not an admin; the database enforces the same rule on every read and write.
 */
export function AdminView() {
  const isAdmin = useAdminAccess()
  const [tab, setTab] = useState<AdminTab>('users')
  // The page header's own toolbar: the open tab puts its actions here (Preset Catalog: Save, Publish, Discard).
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null)
  return (
    <main className="vz-main admin-view" data-testid="admin-view" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {isAdmin && <ApplicationHeaderControls fallbackWhenUnavailable>
        <header className="vz-header" aria-label="Admin Console header">
          <HeaderControlGroup label="Admin Console controls"><span ref={setActionsHost} className="adm-header-actions" /></HeaderControlGroup>
          <VyzualzHeaderActions page="admin" />
        </header>
      </ApplicationHeaderControls>}
      <AdminHeaderActionsContext.Provider value={actionsHost}>
        <div className="admin-view-canvas">
          {isAdmin && (
            <>
              <WorkspaceSurface className="adm-tabs-surface">
                <div className="adm-tabs"><UnderlineTabs ariaLabel="Admin Console sections" activeTab={tab} onChange={setTab} tabs={TABS} /></div>
              </WorkspaceSurface>
              <div className="adm-body" role="tabpanel" aria-label={TABS.find(entry => entry.id === tab)!.label}>
                {tab === 'users' && <WorkspaceSurface className="adm-surface"><UsersTab /></WorkspaceSurface>}
                {tab === 'presets' && <PresetsTab />}
                {tab === 'messages' && <WorkspaceSurface className="adm-surface"><MessagesTab /></WorkspaceSurface>}
              </div>
            </>
          )}
        </div>
      </AdminHeaderActionsContext.Provider>
    </main>
  )
}
