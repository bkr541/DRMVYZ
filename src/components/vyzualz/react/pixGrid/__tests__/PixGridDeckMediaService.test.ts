// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  mediaState: {
    uploadCanonicalVisualFile: vi.fn(),
    removeItem: vi.fn(),
  },
  reactState: {
    pixGridDecks: [] as any[],
    pixGridState: { matrixWidth: 160, matrixHeight: 90 },
    createPixGridDeck: vi.fn(),
    updatePixGridDeck: vi.fn(),
  },
  preflight: vi.fn(),
  brandState: {
    activeKit: { palette: { background: '#112233', primary: '#445566' } },
  },
}))

vi.mock('../../../../../stores/mediaStore', () => ({
  MEDIA_BATCH_CONCURRENCY: 4,
  mapWithConcurrency: async <T, R>(values: readonly T[], _limit: number, worker: (value: T, index: number) => Promise<R>) => (
    Promise.all(values.map((value, index) => worker(value, index)))
  ),
  useMediaStore: { getState: () => runtime.mediaState },
}))
vi.mock('../../../../../stores/reactStore', () => ({
  useReactStore: { getState: () => runtime.reactState },
}))
vi.mock('../../../../../features/personalization/brandKitStore', () => ({
  useBrandKitStore: { getState: () => runtime.brandState },
}))
vi.mock('../PixGridDeckCompilerPreflight', () => ({
  preflightPixGridDeckSources: runtime.preflight,
}))

import { ingestPixGridDeckSourceFiles } from '../PixGridDeckMediaService'

const fixtureRoot = new URL('../../../../../test/fixtures/pixGridDeck/', import.meta.url)
function fixture(name: string, type: string): File {
  return new File([readFileSync(new URL(name, fixtureRoot))], name, { type })
}

function uploaded(id: string, name: string) {
  return {
    id, dbId: id.replace(/^db-/, ''), name, type: 'image' as const, url: 'https://signed.example/source',
    thumbnailUrl: null, meta: '2×2', favorite: false, mediaRole: 'other' as const, tags: [], collectionIds: [],
    metadata: {}, revision: 7,
  }
}

describe('PixGrid Deck media ingestion service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => (
      { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap
    )))
    runtime.reactState.pixGridDecks = []
    runtime.brandState.activeKit = { palette: { background: '#112233', primary: '#445566' } }
    runtime.mediaState.removeItem.mockResolvedValue(true)
    runtime.preflight.mockImplementation(async (entries: Array<{ item: { id: string } }>) => ({
      acceptedItemIds: entries.map(entry => entry.item.id),
      rejected: [],
    }))
    runtime.reactState.pixGridState = { matrixWidth: 160, matrixHeight: 90 }
    runtime.mediaState.uploadCanonicalVisualFile
      .mockResolvedValueOnce({ ok: true, item: uploaded('db-one', 'opaque.png') })
      .mockResolvedValueOnce({ ok: true, item: uploaded('db-two', 'safe.svg') })
    runtime.reactState.createPixGridDeck.mockReturnValue({ ok: true, deckId: 'deck-new' })
    runtime.reactState.updatePixGridDeck.mockReturnValue({ ok: true, deckId: 'deck-existing' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unsupported content before media upload or project mutation', async () => {
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'Rejected' },
      files: [new File(['GIF89a'], 'bad.gif', { type: 'image/gif' }), fixture('opaque.png', 'image/png')],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'unsupported-format', fileName: 'bad.gif' } })
    expect(runtime.mediaState.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(runtime.reactState.createPixGridDeck).not.toHaveBeenCalled()
  })

  it('uploads through mediaStore and commits stable source snapshots in one Deck action', async () => {
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', id: 'deck-new', name: 'My Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
    })
    expect(result).toEqual({ ok: true, deckId: 'deck-new', mediaIds: ['db-one', 'db-two'] })
    expect(runtime.mediaState.uploadCanonicalVisualFile).toHaveBeenCalledTimes(2)
    expect(runtime.reactState.createPixGridDeck).toHaveBeenCalledTimes(1)
    const input = runtime.reactState.createPixGridDeck.mock.calls[0][0]
    expect(input.items).toHaveLength(2)
    expect(input.items[0]).toMatchObject({
      mediaId: 'db-one', source: { mediaRevision: 7, mimeType: 'image/png', hasAlpha: false, transparentBackground: '#000000' },
    })
    expect(input.items[1]).toMatchObject({
      mediaId: 'db-two', source: { mediaRevision: 7, mimeType: 'image/svg+xml', hasAlpha: true, transparentBackground: '#112233' },
    })
    expect(input.items[0].source.fingerprint).toMatch(/^sha256:/)
  })

  it('cancels after finalized uploads without committing a Deck and cleans canonical media', async () => {
    const controller = new AbortController()
    runtime.mediaState.uploadCanonicalVisualFile
      .mockReset()
      .mockImplementationOnce(async () => {
        controller.abort()
        return { ok: true, item: uploaded('db-one', 'opaque.png') }
      })
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'Cancelled' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
      signal: controller.signal,
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-one')
    expect(runtime.reactState.createPixGridDeck).not.toHaveBeenCalled()
  })

  it('removes a failed new image from the pending mutation while preserving compiled successes', async () => {
    runtime.mediaState.uploadCanonicalVisualFile.mockReset()
      .mockResolvedValueOnce({ ok: true, item: uploaded('db-one', 'opaque.png') })
      .mockResolvedValueOnce({ ok: true, item: uploaded('db-two', 'safe.svg') })
      .mockResolvedValueOnce({ ok: true, item: uploaded('db-three', 'transparent.png') })
    runtime.preflight.mockImplementationOnce(async (entries: Array<{ item: { id: string; mediaId: string } }>) => ({
      acceptedItemIds: [entries[0].item.id, entries[2].item.id],
      rejected: [{
        itemId: entries[1].item.id,
        mediaId: entries[1].item.mediaId,
        error: { code: 'decode-failed', message: 'The SVG could not be decoded.', retryable: false },
      }],
    }))
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', id: 'deck-new', name: 'Partial Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml'), fixture('transparent.png', 'image/png')],
    })
    expect(result).toMatchObject({
      ok: true,
      mediaIds: ['db-one', 'db-three'],
      rejected: [{ fileName: 'safe.svg', message: 'The SVG could not be decoded.' }],
    })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledWith('db-two')
    expect(runtime.reactState.createPixGridDeck.mock.calls[0][0].items.map((item: { mediaId: string }) => item.mediaId))
      .toEqual(['db-one', 'db-three'])
  })

  it('rolls back canonical uploads when the Stage 1 name contract rejects the Deck', async () => {
    runtime.reactState.createPixGridDeck.mockReturnValueOnce({
      ok: false,
      error: { code: 'duplicate-name', message: 'A PixGrid Deck named "My Deck" already exists.', path: 'name' },
    })
    const result = await ingestPixGridDeckSourceFiles({
      target: { kind: 'create', name: 'My Deck' },
      files: [fixture('opaque.png', 'image/png'), fixture('safe.svg', 'image/svg+xml')],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'deck-mutation-failed', deckError: { code: 'duplicate-name' } } })
    expect(runtime.mediaState.removeItem).toHaveBeenCalledTimes(2)
  })
})
