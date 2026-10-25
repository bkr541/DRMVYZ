export type LayoutLabDesignId = 'baseline' | 'design-01' | 'design-02' | 'design-03' | 'design-04' | 'design-05'
export const LAYOUT_LAB_DESIGNS = [
  { value: 'baseline', themeClassName: '', label: 'Current app', description: 'Production component styling for comparison.' },
  { value: 'design-01', themeClassName: 'll-template-audio-theme', label: 'Design 01 — Audio Library', description: 'Charcoal surfaces, compact cards and quiet accents.' },
  { value: 'design-02', label: 'Design 02 — Awaiting reference', description: 'No design has been supplied for this slot.', disabled: true },
  { value: 'design-03', label: 'Design 03 — Awaiting reference', description: 'No design has been supplied for this slot.', disabled: true },
  { value: 'design-04', label: 'Design 04 — Awaiting reference', description: 'No design has been supplied for this slot.', disabled: true },
  { value: 'design-05', label: 'Design 05 — Awaiting reference', description: 'No design has been supplied for this slot.', disabled: true },
] as const
export type LayoutLabWorkspaceId = 'cinema2' | 'lyrics' | 'reference'
export const LAYOUT_LAB_WORKSPACES = [
  { value: 'cinema2', label: 'Cinema 2.0' },
  { value: 'lyrics', label: 'Lyric Manager' },
  { value: 'reference', label: 'Component reference' },
] as const
