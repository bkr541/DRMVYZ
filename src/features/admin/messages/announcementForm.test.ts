import { describe, expect, it } from 'vitest'
import { announcementState, draftToRow, draftFromAnnouncement, emptyDraft, normalizeStats, toLocalInput, validateDraft, type AnnouncementDraft } from './announcementForm'
import type { Announcement } from '../../announcements/announcements'

const valid = (patch: Partial<AnnouncementDraft> = {}): AnnouncementDraft => ({ ...emptyDraft(new Date('2026-06-10T09:30:00')), title: 'New: Open Decks', body: 'Try the new preset.', ...patch })

describe('announcement form', () => {
  it('accepts a title and message, with the image and button optional', () => {
    expect(validateDraft(valid())).toEqual({})
    expect(validateDraft(valid({ imageUrl: 'https://x.test/a.png', linkLabel: 'See it', linkUrl: 'https://x.test' }))).toEqual({})
  })

  it('requires a title and a message', () => {
    expect(Object.keys(validateDraft(valid({ title: '  ', body: '' })))).toEqual(['title', 'body'])
  })

  it('needs the button label and address together, both http(s)', () => {
    expect(validateDraft(valid({ linkLabel: 'Go' })).linkUrl).toBeTruthy()
    expect(validateDraft(valid({ linkUrl: 'https://x.test' })).linkLabel).toBeTruthy()
    expect(validateDraft(valid({ linkLabel: 'Go', linkUrl: 'javascript:alert(1)' })).linkUrl).toBeTruthy()
    expect(validateDraft(valid({ imageUrl: 'ftp://x.test/a.png' })).imageUrl).toBeTruthy()
  })

  it('builds the row the database stores, with blanks as null and the publish time as an instant', () => {
    const row = draftToRow(valid({ title: '  Hello ', isActive: true }))
    expect(row).toMatchObject({ title: 'Hello', image_url: null, link_url: null, link_label: null, is_active: true })
    expect(new Date(row.publish_at).getTime()).toBe(new Date('2026-06-10T09:30:00').getTime())
  })

  it('round-trips an announcement through the editor', () => {
    const item: Announcement = { id: '1', title: 'T', body: 'B', image_url: 'https://x.test/i.png', link_url: 'https://x.test', link_label: 'Open', is_active: true, publish_at: '2026-06-10T09:30:00', created_at: '', updated_at: '' }
    const draft = draftFromAnnouncement(item)
    expect(draft).toMatchObject({ title: 'T', imageUrl: 'https://x.test/i.png', linkLabel: 'Open', isActive: true, publishAt: toLocalInput('2026-06-10T09:30:00') })
    expect(draftToRow(draft)).toMatchObject({ title: 'T', image_url: 'https://x.test/i.png', link_url: 'https://x.test', link_label: 'Open' })
  })

  it('reads the statistics the database returns as strings', () => {
    expect(normalizeStats({ announcement_id: 'a', eligible: '40', acknowledged: '12', pending: '28' })).toEqual({ announcement_id: 'a', eligible: 40, acknowledged: 12, pending: 28 })
  })

  it('tells active, scheduled and inactive apart', () => {
    const now = new Date('2026-06-10T12:00:00Z').getTime()
    expect(announcementState({ is_active: true, publish_at: '2026-06-01T00:00:00Z' }, now)).toBe('active')
    expect(announcementState({ is_active: true, publish_at: '2026-06-20T00:00:00Z' }, now)).toBe('scheduled')
    expect(announcementState({ is_active: false, publish_at: '2026-06-01T00:00:00Z' }, now)).toBe('inactive')
  })
})
