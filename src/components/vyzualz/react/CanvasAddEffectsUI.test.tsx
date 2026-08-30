/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import type { CanvasLayerEffectId } from './canvasPerformance'
import { CanvasEngineFxPanel } from './ReactCanvasEngineShell'

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    currentTrackId: null,
    currentAnalysis: null,
    duration: 0,
    currentTime: 12.5,
    getCurrentTime: () => 12.5,
  }),
}))

let host: HTMLDivElement
let root: Root

function media(id: string, name: string) {
  return {
    id,
    name,
    type: 'image' as const,
    objectUrl: `data:image/png;base64,${id}`,
    createdAt: '2026-08-30T00:00:00.000Z',
  }
}

function addLayer(mediaId: string): string {
  const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
  if (!result.ok) throw new Error(result.message)
  return result.layer.id
}

function parentButton(label: string): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>('.drc-header')]
    .find(candidate => candidate.textContent?.includes(label))
  if (!button) throw new Error(`Missing collapsible: ${label}`)
  return button
}

function comboboxByAriaLabel(label: string): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')]
    .find(candidate => candidate.getAttribute('aria-label') === label)
  if (!button) throw new Error(`Missing combobox: ${label}`)
  return button
}

function optionLabels(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .map(option => option.textContent?.trim() ?? '')
}

function selectOpenOption(label: string) {
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.trim() === label)
  if (!option) throw new Error(`Missing option: ${label}`)
  act(() => option.click())
}

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
  useMediaStore.setState({ items: [] })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.querySelectorAll('.drm-dropdown__menu').forEach(menu => menu.remove())
})

