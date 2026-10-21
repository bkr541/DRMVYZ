// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VyzualzErrorBoundary } from './VyzualzErrorBoundary'

vi.mock('./react/output/ProductionOutput', () => ({ productionOutputController: { handleRendererCrash: vi.fn() } }))
vi.mock('../../lib/logger', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const button = () => container.querySelector<HTMLButtonElement>('.vz-error-boundary__reset')!

describe('VyzualzErrorBoundary', () => {
  it('offers Reload, not Try again, when a lazy module failed to download, and Reload hands control to onReload', async () => {
    const Broken = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: http://127.0.0.1:5173/x.tsx')))
    const onReload = vi.fn()
    await act(async () => root.render(
      <VyzualzErrorBoundary section="VyzualzView" onReload={onReload}>
        <Suspense fallback={null}><Broken /></Suspense>
      </VyzualzErrorBoundary>,
    ))

    expect(container.querySelector('.vz-error-boundary__label')?.textContent).toBe('VyzualzView could not load')
    expect(button().textContent).toBe('Reload')
    expect(container.textContent).not.toContain('Try again')
    act(() => button().click())
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('keeps Try again for an ordinary render error, and it re-renders the children', async () => {
    let shouldThrow = true
    const Flaky = () => {
      if (shouldThrow) throw new Error('Cannot read properties of null')
      return <span data-recovered>ok</span>
    }
    const onReload = vi.fn()
    await act(async () => root.render(<VyzualzErrorBoundary onReload={onReload}><Flaky /></VyzualzErrorBoundary>))

    expect(button().textContent).toBe('Try again')
    shouldThrow = false
    act(() => button().click())
    expect(container.querySelector('[data-recovered]')).not.toBeNull()
    expect(onReload).not.toHaveBeenCalled()
  })
})
