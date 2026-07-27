import { detectShaderFloatTargetCapability } from '../../shaders/runtime/ShaderCapabilities'
import { SOUND_DRAWING_BLOOM_TIERS, type BloomTierConfig } from '../../shaders/scenes/soundDrawingBloom'

// ── soundDrawingPhosphorPlan ──────────────────────────────────────────────────
//
// Pure, GL-free planning for the Sound Drawing GPU phosphor pipeline: HDR
// target selection, persistence decay, bloom pyramid shape per quality tier,
// and the pass budget each tier implies.
//
// Kept separate from the WebGL runtime for the same reason
// `soundDrawingBloom.ts` is separate from the scene GLSL: shaders cannot run in
// a unit test, so the numbers they implement are pinned here where they can be
// asserted directly. The runtime reads this plan; it never invents its own.
//
// Rendering-side ownership note: this plan describes Sound Drawing's own
// pipeline. LaserDMX's photographic post stack is documented as not sharing
// mutable post-processing state, and its exposure model is built on fixture and
// atmosphere concepts a scope does not have, so the two remain separate
// pipelines that share only stateless capability probing.

/** Quality tiers, ordered cheapest to most expensive. */
export type ScopePhosphorQuality = 'low' | 'medium' | 'high' | 'ultra'

export const SCOPE_PHOSPHOR_QUALITY_ORDER: readonly ScopePhosphorQuality[] = [
  'low',
  'medium',
  'high',
  'ultra',
]

// ── HDR target selection ──────────────────────────────────────────────────────

export type ScopeHdrTargetFormat = 'rgba16f' | 'rgba8'

export interface ScopeHdrCapabilityProbe {
  colorBufferFloat: boolean
  rgba16fRenderable: boolean
  floatLinearFiltering: boolean
  /**
   * `EXT_float_blend`: whether `gl.BLEND` may be enabled while drawing into a
   * float target.
   *
   * Load-bearing for this pipeline specifically. Beam emission is an *additive*
   * pass into the HDR target — that is what makes overlapping strokes accumulate
   * into hotter intersections instead of overwriting each other. Some drivers
   * expose float render targets but reject blending into them, so a probe that
   * only checked renderability would select HDR and then fail at draw time on
   * exactly the pass the HDR path exists for.
   */
  floatBlend: boolean
}

export interface ScopeHdrTargetStrategy {
  hdrEnabled: boolean
  targetFormat: ScopeHdrTargetFormat
  linearFiltering: boolean
  /**
   * Largest scene value the target can carry. Bloom thresholds and the beam's
   * emission scale are expressed relative to this, so an LDR fallback stays
   * visually coherent instead of clipping everything to flat white.
   */
  maximumSceneValue: number
  diagnosticCode: 'hdr-rgba16f' | 'ldr-rgba8-fallback'
}

/**
 * Chooses the render-target strategy from a capability probe.
 *
 * Half-float is preferred but never assumed: the brief's requirement is that
 * high-quality GPU rendering must not be mandatory for engine availability, so
 * an RGBA8 path stays fully renderable with adjusted headroom rather than
 * disabling the scope.
 */
export function resolveScopeHdrTargetStrategy(
  probe: ScopeHdrCapabilityProbe,
): ScopeHdrTargetStrategy {
  // All three are required, not just renderability: the beam pass blends
  // additively into this target, so a device that can render float but not
  // blend into it must take the RGBA8 path rather than fail at draw time.
  const hdrEnabled = probe.colorBufferFloat && probe.rgba16fRenderable && probe.floatBlend
  return hdrEnabled
    ? {
        hdrEnabled: true,
        targetFormat: 'rgba16f',
        linearFiltering: probe.floatLinearFiltering,
        maximumSceneValue: 16,
        diagnosticCode: 'hdr-rgba16f',
      }
    : {
        hdrEnabled: false,
        targetFormat: 'rgba8',
        linearFiltering: true,
        maximumSceneValue: 1,
        diagnosticCode: 'ldr-rgba8-fallback',
      }
}

/**
 * Probes the live context for the capabilities `resolveScopeHdrTargetStrategy`
 * needs.
 *
 * Extension detection delegates to the shared `ShaderCapabilities` module so
 * there is one source of truth for the float-target policy across the engine.
 * The renderability check is done here because it is the part extension
 * presence does not guarantee: several drivers advertise
 * `EXT_color_buffer_float` yet report an incomplete framebuffer for an actual
 * RGBA16F attachment, so a two-texel test attachment is built and torn down.
 */
