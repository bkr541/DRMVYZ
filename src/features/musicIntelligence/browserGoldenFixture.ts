import { CURRENT_ANALYSIS_VERSION } from './analysisVersion'
import { analyzeTrackBuffer } from './offlineTrackAnalyzer'
import type { AnalysisProgressInfo, TrackIntelligenceAnalysis } from './types'
import { analyzeRgbWaveform } from '../waveform/analyzeRgbWaveform'
import {
  RGB_FFT_SIZE,
  RGB_HOP_SIZE,
  RGB_WAVEFORM_BIN_COUNT,
  RGB_WAVEFORM_VERSION,
  type RgbWaveformAnalysis,
} from '../waveform/rgbWaveformTypes'

export const BROWSER_AUDIO_GOLDEN_SCHEMA_VERSION = 1

export interface BrowserAudioGoldenSource {
  filename: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

export interface BrowserAudioGoldenDecodedAudio {
  sampleRate: number
  channelCount: number
  frameCount: number
  durationSec: number
}

export interface BrowserAudioGoldenFixture {
  schemaVersion: number
  source: BrowserAudioGoldenSource
  decodedAudio: BrowserAudioGoldenDecodedAudio
  browserRuntime: {
    userAgent: string
    platform: string
    language: string
    audioContextSampleRate: number
  }
  analyzers: {
    trackAnalysisVersion: string
    trackAnalysisInvocation: 'analyzeTrackBuffer(audioBuffer)'
    trackAnalysisSeed: null
    rgbWaveformVersion: number
    rgbWaveformBinCount: number
    rgbFftSize: number
    rgbHopSize: number
  }
  byteComparison: {
    encoding: 'utf-8'
    serialization: 'sorted-json-v1'
    trailingNewline: true
    excludedVolatileFields: ['trackAnalysis.createdAt']
    payloadSha256: string
  }
  payload: {
    trackAnalysis: Omit<TrackIntelligenceAnalysis, 'createdAt'>
    rgbWaveform: BrowserSerializableRgbWaveformAnalysis
  }
}

export interface BrowserSerializableRgbWaveformAnalysis {
  version: number
  durationSec: number
  sampleRate: number
  binCount: number
  positivePeaks: number[]
  negativePeaks: number[]
  rms: number[]
  lowEnergy: number[]
  midEnergy: number[]
  highEnergy: number[]
}

export interface BrowserAudioGoldenRunResult {
  fixture: BrowserAudioGoldenFixture
  canonicalJson: string
  runtime: {
    userAgent: string
    platform: string
    language: string
    audioContextSampleRate: number
  }
  volatile: {
    trackAnalysisCreatedAt: string
  }
}

export interface BrowserAudioGoldenOptions {
  onProgress?: (progress: AnalysisProgressInfo) => void
  audioContextFactory?: () => AudioContext
}

type JsonPrimitive = string | number | boolean | null

type JsonCompatible =
  | JsonPrimitive
  | JsonCompatible[]
  | { [key: string]: JsonCompatible }

function normalizeJsonValue(value: unknown): JsonCompatible | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'boolean') return value

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Golden fixture cannot serialize non-finite number: ${String(value)}`)
    }
    return Object.is(value, -0) ? 0 : value
  }

  if (typeof value === 'bigint') return value.toString()

  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    }
    return Array.from(value as unknown as ArrayLike<number>).map(item => normalizeJsonValue(item) as JsonCompatible)
  }

  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value))

  if (Array.isArray(value)) {
    return value.map(item => normalizeJsonValue(item) ?? null)
  }

  if (typeof value === 'object') {
    const output: Record<string, JsonCompatible> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b))) {
      const normalized = normalizeJsonValue((value as Record<string, unknown>)[key])
      if (normalized !== undefined) output[key] = normalized
    }
    return output
  }

  throw new Error(`Golden fixture cannot serialize value of type ${typeof value}`)
}

export function canonicalStringifyBrowserAudioGolden(value: unknown): string {
  const normalized = normalizeJsonValue(value)
  if (normalized === undefined) throw new Error('Golden fixture root cannot be undefined.')
  return `${JSON.stringify(normalized, null, 2)}\n`
}

async function sha256Hex(input: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input)
  const digestInput = new Uint8Array(bytes.byteLength)
  digestInput.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', digestInput.buffer)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function serializeRgbWaveform(analysis: RgbWaveformAnalysis): BrowserSerializableRgbWaveformAnalysis {
  return {
    version: analysis.version,
    durationSec: analysis.durationSec,
    sampleRate: analysis.sampleRate,
    binCount: analysis.binCount,
    positivePeaks: Array.from(analysis.positivePeaks),
    negativePeaks: Array.from(analysis.negativePeaks),
    rms: Array.from(analysis.rms),
    lowEnergy: Array.from(analysis.lowEnergy),
    midEnergy: Array.from(analysis.midEnergy),
    highEnergy: Array.from(analysis.highEnergy),
  }
}

export async function createBrowserAudioGoldenFixture(
  file: File,
  options: BrowserAudioGoldenOptions = {},
): Promise<BrowserAudioGoldenRunResult> {
  const sourceBytes = await file.arrayBuffer()
  const sourceSha256 = await sha256Hex(sourceBytes)
  const context = options.audioContextFactory?.() ?? new AudioContext()

  try {
    // This intentionally mirrors useAudioEngine's production decode path:
    // a browser AudioContext decodes the original file bytes and the resulting
    // AudioBuffer is passed directly into DRMVYZ's existing analyzers.
    const audioBuffer = await context.decodeAudioData(sourceBytes.slice(0))
    const trackAnalysis = await analyzeTrackBuffer(audioBuffer, {
      onProgress: options.onProgress,
    })
    const rgbWaveform = await analyzeRgbWaveform(audioBuffer)
    const { createdAt, ...stableTrackAnalysis } = trackAnalysis

    const payload = {
      trackAnalysis: stableTrackAnalysis,
      rgbWaveform: serializeRgbWaveform(rgbWaveform),
    }
    const payloadSha256 = await sha256Hex(canonicalStringifyBrowserAudioGolden(payload))

    const browserRuntime = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      audioContextSampleRate: context.sampleRate,
    }

    const fixture: BrowserAudioGoldenFixture = {
      schemaVersion: BROWSER_AUDIO_GOLDEN_SCHEMA_VERSION,
      source: {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        sha256: sourceSha256,
      },
      decodedAudio: {
        sampleRate: audioBuffer.sampleRate,
        channelCount: audioBuffer.numberOfChannels,
        frameCount: audioBuffer.length,
        durationSec: audioBuffer.duration,
      },
      browserRuntime,
      analyzers: {
        trackAnalysisVersion: CURRENT_ANALYSIS_VERSION,
        trackAnalysisInvocation: 'analyzeTrackBuffer(audioBuffer)',
        trackAnalysisSeed: null,
        rgbWaveformVersion: RGB_WAVEFORM_VERSION,
        rgbWaveformBinCount: RGB_WAVEFORM_BIN_COUNT,
        rgbFftSize: RGB_FFT_SIZE,
        rgbHopSize: RGB_HOP_SIZE,
      },
      byteComparison: {
        encoding: 'utf-8',
        serialization: 'sorted-json-v1',
        trailingNewline: true,
        excludedVolatileFields: ['trackAnalysis.createdAt'],
        payloadSha256,
      },
      payload,
    }

    return {
      fixture,
      canonicalJson: canonicalStringifyBrowserAudioGolden(fixture),
      runtime: browserRuntime,
      volatile: {
        trackAnalysisCreatedAt: createdAt,
      },
    }
  } finally {
    await context.close().catch(() => undefined)
  }
}
