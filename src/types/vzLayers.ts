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
  /**
   * Explicitly assigned media item ID for this layer.
   * null = fall back to the first deck item whose mediaRole maps to this layer.
   * Set to a specific string to render only that one item.
   */
  mediaId: string | null
}

export const DEFAULT_LAYER_CONFIGS: VzLayerConfig[] = [
  { id: 'texture',   enabled: true,  opacity: 0.4,  blendMode: 'multiply',    fit: 'cover',   mediaId: null },
  { id: 'character', enabled: true,  opacity: 1.0,  blendMode: 'source-over', fit: 'contain', mediaId: null },
  { id: 'logo',      enabled: true,  opacity: 1.0,  blendMode: 'source-over', fit: 'contain', mediaId: null },
  { id: 'overlay',   enabled: true,  opacity: 0.85, blendMode: 'screen',      fit: 'cover',   mediaId: null },
]

// ── Layer item ─────────────────────────────────────────────────────────

export interface VzLayerItem {
  id: string
  /** ID of the media item in the media deck */
  mediaId: string
  /** Which layer this item belongs to */
  layerId: VzLayerConfigId
  enabled: boolean
  locked: boolean
  solo: boolean
  /** 0–1 item-level opacity (multiplied by layer-level opacity at render time) */
  opacity: number
  /** Canvas composite operation for this item */
  blendMode: GlobalCompositeOperation
  /**
   * Normalized position: 0 = left/top edge, 0.5 = center, 1 = right/bottom edge.
   * Applied as ctx.translate(x * W, y * H) before scale/rotation.
   */
  x: number
  y: number
  /**
   * Scale multiplier on top of fitMode sizing. 1.0 = no additional scaling.
   */
  scale: number
  /** Rotation in degrees, clockwise positive. */
  rotation: number
  /** Which point on the image is pinned to (x, y) */
  anchor: 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  /** How the source fills its computed draw rectangle */
  fitMode: 'cover' | 'contain' | 'stretch' | 'original'
  /** Render order within a layer — higher zIndex draws on top. */
  zIndex: number
  /** When true, the canvas bass-reactive scale pulse is applied to this item. */
  audioReactive: boolean
}

function genLayerItemId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createDefaultLayerItem(
  mediaId: string,
  layerId: VzLayerConfigId,
  overrides?: Partial<Omit<VzLayerItem, 'id' | 'mediaId' | 'layerId'>>,
): VzLayerItem {
  const layerCfg = DEFAULT_LAYER_CONFIGS.find(c => c.id === layerId)
  return {
    id:            genLayerItemId(),
    mediaId,
    layerId,
    enabled:       true,
    locked:        false,
    solo:          false,
    opacity:       1,
    blendMode:     layerCfg?.blendMode ?? 'source-over',
    x:             0.5,
    y:             0.5,
    scale:         1,
    rotation:      0,
    anchor:        'center',
    fitMode:       layerCfg?.fit ?? 'contain',
    zIndex:        0,
    audioReactive: layerId === 'logo' || layerId === 'character',
    ...overrides,
  }
}

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
