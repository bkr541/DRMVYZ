// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
}))
vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: unknown) => unknown) => selector({
    createCollection: mocks.createCollection, updateCollection: mocks.updateCollection, loadError: null, clearLoadError: vi.fn(),
  }),
}))

import { CollectionEditorModal } from './CollectionEditorModal'
import { NotificationPageProvider, useNotificationStore } from '../../../stores/notificationStore'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const onClose = vi.fn()
const cards = () => useNotificationStore.getState().events['media-manager']

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  onClose.mockReset()
  mocks.createCollection.mockReset().mockResolvedValue('coll-1')
  mocks.updateCollection.mockReset().mockResolvedValue(true)
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, 'media-manager': [] } })
})
afterEach(() => { act(() => root.unmount()); container.remove() })

async function renderEditor(collection?: { id: string; name: string; description?: string }) {
  await act(async () => {
    root.render(<NotificationPageProvider value="media-manager"><CollectionEditorModal collection={collection as never} onClose={onClose} /></NotificationPageProvider>)
  })
}
async function typeName(value: string) {
  const input = container.querySelector<HTMLInputElement>('input.mum-input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function clickSave() {
  const save = [...container.querySelectorAll('button')].find(button => /Create Collection|Save Changes/.test(button.textContent ?? ''))!
  await act(async () => { save.click(); await Promise.resolve() })
}

describe('CollectionEditorModal success cards', () => {
  it('confirms a created collection', async () => {
    await renderEditor()
    await typeName('Opening Set')
    await clickSave()
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Collection created', message: '"Opening Set" was added to your collections.' })
    expect(onClose).toHaveBeenCalled()
  })

  it('confirms an updated collection', async () => {
    await renderEditor({ id: 'coll-1', name: 'Old Name' })
    await typeName('New Name')
    await clickSave()
    expect(mocks.updateCollection).toHaveBeenCalledWith('coll-1', 'New Name', '')
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Collection updated', message: '"New Name" was updated.' })
  })

  it('posts nothing and stays open when the save fails or the name is blank', async () => {
    mocks.createCollection.mockResolvedValue(null)
    await renderEditor()
    await clickSave()
    expect(container.textContent).toContain('Collection name is required.')
    await typeName('Encore')
    await clickSave()
    expect(cards()).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })
})
