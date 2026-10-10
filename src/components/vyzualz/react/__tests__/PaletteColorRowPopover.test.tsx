// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PaletteColorRow } from '../ReactControlRows'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function Harness() {
  const [value, setValue] = useState('#2060ff')
  return <div data-testid="group"><PaletteColorRow label="Metal" value={value} onChange={setValue} /><output>{value}</output></div>
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const trigger = () => container.querySelector<HTMLButtonElement>('.rv-ctrl-palette-hdr')!
const popover = () => document.body.querySelector<HTMLElement>('.rv-ctrl-palette-popover')

describe('PaletteColorRow popover', () => {
  it('opens the picker in a popover on the document body instead of inline in the group, and keeps the row the same size', async () => {
    await act(async () => root.render(<Harness />))
    expect(popover()).toBeNull()
    await act(async () => trigger().click())
    const open = popover()
    expect(open).not.toBeNull()
    expect(container.contains(open)).toBe(false)
    expect(open!.parentElement).toBe(document.body)
    expect(open!.getAttribute('role')).toBe('dialog')
    expect(open!.querySelector('.rv-ctrl-palette-gradient-square')).not.toBeNull()
    expect(open!.querySelector('input[type="range"]')).not.toBeNull()
    expect(container.querySelector('.rv-ctrl-palette-body')).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })

  it('closes on Escape, on an outside press and on a second click of the row, but not on a press inside it', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => trigger().click())
    await act(async () => { popover()!.querySelector('.rv-ctrl-palette-gradient-square')!.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(popover()).not.toBeNull()
    await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(popover()).toBeNull()

    await act(async () => trigger().click())
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(popover()).toBeNull()

    await act(async () => trigger().click())
    await act(async () => trigger().click())
    expect(popover()).toBeNull()
  })
})
