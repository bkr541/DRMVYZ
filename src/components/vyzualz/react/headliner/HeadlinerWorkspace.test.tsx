// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recorder } from '../../../../hooks/useRecorder'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEnginePanel } from '../ReactEnginePanel'
import { ReactOutputWorkspacePanel } from '../panels/ReactWorkspacePanels'
import { setHeadlinerCameraWanted } from './HeadlinerCameraSession'
import {
  HeadlinerDesignPanel,
  HeadlinerEnginePanel,
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
  readyState: MediaStreamTrackState = 'live'
  muted = false
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
let fillText: ReturnType<typeof vi.fn>

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
  fillText = vi.fn()

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return {
      canvas: this,
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: true,
      drawImage,
      fillRect,
      fillText,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
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

  // The camera is only on automatically once the user has connected it this session.
  setHeadlinerCameraWanted(true)
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

    // Fullscreen is the only working mode; the other three cells of the 2x2 grid are inert placeholders.
    const modeButtons = container.querySelectorAll<HTMLButtonElement>('[aria-label="Headliner engine modes"] .rv-sound-source-card')
    expect(modeButtons).toHaveLength(4)
    expect(modeButtons[0].getAttribute('aria-pressed')).toBe('true')
    expect([...modeButtons].slice(1).every(button => button.disabled)).toBe(true)

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
    expect(canvas?.dataset.headlinerOutputRendered).toBe('true')
    expect(canvas?.dataset.headlinerOutputState).toBe('live')
    expect(rafCallbacks.size).toBe(1)

    track.readyState = 'ended'
    await act(async () => track.dispatchEvent(new Event('ended')))
    expect(surface?.dataset.headlinerCameraStatus).toBe('disconnected')
    const videoDrawsBeforeLostTick = drawImage.mock.calls.filter(call => call[0] === video).length
    act(() => runNextFrame(timestamp + 5_000))
    expect(canvas?.dataset.headlinerOutputRendered).toBe('true')
    expect(canvas?.dataset.headlinerOutputState).toBe('lost')
    expect(fillText).toHaveBeenCalledWith('Connection Lost', 272, 272, 446.08)
    expect(drawImage.mock.calls.filter(call => call[0] === video)).toHaveLength(videoDrawsBeforeLostTick)
    expect(canvas?.width).toBe(544)
    expect(canvas?.height).toBe(544)
    expect(rafCallbacks.size).toBe(1)

    const lostDrawCalls = drawImage.mock.calls.length
    const lostTextCalls = fillText.mock.calls.length
    act(() => runNextFrame(timestamp + 5_016))
    expect(drawImage).toHaveBeenCalledTimes(lostDrawCalls)
    expect(fillText).toHaveBeenCalledTimes(lostTextCalls)
    expect(canvas?.dataset.headlinerOutputState).toBe('lost')

    await act(async () => root.unmount())
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(resizeObservers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(rafCallbacks.size).toBe(0)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    root = createRoot(container)
  })

  it('keeps the frozen program canvas through track loss and resumes one live stream/RAF after bounded recovery', async () => {
    // Leave requestAnimationFrame alone: this file drives frames by hand through its own stub.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    try {
      const firstTrack = new FakeHeadlinerTrack()
      const secondTrack = new FakeHeadlinerTrack()
      const firstStream = new FakeHeadlinerStream(firstTrack) as unknown as MediaStream
      const secondStream = new FakeHeadlinerStream(secondTrack) as unknown as MediaStream
      const getUserMedia = vi.fn()
        .mockResolvedValueOnce(firstStream)
        .mockResolvedValueOnce(secondStream)
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia },
      })

      await act(async () => root.render(<HeadlinerSurface />))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      const surface = container.querySelector<HTMLElement>('[data-headliner-surface="camera"]')
      const video = container.querySelector<HTMLVideoElement>('video.rv-headliner-camera-video')
      const canvas = container.querySelector<HTMLCanvasElement>('[data-headliner-output-canvas="true"]')
      Object.defineProperties(video!, {
        readyState: { configurable: true, value: 2 },
        videoWidth: { configurable: true, value: 1280 },
        videoHeight: { configurable: true, value: 720 },
      })
      await act(async () => video?.dispatchEvent(new Event('loadeddata')))
      act(() => runNextFrame(16))
      expect(surface?.dataset.headlinerCameraStatus).toBe('live')
      expect(canvas?.dataset.headlinerOutputState).toBe('live')
      expect(rafCallbacks.size).toBe(1)

      firstTrack.readyState = 'ended'
      await act(async () => firstTrack.dispatchEvent(new Event('ended')))
      act(() => runNextFrame(32))
      expect(surface?.dataset.headlinerCameraStatus).toBe('disconnected')
      expect(canvas?.dataset.headlinerOutputState).toBe('lost')
      expect(getUserMedia).toHaveBeenCalledTimes(1)
      expect(rafCallbacks.size).toBe(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(750)
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(getUserMedia).toHaveBeenCalledTimes(2)
      expect(video?.srcObject).toBe(secondStream)
      expect(surface?.dataset.headlinerCameraStatus).toBe('disconnected')
      expect(rafCallbacks.size).toBe(1)

      await act(async () => video?.dispatchEvent(new Event('loadeddata')))
      act(() => runNextFrame(48))
      expect(surface?.dataset.headlinerCameraStatus).toBe('live')
      expect(canvas?.dataset.headlinerOutputState).toBe('live')
      expect(rafCallbacks.size).toBe(1)
      expect(firstTrack.stop).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
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
    // Permission problems raise a dialog (not a notification card) that offers a retry.
    const dialog = container.querySelector('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('Camera Access Needed')
    expect(dialog?.textContent).toContain('Camera access was blocked')
    expect(dialog?.textContent).toContain('Try again')
    expect(container.querySelector('.dv-notice')).toBeNull()
    act(() => runNextFrame(16))
    const canvas = container.querySelector<HTMLCanvasElement>('[data-headliner-output-canvas="true"]')
    expect(canvas?.dataset.headlinerOutputRendered).toBe('true')
    expect(canvas?.dataset.headlinerOutputState).toBe('neutral')
    expect(fillText).toHaveBeenCalledWith('Camera Permission Required', 320, 320, 524.8)
  })

  it('does not open the camera on a fresh launch, and opens it when the user connects, then keeps it across engine switches', async () => {
    setHeadlinerCameraWanted(false)
    const track = new FakeHeadlinerTrack()
    const getUserMedia = installHeadlinerCamera(new FakeHeadlinerStream(track) as unknown as MediaStream)

    await act(async () => root.render(<><HeadlinerSurface /><HeadlinerEnginePanel /></>))
    await act(async () => { await Promise.resolve() })
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(container.querySelector('[data-headliner-surface="camera"]')?.getAttribute('data-headliner-camera-status')).toBe('idle')
    const connect = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Connect Camera')
    expect(connect()).toBeDefined()

    await act(async () => connect()?.click())
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(getUserMedia).toHaveBeenCalledTimes(1)

    // Leaving Headliner and coming back in the same session reopens the camera by itself.
    await act(async () => root.render(<div />))
    await act(async () => root.render(<HeadlinerSurface />))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('lists the three effect presets and loads the one that is picked', async () => {
    await act(async () => root.render(<HeadlinerPresetsPanel />))
    const ids = [...container.querySelectorAll<HTMLElement>('[data-headliner-preset-id]')].map(card => card.dataset.headlinerPresetId)
    expect(ids).toEqual(['motion-echo', 'ghost-trails', 'velocity-smear'])
    expect(useReactStore.getState().headlinerSettings.presetId).toBe('motion-echo')

    await act(async () => container.querySelector<HTMLElement>('[data-headliner-preset-id="ghost-trails"]')?.click())
    expect(useReactStore.getState().headlinerSettings.presetId).toBe('ghost-trails')
  })

  it('fills the four Design groups from the active preset, with Master Intensity and BPM Sync in Master Controls', async () => {
    await act(async () => root.render(<HeadlinerDesignPanel />))
    const groups = container.querySelector('[data-headliner-design-groups]')
    const text = groups?.textContent ?? ''
    const order = ['Master Controls', 'Design', 'Effects', 'Palette'].map(label => text.indexOf(label))
    expect(order.every(index => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // Master Controls comes first and holds the two standard controls.
    const master = text.slice(order[0], order[1])
    expect(master).toContain('Master Intensity')
    expect(master).toContain('BPM Sync')
    expect(text).toContain('Echo Count')
    expect(container.querySelectorAll('input[type="range"]').length).toBeGreaterThan(5)
  })

  it('swaps Echo Spacing for Echo Delay when BPM Sync is turned off, and resets to the preset defaults', async () => {
    await act(async () => root.render(<HeadlinerDesignPanel />))
    expect(container.textContent).toContain('Echo Spacing')
    expect(container.textContent).not.toContain('Echo Delay')

    const sync = container.querySelector<HTMLElement>('#headliner-parameter-bpmSync')
    await act(async () => sync?.click())
    expect(useReactStore.getState().headlinerSettings.parameters['motion-echo']).toMatchObject({ bpmSync: false })
    expect(container.textContent).toContain('Echo Delay')
    expect(container.textContent).not.toContain('Echo Spacing')

    const reset = [...container.querySelectorAll('button')].find(button => button.textContent === 'Reset Parameters')
    await act(async () => reset?.click())
    expect(useReactStore.getState().headlinerSettings.parameters['motion-echo']).toBeUndefined()
    expect(container.textContent).toContain('Echo Spacing')
  })

  it('keeps React restrained while shared Output uses the compositor canvas', async () => {
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
      />,
    ))
    expect(container.textContent).not.toContain('Fullscreen program output')
    expect(container.textContent).toContain('RECORDING')
    expect([...container.querySelectorAll<HTMLButtonElement>('[data-recording-panel] button')].find(button => button.textContent?.includes('Start Recording'))?.disabled).toBe(false)
  })
})
