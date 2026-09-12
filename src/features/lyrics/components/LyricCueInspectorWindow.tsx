import { LyricCueInspector, type LyricCueActionHandlers, type LyricSectionOption } from '../editor/LyricCueInspector'
import type { LyricCue, LyricWord } from '../../../types/lyrics'

interface Props {
  cue: LyricCue
  cues: LyricCue[]
  currentTimeMs: number | null
  durationMs: number
  sections?: LyricSectionOption[]
  actions: LyricCueActionHandlers
  canMergePrevious: boolean
  canMergeNext: boolean
  onUpdateCue: (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => void
  onUpdateWord: (cueId: string, wordId: string, patch: Partial<Omit<LyricWord, 'id'>>) => void
  focusWordId?: string | null
}

/**
 * Document Workspace's "Cue Inspector" window: the selected cue's text,
 * timing, section assignment, warnings, and word timing — the same fields
 * LyricCueInspector always had, with its style/animation/effects section
 * suppressed since that now lives in the sibling "Cue Settings" window.
 */
export function LyricCueInspectorWindow(props: Props) {
  return (
    <section className="lmv-cue-inspector-window" aria-label="Cue Inspector">
      <div className="lmv-rail-title">
        <span>Cue Inspector</span>
      </div>
      <LyricCueInspector
        {...props}
        showPresentationControls={false}
        showStyleMetadataJson={false}
      />
    </section>
  )
}
