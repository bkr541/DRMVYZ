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
  | 'audio_track'
  | 'svg'

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
  'audio_track',
  'svg',
]

/** Roles that represent visual media (images/video). audio_track is excluded. */
export const VISUAL_MEDIA_ROLES: MediaRole[] = MEDIA_ROLES.filter(r => r !== 'audio_track')

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
  audio_track:         'Audio Track',
  svg:                 'SVG',
}

/** Compact human-readable labels for badge display on timeline clips and deck cards. */
export const MEDIA_ROLE_BADGE_LABELS: Record<MediaRole, string> = {
  background_image:    'BG Image',
  background_video:    'BG Video',
  logo:                'Logo',
  transparent_element: 'Transparent',
  overlay:             'Overlay',
  character_art:       'Character',
  texture:             'Texture',
  loop:                'Loop',
  transition:          'Transition',
  reference:           'Reference',
  other:               'Other',
  audio_track:         'Audio',
  svg:                 'SVG',
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
  audio_track:         '♪',
  svg:                 '◇',
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

/** Returns true when the file is an audio file by MIME type or extension. */
export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(file.name)
}

/** Returns true when the file is an SVG by MIME type or extension. */
export function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
}

/** Returns true when the filename ends in .svg (case-insensitive). */
export function isSvgFilename(name: string): boolean {
  return /\.svg$/i.test(name)
}

/**
 * Returns a suggested MediaRole based on filename and MIME type.
 * Used as the initial role when a file is added to the modal.
 */
export function suggestMediaRole(file: File): MediaRole {
  if (isAudioFile(file)) return 'audio_track'
  // SVG check before filename hints so an SVG named "logo.svg" gets role "svg", not "logo".
  if (isSvgFile(file)) return 'svg'
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
  return role === 'transparent_element' || role === 'overlay' || role === 'logo' || role === 'svg'
}

export interface MediaFormatInfo {
  isVideo: boolean
  isSvg: boolean
  /** Whether this format can carry a real, addressable alpha channel — not
   * whether this specific file happens to be transparent. JPEG never can;
   * PNG/WEBP/GIF/SVG always can. Common web video codecs (MP4/MOV/WebM) are
   * treated as opaque since DRMVYZ's renderers don't source video alpha. */
  supportsAlpha: boolean
}

/** Derives format characteristics from a MIME type and filename, used to
 * decide which media roles could ever apply to this file (see
 * `getCompatibleMediaRoles`). Accepts an empty MIME type since some upload
 * sources (drag-and-drop from certain OSes/browsers) leave `file.type` blank. */
export function getMediaFormatInfo(mimeType: string, name: string): MediaFormatInfo {
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(name)
  const isSvg = mimeType === 'image/svg+xml' || isSvgFilename(name)
  const supportsAlpha = isSvg ||
    mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/gif' ||
    /\.(png|webp|gif)$/i.test(name)
  return { isVideo, isSvg, supportsAlpha }
}

/**
 * Filters the full visual role list down to roles that could ever actually
 * apply to a file with these format characteristics — e.g. a JPEG can never
 * be "Transparent Element" (JPEG has no alpha channel) and a static image
 * can never be "Background Video". Used to keep the Media Role dropdown from
 * offering choices the uploaded file could never actually be.
 */
export function getCompatibleMediaRoles(format: MediaFormatInfo): MediaRole[] {
  return VISUAL_MEDIA_ROLES.filter(role => {
    if (role === 'svg') return format.isSvg
    if (role === 'background_video') return format.isVideo
    if (role === 'background_image') return !format.isVideo
    if (role === 'transparent_element') return format.supportsAlpha
    return true
  })
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
