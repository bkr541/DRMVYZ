/**
 * Tests for the Supabase-backed Font Library store actions in reactStore.ts.
 *
 * Covers:
 *   uploadOscillatorFont   — validation, auth guard, Storage→DB flow, rollback
 *   loadOscillatorFonts    — metadata list, idempotency, textFontId validation
 *   selectOscillatorFont   — cache hit fast-path, lazy download, failure isolation
 *   removeOscillatorFontAsset — DB-first deletion, cache eviction, textFontId clear
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
  evictFontFromCache:         h.mockEvictFontFromCache,
  parseOpenTypeFontFromAsset: h.mockParseOpenTypeFontFromAsset,
  textToOpenTypeGlyphPoints:  h.mockTextToOpenTypeGlyphPoints,
}))

import { useReactStore } from './reactStore'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../components/vyzualz/react/ReactTypes'
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
  oscillatorSettings:       { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: null },
  oscillatorTextPointCache: {} as Record<string, never[]>,
  fontsLoadState:           'idle' as const,
  fontLoadError:            null,
  fontUploadPending:        false,
  fontUploadError:          null,
  fontSelectPending:        null,
  fontSelectError:          null,
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
  h.mockParseOpenTypeFontFromAsset.mockReturnValue({})
  h.mockTextToOpenTypeGlyphPoints.mockReturnValue([])

  // Restore blank store state
  useReactStore.setState(BLANK_FONT_STATE)
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

  it('adds asset to store and sets textFontId on success', async () => {
    h.mockInspectFontFile.mockResolvedValue(makeInspection())
    h.mockUploadFontFile.mockResolvedValue({ error: null })
    h.mockCreateFontAsset.mockResolvedValue({ id: ASSET_ID, error: null })

    await useReactStore.getState().uploadOscillatorFont(makeFile())

    const state = useReactStore.getState()
    expect(state.fontUploadPending).toBe(false)
    expect(state.fontUploadError).toBeNull()
    expect(state.oscillatorFontAssets).toHaveLength(1)
    expect(state.oscillatorFontAssets[0].id).toBe(ASSET_ID)
    expect(state.oscillatorSettings.textFontId).toBe(ASSET_ID)
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

  it('clears textFontId when the persisted font is not in the returned list', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: 'stale-id' },
    })
    // Cloud returns a different font, not 'stale-id'
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(ASSET_ID)], error: null })
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
  })

  it('preserves textFontId when the font still exists in the cloud list', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID },
    })
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(ASSET_ID)], error: null })
    // Font already in runtime cache — lazy rehydration is a no-op (no download needed)
    h.mockHasFontRuntime.mockReturnValue(true)
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID)
  })

  it('sets error state and message on list failure', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [], error: 'RLS denied' })
    await useReactStore.getState().loadOscillatorFonts()
    expect(useReactStore.getState().fontsLoadState).toBe('error')
    expect(useReactStore.getState().fontLoadError).toBe('RLS denied')
  })
})

// ── selectOscillatorFont ───────────────────────────────────────────────────────

describe('selectOscillatorFont', () => {
  it('clears textFontId synchronously when called with null', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID },
    })
    await useReactStore.getState().selectOscillatorFont(null)
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
  })

  it('returns without state change when the asset is not in the store', async () => {
    // No assets in store → call is a no-op
    await useReactStore.getState().selectOscillatorFont('missing-id')
    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
  })

  it('sets textFontId immediately on cache hit, without downloading', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })
    h.mockHasFontRuntime.mockReturnValue(true)

    await useReactStore.getState().selectOscillatorFont(ASSET_ID)

    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID)
    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
    expect(useReactStore.getState().fontSelectPending).toBeNull()
  })

  it('downloads binary on cache miss, parses it, and sets textFontId', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset()] })
    h.mockHasFontRuntime.mockReturnValue(false)

    const blob = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    h.mockDownloadFontFile.mockResolvedValue({ data: blob, error: null })
    const mockFont = {}
    h.mockParse.mockReturnValue(mockFont)

    await useReactStore.getState().selectOscillatorFont(ASSET_ID)

    expect(h.mockDownloadFontFile).toHaveBeenCalledWith(makeAsset().storagePath)
    expect(h.mockStoreFontRuntime).toHaveBeenCalledWith(ASSET_ID, mockFont, expect.any(ArrayBuffer))
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID)
    expect(useReactStore.getState().fontSelectPending).toBeNull()
    expect(useReactStore.getState().fontSelectError).toBeNull()
  })

  it('sets fontSelectError and preserves previous textFontId when download fails', async () => {
    useReactStore.setState({
      oscillatorFontAssets: [makeAsset()],
      oscillatorSettings:   { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID2 },
    })
    h.mockHasFontRuntime.mockReturnValue(false)
    h.mockDownloadFontFile.mockResolvedValue({ data: null, error: 'network error' })

    await useReactStore.getState().selectOscillatorFont(ASSET_ID)

    expect(useReactStore.getState().fontSelectError).toMatch('network error')
    // Previous selection is unchanged
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID2)
    expect(useReactStore.getState().fontSelectPending).toBeNull()
  })

  it('sets fontSelectError and preserves textFontId when opentype parse throws', async () => {
    useReactStore.setState({
      oscillatorFontAssets: [makeAsset()],
      oscillatorSettings:   { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID2 },
    })
    h.mockHasFontRuntime.mockReturnValue(false)
    const blob = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    h.mockDownloadFontFile.mockResolvedValue({ data: blob, error: null })
    h.mockParse.mockImplementation(() => { throw new Error('corrupt font data') })

    await useReactStore.getState().selectOscillatorFont(ASSET_ID)

    expect(useReactStore.getState().fontSelectError).toMatch('corrupt font data')
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID2)
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

  it('clears textFontId when the removed font was selected', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID },
    })
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
  })

  it('preserves textFontId when a different font was selected', async () => {
    useReactStore.setState({
      oscillatorFontAssets: [makeAsset(), makeAsset(ASSET_ID2)],
      oscillatorSettings:   { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID2 },
    })
    h.mockDeleteFontAsset.mockResolvedValue({ error: null })
    h.mockRemoveFontFile.mockResolvedValue({ error: null })

    await useReactStore.getState().removeOscillatorFontAsset(ASSET_ID)

    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID2)
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

describe('loadOscillatorFonts — lazy rehydration', () => {
  it('downloads the persisted textFontId after loading fonts when not yet cached', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID },
    })
    const blob = { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(ASSET_ID)], error: null })
    h.mockHasFontRuntime.mockReturnValue(false)
    h.mockDownloadFontFile.mockResolvedValue({ data: blob, error: null })
    h.mockParse.mockReturnValue({})

    await useReactStore.getState().loadOscillatorFonts()

    expect(h.mockDownloadFontFile).toHaveBeenCalledWith(makeRow(ASSET_ID).storage_path)
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID)
  })

  it('skips download for persisted textFontId when already in runtime cache', async () => {
    useReactStore.setState({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID },
    })
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(ASSET_ID)], error: null })
    h.mockHasFontRuntime.mockReturnValue(true)

    await useReactStore.getState().loadOscillatorFonts()

    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID)
  })

  it('does not download any font when textFontId is null after load', async () => {
    h.mockListFontAssets.mockResolvedValue({ rows: [makeRow(ASSET_ID)], error: null })
    // textFontId is null (default)

    await useReactStore.getState().loadOscillatorFonts()

    expect(h.mockDownloadFontFile).not.toHaveBeenCalled()
  })
})

// ── selectOscillatorFont — stale result protection ─────────────────────────────

describe('selectOscillatorFont — stale result protection', () => {
  it('discards result of font A when font B (cache hit) is selected while A is downloading', async () => {
    useReactStore.setState({ oscillatorFontAssets: [makeAsset(), makeAsset(ASSET_ID2)] })

    let resolveA!: (v: { data: Blob; error: null }) => void
    const downloadA = new Promise<{ data: Blob; error: null }>(res => { resolveA = res })

    // A is not cached, B is cached
    h.mockHasFontRuntime.mockImplementation((id: string) => id === ASSET_ID2)
    h.mockDownloadFontFile.mockReturnValueOnce(downloadA)
    h.mockParse.mockReturnValue({})

    // Start selecting A (won't complete until resolveA fires)
    const selectA = useReactStore.getState().selectOscillatorFont(ASSET_ID)
    expect(useReactStore.getState().fontSelectPending).toBe(ASSET_ID)

    // Select B (cache hit) — supersedes A by clearing fontSelectPending
    await useReactStore.getState().selectOscillatorFont(ASSET_ID2)
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID2)
    expect(useReactStore.getState().fontSelectPending).toBeNull()

    // Now let A's download complete
    resolveA({ data: { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) } as unknown as Blob, error: null })
    await selectA

    // A's result is discarded — B's selection is unchanged
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBe(ASSET_ID2)
    expect(useReactStore.getState().fontSelectPending).toBeNull()
    expect(useReactStore.getState().fontSelectError).toBeNull()
  })

  it('discards A error and preserves current selection when null is selected while A loads', async () => {
    useReactStore.setState({
      oscillatorFontAssets: [makeAsset()],
      oscillatorSettings:   { ...DEFAULT_OSCILLATOR_SETTINGS, textFontId: ASSET_ID2 },
    })

    let resolveA!: (v: { data: null; error: string }) => void
    const downloadA = new Promise<{ data: null; error: string }>(res => { resolveA = res })
    h.mockHasFontRuntime.mockReturnValue(false)
    h.mockDownloadFontFile.mockReturnValueOnce(downloadA)

    // Start selecting A
    const selectA = useReactStore.getState().selectOscillatorFont(ASSET_ID)

    // Select null — clears fontSelectPending, cancels in-flight work
    await useReactStore.getState().selectOscillatorFont(null)
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
    expect(useReactStore.getState().fontSelectPending).toBeNull()

    // Resolve A with an error — should be silently discarded
    resolveA({ data: null, error: 'network error' })
    await selectA

    // Error from stale A must not pollute the current state
    expect(useReactStore.getState().fontSelectError).toBeNull()
    expect(useReactStore.getState().oscillatorSettings.textFontId).toBeNull()
  })
})

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
