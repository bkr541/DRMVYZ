/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { CinemaInspectorPanel } from '../../react/CinemaInspectorPanel'
import { ReactReactivityWorkspacePanel } from '../../react/panels/ReactWorkspacePanels'
import {
  CINEMA_LEGACY_PRESET_CATALOG,
  createCinemaFoundationPersistedState,
  useCinemaStore,
} from '..'

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useReactStore.getState().resetReactView()
  useReactStore.getState().setActiveReactEngineId('cinema')
  useCinemaStore.getState().hydrateCinemaState(createCinemaFoundationPersistedState())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.unstubAllGlobals()
})

function installPrismTunnelComposition() {
  const entry = CINEMA_LEGACY_PRESET_CATALOG.manifest.find(candidate => candidate.legacySourceId === 'shader-neon-tunnel')
  const catalogComposition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === entry?.compositionId)
  if (!catalogComposition) throw new Error('Production Prism Tunnel composition is required.')

  // Foundation hydration already installs immutable built-in compositions.
  // Select the reconciled production copy instead of trying to upsert it.
  const state = useCinemaStore.getState()
  const composition = state.compositions.find(candidate => candidate.id === catalogComposition.id)
  if (!composition) throw new Error('Hydrated Prism Tunnel composition is required.')
  expect(state.setActiveCinemaComposition(composition.id).ok).toBe(true)

  const definitions = useCinemaStore.getState().definitions
  const node = composition.nodes.find(candidate => {
    const definition = definitions.find(persisted => persisted.id === candidate.typeId)?.definition
    return definition?.metadata?.adapter === 'shader-scene'
      && definition.metadata.shaderSceneId === 'shader-neon-tunnel'
  })
  if (!node) throw new Error('Production Prism Tunnel shader node is required.')
  expect(useCinemaStore.getState().setCinemaEditorSelection(composition.id, node.id).ok).toBe(true)
  return { composition, node }
}

describe('Prism Tunnel React-tab controls', () => {
  it('surfaces Prism choreography and echo controls on PERFORMANCE using shared slider controls', async () => {
    installPrismTunnelComposition()
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    const performance = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'PERFORMANCE')
    expect(performance).toBeDefined()
    await act(async () => performance?.click())

    const controls = host?.querySelector<HTMLElement>('[data-cinema-prism-react-controls="true"]') ?? null
    expect(controls).not.toBeNull()
    expect(controls?.textContent).toContain('Drop Transformation')
    expect(controls?.textContent).toContain('Facet Choreography')
    expect(controls?.textContent).toContain('Echo Amount')
    expect(controls?.textContent).toContain('Echo Count')
    expect(controls?.textContent).toContain('Echo Spacing')
    expect(controls?.textContent).toContain('Echo Decay')
    expect(controls?.querySelectorAll('input[type="range"]')).toHaveLength(6)
  })

  it('keeps React-only Prism choreography and echo settings out of the Cinema Design inspector', async () => {
    installPrismTunnelComposition()
    await act(async () => root?.render(<CinemaInspectorPanel />))
    expect(host?.textContent).not.toContain('Drop Transformation')
    expect(host?.textContent).not.toContain('Facet Choreography')
    expect(host?.textContent).not.toContain('Echo Amount')
    expect(host?.textContent).not.toContain('Echo Count')
    expect(host?.textContent).not.toContain('Echo Spacing')
    expect(host?.textContent).not.toContain('Echo Decay')
  })
})
