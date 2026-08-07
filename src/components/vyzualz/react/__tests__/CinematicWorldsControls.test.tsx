// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../../stores/reactStore'
import {
  CinematicWorldsDesignControls,
  CinematicWorldsFxControls,
  CinematicWorldsModulationControls,
} from '../CinematicWorldsControls'
import { ReactEnginePanel } from '../ReactEnginePanel'
import { ReactFxPanel } from '../ReactFxPanel'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import { resolveReactiveConstellationSettings } from '../CinematicWorldSettings'
import { applyReactiveConstellationVisualDnaProfile } from '../ReactiveConstellationVisualDna'

vi.mock('../../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ currentAudioTrackId: null }),
}))

vi.mock('../../../../features/lyrics/runtime/useLyricPlayback', () => ({
  useLyricPlaybackSelector: (selector: (state: Record<string, unknown>) => unknown) => selector({
    activeCue: null,
    activeWord: null,
    documentId: null,
    sourceIdentity: null,
  }),
}))

let container: HTMLElement
let root: ReturnType<typeof createRoot>

const presetFor = (worldMode: string) => DEFAULT_REACT_PRESETS.find(preset => preset.cinematicConfig?.worldMode === worldMode)!

function activateLegacyCinematicPreset(preset: (typeof DEFAULT_REACT_PRESETS)[number]) {
  useReactStore.setState({
    activeReactEngineId: 'cinematicPortal',
    activeReactPresetId: preset.id,
  })
}

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

async function setRangeValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, String(value))
  await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })))
}

async function selectDropdownOption(trigger: HTMLButtonElement, label: string) {
  await act(async () => trigger.click())
  const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.trim() === label)
  if (!option) throw new Error(`Dropdown option not found: ${label}`)
  await act(async () => option.click())
}

function activeConstellationSettings(presetId: string) {
  const config = useReactStore.getState().cinematicConfigsByPresetId[presetId]
  if (!config || config.worldSettings.mode !== 'reactiveConstellation') throw new Error('Expected Reactive Constellation override')
  return resolveReactiveConstellationSettings(config.worldSettings)
}

describe('Cinematic Worlds engine controls', () => {
  it('keeps World and preset navigation out of Cinematic design controls', async () => {
    activateLegacyCinematicPreset(presetFor('eventHorizon'))
    await render(<CinematicWorldsDesignControls />)

    expect(container.querySelector('[id^="cinematic-world-group-"]')).toBeNull()
    expect(container.querySelector('[id^="cinematic-world-"]')).toBeNull()
    expect(container.querySelector('#cinematic-preset-select')).toBeNull()
    expect(container.querySelector('#cinematic-camera-rig')).not.toBeNull()
    expect(container.textContent).toContain('Choose a World from the left SOURCE panel')
  })

  it('responds to right-rail simple and advanced mode changes without duplicating the mode switch', async () => {
    const preset = presetFor('eventHorizon')
    const base = resolveCinematicConfigForPreset(preset, {})!
    activateLegacyCinematicPreset(preset)
    useReactStore.getState().setCinematicConfigForPreset(preset.id, { ...base, seed: 7654321 })
    await render(<CinematicWorldsDesignControls />)

    expect(buttonWithText('Simple').getAttribute('aria-pressed')).toBe('true')
    expect(buttonWithText('Advanced').getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('#cinematic-portal-shape')).toBeNull()
    await act(async () => useReactStore.getState().setCinematicWorldsUiMode('advanced'))
    expect(container.querySelector('#cinematic-portal-shape')).not.toBeNull()
    expect(container.querySelector('output')?.textContent).toBe('7654321')

    await act(async () => useReactStore.getState().setCinematicWorldsUiMode('simple'))
    await act(async () => useReactStore.getState().setCinematicWorldsUiMode('advanced'))
    expect(container.querySelector('output')?.textContent).toBe('7654321')
  })

  it('hides irrelevant portal controls and exposes safe Auto Director controls', async () => {
    activateLegacyCinematicPreset(presetFor('infiniteCorridor'))
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsDesignControls />)

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
    activateLegacyCinematicPreset(presetFor('stormGateway'))
    await render(<CinematicWorldsDesignControls />)

    const lock = container.querySelector('#cinematic-seed-lock') as HTMLButtonElement
    await act(async () => lock.click())
    expect(lock.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[aria-label="Randomize cinematic variation"]')?.hasAttribute('disabled')).toBe(true)
    expect(buttonWithText('Reset World')).toBeTruthy()
    expect(buttonWithText('Reset Camera')).toBeTruthy()
    expect(buttonWithText('Reset Audio Mappings')).toBeTruthy()
  })

  it('applies Visual DNA through the shared labeled dropdown and preserves scoped reset behavior', async () => {
    const preset = presetFor('reactiveConstellation')
    const base = resolveCinematicConfigForPreset(preset, {})!
    activateLegacyCinematicPreset(preset)
    await render(<CinematicWorldsDesignControls />)

    const selector = container.querySelector('#constellation-visual-dna-profile') as HTMLButtonElement
    expect(selector).toBeInstanceOf(HTMLButtonElement)
    expect((container.querySelector('label[for="constellation-visual-dna-profile"]') as HTMLLabelElement).control).toBe(selector)
    selector.focus()
    expect(document.activeElement).toBe(selector)
    await act(async () => selector.click())
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(7)
    await act(async () => selector.click())

    await selectDropdownOption(selector, 'Heavy Dubstep')
    expect(activeConstellationSettings(preset.id).visualDnaProfile).toBe('heavyDubstep')
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id].worldMode).toBe('reactiveConstellation')

    await act(async () => buttonWithText('Reset Camera').click())
    let override = useReactStore.getState().cinematicConfigsByPresetId[preset.id]
    expect(override.camera).toEqual(base.camera)
    expect(activeConstellationSettings(preset.id).visualDnaProfile).toBe('custom')

    await selectDropdownOption(selector, 'Techno')
    await act(async () => buttonWithText('Reset Audio Mappings').click())
    override = useReactStore.getState().cinematicConfigsByPresetId[preset.id]
    expect(override.audioMapping).toEqual(base.audioMapping)
    expect(activeConstellationSettings(preset.id).visualDnaProfile).toBe('custom')

    await selectDropdownOption(selector, 'House')
    await act(async () => buttonWithText('Reset World').click())
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id]).toBeUndefined()
  })
})

