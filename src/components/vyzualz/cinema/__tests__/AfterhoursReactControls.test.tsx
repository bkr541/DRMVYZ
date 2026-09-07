/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { CinemaInspectorPanel } from '../../react/CinemaInspectorPanel'
import { ReactReactivityWorkspacePanel } from '../../react/panels/ReactWorkspacePanels'
import { getCinemaLiveInstance, setCinemaLiveNodeOverride } from '../../react/CinemaLiveOverrides'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import {
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  createCinemaCinematicPresetComposition,
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
  document.querySelectorAll('.drm-dropdown__menu').forEach(menu => menu.remove())
  root = null
  host?.remove()
  host = null
  vi.unstubAllGlobals()
})

function installAfterhoursComposition() {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-afterhours')
  if (!preset) throw new Error('Afterhours preset is required for this production-path test.')
  const composition = createCinemaCinematicPresetComposition(
    preset,
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
  )
  expect(useCinemaStore.getState().upsertCinemaComposition(composition).ok).toBe(true)
  expect(useCinemaStore.getState().setActiveCinemaComposition(composition.id).ok).toBe(true)
  const node = composition.nodes.find(candidate => candidate.family === 'procedural')
  if (!node) throw new Error('Afterhours procedural node is required.')
  expect(useCinemaStore.getState().setCinemaEditorSelection(composition.id, node.id).ok).toBe(true)
  return { composition, node }
}

describe('Afterhours React-tab controls', () => {
  it('shows only the Stage-4 React controls on the Cinema PERFORMANCE surface with the exact Trigger labels', async () => {
    installAfterhoursComposition()
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    const performance = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'PERFORMANCE')
    expect(performance).toBeDefined()
    await act(async () => performance?.click())

    const controls = host?.querySelector<HTMLElement>('[data-cinema-afterhours-react-controls="true"]') ?? null
    expect(controls).not.toBeNull()
    for (const label of ['BPM Sync', 'Master Intensity', 'Trigger', 'Pulse Amount', 'Pulse Decay', 'Motion Amount']) {
      expect(controls?.textContent).toContain(label)
    }
    // Stage-5 controls are not exposed yet.
    expect(controls?.textContent).not.toContain('Pattern Change')
    expect(controls?.textContent).not.toContain('Blackout Amount')

    const trigger = controls?.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Trigger"]') ?? null
    expect(trigger?.textContent).toContain('Beat')
    await act(async () => {
      trigger?.click()
      await Promise.resolve()
    })
    const labels = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .map(option => option.textContent?.trim())
    expect(labels).toEqual(['Beat', 'Kick', 'Snare', 'Downbeat', '2 Beats', '4 Beats', 'Bar', '4 Bars', '8 Bars', 'Phrase', 'Drop'])
  })

  it('routes live React edits to the same production node parameter values the renderer reads', async () => {
    const { composition, node } = installAfterhoursComposition()
    const definition = useCinemaStore.getState().definitions.find(candidate => candidate.id === node.typeId)?.definition
    if (!definition) throw new Error('Afterhours node definition is required.')

    const triggerSchema = definition.parameters.find(parameter => parameter.label === 'Trigger')
    if (!triggerSchema || triggerSchema.type !== 'enum') throw new Error('Trigger schema is required.')
    const dropId = triggerSchema.options.find(option => option.label === 'Drop')?.id
    expect(dropId).toBeDefined()
    setCinemaLiveNodeOverride(composition, node.id, triggerSchema, dropId as string)

    const numeric = new Map([
      ['Master Intensity', 0.4],
      ['Pulse Amount', 0.9],
      ['Pulse Decay', 0.2],
      ['Motion Amount', 0.15],
    ])
    for (const [label, value] of numeric) {
      const schema = definition.parameters.find(parameter => parameter.label === label)
      if (!schema) throw new Error(`${label} schema is required.`)
      setCinemaLiveNodeOverride(composition, node.id, schema, value)
    }
    const bpmSchema = definition.parameters.find(parameter => parameter.label === 'BPM Sync')
    if (!bpmSchema) throw new Error('BPM Sync schema is required.')
    setCinemaLiveNodeOverride(composition, node.id, bpmSchema, false)

    // The renderer resolves these exact node parameter values via resolveConfig
    // (same mechanism Electric Storm uses), so proving the live override map
    // holds every edited field proves the production wiring.
    const live = getCinemaLiveInstance(composition.id, useCinemaStore.getState().instances)
    const values = live?.nodeOverrides.find(override => override.nodeId === node.id)?.values ?? {}
    expect(values[triggerSchema.id]).toBe(dropId)
    expect(values[bpmSchema.id]).toBe(false)
    for (const [label, value] of numeric) {
      const schema = definition.parameters.find(parameter => parameter.label === label)!
      expect(values[schema.id]).toBe(value)
    }
  })

  it('keeps React-only Afterhours controls out of the Cinema Design inspector', async () => {
    installAfterhoursComposition()
    await act(async () => root?.render(<CinemaInspectorPanel />))
    expect(host?.textContent).toContain('Pattern')
    expect(host?.textContent).not.toContain('Master Intensity')
    expect(host?.textContent).not.toContain('Pulse Amount')
    expect(host?.textContent).not.toContain('BPM Sync')
  })

  it('adds no generic audio routes for Afterhours', () => {
    const { composition } = installAfterhoursComposition()
    expect(composition.modulationRoutes).toEqual([])
  })
})
