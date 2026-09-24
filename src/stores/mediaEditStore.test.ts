import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
  ensureMediaSigned: vi.fn(async () => undefined),
  replaceMediaContent: vi.fn(),
  uploadCanonicalVisualFile: vi.fn(),
  renderEditedMedia: vi.fn(),
}))

vi.mock('./mediaStore', () => ({
  useMediaStore: {
    getState: () => ({
      items: mocks.items,
      ensureMediaSigned: mocks.ensureMediaSigned,
      replaceMediaContent: mocks.replaceMediaContent,
      uploadCanonicalVisualFile: mocks.uploadCanonicalVisualFile,
    }),
  },
}))

vi.mock('../features/media/edit/mediaEditRender', async importOriginal => {
  const actual = await importOriginal<typeof import('../features/media/edit/mediaEditRender')>()
  return { ...actual, renderEditedMedia: mocks.renderEditedMedia }
})

import { createDefaultMediaEdit } from '../features/media/edit/mediaEditModel'
import { selectMediaEditDirty, selectMediaEditNeedsGuard, useMediaEditStore } from './mediaEditStore'

function media(overrides: Record<string, unknown> = {}) {
  return {
    id: 'db-1', name: 'sunset.jpg', title: 'Sunset', description: 'Golden hour', type: 'image',
    url: 'https://signed/sunset.jpg', mimeType: 'image/jpeg', mediaRole: 'background_image',
    tags: ['warm'], collectionIds: ['c-1'], metadata: { width: 800, height: 600, hasAlpha: false, fps: undefined },
    revision: 2, ...overrides,
  }
}

const renderedImage = () => ({
  kind: 'image' as const,
  blob: new Blob(['png'], { type: 'image/png' }),
  mimeType: 'image/png', extension: 'png', width: 400, height: 300, hasAlpha: false,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const store = () => useMediaEditStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.items = [media()]
  mocks.renderEditedMedia.mockResolvedValue(renderedImage())
  mocks.replaceMediaContent.mockResolvedValue({ ok: true, item: media() })
  mocks.uploadCanonicalVisualFile.mockResolvedValue({ ok: true, item: media({ id: 'db-2' }) })
  useMediaEditStore.getState().endSession()
})

describe('edit session state', () => {
  it('starts neutral and clean for a selected item', () => {
    store().beginSession('db-1')
    expect(store().mediaId).toBe('db-1')
    expect(store().edit).toEqual(createDefaultMediaEdit())
    expect(selectMediaEditDirty(store())).toBe(false)
  })

  it.each([
    ['brightness', () => store().setSlider('brightness', 20)],
    ['contrast', () => store().setSlider('contrast', -20)],
    ['saturation', () => store().setSlider('saturation', 30)],
    ['hue', () => store().setSlider('hue', 45)],
    ['opacity', () => store().setSlider('opacity', 80)],
    ['sharpness', () => store().setSlider('sharpness', 40)],
    ['blur', () => store().setSlider('blur', 10)],
    ['rotate', () => store().rotate(1)],
    ['flip', () => store().toggleFlip()],
    ['mirror', () => store().toggleMirror()],
    ['crop', () => store().setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 })],
  ])('%s marks the session dirty', (_name, change) => {
    store().beginSession('db-1')
    change()
    expect(selectMediaEditDirty(store())).toBe(true)
  })

  it('returns to clean when every control goes back to the baseline', () => {
    store().beginSession('db-1')
    store().setSlider('brightness', 20)
    store().toggleFlip()
    store().rotate(1)
    expect(selectMediaEditDirty(store())).toBe(true)
    // Undo in reverse order: each action acts on what is on screen, so order matters.
    store().rotate(-1)
    store().toggleFlip()
    store().setSlider('brightness', 0)
    expect(selectMediaEditDirty(store())).toBe(false)
  })

  it('discard restores every neutral value at once', () => {
    store().beginSession('db-1')
    store().setSlider('hue', 90)
    store().setCrop({ x: 0.2, y: 0.2, width: 0.4, height: 0.4 })
    store().toggleMirror()
    store().discard()
    expect(store().edit).toEqual(createDefaultMediaEdit())
    expect(selectMediaEditDirty(store())).toBe(false)
  })

  it('clamps out-of-range slider values', () => {
    store().beginSession('db-1')
    store().setSlider('brightness', 5000)
    store().setSlider('opacity', -20)
    expect(store().edit.brightness).toBe(100)
    expect(store().edit.opacity).toBe(0)
  })

  it('ignores edits with no session, and re-beginning the same item keeps its edits', () => {
    store().setSlider('brightness', 40)
    expect(store().edit.brightness).toBe(0)
    store().beginSession('db-1')
    store().setSlider('brightness', 40)
    store().beginSession('db-1')
    expect(store().edit.brightness).toBe(40)
  })

  it('a different item starts from a clean baseline', () => {
    store().beginSession('db-1')
    store().setSlider('brightness', 40)
    store().beginSession('db-9')
    expect(store().mediaId).toBe('db-9')
    expect(selectMediaEditDirty(store())).toBe(false)
  })
})

