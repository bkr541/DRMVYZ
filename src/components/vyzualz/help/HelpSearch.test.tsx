// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpSearch } from './HelpSearch'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

const input = () => container.querySelector<HTMLInputElement>('input[type="search"]')!
const type = async (value: string) => act(async () => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input(), value)
  input().dispatchEvent(new Event('input', { bubbles: true }))
})
const key = async (name: string) => act(async () => { input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })) })
const options = () => [...document.querySelectorAll('.hs-option-title')].map(el => el.textContent)

describe('HelpSearch', () => {
  it('shows nothing until something is typed, then lists only matching topics', async () => {
    await act(async () => root.render(<HelpSearch />))
    expect(document.querySelector('.hs-panel')).toBeNull()
    expect(container.querySelector('label')?.textContent).toBe('SEARCH')
    await type('tap')
    expect(options()).toEqual(['Tap Tempo'])
    await type('manager')
    expect(options()).toEqual(['Preset Manager', 'Show Manager', 'Media Manager', 'Lyric Manager'])
  })
  it('says so when nothing matches', async () => {
    await act(async () => root.render(<HelpSearch />))
    await type('zzzz')
    expect(document.querySelector('.hs-empty')?.textContent).toContain('zzzz')
  })
  it('moves through the results with the arrow keys and chooses with Enter', async () => {
    const onSelect = vi.fn()
    await act(async () => root.render(<HelpSearch onSelect={onSelect} />))
    await type('manager')
    expect(input().getAttribute('aria-expanded')).toBe('true')
    await key('ArrowDown')
    expect(document.querySelector('[aria-selected="true"] .hs-option-title')?.textContent).toBe('Show Manager')
    expect(input().getAttribute('aria-activedescendant')).toBe(document.querySelector('[aria-selected="true"]')?.id)
    await key('Enter')
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].title).toBe('Show Manager')
    expect(document.querySelector('.hs-panel')).toBeNull()
  })
  it('opens a popover with the chosen topic\u2019s detail, and clears it when typing again or on Escape', async () => {
    await act(async () => root.render(<HelpSearch />))
    await type('tap')
    await act(async () => { (document.querySelector('.hs-option') as HTMLElement).click() })
    const dialog = () => document.querySelector('[role="dialog"].hs-detail-popover')
    expect(dialog()?.querySelector('.drm-info-popover__title')?.textContent).toBe('Tap Tempo')
    expect(dialog()?.querySelector('.drm-info-popover__description')?.textContent).toBe('Sets the beats per minute by tapping along.')
    expect([...dialog()!.querySelectorAll('.drm-info-popover__section-label')].map(el => el.textContent)).toEqual(['What it does', 'When to use it', 'What it affects', 'Tip'])
    expect(document.querySelector('.hs-panel')).toBeNull()
    await type('tapp')
    expect(dialog()).toBeNull()
    await type('tap')
    await key('Enter')
    expect(dialog()).not.toBeNull()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    expect(dialog()).toBeNull()
  })
  it('closes on Escape and when pressing outside, and reopens when typing again', async () => {
    await act(async () => root.render(<HelpSearch />))
    await type('mood')
    await key('Escape')
    expect(document.querySelector('.hs-panel')).toBeNull()
    await type('moo')
    expect(options()).toEqual(['Mood Conductor'])
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(document.querySelector('.hs-panel')).toBeNull()
  })
})
