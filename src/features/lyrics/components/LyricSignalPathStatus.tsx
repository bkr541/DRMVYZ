import type { RuntimeLyricsStatus } from '../../../stores/lyricsStore'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'

interface Props {
  selectedTrack: LyricManagerTrack | null
  deckTrackPresent: boolean
  deckTrackLoaded: boolean
  deckHasPersistedIdentity: boolean
  activeVersion: LyricDocumentVersion | null
  lyricsDisplayEnabled: boolean
  runtimeStatus: RuntimeLyricsStatus
  runtimeAudioTrackId: string | null
}

function runtimeMessage({
  selectedTrack,
  deckTrackPresent,
  deckTrackLoaded,
  deckHasPersistedIdentity,
  activeVersion,
  runtimeStatus,
  runtimeAudioTrackId,
}: Omit<Props, 'lyricsDisplayEnabled'>): string {
  if (!selectedTrack) return 'Track not selected'
  if (deckTrackPresent && !deckHasPersistedIdentity) return 'Local file is not linked to User Media'
  if (!deckTrackLoaded) return deckHasPersistedIdentity ? 'Deck is loaded with a different saved track' : 'Track not loaded'
  if (runtimeStatus === 'loading') return 'Resolving active lyrics…'
  if (runtimeStatus === 'error') return 'Saved track matched, but lyric resolution failed'
  if (runtimeAudioTrackId !== selectedTrack.dbId) return 'Runtime lyric sync is paused while the editor is open'
  if (!activeVersion || runtimeStatus === 'no-active-version') return 'Saved track matched, but no active lyric version exists'
  return 'Saved track and active lyric version matched'
}

export function LyricSignalPathStatus(props: Props) {
  const {
    selectedTrack,
    deckTrackPresent,
    deckTrackLoaded,
    deckHasPersistedIdentity,
    activeVersion,
    lyricsDisplayEnabled,
    runtimeStatus,
  } = props

  return (
    <section className="lmv-signal-path" aria-label="Lyric signal path status">
      <div className="lmv-signal-path-summary">{runtimeMessage(props)}</div>
      <dl className="lmv-signal-path-grid">
        <div><dt>Selected</dt><dd>{selectedTrack?.title || selectedTrack?.fileName || 'None'}</dd></div>
        <div><dt>Deck match</dt><dd>{deckTrackLoaded ? 'Matched' : 'Not matched'}</dd></div>
        <div><dt>Audio identity</dt><dd>{deckHasPersistedIdentity ? 'Available' : 'Unavailable'}</dd></div>
        <div><dt>Active version</dt><dd>{activeVersion?.title || 'None'}</dd></div>
        <div><dt>Active cues</dt><dd>{activeVersion?.cueCount ?? 0}</dd></div>
        <div><dt>Show lyrics</dt><dd>{lyricsDisplayEnabled ? 'On' : 'Off'}</dd></div>
      </dl>
    </section>
  )
}
