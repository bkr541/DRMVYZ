import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'

export const CINEMA2_NIGHTSHIFT_PATTERNS = [
  { value: 'nightshift', label: 'Nightshift' },
  { value: 'crossfade-checker', label: 'Crossfade Checker' },
  { value: 'runway', label: 'Runway' },
  { value: 'diamond-ripple', label: 'Diamond Ripple' },
  { value: 'diagonal-relay', label: 'Diagonal Relay' },
  { value: 'quadrant-exchange', label: 'Quadrant Exchange' },
  { value: 'midnight-sparse', label: 'Midnight Sparse' },
  { value: 'full-house', label: 'Full House' },
] as const
export type NightshiftPattern = typeof CINEMA2_NIGHTSHIFT_PATTERNS[number]['value']
export type NightshiftRgb = readonly [number, number, number]
export const NIGHTSHIFT_COLORS = {
  background: [0.008, 0.016, 0.067, 1], cyan: [25 / 255, 237 / 255, 1, 1],
  magenta: [1, 32 / 255, 217 / 255, 1], blue: [50 / 255, 59 / 255, 1, 1],
  amber: [1, 179 / 255, 28 / 255, 1], ball: [218 / 255, 192 / 255, 216 / 255, 1],
} as const

export interface NightshiftControls {
  master: number; bpmSync: boolean; motion: number; rotation: boolean; musicResponse: number; autoPerformance: boolean
  floor: number; ball: number; ceiling: number; coverage: number
  pattern: NightshiftPattern; patternChange: boolean; trigger: string
  colors: Record<keyof typeof NIGHTSHIFT_COLORS, NightshiftRgb>
}
export function readNightshiftControls(parameters: Cinema2ModuleParameterReadFacet): NightshiftControls {
  const n = (name: string, fallback: number) => {
    const value = parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
  }
  const pattern = parameters.get('pattern')
  return {
    master: n('master', .85), bpmSync: parameters.get('bpmSync') !== false,
    motion: n('motion', .35), rotation: parameters.get('rotation') !== false, musicResponse: n('musicResponse', .8),
    autoPerformance: parameters.get('autoPerformance') === true,
    floor: n('floor', .8), ball: n('ball', .75), ceiling: n('ceiling', .7), coverage: n('coverage', .75),
    pattern: CINEMA2_NIGHTSHIFT_PATTERNS.some(p => p.value === pattern) ? pattern as NightshiftPattern : 'nightshift',
    patternChange: parameters.get('patternChange') === true,
    trigger: typeof parameters.get('trigger') === 'string' ? parameters.get('trigger') as string : 'bar4',
    colors: Object.fromEntries(Object.entries(NIGHTSHIFT_COLORS).map(([name, fallback]) => {
      const v = parameters.get(`${name}Color`)
      return [name, Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(c => typeof c === 'number' && Number.isFinite(c))
        ? v.slice(0, 3).map(c => Math.min(1, Math.max(0, c as number))) : fallback.slice(0, 3)]
    })) as unknown as NightshiftControls['colors'],
  }
}

export interface NightshiftCell { row: number; column: number; paletteIndex: number; level: number }
const mod = (x: number, n: number) => ((x % n) + n) % n
const band = (distance: number, width: number) => Math.exp(-(distance * distance) / (width * width))
export const nightshiftCoverageMask = (cell: NightshiftCell, coverage: number) => Math.min(1, Math.max(0, (coverage - mod(cell.row * 37 + cell.column * 19, 100) / 100) * 10))

