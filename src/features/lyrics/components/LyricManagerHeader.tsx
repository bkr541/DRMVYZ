interface Props {
  isSaving: boolean
  lyricsEnabled: boolean
  hasDocument: boolean
  draftTitle: string
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
  onBack,
  onToggleLyricsEnabled,
  onSave,
  onSaveAndEnable,
}: Props) {
  return (
    <header className="lmv-header">
      <div className="lmv-header-left">
        <button className="lmv-back-btn" onClick={onBack} title="Back to Visualizer">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Visualizer
        </button>
        <div className="lmv-header-title-group">
          <span className="lmv-header-title">LYRIC MANAGER</span>
          <span className="lmv-header-subtitle">
            {hasDocument && draftTitle
              ? draftTitle
              : 'Create, import, extract, and publish lyric cues for VYZUALZ'}
          </span>
        </div>
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
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onToggleLyricsEnabled() }}
          >
            <div className="lmv-toggle-thumb" />
          </div>
        </label>

        <button
          className="lmv-btn lmv-btn--ghost"
          onClick={onSave}
          disabled={isSaving}
          title="Save lyric document"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        <button
          className="lmv-btn lmv-btn--primary"
          onClick={onSaveAndEnable}
          disabled={isSaving}
          title="Save and enable lyrics in visualizer"
        >
          {isSaving ? 'Saving…' : 'Save + Enable'}
        </button>
      </div>
    </header>
  )
}
