import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — declare mocks with vi.hoisted so they exist when the
// factory runs. Pattern matches how sessionDb.test.ts handles supabase mocking.
const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder  = vi.fn()
  const mockEq     = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom   = vi.fn()
  return { mockFrom, mockSelect, mockEq, mockOrder }
})

vi.mock('./supabase', () => ({
  supabase: { from: mockFrom },
  supabaseConfigured: true,
}))

import { dbListEffectChainOptions } from './effectChainDb'
import type { EffectChainOptionRow } from '../types/database'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeOption(overrides: Partial<EffectChainOptionRow> = {}): EffectChainOptionRow {
  return {
    id:            'rgbSplit',
    chain_name:    'RGB Split',
    effect_key:    'rgbSplit',
    description:   'Separates the rendered image into offset color-channel copies.',
    category:      'distortion',
    control_group: 'Distortion',
    sort_order:    1,
    is_available:  true,
    created_at:    '2025-01-01T00:00:00.000Z',
    updated_at:    '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Chain the builder calls: from().select().eq().order() → resolves to { data, error }
function setupChain(result: { data: EffectChainOptionRow[] | null; error: { message: string } | null }) {
  mockOrder.mockResolvedValueOnce(result)
  mockEq.mockReturnValueOnce({ order: mockOrder })
  mockSelect.mockReturnValueOnce({ eq: mockEq })
  mockFrom.mockReturnValueOnce({ select: mockSelect })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('dbListEffectChainOptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries the effect_chain_options table', async () => {
    setupChain({ data: [], error: null })
    await dbListEffectChainOptions()
    expect(mockFrom).toHaveBeenCalledWith('effect_chain_options')
  })

  it('filters to is_available = true', async () => {
    setupChain({ data: [], error: null })
    await dbListEffectChainOptions()
    expect(mockEq).toHaveBeenCalledWith('is_available', true)
  })

  it('orders by sort_order ascending', async () => {
    setupChain({ data: [], error: null })
    await dbListEffectChainOptions()
    expect(mockOrder).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('returns typed rows when the query succeeds', async () => {
    const rows = [
      makeOption(),
      makeOption({ id: 'bloom', chain_name: 'Bloom', effect_key: 'bloom', sort_order: 7, category: 'post', control_group: 'Lighting / Atmosphere' }),
    ]
    setupChain({ data: rows, error: null })
    const { options, error } = await dbListEffectChainOptions()
    expect(error).toBeNull()
    expect(options).toHaveLength(2)
    expect(options[0].chain_name).toBe('RGB Split')
    expect(options[1].chain_name).toBe('Bloom')
  })

  it('preserves non-identical effect_key mappings in returned rows', async () => {
    const rows = [
      makeOption({ id: 'glitchBars',  chain_name: 'Glitch Bars', effect_key: 'glitchAmount' }),
      makeOption({ id: 'feedback',    chain_name: 'Feedback',    effect_key: 'feedbackTrails' }),
      makeOption({ id: 'tunnel',      chain_name: 'Tunnel',      effect_key: 'tunnelSpeed' }),
    ]
    setupChain({ data: rows, error: null })
    const { options } = await dbListEffectChainOptions()
    expect(options.find(o => o.effect_key === 'glitchAmount')?.chain_name).toBe('Glitch Bars')
    expect(options.find(o => o.effect_key === 'feedbackTrails')?.chain_name).toBe('Feedback')
    expect(options.find(o => o.effect_key === 'tunnelSpeed')?.chain_name).toBe('Tunnel')
  })

  it('returns an empty array and error message when the query fails', async () => {
    setupChain({ data: null, error: { message: 'relation does not exist' } })
    const { options, error } = await dbListEffectChainOptions()
    expect(options).toHaveLength(0)
    expect(error).toBe('relation does not exist')
  })

  it('returns an empty array and null error when data is null with no error', async () => {
    setupChain({ data: null, error: null })
    const { options, error } = await dbListEffectChainOptions()
    expect(options).toHaveLength(0)
    expect(error).toBeNull()
  })
})
