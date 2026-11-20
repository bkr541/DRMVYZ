// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PixGridDeckStudies } from './PixGridDeckStudies'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  HTMLCanvasElement.prototype.getContext = (() => ({ fillRect: () => undefined, beginPath: () => undefined, arc: () => undefined, fill: () => undefined, set fillStyle(_value: string) { /* canvas stub */ } })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  Element.prototype.scrollTo = (() => undefined) as typeof Element.prototype.scrollTo
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<PixGridDeckStudies />))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const dialog = () => document.querySelector<HTMLElement>('.mum-modal')
const scenario = (id: string) => host.querySelector<HTMLButtonElement>(`[data-scenario="${id}"]`)!
const stepTab = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.ll-deck-step')].find(tab => tab.textContent?.includes(name))!
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent?.trim() === name)!
const close = () => document.querySelector<HTMLButtonElement>('.mum-close')!
const labelled = (label: string) => document.querySelector(`[aria-label="${label}"]`)
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('PixGrid Deck popover study', () => {
  it('opens from the toolbar\'s PixGrid key as one dialog with five screens', () => {
    expect(dialog()).toBeNull()
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Create PixGrid Deck"]')!.click())
    const modal = dialog()!
    expect(modal.getAttribute('role')).toBe('dialog')
    expect(modal.classList.contains('mum-modal')).toBe(true)
    expect(modal.querySelector('.mum-header .mum-close')).not.toBeNull()
    expect([...document.querySelectorAll('.ll-deck-step')].map(tab => tab.textContent?.replace(/^\d+/, '').trim())).toEqual(['Images', 'Playback', 'Transitions', 'Sections', 'Review'])
    expect(modal.textContent).toContain('Step 1 of 5')
  })

  it('holds every setting the current builder has', () => {
    act(() => scenario('editing').click())
    // Images: name, upload, ordered list with duration/move/duplicate/toggle/remove, preview, sequence and scrubber.
    for (const label of ['Deck name', 'Ordered Deck images', 'neon-skyline.png duration in beats', 'Move image earlier', 'Move image later', 'Duplicate image occurrence', 'Remove image', 'Live PixGrid preview', 'Previous Deck image', 'Next Deck image', 'Scrub generated PixGrid transition']) {
      expect(labelled(label), label).not.toBeNull()
    }
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toBe('image/png,image/jpeg,image/svg+xml,image/webp')
    expect(dialog()!.textContent).toContain('59 slots remaining')
    act(() => stepTab('Playback').click())
    for (const label of ['Deck playback order', 'Default image duration in beats', 'Deck reaction profile']) expect(labelled(label), label).not.toBeNull()
    expect(dialog()!.textContent).toContain('Loop sequence')
    act(() => stepTab('Transitions').click())
    for (const label of ['Deck motion profile', 'Deck transition mode', 'Transition length', 'Deck transition timing anchor', 'Pair overrides']) expect(labelled(label), label).not.toBeNull()
    expect(dialog()!.textContent).toContain('Reset motion overrides')
    expect(dialog()!.textContent).not.toContain('Arrival event')
    expect(labelled('Transition from image 1 to image 2')).not.toBeNull()
    act(() => stepTab('Sections').click())
    expect(labelled('Deck PreDrop behavior')).not.toBeNull()
    for (const section of ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro']) {
      for (const label of [`${section} image duration in beats`, `${section} assigned Deck image`, `${section} scene motion profile`]) expect(labelled(label), label).not.toBeNull()
    }
    act(() => stepTab('Review').click())
    for (const text of ['Compile Readiness', 'Images', 'Transitions', 'Delete Deck', 'Export for shipping…', 'Create Preset']) expect(dialog()!.textContent, text).toContain(text)
  })

  it('keeps Next off until the Deck is named and has two enabled images, then lets the sample images through', () => {
    act(() => scenario('new').click())
    expect(button('Next').disabled).toBe(true)
    expect(dialog()!.textContent).toContain('Name the Deck and enable at least two images to continue.')
    act(() => button('Study only: add five sample images').click())
    advance(1000)
    expect(dialog()!.querySelectorAll('.ll-deck-image')).toHaveLength(5)
    expect(button('Next').disabled).toBe(false)
  })

  it('reorders, switches off, duplicates and removes images, and never goes below two', () => {
    act(() => scenario('editing').click())
    const names = () => [...dialog()!.querySelectorAll('.ll-deck-image-copy strong')].map(node => node.textContent)
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('[aria-label="Move image later"]')[0]!.click())
    expect(names().slice(0, 2)).toEqual(['crystal-mask.webp', 'neon-skyline.png'])
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('.ll-deck-toggle')[0]!.click())
    expect(dialog()!.querySelectorAll('.ll-deck-image.is-disabled').length).toBeGreaterThanOrEqual(2)
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('[aria-label="Duplicate image occurrence"]')[0]!.click())
    expect(names()).toHaveLength(6)
    for (let count = 0; count < 6; count += 1) {
      const remove = dialog()!.querySelector<HTMLButtonElement>('[aria-label="Remove image"]:not(:disabled)')
      if (remove) act(() => remove.click())
    }
    expect(names()).toHaveLength(2)
    expect(dialog()!.querySelector<HTMLButtonElement>('[aria-label="Remove image"]')!.disabled).toBe(true)
  })

  it('has no arrival event until transitions arrive on the boundary, and per-pair length only once a pair is overridden', () => {
    act(() => scenario('editing').click())
    act(() => stepTab('Transitions').click())
    expect(dialog()!.textContent).not.toContain('Arrival event')
    expect(dialog()!.querySelectorAll('.ll-deck-row:not(.ll-deck-row--head) .ll-deck-muted')).toHaveLength(4)
  })

  it('walks the compile states: working while preparing, ready to create, blocked on an error', () => {
    act(() => scenario('editing').click())
    act(() => stepTab('Review').click())
    expect(button('Create Preset').disabled).toBe(true)
    expect(dialog()!.textContent).toContain('WORKING')
    advance(4000)
    expect(dialog()!.textContent).toContain('READY')
    expect(button('Create Preset').disabled).toBe(false)
    act(() => close().click())
    act(() => scenario('error').click())
    act(() => stepTab('Review').click())
    expect(dialog()!.textContent).toContain('ERROR')
    expect(dialog()!.textContent).toContain('chrome-wave.png: The image could not be decoded')
    expect(button('Create Preset').disabled).toBe(true)
    act(() => close().click())
    act(() => scenario('compiling').click())
    act(() => stepTab('Review').click())
    advance(10000)
    expect(button('Create Preset').disabled).toBe(true)
  })

  it('creates the Preset and confirms it, and cancelling the delete confirmation leaves the popover open', () => {
    act(() => scenario('editing').click())
    act(() => stepTab('Review').click())
    advance(4000)
    act(() => button('Delete Deck').click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Deleting this Deck will delete the Preset too.')
    // A press inside the confirmation sits above the popover and must not dismiss the popover behind it.
    act(() => document.querySelector('[role="alertdialog"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(dialog()).not.toBeNull()
    act(() => button('Cancel').click())
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(dialog()).not.toBeNull()
    act(() => button('Create Preset').click())
    expect(dialog()!.textContent).toContain('Preset created')
    act(() => button('Done').click())
    expect(dialog()).toBeNull()
  })

  it('closes with Escape or the backdrop, and hides the shipping action outside development', () => {
    act(() => scenario('editing').click())
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(dialog()).toBeNull()
    act(() => host.querySelector<HTMLInputElement>('.ll-deck-dev input')!.click())
    act(() => scenario('editing').click())
    act(() => stepTab('Review').click())
    expect(dialog()!.textContent).not.toContain('Shipping (development only)')
    act(() => { document.querySelector('.mum-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(dialog()).toBeNull()
  })
})
