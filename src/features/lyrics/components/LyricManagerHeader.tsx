import { SubtitleIcon } from 'hugeicons-react'
import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import { SaveActiveGlyph, SaveGlyph } from '../../../components/vyzualz/layout/HeaderGlyphs'
import { PageHeadingPlate, LyricHeadingIcon } from '../../../components/vyzualz/layout/PageHeadingPlate'
import { HeaderControlGroup } from '../../../components/vyzualz/layout/HeaderControlGroup'
import { Badge } from '../../../components/vyzualz/react/controls/Badge'
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
        <HeaderIconKey
          label="Show Lyrics"
          title="Show or hide active lyrics in the visualizer"
          icon={<SubtitleIcon size={16} color="currentColor" />}
          pressed={lyricsDisplayEnabled}
          onClick={onToggleLyricsDisplay}
        />
        <HeaderIconKey
          label="Save"
          title={isSaving ? 'Saving…' : 'Save lyric document'}
          icon={<SaveGlyph />}
          disabled={isSaving || (!dirty && !hasDocument)}
          onClick={onSave}
        />
        <HeaderIconKey
          label="Save + Make Active"
          title={isSaving ? 'Saving…' : 'Save this version and make it the active runtime version'}
          icon={<SaveActiveGlyph />}
          disabled={isSaving || (!dirty && !hasDocument)}
          onClick={onSaveAndMakeActive}
        />
      </HeaderControlGroup>

      <div className="lmv-header-right">
        <VyzualzHeaderActions
          page="lyric-manager"
          leading={saveStatusLabel && (
            <Badge
              className="lmv-save-status-badge"
              label={saveStatusLabel}
              tone={saveStatus === 'conflict' || saveStatus === 'failed' ? '#f87171' : saveStatus === 'queued' || saveStatus === 'saving' ? '#4ac7db' : '#d8b95a'}
            />
          )}
        />
      </div>
    </header>
  )
}
