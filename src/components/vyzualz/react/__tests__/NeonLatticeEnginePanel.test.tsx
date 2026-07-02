// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useReactStore } from '../../../../stores/reactStore'
import {
  NeonLatticeEnginePanel,
  NeonLatticeFxControls,
  NeonLatticeModulationControls,
} from '../NeonLatticeEnginePanel'
import { normalizeNeonLatticeSettings } from '../NeonLatticeConfig'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../ReactTypes'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useReactStore.getState().resetNeonLatticeSettings()
})

function inputForLabel(labelText: string): HTMLInputElement | HTMLSelectElement {
  const label = [...container.querySelectorAll<HTMLLabelElement>('label')]
    .find(candidate => candidate.textContent?.trim() === labelText)
  if (!label?.htmlFor) throw new Error(`Missing labeled control: ${labelText}`)
  const control = document.getElementById(label.htmlFor) as HTMLInputElement | HTMLSelectElement | null
  if (!control) throw new Error(`Missing control for label: ${labelText}`)
  return control
}

async function changeControl(labelText: string, value: string) {
  const control = inputForLabel(labelText)
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  nativeSetter?.call(control, value)
  await act(async () => {
    if (control instanceof HTMLInputElement) control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('NeonLatticeEnginePanel reset action', () => {
  it('uses the shared reset-button treatment and preserves the Neon Lattice reset behavior', async () => {
    useReactStore.getState().setNeonLatticeSettings({
      railDensity: 0.91,
      pulseSpeed: 0.13,
      reseedInterval: 31,
    })

    await act(async () => root.render(<NeonLatticeEnginePanel />))

    const resetButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Reset Engine Settings')

    expect(resetButton).toBeDefined()
    expect(resetButton?.type).toBe('button')
    expect(resetButton?.classList.contains('rv-reset-btn')).toBe(true)
    expect(resetButton?.className).not.toContain('rv-btn')
    expect(resetButton?.title).toBe('Reset all Neon Lattice settings to defaults')
    expect(resetButton?.closest('.rv-ctrl-footer')).not.toBeNull()

    await act(async () => resetButton?.click())

    expect(useReactStore.getState().neonLatticeSettings).toEqual(DEFAULT_NEON_LATTICE_SETTINGS)
  })

  it('uses progressive disclosure for legacy, lane, hybrid, and diagonal settings', async () => {
    await act(async () => root.render(<NeonLatticeEnginePanel />))

    expect(() => inputForLabel('Rail Density')).not.toThrow()
    expect(() => inputForLabel('Lane Count')).toThrow()
    expect(inputForLabel('Diagonal Angle')).toHaveProperty('disabled', true)

    await changeControl('Composition Mode', 'laneSequencer')
    expect(() => inputForLabel('Rail Density')).toThrow()
    expect(() => inputForLabel('Lane Count')).not.toThrow()

    await changeControl('Composition Mode', 'hybrid')
    expect(() => inputForLabel('Rail Density')).not.toThrow()
    expect(() => inputForLabel('Lane Count')).not.toThrow()

    await changeControl('Diagonal-Up Weight', '0.4')
    expect(inputForLabel('Diagonal Angle')).toHaveProperty('disabled', false)
  })

  it('updates typed ENGINE settings and reseeds without mutating the stored seed', async () => {
    useReactStore.getState().selectReactPreset('preset-nl-drmvyz-lattice')
    useReactStore.getState().setNeonLatticeSettings({ compositionMode: 'hybrid' })
    await act(async () => root.render(<NeonLatticeEnginePanel />))

    await changeControl('Lane Count', '12')
    await changeControl('Lane Assignment Mode', 'centerOut')
    await changeControl('Chord Size', '6')

    const beforeSeed = useReactStore.getState().neonLatticeSettings.lanePattern.seed
    const reseedButton = container.querySelector<HTMLButtonElement>('[aria-label="Reseed active Neon Lattice pattern"]')
    expect(reseedButton).not.toBeNull()
    await act(async () => reseedButton?.click())

    const state = useReactStore.getState()
    expect(state.neonLatticeSettings.lanePattern.laneCount).toBe(12)
    expect(state.neonLatticeSettings.laneAssignmentMode).toBe('centerOut')
    expect(state.neonLatticeSettings.chordSize).toBe(6)
    expect(state.neonLatticeSettings.lanePattern.seed).toBe(beforeSeed)
    expect(state.performanceActionEvent?.actionId).toBe('neonLattice.reseed')
  })

  it('restores the active preset independently from engine defaults', async () => {
    useReactStore.getState().selectReactPreset('preset-nl-acid-magenta')
    const preset = useReactStore.getState().reactPresets.find(candidate => candidate.id === 'preset-nl-acid-magenta')!
    const expected = normalizeNeonLatticeSettings({
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      ...preset.neonLatticeSettings,
    })
    useReactStore.getState().setNeonLatticeSettings({ railDensity: 0.01, coreWidth: 7 })

    await act(async () => root.render(<NeonLatticeEnginePanel />))
    const resetPreset = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Reset to Current Preset')
    await act(async () => resetPreset?.click())

    expect(useReactStore.getState().neonLatticeSettings).toEqual(expected)
    expect(useReactStore.getState().neonLatticeSettings).not.toEqual(DEFAULT_NEON_LATTICE_SETTINGS)
  })

  it('associates visible controls with labels and names the reseed action', async () => {
    useReactStore.getState().setNeonLatticeSettings({ compositionMode: 'hybrid' })
    await act(async () => root.render(<NeonLatticeEnginePanel />))

    for (const label of container.querySelectorAll<HTMLLabelElement>('label[for]')) {
      expect(label.control, label.textContent ?? '').not.toBeNull()
    }
    expect(container.querySelector('[aria-label="Reseed active Neon Lattice pattern"]')).not.toBeNull()
  })
})

describe('Neon Lattice FX and MOD controls', () => {
  it('updates visual finish settings through the canonical store path while preserving siblings', async () => {
    await act(async () => root.render(<NeonLatticeFxControls />))

    const originalBodyWidth = useReactStore.getState().neonLatticeSettings.bodyWidth
    await changeControl('Core Width', '2.5')
    await changeControl('Legacy Strike Color Role', 'accent')
    await changeControl('Quality Tier', 'low')

    const settings = useReactStore.getState().neonLatticeSettings
    expect(settings.coreWidth).toBe(2.5)
    expect(settings.bodyWidth).toBe(originalBodyWidth)
    expect(settings.cyanStrikePaletteRole).toBe('accent')
    expect(settings.qualityTier).toBe('low')
  })

  it('updates discrete and continuous MOD routes without replacing unrelated route state', async () => {
    await act(async () => root.render(<NeonLatticeModulationControls />))

    const originalBassWidth = useReactStore.getState().neonLatticeSettings.modulationRoutes.bassToWidth
    await changeControl('Kick → Pillar', '0.73')
    await changeControl('Bass → Bloom', '0.62')
    await changeControl('32-Beat Diagonal Weight', '0.44')

    const settings = useReactStore.getState().neonLatticeSettings
    expect(settings.triggerRoutes.find(route => route.source === 'kick')).toMatchObject({ enabled: true, amount: 0.73 })
    expect(settings.modulationRoutes.bassToBloom).toBe(0.62)
    expect(settings.modulationRoutes.phrase32ProgressToDiagonalWeight).toBe(0.44)
    expect(settings.modulationRoutes.bassToWidth).toBe(originalBassWidth)
  })

  it('disables audio routes clearly when the canonical reactive engine is off', async () => {
    useReactStore.getState().setNeonLatticeSettings({ audioReactive: false })
    await act(async () => root.render(<NeonLatticeModulationControls />))

    expect(inputForLabel('Beat → Lane Step')).toHaveProperty('disabled', true)
    expect(inputForLabel('Bass → Bloom')).toHaveProperty('disabled', true)
    expect(inputForLabel('32 Beats → Scene Action')).toHaveProperty('disabled', true)
  })
})
