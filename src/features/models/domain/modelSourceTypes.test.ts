import { describe, expect, it } from 'vitest'
import { isModelSourceImage } from './modelSourceTypes'

describe('isModelSourceImage', () => {
  it('accepts SVG, PNG, JPEG and WebP images', () => {
    for (const mimeType of ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'IMAGE/PNG']) expect(isModelSourceImage({ type: 'image', mimeType }), mimeType).toBe(true)
  })
  it('rejects a GIF, and anything that is not an image', () => {
    expect(isModelSourceImage({ type: 'image', mimeType: 'image/gif' })).toBe(false)
    expect(isModelSourceImage({ type: 'video', mimeType: 'video/mp4' })).toBe(false)
    expect(isModelSourceImage({ type: 'video', mimeType: 'image/png' })).toBe(false)
  })
  it('lets the saved MIME type decide over the file name', () => {
    expect(isModelSourceImage({ type: 'image', mimeType: 'image/gif', name: 'logo.png' })).toBe(false)
  })
  it('falls back to the file extension when there is no MIME type', () => {
    expect(isModelSourceImage({ type: 'image', storagePath: 'user/abc/logo.WEBP' })).toBe(true)
    expect(isModelSourceImage({ type: 'image', name: 'logo.jpeg' })).toBe(true)
    expect(isModelSourceImage({ type: 'image', name: 'anim.gif' })).toBe(false)
    expect(isModelSourceImage({ type: 'image', name: 'noextension' })).toBe(false)
  })
})
