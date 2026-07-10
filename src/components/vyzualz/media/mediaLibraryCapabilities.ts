export type MediaLibraryContext = 'visualizer' | 'react' | 'canvas' | 'manager'

export type MediaLibraryCapability =
  | 'select'
  | 'load-track'
  | 'preview'
  | 'favorite'
  | 'upload'
  | 'edit'
  | 'remove'
  | 'collections'
  | 'drag-media'

/**
 * Performance views can browse, preview, favorite, select, and load media, but
 * all authoring and destructive actions belong exclusively to Media Manager.
 * `drag-media` refers to dragging an existing library item into a performance
 * target, not accepting file drops for upload.
 */
export const MEDIA_DECK_CAPABILITIES = [
  'select',
  'load-track',
  'preview',
  'favorite',
  'collections',
  'drag-media',
] as const satisfies readonly MediaLibraryCapability[]

/** Full management mode backed by the canonical upload, signed-URL, collection,
 * visual-media, and saved-audio services. */
export const MEDIA_MANAGER_CAPABILITIES = [
  'select',
  'load-track',
  'preview',
  'favorite',
  'upload',
  'edit',
  'remove',
  'collections',
  'drag-media',
] as const satisfies readonly MediaLibraryCapability[]


/** CANVAS selects saved visual media through the shared library.
 * Uploading and all management actions remain exclusive to Media Manager. */
export const CANVAS_MEDIA_LIBRARY_CAPABILITIES = [
  'select',
  'preview',
  'favorite',
  'collections',
  'drag-media',
] as const satisfies readonly MediaLibraryCapability[]
