// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  browser: { current: null as null | Record<string, (...args: unknown[]) => void> },
  inspector: { current: null as null | Record<string, unknown> },
}))

vi.mock('../../stores/mediaStore', () => ({
  useMediaStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({
      items: [{ id: 'db-1', type: 'image' }, { id: 'db-2', type: 'image' }],
      collections: [],
      openCollectionEditor: () => undefined,
      openImportMediaModal: () => undefined,
    }),
    { getState: () => ({ items: [], ensureMediaSigned: async () => undefined }) },
  ),
}))
vi.mock('../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({ savedTracks: [{ id: 'track-1' }] }),
}))
vi.mock('../../components/vyzualz/media/MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: (props: Record<string, (...args: unknown[]) => void>) => { mocks.browser.current = props; return <div /> },
}))
vi.mock('../../components/vyzualz/media/MediaManagerStage', () => ({ MediaManagerStage: () => <div /> }))
vi.mock('../../components/vyzualz/media/MediaManagerInspector', () => ({
  MediaManagerInspector: (props: Record<string, unknown>) => { mocks.inspector.current = props; return <div /> },
}))

import { MediaManagerView } from './MediaManagerView'
import { selectMediaEditDirty, useMediaEditStore } from '../../stores/mediaEditStore'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderView() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />) })
}
const selectMedia = (id: string) => act(async () => { mocks.browser.current!.onSelect!(id) })
const selectTrack = (id: string) => act(async () => { mocks.browser.current!.onSelectTrack!({ id }) })
const dialogButton = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-dialog button')].find(b => b.textContent?.trim() === label) ?? null
const activeMediaId = () => mocks.browser.current!.activeMediaId as unknown as string | null

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

describe('Media Manager selection guard', () => {
  it('a clean session switches media immediately and starts a fresh session', async () => {
    await renderView()
    await selectMedia('db-1')
    expect(activeMediaId()).toBe('db-1')
    expect(useMediaEditStore.getState().mediaId).toBe('db-1')
    await selectMedia('db-2')
    expect(activeMediaId()).toBe('db-2')
    expect(useMediaEditStore.getState().mediaId).toBe('db-2')
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('a dirty session blocks choosing another item and asks first', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('brightness', 25) })

    await selectMedia('db-2')
    expect(activeMediaId()).toBe('db-1')
    expect(document.querySelector('.dv-confirm-dialog h2')?.textContent).toBe('Unsaved changes')
    expect(useMediaEditStore.getState().edit.brightness).toBe(25)
  })

  it('also guards switching to an audio track', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().toggleFlip() })
    await selectTrack('track-1')
    expect(activeMediaId()).toBe('db-1')
    expect(document.querySelector('.dv-confirm-dialog')).not.toBeNull()
  })

  it('Cancel keeps the current media and its edits', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    await selectMedia('db-2')
    await act(async () => { dialogButton('Cancel')!.click() })

    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(activeMediaId()).toBe('db-1')
    expect(useMediaEditStore.getState().edit.hue).toBe(40)
  })

  it('Discard Changes loads the requested item with a clean session', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    await selectMedia('db-2')
    await act(async () => { dialogButton('Discard Changes')!.click() })

    expect(activeMediaId()).toBe('db-2')
    expect(useMediaEditStore.getState().mediaId).toBe('db-2')
    expect(selectMediaEditDirty(useMediaEditStore.getState())).toBe(false)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('Save switches only after the save has succeeded', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    let finish!: () => void
    useMediaEditStore.setState({
      save: () => new Promise(resolve => {
        finish = () => {
          useMediaEditStore.setState({ busy: 'idle', edit: useMediaEditStore.getState().baseline })
          resolve({ ok: true, mediaId: 'db-1' })
        }
      }),
    })

    await selectMedia('db-2')
    await act(async () => { dialogButton('Save')!.click() })
    expect(activeMediaId()).toBe('db-1') // still saving: no switch yet
    await act(async () => { finish(); await Promise.resolve() })
    expect(activeMediaId()).toBe('db-2')
  })

  it('a failed Save stays on the current media with its edits', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    useMediaEditStore.setState({
      save: async () => {
        useMediaEditStore.setState({ error: 'Could not save' })
        return { ok: false, kind: 'failed', error: 'Could not save' }
      },
    })
    await selectMedia('db-2')
    await act(async () => { dialogButton('Save')!.click(); await Promise.resolve() })
    expect(activeMediaId()).toBe('db-1')
    expect(useMediaEditStore.getState().edit.hue).toBe(40)
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Could not save')
  })

  it('re-selecting the item being edited never prompts', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    await selectMedia('db-1')
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(useMediaEditStore.getState().edit.hue).toBe(40)
  })

  it('selects the new item after Save As and starts it clean', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { (mocks.inspector.current!.onMediaCreated as (id: string) => void)('db-2') })
    expect(activeMediaId()).toBe('db-2')
    expect(useMediaEditStore.getState().mediaId).toBe('db-2')
  })

  it('ends the session when the view goes away', async () => {
    await renderView()
    await selectMedia('db-1')
    act(() => root?.unmount())
    root = null
    expect(useMediaEditStore.getState().mediaId).toBeNull()
  })
})

describe('window close / reload protection', () => {
  const fire = () => {
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    window.dispatchEvent(event)
    return event
  }

  it('asks before unloading with unsaved edits', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    expect(fire().defaultPrevented).toBe(true)
  })

  it('does not interfere when there is nothing to lose', async () => {
    await renderView()
    await selectMedia('db-1')
    expect(fire().defaultPrevented).toBe(false)
  })

  it('protects a save that is still uploading', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.setState({ busy: 'saving' }) })
    expect(fire().defaultPrevented).toBe(true)
  })

  it('removes its listener once the edits are gone', async () => {
    await renderView()
    await selectMedia('db-1')
    await act(async () => { useMediaEditStore.getState().setSlider('hue', 40) })
    await act(async () => { useMediaEditStore.getState().discard() })
    expect(fire().defaultPrevented).toBe(false)
  })
})
