import { IconMorphToggle } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
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
          <IconMorphToggle
            checked={lyricsDisplayEnabled}
            onCheckedChange={onToggleLyricsDisplay}
            className="lmv-toggle-track"
            aria-label="Show Lyrics"
          />
        </label>

        <IconChipButton
          onClick={onSave}
          disabled={isSaving || (!dirty && !hasDocument)}
          title="Save lyric document"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </IconChipButton>

        <IconChipButton
          tone="primary"
          onClick={onSaveAndMakeActive}
          disabled={isSaving || (!dirty && !hasDocument)}
          title="Save this version and make it the active runtime version"
        >
          {isSaving ? 'Saving…' : 'Save + Make Active'}
        </IconChipButton>

        <VyzualzHeaderActions />
      </div>
    </header>
  )
}
