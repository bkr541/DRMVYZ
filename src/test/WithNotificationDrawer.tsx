import type { ReactNode } from 'react'
import { NotificationDrawer } from '../components/vyzualz/shared/NotificationDrawer'
import { NotificationPageProvider } from '../stores/notificationStore'
import type { AppPageId } from '../stores/pageActivityStore'

/**
 * Renders `children` as a page with a Notifications drawer already open, so a test can read what the page lists there:
 * the DrawerNotices that are mounted and the one-off messages pushed with `notify`.
 */
export function WithNotificationDrawer({ page = 'react', children }: { page?: AppPageId; children: ReactNode }) {
  return (
    <NotificationPageProvider value={page}>
      {children}
      <NotificationDrawer page={page} scope="viewport" onClose={() => undefined} />
    </NotificationPageProvider>
  )
}

/** Text of everything the open drawer currently lists. */
export function drawerText(): string {
  return document.body.querySelector('.vz-notifications-drawer')?.textContent ?? ''
}
