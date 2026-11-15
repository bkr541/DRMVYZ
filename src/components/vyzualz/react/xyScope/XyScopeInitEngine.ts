// Sound Drawing XY › INIT: the oscilloscope maths. One to three straight oscilloscope lines, each with a start and
// an end point in stage coordinates (-1…1), carrying a triggered slice of a live waveform. Layout places the lines,
// Free Endpoints (and the Omnidirectional layout) re-pick them at random on the beat grid or a free-running clock.
// Nothing here draws; XyScopeInitRenderer turns the output into pixels.

import type { Osc1Features } from './XyScopeOsc1Engine'
import type { InitLayout, InitSignal, InitValues } from './XyScopeInitSettings'

export const INIT_TRACE_POINTS = 240
export const INIT_MAX_SCOPES = 3
const PCM = 2048
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

export type InitSource = 'stereo' | 'mono' | 'shared' | 'none'
export interface InitScopeState { ax: number; ay: number; bx: number; by: number }
export interface InitPcm { left: ArrayLike<number>; right: ArrayLike<number>; sampleRate: number }

/** A small seeded generator, so a given seed always chooses the same endpoints. */
export function initRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The resting position of each oscilloscope for a layout: horizontal lines, in stage coordinates. */
export function initLayoutSlots(layout: InitLayout, count: number, span: number): InitScopeState[] {
  return Array.from({ length: count }, (_, i) => {
    if (layout === 'side') {
      const half = span / count * .94, cx = -1 + (i + .5) * 2 / count
      return { ax: cx - half, ay: 0, bx: cx + half, by: 0 }
    }
    if (layout === 'stacked' || layout === 'omni') {
      const y = count === 1 ? 0 : ((i + .5) / count * 2 - 1) * .72
      return { ax: -span, ay: y, bx: span, by: y }
    }
    return { ax: -span, ay: 0, bx: span, by: 0 }
  })
}

const limit = (v: number) => Math.max(-.96, Math.min(.96, v))

/** A line of the given centre, angle (radians) and half length, clamped to the stage. */
function lineAt(cx: number, cy: number, angle: number, half: number): InitScopeState {
  const dx = Math.cos(angle) * half, dy = Math.sin(angle) * half
  return { ax: limit(cx - dx), ay: limit(cy - dy), bx: limit(cx + dx), by: limit(cy + dy) }
}

/** Chooses every scope's target. Omnidirectional picks anywhere on screen (diagonals included); Free Endpoints tilts each slot's line. */
export function initPickTargets(layout: InitLayout, count: number, span: number, free: boolean, random: () => number): InitScopeState[] {
  const slots = initLayoutSlots(layout, count, span)
  return slots.map(slot => {
    if (layout === 'omni') return lineAt((random() - .5) * 1.1, (random() - .5) * 1.0, random() * Math.PI, span * (.45 + random() * .4))
    if (!free) return slot
    const half = Math.hypot(slot.bx - slot.ax, slot.by - slot.ay) / 2
    const cx = (slot.ax + slot.bx) / 2 + (random() - .5) * .2, cy = (slot.ay + slot.by) / 2 + (random() - .5) * .2
    return lineAt(cx, cy, (random() - .5) * Math.PI, half * (.85 + random() * .25))
  })
}

/** Which stream each scope shows, and how much of the window it zooms to. */
export interface InitStreamPlan { stream: 'full' | 'left' | 'right' | 'low' | 'mid' | 'high' | 'rest'; zoom: number; band: 0 | 1 | 2 }
export function initStreamPlan(signal: InitSignal, count: number): InitStreamPlan[] {
  const bands: InitStreamPlan['band'][] = [0, 1, 2]
  const plan = (stream: InitStreamPlan['stream'], i: number, zoom = 1): InitStreamPlan => ({ stream, zoom, band: bands[i] })
  if (signal === 'channels') return count === 1 ? [plan('full', 0)] : count === 2 ? [plan('left', 0), plan('right', 1)] : [plan('left', 0), plan('right', 1), plan('full', 2)]
  if (signal === 'timebase') return Array.from({ length: count }, (_, i) => plan('full', i, [1, .5, .25][i]))
  return count === 1 ? [plan('full', 0)] : count === 2 ? [plan('low', 0), plan('rest', 1)] : [plan('low', 0), plan('mid', 1), plan('high', 2)]
}

