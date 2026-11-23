// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker, type DatePickerProps } from './DatePicker'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
const changes: string[] = []

function Harness({ initial = '', ...props }: { initial?: string } & Partial<DatePickerProps>) {
  const [value, setValue] = useState(initial)
  return <DatePicker ariaLabel="Start date" {...props} value={value} onChange={next => { changes.push(next); setValue(next) }} />
}
function render(node: React.ReactNode) {
  container = document.createElement('div'); document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(node))
}
afterEach(() => { if (root) act(() => root?.unmount()); container?.remove(); container = null; root = null; changes.length = 0; vi.useRealTimers() })

const trigger = () => container!.querySelector<HTMLButtonElement>('button.drm-dropdown__trigger')!
const menu = () => document.body.querySelector<HTMLElement>('.drm-datepicker__menu')
const day = (key: string) => document.body.querySelector<HTMLButtonElement>(`[data-date-key="${key}"]`)!
const click = (element: Element) => act(() => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
const keyDown = (element: Element, key: string, init: KeyboardEventInit = {}) => act(() => { element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })) })
const button = (label: string) => [...document.body.querySelectorAll<HTMLButtonElement>('.drm-datepicker__menu button')].find(entry => entry.textContent === label || entry.getAttribute('aria-label')?.startsWith(label))!

