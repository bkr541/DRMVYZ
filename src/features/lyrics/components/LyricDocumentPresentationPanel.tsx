import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import type { LyricAnimation, LyricEffects, LyricStyle } from '../../../types/lyrics'
import { LyricPresentationControls } from './LyricPresentationControls'

interface Props {
  defaultStyle: Partial<LyricStyle>
  defaultAnimation: Partial<LyricAnimation>
  defaultEffects: Partial<LyricEffects>
  onUpdateDefaultStyle: (patch: Partial<LyricStyle>) => void
  onUpdateDefaultAnimation: (patch: Partial<LyricAnimation>) => void
  onUpdateDefaultEffects: (patch: Partial<LyricEffects>) => void
}

/** Document-level presentation defaults, hosted in Document Workspace. */
export function LyricDocumentPresentationPanel({
  defaultStyle,
  defaultAnimation,
  defaultEffects,
  onUpdateDefaultStyle,
  onUpdateDefaultAnimation,
  onUpdateDefaultEffects,
}: Props) {
  return (
    <section className="lmv-document-presentation-window" aria-label="Default Style / Animation / Effects">
      <DualRailCollapsible
        className="lmv-document-presentation-group"
        headerClassName="lmv-collapsible-toggle"
        bodyClassName="lmv-defaults-section"
        defaultOpen
        label="Default Style / Animation / Effects"
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
    </section>
  )
}
