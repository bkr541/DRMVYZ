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
})
