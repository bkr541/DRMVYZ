import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadedMedia } from '../../../../../stores/mediaStore'
import type { PixGridDeckItemDefinition } from '../PixGridDeckDomain'
import { PIX_GRID_DECK_MAX_SOURCE_BYTES } from '../PixGridDeckMediaValidation'

const runtime = vi.hoisted(() => ({
  items: [] as UploadedMedia[],
  ensureMediaSigned: vi.fn(),
  retryMediaAsset: vi.fn(),
}))

vi.mock('../../../../../stores/mediaStore', () => ({
  useMediaStore: {
    getState: () => ({
      items: runtime.items,
      ensureMediaSigned: runtime.ensureMediaSigned,
      retryMediaAsset: runtime.retryMediaAsset,
    }),
  },
}))

import { resolvePixGridDeckMediaSource } from '../PixGridDeckMediaSourceResolver'

const fingerprint = `sha256:${'a'.repeat(64)}`

function media(overrides: Partial<UploadedMedia> = {}): UploadedMedia {
  return {
    id: 'media-1',
    name: 'source.png',
    type: 'image',
    url: 'https://media.test/old',
    thumbnailUrl: null,
    meta: 'PNG · 2×2',
    favorite: false,
    mediaRole: 'other',
    tags: [],
    collectionIds: [],
    metadata: { contentFingerprint: fingerprint },
    storagePath: 'user/source.png',
    revision: 1,
    urlExpiresAt: Date.now() + 60 * 60 * 1000,
    ...overrides,
  }
}

function item(): PixGridDeckItemDefinition {
  return {
    id: 'item-1',
    mediaId: 'media-1',
    enabled: true,
    order: 0,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint,
      fileName: 'source.png',
      mimeType: 'image/png',
      width: 2,
      height: 2,
      hasAlpha: true,
      transparentBackground: '#123456',
    },
  }
}

describe('PixGrid Deck media source resolver', () => {
  beforeEach(() => {
    runtime.items = [media()]
    runtime.ensureMediaSigned.mockReset()
    runtime.retryMediaAsset.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes an expiring signed URL before reading source bytes', async () => {
    runtime.items = [media({ urlExpiresAt: Date.now() + 1_000 })]
    runtime.ensureMediaSigned.mockImplementation(async () => {
      runtime.items = [media({ url: 'https://media.test/signed', urlExpiresAt: Date.now() + 60 * 60 * 1000 })]
    })
    const fetchMock = vi.fn(async () => new Response(new Blob(['pixels'], { type: 'image/png' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await resolvePixGridDeckMediaSource(item(), new AbortController().signal)

    expect(runtime.ensureMediaSigned).toHaveBeenCalledWith(['media-1'], 'visible')
    expect(fetchMock).toHaveBeenCalledWith('https://media.test/signed', expect.objectContaining({ cache: 'force-cache' }))
    expect(await blob.text()).toBe('pixels')
  })

  it('recovers once from an expired signed URL response', async () => {
    runtime.retryMediaAsset.mockImplementation(async () => {
      runtime.items = [media({ url: 'https://media.test/refreshed' })]
      return true
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(new Blob(['fresh'], { type: 'image/png' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const blob = await resolvePixGridDeckMediaSource(item(), new AbortController().signal)

    expect(runtime.retryMediaAsset).toHaveBeenCalledWith('media-1', 'original')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://media.test/refreshed', expect.any(Object))
    expect(await blob.text()).toBe('fresh')
  })

  it('rejects a media record that no longer matches the immutable Deck source snapshot', async () => {
    runtime.items = [media({ metadata: { contentFingerprint: `sha256:${'b'.repeat(64)}` } })]
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolvePixGridDeckMediaSource(item(), new AbortController().signal)).rejects.toMatchObject({
      code: 'source-unavailable',
      retryable: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized response before materializing its body', async () => {
    const response = new Response(new Blob(['small']), {
      status: 200,
      headers: { 'content-length': String(PIX_GRID_DECK_MAX_SOURCE_BYTES + 1) },
    })
    const blobSpy = vi.spyOn(response, 'blob')
    vi.stubGlobal('fetch', vi.fn(async () => response))

    await expect(resolvePixGridDeckMediaSource(item(), new AbortController().signal)).rejects.toMatchObject({
      code: 'source-too-large',
      retryable: false,
    })
    expect(blobSpy).not.toHaveBeenCalled()
  })
})
