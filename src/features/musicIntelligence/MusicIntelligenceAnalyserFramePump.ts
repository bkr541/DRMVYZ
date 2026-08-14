import { AudioFeatureBus } from './AudioFeatureBus'
import { musicIntelligenceEngine, type MusicIntelligenceEngine } from './MusicIntelligenceEngine'
import type { MusicIntelligenceFrame } from './types'

export type MusicIntelligenceAnalyserAnalysisMode = 'default' | 'live-input'

export interface MusicIntelligenceAnalyserFramePumpInput {
  analyser: AnalyserNode | null
  audioTime: number
  isPlaying: boolean
  trackIdentity?: string | null
  /** Live Input-only analysis gain. 1 preserves the captured analyser values. */
  analysisSensitivity?: number
  /** Live Input-only normalized RMS floor. Frames below this floor are treated as silence. */
  analysisNoiseGate?: number
}

export interface MusicIntelligenceAnalyserFramePumpDiagnostics {
  sampleCount: number
  reusedBufferCount: number
  skippedDuplicateCount: number
  skippedAuthorityCount: number
  frequencyBufferLength: number
  timeDomainBufferLength: number
}

export interface MusicIntelligenceAnalyserFramePumpOptions {
  publisherId: string
  freshnessWindowMs?: number
  now?: () => number
  engine?: Pick<MusicIntelligenceEngine, 'updateFromAudioFrame'>
  analysisMode?: MusicIntelligenceAnalyserAnalysisMode
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function finiteAudioTime(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback
}

function frameIdentityMatches(frame: MusicIntelligenceFrame, trackIdentity: string | null | undefined): boolean {
  if (!trackIdentity) return true
  return frame.trackId === trackIdentity || frame.sourceId === trackIdentity
}

function frameTimeMatches(frame: MusicIntelligenceFrame, audioTime: number): boolean {
  return Math.abs(frame.timeSec - audioTime) <= 1 / 120
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

/**
 * Shape the canonical Live Input analyser snapshot before Music Intelligence
 * derives bands/events/tempo from it. This never touches the Web Audio graph,
 * so these controls cannot enable monitoring or change program output level.
 */
export function shapeLiveInputAnalysisBuffers(
  frequencyData: Uint8Array,
  timeDomainData: Uint8Array,
  sensitivity = 1,
  noiseGate = 0,
): void {
  const gain = clamp(sensitivity, 0.25, 4)
  const gate = clamp(noiseGate, 0, 0.5)

  let sumSquares = 0
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const centered = (timeDomainData[i]! - 128) / 128
    sumSquares += centered * centered
  }
  const rms = timeDomainData.length > 0 ? Math.sqrt(sumSquares / timeDomainData.length) : 0
  if (rms < gate) {
    frequencyData.fill(0)
    timeDomainData.fill(128)
    return
  }

  if (gain === 1) return
  for (let i = 0; i < frequencyData.length; i += 1) {
    frequencyData[i] = Math.round(clamp(frequencyData[i]! * gain, 0, 255))
  }
  for (let i = 0; i < timeDomainData.length; i += 1) {
    const centered = (timeDomainData[i]! - 128) * gain
    timeDomainData[i] = Math.round(clamp(128 + centered, 0, 255))
  }
}

/**
 * Reusable analyser-to-Music-Intelligence bridge for renderer-owned animation loops.
 * It only samples raw Web Audio buffers and delegates all analysis/publication to the
 * canonical MusicIntelligenceEngine singleton.
 */
export class MusicIntelligenceAnalyserFramePump {
  private readonly publisherId: string
  private readonly freshnessWindowMs: number
  private readonly now: () => number
  private readonly engine: Pick<MusicIntelligenceEngine, 'updateFromAudioFrame'>
  private readonly analysisMode: MusicIntelligenceAnalyserAnalysisMode
  private analyser: AnalyserNode | null = null
  private trackIdentity: string | null = null
  private frequencyData: Uint8Array<ArrayBuffer> | null = null
  private timeDomainData: Uint8Array<ArrayBuffer> | null = null
  private lastAudioTime = 0
  private lastPlaybackState = false
  private lastPublishedFrameId = 0
  private disposed = false
  private sampleCount = 0
  private reusedBufferCount = 0
  private skippedDuplicateCount = 0
  private skippedAuthorityCount = 0

