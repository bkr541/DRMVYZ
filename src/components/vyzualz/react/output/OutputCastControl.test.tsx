// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeOutputBridge, OutputCastRequest, OutputCastSession, OutputReceiverRequest, OutputTarget } from '../../../../native/outputBridge'
import { CANVAS_FRACTURES_OUTPUT_DEFERRED } from '../canvasFracturesOutputContract'
import { OutputCastControl } from './OutputCastControl'

const targets: OutputTarget[] = [
  {
    id: 'display:2',
    kind: 'display',
    name: 'Stage Screen',
    detail: '1920 × 1080',
    available: true,
  },
  {
    id: 'receiver:lan-stage-01:display:stage-led',
    kind: 'network',
    name: 'Booth Mac · DRMVYZ — Stage LED',
    detail: '2560 × 1440 · Pair on first use',
    available: true,
    receiverId: 'lan-stage-01',
    receiverDisplayId: 'stage-led',
    receiverDisplayName: 'Stage LED',
    receiverPaired: false,
    receiverProtocolVersion: 2,
  },
  {
    id: 'receiver:lan-stage-01:display:preview',
    kind: 'network',
    name: 'Booth Mac · DRMVYZ — Preview',
    detail: '1920 × 1080 · Primary · Paired',
    available: true,
    receiverId: 'lan-stage-01',
    receiverDisplayId: 'preview',
    receiverDisplayName: 'Preview',
    receiverPaired: true,
    receiverProtocolVersion: 2,
  },
]

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let startCast: ReturnType<typeof vi.fn>
let stopCast: ReturnType<typeof vi.fn>
let performProviderAction: ReturnType<typeof vi.fn>
let bridge: NativeOutputBridge
let canvas: HTMLCanvasElement
let receiverRequested: ((request: OutputReceiverRequest) => void) | null
let sessionChanged: ((session: OutputCastSession | null) => void) | null
let beginGoogleCastStream: ReturnType<typeof vi.fn>
let publishGoogleCastChunk: ReturnType<typeof vi.fn>
let endGoogleCastStream: ReturnType<typeof vi.fn>

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

