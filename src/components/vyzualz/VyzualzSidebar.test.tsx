// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ source: 'file' as 'file' | 'microphone' | 'demo' }))

vi.mock('./react/LayoutLabModal', () => ({
  LayoutLabModal: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Layout Lab"><button onClick={onClose}>Close Layout Lab</button></div>,
}))

vi.mock('../../context/AudioEngineContext', () => ({
  useSharedAudio: () => fixture,
}))

import { useNotificationStore } from '../../stores/notificationStore'
import { VyzualzSidebar } from './VyzualzSidebar'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  fixture.source = 'file'
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('VyzualzSidebar workspace navigation', () => {
  it('keeps the legacy brand toggle and its collapse semantics', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<VyzualzSidebar compact appView="react" />)
    })

    const logo = container.querySelector<HTMLButtonElement>('.az-sidebar .az-logo')!
    expect(container.querySelectorAll('.az-logo')).toHaveLength(1)
    expect(logo.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.az-sidebar--collapsed')).not.toBeNull()
    act(() => logo.click())
    expect(logo.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.az-sidebar--collapsed')).toBeNull()
  })

  it('disables Show Manager while Live Input is selected', () => {
    fixture.source = 'microphone'
    const onAppViewChange = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<VyzualzSidebar compact appView="react" onAppViewChange={onAppViewChange} />)
    })

    const showManagerItem = container.querySelector<HTMLButtonElement>('[aria-label="Show Manager"]')
    expect(showManagerItem?.disabled).toBe(true)
    expect(showManagerItem?.getAttribute('aria-disabled')).toBe('true')
    expect(showManagerItem?.title).toContain('requires a loaded audio track')
    act(() => showManagerItem?.click())
    expect(onAppViewChange).not.toHaveBeenCalledWith('showManager')
  })

  it('places one icon-only notification button above Profile and follows the active workspace', async () => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    useNotificationStore.getState().pushEvent('media-manager', { title: 'Media finished', message: 'Ready.' })
    await act(async () => root?.render(<VyzualzSidebar compact appView="media" />))
    const footer = container.querySelector('.az-sidebar-account')!
    const bell = footer.querySelector<HTMLButtonElement>('.az-sidebar-notifications')!
    expect(bell.textContent).toBe('')
    expect(bell.getAttribute('aria-label')).toBe('Notifications (1)')
    const layoutLab = footer.querySelector<HTMLButtonElement>('[aria-label="Layout Lab"]')!
    expect(layoutLab.nextElementSibling).toBe(bell)
    expect(layoutLab.querySelector('svg')?.getAttribute('width')).toBe('24')
    expect(bell.nextElementSibling?.classList.contains('vz-profile-control')).toBe(true)
    await act(async () => layoutLab.click())
    expect(container.querySelector('[role="dialog"][aria-label="Layout Lab"]')).not.toBeNull()
    await act(async () => container!.querySelector<HTMLButtonElement>('[aria-label="Layout Lab"][role="dialog"] button')!.click())
    expect(container.querySelector('[role="dialog"][aria-label="Layout Lab"]')).toBeNull()
    await act(async () => bell.click())
    expect(document.body.querySelector('[role="dialog"][aria-label="Notifications"]')?.textContent).toContain('Media finished')
    await act(async () => root?.render(<VyzualzSidebar compact appView="lyrics" />))
    expect(document.body.querySelector('[role="dialog"][aria-label="Notifications"]')).toBeNull()
    expect(container.querySelector('.az-sidebar-notifications')?.getAttribute('aria-label')).toBe('Notifications')
  })

  it('omits the legacy Visualizer entry and keeps manager navigation intact', () => {
    const onAppViewChange = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(
        <VyzualzSidebar
          compact
          appView="lyrics"
          onAppViewChange={onAppViewChange}
        />,
      )
    })

    const navItems = [...container.querySelectorAll<HTMLElement>('.az-nav .az-nav-item')]
    const labels = navItems.map(item => item.getAttribute('aria-label'))
    expect(labels).toEqual(['React', 'Preset Manager', 'Show Manager', 'Lyric Manager', 'Media Manager'])
    expect(labels).not.toContain('Visualizer')
    expect(navItems.map(item => item.querySelector('svg')?.getAttribute('data-app-icon'))).toEqual([
      'navReact', 'navPreset', 'navShow', 'navLyrics', 'navMedia',
    ])
    expect(labels.indexOf('Media Manager')).toBe(labels.indexOf('Lyric Manager') + 1)

    const presetManagerItem = navItems.find(item => item.getAttribute('aria-label') === 'Preset Manager')
    expect(presetManagerItem?.querySelector('[data-app-icon="navPreset"]')).not.toBeNull()
    act(() => presetManagerItem?.click())
    expect(onAppViewChange).toHaveBeenCalledWith('presetManager')

    const showManagerItem = navItems.find(item => item.getAttribute('aria-label') === 'Show Manager')
    expect(showManagerItem).toBeInstanceOf(HTMLButtonElement)
    act(() => showManagerItem?.click())
    expect(onAppViewChange).toHaveBeenCalledWith('showManager')

    const mediaItem = navItems.find(item => item.getAttribute('aria-label') === 'Media Manager')
    expect(mediaItem).toBeInstanceOf(HTMLButtonElement)
    expect((mediaItem as HTMLButtonElement).type).toBe('button')
    expect(mediaItem?.getAttribute('aria-current')).toBeNull()
    const lyricItem = navItems.find(item => item.getAttribute('aria-label') === 'Lyric Manager')
    expect(lyricItem?.getAttribute('aria-current')).toBe('page')
    act(() => mediaItem?.click())
    expect(onAppViewChange).toHaveBeenCalledWith('media')
  })
})
