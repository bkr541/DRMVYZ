import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../components/vyzualz/react/ReactTypes'
import { clearSvgVisualCache, getSvgVisualEntry } from '../components/vyzualz/react/renderers/svgVisualCache'
import { getSvgGlyphAssetId } from '../components/vyzualz/react/svgSourceLifecycle'
import type { UploadedMedia } from './mediaStore'
import { useMediaStore } from './mediaStore'
import { migrateReactStore, useReactStore } from './reactStore'

const SVG_A = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L10 10"/></svg>'
const SVG_B = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>'

function media(id: string): UploadedMedia {
  return {
    id,
    name: `${id}.svg`,
    title: id.toUpperCase(),
    type: 'image',
    url: `https://example.test/${id}.svg`,
    thumbnailUrl: null,
    meta: 'SVG',
    favorite: false,
    mediaRole: 'svg',
    mimeType: 'image/svg+xml',
    tags: [],
    collectionIds: [],
    metadata: {},
  }
}

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 640
  naturalHeight = 360
  private _src = ''

  set src(value: string) {
    this._src = value
    queueMicrotask(() => this.onload?.())
  }

  get src(): string {
    return this._src
  }
}

function response(svg: string): Response {
  return { ok: true, text: async () => svg } as Response
}

beforeEach(() => {
  clearSvgVisualCache()
  useMediaStore.setState({ items: [media('a'), media('b')] })
  useReactStore.setState({
    oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS },
    oscillatorGlyphAssets: [],
    oscillatorGlyphPointCache: {},
    glyphLostNotice: null,
  })
  vi.stubGlobal('Image', MockImage)
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${Math.random()}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  clearSvgVisualCache()
})



describe('unified SVG persistence migration', () => {
  it('converts only media-backed legacy glyph selections', () => {
    const mediaBacked = migrateReactStore({
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'svgGlyph',
        selectedGlyphId: getSvgGlyphAssetId('a'),
      },
    }, 1)
    expect(mediaBacked.oscillatorSettings).toMatchObject({
      sourceType: 'svg',
      selectedSvgId: 'a',
      svgRenderMode: 'reactivePath',
    })

    const customGlyph = migrateReactStore({
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'svgGlyph',
        selectedGlyphId: 'custom-library-glyph',
      },
    }, 1)
    expect(customGlyph.oscillatorSettings).toMatchObject({
      sourceType: 'svgGlyph',
      selectedGlyphId: 'custom-library-glyph',
    })
  })
})

describe('unified SVG rehydration', () => {
  it('restores persisted glyph points before media load and artwork after the media item arrives', async () => {
    useMediaStore.setState({ items: [] })
    useReactStore.getState().addAndCacheMediaSvgGlyph('a', SVG_A, 'A')
    useReactStore.setState({
      oscillatorGlyphPointCache: {},
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'svg',
        selectedSvgId: 'a',
        svgRenderMode: 'originalArtwork',
      },
    })
    const before = useReactStore.getState().oscillatorSettings

    await useReactStore.getState().rehydrateSvgAsset('a')

    expect(Object.keys(useReactStore.getState().oscillatorGlyphPointCache).length).toBeGreaterThan(0)
    expect(getSvgVisualEntry('a')?.error).toBe('Media item not found')
    expect(useReactStore.getState().oscillatorSettings).toEqual(before)

    vi.stubGlobal('fetch', vi.fn(async () => response(SVG_A)))
    useMediaStore.setState({ items: [media('a')] })
    await useReactStore.getState().rehydrateSvgAsset('a')

    expect(getSvgVisualEntry('a')).toMatchObject({ loaded: true, error: null })
    expect(useReactStore.getState().oscillatorSettings).toEqual(before)
  })

  it('rebuilds artwork and glyph caches without changing source, selection, or render mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(SVG_A)))
    useReactStore.setState({
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'svg',
        selectedSvgId: 'a',
        svgRenderMode: 'originalArtwork',
      },
    })
    const before = useReactStore.getState().oscillatorSettings

    await useReactStore.getState().rehydrateSvgAsset('a')

    expect(useReactStore.getState().oscillatorSettings).toEqual(before)
    expect(getSvgVisualEntry('a')).toMatchObject({ loaded: true, loading: false, error: null })
    expect(useReactStore.getState().oscillatorGlyphAssets.some(
      asset => asset.id === getSvgGlyphAssetId('a'),
    )).toBe(true)
    expect(Object.keys(useReactStore.getState().oscillatorGlyphPointCache).length).toBeGreaterThan(0)
  })
})

describe('unified SVG selection ordering', () => {
  it('never lets an older async selection overwrite a newer selection', async () => {
    let resolveA!: (value: Response) => void
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/a.svg')) {
        return new Promise<Response>(resolve => { resolveA = resolve })
      }
      return Promise.resolve(response(SVG_B))
    })
    vi.stubGlobal('fetch', fetchMock)

    useReactStore.setState({
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'svg',
        selectedSvgId: null,
        svgRenderMode: 'originalArtwork',
      },
    })

    const older = useReactStore.getState().selectSvgAsset('a')
    const newer = useReactStore.getState().selectSvgAsset('b')
    await newer

    expect(useReactStore.getState().oscillatorSettings).toMatchObject({
      sourceType: 'svg',
      selectedSvgId: 'b',
      svgRenderMode: 'originalArtwork',
    })

    resolveA(response(SVG_A))
    await older

    expect(useReactStore.getState().oscillatorSettings).toMatchObject({
      sourceType: 'svg',
      selectedSvgId: 'b',
      svgRenderMode: 'originalArtwork',
    })
    expect(getSvgVisualEntry('b')?.loaded).toBe(true)
  })
})
