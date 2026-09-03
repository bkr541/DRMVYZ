/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { CinemaComposerStage19Panel } from '../../react/CinemaComposerStage19Panel'
import { ReactReactivityWorkspacePanel } from '../../react/panels/ReactWorkspacePanels'
import {
  CINEMA_FOUNDATION_COMPOSITION,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import {
  buildCinemaComposerDestinations,
  cinemaStableId,
  createCinemaComposerModulationRoute,
  duplicateCinemaCompositionGraph,
  type CinemaCompositionId,
} from '..'
import { useCinemaStore } from '../CinemaStore'

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useReactStore.getState().resetReactView()
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

function createUserComposition() {
  return duplicateCinemaCompositionGraph(CINEMA_FOUNDATION_COMPOSITION, {
    id: cinemaStableId<CinemaCompositionId>('stage-6-user-routing', 'composition'),
    name: 'Stage 6 User Routing',
    saved: true,
  })
}

describe('Cinema routing read-only authoring UX', () => {
  it('drops the Routing sub-tab and its read-only notices for a built-in preset with no authored modulation routes', async () => {
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    const tabLabels = [...(host?.querySelectorAll('[aria-label="Reactivity surfaces"] [role="tab"]') ?? [])]
      .map(tab => tab.textContent?.trim())
    expect(tabLabels).not.toContain('ROUTING')
    expect(tabLabels).toEqual(['PERFORMANCE', 'ANALYSIS'])
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()
    expect(host?.textContent).not.toContain('No modulation routes are authored for this built-in preset.')
    expect(host?.textContent).not.toContain('Add Route')
  })

  it('shows existing routes as non-interactive reference data when the composition is read-only', async () => {
    const user = createUserComposition()
    const destination = buildCinemaComposerDestinations(user, useCinemaStore.getState().definitions)
      .find(candidate => candidate.modulatable && candidate.disabledReason == null)?.path
    expect(destination).toBeDefined()
    const routeResult = createCinemaComposerModulationRoute(user, { destination: destination! })
    const readOnlyComposition = {
      ...routeResult.composition,
      metadata: {
        ...routeResult.composition.metadata,
        provenance: { ...routeResult.composition.metadata.provenance, builtIn: true },
      },
    }

    await act(async () => root?.render(
      <CinemaComposerStage19Panel
        composition={readOnlyComposition}
        definitions={useCinemaStore.getState().definitions}
        frameBridge={null}
        edit={() => { throw new Error('read-only routing must not expose edits') }}
        surface="routing"
        readOnly
      />,
    ))

    const routing = host?.querySelector<HTMLElement>('[data-cinema-routing-mode="read-only"]') ?? null
    expect(routing?.querySelectorAll('[data-cinema-route-reference="true"]')).toHaveLength(1)
    expect(routing?.textContent).toContain('Route 1')
    expect(routing?.textContent).toContain('Destination')
    expect(routing?.textContent).toContain('Operation')
    expect(routing?.querySelector('select, input, button')).toBeNull()
  })

  it('re-enters the production reactivity panel without a Routing sub-tab for a zero-route built-in preset', async () => {
    expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()

    await act(async () => root?.unmount())
    root = host ? createRoot(host) : null
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    const tabLabels = [...(host?.querySelectorAll('[aria-label="Reactivity surfaces"] [role="tab"]') ?? [])]
      .map(tab => tab.textContent?.trim())
    expect(tabLabels).not.toContain('ROUTING')
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()
    expect(host?.textContent).not.toContain('Add Route')
    expect(host?.querySelector('.rv-cinema-stage19__fieldset:disabled select')).toBeNull()
  })

  it('preserves the real Add Route editor for a user-authored composition and follows provenance switches without stale policy', async () => {
    const user = createUserComposition()
    expect(useCinemaStore.getState().upsertCinemaComposition(user).ok).toBe(true)
    expect(useCinemaStore.getState().setActiveCinemaComposition(user.id).ok).toBe(true)
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    let addRoute = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'Add Route')
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()
    expect(addRoute).not.toBeUndefined()

    await act(async () => addRoute?.click())
    expect(useCinemaStore.getState().compositions.find(composition => composition.id === user.id)?.modulationRoutes).toHaveLength(1)

    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(CINEMA_FOUNDATION_COMPOSITION.id).ok).toBe(true)
    })
    // Foundation is a zero-route built-in — its Routing sub-tab is dropped.
    expect([...(host?.querySelectorAll('[aria-label="Reactivity surfaces"] [role="tab"]') ?? [])]
      .map(tab => tab.textContent?.trim())).not.toContain('ROUTING')
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()
    expect(host?.textContent).not.toContain('Add Route')

    await act(async () => {
      expect(useCinemaStore.getState().setActiveCinemaComposition(user.id).ok).toBe(true)
    })
    addRoute = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'Add Route')
    expect(host?.querySelector('[data-cinema-routing-mode="read-only"]')).toBeNull()
    expect(addRoute).not.toBeUndefined()
  })
})
