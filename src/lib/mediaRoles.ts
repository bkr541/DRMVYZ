// Shared constants for media role/category system.
// All role logic lives here so components and the store share one source of truth.

export type MediaRole =
  | 'background_image'
  | 'background_video'
  | 'logo'
  | 'transparent_element'
  | 'overlay'
  | 'character_art'
  | 'texture'
  | 'loop'
  | 'transition'
  | 'reference'
  | 'other'

export type MediaEnergy = 'low' | 'medium' | 'high' | 'peak'

export const MEDIA_ROLES: MediaRole[] = [
  'background_image',
  'background_video',
  'logo',
  'transparent_element',
  'overlay',
  'character_art',
  'texture',
  'loop',
  'transition',
  'reference',
  'other',
]

export const MEDIA_ROLE_LABELS: Record<MediaRole, string> = {
  background_image:    'Background Image',
  background_video:    'Background Video',
  logo:                'Logo',
  transparent_element: 'Transparent Element',
  overlay:             'Overlay',
  character_art:       'Character Art',
  texture:             'Texture',
  loop:                'Loop',
  transition:          'Transition',
  reference:           'Reference',
  other:               'Other',
}

// Used in role <select> option groups
export const MEDIA_ROLE_ICONS: Record<MediaRole, string> = {
  background_image:    '⬛',
  background_video:    '▶',
  logo:                '◎',
  transparent_element: '◈',
  overlay:             '⊞',
  character_art:       '◉',
  texture:             '▦',
  loop:                '↺',
  transition:          '⇌',
  reference:           '◯',
  other:               '●',
}

// Filename keyword patterns → suggested role. Order is intentional (first match wins).
const ROLE_HINTS: [RegExp, MediaRole][] = [
  [/logo/i,            'logo'],
  [/overlay/i,         'overlay'],
  [/transition/i,      'transition'],
  [/texture/i,         'texture'],
  [/loop/i,            'loop'],
  [/alpha|transparent/i, 'transparent_element'],
  [/char|character/i,  'character_art'],
]

/**
 * Returns a suggested MediaRole based on filename and MIME type.
 * Used as the initial role when a file is added to the modal.
 */
export function suggestMediaRole(file: File): MediaRole {
  for (const [re, role] of ROLE_HINTS) {
    if (re.test(file.name)) return role
  }
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
  return isVideo ? 'background_video' : 'background_image'
}

/**
 * Returns true when the role implies this media likely has transparency.
 * Used to pre-check the "Has Alpha" toggle.
 */
export function roleImpliesAlpha(role: MediaRole): boolean {
  return role === 'transparent_element' || role === 'overlay' || role === 'logo'
}

/**
 * Roles valid for the primary canvas / background render path.
 * Layer-managed and helper roles are intentionally excluded so they are never
 * auto-selected as the main visual source.
 */
export const PRIMARY_MEDIA_ROLES = new Set<MediaRole>([
  'background_image',
  'background_video',
  'loop',
  'other',  // generic catch-all — not a layer-only asset
])

/** Returns true when an item should be considered a valid primary canvas source. */
export function isPrimaryMedia(item: { mediaRole: MediaRole }): boolean {
  return PRIMARY_MEDIA_ROLES.has(item.mediaRole)
}

export const ENERGY_LABELS: Record<MediaEnergy, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  peak:   'Peak',
}

export const MUSICAL_KEYS = [
  'C','C#/Db','D','D#/Eb','E','F','F#/Gb','G','G#/Ab','A','A#/Bb','B',
  'Cm','C#m/Dbm','Dm','D#m/Ebm','Em','Fm','F#m/Gbm','Gm','G#m/Abm','Am','A#m/Bbm','Bm',
]
