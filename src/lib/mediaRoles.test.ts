import { describe, it, expect } from 'vitest'
import { getMediaFormatInfo, getCompatibleMediaRoles, VISUAL_MEDIA_ROLES } from './mediaRoles'

describe('getMediaFormatInfo', () => {
  it('flags a PNG as alpha-capable but not video or svg', () => {
    expect(getMediaFormatInfo('image/png', 'sprite.png')).toEqual({
      isVideo: false, isSvg: false, supportsAlpha: true,
    })
  })

  it('flags a JPEG as neither alpha-capable, video, nor svg', () => {
    expect(getMediaFormatInfo('image/jpeg', 'photo.jpg')).toEqual({
      isVideo: false, isSvg: false, supportsAlpha: false,
    })
  })

  it('flags an MP4 as video and not alpha-capable', () => {
    expect(getMediaFormatInfo('video/mp4', 'clip.mp4')).toEqual({
      isVideo: true, isSvg: false, supportsAlpha: false,
    })
  })

  it('flags an SVG as svg and alpha-capable', () => {
    expect(getMediaFormatInfo('image/svg+xml', 'glyph.svg')).toEqual({
      isVideo: false, isSvg: true, supportsAlpha: true,
    })
  })

  it('falls back to filename extension when the MIME type is blank', () => {
    expect(getMediaFormatInfo('', 'clip.webm')).toEqual({
      isVideo: true, isSvg: false, supportsAlpha: false,
    })
    expect(getMediaFormatInfo('', 'sprite.webp')).toEqual({
      isVideo: false, isSvg: false, supportsAlpha: true,
    })
  })
})

describe('getCompatibleMediaRoles', () => {
  it('excludes Background Video and Transparent Element for a JPEG', () => {
    const roles = getCompatibleMediaRoles(getMediaFormatInfo('image/jpeg', 'photo.jpg'))
    expect(roles).not.toContain('background_video')
    expect(roles).not.toContain('transparent_element')
    expect(roles).not.toContain('svg')
    expect(roles).toContain('background_image')
  })

  it('excludes Background Video, Transparent Element, and SVG for a PNG', () => {
    const roles = getCompatibleMediaRoles(getMediaFormatInfo('image/png', 'sprite.png'))
    expect(roles).not.toContain('background_video')
    expect(roles).not.toContain('svg')
    expect(roles).toContain('transparent_element')
    expect(roles).toContain('background_image')
  })

  it('excludes Background Image, Transparent Element, and SVG for an MP4', () => {
    const roles = getCompatibleMediaRoles(getMediaFormatInfo('video/mp4', 'clip.mp4'))
    expect(roles).not.toContain('background_image')
    expect(roles).not.toContain('transparent_element')
    expect(roles).not.toContain('svg')
    expect(roles).toContain('background_video')
  })

  it('only allows SVG role for an actual SVG file', () => {
    const roles = getCompatibleMediaRoles(getMediaFormatInfo('image/svg+xml', 'glyph.svg'))
    expect(roles).toContain('svg')
    expect(roles).not.toContain('background_video')
  })

  it('never drops role-agnostic options like Logo, Overlay, or Other', () => {
    for (const format of [
      getMediaFormatInfo('image/jpeg', 'photo.jpg'),
      getMediaFormatInfo('image/png', 'sprite.png'),
      getMediaFormatInfo('video/mp4', 'clip.mp4'),
    ]) {
      const roles = getCompatibleMediaRoles(format)
      expect(roles).toContain('logo')
      expect(roles).toContain('overlay')
      expect(roles).toContain('other')
    }
  })

  it('never returns a role outside the full visual role list', () => {
    const roles = getCompatibleMediaRoles(getMediaFormatInfo('image/png', 'sprite.png'))
    for (const role of roles) expect(VISUAL_MEDIA_ROLES).toContain(role)
  })
})
