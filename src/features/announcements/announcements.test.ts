import { describe, expect, it } from 'vitest'
import { pendingAnnouncements, type Announcement } from './announcements'

const NOW = new Date('2026-06-10T12:00:00Z').getTime()
const item = (id: string, patch: Partial<Announcement> = {}): Announcement => ({
  id, title: id, body: 'body', image_url: null, link_url: null, link_label: null, is_active: true,
  publish_at: '2026-06-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ...patch,
})
const ids = (list: Announcement[]) => list.map(entry => entry.id)
const none = new Set<string>()

describe('which announcements a user is shown', () => {
  it('shows the active, published ones, oldest first, one after another', () => {
    const list = [item('new', { publish_at: '2026-06-05T00:00:00Z' }), item('old', { publish_at: '2026-06-02T00:00:00Z' })]
    expect(ids(pendingAnnouncements(list, none, none, NOW))).toEqual(['old', 'new'])
  })

  it('never shows an inactive one, or one whose publish date has not come', () => {
    const list = [item('off', { is_active: false }), item('later', { publish_at: '2026-06-11T00:00:00Z' }), item('live')]
    expect(ids(pendingAnnouncements(list, none, none, NOW))).toEqual(['live'])
  })

  it('never shows an acknowledged announcement again', () => {
    expect(ids(pendingAnnouncements([item('a'), item('b')], new Set(['a']), none, NOW))).toEqual(['b'])
  })

  it('hides a closed one for the session but not for good: with no acknowledgment it is pending again at the next sign-in', () => {
    const list = [item('a'), item('b')]
    expect(ids(pendingAnnouncements(list, none, new Set(['a']), NOW))).toEqual(['b'])
    // A new session starts with nothing closed.
    expect(ids(pendingAnnouncements(list, none, none, NOW))).toEqual(['a', 'b'])
  })

  it('shows an announcement again if an admin deactivates and reactivates it, as long as this user has not acknowledged it', () => {
    expect(ids(pendingAnnouncements([item('a', { is_active: false })], none, none, NOW))).toEqual([])
    expect(ids(pendingAnnouncements([item('a', { is_active: true })], none, none, NOW))).toEqual(['a'])
    expect(ids(pendingAnnouncements([item('a', { is_active: true })], new Set(['a']), none, NOW))).toEqual([])
  })
})