export class InitEngine {
  readonly scopes: InitScopeState[] = Array.from({ length: INIT_MAX_SCOPES }, () => ({ ax: -.9, ay: 0, bx: .9, by: 0 }))
  readonly waves: Float32Array[] = Array.from({ length: INIT_MAX_SCOPES }, () => new Float32Array(INIT_TRACE_POINTS))
  kickPulse = 0
  snarePulse = 0
  /** How many times the endpoints have been re-picked, for tests and the inspector. */
  repicks = 0
  private targets: InitScopeState[] = []
  private key = ''
  private slot = Number.NaN
  private random = initRandom(0x1a17)
  private seed = 0x1a17
  private phase = [0, 0, 0]
  private readonly full = new Float32Array(PCM)
  private readonly low = new Float32Array(PCM)
  private readonly mid = new Float32Array(PCM)
  private readonly high = new Float32Array(PCM)
  private readonly rest = new Float32Array(PCM)

  reset(seed = 0x1a17): void {
    this.seed = seed
    this.random = initRandom(seed)
    this.key = ''
    this.slot = Number.NaN
    this.kickPulse = 0
    this.snarePulse = 0
    this.phase = [0, 0, 0]
    this.repicks = 0
    for (const wave of this.waves) wave.fill(0)
  }

  get targetStates(): readonly InitScopeState[] { return this.targets }

  /**
   * Moves the scope ends. `beat` is the track's beat position (BPM Sync) or a free-running beat count; the endpoints
   * are re-picked each time it crosses a `changeEvery` boundary, or at once when the layout changes.
   */
  update(dt: number, beat: number, count: number, values: Pick<InitValues, 'layout' | 'freeEndpoints' | 'span' | 'changeEvery' | 'glide'>): void {
    const key = `${count}|${values.layout}|${values.freeEndpoints}|${values.span}`
    const slot = Math.floor(beat / Number(values.changeEvery))
    const random = values.layout === 'omni' || values.freeEndpoints
    const moved = this.targets.length !== count || key !== this.key || (random && slot !== this.slot)
    if (moved) {
      const firstPick = this.targets.length === 0
      this.targets = initPickTargets(values.layout, count, values.span, values.freeEndpoints, this.random)
      this.key = key
      this.repicks += 1
      // The very first placement (and a layout switch away from random) lands in place instead of gliding from the default line.
      if (firstPick) this.targets.forEach((target, i) => { this.scopes[i] = { ...target } })
    }
    this.slot = slot
    const k = values.glide <= 0 ? 1 : 1 - Math.exp(-dt * 1000 / values.glide)
    for (let i = 0; i < count; i++) {
      const s = this.scopes[i], t = this.targets[i]
      s.ax += (t.ax - s.ax) * k; s.ay += (t.ay - s.ay) * k; s.bx += (t.bx - s.bx) * k; s.by += (t.by - s.by) * k
    }
  }

