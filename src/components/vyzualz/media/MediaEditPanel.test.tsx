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

import { MediaEditPanel } from './MediaEditPanel'
import { selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'
import type { UploadedMedia } from '../../../stores/mediaStore'

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
const onMediaCreated = vi.fn()

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

async function renderPanel(item: UploadedMedia = media()) {
  mocks.items = [item as unknown as Record<string, unknown>]
  useMediaEditStore.getState().beginSession(item.id)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaEditPanel media={item} onMediaCreated={onMediaCreated} />) })
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
  useMediaEditStore.getState().endSession()
  mocks.renderEditedMedia.mockResolvedValue({
    kind: 'image', blob: new Blob(['png'], { type: 'image/png' }), mimeType: 'image/png', extension: 'png', width: 800, height: 600, hasAlpha: false,
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
    expect(button('Save')).not.toBeNull()
    expect(button('Save As')).not.toBeNull()
  })

  it('places the groups and buttons in the specified reading order', async () => {
    await renderPanel()
    const text = container!.textContent ?? ''
    const order = ['Transform', 'Crop', 'Rotate', 'Flip', 'Mirror', 'Color', 'Brightness', 'Contrast', 'Saturation', 'Hue', 'Opacity', 'Detail', 'Sharpness', 'Blur', 'Save']
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

  it('starts neutral with Save and Save As disabled', async () => {
    await renderPanel()
    expect(button('Save')!.disabled).toBe(true)
    expect(button('Save As')!.disabled).toBe(true)
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('enables Save when a value moves off the baseline and disables it again when it returns', async () => {
    await renderPanel()
    await setRange('mmi-edit-brightness', 20)
    expect(useMediaEditStore.getState().edit.brightness).toBe(20)
    expect(button('Save')!.disabled).toBe(false)
    expect(button('Save As')!.disabled).toBe(false)

    await setRange('mmi-edit-brightness', 0)
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(button('Save')!.disabled).toBe(true)
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
    expect(button('Save')!.disabled).toBe(true)
  })

  it('offers a crop reset once a crop exists', async () => {
    await renderPanel()
    expect(button('Reset crop to the full frame')).toBeNull()
    act(() => useMediaEditStore.getState().setCrop({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }))
    await flush()
    await click(button('Reset crop to the full frame'))
    expect(useMediaEditStore.getState().edit.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('Reset returns every value to neutral', async () => {
    await renderPanel()
    await setRange('mmi-edit-blur', 40)
    await click(button('Reset'))
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })
})

describe('Save from the Edit tab', () => {
  it('invokes the real render + replace path for the same item', async () => {
    await renderPanel()
    await setRange('mmi-edit-contrast', 25)
    await click(button('Save'))
    await flush()
    expect(mocks.renderEditedMedia).toHaveBeenCalledTimes(1)
    expect(mocks.replaceMediaContent).toHaveBeenCalledWith('db-1', expect.any(File), expect.anything())
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(button('Save')!.disabled).toBe(true)
  })

  it('shows a useful error and stays dirty when saving fails', async () => {
    mocks.replaceMediaContent.mockResolvedValueOnce({ ok: false, kind: 'failed', error: 'Storage permission denied — check RLS policies' })
    await renderPanel()
    await setRange('mmi-edit-contrast', 25)
    await click(button('Save'))
    await flush()
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain('Storage permission denied')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(true)
    expect(button('Save')!.disabled).toBe(false)
  })
})

describe('Save As dialog', () => {
  async function openDialog() {
    await renderPanel()
    await setRange('mmi-edit-contrast', 25)
    await click(button('Save As'))
  }
  const nameInput = () => document.querySelector<HTMLInputElement>('.dv-confirm-dialog input')
  const dialogButton = (label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-dialog button')].find(b => b.textContent?.trim() === label) ?? null
  async function type(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput(), value)
      nameInput()!.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('opens a "Save As" dialog prefilled with a derivative of the media title, with Cancel and Save As', async () => {
    await openDialog()
    expect(document.querySelector('.dv-confirm-dialog h2')?.textContent).toBe('Save As')
    expect(nameInput()?.value).toBe('Sunset (edited)')
    expect(dialogButton('Cancel')).not.toBeNull()
    expect(dialogButton('Save As')).not.toBeNull()
    document.querySelector('.dv-confirm-backdrop')?.remove()
  })

  it('rejects a blank name and does not save', async () => {
    await openDialog()
    await type('   ')
    await click(dialogButton('Save As'))
    expect(document.querySelector('.dv-confirm-dialog [role="alert"]')?.textContent).toMatch(/Enter a name/)
    expect(mocks.uploadCanonicalVisualFile).not.toHaveBeenCalled()
    expect(mocks.renderEditedMedia).not.toHaveBeenCalled()
  })

  it('rejects invalid filename characters', async () => {
    await openDialog()
    await type('a/b')
    await click(dialogButton('Save As'))
    expect(document.querySelector('.dv-confirm-dialog [role="alert"]')?.textContent).toMatch(/cannot contain/)
    expect(mocks.uploadCanonicalVisualFile).not.toHaveBeenCalled()
  })

  it('Cancel closes the dialog and keeps the edits', async () => {
    await openDialog()
    await click(dialogButton('Cancel'))
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(useMediaEditStore.getState().edit.contrast).toBe(25)
  })

  it('creates a new item, selects it, and starts it clean', async () => {
    await openDialog()
    await type('  Sunset  Night ')
    await click(dialogButton('Save As'))
    await flush()
    expect(mocks.uploadCanonicalVisualFile).toHaveBeenCalledTimes(1)
    expect((mocks.uploadCanonicalVisualFile.mock.calls[0]![0] as File).name).toBe('Sunset Night.png')
    expect(mocks.replaceMediaContent).not.toHaveBeenCalled()
    expect(onMediaCreated).toHaveBeenCalledWith('db-2')
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(useMediaEditStore.getState().mediaId).toBe('db-2')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
  })

  it('keeps the dialog open with the error when it fails, and does not select anything', async () => {
    mocks.uploadCanonicalVisualFile.mockResolvedValueOnce({ ok: false, error: 'Sign in to upload media.', phase: 'failed' })
    await openDialog()
    await click(dialogButton('Save As'))
    await flush()
    expect(document.querySelector('.dv-confirm-dialog')).not.toBeNull()
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Sign in to upload media.')
    expect(onMediaCreated).not.toHaveBeenCalled()
    document.querySelector('.dv-confirm-backdrop')?.remove()
  })

  it('double-clicking Save As creates one asset', async () => {
    let release!: (value: unknown) => void
    mocks.uploadCanonicalVisualFile.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    await openDialog()
    const submit = dialogButton('Save As')!
    await act(async () => { submit.click(); submit.click(); await Promise.resolve() })
    await act(async () => { dialogButton('Saving…')?.click(); await Promise.resolve() })
    await act(async () => { release({ ok: true, item: media({ id: 'db-2' }) }); await Promise.resolve() })
    await flush()
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
    expect(button('Save')).toBeNull()
  })
})
