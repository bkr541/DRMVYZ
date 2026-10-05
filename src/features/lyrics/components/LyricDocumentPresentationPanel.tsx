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

/**
 * Document-level presentation defaults, hosted in the Document tab of the right inspector: the Default Appearance, Animation and
 * Effects groups, which every cue inherits unless it defines an override.
 */
export function LyricDocumentPresentationPanel({
  defaultStyle,
  defaultAnimation,
  defaultEffects,
  onUpdateDefaultStyle,
  onUpdateDefaultAnimation,
  onUpdateDefaultEffects,
}: Props) {
  return (
    <LyricPresentationControls
      style={defaultStyle}
      animation={defaultAnimation}
      effects={defaultEffects}
      onStyleChange={onUpdateDefaultStyle}
      onAnimationChange={onUpdateDefaultAnimation}
      onEffectsChange={onUpdateDefaultEffects}
    />
  )
}
