// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { explainFontSelection, formatFontBytes, isFontEntryUploadable, isFontUploadFile, type FontQueueEntry } from './mediaUploadFonts'

const mocks = vi.hoisted(() => ({
  uploadOscillatorFont: vi.fn(),
  describeFontFile: vi.fn(),
  fontUploadError: null as string | null,
  addFilesToUploadQueue: vi.fn(),
}))

vi.mock('../../stores/mediaStore', () => {
  const state = {
    uploadQueue: [], uploadDrafts: {}, activeUploadDraftKey: null, analyzingAudioTempIds: new Set(), collections: [], items: [],
    mutationStates: {}, loadError: null,
    addFilesToUploadQueue: mocks.addFilesToUploadQueue, removeUploadQueueItem: vi.fn(), clearUploadQueue: vi.fn(), setActiveUploadDraftKey: vi.fn(),
    applyUploadDraftToAllQueued: vi.fn(), setUploadDraftRole: vi.fn(), setUploadDraftTitle: vi.fn(), setUploadDraftDescription: vi.fn(),
    setUploadDraftTags: vi.fn(), setUploadDraftCollections: vi.fn(), setUploadDraftMetadata: vi.fn(), replaceUploadDraftMetadata: vi.fn(),
    setUploadDraftAudioArtist: vi.fn(), setUploadDraftAudioGenre: vi.fn(), setUploadDraftAudioBpm: vi.fn(), setUploadDraftAudioMusicalKey: vi.fn(),
    resetUploadDraft: vi.fn(), uploadQueuedMedia: vi.fn(), saveMediaEdits: vi.fn(), createCollection: vi.fn(), loadCollections: vi.fn(),
    clearLoadError: vi.fn(), retryMediaMutation: vi.fn(), reapplyMediaMutation: vi.fn(), clearMediaMutation: vi.fn(),
  }
  return {
    mediaMutationKey: (id: string, kind: string) => `${id}:${kind}`,
    DEFAULT_UPLOAD_DRAFT: { role: 'background_video', title: '', description: '', tags: [], collectionIds: [], metadata: {}, audioArtist: '', audioGenre: '', audioBpm: '', audioMusicalKey: '' },
    useMediaStore: Object.assign((selector: (value: unknown) => unknown) => selector(state), { getState: () => state }),
  }
})
vi.mock('../../stores/audioStore', () => ({
  useAudioStore: Object.assign((selector: (value: unknown) => unknown) => selector({ savedTracks: [] }), { getState: () => ({ savedTracks: [] }) }),
}))
vi.mock('../../stores/reactStore', () => ({
  useReactStore: Object.assign(() => undefined, {
    getState: () => ({ uploadOscillatorFont: mocks.uploadOscillatorFont, fontUploadError: mocks.fontUploadError }),
  }),
}))
vi.mock('./react/renderers/fontGlyphUtils', () => ({ describeFontFile: mocks.describeFontFile }))
vi.mock('./react/renderers/svgCapabilityAnalysis', () => ({ analyzeSvgCapabilities: () => ({ isValidSvg: true, hasVectorGeometry: true }) }))

import { MediaUploadModal } from './MediaUploadModal'

const details = {
  name: 'Headline Display Regular', fileName: 'Headline.ttf', fontFamilyName: 'Headline Display', styleName: 'Regular',
  format: 'TTF' as const, mimeType: 'font/ttf' as const, fileSize: 84_000, glyphCount: 512,
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.uploadOscillatorFont.mockReset().mockResolvedValue('font-db-1')
  mocks.describeFontFile.mockReset().mockResolvedValue(details)
  mocks.addFilesToUploadQueue.mockReset()
  mocks.fontUploadError = null
})
afterEach(() => { act(() => root.unmount()); container.remove() })

async function chooseFiles(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  await act(async () => { await Promise.resolve() })
}

const fontFile = (name = 'Headline.ttf') => new File([new Uint8Array(8)], name, { type: 'font/ttf' })
const text = () => container.textContent ?? ''
const value = (id: string) => (container.querySelector<HTMLInputElement>(`#${id}`)?.value)

describe('font helpers', () => {
  it('recognises fonts by extension or type and describes why a mixed selection cannot be queued', () => {
    expect(isFontUploadFile({ name: 'A.TTF', type: '' })).toBe(true)
    expect(isFontUploadFile({ name: 'a.otf', type: '' })).toBe(true)
    expect(isFontUploadFile({ name: 'a.woff2', type: 'font/woff2' })).toBe(false)
    expect(isFontUploadFile({ name: 'a.png', type: 'image/png' })).toBe(false)
    const font = { name: 'a.ttf', type: '' }
    const png = { name: 'a.png', type: 'image/png' }
    expect(explainFontSelection({ files: [font], mediaQueued: 0, fontsQueued: 0, audioOnly: false })).toBeNull()
    expect(explainFontSelection({ files: [font, png], mediaQueued: 0, fontsQueued: 0, audioOnly: false })).toMatch(/separate batch/)
    expect(explainFontSelection({ files: [font], mediaQueued: 2, fontsQueued: 0, audioOnly: false })).toMatch(/separate batch/)
    expect(explainFontSelection({ files: [font], mediaQueued: 0, fontsQueued: 0, audioOnly: true })).toMatch(/audio/)
    expect(explainFontSelection({ files: [png], mediaQueued: 0, fontsQueued: 1, audioOnly: false })).toMatch(/Fonts are queued/)
    expect(formatFontBytes(84_000)).toBe('82 KB')
  })

  it('only allows uploading a parsed font that has a name', () => {
    const base: FontQueueEntry = { id: 'a', file: fontFile(), details, fileError: null, name: 'X', tags: [], collectionIds: [], status: 'ready' }
    expect(isFontEntryUploadable(base)).toBe(true)
    expect(isFontEntryUploadable({ ...base, name: '  ' })).toBe(false)
    expect(isFontEntryUploadable({ ...base, details: null })).toBe(false)
    expect(isFontEntryUploadable({ ...base, fileError: 'Font file too large (max 2 MB)' })).toBe(false)
    expect(isFontEntryUploadable({ ...base, status: 'done' })).toBe(false)
  })
})