/** Pure spatial programs: none moves the physical installation. */
export function evaluateNightshiftCell(cell: NightshiftCell, pattern: NightshiftPattern, phase: number, coverage: number): { family: number; gain: number } {
  const { row: r, column: c } = cell
  const width = .35 + coverage * 1.8
  let family = cell.paletteIndex, gain = [0.1, 1 / 2.2, 1][cell.level] ?? 1
  const slow = phase / 8
  if (pattern === 'nightshift') {
    const wave = .88 + .12 * Math.cos(slow + r * 1.3 + c * .7)
    gain *= wave
  } else if (pattern === 'crossfade-checker') {
    const parity = (r + c) % 2
    gain = .06 + .94 * (.5 + .5 * Math.cos(phase * Math.PI / 2 + parity * Math.PI))
    family = parity ? 1 : 0
  } else if (pattern === 'runway') {
    const front = mod(phase * 1.25, 12) - 1
    gain = .035 + .965 * band(r - front, width)
    family = r % 4
  } else if (pattern === 'diamond-ripple') {
    const distance = Math.abs(r - 4.5) + Math.abs(c - 4.5)
    gain = .025 + .975 * band(distance - mod(phase * 1.3, 12), width)
    family = Math.floor(distance) % 4
  } else if (pattern === 'diagonal-relay') {
    const reverse = Math.floor(phase / 12) % 2 === 1
    const distance = mod((reverse ? 9 - c : c) + r - phase * 1.5, 10)
    gain = .025 + .975 * band(Math.min(distance, 10 - distance), width)
    family = (r + c) % 4
  } else if (pattern === 'quadrant-exchange') {
    const quadrant = (r >= 5 ? 2 : 0) + (c >= 5 ? 1 : 0)
    const step = mod(Math.floor(phase / 2), 4)
    gain = quadrant === step ? 1 : .035
    family = quadrant
  } else if (pattern === 'midnight-sparse') {
    const ordinal = mod(r * 17 + c * 31, 23)
    gain = ordinal === mod(Math.floor(phase / 2), 23) || ordinal === mod(Math.floor(phase / 2) + 7, 23) ? .8 : .006
  } else {
    const radius = Math.hypot(r - 4.5, c - 4.5)
    gain = .55 + .45 * (.5 + .5 * Math.cos(radius * 1.7 - phase * 2))
    family = mod(Math.floor(radius) + Math.floor(phase / 4), 4)
  }
  // Coverage gates deterministic cell addresses with a soft boundary. Its upper
  // quarter continues widening coverage rather than saturating at the default.
  const mask = nightshiftCoverageMask(cell, coverage)
  return { family, gain: gain * mask }
}

/** Event ownership only; event meanings come from the shared resolver. */
export class NightshiftPatternController {
  private authored: NightshiftPattern | null = null
  private base: NightshiftPattern = 'nightshift'
  private editRevision = -1
  private enabled = false
  private trigger = ''
  private readonly seen = new Set<string>()
  update(authored: NightshiftPattern, enabled: boolean, trigger: string, eventId: string | null, editRevision: number, reset: boolean, hold = false): NightshiftPattern {
    const edited = this.authored !== authored || this.editRevision !== editRevision
    const changed = this.enabled !== enabled || this.trigger !== trigger
    if (reset) this.seen.clear()
    if (reset || edited || changed || !enabled) {
      this.base = authored
      if (eventId) this.seen.add(eventId)
    } else if (hold) {
      if (eventId) this.seen.add(eventId)
    } else if (eventId && !this.seen.has(eventId)) {
      const index = CINEMA2_NIGHTSHIFT_PATTERNS.findIndex(p => p.value === this.base)
      this.base = CINEMA2_NIGHTSHIFT_PATTERNS[(index + 1) % CINEMA2_NIGHTSHIFT_PATTERNS.length].value
      this.seen.add(eventId)
    }
    if (this.seen.size > 128) this.seen.delete(this.seen.values().next().value!)
    this.authored = authored; this.editRevision = editRevision; this.enabled = enabled; this.trigger = trigger
    return this.base
  }
}

/** Automatic changes blend on the shared visual timeline; manual edits reclaim
 * immediately. This owns presentation, never program selection or a music clock. */
export class NightshiftPatternTransition {
  private current: NightshiftPattern | null = null
  private outgoing: NightshiftPattern | null = null
  private startSec = 0
  update(pattern: NightshiftPattern, timeSec: number, manual: boolean, reset: boolean) {
    if (reset || manual || this.current == null) {
      this.current = pattern; this.outgoing = null
    } else if (this.current !== pattern) {
      this.outgoing = this.current; this.current = pattern; this.startSec = timeSec
    }
    const t = Math.max(0, Math.min(1, (timeSec - this.startSec) / .3))
    if (t >= 1) this.outgoing = null
    return { outgoingPattern: this.outgoing, blend: this.outgoing ? t * t * (3 - 2 * t) : 1 }
  }
}