describe('CANVAS Add Effects UI', () => {
  it('shows the stable single-media owner and reuses the canonical store mutation path', () => {
    useReactStore.setState({
      canvasMediaItems: [media('single-media', 'single-source.png')],
    })
    useReactStore.getState().selectCanvasMediaItem('single-media')
    const primary = useReactStore.getState().getCanvasPrimaryLayer()
    if (!primary) throw new Error('Expected detached CANVAS primary owner')

    act(() => root.render(<CanvasEngineFxPanel />))

    expect(host.textContent).toContain('Add Effects')
    expect(host.textContent).toContain('Active Media 1 — single-source.png')
    const addEffect = comboboxByAriaLabel('Add effect to Active Media 1 — single-source.png')
    expect(addEffect.textContent).toContain('Select Effect…')

    act(() => addEffect.click())
    expect(optionLabels()).toEqual(['Bloom', 'Echo', 'Glitch', 'Melt', 'Stutter'])
    selectOpenOption('Bloom')

    expect(useReactStore.getState().getCanvasPrimaryLayer()).toMatchObject({
      id: primary.id,
      effects: ['bloom'],
    })
    expect(host.querySelectorAll('[data-canvas-effect-layer-id] button[role="combobox"]')).toHaveLength(2)
    expect(host.querySelector('[aria-label^="Remove Bloom from Active Media 1"]')).not.toBeNull()
  })

  it('renders 1/2/3/4 parents in canonical order with media names and reflows ordinals by stable layer identity', () => {
    useReactStore.setState({
      canvasMediaItems: [
        media('media-a', 'A.png'),
        media('media-b', 'B.png'),
        media('media-c', 'C.png'),
        media('media-d', 'D.png'),
      ],
    })

    const layerIds: string[] = []
    for (const [index, mediaId] of ['media-a', 'media-b', 'media-c', 'media-d'].entries()) {
      layerIds.push(addLayer(mediaId))
      act(() => root.render(<CanvasEngineFxPanel />))
      expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(index + 1)
    }

    act(() => {
      useReactStore.getState().addCanvasLayerEffect(layerIds[0], 'bloom')
      useReactStore.getState().addCanvasLayerEffect(layerIds[1], 'echo')
      useReactStore.getState().addCanvasLayerEffect(layerIds[2], 'melt')
      useReactStore.getState().addCanvasLayerEffect(layerIds[3], 'stutter')
    })

    expect(host.textContent).toContain('Active Media 1 — A.png')
    expect(host.textContent).toContain('Active Media 2 — B.png')
    expect(host.textContent).toContain('Active Media 3 — C.png')
    expect(host.textContent).toContain('Active Media 4 — D.png')

    act(() => {
      const removed = useReactStore.getState().removeCanvasAuthoredLayer(layerIds[1])
      if (!removed.ok) throw new Error(removed.message)
    })

    expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(3)
    expect(host.textContent).toContain('Active Media 1 — A.png')
    expect(host.textContent).toContain('Active Media 2 — C.png')
    expect(host.textContent).toContain('Active Media 3 — D.png')
    expect(host.textContent).not.toContain('Active Media 4 —')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => ({
      id: layer.id,
      effects: layer.effects,
    }))).toEqual([
      { id: layerIds[0], effects: ['bloom'] },
      { id: layerIds[2], effects: ['melt'] },
      { id: layerIds[3], effects: ['stutter'] },
    ])
  })

  it('numbers only enabled rendered layers while preserving hidden layer effect ownership', () => {
    useReactStore.setState({
      canvasMediaItems: [
        media('media-a', 'A.png'),
        media('media-b', 'B.png'),
        media('media-c', 'C.png'),
      ],
    })
    const firstId = addLayer('media-a')
    const hiddenId = addLayer('media-b')
    const thirdId = addLayer('media-c')
    act(() => {
      useReactStore.getState().addCanvasLayerEffect(firstId, 'bloom')
      useReactStore.getState().addCanvasLayerEffect(hiddenId, 'echo')
      useReactStore.getState().addCanvasLayerEffect(thirdId, 'melt')
      useReactStore.getState().updateCanvasAuthoredLayer(hiddenId, { enabled: false })
      root.render(<CanvasEngineFxPanel />)
    })

    expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(2)
    expect(host.textContent).toContain('Active Media 1 — A.png')
    expect(host.textContent).toContain('Active Media 2 — C.png')
    expect(host.textContent).not.toContain('B.png')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === hiddenId)?.effects).toEqual(['echo'])

    act(() => {
      const enabled = useReactStore.getState().updateCanvasAuthoredLayer(hiddenId, { enabled: true })
      if (!enabled.ok) throw new Error(enabled.message)
    })
    expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(3)
    expect(host.textContent).toContain('Active Media 2 — B.png')
    expect(host.textContent).toContain('Active Media 3 — C.png')
    expect(host.querySelector('[aria-label="Effect 1 for Active Media 2 — B.png"]')).not.toBeNull()
  })

  it('matches compositor solo semantics by presenting only the soloed layer as Active Media 1', () => {
    useReactStore.setState({
      canvasMediaItems: [
        media('solo-a', 'Solo A.png'),
        media('solo-b', 'Solo B.png'),
        media('solo-c', 'Solo C.png'),
      ],
    })
    const firstId = addLayer('solo-a')
    const secondId = addLayer('solo-b')
    const thirdId = addLayer('solo-c')
    act(() => {
      useReactStore.getState().addCanvasLayerEffect(firstId, 'bloom')
      useReactStore.getState().addCanvasLayerEffect(secondId, 'echo')
      useReactStore.getState().addCanvasLayerEffect(thirdId, 'stutter')
      const soloed = useReactStore.getState().setCanvasAuthoredLayerSolo(thirdId, true)
      if (!soloed.ok) throw new Error(soloed.message)
      root.render(<CanvasEngineFxPanel />)
    })

    expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(1)
    expect(host.textContent).toContain('Active Media 1 — Solo C.png')
    expect(host.textContent).not.toContain('Active Media 2 —')
    expect(host.querySelector('[aria-label="Effect 1 for Active Media 1 — Solo C.png"]')).not.toBeNull()

    act(() => {
      const unsoloed = useReactStore.getState().setCanvasAuthoredLayerSolo(thirdId, false)
      if (!unsoloed.ok) throw new Error(unsoloed.message)
    })
    expect(host.querySelectorAll('[data-canvas-effect-layer-id]')).toHaveLength(3)
    expect(host.textContent).toContain('Active Media 1 — Solo A.png')
    expect(host.textContent).toContain('Active Media 2 — Solo B.png')
    expect(host.textContent).toContain('Active Media 3 — Solo C.png')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.effects)).toEqual([
      ['bloom'], ['echo'], ['stutter'],
    ])
  })

  it('filters choices within one layer while allowing the same effect on another layer', () => {
    useReactStore.setState({
      canvasMediaItems: [media('filter-a', 'Filter A.png'), media('filter-b', 'Filter B.png')],
    })
    const firstId = addLayer('filter-a')
    const secondId = addLayer('filter-b')
    act(() => {
      useReactStore.getState().addCanvasLayerEffect(firstId, 'bloom')
      useReactStore.getState().addCanvasLayerEffect(firstId, 'echo')
      root.render(<CanvasEngineFxPanel />)
    })

    const addFirst = comboboxByAriaLabel('Add effect to Active Media 1 — Filter A.png')
    act(() => addFirst.click())
    expect(optionLabels()).toEqual(['Glitch', 'Melt', 'Stutter'])
    act(() => addFirst.click())

    const firstExisting = comboboxByAriaLabel('Effect 1 for Active Media 1 — Filter A.png')
    act(() => firstExisting.click())
    expect(optionLabels()).toEqual(['Bloom', 'Glitch', 'Melt', 'Stutter'])
    expect(optionLabels()).not.toContain('Echo')
    act(() => firstExisting.click())

    const addSecond = comboboxByAriaLabel('Add effect to Active Media 2 — Filter B.png')
    act(() => addSecond.click())
    expect(optionLabels()).toContain('Bloom')
    selectOpenOption('Bloom')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === secondId)?.effects)
      .toEqual(['bloom'])
  })

  it('caps the rendered stack at five effects and compacts immediately after trash removal', () => {
    useReactStore.setState({ canvasMediaItems: [media('stack-media', 'Stack.png')] })
    const layerId = addLayer('stack-media')
    const effects: CanvasLayerEffectId[] = ['bloom', 'echo', 'glitch', 'melt', 'stutter']
    act(() => {
      for (const effectId of effects) useReactStore.getState().addCanvasLayerEffect(layerId, effectId)
      root.render(<CanvasEngineFxPanel />)
    })

    const stack = host.querySelector(`[data-canvas-effect-layer-id="${layerId}"]`)
    expect(stack?.querySelectorAll('button[role="combobox"]')).toHaveLength(5)
    expect(host.querySelector('[aria-label="Add effect to Active Media 1 — Stack.png"]')).toBeNull()
    expect(stack?.querySelectorAll('.rv-canvas-layer-effect-remove')).toHaveLength(5)

    const removeEcho = host.querySelector<HTMLButtonElement>('[aria-label="Remove Echo from Active Media 1 — Stack.png"]')
    act(() => removeEcho?.click())

    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers[0]?.effects).toEqual([
      'bloom', 'glitch', 'melt', 'stutter',
    ])
    const values = [...host.querySelectorAll<HTMLElement>(`[data-canvas-effect-layer-id="${layerId}"] .drm-dropdown__value`)]
      .map(element => element.textContent?.trim())
    expect(values).toEqual(['Bloom', 'Glitch', 'Melt', 'Stutter', 'Select Effect…'])
    expect(stack?.querySelectorAll('.rv-canvas-layer-effect-remove')).toHaveLength(4)
  })

  it('keeps effect state intact when an active-media parent is collapsed and expanded', () => {
    useReactStore.setState({ canvasMediaItems: [media('collapse-media', 'Collapse.png')] })
    const layerId = addLayer('collapse-media')
    useReactStore.getState().addCanvasLayerEffect(layerId, 'glitch')
    act(() => root.render(<CanvasEngineFxPanel />))

    const header = parentButton('Active Media 1 — Collapse.png')
    expect(header.getAttribute('aria-expanded')).toBe('true')
    act(() => header.click())
    expect(header.getAttribute('aria-expanded')).toBe('false')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers[0]?.effects).toEqual(['glitch'])

    act(() => header.click())
    expect(parentButton('Active Media 1 — Collapse.png').getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('[aria-label="Effect 1 for Active Media 1 — Collapse.png"]')).not.toBeNull()
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers[0]?.effects).toEqual(['glitch'])
  })
})
