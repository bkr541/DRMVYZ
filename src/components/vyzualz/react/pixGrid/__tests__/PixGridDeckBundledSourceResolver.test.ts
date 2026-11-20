import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PixGridDeckItemDefinition } from '../PixGridDeckDomain'
import { PIX_GRID_DECK_MAX_SOURCE_BYTES } from '../PixGridDeckMediaValidation'

vi.mock('../../../../../stores/mediaStore', () => ({ useMediaStore: { getState: () => ({ items: [] }) } }))
vi.mock('../PixGridPresetRegistry', () => ({
  resolvePixGridRegisteredSequenceSource: () => null,
  resolvePixGridRegisteredBundledSource: (mediaId: string) => mediaId === 'bundled-1' ? { url: '/pixgrid-decks/neon/01.png', mimeType: 'image/png' } : null,
}))

import { resolvePixGridDeckMediaSource } from '../PixGridDeckMediaSourceResolver'

const item = (mediaId: string): PixGridDeckItemDefinition => ({
  id: 'item-1', mediaId, enabled: true, order: 0, revision: 1, timingOverrideBeats: null,
  source: { mediaRevision: 1, fingerprint: `sha256:${'a'.repeat(64)}`, fileName: '01.png', mimeType: 'image/png', width: 2, height: 2, hasAlpha: false, transparentBackground: '#000000' },
})

afterEach(() => vi.unstubAllGlobals())

describe('shipped Deck image source', () => {
  it('fetches the bundled file with no Media Library lookup and returns it as the declared type', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4])))
    vi.stubGlobal('fetch', fetchMock)
    const blob = await resolvePixGridDeckMediaSource(item('bundled-1'), new AbortController().signal)
    expect(fetchMock).toHaveBeenCalledWith('/pixgrid-decks/neon/01.png', expect.objectContaining({ cache: 'force-cache' }))
    expect(blob.size).toBe(4)
    expect(blob.type).toBe('image/png')
  })

  it('reports a missing or oversized bundled file as a compile error instead of throwing raw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })))
    await expect(resolvePixGridDeckMediaSource(item('bundled-1'), new AbortController().signal)).rejects.toMatchObject({ code: 'source-load-failed', message: expect.stringContaining('404') })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(PIX_GRID_DECK_MAX_SOURCE_BYTES + 1))))
    await expect(resolvePixGridDeckMediaSource(item('bundled-1'), new AbortController().signal)).rejects.toMatchObject({ code: 'source-too-large' })
  })

  it('reports a cancelled load as cancelled', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); throw new DOMException('aborted', 'AbortError') }))
    await expect(resolvePixGridDeckMediaSource(item('bundled-1'), controller.signal)).rejects.toMatchObject({ code: 'cancelled' })
  })
})