describe('Cinematic Worlds FX and media controls', () => {
  it('keeps one Simple and Advanced switch in the right-rail Design surface', async () => {
    activateLegacyCinematicPreset(presetFor('eventHorizon'))
    await render(<ReactFxPanel />)

    expect([...container.querySelectorAll('button')].filter(button => button.textContent?.trim() === 'Simple')).toHaveLength(1)
    expect([...container.querySelectorAll('button')].filter(button => button.textContent?.trim() === 'Advanced')).toHaveLength(1)
    expect(buttonWithText('Simple').getAttribute('aria-pressed')).toBe('true')
    const advanced = buttonWithText('Advanced')
    await act(async () => advanced.click())
    expect(advanced.getAttribute('aria-pressed')).toBe('true')
  })

  it('does not expose retired Media Portal controls and labels quality effects', async () => {
    activateLegacyCinematicPreset(presetFor('eventHorizon'))
    await render(<CinematicWorldsFxControls />)

    expect(container.querySelector('#cinematic-media-source')).toBeNull()
    expect(container.querySelector('#cinematic-media-fit')).toBeNull()
    expect(container.querySelector('#cinematic-media-mask')).toBeNull()
    expect(container.querySelector('#cinematic-media-appearance')).toBeNull()
    expect(container.querySelector('#cinematic-media-loop')).toBeNull()
    expect(container.querySelector('#cinematic-quality-description')?.textContent).toContain('geometry density')
  })

  it('reveals environment, material and world-specific values only in advanced mode', async () => {
    activateLegacyCinematicPreset(presetFor('eventHorizon'))
    await render(<ReactFxPanel />)
    expect(container.querySelector('#cinematic-environment-depth')).toBeNull()
    expect(container.querySelector('#cinematic-world-setting-coreRadius')).toBeNull()

    await act(async () => buttonWithText('Advanced').click())
    expect(container.querySelector('#cinematic-environment-depth')).not.toBeNull()
    expect(container.querySelector('#cinematic-material-refraction')).not.toBeNull()
    expect(container.querySelector('#cinematic-world-setting-coreRadius')).not.toBeNull()
  })

  it('exposes six responsive, focusable simple-mode macros and keeps low-level controls in advanced mode', async () => {
    const preset = presetFor('reactiveConstellation')
    activateLegacyCinematicPreset(preset)
    await render(<ReactFxPanel />)

    const group = container.querySelector('[aria-label="Reactive Constellation performance macros"]')
    expect(group?.querySelectorAll('input[type="range"]')).toHaveLength(6)
    expect(container.querySelector('#constellation-node-count')).toBeNull()
    const structure = container.querySelector('#constellation-structure-macro') as HTMLInputElement
    expect((container.querySelector('label[for="constellation-structure-macro"]') as HTMLLabelElement).control).toBe(structure)
    expect(structure.getAttribute('aria-describedby')).toBe('constellation-structure-macro-description')
    structure.focus()
    expect(document.activeElement).toBe(structure)
    await setRangeValue(structure, 0.86)
    expect(activeConstellationSettings(preset.id).macroStructure).toBe(0.86)

    await act(async () => buttonWithText('Advanced').click())
    expect(container.querySelector('#constellation-node-count')).toBeInstanceOf(HTMLInputElement)
    expect(container.querySelector('#constellation-structure-macro')).toBeNull()
  })

  it('moves a profiled look to Custom after an advanced detail edit without replacing other values', async () => {
    const preset = presetFor('reactiveConstellation')
    const base = resolveCinematicConfigForPreset(preset, {})!
    const profiled = applyReactiveConstellationVisualDnaProfile(base, 'melodicBass')
    activateLegacyCinematicPreset(preset)
    useReactStore.getState().setCinematicConfigForPreset(preset.id, profiled)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsFxControls />)

    const before = activeConstellationSettings(preset.id)
    const nodeCount = container.querySelector('#constellation-node-count') as HTMLInputElement
    await setRangeValue(nodeCount, 57)
    const after = activeConstellationSettings(preset.id)

    expect(after.visualDnaProfile).toBe('custom')
    expect(after.nodeCount).toBe(57)
    expect(after.networkSpread).toBe(before.networkSpread)
    expect(after.macroImpact).toBe(before.macroImpact)
  })
})

