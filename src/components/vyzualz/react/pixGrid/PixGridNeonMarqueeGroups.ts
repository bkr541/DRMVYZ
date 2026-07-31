import type { PixGridGroup } from './PixGridTypes'

function marqueeGroup(
  id: string,
  name: string,
  layerScope: string[],
  displayColor: string,
  priority: number,
): PixGridGroup {
  return {
    id,
    name,
    source: 'layerAlpha',
    mask: { kind: 'layerAlpha', threshold: 0.01, foreground: true },
    cellRuns: [],
    layerId: layerScope[0] ?? null,
    layerScope,
    smartRuleId: 'layerAlpha',
    enabled: true,
    visible: true,
    contentVisible: true,
    priority,
    overlapBehavior: 'stack',
    reactions: [],
    displayColor,
  }
}

export const PIX_GRID_NEON_MARQUEE_GROUPS: PixGridGroup[] = [
  marqueeGroup('marquee-structure-group', 'Stable Sign Structure', ['marquee-structure'], '#8aa0b8', 0),
  marqueeGroup('marquee-perimeter-group', 'Complete Perimeter Chase', ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'], '#ffd36b', 20),
  marqueeGroup('marquee-bulb-a-group', 'Perimeter Bulb Phase A', ['marquee-bulbs-a'], '#fff4b0', 24),
  marqueeGroup('marquee-bulb-b-group', 'Perimeter Bulb Phase B', ['marquee-bulbs-b'], '#ffe074', 25),
  marqueeGroup('marquee-bulb-c-group', 'Perimeter Bulb Phase C', ['marquee-bulbs-c'], '#ffc857', 26),
  marqueeGroup('marquee-bulb-d-group', 'Perimeter Bulb Phase D', ['marquee-bulbs-d'], '#ffad42', 27),
  marqueeGroup('marquee-letter-group', 'Interior Letter Lights', ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'], '#58d8ff', 35),
  marqueeGroup('marquee-letter-travel-group', 'Letter Light Travel Bank', ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'], '#8cecff', 36),
  marqueeGroup('marquee-equalizer-group', 'Equalizer and Halo Lights', ['marquee-equalizer-lights'], '#7d8cff', 42),
  marqueeGroup('marquee-trim-group', 'Trim and Underline Lights', ['marquee-trim-lights'], '#ff76bd', 44),
  marqueeGroup('marquee-focal-group', 'Frenchie and Focal Lights', ['marquee-focal-lights'], '#74f0c1', 48),
  marqueeGroup('marquee-sparkle-group', 'Sparse Accent Bulbs', ['marquee-sparkle-lights'], '#ffffff', 50),
  marqueeGroup('marquee-transition-group', 'Sign Transition Structure', ['marquee-structure', 'marquee-trim-lights', 'marquee-bulbs-a', 'marquee-bulbs-c'], '#b7c6d8', 55),
  marqueeGroup('marquee-impact-group', 'Marquee Impact Lights', ['marquee-focal-lights', 'marquee-equalizer-lights', 'marquee-trim-lights'], '#fff0a8', 60),
]
