import { IconMorphToggle } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { PageHeadingPlate, LyricHeadingIcon } from '../../../components/vyzualz/layout/PageHeadingPlate'
import { HeaderControlGroup } from '../../../components/vyzualz/layout/HeaderControlGroup'
import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'
import type { LyricWriteStatus } from '../../../stores/lyricsStore'

interface Props {
  isSaving: boolean
  saveStatus: LyricWriteStatus
  lyricsDisplayEnabled: boolean
  hasDocument: boolean
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
        <PageHeadingPlate title="LYRIC MANAGER" icon={<LyricHeadingIcon />} />
      </div>

      <HeaderControlGroup label="Lyric Manager controls">
        {saveStatusLabel && <span className={`lmv-dirty-badge lmv-dirty-badge--${saveStatus}`}>{saveStatusLabel}</span>}
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
      </HeaderControlGroup>

      <div className="lmv-header-right">
        <VyzualzHeaderActions />
      </div>
    </header>
  )
}
