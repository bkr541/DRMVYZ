// Sound Drawing XY › WIREFRAME: chaotic transitions. When the figure changes (the user picks another, Auto Performance chooses one at a
// section) or a reaction rule asks for one, the cluster does not simply cut: it shatters and re-forms, melts into the new figure, glitches, or
// is flown through by the camera. Each is a short, bounded, deterministic sequence that always ends on the clean figure.
//
//   shatter   every corner flies outward along its own direction, the figure swaps at the top, then everything falls back into place
//   morph     the new figure's corners start where the old figure's were and flow to their places
//   glitch    the lines tear: horizontal slices of the picture slip sideways and the beam doubles, for a moment
//   zoom      the camera punches through the figure (it swells past the screen and fades), and the new one arrives from far away
//   cut       none; the new figure just grows in

export type WireTransitionStyle = 'cut' | 'shatter' | 'morph' | 'glitch' | 'zoom' | 'auto'
export type WireTransitionKind = 'shatter' | 'morph' | 'glitch' | 'zoom'
export const WIRE_TRANSITION_OPTIONS: readonly { value: WireTransitionStyle; label: string }[] = Object.freeze([
  { value: 'cut', label: 'None (cut)' }, { value: 'shatter', label: 'Shatter and reassemble' }, { value: 'morph', label: 'Morph' },
  { value: 'glitch', label: 'Glitch and tear' }, { value: 'zoom', label: 'Zoom through' }, { value: 'auto', label: 'Auto (all styles)' },
])
export const WIRE_TRANSITION_KINDS: readonly WireTransitionKind[] = Object.freeze(['shatter', 'morph', 'glitch', 'zoom'])

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x) }

/** How long each takes, in seconds, and the point (0..1) at which the figure itself swaps. */
const TIMING: Readonly<Record<WireTransitionKind, { seconds: number; swapAt: number }>> = Object.freeze({
  shatter: { seconds: 1.15, swapAt: .42 }, morph: { seconds: 1.25, swapAt: 0 }, glitch: { seconds: .6, swapAt: .25 }, zoom: { seconds: 1.05, swapAt: .5 },
})

export interface TransitionFrame {
  active: boolean
  kind: WireTransitionKind | null
  /** 0..1 through the transition. */
  p: number
  /** True on the one frame the figure should swap. */
  swap: boolean
}

export class WireTransition {
  kind: WireTransitionKind | null = null
  private time = 0
  private swapped = false

  get active(): boolean { return this.kind !== null }
  get p(): number { return this.kind ? clamp(this.time / TIMING[this.kind].seconds) : 0 }

  /** Starts a transition unless one is already running. `swapNow` is for a figure that changed this frame (it is what will swap). */
  start(kind: WireTransitionKind): boolean {
    if (this.kind) return false
    this.kind = kind; this.time = 0; this.swapped = false
    return true
  }

  reset(): void { this.kind = null; this.time = 0; this.swapped = false }

  update(dt: number): TransitionFrame {
    if (!this.kind) return { active: false, kind: null, p: 0, swap: false }
    const timing = TIMING[this.kind]
    this.time += dt
    const p = clamp(this.time / timing.seconds)
    let swap = false
    if (!this.swapped && p >= timing.swapAt) { this.swapped = true; swap = true }
    const frame: TransitionFrame = { active: true, kind: this.kind, p, swap }
    if (p >= 1) { this.kind = null; this.time = 0 }
    return frame
  }
}

/** How far into its explosion a shattered figure is, 0 (whole) to 1 (flung apart): out quickly, then back as it re-forms. */
export function shatterAmount(p: number): number {
  const at = TIMING.shatter.swapAt
  return p < at ? smooth(p / at) : 1 - smooth((p - at) / (1 - at))
}

/** The direction corner `index` flies in (a unit vector from a hash of the index; the same corner always flies the same way). */
export function shatterDirection(index: number, out: Float32Array): void {
  const a = Math.sin(index * 12.9898 + 1) * 43758.5453, b = Math.sin(index * 78.233 + 2) * 43758.5453
  const u = a - Math.floor(a), v = b - Math.floor(b)
  const z = u * 2 - 1, angle = v * Math.PI * 2, r = Math.sqrt(1 - z * z)
  out[0] = r * Math.cos(angle); out[1] = r * Math.sin(angle); out[2] = z
}

/** How far the camera has flown through the figure, 0..1 (peaking at the swap). */
export function zoomAmount(p: number): number {
  const at = TIMING.zoom.swapAt
  return p < at ? smooth(p / at) : 1 - smooth((p - at) / (1 - at))
}

/** The scale the figure is drawn at during a zoom: it swells past the screen, then the new one arrives from far. */
export function zoomScale(p: number): number { return 1 + 5 * zoomAmount(p) }
/** The brightness during a zoom: it fades as it passes the camera so the screen does not white out. */
export function zoomFade(p: number): number { return 1 - .85 * zoomAmount(p) ** 2 }

/** How strongly the picture tears, 1 at the start, fading to 0. */
export function glitchAmount(p: number): number { return p >= 1 ? 0 : (1 - Math.max(0, p)) ** 1.5 }

/** The morph's progress for the new figure's corners: 0 at the old figure's places, 1 at their own. */
export function morphMix(p: number): number { return smooth(p) }

/** The slice a glitch tears (the screen is cut into horizontal bands) and how far each slips, a repeatable function of the band and the time. */
export function glitchSlip(band: number, step: number): number {
  const a = Math.sin(band * 91.7 + step * 17.3) * 43758.5453
  const u = a - Math.floor(a)
  return u < .45 ? 0 : (u - .45) / .55 * 2 - 1 // about half the bands are left alone
}
