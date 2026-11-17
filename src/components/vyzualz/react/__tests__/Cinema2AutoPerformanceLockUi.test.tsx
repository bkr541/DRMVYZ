// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Cinema2SchemaControl } from '../Cinema2InspectorPanel'
import { Cinema2LiveValuesProvider } from '../Cinema2LiveValues'
import { CINEMA2_AUTO_PERFORMANCE_LOCK_REASON, type Cinema2InspectorControlModel } from '../../cinema2/parameters/Cinema2InspectorModel'

let container: HTMLElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()); container.remove() })

const make = (definition: Record<string, unknown>, value: unknown, locked: boolean): Readonly<Cinema2InspectorControlModel> => ({
  definition: { description: 'About this control.', ...definition }, value, enabled: !locked, disabledReason: null,
  ...(locked ? { locked: true, lockReason: CINEMA2_AUTO_PERFORMANCE_LOCK_REASON } : {}),
}) as unknown as Readonly<Cinema2InspectorControlModel>
const slider = (locked: boolean) => make({ id: 'rate', label: 'Rate', type: 'float', min: 0, max: 4, step: 0.05, defaultValue: 1.1 }, 1.1, locked)
const toggle = (locked: boolean) => make({ id: 'on', label: 'Center Object', type: 'boolean', defaultValue: true }, true, locked)
const dropdown = (locked: boolean) => make({ id: 'pick', label: 'Direction', type: 'enum', defaultValue: 'a', options: [{ value: 'a', label: 'Forward' }, { value: 'b', label: 'Reverse' }] }, 'a', locked)
const render = async (control: Readonly<Cinema2InspectorControlModel>, live?: Map<string, number>) => {
  await act(async () => root.render(
    <Cinema2LiveValuesProvider value={live ?? new Map()}><Cinema2SchemaControl control={control} onChange={() => {}} onTrigger={() => {}} /></Cinema2LiveValuesProvider>,
  ))
}

describe('the Auto Performance lock in the Inspector', () => {
  it('disables the control, shows its saved value, and adds a tooltip without adding any visible text', async () => {
    await render(slider(false))
    const before = container.textContent
    const unlockedHtml = container.innerHTML
    await render(slider(true))
    expect(container.textContent).toBe(before)
    const input = container.querySelector('input[type="range"]') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(input.value).toBe('1.1')
    const wrapper = container.querySelector('[data-auto-performance-locked]') as HTMLElement
    expect(wrapper.title).toBe(CINEMA2_AUTO_PERFORMANCE_LOCK_REASON)
    expect(wrapper.className).toBe('rv-ctrl-lock')
    // Locked or not, the control's own markup is identical (only the disabled state and the display-contents wrapper differ).
    expect(container.innerHTML.replace(/<div class="rv-ctrl-lock"[^>]*>/, '').replace(/<\/div>$/, '').replace(/ disabled=""/g, '')).toBe(unlockedHtml)
  })

  it('disables toggles and dropdowns the same way, and leaves an unlocked control alone', async () => {
    await render(toggle(true))
    expect([...container.querySelectorAll('input,button,select')].every(el => (el as HTMLInputElement).disabled)).toBe(true)
    await render(dropdown(true))
    expect(container.querySelector('[data-auto-performance-locked]')).not.toBeNull()
    await render(slider(false))
    expect(container.querySelector('[data-auto-performance-locked]')).toBeNull()
    expect((container.querySelector('input[type="range"]') as HTMLInputElement).disabled).toBe(false)
  })

  it('still shows the live readout and marker on a locked slider, so the music\'s movement stays visible', async () => {
    await render(slider(true), new Map([['rate', 2.4]]))
    expect(container.querySelector('[data-live-value]')!.textContent).toBe('2.40 →')
    expect(container.querySelector('[data-live-mark]')).not.toBeNull()
    expect((container.querySelector('input[type="range"]') as HTMLInputElement).disabled).toBe(true)
  })
})
