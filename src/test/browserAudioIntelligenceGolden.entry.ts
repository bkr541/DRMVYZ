import {
  BROWSER_AUDIO_GOLDEN_SCHEMA_VERSION,
  createBrowserAudioGoldenFixture,
} from '../features/musicIntelligence/browserGoldenFixture'
import { CURRENT_ANALYSIS_VERSION } from '../features/musicIntelligence/analysisVersion'
import {
  RGB_FFT_SIZE,
  RGB_HOP_SIZE,
  RGB_WAVEFORM_BIN_COUNT,
  RGB_WAVEFORM_VERSION,
} from '../features/waveform/rgbWaveformTypes'

interface BrowserAnalysisRequest {
  audioUrl: string
  sourceName: string
  mimeType?: string
}

interface GoldenBrowserState {
  runId?: string
  status: 'idle' | 'fetching' | 'decoding' | 'analyzing' | 'complete' | 'error'
  stage?: string
  progress?: number
  canonicalJson?: string
  runtime?: {
    userAgent: string
    platform: string
    language: string
    audioContextSampleRate: number
  }
  volatile?: {
    trackAnalysisCreatedAt: string
  }
  error?: string
  stack?: string
}

interface BrowserAudioIntelligenceBatchApi {
  startAnalysis: (request: BrowserAnalysisRequest) => string
  analyzeTrack: (request: BrowserAnalysisRequest) => Promise<GoldenBrowserState>
  getAnalyzerVersions: () => {
    goldenSchemaVersion: number
    trackAnalysisVersion: string
    rgbWaveformVersion: number
    rgbWaveformBinCount: number
    rgbFftSize: number
    rgbHopSize: number
  }
  getState: () => GoldenBrowserState
}

declare global {
  interface Window {
    __DRMVYZ_BROWSER_AUDIO_GOLDEN__: GoldenBrowserState
    __DRMVYZ_AUDIO_INTELLIGENCE_BATCH__: BrowserAudioIntelligenceBatchApi
  }
}

const statusNode = document.querySelector<HTMLPreElement>('#status')
let activeRunId: string | null = null

function publish(patch: Partial<GoldenBrowserState>): GoldenBrowserState {
  window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__ = {
    ...window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__,
    ...patch,
  }
  if (statusNode) statusNode.textContent = JSON.stringify(window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__, null, 2)
  return window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__
}

function publishForRun(runId: string, patch: Partial<GoldenBrowserState>): GoldenBrowserState {
  if (activeRunId !== runId) return window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__
  return publish({ runId, ...patch })
}

function normalizeRequest(request: BrowserAnalysisRequest): Required<BrowserAnalysisRequest> {
  const audioUrl = request?.audioUrl?.trim()
  const sourceName = request?.sourceName?.trim()
  if (!audioUrl || !sourceName) throw new Error('audioUrl and sourceName are required.')
  return {
    audioUrl,
    sourceName,
    mimeType: request.mimeType?.trim() || 'application/octet-stream',
  }
}

async function analyzeRequest(
  request: BrowserAnalysisRequest,
  runId: string,
): Promise<GoldenBrowserState> {
  const normalizedRequest = normalizeRequest(request)
  activeRunId = runId
  publish({
    runId,
    status: 'fetching',
    stage: 'fetching_source',
    progress: 0,
    canonicalJson: undefined,
    runtime: undefined,
    volatile: undefined,
    error: undefined,
    stack: undefined,
  })

  try {
    const response = await fetch(normalizedRequest.audioUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Unable to fetch source audio: ${response.status} ${response.statusText}`)
    const sourceBytes = await response.arrayBuffer()
    const file = new File([sourceBytes], normalizedRequest.sourceName, {
      type: normalizedRequest.mimeType,
      lastModified: 0,
    })

    publishForRun(runId, { status: 'decoding', stage: 'decoding', progress: 0.01 })
    const result = await createBrowserAudioGoldenFixture(file, {
      onProgress: info => publishForRun(runId, {
        status: 'analyzing',
        stage: info.stage,
        progress: info.progress,
      }),
    })

    return publishForRun(runId, {
      status: 'complete',
      stage: 'complete',
      progress: 1,
      canonicalJson: result.canonicalJson,
      runtime: result.runtime,
      volatile: result.volatile,
    })
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    publishForRun(runId, {
      status: 'error',
      error: normalized.message,
      stack: normalized.stack,
    })
    throw normalized
  } finally {
    if (activeRunId === runId) activeRunId = null
  }
}

function startAnalysis(request: BrowserAnalysisRequest): string {
  if (activeRunId) throw new Error(`Audio analysis is already running: ${activeRunId}`)
  const runId = crypto.randomUUID()
  void analyzeRequest(request, runId).catch(() => undefined)
  return runId
}

window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__ = { status: 'idle' }
window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__ = {
  startAnalysis,
  analyzeTrack: async request => {
    if (activeRunId) throw new Error(`Audio analysis is already running: ${activeRunId}`)
    return await analyzeRequest(request, crypto.randomUUID())
  },
  getAnalyzerVersions: () => ({
    goldenSchemaVersion: BROWSER_AUDIO_GOLDEN_SCHEMA_VERSION,
    trackAnalysisVersion: CURRENT_ANALYSIS_VERSION,
    rgbWaveformVersion: RGB_WAVEFORM_VERSION,
    rgbWaveformBinCount: RGB_WAVEFORM_BIN_COUNT,
    rgbFftSize: RGB_FFT_SIZE,
    rgbHopSize: RGB_HOP_SIZE,
  }),
  getState: () => window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__,
}

const params = new URLSearchParams(window.location.search)
const audioUrl = params.get('audioUrl')
const sourceName = params.get('sourceName')
if (audioUrl && sourceName) {
  startAnalysis({
    audioUrl,
    sourceName,
    mimeType: params.get('mimeType') || 'application/octet-stream',
  })
}
