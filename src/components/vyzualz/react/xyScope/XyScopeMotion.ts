// Sound Drawing XY: the motion model. Pure functions that turn a letter's geometry, its conversation state and
// the live scope window into screen points. Nothing here keeps hidden state or uses randomness, so the same
// inputs always draw the same frame.
//
// The audio never scatters points. Letters ring like a plucked string (a standing wave along the outline that
// starts on each hit and settles), ripple when answered, and fray into the live stereo scope — a short slice of the
// track's real left/right signal. When the pattern changes, the points unspool along the outlines into an
// oscillator form (a waveform, a ring, a rosette...) and are drawn back into letters when it changes again.

import type { XyScopeGlyphGeometry } from './XyScopeGeometry'
import type { XyScopeGlyphState } from './XyScopeConversation'
import { computeXyScopeFormPoint, xyScopeFormBreak, XY_SCOPE_PATTERN_IDS, type XyScopeFormDrive, type XyScopeFormPattern, type XyScopePoint } from './XyScopePatterns'

export const XY_SCOPE_CLOUD_SAMPLES = 512
export const XY_SCOPE_WAVE_SAMPLES = 32
const WINDOW_SAMPLES = XY_SCOPE_CLOUD_SAMPLES * 4

/** One frame of the live scope: a mid/side trace for the dissolve cloud and a smoothed waveform for texture. */
export interface XyScopeScopeFrame {
  cloudX: Float32Array
  cloudY: Float32Array
  wave: Float32Array
  /** The mid signal low-passed to a readable oscilloscope trace (about 1 kHz), for the Waveform pattern. */
  trace: Float32Array
  /** Gain that fits the trace to the letter box. */
  cloudGain: number
  waveGain: number
  traceGain: number
  /** 0..1 loudness relative to the recent peak. */
  level: number
  source: 'stereo' | 'fallback'
}

export function createXyScopeScopeFrame(): XyScopeScopeFrame {
  return {
    cloudX: new Float32Array(XY_SCOPE_CLOUD_SAMPLES),
    cloudY: new Float32Array(XY_SCOPE_CLOUD_SAMPLES),
    wave: new Float32Array(XY_SCOPE_WAVE_SAMPLES),
    trace: new Float32Array(XY_SCOPE_CLOUD_SAMPLES),
    cloudGain: 1, waveGain: 1, traceGain: 1, level: 0, source: 'fallback',
  }
}

/**
 * Turns synchronized stereo samples into the scope frame. Mid/side keeps a centred signal as a vertical line,
 * as on a real vectorscope. With no capture, a slow procedural figure stands in and `source` says so.
 */
export class XyScopeScopeWindow {
  readonly frame: XyScopeScopeFrame = createXyScopeScopeFrame()
  private levelPeak = 0.05

