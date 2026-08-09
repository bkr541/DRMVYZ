/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recorder } from '../../../../hooks/useRecorder'
import { useMediaStore } from '../../../../stores/mediaStore'
import { useReactStore } from '../../../../stores/reactStore'
import {
  DEFAULT_CANVAS_ENGINE_SETTINGS,
  type CanvasMediaItem,
  type CanvasPresetId,
} from '../ReactTypes'
import {
  CanvasPreloadManager,
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  type CanvasPerformanceShowId,
} from '.'

import {
  CANVAS_OUTPUT_AVAILABLE,
  isCanvasOutputAvailable,
  type CanvasOutputCapability,
} from '../canvasFracturesOutputContract'
import { ReactOutputWorkspacePanel } from '../panels/ReactWorkspacePanels'
import { OutputCastControl } from '../output/OutputCastControl'

vi.mock('../renderers/CanvasFracturesRendererLayer', () => ({
  CanvasFracturesRendererLayer: ({
    onCanvasReady,
  }: {
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  }) => <canvas data-testid="fractures-renderer" ref={onCanvasReady} />,
}))

import { CanvasEngineSurface } from '../ReactCanvasEngineShell'
import { createCanvasShowManagerShow } from '../../showManager/CanvasShowManagerDomain'

let root: Root | null = null
let host: HTMLDivElement | null = null
let readyImage: HTMLImageElement
let mediaReady = true

