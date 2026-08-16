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
  type ReactTrackSection,
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
import { LaserImageFxRenderer } from '../renderers/laserImageFx/LaserImageFxRenderer'
import {
  clearAllSharedPerformanceDiagnostics,
  getSharedPerformanceDiagnostics,
} from '../SharedPerformanceDiagnosticsStore'
import {
  CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY,
  CANVAS_SHOW_MANAGER_DEFAULT_FX,
  CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION,
  createCanvasShowManagerShow,
} from '../../showManager/CanvasShowManagerDomain'

let root: Root | null = null
let host: HTMLDivElement | null = null
let readyImage: HTMLImageElement
let mediaReady = true
let canvasAssignments: Array<{ property: PropertyKey; value: unknown }> = []
let canvasDrawSources: unknown[] = []

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

const routingSections: ReactTrackSection[] = [
  { id: 'routing-intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.25, source: 'auto', confidence: 0.95 },
  { id: 'routing-verse', label: 'Verse', type: 'verse', startSec: 16, endSec: 32, intensity: 0.5, source: 'auto', confidence: 0.95 },
  { id: 'routing-build', label: 'Build', type: 'build', startSec: 32, endSec: 48, intensity: 0.75, source: 'auto', confidence: 0.95 },
  { id: 'routing-predrop', label: 'Pre-Drop', type: 'preDrop', startSec: 48, endSec: 52, intensity: 0.55, source: 'auto', confidence: 0.95 },
  { id: 'routing-drop', label: 'Drop', type: 'drop', startSec: 52, endSec: 80, intensity: 0.96, source: 'auto', confidence: 0.97 },
  { id: 'routing-breakdown', label: 'Breakdown', type: 'breakdown', startSec: 80, endSec: 96, intensity: 0.3, source: 'auto', confidence: 0.94 },
  { id: 'routing-outro', label: 'Outro', type: 'outro', startSec: 96, endSec: 112, intensity: 0.2, source: 'auto', confidence: 0.92 },
]

const automaticRoutingPool: CanvasMediaItem[] = [
  { ...media, id: 'routing-drop-video', name: 'Drop Hero Video', type: 'video', mimeType: 'video/mp4', objectUrl: 'media://routing-drop-video', tags: ['drop'], durationSec: 32, fps: 30 },
  { ...media, id: 'routing-alt-portrait', name: 'Alternate Portrait', type: 'video', mimeType: 'video/mp4', objectUrl: 'media://routing-alt-portrait', width: 900, height: 1600, tags: ['drop'], durationSec: 16, fps: 30 },
  { ...media, id: 'routing-atmosphere', name: 'Atmosphere Background', objectUrl: 'media://routing-atmosphere', libraryRole: 'background_image', tags: ['ambient'] },
  { ...media, id: 'routing-texture', name: 'Texture Grain', objectUrl: 'media://routing-texture', width: 1200, height: 1200, tags: ['texture'] },
  { ...media, id: 'routing-accent', name: 'Logo Accent', type: 'svg', mimeType: 'image/svg+xml', objectUrl: 'media://routing-accent', width: 800, height: 1200, libraryRole: 'logo', hasAlpha: true, tags: ['accent'] },
  { ...media, id: 'routing-transition', name: 'Transition Flash', objectUrl: 'media://routing-transition', width: 1200, height: 1200, tags: ['transition'] },
]

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
      if (!(property in object)) {
        object[property] = property === 'drawImage'
          ? vi.fn((source: unknown) => { canvasDrawSources.push(source) })
          : vi.fn()
      }
      return object[property]
    },
    set(object, property, value) {
      object[property] = value
      canvasAssignments.push({ property, value })
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
  audioTime = 0,
  trackSections = [],
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onOutputCapabilityChange?: (capability: CanvasOutputCapability) => void
  audioTime?: number
  trackSections?: ReactTrackSection[]
} = {}) {
  await act(async () => {
    root?.render(
      <CanvasEngineSurface
        isPlaying={false}
        isPaused={false}
        analyser={null}
        activeAudioTrackId="routing-track"
        getAudioTime={() => audioTime}
        trackSections={trackSections}
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
  canvasAssignments = []
  canvasDrawSources = []
  clearAllSharedPerformanceDiagnostics()
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
  clearAllSharedPerformanceDiagnostics()
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
      display: { ...CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY, brightness: 1.25, opacity: 0.8 },
      transitions: {
        in: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION },
        out: { ...CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION },
      },
      fx: { ...CANVAS_SHOW_MANAGER_DEFAULT_FX, blur: 3, contrast: 1.2, saturation: 0.7, hue: 35, glow: 0.5 },
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
    expect(canvasAssignments.some(entry => entry.property === 'filter'
      && typeof entry.value === 'string'
      && entry.value.includes('brightness(1.250)')
      && entry.value.includes('blur(3.00px)'))).toBe(true)
    expect(canvasAssignments.some(entry => entry.property === 'globalCompositeOperation' && entry.value === 'screen')).toBe(true)
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

  it('updates the active production orchestration render state when Layer Complexity changes, then restores manual fallback when Auto Performance is disabled', async () => {
    setCanvasRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-cinematic-bass-editor',
      enabled: true,
    })
    useReactStore.getState().setCanvasOrchestrationSettings({
      compositionPreference: 'fullScreenHero',
      complexity: 0,
      motionIntensity: 0,
      effectIntensity: 0,
      transitionDensity: 0,
      cutDensity: 0,
    })
    await renderSurface()

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.textContent).toContain('1 layers')

    await act(async () => {
      useReactStore.getState().setCanvasOrchestrationSettings({ complexity: 1 })
      await Promise.resolve()
      vi.advanceTimersByTime(80)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.textContent).toContain('6 layers')

    await act(async () => {
      useReactStore.getState().setCanvasOrchestrationSettings({ enabled: false })
      await Promise.resolve()
      vi.advanceTimersByTime(80)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(host?.querySelector('.rv-canvas-orchestration-stage')).toBeNull()
    expect(host?.querySelector('.rv-canvas-live-output')).not.toBeNull()
  })

  it('routes Auto Role media diversity and section-aware show identity through the production CANVAS surface', async () => {
    setCanvasRoutingState({
      presetId: 'canvas-clean-playback',
      showId: 'canvas-glitch-collage-reactor',
      enabled: true,
    })
    useReactStore.setState(state => ({
      canvasMediaItems: automaticRoutingPool,
      selectedCanvasMediaId: automaticRoutingPool[0].id,
      activeCanvasMediaId: automaticRoutingPool[0].id,
      canvasEngineSettings: {
        ...state.canvasEngineSettings,
        selectedMediaId: automaticRoutingPool[0].id,
        mediaIds: automaticRoutingPool.map(item => item.id),
      },
      canvasOrchestrationSettings: {
        ...state.canvasOrchestrationSettings,
        autoRoleEnabled: true,
        compositionPreference: 'auto',
        complexity: 0,
        motionIntensity: 0,
        effectIntensity: 0,
        transitionDensity: 0,
        cutDensity: 0,
        mediaPoolIds: automaticRoutingPool.map(item => item.id),
        mediaRolesById: {},
        poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
      },
    }))

    await renderSurface({ audioTime: 8, trackSections: routingSections })
    const intro = getSharedPerformanceDiagnostics('canvas')
    expect(intro?.performanceShow).toBe('Glitch Collage Reactor')
    expect(intro?.section).toBe('intro')
    expect(intro?.motifOrComposition).toBe('Split Screen')
    expect(useReactStore.getState().canvasOrchestrationSettings.autoRoleEnabled).toBe(true)

    await renderSurface({ audioTime: 56, trackSections: routingSections })
    await act(async () => {
      vi.advanceTimersByTime(80)
      await Promise.resolve()
      await Promise.resolve()
    })
    const drop = getSharedPerformanceDiagnostics('canvas')
    const activeSources = (drop?.activeLayers ?? []).map(layer => layer.split(':').slice(1).join(':'))

    expect(drop?.section).toBe('drop')
    expect(drop?.motifOrComposition).toBe('Four-panel Grid')
    expect(drop?.activeLayers).toHaveLength(4)
    expect(new Set(activeSources).size).toBe(4)
    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
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

  it('routes the full authored layer composition through the selected Laser Image FX renderer', async () => {
    const laserRender = vi.fn(() => true)
    const laserResize = vi.fn()
    const laserDispose = vi.fn()
    vi.spyOn(LaserImageFxRenderer, 'create').mockReturnValue({
      renderer: {
        resize: laserResize,
        render: laserRender,
        dispose: laserDispose,
      } as unknown as LaserImageFxRenderer,
      error: null,
    })

    const second: CanvasMediaItem = {
      ...media,
      id: 'routing-authored-laser-second',
      name: 'Second Layer',
      objectUrl: 'media://routing-authored-laser-second',
    }
    useReactStore.getState().selectCanvasPreset('canvas-laser-image-fx')
    useReactStore.setState({
      canvasMediaItems: [media, second],
      selectedCanvasMediaId: second.id,
      activeCanvasMediaId: media.id,
      canvasOrchestrationSettings: {
        ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
        renderMode: 'layers',
        authoredLayers: [
          { id: 'laser-layer-top', mediaId: second.id, order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'laser-layer-bottom', mediaId: media.id, order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
        ],
      },
    })

    await renderSurface()

    const stage = host?.querySelector<HTMLElement>('[aria-label="CANVAS orchestrated media surface"]')
    expect(stage?.dataset.authoredPresetRenderer).toBe('laserImageFx')
    expect(laserResize).toHaveBeenCalledWith(640, 360)
    expect(laserRender).toHaveBeenCalled()
    const params = laserRender.mock.calls[0]?.[0]
    expect(params?.source).toBeInstanceOf(HTMLCanvasElement)
    expect(params?.settings.laserImageEffect).toBe('spin3d')
    expect(params?.settings.drySourceMix).toBe(0.08)
  })

  it('never leaves the stale single-source renderer in control after Layers mode is selected', async () => {
    mediaReady = false
    const top: CanvasMediaItem = {
      ...media,
      id: 'authored-top-pending',
      name: 'DVYDRM_wm2.png',
      type: 'image',
      mimeType: 'image/png',
      objectUrl: 'media://authored-top-pending',
    }
    const bottom: CanvasMediaItem = {
      ...media,
      id: 'authored-bottom-active',
      name: 'DVYDRM Logo.svg',
      type: 'svg',
      mimeType: 'image/svg+xml',
      objectUrl: 'media://authored-bottom-active',
    }

    useReactStore.setState({
      canvasMediaItems: [top, bottom],
      selectedCanvasMediaId: top.id,
      activeCanvasMediaId: bottom.id,
      canvasOrchestrationSettings: {
        ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
        renderMode: 'layers',
        authoredLayers: [
          { id: 'layer-top', mediaId: top.id, order: 0, enabled: true, solo: true, ownership: 'manual', pinned: true },
          { id: 'layer-bottom', mediaId: bottom.id, order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
        ],
      },
    })

    const adoptSpy = vi.spyOn(CanvasPreloadManager.prototype, 'adoptDrawableHandle').mockReturnValue(true)
    await renderSurface()

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.querySelector('[aria-label="CANVAS engine media surface"]')).toBeNull()

    // The production failure left this frame permanently black because the
    // authored compositor had no drawable source of its own. Layers mode now
    // mounts a browser-owned source host for the active authored media so a real
    // load event can hand the decoded element directly to the compositor.
    const sourceHost = host?.querySelector(`[data-canvas-authored-source="${top.id}"]`) as HTMLImageElement | null
    expect(sourceHost).not.toBeNull()
    Object.defineProperties(sourceHost!, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 1920 },
      naturalHeight: { configurable: true, value: 1080 },
    })
    sourceHost?.dispatchEvent(new Event('load'))
    expect(adoptSpy).toHaveBeenCalledWith(expect.objectContaining({ id: top.id }), sourceHost)
  })

  it('draws a newly added raster Image through the authored compositor above an SVG + SVG stack', async () => {
    const raster: CanvasMediaItem = {
      ...media,
      id: 'authored-raster-c',
      name: 'DVYDRM_wm2.png',
      type: 'image',
      mimeType: 'image/png',
      objectUrl: 'media://authored-raster-c',
    }
    const svgB: CanvasMediaItem = {
      ...media,
      id: 'authored-svg-b',
      name: 'Cloud B.svg',
      type: 'svg',
      mimeType: 'image/svg+xml',
      objectUrl: 'media://authored-svg-b',
    }
    const svgA: CanvasMediaItem = {
      ...media,
      id: 'authored-svg-a',
      name: 'Cloud A.svg',
      type: 'svg',
      mimeType: 'image/svg+xml',
      objectUrl: 'media://authored-svg-a',
    }
    const rasterHandle = document.createElement('img')
    const svgBHandle = document.createElement('img')
    const svgAHandle = document.createElement('img')
    for (const handle of [rasterHandle, svgBHandle, svgAHandle]) {
      Object.defineProperties(handle, {
        complete: { configurable: true, value: true },
        naturalWidth: { configurable: true, value: 1920 },
        naturalHeight: { configurable: true, value: 1080 },
      })
    }
    vi.mocked(CanvasPreloadManager.prototype.getHandle).mockImplementation((mediaId: string) => ({
      [raster.id]: rasterHandle,
      [svgB.id]: svgBHandle,
      [svgA.id]: svgAHandle,
    }[mediaId] ?? null))

    useReactStore.setState(state => ({
      canvasMediaItems: [raster, svgB, svgA],
      selectedCanvasMediaId: raster.id,
      activeCanvasMediaId: svgA.id,
      canvasOrchestrationSettings: {
        ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
        enabled: true,
        renderMode: 'layers',
        poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
        authoredLayers: [
          { id: 'layer-raster-c', mediaId: raster.id, order: 0, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'layer-svg-b', mediaId: svgB.id, order: 1, enabled: true, solo: false, ownership: 'manual', pinned: true },
          { id: 'layer-svg-a', mediaId: svgA.id, order: 2, enabled: true, solo: false, ownership: 'manual', pinned: true },
        ],
      },
    }))

    await renderSurface()

    expect(host?.querySelector('[aria-label="CANVAS orchestrated media surface"]')).not.toBeNull()
    expect(host?.textContent).toContain('3 layers')
    expect(canvasDrawSources).toContain(rasterHandle)
    expect(canvasDrawSources.lastIndexOf(rasterHandle)).toBeGreaterThan(canvasDrawSources.lastIndexOf(svgBHandle))
    expect(canvasDrawSources.lastIndexOf(svgBHandle)).toBeGreaterThan(canvasDrawSources.lastIndexOf(svgAHandle))
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
