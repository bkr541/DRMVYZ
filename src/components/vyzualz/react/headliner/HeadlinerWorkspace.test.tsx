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


class FakeHeadlinerTrack extends EventTarget {
  readonly kind = 'video'
  stop = vi.fn()
}

class FakeHeadlinerStream {
  constructor(readonly track: FakeHeadlinerTrack) {}
  getTracks = () => [this.track] as unknown as MediaStreamTrack[]
  getVideoTracks = () => [this.track] as unknown as MediaStreamTrack[]
  getAudioTracks = () => [] as MediaStreamTrack[]
}

function installHeadlinerCamera(streamOrError: MediaStream | DOMException) {
  const getUserMedia = streamOrError instanceof DOMException
    ? vi.fn(async () => { throw streamOrError })
    : vi.fn(async () => streamOrError)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  return getUserMedia
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
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

describe('Headliner production workspace controls', () => {
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

  it('requests the default front camera through the production Headliner surface and releases it on exit', async () => {
    const track = new FakeHeadlinerTrack()
    const stream = new FakeHeadlinerStream(track) as unknown as MediaStream
    const getUserMedia = installHeadlinerCamera(stream)
    const onCanvasReady = vi.fn()
    const onLiveFps = vi.fn()

    await act(async () => root.render(
      <HeadlinerSurface onCanvasReady={onCanvasReady} onLiveFps={onLiveFps} />,
    ))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const surface = container.querySelector<HTMLElement>('[data-headliner-surface="camera"]')
    const video = container.querySelector<HTMLVideoElement>('video[aria-label="Default Front Camera"]')
    expect(surface?.dataset.headlinerCameraStatus).toBe('requesting')
    expect(video).not.toBeNull()
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'user' } },
    })

    await act(async () => video?.dispatchEvent(new Event('loadeddata')))
    expect(surface?.dataset.headlinerCameraStatus).toBe('live')
    expect(container.textContent).not.toContain('Camera not started')
    expect(onCanvasReady).toHaveBeenCalledWith(null)
    expect(onLiveFps).toHaveBeenCalledWith(0)
    expect(container.querySelector('canvas')).toBeNull()

    await act(async () => root.unmount())
    expect(track.stop).toHaveBeenCalledTimes(1)
    root = createRoot(container)
  })

  it('shows a contained permission-denied state instead of a fake active camera', async () => {
    installHeadlinerCamera(new DOMException('denied', 'NotAllowedError'))

    await act(async () => root.render(<HeadlinerSurface />))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const surface = container.querySelector<HTMLElement>('[data-headliner-surface="camera"]')
    expect(surface?.dataset.headlinerCameraStatus).toBe('error')
    expect(container.textContent).toContain('Camera permission denied')
    expect(container.textContent).toContain('Camera permission was denied')
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
