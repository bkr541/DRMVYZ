import { AuthSessionMissingError, createClient, type User } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../types/database'
import { SupabaseModelAssetRepository, type ModelSaveInput } from './modelAssetRepository'
import { ModelAssetStorage } from './modelAssetStorage'
import { modelStoragePaths, record, MODEL_MAX_FILE_BYTES } from '../domain/modelAssetTypes'
import { assetRow, MODEL_ID, NOW, OP_ID, OP_2, recipe, stats, USER_A, USER_B, VERSION_ID } from '../__tests__/modelAssetFixtures'

type Row = Record<string, unknown>
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const failure = (code: string, message: string, status = 400) => response({ code, message }, status)

/** HTTP double behind the real Supabase SDK, not a replacement repository. SQL/RLS have a separate regression script. */
class ModelServer {
  owner: string | null = USER_A
  asset: Row = assetRow()
  operations = new Map<string, Row>()
  versions: Row[] = []
  objects = new Set<string>()
  calls: Array<{ url: URL; method: string; body: Row }> = []
  organization = { tags: [] as string[], collection_ids: [] as string[] }
  onUpload: (() => void) | null = null
  failUpload = ''
  failCleanup = false
  failCancel = false
  losePublishResponse = false
  sourceDeleted = false
  path(operation: Row) {
    return modelStoragePaths(USER_A, MODEL_ID, Number(operation.expected_version) + 1, String(operation.id), 'png', Boolean(operation.has_thumbnail))
  }
  fetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? record(JSON.parse(init.body)) : {}
    this.calls.push({ url, method, body })
    const route = url.pathname.split('/').at(-1)!
    if (url.pathname.includes('/rest/v1/rpc/')) {
      if (this.owner !== USER_A || this.asset.user_id !== USER_A) return failure('42501', 'Not owned', 403)
      if (route === 'get_model_organization') return response(this.organization)
      if (route === 'update_model_metadata') {
        if (body.p_expected_version !== this.asset.current_version) return failure('40001', 'Version conflict', 409)
        this.asset = { ...this.asset, name: body.p_name, description: body.p_description, favorite: body.p_favorite }
        this.organization = { tags: body.p_tags as string[], collection_ids: body.p_collection_ids as string[] }
        return response({ asset: this.asset, organization: this.organization })
      }
      const op = this.operations.get(String(body.p_operation_id))
      if (route === 'begin_model_version') {
        if (op) return response(op)
        if (this.asset.current_version !== body.p_expected_version) return failure('40001', 'Version conflict', 409)
        const created = { id: body.p_operation_id, model_asset_id: body.p_model_id, expected_version: body.p_expected_version, state: 'uploading',
          source_extension: body.p_source_extension, has_thumbnail: body.p_has_thumbnail, generator_recipe: body.p_recipe, geometry_stats: body.p_stats, created_at: NOW }
        this.operations.set(String(created.id), created)
        return response(created)
      }
      if (route === 'publish_model_version') {
        if (!op) return failure('42501', 'No operation', 403)
        if (op.state === 'published') return response(this.versions.find(v => v.operation_id === op.id))
        if (op.state !== 'uploading') return failure('23514', 'Cancelled')
        if (this.asset.current_version !== op.expected_version) return failure('40001', 'Version conflict', 409)
        const p = this.path(op)
        if (Object.values(p).some(path => path && !this.objects.has(path))) return failure('23514', 'Missing object')
        const version = { id: VERSION_ID, model_asset_id: MODEL_ID, version: Number(op.expected_version) + 1, operation_id: op.id,
          glb_path: p.glbPath, source_snapshot_path: p.sourceSnapshotPath, trace_svg_path: p.traceSvgPath, thumbnail_path: p.thumbnailPath,
          generator_recipe: op.generator_recipe, geometry_stats: op.geometry_stats, created_at: NOW }
        this.versions.push(version)
        op.state = 'published'
        this.asset.current_version = version.version
        this.asset.status = 'ready'
        if (this.losePublishResponse) { this.losePublishResponse = false; return failure('FETCH_ERROR', 'Response lost', 503) }
        return response(version)
      }
      if (route === 'cancel_model_version') {
        if (this.failCancel) return failure('FETCH_ERROR', 'Offline', 503)
        if (!op) return failure('42501', 'No operation', 403)
        if (op.state !== 'published') op.state = body.p_finalize ? 'cancelled' : 'cleanup_pending'
        return response(op)
      }
      if (route === 'request_model_deletion') { this.asset.status = 'deletion_pending'; return response(null) }
      if (route === 'finalize_model_deletion') {
        if (this.objects.size) return failure('23514', 'Objects remain')
        this.asset = {}; this.operations.clear(); this.versions = []
        return response(null)
      }
    }
    if (url.pathname.includes('/storage/v1/object/sign/')) return response({ signedURL: `/object/sign/model-assets/file?token=${this.calls.length}` })
    if (url.pathname.includes('/storage/v1/object/')) {
      const prefix = '/storage/v1/object/model-assets'
      if (method === 'DELETE') {
        if (this.failCleanup) return failure('503', 'Cleanup offline', 503)
        for (const path of body.prefixes as string[]) this.objects.delete(path)
        return response([])
      }
      const path = decodeURIComponent(url.pathname.slice(prefix.length + 1))
      if (path.endsWith(this.failUpload) && this.failUpload) return failure('503', 'Upload failed', 503)
      this.objects.add(path); this.onUpload?.()
      return response({ Key: `model-assets/${path}` })
    }
    if (route === 'model_assets') {
      if (this.owner !== this.asset.user_id) return failure('PGRST116', 'Not owned', 406)
      if (method === 'POST') this.asset = { ...assetRow(), ...body }
      if (method === 'PATCH') this.asset = { ...this.asset, ...body }
      if (this.sourceDeleted) this.asset.source_media_id = null
      return response(url.searchParams.has('id') || method !== 'GET' ? this.asset : [this.asset, { ...this.asset, id: VERSION_ID }])
    }
    if (route === 'model_asset_versions') {
      if (!url.searchParams.get('version')?.startsWith('eq.')) return response(this.versions.filter(v => !url.searchParams.has('version') || Number(v.version) < Number(url.searchParams.get('version')!.slice(3))).reverse())
      return response(this.versions.find(v => `eq.${v.version}` === url.searchParams.get('version')) ?? null)
    }
    if (route === 'model_version_operations') {
      const states = url.searchParams.has('state') ? ['uploading', 'cleanup_pending'] : null
      return response([...this.operations.values()].filter(op => !states || states.includes(String(op.state))))
    }
    if (route === 'model_collection_items') return response(null)
    throw new Error(`Unhandled model test request ${method} ${url}`)
  }
}

