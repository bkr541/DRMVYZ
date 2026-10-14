import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'

/**
 * Central quality configuration for the opt-in rendering capabilities (ambient occlusion, anti-aliasing, shadow filtering, environment
 * resolution, texture filtering, model detail, advanced PBR features).
 *
 * These are *available* settings. Nothing here switches a feature on: a scene or effect has to ask for it, and an existing preset that asks for
 * none of them renders exactly as before. Every consumer reads its tier row from here so the three tiers stay consistent, and the capability
 * detection below lets a consumer step a feature down (never crash) when the GPU cannot do it.
 */
export type Cinema2AntiAliasingMode = 'off' | 'fxaa' | 'smaa'
export type Cinema2ShadowFilter = 'basic' | 'pcf' | 'vsm'

export interface Cinema2AmbientOcclusionQuality {
  /** `false` on low: the effect passes the image through without allocating or drawing anything. */
  enabled: boolean
  /** Hemisphere samples per pixel. */
  samples: number
  /** Size of the occlusion buffer relative to the frame (denoising upsamples it depth-aware). */
  resolutionScale: number
  /** Taps per side of each depth-aware blur pass (0 = no denoising). */
  denoiseTaps: number
}

export interface Cinema2ShadowQuality {
  mapSize: number
  filter: Cinema2ShadowFilter
  /** Softness radius (PCF / VSM). */
  radius: number
  /** VSM blur samples. */
  blurSamples: number
}

export interface Cinema2PbrQuality {
  clearcoat: boolean
  sheen: boolean
  transmission: boolean
  iridescence: boolean
  anisotropy: boolean
}

export interface Cinema2RenderQualityProfile {
  tier: Cinema2RenderQualityLevel
  /** Mode used by an anti-aliasing effect set to `auto`. */
  antiAliasing: Readonly<{ auto: Cinema2AntiAliasingMode; smaaThreshold: number }>
  ambientOcclusion: Readonly<Cinema2AmbientOcclusionQuality>
  shadows: Readonly<Cinema2ShadowQuality>
  /** Widest equirectangular environment source that is filtered into image-based lighting (wider sources are box-downsampled first). */
  environment: Readonly<{ maxSourceWidth: number }>
  /** Anisotropic filtering requested for imported material textures (clamped to what the GPU offers). */
  textureFiltering: Readonly<{ anisotropy: number; mipmaps: boolean }>
  /** Which advanced physical-material features survive on this tier. */
  pbr: Readonly<Cinema2PbrQuality>
  /** Model detail: scales LOD switch distances (larger = detailed meshes stay longer) and picks the asset variant LOD level. */
  modelDetail: Readonly<{ lodDistanceScale: number; preferredLevel: 'optimized' | 'balanced' | 'detailed' }>
}

export const CINEMA2_RENDER_QUALITY_PROFILES: Readonly<Record<Cinema2RenderQualityLevel, Readonly<Cinema2RenderQualityProfile>>> = Object.freeze({
  low: Object.freeze({
    tier: 'low',
    antiAliasing: Object.freeze({ auto: 'fxaa', smaaThreshold: 0.1 }),
    ambientOcclusion: Object.freeze({ enabled: false, samples: 0, resolutionScale: 0.5, denoiseTaps: 0 }),
    shadows: Object.freeze({ mapSize: 512, filter: 'basic', radius: 1, blurSamples: 0 }),
    environment: Object.freeze({ maxSourceWidth: 512 }),
    textureFiltering: Object.freeze({ anisotropy: 1, mipmaps: true }),
    pbr: Object.freeze({ clearcoat: true, sheen: true, transmission: false, iridescence: false, anisotropy: false }),
    modelDetail: Object.freeze({ lodDistanceScale: 0.6, preferredLevel: 'optimized' }),
  }),
  medium: Object.freeze({
    tier: 'medium',
    antiAliasing: Object.freeze({ auto: 'smaa', smaaThreshold: 0.1 }),
    ambientOcclusion: Object.freeze({ enabled: true, samples: 8, resolutionScale: 0.5, denoiseTaps: 3 }),
    shadows: Object.freeze({ mapSize: 1024, filter: 'pcf', radius: 2, blurSamples: 0 }),
    environment: Object.freeze({ maxSourceWidth: 1024 }),
    textureFiltering: Object.freeze({ anisotropy: 4, mipmaps: true }),
    pbr: Object.freeze({ clearcoat: true, sheen: true, transmission: true, iridescence: false, anisotropy: true }),
    modelDetail: Object.freeze({ lodDistanceScale: 1, preferredLevel: 'balanced' }),
  }),
  high: Object.freeze({
    tier: 'high',
    antiAliasing: Object.freeze({ auto: 'smaa', smaaThreshold: 0.08 }),
    ambientOcclusion: Object.freeze({ enabled: true, samples: 16, resolutionScale: 1, denoiseTaps: 4 }),
    shadows: Object.freeze({ mapSize: 2048, filter: 'pcf', radius: 3, blurSamples: 8 }),
    environment: Object.freeze({ maxSourceWidth: 2048 }),
    textureFiltering: Object.freeze({ anisotropy: 16, mipmaps: true }),
    pbr: Object.freeze({ clearcoat: true, sheen: true, transmission: true, iridescence: true, anisotropy: true }),
    modelDetail: Object.freeze({ lodDistanceScale: 1.6, preferredLevel: 'detailed' }),
  }),
})

