/**
 * Per-frame CPU hot-path benchmarks for the audio and transition dispatch
 * subsystems.  These run with `npx vitest bench` and establish a baseline for
 * detecting regressions in the per-frame JavaScript budget.
 *
 * Target: all operations below 0.05 ms at 60 fps to leave adequate headroom
 * for Canvas 2D, layout, and React scheduler overhead.
 */
import { bench, describe } from 'vitest'
import { gateAudioBands, applyModulatedEffects, DEFAULT_MODULATION_ROUTES } from '../lib/audioModulation'
import type { AudioBandValues } from '../lib/audioModulation'
import { GPU_TRANSITION_TYPES, getGpuTransitionIndex } from './gpuTransitions'
import type { VzTransitionType } from '../types/timeline'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LIVE_BANDS: AudioBandValues = {
  bass: 0.82, lowMid: 0.55, mid: 0.41, high: 0.33, volume: 0.76, beat: 1.0,
}

// Realistic effects snapshot: bloom, RGB split, and displacement active.
const ACTIVE_EFFECTS = {
  masterIntensity: 0.85,
  bassReactivity:  0.90,
  glitchAmount:    0.00,
  rgbSplit:        0.40,
  tunnelSpeed:     0.60,
  displacement:    0.30,
  bloom:           0.55,
  strobe:          0.00,
  feedbackTrails:  0.00,
  logoScale:       1.00,
  colorShift:      0.20,
  spectrumBars:    0.65,
  circularSpectrum: 0.55,
  oscilloscope:    0.60,
  beatRing:        0.70,
  particleBurst:   0.55,
  reactiveGrid:    0.45,
  cameraShake:     0.25,
  kaleidoscope:    0.50,
  mirrorSplit:     0.50,
  radialBlur:      0.40,
  vhsStatic:       0.35,
  datamoshSmear:   0.35,
  edgeGlow:        0.50,
  colorCycle:      0.45,
  beatFlash:       0.50,
  edgeFlicker:     0.50,
  noiseFog:        0.40,
  scanlines:       0.50,
}

const GPU_TYPES: VzTransitionType[] = [
  'crossfade', 'wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown',
  'additiveBlend', 'lumaFade', 'radialWipe', 'zoomIn', 'zoomOut',
]

const CANVAS_TYPES: VzTransitionType[] = [
  'flash', 'glitch', 'rgbTear', 'datamoshCut', 'scanlineWipe',
]

// ── Audio modulation hot path ─────────────────────────────────────────────────

describe('per-frame audio modulation (called once per animation frame)', () => {
  bench('gateAudioBands — audio reactivity enabled (pass-through)', () => {
    gateAudioBands(LIVE_BANDS, true)
  })

  bench('gateAudioBands — audio reactivity disabled (returns SILENT_BANDS)', () => {
    gateAudioBands(LIVE_BANDS, false)
  })

  bench('applyModulatedEffects — 25 default routes, realistic live bands', () => {
    applyModulatedEffects(ACTIVE_EFFECTS, LIVE_BANDS, DEFAULT_MODULATION_ROUTES)
  })
})

// ── Transition dispatch (called when a transition is active, ~2–4 fps) ────────

describe('transition type dispatch', () => {
  bench('GPU_TRANSITION_TYPES.has() — supported GPU type', () => {
    void GPU_TRANSITION_TYPES.has('crossfade')
    void GPU_TRANSITION_TYPES.has('radialWipe')
    void GPU_TRANSITION_TYPES.has('zoomOut')
  })

  bench('GPU_TRANSITION_TYPES.has() — unsupported Canvas-only type', () => {
    void GPU_TRANSITION_TYPES.has('flash')
    void GPU_TRANSITION_TYPES.has('glitch')
    void GPU_TRANSITION_TYPES.has('rgbTear')
  })

  bench('getGpuTransitionIndex() — lookup for all 10 GPU types', () => {
    for (const t of GPU_TYPES) getGpuTransitionIndex(t)
  })
})
