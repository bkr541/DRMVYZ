import React from 'react'
import { createRoot } from 'react-dom/client'
import { AudioEngineProvider, useSharedAudio } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import {
  CINEMA2_AFTERHOURS_PRESET_ID,
  Cinema2Runtime,
} from '../../components/vyzualz/cinema2'
import {
  compareCinema2RgbaPixels,
  measureCinema2RgbaPixels,
  type Cinema2PixelDifferenceMetrics,
  type Cinema2PixelMetrics,
} from '../visual/Cinema2AfterhoursPixelMetrics'
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
  sceneCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
  outputCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
}

type HarnessApi = {
  getAudioState(): { trackId: string | null; analyzedBpm: number | null; analysisStatus: string | null }
  measureScreenshotDataUrl(dataUrl: string): Promise<Cinema2PixelMetrics>
  compareScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string): Promise<Cinema2PixelDifferenceMetrics>
  runRawSceneProbe(): Promise<RawProbeResult>
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__?: HarnessApi
  }
}

const rootElement = document.querySelector<HTMLElement>('#root')
const statusElement = document.querySelector<HTMLElement>('[data-cinema2-afterhours-status]')
if (!rootElement || !statusElement) throw new Error('Cinema 2.0 After Hours 2.0 browser harness is incomplete.')

let audioState = { trackId: null as string | null, analyzedBpm: null as number | null, analysisStatus: null as string | null }

async function decodeScreenshot(dataUrl: string): Promise<ImageData> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D context unavailable for screenshot analysis.')
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
    presetId: CINEMA2_AFTERHOURS_PRESET_ID,
    debugVisibilityReadback: true,
  })
  if (!created.runtime) {
    canvas.remove()
    throw new Error(created.error)
  }
  const runtime = created.runtime
  try {
    runtime.resize({ width: 640, height: 360, dpr: 1 })
    runtime.start()
    const deadline = performance.now() + 10_000
    while (runtime.getSnapshot().frameCount < 4) {
      if (performance.now() >= deadline) throw new Error('Timed out waiting for raw After Hours 2.0 frames.')
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    const render = runtime.getRenderGraphExecutorSnapshot()
    const sceneCheckpoint = render.visibilityCheckpoints.find(checkpoint => checkpoint.stage === 'pass-target') ?? null
    const outputCheckpoint = [...render.visibilityCheckpoints].reverse().find(checkpoint => checkpoint.stage === 'canvas') ?? null
    return {
      presetId: String(runtime.getDiagnosticsSnapshot().presetId),
      phase: runtime.getSnapshot().phase,
      frameCount: runtime.getSnapshot().frameCount,
      failedPassCount: render.failedPassCount,
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
    }
  } finally {
    runtime.dispose()
    canvas.remove()
  }
}

window.__DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__ = {
  getAudioState: () => ({ ...audioState }),
  measureScreenshotDataUrl: async dataUrl => {
    const image = await decodeScreenshot(dataUrl)
    return measureCinema2RgbaPixels(image.data)
  },
  compareScreenshotDataUrls: async (beforeDataUrl, afterDataUrl) => {
    const before = await decodeScreenshot(beforeDataUrl)
    const after = await decodeScreenshot(afterDataUrl)
    if (before.width !== after.width || before.height !== after.height) {
      throw new Error('Screenshot dimensions changed during visual comparison.')
    }
    return compareCinema2RgbaPixels(before.data, after.data)
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
    statusElement.dataset.result = 'ready'
    statusElement.textContent = JSON.stringify(audioState)
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
