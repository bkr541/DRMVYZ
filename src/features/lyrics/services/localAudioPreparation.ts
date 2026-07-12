import { supabase } from '../../../lib/supabase'
import {
  beginAudioPreparation,
  finalizeAudioPreparationManifest,
  getAudioPreparationOperation,
  markAudioPreparationChunkUploaded,
  preparedAudioPathExists,
  recordAudioPreparationCleanup,
  recordAudioPreparationSupersededCleanup,
  removePreparedAudioPath,
  uploadPreparedAudioChunk,
} from '../../../lib/audioPreparationDb'
import type { AudioPreparationOperationRow } from '../../../types/database'
import type { PreparedTranscriptionAudioChunk, PreparedTranscriptionAudioManifest } from '../../../types/audio'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import {
  AUDIO_PREPARATION_LIMITS,
  assertSafeAudioPreparation,
  detectAudioPreparationEnvironment,
  type AudioPreparationEnvironment,
} from './audioPreparationLimits'

const AUDIO_BUCKET = 'audio-tracks'
const PREPARED_AUDIO_VERSION = 'browser-pcm16-v2' as const
const TARGET_SAMPLE_RATE = AUDIO_PREPARATION_LIMITS.targetSampleRate
const TARGET_CHANNELS = AUDIO_PREPARATION_LIMITS.targetChannels
const BITS_PER_SAMPLE = 16
const BYTES_PER_SAMPLE = AUDIO_PREPARATION_LIMITS.targetBytesPerSample
const WAV_HEADER_BYTES = AUDIO_PREPARATION_LIMITS.wavHeaderBytes
const TARGET_CHUNK_BYTES = AUDIO_PREPARATION_LIMITS.targetChunkBytes
const CHUNK_OVERLAP_SECONDS = 3

// Server routing thresholds. Tracks below these values never enter the browser
// preparation path and remain on the secure direct/server-WAV routes.
const SAFE_DIRECT_BYTES = 20 * 1024 * 1024
const SERVER_DOWNLOAD_LIMIT = 100 * 1024 * 1024

export interface LocalAudioPreparationProgress {
  stage: 'preflight' | 'downloading' | 'decoding' | 'planning' | 'encoding' | 'uploading' | 'saving' | 'cleanup' | 'complete'
  progress: number
  chunkIndex?: number | null
  chunkTotal?: number | null
}

export interface EnsurePreparedTranscriptionAudioOptions {
  signal?: AbortSignal
  onProgress?: (progress: LocalAudioPreparationProgress) => void
  force?: boolean
  /** Operation ownership guard supplied by the UI for track/account/unmount changes. */
  isCurrent?: () => boolean
}

export interface EnsurePreparedTranscriptionAudioResult {
  prepared: boolean
  operationId?: string
  reused?: boolean
}

interface ChunkPlan {
  frameStart: number
  frameEnd: number
  overlapBeforeFrames: number
  overlapAfterFrames: number
}

interface DecodedAudio {
  pcm: Float32Array
  durationMs: number
  sourceSampleRate: number
  sourceChannels: number
}

interface ChunkEncoder {
  encode(index: number): Promise<ArrayBuffer>
  terminate(): void
}

function needsLocalPreparation(track: LyricManagerTrack): boolean {
  const size = track.fileSizeByte ?? 0
  if (size <= 0 || size <= SAFE_DIRECT_BYTES) return false
  const mime = (track.mimeType ?? '').toLowerCase()
  const ext = (track.fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
  const isWav = mime.includes('wav') || ext === 'wav'
  return !(isWav && size <= SERVER_DOWNLOAD_LIMIT)
}

function isValidExistingManifest(manifest: PreparedTranscriptionAudioManifest | null): boolean {
  return (
    manifest !== null
    && (manifest.version === 'browser-pcm16-v1' || manifest.version === PREPARED_AUDIO_VERSION)
    && manifest.chunks.length > 0
    && manifest.sampleRate === TARGET_SAMPLE_RATE
    && manifest.channels === TARGET_CHANNELS
    && manifest.bitsPerSample === BITS_PER_SAMPLE
  )
}

function createOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16)
    const digit = character === 'x' ? value : (value & 0x3) | 0x8
    return digit.toString(16)
  })
}