describe('DatePicker', () => {
  it('looks like every other dropdown: the canonical underline trigger and the dropdown popover surface, with the date in the viewer\'s format', () => {
    render(<Harness initial="2026-11-23" />)
    expect(container!.querySelector('.drm-dropdown.dv-underline-dropdown')).not.toBeNull()
    expect(trigger().querySelector('.drm-dropdown__value')!.textContent).toContain('Nov')
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger().querySelector('[data-app-icon="calendar"]')).not.toBeNull()
    click(trigger())
    expect(menu()!.classList.contains('drm-dropdown__menu')).toBe(true)
    expect(menu()!.getAttribute('role')).toBe('dialog')
    expect(menu()!.parentElement).toBe(document.body)
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })

  it('shows a placeholder while there is no date, and opens on the current month', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 5, 15, 10, 30))
    render(<Harness />)
    expect(trigger().querySelector('.drm-dropdown__value--placeholder')!.textContent).toBe('Select a date')
    click(trigger())
    expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('June 2026')
    expect(day('20260615').getAttribute('data-today')).toBe('true')
  })

  it('opens on the month of the value, marks the selected day, and picks a day and closes', () => {
    render(<Harness initial="2026-11-23" />)
    click(trigger())
    expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('November 2026')
    expect(day('20261123').getAttribute('data-selected')).toBe('true')
    expect(document.body.querySelectorAll('.drm-datepicker__day')).toHaveLength(42)
    click(day('20261105'))
    expect(changes).toEqual(['2026-11-05'])
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('closes on Escape and on a click outside, without changing the value', () => {
    render(<Harness initial="2026-11-23" />)
    click(trigger()); keyDown(menu()!, 'Escape')
    expect(menu()).toBeNull()
    click(trigger())
    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(menu()).toBeNull()
    expect(changes).toEqual([])
  })

  it('moves by keyboard: arrows by day and week, Page keys by month, Home and End by week, Enter picks', () => {
    render(<Harness initial="2026-11-23" />)
    click(trigger())
    expect(document.activeElement).toBe(day('20261123'))
    const grid = menu()!.querySelector('[role="grid"]')!
    keyDown(grid, 'ArrowRight'); expect(document.activeElement).toBe(day('20261124'))
    keyDown(grid, 'ArrowDown'); expect(document.activeElement).toBe(day('20261201'))
    expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('December 2026')
    keyDown(grid, 'PageUp'); expect(document.activeElement).toBe(day('20261101'))
    keyDown(grid, 'PageDown', { shiftKey: true }); expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('November 2027')
    keyDown(grid, 'Home'); expect(document.activeElement).toBe(day('20271031'))
    keyDown(grid, 'End'); expect(document.activeElement).toBe(day('20271106'))
    click(document.activeElement!)
    expect(changes).toEqual(['2027-11-06'])
  })

  it('opens from the keyboard with the down arrow', () => {
    render(<Harness initial="2026-11-23" />)
    keyDown(trigger(), 'ArrowDown')
    expect(menu()).not.toBeNull()
  })

  it('steps months with the header buttons and jumps to a month and year from the title', () => {
    render(<Harness initial="2026-11-23" />)
    click(trigger())
    click(button('Next month')); expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('December 2026')
    click(button('Previous month')); click(button('Previous month')); expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('October 2026')
    click(menu()!.querySelector('.drm-datepicker__title')!)
    click(button('Next year')); expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('2027')
    click(menu()!.querySelector('[data-month-pick="2"]')!)
    expect(menu()!.querySelector('.drm-datepicker__title')!.textContent).toBe('February 2027')
    click(day('20270210'))
    expect(changes).toEqual(['2027-02-10'])
  })

  it('will not pick a day outside min and max, and will not step to a month with none', () => {
    render(<Harness initial="2026-11-15" min="2026-11-10" max="2026-11-20" />)
    click(trigger())
    expect(day('20261109').disabled).toBe(true)
    expect(day('20261121').disabled).toBe(true)
    click(day('20261109')); expect(changes).toEqual([]); expect(menu()).not.toBeNull()
    expect(button('Previous month').disabled).toBe(true)
    expect(button('Next month').disabled).toBe(true)
    click(day('20261120')); expect(changes).toEqual(['2026-11-20'])
  })

  it('offers Today and Clear, and Clear is left out when the date must always have a value', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 5, 15, 10, 30))
    render(<Harness initial="2026-11-23" />)
    click(trigger()); click(button('Clear'))
    expect(changes).toEqual(['']); expect(menu()).toBeNull()
    click(trigger()); click(button('Today'))
    expect(changes).toEqual(['', '2026-06-15'])
    act(() => root?.render(<Harness initial="2026-11-23" clearable={false} />))
    click(trigger())
    expect(button('Clear')).toBeUndefined()
  })

  it('in date and time mode, keeps the time when a day is picked, stays open, and sets the time from its fields', () => {
    render(<Harness initial="2026-11-23T18:05" mode="datetime" />)
    expect(trigger().querySelector('.drm-dropdown__value')!.textContent).toMatch(/Nov 23, 2026/)
    click(trigger())
    click(day('20261105'))
    expect(changes).toEqual(['2026-11-05T18:05'])
    expect(menu()).not.toBeNull()
    const minute = menu()!.querySelector<HTMLInputElement>('input[aria-label="Minute"]')!
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(minute, '45'); minute.dispatchEvent(new Event('input', { bubbles: true })) })
    act(() => { minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })) })
    expect(changes.at(-1)).toBe('2026-11-05T18:45')
    const hour = menu()!.querySelector<HTMLInputElement>('input[aria-label="Hour"]')!
    keyDown(hour, 'ArrowUp')
    expect(changes.at(-1)).toBe('2026-11-05T19:45')
    click(button('Done'))
    expect(menu()).toBeNull()
  })

  it('keeps Tab inside the open calendar, and hands its label and description to assistive technology', () => {
    render(<Harness initial="2026-11-23" ariaDescribedBy="note" label="Starts" ariaLabel={undefined} />)
    expect(trigger().getAttribute('aria-labelledby')).toBeTruthy()
    expect(trigger().getAttribute('aria-describedby')).toBe('note')
    click(trigger())
    const focusable = [...menu()!.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)')]
    focusable.at(-1)!.focus()
    keyDown(focusable.at(-1)!, 'Tab')
    expect(document.activeElement).toBe(focusable[0])
  })

  it('does not open when disabled', () => {
    render(<Harness initial="2026-11-23" disabled />)
    click(trigger()); expect(menu()).toBeNull()
  })
})
