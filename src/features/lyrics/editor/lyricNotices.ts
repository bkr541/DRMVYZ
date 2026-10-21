import { create } from 'zustand'
import { useNotificationStore, type NotifyOptions } from '../../../stores/notificationStore'
import type { AppPageId } from '../../../stores/pageActivityStore'

/**
 * What the Lyric Manager tells the user about its own results: save state and the outcome of cue edits (split, merge, delete, undo, ...).
 * Each message is a notice card in the page's Notifications drawer. A channel keeps only its latest card, so a run of edits (or of
 * undo/redo) leaves one current message instead of filling the drawer. The same text is mirrored into a visually hidden polite live region
 * (see LyricLiveAnnouncer) because the drawer is not in the page while it is closed, and a screen reader would otherwise hear nothing.
 */
const PAGE: AppPageId = 'lyric-manager'

interface AnnouncementState {
  message: string
  /** Bumps on every announcement so the same sentence twice in a row is still read out. */
  sequence: number
}

export const useLyricAnnouncementStore = create<AnnouncementState>(() => ({ message: '', sequence: 0 }))

interface NoticeChannel {
  post(options: NotifyOptions): void
}

function createChannel(): NoticeChannel {
  let lastId: string | null = null
  return {
    post(options) {
      const notifications = useNotificationStore.getState()
      if (lastId) notifications.dismissEvent(PAGE, lastId)
      lastId = notifications.pushEvent(PAGE, options)
      useLyricAnnouncementStore.setState(state => ({ message: `${options.title}. ${options.message}`, sequence: state.sequence + 1 }))
    },
  }
}

const cueEditChannel = createChannel()
const saveStateChannel = createChannel()

/** The outcome of a cue edit, e.g. "Cue 4 split into cues 4 and 5". `refused` marks an edit that did not happen. */
export function announceCueEdit(message: string, refused = false): void {
  cueEditChannel.post({ tone: refused ? 'warning' : 'success', title: refused ? 'Cue edit not applied' : 'Cue edited', message })
}

/** A change in whether the lyric document is saved. */
export function announceLyricSaveState(options: NotifyOptions): void {
  saveStateChannel.post(options)
}
