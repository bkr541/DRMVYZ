import type { TextureSourceType } from '../registry/shaderRegistryTypes'

// ── Extended source type ──────────────────────────────────────────────────────
// Superset of the registry TextureSourceType, adding runtime-specific variants.

export type ShaderTexSourceType =
  | TextureSourceType          // all 11 registry types
  | 'noise-white'              // deterministic white noise (LCG seeded)
  | 'noise-value'              // smooth value noise
  | 'noise-blue'               // blue-noise asset (falls back to value noise)
  | 'svg'                      // rasterized SVG (caller provides loaded HTMLImageElement)
  | 'solid-color'              // 1×1 RGBA fill
  | 'unset'                    // no source selected

export type MaskType = 'radial' | 'linear-h' | 'linear-v' | 'vignette' | 'box'

// ── Source selection ──────────────────────────────────────────────────────────

export interface ShaderTexSourceSelection {
  sourceType: ShaderTexSourceType
  // For image / video / canvas / svg / media-output sources:
  mediaElement?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null
  /** Stable URL used as a change-detection key. Does not have to be the actual URL. */
  assetUrl?: string
  // For noise-white / noise-value / noise-blue:
  noiseSeed?: number   // default 0
  noiseSize?: number   // default 128 (white) / 256 (value/blue)
  // For mask:
  maskType?: MaskType  // default 'radial'
  maskSize?: number    // default 256
  maskInvert?: boolean // default false
  // For solid-color:
  color?: readonly [number, number, number, number]  // RGBA 0–255, default [0,0,0,255]
  // For shader-output:
  passOutputName?: string
}

// ── Resolved texture metadata ─────────────────────────────────────────────────

export interface ShaderTextureMeta {
  w: number
  h: number
  aspectRatio: number    // w / h
  uvScaleX: number       // 1.0 for normal; kept for shader metadata uniform
  uvScaleY: number
  uvOffsetX: number
  uvOffsetY: number
  sourceType: ShaderTexSourceType
  /** false when the texture is the opaque-black fallback. */
  available: boolean
  /** true when the texture content changes frame-to-frame (video, canvas). */
  dynamic: boolean
}

export interface ResolvedShaderTexture {
  texture: WebGLTexture
  meta: ShaderTextureMeta
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface TextureInputValidation {
  inputName: string
  required: boolean
  available: boolean
  warningMessage: string | null
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const SHADER_TEX_SOURCE_LABELS: Readonly<Record<ShaderTexSourceType, string>> = {
  'uploaded-image':  'Uploaded Image',
  'uploaded-video':  'Uploaded Video',
  'media-output':    'Media Output',
  'logo':            'Logo',
  'album-artwork':   'Album Artwork',
  'previous-frame':  'Previous Frame',
  'shader-output':   'Shader Output',
  'fft':             'FFT Spectrum',
  'waveform':        'Waveform',
  'noise':           'Noise',
  'mask':            'Mask',
  'noise-white':     'White Noise',
  'noise-value':     'Value Noise',
  'noise-blue':      'Blue Noise',
  'svg':             'SVG',
  'solid-color':     'Solid Color',
  'unset':           'Not set',
}

// ── Fallback metadata constant ────────────────────────────────────────────────

export const FALLBACK_TEX_META: ShaderTextureMeta = {
  w: 1, h: 1, aspectRatio: 1,
  uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0,
  sourceType: 'solid-color', available: false, dynamic: false,
}
