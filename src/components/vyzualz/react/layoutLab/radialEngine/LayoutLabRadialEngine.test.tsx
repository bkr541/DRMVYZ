// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabRadialEngine } from './LayoutLabRadialEngine'
import type { RadialEngineVariant } from './engineChoices'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

const mount = (variant: RadialEngineVariant) => act(async () => root.render(<LayoutLabRadialEngine variant={variant} />))
const trigger = () => host.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')!
const overlay = () => document.body.querySelector('[data-radial-engine-overlay]')
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')!
const key = (target: Element, name: string) => act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })) })
const click = (node: Element) => act(async () => (node as HTMLElement).click())

describe.each(['dial', 'orbit', 'rotary'] as const)('radial engine selector: %s', variant => {
  beforeEach(async () => { await mount(variant) })

  it('keeps the production engine card and opens a portaled dialog listing every engine', async () => {
    expect(trigger().getAttribute('aria-label')).toContain('Cinema 2.0, preset Electric Storm')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector('.rv-engine-dropdown-preset')?.textContent).toBe('Electric Storm')
    await click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(dialog().getAttribute('aria-label')).toBe('Choose React engine')
    expect(host.contains(overlay())).toBe(false)
    expect(document.body.contains(overlay())).toBe(true)
    if (variant === 'rotary') expect(dialog().textContent).toContain('Cinema 2.0')
    else expect(document.body.querySelectorAll('[role="menuitemradio"]')).toHaveLength(6)
  })

  it('moves focus with the arrow keys, selects with Enter, updates the card and returns focus', async () => {
    await click(trigger())
    await key(dialog(), 'ArrowRight')
    await key(dialog(), 'ArrowRight')
    await key(dialog(), 'Enter')
    expect(overlay()).toBeNull()
    expect(trigger().getAttribute('aria-label')).toContain('CANVAS, preview only')
    expect(host.querySelector('.rv-engine-dropdown-label')?.textContent).toBe('CANVAS')
    expect(host.querySelector('.rv-engine-dropdown-preset')?.textContent).toBe('Preview only')
    expect(document.activeElement).toBe(trigger())
  })

  it('closes on Escape and on an outside press without changing the engine', async () => {
    await click(trigger())
    await key(document.body, 'Escape')
    expect(overlay()).toBeNull()
    expect(trigger().getAttribute('aria-label')).toContain('Cinema 2.0')
    await click(trigger())
    await act(async () => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(overlay()).toBeNull()
    expect(trigger().getAttribute('aria-label')).toContain('Cinema 2.0')
  })
})

describe('variant-specific controls', () => {
  it('lets the dial and orbit pick an engine by clicking its entry', async () => {
    for (const variant of ['dial', 'orbit'] as const) {
      await act(async () => root.render(<span />))
      await mount(variant)
      await click(trigger())
      const entry = [...document.body.querySelectorAll('[role="menuitemradio"]')].find(node => node.textContent?.includes('Sound Drawing'))!
      expect(entry).not.toBeUndefined()
      await click(entry)
      expect(trigger().getAttribute('aria-label')).toContain('Sound Drawing')
    }
  })
  it('turns the rotary to a wedge and confirms with its centre key, or closes without choosing', async () => {
    await mount('rotary')
    await click(trigger())
    const confirm = () => document.body.querySelector<HTMLButtonElement>('.ler-rotary-confirm')!
    expect(confirm().textContent).toBe('Keep engine')
    await key(dialog(), 'ArrowRight')
    expect(confirm().textContent).toBe('Select engine')
    expect(dialog().textContent).toContain('Sound Drawing')
    await click(document.body.querySelector('.ler-rotary-close')!)
    expect(overlay()).toBeNull()
    expect(trigger().getAttribute('aria-label')).toContain('Cinema 2.0')
    await click(trigger())
    await key(dialog(), 'ArrowRight')
    await click(confirm())
    expect(trigger().getAttribute('aria-label')).toContain('Sound Drawing')
  })
})
void React
