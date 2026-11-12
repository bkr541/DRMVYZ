import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { assertOwnedModelPath, invalid, MODEL_MAX_FILE_BYTES, ModelAssetError } from '../domain/modelAssetTypes'

export const MODEL_ASSET_BUCKET = 'model-assets'
export type ModelPreparedFile = { data: Blob | ArrayBuffer; contentType: 'model/gltf-binary' | 'image/png' | 'image/svg+xml' }

export function modelRequestError(error: unknown): ModelAssetError {
  if (error instanceof ModelAssetError) return error
  const e = error && typeof error === 'object' ? error as { code?: string; status?: number | string; statusCode?: number | string; message?: string } : {}
  const code = e.code ?? String(e.statusCode ?? e.status ?? '')
  const kind = code === '40001' || code === '23505' ? 'conflict' : ['42501', '401', '403', 'PGRST116'].includes(code) ? 'authorization' : ['23514', '23503', '22P02'].includes(code) ? 'validation' : 'transport'
  return new ModelAssetError(kind, e.message ?? 'Model persistence request failed.', undefined, error)
}
export function checkModelResponse<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw modelRequestError(result.error)
  return result.data
}

/** Stores only prepared artifacts. SVG sanitization and mesh generation belong to Phase 02. */
export class ModelAssetStorage {
  constructor(private readonly client: SupabaseClient<Database>) {}

  validateFile(file: ModelPreparedFile): void {
    const bytes = file.data instanceof ArrayBuffer ? file.data.byteLength : file.data.size
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > MODEL_MAX_FILE_BYTES) invalid('Model file exceeds the 64 MiB budget or is empty.')
    if (!['model/gltf-binary', 'image/png', 'image/svg+xml'].includes(file.contentType)) invalid('Unsupported model file MIME type.')
    if (file.data instanceof Blob && file.data.type && file.data.type !== file.contentType) invalid('Model blob MIME type does not match its artifact.')
  }

  async upload(userId: string, modelId: string, path: string, file: ModelPreparedFile): Promise<void> {
    assertOwnedModelPath(path, userId, modelId)
    this.validateFile(file)
    const response = await this.client.storage.from(MODEL_ASSET_BUCKET).upload(path, file.data, { contentType: file.contentType, upsert: false })
    checkModelResponse(response)
  }

  async remove(userId: string, modelId: string, paths: string[]): Promise<void> {
    paths.forEach(path => assertOwnedModelPath(path, userId, modelId))
    for (let index = 0; index < paths.length; index += 100) {
      checkModelResponse(await this.client.storage.from(MODEL_ASSET_BUCKET).remove(paths.slice(index, index + 100)))
    }
  }

  async sign(userId: string, modelId: string, path: string): Promise<{ url: string; expiresAt: number }> {
    assertOwnedModelPath(path, userId, modelId)
    // No URL cache or persistence: every access obtains a fresh short-lived URL.
    const issuedAt = Date.now()
    const data = checkModelResponse(await this.client.storage.from(MODEL_ASSET_BUCKET).createSignedUrl(path, 300))
    if (!data?.signedUrl) throw new ModelAssetError('transport', 'Model URL signing returned no URL.')
    return { url: data.signedUrl, expiresAt: issuedAt + 300_000 }
  }
}
