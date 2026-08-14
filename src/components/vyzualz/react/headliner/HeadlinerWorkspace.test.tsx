// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recorder } from '../../../../hooks/useRecorder'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import { ReactOutputWorkspacePanel } from '../panels/ReactWorkspacePanels'
import {
  HeadlinerDesignPanel,
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

const recorder: Recorder = {
  recorderState: 'idle',
  recordingMode: null,
  recordingTime: 0,
  recorderError: null,
  fps: 30,
  setFps: vi.fn(),
  startVideoRecording: vi.fn(),
  stopRecording: vi.fn(),
  exportRingBuffer: vi.fn(),
  exportPNG: vi.fn(),
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()
let resizeObservers: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }>
let drawImage: ReturnType<typeof vi.fn>
let fillRect: ReturnType<typeof vi.fn>

function runNextFrame(timestamp: number) {
  const entry = rafCallbacks.entries().next().value as [number, FrameRequestCallback] | undefined
  if (!entry) throw new Error('No Headliner RAF was scheduled')
  const [id, callback] = entry
  rafCallbacks.delete(id)
  callback(timestamp)
}

beforeEach(() => {
  nextRafId = 1
  rafCallbacks = new Map()
  resizeObservers = []
  drawImage = vi.fn()
  fillRect = vi.fn()

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this,
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      drawImage,
      fillRect,
    } as unknown as CanvasRenderingContext2D
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 640,
    width: 640,
    height: 640,
    toJSON: () => ({}),
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
    rafCallbacks.delete(id)
  }))
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    disconnect = vi.fn()
    constructor(_callback: ResizeObserverCallback) {
      resizeObservers.push(this)
    }
  })

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
  vi.unstubAllGlobals()
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

  it('renders the default front camera through one fullscreen program canvas and releases the loop/source on exit', async () => {
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
    const video = container.querySelector<HTMLVideoElement>('video.rv-headliner-camera-video')
    const canvas = container.querySelector<HTMLCanvasElement>('[data-headliner-output-canvas="true"]')
    expect(surface?.dataset.headlinerCameraStatus).toBe('requesting')
    expect(video).not.toBeNull()
    expect(canvas).not.toBeNull()
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'user' } },
    })
    expect(onCanvasReady).toHaveBeenCalledWith(canvas)
    expect(onLiveFps).toHaveBeenCalledWith(0)
    expect(rafCallbacks.size).toBe(1)
    expect(resizeObservers).toHaveLength(1)

    Object.defineProperties(video!, {
      readyState: { configurable: true, value: 2 },
      videoWidth: { configurable: true, value: 1280 },
      videoHeight: { configurable: true, value: 720 },
    })
    await act(async () => video?.dispatchEvent(new Event('loadeddata')))
    expect(surface?.dataset.headlinerCameraStatus).toBe('live')

    act(() => runNextFrame(16))
    expect(fillRect).toHaveBeenCalledWith(0, 0, 640, 640)
    expect(drawImage).toHaveBeenCalledWith(
      video,
      280,
      0,
      720,
      720,
      0,
      0,
      640,
      640,
    )
    expect(canvas?.dataset.headlinerOutputRendered).toBe('true')
    expect(rafCallbacks.size).toBe(1)

    let timestamp = 16
    for (let index = 0; index < 8; index += 1) {
      timestamp += 48
      act(() => runNextFrame(timestamp))
      expect(rafCallbacks.size).toBe(1)
    }
    expect(canvas?.width).toBe(544)
    expect(canvas?.height).toBe(544)

    drawImage.mockImplementationOnce(() => { throw new DOMException('frame unavailable', 'InvalidStateError') })
    act(() => runNextFrame(timestamp + 16))
    expect(canvas?.dataset.headlinerOutputRendered).toBeUndefined()
    expect(rafCallbacks.size).toBe(1)

    await act(async () => root.unmount())
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(rafCallbacks.size).toBe(0)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
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
    expect(container.querySelector('[data-headliner-output-rendered="true"]')).toBeNull()
  })

  it('keeps Presets, Design, and React restrained while shared Output uses the compositor canvas', async () => {
    await act(async () => root.render(<HeadlinerPresetsPanel />))
    expect(container.textContent).toContain('Headliner presets coming later')
    expect(container.querySelector('input[type="range"]')).toBeNull()

    await act(async () => root.render(<HeadlinerDesignPanel />))
    expect(container.textContent).toContain('Camera design controls are not available yet')
    expect(container.querySelector('input[type="range"]')).toBeNull()

    await act(async () => root.render(<HeadlinerReactivityPanel />))
    expect(container.textContent).toContain('Headliner-specific reactions are not authored yet')
    expect(container.querySelector('[data-headliner-shared-analysis="true"]')).not.toBeNull()

    const canvas = document.createElement('canvas')
    await act(async () => root.render(
      <ReactOutputWorkspacePanel
        canvas={canvas}
        outputCapability={{ status: 'available' }}
        recorder={recorder}
        liveFps={60}
        hasActiveProgramAudio={false}
        onStartRecording={vi.fn()}
        showCastControl
      />,
    ))
    expect(container.textContent).toContain('Fullscreen program output')
    expect(container.textContent).toContain('shared recording and casting source')
    expect(container.querySelector('button[aria-label="Cast visual output"]')).not.toBeNull()
    expect(container.textContent).toContain('RECORDING')
    expect(container.querySelector<HTMLButtonElement>('.vz-rec-start-btn')?.disabled).toBe(false)
  })
})
