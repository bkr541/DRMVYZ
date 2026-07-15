import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'
import type { LyricWriteStatus } from '../../../stores/lyricsStore'

interface Props {
  isSaving: boolean
  saveStatus: LyricWriteStatus
  lyricsDisplayEnabled: boolean
  hasDocument: boolean
  draftTitle: string
  selectedTrackName: string | null
  dirty: boolean
  onBack: () => void
  onToggleLyricsDisplay: () => void
  onSave: () => void
  onSaveAndMakeActive: () => void
}

export function LyricManagerHeader({
  isSaving,
  saveStatus,
  lyricsDisplayEnabled,
  hasDocument,
  draftTitle,
  selectedTrackName,
  dirty,
  onBack,
  onToggleLyricsDisplay,
  onSave,
  onSaveAndMakeActive,
}: Props) {
  const saveStatusLabel = saveStatus === 'conflict'
    ? 'Conflict'
    : saveStatus === 'failed'
      ? 'Save failed'
      : saveStatus === 'queued'
        ? 'Queued'
        : saveStatus === 'saving'
          ? 'Saving'
          : dirty || saveStatus === 'unsaved'
            ? 'Unsaved'
            : null

  return (
    <header className="lmv-header">
      <div className="lmv-header-left">
        <button className="lmv-header-back" onClick={onBack} aria-label="Leave Lyric Manager">←</button>
        <div className="lmv-header-title-group">
          <span className="lmv-header-title">LYRIC MANAGER</span>
          <span className="lmv-header-subtitle">
            {hasDocument && draftTitle
              ? draftTitle
              : selectedTrackName
                ? `Lyrics for ${selectedTrackName}`
                : 'Select or upload a track, then manage its lyric versions'}
          </span>
        </div>
        {saveStatusLabel && <span className={`lmv-dirty-badge lmv-dirty-badge--${saveStatus}`}>{saveStatusLabel}</span>}
      </div>

      <div className="lmv-header-right">
        <label className="lmv-toggle-row" title="Show or hide active lyrics in the visualizer">
          <span className="lmv-toggle-label">Show Lyrics</span>
          <div
            className={`lmv-toggle-track${lyricsDisplayEnabled ? ' lmv-toggle-track--on' : ''}`}
            onClick={onToggleLyricsDisplay}
            role="switch"
            aria-checked={lyricsDisplayEnabled}
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') onToggleLyricsDisplay()
            }}
          >
            <div className="lmv-toggle-thumb" />
          </div>
        </label>

        <button
          className="lmv-btn lmv-btn--ghost"
          onClick={onSave}
          disabled={isSaving || (!dirty && !hasDocument)}
          title="Save lyric document"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        <button
          className="lmv-btn lmv-btn--primary"
          onClick={onSaveAndMakeActive}
          disabled={isSaving || (!dirty && !hasDocument)}
          title="Save this version and make it the active runtime version"
        >
          {isSaving ? 'Saving…' : 'Save + Make Active'}
        </button>

        <VyzualzHeaderActions />
      </div>
    </header>
  )
}
