// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VyzualzSidebar } from './VyzualzSidebar'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('VyzualzSidebar Media Manager navigation', () => {
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
    expect(labels.indexOf('Media Manager')).toBe(labels.indexOf('Lyric Manager') + 1)

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
