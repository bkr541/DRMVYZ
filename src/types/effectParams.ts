// Per-effect configurable parameters that control rendering detail and cost.
// Separate from VzEffects intensity values; all fields are optional — absent
// keys fall back to the module's own defaults at render time.
//
// Performance-relevant fields are marked with ★.

// ── Glitch Bars ───────────────────────────────────────────────────────────────
export interface GlitchEffectParams {
  /** ★ Max simultaneous slice bars (2–20). Lower = cheaper. */
  sliceCount:  number
  /** ★ Probability of firing on any eligible frame (0–1). */
  probability: number
  /** ★ Maximum horizontal displacement in CSS pixels (10–200). */
  maxShift:    number
  /** Frames a bar persists before being replaced (1–10). */
  holdTime:    number
}

// ── Spectrum Bars ─────────────────────────────────────────────────────────────
export interface SpectrumBarsEffectParams {
  /** ★ Number of frequency bars rendered (8–120). Lower = cheaper. */
  barCount:   number
  /** Inter-frame height smoothing, 0 = none, 0.9 = heavy (0–0.95). */
  smoothing:  number
  /** Mirror bars symmetrically from the centre. */
  mirrorMode: boolean
}

// ── Tunnel ────────────────────────────────────────────────────────────────────
export interface TunnelEffectParams {
  /** ★ Number of concentric ring strokes (3–20). Lower = cheaper. */
  ringCount:  number
  /** Stroke line-width in CSS px (0.5–4). */
  lineWidth:  number
  /** Depth/speed multiplier (0.1–2). */
  depth:      number
}

// ── Strobe ────────────────────────────────────────────────────────────────────
export interface StrobeEffectParams {
  /** Flashes per beat (0.25–4). 1 = once/beat, 2 = twice/beat. */
  beatDivision: number
  /** Flash window as fraction of sub-beat period (0.01–0.25). */
  duration:     number
  /** Bass threshold for free (un-synced) mode (0–1). */
  threshold:    number
  /** ★ Photosensitivity cap: max flashes per second (1–10). */
  safetyCap:    number
}

// ── Noise Fog ─────────────────────────────────────────────────────────────────
export interface NoiseFogEffectParams {
  /** ★ Override particle count (0 = use quality setting; 1–1000 = explicit). */
  particleCount:     number
  /** ★ Multiplier applied to the quality-controlled count (0.1–1). */
  qualityMultiplier: number
}

// ── Particle Burst ────────────────────────────────────────────────────────────
export interface ParticleBurstEffectParams {
  /** ★ Hard cap on simultaneous particles (10–200). Lower = cheaper. */
  maxParticles: number
}

// ── Composite ─────────────────────────────────────────────────────────────────
export interface VzEffectParams {
  glitch?:        GlitchEffectParams
  spectrumBars?:  SpectrumBarsEffectParams
  tunnel?:        TunnelEffectParams
  strobe?:        StrobeEffectParams
  noiseFog?:      NoiseFogEffectParams
  particleBurst?: ParticleBurstEffectParams
}

export const DEFAULT_EFFECT_PARAMS: VzEffectParams = {}

// ── Hard defaults (used when a key is absent from VzEffectParams) ─────────────

export const GLITCH_DEFAULTS: Required<GlitchEffectParams> = {
  sliceCount:  8,
  probability: 0.25,
  maxShift:    40,
  holdTime:    1,
}

export const SPECTRUM_BARS_DEFAULTS: Required<SpectrumBarsEffectParams> = {
  barCount:   80,
  smoothing:  0,
  mirrorMode: false,
}

export const TUNNEL_DEFAULTS: Required<TunnelEffectParams> = {
  ringCount: 8,
  lineWidth: 1.5,
  depth:     1,
}

export const STROBE_DEFAULTS: Required<StrobeEffectParams> = {
  beatDivision: 1,
  duration:     0.08,
  threshold:    0.62,
  safetyCap:    3,
}

export const NOISE_FOG_DEFAULTS: Required<NoiseFogEffectParams> = {
  particleCount:     0,
  qualityMultiplier: 1,
}

export const PARTICLE_BURST_DEFAULTS: Required<ParticleBurstEffectParams> = {
  maxParticles: 80,
}

// ── Resolved accessors — always return a fully-populated object ───────────────

export function resolveGlitchParams(p: VzEffectParams): Required<GlitchEffectParams> {
  return { ...GLITCH_DEFAULTS, ...p.glitch }
}
export function resolveSpectrumBarsParams(p: VzEffectParams): Required<SpectrumBarsEffectParams> {
  return { ...SPECTRUM_BARS_DEFAULTS, ...p.spectrumBars }
}
export function resolveTunnelParams(p: VzEffectParams): Required<TunnelEffectParams> {
  return { ...TUNNEL_DEFAULTS, ...p.tunnel }
}
export function resolveStrobeParams(p: VzEffectParams): Required<StrobeEffectParams> {
  return { ...STROBE_DEFAULTS, ...p.strobe }
}
export function resolveNoiseFogParams(p: VzEffectParams): Required<NoiseFogEffectParams> {
  return { ...NOISE_FOG_DEFAULTS, ...p.noiseFog }
}
export function resolveParticleBurstParams(p: VzEffectParams): Required<ParticleBurstEffectParams> {
  return { ...PARTICLE_BURST_DEFAULTS, ...p.particleBurst }
}
