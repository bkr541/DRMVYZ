import { createBrowserAudioGoldenFixture } from '../features/musicIntelligence/browserGoldenFixture'

interface GoldenBrowserState {
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

declare global {
  interface Window {
    __DRMVYZ_BROWSER_AUDIO_GOLDEN__: GoldenBrowserState
  }
}

const statusNode = document.querySelector<HTMLPreElement>('#status')

function publish(patch: Partial<GoldenBrowserState>): void {
  window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__ = {
    ...window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__,
    ...patch,
  }
  if (statusNode) statusNode.textContent = JSON.stringify(window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__, null, 2)
}

async function run(): Promise<void> {
  window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__ = { status: 'idle' }
  const params = new URLSearchParams(window.location.search)
  const audioUrl = params.get('audioUrl')
  const sourceName = params.get('sourceName')
  const mimeType = params.get('mimeType') || 'application/octet-stream'

  if (!audioUrl || !sourceName) {
    throw new Error('audioUrl and sourceName query parameters are required.')
  }

  publish({ status: 'fetching', stage: 'fetching_source', progress: 0 })
  const response = await fetch(audioUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Unable to fetch golden source audio: ${response.status} ${response.statusText}`)
  const sourceBytes = await response.arrayBuffer()
  const file = new File([sourceBytes], sourceName, { type: mimeType, lastModified: 0 })

  publish({ status: 'decoding', stage: 'decoding', progress: 0.01 })
  const result = await createBrowserAudioGoldenFixture(file, {
    onProgress: info => publish({
      status: 'analyzing',
      stage: info.stage,
      progress: info.progress,
    }),
  })

  publish({
    status: 'complete',
    stage: 'complete',
    progress: 1,
    canonicalJson: result.canonicalJson,
    runtime: result.runtime,
    volatile: result.volatile,
  })
}

void run().catch(error => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  publish({
    status: 'error',
    error: normalized.message,
    stack: normalized.stack,
  })
})
