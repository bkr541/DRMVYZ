import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import type { Database, Json } from '../../../types/database'
import {
  invalid, record, ModelAssetError, modelStoragePaths, parseModelAsset, parseModelGeometryStats,
  parseModelOperation, parseModelRecipe, parseModelVersion, text, uuid, versionNumber,
  type ModelAsset, type ModelAssetVersion, type ModelGeneratorRecipe, type ModelGeometryStats, type ModelSaveOperation,
} from '../domain/modelAssetTypes'
import { checkModelResponse, ModelAssetStorage, modelRequestError, type ModelPreparedFile } from './modelAssetStorage'

export interface ModelListCursor { createdAt: string; id: string }
export interface ModelListQuery { search?: string; favorite?: boolean; collectionId?: string; cursor?: ModelListCursor; limit?: number; includeDeletionPending?: boolean }
export interface ModelListPage { items: ModelAsset[]; nextCursor: ModelListCursor | null }
export interface ModelDraftInput { name: string; description?: string | null; sourceMediaId?: string | null; favorite?: boolean }
export interface ModelOrganization { tags: string[]; collectionIds: string[] }
export interface ModelMetadata extends ModelOrganization { name: string; description: string | null; favorite: boolean }
export interface ModelSaveInput {
  signal?: AbortSignal
  modelAssetId: string
  /** Keep this identity for reconciliation after network failure; use a new UUID after cancellation. */
  operationId: string
  expectedVersion: number
  generatorRecipe: ModelGeneratorRecipe
  geometryStats: ModelGeometryStats
  files: { glb: ModelPreparedFile; source: ModelPreparedFile; trace: ModelPreparedFile; thumbnail?: ModelPreparedFile }
}
export type ModelArtifact = 'glbPath' | 'sourceSnapshotPath' | 'traceSvgPath' | 'thumbnailPath'
export interface ModelAssetRepository {
  list(query?: ModelListQuery): Promise<ModelListPage>
  get(assetId: string): Promise<ModelAsset>
  listVersions(assetId: string, before?: number): Promise<ModelAssetVersion[]>
  getOrganization(assetId: string): Promise<ModelOrganization>
  updateMetadata(assetId: string, expectedVersion: number, metadata: ModelMetadata): Promise<ModelAsset>
  getVersion(assetId: string, version: number): Promise<ModelAssetVersion>
  createDraft(input: ModelDraftInput): Promise<ModelAsset>
  update(assetId: string, patch: Partial<Pick<ModelAsset, 'name' | 'description' | 'favorite'>>): Promise<ModelAsset>
  setCollectionMembership(assetId: string, collectionId: string, included: boolean): Promise<void>
  saveVersion(input: ModelSaveInput): Promise<ModelAssetVersion>
  retryPublish(operationId: string): Promise<ModelAssetVersion>
  cancelSave(operationId: string): Promise<ModelAssetVersion | null>
  listPendingOperations(limit?: number, offset?: number): Promise<ModelSaveOperation[]>
  delete(assetId: string): Promise<void>
  signedUrl(assetId: string, version: number, artifact: ModelArtifact): Promise<{ url: string; expiresAt: number }>
}

function json(value: ModelGeneratorRecipe | ModelGeometryStats): Json {
  // Parsers reconstruct finite, JSON-only records before they cross the DB boundary.
  return JSON.parse(JSON.stringify(value)) as Json
}
function pageSize(value = 50): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) invalid('Model page size must be between 1 and 100.')
  return value
}
function operationPaths(userId: string, operation: ModelSaveOperation): string[] {
  return Object.values(modelStoragePaths(userId, operation.modelAssetId, operation.expectedVersion + 1, operation.id, operation.sourceExtension, operation.hasThumbnail)).filter((path): path is string => path !== null)
}

export function parseModelOrganization(value: unknown): ModelOrganization {
  const v = record(value)
  if (!Array.isArray(v.tags) || v.tags.length > 32 || !Array.isArray(v.collection_ids) || v.collection_ids.length > 100) invalid('Invalid model organization.')
  return { tags: v.tags.map(t => text(t, 64)), collectionIds: v.collection_ids.map(uuid) }
}

export class SupabaseModelAssetRepository implements ModelAssetRepository {
  private readonly storage: ModelAssetStorage
  constructor(private readonly client: SupabaseClient<Database> = supabase, private readonly configured = supabaseConfigured) {
    this.storage = new ModelAssetStorage(client)
  }

