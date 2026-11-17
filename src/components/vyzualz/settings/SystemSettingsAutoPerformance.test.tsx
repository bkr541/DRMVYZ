/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCinema2AutoPerformanceUserDefault, setCinema2AutoPerformanceUserDefault } from '../cinema2/parameters/Cinema2AutoPerformanceDefault'
import { useVisualStore } from '../../../stores/visualStore'
import { SettingsModal } from './SettingsModal'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  localStorage.clear()
  useVisualStore.setState({ autoPerformanceDefault: false })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  setCinema2AutoPerformanceUserDefault(null)
})

describe('System Settings > Auto Performance', () => {
  it('shows a default row whose toggle sets the Cinema 2.0 Auto Performance default', async () => {
    await act(async () => { root.render(<SettingsModal onClose={vi.fn()} />) })
    const tab = [...document.querySelectorAll('button, [role="tab"]')].find(element => element.textContent === 'System Settings') as HTMLElement
    await act(async () => { tab.click() })
    const group = [...document.querySelectorAll('.vsm-settings-group')].find(section => section.querySelector('h2')?.textContent === 'Auto Performance')
    expect(group).toBeTruthy()
    expect(group!.textContent).toContain('Default: Off')
    expect(getCinema2AutoPerformanceUserDefault()).toBe(false)

    const toggle = group!.querySelector('button[aria-label="Auto Performance default"]') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    await act(async () => { toggle.click() })
    expect(useVisualStore.getState().autoPerformanceDefault).toBe(true)
    expect(getCinema2AutoPerformanceUserDefault()).toBe(true)
    expect(group!.textContent).toContain('Default: On')
  })
})
