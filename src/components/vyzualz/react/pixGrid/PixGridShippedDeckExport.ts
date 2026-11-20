import type { PixGridDeckDefinition } from './PixGridDeckDomain'
import {
  PIX_GRID_SHIPPED_DECK_MAX_IMAGE_SIDE,
  PIX_GRID_SHIPPED_DECK_PATH_PREFIX,
  PIX_GRID_SHIPPED_DECK_SCHEMA_VERSION,
  pixGridShippedSequenceId,
  validatePixGridShippedDeckManifest,
  type PixGridShippedDeckManifest,
  type PixGridShippedDeckSource,
} from './PixGridShippedDecks'

/** Where an exported Deck goes, relative to the repository root. */
export const PIX_GRID_SHIPPED_MANIFEST_DIRECTORY = 'src/components/vyzualz/react/pixGrid/shippedDecks'
export const PIX_GRID_SHIPPED_IMAGE_DIRECTORY = `public/${PIX_GRID_SHIPPED_DECK_PATH_PREFIX.replace(/\/$/, '')}`

const EXTENSIONS: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

export interface PixGridPreparedShippedImage {
  bytes: Uint8Array
  mimeType: string
  width: number | null
  height: number | null
  hasAlpha: boolean
  fingerprint: string
  fileName: string
}

export interface PixGridShippedDeckWriter {
  write(path: string, data: Uint8Array | string): Promise<void>
}

/** Lowercase letters, digits and hyphens, at most 48 characters, never empty. */
export function pixGridShippedDeckSlug(name: string): string {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '')
  return slug || 'deck'
}

export async function sha256Fingerprint(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

/** The longest side after shrinking to the shipped limit (never enlarged). */
export function pixGridShippedImageSize(width: number, height: number, limit = PIX_GRID_SHIPPED_DECK_MAX_IMAGE_SIDE): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height)
  if (longest <= limit) return { width, height, resized: false }
  const scale = limit / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), resized: true }
}

/**
 * A Deck image at shipping size. The compiler turns every image into at most 256 x 144 cells, so 512 px on the long side is plenty: larger files
 * are shrunk (PNG when they have transparency, lossless-quality WebP otherwise), smaller ones and SVGs ship unchanged.
 */
