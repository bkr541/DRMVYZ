import type { ReactNode } from 'react'
import { LyricHeaderIcon } from './LyricHeaderIcon'

import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import { HeaderActionIcon } from '../../../components/vyzualz/layout/HeaderActionIcon'
import { HeaderControlGroup } from '../../../components/vyzualz/layout/HeaderControlGroup'
import type { HeaderSaveTone } from '../../../components/vyzualz/shared/HeaderSaveChip'
import { VyzualzHeaderActions } from '../../../components/vyzualz/shared/VyzualzHeaderActions'
import type { LyricWriteStatus } from '../../../stores/lyricsStore'
import type { LyricLayoutMode } from '../lyricLayoutMode'

interface Props {
  /** The manager's measured layout mode. The header can render outside `.lmv-root` (the shared app header), so it carries the mode itself. */
  layout?: LyricLayoutMode
  editActions?: ReactNode
  laneIconsExpanded?: boolean
  onToggleLaneIcons?: () => void
  isSaving: boolean
  saveStatus: LyricWriteStatus
  lyricsDisplayEnabled: boolean
  hasDocument: boolean
  dirty: boolean
  onAddTracks: () => void
  onToggleLyricsDisplay: () => void
  onSave: () => void
  onSaveAndMakeActive: () => void
}

export function LyricManagerHeader({
  layout,
  editActions,
  laneIconsExpanded,
  onToggleLaneIcons,
  isSaving,
  saveStatus,
  lyricsDisplayEnabled,
  hasDocument,
  dirty,
  onAddTracks,
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
      : saveStatusLabel ? 'unsaved' : 'saved'

  return (
    <header className="lmv-header" data-layout={layout}>
      <HeaderControlGroup label="Lyric Manager controls" className="lmv-header-controls">
        <HeaderIconKey
          label="Add tracks"
          icon={<HeaderActionIcon action="create" />}
          onClick={onAddTracks}
        />
        <HeaderIconKey
          label="Show Lyrics"
          title="Show or hide active lyrics in the visualizer"
          icon={<HeaderActionIcon action="lyrics" />}
          pressed={lyricsDisplayEnabled}
          onClick={onToggleLyricsDisplay}
        />
        <HeaderIconKey
          label="Save"
          title={isSaving ? 'Saving…' : 'Save lyric document'}
          icon={<HeaderActionIcon action="save" />}
          disabled={isSaving || (!dirty && !hasDocument)}
          onClick={onSave}
        />
        <HeaderIconKey
          label="Save + Make Active"
          title={isSaving ? 'Saving…' : 'Save this version and make it the active runtime version'}
          icon={<HeaderActionIcon action="saveActive" />}
          disabled={isSaving || (!dirty && !hasDocument)}
          onClick={onSaveAndMakeActive}
        />
        {editActions}
        {onToggleLaneIcons && <HeaderIconKey
          label={laneIconsExpanded ? 'Collapse Track Timeline row icons' : 'Expand Track Timeline row icons'}
          icon={<HeaderActionIcon action="list" />}
          pressed={laneIconsExpanded}
          onClick={onToggleLaneIcons}
        />}
      </HeaderControlGroup>

      <div className="lmv-header-right">
        <VyzualzHeaderActions
          page="lyric-manager"
          saveStatus={{ label: saveStatusLabel ?? 'Saved', tone: saveTone }}
        />
      </div>
    </header>
  )
}
