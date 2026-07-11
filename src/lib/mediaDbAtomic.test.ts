import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { rpc: mocks.rpc },
}))

import { reorderMediaCollectionAtomic, saveMediaItemAtomic } from './mediaDb'

const baseInput = {
  mediaItemId: 'media-1',
  expectedRevision: 2,
  patch: {
    media_role: 'overlay' as const,
    title: 'Title',
    description: 'Description',
    favorite: true,
    metadata: { hasAlpha: true },
  },
  tagNames: ['cyan'],
  collectionIds: ['collection-1'],
}

const canonical = {
  id: 'media-1', user_id: 'user-1', name: 'image.png', type: 'image',
  storage_path: 'user-1/media-1/image.png', thumbnail_path: null,
  width: 1920, height: 1080, duration_sec: null, file_size: 10, mime_type: 'image/png',
  favorite: true, media_role: 'overlay', title: 'Title', description: 'Description',
  metadata: { hasAlpha: true }, revision: 3,
  created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z',
  tags: ['cyan'], collection_ids: ['collection-1'],
}

describe('mediaDb atomic RPC envelopes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the complete canonical media item from a successful transaction', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: 'success', media_item: canonical }, error: null })

    await expect(saveMediaItemAtomic(baseInput)).resolves.toEqual({ ok: true, kind: 'success', mediaItem: canonical })
    expect(mocks.rpc).toHaveBeenCalledWith('save_media_item_atomic', {
      p_media_item_id: 'media-1', p_expected_revision: 2,
      p_patch: baseInput.patch, p_tag_names: ['cyan'], p_collection_ids: ['collection-1'],
    })
  })

  it.each([
    ['forced tag insertion failure', '23514'],
    ['forced collection insertion failure', '23503'],
  ])('surfaces a %s as an atomic validation failure', async (_label, code) => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'validation_failure', message: 'No changes were saved.', error_code: code }, error: null,
    })

    await expect(saveMediaItemAtomic(baseInput)).resolves.toEqual({
      ok: false, kind: 'validation', message: 'No changes were saved.', code,
    })
  })

  it('returns the refreshed canonical media item for a stale revision', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { status: 'conflict', message: 'Changed elsewhere', current_revision: 7, media_item: { ...canonical, revision: 7 } },
      error: null,
    })

    await expect(saveMediaItemAtomic(baseInput)).resolves.toMatchObject({
      ok: false, kind: 'conflict', currentRevision: 7, mediaItem: { revision: 7 },
    })
  })

  it('distinguishes transport failures from server validation', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline', code: 'FETCH_ERROR' } })

    await expect(saveMediaItemAtomic(baseInput)).resolves.toEqual({
      ok: false,
      kind: 'transport',
      message: 'The media update request failed before a canonical result was received.',
      code: 'FETCH_ERROR',
    })
  })

  it('returns canonical collection order and typed ownership rejection', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { status: 'success', ordered_media_ids: ['media-2', 'media-1'] }, error: null })
      .mockResolvedValueOnce({ data: { status: 'authorization_failure', message: 'Not owned' }, error: null })

    await expect(reorderMediaCollectionAtomic('collection-1', ['media-2', 'media-1'])).resolves.toEqual({
      ok: true, kind: 'success', orderedMediaIds: ['media-2', 'media-1'],
    })
    await expect(reorderMediaCollectionAtomic('foreign', ['media-1'])).resolves.toEqual({
      ok: false, kind: 'authorization', message: 'Not owned',
    })
  })
})
