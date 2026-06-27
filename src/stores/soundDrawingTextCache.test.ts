import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  parseFont: vi.fn(),
  sampleText: vi.fn(),
}))

vi.mock('../components/vyzualz/react/renderers/fontGlyphUtils', () => ({
  parseOpenTypeFontFromAsset: h.parseFont,
  textToOpenTypeGlyphPoints: h.sampleText,
  evictFontFromCache: vi.fn(),
  inspectFontFile: vi.fn(),
  storeFontRuntime: vi.fn(),
  hasFontRuntime: vi.fn(() => true),
  getBufferFromCache: vi.fn(() => null),
}))

import { DEFAULT_OSCILLATOR_SETTINGS } from '../components/vyzualz/react/ReactTypes'
import type { OscillatorFontAsset, SoundDrawingLayer } from '../components/vyzualz/react/ReactTypes'
import { useReactStore } from './reactStore'

const font: OscillatorFontAsset = {
  id: 'font-layer',
  name: 'Layer Font',
  fileName: 'LayerFont.ttf',
  storagePath: 'user/font-layer/font.ttf',
  mimeType: 'font/ttf',
  fileSize: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const layer: SoundDrawingLayer = {
  id: 'layer-1',
  name: 'Saved title',
  enabled: true,
  sourceType: 'text',
  text: 'LAYER TEXT',
  fontId: font.id,
  letterSpacing: 7,
  lineHeight: 1.4,
  alignment: 'right',
  svgId: null,
  shape: 'circle',
  x: 0.25,
  y: -0.3,
  scale: 1.5,
  rotation: 18,
  oscillatorOverride: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  h.parseFont.mockReturnValue({ familyName: 'Mock' })
  h.sampleText.mockImplementation((_font, _text, resolution) => [
    { x: resolution, y: 0, pathIndex: 0 },
  ])
  useReactStore.setState({
    oscillatorSettings: {
      ...DEFAULT_OSCILLATOR_SETTINGS,
      sourceType: 'builtinShape',
      pathResolution: 512,
    },
    oscillatorFontAssets: [font],
    oscillatorTextPointCache: {},
    soundDrawingLayersByTrackId: { 'track-1': [layer] },
  })
})

describe('Sound Drawing saved text cache invalidation', () => {
  it('rebuilds saved layer text points when global path resolution changes', () => {
    useReactStore.getState().setOscillatorSettings({ pathResolution: 1024 })

    expect(h.sampleText).toHaveBeenCalledWith(
      expect.anything(),
      'LAYER TEXT',
      1024,
      { letterSpacing: 7, lineHeight: 1.4, alignment: 'right' },
    )
    expect(useReactStore.getState().oscillatorTextPointCache)
      .toHaveProperty('font-layer:LAYER TEXT:7:1.4:right:1024')

    const stored = useReactStore.getState().soundDrawingLayersByTrackId['track-1'][0]
    expect(stored).toMatchObject({
      text: 'LAYER TEXT',
      fontId: 'font-layer',
      x: 0.25,
      y: -0.3,
      scale: 1.5,
      rotation: 18,
    })
  })

  it('does not rebuild point geometry for a non-geometry setting change', () => {
    useReactStore.getState().setOscillatorSettings({ pathScale: 1.2 })
    expect(h.sampleText).not.toHaveBeenCalled()
  })

  it('uses a layer oscillator override when it defines its own resolution', () => {
    useReactStore.setState({
      soundDrawingLayersByTrackId: {
        'track-1': [{ ...layer, oscillatorOverride: { pathResolution: 256 } }],
      },
    })

    useReactStore.getState().setOscillatorSettings({ pathResolution: 1024 })

    expect(h.sampleText).toHaveBeenCalledWith(
      expect.anything(),
      'LAYER TEXT',
      256,
      expect.anything(),
    )
    expect(useReactStore.getState().oscillatorTextPointCache)
      .toHaveProperty('font-layer:LAYER TEXT:7:1.4:right:256')
  })
})
