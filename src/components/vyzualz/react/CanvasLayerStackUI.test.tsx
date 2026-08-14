/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { CanvasEngineSurface, CanvasLayersPanel } from './ReactCanvasEngineShell'
import { ReactInspectorPanel } from './ReactInspectorPanel'

const mediaBase: UploadedMedia = {
  id: 'canvas-layer-media-a',
  dbId: 'db-canvas-layer-media-a',
  storagePath: 'user/canvas-layer-media-a/image.png',
  mimeType: 'image/png',
  name: 'layer-a.png',
  title: 'Layer A',
  description: 'Layer stack test visual',
  type: 'image',
  url: 'https://example.test/layer-a.png',
  thumbnailUrl: 'https://example.test/layer-a-thumb.png',
  meta: 'PNG · 1920×1080',
  favorite: false,
  mediaRole: 'background_image',
  tags: ['canvas'],
  collectionIds: [],
  metadata: { width: 1920, height: 1080 },
}

const mediaItems: UploadedMedia[] = [
  mediaBase,
  { ...mediaBase, id: 'canvas-layer-media-b', dbId: 'db-b', name: 'layer-b.png', title: 'Layer B', url: 'https://example.test/layer-b.png' },
  { ...mediaBase, id: 'canvas-layer-media-c', dbId: 'db-c', name: 'layer-c.png', title: 'Layer C', url: 'https://example.test/layer-c.png' },
  { ...mediaBase, id: 'canvas-layer-media-d', dbId: 'db-d', name: 'layer-d.png', title: 'Layer D', url: 'https://example.test/layer-d.png' },
]

let host: HTMLDivElement
let root: Root
let mediaStoreBaseline: ReturnType<typeof useMediaStore.getState>

function renderStageAndLayers() {
  act(() => root.render(
    <>
      <CanvasLayersPanel />
      <CanvasEngineSurface isPlaying={false} isPaused />
      <ReactInspectorPanel />
    </>,
  ))
}

function layerRows(): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>('.rv-canvas-layer-stack-row')]
}

function makeTransfer() {
  const values = new Map<string, string>()
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type: string, value: string) { values.set(type, value) },
    getData(type: string) { return values.get(type) ?? '' },
  }
}

function dispatchDrag(target: HTMLElement, type: 'dragstart' | 'dragover' | 'drop' | 'dragend', transfer: ReturnType<typeof makeTransfer>) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: transfer })
  act(() => target.dispatchEvent(event))
}

beforeEach(() => {
  mediaStoreBaseline = useMediaStore.getState()
  useMediaStore.setState({ items: mediaItems })
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useMediaStore.setState(mediaStoreBaseline)
})

