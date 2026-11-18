export interface Announcement {
  id: string
  title: string
  body: string
  image_url: string | null
  link_url: string | null
  link_label: string | null
  is_active: boolean
  publish_at: string
  created_at: string
  updated_at: string
}

/**
 * What a user should be shown at sign-in, oldest first: the active, already-published announcements they have not acknowledged and have not closed
 * during this session. Closing without "Got It" only hides it for this session, so it comes back at the next sign-in; an acknowledged one never does.
 */
export function pendingAnnouncements(
  announcements: readonly Announcement[],
  acknowledgedIds: ReadonlySet<string>,
  closedThisSession: ReadonlySet<string>,
  now: number = Date.now(),
): Announcement[] {
  return announcements
    .filter(item => item.is_active && new Date(item.publish_at).getTime() <= now && !acknowledgedIds.has(item.id) && !closedThisSession.has(item.id))
    .sort((a, b) => new Date(a.publish_at).getTime() - new Date(b.publish_at).getTime() || a.created_at.localeCompare(b.created_at))
}
