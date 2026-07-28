// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateReactStore, useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import { ReactFxPanel } from '../ReactFxPanel'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'

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

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().setActiveReactEngineId('oscilloscope')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('Sound Drawing source grid', () => {
  it('renders a semantic 2x2 source chooser and updates the active source', async () => {
    await act(async () => root.render(<ReactEnginePanel />))

    const group = container.querySelector('[role="radiogroup"][aria-label="Sound Drawing source"]')
    const choices = [...group!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(choices).toHaveLength(4)
    expect(choices.map(choice => choice.textContent?.trim())).toEqual([
      'Classic Scope',
      'Built-in Shape',
      'Text',
      'SVG',
    ])
    expect(choices[0].getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('.rv-osc-status-card')).toBeNull()
    expect((container.textContent?.match(/Classic Scope/g) ?? [])).toHaveLength(1)

    await act(async () => choices[2].click())
    expect(useReactStore.getState().oscillatorSettings.sourceType).toBe('text')
    expect(choices[2].getAttribute('aria-checked')).toBe('true')
  })


  it('disables source rows only when Generated Visual bypasses the manual source', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'classic',
      autoSectionMode: false,
      classicMode: 'professionalScope',
    })
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      autoPerformance: true,
      selectedShowId: 'phaseOrbit',
      performanceSource: 'generatedVisual',
    })
    await act(async () => root.render(<ReactEnginePanel />))

    const choices = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(choices.every(choice => choice.disabled)).toBe(true)
    expect(container.textContent).toContain('Unavailable ownership')
    expect(container.querySelector('fieldset[disabled][aria-describedby="sound-drawing-source-ownership"]')).not.toBeNull()

    const traceSizeRow = [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes('Trace Size'))
    expect(traceSizeRow?.querySelector<HTMLInputElement>('input[type="range"]')?.disabled).toBe(false)
    expect(traceSizeRow?.textContent).toContain('Mixed ownership')
  })

  it('maps legacy SVG source values to the unified SVG card', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'svgVisual' })
    await act(async () => root.render(<ReactEnginePanel />))

    const svgChoice = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find(choice => choice.textContent?.trim() === 'SVG')
    expect(svgChoice?.getAttribute('aria-checked')).toBe('true')
  })
})


describe('Sound Drawing Visual Size', () => {
  async function expectVisualSizeFor(patch: Partial<typeof DEFAULT_OSCILLATOR_SETTINGS>) {
    useReactStore.getState().setOscillatorSettings(patch)
    await act(async () => root.render(<ReactFxPanel />))
    const controls = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')]
      .filter(input => input.id.includes('visual-size') || input.closest('.rv-ctrl-row')?.textContent?.includes('Visual Size'))
    expect(controls).toHaveLength(1)
    expect(controls[0].max).toBe('2.5')
    expect(controls[0].min).toBe('0.1')
    expect(container.textContent).toContain('Auto Performance may animate the effective size')
  }

  it('shows one top-level Visual Size control for Classic Scope and Built-In Shape', async () => {
    await expectVisualSizeFor({ sourceType: 'classic' })
    await expectVisualSizeFor({ sourceType: 'builtinShape' })
  })

  it('shows one top-level Visual Size control for reactive and original SVG modes', async () => {
    await expectVisualSizeFor({ sourceType: 'svg', selectedSvgId: 'test-svg', svgRenderMode: 'reactivePath' })
    await expectVisualSizeFor({ sourceType: 'svg', selectedSvgId: 'test-svg', svgRenderMode: 'originalArtwork' })
  })

  it('shows the same control for text and safely normalizes legacy values', async () => {
    await expectVisualSizeFor({ sourceType: 'text' })
    useReactStore.getState().setOscillatorSettings({ pathScale: 99 })
    expect(useReactStore.getState().oscillatorSettings.pathScale).toBe(2.5)
    useReactStore.getState().setOscillatorSettings({ pathScale: Number.NaN })
    expect(useReactStore.getState().oscillatorSettings.pathScale).toBe(DEFAULT_OSCILLATOR_SETTINGS.pathScale)

    const migrated = migrateReactStore({
      oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS, pathScale: 1.4 },
    }, 0) as { oscillatorSettings: typeof DEFAULT_OSCILLATOR_SETTINGS }
    expect(migrated.oscillatorSettings.pathScale).toBe(1.4)
  })

  it('keeps authored Pro Scope Trace Size live while signal controls are program-owned', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'classic',
      autoSectionMode: false,
      classicMode: 'professionalScope',
    })
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      autoPerformance: true,
      selectedShowId: 'phaseOrbit',
    })
    await act(async () => root.render(<ReactEnginePanel />))

    const traceSizeRow = [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes('Trace Size'))
    const traceSizeInput = traceSizeRow?.querySelector<HTMLInputElement>('input[type="range"]')
    expect(traceSizeInput?.disabled).toBe(false)
    expect(traceSizeRow?.textContent).toContain('Mixed ownership')

    const ownedScopeFieldset = container.querySelector<HTMLFieldSetElement>(
      'fieldset[disabled][aria-describedby="sound-drawing-performance-ownership"]',
    )
    expect(ownedScopeFieldset).not.toBeNull()
    expect(ownedScopeFieldset?.textContent).toContain('Signal, trigger, phosphor, and CRT controls are owned')
  })

  it('disables authored topology rows until their matching lock is active', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'builtinShape' })
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: true })
    await act(async () => root.render(<ReactFxPanel />))

    const rowInput = (label: string) => [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes(label))
      ?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select')
    expect(rowInput('Visual Size')?.disabled).toBe(false)
    expect(rowInput('Render Mode')?.disabled).toBe(true)
    expect(rowInput('Duplicate Traces')?.disabled).toBe(true)

    useReactStore.getState().setSoundDrawingPerformanceLock('topology', true)
    await act(async () => root.render(<ReactFxPanel />))
    expect(rowInput('Render Mode')?.disabled).toBe(false)
    expect(rowInput('Duplicate Traces')?.disabled).toBe(false)
  })

  it('moves Pro Scope Trace Size to the Engine panel instead of duplicating it in FX', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'classic',
      autoSectionMode: false,
      classicMode: 'professionalScope',
    })
    await act(async () => root.render(<ReactFxPanel />))
    expect(container.textContent).toContain('Pro Scope Trace Size is owned by Engine')
    expect(container.textContent).not.toContain('Visual Size')

    await act(async () => root.render(<ReactEnginePanel />))
    const traceSizeRows = [...container.querySelectorAll('.rv-ctrl-row')]
      .filter(row => row.textContent?.includes('Trace Size'))
    expect(traceSizeRows).toHaveLength(1)
  })
})
