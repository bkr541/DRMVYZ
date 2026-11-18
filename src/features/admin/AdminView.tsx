import { WorkspaceSurface } from '../../components/vyzualz/layout/FloatingWorkspace'
import { useAdminAccess } from '../../lib/adminAccess'

/**
 * The Admin workspace. A blank canvas for now: it checks admin access itself (the sidebar button and the navigation also do), so a stale or forced
 * navigation to it shows nothing to anyone who is not an admin.
 */
export function AdminView() {
  const isAdmin = useAdminAccess()
  return (
    <main className="vz-main admin-view" data-testid="admin-view" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
      <WorkspaceSurface className="admin-view-canvas" style={{ flex: 1, minHeight: 0 }}>
        {isAdmin ? null : null}
      </WorkspaceSurface>
    </main>
  )
}
