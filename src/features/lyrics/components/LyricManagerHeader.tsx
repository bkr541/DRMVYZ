import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'

interface Props {
  isSaving: boolean
  lyricsEnabled: boolean
  hasDocument: boolean
  draftTitle: string
  selectedTrackName: string | null
  dirty: boolean
  onBack: () => void
  onToggleLyricsEnabled: () => void
  onSave: () => void
  onSaveAndEnable: () => void
}

export function LyricManagerHeader({
  isSaving,
  lyricsEnabled,
  hasDocument,
  draftTitle,
  selectedTrackName,
  dirty,
  onBack,
  onToggleLyricsEnabled,
  onSave,
  onSaveAndEnable,
}: Props) {
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
        {dirty && <span className="lmv-dirty-badge">Unsaved</span>}
      </div>

      <div className="lmv-header-right">
        <label className="lmv-toggle-row" title="Enable lyrics in visualizer">
          <span className="lmv-toggle-label">Lyrics</span>
          <div
            className={`lmv-toggle-track${lyricsEnabled ? ' lmv-toggle-track--on' : ''}`}
            onClick={onToggleLyricsEnabled}
            role="switch"
            aria-checked={lyricsEnabled}
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') onToggleLyricsEnabled()
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
          onClick={onSaveAndEnable}
          disabled={isSaving || (!dirty && !hasDocument)}
          title="Save and enable lyrics in visualizer"
        >
          {isSaving ? 'Saving…' : 'Save + Enable'}
        </button>

        <VyzualzHeaderActions />
      </div>
    </header>
  )
}
