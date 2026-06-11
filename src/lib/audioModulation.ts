// Audio modulation routing for VYZUALZ.
// Maps audio band energy values to effect parameter boosts via configurable routes.
// applyModulatedEffects is a pure function — the renderer calls it every frame.

import type { VzEffects } from '../stores/visualStore'
import type { MusicIntelligenceFrame } from '../features/musicIntelligence/types'
import type { ModulationSourceKey } from './miSourceRegistry'

export type AudioBand = 'bass' | 'lowMid' | 'mid' | 'high' | 'volume' | 'beat'

export interface ModulationRoute {
  id: string
  effectId: keyof VzEffects
  /** Legacy AudioBand keys still work; all MI source keys are accepted. */
  source: ModulationSourceKey
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

  // ── Distortion Pixels effects ─────────────────────────────────────────────────
  // Beat → pixel corruption punch (short burst on beat boundary)
  { id: 'beat-pixelDistortion',   effectId: 'pixelDistortion',   source: 'beat',   amount: 0.22, enabled: true },
  // Bass → signal breakup pressure during heavy low end
  { id: 'bass-pixelDistortion',   effectId: 'pixelDistortion',   source: 'bass',   amount: 0.15, enabled: true },
  // Beat → rhythmic stutter pressure (restrained for live usability)
  { id: 'beat-frameQuantization', effectId: 'frameQuantization', source: 'beat',   amount: 0.12, enabled: true },

