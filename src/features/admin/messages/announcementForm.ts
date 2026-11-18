import type { Announcement } from '../../announcements/announcements'

export interface AnnouncementDraft {
  title: string
  body: string
  imageUrl: string
  linkLabel: string
  linkUrl: string
  isActive: boolean
  /** What a datetime-local input holds: local time, `YYYY-MM-DDTHH:mm`. */
  publishAt: string
}

export type AnnouncementErrors = Partial<Record<keyof AnnouncementDraft, string>>

const pad = (value: number) => String(value).padStart(2, '0')

/** An ISO instant as the local `YYYY-MM-DDTHH:mm` a datetime-local input shows. */
export function toLocalInput(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const emptyDraft = (now: Date = new Date()): AnnouncementDraft => ({ title: '', body: '', imageUrl: '', linkLabel: '', linkUrl: '', isActive: false, publishAt: toLocalInput(now) })

export function draftFromAnnouncement(item: Announcement): AnnouncementDraft {
  return { title: item.title, body: item.body, imageUrl: item.image_url ?? '', linkLabel: item.link_label ?? '', linkUrl: item.link_url ?? '', isActive: item.is_active, publishAt: toLocalInput(item.publish_at) }
}

const isHttpUrl = (value: string) => { try { return /^https?:$/.test(new URL(value).protocol) } catch { return false } }

/** The same rules the database enforces (migration 0056), so a mistake is caught before the round trip. */
export function validateDraft(draft: AnnouncementDraft): AnnouncementErrors {
  const errors: AnnouncementErrors = {}
  const title = draft.title.trim(), body = draft.body.trim()
  if (!title) errors.title = 'Add a title.'
  else if (title.length > 160) errors.title = 'The title can be at most 160 characters.'
  if (!body) errors.body = 'Add a message.'
  else if (body.length > 4000) errors.body = 'The message can be at most 4,000 characters.'
  if (draft.imageUrl.trim() && !isHttpUrl(draft.imageUrl.trim())) errors.imageUrl = 'The image must be an http or https address.'
  const linkUrl = draft.linkUrl.trim(), linkLabel = draft.linkLabel.trim()
  if (linkUrl && !isHttpUrl(linkUrl)) errors.linkUrl = 'The link must be an http or https address.'
  if (linkUrl && !linkLabel) errors.linkLabel = 'Name the button.'
  if (linkLabel && !linkUrl) errors.linkUrl = 'Add the address the button opens.'
  if (linkLabel.length > 40) errors.linkLabel = 'The button label can be at most 40 characters.'
  if (Number.isNaN(new Date(draft.publishAt).getTime())) errors.publishAt = 'Choose a publish date.'
  return errors
}

export function draftToRow(draft: AnnouncementDraft) {
  const blank = (value: string) => value.trim() || null
  return {
    title: draft.title.trim(), body: draft.body.trim(), image_url: blank(draft.imageUrl),
    link_url: blank(draft.linkUrl), link_label: blank(draft.linkLabel),
    is_active: draft.isActive, publish_at: new Date(draft.publishAt).toISOString(),
  }
}

export interface AnnouncementStats { announcement_id: string; eligible: number; acknowledged: number; pending: number }

/** The three numbers an admin reads. The database counts bigint as a string over the wire, so every value is coerced. */
export function normalizeStats(row: { announcement_id: string; eligible: number | string; acknowledged: number | string; pending: number | string }): AnnouncementStats {
  return { announcement_id: row.announcement_id, eligible: Number(row.eligible), acknowledged: Number(row.acknowledged), pending: Number(row.pending) }
}

export type AnnouncementState = 'active' | 'scheduled' | 'inactive'
/** Active and published = live; active with a future publish date = scheduled (nobody sees it yet); off = inactive. */
export function announcementState(item: Pick<Announcement, 'is_active' | 'publish_at'>, now: number = Date.now()): AnnouncementState {
  if (!item.is_active) return 'inactive'
  return new Date(item.publish_at).getTime() > now ? 'scheduled' : 'active'
}
