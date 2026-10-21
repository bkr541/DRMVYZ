import { useLyricAnnouncementStore } from '../editor/lyricNotices'

/** Visually hidden polite live region that reads out the Lyric Manager's save-state and cue-edit messages. */
export function LyricLiveAnnouncer() {
  const message = useLyricAnnouncementStore(state => state.message)
  const sequence = useLyricAnnouncementStore(state => state.sequence)
  // A changing trailing character makes a repeated sentence count as new content.
  const text = message ? `${message}${sequence % 2 === 0 ? '​' : ''}` : ''
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="lyric-live-announcer">{text}</div>
}