describe('media upload dialog with a font', () => {
  it('offers fonts in the drop zone and switches the form to font fields once a font is chosen', async () => {
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    expect(text()).toContain('MEDIA UPLOAD')
    expect(text()).toContain('Drag & drop media or fonts here')
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toContain('.ttf')
    expect(text()).toContain('MEDIA ROLE')

    await chooseFiles([fontFile()])
    expect(text()).toContain('FONT UPLOAD')
    expect(text()).toContain('FONT NAME')
    expect(text()).toContain('FONT DETAILS')
    const detail = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)?.value
    expect(detail('FAMILY')).toBe('Headline Display')
    expect(detail('STYLE')).toBe('Regular')
    expect(detail('FORMAT')).toBe('TTF (font/ttf)')
    expect(detail('FILE SIZE')).toBe('82 KB')
    expect(detail('GLYPHS')).toBe('512')
    expect(detail('FILE NAME')).toBe('Headline.ttf')
    expect(container.querySelector<HTMLInputElement>('input[aria-label="FAMILY"]')!.readOnly).toBe(true)
    expect(text()).toContain('TTF · 82 KB · 512 glyphs')
    expect(value('mum-font-name')).toBe('Headline Display Regular')
    // Media-only fields are gone.
    for (const label of ['ADDITIONAL INFO', 'DESCRIPTION', 'DURATION', 'RESOLUTION', 'FPS', 'HAS ALPHA', 'LOOPABLE']) expect(text()).not.toContain(label)
    expect(container.querySelector('#mum-role')).toBeNull()
    expect(text()).toContain('Upload 1 Font')
    expect(mocks.addFilesToUploadQueue).not.toHaveBeenCalled()
  })

  it('uploads through the Font Library with the edited name, then closes', async () => {
    const onClose = vi.fn()
    await act(async () => { root.render(<MediaUploadModal onClose={onClose} />) })
    await chooseFiles([fontFile()])
    const name = container.querySelector<HTMLInputElement>('#mum-font-name')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(name, 'Show Headline')
      name.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(value('mum-font-name')).toBe('Show Headline')

    const upload = [...container.querySelectorAll('button')].find(button => /Upload 1 Font/.test(button.textContent ?? ''))!
    await act(async () => { upload.click() })
    await act(async () => { await Promise.resolve() })
    expect(mocks.uploadOscillatorFont).toHaveBeenCalledTimes(1)
    expect(mocks.uploadOscillatorFont.mock.calls[0]![1]).toEqual({ name: 'Show Headline', tags: [], collectionIds: [] })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps a failed font in the list with the reason so it can be retried, and does not close', async () => {
    mocks.uploadOscillatorFont.mockResolvedValue(null)
    mocks.fontUploadError = 'Sign in to upload fonts'
    const onClose = vi.fn()
    await act(async () => { root.render(<MediaUploadModal onClose={onClose} />) })
    await chooseFiles([fontFile()])
    const upload = [...container.querySelectorAll('button')].find(button => /Upload 1 Font/.test(button.textContent ?? ''))!
    await act(async () => { upload.click() })
    await act(async () => { await Promise.resolve() })
    expect(onClose).not.toHaveBeenCalled()
    expect(text()).toContain('Sign in to upload fonts')
    expect(text()).toContain('Upload 1 Font')
  })

  it('shows why an unreadable font cannot be uploaded and disables the upload', async () => {
    mocks.describeFontFile.mockRejectedValue(new Error('Font file too large (max 2 MB)'))
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    await chooseFiles([fontFile('Huge.otf')])
    expect(text()).toContain('Font file too large (max 2 MB)')
    const upload = [...container.querySelectorAll('button')].find(button => /Upload/.test(button.textContent ?? '') && /Font/.test(button.textContent ?? ''))!
    expect(upload.disabled).toBe(true)
  })

  it('refuses to mix fonts with images in one batch', async () => {
    await act(async () => { root.render(<MediaUploadModal onClose={() => undefined} />) })
    await chooseFiles([fontFile(), new File([new Uint8Array(4)], 'a.png', { type: 'image/png' })])
    expect(text()).toContain('Upload fonts in a separate batch')
    expect(text()).toContain('MEDIA UPLOAD')
    expect(mocks.addFilesToUploadQueue).not.toHaveBeenCalled()
  })

  it('rejects fonts in the audio-only dialog', async () => {
    await act(async () => { root.render(<MediaUploadModal audioOnly onClose={() => undefined} />) })
    await chooseFiles([fontFile()])
    expect(text()).toContain('Only audio files can be uploaded here.')
  })
})
