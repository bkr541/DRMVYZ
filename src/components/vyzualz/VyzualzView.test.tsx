// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLyricsStore } from '../../stores/lyricsStore'
import type { AppView, PerformanceAppView } from './appView'

const lifecycle = vi.hoisted(() => ({
  hotkeys: vi.fn(),
  activeEffects: 0,
  mounts: 0,
  unmounts: 0,
}))

vi.mock('./VisualizerWorkspace', () => ({
  VisualizerWorkspace: ({ onAppViewChange }: { onAppViewChange: (view: AppView) => void }) => {
    useEffect(() => {
      lifecycle.mounts += 1
      lifecycle.activeEffects += 1
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'f' || event.key === 'F' || event.key === ' ' || /^[1-9]$/.test(event.key)) {
          lifecycle.hotkeys(event.key)
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        lifecycle.unmounts += 1
        lifecycle.activeEffects -= 1
        window.removeEventListener('keydown', handleKeyDown)
      }
    }, [])

    return (
      <div data-testid="visualizer-workspace">
        <button aria-label="React" onClick={() => onAppViewChange('react')}>React</button>
        <button aria-label="Show Manager" onClick={() => onAppViewChange('showManager')}>Show Manager</button>
        <button aria-label="Lyric Manager" onClick={() => onAppViewChange('lyrics')}>Lyrics</button>
        <button aria-label="Media Manager" onClick={() => onAppViewChange('media')}>Media</button>
      </div>
    )
  },
}))

vi.mock('./react/ReactView', () => ({
  ReactView: ({ onOpenMediaManager }: { onOpenMediaManager?: () => void }) => (
    <div data-testid="react-workspace">
      React workspace
      <button onClick={onOpenMediaManager}>Open Media Manager</button>
    </div>
  ),
}))

vi.mock('./showManager/ShowManagerView', () => ({
  ShowManagerView: () => <div data-testid="show-manager">Show Manager workspace</div>,
}))

vi.mock('../../features/media/MediaManagerView', () => ({
  MediaManagerView: ({ onBack, returnView, onOpenLyricManager }: { onBack: () => void; returnView: PerformanceAppView; onOpenLyricManager: (intent: { id: string; targetAudioTrackId: string; workflow: 'ai-extract' }) => void }) => (
    <div data-testid="media-manager" data-return-view={returnView}>
      Media Manager
      <button onClick={onBack}>Back</button>
      <button onClick={onBack}>Preview</button>
      <button onClick={() => onOpenLyricManager({ id: 'intent-1', targetAudioTrackId: 'track-a', workflow: 'ai-extract' })}>Open Track Lyrics</button>
    </div>
  ),
}))

vi.mock('../../features/lyrics/LyricManagerView', () => ({
  LyricManagerView: ({ onBack, returnView, navigationIntent, onNavigationIntentConsumed }: { onBack: () => void; returnView: PerformanceAppView; navigationIntent?: { id: string; targetAudioTrackId: string; workflow: string } | null; onNavigationIntentConsumed?: (id: string) => void }) => (
    <div data-testid="lyric-manager" data-return-view={returnView} data-target-track={navigationIntent?.targetAudioTrackId ?? ''} data-workflow={navigationIntent?.workflow ?? ''}>
      Lyric Manager
      <button onClick={onBack}>Back</button>
      <button onClick={onBack}>Preview</button>
      {navigationIntent && <button onClick={() => onNavigationIntentConsumed?.(navigationIntent.id)}>Consume Intent</button>}
    </div>
  ),
}))

import { VyzualzView } from './VyzualzView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderView(initialAppView: AppView = 'react'): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <VyzualzView
        activeView="vyzualz"
        onNavigate={() => {}}
        initialAppView={initialAppView}
      />,
    )
  })
  await flush()
}

