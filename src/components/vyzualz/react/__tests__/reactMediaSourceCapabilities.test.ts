import { describe, expect, it } from 'vitest'
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
  it('exposes canonical media selection only for compatible engines', () => {
    expect(getReactMediaSourceCapability('oscilloscope')).toBeNull()
    expect(getReactMediaSourceCapability('xyScope')).toBeNull()
    expect(getReactMediaSourceCapability('cinematicPortal')).toBeNull()
    expect(getReactMediaSourceCapability('shaderPads')).toBeNull()
    expect(getReactMediaSourceCapability('laserDmx')).toBeNull()
    expect(getReactMediaSourceCapability('canvas')).toBeNull()
    expect(getReactMediaSourceCapability('pixGrid')).toBe('pixGridStill')
  })

  it('routes PixGrid source identity through compact conversion state', () => {
    const state = useReactStore.getState().pixGridState
    const pixGrid = { ...state, conversion: { ...state.conversion, selectedMediaId: pngMedia.id } }
    expect(getReactMediaSourceId('pixGridStill', pixGrid)).toBe(pngMedia.id)
    expect(getReactMediaDisabledReason('pixGridStill', pngMedia)).toBeNull()
    expect(getReactMediaDisabledReason('pixGridStill', { ...pngMedia, type: 'video', mimeType: 'video/mp4' })).toContain('not video')
  })

  it('disables incompatible media instead of presenting a false selection', () => {
    expect(getReactMediaDisabledReason(null, svgMedia)).toContain('does not consume')
  })
})
