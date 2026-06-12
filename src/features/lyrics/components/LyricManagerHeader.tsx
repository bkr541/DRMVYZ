import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'

interface Props {
  isSaving: boolean
  lyricsEnabled: boolean
  hasDocument: boolean
  draftTitle: string
  onToggleLyricsEnabled: () => void
  onSave: () => void
  onSaveAndEnable: () => void
}

export function LyricManagerHeader({
  isSaving,
  lyricsEnabled,
  hasDocument,
  draftTitle,
  onToggleLyricsEnabled,
  onSave,
  onSaveAndEnable,
}: Props) {
  return (
    <header className="lmv-header">
      <div className="lmv-header-left">
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

        <VyzualzHeaderActions />
      </div>
    </header>
  )
}
