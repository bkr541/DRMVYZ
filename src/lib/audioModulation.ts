// Audio modulation routing for VYZUALZ.
// Maps audio band energy values to effect parameter boosts via configurable routes.
// applyModulatedEffects is a pure function — the renderer calls it every frame.

import type { VzEffects } from '../stores/visualStore'

export type AudioBand = 'bass' | 'lowMid' | 'mid' | 'high' | 'volume' | 'beat'

export interface ModulationRoute {
  id: string
  effectId: keyof VzEffects
  source: AudioBand
  // additive delta: modulatedValue = clamp(base + bandValue * amount, min, max)
  amount: number
  min?: number
  max?: number
  curve?: 'linear' | 'easeIn' | 'easeOut' | 'exponential'
  enabled: boolean
}

export interface AudioBandValues {
  bass: number    // 20–250 Hz,    0–1
  lowMid: number  // 250–1000 Hz,  0–1
  mid: number     // 1000–4000 Hz, 0–1
  high: number    // 4000–16000 Hz,0–1
  volume: number  // combined RMS, 0–1
  beat: number    // 1.0 at beat boundary, decays to 0 within ~70 ms
}

// ── Default routes ────────────────────────────────────────────────────────────

export const DEFAULT_MODULATION_ROUTES: ModulationRoute[] = [
  // Bass → scale pulse (amplifies bassReactivity effect in renderer)
  { id: 'bass-bassReactivity',    effectId: 'bassReactivity',  source: 'bass',   amount: 0.25, enabled: true },
  // Bass → tunnel ring expansion speed
  { id: 'bass-tunnelSpeed',       effectId: 'tunnelSpeed',     source: 'bass',   amount: 0.20, enabled: true },
  // Low-mid → displacement warp magnitude
  { id: 'lowMid-displacement',    effectId: 'displacement',    source: 'lowMid', amount: 0.45, enabled: true },
  // Low-mid → feedback smear/bend
  { id: 'lowMid-feedbackTrails',  effectId: 'feedbackTrails',  source: 'lowMid', amount: 0.35, enabled: true },
  // Highs → glitch slice probability
  { id: 'high-glitchAmount',      effectId: 'glitchAmount',    source: 'high',   amount: 0.50, enabled: true },
  // Highs → strobe sensitivity
  { id: 'high-strobe',            effectId: 'strobe',          source: 'high',   amount: 0.25, enabled: true },
  // Highs → chromatic aberration burst
  { id: 'high-rgbSplit',          effectId: 'rgbSplit',        source: 'high',   amount: 0.20, enabled: true },
  // Volume → bloom intensity
  { id: 'volume-bloom',           effectId: 'bloom',           source: 'volume', amount: 0.35, enabled: true },
  // Volume → master brightness
  { id: 'volume-masterIntensity', effectId: 'masterIntensity', source: 'volume', amount: 0.15, enabled: true },
  // Beat → RGB split burst on beat boundary
  { id: 'beat-rgbSplit',          effectId: 'rgbSplit',        source: 'beat',   amount: 0.35, enabled: true },
  // Beat → hue nudge on beat boundary
  { id: 'beat-colorShift',        effectId: 'colorShift',      source: 'beat',   amount: 0.07, enabled: true, curve: 'easeOut' },

  // ── Newer effect routes ───────────────────────────────────────────────────────
  // Bass → spectrum bar height pulse
  { id: 'bass-spectrumBars',      effectId: 'spectrumBars',    source: 'bass',   amount: 0.25, enabled: true },
  // Bass → beat ring radius swell
  { id: 'bass-beatRing',          effectId: 'beatRing',        source: 'bass',   amount: 0.35, enabled: true },
  // Beat → particle burst intensity
  { id: 'beat-particleBurst',     effectId: 'particleBurst',   source: 'beat',   amount: 0.45, enabled: true },
  // Bass → camera shake magnitude
  { id: 'bass-cameraShake',       effectId: 'cameraShake',     source: 'bass',   amount: 0.20, enabled: true },
  // Mid → reactive grid cell brightness
  { id: 'mid-reactiveGrid',       effectId: 'reactiveGrid',    source: 'mid',    amount: 0.30, enabled: true },
  // High → edge glow radius
  { id: 'high-edgeGlow',          effectId: 'edgeGlow',        source: 'high',   amount: 0.25, enabled: true },
  // High → VHS noise grain
  { id: 'high-vhsStatic',         effectId: 'vhsStatic',       source: 'high',   amount: 0.18, enabled: true },
  // High → hue cycling speed (eased so subtle at rest)
  { id: 'high-colorCycle',        effectId: 'colorCycle',      source: 'high',   amount: 0.20, enabled: true, curve: 'easeOut' },
  // Mid → kaleidoscope segment rotation
  { id: 'mid-kaleidoscope',       effectId: 'kaleidoscope',    source: 'mid',    amount: 0.15, enabled: true },
  // Bass → radial blur spread
  { id: 'bass-radialBlur',        effectId: 'radialBlur',      source: 'bass',   amount: 0.20, enabled: true },
  // Mid → circular spectrum ring amplitude
  { id: 'mid-circularSpectrum',   effectId: 'circularSpectrum', source: 'mid',   amount: 0.25, enabled: true },
  // High → oscilloscope waveform brightness
  { id: 'high-oscilloscope',      effectId: 'oscilloscope',    source: 'high',   amount: 0.20, enabled: true },
  // Mid → mirror split offset
  { id: 'mid-mirrorSplit',        effectId: 'mirrorSplit',     source: 'mid',    amount: 0.15, enabled: true },
  // Beat → datamosh smear burst
  { id: 'beat-datamoshSmear',     effectId: 'datamoshSmear',   source: 'beat',   amount: 0.20, enabled: true },
]