describe('Save', () => {
  it('renders the real edit and replaces the same item, then clears the dirty state', async () => {
    store().beginSession('db-1')
    store().setSlider('brightness', 25)
    const outcome = await store().save()

    expect(outcome).toEqual({ ok: true, mediaId: 'db-1' })
    expect(mocks.renderEditedMedia).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image', url: 'https://signed/sunset.jpg', mimeType: 'image/jpeg' }),
      expect.objectContaining({ brightness: 25 }),
      expect.anything(),
    )
    // Same canonical item, new bytes: name gets the extension the bytes really have.
    const [itemId, file, options] = mocks.replaceMediaContent.mock.calls[0]!
    expect(itemId).toBe('db-1')
    expect(file).toBeInstanceOf(File)
    expect((file as File).name).toBe('sunset.png')
    expect((file as File).type).toBe('image/png')
    expect(options.metadata).toMatchObject({ width: 400, height: 300, hasAlpha: false, detectedMimeType: 'image/png' })
    expect(mocks.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(store().mediaId).toBe('db-1')
    expect(selectMediaEditDirty(store())).toBe(false)
    expect(store().busy).toBe('idle')
  })

  it('does not treat the session as clean until the persistence call has resolved', async () => {
    const pending = deferred<{ ok: true; item: unknown }>()
    mocks.replaceMediaContent.mockReturnValueOnce(pending.promise)
    store().beginSession('db-1')
    store().setSlider('contrast', 30)

    const saving = store().save()
    await vi.waitFor(() => expect(mocks.replaceMediaContent).toHaveBeenCalled())
    expect(selectMediaEditDirty(store())).toBe(true)
    expect(selectMediaEditNeedsGuard(store())).toBe(true)
    expect(store().busy).toBe('saving')

    pending.resolve({ ok: true, item: media() })
    await saving
    expect(selectMediaEditDirty(store())).toBe(false)
    expect(selectMediaEditNeedsGuard(store())).toBe(false)
  })

  it('keeps the edits and shows the error when persistence fails', async () => {
    mocks.replaceMediaContent.mockResolvedValueOnce({ ok: false, kind: 'failed', error: 'Storage permission denied' })
    store().beginSession('db-1')
    store().setSlider('saturation', -40)
    const outcome = await store().save()

    expect(outcome).toMatchObject({ ok: false, kind: 'failed', error: 'Storage permission denied' })
    expect(store().edit.saturation).toBe(-40)
    expect(selectMediaEditDirty(store())).toBe(true)
    expect(store().error).toBe('Storage permission denied')
    expect(store().busy).toBe('idle')
  })

  it('keeps the edits when rendering fails', async () => {
    mocks.renderEditedMedia.mockRejectedValueOnce(new Error('GPU rendering is unavailable'))
    store().beginSession('db-1')
    store().toggleFlip()
    const outcome = await store().save()
    expect(outcome).toMatchObject({ ok: false, kind: 'failed', error: 'GPU rendering is unavailable' })
    expect(selectMediaEditDirty(store())).toBe(true)
    expect(mocks.replaceMediaContent).not.toHaveBeenCalled()
  })

  it('reports a revision conflict without discarding the edits', async () => {
    mocks.replaceMediaContent.mockResolvedValueOnce({ ok: false, kind: 'conflict', error: 'changed in another session' })
    store().beginSession('db-1')
    store().rotate(1)
    expect(await store().save()).toMatchObject({ ok: false, kind: 'conflict' })
    expect(selectMediaEditDirty(store())).toBe(true)
  })

  it('does nothing when there are no visual edits', async () => {
    store().beginSession('db-1')
    expect(await store().save()).toMatchObject({ ok: false, kind: 'no-changes' })
    expect(mocks.renderEditedMedia).not.toHaveBeenCalled()
  })

  it('refuses while a crop is still being adjusted', async () => {
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    store().setCropMode(true)
    expect(await store().save()).toMatchObject({ ok: false, kind: 'invalid' })
    expect(mocks.renderEditedMedia).not.toHaveBeenCalled()
  })

  it('refuses unsupported media instead of producing a lossy save', async () => {
    mocks.items = [media({ mimeType: 'image/gif', name: 'anim.gif' })]
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    expect(await store().save()).toMatchObject({ ok: false, kind: 'invalid', error: expect.stringContaining('GIF') })
  })

  it('blocks a second save while one is running, so nothing is uploaded twice', async () => {
    const pending = deferred<{ ok: true; item: unknown }>()
    mocks.replaceMediaContent.mockReturnValueOnce(pending.promise)
    store().beginSession('db-1')
    store().setSlider('blur', 30)

    const first = store().save()
    await vi.waitFor(() => expect(mocks.replaceMediaContent).toHaveBeenCalled())
    expect(await store().save()).toMatchObject({ ok: false, kind: 'busy' })
    expect(await store().saveAs('Copy')).toMatchObject({ ok: false, kind: 'busy' })
    pending.resolve({ ok: true, item: media() })
    await first
    expect(mocks.replaceMediaContent).toHaveBeenCalledTimes(1)
  })

  it('locks the controls while saving', async () => {
    const pending = deferred<{ ok: true; item: unknown }>()
    mocks.replaceMediaContent.mockReturnValueOnce(pending.promise)
    store().beginSession('db-1')
    store().setSlider('blur', 30)
    const saving = store().save()
    await vi.waitFor(() => expect(store().busy).toBe('saving'))
    store().setSlider('blur', 90)
    store().toggleFlip()
    expect(store().edit.blur).toBe(30)
    expect(store().edit.flip).toBe(false)
    pending.resolve({ ok: true, item: media() })
    await saving
  })

  it('carries the fingerprint forward as a NEW value so Decks see the change', async () => {
    mocks.items = [media({ metadata: { width: 1, height: 1, contentFingerprint: 'sha256:old' } })]
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    await store().save()
    const { metadata } = mocks.replaceMediaContent.mock.calls[0]![2]
    expect(metadata.contentFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(metadata.contentFingerprint).not.toBe('sha256:old')
  })

  it('drops stale analysis (palette, fingerprint) from the replaced metadata', async () => {
    mocks.items = [media({ metadata: { width: 1, height: 1, dominantColors: ['#fff'], analyzedAt: 1, detectedMimeType: 'image/jpeg' } })]
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    await store().save()
    const { metadata } = mocks.replaceMediaContent.mock.calls[0]![2]
    expect(metadata.dominantColors).toBeUndefined()
    expect(metadata.analyzedAt).toBeUndefined()
    expect(metadata.contentFingerprint).toBeUndefined()
    expect(metadata.detectedMimeType).toBe('image/png')
  })

  it('uses the extension the rendered bytes actually have for videos', async () => {
    mocks.items = [media({ id: 'db-1', type: 'video', name: 'clip.mov', mimeType: 'video/quicktime', metadata: { duration: 4, fps: 24 } })]
    mocks.renderEditedMedia.mockResolvedValueOnce({
      kind: 'video', blob: new Blob(['v'], { type: 'video/mp4' }), mimeType: 'video/mp4', extension: 'mp4',
      width: 640, height: 360, durationSec: 4, hasAlpha: false, hasAudio: true,
    })
    store().beginSession('db-1')
    store().rotate(1)
    await store().save()
    const [, file, options] = mocks.replaceMediaContent.mock.calls[0]!
    expect((file as File).name).toBe('clip.mp4')
    expect((file as File).type).toBe('video/mp4')
    expect(options.metadata).toMatchObject({ duration: 4, fps: 24, detectedMimeType: 'video/mp4', hasAlpha: false })
  })
})

describe('Save As', () => {
  it('rejects a blank or invalid name without rendering anything', async () => {
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    expect(await store().saveAs('   ')).toMatchObject({ ok: false, kind: 'invalid' })
    expect(await store().saveAs('bad/name')).toMatchObject({ ok: false, kind: 'invalid' })
    expect(mocks.renderEditedMedia).not.toHaveBeenCalled()
    expect(mocks.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(store().busy).toBe('idle')
  })

  it('creates a NEW item from rendered bytes, inheriting organization, and leaves the original alone', async () => {
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    const outcome = await store().saveAs('  Sunset   copy ')

    expect(outcome).toEqual({ ok: true, mediaId: 'db-2' })
    expect(mocks.replaceMediaContent).not.toHaveBeenCalled()
    const [file, options] = mocks.uploadCanonicalVisualFile.mock.calls[0]!
    expect(file).toBeInstanceOf(File)
    expect((file as File).name).toBe('Sunset copy.png')
    expect((file as File).type).toBe('image/png')
    expect(await (file as File).text()).toBe('png')
    expect(options).toMatchObject({
      allowVideo: true,
      role: 'background_image',
      title: 'Sunset copy',
      description: 'Golden hour',
      tags: ['warm'],
      collectionIds: ['c-1'],
    })
    expect(options.metadata).toMatchObject({ width: 400, height: 300, detectedMimeType: 'image/png' })
    expect(options.metadata.contentFingerprint).toBeUndefined()
    // The session moves to the new item, clean.
    expect(store().mediaId).toBe('db-2')
    expect(selectMediaEditDirty(store())).toBe(false)
  })

  it('a failed Save As keeps the session on the original with its edits and shows the error', async () => {
    mocks.uploadCanonicalVisualFile.mockResolvedValueOnce({ ok: false, error: 'Sign in to upload media.', phase: 'failed' })
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    expect(await store().saveAs('Copy')).toMatchObject({ ok: false, kind: 'failed' })
    expect(store().mediaId).toBe('db-1')
    expect(selectMediaEditDirty(store())).toBe(true)
    expect(store().error).toBe('Sign in to upload media.')
  })

  it('ignores duplicate clicks while saving: exactly one asset is created', async () => {
    const pending = deferred<{ ok: true; item: unknown }>()
    mocks.uploadCanonicalVisualFile.mockReturnValueOnce(pending.promise)
    store().beginSession('db-1')
    store().setSlider('hue', 20)

    const first = store().saveAs('Copy')
    await vi.waitFor(() => expect(mocks.uploadCanonicalVisualFile).toHaveBeenCalled())
    const second = await store().saveAs('Copy')
    const third = await store().saveAs('Copy again')
    expect(second).toMatchObject({ ok: false, kind: 'busy' })
    expect(third).toMatchObject({ ok: false, kind: 'busy' })
    pending.resolve({ ok: true, item: media({ id: 'db-2' }) })
    await first
    expect(mocks.uploadCanonicalVisualFile).toHaveBeenCalledTimes(1)
    expect(mocks.renderEditedMedia).toHaveBeenCalledTimes(1)
  })
})

describe('cancellation', () => {
  it('ending the session aborts an in-flight render', async () => {
    let signal: AbortSignal | undefined
    mocks.renderEditedMedia.mockImplementationOnce((_source, _edit, options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })))
      })
    })
    store().beginSession('db-1')
    store().setSlider('hue', 20)
    const saving = store().save()
    await vi.waitFor(() => expect(signal).toBeDefined())
    store().endSession()
    expect(signal?.aborted).toBe(true)
    expect(await saving).toMatchObject({ ok: false, kind: 'cancelled' })
    expect(store().mediaId).toBeNull()
  })
})
