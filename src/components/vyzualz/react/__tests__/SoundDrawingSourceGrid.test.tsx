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
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from '../soundDrawing/SoundDrawingPerformanceShows'

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

describe('Sound Drawing authored-show ownership', () => {
  it('loads with no Performance Show selected and leaves the base source controls active', async () => {
    await act(async () => root.render(<ReactEnginePanel />))
    const showDropdown = container.querySelector<HTMLButtonElement>('#sound-drawing-performance-show-trigger')!
    const autoToggle = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.closest('.rv-ctrl-row')?.textContent?.includes('Auto Performance'))!

    expect(showDropdown.textContent).toContain('Select a Performance Show…')
    expect(autoToggle.disabled).toBe(true)
    expect(container.querySelector('[role="radiogroup"][aria-label="Sound Drawing source"]')).not.toBeNull()
  })

  it('renders the manual 2x2 source chooser only while no Performance Show is selected', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })
    await act(async () => root.render(<ReactEnginePanel />))

    const group = container.querySelector('[role="radiogroup"][aria-label="Sound Drawing source"]')
    const choices = [...group!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
    expect(choices.map(choice => choice.textContent?.trim())).toEqual([
      'Classic Scope',
      'Built-in Shape',
      'Text',
      'SVG',
    ])

    await act(async () => choices[2].click())
    expect(useReactStore.getState().oscillatorSettings.sourceType).toBe('text')
  })

  it('removes manual source routing, generator overrides, and Parameter Locks from a running show', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      autoPerformance: true,
      selectedShowId: 'phaseOrbit',
    })
    await act(async () => root.render(<ReactEnginePanel />))

    expect(container.textContent).toContain('Show Choreography')
    expect(container.textContent).toContain('Show Size')
    expect(container.textContent).not.toContain('Engine Mode')
    expect(container.textContent).not.toContain('Performance Source')
    expect(container.textContent).not.toContain('Source Integration')
    expect(container.textContent).not.toContain('Generator Preference')
    expect(container.textContent).not.toContain('Parameter Locks')
    expect(container.querySelector('[role="radiogroup"][aria-label="Sound Drawing source"]')).toBeNull()
  })

  it('loads a selected show base design without enabling Auto Performance', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      autoPerformance: false,
      performanceSource: 'activeUserSource',
      generatorPreference: 'horizontalOscilloscope',
      locks: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
        generator: true,
        layerRecruitment: true,
      },
    })
    await act(async () => root.render(<ReactEnginePanel />))

    const showDropdown = container.querySelector<HTMLButtonElement>('#sound-drawing-performance-show-trigger')!
    const nextShow = SOUND_DRAWING_PERFORMANCE_SHOWS[0]!
    await act(async () => showDropdown.click())
    const nextShowOption = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
      .find(option => option.textContent?.includes(nextShow.name))!
    await act(async () => nextShowOption.click())

    const settings = useReactStore.getState().soundDrawingPerformanceSettings
    expect(settings.selectedShowId).toBe(nextShow.id)
    expect(settings.autoPerformance).toBe(false)
    expect(settings.performanceSource).toBe('generatedVisual')
    expect(settings.generatorPreference).toBe('authored')
    expect(Object.values(settings.locks).every(value => value === false)).toBe(true)
    expect(container.textContent).toContain('Base Design')
    expect(container.textContent).toContain('Show Size')
    expect(container.textContent).not.toContain('Engine Mode')
    expect(container.querySelector('[role="radiogroup"][aria-label="Sound Drawing source"]')).toBeNull()
  })

  it('canonicalizes stale source and lock settings whenever a Performance Show is selected', () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      selectedShowId: 'phaseOrbit',
      autoPerformance: false,
      performanceSource: 'activeUserSource',
      generatorPreference: 'particleSpline',
      locks: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
        topology: true,
        camera: true,
      },
    })
    const settings = useReactStore.getState().soundDrawingPerformanceSettings
    expect(settings.performanceSource).toBe('generatedVisual')
    expect(settings.generatorPreference).toBe('authored')
    expect(Object.values(settings.locks).every(value => value === false)).toBe(true)

    useReactStore.getState().setSoundDrawingPerformanceLock('layerRecruitment', true)
    expect(useReactStore.getState().soundDrawingPerformanceSettings.locks.layerRecruitment).toBe(false)
  })

  it('keeps legacy source migration only for manual mode and removes it from authored playback', () => {
    const manual = migrateReactStore({
      soundDrawingPerformanceSettings: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
        autoPerformance: false,
        performanceSource: 'activeText',
      },
    }, 57) as { soundDrawingPerformanceSettings: typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS }
    expect(manual.soundDrawingPerformanceSettings.performanceSource).toBe('activeUserSource')

    const authored = migrateReactStore({
      soundDrawingPerformanceSettings: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
        selectedShowId: 'phaseOrbit',
        autoPerformance: true,
        performanceSource: 'activeSvg',
        locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, generator: true },
      },
    }, 57) as { soundDrawingPerformanceSettings: typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS }
    expect(authored.soundDrawingPerformanceSettings.selectedShowId).toBeNull()
    expect(authored.soundDrawingPerformanceSettings.autoPerformance).toBe(false)
    expect(authored.soundDrawingPerformanceSettings.performanceSource).toBe('generatedVisual')
    expect(authored.soundDrawingPerformanceSettings.locks.generator).toBe(false)
  })

  it('presents section following as a manual Classic Scope control only', async () => {
    useReactStore.getState().setOscillatorSettings({ sourceType: 'classic', autoSectionMode: true })
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })
    await act(async () => root.render(<ReactEnginePanel />))
    expect(container.textContent).toContain('Follow Track Sections')
    expect(container.textContent).toContain('Effective visual Waveform')

    useReactStore.getState().setSoundDrawingPerformanceSettings({ selectedShowId: 'radialPressureSystem', autoPerformance: true })
    await act(async () => root.render(<ReactEnginePanel />))
    expect(container.textContent).not.toContain('Follow Track Sections')
    expect(container.textContent).not.toContain('Classic Mode')
  })

  it('keeps transparent Sound Drawing fieldsets on the shared control-stack rhythm', async () => {
    useReactStore.getState().setOscillatorSettings({
      sourceType: 'classic',
      autoSectionMode: false,
      classicMode: 'professionalScope',
    })
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })

    await act(async () => root.render(<ReactEnginePanel />))

    const stackedFieldsets = container.querySelectorAll('fieldset.rv-ctrl-fieldset-stack')
    expect(stackedFieldsets).toHaveLength(2)
    expect(stackedFieldsets[0].getAttribute('style')).toBeNull()
    expect(stackedFieldsets[1].getAttribute('style')).toBeNull()
  })
})

