// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PIX_GRID_DECK_MAX_SOURCE_BYTES,
  validatePixGridDeckSourceFile,
} from '../PixGridDeckMediaValidation'

const fixtureRoot = new URL('../../../../../test/fixtures/pixGridDeck/', import.meta.url)

function fixture(name: string, type: string, fileName = name): File {
  return new File([readFileSync(new URL(name, fixtureRoot))], fileName, { type })
}

function pngWithDimensions(width: number, height: number): File {
  const bytes = new Uint8Array(readFileSync(new URL('opaque.png', fixtureRoot)))
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width, false)
  view.setUint32(20, height, false)
  return new File([bytes], `${width}x${height}.png`, { type: 'image/png' })
}

describe('PixGrid Deck source validation', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async (source: ImageBitmapSource) => {
      const fileName = source instanceof File ? source.name : ''
      if (fileName === 'corrupt-decode.png') throw new Error('decode failed')
      return { width: 2, height: 2, close: vi.fn() } as unknown as ImageBitmap
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['opaque.png', 'image/png'],
    ['static.webp', 'image/webp'],
    ['safe.svg', 'image/svg+xml'],
  ])('accepts content-verified static source %s', async (name, type) => {
    const result = await validatePixGridDeckSourceFile(fixture(name, type, name.toUpperCase()))
    expect(result).toMatchObject({ ok: true, source: { mimeType: type } })
    if (result.ok) expect(result.source.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('accepts JPEG extension and MIME aliases after content verification', async () => {
    expect(await validatePixGridDeckSourceFile(fixture('photo.jpg', 'image/jpeg', 'photo.JPEG'))).toMatchObject({
      ok: true, source: { mimeType: 'image/jpeg', extension: 'jpg' },
    })
    expect(await validatePixGridDeckSourceFile(fixture('photo.jpg', 'image/jpg', 'photo.JPG'))).toMatchObject({
      ok: true, source: { mimeType: 'image/jpeg', extension: 'jpg' },
    })
  })

  it('detects alpha-bearing PNG and treats SVG preparation as transparent', async () => {
    const png = await validatePixGridDeckSourceFile(fixture('transparent.png', 'image/png'))
    const svg = await validatePixGridDeckSourceFile(fixture('safe.svg', 'image/svg+xml'))
    expect(png).toMatchObject({ ok: true, source: { hasAlpha: true, width: 2, height: 2 } })
    expect(svg).toMatchObject({ ok: true, source: { hasAlpha: true, width: 2, height: 2 } })
  })

  it('rejects animated WebP and unsafe or externally linked SVG content', async () => {
    expect(await validatePixGridDeckSourceFile(fixture('animated.webp', 'image/webp'))).toMatchObject({
      ok: false, error: { code: 'animated-image' },
    })
    expect(await validatePixGridDeckSourceFile(fixture('animated.svg', 'image/svg+xml'))).toMatchObject({
      ok: false, error: { code: 'unsafe-svg' },
    })
    expect(await validatePixGridDeckSourceFile(fixture('external.svg', 'image/svg+xml'))).toMatchObject({
      ok: false, error: { code: 'external-svg-resource' },
    })
    expect(await validatePixGridDeckSourceFile(new File([
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ], 'script.svg', { type: 'image/svg+xml' }))).toMatchObject({
      ok: false, error: { code: 'unsafe-svg' },
    })
  })

  it('rejects extension spoofing, MIME spoofing, GIF, and corrupt headers', async () => {
    expect(await validatePixGridDeckSourceFile(fixture('opaque.png', 'image/png', 'fake.jpg'))).toMatchObject({
      ok: false, error: { code: 'extension-mismatch' },
    })
    expect(await validatePixGridDeckSourceFile(fixture('opaque.png', 'image/jpeg'))).toMatchObject({
      ok: false, error: { code: 'mime-mismatch' },
    })
    expect(await validatePixGridDeckSourceFile(new File(['GIF89a'], 'animated.gif', { type: 'image/gif' }))).toMatchObject({
      ok: false, error: { code: 'unsupported-format' },
    })
    expect(await validatePixGridDeckSourceFile(new File(['not an image'], 'broken.png', { type: 'image/png' }))).toMatchObject({
      ok: false, error: { code: 'corrupt-image' },
    })
    expect(await validatePixGridDeckSourceFile(fixture('corrupt-decode.png', 'image/png'))).toMatchObject({
      ok: false, error: { code: 'corrupt-image' },
    })
  })

  it('enforces source bytes, dimensions, and decoded pixel limits before upload', async () => {
    const oversized = new File([new Uint8Array(PIX_GRID_DECK_MAX_SOURCE_BYTES + 1)], 'large.png', { type: 'image/png' })
    expect(await validatePixGridDeckSourceFile(oversized)).toMatchObject({
      ok: false, error: { code: 'file-too-large' },
    })
    expect(await validatePixGridDeckSourceFile(pngWithDimensions(8193, 1))).toMatchObject({
      ok: false, error: { code: 'raster-dimension-limit' },
    })
    expect(await validatePixGridDeckSourceFile(pngWithDimensions(8192, 4097))).toMatchObject({
      ok: false, error: { code: 'decoded-pixel-limit' },
    })
  })
})
