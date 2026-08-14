// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import {
  HeadlinerDesignPanel,
  HeadlinerOutputPanel,
  HeadlinerPresetsPanel,
  HeadlinerReactivityPanel,
  HeadlinerSurface,
} from './HeadlinerWorkspace'

vi.mock('../../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ currentAudioTrackId: null }),
}))

vi.mock('../ReactAudioPanel', () => ({
  ReactAudioPanel: () => <div data-headliner-shared-analysis="true">Shared Music Analysis</div>,
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
  useReactStore.getState().selectReactEngine('headliner')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('Headliner Stage 1 production workspace controls', () => {
  it('enters through canonical Headliner selection and renders only Fullscreen/default front camera controls', async () => {
    await act(async () => root.render(<ReactEnginePanel />))

    expect(useReactStore.getState().activeReactEngineId).toBe('headliner')
    expect(container.textContent).toContain('Engine Mode')
    expect(container.textContent).toContain('Fullscreen')
    expect(container.textContent).toContain('Input Source')
    expect(container.textContent).toContain('Default Front Camera')

    const modeButtons = container.querySelectorAll<HTMLButtonElement>('[aria-label="Headliner engine modes"] .rv-sound-source-card')
    expect(modeButtons).toHaveLength(1)
    expect(modeButtons[0].getAttribute('aria-pressed')).toBe('true')

    const cameraTrigger = container.querySelector<HTMLButtonElement>('#headliner-input-source')
    expect(cameraTrigger).not.toBeNull()
    expect(cameraTrigger?.textContent).toContain('Default Front Camera')
  })

  it('owns a resource-free stage boundary rather than starting camera capture in Stage 1', async () => {
    const onCanvasReady = vi.fn()
    const onLiveFps = vi.fn()

    await act(async () => root.render(
      <HeadlinerSurface onCanvasReady={onCanvasReady} onLiveFps={onLiveFps} />,
    ))

    expect(container.querySelector('[data-headliner-surface="foundation"]')).not.toBeNull()
    expect(container.textContent).toContain('Camera not started')
    expect(onCanvasReady).toHaveBeenCalledWith(null)
    expect(onLiveFps).toHaveBeenCalledWith(0)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('keeps unfinished Presets, Design, and Output surfaces restrained and Headliner-specific', async () => {
    await act(async () => root.render(<HeadlinerPresetsPanel />))
    expect(container.textContent).toContain('Headliner presets coming later')
    expect(container.querySelector('input[type="range"]')).toBeNull()

    await act(async () => root.render(<HeadlinerDesignPanel />))
    expect(container.textContent).toContain('Camera design controls are not available yet')
    expect(container.querySelector('input[type="range"]')).toBeNull()

    await act(async () => root.render(<HeadlinerOutputPanel />))
    expect(container.textContent).toContain('Headliner output is not connected yet')
    expect(container.querySelector('input[type="range"]')).toBeNull()

    await act(async () => root.render(<HeadlinerReactivityPanel />))
    expect(container.textContent).toContain('Headliner-specific reactions are not authored yet')
    expect(container.querySelector('[data-headliner-shared-analysis="true"]')).not.toBeNull()
  })
})