export function probeScopeHdrCapability(gl: WebGL2RenderingContext): ScopeHdrCapabilityProbe {
  const { colorBufferFloat, floatBlend } = detectShaderFloatTargetCapability(gl)
  const floatLinearFiltering = gl.getExtension('OES_texture_float_linear') != null

  let rgba16fRenderable = false
  const texture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  try {
    if (colorBufferFloat && texture && framebuffer && !gl.isContextLost()) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 2, 2, 0, gl.RGBA, gl.HALF_FLOAT, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      rgba16fRenderable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }
  } catch {
    rgba16fRenderable = false
  } finally {
    // The probe must leave no trace: it runs during init and on every context
    // restore, so a leaked texture or framebuffer would accumulate per restore.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (framebuffer) gl.deleteFramebuffer(framebuffer)
    if (texture) gl.deleteTexture(texture)
  }

  return { colorBufferFloat, rgba16fRenderable, floatLinearFiltering, floatBlend }
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Shortest persistence the UI may request. Below this the phosphor reads as an
 * untrailed line and the ping-pong pass is pure cost.
 */
export const MIN_SCOPE_PERSISTENCE_SECONDS = 0.01

/** Longest persistence. Beyond this the display never resolves a new figure. */
export const MAX_SCOPE_PERSISTENCE_SECONDS = 4

/**
 * Fraction of the previous phosphor frame retained over `deltaSeconds`.
 *
 * Exponential in elapsed time, not in frame count: `exp(-dt / tau)`. A decay
 * expressed per frame — which is what the shared feedback pass takes — makes a
 * trail that is twice as long at 120 fps as at 60 fps, so the runtime converts
 * through this function every frame rather than passing a constant.
 *
 * This mirrors the frame-rate-independent rule the Canvas2D trail already uses
 * (`computeSoundDrawingTrailRetention`), so the two paths age their trails at
 * the same real-world rate and a quality switch cannot change the look.
 */
export function resolveScopePersistenceDecay(
  persistenceSeconds: number,
  deltaSeconds: number,
): number {
  const tau = clamp(persistenceSeconds, MIN_SCOPE_PERSISTENCE_SECONDS, MAX_SCOPE_PERSISTENCE_SECONDS)
  const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
  // Exactly exp(-dt/tau), with no upper clamp.
  //
  // Burn-in is already prevented by clamping tau: at the longest supported
  // persistence a 60 fps frame still retains only exp(-(1/60)/4) ≈ 0.9958, so
  // the trail always clears in bounded time. An additional cap just below 1
  // would decay the phosphor even when dt is zero, which breaks the property
  // this function exists to provide — that n frames of dt/n compose exactly to
  // one frame of dt — and would quietly mask a stalled upstream clock rather
  // than letting it surface.
  return Math.exp(-dt / tau)
}

/**
 * Seconds for the phosphor to fall to `targetFraction` of its initial energy.
 * Used by tests and diagnostics to state persistence in observable terms.
 */
export function resolveScopePersistenceHalfLifeSeconds(
  persistenceSeconds: number,
  targetFraction = 0.5,
): number {
  const tau = clamp(persistenceSeconds, MIN_SCOPE_PERSISTENCE_SECONDS, MAX_SCOPE_PERSISTENCE_SECONDS)
  const fraction = clamp(targetFraction, 1e-6, 0.999999)
  return -tau * Math.log(fraction)
}

// ── Bloom pyramid ─────────────────────────────────────────────────────────────

export interface ScopeBloomLevelPlan {
  /** Stable pass identity, for framebuffer naming and GPU timer labels. */
  id: 'tight' | 'medium' | 'wide'
  /** Base Gaussian sigma in pixels at full resolution, before channel scaling. */
  sigmaPx: number
  /** Contribution weight when composited into the final image. */
  weight: number
  /**
   * Render-target scale for this level. Wide bloom runs small because a large
   * blur of a small target is visually equivalent to a small blur of a large
   * one, at a fraction of the fill cost.
   */
  resolutionScale: number
  channelRadiusScale: readonly [number, number, number]
}

export interface ScopePhosphorPlan {
  quality: ScopePhosphorQuality
  hdr: ScopeHdrTargetStrategy
  bloomLevels: readonly ScopeBloomLevelPlan[]
  /** Ping-pong persistence target scale. Halved on the cheapest tier. */
  persistenceResolutionScale: number
  /** Maximum trace points the geometry pass will draw this tier. */
  maxTracePoints: number
  /** Whether the optional CRT presentation pass may run at this tier. */
  crtEnabled: boolean
  /** Total render passes, for budget assertions and telemetry. */
  estimatedPassCount: number
}