const media: CanvasMediaItem = {
  id: 'routing-hero',
  name: 'Routing Hero',
  type: 'image',
  objectUrl: 'media://routing-hero',
  thumbnailUrl: null,
  mimeType: 'image/png',
  meta: 'PNG · 1920×1080',
  source: 'legacySession',
  createdAt: new Date(0).toISOString(),
  width: 1920,
  height: 1080,
  tags: ['hero', 'background'],
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

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<PropertyKey, unknown> = {
    canvas,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    filter: 'none',
  }
  return new Proxy(target, {
    get(object, property) {
      if (!(property in object)) object[property] = vi.fn()
      return object[property]
    },
    set(object, property, value) {
      object[property] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function setCanvasRoutingState({
  presetId,
  showId,
  enabled,
}: {
  presetId: CanvasPresetId
  showId: CanvasPerformanceShowId
  enabled: boolean
}) {
  useReactStore.getState().selectCanvasPreset(presetId)
  useReactStore.setState(state => ({
    canvasMediaItems: [media],
    selectedCanvasMediaId: media.id,
    activeCanvasMediaId: media.id,
    canvasEngineSettings: {
      ...DEFAULT_CANVAS_ENGINE_SETTINGS,
      ...state.canvasEngineSettings,
      selectedMediaId: media.id,
      mediaIds: [media.id],
    },
    canvasOrchestrationSettings: {
      ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
      enabled,
      programId: showId,
      mediaPoolIds: [media.id],
      mediaRolesById: {
        [media.id]: [
          'hero',
          'alternateHero',
          'background',
          'texture',
          'foregroundAccent',
          'introAsset',
          'buildAsset',
          'dropAsset',
          'breakdownAsset',
          'outroAsset',
        ],
      },
      poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
    },
  }))
}

async function renderSurface({
  onCanvasReady,
  onOutputCapabilityChange,
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onOutputCapabilityChange?: (capability: CanvasOutputCapability) => void
} = {}) {
  await act(async () => {
    root?.render(
      <CanvasEngineSurface
        isPlaying={false}
        isPaused={false}
        analyser={null}
        activeAudioTrackId="routing-track"
        getAudioTime={() => 0}
        onCanvasReady={onCanvasReady}
        onOutputCapabilityChange={onOutputCapabilityChange}
      />,
    )
    await Promise.resolve()
    await Promise.resolve()
  })
}

function OutputSafetyHarness() {
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null)
  const [capability, setCapability] = React.useState<CanvasOutputCapability>(CANVAS_OUTPUT_AVAILABLE)
  const handleCapability = React.useCallback((next: CanvasOutputCapability) => {
    setCapability(next)
    if (!isCanvasOutputAvailable(next)) setCanvas(null)
  }, [])

  return (
    <>
      <CanvasEngineSurface
        isPlaying={false}
        isPaused={false}
        analyser={null}
        activeAudioTrackId="routing-track"
        getAudioTime={() => 0}
        onCanvasReady={setCanvas}
        onOutputCapabilityChange={handleCapability}
      />
      <div
        data-testid="output-safety-state"
        data-capability={capability.status}
        data-canvas-ready={canvas ? 'true' : 'false'}
      />
      <ReactOutputWorkspacePanel
        canvas={canvas}
        outputCapability={capability}
        recorder={recorder}
        liveFps={60}
        hasActiveProgramAudio={false}
        onStartRecording={vi.fn()}
      />
      <OutputCastControl canvas={canvas} capability={capability} />
    </>
  )
}

async function updateRoutingState(input: Parameters<typeof setCanvasRoutingState>[0]) {
  await act(async () => {
    setCanvasRoutingState(input)
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  mediaReady = true
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    return canvasContext(this)
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 640,
    bottom: 360,
    width: 640,
    height: 360,
    toJSON: () => ({}),
  })

  readyImage = document.createElement('img')
  Object.defineProperties(readyImage, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 1920 },
    naturalHeight: { configurable: true, value: 1080 },
  })
  vi.spyOn(CanvasPreloadManager.prototype, 'isReady').mockImplementation(() => mediaReady)
  vi.spyOn(CanvasPreloadManager.prototype, 'getHandle').mockImplementation(() => readyImage)
  vi.spyOn(CanvasPreloadManager.prototype, 'request').mockImplementation(() => {})
  vi.spyOn(CanvasPreloadManager.prototype, 'retainOnly').mockImplementation(() => {})

  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
  useMediaStore.setState({ items: [] })

  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  useReactStore.getState().resetReactView()
  useMediaStore.setState({ items: [] })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('CanvasEngineSurface Performance Show routing', () => {
  it('selects a valid active saved Canvas Show through the real production surface before orchestration fallback', async () => {
    setCanvasRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-cinematic-bass-editor',
      enabled: false,
    })
    const show = createCanvasShowManagerShow('Active Four-Layer Show')
    show.mediaElements = [{
      id: 'active-show-element',
      mediaId: media.id,
      layer: 0,
      showStartSec: 0,
      showEndSec: 8,
      sourceInSec: null,
      sourceOutSec: null,
    }]
    useReactStore.setState({
      canvasShowManagerShows: [show],
      canvasShowManagerActiveShowId: show.id,
    })

    await renderSurface()

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.textContent).toContain('Active Four-Layer Show')
    expect(host?.textContent).toContain('Four-layer Show')
    expect(host?.querySelector('[data-testid="canvas-show-quality-diagnostics"]')).not.toBeNull()
  })

  it('suppresses direct Fractures publication and restores direct generic output', async () => {
    const onCanvasReady = vi.fn()
    const onOutputCapabilityChange = vi.fn()
    setCanvasRoutingState({
      presetId: 'canvas-fractures',
      showId: 'canvas-fractures-performance',
      enabled: false,
    })
    await renderSurface({ onCanvasReady, onOutputCapabilityChange })

    expect(onOutputCapabilityChange).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'deferred',
      reason: 'fractures-mvp',
    }))
    expect(onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(onCanvasReady.mock.calls.some((call: unknown[]) => call[0] instanceof HTMLCanvasElement)).toBe(false)

    await updateRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-fractures-performance',
      enabled: false,
    })

    expect(onOutputCapabilityChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'available' }))
    expect(onCanvasReady.mock.calls.some((call: unknown[]) => call[0] instanceof HTMLCanvasElement)).toBe(true)
  })

  it('waits for canonical media readiness before activating a generic show over direct Fractures fallback', async () => {
    mediaReady = false
    setCanvasRoutingState({
      presetId: 'canvas-fractures',
      showId: 'canvas-cinematic-bass-editor',
      enabled: true,
    })
    await renderSurface()

    expect(host?.querySelector('.rv-canvas-orchestration-stage')).toBeNull()
    expect(host?.querySelector('[data-testid="fractures-renderer"]')).not.toBeNull()

    mediaReady = true
    await act(async () => {
      vi.advanceTimersByTime(80)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.querySelector('[data-testid="fractures-renderer"]')).toBeNull()
  })

  it('derives orchestration stage from the resolved show and reserves the selected preset for direct fallback', async () => {
    setCanvasRoutingState({
      presetId: 'canvas-fractures',
      showId: 'canvas-cinematic-bass-editor',
      enabled: true,
    })
    await renderSurface()

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.querySelector('[data-specialized-processor="fractures"]')).toBeNull()
    expect(host?.textContent).toContain('Cinematic Bass Editor')

    await updateRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-fractures-performance',
      enabled: true,
    })

    expect(host?.querySelector('[data-specialized-processor="fractures"]')).not.toBeNull()
    expect(host?.querySelector('[data-testid="fractures-renderer"]')).not.toBeNull()
    expect(host?.textContent).toContain('Fractures Performance')

    await updateRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-fractures-performance',
      enabled: false,
    })

    expect(host?.querySelector('.rv-canvas-orchestration-stage')).toBeNull()
    expect(host?.querySelector('.rv-canvas-live-output')).not.toBeNull()
    expect(host?.querySelector('[data-testid="fractures-renderer"]')).toBeNull()

    await updateRoutingState({
      presetId: 'canvas-fractures',
      showId: 'canvas-cinematic-bass-editor',
      enabled: false,
    })

    expect(host?.querySelector('.rv-canvas-orchestration-stage')).toBeNull()
    expect(host?.querySelector('[data-testid="fractures-renderer"]')).not.toBeNull()
  })

  it('drives the real Recording and Cast paths from effective renderer capability and clears stale output', async () => {
    setCanvasRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-cinematic-bass-editor',
      enabled: true,
    })
    await act(async () => {
      root?.render(<OutputSafetyHarness />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const state = () => host?.querySelector<HTMLElement>('[data-testid="output-safety-state"]')
    expect(state()?.dataset.capability).toBe('available')
    expect(state()?.dataset.canvasReady).toBe('true')
    expect(host?.querySelector('[aria-label="Fractures recording unavailable"]')).toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.vz-rec-start-btn')?.disabled).toBe(false)
    expect(host?.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')?.disabled).toBe(false)

    await updateRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-fractures-performance',
      enabled: true,
    })

    expect(state()?.dataset.capability).toBe('deferred')
    expect(state()?.dataset.canvasReady).toBe('false')
    expect(host?.querySelector('[aria-label="Fractures recording unavailable"]')).not.toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('[aria-label="Fractures cast unavailable"]')?.disabled).toBe(true)

    await updateRoutingState({
      presetId: 'canvas-fractures',
      showId: 'canvas-cinematic-bass-editor',
      enabled: true,
    })

    expect(state()?.dataset.capability).toBe('available')
    expect(state()?.dataset.canvasReady).toBe('true')
    expect(host?.querySelector('[aria-label="Fractures recording unavailable"]')).toBeNull()
    expect(host?.querySelector<HTMLButtonElement>('.vz-rec-start-btn')?.disabled).toBe(false)
  })

})
