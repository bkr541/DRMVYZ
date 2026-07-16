// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UploadedMedia } from '../../../../../stores/mediaStore'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from '../PixGridDefaults'
import { pixGridPreparedAssetCache, preparePixGridMediaAsset } from '../PixGridAssetPreparation'

const palette = {
  primary: '#00d9ff',
  secondary: '#00d982',
  accent: '#ff3ed1',
  background: '#020508',
  highlight: '#ffffff',
  text: '#dce8ee',
}

const svgMedia = {
  id: 'svg-media',
  name: 'logo.svg',
  type: 'image',
  url: 'https://example.test/logo.svg',
  thumbnailUrl: null,
  meta: 'SVG',
  favorite: false,
  mediaRole: 'svg',
  tags: [],
  collectionIds: [],
  metadata: {},
  mimeType: 'image/svg+xml',
  revision: 7,
} as UploadedMedia

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  pixGridPreparedAssetCache.clear()
})

describe('PixGrid SVG raster lifecycle', () => {
  it('rasterizes at logical resolution, closes ImageBitmap, and reuses the prepared cache', async () => {
    const close = vi.fn()
    const bitmap = { width: 160, height: 90, close } as unknown as ImageBitmap
    const createImageBitmapMock = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#fff"/></svg>'], { type: 'image/svg+xml' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => svgBlob,
    })
    vi.stubGlobal('fetch', fetchMock)

    const drawImage = vi.fn()
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(160 * 90 * 4) }))
    const fakeContext = {
      clearRect: vi.fn(),
      drawImage,
      getImageData,
      imageSmoothingEnabled: false,
    }
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') return originalCreateElement(tagName)
      return {
        width: 0,
        height: 0,
        getContext: () => fakeContext,
      } as unknown as HTMLCanvasElement
    }) as typeof document.createElement)

    const input = {
      media: svgMedia,
      width: 160,
      height: 90,
      settings: { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS, selectedMediaId: svgMedia.id },
      palette,
    }
    const first = await preparePixGridMediaAsset(input)
    const second = await preparePixGridMediaAsset(input)

    expect(first).toBe(second)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createImageBitmapMock).toHaveBeenCalledWith(expect.any(Blob))
    expect(drawImage).toHaveBeenCalled()
    expect(getImageData).toHaveBeenCalledWith(0, 0, 160, 90)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
