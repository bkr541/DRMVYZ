import { describe, expect, it } from 'vitest'
import { describeTrackForLog } from './trackLogContext'

describe('describeTrackForLog', () => {
  it('names the file with its size, type, modified time and source, and keeps only the URL scheme', () => {
    const file = new File([new Uint8Array(4096)], 'Open Decks - Track.wav', { type: 'audio/wav', lastModified: Date.UTC(2026, 10, 22, 18, 20) })
    const context = describeTrackForLog({ id: 'abc', name: 'Open Decks - Track.wav', url: 'blob:http://127.0.0.1:5173/secret-id', sourceKind: 'file', sourceFile: file, isRekordbox: true })
    expect(context).toEqual({
      trackId: 'abc', fileName: 'Open Decks - Track.wav', fileSizeBytes: 4096, fileType: 'audio/wav', fileModified: '2026-11-22T18:20:00.000Z',
      sourceKind: 'file', urlScheme: 'blob', isRekordbox: true, looksLikeSidecarStub: false,
    })
    expect(JSON.stringify(context)).not.toContain('secret-id')
  })

  it('flags a macOS "._" sidecar stub, which carries an audio extension but no audio', () => {
    expect(describeTrackForLog({ id: 'x', name: '._Track.mp3', sourceKind: 'file' }).looksLikeSidecarStub).toBe(true)
    expect(describeTrackForLog({ id: 'x', name: 'Track.mp3', sourceKind: 'file' }).looksLikeSidecarStub).toBe(false)
  })

  it('never carries a signed remote URL, and falls back to the track name and a supplied id', () => {
    const context = describeTrackForLog({ name: 'Saved.wav', url: 'https://project.supabase.co/storage/v1/object/sign/x?token=SECRET', sourceKind: 'remote' }, 'fallback-id')
    expect(context).toMatchObject({ trackId: 'fallback-id', fileName: 'Saved.wav', urlScheme: 'https', fileSizeBytes: null, sourceKind: 'remote' })
    expect(JSON.stringify(context)).not.toContain('SECRET')
  })

  it('still returns a complete record when the track is gone', () => {
    expect(describeTrackForLog(null, 'gone')).toMatchObject({ trackId: 'gone', fileName: null, urlScheme: null, isRekordbox: false, looksLikeSidecarStub: false })
    expect(describeTrackForLog(undefined).trackId).toBeNull()
  })
})
