// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'

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
