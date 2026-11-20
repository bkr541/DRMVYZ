import { Mesh, type Texture } from 'three'
import { decodeModelPreview } from '../data/loadModelPreview'
import { modelAssetRepository, type ModelAssetRepository } from '../data/modelAssetRepository'
import { MODEL_MAX_FILE_BYTES, ModelAssetError, parseModelGeometryStats, text, type ModelAsset, type ModelGeometryStats } from '../domain/modelAssetTypes'
import { renderModelThumbnail } from '../export/renderModelThumbnail'
import { assertImageBudget, isGlbFile, MODEL_IMPORT_LIMITS, scanGlbContainer } from './glbContainer'

/** A GLB that has been fully checked and is ready to store: the original bytes, what was measured, and a thumbnail when one could be drawn. */
export interface GlbInspection {
  fileName: string
  bytes: ArrayBuffer
  stats: ModelGeometryStats
  thumbnail: Blob | null
  /** Things worth telling the user that do not stop the import (no thumbnail, animations that will not play). */
  warnings: string[]
}

/**
 * Validates a local GLB the way the saved-model loader will read it: container and budgets first (nothing is decoded until those pass),
 * then a real decode for geometry and texture checks, then a thumbnail. The decoded model is always released before this returns.
 */
export async function inspectGlbFile(file: File, signal: AbortSignal): Promise<GlbInspection> {
  if (!isGlbFile(file)) throw new Error('Only .glb files can be imported as 3D models.')
  if (file.size < 1) throw new Error('This file is empty.')
  if (file.size > MODEL_MAX_FILE_BYTES) throw new Error(`This file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MODEL_MAX_FILE_BYTES / 1048576} MB.`)
  const bytes = await file.arrayBuffer()
  if (signal.aborted) throw new DOMException('Import cancelled.', 'AbortError')
  const container = scanGlbContainer(bytes)
  assertImageBudget(container.images)
  const decoded = await decodeModelPreview(bytes, signal)
  try {
    // Formats whose size could not be read from the header (WebP, for one) are measured here, on the decoded images.
    const textures = new Set<Texture>(), materials = new Set<import('three').Material>()
    decoded.group.traverse(object => { if (object instanceof Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)) })
    materials.forEach(material => { for (const value of Object.values(material)) if (value && (value as Texture).isTexture) textures.add(value as Texture) })
    const measured = [...textures].map(texture => texture.image as { width?: number; height?: number } | null)
    assertImageBudget(measured.map(image => ({ mimeType: null, width: image?.width ?? null, height: image?.height ?? null })))
    if (materials.size > 128) throw new Error(`This model has ${materials.size} materials; the limit is 128.`)
    const known = assertImageBudget(container.images)
    const stats = parseModelGeometryStats({
      ...decoded.stats, glbBytes: bytes.byteLength, ...(materials.size ? { materialCount: materials.size } : {}),
      imported: { fileName: file.name.slice(0, 300), imageCount: container.images.length, maxImageSide: Math.max(known.maxSide, ...measured.map(image => Math.max(image?.width ?? 0, image?.height ?? 0))) },
    })
    const warnings: string[] = []
    if (decoded.animations > 0) warnings.push('This model has animations. They are kept in the file, but the viewer shows it as a still model.')
    let thumbnail: Blob | null = null
    try { thumbnail = await renderModelThumbnail(decoded.group, 256, signal) }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      warnings.push('A thumbnail could not be drawn, so the library card will show a placeholder.')
    }
    return { fileName: file.name, bytes, stats, thumbnail, warnings }
  } finally { decoded.dispose() }
}

export interface GlbImportMetadata { name: string; description?: string | null; tags?: string[]; collectionIds?: string[]; favorite?: boolean }

/**
 * Stores an inspected GLB as an imported model: a draft record, one immutable version holding the original bytes (and thumbnail), then the
 * title, tags and collections. If any step fails the half-made record is removed again so it cannot linger as an empty draft.
 */
export async function importGlbModel(
  inspection: GlbInspection, metadata: GlbImportMetadata, options: { signal?: AbortSignal; repository?: ModelAssetRepository } = {},
): Promise<ModelAsset> {
  const repository = options.repository ?? modelAssetRepository
  const name = text(metadata.name).trim()
  const draft = await repository.createDraft({ name, description: metadata.description ?? null, favorite: metadata.favorite ?? false, kind: 'imported' })
  try {
    const published = await repository.saveVersion({
      modelAssetId: draft.id, operationId: crypto.randomUUID(), expectedVersion: 0, generatorRecipe: null, geometryStats: inspection.stats, signal: options.signal,
      files: {
        glb: { data: inspection.bytes, contentType: 'model/gltf-binary' },
        ...(inspection.thumbnail ? { thumbnail: { data: inspection.thumbnail, contentType: 'image/png' as const } } : {}),
      },
    })
    return await repository.updateMetadata(draft.id, published.version, {
      name, description: metadata.description ?? null, favorite: metadata.favorite ?? false,
      tags: [...new Set((metadata.tags ?? []).map(tag => tag.trim()).filter(Boolean))], collectionIds: [...new Set(metadata.collectionIds ?? [])],
    })
  } catch (error) {
    try { await repository.delete(draft.id) } catch { /* A cleanup-pending draft is finished by retrying the delete from the library. */ }
    throw error instanceof ModelAssetError || error instanceof Error ? error : new Error('The model could not be imported.')
  }
}

export { MODEL_IMPORT_LIMITS }
