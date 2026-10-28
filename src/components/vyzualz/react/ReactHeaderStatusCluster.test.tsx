// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactPersistenceStatusStore } from '../../../stores/reactPersistenceStatusStore'
import { usePageActivityStore } from '../../../stores/pageActivityStore'
import { ReactHeaderStatusCluster } from './ReactHeaderStatusCluster'
vi.mock('../../../native/useAppCpuUsage', () => ({ useAppCpuUsage: () => ({ status: 'ready', usage: { percent: 12.4, processCount: 6 } }) }))
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  useReactPersistenceStatusStore.getState().reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useReactPersistenceStatusStore.getState().reset()
  usePageActivityStore.getState().replaceOwnerSources('react', 'readout-test', {})
})
const render = () => act(async () => root.render(<ReactHeaderStatusCluster fps={67} frameTimeMs={15} qualityTier="high" />))
describe('Option E React header readouts', () => {
  it('groups live values under three captions without header notification/profile actions', async () => {
    await render()
    expect([...container.querySelectorAll('.vz-header-readout-label')].map(el => el.textContent)).toEqual(['LOAD / SAVE', 'RENDER / FPS', 'QUALITY / CPU'])
    expect(container.querySelector('[data-performance-metric="fps"]')?.textContent).toBe('67')
    expect(container.querySelector('[data-performance-metric="frame-time"]')?.textContent).toBe('15.0ms')
    expect(container.querySelector('[data-performance-metric="quality"]')?.textContent).toBe('HIGH')
    expect(container.querySelector('[data-header-cpu]')?.textContent).toBe('12%')
    expect(container.querySelector('.vz-header-notifications')).toBeNull()
    expect(container.querySelectorAll('.vz-header-readout')).toHaveLength(3)
  })
  it('keeps the load/save group present through idle, loading and dirty states', async () => {
    await render()
    expect(container.querySelector('.vz-header-readout-primary')?.textContent).toBe('Ready')
    await act(async () => {
      useReactPersistenceStatusStore.setState({ phase: 'dirty' })
      usePageActivityStore.getState().replaceOwnerSources('react', 'readout-test', { assets: 'Loading asset' })
    })
    expect(container.querySelector('.vz-header-readout-primary')?.textContent).toBe('Loading')
    expect(container.querySelector('.vz-header-readout em')?.textContent).toBe('Unsaved')
    expect(container.querySelector('.vz-header-readout')?.getAttribute('title')).toContain('Loading asset')
  })
  it('retains save error notices and the retry action', async () => {
    const retry = vi.fn(async () => {})
    const originalRetry = useReactPersistenceStatusStore.getState().retry
    try {
      useReactPersistenceStatusStore.setState({ phase: 'error', error: 'Disk full', retry })
      await render()
      expect(container.querySelector('.vz-header-readout-primary')?.textContent).toBe('Save failed')
      expect(container.textContent).toContain('Disk full')
      await act(async () => container.querySelector<HTMLButtonElement>('.vz-header-readout button')!.click())
      expect(retry).toHaveBeenCalledOnce()
    } finally { await act(async () => useReactPersistenceStatusStore.setState({ retry: originalRetry })) }
  })
})
