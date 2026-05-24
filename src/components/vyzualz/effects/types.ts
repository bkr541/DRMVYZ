// Core types for the modular VYZUALZ effect system.
import type { VzEffectParams } from '../../../types/effectParams'
export type { VzEffectParams }
// Effects are represented as VzEffectModule instances registered by ID,
// categorized by render phase, and called from a single per-phase loop in the RAF.

// ── Categories ────────────────────────────────────────────────────────────────

export type VzEffectCategory =
  | 'color'        // hue shifts, color grading, cycling
  | 'distortion'   // glitch, displacement, warp, smear
  | 'audioReactive'// beat-triggered or frequency-driven overlays
  | 'generative'   // procedurally drawn geometry (grid, tunnel, spectrum)
  | 'post'         // screen-space overlays with no audio dependency (scanlines, fog)
  | 'utility'      // helper / debug effects

// ── Render phases ─────────────────────────────────────────────────────────────
// Phases represent stages in the per-frame draw pipeline.
// The render loop calls registered modules for each phase in order.

export type VzRenderPhase =
  | 'background'   // initial clear / feedback fill (before any media)
  | 'preMedia'     // behind the primary media draw (grid, tunnel)
  | 'media'        // the primary media draw itself (reserved for future use)
  | 'postMedia'    // after media, INSIDE the camera-shake transform (kaleidoscope, mirror, etc.)
  | 'master'       // screen-space, AFTER camera-shake restore (scanlines, fog, flash, flicker)

// ── Quality snapshot passed to modules each frame ────────────────────────────

export interface VzQualitySnapshot {
  scanlineStep:  number   // pixel stride between scanline rows
  fogParticles:  number   // noise-fog dot count
  glitchMax:     number   // max glitch-bar slices
  bloomBlur:     number   // max blur radius for bloom
  tunnelRings:   number   // concentric ring count for tunnel effect
}

// ── Per-frame context ─────────────────────────────────────────────────────────
// Built once per RAF tick and passed unchanged to every module draw call.

export interface VzFrameContext {
  W:    number  // canvas pixel width  (already DPR-scaled)
  H:    number  // canvas pixel height (already DPR-scaled)
  dpr:  number  // effective devicePixelRatio (clamped by quality)
  /** Milliseconds elapsed since the canvas session started. */
  time: number
  /** Audio engine currentTime in seconds; 0 when no track is playing. */
  audioTime: number
  bpm:           number
  beatPhase:     number   // 0→1 cycling each beat
  onBeatBoundary: boolean // true for the first ~4% of each beat period
  /** true at onBeatBoundary (synced) OR on a bass transient (free mode). */
  beatHit:        boolean
  audio: {
    bass:   number   // 20–250 Hz,    0–1
    lowMid: number   // 250–1000 Hz,  0–1
    mid:    number   // 1000–4000 Hz, 0–1
    high:   number   // 4000–16000 Hz,0–1
    volume: number   // combined RMS, 0–1
    beat:   number   // 1.0 at beat boundary, decays to 0 within ~70 ms
  }
  masterIntensity: number
  quality:         VzQualitySnapshot
  /** Canvas center X (W/2). */
  cx: number
  /** Canvas center Y (H/2). */
  cy: number
  /** Raw frequency-domain byte buffer from AnalyserNode; null when no analyser. */
  freqData:       Uint8Array<ArrayBuffer> | null
  /** Raw time-domain byte buffer from AnalyserNode; null when no analyser. */
  timeDomainData: Uint8Array<ArrayBuffer> | null
  /** Per-effect performance/behaviour parameters from the store. */
  effectParams:   VzEffectParams
}

// ── Effect module ─────────────────────────────────────────────────────────────
// Modules are plain objects — no class hierarchy, no React, no store access.
// The generic P lets individual module files keep their params fully typed
// while the registry erases the generic for the common loop path.

export interface VzEffectModule<
  P extends Record<string, unknown> = Record<string, unknown>
> {
  /** Must match the corresponding VzEffects key used as an intensity source. */
  id:          string
  /** User-facing label — must exactly match the corresponding effect_chain_options.chain_name value.
   *  This is required because enabledFx remains string-based for backward compatibility
   *  with stored sessions and existing renderer checks (e.g. enabledFx.has('RGB Split')). */
  label:       string
  category:    VzEffectCategory
  renderPhase: VzRenderPhase
  /** Chain-item name checked against enabledFx before calling draw. */
  chainName:   string
  /** Key in VzEffects that maps to this module's primary intensity. */
  effectKey:   string
  /**
   * Default params — merged with { amount: modulatedIntensity } at call time.
   * Add deeper structured params here as the effect rack grows.
   */
  defaultParams: P
  /**
   * Called each frame when the chain is enabled and intensity > 0.
   * Must be stateless w.r.t. React; use module-level WeakMaps for per-canvas state.
   */
  draw: (
    ctx:    CanvasRenderingContext2D,
    frame:  VzFrameContext,
    params: P,
  ) => void
}
