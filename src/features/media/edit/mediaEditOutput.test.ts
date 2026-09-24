import { describe, expect, it } from 'vitest'
import {
  baseMimeType,
  chooseImageOutputFormat,
  extensionForMime,
  fileNameForTitle,
  pickVideoExportFormat,
  stripExtension,
  suggestEditedTitle,
  validateMediaName,
  withExtension,
} from './mediaEditOutput'

const supports = (...mimes: string[]) => (mime: string) => mimes.includes(mime)

describe('image output format', () => {
  it('keeps the source family and never labels bytes with a different type', () => {
    expect(chooseImageOutputFormat('image/jpeg', false)).toMatchObject({ mimeType: 'image/jpeg', extension: 'jpg' })
    expect(chooseImageOutputFormat('image/webp', false)).toMatchObject({ mimeType: 'image/webp', extension: 'webp' })
    expect(chooseImageOutputFormat('image/png', false)).toMatchObject({ mimeType: 'image/png', extension: 'png' })
    expect(chooseImageOutputFormat(null, false)).toMatchObject({ mimeType: 'image/png', extension: 'png' })
  })

  it('switches JPEG to PNG when transparency is required, since JPEG cannot hold it', () => {
    expect(chooseImageOutputFormat('image/jpeg', true)).toMatchObject({ mimeType: 'image/png', extension: 'png', supportsAlpha: true })
  })

  it('every image extension matches its MIME type', () => {
    for (const source of ['image/jpeg', 'image/webp', 'image/png', 'image/avif', 'image/bmp']) {
      const format = chooseImageOutputFormat(source, true)
      expect(extensionForMime(format.mimeType)).toBe(format.extension)
    }
  })
})

describe('video output format', () => {
  const all = supports(
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm',
  )

  it('prefers the source container when this runtime can record it', () => {
    expect(pickVideoExportFormat('video/mp4', true, all)).toMatchObject({ container: 'mp4', mimeType: 'video/mp4', extension: 'mp4' })
    expect(pickVideoExportFormat('video/quicktime', true, all)).toMatchObject({ container: 'mp4', extension: 'mp4' })
    expect(pickVideoExportFormat('video/webm', true, all)).toMatchObject({ container: 'webm', mimeType: 'video/webm', extension: 'webm' })
  })

  it('falls back honestly to the other container, with an extension that matches it', () => {
    const webmOnly = supports('video/webm;codecs=vp9,opus', 'video/webm')
    const choice = pickVideoExportFormat('video/mp4', true, webmOnly)
    expect(choice).toMatchObject({ container: 'webm', mimeType: 'video/webm', extension: 'webm' })
    const mp4Only = supports('video/mp4;codecs=avc1', 'video/mp4')
    expect(pickVideoExportFormat('video/webm', false, mp4Only)).toMatchObject({ container: 'mp4', mimeType: 'video/mp4', extension: 'mp4' })
  })

  it('always pairs mimeType and extension, and reports null when nothing can be recorded', () => {
    for (const source of ['video/mp4', 'video/webm', 'video/quicktime', null]) {
      for (const audio of [true, false]) {
        const choice = pickVideoExportFormat(source, audio, all)!
        expect(extensionForMime(choice.mimeType)).toBe(choice.extension)
        expect(baseMimeType(choice.recorderMime)).toBe(choice.mimeType)
      }
    }
    expect(pickVideoExportFormat('video/mp4', true, () => false)).toBeNull()
  })

  it('asks for an audio codec only when there is audio to carry', () => {
    const seen: string[] = []
    pickVideoExportFormat('video/mp4', false, mime => { seen.push(mime); return false })
    expect(seen.some(mime => mime.includes('mp4a') || mime.includes('opus'))).toBe(false)
    const withAudio: string[] = []
    pickVideoExportFormat('video/mp4', true, mime => { withAudio.push(mime); return false })
    expect(withAudio[0]).toContain('mp4a')
  })
})

describe('names', () => {
  it('suggests a derivative of the existing title', () => {
    expect(suggestEditedTitle('Sunset')).toBe('Sunset (edited)')
    expect(suggestEditedTitle('   ')).toBe('Edited media')
  })

  it('trims and rejects blank or obviously invalid names', () => {
    expect(validateMediaName('  My  clip  ')).toEqual({ ok: true, name: 'My clip' })
    expect(validateMediaName('   ').ok).toBe(false)
    expect(validateMediaName('a/b').ok).toBe(false)
    expect(validateMediaName('bad:name').ok).toBe(false)
    expect(validateMediaName('tab\tname').ok).toBe(false)
    expect(validateMediaName('...').ok).toBe(false)
    expect(validateMediaName('x'.repeat(500)).ok).toBe(false)
    expect(validateMediaName('Sunset v2.1')).toEqual({ ok: true, name: 'Sunset v2.1' })
  })

  it('builds file names whose extension agrees with the bytes', () => {
    expect(withExtension('clip.mov', 'mp4')).toBe('clip.mp4')
    expect(stripExtension('photo.final.JPG')).toBe('photo.final')
    expect(fileNameForTitle('Sunset v2.1', 'png')).toBe('Sunset v2.1.png')
    expect(fileNameForTitle('Sunset.PNG', 'png')).toBe('Sunset.PNG')
  })
})