  update(left: Float32Array | null, right: Float32Array | null, dtSec: number, timeSec: number): XyScopeScopeFrame {
    const frame = this.frame
    const { cloudX, cloudY, wave } = frame
    let peak = 1e-4
    let wavePeak = 1e-4
    let energy = 0
    if (left && right && left.length >= WINDOW_SAMPLES && right.length >= WINDOW_SAMPLES) {
      frame.source = 'stereo'
      const start = left.length - WINDOW_SAMPLES
      for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) {
        let l = 0
        let r = 0
        const offset = start + k * 4
        for (let q = 0; q < 4; q += 1) { l += left[offset + q]; r += right[offset + q] }
        l *= 0.25; r *= 0.25
        const x = (r - l) * Math.SQRT1_2
        const y = (r + l) * Math.SQRT1_2
        cloudX[k] = x; cloudY[k] = y
        peak = Math.max(peak, Math.abs(x), Math.abs(y))
        energy += l * l + r * r
      }
      energy = Math.sqrt(energy / (2 * XY_SCOPE_CLOUD_SAMPLES))
    } else {
      // No stereo capture: a quiet figure so a dissolve still has somewhere to go.
      frame.source = 'fallback'
      for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) {
        const u = k / XY_SCOPE_CLOUD_SAMPLES * Math.PI * 2
        cloudX[k] = Math.sin(3 * u + timeSec * 0.7) * 0.5
        cloudY[k] = Math.sin(2 * u + timeSec * 0.5) * 0.5
        peak = Math.max(peak, Math.abs(cloudX[k]), Math.abs(cloudY[k]))
      }
      energy = 0.02
    }
    const block = XY_SCOPE_CLOUD_SAMPLES / XY_SCOPE_WAVE_SAMPLES
    for (let k = 0; k < XY_SCOPE_WAVE_SAMPLES; k += 1) {
      let sum = 0
      for (let q = 0; q < block; q += 1) sum += cloudY[k * block + q]
      wave[k] = sum / block
      wavePeak = Math.max(wavePeak, Math.abs(wave[k]))
    }
    // A box low-pass over the mid signal: the bass and body of the track, without the hair of the top end.
    const { trace } = frame
    let tracePeak = 1e-4
    const radius = 5
    for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) {
      let sum = 0
      let count = 0
      for (let q = -radius; q <= radius; q += 1) {
        const index = k + q
        if (index < 0 || index >= XY_SCOPE_CLOUD_SAMPLES) continue
        sum += cloudY[index]
        count += 1
      }
      trace[k] = sum / count
      tracePeak = Math.max(tracePeak, Math.abs(trace[k]))
    }
    const targetCloud = 1 / Math.max(peak, 0.03)
    const targetWave = 1 / Math.max(wavePeak, 0.02)
    const targetTrace = 1 / Math.max(tracePeak, 0.02)
    const ease = 1 - Math.exp(-Math.max(0, dtSec) / 0.35)
    // Gain drops at once (never clip) and recovers slowly.
    frame.cloudGain = targetCloud < frame.cloudGain ? targetCloud : frame.cloudGain + (targetCloud - frame.cloudGain) * ease
    frame.waveGain = targetWave < frame.waveGain ? targetWave : frame.waveGain + (targetWave - frame.waveGain) * ease
    frame.traceGain = targetTrace < frame.traceGain ? targetTrace : frame.traceGain + (targetTrace - frame.traceGain) * ease
    this.levelPeak = Math.max(energy, this.levelPeak * Math.exp(-Math.max(0, dtSec) / 6))
    frame.level = Math.min(1, energy / (this.levelPeak + 1e-6))
    return frame
  }
}

export interface XyScopeMotionParams {
  /** Line Vibration, 0..1.5. */
  vibration: number
  /** Dissolve Depth, 0..1.5; zero also disables the kick pop. */
  dissolveDepth: number
}

export interface XyScopePointBuffers {
  /** Screen position, px from the stage centre. */
  x: Float32Array
  y: Float32Array
  /** 0..1 how far each point has frayed into the scope, so the renderer can dim the cloud. */
  dissolved: Float32Array
  /** 0..1 how far each point has moved into an oscillator form, so the renderer can open the letter's closed loops. */
  form: Float32Array
  /** 0..1 how much the line from this point to the next is a hand-over between separate strokes of a form (not drawn). */
  gap: Float32Array
}

export function createXyScopePointBuffers(count: number): XyScopePointBuffers {
  return { x: new Float32Array(count), y: new Float32Array(count), dissolved: new Float32Array(count), form: new Float32Array(count), gap: new Float32Array(count) }
}

/** A letter's share of the pattern blend: its weights, where it sits in the whole word, and what the music is doing. */
export interface XyScopeGlyphForm {
  /** Weight per pattern in `XY_SCOPE_PATTERN_IDS` order; they sum to 1 and index 0 is the letters themselves. */
  weights: Float32Array
  /** Index of this letter's first point within the whole word, and the word's total point count. */
  globalOffset: number
  globalTotal: number
  drive: XyScopeFormDrive
}

const formPoint: XyScopePoint = { x: 0, y: 0 }

const smoothstep = (value: number) => value * value * (3 - 2 * value)

function waveAt(frame: XyScopeScopeFrame, u: number): number {
  const wrapped = u - Math.floor(u)
  const f = wrapped * XY_SCOPE_WAVE_SAMPLES
  const i = Math.floor(f)
  const a = frame.wave[i % XY_SCOPE_WAVE_SAMPLES]
  const b = frame.wave[(i + 1) % XY_SCOPE_WAVE_SAMPLES]
  return (a + (b - a) * (f - i)) * frame.waveGain
}

