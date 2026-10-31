import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
import { resolveCinema2EffectiveBpm } from '../Cinema2BeatClock'
export const GLASSFALL_PATTERNS = ['glassfall', 'cascade', 'splitCurrent', 'prismTrace', 'darkWindows', 'prismRelay'] as const
export type GlassfallPattern = typeof GLASSFALL_PATTERNS[number]
export const GLASSFALL_PATTERN_LABELS = ['Glassfall', 'Cascade', 'Split Current', 'Prism Trace', 'Dark Windows', 'Prism Relay']
export interface GlassfallControls {
  intensity: number; scale: number; spacing: number; speed: number; sequenceSpeed: number; relief: number
  reflectionStrength?: number;
  sync: boolean; pattern: GlassfallPattern
  background: number[]; cyan: number[]; violet: number[]; highlight: number[]; panel: number[]
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
export const GLASSFALL_PALETTE = { background: rgb('#10152d'), cyan: rgb('#00d4ed'), violet: rgb('#7725ff'), highlight: rgb('#c8d9ff'), panel: rgb('#080a11') }
export const GLASSFALL_NUMBERS = { intensity: [0, 1, 1], scale: [.75, 1, 1.25], spacing: [.9, 1, 1.25], speed: [0, .35, 1.5], sequenceSpeed: [0, .65, 2], relief: [.5, 1, 1.5] } as const
export const GLASSFALL_DEFAULT_CONTROLS: GlassfallControls = { ...GLASSFALL_PALETTE, ...Object.fromEntries(Object.entries(GLASSFALL_NUMBERS).map(([key, range]) => [key, range[1]])), sync: true, pattern: 'glassfall' } as GlassfallControls
export function readGlassfallControls(parameters: Cinema2ModuleParameterReadFacet): GlassfallControls {
  const c = { ...GLASSFALL_DEFAULT_CONTROLS }
  for (const [key, [min, fallback, max]] of Object.entries(GLASSFALL_NUMBERS)) {
    const value = parameters.get(key)
    Object.assign(c, { [key]: typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback })
  }
  for (const key of Object.keys(GLASSFALL_PALETTE) as Array<keyof typeof GLASSFALL_PALETTE>) {
    const value = parameters.get(key)
    if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(v => typeof v === 'number' && Number.isFinite(v))) c[key] = value.slice(0, 3) as number[]
  }
  const reflection = parameters.get('reflectionStrength')
  if (typeof reflection === 'number' && Number.isFinite(reflection)) c.reflectionStrength = Math.max(0, Math.min(1, reflection))
  c.sync = parameters.get('sync') !== false
  const pattern = parameters.get('pattern') as GlassfallPattern
  if (GLASSFALL_PATTERNS.includes(pattern)) c.pattern = pattern
  return c
}
export interface GlassfallPhases { travel: number; score: number }
/** Uses the host's canonical transport/grid. Edits preserve phase; discontinuities
 * reconstruct it. This is a visual mapping, not a second beat detector/clock. */
export class GlassfallTimeline {
  private previous: Pick<GlassfallControls, 'sync' | 'speed' | 'sequenceSpeed'> | null = null
  private offsets = { travel: 0, score: 0 }
  private last = { travel: 0, score: 0 }
  reset() { this.previous = null; this.offsets = { travel: 0, score: 0 } }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, time: number, c: GlassfallControls, reset: boolean): GlassfallPhases {
    if (reset) this.reset()
    const idle = frame.transport?.sourcePresent === false
    const index = frame.audio?.rhythm.beatIndex, phase = frame.audio?.rhythm.beatPhase
    const grid = c.sync && !idle && index?.available && phase?.available && typeof index.value === 'number' && typeof phase.value === 'number'
    const position = grid ? index!.value! + phase!.value! : time * (c.sync && !idle ? (resolveCinema2EffectiveBpm(frame) ?? 120) / 60 : 2)
    const raw = { travel: position * c.speed * .22 * (idle ? .15 : 1), score: position * c.sequenceSpeed * (idle ? .15 : 1) }
    if (this.previous && (this.previous.sync !== c.sync || this.previous.speed !== c.speed || this.previous.sequenceSpeed !== c.sequenceSpeed)) {
      this.offsets = { travel: this.last.travel - raw.travel, score: this.last.score - raw.score }
    }
    this.previous = { sync: c.sync, speed: c.speed, sequenceSpeed: c.sequenceSpeed }
    this.last = { travel: raw.travel + this.offsets.travel, score: raw.score + this.offsets.score }
    return { ...this.last }
  }
}
export const glassfallModulo = (v: number, span: number) => ((v % span) + span) % span
/** Lighting vocabulary, always on the approved paired-band lattice. */
export function glassfallIllumination(pattern: GlassfallPattern, x: number, y: number, inverted: boolean, score: number): number {
  const wave = (v: number) => Math.pow(.5 + .5 * Math.cos(v * Math.PI * 2), 5)
  switch (pattern) {
    case 'glassfall': return .5 + .5 * wave(score / 5 + x * .17 + y * .11)
    case 'cascade': return .12 + .88 * wave(score / 4 - y * .20)
    case 'splitCurrent': return .15 + .85 * wave(score / 3 * (Math.round(x / 1.04) % 2 ? -1 : 1) + x * .19)
    case 'prismTrace': return .9
    case 'darkWindows': return Math.cos(x * 2 - score) * Math.cos(y * 1.8 + score * .7) > .05 ? .05 : 1
    case 'prismRelay': return .08 + .92 * wave(score / 3 - x * .13 - y * .09 - (inverted ? 0 : .2))
  }
}
