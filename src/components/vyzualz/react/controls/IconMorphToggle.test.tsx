// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IconMorphCheckbox, IconMorphToggle } from './IconMorphToggle'
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
it('updates the approved switch artwork and preserves checked and disabled semantics', async () => {
  const changed = vi.fn()
  function Switch() { const [checked, setChecked] = useState(false); return <IconMorphToggle aria-label="Enabled" checked={checked} onCheckedChange={value => { setChecked(value); changed(value) }} /> }
  await act(async () => root.render(<Switch />))
  const button = container.querySelector('button')!
  expect(button.getAttribute('aria-checked')).toBe('false')
  expect(button.querySelector('[data-app-icon="off"]')).not.toBeNull()
  await act(async () => button.click())
  expect(changed).toHaveBeenCalledWith(true)
  expect(button.getAttribute('aria-checked')).toBe('true')
  expect(button.querySelector('[data-app-icon="check"]')).not.toBeNull()
  await act(async () => root.render(<IconMorphToggle checked disabled onCheckedChange={changed} />))
  await act(async () => container.querySelector('button')!.click())
  expect(changed).toHaveBeenCalledTimes(1)
})
it('keeps uncontrolled checkbox submission, change events and form reset native', async () => {
  const changed = vi.fn()
  await act(async () => root.render(<form><IconMorphCheckbox name="enabled" defaultChecked onChange={changed} aria-label="Enabled" /></form>))
  const input = container.querySelector('input')!, form = container.querySelector('form')!
  expect(input.checked).toBe(true)
  expect(new FormData(form).get('enabled')).toBe('on')
  await act(async () => input.click())
  expect(input.checked).toBe(false)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(new FormData(form).has('enabled')).toBe(false)
  form.reset()
  expect(input.checked).toBe(true)
  expect(container.querySelector('.dv-icon-morph-checkbox__on [data-app-icon="check"]')).not.toBeNull()
  expect(container.querySelector('.dv-icon-morph-checkbox__off [data-app-icon="off"]')).not.toBeNull()
})
it('preserves controlled checkbox changes and the input ref', async () => {
  const ref = { current: null as HTMLInputElement | null }
  function Checkbox() { const [checked, setChecked] = useState(false); return <IconMorphCheckbox ref={ref} checked={checked} onChange={event => setChecked(event.target.checked)} /> }
  await act(async () => root.render(<Checkbox />))
  await act(async () => ref.current!.click())
  expect(ref.current!.checked).toBe(true)
  expect(container.querySelector('.dv-icon-morph-checkbox.is-on')).not.toBeNull()
})
