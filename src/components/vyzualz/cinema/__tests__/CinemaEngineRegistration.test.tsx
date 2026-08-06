/** @vitest-environment jsdom */

import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { CinemaWorkspace, resolveCinemaWorkspaceModel } from '../../react/CinemaWorkspace'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'
import {
  acquireReactLiveEngineOwnership,
  getReactLiveEngineOwnershipDiagnosticsForTests,
  resetReactLiveEngineOwnershipForTests,
} from '../../react/renderers/ReactLiveEngineOwnership'
import { createEmptyCinemaPersistedState } from '../CinemaPersistence'
import { createCinemaDiagnosticSnapshot } from '../CinemaDiagnostics'
import { useCinemaStore } from '../CinemaStore'

let root: Root | null = null
let host: HTMLDivElement | null = null

function LegacyOwnershipProbe({ retire }: { retire: () => void }) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  useEffect(() => {
    if (engineId === 'cinema') return
    const ownership = acquireReactLiveEngineOwnership(engineId, retire)
    ownership.markStable()
    return () => ownership.retire('unmount')
  }, [engineId, retire])
  return null
}

const productionFrameBridge = buildCinemaWorkspaceFrameBridge({
  width: 1,
  height: 1,
  dpr: 1,
  audioTimeSec: 0,
  durationSec: null,
  trackId: null,
  playing: false,
  paused: false,
  bpm: null,
})

function ProductionSelectionHarness({ retire }: { retire: () => void }) {
  const engineId = useReactStore(state => state.activeReactEngineId)
  return (
    <>
      <ReactEngineBrowser />
      <LegacyOwnershipProbe retire={retire} />
      {engineId === 'cinema' ? <CinemaWorkspace surface="stage" frameBridge={productionFrameBridge} /> : <div data-legacy-engine={engineId} />}
    </>
  )
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  resetReactLiveEngineOwnershipForTests()
  useReactStore.getState().resetReactView()
  useCinemaStore.getState().hydrateCinemaState(createEmptyCinemaPersistedState())
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  resetReactLiveEngineOwnershipForTests()
  vi.unstubAllGlobals()
})

describe('Cinema production engine registration', () => {
  it('selects Cinema through the real engine dropdown, clears legacy preset state, and mounts no renderer owner', async () => {
    const retire = vi.fn()
    const requestAnimationFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')

    await act(async () => root?.render(<ProductionSelectionHarness retire={retire} />))
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinematicPortal',
      activeOwnerCount: 1,
    })

    const trigger = host?.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    const cinemaOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinema'))
    expect(cinemaOption).not.toBeUndefined()
    await act(async () => cinemaOption?.click())

    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('cinema')
    expect(state.activeReactPresetId).toBeNull()
    expect(host?.querySelector('[data-cinema-workspace="foundation"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema-frame-available="true"]')).not.toBeNull()
    expect(host?.querySelector('canvas')).toBeNull()
    expect(retire).toHaveBeenCalledTimes(1)
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: null,
      activeOwnerCount: 0,
      phase: 'idle',
    })
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(getContext).not.toHaveBeenCalled()

    await act(async () => trigger?.click())
    const cinematicOption = [...(host?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('Cinematic Worlds'))
    expect(cinematicOption).not.toBeUndefined()
    await act(async () => cinematicOption?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('cinematicPortal')
    expect(host?.querySelector('[data-legacy-engine="cinematicPortal"]')).not.toBeNull()
    expect(getReactLiveEngineOwnershipDiagnosticsForTests()).toMatchObject({
      activeEngine: 'cinematicPortal',
      activeOwnerCount: 1,
      phase: 'stable',
    })
  })

  it('returns structured diagnostics and safe output for a stale active composition reference', () => {
    const model = resolveCinemaWorkspaceModel({
      activeCompositionId: 'cinema.composition.missing' as never,
      activeInstanceId: null,
      compositions: [],
      instances: [],
      lastDiagnostics: createCinemaDiagnosticSnapshot([]),
    })

    expect(model.activeComposition).toBeNull()
    expect(model.runtimeAvailable).toBe(false)
    expect(model.statusLabel).toBe('Needs attention')
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_VALIDATION_FAILED'
      && diagnostic.attribution?.compositionId === 'cinema.composition.missing'
    ))).toBe(true)
    expect(model.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_CAPABILITY_UNAVAILABLE'
    ))).toBe(true)
  })
})
