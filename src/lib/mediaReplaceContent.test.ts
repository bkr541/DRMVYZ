import { beforeEach, describe, expect, it, vi } from 'vitest'
import migrationSql from '../../supabase/migrations/0033_media_replace_content.sql?raw'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { replaceMediaItemContentAtomic } from './mediaDb'

const input = {
  operationId: 'op-1',
  mediaItemId: 'media-1',
  expectedRevision: 4,
  media: {
    name: 'photo.png', type: 'image' as const, storage_path: 'user-1/uploads/op-1/original.png',
    thumbnail_path: 'user-1/uploads/op-1/original.png', width: 800, height: 600, duration_sec: null,
    file_size: 1234, mime_type: 'image/png', metadata: { hasAlpha: false },
  },
  derivatives: [],
}

const canonical = {
  id: 'media-1', user_id: 'user-1', name: 'photo.png', type: 'image', storage_path: input.media.storage_path,
  thumbnail_path: input.media.thumbnail_path, width: 800, height: 600, duration_sec: null, file_size: 1234,
  mime_type: 'image/png', favorite: true, media_role: 'overlay', title: 'Photo', description: 'Keep me',
  metadata: {}, revision: 5, tags: ['keep'], collection_ids: ['c-1'],
  created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z',
}

const cleanupJob = {
  id: 'job-1', user_id: 'user-1', media_item_id: 'media-1', upload_operation_id: null, kind: 'derivative_cleanup',
  status: 'pending', storage_paths: ['user-1/media-1/old.png'], completed_paths: [], last_error: null,
  created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
}

describe('replaceMediaItemContentAtomic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the atomic RPC with the revision guard and returns the canonical item plus its cleanup job', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', media_item: canonical, cleanup_job: cleanupJob, reconciled: false }, error: null })
    await expect(replaceMediaItemContentAtomic(input)).resolves.toEqual({ ok: true, mediaItem: canonical, cleanupJob, reconciled: false })
    expect(mocks.rpc).toHaveBeenCalledWith('replace_media_item_content_atomic', {
      p_media_item_id: 'media-1',
      p_expected_revision: 4,
      p_operation_id: 'op-1',
      p_media: input.media,
      p_derivative_paths: [],
    })
  })

  it('accepts a replace with nothing to clean up', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', media_item: canonical, cleanup_job: null, reconciled: true }, error: null })
    await expect(replaceMediaItemContentAtomic(input)).resolves.toMatchObject({ ok: true, cleanupJob: null, reconciled: true })
  })

  it('surfaces a revision conflict with the current canonical item', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'conflict', message: 'changed in another session', current_revision: 9, media_item: canonical }, error: null,
    })
    await expect(replaceMediaItemContentAtomic(input)).resolves.toMatchObject({
      ok: false, kind: 'conflict', currentRevision: 9, mediaItem: canonical,
    })
  })

  it('rejects a missing revision before contacting the server', async () => {
    await expect(replaceMediaItemContentAtomic({ ...input, expectedRevision: 0 })).resolves.toMatchObject({ ok: false, kind: 'validation' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('reports transport failures and malformed payloads instead of throwing', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '503', message: 'down' } })
    await expect(replaceMediaItemContentAtomic(input)).resolves.toMatchObject({ ok: false, kind: 'transport' })
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', media_item: { id: 'x' } }, error: null })
    await expect(replaceMediaItemContentAtomic(input)).resolves.toMatchObject({ ok: false, kind: 'unexpected' })
    mocks.rpc.mockRejectedValueOnce(new Error('offline'))
    await expect(replaceMediaItemContentAtomic(input)).resolves.toMatchObject({ ok: false, kind: 'transport', message: 'offline' })
  })
})

const sql = migrationSql.replace(/\s+/g, ' ').trim()

describe('0033 media content replacement migration contract', () => {
  it('locks the row, checks ownership, then the revision, before changing anything', () => {
    const lock = sql.indexOf('FROM public.media_items WHERE id = p_media_item_id FOR UPDATE')
    const owner = sql.indexOf('v_existing.user_id IS DISTINCT FROM v_user_id')
    const revision = sql.indexOf('v_existing.revision <> p_expected_revision')
    const update = sql.indexOf('UPDATE public.media_items SET name')
    expect(lock).toBeGreaterThan(0)
    expect(owner).toBeGreaterThan(lock)
    expect(revision).toBeGreaterThan(owner)
    expect(update).toBeGreaterThan(revision)
    expect(sql).toContain("'status', 'conflict'")
    expect(sql).toContain("'current_revision', v_existing.revision")
  })

  it('swaps only content fields: identity, organization and Deck-visible fields are never written', () => {
    const statement = sql.slice(sql.indexOf('UPDATE public.media_items SET name'), sql.indexOf('UPDATE public.media_upload_operations'))
    const update = statement.slice(0, statement.indexOf(' WHERE '))
    for (const column of ['storage_path', 'thumbnail_path', 'width', 'height', 'duration_sec', 'file_size', 'mime_type', 'metadata', 'derivative_paths']) {
      expect(update).toContain(`${column} =`)
    }
    for (const preserved of ['title', 'description', 'media_role', 'favorite', 'user_id', ' id =']) {
      expect(update).not.toContain(`${preserved} =`)
    }
    expect(sql).not.toContain('DELETE FROM public.media_item_tags')
    expect(sql).not.toContain('DELETE FROM public.media_collection_items')
  })

  it('keeps the media type fixed and binds the new path to the upload session', () => {
    expect(sql).toContain("p_media->>'type' IS DISTINCT FROM v_existing.type")
    expect(sql).toContain("p_media->>'storage_path' IS DISTINCT FROM v_operation.original_path")
    expect(sql).toContain('public.media_storage_path_is_owned(v_user_id, p_media->>\'storage_path\')')
  })

  it('is idempotent for a retried operation and refuses one bound to another item', () => {
    expect(sql).toContain('v_operation.media_item_id = p_media_item_id')
    expect(sql).toContain("'reconciled', true")
    expect(sql).toContain('already belongs to a different media item')
  })

  it('records the previous objects as a durable cleanup job in the same transaction, never touching foreign or reused paths', () => {
    expect(sql).toContain("'derivative_cleanup'")
    expect(sql).toContain('public.media_storage_path_is_owned(v_user_id, old_path)')
    expect(sql).toContain('NOT (old_path = ANY(v_new_paths))')
    expect(sql.indexOf('UPDATE public.media_items SET name')).toBeLessThan(sql.indexOf('INSERT INTO public.media_cleanup_jobs'))
    // Storage deletion itself stays outside SQL.
    expect(sql).not.toContain('storage.objects')
  })

  it('completes the upload session and rolls the whole change back on failure', () => {
    expect(sql).toContain("SET status = 'complete', phase = 'complete', media_item_id = p_media_item_id")
    expect(sql).toContain("kind = 'upload_rollback'")
    expect(sql).toContain('No partial database change was kept.')
  })

  it('is callable only by signed-in users', () => {
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) FROM PUBLIC')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) FROM anon')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.replace_media_item_content_atomic(uuid, bigint, uuid, jsonb, jsonb) TO authenticated')
  })
})
