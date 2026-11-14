/** The compact, persisted controls for the signal-driven Text V2 instrument. */
export const TEXT_V2_STYLES = [
  { value: 'contour', label: 'Contour / Live Beam' },
  { value: 'stereo', label: 'Stereo / XY Weave' },
  { value: 'harmonic', label: 'Harmonic / Ribbons' },
  { value: 'impact', label: 'Transient / Impact' },
  { value: 'reform', label: 'Scatter / Reform' },
] as const
export type TextV2Style = typeof TEXT_V2_STYLES[number]['value']
export type TextV2Grouping = 'both' | 'word' | 'letters'
export interface XyScopeTextV2Settings {
  autoPerformance: boolean
  grouping: TextV2Grouping
  abstraction: number
  response: number
  manualStyle: TextV2Style
}
export const DEFAULT_TEXT_V2_SETTINGS: Readonly<XyScopeTextV2Settings> = Object.freeze({
  autoPerformance: true, grouping: 'both', abstraction: 0.35, response: 1, manualStyle: 'contour',
})
export function textV2Unit(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0 }
export function normalizeTextV2Settings(value: unknown): XyScopeTextV2Settings {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const number = (key: string, fallback: number, max = 1) => typeof v[key] === 'number' && Number.isFinite(v[key]) ? Math.max(0, Math.min(max, v[key] as number)) : fallback
  return {
    autoPerformance: typeof v.autoPerformance === 'boolean' ? v.autoPerformance : DEFAULT_TEXT_V2_SETTINGS.autoPerformance,
    grouping: v.grouping === 'word' || v.grouping === 'letters' ? v.grouping : 'both',
    abstraction: number('abstraction', 0.35), response: number('response', 1, 1.5),
    manualStyle: TEXT_V2_STYLES.some(style => style.value === v.manualStyle) ? v.manualStyle as TextV2Style : 'contour',
  }
}
