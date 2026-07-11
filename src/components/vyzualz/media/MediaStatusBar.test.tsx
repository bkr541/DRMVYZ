// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mediaState: {} as Record<string, unknown>,
  audioState: { loadError: null, clearError: vi.fn() } as Record<string, unknown>,
}))

vi.mock('../../../stores/mediaStore', () => ({ useMediaStore: () => mocks.mediaState }))
vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mocks.audioState),
}))

import { MediaStatusBar } from './MediaStatusBar'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.mediaState = {
    loading: false, loadError: null, deleteError: null, authRequired: false,
    storageAvailable: true, lastRestored: null,
    clearLoadError: vi.fn(), clearDeleteError: vi.fn(), clearRestored: vi.fn(),
    mutationStates: {}, collectionOrderMutations: {},
    retryMediaMutation: vi.fn(), reapplyMediaMutation: vi.fn(), clearMediaMutation: vi.fn(),
    retryCollectionReorder: vi.fn(), clearCollectionReorderError: vi.fn(),
  }
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('MediaStatusBar mutation recovery', () => {
  it('shows a revision conflict and deliberately reapplies the preserved operation', () => {
    mocks.mediaState.mutationStates = {
      'db-media-1:edit': {
        itemId: 'db-media-1', operation: 'edit', status: 'conflict',
        message: 'Changed in another session.', attempted: {}, updatedAt: 10,
      },
    }

    act(() => root.render(<MediaStatusBar />))

    expect(container.textContent).toContain('Media edit: Changed in another session.')
    const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Reapply')
    act(() => button?.click())
    expect(mocks.mediaState.reapplyMediaMutation).toHaveBeenCalledWith('db-media-1', 'edit')
  })

  it('shows rejected collection order with a retry action', () => {
    mocks.mediaState.collectionOrderMutations = {
      'collection-1': {
        collectionId: 'collection-1', status: 'failed', message: 'Foreign item.',
        attemptedOrder: [], previousOrder: [], updatedAt: 20,
      },
    }

    act(() => root.render(<MediaStatusBar />))

    expect(container.textContent).toContain('Collection order: Foreign item.')
    const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent === 'Retry')
    act(() => button?.click())
    expect(mocks.mediaState.retryCollectionReorder).toHaveBeenCalledWith('collection-1')
  })
})
