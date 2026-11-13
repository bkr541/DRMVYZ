// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PerformancePadStudies } from './PerformancePadStudies'
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  vi.useFakeTimers()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<PerformancePadStudies />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers() })
const pad = (row: string) => host.querySelector<HTMLButtonElement>(`[data-pad-study-item="${row}-drop-cage"]`)!
const pointer = async (button: HTMLElement, type: string) => { await act(async () => button.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))) }
describe('performance pad strike previews', () => {
  it('holds the strike until release, then fades without losing the selected state', async () => {
    for (const row of ['signal', 'compact', 'underline', 'accent-rail', 'glow']) {
      const button = pad(row)
      await pointer(button, 'pointerdown')
      await act(async () => vi.advanceTimersByTime(500))
      expect(button.dataset.hit).toBe('true')
      await pointer(button, 'pointerup')
      expect(button.dataset.hit).toBeUndefined()
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
      expect(button.dataset.hit).toBeUndefined()
      expect(button.getAttribute('aria-pressed')).toBe('true')
    }
  })
  it('supports held Space and Enter presses with immediate release', async () => {
    for (const key of [' ', 'Enter']) {
      const button = pad('signal')
      await act(async () => button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
      expect(button.dataset.hit).toBe('true')
      await act(async () => vi.advanceTimersByTime(500))
      expect(button.dataset.hit).toBe('true')
      await act(async () => button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true })))
      expect(button.dataset.hit).toBeUndefined()
    }
  })
  it('clears canceled presses and simultaneous strikes when the preview loses focus', async () => {
    await pointer(pad('signal'), 'pointerdown')
    await pointer(pad('signal'), 'pointercancel')
    expect(pad('signal').dataset.hit).toBeUndefined()
    await pointer(pad('signal'), 'pointerdown')
    await pointer(host.querySelector<HTMLButtonElement>('[data-pad-study-item="signal-reactor"]')!, 'pointerdown')
    expect(host.querySelectorAll('[data-hit="true"]')).toHaveLength(2)
    await act(async () => window.dispatchEvent(new Event('blur')))
    expect(host.querySelectorAll('[data-hit="true"]')).toHaveLength(0)
  })
})
