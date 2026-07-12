// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearMediaGenerationCaches,
  generateThumbnail,
  getMediaGenerationCacheStats,
  MAX_GENERATED_THUMBNAILS,
} from './generateThumbnail'

class ImmediateImage {
  static created = 0
  naturalWidth = 640
  naturalHeight = 360
  crossOrigin = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { ImmediateImage.created += 1 }
  set src(_value: string) { queueMicrotask(() => this.onload?.()) }
}

describe('generated media caches', () => {
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    clearMediaGenerationCaches()
    ImmediateImage.created = 0
    vi.stubGlobal('Image', ImmediateImage)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => 'data:image/jpeg;base64,thumb',
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName)
    }) as typeof document.createElement)
  })

  afterEach(() => {
    clearMediaGenerationCaches()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keys entries by a stable media identity rather than a rotating signed URL', async () => {
    const first = await generateThumbnail('https://signed.test/one?token=1', 'image', 'user-1/media-1/original')
    const second = await generateThumbnail('https://signed.test/one?token=2', 'image', 'user-1/media-1/original')
    expect(first.thumbnailObjectUrl).toBe(second.thumbnailObjectUrl)
    expect(ImmediateImage.created).toBe(1)
    expect(getMediaGenerationCacheStats().thumbnails).toBe(1)
  })

  it('evicts the least-recently-used generated thumbnail at the explicit bound', async () => {
    for (let index = 0; index < MAX_GENERATED_THUMBNAILS; index += 1) {
      await generateThumbnail(`https://signed.test/${index}`, 'image', `user-1/media-${index}/original`)
    }
    await generateThumbnail('https://signed.test/0-refresh', 'image', 'user-1/media-0/original')
    await generateThumbnail('https://signed.test/new', 'image', 'user-1/media-new/original')
    const beforeReload = ImmediateImage.created
    await generateThumbnail('https://signed.test/1-refresh', 'image', 'user-1/media-1/original')
    expect(getMediaGenerationCacheStats().thumbnails).toBe(MAX_GENERATED_THUMBNAILS)
    expect(ImmediateImage.created).toBe(beforeReload + 1)
  })

  it('does not poison the cache when generation fails', async () => {
    class FailingThenWorkingImage extends ImmediateImage {
      static attempts = 0
      set src(_value: string) {
        FailingThenWorkingImage.attempts += 1
        queueMicrotask(() => {
          if (FailingThenWorkingImage.attempts === 1) this.onerror?.()
          else this.onload?.()
        })
      }
    }
    vi.stubGlobal('Image', FailingThenWorkingImage)
    const first = await generateThumbnail('https://signed.test/fail', 'image', 'user-1/media-fail/original')
    const second = await generateThumbnail('https://signed.test/retry', 'image', 'user-1/media-fail/original')
    expect(first.thumbnailObjectUrl).toBeNull()
    expect(second.thumbnailObjectUrl).toContain('data:image/jpeg')
    expect(FailingThenWorkingImage.attempts).toBe(2)
  })
})
