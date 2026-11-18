import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { pendingAnnouncements, type Announcement } from './announcements'

// The announcements a user is shown at sign-in (migration 0056). Users can read only the live ones and their own acknowledgments, and can write only their
// own acknowledgment, so nothing here can reach another user's state. Failing to load shows nothing: an announcement must never block the app.

const db = supabase as unknown as SupabaseClient

interface AnnouncementState {
  status: 'idle' | 'loading' | 'ready'
  announcements: readonly Announcement[]
  acknowledged: ReadonlySet<string>
  /** Closed with the × / Close button: hidden until the next sign-in, never recorded. */
  closed: ReadonlySet<string>
  error: string | null
  busy: boolean
  load: () => Promise<void>
  acknowledge: (id: string) => Promise<boolean>
  close: (id: string) => void
  reset: () => void
}

const NONE: ReadonlySet<string> = new Set()

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  status: 'idle', announcements: [], acknowledged: NONE, closed: NONE, error: null, busy: false,
  load: async () => {
    if (!supabaseConfigured || get().status === 'loading') return
    set({ status: 'loading', error: null })
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { set({ status: 'ready', announcements: [], acknowledged: NONE }); return }
      const [live, acked] = await Promise.all([
        db.from('announcements').select('*').eq('is_active', true).lte('publish_at', new Date().toISOString()).order('publish_at', { ascending: true }),
        db.from('announcement_acknowledgments').select('announcement_id').eq('user_id', userData.user.id),
      ])
      if (live.error || acked.error) throw live.error ?? acked.error
      set({
        announcements: (live.data as Announcement[] | null) ?? [],
        acknowledged: new Set(((acked.data as { announcement_id: string }[] | null) ?? []).map(row => row.announcement_id)),
        status: 'ready',
      })
    } catch (error) {
      set({ status: 'ready', announcements: [], error: error instanceof Error ? error.message : 'Announcements could not be loaded.' })
    }
  },
  acknowledge: async id => {
    if (get().busy) return false
    set({ busy: true, error: null })
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Sign in to acknowledge this announcement.')
      // An existing acknowledgment is the same answer, so a repeat (two windows, a retry) is not an error.
      const { error } = await db.from('announcement_acknowledgments').upsert({ announcement_id: id, user_id: userData.user.id }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true })
      if (error) throw error
      set(state => ({ acknowledged: new Set([...state.acknowledged, id]), busy: false }))
      return true
    } catch (error) {
      // Not recorded: it will be shown again, which is the safe direction.
      set({ busy: false, error: error instanceof Error ? error.message : 'Could not save your acknowledgment. It will appear again.' })
      return false
    }
  },
  close: id => set(state => ({ closed: new Set([...state.closed, id]) })),
  reset: () => set({ status: 'idle', announcements: [], acknowledged: NONE, closed: NONE, error: null, busy: false }),
}))

/** The announcement to show now (they appear one after another), or null. */
export function selectCurrentAnnouncement(state: Pick<AnnouncementState, 'announcements' | 'acknowledged' | 'closed'>): Announcement | null {
  return pendingAnnouncements(state.announcements, state.acknowledged, state.closed)[0] ?? null
}
