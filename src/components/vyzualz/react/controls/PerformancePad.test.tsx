// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PerformancePad } from './PerformancePad'
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { vi.useFakeTimers(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers() })
const button = () => host.querySelector('button')!
const pointer = async (type: string) => { await act(async () => button().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))) }
const render = async (props: Partial<React.ComponentProps<typeof PerformancePad>> = {}) => { await act(async () => root.render(<PerformancePad label="Reactor" shortcut="1" color="#5993e8" {...props} />)) }
describe('reusable PerformancePad', () => {
  it('releases pointer feedback immediately and routes a click exactly once', async () => {
    const onActivate = vi.fn(); await render({ onActivate })
    await pointer('pointerdown'); expect(button().dataset.hit).toBe('true')
    await act(async () => vi.advanceTimersByTime(500)); expect(button().dataset.hit).toBe('true')
    await pointer('pointerup'); expect(button().dataset.hit).toBeUndefined()
    await act(async () => button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(onActivate).toHaveBeenCalledOnce(); expect(button().dataset.hit).toBeUndefined()
    expect(host.querySelector('.performance-pad-number')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('retains native keyboard activation without relatching the release glow', async () => {
    const onActivate = vi.fn(); await render({ onActivate })
    await act(async () => button().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    await act(async () => button().click())
    expect(button().dataset.hit).toBe('true'); expect(onActivate).toHaveBeenCalledOnce()
    await act(async () => button().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })))
    expect(button().dataset.hit).toBeUndefined()
  })
  it('keeps mirror activation inert and empty slots transparent and unassigned', async () => {
    const onActivate = vi.fn(); await render({ readOnly: true, onActivate })
    await act(async () => button().click()); expect(onActivate).not.toHaveBeenCalled()
    await render({ disabled: true, onActivate })
    await pointer('pointerdown'); await act(async () => button().click())
    expect(button().dataset.hit).toBeUndefined(); expect(button().style.getPropertyValue('--pad-color')).toBe('')
    expect(onActivate).not.toHaveBeenCalled()
  })
  it('clears hold state and pending pulses on focus loss and unmount', async () => {
    await render(); await pointer('pointerdown')
    await act(async () => window.dispatchEvent(new Event('blur'))); expect(button().dataset.hit).toBeUndefined()
    await act(async () => button().click()); expect(vi.getTimerCount()).toBe(1)
    await act(async () => root.unmount()); expect(vi.getTimerCount()).toBe(0)
    root = createRoot(host)
  })
})
