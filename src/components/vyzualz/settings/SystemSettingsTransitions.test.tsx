/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVisualStore } from '../../../stores/visualStore'
import { SettingsModal } from './SettingsModal'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  localStorage.clear()
  useVisualStore.setState({ transitionsEnabled: false, transitionStyle: 'dissolve' })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
})

async function openGroup() {
  await act(async () => { root.render(<SettingsModal onClose={vi.fn()} />) })
  const tab = [...document.querySelectorAll('button, [role="tab"]')].find(element => element.textContent === 'System Settings') as HTMLElement
  await act(async () => { tab.click() })
  const group = [...document.querySelectorAll('.vsm-settings-group')].find(section => section.querySelector('h2')?.textContent === 'Transitions')
  expect(group).toBeTruthy()
  return group as HTMLElement
}

describe('System Settings > Transitions', () => {
  it('has a "Transitions in React" toggle, off by default, with no style choice while it is off', async () => {
    const group = await openGroup()
    const toggle = group.querySelector('button[aria-label="Transitions in React"]') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    expect(group.textContent).toContain('Transitions in React')
    expect(useVisualStore.getState().transitionsEnabled).toBe(false)
    expect(group.querySelector('[aria-label="Transition style"]')).toBeNull()
  })

  it('shows the style dropdown with five styles and Random once the toggle is on, and hides it again when it is turned off', async () => {
    const group = await openGroup()
    const toggle = group.querySelector('button[aria-label="Transitions in React"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    expect(useVisualStore.getState().transitionsEnabled).toBe(true)

    const trigger = group.querySelector('[aria-label="Transition style"]') as HTMLElement
    expect(trigger).toBeTruthy()
    expect(trigger.textContent).toContain('Dissolve')
    await act(async () => { trigger.click() })
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(6)
    for (const name of ['Dissolve', 'Flash', 'Wipe', 'Zoom', 'Dip to Black', 'Random']) expect(document.body.textContent).toContain(name)

    const random = [...document.querySelectorAll('[role="option"]')].find(option => option.textContent?.includes('Random')) as HTMLElement
    await act(async () => { random.click() })
    expect(useVisualStore.getState().transitionStyle).toBe('random')
    expect((group.querySelector('[aria-label="Transition style"]') as HTMLElement).textContent).toContain('Random')

    await act(async () => { toggle.click() })
    expect(useVisualStore.getState().transitionsEnabled).toBe(false)
    expect(group.querySelector('[aria-label="Transition style"]')).toBeNull()
    expect(useVisualStore.getState().transitionStyle).toBe('random')   // the choice is remembered while Transitions is off
  })
})
