// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../stores/mediaStore', () => ({ useMediaStore: { getState: () => ({ items: [] }) } }))

import { UnsavedMediaChangesDialog } from './UnsavedMediaChangesDialog'
import { selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
const onCancel = vi.fn()
const onProceed = vi.fn()

async function renderDialog(open = true) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<UnsavedMediaChangesDialog open={open} onCancel={onCancel} onProceed={onProceed} />) })
}
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-dialog button')].find(b => b.textContent?.trim() === label) ?? null
async function click(label: string) {
  const target = button(label)
  expect(target, label).not.toBeNull()
  await act(async () => { target!.click(); await Promise.resolve() })
}

function makeDirty() {
  useMediaEditStore.getState().beginSession('db-1')
  useMediaEditStore.getState().setSlider('brightness', 30)
}

beforeEach(() => {
  vi.clearAllMocks()
  useMediaEditStore.getState().endSession()
})
afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  useMediaEditStore.getState().endSession()
})

describe('UnsavedMediaChangesDialog', () => {
  it('shows the specified copy and the Cancel / Discard Changes / Save actions', async () => {
    makeDirty()
    await renderDialog()
    expect(document.querySelector('.dv-confirm-dialog h2')?.textContent).toBe('Unsaved changes')
    expect(document.querySelector('.dv-confirm-dialog > p')?.textContent)
      .toBe('You have unsaved media changes. If you continue, those changes will be lost.')
    expect([...document.querySelectorAll('.dv-confirm-dialog button')].map(b => b.textContent))
      .toEqual(['Cancel', 'Discard Changes', 'Save'])
  })

  it('renders nothing while closed', async () => {
    makeDirty()
    await renderDialog(false)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('Cancel stays put and preserves the edits', async () => {
    makeDirty()
    await renderDialog()
    await click('Cancel')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onProceed).not.toHaveBeenCalled()
    expect(useMediaEditStore.getState().edit.brightness).toBe(30)
  })

  it('Discard Changes resets the session and lets the caller continue', async () => {
    makeDirty()
    await renderDialog()
    await click('Discard Changes')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(useMediaEditStore.getState().edit.brightness).toBe(0)
    expect(onProceed).toHaveBeenCalledTimes(1)
  })

  it('Save only lets the caller continue after the real save has succeeded', async () => {
    makeDirty()
    let finishSave!: () => void
    const save = vi.fn(() => new Promise<{ ok: true; mediaId: string }>(resolve => {
      finishSave = () => {
        useMediaEditStore.setState({ busy: 'idle', edit: useMediaEditStore.getState().baseline })
        resolve({ ok: true, mediaId: 'db-1' })
      }
    }))
    useMediaEditStore.setState({ save })
    await renderDialog()

    await click('Save')
    expect(save).toHaveBeenCalledTimes(1)
    // Not yet: nothing has been persisted, so no navigation.
    expect(onProceed).not.toHaveBeenCalled()

    await act(async () => { finishSave(); await Promise.resolve() })
    expect(onProceed).toHaveBeenCalledTimes(1)
  })

  it('a failed Save keeps the dialog open, shows the error, and never proceeds', async () => {
    makeDirty()
    const save = vi.fn(async () => {
      useMediaEditStore.setState({ error: 'Storage permission denied' })
      return { ok: false as const, kind: 'failed' as const, error: 'Storage permission denied' }
    })
    useMediaEditStore.setState({ save })
    await renderDialog()
    await click('Save')
    expect(onProceed).not.toHaveBeenCalled()
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Storage permission denied')
    expect(useMediaEditStore.getState().edit.brightness).toBe(30)
  })

  it('disables Save and Discard while a save is running, so navigation cannot race the upload', async () => {
    makeDirty()
    useMediaEditStore.setState({ busy: 'saving' })
    await renderDialog()
    expect(button('Saving…')!.disabled).toBe(true)
    expect(button('Discard Changes')!.disabled).toBe(true)
    expect(onProceed).not.toHaveBeenCalled()
  })

  it('continues on its own once a running save (started elsewhere) finishes cleanly', async () => {
    makeDirty()
    useMediaEditStore.setState({ busy: 'saving' })
    await renderDialog()
    expect(onProceed).not.toHaveBeenCalled()
    await act(async () => { useMediaEditStore.setState({ busy: 'idle', edit: useMediaEditStore.getState().baseline }) })
    expect(onProceed).toHaveBeenCalledTimes(1)
  })
})