export async function preparePixGridShippedImage(file: File, hasAlpha: boolean): Promise<PixGridPreparedShippedImage> {
  const mimeType = file.type
  if (!EXTENSIONS[mimeType]) throw new Error(`"${file.name}" is not a supported Deck image type.`)
  const original = new Uint8Array(await file.arrayBuffer())
  if (mimeType === 'image/svg+xml') {
    return { bytes: original, mimeType, width: null, height: null, hasAlpha: true, fingerprint: await sha256Fingerprint(original), fileName: file.name }
  }
  const bitmap = await createImageBitmap(file)
  try {
    const size = pixGridShippedImageSize(bitmap.width, bitmap.height)
    if (!size.resized) {
      return { bytes: original, mimeType, width: bitmap.width, height: bitmap.height, hasAlpha, fingerprint: await sha256Fingerprint(original), fileName: file.name }
    }
    const canvas = new OffscreenCanvas(size.width, size.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A 2D canvas is required to resize Deck images.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const outputType = hasAlpha ? 'image/png' : 'image/webp'
    const blob = await canvas.convertToBlob(outputType === 'image/webp' ? { type: outputType, quality: 0.92 } : { type: outputType })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const extension = EXTENSIONS[outputType]
    return { bytes, mimeType: outputType, width: size.width, height: size.height, hasAlpha, fingerprint: await sha256Fingerprint(bytes), fileName: file.name.replace(/\.[^.]+$/, '') + `.${extension}` }
  } finally {
    bitmap.close()
  }
}

/**
 * The manifest for an exported Deck. One source per distinct image (a duplicated occurrence shares its source), items keep their ids, so section
 * assignments and pair overrides stay valid, and per-section motion keys are re-pointed at the shipped scene ids.
 */
export function buildPixGridShippedDeckManifest(input: {
  deck: PixGridDeckDefinition
  slug: string
  description?: string
  revision?: number
  /** Prepared image for each media id used by the Deck. */
  images: ReadonlyMap<string, PixGridPreparedShippedImage>
}): PixGridShippedDeckManifest {
  const { deck, slug, images } = input
  const sourceByMedia = new Map<string, PixGridShippedDeckSource>()
  const items = [...deck.items].sort((left, right) => left.order - right.order).map(item => {
    let source = sourceByMedia.get(item.mediaId)
    if (!source) {
      const image = images.get(item.mediaId)
      if (!image) throw new Error(`Image for "${item.source.fileName ?? item.id}" was not prepared.`)
      const index = sourceByMedia.size + 1
      const extension = EXTENSIONS[image.mimeType]
      source = {
        id: `source-${String(index).padStart(2, '0')}`,
        path: `${PIX_GRID_SHIPPED_DECK_PATH_PREFIX}${slug}/${String(index).padStart(2, '0')}.${extension}`,
        mimeType: image.mimeType, fileName: image.fileName, width: image.width, height: image.height, hasAlpha: image.hasAlpha, fingerprint: image.fingerprint,
      }
      sourceByMedia.set(item.mediaId, source)
    }
    return { id: item.id, sourceId: source.id, enabled: item.enabled, durationBeats: item.timingOverrideBeats }
  })
  const configuration = deck.configuration
  const sceneKeyPrefix = `pix-grid-deck-scene:${deck.id}:`
  const shippedScenePrefix = `pix-grid-deck-scene:pix-grid-sequence:${pixGridShippedSequenceId(slug)}:`
  const sceneMotionProfileIds = Object.fromEntries(Object.entries(configuration.sceneMotionProfileIds ?? {}).flatMap(([key, value]) => (
    key.startsWith(sceneKeyPrefix) ? [[`${shippedScenePrefix}${key.slice(sceneKeyPrefix.length)}`, value]] : []
  )))
  const manifest: PixGridShippedDeckManifest = {
    schemaVersion: PIX_GRID_SHIPPED_DECK_SCHEMA_VERSION,
    slug,
    name: deck.name,
    ...(input.description ? { description: input.description } : {}),
    revision: input.revision ?? 1,
    sources: [...sourceByMedia.values()],
    items,
    configuration: {
      playbackOrder: configuration.playbackOrder,
      loop: configuration.loop,
      defaultItemDurationBeats: configuration.defaultItemDurationBeats,
      sectionTimingBeats: configuration.sectionTimingBeats,
      sectionItemAssignments: configuration.sectionItemAssignments,
      transitionPolicy: configuration.transitionPolicy,
      reactionProfileId: configuration.reactionProfileId,
      preDropBehavior: configuration.preDropBehavior,
      motionProfileId: configuration.motionProfileId ?? 'balanced',
      sceneMotionProfileIds,
    },
  }
  const checked = validatePixGridShippedDeckManifest(manifest)
  if (!checked.ok) throw new Error(`The exported Deck is not valid: ${checked.error}`)
  return manifest
}

/** Prepares every image, then writes the images and the manifest. Nothing is written if any image fails to prepare. */
export async function exportPixGridShippedDeck(input: {
  deck: PixGridDeckDefinition
  /** The validated source file for each media id used by the Deck. */
  files: ReadonlyMap<string, File>
  writer: PixGridShippedDeckWriter
  slug?: string
  description?: string
  revision?: number
}): Promise<{ slug: string; manifestPath: string; imagePaths: string[] }> {
  const slug = input.slug ?? pixGridShippedDeckSlug(input.deck.name)
  const images = new Map<string, PixGridPreparedShippedImage>()
  for (const item of input.deck.items) {
    if (images.has(item.mediaId)) continue
    const file = input.files.get(item.mediaId)
    if (!file) throw new Error(`The source for "${item.source.fileName ?? item.id}" is not available.`)
    images.set(item.mediaId, await preparePixGridShippedImage(file, item.source.hasAlpha))
  }
  const manifest = buildPixGridShippedDeckManifest({ deck: input.deck, slug, description: input.description, revision: input.revision, images })
  const imagePaths: string[] = []
  for (const source of manifest.sources) {
    const mediaId = [...images.keys()].find(key => images.get(key)!.fingerprint === source.fingerprint)!
    const path = `public/${source.path}`
    await input.writer.write(path, images.get(mediaId)!.bytes)
    imagePaths.push(path)
  }
  const manifestPath = `${PIX_GRID_SHIPPED_MANIFEST_DIRECTORY}/${slug}.json`
  await input.writer.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { slug, manifestPath, imagePaths }
}

/** Writes into a directory the user picked (the repository root) using the File System Access API. */
export function createDirectoryHandleWriter(root: FileSystemDirectoryHandle): PixGridShippedDeckWriter {
  return {
    async write(path, data) {
      const parts = path.split('/').filter(Boolean)
      const fileName = parts.pop()
      if (!fileName || parts.some(part => part === '..' || part === '.')) throw new Error(`Refusing to write "${path}".`)
      let directory = root
      for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true })
      const handle = await directory.getFileHandle(fileName, { create: true })
      const writable = await handle.createWritable()
      await writable.write(data as FileSystemWriteChunkType)
      await writable.close()
    },
  }
}