// ── Band display metadata (used by ModulationPanel) ──────────────────────────

export const BAND_LABELS: Record<AudioBand, string> = {
  bass: 'Bass', lowMid: 'LMid', mid: 'Mid', high: 'High', volume: 'Vol', beat: 'Beat',
}

export const EFFECT_LABELS: Partial<Record<keyof VzEffects, string>> = {
  // ── Core effects ──────────────────────────────────────────────────────
  bassReactivity:  'Scale Pulse',
  tunnelSpeed:     'Tunnel Depth',
  displacement:    'Displacement',
  feedbackTrails:  'Feedback Bend',
  glitchAmount:    'Glitch',
  strobe:          'Strobe',
  rgbSplit:        'RGB Split',
  bloom:           'Bloom',
  masterIntensity: 'Brightness',
  colorShift:      'Color Shift',
  logoScale:       'Reactive Scale',
  // ── Newer effects ─────────────────────────────────────────────────────
  spectrumBars:    'Spectrum Bars',
  circularSpectrum: 'Circ Spectrum',
  oscilloscope:    'Oscilloscope',
  beatRing:        'Beat Ring',
  particleBurst:   'Particles',
  reactiveGrid:    'React Grid',
  cameraShake:     'Cam Shake',
  kaleidoscope:    'Kaleidoscope',
  mirrorSplit:     'Mirror Split',
  radialBlur:      'Radial Blur',
  vhsStatic:       'VHS Static',
  datamoshSmear:   'Datamosh',
  edgeGlow:        'Edge Glow',
  colorCycle:      'Color Cycle',
  beatFlash:       'Beat Flash',
  edgeFlicker:     'Edge Flicker',
  noiseFog:        'Noise Fog',
  scanlines:       'Scanlines',
}

// ── Band extraction ───────────────────────────────────────────────────────────

export function getBandAvg(buf: Uint8Array<ArrayBuffer>, sampleRate: number, lo: number, hi: number): number {
  const n   = buf.length
  const nyq = sampleRate / 2
  const lb  = Math.floor((lo / nyq) * n)
  const hb  = Math.min(Math.ceil((hi / nyq) * n), n - 1)
  if (hb <= lb) return 0
  let sum = 0
  for (let i = lb; i <= hb; i++) sum += buf[i]
  return sum / ((hb - lb + 1) * 255)
}

/**
 * Compute all six band values from a live FFT buffer.
 * beatPhase: 0→1 cycling each beat. bpmSync: whether it's anchored to audio time.
 */
export function extractBandValues(
  buf: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  beatPhase: number,
  bpmSync: boolean,
): AudioBandValues {
  const bass   = getBandAvg(buf, sampleRate,    20,   250)
  const lowMid = getBandAvg(buf, sampleRate,   250,  1000)
  const mid    = getBandAvg(buf, sampleRate,  1000,  4000)
  const high   = getBandAvg(buf, sampleRate,  4000, 16000)
  const volume = Math.min(1, (bass * 1.1 + lowMid * 0.8 + mid * 0.6 + high * 0.4) / 1.5)
  // Beat pulse: decays from 1→0 over the first ~7% of the beat period
  const beatWindow = 0.07
  const beat = bpmSync && beatPhase < beatWindow
    ? Math.max(0, 1 - beatPhase / beatWindow)
    : 0
  return { bass, lowMid, mid, high, volume, beat }
}

// ── Modulation helper ─────────────────────────────────────────────────────────

function applyCurve(v: number, curve?: ModulationRoute['curve']): number {
  switch (curve) {
    case 'easeIn':      return v * v
    case 'easeOut':     return Math.sqrt(Math.max(0, v))
    case 'exponential': return v * v * v
    default:            return v
  }
}

const SILENT_BANDS: AudioBandValues = { bass: 0, lowMid: 0, mid: 0, high: 0, volume: 0, beat: 0 }

/**
 * Returns rawBands unchanged when audio reactivity is on, or an all-zero
 * AudioBandValues object when it is off.  Use this as the single gate so that
 * every downstream consumer (transitions, datamosh, meters, generative art)
 * automatically goes silent when the toggle is disabled.
 */
export function gateAudioBands(rawBands: AudioBandValues, audioOn: boolean): AudioBandValues {
  return audioOn ? rawBands : SILENT_BANDS
}

/**
 * Returns a copy of `base` effects with each enabled route's band value
 * additively boosting the target effect parameter.
 * Falls back gracefully to `base` when bands are all zero (no audio).
 */
export function applyModulatedEffects(
  base: VzEffects,
  bands: AudioBandValues,
  routes: ModulationRoute[],
): VzEffects {
  const result = { ...base }
  for (const route of routes) {
    if (!route.enabled) continue
    const src    = (bands[route.source] ?? 0) as number
    const curved = applyCurve(src, route.curve)
    const key    = route.effectId
    const lo     = route.min ?? 0
    const hi     = route.max ?? (key === 'logoScale' ? 2 : 1)
    ;(result as Record<string, number>)[key] = Math.max(
      lo,
      Math.min(hi, (result[key] as number) + curved * route.amount),
    )
  }
  return result
}