describe('Cinematic Worlds audio mappings', () => {
  it('reports only unavailable active Music Intelligence routes with readable assignments', async () => {
    activateLegacyCinematicPreset(presetFor('stormGateway'))
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsModulationControls />)

    expect(container.textContent).toContain('Unavailable Music Intelligence inputs')
    expect(container.textContent).toContain('Snare unavailable')
    expect(container.textContent).toContain('Waiting for live audio input.')
    expect(container.textContent).not.toContain('Track Energy Curve')
    expect(container.textContent).toContain('Lightning')
    expect(container.textContent).not.toContain('storm-snare-lightning')
    expect(container.querySelector('#cinematic-route-0-source')).not.toBeNull()
    expect(container.querySelector('#cinematic-route-0-target')).not.toBeNull()
  })

  it('edits source-to-target mappings through labeled controls', async () => {
    const preset = presetFor('eventHorizon')
    activateLegacyCinematicPreset(preset)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    await render(<CinematicWorldsModulationControls />)

    const source = container.querySelector('#cinematic-route-0-source') as HTMLButtonElement
    await selectDropdownOption(source, 'Bass')
    expect(useReactStore.getState().cinematicConfigsByPresetId[preset.id].audioMapping.routes[0].source).toBe('bass')

    const target = container.querySelector('#cinematic-route-0-target') as HTMLButtonElement
    await act(async () => target.click())
    expect([...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
      .map(option => option.textContent?.trim())).toContain('Gravitational Lensing')
  })
})


describe('Cinematic Worlds Stage 23 retirement', () => {
  it('keeps the legacy controls compatibility-only while the public engine panel stays on Cinema', async () => {
    useReactStore.getState().selectReactPreset(presetFor('eventHorizon').id)
    await render(<ReactEnginePanel />)

    expect(useReactStore.getState().activeReactEngineId).toBe('cinema')
    expect(useReactStore.getState().activeReactPresetId).toBeNull()
    expect(useReactStore.getState().pendingCinemaLegacySelectionMigration).toMatchObject({
      legacyEngineId: 'cinematicPortal',
    })
    expect(container.querySelector('[data-cinematic-world-grid]')).toBeNull()
  })
})
