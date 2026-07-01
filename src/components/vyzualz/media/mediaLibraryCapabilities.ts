export type MediaLibraryContext = 'visualizer' | 'react' | 'manager'

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
 * The performance deck keeps its complete pre-refactor behavior in Patch 3.
 * Later patches may intentionally narrow this list once Media Manager owns the
 * management-first actions.
 */
export const MEDIA_DECK_CAPABILITIES = [
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
