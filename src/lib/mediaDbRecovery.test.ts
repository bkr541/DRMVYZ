import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    rpc: mocks.rpc,
    storage: {
      from: vi.fn(() => ({ list: mocks.list, upload: mocks.upload, remove: mocks.remove })),
    },
  },
}))

import {
  beginMediaUpload,
  finalizeMediaUploadAtomic,
  requestMediaDeletion,
  updateMediaCleanupJob,
  uploadMediaFile,
} from './mediaDb'

const canonical = {
  id: 'media-1', user_id: 'user-1', name: 'clip.mp4', type: 'video',
  storage_path: 'user-1/uploads/op-1/original.mp4', thumbnail_path: 'user-1/uploads/op-1/thumbnail.jpg',
  width: 1920, height: 1080, duration_sec: 8, file_size: 100, mime_type: 'video/mp4',
  favorite: false, media_role: 'loop', title: 'Clip', description: null,
  metadata: {}, revision: 1, upload_operation_id: 'op-1', lifecycle_status: 'complete',
  derivative_paths: [{ kind: 'thumbnail', path: 'user-1/uploads/op-1/thumbnail.jpg', required: false, status: 'ready' as const }],
  created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z',
  tags: ['live'], collection_ids: ['collection-1'],
}

const cleanupJob = {
  id: 'cleanup-1', user_id: 'user-1', media_item_id: 'media-1', upload_operation_id: 'op-1',
  kind: 'media_deletion', status: 'pending',
  storage_paths: ['user-1/uploads/op-1/original.mp4', 'user-1/uploads/op-1/thumbnail.jpg'],
  completed_paths: [], last_error: null,
  created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
}

describe('mediaDb recoverable upload and deletion envelopes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({ data: [], error: null })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.remove.mockResolvedValue({ error: null })
  })

  it('reconciles an already-created canonical row after an ambiguous upload response', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'success', operation_status: 'complete', phase: 'complete', media_item: canonical },
      error: null,
    })

    await expect(beginMediaUpload('op-1', canonical.storage_path, canonical.derivative_paths)).resolves.toEqual({
      ok: true, operationStatus: 'complete', phase: 'complete', mediaItem: canonical,
    })
  })

  it('sends record, role, tags, collections, and derivative truth through one finalization RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', media_item: canonical, reconciled: false }, error: null })
    const input = {
      operationId: 'op-1',
      media: {
        name: 'clip.mp4', type: 'video' as const, storage_path: canonical.storage_path,
        thumbnail_path: canonical.thumbnail_path, width: 1920, height: 1080, duration_sec: 8,
        file_size: 100, mime_type: 'video/mp4', favorite: false, media_role: 'loop' as const,
        title: 'Clip', description: null, metadata: {},
      },
      tagNames: ['live'], collectionIds: ['collection-1'], derivatives: canonical.derivative_paths,
    }

    await expect(finalizeMediaUploadAtomic(input)).resolves.toEqual({ ok: true, mediaItem: canonical, reconciled: false })
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_media_upload_atomic', {
      p_operation_id: 'op-1', p_media: input.media, p_tag_names: ['live'],
      p_collection_ids: ['collection-1'], p_derivative_paths: canonical.derivative_paths,
    })
  })

  it('does not report a relationship validation failure as upload success', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'validation_failure', message: 'One or more selected collections are unavailable.' }, error: null,
    })

    await expect(finalizeMediaUploadAtomic({
      operationId: 'op-1',
      media: {
        name: 'clip.mp4', type: 'video', storage_path: canonical.storage_path,
        thumbnail_path: canonical.thumbnail_path, width: null, height: null, duration_sec: null,
        file_size: null, mime_type: 'video/mp4', favorite: false, media_role: 'loop',
        title: null, description: null, metadata: {},
      },
      tagNames: [], collectionIds: ['foreign'], derivatives: canonical.derivative_paths,
    })).resolves.toMatchObject({ ok: false, kind: 'validation' })
  })

  it('reuses an exact existing storage object instead of blindly uploading it again', async () => {
    mocks.list.mockResolvedValueOnce({ data: [{ name: 'original.mp4' }], error: null })

    await expect(uploadMediaFile(canonical.storage_path, new Blob(['x']), 'video/mp4')).resolves.toEqual({ error: null, reused: true })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('reconciles a duplicate upload race by checking the exact object', async () => {
    mocks.list
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ name: 'original.mp4' }], error: null })
    mocks.upload.mockResolvedValueOnce({ error: { message: 'The resource already exists' } })

    await expect(uploadMediaFile(canonical.storage_path, new Blob(['x']), 'video/mp4')).resolves.toEqual({ error: null, reused: true })
  })

  it('returns durable exact-path deletion cleanup and rejects malformed progress responses', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { status: 'success', cleanup_job: cleanupJob, reconciled: false }, error: null })
      .mockResolvedValueOnce({ data: { status: 'success', cleanup_job: { id: 'bad' } }, error: null })

    await expect(requestMediaDeletion('media-1')).resolves.toEqual({ ok: true, cleanupJob, reconciled: false })
    await expect(updateMediaCleanupJob('cleanup-1', [canonical.storage_path], 'pending')).resolves.toMatchObject({
      ok: false, kind: 'unexpected',
    })
  })

  it('does not turn a successful upload into failure when the existence preflight was unavailable', async () => {
    mocks.list.mockResolvedValueOnce({ data: null, error: { message: 'list unavailable' } })
    mocks.upload.mockResolvedValueOnce({ error: null })

    await expect(uploadMediaFile(canonical.storage_path, new Blob(['x']), 'video/mp4')).resolves.toEqual({ error: null, reused: false })
  })

})
