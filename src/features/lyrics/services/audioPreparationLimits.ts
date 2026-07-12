export const AUDIO_PREPARATION_LIMITS = {
  browser: {
    maxSourceBytes: 256 * 1024 * 1024,
    maxUnknownLengthBytes: 96 * 1024 * 1024,
    maxDurationSeconds: 45 * 60,
    maxDecodedPcmBytes: 512 * 1024 * 1024,
    maxPeakBytes: 768 * 1024 * 1024,
    maxResampleWork: 120_000_000,
    maxChannels: 8,
  },
  electron: {
    maxSourceBytes: 384 * 1024 * 1024,
    maxUnknownLengthBytes: 128 * 1024 * 1024,
    maxDurationSeconds: 60 * 60,
    maxDecodedPcmBytes: 768 * 1024 * 1024,
    maxPeakBytes: 1024 * 1024 * 1024,
    maxResampleWork: 180_000_000,
    maxChannels: 8,
  },
  targetSampleRate: 16_000,
  targetChannels: 1,
  targetBytesPerSample: 2,
  floatBytesPerSample: 4,
  wavHeaderBytes: 44,
  targetChunkBytes: 20 * 1024 * 1024,
} as const

export type AudioPreparationEnvironment = 'browser' | 'electron'

export interface AudioPreparationEstimateInput {
  sourceBytes: number
  durationSeconds: number | null
  sourceSampleRate: number | null
  sourceChannels: number | null
  contentLengthKnown?: boolean
}

export interface AudioPreparationWorkloadEstimate {
  environment: AudioPreparationEnvironment
  sourceBytes: number
  durationSeconds: number | null
  sourceSampleRate: number | null
  sourceChannels: number | null
  decodedPcmBytes: number | null
  targetPcmBytes: number | null
  expectedWavBytes: number | null
  chunkCount: number | null
  chunkBytes: number | null
  temporaryCopyBytes: number
  expectedPeakBytes: number
  resampleWork: number | null
}

