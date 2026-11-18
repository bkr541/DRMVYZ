/** The image types a 3D model can be generated from. They match what the generator accepts (`sniffModelImage`): it reads the
 * file's own bytes, so a GIF, a video or anything else is rejected there. */
export const MODEL_SOURCE_MIME_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'] as const
const MODEL_SOURCE_EXTENSIONS = ['svg', 'png', 'jpg', 'jpeg', 'webp'] as const

interface ModelSourceCandidate {
  type: string
  mimeType?: string | null
  storagePath?: string
  name?: string
}

/** Whether a library item is an image a 3D model can be created from. The saved MIME type decides; an item without one is judged by
 * its file extension. */
export function isModelSourceImage(media: ModelSourceCandidate): boolean {
  if (media.type !== 'image') return false
  const mime = media.mimeType?.toLowerCase().trim()
  if (mime) return mime === 'image/jpg' || (MODEL_SOURCE_MIME_TYPES as readonly string[]).includes(mime)
  const path = (media.storagePath ?? media.name ?? '').toLowerCase()
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : ''
  return (MODEL_SOURCE_EXTENSIONS as readonly string[]).includes(extension)
}
