export const DATA_BLEED_SETTINGS_VERSION = 1 as const
export const DATA_BLEED_FLOW_OPTIONS = [
  { value: 'motion', label: 'Motion' },
  { value: 'procedural', label: 'Procedural' },
  { value: 'mixed', label: 'Mixed' },
] as const
export type DataBleedFlowMode = typeof DATA_BLEED_FLOW_OPTIONS[number]['value']
export interface CanvasDataBleedSettings {
  version: typeof DATA_BLEED_SETTINGS_VERSION
  flowMode: DataBleedFlowMode
  amount: number
  blockSize: number
  motionSensitivity: number
  flowSpeed: number
  historyRetention: number
  sourceRefresh: number
  directionBias: number
  freezeHistory: boolean
  sourceMix: number
  audioReactivity: number
  bpmSync: boolean
  autoPerformance: boolean
  deterministicSeed: number
  quality: 'auto' | 'low' | 'balanced' | 'high'
}
export const DEFAULT_CANVAS_DATA_BLEED_SETTINGS: CanvasDataBleedSettings = {
  version: DATA_BLEED_SETTINGS_VERSION, flowMode: 'mixed', amount: 0.65,
  blockSize: 16, motionSensitivity: 0.5, flowSpeed: 1, historyRetention: 0.7,
  sourceRefresh: 0.25, directionBias: 0, freezeHistory: false, sourceMix: 0,
  audioReactivity: 0.65, bpmSync: false, autoPerformance: false,
  deterministicSeed: 91817, quality: 'auto',
}
export function normalizeCanvasDataBleedSettings(value: unknown): CanvasDataBleedSettings {
  const s = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const d = DEFAULT_CANVAS_DATA_BLEED_SETTINGS
  const n = (key: keyof CanvasDataBleedSettings, lo = 0, hi = 1): number => typeof s[key] === 'number' && Number.isFinite(s[key]) ? Math.max(lo, Math.min(hi, s[key] as number)) : d[key] as number
  const b = (key: 'freezeHistory' | 'bpmSync' | 'autoPerformance') => typeof s[key] === 'boolean' ? s[key] as boolean : d[key]
  return {
    version: DATA_BLEED_SETTINGS_VERSION,
    flowMode: DATA_BLEED_FLOW_OPTIONS.some(o => o.value === s.flowMode) ? s.flowMode as DataBleedFlowMode : d.flowMode,
    amount: n('amount'), blockSize: Math.round(n('blockSize', 2, 64)),
    motionSensitivity: n('motionSensitivity'), flowSpeed: n('flowSpeed', 0, 4),
    historyRetention: n('historyRetention', 0, 0.95), sourceRefresh: n('sourceRefresh'),
    directionBias: n('directionBias', -180, 180), freezeHistory: b('freezeHistory'),
    sourceMix: n('sourceMix'), audioReactivity: n('audioReactivity'), bpmSync: b('bpmSync'),
    autoPerformance: b('autoPerformance'), deterministicSeed: Math.round(n('deterministicSeed', 0, 0x7fffffff)),
    quality: s.quality === 'low' || s.quality === 'balanced' || s.quality === 'high' || s.quality === 'auto' ? s.quality : d.quality,
  }
}
// Session-only command identity: neither pixels nor a command counter enter the recipe.
let clearRevision = 0
export function clearDataBleedHistory(): void { clearRevision = (clearRevision + 1) % 0x7fffffff }
export function getDataBleedClearRevision(): number { return clearRevision }
