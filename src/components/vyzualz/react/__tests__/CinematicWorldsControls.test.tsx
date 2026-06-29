// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../../stores/reactStore'
import {
  CinematicWorldsEngineControls,
  CinematicWorldsFxControls,
  CinematicWorldsModulationControls,
} from '../CinematicWorldsControls'
import { ReactPresetsPanel } from '../ReactPresetsPanel'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const presetFor = (worldMode: string) => DEFAULT_REACT_PRESETS.find(preset => preset.cinematicConfig?.worldMode === worldMode)!

beforeEach(() => {
  useReactStore.getState().resetReactView()
  AudioFeatureBus.reset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function render(node: React.ReactNode) {
  await act(async () => root.render(node))
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button as HTMLButtonElement
}

function labelControl(text: string): HTMLElement | null {
  const label = [...container.querySelectorAll('label')].find(candidate => candidate.textContent === text) as HTMLLabelElement | undefined
  return label?.control as HTMLElement | null
}

describe('Cinematic Worlds engine controls', () => {
  it('exposes all worlds with semantic selected state and focused descriptions', async () => {
    useReactStore.getState().selectReactPreset(presetFor('eventHorizon').id)
    await render(<CinematicWorldsEngineControls />)

    const worlds = container.querySelectorAll('[role="radio"]')
    expect(worlds).toHaveLength(11)
    expect(container.querySelector('#cinematic-world-eventHorizon')?.getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('#cinematic-world-mediaPortal')?.textContent).toContain('Places images, video, logos or SVG artwork')
    expect(container.textContent).toContain('Selected')
  })

  it('switches simple and advanced modes without discarding authored values or focusable semantics', async () => {
    const preset = presetFor('eventHorizon')
    const base = resolveCinematicConfigForPreset(preset, {})!
    useReactStore.getState().selectReactPreset(preset.id)
    useReactStore.getState().setCinematicConfigForPreset(preset.id, { ...base, seed: 7654321 })
    await render(<CinematicWorldsEngineControls />)

    expect(container.querySelector('#cinematic-portal-shape')).toBeNull()
    const advanced = buttonWithText('Advanced')
    await act(async () => advanced.click())
    expect(advanced.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('#cinematic-portal-shape')).not.toBeNull()
    expect(container.querySelector('output')?.textContent).toBe('7654321')

    await act(async () => buttonWithText('Simple').click())
    await act(async () => buttonWithText('Advanced').click())
    expect(container.querySelector('output')?.textContent).toBe('7654321')
  })

  it('hides irrelevant portal controls and exposes safe Auto Director controls', async () => {
    useReactStore.getState().selectReactPreset(presetFor('infiniteCorridor').id)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsEngineControls />)

    expect(container.querySelector('#cinematic-portal-shape')).toBeNull()
    expect(labelControl('Strength')).not.toBeNull()
    expect(labelControl('Camera Activity')).not.toBeNull()
    expect(labelControl('Transition Frequency')).not.toBeNull()
    expect(labelControl('Drop Impact')).not.toBeNull()
    expect(labelControl('Build Intensity')).not.toBeNull()
    expect(labelControl('Minimum Shot Duration')).not.toBeNull()
    expect(container.querySelector('#cinematic-auto-director-lock')).not.toBeNull()
  })

  it('locks deterministic seed navigation and keeps reset actions accessible by name', async () => {
    useReactStore.getState().selectReactPreset(presetFor('stormGateway').id)
    await render(<CinematicWorldsEngineControls />)

    const lock = container.querySelector('#cinematic-seed-lock') as HTMLButtonElement
    await act(async () => lock.click())
    expect(lock.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[aria-label="Randomize cinematic variation"]')?.hasAttribute('disabled')).toBe(true)
    expect(buttonWithText('Reset World')).toBeTruthy()
    expect(buttonWithText('Reset Camera')).toBeTruthy()
    expect(buttonWithText('Reset Audio Mappings')).toBeTruthy()
  })
})

describe('Cinematic Worlds FX and media controls', () => {
  it('shows Media Portal controls only for Media Portal and labels quality effects', async () => {
    useReactStore.getState().selectReactPreset(presetFor('eventHorizon').id)
    await render(<CinematicWorldsFxControls />)
    expect(container.querySelector('#cinematic-media-source')).toBeNull()
    expect(container.querySelector('#cinematic-quality-description')?.textContent).toContain('geometry density')

    await act(async () => useReactStore.getState().selectReactPreset(presetFor('mediaPortal').id))
    expect(container.querySelector('#cinematic-media-source')).not.toBeNull()
    expect(container.querySelector('#cinematic-media-fit')).not.toBeNull()
    expect(container.querySelector('#cinematic-media-mask')).not.toBeNull()
    expect(container.querySelector('#cinematic-media-appearance')).not.toBeNull()
    expect(container.querySelector('#cinematic-media-loop')).not.toBeNull()
    expect(buttonWithText('Import or Relink Media')).toBeTruthy()
  })

  it('reveals environment, material and world-specific values only in advanced mode', async () => {
    useReactStore.getState().selectReactPreset(presetFor('liquidMembrane').id)
    await render(<CinematicWorldsFxControls />)
    expect(container.querySelector('#cinematic-environment-depth')).toBeNull()
    expect(container.querySelector('#cinematic-world-setting-viscosity')).toBeNull()

    await act(async () => buttonWithText('Advanced').click())
    expect(container.querySelector('#cinematic-environment-depth')).not.toBeNull()
    expect(container.querySelector('#cinematic-material-refraction')).not.toBeNull()
    expect(container.querySelector('#cinematic-world-setting-viscosity')).not.toBeNull()
  })
})

describe('Cinematic Worlds audio mappings', () => {
  it('presents unsupported Music Intelligence capabilities and readable assignments', async () => {
    useReactStore.getState().selectReactPreset(presetFor('stormGateway').id)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsModulationControls />)

    expect(container.textContent).toContain('Unavailable Music Intelligence inputs')
    expect(container.textContent).toContain('Track Energy Curve')
    expect(container.textContent).toContain('Lightning')
    expect(container.textContent).not.toContain('storm-snare-lightning')
    expect(container.querySelector('#cinematic-route-0-source')).not.toBeNull()
    expect(container.querySelector('#cinematic-route-0-target')).not.toBeNull()
  })

  it('edits source-to-target mappings through labeled controls', async () => {
    const preset = presetFor('eventHorizon')
    useReactStore.getState().selectReactPreset(preset.id)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsModulationControls />)

    const source = container.querySelector('#cinematic-route-0-source') as HTMLSelectElement
    source.value = 'bass'
    await act(async () => source.dispatchEvent(new Event('change', { bubbles: true })))
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id].audioMapping.routes[0].source).toBe('bass')

    const target = container.querySelector('#cinematic-route-0-target') as HTMLSelectElement
    expect([...target.options].map(option => option.textContent)).toContain('Gravitational Lensing')
  })
})

describe('Cinematic Worlds preset semantics', () => {
  it('communicates selected world and modified-from-preset state without color alone', async () => {
    const preset = presetFor('ancientMachine')
    const base = resolveCinematicConfigForPreset(preset, {})!
    useReactStore.getState().selectReactPreset(preset.id)
    useReactStore.getState().setCinematicConfigForPreset(preset.id, { ...base, seed: base.seed + 1 })
    await render(<ReactPresetsPanel />)

    const selected = container.querySelector('button[aria-current="true"]') as HTMLButtonElement
    expect(selected.textContent).toContain('Selected')
    expect(selected.textContent).toContain('Modified')
    expect(container.textContent).toContain('Current world:')
    expect(container.textContent).toContain('Ancient Machine')
  })
})
