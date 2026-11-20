// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { PixGridAuthoringPanel, PixGridLayersPanel } from '../PixGridAuthoringPanel'
import { requestPixGridDeckBuilderOpen, takePixGridDeckBuilderRequest } from '../PixGridDeckBuilderRequest'
import { PixGridDesignPanel } from '../PixGridDesignPanel'
import { ReactReactivityWorkspacePanel } from '../../panels/ReactWorkspacePanels'
import reactViewCss from '../../../../../styles/reactView.css?raw'

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('PixGrid panel consistency', () => {
  it('removes technical matrix status from above Edit PixGrid', () => {
    act(() => root.render(<PixGridAuthoringPanel />))
    const editButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'Edit PixGrid')!
    expect(editButton).toBeDefined()
    expect(host.querySelector('.rv-engine-status-grid')).toBeNull()
    expect(editButton.previousElementSibling).toBeNull()
    expect(editButton.nextElementSibling?.textContent).toContain('Changes save automatically')
  })

  it('retains the shared right-panel horizontal padding contract', () => {
    const pixGridBlock = reactViewCss.match(/\.rv-pix-grid-design-panel\s*\{([^}]*)\}/)?.[1] ?? ''
    const sharedBlock = reactViewCss.match(/\.rv-ctrl-group\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(pixGridBlock).not.toContain('padding-inline: 0')
    expect(sharedBlock).toContain('padding: 7px 11px 10px')
  })

  it('uses the standard control group with collapsible Design groups and no inner tab strip', () => {
    act(() => root.render(<PixGridDesignPanel />))
    const panel = host.querySelector('.rv-pix-grid-design-panel')!
    expect(panel.classList.contains('rv-ctrl-group')).toBe(true)
    expect(host.querySelector('[role="tablist"]')).toBeNull()
    const groups = [...host.querySelectorAll('.drc-group > .drc-header')].map(header => header.textContent ?? '')
    expect(groups.map(label => label.toLowerCase())).toEqual(['editing context', 'grid presentation', 'scene', 'layer', 'tool settings'])
    for (const label of ['Editing Context', 'Grid Presentation', 'Scene', 'Tool Settings']) expect(host.textContent).toContain(label)
    // Layer appears while a layer is selected (one is by default) and Selection only with a cell selection.
    expect(host.querySelector('.rv-ctrl-action-row')).not.toBeNull()
    expect(host.textContent).toContain('Active Scene')
    expect(host.textContent).toContain('Edit Target')
  })

  it('keeps PixGrid reactivity controls inside canonical cards and a two-column tab wrap', () => {
    act(() => root.render(<ReactReactivityWorkspacePanel />))
    const workspace = host.querySelector('.rv-pix-grid-reactivity-workspace')!
    const tabs = host.querySelector('[role="tablist"][aria-label="PixGrid reactivity surfaces"]')!
    const tabCss = reactViewCss.match(/\.rv-pix-grid-reactivity-tabs button\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(workspace.classList.contains('rv-ctrl-group')).toBe(true)
    expect(tabs.classList.contains('rv-right-subtabs--wrap')).toBe(true)
    expect(tabs.classList.contains('rv-pix-grid-reactivity-tabs')).toBe(true)
    expect(tabCss).toContain('flex: 1 1 calc(50% - 3px)')
    expect(host.querySelectorAll('.rv-pix-grid-reactivity-workspace .rv-ctrl-collapsible').length).toBeGreaterThanOrEqual(3)
    expect(host.textContent).toContain('CONTINUOUS ROUTES')
    expect(host.textContent).toContain('CONTINUOUS ROUTE SETTINGS')
  })

  it('SOURCE lists the scenes as shared rows, offers Custom Workflow, and leaves the scene name to Design', () => {
    const onCreateDeck = vi.fn()
    act(() => root.render(<PixGridAuthoringPanel onCreateDeck={onCreateDeck} />))
    const sceneCount = useReactStore.getState().pixGridState.scenes.length
    const sceneList = host.querySelector('[aria-label="PixGrid scenes"]')!
    expect(sceneList.classList.contains('rv-engine-panel-list')).toBe(true)
    expect(sceneList.querySelectorAll('.dv-layer-row')).toHaveLength(sceneCount)
    expect(sceneList.querySelector('.rv-engine-panel-list__header span')?.textContent).toBe(String(sceneCount))
    expect(host.textContent).not.toContain('Scene Name')
    expect(host.querySelector('[aria-label="PixGrid layers"]')).toBeNull()
    const button = [...host.querySelectorAll('button')].find(candidate => candidate.textContent === 'Create PixGrid Deck')!
    act(() => button.click())
    expect(onCreateDeck).toHaveBeenCalledTimes(1)
    act(() => root.render(<PixGridAuthoringPanel />))
    expect(host.textContent).not.toContain('Custom Workflow')
  })

  it('LAYERS shows the active scene layer stack with the shared rows and per-layer actions', () => {
    act(() => root.render(<PixGridLayersPanel />))
    const state = useReactStore.getState().pixGridState
    const layers = state.layers.filter(layer => state.scenes.find(scene => scene.id === state.selectedSceneId)?.layerIds.includes(layer.id))
    const list = host.querySelector('[aria-label="PixGrid layers"]')!
    expect(list.querySelectorAll('.dv-layer-row')).toHaveLength(layers.length)
    expect(list.querySelector('.rv-engine-panel-list__header span')?.textContent).toBe(String(layers.length))
    const first = layers[0]!
    expect(first.visible).toBe(true)
    act(() => (host.querySelector(`[aria-label="Hide ${first.name}"]`) as HTMLButtonElement).click())
    expect(useReactStore.getState().pixGridState.layers.find(layer => layer.id === first.id)?.visible).toBe(false)
    expect(host.querySelector(`[aria-label="Show ${first.name}"]`)).not.toBeNull()
  })

  it('the builder request is one-shot', () => {
    expect(takePixGridDeckBuilderRequest()).toBe(false)
    requestPixGridDeckBuilderOpen()
    expect(takePixGridDeckBuilderRequest()).toBe(true)
    expect(takePixGridDeckBuilderRequest()).toBe(false)
  })
})

