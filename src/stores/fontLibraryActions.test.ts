/**
 * Tests for the Supabase-backed Font Library store actions in reactStore.ts.
 *
 * Covers:
 *   uploadOscillatorFont   — validation, auth guard, Storage→DB flow, rollback
 *   loadOscillatorFonts    — metadata list, idempotency
 *   removeOscillatorFontAsset — DB-first deletion, cache eviction
 *
 * Supabase, fontDb helpers, opentype, and fontGlyphUtils are all mocked so no
 * network or filesystem calls are made.  The Zustand store runs against real
 * in-memory state; each test resets to a known baseline in beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must use vi.hoisted so they're ready when vi.mock factories run) ────

const h = vi.hoisted(() => ({
  // Supabase
  isConfigured:    true,
  mockGetUser:     vi.fn(),

  // fontDb helpers
  mockUploadFontFile:   vi.fn(),
  mockCreateFontAsset:  vi.fn(),
  mockUpdateFontAssetName: vi.fn(),
  mockUpdateFontAssetMetadata: vi.fn(),
  mockDeleteFontAsset:  vi.fn(),
  mockRemoveFontFile:   vi.fn(),
  mockListFontAssets:   vi.fn(),
  mockDownloadFontFile: vi.fn(),

  // opentype
  mockParse: vi.fn(),

  // fontGlyphUtils
  mockInspectFontFile:            vi.fn(),
  mockStoreFontRuntime:           vi.fn(),
  mockHasFontRuntime:             vi.fn(),
  mockGetBufferFromCache:         vi.fn(),
  mockEvictFontFromCache:         vi.fn(),
  mockParseOpenTypeFontFromAsset: vi.fn(),
  mockTextToOpenTypeGlyphPoints:  vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  get supabaseConfigured() { return h.isConfigured },
  supabase: { auth: { getUser: h.mockGetUser }, from: vi.fn(), storage: { from: vi.fn() } },
}))

vi.mock('../lib/fontDb', () => ({
  uploadFontFile:   h.mockUploadFontFile,
  createFontAsset:  h.mockCreateFontAsset,
  updateFontAssetName: h.mockUpdateFontAssetName,
  updateFontAssetMetadata: h.mockUpdateFontAssetMetadata,
  deleteFontAsset:  h.mockDeleteFontAsset,
  removeFontFile:   h.mockRemoveFontFile,
  listFontAssets:   h.mockListFontAssets,
  downloadFontFile: h.mockDownloadFontFile,
}))

vi.mock('opentype.js', () => ({
  parse: h.mockParse,
}))

vi.mock('../components/vyzualz/react/renderers/fontGlyphUtils', () => ({
  inspectFontFile:            h.mockInspectFontFile,
  storeFontRuntime:           h.mockStoreFontRuntime,
  hasFontRuntime:             h.mockHasFontRuntime,
  getBufferFromCache:         h.mockGetBufferFromCache,
  evictFontFromCache:         h.mockEvictFontFromCache,
  parseOpenTypeFontFromAsset: h.mockParseOpenTypeFontFromAsset,
  textToOpenTypeGlyphPoints:  h.mockTextToOpenTypeGlyphPoints,
}))

import { useReactStore } from './reactStore'
import type { OscillatorFontAsset } from '../components/vyzualz/react/ReactTypes'
import type { FontAssetRow } from '../types/database'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID   = 'user-abc'
const ASSET_ID  = 'uuid-db-0001'
const ASSET_ID2 = 'uuid-db-0002'
const FNV_ID    = 'font-deadbeef'
const STORAGE_PATH = `${USER_ID}/${ASSET_ID}/TestFont.ttf`

function makeAsset(id = ASSET_ID): OscillatorFontAsset {
  return {
    id,
    name:        'Test Font',
    fileName:    'TestFont-Regular.ttf',
    storagePath: `${USER_ID}/${id}/TestFont.ttf`,
    mimeType:    'font/ttf',
    fileSize:    42000,
    createdAt:   '2025-06-01T00:00:00.000Z',
  }
}

function makeRow(id = ASSET_ID): FontAssetRow {
  return {
    id,
    user_id:          USER_ID,
    name:             'Test Font',
    file_name:        'TestFont-Regular.ttf',
    font_family_name: 'Test Family',
    storage_path:     `${USER_ID}/${id}/TestFont.ttf`,
    mime_type:        'font/ttf',
    file_size:        42000,
    tags:             [],
    collection_ids:   [],
    created_at:       '2025-06-01T00:00:00.000Z',
  }
}

function makeFile(name = 'TestFont.ttf'): File {
  return { name, size: 42000, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) } as unknown as File
}

function makeInspection(id = FNV_ID) {
  return {
    id,
    name:           'Test Font',
    fileName:       'TestFont-Regular.ttf',
    fontFamilyName: 'Test Family',
    mimeType:       'font/ttf' as const,
    fileSize:       42000,
    buffer:         new ArrayBuffer(8),
    font:           {} as never,
  }
}

// ── Reset ──────────────────────────────────────────────────────────────────────

const BLANK_FONT_STATE = {
  oscillatorFontAssets:     [] as OscillatorFontAsset[],
  fontsLoadState:           'idle' as const,
  fontLoadError:            null,
  fontUploadPending:        false,
  fontUploadError:          null,
  fontRemovePending:        null,
  fontRemoveError:          null,
}

beforeEach(() => {
  vi.clearAllMocks()

  // Default: configured + authenticated
  h.isConfigured = true
  h.mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

  // fontGlyphUtils defaults
  h.mockHasFontRuntime.mockReturnValue(false)
  h.mockGetBufferFromCache.mockReturnValue(undefined)
  h.mockParseOpenTypeFontFromAsset.mockReturnValue({})
  h.mockTextToOpenTypeGlyphPoints.mockReturnValue([])
  h.mockUpdateFontAssetName.mockResolvedValue({ error: null })
  h.mockUpdateFontAssetMetadata.mockResolvedValue({ error: null })

  // Restore blank store state
  useReactStore.setState(BLANK_FONT_STATE)
})

// ── renameOscillatorFontAsset ─────────────────────────────────────────────────

describe('renameOscillatorFontAsset', () => {
  it('persists the new name and updates the in-memory font record', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })

    await expect(useReactStore.getState().renameOscillatorFontAsset(ASSET_ID, 'My Headline Font')).resolves.toBe(true)

    expect(h.mockUpdateFontAssetName).toHaveBeenCalledWith(ASSET_ID, 'My Headline Font')
    expect(useReactStore.getState().oscillatorFontAssets[0]?.name).toBe('My Headline Font')
  })

  it('keeps the current name when persistence fails', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })
    h.mockUpdateFontAssetName.mockResolvedValueOnce({ error: 'database unavailable' })

    await expect(useReactStore.getState().renameOscillatorFontAsset(ASSET_ID, 'Unsaved Name')).resolves.toBe(false)

    expect(useReactStore.getState().oscillatorFontAssets[0]?.name).toBe('Test Font')
  })
})

describe('updateOscillatorFontAssetMetadata', () => {
  it('persists tags and collection memberships with the font name', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })

    await expect(useReactStore.getState().updateOscillatorFontAssetMetadata(ASSET_ID, {
      name: 'Show Font', tags: [' headline ', 'headline'], collectionIds: ['collection-1'],
    })).resolves.toBe(true)

    expect(h.mockUpdateFontAssetMetadata).toHaveBeenCalledWith(ASSET_ID, {
      name: 'Show Font', tags: ['headline'], collectionIds: ['collection-1'],
    })
    expect(useReactStore.getState().oscillatorFontAssets[0]).toMatchObject({
      name: 'Show Font', tags: ['headline'], collectionIds: ['collection-1'],
    })
  })
})

// ── uploadOscillatorFont ───────────────────────────────────────────────────────

describe('uploadOscillatorFont', () => {
  it('sets fontUploadError when Supabase is not configured', async () => {
    h.isConfigured = false
    await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(useReactStore.getState().fontUploadError).toBe('Supabase is not configured')
    expect(h.mockInspectFontFile).not.toHaveBeenCalled()
  })

  it('sets fontUploadError when the user is not signed in', async () => {
    h.mockGetUser.mockResolvedValue({ data: { user: null } })
    await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(useReactStore.getState().fontUploadError).toBe('Sign in to upload fonts')
    expect(useReactStore.getState().fontUploadPending).toBe(false)
  })

  it('surfaces inspectFontFile validation errors (unsupported extension)', async () => {
    h.mockInspectFontFile.mockRejectedValue(new Error('Only .ttf and .otf fonts are supported'))
    await useReactStore.getState().uploadOscillatorFont(makeFile('track.mp3'))
    expect(useReactStore.getState().fontUploadError).toBe('Only .ttf and .otf fonts are supported')
    expect(useReactStore.getState().fontUploadPending).toBe(false)
    expect(h.mockUploadFontFile).not.toHaveBeenCalled()
  })

  it('surfaces inspectFontFile rejection for oversized files', async () => {
    h.mockInspectFontFile.mockRejectedValue(new Error('Font file too large (max 2 MB)'))
    await useReactStore.getState().uploadOscillatorFont(makeFile('big.ttf'))
    expect(useReactStore.getState().fontUploadError).toMatch('Font file too large')
    expect(h.mockUploadFontFile).not.toHaveBeenCalled()
  })

  it('sets fontUploadError and evicts FNV cache when storage upload fails', async () => {
    const inspection = makeInspection()
    h.mockInspectFontFile.mockResolvedValue(inspection)
    h.mockUploadFontFile.mockResolvedValue({ error: 'bucket full' })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    expect(useReactStore.getState().fontUploadError).toMatch('Upload failed')
    expect(h.mockEvictFontFromCache).toHaveBeenCalledWith(FNV_ID)
    expect(h.mockCreateFontAsset).not.toHaveBeenCalled()
  })

  it('rolls back storage and evicts FNV cache when DB insert fails', async () => {
    const inspection = makeInspection()
    h.mockInspectFontFile.mockResolvedValue(inspection)
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: null, error: 'RLS violation' })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    expect(h.mockRemoveFontFile).toHaveBeenCalledWith(expect.stringContaining(USER_ID))
    expect(h.mockEvictFontFromCache).toHaveBeenCalledWith(FNV_ID)
    expect(useReactStore.getState().fontUploadError).toMatch('Database insert failed')
    expect(useReactStore.getState().oscillatorFontAssets).toHaveLength(0)
  })

  it('adds asset to the Font Library on success', async () => {
    h.mockInspectFontFile.mockResolvedValue(makeInspection())
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    const state = useReactStore.getState()
    expect(state.fontUploadPending).toBe(false)
    expect(state.fontUploadError).toBeNull()
    expect(state.oscillatorFontAssets).toHaveLength(1)
    expect(state.oscillatorFontAssets[0].id).toBe(ASSET_ID)
  })

  it('migrates runtime cache from FNV id to DB UUID on success', async () => {
    const inspection = makeInspection(FNV_ID)
    h.mockInspectFontFile.mockResolvedValue(inspection)
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    // storeFontRuntime called with the DB UUID (not the FNV hash)
    expect(h.mockStoreFontRuntime).toHaveBeenCalledWith(ASSET_ID, inspection.font, inspection.buffer)
    // FNV-keyed entry evicted after migration
    expect(h.mockEvictFontFromCache).toHaveBeenCalledWith(FNV_ID)
  })

  it('clears fontUploadPending on success', async () => {
    h.mockInspectFontFile.mockResolvedValue(makeInspection())
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    expect(useReactStore.getState().fontUploadPending).toBe(false)
  })
})

// ── loadOscillatorFonts ────────────────────────────────────────────────────────

describe('loadOscillatorFonts', () => {
  it('sets fontLoadError when Supabase is not configured', async () => {
    h.isConfigured = false
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontLoadError).toBe('Supabase is not configured')
    expect(h.mockListFontAssets).not.toHaveBeenCalled()
  })

  it('sets error state when the user is not signed in', async () => {
    h.mockGetUser.mockResolvedValue({ data: { user: null } })
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontsLoadState).toBe('error')
    expect(useReactStore.getState().fontLoadError).toBe('Sign in to load fonts')
  })

  it('is idempotent when fontsLoadState is loading', async () => {
    useReactStore.setState({ fontsLoadState: 'loading' })
    await useReactStore.getState().loadOscillatorFonts()
    expect(h.mockListFontAssets).not.toHaveBeenCalled()
  })

  it('is idempotent when fontsLoadState is loaded', async () => {
    useReactStore.setState({ fontsLoadState: 'loaded' })
    await useReactStore.getState().loadOscillatorFonts()
    expect(h.mockListFontAssets).not.toHaveBeenCalled()
  })

  it('populates oscillatorFontAssets from cloud rows (metadata only, no binary)', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow()], error: null })
    await useReactStore.getState().loadOscillatorFonts()

    const assets = useReactStore.getState().oscillatorFontAssets
    expect(assets).toHaveLength(1)
    expect(assets[0].id).toBe(ASSET_ID)
    expect(assets[0].storagePath).toBeDefined()
    // No binary data in store
    expect((assets[0] as unknown as Record<string, unknown>).rawFontDataBase64).toBeUndefined()
    expect((assets[0] as unknown as Record<string, unknown>).buffer).toBeUndefined()
  })

  it('does not call downloadFontFile during list (no binary downloads)', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(), makeRow(ASSET_ID2)], error: null })
    await useReactStore.getState().loadOscillatorFonts()
    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
  })

  it('sets fontsLoadState to loaded on success', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [], error: null })
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontsLoadState).toBe('loaded')
  })

  it('sets error state and message on list failure', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [], error: 'RLS denied' })
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontsLoadState).toBe('error')
    expect(useReactStore.getState().fontLoadError).toBe('RLS denied')
  })
})

// ── removeOscillatorFontAsset ──────────────────────────────────────────────────

describe('removeOscillatorFontAsset', () => {
  beforeEach(() => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })
  })

  it('calls deleteFontAsset with the asset id', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(h.mockDeleteFontAsset).toHaveBeenCalledWith(ASSET_ID)
  })

  it('preserves asset in store when DB delete fails', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: 'RLS denied' })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(useReactStore.getState().oscillatorFontAssets).toHaveLength(1)
    expect(useReactStore.getState().fontRemoveError).toMatch('Could not delete font record')
    expect(h.mockRemoveFontFile).not.toHaveBeenCalled()
  })

  it('removes asset from store after successful DB delete', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(useReactStore.getState().oscillatorFontAssets).toHaveLength(0)
  })

  it('calls removeFontFile for the asset storagePath', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(h.mockRemoveFontFile).toHaveBeenCalledWith(makeAsset().storagePath)
  })

  it('evicts the runtime cache entry after deletion', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(h.mockEvictFontFromCache).toHaveBeenCalledWith(ASSET_ID)
  })

  it('surfaces a soft warning when Storage deletion fails (asset still removed)', async () => {
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: 'object not found' })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    // Asset is removed from Zustand (DB delete succeeded)
    expect(useReactStore.getState().oscillatorFontAssets).toHaveLength(0)
    // Error message surfaced to UI
    expect(useReactStore.getState().fontRemoveError).toMatch('storage cleanup failed')
  })

  it('is a no-op for an unknown id', async () => {
    await useReactStore.getState().removeOscillatorFontAsset('does-not-exist')
    expect(h.mockDeleteFontAsset).not.toHaveBeenCalled()
    expect(useReactStore.getState().oscillatorFontAssets).toHaveLength(1)
  })
})

// ── loadOscillatorFonts — lazy rehydration ─────────────────────────────────────


// ── uploadOscillatorFont — storage path safety ─────────────────────────────────

describe('uploadOscillatorFont — storage path safety', () => {
  function setupUpload(originalFileName: string, mimeType: 'font/ttf' | 'font/otf') {
    h.mockInspectFontFile.mockResolvedValue({ ...makeInspection(), fileName: originalFileName, mimeType })
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })
  }

  it('uses font.ttf (not the original filename) in the storage path for .ttf uploads', async () => {
    setupUpload('My Font Regular.ttf', 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('My Font Regular.ttf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    expect(storagePath).toMatch(/\/font\.ttf$/)
    expect(storagePath).not.toContain('My Font Regular')
  })

  it('uses font.otf (not the original filename) in the storage path for .otf uploads', async () => {
    setupUpload('Weird-Name.otf', 'font/otf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('Weird-Name.otf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    expect(storagePath).toMatch(/\/font\.otf$/)
    expect(storagePath).not.toContain('Weird-Name')
  })

  it('excludes path-traversal chars from storage path when filename contains slashes', async () => {
    setupUpload('path/../traversal.ttf', 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('path/../traversal.ttf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    expect(storagePath).not.toContain('../')
    expect(storagePath).not.toContain('traversal')
    expect(storagePath).toMatch(/\/font\.ttf$/)
  })

  it('excludes backslashes from storage path when filename contains backslashes', async () => {
    setupUpload('dir\\subdir\\font.ttf', 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('dir\\subdir\\font.ttf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    expect(storagePath).not.toContain('\\')
    expect(storagePath).toMatch(/\/font\.ttf$/)
  })

  it('excludes spaces and special chars from storage path for unusual filenames', async () => {
    setupUpload('My & Unique "Font"!.ttf', 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('My & Unique "Font"!.ttf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    expect(storagePath).toMatch(/^[^"&!]+$/)
    expect(storagePath).toMatch(/\/font\.ttf$/)
  })

  it('preserves the original filename verbatim in the DB file_name column', async () => {
    const originalName = 'path/../../etc/passwd.ttf'
    setupUpload(originalName, 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile(originalName))
    const [insertArg] = h.mockCreateFontAsset.mock.calls[0]
    expect(insertArg.file_name).toBe(originalName)
  })

  it('does not place the original filename in the storage_path column of the DB insert', async () => {
    const originalName = 'Dangerous  File Name.ttf'
    setupUpload(originalName, 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile(originalName))
    const [insertArg] = h.mockCreateFontAsset.mock.calls[0]
    expect(insertArg.storage_path).not.toContain('Dangerous')
    expect(insertArg.storage_path).toMatch(/\/font\.ttf$/)
  })

  it('storage path has exactly three segments: userId / UUID / font.ttf', async () => {
    setupUpload('test.ttf', 'font/ttf')
    await useReactStore.getState().uploadOscillatorFont(makeFile('test.ttf'))
    const [[storagePath]] = h.mockUploadFontFile.mock.calls
    const parts = storagePath.split('/')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe(USER_ID)
    expect(parts[1]).toMatch(/^[0-9a-f-]{36}$/)
    expect(parts[2]).toBe('font.ttf')
  })

  it('rolls back the safe normalized path (not the original filename) on insert failure', async () => {
    setupUpload('My Font.ttf', 'font/ttf')
    h.mockCreateFontAsset.mockResolvedValue({ id: null, error: 'DB error' })
    await useReactStore.getState().uploadOscillatorFont(makeFile('My Font.ttf'))
    const [[rollbackPath]] = h.mockRemoveFontFile.mock.calls
    expect(rollbackPath).toMatch(/\/font\.ttf$/)
    expect(rollbackPath).not.toContain('My Font.ttf')
  })
})

// ── Unexpected throws always clear pending state ───────────────────────────────

describe('unexpected thrown errors always clear pending state', () => {
  it('clears fontUploadPending when supabase.auth.getUser() throws', async () => {
    h.mockGetUser.mockRejectedValue(new Error('network timeout'))
    await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(useReactStore.getState().fontUploadPending).toBe(false)
    expect(useReactStore.getState().fontUploadError).toMatch('network timeout')
  })

  it('clears fontUploadPending when inspectFontFile throws unexpectedly', async () => {
    h.mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    h.mockInspectFontFile.mockRejectedValue(new Error('unexpected parse crash'))
    await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(useReactStore.getState().fontUploadPending).toBe(false)
  })

  it('clears fontUploadPending when uploadFontFile throws unexpectedly', async () => {
    h.mockInspectFontFile.mockResolvedValue(makeInspection())
    h.mockUploadFontFile.mockRejectedValue(new Error('storage SDK crash'))
    await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(useReactStore.getState().fontUploadPending).toBe(false)
    expect(useReactStore.getState().fontUploadError).toMatch('storage SDK crash')
  })

  it('clears fontRemovePending when deleteFontAsset throws unexpectedly', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })
    h.mockDeleteFontAsset.mockRejectedValue(new Error('DB connection lost'))

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(useReactStore.getState().fontRemovePending).toBeNull()
    expect(useReactStore.getState().fontRemoveError).toMatch('DB connection lost')
  })

  it('clears fontsLoadState when supabase.auth.getUser() throws during load', async () => {
    h.mockGetUser.mockRejectedValue(new Error('auth service down'))
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontsLoadState).toBe('error')
    expect(useReactStore.getState().fontLoadError).toMatch('auth service down')
  })
})

// ── selectOscillatorFont — stale result does not enter runtime cache ───────────

// ── uploadOscillatorFont — details from the media upload dialog ───────────────

describe('uploadOscillatorFont — name, tags and collections', () => {
  beforeEach(() => {
    h.mockInspectFontFile.mockResolvedValue(makeInspection())
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })
  })

  it('stores the chosen name, tags and collections on the database row and the in-memory font, and resolves with its id', async () => {
    const id = await useReactStore.getState().uploadOscillatorFont(makeFile(), {
      name: '  Show   Headline ', tags: [' headline ', 'headline', ''], collectionIds: ['collection-1', 'collection-1'],
    })
    expect(id).toBe(ASSET_ID)
    expect(h.mockCreateFontAsset).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Show Headline', tags: ['headline'], collection_ids: ['collection-1'],
    }))
    expect(useReactStore.getState().oscillatorFontAssets[0]).toMatchObject({
      id: ASSET_ID, name: 'Show Headline', tags: ['headline'], collectionIds: ['collection-1'],
    })
  })

  it('keeps the name read from the font when no details are given, as the Font Library panel does', async () => {
    const id = await useReactStore.getState().uploadOscillatorFont(makeFile())
    expect(id).toBe(ASSET_ID)
    expect(h.mockCreateFontAsset).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Font', tags: [], collection_ids: [] }))
  })

  it('resolves with null and reports the reason when the upload fails', async () => {
    h.mockUploadFontFile.mockResolvedValue({ error: 'bucket unavailable' })
    await expect(useReactStore.getState().uploadOscillatorFont(makeFile(), { name: 'X' })).resolves.toBeNull()
    expect(useReactStore.getState().fontUploadError).toContain('bucket unavailable')
  })
})
