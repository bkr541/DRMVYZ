// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridDeckBuilderInspector, PixGridDeckBuilderLibrary } from '../../../showManager/PixGridDeckBuilder'
import type { PixGridDeckDefinition } from '../PixGridDeckDomain'

let root: Root
let host: HTMLDivElement

function deck(): PixGridDeckDefinition {
  const items = Array.from({ length: 2 }, (_, index) => ({
    id: `item-${index + 1}`, mediaId: `media-${index + 1}`, enabled: true, order: index, revision: 1, timingOverrideBeats: index === 1 ? 6 : null,
    source: { mediaRevision: 1, fingerprint: `sha256:${String(index + 1).padStart(64, '0')}`, fileName: `image-${index + 1}.png`, mimeType: 'image/png', width: 64, height: 36, hasAlpha: false, transparentBackground: '#000000' },
  }))
  useReactStore.getState().createPixGridDeck({ id: 'controls-deck', name: 'Controls', items })
  return useReactStore.getState().pixGridDecks[0]!
}

const upload = { active: false, phase: 'Ready', error: null, warnings: [] }
const noop = () => undefined

beforeEach(() => {
  useReactStore.getState().resetReactView()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

function renderLibrary(current: PixGridDeckDefinition, onTiming?: (itemId: string, beats: number | null) => void) {
  act(() => root.render(
    <PixGridDeckBuilderLibrary deck={current} draftName={current.name} upload={upload} previewItemId={null} onFiles={noop} onPreview={noop}
      onMove={noop} onDuplicate={noop} onReorder={noop} onToggle={noop} onRemove={noop} onTiming={onTiming} />,
  ))
}

function typeInto(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Deck Builder per-image duration', () => {
  it('shows each image\'s own duration over the Deck default and reports edits, clearing back to the default', () => {
    const current = deck()
    const onTiming = vi.fn()
    renderLibrary(current, onTiming)
    const inputs = [...host.querySelectorAll<HTMLInputElement>('.sm-deck-image-timing input')]
    expect(inputs).toHaveLength(2)
    expect(inputs[0]!.value).toBe('')
    expect(inputs[0]!.placeholder).toBe(String(current.configuration.defaultItemDurationBeats))
    expect(inputs[1]!.value).toBe('6')
    typeInto(inputs[0]!, '12')
    expect(onTiming).toHaveBeenLastCalledWith('item-1', 12)
    typeInto(inputs[1]!, '')
    expect(onTiming).toHaveBeenLastCalledWith('item-2', null)
  })

  it('shows no duration field when the host does not handle it', () => {
    renderLibrary(deck())
    expect(host.querySelector('.sm-deck-image-timing')).toBeNull()
  })
})

describe('Deck Builder arrival event', () => {
  const renderInspector = (current: PixGridDeckDefinition) => act(() => root.render(
    <PixGridDeckBuilderInspector deck={current} draftName={current.name} readiness={null} upload={upload} nameError={null}
      onDraftName={noop} onRename={noop} onUpdate={noop} onCreatePreset={noop} onDelete={noop} />,
  ))

  it('appears only while transitions are set to arrive on the boundary', () => {
    const current = deck()
    renderInspector(current)
    expect(host.textContent).toContain('Timing anchor')
    expect(host.textContent).not.toContain('Arrival event')
    const arriving = { ...current, configuration: { ...current.configuration, transitionPolicy: { ...current.configuration.transitionPolicy, anchorMode: 'arrival' as const } } }
    renderInspector(arriving)
    expect(host.textContent).toContain('Arrival event')
    const field = [...host.querySelectorAll('label.sm-deck-field')].find(label => label.textContent?.includes('Arrival event'))
    expect(field?.querySelector('button')?.textContent).toContain('Drop impact')
  })
})
