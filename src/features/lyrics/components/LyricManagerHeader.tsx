import type { ReactNode } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'

import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import { SaveActiveGlyph, SaveGlyph } from '../../../components/vyzualz/layout/HeaderGlyphs'
import { HeaderControlGroup } from '../../../components/vyzualz/layout/HeaderControlGroup'
import { HeaderSaveChip, type HeaderSaveTone } from '../../../components/vyzualz/shared/HeaderSaveChip'
import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'
import type { LyricWriteStatus } from '../../../stores/lyricsStore'

interface Props {
  editActions?: ReactNode
  laneIconsExpanded?: boolean
  onToggleLaneIcons?: () => void
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
  editActions,
  laneIconsExpanded,
  onToggleLaneIcons,
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

  const saveTone: HeaderSaveTone = saveStatus === 'conflict' || saveStatus === 'failed'
    ? 'error'
    : saveStatus === 'queued' || saveStatus === 'saving'
      ? 'saving'
      : 'unsaved'

  return (
    <header className="lmv-header">
      <HeaderControlGroup label="Lyric Manager controls">
        <HeaderIconKey
          label="Show Lyrics"
          title="Show or hide active lyrics in the visualizer"
          icon={<AppIcon kind="lyrics" size={16} color="currentColor" />}
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
        {editActions}
        {onToggleLaneIcons && <HeaderIconKey
          label={laneIconsExpanded ? 'Collapse Track Timeline row icons' : 'Expand Track Timeline row icons'}
          icon={<AppIcon kind="list" size={16} />}
          pressed={laneIconsExpanded}
          onClick={onToggleLaneIcons}
        />}
      </HeaderControlGroup>

      <div className="lmv-header-right">
        <VyzualzHeaderActions
          page="lyric-manager"
          leading={saveStatusLabel && (
            <HeaderSaveChip className="lmv-save-status-badge" label={saveStatusLabel} tone={saveTone} />
          )}
        />
      </div>
    </header>
  )
}
