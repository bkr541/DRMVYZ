// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFeatureBus } from '../../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { musicIntelligenceEngine } from '../../../../../features/musicIntelligence/MusicIntelligenceEngine'
import { DEFAULT_REACT_PRESETS } from '../../ReactTypes'
import { resetReactLiveEngineOwnershipForTests } from '../../renderers/ReactLiveEngineOwnership'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { getPixGridReactivityRuntimeStatus } from '../PixGridReactivityStatus'
import { PixGridSurface } from '../PixGridSurface'
import type { PixGridRendererDiagnostics, PixGridState } from '../PixGridTypes'

const context = {
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(),
  rect: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), strokeRect: vi.fn(), drawImage: vi.fn(),
  createImageData: vi.fn((width: number, height: number) => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  })),
  putImageData: vi.fn(),
  fillStyle: '', strokeStyle: '', shadowColor: '', shadowBlur: 0, lineWidth: 1,
  globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
} as unknown as CanvasRenderingContext2D

let root: Root
let host: HTMLDivElement
let nextRafId = 1
let rafCallbacks = new Map<number, FrameRequestCallback>()
const cancelledFrames: number[] = []
const disconnectedObservers: ReturnType<typeof vi.fn>[] = []
let webglAttempts = 0

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  resetReactLiveEngineOwnershipForTests()
  nextRafId = 1
  rafCallbacks = new Map()
  cancelledFrames.length = 0
  disconnectedObservers.length = 0
  webglAttempts = 0
  vi.clearAllMocks()
  musicIntelligenceEngine.setSourceId(null, null)
  musicIntelligenceEngine.reset()
  AudioFeatureBus.reset()

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => {
    if (kind === 'webgl2') {
      webglAttempts += 1
      return null
    }
    return context
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 640, height: 360, top: 0, left: 0, right: 640, bottom: 360, x: 0, y: 0,
    toJSON: () => ({}),
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextRafId++
    rafCallbacks.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelledFrames.push(id)
    rafCallbacks.delete(id)
  })
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn()
    observe = vi.fn()
    constructor() { disconnectedObservers.push(this.disconnect) }
  })

  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  try { act(() => root.unmount()) } catch { /* Test may already have unmounted explicitly. */ }
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resetReactLiveEngineOwnershipForTests()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
})

function renderSurface({
  isPlaying,
  analysisActive,
  isPaused = false,
  analyser = null,
  state = createDefaultPixGridState(),
  onCanvasReady = vi.fn(),
  onLiveFps = vi.fn(),
  onDiagnostics = vi.fn(),
  audioTimeSec = 0,
  trackIdentity = null,
  getAudioTime = vi.fn(() => 42),
}: {
  isPlaying: boolean
  analysisActive?: boolean
  isPaused?: boolean
  analyser?: AnalyserNode | null
  state?: PixGridState
  onCanvasReady?: ReturnType<typeof vi.fn>
  onLiveFps?: ReturnType<typeof vi.fn>
  onDiagnostics?: ReturnType<typeof vi.fn<(diagnostics: PixGridRendererDiagnostics) => void>>
  audioTimeSec?: number
  trackIdentity?: string | null
  getAudioTime?: ReturnType<typeof vi.fn<() => number>>
}) {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'pix-grid-bass-beacon')!
  act(() => root.render(
    <PixGridSurface
      analyser={analyser}
      activePreset={preset}
      pixGridState={state}
      intensity={1}
      motion={0.7}
      glow={0.5}
      bassReactivity={0.9}
      isPlaying={isPlaying}
      analysisActive={analysisActive}
      isPaused={isPaused}
      audioTimeSec={audioTimeSec}
      trackIdentity={trackIdentity}
      getAudioTime={getAudioTime}
      onCanvasReady={onCanvasReady}
      onLiveFps={onLiveFps}
      onDiagnostics={onDiagnostics}
    />,
  ))
  return { onCanvasReady, onLiveFps, onDiagnostics, getAudioTime }
}

function analyserFixture(value = 208) {
  const getByteFrequencyData = vi.fn((buffer: Uint8Array) => buffer.fill(value))
  const getByteTimeDomainData = vi.fn((buffer: Uint8Array) => buffer.fill(128 + Math.floor(value / 10)))
  return {
    analyser: {
      frequencyBinCount: 32,
      fftSize: 64,
      context: { sampleRate: 48_000 },
      getByteFrequencyData,
      getByteTimeDomainData,
    } as unknown as AnalyserNode,
    getByteFrequencyData,
    getByteTimeDomainData,
  }
}

function runNextFrame(now = 16) {
  const next = [...rafCallbacks][0]
  expect(next).toBeDefined()
  const [id, callback] = next
  rafCallbacks.delete(id)
  act(() => callback(now))
}

