import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { LyricCueJsonField } from '../editor/LyricCueJsonField'
import type { LyricAnimation, LyricCue, LyricEffects, LyricStyle } from '../../../types/lyrics'
import { LyricPresentationControls } from './LyricPresentationControls'

interface Props {
  cue: LyricCue
  onUpdateCue: (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => void
}

/**
 * Document Workspace's "Cue Settings" window: the selected cue's style /
 * animation / effects overrides. Reuses LyricPresentationControls wholesale
 * — the same component already shared between per-cue overrides (formerly
 * inside LyricCueInspector) and document-level defaults
 * (LyricDocumentDefaultsPanel) — so all inputs are the existing reusable
 * controls (DreamVizTextInput, native color input, DropdownSelect,
 * BubbleRevealSlider) it already wraps.
 */
export function LyricCueSettingsPanel({ cue, onUpdateCue }: Props) {
  return (
    <section className="lmv-cue-settings-window" aria-label="Cue Settings">
      <div className="lmv-rail-title">
        <span>Cue Settings</span>
      </div>
      <div className="lyric-cue-inspector__presentation">
        <p>Only fields set here override the document defaults. Other renderer metadata is preserved.</p>
        <LyricPresentationControls
          style={cue.style ?? {}}
          animation={cue.animation ?? {}}
          effects={cue.effects ?? {}}
          allowInherit
          onStyleChange={patch => onUpdateCue(cue.id, { style: { ...(cue.style ?? {}), ...patch } })}
          onAnimationChange={patch => onUpdateCue(cue.id, { animation: { ...(cue.animation ?? {}), ...patch } })}
          onEffectsChange={patch => onUpdateCue(cue.id, { effects: { ...(cue.effects ?? {}), ...patch } })}
          onClearStyle={() => onUpdateCue(cue.id, { style: undefined })}
          onClearAnimation={() => onUpdateCue(cue.id, { animation: undefined })}
          onClearEffects={() => onUpdateCue(cue.id, { effects: undefined })}
        />
      </div>
      <DualRailCollapsible
        className="lyric-cue-inspector__metadata"
        defaultOpen={false}
        label="Advanced style JSON"
      >
        <p>Use this only for uncommon renderer fields or troubleshooting. Unknown fields are preserved.</p>
        <LyricCueJsonField label="Style JSON" value={cue.style} onCommit={value => onUpdateCue(cue.id, { style: value as Partial<LyricStyle> })} />
        <LyricCueJsonField label="Animation JSON" value={cue.animation} onCommit={value => onUpdateCue(cue.id, { animation: value as Partial<LyricAnimation> })} />
        <LyricCueJsonField label="Effects JSON" value={cue.effects} onCommit={value => onUpdateCue(cue.id, { effects: value as Partial<LyricEffects> })} />
      </DualRailCollapsible>
    </section>
  )
}
