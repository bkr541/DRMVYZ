// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeDiagnosticsBridge, NativeMainLogAppendChunk } from '../../../../native/diagnosticsBridge'
import { DeveloperPanel } from './DeveloperPanel'

const SEED_LOG = [
  '[2026-09-22 10:00:00.000] [info]  (system:main) app ready',
  '[2026-09-22 10:00:01.000] [warn]  (react:WebGL2Renderer) context lost',
  '[2026-09-22 10:00:02.000] [error] (react:VyzualzErrorBoundary) VyzualzView crashed: boom',
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
  it('shows five sub-tabs and defaults to Logging', () => {
    const navButtons = [...document.querySelectorAll<HTMLButtonElement>('.vsm-dev-panel .rv-right-subtabs button')].map(b => b.textContent)
    expect(navButtons).toEqual(['Logging', 'Feature Flags', 'Network', 'Performance', 'Storage'])
    expect(document.querySelector('.vsm-dev-panel .rv-right-subtabs .is-active')?.textContent).toBe('Logging')
  })

  it('loads the seeded main.log content into sortable rows', () => {
    expect(readMainLog).toHaveBeenCalledTimes(1)
    const rows = rowsText()
    expect(rows).toHaveLength(3)
    expect(rows.some(text => text.includes('app ready'))).toBe(true)
    expect(rows.some(text => text.includes('context lost'))).toBe(true)
    expect(rows.some(text => text.includes('VyzualzView crashed: boom'))).toBe(true)
    // None of the seeded entries are multi-line, so none should offer to expand.
    expect(document.querySelector('.vsm-dev-log-row--collapsible')).toBeNull()
  })

  it('splits the "<component>:<category>" scope convention into a Component column and a narrower Scope', () => {
    const componentLabels = [...document.querySelectorAll('.vsm-dev-log-component')].map(el => el.textContent)
    expect(componentLabels.sort()).toEqual(['React', 'React', 'System'])
    const scopes = [...document.querySelectorAll('.vsm-dev-log-scope')].map(el => el.textContent)
    expect(scopes.sort()).toEqual(['VyzualzErrorBoundary', 'WebGL2Renderer', 'main'])
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

  it('filters rows using the level dropdown, defaulting to All', async () => {
    const trigger = document.querySelector<HTMLButtonElement>('.vsm-dev-log-level-select[role="combobox"]')!
    expect(trigger.textContent).toContain('All')

    await act(async () => trigger.click())
    const errorOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === 'ERROR')!
    await act(async () => errorOption.click())

    const rows = rowsText()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('VyzualzView crashed')
    expect(document.querySelector('.vsm-dev-log-count')?.textContent).toBe('1 / 3')

    await act(async () => trigger.click())
    const allOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === 'All')!
    await act(async () => allOption.click())
    expect(rowsText()).toHaveLength(3)
  })

  it('filters rows using the component dropdown, defaulting to All', async () => {
    const trigger = document.querySelector<HTMLButtonElement>('.vsm-dev-log-component-select[role="combobox"]')!
    expect(trigger.textContent).toContain('All')

    await act(async () => trigger.click())
    const systemOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === 'System')!
    await act(async () => systemOption.click())

    const rows = rowsText()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('app ready')
    expect(document.querySelector('.vsm-dev-log-count')?.textContent).toBe('1 / 3')

    await act(async () => trigger.click())
    const allOption = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent === 'All')!
    await act(async () => allOption.click())
    expect(rowsText()).toHaveLength(3)
  })

  it('sorts rows by component', async () => {
    const componentHeader = [...document.querySelectorAll('.vsm-dev-log-table thead th')]
      .find(th => th.textContent?.includes('Component')) as HTMLElement

    await act(async () => componentHeader.click())
    expect(componentHeader.getAttribute('aria-sort')).toBe('descending')
    const desc = [...document.querySelectorAll('.vsm-dev-log-component')].map(el => el.textContent)
    expect(desc).toEqual(['System', 'React', 'React']) // desc alpha: system > react

    await act(async () => componentHeader.click())
    expect(componentHeader.getAttribute('aria-sort')).toBe('ascending')
    const asc = [...document.querySelectorAll('.vsm-dev-log-component')].map(el => el.textContent)
    expect(asc).toEqual(['React', 'React', 'System'])
  })

  it('filters with a "component:" search token', async () => {
    const search = document.querySelector<HTMLInputElement>('.vsm-dev-log-search')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(search, 'component:system')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const rows = rowsText()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('app ready')
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

  it('copies a single row to the clipboard via its hover copy icon, without toggling expand', async () => {
    const row = [...document.querySelectorAll<HTMLElement>('.vsm-dev-log-row')]
      .find(candidate => candidate.textContent?.includes('context lost'))!
    const copyButton = row.querySelector<HTMLButtonElement>('.vsm-dev-log-copy-row-btn')!

    await act(async () => copyButton.click())
    expect(clipboardWriteText).toHaveBeenCalledTimes(1)
    const copied = clipboardWriteText.mock.calls[0]![0] as string
    expect(copied).toContain('context lost')
    expect(copied).not.toContain('app ready')
    // This entry is single-line and has no expand affordance at all.
    expect(row.classList.contains('vsm-dev-log-row--collapsible')).toBe(false)
  })

  it('gives every row a copy icon, even ones without an expand affordance', () => {
    const rows = [...document.querySelectorAll<HTMLElement>('.vsm-dev-log-row')]
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.querySelector('.vsm-dev-log-copy-row-btn')).not.toBeNull()
    }
  })
})

