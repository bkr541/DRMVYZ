/** File routing is deliberately independent of Three and of the upload UI. */
export const MODEL_FORMATS = ['glb', 'gltf', 'fbx', 'obj', 'stl', 'ply'] as const
export type ModelImportFormat = typeof MODEL_FORMATS[number]
export const MODEL_FORMAT_ACCEPT = '.glb,.gltf,.fbx,.obj,.stl,.ply,.bin,model/gltf-binary,model/gltf+json'
export function modelImportFormat(file: Pick<File, 'name' | 'type'>): ModelImportFormat | null {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (MODEL_FORMATS.includes(ext as ModelImportFormat)) return ext as ModelImportFormat
  if (file.type === 'model/gltf-binary') return 'glb'
  if (file.type === 'model/gltf+json') return 'gltf'
  return null
}
export function isModelResource(file: Pick<File, 'name'>): boolean { return /\.(bin|png|jpe?g|webp)$/i.test(file.name) }
/** Companion files may accompany exactly one glTF root; never mistake a standalone image for a model. */
export function isModelBatch(files: readonly Pick<File, 'name' | 'type'>[]): boolean {
  const roots = files.filter(file => modelImportFormat(file) !== null)
  return roots.length > 0 && (roots.length === files.length || (roots.length === 1 && modelImportFormat(roots[0]!) === 'gltf' && files.every(file => modelImportFormat(file) !== null || isModelResource(file))))
}