  // ── MI Layer 2-8 example routes (disabled — opt-in per session) ──────────────
  // Kick → camera punch
  { id: 'kick-cameraShake',     effectId: 'cameraShake',   source: 'kick',              amount: 0.40, enabled: false },
  // Snare → RGB split flash
  { id: 'snare-rgbSplit',       effectId: 'rgbSplit',       source: 'snare',            amount: 0.45, enabled: false },
  // Hat → sparkle/flicker
  { id: 'hat-edgeFlicker',      effectId: 'edgeFlicker',    source: 'hat',              amount: 0.30, enabled: false },
  // Build Progress → particle density
  { id: 'build-particles',      effectId: 'particleBurst',  source: 'buildProgress',    amount: 0.50, enabled: false },
  // Build Progress → tunnel depth
  { id: 'build-tunnelSpeed',    effectId: 'tunnelSpeed',    source: 'buildProgress',    amount: 0.25, enabled: false },
  // Drop Impact → flash
  { id: 'drop-beatFlash',       effectId: 'beatFlash',      source: 'dropImpact',       amount: 0.60, enabled: false },
  // Vocal Energy → bloom glow
  { id: 'vocal-bloom',          effectId: 'bloom',          source: 'vocalEnergy',      amount: 0.35, enabled: false },
  // Chord Change → color shift nudge
  { id: 'chord-colorShift',     effectId: 'colorShift',     source: 'chordChange',      amount: 0.12, enabled: false },
  // Section Intensity → master brightness
  { id: 'section-intensity',    effectId: 'masterIntensity',source: 'sectionIntensity', amount: 0.20, enabled: false },
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
  noiseFog:          'Noise Fog',
  scanlines:         'Scanlines',
  pixelDistortion:   'Pixel Distortion',
  frameQuantization: 'Frame Quantize',
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

// ── Modulation helpers ────────────────────────────────────────────────────────

function applyCurve(v: number, curve?: ModulationRoute['curve']): number {
  switch (curve) {
    case 'easeIn':      return v * v
    case 'easeOut':     return Math.sqrt(Math.max(0, v))
    case 'exponential': return v * v * v
    default:            return v
  }
}

/**
 * Resolve a modulation source to a 0–1 number.
 * Legacy AudioBand keys read from `bands` to preserve historical smoothing behavior.
 * All extended MI sources read from the MI frame when available, else return 0.
 * Inline switch avoids importing from selectors (which imports back from here).
 */
function resolveSourceValue(
  source: string,
  bands: AudioBandValues,
  frame: MusicIntelligenceFrame | null | undefined,
): number {
  switch (source) {
    // ── Legacy AudioBand (raw bands — historical smoothing preserved) ────────
    case 'bass':   return bands.bass
    case 'lowMid': return bands.lowMid
    case 'mid':    return bands.mid
    case 'high':   return bands.high
    case 'volume': return bands.volume
    case 'beat':   return bands.beat
  }
  if (!frame) return 0
  const b  = frame.bands
  const r  = frame.rhythm
  const e  = frame.energy
  const sc = frame.section
  const h  = frame.harmonic
  const st = frame.stems
  const ly = frame.lyrics
  const sm = frame.semantics
  switch (source) {
    // Layer 1 extras
    case 'sub':           return b.sub
    case 'air':           return b.air
    case 'rms':           return e.rms
    case 'peak':          return e.peak
    case 'nSub':          return b.normalizedSub
    case 'nBass':         return b.normalizedBass
    case 'nLowMid':       return b.normalizedLowMid
    case 'nMid':          return b.normalizedMid
    case 'nHigh':         return b.normalizedHigh
    case 'nAir':          return b.normalizedAir
    // Layer 2
    case 'beatPhase':     return r.beatPhase
    case 'kick':          return r.kickStrength
    case 'snare':         return r.snareStrength
    case 'hat':           return r.hatStrength
    case 'transient':     return r.transient
    case 'downbeat':      return r.downbeatHit ? 1 : 0
    // Layer 3
    case 'phrase4':       return r.phrase4Progress
    case 'phrase8':       return r.phrase8Progress
    case 'phrase16':      return r.phrase16Progress
    case 'phrase32':      return r.phrase32Progress
    case 'phrase4Hit':    return r.phrase4Hit    ? 1 : 0
    case 'phrase8Hit':    return r.phrase8Hit    ? 1 : 0
    case 'phrase16Hit':   return r.phrase16Hit   ? 1 : 0
    case 'phrase32Hit':   return r.phrase32Hit   ? 1 : 0
    // Layer 4
    case 'energy':           return e.instant
    case 'energyShort':      return e.shortTerm
    case 'energyLong':       return e.longTerm
    case 'spectralFlux':     return e.spectralFlux
    case 'tension':          return e.tension
    case 'complexity':       return e.complexity
    case 'buildProgress':    return e.buildProgress
    case 'dropImpact':       return e.dropImpact
    case 'crestFactor':      return Math.min(1, e.crestFactor / 20)
    case 'percentile':       return e.percentile
    case 'delta':            return Math.max(0, Math.min(1, e.delta + 0.5))
    case 'spectralCentroid': return e.spectralCentroid
    case 'spectralFlatness': return e.spectralFlatness
    // Layer 5
    case 'sectionProgress':  return sc.progress
    case 'sectionIntensity': return sc.intensity
    // Layer 6
    case 'pitchHz':          return h.pitchHz != null ? Math.min(1, h.pitchHz / 2000) : 0
    case 'melodyHeight':     return h.pitchHz != null ? Math.min(1, Math.max(0, (h.pitchHz - 50) / 1950)) : 0
    case 'keyConfidence':    return h.keyConfidence
    case 'chordConfidence':  return h.chordConfidence
    case 'chordChange':      return h.chordChanged ? 1 : 0
    // Layer 7
    case 'vocalEnergy':       return st.vocalEnergy
    case 'drumEnergy':        return st.drumEnergy
    case 'bassStemEnergy':    return st.bassStemEnergy
    case 'instrumentEnergy':  return st.instrumentEnergy
    case 'vocalActivity':     return st.vocalActivity
    case 'lyricActivity':     return ly.vocalActivity
    case 'lyricLineProgress': return ly.lyricLineProgress
    case 'phraseConfidence':  return ly.phraseConfidence
    case 'wordHit':           return ly.wordHit           ? 1 : 0
    case 'drumTrans':         return st.drumTransient      ? 1 : 0
    case 'bassTrans':         return st.bassStemTransient  ? 1 : 0
    // Layer 8
    case 'buildConfidence':     return sm.buildConfidence
    case 'dropConfidence':      return sm.dropConfidence
    case 'fakeoutConfidence':   return sm.fakeoutConfidence
    case 'vocalHookConfidence': return sm.vocalHookConfidence
    default:                    return 0
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
 * Compatibility bridge: convert a MusicIntelligenceFrame into the AudioBandValues
 * shape expected by existing modulation routes.  Lets new code read from the
 * centralized bus without changing any call sites in the renderer.
 */
export function bandsFromFrame(frame: MusicIntelligenceFrame): AudioBandValues {
  return {
    bass:   frame.bands.bass,
    lowMid: frame.bands.lowMid,
    mid:    frame.bands.mid,
    high:   frame.bands.high,
    volume: frame.bands.volume,
    beat:   frame.rhythm.beatHit
      ? 1
      : Math.max(0, frame.rhythm.transient * (1 - frame.rhythm.beatPhase)),
  }
}

/**
 * Returns a copy of `base` effects with each enabled route's source value
 * additively boosting the target effect parameter.
 *
 * Legacy AudioBand sources (bass/lowMid/mid/high/volume/beat) read from `bands`
 * to preserve the historical raw-band smoothing behavior.  All extended MI
 * sources read from `miFrame` when provided; they return 0 when the frame is
 * absent so routes degrade gracefully before the MI engine is warmed up.
 */
export function applyModulatedEffects(
  base: VzEffects,
  bands: AudioBandValues,
  routes: ModulationRoute[],
  miFrame?: MusicIntelligenceFrame | null,
): VzEffects {
  const result = { ...base }
  for (const route of routes) {
    if (!route.enabled) continue
    const src    = resolveSourceValue(route.source, bands, miFrame)
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
