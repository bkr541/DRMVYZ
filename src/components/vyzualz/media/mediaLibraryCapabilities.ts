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

/** Foundation management mode: expose the canonical browser's existing tools
 * without creating a second upload, signed-URL, collection, or media state path.
 */
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