beforeEach(async () => {
  receiverRequested = null
  sessionChanged = null
  beginGoogleCastStream = vi.fn(async () => ({ ok: true, mediaUrls: ['http://192.168.1.2/live'] }))
  publishGoogleCastChunk = vi.fn(async () => true)
  endGoogleCastStream = vi.fn(async () => true)
  startCast = vi.fn(async (request: OutputCastRequest) => ({
    id: 'session-1',
    targetId: request.targetId,
    targetName: 'Stage Screen',
    windowMode: request.windowMode,
    aspectRatio: request.aspectRatio,
    state: 'connecting' as const,
    error: null,
  }))
  stopCast = vi.fn(async () => null)
  performProviderAction = vi.fn(async (providerId: string, actionId: string) => ({
    providerId,
    actionId,
    state: 'opened',
    message: 'macOS display controls opened.',
  }))
  bridge = {
    listTargets: vi.fn(async () => targets),
    getTargetSnapshot: vi.fn(async () => ({
      targets,
      providers: [
        { providerId: 'local-display', label: 'Connected displays', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'airplay', label: 'AirPlay / Wireless Displays', state: 'available', targetCount: 0, message: null, capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'miracast', label: 'Windows Wireless Displays', state: 'unsupported', targetCount: 0, message: 'Windows only.', capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'drmvyz-receiver', label: 'DRMVYZ Receivers', state: 'available', targetCount: 2, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'google-cast', label: 'Google Cast', state: 'configuration-required', targetCount: 0, message: 'Google Cast deployment configuration is missing.', capabilities: { targetEnumeration: false, sessions: true, picker: true, actions: ['open-picker'] } },
      ],
    })),
    getSession: vi.fn(async () => null),
    performProviderAction,
    startCast,
    stopCast,
    publishOffer: vi.fn(async () => true),
    waitForAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'answer' })),
    failSession: vi.fn(async () => true),
    beginGoogleCastStream,
    publishGoogleCastChunk,
    endGoogleCastStream,
    reportStats: vi.fn(async () => true),
    onTargetsChanged: vi.fn(() => () => {}),
    onSessionChanged: vi.fn((callback: (session: OutputCastSession | null) => void) => {
      sessionChanged = callback
      return () => { if (sessionChanged === callback) sessionChanged = null }
    }),
    onReceiverRequested: vi.fn((callback: (request: OutputReceiverRequest) => void) => {
      receiverRequested = callback
      return () => { if (receiverRequested === callback) receiverRequested = null }
    }),
  }
  window.drmvyzNative = {
    runtime: { isElectron: true, platform: 'darwin' },
    output: bridge,
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  await act(async () => root.render(<OutputCastControl canvas={canvas} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.querySelector('.rv-cast-popover')?.remove()
  delete window.drmvyzNative
  vi.restoreAllMocks()
})

describe('OutputCastControl', () => {
  it('places casting behind the visualizer icon and requires window and aspect selections', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Cast Output')
    expect(dialog?.classList.contains('rv-cast-popover')).toBe(true)
    expect(dialog?.getAttribute('aria-modal')).toBeNull()
    expect(document.body.querySelector('.rv-cast-overlay')).toBeNull()
    const device = buttonWithText('Stage Screen')
    expect(device.disabled).toBe(true)

    await act(async () => buttonWithText('Full Screen').click())
    expect(device.disabled).toBe(true)
    await act(async () => buttonWithText('16:9').click())
    expect(device.disabled).toBe(false)

    await act(async () => device.click())
    expect(startCast).toHaveBeenCalledWith({
      targetId: 'display:2',
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
  })

  it('shows discovered network receivers in the same chooser', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.textContent).toContain('Booth Mac · DRMVYZ — Stage LED')
    expect(document.body.textContent).toContain('Booth Mac · DRMVYZ — Preview')
    expect(document.body.textContent).toContain('Pair & Cast')
    expect(document.body.textContent).toContain('Wireless Displays')
    expect(document.body.textContent).toContain('Local Displays')
    expect(document.body.textContent).toContain('DRMVYZ Receivers')
  })


  it('reuses one relay capture while renderer transitions replace the canonical output canvas', async () => {
    const originalCaptureStream = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'captureStream')
    const originalPeer = globalThis.RTCPeerConnection
    const drawImage = vi.fn()
    const captureStream = vi.fn()
    let animationFrame: FrameRequestCallback | null = null
    const track = {
      kind: 'video',
      contentHint: '',
      stop: vi.fn(),
      applyConstraints: vi.fn(async () => undefined),
    }
    const stream = {
      getVideoTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream
    captureStream.mockReturnValue(stream)

    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: captureStream })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      fillRect: vi.fn(),
      fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrame = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    class FakePeerConnection {
      iceGatheringState: RTCIceGatheringState = 'complete'
      connectionState: RTCPeerConnectionState = 'connected'
      localDescription: RTCSessionDescription | null = null
      addEventListener = vi.fn()
      removeEventListener = vi.fn()
      close = vi.fn()
      addTrack = vi.fn(() => ({
        track,
        getParameters: () => ({ encodings: [{}] }),
        setParameters: async () => undefined,
      } as unknown as RTCRtpSender))
      createOffer = async () => ({ type: 'offer' as RTCSdpType, sdp: 'offer-sdp' })
      setLocalDescription = async (description: RTCSessionDescriptionInit) => {
        this.localDescription = { ...description, toJSON: () => description } as RTCSessionDescription
      }
      setRemoteDescription = async () => undefined
      getStats = async () => new Map() as unknown as RTCStatsReport
    }
    Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: FakePeerConnection })

    try {
      await act(async () => {
        receiverRequested?.({ sessionId: 'renderer-transition-session' })
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(captureStream).toHaveBeenCalledTimes(1)
      expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1280, 720)

      const nextCanvas = document.createElement('canvas')
      nextCanvas.width = 1920
      nextCanvas.height = 1080
      await act(async () => root.render(<OutputCastControl canvas={nextCanvas} />))
      const nextAnimationFrame = animationFrame as FrameRequestCallback | null
      nextAnimationFrame?.(performance.now())

      expect(captureStream).toHaveBeenCalledTimes(1)
      expect(drawImage).toHaveBeenLastCalledWith(nextCanvas, 0, 0, 1920, 1080)
    } finally {
      if (originalCaptureStream) Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', originalCaptureStream)
      else Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
      Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: originalPeer })
    }
  })


  it('shows Google Cast as explicit configuration-required setup instead of an empty receiver list', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('Google Cast')
    expect(document.body.textContent).toContain('Configure the Cast receiver app ID and HTTPS sender companion first.')
    const picker = buttonWithText('Choose Google Cast Device')
    expect(picker.disabled).toBe(true)
    expect(document.body.textContent).toContain('Google Cast deployment configuration is missing.')
  })

  it('dispatches Google Cast picker through the provider action with current output choices', async () => {
    bridge.getTargetSnapshot = vi.fn(async () => ({
      targets,
      providers: [
        { providerId: 'local-display', label: 'Connected displays', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'google-cast', label: 'Google Cast', state: 'available', targetCount: 0, message: null, capabilities: { targetEnumeration: false, sessions: true, picker: true, actions: ['open-picker'] } },
        { providerId: 'drmvyz-receiver', label: 'DRMVYZ Receivers', state: 'available', targetCount: 2, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
      ],
    }))
    await act(async () => {
      await (bridge.getTargetSnapshot?.())
      const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
      trigger?.click()
      await Promise.resolve()
    })
    // Re-open forces the component refresh path to read the updated provider snapshot.
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    if (!document.body.querySelector('[role="dialog"]')) await act(async () => trigger?.click())
    await act(async () => buttonWithText('Full Screen').click())
    await act(async () => buttonWithText('16:9').click())
    const picker = buttonWithText('Choose Google Cast Device')
    expect(picker.disabled).toBe(false)
    await act(async () => picker.click())

    expect(performProviderAction).toHaveBeenCalledWith('google-cast', 'open-picker', {
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
    expect(startCast).not.toHaveBeenCalled()
  })

  it('keeps one Google Cast encoder relay across session-state and canonical-canvas replacement', async () => {
    const originalCaptureStream = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'captureStream')
    const originalMediaRecorder = globalThis.MediaRecorder
    const drawImage = vi.fn()
    const captureStream = vi.fn()
    let animationFrame: FrameRequestCallback | null = null
    const track = {
      kind: 'video',
      contentHint: '',
      stop: vi.fn(),
      applyConstraints: vi.fn(async () => undefined),
      getSettings: () => ({ width: 1280, height: 720, frameRate: 30 }),
    }
    const stream = {
      getVideoTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream
    captureStream.mockReturnValue(stream)

    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported = vi.fn(() => true)
      state: RecordingState = 'inactive'
      mimeType = 'video/webm;codecs=vp8'
      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
        super()
      }
      start = vi.fn(() => { this.state = 'recording' })
      stop = vi.fn(() => { this.state = 'inactive' })
      pause = vi.fn()
      resume = vi.fn()
      requestData = vi.fn()
      ondataavailable: ((this: MediaRecorder, ev: BlobEvent) => unknown) | null = null
      onerror: ((this: MediaRecorder, ev: Event) => unknown) | null = null
      onpause: ((this: MediaRecorder, ev: Event) => unknown) | null = null
      onresume: ((this: MediaRecorder, ev: Event) => unknown) | null = null
      onstart: ((this: MediaRecorder, ev: Event) => unknown) | null = null
      onstop: ((this: MediaRecorder, ev: Event) => unknown) | null = null
      audioBitsPerSecond = 0
      videoBitsPerSecond = 6_000_000
      stream = stream
    }

    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: captureStream })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      fillRect: vi.fn(),
      fillStyle: '#000',
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrame = callback
      return 7
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder })

    const castSession: OutputCastSession = {
      id: 'google-cast-session',
      targetId: 'google-cast:transaction',
      targetName: 'Studio TV',
      providerId: 'google-cast',
      transport: 'google-cast-webm',
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
      state: 'connecting',
      error: null,
    }

    try {
      await act(async () => {
        sessionChanged?.(castSession)
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(captureStream).toHaveBeenCalledTimes(1)
      expect(beginGoogleCastStream).toHaveBeenCalledTimes(1)
      expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1280, 720)

      await act(async () => {
        sessionChanged?.({ ...castSession, state: 'connected' })
        await Promise.resolve()
      })
      expect(captureStream).toHaveBeenCalledTimes(1)
      expect(beginGoogleCastStream).toHaveBeenCalledTimes(1)

      const nextCanvas = document.createElement('canvas')
      nextCanvas.width = 1920
      nextCanvas.height = 1080
      await act(async () => root.render(<OutputCastControl canvas={nextCanvas} />))
      const nextAnimationFrame = animationFrame as FrameRequestCallback | null
      nextAnimationFrame?.(performance.now())
      expect(captureStream).toHaveBeenCalledTimes(1)
      expect(drawImage).toHaveBeenLastCalledWith(nextCanvas, 0, 0, 1280, 720)
    } finally {
      if (originalCaptureStream) Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', originalCaptureStream)
      else Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
      Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: originalMediaRecorder })
    }
  })

  it('fails the managed Google Cast session when the Chromium encoder cannot start', async () => {
    const originalCaptureStream = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'captureStream')
    const originalMediaRecorder = globalThis.MediaRecorder
    const track = { kind: 'video', stop: vi.fn(), applyConstraints: vi.fn(async () => undefined), getSettings: () => ({}) }
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
      configurable: true,
      value: vi.fn(() => ({ getVideoTracks: () => [track], getTracks: () => [track] })),
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '#000' } as unknown as CanvasRenderingContext2D)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class {
        static isTypeSupported() { return true }
        constructor() { throw new Error('Encoder initialization exploded') }
      },
    })

    try {
      await act(async () => {
        sessionChanged?.({
          id: 'encoder-failure-session',
          targetId: 'google-cast:failure',
          targetName: 'Studio TV',
          providerId: 'google-cast',
          transport: 'google-cast-webm',
          windowMode: 'fullscreen',
          aspectRatio: '16:9',
          state: 'connecting',
          error: null,
        })
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(bridge.failSession).toHaveBeenCalledWith('encoder-failure-session', 'Encoder initialization exploded')
      expect(beginGoogleCastStream).not.toHaveBeenCalled()
      expect(track.stop).toHaveBeenCalledTimes(1)
    } finally {
      if (originalCaptureStream) Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', originalCaptureStream)
      else Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream')
      Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: originalMediaRecorder })
    }
  })

  it('exposes macOS wireless-display selection as a provider action without starting a cast session', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('AirPlay / Wireless Displays')
    await act(async () => buttonWithText('Open macOS Displays').click())

    expect(performProviderAction).toHaveBeenCalledWith('airplay', 'open-system-picker')
    expect(startCast).not.toHaveBeenCalled()
  })


  it('exposes Windows wireless-display selection through the same provider-action contract', async () => {
    bridge.getTargetSnapshot = vi.fn(async () => ({
      targets,
      providers: [
        { providerId: 'local-display', label: 'Connected displays', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'airplay', label: 'AirPlay / Wireless Displays', state: 'unsupported', targetCount: 0, message: 'macOS only.', capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'miracast', label: 'Windows Wireless Displays', state: 'available', targetCount: 0, message: null, capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'drmvyz-receiver', label: 'DRMVYZ Receivers', state: 'available', targetCount: 2, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
      ],
    }))

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('Windows Wireless Displays')
    await act(async () => buttonWithText('Open Windows Displays').click())

    expect(performProviderAction).toHaveBeenCalledWith('miracast', 'open-system-picker')
    expect(startCast).not.toHaveBeenCalled()
  })


  it('rejects a cast that finishes starting after output becomes deferred', async () => {
    let resolveStartCast: ((session: OutputCastSession) => void) | null = null
    startCast.mockImplementation((request: OutputCastRequest) => new Promise<OutputCastSession>((resolve) => {
      resolveStartCast = resolve
      expect(request.targetId).toBe('display:2')
    }))

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    await act(async () => buttonWithText('Full Screen').click())
    await act(async () => buttonWithText('16:9').click())
    await act(async () => buttonWithText('Stage Screen').click())

    await act(async () => root.render(
      <OutputCastControl canvas={canvas} capability={CANVAS_FRACTURES_OUTPUT_DEFERRED} />,
    ))
    stopCast.mockClear()

    await act(async () => {
      resolveStartCast?.({
        id: 'late-session',
        targetId: 'display:2',
        targetName: 'Stage Screen',
        windowMode: 'fullscreen',
        aspectRatio: '16:9',
        state: 'connecting',
        error: null,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(stopCast).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Fractures cast unavailable"]')?.disabled).toBe(true)
  })

  it('stops and disables casting when the canonical capability becomes deferred', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).not.toBeNull()

    await act(async () => root.render(
      <OutputCastControl canvas={canvas} capability={CANVAS_FRACTURES_OUTPUT_DEFERRED} />,
    ))

    const disabled = container.querySelector<HTMLButtonElement>('[aria-label="Fractures cast unavailable"]')
    expect(disabled?.disabled).toBe(true)
    expect(disabled?.textContent).toContain('Cast unavailable for Fractures')
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()
    expect(stopCast).toHaveBeenCalled()
    expect(startCast).not.toHaveBeenCalled()
  })

  it('closes the anchored popover when the trigger is clicked again or the page is clicked', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).not.toBeNull()

    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()

    await act(async () => trigger?.click())
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()
  })
})
