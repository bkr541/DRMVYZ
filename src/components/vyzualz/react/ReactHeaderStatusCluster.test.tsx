// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import { useHealthStore } from '../../../stores/healthStore'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactPersistenceStatusStore } from '../../../stores/reactPersistenceStatusStore'
import { usePageActivityStore } from '../../../stores/pageActivityStore'
import { ReactHeaderStatusCluster } from './ReactHeaderStatusCluster'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
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
  usePageActivityStore.getState().replaceOwnerSources('lyric-manager', 'readout-test', {})
})
const render = () => act(async () => root.render(<ReactHeaderStatusCluster fps={67} frameTimeMs={15} qualityTier="high" />))
describe('Option E React header readouts', () => {
  it('places the header search field directly before the status group', async () => {
    await render()
    const search = container.querySelector('.rv-header-search')
    expect(search?.querySelector('input[type="search"]')?.getAttribute('aria-label')).toBe('Search help')
    expect(search?.querySelector('.dv-library-search-icon')).toBeNull()
    expect(search?.nextElementSibling?.matches('[data-react-header-status]')).toBe(true)
  })
  it.each(['preset-manager', 'show-manager', 'lyric-manager', 'media-manager'] as const)('uses the same four readouts in %s', async page => {
    await act(async () => root.render(<VyzualzHeaderActions page={page} />))
    expect([...container.querySelectorAll('.rv-header-status .vz-header-readout-label')].map(el => el.textContent)).toEqual(['LOAD / SAVE', 'RENDER / FPS', 'QUALITY / CPU', 'HEALTH'])
    expect(container.querySelector('[data-performance-metric="fps"]')?.textContent).toBe('—')
    expect(container.querySelector('.vz-header-activity')).toBeNull()
  })
  it('uses the manager loading activity and preserves lyric save conflicts', async () => {
    useReactPersistenceStatusStore.setState({ phase: 'error', error: 'React save error' })
    usePageActivityStore.getState().replaceOwnerSources('lyric-manager', 'readout-test', { lyrics: 'Loading lyrics' })
    await act(async () => root.render(<VyzualzHeaderActions page="lyric-manager" saveStatus={{ label: 'Conflict', tone: 'error' }} />))
    expect(container.querySelector('.vz-header-readout-primary')?.textContent).toBe('Conflict')
    expect(container.querySelector('.vz-header-readout')?.getAttribute('data-busy')).toBe('true')
    expect(container.querySelector('.vz-header-readout')?.getAttribute('title')).toContain('Loading lyrics')
    expect(container.textContent).not.toContain('React save error')
  })
  it('groups live values under four captions without header notification/profile actions', async () => {
    await render()
    expect([...container.querySelectorAll('.rv-header-status .vz-header-readout-label')].map(el => el.textContent)).toEqual(['LOAD / SAVE', 'RENDER / FPS', 'QUALITY / CPU', 'HEALTH'])
    expect(container.querySelector('[data-performance-metric="fps"]')?.textContent).toBe('67')
    expect(container.querySelector('[data-performance-metric="frame-time"]')?.textContent).toBe('15.0ms')
    expect(container.querySelector('[data-performance-metric="quality"]')?.textContent).toBe('High')
    expect(container.querySelector('[data-header-cpu]')?.textContent).toBe('12%')
    expect(container.querySelector('.vz-header-notifications')).toBeNull()
    expect(container.querySelectorAll('.vz-header-readout')).toHaveLength(4)
  })
  it('shows a HEALTH chip per system that follows the health store', async () => {
    await render()
    const chip = (system: string) => container.querySelector(`[data-health-system="${system}"]`)?.getAttribute('data-health')
    expect(['cast', 'audio', 'graphics'].map(chip)).toEqual(['idle', 'ok', 'ok'])
    const health = container.querySelector('[data-health-readout]')!
    expect(health.closest('.vz-header-readout')?.querySelector('.vz-header-readout-label')?.textContent).toBe('HEALTH')
    expect([...health.querySelectorAll('.vz-header-readout-primary')].map(el => el.textContent)).toEqual(['CAST', 'AUDIO', 'GFX'])
    expect(health.querySelectorAll('.vz-header-readout-led')).toHaveLength(3)
    const quality = container.querySelector('[data-performance-metric="quality"]')!
    expect([...health.querySelectorAll('.vz-header-readout-primary')].every(el =>
      el.tagName === quality.tagName && el.className === quality.className && !el.querySelector('.vz-header-readout-led'))).toBe(true)
    expect(health.querySelector('em')).toBeNull()
    await act(async () => { useHealthStore.getState().setHealth('audio', 'healing', 'Audio output stopped') })
    expect(chip('audio')).toBe('healing')
    expect(container.querySelector('[data-health-readout]')?.getAttribute('aria-label')).toContain('Audio: failed; repairing itself')
    await act(async () => { useHealthStore.getState().reset() })
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