describe('Sound Drawing size controls', () => {
  async function expectManualVisualSizeFor(patch: Partial<typeof DEFAULT_OSCILLATOR_SETTINGS>) {
    useReactStore.getState().setSoundDrawingPerformanceSettings({ autoPerformance: false })
    useReactStore.getState().setOscillatorSettings(patch)
    await act(async () => root.render(<ReactEnginePanel />))
    const controls = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')]
      .filter(input => input.closest('.rv-ctrl-row')?.textContent?.includes('Visual Size'))
    expect(controls).toHaveLength(1)
    expect(controls[0].max).toBe('2.5')
    expect(controls[0].min).toBe('0.1')
  }

  it('shows one Visual Size control for every manual source family', async () => {
    await expectManualVisualSizeFor({ sourceType: 'classic' })
    await expectManualVisualSizeFor({ sourceType: 'builtinShape' })
    await expectManualVisualSizeFor({ sourceType: 'text' })
    await expectManualVisualSizeFor({ sourceType: 'svg', selectedSvgId: 'test-svg', svgRenderMode: 'reactivePath' })
  })

  it('replaces manual Visual Size with one composition-level Show Size whenever a show is selected', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({ selectedShowId: 'radialPressureSystem', autoPerformance: false })
    await act(async () => root.render(<ReactEnginePanel />))

    const showSizeRows = [...container.querySelectorAll('.rv-ctrl-row')]
      .filter(row => row.textContent?.includes('Show Size'))
    expect(showSizeRows).toHaveLength(1)
    expect(container.textContent).not.toContain('Visual Size')

    const input = showSizeRows[0].querySelector<HTMLInputElement>('input[type="range"]')!
    await act(async () => {
      input.value = '1.4'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(useReactStore.getState().oscillatorSettings.pathScale).toBeCloseTo(1.4)
  })

  it('safely normalizes manual and authored size values', () => {
    useReactStore.getState().setOscillatorSettings({ pathScale: 99 })
    expect(useReactStore.getState().oscillatorSettings.pathScale).toBe(2.5)
    useReactStore.getState().setOscillatorSettings({ pathScale: Number.NaN })
    expect(useReactStore.getState().oscillatorSettings.pathScale).toBe(DEFAULT_OSCILLATOR_SETTINGS.pathScale)
  })

  it('keeps the duplicate size control out of the FX panel', async () => {
    await act(async () => root.render(<ReactFxPanel />))
    expect(container.textContent).not.toContain('Visual Size')
    expect(container.textContent).not.toContain('Show Size')
  })
})

describe('Sound Drawing contextual help clean reset', () => {
  it('renders the authored-performance controls without any help triggers or injected slots', async () => {
    useReactStore.getState().setSoundDrawingPerformanceSettings({
      selectedShowId: 'phaseOrbit',
      autoPerformance: true,
      complexity: 0.7,
    })
    await act(async () => root.render(<ReactEnginePanel />))

    expect(container.textContent).toContain('Performance Show')
    expect(container.textContent).toContain('Auto Performance')
    expect(container.textContent).toContain('Complexity')
    expect(container.querySelector('.drm-help-info-trigger')).toBeNull()
    expect(container.querySelector('.drm-priority-help-slot')).toBeNull()
    expect(document.body.querySelector('.drm-info-popover')).toBeNull()
  })

  it('keeps the Auto Performance toggle disabled until a show is selected without a help-only accessory hotspot', async () => {
    await act(async () => root.render(<ReactEnginePanel />))

    const label = Array.from(container.querySelectorAll('.rv-ctrl-label'))
      .find(element => element.textContent === 'Auto Performance')
    const row = label?.closest('.rv-ctrl-toggle-row')
    const toggle = row?.querySelector<HTMLButtonElement>('.rv-ctrl-toggle')

    expect(toggle?.disabled).toBe(true)
    expect(row?.classList.contains('rv-ctrl-toggle-row--interactive-accessory')).toBe(false)
    expect(row?.querySelector('button[aria-haspopup="dialog"]')).toBeNull()
  })
})
