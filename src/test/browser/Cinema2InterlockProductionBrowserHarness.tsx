import React from 'react'
import { createRoot } from 'react-dom/client'
import { AudioEngineProvider, useSharedAudio } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import { CINEMA2_INTERLOCK_PRESET_ID, Cinema2Runtime } from '../../components/vyzualz/cinema2'
import {
  compareCinema2InterlockFixtureSamples,
  compareCinema2InterlockRgbaPixels,
  measureCinema2InterlockFixtureReadability,
  measureCinema2InterlockRgbaPixels,
  type Cinema2InterlockDifferenceMetrics,
  type Cinema2InterlockFixtureDifferenceMetrics,
  type Cinema2InterlockFixtureReadabilityMetrics,
  type Cinema2InterlockPixelMetrics,
} from '../visual/Cinema2InterlockPixelMetrics'
import '../../styles.css'
import '../../styles/analyzer.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'

type RawProbeResult = {
  presetId: string
  phase: string
  frameCount: number
  failedPassCount: number
  activeModuleCount: number
  activeResourceLeaseCount: number
  executedPassCount: number
  lastExecutedPassIds: readonly string[]
  sceneCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
  outputCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
  performance: {
    resolvedQuality: string
    cpuFrameTimeMs: number | null
    cpuFrameTimeAverageMs: number | null
    gpuFrameTimeMs: number | null
    gpuTimingSupported: boolean
  }
  resources: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number }
  history: { activeBufferCount: number; validBufferCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number }
  postDispose: {
    phase: string
    activeAnimationFrameCount: number
    activeEventListenerCount: number
    activeWebGLContextCount: number
    activeModuleCount: number
    activeModuleResourceLeaseCount: number
    activeRenderTargetLeaseCount: number
    activeHistoryBufferCount: number
  }
}

type HarnessApi = {
  getAudioState(): { trackId: string | null; analyzedBpm: number | null; analysisStatus: string | null }
  measureScreenshotDataUrl(dataUrl: string): Promise<Cinema2InterlockPixelMetrics>
  measureFixtureScreenshotDataUrl(dataUrl: string, patternId: 'diamondTunnel' | 'mechanicalIris' | 'doubleWing' | 'bassPortal' | 'fourWayVortex'): Promise<Cinema2InterlockFixtureReadabilityMetrics>
  compareScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string): Promise<Cinema2InterlockDifferenceMetrics>
  compareFixtureScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string, patternId: 'diamondTunnel' | 'mechanicalIris' | 'doubleWing' | 'bassPortal' | 'fourWayVortex'): Promise<Cinema2InterlockFixtureDifferenceMetrics>
  runRawSceneProbe(): Promise<RawProbeResult>
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__?: HarnessApi
  }
}

const rootElement = document.querySelector<HTMLElement>('#root')
const statusElement = document.querySelector<HTMLElement>('[data-cinema2-interlock-status]')
if (!rootElement || !statusElement) throw new Error('Cinema 2.0 Interlock browser harness is incomplete.')
const acceptanceStatusElement = statusElement

let audioState = { trackId: null as string | null, analyzedBpm: null as number | null, analysisStatus: null as string | null }

async function decodeScreenshot(dataUrl: string): Promise<ImageData> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D context unavailable for Interlock screenshot analysis.')
  context.drawImage(image, 0, 0)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

