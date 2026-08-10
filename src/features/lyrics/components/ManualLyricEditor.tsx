import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { useState } from 'react'
import { LyricCueEditor, type LyricBeatGridStatus } from '../editor/LyricCueEditor'
import type { LyricSectionOption } from '../editor/LyricCueInspector'
import type { LyricSnapMode } from '../editor/lyricCueEditorModel'
import type { TrackIntelligenceAnalysis } from '../../musicIntelligence/types'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'
import type { LyricAnimation, LyricEffects, LyricStyle } from '../../../types/lyrics'
import { LyricPresentationControls } from './LyricPresentationControls'

interface Props {
  draftTitle: string
  draftArtist: string
  globalOffsetMs: number
  onUpdateTitle: (value: string) => void
  onUpdateArtist: (value: string) => void
  onUpdateGlobalOffset: (value: number) => void
  defaultStyle: Partial<LyricStyle>
  defaultAnimation: Partial<LyricAnimation>
  defaultEffects: Partial<LyricEffects>
  onUpdateDefaultStyle: (patch: Partial<LyricStyle>) => void
  onUpdateDefaultAnimation: (patch: Partial<LyricAnimation>) => void
  onUpdateDefaultEffects: (patch: Partial<LyricEffects>) => void
  trackId: string | null
  trackUrl: string | null
  decodedBuffer?: AudioBuffer | null
  durationMs: number
  currentAudioTimeMs: number | null
  getCurrentAudioTimeMs?: () => number | null
  onSeek: (timeMs: number) => void
  beatGridMs?: number[]
  beatGridStatus?: LyricBeatGridStatus
  beatGridStatusMessage?: string | null
  sections?: LyricSectionOption[]
  analysis?: TrackIntelligenceAnalysis | null
  timelineSections?: ReactTrackSection[]
  snapMode: LyricSnapMode
  onSnapModeChange: (mode: LyricSnapMode) => void
  onAnalyzeTrack?: () => void
  analysisActionLabel?: string
  navigationTarget?: { cueId: string; wordId?: string | null; revision: number } | null
}

export function ManualLyricEditor({
  draftTitle,
  draftArtist,
  globalOffsetMs,
  onUpdateTitle,
  onUpdateArtist,
  onUpdateGlobalOffset,
  defaultStyle,
  defaultAnimation,
  defaultEffects,
  onUpdateDefaultStyle,
  onUpdateDefaultAnimation,
  onUpdateDefaultEffects,
  trackId,
  trackUrl,
  decodedBuffer,
  durationMs,
  currentAudioTimeMs,
  getCurrentAudioTimeMs,
  onSeek,
  beatGridMs,
  beatGridStatus,
  beatGridStatusMessage,
  sections,
  analysis,
  timelineSections,
  snapMode,
  onSnapModeChange,
  onAnalyzeTrack,
  analysisActionLabel,
  navigationTarget,
}: Props) {
  const [styleOpen, setStyleOpen] = useState(false)

  return (
    <div className="lmv-workflow-content lmv-workflow-content--timeline-editor">
      <div className="lmv-section-label">Document info</div>
      <div className="lmv-grid2">
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-document-title">Title</label>
          <DreamVizTextInput
            id="lyric-document-title"
            className="lmv-input"
            placeholder="Song Title"
            value={draftTitle}
            onChange={event => onUpdateTitle(event.target.value)}
          />
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-document-artist">Artist</label>
          <DreamVizTextInput
            id="lyric-document-artist"
            className="lmv-input"
            placeholder="Artist Name"
            value={draftArtist}
            onChange={event => onUpdateArtist(event.target.value)}
          />
        </div>
      </div>
      <div className="lmv-field lmv-field--short">
        <label className="lmv-field-label" htmlFor="lyric-global-offset">Global offset (ms)</label>
        <input
          id="lyric-global-offset"
          className="lmv-num"
          type="number"
          step={1}
          value={globalOffsetMs}
          onChange={event => onUpdateGlobalOffset(Number.isFinite(Number(event.target.value)) ? Math.round(Number(event.target.value)) : 0)}
        />
        <span className="lmv-field-hint">Applied at render time. Canonical cue and word timestamps remain integer milliseconds.</span>
      </div>

      <DualRailCollapsible
        headerClassName="lmv-collapsible-toggle"
        bodyClassName="lmv-defaults-section"
        open={styleOpen}
        onOpenChange={setStyleOpen}
        label="Default style / animation / effects"
      >
        <div className="lmv-defaults-hint">These document defaults are inherited by every cue unless that cue defines an override.</div>
        <LyricPresentationControls
          style={defaultStyle}
          animation={defaultAnimation}
          effects={defaultEffects}
          onStyleChange={onUpdateDefaultStyle}
          onAnimationChange={onUpdateDefaultAnimation}
          onEffectsChange={onUpdateDefaultEffects}
        />
      </DualRailCollapsible>

      <div className="lmv-section-label">Cue timeline</div>
      <LyricCueEditor
        trackId={trackId}
        trackUrl={trackUrl}
        decodedBuffer={decodedBuffer}
        durationMs={durationMs}
        currentTimeMs={currentAudioTimeMs}
        getCurrentTimeMs={getCurrentAudioTimeMs}
        globalOffsetMs={globalOffsetMs}
        onSeek={onSeek}
        beatGridMs={beatGridMs}
        beatGridStatus={beatGridStatus}
        beatGridStatusMessage={beatGridStatusMessage}
        sections={sections}
        analysis={analysis}
        timelineSections={timelineSections}
        snapMode={snapMode}
        onSnapModeChange={onSnapModeChange}
        onAnalyzeTrack={onAnalyzeTrack}
        analysisActionLabel={analysisActionLabel}
        navigationTarget={navigationTarget}
      />
    </div>
  )
}
