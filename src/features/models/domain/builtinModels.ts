/** A shipped model the Media Manager can open. The list is empty: models in the library are the user's own (generated or imported). */
export interface BuiltinModel {
  id: string
  name: string
  description: string
  /** Public URL of the GLB. */
  url: string
  thumbnailUrl: string
}
export const BUILTIN_MODELS: readonly BuiltinModel[] = []