async function runRawSceneProbe(): Promise<RawProbeResult> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  canvas.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:640px;height:360px;'
  document.body.append(canvas)
  const created = Cinema2Runtime.create(canvas, {
    presetId: CINEMA2_INTERLOCK_PRESET_ID,
    diagnosticsEnabled: true,
    debugVisibilityReadback: true,
    renderQuality: 'high',
    randomness: { mode: 'deterministic', seed: 'interlock-stage6-final-acceptance' },
  })
  if (!created.runtime) {
    canvas.remove()
    throw new Error(created.error)
  }
  const runtime = created.runtime
  let result: Omit<RawProbeResult, 'postDispose'> | null = null
  try {
    runtime.resize({ width: 640, height: 360, dpr: 1 })
    runtime.start()
    const deadline = performance.now() + 10_000
    while (runtime.getSnapshot().frameCount < 4) {
      if (performance.now() >= deadline) throw new Error('Timed out waiting for raw Interlock frames.')
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    const render = runtime.getRenderGraphExecutorSnapshot()
    const modules = runtime.getModuleRuntimeSnapshot()
    const performanceSnapshot = runtime.getPerformanceSnapshot()
    const resources = runtime.getResourceManagerSnapshot()
    const history = runtime.getHistoryServiceSnapshot()
    const sceneCheckpoint = render.visibilityCheckpoints.find(checkpoint => checkpoint.stage === 'pass-target') ?? null
    const outputCheckpoint = [...render.visibilityCheckpoints].reverse().find(checkpoint => checkpoint.stage === 'canvas') ?? null
    result = {
      presetId: String(runtime.getDiagnosticsSnapshot().presetId),
      phase: runtime.getSnapshot().phase,
      frameCount: runtime.getSnapshot().frameCount,
      failedPassCount: render.failedPassCount,
      activeModuleCount: modules.activeModuleCount,
      activeResourceLeaseCount: modules.activeResourceLeaseCount,
      executedPassCount: render.executedPassCount,
      lastExecutedPassIds: [...render.lastExecutedPassIds].map(String),
      sceneCheckpoint: sceneCheckpoint ? {
        maxRgbByte: sceneCheckpoint.maxRgbByte,
        rgbEnergyDetected: sceneCheckpoint.rgbEnergyDetected,
        error: sceneCheckpoint.error,
      } : null,
      outputCheckpoint: outputCheckpoint ? {
        maxRgbByte: outputCheckpoint.maxRgbByte,
        rgbEnergyDetected: outputCheckpoint.rgbEnergyDetected,
        error: outputCheckpoint.error,
      } : null,
      performance: {
        resolvedQuality: performanceSnapshot.resolvedQuality,
        cpuFrameTimeMs: performanceSnapshot.cpuFrameTimeMs,
        cpuFrameTimeAverageMs: performanceSnapshot.cpuFrameTimeAverageMs,
        gpuFrameTimeMs: performanceSnapshot.gpuFrameTimeMs,
        gpuTimingSupported: performanceSnapshot.gpuTimingSupported,
      },
      resources: {
        activeLeaseCount: resources.activeLeaseCount,
        activeSurfaceCount: resources.activeSurfaceCount,
        estimatedGpuMemoryBytes: resources.estimatedGpuMemoryBytes,
      },
      history: {
        activeBufferCount: history.activeBufferCount,
        validBufferCount: history.validBufferCount,
        activeSurfaceCount: history.activeSurfaceCount,
        estimatedGpuMemoryBytes: history.estimatedGpuMemoryBytes,
      },
    }
  } finally {
    runtime.dispose()
    canvas.remove()
  }

  if (!result) throw new Error('Interlock raw scene probe did not produce a result.')
  const disposedRuntime = runtime.getSnapshot()
  const disposedModules = runtime.getModuleRuntimeSnapshot()
  const disposedResources = runtime.getResourceManagerSnapshot()
  const disposedHistory = runtime.getHistoryServiceSnapshot()
  return {
    ...result,
    postDispose: {
      phase: disposedRuntime.phase,
      activeAnimationFrameCount: disposedRuntime.resources.activeAnimationFrameCount,
      activeEventListenerCount: disposedRuntime.resources.activeEventListenerCount,
      activeWebGLContextCount: disposedRuntime.resources.activeWebGLContextCount,
      activeModuleCount: disposedModules.activeModuleCount,
      activeModuleResourceLeaseCount: disposedModules.activeResourceLeaseCount,
      activeRenderTargetLeaseCount: disposedResources.activeLeaseCount,
      activeHistoryBufferCount: disposedHistory.activeBufferCount,
    },
  }
}

window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__ = {
  getAudioState: () => ({ ...audioState }),
  measureScreenshotDataUrl: async dataUrl => {
    const image = await decodeScreenshot(dataUrl)
    return measureCinema2InterlockRgbaPixels(image.data, image.width, image.height)
  },
  measureFixtureScreenshotDataUrl: async (dataUrl, patternId) => {
    const image = await decodeScreenshot(dataUrl)
    return measureCinema2InterlockFixtureReadability(image.data, image.width, image.height, patternId, window.devicePixelRatio)
  },
  compareScreenshotDataUrls: async (beforeDataUrl, afterDataUrl) => {
    const before = await decodeScreenshot(beforeDataUrl)
    const after = await decodeScreenshot(afterDataUrl)
    if (before.width !== after.width || before.height !== after.height) throw new Error('Interlock screenshot dimensions changed during comparison.')
    return compareCinema2InterlockRgbaPixels(before.data, after.data)
  },
  compareFixtureScreenshotDataUrls: async (beforeDataUrl, afterDataUrl, patternId) => {
    const before = await decodeScreenshot(beforeDataUrl)
    const after = await decodeScreenshot(afterDataUrl)
    if (before.width !== after.width || before.height !== after.height) throw new Error('Interlock screenshot dimensions changed during fixture comparison.')
    return compareCinema2InterlockFixtureSamples(before.data, after.data, before.width, before.height, patternId, window.devicePixelRatio)
  },
  runRawSceneProbe,
}

function HarnessContent() {
  const audio = useSharedAudio()
  React.useEffect(() => {
    audioState = {
      trackId: audio.currentTrackId ?? null,
      analyzedBpm: typeof audio.currentAnalyzedBpm === 'number' ? audio.currentAnalyzedBpm : null,
      analysisStatus: audio.currentAnalysisStatus ?? null,
    }
    acceptanceStatusElement.dataset.result = 'ready'
    acceptanceStatusElement.textContent = JSON.stringify(audioState)
  }, [audio.currentAnalysisStatus, audio.currentAnalyzedBpm, audio.currentTrackId])
  return <VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView="react" />
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AudioEngineProvider>
      <HarnessContent />
    </AudioEngineProvider>
  </React.StrictMode>,
)
