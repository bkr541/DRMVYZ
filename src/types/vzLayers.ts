import type { MediaRole } from '../lib/mediaRoles'

// ── Layer identity ────────────────────────────────────────────────────

/**
 * Render-layer IDs, listed in compositing order (bottom → top).
 * 'lyrics' is reserved as a hook for a future lyrics overlay layer.
 */
export type VzLayerConfigId =
  | 'texture'
  | 'character'
  | 'logo'
  | 'overlay'

/** Render order: texture is drawn first (bottom of overlay stack), overlay last. */
export const VZ_LAYER_RENDER_ORDER: VzLayerConfigId[] = [
  'texture',
  'character',
  'logo',
  'overlay',
]

export const LAYER_LABELS: Record<VzLayerConfigId, string> = {
  texture:   'Texture',
  character: 'Character',
  logo:      'Logo',
  overlay:   'Overlay',
}

// ── Role ↔ layer mappings ─────────────────────────────────────────────

/**
 * Media roles that belong to each overlay layer.
 * Roles absent from every layer (background_image, background_video, loop,
 * reference, transition, other) are handled by the primary media / timeline
 * system and rendered separately.
 */
export const LAYER_TO_ROLES: Record<VzLayerConfigId, MediaRole[]> = {
  texture:   ['texture'],
  character: ['character_art', 'transparent_element'],
  logo:      ['logo'],
  overlay:   ['overlay'],
}

/** Reverse map: media role → layer it belongs to (undefined = not an overlay layer). */
export const ROLE_TO_LAYER: Partial<Record<MediaRole, VzLayerConfigId>> = {
  texture:             'texture',
  character_art:       'character',
  transparent_element: 'character',
  logo:                'logo',
  overlay:             'overlay',
}

/**
 * Set of roles managed by the overlay layer compositor.
 * Items with these roles are NOT rendered by the primary single-media path —
 * they are rendered exclusively through the layer pass.
 */
export const LAYER_MANAGED_ROLES: ReadonlySet<MediaRole> = new Set<MediaRole>([
  'texture',
  'character_art',
  'transparent_element',
  'logo',
  'overlay',
])

// ── Layer config type ─────────────────────────────────────────────────

export interface VzLayerConfig {
  id: VzLayerConfigId
  /** Whether this layer is drawn. */
  enabled: boolean
  /** 0–1 alpha applied to every item in this layer. */
  opacity: number
  /** Canvas globalCompositeOperation for items in this layer. */
  blendMode: GlobalCompositeOperation
  /** Default fit mode for items in this layer (clip.fitMode overrides per clip). */
  fit: 'cover' | 'contain'
}

export const DEFAULT_LAYER_CONFIGS: VzLayerConfig[] = [
  { id: 'texture',   enabled: true,  opacity: 0.4,  blendMode: 'multiply',    fit: 'cover'   },
  { id: 'character', enabled: true,  opacity: 1.0,  blendMode: 'source-over', fit: 'contain' },
  { id: 'logo',      enabled: true,  opacity: 1.0,  blendMode: 'source-over', fit: 'contain' },
  { id: 'overlay',   enabled: true,  opacity: 0.85, blendMode: 'screen',      fit: 'cover'   },
]

/** Blend modes shown in the Layers panel select. */
export const LAYER_BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over',
  'screen',
  'multiply',
  'overlay',
  'hard-light',
  'soft-light',
  'difference',
  'color-dodge',
  'lighten',
  'darken',
]
