// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleReactPersistenceStatus, useReactPersistenceStatusStore } from '../../../stores/reactPersistenceStatusStore'
import { ReactPersistenceStatus } from './ReactPersistenceStatus'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

beforeEach(() => {
  useReactPersistenceStatusStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(<ReactPersistenceStatus />))
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  useReactPersistenceStatusStore.getState().reset()
})

describe('React persistence health UI', () => {
  it('surfaces persistence failures and retries the failed save', async () => {
    const retry = vi.fn().mockResolvedValue(true)
    act(() => {
      handleReactPersistenceStatus({
        phase: 'error',
        storageName: 'drmvyz-react-store',
        error: 'IndexedDB unavailable',
        retry,
      })
    })

    const alert = container?.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Changes not safely stored')
    const button = alert?.querySelector<HTMLButtonElement>('button')
    expect(button?.textContent).toBe('Retry')

    await act(async () => {
      button?.click()
      await Promise.resolve()
    })

    expect(retry).toHaveBeenCalledTimes(1)
    expect(container?.querySelector('[role="status"]')?.textContent).toContain('Saved')
  })

  it('shows pending and saving states before a successful save', () => {
    act(() => handleReactPersistenceStatus({ phase: 'dirty', storageName: 'react' }))
    expect(container?.textContent).toContain('Unsaved changes')

    act(() => handleReactPersistenceStatus({ phase: 'saving', storageName: 'react' }))
    expect(container?.textContent).toContain('Saving')

    act(() => handleReactPersistenceStatus({ phase: 'saved', storageName: 'react', lastSavedAt: Date.now() }))
    expect(container?.textContent).toContain('Saved')
  })
})
