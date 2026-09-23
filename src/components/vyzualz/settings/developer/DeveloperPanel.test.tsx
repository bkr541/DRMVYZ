// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeDiagnosticsBridge, NativeMainLogAppendChunk } from '../../../../native/diagnosticsBridge'
import { DeveloperPanel } from './DeveloperPanel'

const SEED_LOG = [
  '[2026-09-22 10:00:00.000] [info]  (main) app ready',
  '[2026-09-22 10:00:01.000] [warn]  (renderer:WebGL2Renderer) context lost',
  '[2026-09-22 10:00:02.000] [error] (renderer:VyzualzErrorBoundary) VyzualzView crashed: boom',
].join('\n') + '\n'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let readMainLog: ReturnType<typeof vi.fn>
let watchCallback: ((chunk: NativeMainLogAppendChunk) => void) | null
let unwatch: ReturnType<typeof vi.fn>
let clipboardWriteText: ReturnType<typeof vi.fn>

function rowsText(): string[] {
  return [...document.body.querySelectorAll<HTMLElement>('.vsm-dev-log-row')].map(row => row.textContent ?? '')
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

beforeEach(async () => {
  watchCallback = null
  unwatch = vi.fn()
  readMainLog = vi.fn(async () => ({
    path: '/tmp/main.log',
    content: SEED_LOG,
    truncated: false,
    sizeBytes: SEED_LOG.length,
  }))
  clipboardWriteText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteText },
    configurable: true,
  })

  const bridge: NativeDiagnosticsBridge = {
    log: vi.fn(),
    readMainLog,
    watchMainLog: vi.fn(callback => {
      watchCallback = callback
      return unwatch
    }),
  }
  window.drmvyzNative = { runtime: { isElectron: true, platform: 'darwin' }, diagnostics: bridge }

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<DeveloperPanel />))
  await flush()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete window.drmvyzNative
  vi.restoreAllMocks()
})

describe('DeveloperPanel', () => {
  it('shows five sub-nav groups and defaults to Logging', () => {
    const navButtons = [...document.querySelectorAll<HTMLButtonElement>('.vsm-dev-nav button')].map(b => b.textContent)
    expect(navButtons).toEqual(['Logging', 'Feature Flags', 'Network', 'Performance', 'Storage'])
    expect(document.querySelector('.vsm-dev-nav .vsm-nav-item--active')?.textContent).toBe('Logging')
  })

  it('loads the seeded main.log content into sortable rows', () => {
    expect(readMainLog).toHaveBeenCalledTimes(1)
    const rows = rowsText()
    expect(rows).toHaveLength(3)
    expect(rows.some(text => text.includes('app ready'))).toBe(true)
    expect(rows.some(text => text.includes('context lost'))).toBe(true)
    expect(rows.some(text => text.includes('VyzualzView crashed: boom'))).toBe(true)
  })

  it('switches to a placeholder group and back without losing the log view', async () => {
    await act(async () => buttonWithText('Network').click())
    expect(document.querySelector('.vsm-dev-placeholder h2')?.textContent).toBe('Network')
    expect(document.querySelector('.vsm-dev-log-table')).toBeNull()

    await act(async () => buttonWithText('Logging').click())
    expect(rowsText()).toHaveLength(3)
  })

  it('sorts rows when a column header is clicked', async () => {
    const levelHeader = [...document.querySelectorAll('.vsm-dev-log-table thead th')]
      .find(th => th.textContent?.includes('Level')) as HTMLElement
    expect(levelHeader.getAttribute('aria-sort')).toBe('none')

    await act(async () => levelHeader.click())
    expect(levelHeader.getAttribute('aria-sort')).toBe('descending')
    let levels = [...document.querySelectorAll('.vsm-dev-log-level')].map(el => el.textContent)
    expect(levels).toEqual(['WARN', 'INFO', 'ERROR']) // desc alpha: warn > info > error

    await act(async () => levelHeader.click())
    expect(levelHeader.getAttribute('aria-sort')).toBe('ascending')
    levels = [...document.querySelectorAll('.vsm-dev-log-level')].map(el => el.textContent)
    expect(levels).toEqual(['ERROR', 'INFO', 'WARN'])
  })

  it('filters rows by clicking a level chip', async () => {
    const errorChip = [...document.querySelectorAll<HTMLButtonElement>('.vsm-dev-log-chip')]
      .find(chip => chip.textContent === 'error')!
    await act(async () => errorChip.click())

    const rows = rowsText()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('VyzualzView crashed')
    expect(document.querySelector('.vsm-dev-log-count')?.textContent).toBe('1 / 3')

    await act(async () => errorChip.click())
    expect(rowsText()).toHaveLength(3)
  })

  it('filters with a "scope:" search token', async () => {
    const search = document.querySelector<HTMLInputElement>('.vsm-dev-log-search')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(search, 'scope:WebGL2Renderer')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const rows = rowsText()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('context lost')
  })

  it('appends live-tailed entries pushed through the watch callback', async () => {
    expect(watchCallback).toBeTypeOf('function')
    expect(document.querySelector('.vsm-media-sync-dot')?.classList.contains('is-online')).toBe(false)

    await act(async () => {
      watchCallback?.({ content: '[2026-09-22 10:00:03.000] [debug] (renderer:AudioEngine) device list changed\n' })
    })

    const rows = rowsText()
    expect(rows).toHaveLength(4)
    expect(rows.some(text => text.includes('device list changed'))).toBe(true)
    expect(document.querySelector('.vsm-media-sync-dot')?.classList.contains('is-online')).toBe(true)
  })

  it('unsubscribes the live-tail watcher on unmount', async () => {
    await act(async () => root.unmount())
    expect(unwatch).toHaveBeenCalledTimes(1)
    // Re-render for the shared afterEach unmount to stay a no-op.
    root = createRoot(container)
  })

  it('copies filtered rows to the clipboard', async () => {
    const copyButton = buttonWithText('Copy filtered')
    await act(async () => copyButton.click())
    expect(clipboardWriteText).toHaveBeenCalledTimes(1)
    const copied = clipboardWriteText.mock.calls[0]![0] as string
    expect(copied).toContain('app ready')
    expect(copied).toContain('context lost')
    expect(copied).toContain('VyzualzView crashed: boom')
  })

  it('clears the view without touching the log file', async () => {
    await act(async () => buttonWithText('Clear').click())
    expect(rowsText()).toHaveLength(0)
    expect(document.querySelector('.vsm-dev-log-count')?.textContent).toBe('0 / 0')
  })
})

describe('DeveloperPanel without the native diagnostics bridge', () => {
  it('shows a desktop-app-required message instead of throwing', async () => {
    delete window.drmvyzNative
    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    await act(async () => r.render(<DeveloperPanel />))
    await flush()

    expect(el.textContent).toContain('needs the desktop app')
    await act(async () => r.unmount())
    el.remove()
  })
})
