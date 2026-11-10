// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ browserProps: { current: null as null | { activeMediaId: string | null; onSelect?: (id: string) => void; context?: string } } }))

vi.mock('../../media/MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: (props: { activeMediaId: string | null; onSelect?: (id: string) => void; context?: string }) => {
    mocks.browserProps.current = props
    return <div data-testid="media-library-browser" />
  },
}))

import { useReactStore } from '../../../../stores/reactStore'
import { DEFAULT_HEADLINER_SETTINGS } from './HeadlinerSettings'
import { HeadlinerBackdropPanel } from './HeadlinerWorkspace'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  useReactStore.setState({ headlinerSettings: { ...DEFAULT_HEADLINER_SETTINGS, presetId: 'motion-echo' } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  mocks.browserProps.current = null
})

describe('Headliner backdrop panel', () => {
  it('shows the shared media library and says Virtual Backdrop is off until a background is chosen', async () => {
    await act(async () => root.render(<HeadlinerBackdropPanel />))
    expect(container.querySelector('[data-testid="media-library-browser"]')).not.toBeNull()
    expect(mocks.browserProps.current?.activeMediaId).toBeNull()
    expect(container.querySelector('[data-headliner-backdrop-inactive="true"]')).not.toBeNull()
    expect(container.textContent).toContain('None chosen')
    expect(container.textContent).not.toContain('Clear Background')
  })

  it('choosing a library item stores it and turns Virtual Backdrop on', async () => {
    await act(async () => root.render(<HeadlinerBackdropPanel />))
    await act(async () => mocks.browserProps.current?.onSelect?.('media-42'))
    const settings = useReactStore.getState().headlinerSettings
    expect(settings.backdropMediaId).toBe('media-42')
    expect(settings.presetId).toBe('virtual-backdrop')
    expect(mocks.browserProps.current?.activeMediaId).toBe('media-42')
    expect(container.querySelector('[data-headliner-backdrop-inactive="true"]')).toBeNull()
  })

  it('clears the chosen background without changing the preset', async () => {
    useReactStore.setState({ headlinerSettings: { ...DEFAULT_HEADLINER_SETTINGS, presetId: 'virtual-backdrop', backdropMediaId: 'media-42' } })
    await act(async () => root.render(<HeadlinerBackdropPanel />))
    const clear = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Clear Background'))
    expect(clear).toBeDefined()
    await act(async () => clear!.click())
    const settings = useReactStore.getState().headlinerSettings
    expect(settings.backdropMediaId).toBeNull()
    expect(settings.presetId).toBe('virtual-backdrop')
  })
})