function saveInput(operationId = OP_ID, expectedVersion = 0): ModelSaveInput {
  return { modelAssetId: MODEL_ID, operationId, expectedVersion, generatorRecipe: recipe, geometryStats: stats,
    files: { glb: { data: new ArrayBuffer(24), contentType: 'model/gltf-binary' }, source: { data: new Blob(['png'], { type: 'image/png' }), contentType: 'image/png' }, trace: { data: new Blob(['<svg/>'], { type: 'image/svg+xml' }), contentType: 'image/svg+xml' } } }
}

let server: ModelServer
let repo: SupabaseModelAssetRepository
let client: ReturnType<typeof createClient<Database>>
beforeEach(() => {
  server = new ModelServer()
  client = createClient<Database>('https://model-test.example.invalid', 'anon-test-key', {
    global: { fetch: server.fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  vi.spyOn(client.auth, 'getUser').mockImplementation(async () => {
    if (!server.owner) return { data: { user: null }, error: new AuthSessionMissingError() }
    return { data: { user: { id: server.owner, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: NOW } as User }, error: null }
  })
  repo = new SupabaseModelAssetRepository(client, true)
})
afterEach(() => vi.restoreAllMocks())

describe('model repository through the Supabase SDK', () => {
  it('publishes successive immutable versions and round-trips their complete recipes', async () => {
    await repo.createDraft({ name: 'Logo' })
    const first = await repo.saveVersion(saveInput())
    const second = await repo.saveVersion(saveInput(OP_2, 1))
    expect(first.version).toBe(1); expect(second.version).toBe(2)
    expect(first.glbPath).not.toBe(second.glbPath)
    expect(await repo.getVersion(MODEL_ID, 1)).toEqual(first)
    expect((await repo.getVersion(MODEL_ID, 2)).generatorRecipe).toEqual(recipe)
    expect(server.objects.size).toBe(6)
    expect(server.calls.filter(c => c.method === 'POST' && c.url.pathname.includes('/storage/')).every(c => !c.url.searchParams.has('upsert'))).toBe(true)
  })

  it('never publishes a failed GLB upload and cleans up its entire planned file set', async () => {
    server.failUpload = 'model.glb'
    await expect(repo.saveVersion(saveInput())).rejects.toMatchObject({ kind: 'transport', operationId: OP_ID })
    expect(server.versions).toHaveLength(0)
    expect(server.operations.get(OP_ID)?.state).toBe('cancelled')
    expect(server.objects.size).toBe(0)
    expect(server.calls.some(c => c.url.pathname.endsWith('publish_model_version'))).toBe(false)
  })

  it('retains durable cleanup state on failure and supports cancellation retry', async () => {
    server.failUpload = 'source.png'; server.failCleanup = true
    await expect(repo.saveVersion(saveInput())).rejects.toMatchObject({ kind: 'cleanup_pending', operationId: OP_ID })
    expect(server.objects.size).toBe(1)
    expect(await repo.listPendingOperations()).toMatchObject([{ id: OP_ID, state: 'cleanup_pending' }])
    server.failCleanup = false
    await expect(repo.cancelSave(OP_ID)).resolves.toBeNull()
    await expect(repo.cancelSave(OP_ID)).resolves.toBeNull()
    expect(server.objects.size).toBe(0)
    expect(server.operations.get(OP_ID)?.state).toBe('cancelled')
  })

  it('reconciles a lost publish response without deleting the successful version', async () => {
    server.losePublishResponse = true
    const saved = await repo.saveVersion(saveInput())
    expect(saved.version).toBe(1)
    expect(server.objects.size).toBe(3)
    expect(server.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
    expect(await repo.retryPublish(OP_ID)).toEqual(saved)
    expect(await repo.cancelSave(OP_ID)).toEqual(saved)
  })

  it('leaves an uncertain operation recoverable when even cancellation cannot reach the server', async () => {
    server.failUpload = 'source.png'; server.failCancel = true
    await expect(repo.saveVersion(saveInput())).rejects.toMatchObject({ kind: 'cleanup_pending', operationId: OP_ID })
    expect(server.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
    server.failCancel = false
    await repo.cancelSave(OP_ID)
    expect(server.objects.size).toBe(0)
  })

  it('conflicts competing edits and removes only the losing operation files', async () => {
    const results = await Promise.allSettled([repo.saveVersion(saveInput()), repo.saveVersion(saveInput(OP_2))])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ status: 'rejected', reason: { kind: 'conflict' } })
    expect(server.versions).toHaveLength(1)
    expect(server.objects.size).toBe(3)
    const version = server.versions[0]
    expect(server.objects.has(String(version.glb_path))).toBe(true)
  })

  it('keeps deletion pending after failed cleanup and safely retries it', async () => {
    await repo.saveVersion(saveInput())
    server.failCleanup = true
    await expect(repo.delete(MODEL_ID)).rejects.toMatchObject({ kind: 'cleanup_pending' })
    expect(server.asset.status).toBe('deletion_pending')
    expect(server.versions).toHaveLength(1)
    server.failCleanup = false
    await repo.delete(MODEL_ID)
    expect(server.versions).toHaveLength(0); expect(server.objects.size).toBe(0)
  })

  it('preserves the independent source snapshot after source media deletion', async () => {
    const saved = await repo.saveVersion(saveInput())
    server.sourceDeleted = true
    expect((await repo.get(MODEL_ID)).sourceMediaId).toBeNull()
    expect((await repo.getVersion(MODEL_ID, 1)).sourceSnapshotPath).toBe(saved.sourceSnapshotPath)
    expect(server.objects.has(saved.sourceSnapshotPath)).toBe(true)
  })

  it('signs only validated owned version paths and obtains a fresh URL on each access', async () => {
    await repo.saveVersion(saveInput())
    const first = await repo.signedUrl(MODEL_ID, 1, 'glbPath')
    const second = await repo.signedUrl(MODEL_ID, 1, 'glbPath')
    expect(first.url).not.toBe(second.url)
    expect(first.expiresAt).toBeGreaterThan(Date.now())
    expect(JSON.stringify(server.versions)).not.toContain('token=')
    server.owner = USER_B
    await expect(repo.signedUrl(MODEL_ID, 1, 'glbPath')).rejects.toMatchObject({ kind: 'authorization' })
    await expect(repo.saveVersion(saveInput(OP_2, 1))).rejects.toMatchObject({ kind: 'authorization' })
    await expect(repo.update(MODEL_ID, { favorite: true })).rejects.toMatchObject({ kind: 'authorization' })
    await expect(repo.delete(MODEL_ID)).rejects.toMatchObject({ kind: 'authorization' })
    expect(server.calls.filter(c => c.url.pathname.includes('/object/sign/'))).toHaveLength(2)
  })

  it('fails explicitly for missing configuration or logged-out sessions without storage requests', async () => {
    const missing = new SupabaseModelAssetRepository(client, false)
    await expect(missing.list()).rejects.toMatchObject({ kind: 'configuration' })
    server.owner = null
    await expect(repo.createDraft({ name: 'Logo' })).rejects.toMatchObject({ kind: 'authorization' })
    expect(server.calls).toHaveLength(0)
  })

  it('sends bounded pagination, precise cursors, literal search and collection filters', async () => {
    const page = await repo.list({ limit: 1, cursor: { id: MODEL_ID, createdAt: NOW }, search: 'A_%', favorite: true, collectionId: VERSION_ID })
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toEqual({ id: MODEL_ID, createdAt: NOW })
    const params = server.calls.at(-1)!.url.searchParams
    expect(params.get('or')).toContain(NOW)
    expect(params.get('limit')).toBe('2')
    expect(params.get('name')).toBe('ilike.%A\\_\\%%')
    expect(params.get('model_collection_items.collection_id')).toBe(`eq.${VERSION_ID}`)
    await expect(repo.list({ cursor: { id: MODEL_ID, createdAt: 'invalid),id.eq.inject' } })).rejects.toMatchObject({ kind: 'validation' })
    await expect(repo.list({ limit: 101 })).rejects.toMatchObject({ kind: 'validation' })
  })

  it('updates supported metadata and collection membership through the separate model domain', async () => {
    expect(await repo.update(MODEL_ID, { name: 'New logo', favorite: true })).toMatchObject({ name: 'New logo', favorite: true })
    await repo.setCollectionMembership(MODEL_ID, VERSION_ID, true)
    await repo.setCollectionMembership(MODEL_ID, VERSION_ID, false)
    expect(server.calls.filter(c => c.url.pathname.endsWith('model_collection_items')).map(c => c.method)).toEqual(['POST', 'DELETE'])
    expect(server.calls.some(c => c.url.pathname.endsWith('/media_items'))).toBe(false)
  })

  it('rejects invalid prepared artifacts and foreign paths before making Storage calls', async () => {
    const storage = new ModelAssetStorage(client)
    const input = saveInput()
    input.files.glb.data = new ArrayBuffer(0)
    await expect(repo.saveVersion(input)).rejects.toMatchObject({ kind: 'validation' })
    expect(() => storage.validateFile({ data: new Blob([new Uint8Array(MODEL_MAX_FILE_BYTES + 1)]), contentType: 'image/png' })).toThrow()
    const path = modelStoragePaths(USER_B, MODEL_ID, 1, OP_ID, 'png', false).glbPath
    await expect(storage.sign(USER_A, MODEL_ID, path)).rejects.toMatchObject({ kind: 'validation' })
    expect(server.calls).toHaveLength(0)
  })
  it('saves owned organization atomically and checks version concurrency for metadata', async () => {
    const form = { name: 'Logo', description: 'Gold mark', favorite: true, tags: ['Logo', 'Logo'], collectionIds: [VERSION_ID] }
    expect(await repo.updateMetadata(MODEL_ID, 0, form)).toMatchObject({ favorite: true, name: 'Logo', currentVersion: 0 })
    expect(await repo.getOrganization(MODEL_ID)).toEqual({ tags: ['Logo'], collectionIds: [VERSION_ID] })
    await expect(repo.updateMetadata(MODEL_ID, 1, form)).rejects.toMatchObject({ kind: 'conflict' })
    server.owner = USER_B
    await expect(repo.getOrganization(MODEL_ID)).rejects.toMatchObject({ kind: 'authorization' })
  })
  it('loads bounded immutable version history with a version cursor', async () => {
    await repo.saveVersion(saveInput()); await repo.saveVersion(saveInput(OP_2, 1))
    expect((await repo.listVersions(MODEL_ID)).map(v => v.version)).toEqual([2, 1])
    expect((await repo.listVersions(MODEL_ID, 2)).map(v => v.version)).toEqual([1])
    expect(server.calls.at(-1)!.url.searchParams.get('limit')).toBe('50')
  })
  it('cancels after an in-flight upload and cleans staged bytes before publishing', async () => {
    const controller = new AbortController(); server.onUpload = () => controller.abort()
    await expect(repo.saveVersion({ ...saveInput(), signal: controller.signal })).rejects.toMatchObject({ kind: 'transport' })
    expect(server.versions).toHaveLength(0); expect(server.objects.size).toBe(0)
    expect(server.operations.get(OP_ID)?.state).toBe('cancelled')
  })

})