describe('CANVAS Stage 3 layer stack UI', () => {
  it('renders canonical instances, selects only from rows, and exposes focused row actions', () => {
    const first = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[0].id)
    const second = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[1].id)
    if (!first.ok || !second.ok) throw new Error('Expected CANVAS layers')
    renderStageAndLayers()

    expect(host.textContent).toContain('2 / 4')
    expect(layerRows()).toHaveLength(2)
    expect(layerRows()[0].textContent).toContain('Layer B')
    expect(layerRows()[1].textContent).toContain('Layer A')

    const layerASelect = host.querySelector<HTMLButtonElement>(`[aria-label="Select CANVAS layer 2: Layer A"]`)
    if (!layerASelect) throw new Error('Expected Layer A selection row')
    act(() => layerASelect.click())
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(first.layer.id)
    expect(host.textContent).toContain('CANVAS Layer')
    expect(host.textContent).toContain('2 of 2')
    expect(host.textContent).toContain('Layer-specific production controls are not finalized yet.')

    const stage = host.querySelector<HTMLElement>('[aria-label="CANVAS engine render surface"]')
    if (!stage) throw new Error('Expected render-only CANVAS stage')
    act(() => stage.click())
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(first.layer.id)

    expect(host.querySelector(`[aria-label="Solo CANVAS layer Layer A"]`)).not.toBeNull()
    expect(host.querySelector(`[aria-label="Duplicate CANVAS layer Layer A"]`)).not.toBeNull()
    expect(host.querySelector(`[aria-label="Delete CANVAS layer Layer A"]`)).not.toBeNull()
  })

  it('reorders by layer id while preserving selection and uses single-solo state', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[0].id)
    const b = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[1].id)
    const c = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[2].id)
    if (!a.ok || !b.ok || !c.ok) throw new Error('Expected CANVAS layers')
    useReactStore.getState().setSelectedCanvasLayer(b.layer.id)
    renderStageAndLayers()

    const rows = layerRows()
    const source = rows.find(row => row.dataset.canvasLayerId === a.layer.id)
    const target = rows.find(row => row.dataset.canvasLayerId === c.layer.id)
    if (!source || !target) throw new Error('Expected draggable CANVAS rows')
    const transfer = makeTransfer()
    dispatchDrag(source, 'dragstart', transfer)
    dispatchDrag(target, 'dragover', transfer)
    dispatchDrag(target, 'drop', transfer)

    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual([
      a.layer.id,
      c.layer.id,
      b.layer.id,
    ])
    expect(useReactStore.getState().selectedCanvasLayerId).toBe(b.layer.id)

    const soloA = host.querySelector<HTMLButtonElement>(`[aria-label="Solo CANVAS layer Layer A"]`)
    if (!soloA) throw new Error('Expected Layer A solo action')
    act(() => soloA.click())
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.filter(layer => layer.solo).map(layer => layer.id)).toEqual([a.layer.id])

    const soloB = host.querySelector<HTMLButtonElement>(`[aria-label="Solo CANVAS layer Layer B"]`)
    if (!soloB) throw new Error('Expected Layer B solo action')
    act(() => soloB.click())
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.filter(layer => layer.solo).map(layer => layer.id)).toEqual([b.layer.id])
  })

  it('duplicates without media confirmation, selects the duplicate, enforces capacity, and deletes only the instance', () => {
    const a = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[0].id)
    const b = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[1].id)
    const c = useReactStore.getState().addCanvasAuthoredLayer(mediaItems[2].id)
    if (!a.ok || !b.ok || !c.ok) throw new Error('Expected CANVAS layers')
    renderStageAndLayers()

    const duplicateA = host.querySelector<HTMLButtonElement>(`[aria-label="Duplicate CANVAS layer Layer A"]`)
    if (!duplicateA) throw new Error('Expected duplicate action')
    act(() => duplicateA.click())
    const afterDuplicate = useReactStore.getState()
    expect(afterDuplicate.canvasOrchestrationSettings.authoredLayers).toHaveLength(4)
    const selectedDuplicate = afterDuplicate.canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === afterDuplicate.selectedCanvasLayerId)
    expect(selectedDuplicate?.mediaId).toBe(mediaItems[0].id)
    expect(selectedDuplicate?.id).not.toBe(a.layer.id)

    const duplicateB = host.querySelector<HTMLButtonElement>(`[aria-label="Duplicate CANVAS layer Layer B"]`)
    if (!duplicateB) throw new Error('Expected second duplicate action')
    act(() => duplicateB.click())
    expect(host.textContent).toContain('Remove a layer before duplicating another.')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(4)

    const sourceMediaCount = useMediaStore.getState().items.length
    const selectedId = useReactStore.getState().selectedCanvasLayerId
    const selectedRow = selectedId ? host.querySelector<HTMLElement>(`[data-canvas-layer-id="${selectedId}"]`) : null
    const deleteSelected = selectedRow?.querySelector<HTMLButtonElement>('[aria-label^="Delete CANVAS layer"]') ?? null
    if (!deleteSelected) throw new Error('Expected selected duplicate delete action')
    act(() => deleteSelected.click())
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(3)
    expect(useMediaStore.getState().items).toHaveLength(sourceMediaCount)
    expect(useReactStore.getState().selectedCanvasLayerId).not.toBe(selectedId)
  })
})
