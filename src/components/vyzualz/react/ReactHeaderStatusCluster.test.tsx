// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleReactPersistenceStatus, useReactPersistenceStatusStore } from '../../../stores/reactPersistenceStatusStore'
import { ReactHeaderStatusCluster } from './ReactHeaderStatusCluster'

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
})

const render = () => act(async () => root.render(<ReactHeaderStatusCluster fps={67} frameTimeMs={15} qualityTier="high" />))
const stacks = () => [...container.querySelectorAll<HTMLElement>('.rv-header-status-stack')]
const kind = (node: Element) => node.classList.contains('vz-header-activity') ? 'loading'
  : node.classList.contains('rv-persistence-status') ? 'saved'
    : node.getAttribute('data-performance-metric') ?? (node.classList.contains('vz-header-cpu') ? 'cpu' : 'other')

describe('React header status cluster', () => {
  it('stacks Loading over Saved, FPS over Frame Time and Quality over CPU, then Notifications', async () => {
    await render()
    act(() => handleReactPersistenceStatus({ phase: 'saved', storageName: 'react' }))
    expect(stacks().map(stack => stack.getAttribute('data-header-stack'))).toEqual(['loading+saved', 'fps+frame-time', 'quality+cpu'])
    expect(stacks().map(stack => [...stack.children].map(kind))).toEqual([['loading', 'saved'], ['fps', 'frame-time'], ['quality', 'cpu']])
    const cluster = container.querySelector('[data-react-header-status]')!
    expect(cluster.lastElementChild?.classList.contains('vz-header-notifications')).toBe(true)
    // Loading and Notifications are the production chips, with their labels.
    expect(container.querySelector('.vz-header-activity .vz-header-state-label')?.textContent).toBe('Loading')
    expect(container.querySelector('.vz-header-notifications .vz-header-state-label')?.textContent).toBe('Notifications')
  })

  it('shows every reading with its label, value and the Saved chip only once there is a save state', async () => {
    await render()
    expect(container.querySelector('[data-performance-metric="fps"]')?.textContent).toBe('FPS67')
    expect(container.querySelector('[data-performance-metric="frame-time"]')?.textContent).toBe('FRAME TIME15.0 ms')
    expect(container.querySelector('[data-performance-metric="quality"]')?.textContent).toBe('QUALITYhigh')
    expect(container.querySelector('.vz-header-cpu:not(.vz-header-performance-metric) .vz-header-cpu-label')?.textContent).toBe('CPU')
    // Idle: nothing to save yet, so Loading stands alone in its stack.
    expect(stacks()[0]!.children).toHaveLength(1)
    act(() => handleReactPersistenceStatus({ phase: 'dirty', storageName: 'react' }))
    expect(stacks()[0]!.children).toHaveLength(2)
    expect(container.querySelector('.rv-persistence-status')?.textContent).toContain('Unsaved changes')
  })

  it('keeps the stacks and the readings free of borders and backgrounds, and gives each stack one label column', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles/reactView.css'), 'utf8')
    const block = css.slice(css.indexOf('/* ── React header status cluster'))
    // The stack wrappers never carry a border, background, shadow or outline.
    const stackRules = [...block.matchAll(/(^|\n)(\.rv-header-status-stack(?:\[[^\]]*\])?)\s*\{([^}]*)\}/g)]
    expect(stackRules.length).toBeGreaterThan(0)
    for (const [, , selector, body] of stackRules) expect(body, selector).not.toMatch(/(^|[;\s])(background[a-z-]*|border[a-z-]*|box-shadow|outline[a-z-]*)\s*:/)
    // FPS, Frame Time, Quality and CPU are plain lines.
    expect(block).toMatch(/\.vz-header-cpu \{[^}]*border: 0;[^}]*background: none;[^}]*box-shadow: none;/)
    // Loading and Saved are flattened the same way, so no line in the cluster carries a border, background or shadow.
    expect(block).toMatch(/\.vz-header-activity,\s*\.rv-header-status \.rv-header-status-stack > \.rv-persistence-status[^{]*\{[^}]*height: var\(--rv-header-line-h\);[^}]*border: 0;[^}]*background: none;[^}]*box-shadow: none;/)
    expect(block).not.toMatch(/linear-gradient\(180deg, #1a2228/)
    expect(block).toContain("[data-header-stack='loading+saved'] { --rv-header-label-col: 52px; }")
    expect(block).toContain("[data-header-stack='fps+frame-time'] { --rv-header-label-col: 68px; }")
    expect(block).toContain("[data-header-stack='quality+cpu'] { --rv-header-label-col: 50px; }")
  })
})
