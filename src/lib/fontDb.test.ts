/**
 * Unit tests for the Supabase-backed font_assets data layer (fontDb.ts).
 *
 * Covers every exported function:
 *   listFontAssets, createFontAsset, deleteFontAsset (table operations)
 *   uploadFontFile, downloadFontFile, removeFontFile (storage operations)
 *
 * Supabase is mocked via vi.hoisted so the test file never calls the network.
 * The table helpers use `db = supabase as SupabaseClient`, which resolves to
 * the same mock object as supabase.from, so assertions cover both paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockDbFrom, mockStorageFrom, cfg } = vi.hoisted(() => {
  return {
    mockDbFrom:      vi.fn(),
    mockStorageFrom: vi.fn(),
    cfg:             { supabaseConfigured: true },
  }
})

vi.mock('./supabase', () => ({
  get supabaseConfigured() { return cfg.supabaseConfigured },
  supabase: {
    from:    mockDbFrom,
    storage: { from: mockStorageFrom },
  },
}))

import {
  listFontAssets,
  createFontAsset,
  deleteFontAsset,
  uploadFontFile,
  downloadFontFile,
  removeFontFile,
} from './fontDb'
import type { FontAssetRow, FontAssetInsert } from '../types/database'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc-123'
const ASSET_ID = 'uuid-asset-001'
const STORAGE_PATH = `${USER_ID}/${ASSET_ID}/TestFont.ttf`

function makeRow(overrides: Partial<FontAssetRow> = {}): FontAssetRow {
  return {
    id:               ASSET_ID,
    user_id:          USER_ID,
    name:             'Test Font',
    file_name:        'TestFont-Regular.ttf',
    font_family_name: 'Test Family',
    storage_path:     STORAGE_PATH,
    mime_type:        'font/ttf',
    file_size:        42000,
    created_at:       '2025-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeInsert(): FontAssetInsert {
  return {
    user_id:          USER_ID,
    name:             'Test Font',
    file_name:        'TestFont-Regular.ttf',
    font_family_name: 'Test Family',
    storage_path:     STORAGE_PATH,
    mime_type:        'font/ttf',
    file_size:        42000,
  }
}

// ── Chain builders ────────────────────────────────────────────────────────────

type TableResult<T> = { data: T | null; error: { message: string } | null }
type MutateResult = { error: { message: string } | null }

function setupList(result: TableResult<FontAssetRow[]>) {
  const mockOrder  = vi.fn().mockResolvedValueOnce(result)
  const mockEq     = vi.fn().mockReturnValueOnce({ order: mockOrder })
  const mockSelect = vi.fn().mockReturnValueOnce({ eq: mockEq })
  mockDbFrom.mockReturnValueOnce({ select: mockSelect })
  return { mockSelect, mockEq, mockOrder }
}

function setupInsert(result: TableResult<{ id: string }>) {
  const mockSingle = vi.fn().mockResolvedValueOnce(result)
  const mockSelect = vi.fn().mockReturnValueOnce({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValueOnce({ select: mockSelect })
  mockDbFrom.mockReturnValueOnce({ insert: mockInsert })
  return { mockInsert, mockSelect, mockSingle }
}

function setupDelete(result: MutateResult) {
  const mockEq     = vi.fn().mockResolvedValueOnce(result)
  const mockDelete = vi.fn().mockReturnValueOnce({ eq: mockEq })
  mockDbFrom.mockReturnValueOnce({ delete: mockDelete })
  return { mockDelete, mockEq }
}

function setupStorageUpload(result: MutateResult) {
  const mockUpload = vi.fn().mockResolvedValueOnce(result)
  mockStorageFrom.mockReturnValueOnce({ upload: mockUpload })
  return { mockUpload }
}

function setupStorageDownload(result: { data: Blob | null; error: { message: string } | null }) {
  const mockDownload = vi.fn().mockResolvedValueOnce(result)
  mockStorageFrom.mockReturnValueOnce({ download: mockDownload })
  return { mockDownload }
}

function setupStorageRemove(result: MutateResult) {
  const mockRemove = vi.fn().mockResolvedValueOnce(result)
  mockStorageFrom.mockReturnValueOnce({ remove: mockRemove })
  return { mockRemove }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  cfg.supabaseConfigured = true
})

// ── listFontAssets ─────────────────────────────────────────────────────────────

describe('listFontAssets', () => {
  it('queries the font_assets table', async () => {
    setupList({ data: [], error: null })
    await listFontAssets(USER_ID)
    expect(mockDbFrom).toHaveBeenCalledWith('font_assets')
  })

  it('filters by user_id', async () => {
    const { mockEq } = setupList({ data: [], error: null })
    await listFontAssets(USER_ID)
    expect(mockEq).toHaveBeenCalledWith('user_id', USER_ID)
  })

  it('orders by created_at descending', async () => {
    const { mockOrder } = setupList({ data: [], error: null })
    await listFontAssets(USER_ID)
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns rows on success', async () => {
    const rows = [makeRow(), makeRow({ id: 'uuid-002', name: 'Second Font' })]
    setupList({ data: rows, error: null })
    const { rows: result, error } = await listFontAssets(USER_ID)
    expect(error).toBeNull()
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Test Font')
    expect(result[1].name).toBe('Second Font')
  })

  it('returns an empty array and error string on failure', async () => {
    setupList({ data: null, error: { message: 'permission denied' } })
    const { rows, error } = await listFontAssets(USER_ID)
    expect(rows).toEqual([])
    expect(error).toBe('permission denied')
  })
})

// ── createFontAsset ────────────────────────────────────────────────────────────

describe('createFontAsset', () => {
  it('inserts into font_assets', async () => {
    const { mockInsert } = setupInsert({ data: { id: ASSET_ID }, error: null })
    await createFontAsset(makeInsert())
    expect(mockDbFrom).toHaveBeenCalledWith('font_assets')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Font' }))
  })

  it('returns the database id on success', async () => {
    setupInsert({ data: { id: ASSET_ID }, error: null })
    const { id, error } = await createFontAsset(makeInsert())
    expect(error).toBeNull()
    expect(id).toBe(ASSET_ID)
  })

  it('returns a null id and error string on failure', async () => {
    setupInsert({ data: null, error: { message: 'violates RLS policy' } })
    const { id, error } = await createFontAsset(makeInsert())
    expect(id).toBeNull()
    expect(error).toBe('violates RLS policy')
  })
})

// ── deleteFontAsset ────────────────────────────────────────────────────────────

describe('deleteFontAsset', () => {
  it('deletes from font_assets by id', async () => {
    const { mockDelete, mockEq } = setupDelete({ error: null })
    await deleteFontAsset(ASSET_ID)
    expect(mockDbFrom).toHaveBeenCalledWith('font_assets')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', ASSET_ID)
  })

  it('returns a null error on success', async () => {
    setupDelete({ error: null })
    const { error } = await deleteFontAsset(ASSET_ID)
    expect(error).toBeNull()
  })

  it('returns an error string on failure', async () => {
    setupDelete({ error: { message: 'row not found' } })
    const { error } = await deleteFontAsset(ASSET_ID)
    expect(error).toBe('row not found')
  })
})

// ── uploadFontFile ─────────────────────────────────────────────────────────────

describe('uploadFontFile', () => {
  it('returns early with an error when Supabase is not configured', async () => {
    cfg.supabaseConfigured = false
    const { error } = await uploadFontFile(STORAGE_PATH, new Blob([]), 'font/ttf')
    expect(error).toBe('Supabase not configured')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('uploads to the font-assets bucket', async () => {
    const { mockUpload } = setupStorageUpload({ error: null })
    await uploadFontFile(STORAGE_PATH, new Blob([]), 'font/ttf')
    expect(mockStorageFrom).toHaveBeenCalledWith('font-assets')
    expect(mockUpload).toHaveBeenCalledWith(
      STORAGE_PATH,
      expect.any(Blob),
      expect.objectContaining({ contentType: 'font/ttf', upsert: false }),
    )
  })

  it('returns a null error on success', async () => {
    setupStorageUpload({ error: null })
    const { error } = await uploadFontFile(STORAGE_PATH, new Blob([]), 'font/ttf')
    expect(error).toBeNull()
  })

  it('returns an error string on storage failure', async () => {
    setupStorageUpload({ error: { message: 'bucket not found' } })
    const { error } = await uploadFontFile(STORAGE_PATH, new Blob([]), 'font/ttf')
    expect(error).toBe('bucket not found')
  })
})

// ── downloadFontFile ───────────────────────────────────────────────────────────

describe('downloadFontFile', () => {
  it('returns early with an error when Supabase is not configured', async () => {
    cfg.supabaseConfigured = false
    const { data, error } = await downloadFontFile(STORAGE_PATH)
    expect(data).toBeNull()
    expect(error).toBe('Supabase not configured')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('downloads from the font-assets bucket', async () => {
    const blob = new Blob(['font-binary'])
    const { mockDownload } = setupStorageDownload({ data: blob, error: null })
    await downloadFontFile(STORAGE_PATH)
    expect(mockStorageFrom).toHaveBeenCalledWith('font-assets')
    expect(mockDownload).toHaveBeenCalledWith(STORAGE_PATH)
  })

  it('returns the Blob on success', async () => {
    const blob = new Blob(['font-binary'])
    setupStorageDownload({ data: blob, error: null })
    const { data, error } = await downloadFontFile(STORAGE_PATH)
    expect(error).toBeNull()
    expect(data).toBe(blob)
  })

  it('returns a null Blob and error string on failure', async () => {
    setupStorageDownload({ data: null, error: { message: 'object not found' } })
    const { data, error } = await downloadFontFile(STORAGE_PATH)
    expect(data).toBeNull()
    expect(error).toBe('object not found')
  })
})

// ── removeFontFile ─────────────────────────────────────────────────────────────

describe('removeFontFile', () => {
  it('returns early with an error when Supabase is not configured', async () => {
    cfg.supabaseConfigured = false
    const { error } = await removeFontFile(STORAGE_PATH)
    expect(error).toBe('Supabase not configured')
    expect(mockStorageFrom).not.toHaveBeenCalled()
  })

  it('removes from the font-assets bucket', async () => {
    const { mockRemove } = setupStorageRemove({ error: null })
    await removeFontFile(STORAGE_PATH)
    expect(mockStorageFrom).toHaveBeenCalledWith('font-assets')
    expect(mockRemove).toHaveBeenCalledWith([STORAGE_PATH])
  })

  it('returns a null error on success', async () => {
    setupStorageRemove({ error: null })
    const { error } = await removeFontFile(STORAGE_PATH)
    expect(error).toBeNull()
  })

  it('returns an error string on failure', async () => {
    setupStorageRemove({ error: { message: 'object does not exist' } })
    const { error } = await removeFontFile(STORAGE_PATH)
    expect(error).toBe('object does not exist')
  })
})