const BLOOM_LEVEL_IDS: readonly ScopeBloomLevelPlan['id'][] = ['tight', 'medium', 'wide']

/** Target scale per bloom level. Index matches BLOOM_LEVEL_IDS. */
const BLOOM_RESOLUTION_SCALES: readonly number[] = [1, 0.5, 0.25]

/** Bloom levels retained per tier, cheapest first. */
const BLOOM_LEVEL_COUNT: Record<ScopePhosphorQuality, number> = {
  low: 1,
  medium: 2,
  high: 3,
  ultra: 3,
}

const MAX_TRACE_POINTS: Record<ScopePhosphorQuality, number> = {
  low: 512,
  medium: 1024,
  high: 2048,
  ultra: 4096,
}

const PERSISTENCE_RESOLUTION_SCALE: Record<ScopePhosphorQuality, number> = {
  low: 0.5,
  medium: 1,
  high: 1,
  ultra: 1,
}

/**
 * Builds the bloom pyramid for a tier.
 *
 * Levels are dropped from the widest inward. Dropping the tight level instead
 * would remove the dense luminous line body, which is the part that reads as
 * "a real beam" — the wide atmospheric spill is the most expendable.
 */
export function resolveScopeBloomLevels(
  quality: ScopePhosphorQuality,
  tiers: readonly BloomTierConfig[] = SOUND_DRAWING_BLOOM_TIERS,
): readonly ScopeBloomLevelPlan[] {
  const count = Math.min(BLOOM_LEVEL_COUNT[quality], tiers.length)
  const levels: ScopeBloomLevelPlan[] = []
  for (let index = 0; index < count; index++) {
    const tier = tiers[index]
    levels.push({
      id: BLOOM_LEVEL_IDS[index],
      sigmaPx: tier.sigmaPx,
      weight: tier.weight,
      resolutionScale: BLOOM_RESOLUTION_SCALES[index],
      channelRadiusScale: tier.channelRadiusScale,
    })
  }
  return levels
}

/**
 * Resolves the full per-tier pipeline plan.
 *
 * Pass accounting: beam emission + persistence + two per bloom level
 * (downsample/extract then blur) + composite, plus CRT when enabled.
 */
export function resolveScopePhosphorPlan(
  quality: ScopePhosphorQuality,
  hdr: ScopeHdrTargetStrategy,
): ScopePhosphorPlan {
  const bloomLevels = resolveScopeBloomLevels(quality)
  const crtEnabled = quality !== 'low'
  const estimatedPassCount = 1 + 1 + bloomLevels.length * 2 + 1 + (crtEnabled ? 1 : 0)
  return {
    quality,
    hdr,
    bloomLevels,
    persistenceResolutionScale: PERSISTENCE_RESOLUTION_SCALE[quality],
    maxTracePoints: MAX_TRACE_POINTS[quality],
    crtEnabled,
    estimatedPassCount,
  }
}

/**
 * Initial tier from device capability, before any frame timing exists.
 *
 * Deliberately conservative: starting too high and downshifting produces a
 * visible quality drop in the first seconds of a show, which is worse than
 * starting one tier low and rising once frame timing proves there is headroom.
 */
export function resolveInitialScopePhosphorQuality(capabilities: {
  hdrAvailable: boolean
  maxTextureSize: number
  devicePixelRatio: number
}): ScopePhosphorQuality {
  const textureLimit = Math.max(0, capabilities.maxTextureSize)
  const dpr = clamp(capabilities.devicePixelRatio, 0.5, 4)
  if (textureLimit < 2048) return 'low'
  if (textureLimit < 4096 || dpr >= 3) return 'medium'
  if (!capabilities.hdrAvailable || dpr >= 2.2) return 'high'
  return 'ultra'
}

// ── Quality transitions ───────────────────────────────────────────────────────

/**
 * Whether moving between two plans requires reallocating render targets.
 *
 * This is the only part of a quality change that is decidable from the plans
 * alone. The stronger guarantees the brief demands — that a tier change must
 * not clear persistence, reset the trigger, or change signal mode or phosphor
 * colour — are properties of the *runtime*, not of this data, so they are
 * asserted against the runtime when it lands rather than by a function here
 * that could only ever return a hardcoded answer.
 */
export function scopeQualityChangeNeedsTargetReallocation(
  from: ScopePhosphorPlan,
  to: ScopePhosphorPlan,
): boolean {
  return (
    from.persistenceResolutionScale !== to.persistenceResolutionScale ||
    from.bloomLevels.length !== to.bloomLevels.length
  )
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}