export interface AudioPreparationLimitFailure {
  factor: 'source-size' | 'unknown-source-size' | 'duration' | 'channels' | 'decoded-pcm' | 'resampling-work' | 'peak-memory'
  message: string
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function detectAudioPreparationEnvironment(): AudioPreparationEnvironment {
  // Only trust the preload-injected runtime capability. A user-agent string is
  // client-controlled and must not unlock the larger Electron memory budget.
  if (typeof window !== 'undefined' && window.drmvyzNative?.runtime?.isElectron === true) return 'electron'
  return 'browser'
}

export function estimateAudioPreparationWorkload(
  input: AudioPreparationEstimateInput,
  environment = detectAudioPreparationEnvironment(),
): AudioPreparationWorkloadEstimate {
  const sourceBytes = Math.max(0, Math.floor(input.sourceBytes || 0))
  const durationSeconds = finitePositive(input.durationSeconds)
  const sourceSampleRate = finitePositive(input.sourceSampleRate)
  const sourceChannels = finitePositive(input.sourceChannels)

  const decodedPcmBytes = durationSeconds && sourceSampleRate && sourceChannels
    ? Math.ceil(durationSeconds * sourceSampleRate * sourceChannels * AUDIO_PREPARATION_LIMITS.floatBytesPerSample)
    : null
  const targetPcmBytes = durationSeconds
    ? Math.ceil(durationSeconds * AUDIO_PREPARATION_LIMITS.targetSampleRate * AUDIO_PREPARATION_LIMITS.targetChannels * AUDIO_PREPARATION_LIMITS.floatBytesPerSample)
    : null
  const expectedWavBytes = durationSeconds
    ? Math.ceil(durationSeconds * AUDIO_PREPARATION_LIMITS.targetSampleRate * AUDIO_PREPARATION_LIMITS.targetChannels * AUDIO_PREPARATION_LIMITS.targetBytesPerSample)
      + AUDIO_PREPARATION_LIMITS.wavHeaderBytes
    : null
  const chunkCount = expectedWavBytes
    ? Math.max(1, Math.ceil(expectedWavBytes / AUDIO_PREPARATION_LIMITS.targetChunkBytes))
    : null
  const chunkBytes = expectedWavBytes && chunkCount
    ? Math.min(AUDIO_PREPARATION_LIMITS.targetChunkBytes, expectedWavBytes)
    : null
  const resampleWork = durationSeconds && sourceSampleRate && sourceChannels
    ? Math.ceil(durationSeconds * sourceSampleRate * sourceChannels)
    : null

  // Conservative renderer-process peaks. Known Content-Length downloads are
  // preallocated, while unknown-length streams retain chunks plus one final copy.
  const downloadCopies = input.contentLengthKnown === false ? 2 : 1.15
  const downloadPeak = Math.ceil(sourceBytes * downloadCopies)
  const decodePeak = Math.ceil(sourceBytes + (decodedPcmBytes ?? sourceBytes * 8) * 1.35)
  const resamplePeak = Math.ceil(sourceBytes + (decodedPcmBytes ?? 0) + (targetPcmBytes ?? 0) * 1.2)
  const encodingPeak = Math.ceil((targetPcmBytes ?? 0) + (chunkBytes ?? 0) * 2.25)
  const expectedPeakBytes = Math.max(downloadPeak, decodePeak, resamplePeak, encodingPeak)
  const temporaryCopyBytes = Math.max(0, expectedPeakBytes - sourceBytes - (decodedPcmBytes ?? 0))

  return {
    environment,
    sourceBytes,
    durationSeconds,
    sourceSampleRate,
    sourceChannels,
    decodedPcmBytes,
    targetPcmBytes,
    expectedWavBytes,
    chunkCount,
    chunkBytes,
    temporaryCopyBytes,
    expectedPeakBytes,
    resampleWork,
  }
}

function formatBytes(bytes: number): string {
  const mib = bytes / (1024 * 1024)
  return `${Math.max(1, Math.round(mib))} MiB`
}

function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} minutes`
}

export function audioPreparationLimitFailure(
  estimate: AudioPreparationWorkloadEstimate,
  contentLengthKnown = true,
): AudioPreparationLimitFailure | null {
  const limits = AUDIO_PREPARATION_LIMITS[estimate.environment]
  if (estimate.sourceBytes > limits.maxSourceBytes) {
    return {
      factor: 'source-size',
      message: `This source is ${formatBytes(estimate.sourceBytes)}, above the safe ${formatBytes(limits.maxSourceBytes)} renderer limit. Trim the mix or convert it to smaller mono WAV sections before retrying.`,
    }
  }
  if (!contentLengthKnown && estimate.sourceBytes > limits.maxUnknownLengthBytes) {
    return {
      factor: 'unknown-source-size',
      message: `The server did not report the file size and the download exceeded the conservative ${formatBytes(limits.maxUnknownLengthBytes)} streaming limit. Use a shorter export with a known size.`,
    }
  }
  if (estimate.durationSeconds && estimate.durationSeconds > limits.maxDurationSeconds) {
    return {
      factor: 'duration',
      message: `This track is about ${formatMinutes(estimate.durationSeconds)}, above the safe ${formatMinutes(limits.maxDurationSeconds)} browser-preparation limit. Split the DJ mix into shorter sections.`,
    }
  }
  if (estimate.sourceChannels && estimate.sourceChannels > limits.maxChannels) {
    return {
      factor: 'channels',
      message: `This file has ${estimate.sourceChannels} channels. Browser preparation supports at most ${limits.maxChannels}; export a stereo or mono copy.`,
    }
  }
  if (estimate.decodedPcmBytes && estimate.decodedPcmBytes > limits.maxDecodedPcmBytes) {
    return {
      factor: 'decoded-pcm',
      message: `Decoding would expand this file to about ${formatBytes(estimate.decodedPcmBytes)} of PCM, above the safe ${formatBytes(limits.maxDecodedPcmBytes)} limit. Export a shorter or lower-sample-rate copy.`,
    }
  }
  if (estimate.resampleWork && estimate.resampleWork > limits.maxResampleWork) {
    return {
      factor: 'resampling-work',
      message: `The channel, duration, and sample-rate combination would require excessive resampling work. Export a shorter stereo or mono file at 48 kHz or lower.`,
    }
  }
  if (estimate.expectedPeakBytes > limits.maxPeakBytes) {
    return {
      factor: 'peak-memory',
      message: `Preparation could peak near ${formatBytes(estimate.expectedPeakBytes)} of renderer memory, above the safe ${formatBytes(limits.maxPeakBytes)} limit. Split or downsample the source before retrying.`,
    }
  }
  return null
}

export class AudioPreparationLimitError extends Error {
  readonly name = 'AudioPreparationLimitError'

  constructor(
    readonly estimate: AudioPreparationWorkloadEstimate,
    readonly factor: AudioPreparationLimitFailure['factor'],
    message: string,
  ) {
    super(message)
  }
}

export function assertSafeAudioPreparation(
  input: AudioPreparationEstimateInput,
  environment = detectAudioPreparationEnvironment(),
): AudioPreparationWorkloadEstimate {
  const estimate = estimateAudioPreparationWorkload(input, environment)
  const failure = audioPreparationLimitFailure(estimate, input.contentLengthKnown !== false)
  if (failure) throw new AudioPreparationLimitError(estimate, failure.factor, failure.message)
  return estimate
}
