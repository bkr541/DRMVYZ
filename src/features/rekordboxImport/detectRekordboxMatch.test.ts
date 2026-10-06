import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileHasRekordboxMatch } from './detectRekordboxMatch'
import type { RekordboxLibrary } from './types'

const library = {
  id: 'lib', source: 'rekordbox_usb', importedAt: '', warnings: [],
  stats: { totalTracks: 1, tracksWithCues: 0, cues: 0, loops: 0, detectedPdbFiles: 1, detectedAnlzFiles: 0 },
  tracks: [{ trackId: '1', name: 'Song', location: '/Volumes/DJ/Contents/Artist/song.mp3', filename: 'song.mp3' }],
} as unknown as RekordboxLibrary

function fileAt(name: string, path: string | null): File {
  const file = new File(['x'], name)
  vi.stubGlobal('window', { drmvyzNative: { files: { getPathForFile: () => path }, rekordbox: { scanUsbRoot: scan } } })
  return file
}
const scan = vi.fn(async () => ({ cancelled: false, library, warnings: [], detectedPdbFiles: 1, detectedAnlzFiles: 0 }))

afterEach(() => { vi.unstubAllGlobals(); scan.mockClear() })

describe('fileHasRekordboxMatch', () => {
  it('is true for a file on a USB whose Rekordbox library lists it, scanning each USB once', async () => {
    const cache = new Map()
    expect(await fileHasRekordboxMatch(fileAt('song.mp3', '/Volumes/DJ/Contents/Artist/song.mp3'), cache)).toBe(true)
    expect(await fileHasRekordboxMatch(fileAt('song.mp3', '/Volumes/DJ/Contents/Artist/song.mp3'), cache)).toBe(true)
    expect(scan).toHaveBeenCalledTimes(1)
  })

  it('is false when the library has no matching track', async () => {
    expect(await fileHasRekordboxMatch(fileAt('other.mp3', '/Volumes/DJ/Contents/Artist/other.mp3'))).toBe(false)
  })

  it('is false without a USB path or when the scan fails', async () => {
    expect(await fileHasRekordboxMatch(fileAt('song.mp3', '/Users/me/Music/song.mp3'))).toBe(false)
    scan.mockRejectedValueOnce(new Error('boom'))
    expect(await fileHasRekordboxMatch(fileAt('song.mp3', '/Volumes/DJ/song.mp3'))).toBe(false)
  })
})
