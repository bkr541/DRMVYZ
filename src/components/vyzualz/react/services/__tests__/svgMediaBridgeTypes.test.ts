import { describe, expect, it } from 'vitest'
import { buildSvgGlyphPrecacheRequest } from '../svgMediaBridgeTypes'

describe('buildSvgGlyphPrecacheRequest', () => {
  it('rejects content that is not SVG markup', () => {
    expect(buildSvgGlyphPrecacheRequest({
      mediaId: 'db-1',
      rawSvg: '<html></html>',
      title: 'Artwork',
      name: 'artwork.svg',
    })).toBeNull()
  })

  it('preserves the media ID and strips the SVG extension from the title', () => {
    expect(buildSvgGlyphPrecacheRequest({
      mediaId: 'db-42',
      rawSvg: '<svg viewBox="0 0 10 10"></svg>',
      title: 'Club Mark.SVG',
      name: 'upload.svg',
    })).toEqual({
      mediaId: 'db-42',
      rawSvg: '<svg viewBox="0 0 10 10"></svg>',
      displayName: 'Club Mark',
    })
  })

  it('uses the existing fallback when the chosen name is empty', () => {
    expect(buildSvgGlyphPrecacheRequest({
      mediaId: 'local-1',
      rawSvg: '<SVG></SVG>',
      title: '.svg',
      name: 'ignored.svg',
    })?.displayName).toBe('SVG Glyph')
  })
})