  /** Fills each scope's waveform for this frame (values -1…1, left to right along the scope line). */
  sample(dt: number, count: number, values: InitValues, features: Osc1Features, pcm: InitPcm | null, source: InitSource): void {
    const decay = Math.exp(-dt * 8)
    const onsets = features.onsets
    const kick = onsets ? Math.max(onsets[0] ?? 0, onsets[1] ?? 0) : 0
    const snare = onsets ? Math.max(onsets[4] ?? 0, onsets[5] ?? 0, onsets[6] ?? 0, onsets[7] ?? 0) : 0
    this.kickPulse = Math.max(this.kickPulse * decay, clamp(kick) * values.kickResponse)
    this.snarePulse = Math.max(this.snarePulse * decay, clamp(snare) * values.snareResponse)

    const plan = initStreamPlan(values.signal, count)
    if (source === 'none') { for (let i = 0; i < count; i++) this.waves[i].fill(0); return }
    if (!pcm || source === 'shared') { this.synthesize(dt, count, plan, values, features); return }
    this.prepareStreams(pcm, values.signal)
    const left = pcm.left, right = pcm.right
    const lastL = left.length, lastR = right.length
    const gain = 2.6 * values.waveResponse * values.audioReactivity
    for (let i = 0; i < count; i++) {
      const p = plan[i]
      const window = Math.max(64, Math.min(PCM - 8, Math.round(values.window * .001 * pcm.sampleRate * p.zoom)))
      const read = (index: number): number => {
        switch (p.stream) {
          case 'left': return pcmAt(left, lastL, index)
          case 'right': return pcmAt(right, lastR, index)
          case 'low': return this.low[index]
          case 'mid': return this.mid[index]
          case 'high': return this.high[index]
          case 'rest': return this.rest[index]
          default: return this.full[index]
        }
      }
      // Trigger on the first rising zero crossing so a steady tone holds still on the screen.
      let start = 0
      for (let k = 1; k < PCM - window; k++) { if (read(k - 1) <= 0 && read(k) > 0) { start = k; break } }
      const wave = this.waves[i]
      for (let k = 0; k < INIT_TRACE_POINTS; k++) wave[k] = Math.tanh(read(Math.min(PCM - 1, start + Math.floor(k / (INIT_TRACE_POINTS - 1) * (window - 1)))) * gain)
    }
  }

  private prepareStreams(pcm: InitPcm, signal: InitSignal): void {
    const { left, right } = pcm
    for (let i = 0; i < PCM; i++) this.full[i] = (pcmAt(left, left.length, i) + pcmAt(right, right.length, i)) * .5
    if (signal !== 'bands') return
    const lowA = 1 - Math.exp(-2 * Math.PI * 220 / pcm.sampleRate), midA = 1 - Math.exp(-2 * Math.PI * 2400 / pcm.sampleRate)
    let l1 = 0, l2 = 0
    for (let i = 0; i < PCM; i++) {
      const x = this.full[i]
      l1 += (x - l1) * lowA; l2 += (x - l2) * midA
      this.low[i] = l1; this.mid[i] = l2 - l1; this.high[i] = x - l2; this.rest[i] = x - l1
    }
  }

  /** With no PCM (shared analysis only), each scope draws a sine whose amplitude follows its band's energy. */
  private synthesize(dt: number, count: number, plan: InitStreamPlan[], values: InitValues, f: Osc1Features): void {
    const bandLevel = [f.bass, f.mid, f.air]
    for (let i = 0; i < count; i++) {
      const p = plan[i]
      const level = values.signal === 'bands' ? (p.stream === 'rest' ? Math.max(f.mid, f.air) : bandLevel[p.band]) : f.level
      const cycles = values.signal === 'timebase' ? [1.5, 3, 6][i] : [1.5, 4, 11][i]
      this.phase[i] = (this.phase[i] + dt * (1.2 + i * .8)) % 1
      const amp = clamp(level) * values.waveResponse * values.audioReactivity
      const wave = this.waves[i]
      for (let k = 0; k < INIT_TRACE_POINTS; k++) wave[k] = Math.sin(2 * Math.PI * (cycles * k / (INIT_TRACE_POINTS - 1) + this.phase[i])) * Math.min(1, amp)
    }
  }
}

function pcmAt(source: ArrayLike<number>, length: number, index: number): number {
  // Windows shorter than the analysis size are right-aligned with leading silence, as the analyser does.
  const offset = length - PCM
  const i = offset >= 0 ? offset + index : index + offset
  return i >= 0 && i < length ? source[i] : 0
}
