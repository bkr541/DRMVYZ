import { describe, expect, it } from 'vitest'
import { extractArtistFromAudioMetadata, formatDetectedMusicalKey } from './analyzeAudioFile'

describe('upload audio metadata formatting', () => {
  it('formats detected keys for the upload Key dropdown', () => {
    expect(formatDetectedMusicalKey('C', 'major')).toBe('C')
    expect(formatDetectedMusicalKey('C#', 'major')).toBe('C#/Db')
    expect(formatDetectedMusicalKey('C#', 'minor')).toBe('C#m/Dbm')
    expect(formatDetectedMusicalKey('A', 'minor')).toBe('Am')
    expect(formatDetectedMusicalKey(null, null)).toBeNull()
  })

  it('extracts an artist from an ID3v2 artist frame', () => {
    const artist = new TextEncoder().encode('Test Artist')
    const frameSize = artist.length + 1
    const tagSize = 10 + frameSize
    const bytes = new Uint8Array(10 + tagSize)
    bytes.set(new TextEncoder().encode('ID3'), 0)
    bytes[3] = 3
    bytes[9] = tagSize
    bytes.set(new TextEncoder().encode('TPE1'), 10)
    bytes[17] = frameSize
    bytes[20] = 3
    bytes.set(artist, 21)

    expect(extractArtistFromAudioMetadata(bytes.buffer)).toBe('Test Artist')
  })

  it('returns null when an audio file has no embedded artist metadata', () => {
    expect(extractArtistFromAudioMetadata(new Uint8Array([1, 2, 3]).buffer)).toBeNull()
  })
})
