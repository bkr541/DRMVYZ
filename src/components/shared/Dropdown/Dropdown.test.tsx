// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dropdown, type DropdownOption } from './Dropdown'

const OPTIONS: readonly DropdownOption[] = [
  {
    value: 'orbit',
    label: 'Orbit',
    description: 'Manual orbit camera with user-controlled radius and speed',
  },
  {
    value: 'auto-director',
    label: 'Auto Director',
    description: 'Automatically reframes based on motion and scene activity',
  },
  {
    value: 'locked',
    label: 'Locked',
    description: 'Keeps the camera fixed for a stable presentation',
  },
]

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function renderDropdown(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(node))
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function keyDown(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  document.body.innerHTML = ''
  container = null
  root = null
  vi.clearAllMocks()
})

describe('Dropdown', () => {
  it('renders a custom combobox and portals the descriptive listbox', () => {
    renderDropdown(
      <Dropdown
        label="Camera Mode"
        menuLabel="Camera Modes"
        defaultValue="orbit"
        options={OPTIONS}
      />,
    )

    const trigger = container?.querySelector('[role="combobox"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
    expect(trigger?.textContent).toContain('Orbit')

    click(trigger as Element)

    const listbox = document.body.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    expect(container?.contains(listbox)).toBe(false)
    expect(trigger?.getAttribute('aria-expanded')).toBe('true')
    expect(listbox?.textContent).toContain('Camera Modes')
    expect(listbox?.textContent).toContain('Manual orbit camera')
    expect(listbox?.querySelector('[aria-selected="true"]')?.textContent).toContain('Orbit')
  })

  it('selects an option and closes the menu', () => {
    const onChange = vi.fn()
    renderDropdown(
      <Dropdown
        label="Camera Mode"
        defaultValue="orbit"
        options={OPTIONS}
        onChange={onChange}
      />,
    )

    const trigger = container?.querySelector('[role="combobox"]') as Element
    click(trigger)
    const autoDirector = [...document.body.querySelectorAll('[role="option"]')]
      .find(option => option.textContent?.includes('Auto Director'))
    expect(autoDirector).not.toBeNull()

    click(autoDirector as Element)

    expect(onChange).toHaveBeenCalledWith('auto-director', OPTIONS[1])
    expect(trigger.textContent).toContain('Auto Director')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })

  it('supports arrow-key navigation and skips disabled options', () => {
    const onChange = vi.fn()
    const options: readonly DropdownOption[] = [
      OPTIONS[0],
      { ...OPTIONS[1], disabled: true },
      OPTIONS[2],
    ]
    renderDropdown(
      <Dropdown
        ariaLabel="Camera mode"
        defaultValue="orbit"
        options={options}
        onChange={onChange}
      />,
    )

    const trigger = container?.querySelector('[role="combobox"]') as Element
    keyDown(trigger, 'ArrowDown')
    keyDown(trigger, 'ArrowDown')
    keyDown(trigger, 'Enter')

    expect(onChange).toHaveBeenCalledWith('locked', options[2])
    expect(trigger.textContent).toContain('Locked')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports controlled value and open state without mutating them internally', () => {
    const onChange = vi.fn()
    const onOpenChange = vi.fn()
    renderDropdown(
      <Dropdown
        ariaLabel="Camera mode"
        value="orbit"
        open
        options={OPTIONS}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />,
    )

    const autoDirector = [...document.body.querySelectorAll('[role="option"]')]
      .find(option => option.textContent?.includes('Auto Director'))
    click(autoDirector as Element)

    expect(onChange).toHaveBeenCalledWith('auto-director', OPTIONS[1])
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(container?.querySelector('[role="combobox"]')?.textContent).toContain('Orbit')
  })

  it('renders disabled and empty states accessibly', () => {
    renderDropdown(
      <Dropdown
        label="Camera Mode"
        options={[]}
        disabled
        emptyMessage="No camera modes"
      />,
    )

    const trigger = container?.querySelector('button') as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
  })
})
