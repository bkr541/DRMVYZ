// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

// The app-view router's unsaved-work guards: Media Manager's new edit guard, and
// proof that the existing Lyric Manager guard still works next to it. The sidebar
// is stubbed (it needs the audio engine); the router itself is real.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLyricsStore } from '../../stores/lyricsStore'
import { useMediaEditStore } from '../../stores/mediaEditStore'
import type { AppView } from './appView'

vi.mock('./VyzualzSidebar', () => ({
  VyzualzSidebar: ({ onAppViewChange }: { onAppViewChange: (view: AppView) => void }) => (
    <nav>
      <button aria-label="React" onClick={() => onAppViewChange('react')}>React</button>
      <button aria-label="Show Manager" onClick={() => onAppViewChange('showManager')}>Show Manager</button>
      <button aria-label="Lyric Manager" onClick={() => onAppViewChange('lyrics')}>Lyric Manager</button>
      <button aria-label="Media Manager" onClick={() => onAppViewChange('media')}>Media Manager</button>
    </nav>
  ),
}))
vi.mock('./react/ReactView', () => ({ ReactView: () => <div data-testid="react-workspace" /> }))
vi.mock('./showManager/ShowManagerView', () => ({ ShowManagerView: () => <div data-testid="show-manager" /> }))
vi.mock('../../features/media/MediaManagerView', () => ({
  MediaManagerView: ({ onOpenLyricManager }: { onOpenLyricManager: (intent: { id: string; targetAudioTrackId: string; workflow: 'ai-extract' }) => void }) => (
    <div data-testid="media-manager">
      <button onClick={() => onOpenLyricManager({ id: 'intent-1', targetAudioTrackId: 'track-a', workflow: 'ai-extract' })}>Open Track Lyrics</button>
    </div>
  ),
}))
vi.mock('../../features/lyrics/LyricManagerView', () => ({
  LyricManagerView: ({ navigationIntent }: { navigationIntent?: { targetAudioTrackId: string } | null }) => (
    <div data-testid="lyric-manager" data-target-track={navigationIntent?.targetAudioTrackId ?? ''} />
  ),
}))

import { VyzualzView } from './VyzualzView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

async function renderView(initialAppView: AppView) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView={initialAppView} />)
  })
  await flush()
}

async function clickLabel(label: string) {
  const target = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(candidate => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label)
  expect(target, `button ${label}`).toBeDefined()
  await act(async () => { target?.click(); await Promise.resolve() })
  await flush()
}

const dialogButton = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.dv-confirm-dialog button, .lmv-dialog button')]
    .find(candidate => candidate.textContent?.trim() === label) ?? null

async function press(label: string) {
  const target = dialogButton(label)
  expect(target, `dialog button ${label}`).not.toBeNull()
  await act(async () => { target?.click(); await Promise.resolve() })
  await flush()
}

async function makeMediaDirty() {
  await act(async () => {
    useMediaEditStore.getState().beginSession('db-1')
    useMediaEditStore.getState().setSlider('brightness', 30)
  })
}

const has = (testId: string) => container?.querySelector(`[data-testid="${testId}"]`) !== null

beforeEach(() => {
  useLyricsStore.getState().markEditorDirty(false)
  useMediaEditStore.getState().endSession()
})
afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  useMediaEditStore.getState().endSession()
  useLyricsStore.getState().markEditorDirty(false)
})

