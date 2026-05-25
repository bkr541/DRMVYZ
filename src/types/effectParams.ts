// Per-effect configurable parameters that control rendering detail and cost.
// Separate from VzEffects intensity values; all fields are optional — absent
// keys fall back to the module's own defaults at render time.
//
// Performance-relevant fields are marked with ★.

// ── Pixel Distortion ──────────────────────────────────────────────────────────
export interface PixelDistortionEffectParams {
  /** Pixel cell size in output pixels. 1 = effectively unpixelated. ★ */
  pixelSize: number
  /** Number of posterized tonal steps. Lower = harsher signal breakup. */
  posterizeLevels: number
  /** Ordered/noise dither strength, 0..1. */
  ditherAmount: number
  /** Digital corruption breakup amount, 0..1. */
  corruptionAmount: number
  /** Highlight clipping / bleached-energy strength, 0..1. */
  overexposure: number
  /** Cyan-white signal tint applied to bright areas, 0..1. */
  energyTint: number
  /** Beat-triggered additional corruption amount, 0..1. */
  beatPunch: number
}

// ── Frame Quantization ────────────────────────────────────────────────────────
export interface FrameQuantizationEffectParams {
  /** Desired visual sampling rate for held source frames, e.g. 12 fps. */
  targetFps: number
  /** Additional held-frame count during beat impacts. */
  beatHoldFrames: number
  /** Chance/intensity of rhythmic hold events on beats, 0..1. */
  beatStutterAmount: number
}

// ── Bloom (extended) ──────────────────────────────────────────────────────────
export interface BloomEffectParams {
  /** Blur radius in pixels (full-res equivalent). */
  radius: number
  /** Luminance extraction threshold, 0..1. Lower = more area bloomed. */
  threshold: number
  /** Intensity multiplier applied to the bloom composite. */
  intensityMultiplier: number
  /** Highlight exposure boost before threshold extraction. */
  exposure: number
  /** Glow tint red channel, 0..1. */
  tintR: number
  /** Glow tint green channel, 0..1. */
  tintG: number
  /** Glow tint blue channel, 0..1. */
  tintB: number
}

// ── Analog Signal (Scanlines + VHS combined params) ───────────────────────────
export interface AnalogSignalEffectParams {
  /** Scanline density: lines per pixel row relative to default, 0..1. */
  density: number
  /** Scanline darkness multiplier, 0..1. */
  strength: number
  /** Horizontal jitter amount, 0..1. */
  jitterAmount: number
  /** Horizontal jitter speed multiplier. */
  jitterSpeed: number
  /** Mild screen curvature/barrel-distortion amount, 0..1. */
  curvature: number
  /** Fine analog noise grain amount, 0..1. */
  noiseAmount: number
}

// ── Feedback (extended) ───────────────────────────────────────────────────────
export interface FeedbackEffectParams {
  /** Trail decay factor, 0..1. Higher = longer trails. */
  decay: number
  /** Per-frame horizontal smear in pixels. */
  smearX: number
  /** Per-frame vertical smear in pixels. */
  smearY: number
  /** Subtle zoom factor per frame (1.0 = no zoom). */
  zoom: number
  /** How strongly audio (bass/volume) boosts visible trail strength. */
  audioResponse: number
}

// ── Displacement (extended) ───────────────────────────────────────────────────
export interface DisplacementEffectParams {
  /** Scale of the procedural noise field. */
  noiseScale: number
  /** UV warp amount from noise, 0..1. */
  noiseAmount: number
  /** Speed of noise field animation. */
  warpSpeed: number
  /** Horizontal warp bias multiplier. */
  horizontalBias: number
  /** Bass reactivity multiplier for noise warp. */
  bassResponse: number
  /** When true, the original shifted ghost layer is composited on top. */
  retainGhostLayer: boolean
}

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
  glitch?:           GlitchEffectParams
  spectrumBars?:     SpectrumBarsEffectParams
  tunnel?:           TunnelEffectParams
  strobe?:           StrobeEffectParams
  noiseFog?:         NoiseFogEffectParams
  particleBurst?:    ParticleBurstEffectParams
  pixelDistortion?:  PixelDistortionEffectParams
  frameQuantization?: FrameQuantizationEffectParams
  bloom?:            BloomEffectParams
  analogSignal?:     AnalogSignalEffectParams
  feedback?:         FeedbackEffectParams
  displacement?:     DisplacementEffectParams
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

export const PIXEL_DISTORTION_DEFAULTS: Required<PixelDistortionEffectParams> = {
  pixelSize:        4,
  posterizeLevels:  5,
  ditherAmount:     0.55,
  corruptionAmount: 0.35,
  overexposure:     0.45,
  energyTint:       0.65,
  beatPunch:        0.25,
}

export const FRAME_QUANTIZATION_DEFAULTS: Required<FrameQuantizationEffectParams> = {
  targetFps:         12,
  beatHoldFrames:    2,
  beatStutterAmount: 0.35,
}

export const BLOOM_EFFECT_DEFAULTS: Required<BloomEffectParams> = {
  radius:              10,
  threshold:           0.35,
  intensityMultiplier: 1.0,
  exposure:            0.0,
  tintR:               1.0,
  tintG:               1.0,
  tintB:               1.0,
}

export const ANALOG_SIGNAL_DEFAULTS: Required<AnalogSignalEffectParams> = {
  density:      0.5,
  strength:     0.5,
  jitterAmount: 0.0,
  jitterSpeed:  1.0,
  curvature:    0.0,
  noiseAmount:  0.0,
}

export const FEEDBACK_EFFECT_DEFAULTS: Required<FeedbackEffectParams> = {
  decay:         0.85,
  smearX:        0.0,
  smearY:        0.0,
  zoom:          1.0,
  audioResponse: 0.0,
}

export const DISPLACEMENT_EFFECT_DEFAULTS: Required<DisplacementEffectParams> = {
  noiseScale:       2.0,
  noiseAmount:      0.0,
  warpSpeed:        0.2,
  horizontalBias:   1.0,
  bassResponse:     0.0,
  retainGhostLayer: true,
}

export function resolvePixelDistortionParams(p: VzEffectParams): Required<PixelDistortionEffectParams> {
  return { ...PIXEL_DISTORTION_DEFAULTS, ...p.pixelDistortion }
}
export function resolveFrameQuantizationParams(p: VzEffectParams): Required<FrameQuantizationEffectParams> {
  const merged = { ...FRAME_QUANTIZATION_DEFAULTS, ...p.frameQuantization }
  merged.targetFps = Math.max(1, Math.min(60, merged.targetFps))
  merged.beatHoldFrames = Math.max(0, Math.min(10, merged.beatHoldFrames))
  return merged
}
export function resolveBloomEffectParams(p: VzEffectParams): Required<BloomEffectParams> {
  return { ...BLOOM_EFFECT_DEFAULTS, ...p.bloom }
}
export function resolveAnalogSignalParams(p: VzEffectParams): Required<AnalogSignalEffectParams> {
  return { ...ANALOG_SIGNAL_DEFAULTS, ...p.analogSignal }
}
export function resolveFeedbackEffectParams(p: VzEffectParams): Required<FeedbackEffectParams> {
  const merged = { ...FEEDBACK_EFFECT_DEFAULTS, ...p.feedback }
  // Clamp decay to prevent unstable permanent accumulation
  merged.decay = Math.max(0, Math.min(0.97, merged.decay))
  return merged
}
export function resolveDisplacementEffectParams(p: VzEffectParams): Required<DisplacementEffectParams> {
  return { ...DISPLACEMENT_EFFECT_DEFAULTS, ...p.displacement }
}
