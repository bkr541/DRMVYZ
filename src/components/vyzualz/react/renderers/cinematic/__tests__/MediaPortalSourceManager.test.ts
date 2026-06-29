// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { UploadedMedia } from '../../../../../../stores/mediaStore'
import { isSupportedMediaPortalSource, MediaPortalSourceManager, normalizeDurableMediaReference } from '../MediaPortalSourceManager'

function media(patch: Partial<UploadedMedia> = {}): UploadedMedia {
  return { id:'media-1', name:'clip.mp4', type:'video', url:'https://example.test/clip.mp4', thumbnailUrl:null, meta:'MP4', favorite:false, mediaRole:'background_video', tags:[], collectionIds:[], metadata:{}, mimeType:'video/mp4', ...patch }
}

describe('MediaPortalSourceManager', () => {
  it('rejects temporary references during saved-state normalization', () => {
    expect(normalizeDurableMediaReference('blob:temporary')).toBeNull()
    expect(normalizeDurableMediaReference('data:image/png;base64,x')).toBeNull()
    expect(normalizeDurableMediaReference('media-123')).toBe('media-123')
  })
  it('validates supported and unsupported source types', () => {
    expect(isSupportedMediaPortalSource(media())).toBe(true)
    expect(isSupportedMediaPortalSource(media({ mimeType:'application/pdf' }))).toBe(false)
  })
  it('configures video loop and muted playback', async () => {
    const original = document.createElement.bind(document)
    const videos: HTMLVideoElement[] = []
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const element = original(tag)
      if (tag === 'video') videos.push(element as HTMLVideoElement)
      return element
    }) as typeof document.createElement)
    const manager = new MediaPortalSourceManager()
    const pending = manager.load(media(), { loop:false, muted:true })
    const video = videos[0]
    expect(video.loop).toBe(false)
    expect(video.muted).toBe(true)
    video.dispatchEvent(new Event('loadeddata'))
    await expect(pending).resolves.toMatchObject({ status:'ready' })
    manager.dispose()
    vi.restoreAllMocks()
  })
  it('rejects an older async load after source replacement', async () => {
    const original = document.createElement.bind(document)
    const videos: HTMLVideoElement[] = []
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const element = original(tag)
      if (tag === 'video') videos.push(element as HTMLVideoElement)
      return element
    }) as typeof document.createElement)
    const manager = new MediaPortalSourceManager()
    const first = manager.load(media({id:'old'}), {loop:true,muted:true})
    const second = manager.load(media({id:'new',url:'https://example.test/new.mp4'}), {loop:true,muted:true})
    videos[0].dispatchEvent(new Event('loadeddata'))
    videos[1].dispatchEvent(new Event('loadeddata'))
    await expect(first).resolves.toMatchObject({status:'error',message:expect.stringContaining('Stale')})
    await expect(second).resolves.toMatchObject({status:'ready',media:expect.objectContaining({id:'new'})})
    manager.dispose(); vi.restoreAllMocks()
  })
  it('cleans object URLs and live tracks', () => {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    const revoke = vi.mocked(URL.revokeObjectURL)
    const stop = vi.fn()
    const manager = new MediaPortalSourceManager()
    manager.setOwnedObjectUrl('blob:owned')
    manager.setLiveStream({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    manager.dispose()
    expect(revoke).toHaveBeenCalledWith('blob:owned')
    expect(stop).toHaveBeenCalled()
  })
  it('returns readable missing and unsupported states', async () => {
    const manager = new MediaPortalSourceManager()
    await expect(manager.load(null,{loop:true,muted:true})).resolves.toMatchObject({status:'missing',message:expect.stringContaining('Relink')})
    await expect(manager.load(media({mimeType:'application/pdf'}),{loop:true,muted:true})).resolves.toMatchObject({status:'unsupported',message:expect.stringContaining('Unsupported')})
  })
})
