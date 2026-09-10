import type { ReactNode } from 'react'
import { Badge } from './Badge'

// ── StatusBadge ──────────────────────────────────────────────────────────
//
// Display-only status pill (Selected / Loaded / Playing / …). Renders the
// Layout Lab Template "Removable Capsule" treatment (.dv-badge) via the
// shared Badge component — same size and style — minus the × dismiss button.

export type StatusBadgeTone = 'selected' | 'loaded' | 'playing' | 'dirty' | 'legacy'

// Tones match Layout Lab Template's Removable Capsule sample palette.
const STATUS_BADGE_TONES: Record<StatusBadgeTone, string> = {
  selected: '#d8b95a',
  loaded: '#4ac7db',
  playing: '#61d6aa',
  dirty: '#d8b95a',
  legacy: '#d8b95a',
}

export interface StatusBadgeProps {
  tone: StatusBadgeTone
  children: ReactNode
  className?: string
}

export function StatusBadge({ tone, children, className = '' }: StatusBadgeProps) {
  return <Badge label={children} tone={STATUS_BADGE_TONES[tone]} className={className} />
}