describe('Media Manager unsaved-edit navigation guard', () => {
  it('leaves Media Manager freely when nothing is unsaved', async () => {
    await renderView('media')
    await act(async () => { useMediaEditStore.getState().beginSession('db-1') })
    await clickLabel('React')
    expect(has('react-workspace')).toBe(true)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('blocks navigation to another workspace and asks first', async () => {
    await renderView('media')
    await makeMediaDirty()
    await flush()
    await clickLabel('Show Manager')

    expect(has('media-manager')).toBe(true)
    expect(has('show-manager')).toBe(false)
    expect(document.querySelector('.dv-confirm-dialog h2')?.textContent).toBe('Unsaved changes')
  })

  it('Cancel stays in Media Manager and preserves the edits', async () => {
    await renderView('media')
    await makeMediaDirty()
    await flush()
    await clickLabel('React')
    await press('Cancel')

    expect(has('media-manager')).toBe(true)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(useMediaEditStore.getState().edit.brightness).toBe(30)
  })

  it('Discard Changes continues to the requested workspace', async () => {
    await renderView('media')
    await makeMediaDirty()
    await flush()
    await clickLabel('React')
    await press('Discard Changes')

    expect(has('react-workspace')).toBe(true)
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()
    expect(useMediaEditStore.getState().edit.brightness).toBe(0)
  })

  it('Save continues only after the real save has succeeded', async () => {
    await renderView('media')
    await makeMediaDirty()
    let finish!: () => void
    await act(async () => {
      useMediaEditStore.setState({
        save: () => new Promise(resolve => {
          finish = () => {
            useMediaEditStore.setState({ busy: 'idle', edit: useMediaEditStore.getState().baseline })
            resolve({ ok: true, mediaId: 'db-1' })
          }
        }),
      })
    })
    await clickLabel('React')
    await press('Save')

    expect(has('media-manager')).toBe(true)
    await act(async () => { finish(); await Promise.resolve() })
    await flush()
    expect(has('react-workspace')).toBe(true)
  })

  it('a failed Save stays in Media Manager with the edits and the error', async () => {
    await renderView('media')
    await makeMediaDirty()
    await act(async () => {
      useMediaEditStore.setState({
        save: async () => {
          useMediaEditStore.setState({ error: 'Could not save the edited media.' })
          return { ok: false, kind: 'failed', error: 'Could not save the edited media.' }
        },
      })
    })
    await clickLabel('React')
    await press('Save')

    expect(has('media-manager')).toBe(true)
    expect(document.querySelector('.dv-confirm-dialog')?.textContent).toContain('Could not save the edited media.')
    expect(useMediaEditStore.getState().edit.brightness).toBe(30)
  })

  it('also protects the hop from Media Manager into Lyric Manager, and keeps the navigation intent', async () => {
    await renderView('media')
    await makeMediaDirty()
    await flush()
    await clickLabel('Open Track Lyrics')
    expect(has('lyric-manager')).toBe(false)
    expect(document.querySelector('.dv-confirm-dialog h2')?.textContent).toBe('Unsaved changes')
    await press('Discard Changes')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-target-track')).toBe('track-a')
  })

  it('holds navigation while a save is still uploading', async () => {
    await renderView('media')
    await act(async () => {
      useMediaEditStore.getState().beginSession('db-1')
      useMediaEditStore.setState({ busy: 'saving' })
    })
    await clickLabel('React')
    expect(has('media-manager')).toBe(true)
    expect(document.querySelector('.dv-confirm-dialog')).not.toBeNull()
  })
})

describe('Lyric Manager unsaved guard (unchanged)', () => {
  it('still holds navigation and shows the lyric dialog when lyrics are unsaved', async () => {
    await renderView('lyrics')
    await act(async () => { useLyricsStore.getState().markEditorDirty(true) })
    await clickLabel('Media Manager')

    expect(has('lyric-manager')).toBe(true)
    expect(has('media-manager')).toBe(false)
    expect(document.body.textContent).toContain('Unsaved lyric changes')
    expect(document.querySelector('.dv-confirm-dialog')).toBeNull()

    await press('Discard')
    expect(has('media-manager')).toBe(true)
  })

  it('unsaved media edits do not block leaving Lyric Manager', async () => {
    await renderView('lyrics')
    await makeMediaDirty()
    await flush()
    await clickLabel('React')
    expect(has('react-workspace')).toBe(true)
  })
})