  constructor(options: MusicIntelligenceAnalyserFramePumpOptions) {
    this.publisherId = options.publisherId
    this.freshnessWindowMs = Math.max(0, options.freshnessWindowMs ?? 4)
    this.now = options.now ?? monotonicNow
    this.engine = options.engine ?? musicIntelligenceEngine
    this.analysisMode = options.analysisMode ?? 'default'
  }

  sample(input: MusicIntelligenceAnalyserFramePumpInput): MusicIntelligenceFrame {
    const current = AudioFeatureBus.getFrame()
    if (this.disposed || !input.analyser) return current
    if (!AudioFeatureBus.canPublishFrame(this.publisherId)) {
      this.skippedAuthorityCount += 1
      return current
    }

    const trackIdentity = input.trackIdentity ?? null
    if (this.analyser !== input.analyser || this.trackIdentity !== trackIdentity) {
      this.analyser = input.analyser
      this.trackIdentity = trackIdentity
      this.frequencyData = null
      this.timeDomainData = null
      this.lastPublishedFrameId = 0
      this.lastAudioTime = finiteAudioTime(input.audioTime, current.timeSec)
      this.lastPlaybackState = input.isPlaying
    }

    const analyser = input.analyser
    const audioTime = finiteAudioTime(input.audioTime, this.lastAudioTime)
    const sampleRate = analyser.context.sampleRate > 0 ? analyser.context.sampleRate : current.sampleRate
    const publication = AudioFeatureBus.getFramePublicationMeta()
    const sameOwnPublication = publication.publisherId === this.publisherId
      && current.frameId === this.lastPublishedFrameId
      && frameTimeMatches(current, audioTime)
      && this.lastPlaybackState === input.isPlaying
    const freshExternalPublication = publication.kind === 'frame'
      && publication.publisherId !== this.publisherId
      && current.frameId > 0
      && this.now() - publication.publishedAtMs <= this.freshnessWindowMs
      && current.sampleRate === sampleRate
      && current.raw.freqData != null
      && current.raw.timeDomainData != null
      && frameIdentityMatches(current, trackIdentity)
      && frameTimeMatches(current, audioTime)

    if (sameOwnPublication || freshExternalPublication) {
      this.skippedDuplicateCount += 1
      this.lastAudioTime = audioTime
      this.lastPlaybackState = input.isPlaying
      return current
    }

    const frequencyLength = Math.max(1, analyser.frequencyBinCount)
    if (!this.frequencyData || this.frequencyData.length !== frequencyLength) {
      this.frequencyData = new Uint8Array(frequencyLength) as Uint8Array<ArrayBuffer>
    } else {
      this.reusedBufferCount += 1
    }
    const timeDomainLength = Math.max(1, analyser.fftSize)
    if (!this.timeDomainData || this.timeDomainData.length !== timeDomainLength) {
      this.timeDomainData = new Uint8Array(timeDomainLength) as Uint8Array<ArrayBuffer>
    } else {
      this.reusedBufferCount += 1
    }

    analyser.getByteFrequencyData(this.frequencyData)
    analyser.getByteTimeDomainData(this.timeDomainData)
    if (this.analysisMode === 'live-input') {
      shapeLiveInputAnalysisBuffers(
        this.frequencyData,
        this.timeDomainData,
        input.analysisSensitivity,
        input.analysisNoiseGate,
      )
    }
    this.engine.updateFromAudioFrame({
      freqBuf: this.frequencyData,
      timeBuf: this.timeDomainData,
      sampleRate,
      audioTime,
      isPlaying: input.isPlaying,
      publisherId: this.publisherId,
      analysisMode: this.analysisMode,
    })

    const published = AudioFeatureBus.getFrame()
    this.sampleCount += 1
    this.lastAudioTime = audioTime
    this.lastPlaybackState = input.isPlaying
    this.lastPublishedFrameId = published.frameId
    return published
  }

  reset(): void {
    this.analyser = null
    this.trackIdentity = null
    this.frequencyData = null
    this.timeDomainData = null
    this.lastAudioTime = 0
    this.lastPlaybackState = false
    this.lastPublishedFrameId = 0
  }

  dispose(): void {
    this.disposed = true
    this.reset()
  }

  get diagnostics(): MusicIntelligenceAnalyserFramePumpDiagnostics {
    return {
      sampleCount: this.sampleCount,
      reusedBufferCount: this.reusedBufferCount,
      skippedDuplicateCount: this.skippedDuplicateCount,
      skippedAuthorityCount: this.skippedAuthorityCount,
      frequencyBufferLength: this.frequencyData?.length ?? 0,
      timeDomainBufferLength: this.timeDomainData?.length ?? 0,
    }
  }
}
