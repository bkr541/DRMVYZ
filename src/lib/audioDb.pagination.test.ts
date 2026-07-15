import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  or: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    from: mocks.from,
    storage: { from: vi.fn() },
  },
}))

import { listAudioTracksPage } from './audioDb'

describe('listAudioTracksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ eq: mocks.eq, order: mocks.order })
    mocks.order.mockReturnValue({ range: mocks.range })
    mocks.range.mockReturnValue({ or: mocks.or })
    mocks.or.mockResolvedValue({ data: [], count: 0, error: null })
  })

  it('searches title and artist in one newest-first paged query', async () => {
    await listAudioTracksPage('user-1', { offset: 18, limit: 18, search: 'From Grace' })

    expect(mocks.from).toHaveBeenCalledWith('audio_tracks')
    expect(mocks.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mocks.eq).toHaveBeenCalledWith('lifecycle_status', 'complete')
    expect(mocks.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mocks.range).toHaveBeenCalledWith(18, 35)
    expect(mocks.or).toHaveBeenCalledWith('title.ilike.%From Grace%,artist.ilike.%From Grace%,file_name.ilike.%From Grace%')
  })
})