describe('PixGridSurface lifecycle', () => {
  it('uses a GPU canvas plus one isolated fallback canvas and never creates a DOM element per cell', () => {
    renderSurface({ isPlaying: false })
    expect(host.querySelectorAll('canvas')).toHaveLength(2)
    expect(host.querySelectorAll('[data-pix-grid-cell]')).toHaveLength(0)
    expect(host.querySelector('[data-pix-grid-matrix="160x90"]')).not.toBeNull()
    expect(host.querySelector('[data-pix-grid-renderer="canvas2d-fallback"]')).not.toBeNull()
  })

  it('renders one deterministic stopped frame, then leaves no continuing animation work', () => {
    const { getAudioTime } = renderSurface({ isPlaying: false })
    expect(rafCallbacks.size).toBe(1)
    runNextFrame()
    expect(context.drawImage).toHaveBeenCalledOnce()
    expect(getAudioTime).not.toHaveBeenCalled()
    expect(rafCallbacks.size).toBe(0)
  })

  it('renders one deterministic paused frame, then leaves no continuing animation work', () => {
    const getAudioTime = vi.fn(() => 18)
    renderSurface({ isPlaying: true, isPaused: true, audioTimeSec: 18, getAudioTime })
    expect(rafCallbacks.size).toBe(1)
    runNextFrame()
    expect(context.drawImage).toHaveBeenCalledOnce()
    expect(getAudioTime).toHaveBeenCalledOnce()
    expect(rafCallbacks.size).toBe(0)
  })

  it('refreshes editor state and paused seeks with one forced frame', () => {
    const base = createDefaultPixGridState()
    const getAudioTime = vi.fn(() => 12)
    renderSurface({ isPlaying: false, isPaused: true, audioTimeSec: 12, state: base, getAudioTime })
    runNextFrame()
    vi.clearAllMocks()

    const edited: PixGridState = {
      ...base,
      pixelOverrides: [[8, 4, 1, '#ffffff', 1]],
      scenes: base.scenes.map(scene => scene.id === base.selectedSceneId
        ? { ...scene, pixelOverrides: [[8, 4, 1, '#ffffff', 1]] }
        : scene),
    }
    getAudioTime.mockReturnValue(36)
    renderSurface({ isPlaying: false, isPaused: true, audioTimeSec: 36, state: edited, getAudioTime })

    expect(rafCallbacks.size).toBe(1)
    runNextFrame(32)
    expect(context.drawImage).toHaveBeenCalledOnce()
    expect(getAudioTime).toHaveBeenCalledOnce()
    expect(getPixGridReactivityRuntimeStatus().audioFrame).toMatchObject({
      audioTime: 36,
      isPlaying: false,
      deltaTimeSec: 0,
    })
    expect(rafCallbacks.size).toBe(0)
  })

  it('samples the active analyser before resolving PixGrid audio and performance state', () => {
    const fixture = analyserFixture()
    let audioTime = 1
    const getAudioTime = vi.fn(() => {
      audioTime += 1 / 60
      return audioTime
    })
    renderSurface({ isPlaying: true, analyser: fixture.analyser, getAudioTime })

    runNextFrame()

    const intelligenceFrame = AudioFeatureBus.getFrame()
    const pixGridFrame = getPixGridReactivityRuntimeStatus().audioFrame
    expect(fixture.getByteFrequencyData).toHaveBeenCalledOnce()
    expect(fixture.getByteTimeDomainData).toHaveBeenCalledOnce()
    expect(intelligenceFrame.frameId).toBeGreaterThan(0)
    expect(intelligenceFrame.raw.freqData).toHaveLength(32)
    expect(intelligenceFrame.raw.timeDomainData).toHaveLength(64)
    expect(intelligenceFrame.bands.volume).toBeGreaterThan(0)
    expect(pixGridFrame?.energy).toBeGreaterThan(0)
    expect(pixGridFrame?.sourceValues?.bass).toBeGreaterThan(0)
    expect(rafCallbacks.size).toBe(1)

    runNextFrame(32)
    expect(fixture.getByteFrequencyData).toHaveBeenCalledTimes(2)
    expect(rafCallbacks.size).toBe(1)
  })

  it('consumes authoritative Live Input while transport stays stopped and does not republish from PixGrid', () => {
    const fixture = analyserFixture(240)
    AudioFeatureBus.setAuthoritativeFramePublisherId('audio:live-input')
    AudioFeatureBus.setFrame({
      ...DEFAULT_MI_FRAME,
      frameId: 41,
      sourceId: 'live-input:41',
      trackId: null,
      timeSec: 42,
      bands: { ...DEFAULT_MI_FRAME.bands, bass: 0.8, lowMid: 0.5, mid: 0.5, high: 0.4, air: 0.3, volume: 0.7 },
      energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.74, spectralFlux: 0.1 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: false, sections: false },
    }, 'audio:live-input')

    renderSurface({ isPlaying: false, analysisActive: true, analyser: fixture.analyser, getAudioTime: vi.fn(() => 42) })
    runNextFrame()

    const pixGridFrame = getPixGridReactivityRuntimeStatus().audioFrame
    expect(fixture.getByteFrequencyData).not.toHaveBeenCalled()
    expect(fixture.getByteTimeDomainData).not.toHaveBeenCalled()
    expect(AudioFeatureBus.getFramePublicationMeta().publisherId).toBe('audio:live-input')
    expect(pixGridFrame).toMatchObject({
      isPlaying: true,
      transportState: 'stopped',
      inputSource: 'shared-bus',
    })
    expect(pixGridFrame?.energy).toBeGreaterThan(0)
    expect(pixGridFrame?.sourceValues?.bass).toBeGreaterThan(0)
    expect(pixGridFrame?.sectionType).toBeNull()
    expect(rafCallbacks.size).toBe(1)
  })

  it('switches analyser ownership without retaining stale buffers or adding a second loop', () => {
    const first = analyserFixture(160)
    const second = analyserFixture(240)
    renderSurface({ isPlaying: true, analyser: first.analyser, getAudioTime: vi.fn(() => 2) })
    runNextFrame()

    renderSurface({ isPlaying: true, analyser: second.analyser, getAudioTime: vi.fn(() => 2.02) })
    expect(rafCallbacks.size).toBe(1)
    runNextFrame(32)

    expect(first.getByteFrequencyData).toHaveBeenCalledOnce()
    expect(second.getByteFrequencyData).toHaveBeenCalledOnce()
    expect(AudioFeatureBus.getFrame().raw.freqData?.[0]).toBe(240)
    expect(rafCallbacks.size).toBe(1)
  })

  it('updates controls live without recreating the surface or retrying WebGL automatically', () => {
    renderSurface({ isPlaying: false })
    const canvases = [...host.querySelectorAll('canvas')]
    expect(webglAttempts).toBe(1)
    runNextFrame()

    renderSurface({
      isPlaying: false,
      state: { ...createDefaultPixGridState(), cellGap: 0.31, diffusion: 0.6 },
    })
    expect([...host.querySelectorAll('canvas')]).toEqual(canvases)
    expect(webglAttempts).toBe(1)
    expect(rafCallbacks.size).toBe(1)
  })

  it('surfaces a concise retryable fallback diagnostic', () => {
    renderSurface({ isPlaying: false })
    runNextFrame()
    expect(host.textContent).toContain('Canvas2D PixGrid fallback')
    const button = host.querySelector<HTMLButtonElement>('.rv-pix-grid-diagnostic button')!
    act(() => button.click())
    expect(webglAttempts).toBe(2)
  })

  it('handles a missing Media Library item without breaking rendering and recovers when cleared', () => {
    const base = createDefaultPixGridState()
    renderSurface({
      isPlaying: false,
      state: {
        ...base,
        conversion: { ...base.conversion, selectedMediaId: 'missing-media-id' },
      },
    })
    expect(host.querySelector('[data-pix-grid-media-status="missing"]')).not.toBeNull()
    expect(host.textContent).toContain('selected Media Library item is missing')

    renderSurface({ isPlaying: false, state: base })
    expect(host.querySelector('[data-pix-grid-media-status="idle"]')).not.toBeNull()
    expect(host.textContent).not.toContain('selected Media Library item is missing')
  })

  it('promotes Draft fallback rendering to 96 × 54 logical readability', () => {
    const onDiagnostics = vi.fn<(diagnostics: PixGridRendererDiagnostics) => void>()
    renderSurface({
      isPlaying: false,
      state: { ...createDefaultPixGridState(), quality: 'draft', matrixWidth: 64, matrixHeight: 36 },
      onDiagnostics,
    })
    runNextFrame()
    expect(onDiagnostics).toHaveBeenLastCalledWith(expect.objectContaining({
      path: 'canvas2d-fallback',
      logicalWidth: 96,
      logicalHeight: 54,
    }))
  })

  it('cancels animation, disconnects observers, unregisters output, and clears FPS on unmount', () => {
    const onCanvasReady = vi.fn()
    const onLiveFps = vi.fn()
    renderSurface({ isPlaying: true, onCanvasReady, onLiveFps })
    runNextFrame()
    expect(rafCallbacks.size).toBe(1)

    act(() => root.unmount())
    expect(cancelledFrames.length).toBeGreaterThan(0)
    expect(disconnectedObservers.every(disconnect => disconnect.mock.calls.length === 1)).toBe(true)
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(onLiveFps).toHaveBeenLastCalledWith(0)
  })
})
