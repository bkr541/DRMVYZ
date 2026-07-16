import { beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import {
  getReactMediaDisabledReason,
  getReactMediaSourceCapability,
  getReactMediaSourceId,
} from '../reactMediaSourceCapabilities'
import type { UploadedMedia } from '../../../../stores/mediaStore'

const svgMedia = {
  id: 'svg-source-1',
  name: 'logo.svg',
  title: 'Logo',
  mimeType: 'image/svg+xml',
  type: 'image',
  url: 'blob:svg-source-1',
  thumbnailUrl: null,
  meta: 'SVG',
  favorite: false,
  mediaRole: 'svg',
  collectionIds: [],
  tags: [],
  metadata: {},
} as unknown as UploadedMedia

const pngMedia = {
  ...svgMedia,
  id: 'png-source-1',
  name: 'logo.png',
  mimeType: 'image/png',
  mediaRole: 'background_image',
} as unknown as UploadedMedia

describe('React media-source capabilities', () => {
  beforeEach(() => {
    useReactStore.setState(state => ({
      oscillatorSettings: {
        ...state.oscillatorSettings,
        sourceType: 'classic',
        selectedSvgId: null,
      },
    }))
  })

  it('exposes canonical media selection only for compatible engines', () => {
    expect(getReactMediaSourceCapability('oscilloscope')).toBe('soundDrawingSvg')
    expect(getReactMediaSourceCapability('cinematicPortal')).toBeNull()
    expect(getReactMediaSourceCapability('shaderPads')).toBeNull()
    expect(getReactMediaSourceCapability('laserDmx')).toBeNull()
    expect(getReactMediaSourceCapability('canvas')).toBeNull()
    expect(getReactMediaSourceCapability('pixGrid')).toBe('pixGridStill')
  })

  it('routes Sound Drawing media selection into renderer-owned oscillator state', async () => {
    await useReactStore.getState().selectSvgAsset(svgMedia.id)
    const settings = useReactStore.getState().oscillatorSettings
    expect(settings.sourceType).toBe('svg')
    expect(settings.selectedSvgId).toBe(svgMedia.id)
    expect(getReactMediaSourceId('soundDrawingSvg', settings)).toBe(svgMedia.id)
  })


  it('routes PixGrid source identity through compact conversion state', () => {
    const state = useReactStore.getState().pixGridState
    const pixGrid = { ...state, conversion: { ...state.conversion, selectedMediaId: pngMedia.id } }
    expect(getReactMediaSourceId('pixGridStill', useReactStore.getState().oscillatorSettings, pixGrid)).toBe(pngMedia.id)
    expect(getReactMediaDisabledReason('pixGridStill', pngMedia)).toBeNull()
    expect(getReactMediaDisabledReason('pixGridStill', { ...pngMedia, type: 'video', mimeType: 'video/mp4' })).toContain('not video')
  })

  it('disables incompatible media instead of presenting a false selection', () => {
    expect(getReactMediaDisabledReason('soundDrawingSvg', svgMedia)).toBeNull()
    expect(getReactMediaDisabledReason('soundDrawingSvg', pngMedia)).toContain('SVG')
    expect(getReactMediaDisabledReason(null, svgMedia)).toContain('does not consume')
  })
})