describe('DeveloperPanel multi-line message collapsing', () => {
  it('collapses a folded stack trace to its first line and expands on click', async () => {
    const stackTraceLog = [
      '[2026-09-22 10:05:00.000] [error]        Error sending from webFrameMain:  Error: boom',
      '    at WebFrameMain.send (node:electron/js2c/browser_init:2:104635)',
      '    at WebContents.send (node:electron/js2c/browser_init:2:88680)',
      '',
    ].join('\n')

    const bridge: NativeDiagnosticsBridge = {
      log: vi.fn(),
      readMainLog: vi.fn(async () => ({
        path: '/tmp/main.log', content: stackTraceLog, truncated: false, sizeBytes: stackTraceLog.length,
      })),
      watchMainLog: vi.fn(() => () => {}),
    }
    window.drmvyzNative = { runtime: { isElectron: true, platform: 'darwin' }, diagnostics: bridge }

    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    await act(async () => r.render(<DeveloperPanel />))
    await flush()

    const row = el.querySelector<HTMLElement>('.vsm-dev-log-row')!
    expect(row.classList.contains('vsm-dev-log-row--collapsible')).toBe(true)
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(row.querySelector('.vsm-dev-log-expand-caret')?.textContent).toBe('▸')
    expect(row.querySelector('.vsm-dev-log-message-first')?.textContent).toBe('Error sending from webFrameMain:  Error: boom')
    expect(row.querySelector('.vsm-dev-log-message-collapse')?.classList.contains('is-expanded')).toBe(false)
    expect(row.querySelector('.vsm-dev-log-message-collapse pre')?.textContent).toContain('WebFrameMain.send')

    await act(async () => row.click())
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(row.querySelector('.vsm-dev-log-expand-caret')?.textContent).toBe('▾')
    expect(row.querySelector('.vsm-dev-log-message-collapse')?.classList.contains('is-expanded')).toBe(true)

    await act(async () => row.click())
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(row.querySelector('.vsm-dev-log-message-collapse')?.classList.contains('is-expanded')).toBe(false)

    await act(async () => r.unmount())
    el.remove()
    delete window.drmvyzNative
  })

  it('copying a collapsible row does not also toggle its expand state', async () => {
    const stackTraceLog = [
      '[2026-09-22 10:05:30.000] [error] boom summary',
      '    at somewhere.js:1:1',
      '',
    ].join('\n')

    const writeText = vi.fn(async (_text: string) => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const bridge: NativeDiagnosticsBridge = {
      log: vi.fn(),
      readMainLog: vi.fn(async () => ({
        path: '/tmp/main.log', content: stackTraceLog, truncated: false, sizeBytes: stackTraceLog.length,
      })),
      watchMainLog: vi.fn(() => () => {}),
    }
    window.drmvyzNative = { runtime: { isElectron: true, platform: 'darwin' }, diagnostics: bridge }

    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    await act(async () => r.render(<DeveloperPanel />))
    await flush()

    const row = el.querySelector<HTMLElement>('.vsm-dev-log-row')!
    const copyButton = row.querySelector<HTMLButtonElement>('.vsm-dev-log-copy-row-btn')!

    await act(async () => copyButton.click())
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]![0] as string).toContain('somewhere.js')
    expect(row.getAttribute('aria-expanded')).toBe('false') // unaffected by the copy click

    await act(async () => r.unmount())
    el.remove()
    delete window.drmvyzNative
  })

  it('toggles expansion via keyboard (Enter/Space) for accessibility', async () => {
    const stackTraceLog = [
      '[2026-09-22 10:06:00.000] [warn]  multi-line message',
      'second line',
      '',
    ].join('\n')

    const bridge: NativeDiagnosticsBridge = {
      log: vi.fn(),
      readMainLog: vi.fn(async () => ({
        path: '/tmp/main.log', content: stackTraceLog, truncated: false, sizeBytes: stackTraceLog.length,
      })),
      watchMainLog: vi.fn(() => () => {}),
    }
    window.drmvyzNative = { runtime: { isElectron: true, platform: 'darwin' }, diagnostics: bridge }

    const el = document.createElement('div')
    document.body.appendChild(el)
    const r = createRoot(el)
    await act(async () => r.render(<DeveloperPanel />))
    await flush()

    const row = el.querySelector<HTMLElement>('.vsm-dev-log-row')!
    expect(row.getAttribute('tabIndex') ?? row.tabIndex.toString()).toBeTruthy()
    await act(async () => {
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(row.getAttribute('aria-expanded')).toBe('true')

    await act(async () => r.unmount())
    el.remove()
    delete window.drmvyzNative
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
