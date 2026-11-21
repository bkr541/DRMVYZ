// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
  replaceMediaContent: vi.fn(),
  uploadCanonicalVisualFile: vi.fn(),
  renderEditedMedia: vi.fn(),
  removeImageBackground: vi.fn(),
}))

vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: {
    getState: () => ({
      items: mocks.items,
      ensureMediaSigned: async () => undefined,
      replaceMediaContent: mocks.replaceMediaContent,
      uploadCanonicalVisualFile: mocks.uploadCanonicalVisualFile,
    }),
  },
}))

vi.mock('../../../features/media/edit/mediaEditRender', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../features/media/edit/mediaEditRender')>()
  return { ...actual, renderEditedMedia: mocks.renderEditedMedia }
})

vi.mock('../../../features/media/backgroundRemoval/removeImageBackground', () => ({
  removeImageBackground: mocks.removeImageBackground,
}))

import { MediaEditPanel } from './MediaEditPanel'
import { selectMediaEditCanSave, selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useNotificationStore } from '../../../stores/notificationStore'

const cards = () => useNotificationStore.getState().events['media-manager']
beforeEach(() => { useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, 'media-manager': [] } }) })

function media(overrides: Partial<UploadedMedia> = {}): UploadedMedia {
  return {
    id: 'db-1', name: 'sunset.jpg', title: 'Sunset', type: 'image', url: 'https://signed/sunset.jpg',
    thumbnailUrl: null, meta: 'JPG', favorite: false, mediaRole: 'background_image', tags: [], collectionIds: [],
    metadata: { width: 800, height: 600 }, mimeType: 'image/jpeg', revision: 1,
    ...overrides,
  }
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

async function renderPanel(item: UploadedMedia = media(), onCreateModel?: (media: UploadedMedia) => void) {
  mocks.items = [item as unknown as Record<string, unknown>]
  useMediaEditStore.getState().beginSession(item.id)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaEditPanel media={item} onCreateModel={onCreateModel} />) })
}

const q = <T extends Element = HTMLElement>(selector: string) => container?.querySelector<T>(selector) ?? null
const button = (label: string) =>
  [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(candidate => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label) ?? null

async function setRange(id: string, value: number) {
  const input = q<HTMLInputElement>(`#${id}`)
  expect(input, id).not.toBeNull()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value))
    input!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(target: HTMLElement | null) {
  expect(target).not.toBeNull()
  await act(async () => { target!.click(); await Promise.resolve() })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:transparent-preview') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  useMediaEditStore.getState().endSession()
  mocks.renderEditedMedia.mockResolvedValue({
    kind: 'image', blob: new Blob(['png'], { type: 'image/png' }), mimeType: 'image/png', extension: 'png', width: 800, height: 600, hasAlpha: false,
  })
  mocks.removeImageBackground.mockResolvedValue({
    blob: new Blob(['transparent'], { type: 'image/png' }), width: 800, height: 600,
  })
  mocks.replaceMediaContent.mockResolvedValue({ ok: true, item: media() })
  mocks.uploadCanonicalVisualFile.mockResolvedValue({ ok: true, item: media({ id: 'db-2' }) })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  useMediaEditStore.getState().endSession()
})

