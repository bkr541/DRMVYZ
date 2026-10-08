// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CPU_POLL_INTERVAL_MS } from '../../../native/useAppCpuUsage'
import { usePageActivities, usePageActivityStore } from '../../../stores/pageActivityStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import { HeaderSystemStatus } from './HeaderSystemStatus'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const setNative = (getCpuUsage?: () => Promise<unknown>) => {
  ;(window as unknown as { drmvyzNative?: unknown }).drmvyzNative = getCpuUsage ? { system: { getCpuUsage } } : undefined
}
const usage = (percent: number) => ({ percent, rawPercent: percent * 8, processCount: 4, cores: 8, timestamp: Date.now() })

const ring = () => container.querySelector<HTMLElement>('.vz-header-activity')!
const cpu = () => container.querySelector<HTMLElement>('.vz-header-cpu')!

async function render(page: AppPageId = 'react') {
  await act(async () => root.render(<HeaderSystemStatus page={page} />))
}

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  usePageActivityStore.setState({ pages: { 'react': {}, 'show-manager': {}, 'media-manager': {}, 'lyric-manager': {} } })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  setNative(undefined)
  vi.useRealTimers()
})

describe('HeaderSystemStatus CPU readout', () => {
  it('shows a dash with an explanation outside the desktop app instead of inventing a number', async () => {
    setNative(undefined)
    await render()
    expect(cpu().dataset.cpuStatus).toBe('unavailable')
    expect(cpu().textContent).toContain('—')
    expect(cpu().title).toBe('App CPU usage is only available in the desktop app')
  })

  it('shows the desktop app\'s CPU and refreshes it on the poll interval', async () => {
    const getCpuUsage = vi.fn()
      .mockResolvedValueOnce(usage(7.4))
      .mockResolvedValue(usage(23.6))
    setNative(getCpuUsage)
    await render()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(cpu().dataset.cpuStatus).toBe('ready')
    expect(cpu().textContent).toContain('7%')
    expect(cpu().title).toContain('7.4%')
    await act(async () => { await vi.advanceTimersByTimeAsync(CPU_POLL_INTERVAL_MS) })
    expect(cpu().textContent).toContain('24%')
    expect(getCpuUsage).toHaveBeenCalledTimes(2)
  })

  it('stops polling when unmounted and keeps the last value if a read fails', async () => {
    const getCpuUsage = vi.fn().mockResolvedValueOnce(usage(10)).mockRejectedValue(new Error('ipc'))
    setNative(getCpuUsage)
    await render()
    await act(async () => { await vi.advanceTimersByTimeAsync(CPU_POLL_INTERVAL_MS * 2) })
    expect(cpu().textContent).toContain('10%')
    await act(async () => root.unmount())
    const calls = getCpuUsage.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(CPU_POLL_INTERVAL_MS * 3) })
    expect(getCpuUsage.mock.calls.length).toBe(calls)
    root = createRoot(container)
  })
})

describe('HeaderSystemStatus activity ring', () => {
  it('rests idle, spins while this page has loading work, and lists what is loading', async () => {
    await render('react')
    expect(ring().dataset.busy).toBe('false')
    expect(ring().textContent).toContain('Loading')
    expect(ring().classList.contains('vz-header-chip--labeled')).toBe(true)
    expect(container.querySelector('.vz-header-activity-arc--spinning')).toBeNull()
    expect(ring().title).toBe('Nothing loading')

    await act(async () => usePageActivityStore.getState().replaceOwnerSources('react', 'test', { a: 'Loading media', b: 'Saving project' }))
    expect(ring().dataset.busy).toBe('true')
    expect(container.querySelector('.vz-header-activity-arc--spinning')).not.toBeNull()
    expect(ring().title).toBe('Loading: Loading media, Saving project')

    await act(async () => usePageActivityStore.getState().replaceOwnerSources('react', 'test', {}))
    expect(ring().dataset.busy).toBe('false')
  })

  it('only reacts to its own page', async () => {
    await render('lyric-manager')
    expect(ring().textContent).not.toContain('Loading')
    expect(ring().classList.contains('vz-header-chip--square')).toBe(true)
    await act(async () => usePageActivityStore.getState().replaceOwnerSources('media-manager', 'test', { a: 'Uploading media' }))
    expect(ring().dataset.busy).toBe('false')
  })

  it('has the same gray, borderless button treatment as the header icon buttons', async () => {
    await render()
    for (const el of [cpu(), ring()]) {
      expect(el.classList.contains('vsm-settings-btn')).toBe(true)
      expect(el.classList.contains('vz-header-status-chip')).toBe(true)
    }
  })
})

function Probe({ page, loading }: { page: AppPageId; loading: boolean }) {
  usePageActivities(page, 'probe', { fetch: loading && 'Fetching' })
  return null
}

describe('usePageActivities', () => {
  it('registers while loading, clears when done, and clears on unmount', async () => {
    const labels = () => Object.values(usePageActivityStore.getState().pages['media-manager'])
    await act(async () => root.render(<Probe page="media-manager" loading />))
    expect(labels()).toEqual(['Fetching'])
    await act(async () => root.render(<Probe page="media-manager" loading={false} />))
    expect(labels()).toEqual([])
    await act(async () => root.render(<Probe page="media-manager" loading />))
    expect(labels()).toEqual(['Fetching'])
    await act(async () => root.render(<div />))
    expect(labels()).toEqual([])
  })

  it('keeps separate owners on one page from clearing each other and ignores no-op updates', async () => {
    const { replaceOwnerSources } = usePageActivityStore.getState()
    replaceOwnerSources('react', 'one', { x: 'A' })
    replaceOwnerSources('react', 'two', { x: 'B' })
    replaceOwnerSources('react', 'one', {})
    expect(Object.values(usePageActivityStore.getState().pages.react)).toEqual(['B'])
    const before = usePageActivityStore.getState().pages
    replaceOwnerSources('react', 'two', { x: 'B' })
    expect(usePageActivityStore.getState().pages).toBe(before)
  })
})
