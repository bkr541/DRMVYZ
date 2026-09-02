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
  createCinemaStore,
  snapshotCinemaPersistedState,
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

function installElectricStormComposition() {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-electric-storm')
  if (!preset) throw new Error('Electric Storm preset is required for this production-path test.')
  const composition = createCinemaCinematicPresetComposition(
    preset,
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
  )
  expect(useCinemaStore.getState().upsertCinemaComposition(composition).ok).toBe(true)
  expect(useCinemaStore.getState().setActiveCinemaComposition(composition.id).ok).toBe(true)
  const node = composition.nodes.find(candidate => candidate.family === 'procedural')
  if (!node) throw new Error('Electric Storm procedural node is required.')
  expect(useCinemaStore.getState().setCinemaEditorSelection(composition.id, node.id).ok).toBe(true)
  return { composition, node }
}

describe('Electric Storm React-tab controls', () => {
  it('appears only on the Cinema React PERFORMANCE surface with the required trigger labels', async () => {
    installElectricStormComposition()
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))

    expect(host?.textContent).not.toContain('Thunder Trigger')
    const performance = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'PERFORMANCE')
    expect(performance).toBeDefined()
    await act(async () => performance?.click())

    const controls = host?.querySelector<HTMLElement>('[data-cinema-electric-storm-react-controls="true"]') ?? null
    expect(controls).not.toBeNull()
    expect(controls?.textContent).toContain('Thunder Trigger')
    expect(controls?.textContent).toContain('Flash Intensity')
    expect(controls?.textContent).toContain('Flash Duration')
    expect(controls?.textContent).toContain('Flash Decay')

    const trigger = controls?.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Thunder Trigger"]') ?? null
    expect(trigger?.textContent).toContain('4 Bars')
    await act(async () => {
      trigger?.click()
      await Promise.resolve()
    })
    const labels = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .map(option => option.textContent?.trim())
    expect(labels).toEqual(['Energy', 'Beat', 'Downbeat', '2 Beats', '4 Beats', 'Bar', '4 Bars', '8 Bars', 'Phrase', 'Drop'])
  })

  it('persists React edits through canonical Cinema instance state with undo, redo, and hydration', async () => {
    const { composition, node } = installElectricStormComposition()
    await act(async () => root?.render(<ReactReactivityWorkspacePanel />))
    const performance = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find(button => button.textContent?.trim() === 'PERFORMANCE')
    await act(async () => performance?.click())

    const trigger = host?.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Thunder Trigger"]') ?? null
    await act(async () => {
      trigger?.click()
      await Promise.resolve()
    })
    const dropOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .find(option => option.textContent?.trim() === 'Drop')
    expect(dropOption).toBeDefined()
    await act(async () => dropOption?.click())

    const definition = useCinemaStore.getState().definitions.find(candidate => candidate.id === node.typeId)?.definition
    if (!definition) throw new Error('Electric Storm node definition is required.')
    const triggerSchema = definition.parameters.find(parameter => parameter.label === 'Thunder Trigger')
    if (!triggerSchema || triggerSchema.type !== 'enum') throw new Error('Thunder Trigger schema is required.')
    const dropId = triggerSchema.options.find(option => option.label === 'Drop')?.id
    expect(dropId).toBeDefined()

    const flashValues = new Map([
      ['Flash Intensity', 0.81],
      ['Flash Duration', 0.27],
      ['Flash Decay', 0.68],
    ])
    for (const [label, value] of flashValues) {
      const schema = definition.parameters.find(parameter => parameter.label === label)
      if (!schema) throw new Error(`${label} schema is required.`)
      setCinemaLiveNodeOverride(composition, node.id, schema, value)
    }

    let live = getCinemaLiveInstance(composition.id, useCinemaStore.getState().instances)
    const liveNodeValues = live?.nodeOverrides.find(override => override.nodeId === node.id)?.values ?? {}
    expect(liveNodeValues[triggerSchema.id]).toBe(dropId)
    for (const [label, value] of flashValues) {
      const schema = definition.parameters.find(parameter => parameter.label === label)!
      expect(liveNodeValues[schema.id]).toBe(value)
    }

    const saved = snapshotCinemaPersistedState(useCinemaStore.getState())
    const reloaded = createCinemaStore()
    expect(reloaded.getState().hydrateCinemaState(JSON.parse(JSON.stringify(saved))).ok).toBe(true)
    live = getCinemaLiveInstance(composition.id, reloaded.getState().instances)
    const reloadedValues = live?.nodeOverrides.find(override => override.nodeId === node.id)?.values ?? {}
    expect(reloadedValues[triggerSchema.id]).toBe(dropId)
    for (const [label, value] of flashValues) {
      const schema = definition.parameters.find(parameter => parameter.label === label)!
      expect(reloadedValues[schema.id]).toBe(value)
    }

    for (let index = 0; index < 4; index += 1) expect(useCinemaStore.getState().undoCinemaEdit().ok).toBe(true)
    live = getCinemaLiveInstance(composition.id, useCinemaStore.getState().instances)
    expect(live?.nodeOverrides.find(override => override.nodeId === node.id)?.values[triggerSchema.id]).not.toBe(dropId)
    for (let index = 0; index < 4; index += 1) expect(useCinemaStore.getState().redoCinemaEdit().ok).toBe(true)
    live = getCinemaLiveInstance(composition.id, useCinemaStore.getState().instances)
    expect(live?.nodeOverrides.find(override => override.nodeId === node.id)?.values[triggerSchema.id]).toBe(dropId)
  })

  it('keeps React-only thunder controls out of the Cinema Design inspector', async () => {
    installElectricStormComposition()
    await act(async () => root?.render(<CinemaInspectorPanel />))
    // The Inspector's Palette section strips " Color" from color-param
    // labels ("Background Color" -> "Background") — a pre-existing,
    // documented behavior unrelated to this patch.
    expect(host?.textContent).toContain('Background')
    expect(host?.textContent).toContain('Impact Shake')
    expect(host?.textContent).not.toContain('Thunder Trigger')
    expect(host?.textContent).not.toContain('Flash Intensity')
  })
})
