// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateReactStore, useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import { ReactFxPanel } from '../ReactFxPanel'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../soundDrawing/SoundDrawingPerformanceTypes'

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


  it('disables source rows only when Generated Show Visuals bypasses the manual source', async () => {
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

    const visualSizeRow = [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes('Visual Size'))
    expect(visualSizeRow?.querySelector<HTMLInputElement>('input[type="range"]')?.disabled).toBe(false)
    expect(visualSizeRow?.textContent).toContain('Mixed ownership')
  })

  it('maps legacy SVG source values to the unified SVG card', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'svgVisual' })
    await act(async () => root.render(<ReactEnginePanel />))

    const svgChoice = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find(choice => choice.textContent?.trim() === 'SVG')
    expect(svgChoice?.getAttribute('aria-checked')).toBe('true')
  })


  it('starts a selected authored show instead of storing an inert queued choice', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })
    await act(async () => root.render(<ReactEnginePanel />))

    const showSelect = [...container.querySelectorAll<HTMLSelectElement>('select')]
      .find(select => select.closest('.rv-ctrl-row')?.textContent?.includes('Performance Show'))
    expect(showSelect).toBeDefined()
    const nextShow = [...showSelect!.options].find(option => option.value !== showSelect!.value)!
    await act(async () => {
      showSelect!.value = nextShow.value
      showSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(useReactStore.getState().soundDrawingPerformanceSettings.selectedShowId).toBe(nextShow.value)
    expect(useReactStore.getState().soundDrawingPerformanceSettings.autoPerformance).toBe(true)
  })

  it('offers only generated visuals or the current Engine Mode as performance sources', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: true })
    await act(async () => root.render(<ReactEnginePanel />))

    const sourceSelect = [...container.querySelectorAll<HTMLSelectElement>('select')]
      .find(select => select.closest('.rv-ctrl-row')?.textContent?.includes('Performance Source'))
    expect([...sourceSelect!.options].map(option => option.textContent)).toEqual([
      'Generated Show Visuals',
      'Use Current Engine Source',
    ])
    expect(container.textContent).not.toContain('Active Text')
    expect(container.textContent).not.toContain('Active SVG')
  })


  it('migrates legacy Active Text and Active SVG routing to the current Engine Mode', () => {
    for (const performanceSource of ['activeText', 'activeSvg'] as const) {
      const migrated = migrateReactStore({
        soundDrawingPerformanceSettings: {
          ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
          performanceSource,
        },
      }, 57) as { soundDrawingPerformanceSettings: typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS }
      expect(migrated.soundDrawingPerformanceSettings.performanceSource).toBe('activeUserSource')
    }
  })

  it('presents section following as a manual Classic Scope control only', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'classic', autoSectionMode: true })
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })
    await act(async () => root.render(<ReactEnginePanel />))
    expect(container.textContent).toContain('Follow Track Sections')
    expect(container.textContent).toContain('Effective visual Waveform')

    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: true })
    await act(async () => root.render(<ReactEnginePanel />))
    expect(container.textContent).not.toContain('Follow Track Sections')
    expect(container.textContent).toContain('Classic Mode')
  })
})


describe('Sound Drawing Visual Size', () => {
  async function expectVisualSizeFor(patch: Partial<typeof DEFAULT_OSCILLATOR_SETTINGS>) {
    useReactStore.getState().setOscillatorSettings(patch)
    await act(async () => root.render(<ReactEnginePanel />))
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

  it('keeps authored Pro Scope Visual Size live while signal controls are program-owned', async () => {
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

    const visualSizeRow = [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes('Visual Size'))
    const visualSizeInput = visualSizeRow?.querySelector<HTMLInputElement>('input[type="range"]')
    expect(visualSizeInput?.disabled).toBe(false)
    expect(visualSizeRow?.textContent).toContain('Mixed ownership')

    const ownedScopeFieldset = container.querySelector<HTMLFieldSetElement>(
      'fieldset[disabled][aria-describedby="sound-drawing-performance-ownership"]',
    )
    expect(ownedScopeFieldset).not.toBeNull()
    expect(ownedScopeFieldset?.textContent).toContain('Signal, trigger, phosphor, and CRT controls are owned')
  })

  it('disables authored topology rows until their matching lock is active', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'builtinShape' })
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: true })
    await act(async () => root.render(<ReactEnginePanel />))

    const engineSize = [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes('Visual Size'))
      ?.querySelector<HTMLInputElement>('input[type="range"]')
    expect(engineSize?.disabled).toBe(false)

    await act(async () => root.render(<ReactFxPanel />))
    const rowInput = (label: string) => [...container.querySelectorAll('.rv-ctrl-row')]
      .find(row => row.textContent?.includes(label))
      ?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select')
    expect(container.textContent).not.toContain('Visual Size')
    expect(rowInput('Render Mode')?.disabled).toBe(true)
    expect(rowInput('Duplicate Traces')?.disabled).toBe(true)

    useReactStore.getState().setSoundDrawingPerformanceLock('topology', true)
    await act(async () => root.render(<ReactFxPanel />))
    expect(rowInput('Render Mode')?.disabled).toBe(false)
    expect(rowInput('Duplicate Traces')?.disabled).toBe(false)
  })

  it('keeps one Visual Size in Engine and removes the duplicate from FX', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'classic',
      autoSectionMode: false,
      classicMode: 'professionalScope',
    })
    await act(async () => root.render(<ReactFxPanel />))
    expect(container.textContent).not.toContain('Visual Size')

    await act(async () => root.render(<ReactEnginePanel />))
    const visualSizeRows = [...container.querySelectorAll('.rv-ctrl-row')]
      .filter(row => row.textContent?.includes('Visual Size'))
    expect(visualSizeRows).toHaveLength(1)
    expect(container.textContent).toContain('Visual Size')
  })
})