/**
 * Writes one letter's points into `out` (px from the stage centre) and returns its dissolve amount.
 * `dissolve` is the letter's total dissolve 0..1 from the conversation.
 */
export function computeXyScopeGlyphPoints(
  glyph: XyScopeGlyphGeometry,
  glyphIndex: number,
  state: XyScopeGlyphState,
  dissolve: number,
  params: XyScopeMotionParams,
  scope: XyScopeScopeFrame,
  out: XyScopePointBuffers,
  form: XyScopeGlyphForm | null = null,
): number {
  const height = glyph.heightPx
  const vk = params.vibration
  const amplitude = height * vk * (0.002 + 0.019 * state.vibration + 0.003 * scope.level)
  const ring = Math.cos(state.ringPhase)
  const rippleAmplitude = height * vk * 0.035 * state.ripple
  const pop = 1 + (params.dissolveDepth > 0 ? 0.055 * state.kick : 0)
  const cloudRadiusX = scope.cloudGain * 0.9 * height
  const cloudRadiusY = scope.cloudGain * 0.66 * height
  const dissolving = dissolve > 0.004
  const formActive = form != null && form.weights[0] < 0.998

  for (let i = 0; i < glyph.count; i += 1) {
    const s = glyph.s[i]
    const wobble =
      (Math.sin(Math.PI * 2 * 3 * s + glyphIndex * 1.7) + 0.4 * Math.sin(Math.PI * 2 * 7 * s + glyphIndex * 0.9)) * amplitude * ring
      + waveAt(scope, s + glyphIndex * 0.173) * amplitude * 0.08
      + Math.sin(Math.PI * 2 * (s * 5) - state.ripplePhase) * rippleAmplitude
    const px = (glyph.x[i] + glyph.nx[i] * wobble) * pop
    const py = (glyph.y[i] + glyph.ny[i] * wobble) * pop
    let x = px
    let y = py
    let amount = 0
    if (dissolving) {
      // Points unspool along the outline: a small dissolve frays one stretch, a full one takes every point.
      const threshold = (s + state.fray) % 1
      amount = smoothstep(Math.max(0, Math.min(1, (dissolve * 1.25 - threshold) / 0.25)))
      if (amount > 0) {
        const j = (Math.floor(s * XY_SCOPE_CLOUD_SAMPLES) + glyphIndex * 83) % XY_SCOPE_CLOUD_SAMPLES
        x = px + (scope.cloudX[j] * cloudRadiusX - px) * amount
        y = py + (-scope.cloudY[j] * cloudRadiusY - py) * amount
      }
    }
    let outX = glyph.centerX + x
    let outY = y
    let formAmount = 0
    if (form && formActive) {
      // Letters unspool along their outline into each active form, so a change runs through the lines.
      let fx = 0
      let fy = 0
      let sum = 0
      let gapAmount = 0
      for (let p = 1; p < XY_SCOPE_PATTERN_IDS.length; p += 1) {
        const weight = form.weights[p]
        if (weight < 0.002) continue
        const effective = smoothstep(Math.max(0, Math.min(1, (weight * 1.25 - s) / 0.25)))
        if (effective <= 0) continue
        const formId = XY_SCOPE_PATTERN_IDS[p] as XyScopeFormPattern
        const g = (form.globalOffset + i) / form.globalTotal
        computeXyScopeFormPoint(formId, g, form.drive, formPoint)
        if (xyScopeFormBreak(formId, g, (form.globalOffset + i + 1) / form.globalTotal, form.drive.variation)) gapAmount = Math.max(gapAmount, effective)
        fx += effective * formPoint.x
        fy += effective * formPoint.y
        sum += effective
      }
      if (sum > 1) { fx /= sum; fy /= sum; sum = 1 }
      if (sum > 0) {
        outX = outX * (1 - sum) + fx
        outY = outY * (1 - sum) + fy
        formAmount = sum
      }
      out.gap[i] = Math.min(1, gapAmount)
    } else {
      out.gap[i] = 0
    }
    out.x[i] = outX
    out.y[i] = outY
    out.dissolved[i] = amount
    out.form[i] = formAmount
  }
  return dissolve
}