function cancelled(signal: AbortSignal | undefined, isCurrent: (() => boolean) | undefined): boolean {
  return signal?.aborted === true || (isCurrent ? !isCurrent() : false)
}

function throwIfCancelled(signal: AbortSignal | undefined, isCurrent?: () => boolean): void {
  if (cancelled(signal, isCurrent)) throw new DOMException('Audio preparation was cancelled.', 'AbortError')
}

function phaseError(phase: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unexpected preparation failure.'
  return new Error(`${phase} failed: ${message}`)
}

function assertTrackPreflight(track: LyricManagerTrack, environment: AudioPreparationEnvironment): void {
  assertSafeAudioPreparation({
    sourceBytes: track.fileSizeByte ?? 0,
    durationSeconds: track.durationSec,
    sourceSampleRate: track.sampleRate,
    sourceChannels: track.channels,
    contentLengthKnown: (track.fileSizeByte ?? 0) > 0,
  }, environment)
}

async function downloadWithProgress(
  url: string,
  expectedBytes: number | null,
  signal: AbortSignal | undefined,
  isCurrent: (() => boolean) | undefined,
  environment: AudioPreparationEnvironment,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Audio download failed (${response.status}).`)

  const headerBytes = Number(response.headers.get('content-length'))
  const knownLength = Number.isFinite(headerBytes) && headerBytes > 0 ? Math.floor(headerBytes) : null
  if (knownLength !== null && expectedBytes !== null && expectedBytes > 0 && knownLength !== expectedBytes) {
    await response.body?.cancel()
    throw new Error('The stored audio size changed after its metadata was loaded. Refresh the library and retry.')
  }
  const declaredBytes = knownLength ?? expectedBytes
  if (declaredBytes && declaredBytes > 0) {
    assertSafeAudioPreparation({
      sourceBytes: declaredBytes,
      durationSeconds: null,
      sourceSampleRate: null,
      sourceChannels: null,
      contentLengthKnown: knownLength !== null,
    }, environment)
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    assertSafeAudioPreparation({
      sourceBytes: buffer.byteLength,
      durationSeconds: null,
      sourceSampleRate: null,
      sourceChannels: null,
      contentLengthKnown: knownLength !== null,
    }, environment)
    if (expectedBytes !== null && expectedBytes > 0 && buffer.byteLength !== expectedBytes) {
      throw new Error('The downloaded audio no longer matches its canonical size. Refresh the library and retry.')
    }
    onProgress(1)
    return buffer
  }

  const reader = response.body.getReader()
  if (knownLength !== null) {
    const result = new Uint8Array(knownLength)
    let received = 0
    for (;;) {
      throwIfCancelled(signal, isCurrent)
      const { done, value } = await reader.read()
      if (done) break
      if (received + value.length > result.length) {
        await reader.cancel()
        throw new Error('The audio download exceeded its declared size.')
      }
      result.set(value, received)
      received += value.length
      onProgress(Math.min(1, received / knownLength))
    }
    if (received !== result.length) throw new Error('The audio download ended before its declared size was received.')
    return result.buffer
  }

  // Unknown-length streams are capped much more aggressively. The chunks and
  // final ArrayBuffer coexist briefly, so the workload model accounts for 2x.
  const chunks: Uint8Array[] = []
  let received = 0
  const unknownLimit = AUDIO_PREPARATION_LIMITS[environment].maxUnknownLengthBytes
  for (;;) {
    throwIfCancelled(signal, isCurrent)
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    if (received > unknownLimit) {
      await reader.cancel()
      assertSafeAudioPreparation({
        sourceBytes: received,
        durationSeconds: null,
        sourceSampleRate: null,
        sourceChannels: null,
        contentLengthKnown: false,
      }, environment)
      throw new Error('The unknown-length audio download exceeded the safe renderer limit.')
    }
    chunks.push(value)
    onProgress(Math.min(0.99, received / unknownLimit))
  }
  assertSafeAudioPreparation({
    sourceBytes: received,
    durationSeconds: null,
    sourceSampleRate: null,
    sourceChannels: null,
    contentLengthKnown: false,
  }, environment)
  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  chunks.length = 0
  onProgress(1)
  return merged.buffer
}

async function decodeAndResampleToMono16k(
  arrayBuffer: ArrayBuffer,
  signal: AbortSignal | undefined,
  isCurrent: (() => boolean) | undefined,
  environment: AudioPreparationEnvironment,
): Promise<DecodedAudio> {
  throwIfCancelled(signal, isCurrent)
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    // decodeAudioData itself is not abortable in browsers. Ownership is checked
    // immediately before and after so a cancelled decode cannot advance.
    decoded = await context.decodeAudioData(arrayBuffer)
  } catch (error) {
    if (cancelled(signal, isCurrent)) throw new DOMException('Audio preparation was cancelled.', 'AbortError')
    throw new Error(
      error instanceof Error && /memory|allocation/i.test(error.message)
        ? 'Browser audio decoding ran out of safe renderer memory. Convert the track to a shorter mono or stereo WAV.'
        : 'This audio file could not be decoded in the browser. Convert it to MP3, M4A, WAV, or OGG, or use the configured secure server fallback.',
    )
  } finally {
    void context.close()
  }
  throwIfCancelled(signal, isCurrent)

  const actualEstimate = assertSafeAudioPreparation({
    sourceBytes: arrayBuffer.byteLength,
    durationSeconds: decoded.duration,
    sourceSampleRate: decoded.sampleRate,
    sourceChannels: decoded.numberOfChannels,
    contentLengthKnown: true,
  }, environment)
  const targetFrames = Math.max(1, Math.ceil((actualEstimate.durationSeconds ?? decoded.duration) * TARGET_SAMPLE_RATE))
  const offline = new OfflineAudioContext(TARGET_CHANNELS, targetFrames, TARGET_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  source.disconnect()
  source.buffer = null
  throwIfCancelled(signal, isCurrent)

  return {
    pcm: rendered.getChannelData(0),
    durationMs: Math.round(rendered.duration * 1000),
    sourceSampleRate: decoded.sampleRate,
    sourceChannels: decoded.numberOfChannels,
  }
}

function planChunks(totalFrames: number): ChunkPlan[] {
  const overlapFrames = Math.round(CHUNK_OVERLAP_SECONDS * TARGET_SAMPLE_RATE)
  const contentFramesPerChunk = Math.floor((TARGET_CHUNK_BYTES - WAV_HEADER_BYTES) / BYTES_PER_SAMPLE)
  const plans: ChunkPlan[] = []
  let contentStart = 0
  while (contentStart < totalFrames) {
    const contentEnd = Math.min(contentStart + contentFramesPerChunk, totalFrames)
    const overlapBefore = contentStart > 0 ? Math.min(overlapFrames, contentStart) : 0
    const overlapAfter = contentEnd < totalFrames ? Math.min(overlapFrames, totalFrames - contentEnd) : 0
    plans.push({
      frameStart: contentStart - overlapBefore,
      frameEnd: contentEnd + overlapAfter,
      overlapBeforeFrames: overlapBefore,
      overlapAfterFrames: overlapAfter,
    })
    contentStart = contentEnd
  }
  return plans
}

function encodePcm16Wav(pcm: Float32Array, plan: ChunkPlan): ArrayBuffer {
  const frameCount = Math.max(0, plan.frameEnd - plan.frameStart)
  const dataBytes = frameCount * BYTES_PER_SAMPLE
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const view = new DataView(buffer)
  view.setUint32(0, 0x52494646, false)
  view.setUint32(4, buffer.byteLength - 8, true)
  view.setUint32(8, 0x57415645, false)
  view.setUint32(12, 0x666d7420, false)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, TARGET_CHANNELS, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * TARGET_CHANNELS * BYTES_PER_SAMPLE, true)
  view.setUint16(32, TARGET_CHANNELS * BYTES_PER_SAMPLE, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  view.setUint32(36, 0x64617461, false)
  view.setUint32(40, dataBytes, true)
  let byteOffset = WAV_HEADER_BYTES
  for (let frame = plan.frameStart; frame < plan.frameEnd; frame += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[frame] ?? 0))
    view.setInt16(byteOffset, Math.round(sample * 32767), true)
    byteOffset += BYTES_PER_SAMPLE
  }
  return buffer
}

async function createChunkEncoder(
  operationId: string,
  pcm: Float32Array,
  plans: ChunkPlan[],
  signal?: AbortSignal,
): Promise<ChunkEncoder> {
  if (typeof Worker === 'undefined') {
    return {
      encode: async index => encodePcm16Wav(pcm, plans[index]),
      terminate: () => undefined,
    }
  }

  const worker = new Worker(new URL('./localAudioPreparation.worker.ts', import.meta.url), { type: 'module' })
  let terminated = false
  let rejectReady: ((error: Error) => void) | null = null
  let pending: {
    index: number
    resolve(buffer: ArrayBuffer): void
    reject(error: Error): void
  } | null = null
  const abortWorker = () => {
    if (terminated) return
    terminated = true
    signal?.removeEventListener('abort', abortWorker)
    const abortError = new DOMException('Audio preparation was cancelled.', 'AbortError') as unknown as Error
    if (rejectReady) {
      rejectReady(abortError)
      rejectReady = null
    }
    if (pending) {
      pending.reject(abortError)
      pending = null
    }
    worker.postMessage({ type: 'cancel', operationId })
    worker.terminate()
  }
  signal?.addEventListener('abort', abortWorker, { once: true })

  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject
    const handleReady = (event: MessageEvent) => {
      const message = event.data as { type?: string; operationId?: string; message?: string }
      if (message.operationId !== operationId) return
      if (message.type === 'ready') {
        worker.removeEventListener('message', handleReady)
        rejectReady = null
        resolve()
      } else if (message.type === 'error') {
        worker.removeEventListener('message', handleReady)
        rejectReady = null
        reject(new Error(message.message ?? 'Audio worker initialization failed.'))
      }
    }
    worker.addEventListener('message', handleReady)
    worker.addEventListener('error', event => {
      rejectReady = null
      reject(new Error(event.message || 'Audio worker failed to start.'))
    }, { once: true })
  })

  worker.addEventListener('message', event => {
    const message = event.data as { type?: string; operationId?: string; index?: number; wavBuffer?: ArrayBuffer; message?: string }
    if (message.operationId !== operationId || !pending || message.index !== pending.index) return
    const current = pending
    pending = null
    if (message.type === 'encoded' && message.wavBuffer instanceof ArrayBuffer) current.resolve(message.wavBuffer)
    else current.reject(new Error(message.message ?? 'Chunk encoding failed.'))
  })
  worker.addEventListener('error', event => {
    if (!pending) return
    const current = pending
    pending = null
    current.reject(new Error(event.message || 'Audio worker failed.'))
  })

  worker.postMessage({
    type: 'init',
    operationId,
    pcmBuffer: pcm.buffer,
    pcmByteOffset: pcm.byteOffset,
    pcmLength: pcm.length,
    sampleRate: TARGET_SAMPLE_RATE,
    channels: TARGET_CHANNELS,
    bitsPerSample: BITS_PER_SAMPLE,
    plans: plans.map(({ frameStart, frameEnd }) => ({ frameStart, frameEnd })),
  }, [pcm.buffer])
  try {
    await ready
  } catch (error) {
    abortWorker()
    throw error
  }

  return {
    encode(index) {
      if (terminated) return Promise.reject(new Error('Audio worker has been terminated.'))
      if (pending) return Promise.reject(new Error('Audio worker received overlapping chunk requests.'))
      return new Promise<ArrayBuffer>((resolve, reject) => {
        pending = { index, resolve, reject }
        worker.postMessage({ type: 'encode', operationId, index })
      })
    },
    terminate() {
      signal?.removeEventListener('abort', abortWorker)
      abortWorker()
    },
  }
}

function chunkFileName(trackFileName: string, index: number): string {
  const dot = trackFileName.lastIndexOf('.')
  const base = dot > 0 ? trackFileName.slice(0, dot) : trackFileName
  return `${base}.transcription-${String(index).padStart(3, '0')}.wav`
}

function uploadedIndexSet(operation: AudioPreparationOperationRow): Set<number> {
  return new Set(operation.uploaded_chunks.map(chunk => chunk.index))
}

async function cleanupOperation(
  operation: AudioPreparationOperationRow,
  finalStatus: 'failed' | 'cancelled',
  errorMessage: string,
  onProgress?: (progress: LocalAudioPreparationProgress) => void,
): Promise<boolean> {
  const completed = new Set(operation.cleanup_completed_indices)
  const intended = operation.intended_paths.map((path, index) => ({ index, path }))
  let cleanupError: string | null = null

  // Remove every deterministic path, not only chunks whose upload response was
  // recorded. This reconciles ambiguous upload responses and cancellation that
  // lands between storage commit and operation-ledger commit.
  for (let position = 0; position < intended.length; position += 1) {
    const chunk = intended[position]
    if (completed.has(chunk.index)) continue
    onProgress?.({ stage: 'cleanup', progress: intended.length ? position / intended.length : 1, chunkIndex: position + 1, chunkTotal: intended.length })
    try {
      await removePreparedAudioPath(chunk.path)
      completed.add(chunk.index)
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : 'Prepared chunk cleanup failed.'
      break
    }
  }

  const allCleaned = intended.every(chunk => completed.has(chunk.index))
  try {
    await recordAudioPreparationCleanup(
      operation.operation_id,
      [...completed],
      allCleaned ? finalStatus : 'cleanup_pending',
      cleanupError ?? errorMessage,
    )
  } catch (recordError) {
    console.error('[localAudioPreparation] cleanup state recording failed:', recordError)
    return false
  }
  return allCleaned
}

export async function rollbackPreparedTranscriptionAudio(
  operationId: string,
  reason: string,
  status: 'failed' | 'cancelled' = 'failed',
): Promise<boolean> {
  const operation = await getAudioPreparationOperation(operationId)
  if (!operation) return true
  if (operation.status === 'job_created' || operation.job_id) return false
  return cleanupOperation(operation, status, reason)
}

export async function ensurePreparedTranscriptionAudio(
  track: LyricManagerTrack,
  options: EnsurePreparedTranscriptionAudioOptions = {},
): Promise<EnsurePreparedTranscriptionAudioResult> {
  const { signal, onProgress, force = false, isCurrent } = options
  if (!needsLocalPreparation(track)) return { prepared: false }
  if (!force && isValidExistingManifest(track.transcriptionAssets)) {
    return { prepared: false, operationId: track.transcriptionAssets?.operationId, reused: true }
  }
  if (!track.storagePath) throw new Error('This track does not have a stored audio file.')

  const environment = detectAudioPreparationEnvironment()
  let operation: AudioPreparationOperationRow | null = null
  let encoder: ChunkEncoder | null = null
  let manifestSaved = false
  let failurePhase = 'Audio preparation'

  try {
    throwIfCancelled(signal, isCurrent)
    onProgress?.({ stage: 'preflight', progress: 0 })
    assertTrackPreflight(track, environment)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) throw new Error('You must be signed in to prepare transcription audio.')
    throwIfCancelled(signal, isCurrent)

    failurePhase = 'Download URL creation'
    const { data: urlData, error: urlError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(track.storagePath, 600)
    if (urlError || !urlData?.signedUrl) throw new Error('Could not create a download URL for this track.')

    failurePhase = 'Audio download'
    onProgress?.({ stage: 'downloading', progress: 0.02 })
    let sourceBuffer: ArrayBuffer | null = await downloadWithProgress(
      urlData.signedUrl,
      track.fileSizeByte,
      signal,
      isCurrent,
      environment,
      fraction => onProgress?.({ stage: 'downloading', progress: 0.02 + fraction * 0.25 }),
    )
    throwIfCancelled(signal, isCurrent)

    failurePhase = 'Browser audio decoding'
    onProgress?.({ stage: 'decoding', progress: 0.28 })
    const decoded = await decodeAndResampleToMono16k(sourceBuffer, signal, isCurrent, environment)
    const sourceBytes = sourceBuffer.byteLength
    sourceBuffer = null
    throwIfCancelled(signal, isCurrent)

    failurePhase = 'Chunk planning'
    onProgress?.({ stage: 'planning', progress: 0.42 })
    const plans = planChunks(decoded.pcm.length)
    if (!plans.length || plans.length > 64) throw new Error('The prepared audio requires an unsupported number of chunks.')

    let begun = await beginAudioPreparation({
      trackId: track.dbId,
      candidateOperationId: createOperationId(),
      sourceFileSize: sourceBytes,
      durationMs: decoded.durationMs,
      sourceSampleRate: decoded.sourceSampleRate,
      sourceChannels: decoded.sourceChannels,
      chunkCount: plans.length,
    })
    operation = begun.operation

    if (operation.status === 'cleanup_pending') {
      const cleaned = await cleanupOperation(operation, 'failed', operation.last_error ?? 'Retrying incomplete preparation cleanup.', onProgress)
      if (!cleaned) throw new Error('A previous preparation still has storage cleanup pending. Retry after the connection is stable.')
      begun = await beginAudioPreparation({
        trackId: track.dbId,
        candidateOperationId: createOperationId(),
        sourceFileSize: sourceBytes,
        durationMs: decoded.durationMs,
        sourceSampleRate: decoded.sourceSampleRate,
        sourceChannels: decoded.sourceChannels,
        chunkCount: plans.length,
      })
      operation = begun.operation
    }
    throwIfCancelled(signal, isCurrent)

    failurePhase = 'WAV encoding'
    encoder = await createChunkEncoder(operation.operation_id, decoded.pcm, plans, signal)
    const chunks: PreparedTranscriptionAudioChunk[] = []
    const alreadyUploaded = uploadedIndexSet(operation)

    for (let index = 0; index < plans.length; index += 1) {
      throwIfCancelled(signal, isCurrent)
      const plan = plans[index]
      const storagePath = operation.intended_paths[index]
      if (!storagePath) throw new Error('The server did not return an exact storage path for this chunk.')
      const expectedByteSize = WAV_HEADER_BYTES + (plan.frameEnd - plan.frameStart) * BYTES_PER_SAMPLE
      const exists = alreadyUploaded.has(index)
        && await preparedAudioPathExists(storagePath, expectedByteSize)

      if (!exists) {
        onProgress?.({
          stage: 'encoding',
          progress: 0.45 + (index / plans.length) * 0.4,
          chunkIndex: index + 1,
          chunkTotal: plans.length,
        })
        const wavBuffer = await encoder.encode(index)
        throwIfCancelled(signal, isCurrent)
        failurePhase = `Chunk ${index + 1} upload`
        onProgress?.({
          stage: 'uploading',
          progress: 0.45 + ((index + 0.55) / plans.length) * 0.4,
          chunkIndex: index + 1,
          chunkTotal: plans.length,
        })
        await uploadPreparedAudioChunk(storagePath, wavBuffer)
        // Record the deterministic asset before honoring cancellation so a late
        // abort cannot strand an uploaded chunk outside durable cleanup state.
        operation = await markAudioPreparationChunkUploaded(operation.operation_id, index, wavBuffer.byteLength)
        throwIfCancelled(signal, isCurrent)
      } else if (!operation.uploaded_chunks.some(chunk => chunk.index === index)) {
        operation = await markAudioPreparationChunkUploaded(operation.operation_id, index, expectedByteSize)
      }

      chunks.push({
        index,
        storagePath,
        fileName: chunkFileName(track.fileName, index),
        mimeType: 'audio/wav',
        byteSize: operation.uploaded_chunks.find(chunk => chunk.index === index)?.byteSize ?? expectedByteSize,
        startMs: Math.round(plan.frameStart / TARGET_SAMPLE_RATE * 1000),
        endMs: Math.round(plan.frameEnd / TARGET_SAMPLE_RATE * 1000),
        overlapBeforeMs: Math.round(plan.overlapBeforeFrames / TARGET_SAMPLE_RATE * 1000),
        overlapAfterMs: Math.round(plan.overlapAfterFrames / TARGET_SAMPLE_RATE * 1000),
      })
    }

    throwIfCancelled(signal, isCurrent)
    failurePhase = 'Manifest save'
    onProgress?.({ stage: 'saving', progress: 0.93 })
    const manifest: PreparedTranscriptionAudioManifest = {
      version: PREPARED_AUDIO_VERSION,
      operationId: operation.operation_id,
      preparedAt: new Date().toISOString(),
      sourceFileSize: sourceBytes,
      sourceMimeType: track.mimeType,
      durationMs: decoded.durationMs,
      sampleRate: TARGET_SAMPLE_RATE,
      channels: TARGET_CHANNELS,
      bitsPerSample: BITS_PER_SAMPLE,
      chunks,
    }
    const finalized = await finalizeAudioPreparationManifest(operation.operation_id, manifest)
    operation = finalized.operation
    manifestSaved = true
    throwIfCancelled(signal, isCurrent)

    // Superseded paths are persisted on the operation before this removal starts.
    // A transient storage failure therefore remains visible and can be retried on
    // the next audio-library load instead of silently leaking old chunks.
    const supersededCompleted = new Set(operation.superseded_completed_paths)
    let supersededError: string | null = null
    for (const oldPath of finalized.supersededPaths) {
      throwIfCancelled(signal, isCurrent)
      if (!oldPath || supersededCompleted.has(oldPath)) continue
      try {
        await removePreparedAudioPath(oldPath)
        supersededCompleted.add(oldPath)
        throwIfCancelled(signal, isCurrent)
      } catch (cleanupError) {
        if (cleanupError instanceof DOMException && cleanupError.name === 'AbortError') throw cleanupError
        supersededError = cleanupError instanceof Error ? cleanupError.message : 'Superseded chunk cleanup failed.'
        break
      }
    }
    if (finalized.supersededPaths.length > 0) {
      try {
        operation = await recordAudioPreparationSupersededCleanup(
          operation.operation_id,
          [...supersededCompleted].sort(),
          supersededError,
        )
      } catch (cleanupStateError) {
        console.warn('[localAudioPreparation] superseded cleanup state retry deferred:', cleanupStateError)
      }
    }

    throwIfCancelled(signal, isCurrent)
    onProgress?.({ stage: 'complete', progress: 1 })
    return { prepared: true, operationId: operation.operation_id, reused: begun.reconciled }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    if (operation && operation.status !== 'job_created' && !operation.job_id) {
      const cleanupMessage = aborted ? 'Audio preparation was cancelled.' : `${failurePhase}: ${error instanceof Error ? error.message : 'Unknown failure.'}`
      const cleaned = await cleanupOperation(operation, aborted ? 'cancelled' : 'failed', cleanupMessage, onProgress)
      if (!cleaned && !aborted) {
        throw new Error(`${cleanupMessage} Uploaded chunks are recorded for automatic cleanup retry.`)
      }
    }
    if (aborted) throw error
    if (manifestSaved) throw phaseError('Transcription job preparation', error)
    throw phaseError(failurePhase, error)
  } finally {
    encoder?.terminate()
  }
}
