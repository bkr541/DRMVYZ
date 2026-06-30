// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../../stores/reactStore'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import { ReactPerformancePads } from '../ReactPerformancePads'

const constellationPreset = DEFAULT_REACT_PRESETS.find(preset => (
  resolveCinematicConfigForPreset(preset, {})?.worldMode === 'reactiveConstellation'
))!

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  vi.useFakeTimers()
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactPreset(constellationPreset.id)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<ReactPerformancePads />))
  const header = container.querySelector('[role="button"][aria-expanded]') as HTMLElement
  await act(async () => header.click())
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('React performance pads', () => {
  it('exposes toggle state with aria-pressed and keeps preset pads in remaining slots', async () => {
    const freeze = [...container.querySelectorAll('button')]
      .find(button => button.getAttribute('aria-label')?.startsWith('Freeze.')) as HTMLButtonElement
    expect(freeze.getAttribute('aria-pressed')).toBe('false')

    await act(async () => freeze.click())
    expect(freeze.getAttribute('aria-pressed')).toBe('true')
    expect(useReactStore.getState().performanceActionToggleStates['reactiveConstellation.freeze']).toBe(true)

    const presetPad = [...container.querySelectorAll('button')]
      .find(button => button.title.includes('[D]')) as HTMLButtonElement
    expect(presetPad).not.toBeNull()
    expect(presetPad.classList.contains('rv-pad--action')).toBe(false)
  })

  it('ignores form-field keyboard input and cleans momentary feedback timers on unmount', async () => {
    const input = document.createElement('input')
    container.appendChild(input)
    const before = useReactStore.getState().performanceActionSeq
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }))
    expect(useReactStore.getState().performanceActionSeq).toBe(before)

    const collapse = [...container.querySelectorAll('button')]
      .find(button => button.getAttribute('aria-label')?.startsWith('Collapse.')) as HTMLButtonElement
    await act(async () => collapse.click())
    expect(collapse.classList.contains('rv-pad--pressed')).toBe(true)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    await act(async () => root.unmount())
    expect(vi.getTimerCount()).toBe(0)
    root = createRoot(container)
  })
})
