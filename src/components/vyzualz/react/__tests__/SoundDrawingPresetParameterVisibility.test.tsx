// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateReactStore, useReactStore } from '../../../../stores/reactStore'
import { ReactFxPanel } from '../ReactFxPanel'
import { ReactModulationPanel } from '../ReactModulationPanel'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'

let container: HTMLDivElement
let root: Root

async function renderPanels(): Promise<void> {
  await act(async () => root.render(
    <>
      <ReactFxPanel />
      <ReactModulationPanel />
    </>,
  ))
}

function hasControl(label: string): boolean {
  return [...container.querySelectorAll<HTMLElement>('.rv-ctrl-label')]
    .some(candidate => candidate.textContent?.trim() === label)
}

function controlInput(label: string): HTMLInputElement | null {
  const candidate = [...container.querySelectorAll<HTMLLabelElement>('label.rv-ctrl-label')]
    .find(element => element.textContent?.trim() === label)
  return candidate?.control instanceof HTMLInputElement ? candidate.control : null
}

describe('Sound Drawing preset-aware production parameter visibility', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useReactStore.getState().resetReactView()
    useReactStore.getState().setActiveReactEngineId('oscilloscope')
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('switches from a Classic Scope preset to a point-path preset and removes stale unsupported controls when switched back', async () => {
    useReactStore.getState().selectReactPreset('preset-xy-cyan-scope')
    await renderPanels()

    expect(hasControl('Trail Decay')).toBe(true)
    expect(hasControl('Bass React')).toBe(true)
    expect(hasControl('Motion')).toBe(false)
    expect(hasControl('Glow')).toBe(false)
    expect(hasControl('Render Mode')).toBe(false)
    expect(hasControl('Duplicate Traces')).toBe(false)
    expect(hasControl('Displacement')).toBe(false)
    expect(hasControl('Bass → Scale')).toBe(false)

    await act(async () => {
      useReactStore.getState().selectReactPreset('preset-glyph-circle-pulse')
    })

    expect(hasControl('Motion')).toBe(true)
    expect(hasControl('Glow')).toBe(true)
    expect(hasControl('Render Mode')).toBe(true)
    expect(hasControl('Duplicate Traces')).toBe(true)
    expect(hasControl('Displacement')).toBe(true)
    expect(hasControl('Bass → Scale')).toBe(true)

    await act(async () => {
      useReactStore.getState().selectReactPreset('preset-xy-cyan-scope')
    })
    expect(hasControl('Render Mode')).toBe(false)
    expect(hasControl('Displacement')).toBe(false)
  })

  it('keeps the SVG Slot preset on its real point-path fallback contract until media is selected', async () => {
    useReactStore.getState().selectReactPreset('preset-svg-glyph-slot')
    await renderPanels()

    expect(useReactStore.getState().oscillatorSettings.selectedSvgId).toBeNull()
    expect(hasControl('Render Mode')).toBe(true)
    expect(hasControl('Duplicate Traces')).toBe(true)
    expect(hasControl('Displacement')).toBe(true)
    expect(hasControl('Displace Mode')).toBe(true)
    expect(hasControl('Bass → Scale')).toBe(true)
    expect(hasControl('Glow')).toBe(true)
  })

  it('preserves hidden manual values across a capability-only source switch', async () => {
    useReactStore.getState().selectReactPreset('preset-glyph-circle-pulse')
    useReactStore.getState().setOscillatorSettings({
      audioDisplacement: 0.23,
      duplicateTraces: 4,
    })
    await renderPanels()
    expect(controlInput('Displacement')?.value).toBe('0.23')
    expect(controlInput('Duplicate Traces')?.value).toBe('4')

    await act(async () => {
      useReactStore.getState().setOscillatorSettings({ sourceType: 'classic', classicMode: 'waveform' })
    })
    expect(hasControl('Displacement')).toBe(false)
    expect(hasControl('Duplicate Traces')).toBe(false)
    expect(useReactStore.getState().oscillatorSettings.audioDisplacement).toBe(0.23)
    expect(useReactStore.getState().oscillatorSettings.duplicateTraces).toBe(4)

    await act(async () => {
      useReactStore.getState().setOscillatorSettings({ sourceType: 'builtinShape' })
    })
    expect(controlInput('Displacement')?.value).toBe('0.23')
    expect(controlInput('Duplicate Traces')?.value).toBe('4')
  })

  it('preserves hidden values through persisted-state migration and re-entry', async () => {
    const hydrated = migrateReactStore({
      activeReactEngineId: 'oscilloscope',
      oscillatorSettings: {
        ...DEFAULT_OSCILLATOR_SETTINGS,
        sourceType: 'classic',
        classicMode: 'waveform',
        audioDisplacement: 0.31,
        duplicateTraces: 5,
      },
    }, 74)

    useReactStore.setState(hydrated as Partial<ReturnType<typeof useReactStore.getState>>)
    await renderPanels()

    expect(hasControl('Displacement')).toBe(false)
    expect(hasControl('Duplicate Traces')).toBe(false)
    expect(useReactStore.getState().oscillatorSettings.audioDisplacement).toBe(0.31)
    expect(useReactStore.getState().oscillatorSettings.duplicateTraces).toBe(5)

    await act(async () => {
      useReactStore.getState().setOscillatorSettings({ sourceType: 'builtinShape' })
    })
    expect(controlInput('Displacement')?.value).toBe('0.31')
    expect(controlInput('Duplicate Traces')?.value).toBe('5')
  })

  it('hides show-overridden manual parameters while retaining a shared consumed Trail Decay control', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      selectedShowId: 'radialPressureSystem',
      autoPerformance: true,
    })
    await renderPanels()

    expect(hasControl('Trail Decay')).toBe(true)
    expect(hasControl('Render Mode')).toBe(false)
    expect(hasControl('Duplicate Traces')).toBe(false)
    expect(hasControl('Displacement')).toBe(false)
    expect(hasControl('High → Jitter')).toBe(false)
    expect(hasControl('Displace Mode')).toBe(true)
    expect(hasControl('Bass → Scale')).toBe(true)

    await act(async () => {
      useReactStore.getState().setSoundDrawingPerformanceSettings({ selectedShowId: 'harmonicRibbonReactor' })
    })
    expect(hasControl('Trail Decay')).toBe(true)
    expect(hasControl('Displace Mode')).toBe(false)
    expect(hasControl('Bass → Scale')).toBe(false)
    expect(hasControl('Motion')).toBe(false)
    expect(hasControl('Glow')).toBe(false)
    expect(hasControl('Bass React')).toBe(true)

    await act(async () => {
      useReactStore.getState().setSoundDrawingPerformanceSettings({ selectedShowId: 'livingRibbonSystem' })
    })
    expect(hasControl('Glow')).toBe(true)
    expect(hasControl('Bass React')).toBe(false)
  })

  it('shows native-artwork controls but hides point-path-only SVG parameters', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'svg',
      svgRenderMode: 'originalArtwork',
      selectedSvgId: 'test-svg',
    })
    await renderPanels()

    expect(hasControl('Trail Decay')).toBe(true)
    expect(hasControl('Duplicate Traces')).toBe(true)
    expect(hasControl('Rotation Speed')).toBe(true)
    expect(hasControl('Displacement')).toBe(true)
    expect(hasControl('Bass → Scale')).toBe(true)
    expect(hasControl('Render Mode')).toBe(false)
    expect(hasControl('Mirror X')).toBe(false)
    expect(hasControl('Displace Mode')).toBe(false)
    expect(hasControl('Glow')).toBe(false)
  })
})