export function cinema2RenderQualityProfile(tier: Cinema2RenderQualityLevel): Readonly<Cinema2RenderQualityProfile> {
  return CINEMA2_RENDER_QUALITY_PROFILES[tier]
}

// ---------------------------------------------------------------- capability detection

export interface Cinema2RenderCapabilities {
  /** Render into `RGBA16F` (HDR intermediate targets). */
  floatColorTargets: boolean
  /** Linear filtering of float textures. */
  floatLinearFiltering: boolean
  /** `EXT_disjoint_timer_query_webgl2` (GPU timing). */
  gpuTimerQuery: boolean
  /** `KHR_parallel_shader_compile` (non-blocking shader compiles). */
  parallelShaderCompile: boolean
  maxTextureSize: number
  /** Largest anisotropic filtering level (1 when `EXT_texture_filter_anisotropic` is missing). */
  maxAnisotropy: number
  /** GPU-native compressed texture families (KTX2 / Basis transcodes to one of these, or to uncompressed RGBA when none is available). */
  compressedTextures: Readonly<{ astc: boolean; etc2: boolean; s3tc: boolean; bptc: boolean; pvrtc: boolean }>
}

/** Extension handles die with the context, so this is read fresh (not cached) whenever a consumer needs it after a restore. */
export function detectCinema2RenderCapabilities(gl: WebGL2RenderingContext): Readonly<Cinema2RenderCapabilities> {
  const has = (name: string): boolean => typeof gl.getExtension === 'function' && gl.getExtension(name) != null
  const aniso = typeof gl.getExtension === 'function'
    ? (gl.getExtension('EXT_texture_filter_anisotropic') ?? gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')) as { MAX_TEXTURE_MAX_ANISOTROPY_EXT: number } | null
    : null
  return Object.freeze({
    floatColorTargets: has('EXT_color_buffer_float'),
    floatLinearFiltering: has('OES_texture_float_linear'),
    gpuTimerQuery: has('EXT_disjoint_timer_query_webgl2'),
    parallelShaderCompile: has('KHR_parallel_shader_compile'),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 2048,
    maxAnisotropy: aniso ? Number(gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 1 : 1,
    compressedTextures: Object.freeze({
      astc: has('WEBGL_compressed_texture_astc'),
      etc2: has('WEBGL_compressed_texture_etc'),
      s3tc: has('WEBGL_compressed_texture_s3tc'),
      bptc: has('EXT_texture_compression_bptc'),
      pvrtc: has('WEBGL_compressed_texture_pvrtc') || has('WEBKIT_WEBGL_compressed_texture_pvrtc'),
    }),
  })
}

export interface Cinema2ResolvedRenderFeatures {
  tier: Cinema2RenderQualityLevel
  profile: Readonly<Cinema2RenderQualityProfile>
  antiAliasing: Cinema2AntiAliasingMode
  ambientOcclusion: Readonly<Cinema2AmbientOcclusionQuality>
  textureAnisotropy: number
  /** Features that were stepped down because the GPU cannot do them, each with the reason. */
  downgrades: readonly Readonly<{ feature: string; reason: string }>[]
}

export interface Cinema2RenderFeatureRequest {
  antiAliasing?: Cinema2AntiAliasingMode | 'auto'
  /** `false` forces ambient occlusion off even on tiers that allow it. */
  ambientOcclusion?: boolean
  textureAnisotropy?: number
}

/**
 * Turns a scene's request into what this tier and GPU can actually do. It never throws: unsupported features step down and the reason is
 * recorded so diagnostics can show it. With no request, nothing is enabled beyond the tier's `auto` anti-aliasing mode.
 */
export function resolveCinema2RenderFeatures(
  tier: Cinema2RenderQualityLevel,
  capabilities: Readonly<Cinema2RenderCapabilities>,
  request: Readonly<Cinema2RenderFeatureRequest> = {},
): Readonly<Cinema2ResolvedRenderFeatures> {
  const profile = cinema2RenderQualityProfile(tier)
  const downgrades: { feature: string; reason: string }[] = []

  let antiAliasing: Cinema2AntiAliasingMode = request.antiAliasing == null || request.antiAliasing === 'auto' ? profile.antiAliasing.auto : request.antiAliasing
  if (antiAliasing === 'smaa' && capabilities.maxTextureSize < 1024) {
    downgrades.push({ feature: 'anti-aliasing', reason: 'GPU texture size limit is too small for the SMAA lookup tables; using FXAA.' })
    antiAliasing = 'fxaa'
  }

  let ambientOcclusion = profile.ambientOcclusion
  if (request.ambientOcclusion === false && ambientOcclusion.enabled) {
    ambientOcclusion = Object.freeze({ ...ambientOcclusion, enabled: false })
  } else if (ambientOcclusion.enabled && !capabilities.floatColorTargets) {
    // The occlusion buffer then packs its depth guard into 8 bits; still correct, but denoising is the first thing to give up.
    downgrades.push({ feature: 'ambient-occlusion', reason: 'Float render targets are unavailable; the occlusion buffer is 8-bit and denoising is shortened.' })
    ambientOcclusion = Object.freeze({ ...ambientOcclusion, denoiseTaps: Math.min(ambientOcclusion.denoiseTaps, 2) })
  }

  const requestedAniso = request.textureAnisotropy ?? profile.textureFiltering.anisotropy
  const textureAnisotropy = Math.max(1, Math.min(requestedAniso, capabilities.maxAnisotropy))
  if (textureAnisotropy < requestedAniso) downgrades.push({ feature: 'texture-filtering', reason: `GPU supports ${capabilities.maxAnisotropy}x anisotropy; ${requestedAniso}x was requested.` })

  return Object.freeze({ tier, profile, antiAliasing, ambientOcclusion, textureAnisotropy, downgrades: Object.freeze(downgrades.map(entry => Object.freeze(entry))) })
}

// ---------------------------------------------------------------- dynamic resolution

export interface Cinema2DynamicResolutionOptions {
  /** Frame time the controller steers toward. */
  targetFrameMs?: number
  minScale?: number
  maxScale?: number
  /** Scale moves in multiples of this, so the render targets are reallocated rarely. */
  step?: number
  /** Consecutive slow frames before stepping down. */
  slowFrames?: number
  /** Consecutive fast frames before stepping up. */
  fastFrames?: number
}

/**
 * Steers a render-target scale from measured frame times. Stepping is quantized and uses hysteresis (down fast, up slowly) so the targets are
 * reallocated rarely and the image does not breathe. Pure: the caller decides whether and where to apply the scale.
 */
export class Cinema2DynamicResolution {
  private scale: number
  private average: number | null = null
  private slow = 0
  private fast = 0
  private readonly target: number
  private readonly min: number
  private readonly max: number
  private readonly step: number
  private readonly slowFrames: number
  private readonly fastFrames: number

  constructor(options: Cinema2DynamicResolutionOptions = {}) {
    this.target = options.targetFrameMs ?? 16.7
    this.min = options.minScale ?? 0.5
    this.max = options.maxScale ?? 1
    this.step = options.step ?? 0.125
    this.slowFrames = options.slowFrames ?? 8
    this.fastFrames = options.fastFrames ?? 90
    this.scale = this.max
  }

  getScale(): number {
    return this.scale
  }

  /** Feeds one frame time and returns the (possibly changed) scale. */
  sample(frameMs: number): number {
    if (!Number.isFinite(frameMs) || frameMs < 0) return this.scale
    this.average = this.average == null ? frameMs : this.average * 0.85 + frameMs * 0.15
    if (this.average > this.target * 1.15) {
      this.slow += 1
      this.fast = 0
      if (this.slow >= this.slowFrames) {
        this.scale = Math.max(this.min, this.scale - this.step)
        this.slow = 0
        this.average = null
      }
    } else if (this.average < this.target * 0.75) {
      this.fast += 1
      this.slow = 0
      if (this.fast >= this.fastFrames) {
        this.scale = Math.min(this.max, this.scale + this.step)
        this.fast = 0
        this.average = null
      }
    } else {
      this.slow = 0
      this.fast = 0
    }
    return this.scale
  }

  reset(): void {
    this.scale = this.max
    this.average = null
    this.slow = 0
    this.fast = 0
  }
}
