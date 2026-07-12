import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { listMediaItemsPage } from './mediaDb'

const canonical = (id: string, createdAt = '2026-07-11T00:00:00.000Z') => ({
  id, user_id: 'user-1', name: `${id}.png`, type: 'image', storage_path: `user-1/${id}/image.png`,
  thumbnail_path: null, width: 100, height: 100, duration_sec: null, file_size: 1, mime_type: 'image/png',
  favorite: false, media_role: 'other', title: id, description: null, metadata: {}, revision: 1,
  lifecycle_status: 'complete', upload_operation_id: null, derivative_paths: [],
  created_at: createdAt, updated_at: createdAt, tags: [], collection_ids: [],
})

describe('media library page RPC', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the stable cursor, one-character search, filters, and bounded limit to the server', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', items: [canonical('a')], has_more: true, next_cursor: { created_at: '2026-07-11T00:00:00.000Z', id: 'a' } }, error: null })
    const result = await listMediaItemsPage({ search: 'D', filter: 'favorites', scope: 'react', collectionId: 'collection-1', sort: 'created_desc' }, { createdAt: '2026-07-12T00:00:00.000Z', id: 'cursor-id' }, 500)
    expect(mocks.rpc).toHaveBeenCalledWith('list_media_library_page', {
      p_limit: 100, p_cursor_created_at: '2026-07-12T00:00:00.000Z', p_cursor_id: 'cursor-id',
      p_search: 'D', p_filter: 'favorites', p_scope: 'react', p_collection_id: 'collection-1',
    })
    expect(result).toMatchObject({ ok: true, page: { hasMore: true, nextCursor: { id: 'a' } } })
  })

  it('rejects malformed cursors and page rows instead of corrupting pagination', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { status: 'success', items: [canonical('a')], has_more: true, next_cursor: { created_at: 3, id: 'a' } }, error: null })
      .mockResolvedValueOnce({ data: { status: 'success', items: [{ id: 'bad' }], has_more: false, next_cursor: null }, error: null })
    await expect(listMediaItemsPage({ search: '', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' })).resolves.toMatchObject({ ok: false, kind: 'unexpected' })
    await expect(listMediaItemsPage({ search: '', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' })).resolves.toMatchObject({ ok: false, kind: 'unexpected' })
  })
})
