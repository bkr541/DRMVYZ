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
  useHealthStore.getState().reset()
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
  it('uses distinct health symbols and secondary system labels for all five live states', async () => {
    await render()
    const health = container.querySelector<HTMLButtonElement>('[data-health-readout]')!
    const chip = (system: string) => health.querySelector(`[data-health-system="${system}"]`)!
    expect(['cast', 'audio', 'graphics'].map(system => chip(system).getAttribute('data-health'))).toEqual(['idle', 'ok', 'ok'])
    expect(health.querySelector('.vz-header-readout-label')?.textContent).toBe('HEALTH')
    expect([...health.querySelectorAll('.vz-health-system-label')].map(el => el.textContent)).toEqual(['CAST', 'AUDIO', 'GFX'])
    expect(health.querySelectorAll('.vz-health-status-icon')).toHaveLength(3)
    expect(health.querySelector('.vz-header-readout-primary, .vz-header-readout-led')).toBeNull()
    const shapes = new Set<string>()
    for (const state of ['idle', 'ok', 'degraded', 'healing', 'failed'] as const) {
      await act(async () => useHealthStore.getState().setHealth('audio', state, `Audio ${state}`))
      expect(chip('audio').getAttribute('data-health')).toBe(state)
      const icon = chip('audio').querySelector('svg')!
      expect(icon.getAttribute('data-health')).toBe(state)
      shapes.add(icon.innerHTML)
      expect(chip('audio').getAttribute('title')).toContain(`Audio ${state}`)
      expect(health.getAttribute('aria-label')).toContain(`Audio ${state}`)
    }
    expect(shapes.size).toBe(5)
  })
  it('opens non-blocking live health diagnostics and closes by Escape or outside press', async () => {
    await render()
    const health = container.querySelector<HTMLButtonElement>('[data-health-readout]')!
    await act(async () => health.click())
    expect(health.getAttribute('aria-expanded')).toBe('true')
    const dialog = document.getElementById(health.getAttribute('aria-controls')!)!
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.textContent).toContain('No active casting session')
    expect(dialog.querySelectorAll('[data-health-diagnostic]')).toHaveLength(3)
    expect(document.querySelector('.drm-info-popover-backdrop')).toBeNull()
    await act(async () => useHealthStore.getState().setHealth('graphics', 'healing', 'Graphics context lost'))
    const graphics = dialog.querySelector('[data-health-diagnostic="graphics"]')!
    expect(graphics.textContent).toContain('Recovering')
    expect(graphics.textContent).toContain('Graphics context lost')
    expect(graphics.querySelector('time')?.getAttribute('datetime')).toBe(new Date(useHealthStore.getState().systems.graphics.since).toISOString())
    expect(dialog.textContent).toContain('Automatic system recovery')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(health.getAttribute('aria-expanded')).toBe('false')
    expect(dialog.isConnected).toBe(false)
    await act(async () => health.click())
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true })))
    expect(health.getAttribute('aria-expanded')).toBe('false')
    await act(async () => health.click())
    await act(async () => document.querySelector<HTMLButtonElement>('.vz-health-popover .drm-info-popover__close')!.click())
    expect(health.getAttribute('aria-expanded')).toBe('false')
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
