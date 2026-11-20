// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import type { PixGridDeckDefinition, PixGridDeckItemDefinition } from '../PixGridDeckDomain'
import { resolvePixGridDeckPreviewTime, usePixGridDeckBuilder, type PixGridDeckBuilderController, type PixGridDeckBuilderOptions } from '../usePixGridDeckBuilder'

function items(count: number): PixGridDeckItemDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`, mediaId: `media-${index + 1}`, enabled: true, order: index, revision: 1, timingOverrideBeats: null,
    source: { mediaRevision: 1, fingerprint: `sha256:${String(index + 1).padStart(64, '0')}`, fileName: `image-${index + 1}.png`, mimeType: 'image/png', width: 640, height: 360, hasAlpha: false, transparentBackground: '#000000' },
  }))
}

let root: Root
let host: HTMLDivElement
let controller: PixGridDeckBuilderController

function Probe({ options }: { options: PixGridDeckBuilderOptions }) {
  controller = usePixGridDeckBuilder(options)
  return null
}

function mount(options: PixGridDeckBuilderOptions = {}) {
  act(() => { root.render(<Probe options={options} />) })
}

function createDeck(count = 3): PixGridDeckDefinition {
  const result = useReactStore.getState().createPixGridDeck({ id: 'builder-deck', name: 'Builder Deck', items: items(count) })
  expect(result.ok).toBe(true)
  return useReactStore.getState().pixGridDecks[0]!
}

const order = () => [...controller.deck!.items].sort((a, b) => a.order - b.order).map(item => item.id)

describe('usePixGridDeckBuilder', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('opens for a new Deck, closes, and tells the host which control should get focus back', () => {
    vi.useFakeTimers()
    const onExit = vi.fn()
    mount({ onExit })
    expect(controller.active).toBe(false)
    act(() => controller.enter(null))
    expect(controller.active).toBe(true)
    expect(controller.deck).toBeNull()
    act(() => controller.exit())
    expect(controller.active).toBe(false)
    act(() => { vi.runAllTimers() })
    expect(onExit).toHaveBeenCalledWith('create')

    const deck = createDeck()
    act(() => controller.enter(deck.id))
    expect(controller.deck?.id).toBe(deck.id)
    act(() => controller.exit())
    act(() => { vi.runAllTimers() })
    expect(onExit).toHaveBeenLastCalledWith('edit')
  })

  it('requires a name before the first upload and reports it', async () => {
    mount()
    act(() => controller.enter(null))
    act(() => controller.setDraftName('   '))
    await act(async () => { await controller.addFiles([new File([new Uint8Array(4)], 'a.png', { type: 'image/png' })]) })
    expect(controller.nameError).toBe('Deck name is required.')
    expect(controller.upload.active).toBe(false)
  })

  it('keeps the draft name and a valid preview image in step with the open Deck', () => {
    const deck = createDeck()
    mount()
    act(() => controller.enter(deck.id))
    expect(controller.draftName).toBe('Builder Deck')
    expect(controller.previewItemId).toBe('item-1')
    act(() => controller.toggleItem('item-1'))
    expect(controller.previewItemId).toBe('item-2')
    expect(controller.enabledItems.map(item => item.id)).toEqual(['item-2', 'item-3'])
  })

  it('moves, reorders, duplicates, disables and removes images, never below two or above the Deck limit', () => {
    const deck = createDeck(3)
    mount()
    act(() => controller.enter(deck.id))
    act(() => controller.moveItem('item-1', 1))
    expect(order()).toEqual(['item-2', 'item-1', 'item-3'])
    act(() => controller.moveItem('item-2', -1))
    expect(order()).toEqual(['item-2', 'item-1', 'item-3'])
    act(() => controller.reorderItems('item-3', 'item-2'))
    expect(order()).toEqual(['item-3', 'item-2', 'item-1'])
    act(() => controller.duplicateItem('item-2'))
    expect(controller.deck!.items).toHaveLength(4)
    expect(new Set(controller.deck!.items.map(item => item.id)).size).toBe(4)
    act(() => controller.removeItem('item-3'))
    act(() => controller.removeItem('item-1'))
    expect(controller.deck!.items).toHaveLength(2)
    act(() => controller.removeItem(controller.deck!.items[0]!.id))
    expect(controller.deck!.items).toHaveLength(2)
  })

  it('steps the preview through the enabled images and wraps', () => {
    const deck = createDeck(3)
    mount()
    act(() => controller.enter(deck.id))
    act(() => controller.stepPreview(1))
    expect(controller.previewItemId).toBe('item-2')
    act(() => controller.stepPreview(-1))
    act(() => controller.stepPreview(-1))
    expect(controller.previewItemId).toBe('item-3')
  })

  it('does not create a Preset, or close, while the Deck is still compiling', () => {
    const onPresetCreated = vi.fn()
    const deck = createDeck()
    mount({ onPresetCreated })
    act(() => controller.enter(deck.id))
    expect(controller.readiness?.ready).toBe(false)
    act(() => controller.createPreset())
    expect(onPresetCreated).not.toHaveBeenCalled()
    expect(useReactStore.getState().pixGridDecks[0]?.presetCreated).toBe(false)
    expect(controller.active).toBe(true)
  })

  it('deletes only after confirmation, removing the Deck and its generated Preset', () => {
    vi.useFakeTimers()
    const onDeleted = vi.fn()
    const deck = createDeck()
    mount({ onDeleted })
    act(() => controller.enter(deck.id))
    act(() => controller.requestDelete())
    expect(controller.pendingDelete).toEqual({ id: deck.id })
    act(() => controller.cancelDelete())
    expect(controller.pendingDelete).toBeNull()
    expect(useReactStore.getState().pixGridDecks).toHaveLength(1)
    act(() => controller.requestDelete())
    act(() => controller.confirmDelete())
    expect(useReactStore.getState().pixGridDecks).toHaveLength(0)
    expect(onDeleted).toHaveBeenCalledWith(deck.id)
    expect(controller.active).toBe(false)
  })
})

describe('resolvePixGridDeckPreviewTime', () => {
  const deck = (timings: (number | null)[], durationFraction = 0.25) => ({
    configuration: { defaultItemDurationBeats: 4, transitionPolicy: { durationFraction } },
    items: timings.map((timingOverrideBeats, index) => ({ id: `i${index}`, enabled: true, timingOverrideBeats })),
  }) as unknown as PixGridDeckDefinition

  it('returns the fallback time when no Deck is open', () => {
    expect(resolvePixGridDeckPreviewTime({ deck: null, previewItemId: null, transitionProgress: 0, bpm: 120, fallbackTimeSec: 7 })).toBe(7)
  })

  it('places the clock inside the selected image window, after the images before it, at the tempo', () => {
    const d = deck([null, 2, null])
    // Image 2 starts after 4 beats; its window is 2 beats with a 25% transition at the end. At 120 BPM a beat is 0.5 s.
    const start = resolvePixGridDeckPreviewTime({ deck: d, previewItemId: 'i1', transitionProgress: 0, bpm: 120, fallbackTimeSec: 0 })
    const end = resolvePixGridDeckPreviewTime({ deck: d, previewItemId: 'i1', transitionProgress: 1, bpm: 120, fallbackTimeSec: 0 })
    expect(start).toBeCloseTo((4 + 2 * 0.75) * 0.5 + 0.01, 6)
    expect(end).toBeCloseTo((4 + 2) * 0.5 + 0.01, 6)
  })

  it('uses 120 BPM when the tempo is unknown, and ignores disabled images', () => {
    const d = deck([null, null])
    ;(d.items[0] as { enabled: boolean }).enabled = false
    const time = resolvePixGridDeckPreviewTime({ deck: d, previewItemId: 'i1', transitionProgress: 0, bpm: null, fallbackTimeSec: 0 })
    expect(time).toBeCloseTo(4 * 0.75 * 0.5 + 0.01, 6)
  })
})