describe('Edit tab', () => {
  it.each([
    ['image', media()],
    ['video', media({ type: 'video', name: 'clip.mp4', mimeType: 'video/mp4', metadata: { duration: 4 } })],
  ])('renders the full editor for %s media', async (_kind, item) => {
    await renderPanel(item)

    const headers = [...container!.querySelectorAll('.drc-header')].map(node => node.textContent?.replace('▾', '').trim())
    // Exactly these three collapsible groups, in this order: TRANSFORM → COLOR → DETAIL.
    expect(headers).toEqual(['Transform', 'Color', 'Detail'])

    for (const label of ['Crop', 'Rotate', 'Flip', 'Mirror']) {
      expect(container!.textContent, label).toContain(label)
    }
    for (const label of ['Brightness', 'Contrast', 'Saturation', 'Hue', 'Opacity', 'Sharpness', 'Blur']) {
      expect(container!.textContent, label).toContain(label)
    }
    // Save, Save As and Revert are toolbar keys; the editor itself has no save buttons.
    for (const label of ['Save', 'Save As', 'Reset']) expect(button(label), label).toBeNull()
    expect(button('Remove Background') !== null).toBe(item.type === 'image')
  })

  it('removes and restores an image background as part of the shared edit session', async () => {
    await renderPanel()
    await click(button('Remove Background'))
    await flush()

    expect(mocks.removeImageBackground).toHaveBeenCalledTimes(1)
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(true)
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(true)

    await click(button('Restore Background'))
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(button('Remove Background')).not.toBeNull()
  })

  it('places the groups and buttons in the specified reading order', async () => {
    await renderPanel()
    const text = container!.textContent ?? ''
    const order = ['Transform', 'Crop', 'Rotate', 'Flip', 'Mirror', 'Color', 'Brightness', 'Contrast', 'Saturation', 'Hue', 'Opacity', 'Detail', 'Sharpness', 'Blur']
      .map(label => text.indexOf(label))
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('shows readable values beside the sliders', async () => {
    await renderPanel()
    expect(q('#mmi-edit-opacity')).not.toBeNull()
    await setRange('mmi-edit-brightness', 20)
    await setRange('mmi-edit-hue', -45)
    await setRange('mmi-edit-opacity', 60)
    const readouts = [...container!.querySelectorAll('.rv-ctrl-val')].map(node => node.textContent)
    expect(readouts).toEqual(expect.arrayContaining(['+20', '-45°', '60%']))
  })

  it('starts neutral with nothing to save', async () => {
    await renderPanel()
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(false)
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('can be saved once a value moves off the baseline, and not again when it returns', async () => {
    await renderPanel()
    await setRange('mmi-edit-brightness', 20)
    expect(useMediaEditStore.getState().edit.brightness).toBe(20)
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(true)

    await setRange('mmi-edit-brightness', 0)
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(false)
  })

  it.each([
    ['contrast', 'mmi-edit-contrast'], ['saturation', 'mmi-edit-saturation'], ['hue', 'mmi-edit-hue'],
    ['opacity', 'mmi-edit-opacity'], ['sharpness', 'mmi-edit-sharpness'], ['blur', 'mmi-edit-blur'],
  ] as const)('the %s slider writes to the shared session', async (key, id) => {
    await renderPanel()
    await setRange(id, key === 'opacity' ? 40 : 15)
    expect(useMediaEditStore.getState().edit[key]).toBe(key === 'opacity' ? 40 : 15)
  })

  it('rotate, flip and mirror update the same session and compose', async () => {
    await renderPanel()
    await click(button('Rotate right 90 degrees'))
    await click(q('#mmi-edit-flip'))
    await click(q('#mmi-edit-mirror'))
    const edit = useMediaEditStore.getState().edit
    expect(edit.flip).toBe(true)
    expect(edit.mirror).toBe(true)
    expect(edit.rotation).not.toBe(0)
    await click(button('Rotate left 90 degrees'))
    await click(q('#mmi-edit-flip'))
    await click(q('#mmi-edit-mirror'))
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('Crop enters crop mode and pauses the other transforms until Apply or Cancel', async () => {
    await renderPanel()
    await click(button('Crop'))
    expect(useMediaEditStore.getState().cropMode).toBe(true)
    expect(button('Rotate right 90 degrees')!.disabled).toBe(true)
    // A half-drawn crop cannot be saved.
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(false)
  })

  it('offers a crop reset once a crop exists', async () => {
    await renderPanel()
    expect(button('Reset crop to the full frame')).toBeNull()
    act(() => useMediaEditStore.getState().setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }))
    await flush()
    await click(button('Reset crop to the full frame'))
    expect(useMediaEditStore.getState().edit.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('discarding (the toolbar\'s Revert) returns every value to neutral', async () => {
    await renderPanel()
    await setRange('mmi-edit-blur', 40)
    act(() => useMediaEditStore.getState().discard())
    await flush()
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(useMediaEditStore.getState().edit.blur).toBe(0)
  })
})

// The toolbar's Save and Save As call these two store actions, so the render, upload and replace paths are covered here.
describe('saving the edits (Save)', () => {
  const dirty = async () => { await renderPanel(); await setRange('mmi-edit-contrast', 25) }

  it('invokes the real render + replace path for the same item', async () => {
    await dirty()
    await act(async () => { void useMediaEditStore.getState().save() })
    await flush()
    expect(mocks.renderEditedMedia).toHaveBeenCalledTimes(1)
    expect(mocks.replaceMediaContent).toHaveBeenCalledWith('db-1', expect.any(File), expect.anything())
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('reports a useful error and stays dirty when saving fails', async () => {
    mocks.replaceMediaContent.mockResolvedValueOnce({ ok: false, kind: 'failed', error: 'Storage permission denied — check RLS policies' })
    await dirty()
    await act(async () => { void useMediaEditStore.getState().save() })
    await flush()
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain('Storage permission denied')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(true)
    expect(selectMediaEditCanSave(useMediaEditStore.getState())).toBe(true)
  })
})

describe('saving a copy (Save As)', () => {
  const dirty = async () => { await renderPanel(media({ tags: ['warm'], collectionIds: ['c-1'] })); await setRange('mmi-edit-contrast', 25) }
  const saveAs = (name: string, organization?: { tags: string[]; collectionIds: string[] }) => useMediaEditStore.getState().saveAs(name, organization)

  it('rejects a blank name and one with invalid filename characters, and saves nothing', async () => {
    await dirty()
    expect(await saveAs('   ')).toMatchObject({ ok: false, kind: 'invalid', error: expect.stringMatching(/Enter a name/) })
    expect(await saveAs('a/b')).toMatchObject({ ok: false, kind: 'invalid', error: expect.stringMatching(/cannot contain/) })
    expect(mocks.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(mocks.renderEditedMedia).not.toHaveBeenCalled()
  })

  it('creates a new item, leaves the original alone, starts the new one clean, and carries the original\'s tags and collections by default', async () => {
    await dirty()
    const outcome = await act(async () => saveAs('  Sunset  Night '))
    expect(outcome).toEqual({ ok: true, mediaId: 'db-2' })
    expect(mocks.uploadCanonicalVisualFile).toHaveBeenCalledTimes(1)
    const [file, options] = mocks.uploadCanonicalVisualFile.mock.calls[0] as [File, { title: string; tags: string[]; collectionIds: string[] }]
    expect(file.name).toBe('Sunset Night.png')
    expect(options).toMatchObject({ title: 'Sunset Night', tags: ['warm'], collectionIds: ['c-1'] })
    expect(mocks.replaceMediaContent).not.toHaveBeenCalled()
    expect(useMediaEditStore.getState().mediaId).toBe('db-2')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('gives the copy the tags and collections chosen in the Save As popover instead', async () => {
    await dirty()
    await act(async () => saveAs('Cold copy', { tags: ['cold', 'night'], collectionIds: [] }))
    expect(mocks.uploadCanonicalVisualFile.mock.calls[0]![1]).toMatchObject({ title: 'Cold copy', tags: ['cold', 'night'], collectionIds: [] })
  })

  it('keeps the edits and reports the error when the copy fails, without selecting anything', async () => {
    mocks.uploadCanonicalVisualFile.mockResolvedValueOnce({ ok: false, error: 'Sign in to upload media.', phase: 'failed' })
    await dirty()
    const outcome = await act(async () => saveAs('Copy'))
    expect(outcome).toMatchObject({ ok: false, error: 'Sign in to upload media.' })
    expect(useMediaEditStore.getState().mediaId).toBe('db-1')
    expect(useMediaEditStore.getState().edit.contrast).toBe(25)
  })

  it('a double press creates one asset', async () => {
    let release!: (value: unknown) => void
    mocks.uploadCanonicalVisualFile.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    await dirty()
    const first = saveAs('Once'), second = await saveAs('Once')
    expect(second).toMatchObject({ ok: false, kind: 'busy' })
    release({ ok: true, item: media({ id: 'db-2' }) })
    await first
    expect(mocks.uploadCanonicalVisualFile).toHaveBeenCalledTimes(1)
  })
})

describe('unsupported media', () => {
  it.each([
    ['SVG', media({ name: 'logo.svg', mimeType: 'image/svg+xml', mediaRole: 'svg' })],
    ['GIF', media({ name: 'anim.gif', mimeType: 'image/gif' })],
  ])('explains why %s cannot be edited instead of offering a lossy save', async (_kind, item) => {
    await renderPanel(item)
    expect(container!.textContent).toContain('Editing unavailable')
  })
})

describe('Create 3D Model in the Edit tab', () => {
  const create = () => button('Create 3D Model')
  /** A saved library image: the 3D flow needs the server record. */
  const saved = (overrides: Partial<UploadedMedia> = {}) => media({ dbId: 'db-1', ...overrides })

  it.each([
    ['PNG', saved({ name: 'logo.png', mimeType: 'image/png' })],
    ['JPEG', saved()],
    ['WebP', saved({ name: 'logo.webp', mimeType: 'image/webp' })],
    ['SVG', saved({ name: 'logo.svg', mimeType: 'image/svg+xml', mediaRole: 'svg' })],
  ])('offers it for a %s, and starts 3D generation for that file when clicked', async (_kind, item) => {
    const onCreateModel = vi.fn()
    await renderPanel(item, onCreateModel)
    expect(container!.textContent).toContain('3D Model')
    expect(create()?.disabled).toBe(false)
    await act(async () => { create()!.click() })
    expect(onCreateModel).toHaveBeenCalledTimes(1)
    expect(onCreateModel).toHaveBeenCalledWith(item)
  })

  it('is still offered for an SVG, whose own editing is unavailable', async () => {
    await renderPanel(saved({ name: 'logo.svg', mimeType: 'image/svg+xml', mediaRole: 'svg' }), vi.fn())
    expect(container!.textContent).toContain('Editing unavailable')
    expect(create()).not.toBeNull()
  })

  it.each([
    ['a GIF', saved({ name: 'anim.gif', mimeType: 'image/gif' })],
    ['a video', saved({ type: 'video', name: 'clip.mp4', mimeType: 'video/mp4' })],
  ])('is not offered for %s', async (_kind, item) => {
    await renderPanel(item, vi.fn())
    expect(create()).toBeNull()
    expect(container!.textContent).not.toContain('3D Model')
  })

  it('waits for an image that is still uploading, or failed, or has no saved record', async () => {
    for (const item of [saved({ uploading: true }), saved({ uploadError: 'failed' }), media({ dbId: undefined })]) {
      await renderPanel(item, vi.fn())
      expect(create()?.disabled).toBe(true)
      act(() => root?.unmount()); container?.remove(); root = null; container = null
    }
  })

  it('is not shown when no handler is given', async () => {
    await renderPanel(saved())
    expect(create()).toBeNull()
  })
})