  private async owner(): Promise<string> {
    if (!this.configured) throw new ModelAssetError('configuration', 'Supabase is not configured for model storage.')
    const result = await this.client.auth.getUser()
    if (result.error || !result.data.user) throw new ModelAssetError('authorization', 'Sign in to access model assets.', undefined, result.error)
    return uuid(result.data.user.id)
  }
  private async ownedAsset(id: string, userId: string): Promise<ModelAsset> {
    const data = checkModelResponse(await this.client.from('model_assets').select('*').eq('id', uuid(id)).eq('user_id', userId).single())
    const asset = parseModelAsset(data)
    if (asset.userId !== userId || asset.id !== id) throw new ModelAssetError('authorization', 'Model unavailable or not owned.')
    return asset
  }
  async get(assetId: string): Promise<ModelAsset> { return this.ownedAsset(assetId, await this.owner()) }

  async list(query: ModelListQuery = {}): Promise<ModelListPage> {
    const userId = await this.owner(), limit = pageSize(query.limit)
    let request = this.client.from('model_assets')
      .select(query.collectionId ? '*, model_collection_items!inner(collection_id)' : '*')
      .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1)
    if (!query.includeDeletionPending) request = request.neq('status', 'deletion_pending')
    if (query.favorite !== undefined) request = request.eq('favorite', query.favorite)
    if (query.collectionId) request = request.eq('model_collection_items.collection_id', uuid(query.collectionId))
    if (query.search?.trim()) request = request.ilike('name', `%${text(query.search, 200).replace(/[\\%_]/g, '\\$&')}%`)
    if (query.cursor) {
      const id = uuid(query.cursor.id), stamp = query.cursor.createdAt
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) || !Number.isFinite(Date.parse(stamp))) invalid('Invalid model page cursor.')
      request = request.or(`created_at.lt.${stamp},and(created_at.eq.${stamp},id.lt.${id})`)
    }
    const rows = checkModelResponse(await request) ?? []
    const assets = rows.map(parseModelAsset)
    if (assets.some(a => a.userId !== userId)) throw new ModelAssetError('authorization', 'Foreign model in query response.')
    const items = assets.slice(0, limit), last = items.at(-1)
    return { items, nextCursor: assets.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null }
  }

  async getVersion(assetId: string, version: number): Promise<ModelAssetVersion> {
    const owner = await this.owner()
    await this.ownedAsset(assetId, owner)
    return this.readVersion(assetId, version, owner)
  }
  private async readVersion(assetId: string, version: number, owner: string): Promise<ModelAssetVersion> {
    const result = parseModelVersion(checkModelResponse(await this.client.from('model_asset_versions').select('*')
      .eq('model_asset_id', uuid(assetId)).eq('version', versionNumber(version, 1)).single()), owner)
    if (result.modelAssetId !== assetId || result.version !== version) invalid('Model version identity mismatch.')
    return result
  }

  async listVersions(assetId: string, before?: number): Promise<ModelAssetVersion[]> {
    const owner = await this.owner(); await this.ownedAsset(assetId, owner)
    let request = this.client.from('model_asset_versions').select('*').eq('model_asset_id', uuid(assetId)).order('version', { ascending: false }).limit(50)
    if (before !== undefined) request = request.lt('version', versionNumber(before, 1))
    const versions = (checkModelResponse(await request) ?? []).map(row => parseModelVersion(row, owner))
    if (versions.some(version => version.modelAssetId !== assetId)) invalid('Model version history identity mismatch.')
    return versions
  }
  async getOrganization(assetId: string): Promise<ModelOrganization> {
    await this.owner()
    return parseModelOrganization(checkModelResponse(await this.client.rpc('get_model_organization', { p_model_id: uuid(assetId) })))
  }
  async updateMetadata(assetId: string, expectedVersion: number, metadata: ModelMetadata): Promise<ModelAsset> {
    const owner = await this.owner()
    const org = parseModelOrganization({ tags: metadata.tags, collection_ids: metadata.collectionIds })
    if (typeof metadata.favorite !== 'boolean') invalid('Invalid favorite value.')
    const result = record(checkModelResponse(await this.client.rpc('update_model_metadata', {
      p_model_id: uuid(assetId), p_expected_version: versionNumber(expectedVersion), p_name: text(metadata.name).trim(),
      p_description: metadata.description ? text(metadata.description, 4000) : null, p_favorite: metadata.favorite,
      p_tags: [...new Set(org.tags.map(t => t.trim()))], p_collection_ids: [...new Set(org.collectionIds)],
    })))
    const asset = parseModelAsset(result.asset)
    if (asset.id !== assetId || asset.userId !== owner) throw new ModelAssetError('authorization', 'Model metadata ownership mismatch.')
    return asset
  }

  async createDraft(input: ModelDraftInput): Promise<ModelAsset> {
    const userId = await this.owner()
    if (input.favorite !== undefined && typeof input.favorite !== 'boolean') invalid('Invalid favorite value.')
    const data = checkModelResponse(await this.client.from('model_assets').insert({
      user_id: userId, name: text(input.name).trim(), description: input.description ? text(input.description, 4000) : null,
      source_media_id: input.sourceMediaId ? uuid(input.sourceMediaId) : null, favorite: input.favorite ?? false,
    }).select('*').single())
    const asset = parseModelAsset(data)
    if (asset.userId !== userId) throw new ModelAssetError('authorization', 'Foreign model in create response.')
    return asset
  }
  async update(assetId: string, patch: Partial<Pick<ModelAsset, 'name' | 'description' | 'favorite'>>): Promise<ModelAsset> {
    const owner = await this.owner()
    const clean: { name?: string; description?: string | null; favorite?: boolean } = {}
    if (patch.name !== undefined) clean.name = text(patch.name).trim()
    if (patch.description !== undefined) clean.description = patch.description === null ? null : text(patch.description, 4000)
    if (patch.favorite !== undefined) {
      if (typeof patch.favorite !== 'boolean') invalid('Invalid favorite value.')
      clean.favorite = patch.favorite
    }
    if (!Object.keys(clean).length) invalid('No supported model metadata changes.')
    const result = parseModelAsset(checkModelResponse(await this.client.from('model_assets').update(clean).eq('id', uuid(assetId)).eq('user_id', owner).select('*').single()))
    if (result.userId !== owner || result.id !== assetId) throw new ModelAssetError('authorization', 'Foreign model in update response.')
    return result
  }

  async setCollectionMembership(assetId: string, collectionId: string, included: boolean): Promise<void> {
    const owner = await this.owner()
    await this.ownedAsset(assetId, owner)
    uuid(collectionId)
    if (included) {
      // ON CONFLICT DO NOTHING needs no UPDATE privilege and makes retries safe.
      checkModelResponse(await this.client.from('model_collection_items').upsert({ model_asset_id: assetId, collection_id: collectionId }, { onConflict: 'collection_id,model_asset_id', ignoreDuplicates: true }))
    } else {
      checkModelResponse(await this.client.from('model_collection_items').delete().eq('model_asset_id', assetId).eq('collection_id', collectionId))
    }
  }

  async saveVersion(input: ModelSaveInput): Promise<ModelAssetVersion> {
    const owner = await this.owner()
    const checkCancelled = () => { if (input.signal?.aborted) throw new ModelAssetError('transport', 'Model save cancelled.', input.operationId) }
    checkCancelled()
    uuid(input.operationId); uuid(input.modelAssetId); versionNumber(input.expectedVersion)
    const recipe = parseModelRecipe(input.generatorRecipe), stats = parseModelGeometryStats(input.geometryStats)
    const { files } = input
    const sourceExtension = files.source.contentType === 'image/png' ? 'png' : files.source.contentType === 'image/svg+xml' ? 'svg' : invalid('Source snapshot must be PNG or SVG.')
    if (files.glb.contentType !== 'model/gltf-binary' || files.trace.contentType !== 'image/svg+xml' || (files.thumbnail && files.thumbnail.contentType !== 'image/png')) invalid('Model artifact MIME types do not match their roles.')
    Object.values(files).forEach(file => this.storage.validateFile(file))
    const operation = parseModelOperation(checkModelResponse(await this.client.rpc('begin_model_version', {
      p_model_id: input.modelAssetId, p_operation_id: input.operationId, p_expected_version: input.expectedVersion,
      p_source_extension: sourceExtension, p_has_thumbnail: Boolean(files.thumbnail), p_recipe: json(recipe), p_stats: json(stats),
    })))
    if (operation.id !== input.operationId || operation.modelAssetId !== input.modelAssetId) invalid('Model save operation identity mismatch.')
    if (operation.state === 'published') return this.readVersion(operation.modelAssetId, operation.expectedVersion + 1, owner)
    if (operation.state !== 'uploading') throw new ModelAssetError('conflict', 'Save was cancelled; start a new save operation.', operation.id)
    const paths = modelStoragePaths(owner, operation.modelAssetId, operation.expectedVersion + 1, operation.id, sourceExtension, Boolean(files.thumbnail))
    try {
      checkCancelled()
      await this.storage.upload(owner, operation.modelAssetId, paths.glbPath, files.glb)
      checkCancelled()
      await this.storage.upload(owner, operation.modelAssetId, paths.sourceSnapshotPath, files.source)
      checkCancelled()
      await this.storage.upload(owner, operation.modelAssetId, paths.traceSvgPath, files.trace)
      checkCancelled()
      if (paths.thumbnailPath && files.thumbnail) await this.storage.upload(owner, operation.modelAssetId, paths.thumbnailPath, files.thumbnail)
      checkCancelled()
      return await this.retryPublish(operation.id)
    } catch (error) {
      // Never remove files until the DB has confirmed this operation did not publish.
      try {
        const published = await this.cancelSave(operation.id)
        if (published) return published
      } catch (cleanupError) {
        throw new ModelAssetError('cleanup_pending', 'Model save needs reconciliation. Retry publication or cancellation with this operation ID.', operation.id, { error, cleanupError })
      }
      const failure = modelRequestError(error)
      throw new ModelAssetError(failure.kind, failure.message, operation.id, error)
    }
  }

  async retryPublish(operationId: string): Promise<ModelAssetVersion> {
    const owner = await this.owner()
    const version = parseModelVersion(checkModelResponse(await this.client.rpc('publish_model_version', { p_operation_id: uuid(operationId) })), owner)
    if (version.operationId !== operationId) invalid('Published operation identity mismatch.')
    return version
  }

  async cancelSave(operationId: string): Promise<ModelAssetVersion | null> {
    const owner = await this.owner()
    const operation = parseModelOperation(checkModelResponse(await this.client.rpc('cancel_model_version', { p_operation_id: uuid(operationId) })))
    if (operation.id !== operationId) invalid('Cancelled operation identity mismatch.')
    if (operation.state === 'published') return this.readVersion(operation.modelAssetId, operation.expectedVersion + 1, owner)
    if (operation.state === 'cancelled') return null
    try {
      await this.storage.remove(owner, operation.modelAssetId, operationPaths(owner, operation))
      checkModelResponse(await this.client.rpc('cancel_model_version', { p_operation_id: operationId, p_finalize: true }))
    } catch (error) { throw new ModelAssetError('cleanup_pending', 'Model upload cleanup is pending; retry cancellation.', operationId, error) }
    return null
  }

  async listPendingOperations(limit = 50, offset = 0): Promise<ModelSaveOperation[]> {
    const owner = await this.owner()
    if (!Number.isSafeInteger(offset) || offset < 0) invalid('Invalid recovery page offset.')
    return (checkModelResponse(await this.client.from('model_version_operations').select('*, model_assets!inner(user_id)')
      .eq('model_assets.user_id', owner).in('state', ['uploading', 'cleanup_pending'])
      .order('created_at').order('id').range(offset, offset + pageSize(limit) - 1)) ?? []).map(parseModelOperation)
  }

  async delete(assetId: string): Promise<void> {
    const owner = await this.owner()
    uuid(assetId)
    // Tombstone first; new saves/uploads are now rejected. This method is retryable.
    checkModelResponse(await this.client.rpc('request_model_deletion', { p_model_id: assetId }))
    try {
      let offset = 0
      while (true) {
        const operations = (checkModelResponse(await this.client.from('model_version_operations').select('*')
          .eq('model_asset_id', assetId).order('id').range(offset, offset + 99)) ?? []).map(parseModelOperation)
        for (const operation of operations) await this.storage.remove(owner, assetId, operationPaths(owner, operation))
        if (operations.length < 100) break
        offset += 100
      }
      checkModelResponse(await this.client.rpc('finalize_model_deletion', { p_model_id: assetId }))
    } catch (error) { throw new ModelAssetError('cleanup_pending', 'Model deletion is pending; retry deletion to finish file cleanup.', undefined, error) }
  }

  async signedUrl(assetId: string, version: number, artifact: ModelArtifact): Promise<{ url: string; expiresAt: number }> {
    const owner = await this.owner(), asset = await this.ownedAsset(assetId, owner)
    if (asset.status === 'deletion_pending') throw new ModelAssetError('validation', 'Model deletion is pending.')
    if (!['glbPath', 'sourceSnapshotPath', 'traceSvgPath', 'thumbnailPath'].includes(artifact)) invalid('Unknown model artifact.')
    const modelVersion = await this.readVersion(assetId, version, owner), path = modelVersion[artifact]
    if (!path) throw new ModelAssetError('validation', 'Model artifact is unavailable.')
    return this.storage.sign(owner, assetId, path)
  }
}

export const modelAssetRepository: ModelAssetRepository = new SupabaseModelAssetRepository()
