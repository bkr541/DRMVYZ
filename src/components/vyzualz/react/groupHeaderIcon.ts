import type { ReactNode } from 'react'
import type { AppIconKind } from '../../shared/icons/AppIcon'

/**
 * Icon for a parent group header, chosen from the header's label so every parent group
 * (Master Controls, Cue List, Track Timeline, …) leads with a glyph without each call site
 * naming one. First matching rule wins; a call site can always pass its own `icon`.
 * Labels that match nothing get the generic group glyph.
 */
const RULES: readonly (readonly [RegExp, AppIconKind])[] = [
  [/palette|colou?r/i, 'colorPalette'],
  [/effects?\b|\bfx\b|fog|haze|strobe|bloom|glow|phosphor|distortion/i, 'wand'],
  [/master|controls?\b|macros?|overrides?/i, 'sliders'],
  [/design|appearance|display|canvas|material|layout|styling|presentation|font|artwork|texture|shader|crt|svg/i, 'paintBrush'],
  [/audio|reactiv|music|frequency|signal|waveform|perceptual|analysis|beat|sound|response/i, 'waveform'],
  [/transform|path|position|move/i, 'move'],
  [/cue/i, 'cue'],
  [/route|routing|trigger|matrix|bank|motif/i, 'route'],
  [/motion|evolution|timing|timebase|sequencer|timeline|track map|speed|transitions?|ribbon/i, 'timeline'],
  [/performance|orchestration|automation|live|launch|program|section plan|beam|laser|scanner|scope|moving head|led bar|fixture|lighting/i, 'energy'],
  [/camera|scene|environment|stage/i, 'camera'],
  [/video|media|screen|recording|extraction|source/i, 'image'],
  [/diagnostic|status|validation|capability|inspection|workflow|progress|reasons?|state|why /i, 'checklist'],
  [/document|detail|info\b|stats|tags|collections|preset|workspace|show\b/i, 'info'],
  [/advanced|settings?|render|output|quality|personali[sz]ation|behavior|configuration|inactive|locks?/i, 'settings'],
]

export const GENERIC_GROUP_ICON: AppIconKind = 'layers'

export function groupHeaderIconKind(label: ReactNode): AppIconKind {
  if (typeof label !== 'string' && typeof label !== 'number') return GENERIC_GROUP_ICON
  const text = String(label)
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? GENERIC_GROUP_ICON
}
