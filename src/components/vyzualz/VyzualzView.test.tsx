// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLyricsStore } from '../../stores/lyricsStore'
import type { AppView, PerformanceAppView } from './appView'

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
  MediaManagerView: ({ onOpenLyricManager }: { onOpenLyricManager: (intent: { id: string; targetAudioTrackId: string; workflow: 'ai-extract' }) => void }) => (
    <div data-testid="media-manager">
      Media Manager
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

beforeEach(() => {
  useLyricsStore.getState().markEditorDirty(false)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Vyzualz production application-view routing', () => {
  it('does not expose Visualizer and keeps every current workspace selectable through the real router', async () => {
    await renderView('react')

    const labels = [...(container?.querySelectorAll<HTMLElement>('.az-nav-item') ?? [])]
      .map(item => item.getAttribute('aria-label'))
    expect(labels).toEqual(['React', 'Show Manager', 'Lyric Manager', 'Media Manager'])
    expect(labels).not.toContain('Visualizer')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Show Manager')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()

    await clickLabel('Media Manager')
    expect(container?.querySelector('[data-testid="media-manager"]')).not.toBeNull()

    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')).not.toBeNull()
  })

  it('contains no production Visualizer workspace import or render branch', () => {
    const source = readFileSync(new URL('./VyzualzView.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('VisualizerWorkspace')
    expect(source).not.toContain("appView === 'visualizer'")
  })

  it('returns Lyric Manager to the originating performance view', async () => {
    await renderView('react')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('react')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Show Manager')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('showManager')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()
  })

  it('preserves the originating performance view across manager-to-manager navigation', async () => {
    await renderView('react')
    await clickLabel('Media Manager')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('react')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Show Manager')
    await clickLabel('Media Manager')
    await clickLabel('Lyric Manager')
    expect(container?.querySelector('[data-testid="lyric-manager"]')?.getAttribute('data-return-view')).toBe('showManager')
    await clickLabel('Back')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()
  })

  it('returns Lyric Manager previews to the originating current performance view', async () => {
    await renderView('react')
    await clickLabel('Lyric Manager')
    await clickLabel('Preview')
    expect(container?.querySelector('[data-testid="react-workspace"]')).not.toBeNull()

    await clickLabel('Show Manager')
    await clickLabel('Lyric Manager')
    await clickLabel('Preview')
    expect(container?.querySelector('[data-testid="show-manager"]')).not.toBeNull()
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
