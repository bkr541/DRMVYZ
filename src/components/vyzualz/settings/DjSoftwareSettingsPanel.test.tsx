/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DjSoftwareSettingsPanel } from './DjSoftwareSettingsPanel'

let root: Root
let host: HTMLDivElement
let syncIndex: ReturnType<typeof vi.fn>

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

beforeEach(async () => {
  localStorage.clear()
  syncIndex = vi.fn(async () => ({
    available: true,
    selectedRootPath: '/Volumes/LUMA',
    selectedRootName: 'LUMA',
    hasIndex: true,
    syncedAt: '2026-10-12T10:00:00.000Z',
    trackCount: 2278,
    detectedAnlzFiles: 6830,
  }))
  window.drmvyzNative = {
    rekordbox: {
      getIndexStatus: vi.fn(async () => ({
        available: true,
        selectedRootPath: '/Volumes/LUMA',
        selectedRootName: 'LUMA',
        hasIndex: false,
      })),
      selectIndexDirectory: vi.fn(async () => ({
        available: true,
        selectedRootPath: '/Volumes/LUMA',
        selectedRootName: 'LUMA',
        hasIndex: false,
        cancelled: false,
      })),
      syncIndex,
    },
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => root.render(<DjSoftwareSettingsPanel />))
  await flush()
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  delete window.drmvyzNative
  vi.restoreAllMocks()
})

describe('DjSoftwareSettingsPanel', () => {
  it('shows the selected Rekordbox directory and indexes it on Sync', async () => {
    expect(host.textContent).toContain('/Volumes/LUMA')
    const syncButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'Sync')
    expect(syncButton).toBeTruthy()
    await act(async () => syncButton?.click())
    await flush()
    expect(syncIndex).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Indexed')
    expect(host.textContent).toContain('2,278')
    expect(host.textContent).toContain('6,830')
  })

  it('offers non-functional DJ providers as coming-soon choices', async () => {
    const trigger = host.querySelector<HTMLButtonElement>('#vsm-dj-software-select')
    await act(async () => trigger?.click())
    const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(candidate => candidate.textContent?.includes('Serato DJ Pro'))
    await act(async () => option?.click())
    expect(host.textContent).toContain('not available yet')
    expect(host.textContent).not.toContain('Rekordbox Library Index')
  })
})