async function clickLabel(label: string): Promise<void> {
  const button = [...(container?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(candidate => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label)
  expect(button, `button ${label}`).toBeDefined()
  await act(async () => {
    button?.click()
    await Promise.resolve()
  })
  await flush()
}

function press(key: string): void {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
}

beforeEach(() => {
  lifecycle.hotkeys.mockClear()
  lifecycle.activeEffects = 0
  lifecycle.mounts = 0
  lifecycle.unmounts = 0
  useLyricsStore.getState().markEditorDirty(false)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Vyzualz application-view lifecycle isolation', () => {
  it('keeps Visualizer hotkeys inactive in React, Show Manager, Media Manager, and Lyric Manager', async () => {
    await renderView('react')
    press('f')
    press(' ')
    press('1')
    expect(lifecycle.hotkeys).not.toHaveBeenCalled()

    await clickLabel('Show Manager')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()
    press('f')
    expect(lifecycle.hotkeys).not.toHaveBeenCalled()

    await clickLabel('Visualizer')
    expect(lifecycle.activeEffects).toBe(1)
    await clickLabel('Media Manager')
    lifecycle.hotkeys.mockClear()
    press('f')
    press(' ')
    expect(lifecycle.hotkeys).not.toHaveBeenCalled()

    await clickLabel('Lyric Manager')
    press('1')
    expect(lifecycle.hotkeys).not.toHaveBeenCalled()
    expect(lifecycle.activeEffects).toBe(0)
  })

  it('preserves Visualizer behavior while Visualizer is active', async () => {
    await renderView('visualizer')
    press('f')
    press(' ')
    press('2')
    expect(lifecycle.hotkeys.mock.calls.map(call => call[0])).toEqual(['f', ' ', '2'])
    expect(lifecycle.activeEffects).toBe(1)
  })

  it('returns Lyric Manager to the originating performance view', async () => {
    await renderView('react')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('react')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Visualizer')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('visualizer')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="visualizer-workspace"]')).not.toBeNull()

    await clickLabel('Show Manager')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('showManager')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()
  })

  it('preserves manager origin across manager-to-manager navigation', async () => {
    await renderView('react')
    await clickLabel('Media Manager')
    expect(container?.querySelector('[data-testid="media-manager"]')?.getAttribute('data-return-view')).toBe('react')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('react')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Visualizer')
    await clickLabel('Media Manager')
    expect(container?.querySelector('[data-testid="media-manager"]')?.getAttribute('data-return-view')).toBe('visualizer')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="visualizer-workspace"]')).not.toBeNull()
  })

  it('returns Lyric Manager previews to the originating performance view', async () => {
    await renderView('react')
    await clickLabel('Lyric Manager')
    await clickLabel('Preview')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Visualizer')
    await clickLabel('Lyric Manager')
    await clickLabel('Preview')
    expect(container?.querySelector('[data-testid="visualizer-workspace"]')).not.toBeNull()
  })

  it('cleans up global listeners and side effects across repeated view switches', async () => {
    await renderView('visualizer')
    press('f')
    expect(lifecycle.hotkeys).toHaveBeenCalledTimes(1)

    await clickLabel('React')
    expect(lifecycle.activeEffects).toBe(0)
    press('f')
    expect(lifecycle.hotkeys).toHaveBeenCalledTimes(1)

    await clickLabel('Visualizer')
    expect(lifecycle.activeEffects).toBe(1)
    press('f')
    expect(lifecycle.hotkeys).toHaveBeenCalledTimes(2)
    expect(lifecycle.mounts).toBe(2)
    expect(lifecycle.unmounts).toBe(1)
  })

  it('passes a one-time typed lyric navigation intent from Media Manager into Lyric Manager', async () => {
    await renderView('react')
    await clickLabel('Media Manager')
    await clickLabel('Open Track Lyrics')

    const manager = container?.querySelector('[data-testid="lyric-manager"]')
    expect(manager?.getAttribute('data-target-track')).toBe('track-a')
    expect(manager?.getAttribute('data-workflow')).toBe('ai-extract')

    await clickLabel('Consume Intent')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-target-track')).toBe('')
  })

})
