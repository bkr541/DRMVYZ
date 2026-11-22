// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { usePixGridDeckBuilder, type PixGridDeckBuilderController } from '../react/pixGrid/usePixGridDeckBuilder'
import { PixGridDeckBuilderPopover } from './PixGridDeckBuilderPopover'

// The live preview is a WebGL PixGrid render; the popover only needs to place it.
vi.mock('./PixGridPreviewStage', () => ({ PixGridPreviewStage: () => <div data-testid="pixgrid-stage" /> }))

let root: Root
let host: HTMLDivElement
let controller: PixGridDeckBuilderController
const exited: string[] = []

function Harness({ deckId }: { deckId: string | null }) {
  const builder = usePixGridDeckBuilder({ confirmCreation: true, onExit: target => { exited.push(target) } })
  controller = builder
  useEffect(() => { builder.enter(deckId) }, []) // eslint-disable-line react-hooks/exhaustive-deps -- open once on mount
  return <PixGridDeckBuilderPopover controller={builder} />
}

function seedDeck() {
  const items = Array.from({ length: 3 }, (_, index) => ({
    id: `item-${index + 1}`, mediaId: `media-${index + 1}`, enabled: true, order: index, revision: 1, timingOverrideBeats: null,
    source: { mediaRevision: 1, fingerprint: `sha256:${String(index + 1).padStart(64, '0')}`, fileName: `image-${index + 1}.png`, mimeType: 'image/png', width: 64, height: 36, hasAlpha: false, transparentBackground: '#000000' },
  }))
  useReactStore.getState().createPixGridDeck({ id: 'popover-deck', name: 'Popover Deck', items })
  return useReactStore.getState().pixGridDecks[0]!
}
const storedDeck = () => useReactStore.getState().pixGridDecks[0]

const dialog = () => document.querySelector<HTMLElement>('.mum-modal')
const stepTab = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('.ll-deck-step')].find(tab => tab.textContent?.includes(name))!
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent?.trim() === name)!

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  useReactStore.getState().resetReactView()
  exited.length = 0
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Create PixGrid Deck popover in Preset Manager', () => {
  it('opens a new Deck as one dialog on the Images screen with Next held back until it has a name and two images', () => {
    act(() => root.render(<Harness deckId={null} />))
    expect(dialog()?.getAttribute('role')).toBe('dialog')
    expect(dialog()!.textContent).toContain('CREATE PIXGRID DECK')
    expect(dialog()!.textContent).toContain('Step 1 of 5')
    expect(button('Next').disabled).toBe(true)
    expect(dialog()!.textContent).toContain('Name the Deck and enable at least two images to continue.')
    expect(dialog()!.textContent).not.toContain('Study only')
    expect(document.querySelector('[data-testid="pixgrid-stage"]')).toBeNull()
  })

  it('opens an existing Deck for editing with its real images, name and live preview', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    expect(dialog()!.textContent).toContain('EDIT PIXGRID DECK')
    expect([...dialog()!.querySelectorAll('.ll-deck-image-copy strong')].map(node => node.textContent)).toEqual(['image-1.png', 'image-2.png', 'image-3.png'])
    expect(dialog()!.querySelector<HTMLInputElement>('input[aria-label="Deck name"]')!.value).toBe('Popover Deck')
    expect(document.querySelector('[data-testid="pixgrid-stage"]')).not.toBeNull()
    expect(button('Next').disabled).toBe(false)
  })

  it('writes image edits to the project Deck: duration, switching off, reordering and duplicating', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    typeInto(dialog()!.querySelector<HTMLInputElement>('input[aria-label="image-1.png duration in beats"]')!, '8')
    expect(storedDeck()!.items.find(item => item.id === 'item-1')!.timingOverrideBeats).toBe(8)
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('.ll-deck-toggle')[2]!.click())
    expect(storedDeck()!.items.find(item => item.id === 'item-3')!.enabled).toBe(false)
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('[aria-label="Move image later"]')[0]!.click())
    expect(storedDeck()!.items.map(item => item.id)).toEqual(['item-2', 'item-1', 'item-3'])
    act(() => dialog()!.querySelectorAll<HTMLButtonElement>('[aria-label="Duplicate image occurrence"]')[0]!.click())
    expect(storedDeck()!.items).toHaveLength(4)
  })

  it('writes settings from the other screens to the Deck configuration', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    act(() => stepTab('Playback').click())
    act(() => dialog()!.querySelector<HTMLInputElement>('.ll-deck-check input')!.click())
    expect(storedDeck()!.configuration.loop).toBe(false)
    typeInto(dialog()!.querySelector<HTMLInputElement>('input[aria-label="Default image duration in beats"]')!, '16')
    expect(storedDeck()!.configuration.defaultItemDurationBeats).toBe(16)
    act(() => stepTab('Sections').click())
    typeInto(dialog()!.querySelector<HTMLInputElement>('input[aria-label="drop image duration in beats"]')!, '2')
    expect(storedDeck()!.configuration.sectionTimingBeats.drop).toBe(2)
    act(() => stepTab('Transitions').click())
    typeInto(dialog()!.querySelector<HTMLInputElement>('input[aria-label="Transition length"]')!, '0.5')
    expect(storedDeck()!.configuration.transitionPolicy.durationFraction).toBe(0.5)
  })

  it('renames the Deck when the name field loses focus', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    const input = dialog()!.querySelector<HTMLInputElement>('input[aria-label="Deck name"]')!
    typeInto(input, 'Renamed Deck')
    expect(storedDeck()!.name).toBe('Popover Deck')
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
    expect(storedDeck()!.name).toBe('Renamed Deck')
  })

  it('asks before deleting, keeps the popover open on Cancel, and deletes the Deck and closes on confirm', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    act(() => stepTab('Review').click())
    act(() => button('Delete Deck').click())
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Deleting this Deck will delete the Preset too.')
    act(() => button('Cancel').click())
    expect(storedDeck()).toBeDefined()
    expect(dialog()).not.toBeNull()
    act(() => button('Delete Deck').click())
    act(() => [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(candidate => candidate.textContent?.trim() === 'Delete')!.click())
    expect(useReactStore.getState().pixGridDecks).toHaveLength(0)
    expect(dialog()).toBeNull()
  })

  it('leaves the Deck in the project when closed, and reports where focus should return', async () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    act(() => document.querySelector<HTMLButtonElement>('.mum-close')!.click())
    expect(dialog()).toBeNull()
    expect(storedDeck()).toBeDefined()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    expect(exited.at(-1)).toBe('edit')
  })

  it('closes on Escape or a backdrop press while nothing is uploading', () => {
    const deck = seedDeck()
    act(() => root.render(<Harness deckId={deck.id} />))
    expect(controller.upload.active).toBe(false)
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(dialog()).toBeNull()
    act(() => controller.enter(null))
    expect(dialog()).not.toBeNull()
    act(() => { document.querySelector('.mum-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(dialog()).toBeNull()
  })
})
