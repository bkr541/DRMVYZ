// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ source: 'file' as 'file' | 'microphone' | 'demo' }))

vi.mock('../../context/AudioEngineContext', () => ({
  useSharedAudio: () => fixture,
}))

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

  it('renders Media Manager directly beneath Lyric Manager and navigates to media', () => {
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

    const navItems = [...container.querySelectorAll<HTMLElement>('.az-nav-item')]
    const labels = navItems.map(item => item.getAttribute('aria-label'))
    expect(labels.indexOf('Show Manager')).toBe(labels.indexOf('Visualizer') + 1)
    expect(labels.indexOf('Media Manager')).toBe(labels.indexOf('Lyric Manager') + 1)

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
