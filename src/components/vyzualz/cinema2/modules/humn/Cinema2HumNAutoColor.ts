import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'

/**
 * Auto Color for HUM:N: a three-colour palette picked from what the music is doing, so the manual colours can be left alone.
 *
 *   key (circle of fifths) + mode  -> where the palette sits on the colour wheel (minor keys sit cooler than major ones)
 *   spectral centroid              -> bright, airy sound tilts the palette toward the warm/bright side
 *   energy                         -> saturation, and how far apart the three colours sit (calm = neighbours, loud = the full wheel)
 *   section change                 -> the palette jumps by a fixed step (slewed, never a cut)
 *   chord change                   -> a small nudge
 *   drop                           -> saturation and spread swell while the drop lasts
 * With no analysis (or no key) the centroid and the bar count still steer it; with no audio at all the palette turns slowly on its own.
 * The result is smoothed on the wheel so it never flickers between colours.
 */

export interface Cinema2HumNAutoPalette {
  /** Three fill colours (linear 0..1 RGB). */
  readonly colors: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]
  /** Wireframe colour: near white, tinted by the palette. */
  readonly wireframe: readonly [number, number, number]
  /** Pattern ink (stripes, dots, eyes): white with a whisper of the palette. */
  readonly ink: readonly [number, number, number]
  readonly hue: number
  readonly spread: number
  readonly saturation: number
}

const PITCH_CLASS: Readonly<Record<string, number>> = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })
const SECTION_STEP_DEGREES = 52
const CHORD_STEP_DEGREES = 12
const HUE_SLEW_DEGREES_PER_SECOND = 70
const IDLE_DRIFT_DEGREES_PER_SECOND = 6

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function wrapDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

/** Signed shortest arc from `from` to `to`, in (-180, 180]. */
function arc(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180
}

/** Pitch class (0-11) from a key name such as "C", "F#", "Bb", "A minor". Null when it cannot be read. */
export function cinema2HumNPitchClass(key: string | null | undefined): number | null {
  if (!key) return null
  const match = /^\s*([A-Ga-g])\s*([#b♯♭]?)/.exec(key)
  if (!match) return null
  const base = PITCH_CLASS[match[1]!.toUpperCase()]
  if (base === undefined) return null
  const accidental = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0
  return (base + accidental + 12) % 12
}

export function hsvToRgb(hue: number, saturation: number, value: number): readonly [number, number, number] {
  const h = wrapDegrees(hue) / 60
  const c = value * saturation
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = value - c
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return [r + m, g + m, b + m]
}

export class Cinema2HumNAutoColor {
  private hue = 200
  private saturation = 0.85
  private spread = 90
  private sectionOffset = 0
  private chordOffset = 0
  private energy = 0
  private drop = 0
  private sectionId: string | null = null
  private chord: string | null = null
  private initialized = false
  private palette: Readonly<Cinema2HumNAutoPalette> = this.compose()

  reset(): void {
    this.hue = 200
    this.saturation = 0.85
    this.spread = 90
    this.sectionOffset = 0
    this.chordOffset = 0
    this.energy = 0
    this.drop = 0
    this.sectionId = null
    this.chord = null
    this.initialized = false
    this.palette = this.compose()
  }

  getPalette(): Readonly<Cinema2HumNAutoPalette> {
    return this.palette
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>): Readonly<Cinema2HumNAutoPalette> {
    const dt = Number.isFinite(frame.deltaTimeSec) ? Math.min(Math.max(frame.deltaTimeSec, 0), 0.25) : 0
    const audio = frame.audio
    let targetHue: number
    let targetEnergy = 0
    let targetDrop = 0

    if (audio == null) {
      // No analysis: the palette turns slowly on its own so Auto Color is never a frozen colour.
      targetHue = wrapDegrees(this.hue + IDLE_DRIFT_DEGREES_PER_SECOND * dt)
    } else {
      const harmonic = audio.harmonic
      const key = harmonic?.available ? harmonic.value : null
      const pitch = cinema2HumNPitchClass(key?.key)
      const centroid = audio.features.spectralCentroid.available ? clamp01(audio.features.spectralCentroid.value ?? 0) : 0.5
      const bar = audio.rhythm.barIndex.available && typeof audio.rhythm.barIndex.value === 'number' ? audio.rhythm.barIndex.value : 0
      // Circle of fifths, so related keys sit next to each other on the wheel; minor keys move toward the cool side.
      const keyHue = pitch != null ? ((pitch * 7) % 12) * 30 + (key?.mode === 'minor' ? 150 : 20) : wrapDegrees(bar * 9 + 20)
      targetHue = keyHue + (centroid - 0.5) * 70 + this.sectionOffset + this.chordOffset

      const section = audio.structure.section.available ? audio.structure.section.value : null
      const sectionId = section?.id ?? null
      if (this.initialized && sectionId != null && sectionId !== this.sectionId) this.sectionOffset += SECTION_STEP_DEGREES
      this.sectionId = sectionId
      const chordName = key?.chordChanged ? key.chord : this.chord
      if (this.initialized && key?.chordChanged && chordName && chordName !== this.chord) this.chordOffset += CHORD_STEP_DEGREES
      this.chord = chordName ?? null
      // Offsets relax back so a long track does not wind the palette round for ever.
      this.sectionOffset *= Math.exp(-dt / 40)
      this.chordOffset *= Math.exp(-dt / 12)

      targetEnergy = clamp01((audio.features.overallEnergy.available ? audio.features.overallEnergy.value ?? 0 : 0) / 0.45)
      targetDrop = clamp01(audio.structure.dropConfidence.available ? audio.structure.dropConfidence.value ?? 0 : 0)
    }

    if (!this.initialized) {
      this.hue = wrapDegrees(targetHue)
      this.initialized = true
    } else {
      const maxStep = HUE_SLEW_DEGREES_PER_SECOND * dt
      const delta = arc(this.hue, targetHue)
      this.hue = wrapDegrees(this.hue + Math.min(Math.max(delta * (1 - Math.exp(-dt / 0.9)), -maxStep), maxStep))
    }
    this.energy += (targetEnergy - this.energy) * (1 - Math.exp(-dt / 0.5))
    this.drop += (targetDrop - this.drop) * (1 - Math.exp(-dt / 0.4))
    this.saturation = 0.62 + 0.3 * this.energy + 0.08 * this.drop
    this.spread = 42 + 62 * this.energy + 30 * this.drop
    this.palette = this.compose()
    return this.palette
  }

  private compose(): Readonly<Cinema2HumNAutoPalette> {
    const saturation = clamp01(this.saturation)
    const colors = [
      hsvToRgb(this.hue, saturation, 1),
      hsvToRgb(this.hue + this.spread, saturation, 1),
      hsvToRgb(this.hue + this.spread * 2, saturation, 1),
    ] as const
    const tint = hsvToRgb(this.hue, 0.07, 1)
    return Object.freeze({
      colors,
      wireframe: [tint[0] * 0.98, tint[1] * 0.98, tint[2] * 0.98] as const,
      ink: [1, 1, 1] as const,
      hue: this.hue,
      spread: this.spread,
      saturation,
    })
  }
}
