import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }))
import { cinema2TextRepository } from './cinema2TextDb'

describe('Cinema 2.0 text Supabase boundary', () => {
  it('filters every read by owner and reads beyond the default 1000-row service cap', async () => {
    const eq = vi.fn(), range = vi.fn()
    mocks.from.mockImplementation((table: string) => ({ select: () => {
      const query = {
        eq: (column: string, value: string) => { eq(column, value); return query },
        order: () => query,
        returns: () => query,
        range: async (start: number, end: number) => {
          range(table, start, end)
          const rows = table === 'cinema2_saved_text' && start === 0 ? Array.from({ length: 1000 }, (_, index) => ({ id: String(index), preset_id: 'drmvyz.cinema2.say-it', name: 'Test', schema_version: 1, parameters: {}, created_at: '2026-11-10T00:00:00Z' })) : []
          return { data: rows, error: null }
        },
      }
      return query
    } }))
    const data = await cinema2TextRepository.load('alice')
    expect(data.records).toHaveLength(1000)
    expect(range).toHaveBeenCalledWith('cinema2_saved_text', 1000, 1999)
    expect(eq.mock.calls.every(call => call[0] === 'user_id' && call[1] === 'alice')).toBe(true)
  })
  it('uses retry-safe insert-only writes with owner/preset identity and propagates failures', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })
    await cinema2TextRepository.insertPools('alice', [{ id: 'pool', presetId: 'drmvyz.cinema2.say-it', name: 'Opening', createdAt: '2026-11-10T00:00:00Z' }])
    expect(upsert).toHaveBeenCalledWith([{ user_id: 'alice', preset_id: 'drmvyz.cinema2.say-it', id: 'pool', name: 'Opening', created_at: '2026-11-10T00:00:00Z' }], { onConflict: 'user_id,preset_id,id', ignoreDuplicates: true })
    upsert.mockResolvedValue({ error: { message: 'permission denied' } })
    await expect(cinema2TextRepository.insertMemberships('bob', [{ poolId: 'pool', recordId: 'record', presetId: 'drmvyz.cinema2.marquee' }])).rejects.toThrow('permission denied')
  })
})
