import { supabase } from '../../../lib/supabase'
import type { PreparedTranscriptionAudioChunk, PreparedTranscriptionAudioManifest } from '../../../types/audio'
import type { LyricManagerTrack } from '../lyricManagerTypes'

const AUDIO_BUCKET = 'audio-tracks'
const PREPARED_AUDIO_VERSION = 'browser-pcm16-v1' as const

// Target and resampling constants
const TARGET_SAMPLE_RATE = 16_000
const TARGET_CHANNELS = 1
const BITS_PER_SAMPLE = 16
const BYTES_PER_SAMPLE = 2
const BYTES_PER_SEC = TARGET_SAMPLE_RATE * TARGET_CHANNELS * BYTES_PER_SAMPLE
const WAV_HEADER_BYTES = 44
const TARGET_CHUNK_BYTES = 20 * 1024 * 1024
const CHUNK_OVERLAP_SECONDS = 3

// Server routing thresholds — must stay in sync with Edge Function constants
const SAFE_DIRECT_BYTES = 20 * 1024 * 1024
const SERVER_DOWNLOAD_LIMIT = 100 * 1024 * 1024

export interface LocalAudioPreparationProgress {
  stage: 'downloading' | 'decoding' | 'planning' | 'encoding' | 'uploading' | 'saving' | 'complete'
  progress: number
  chunkIndex?: number | null
  chunkTotal?: number | null
}

export interface EnsurePreparedTranscriptionAudioOptions {
  signal?: AbortSignal
  onProgress?: (progress: LocalAudioPreparationProgress) => void
  force?: boolean
}

export interface EnsurePreparedTranscriptionAudioResult {
  prepared: boolean
}

function needsLocalPreparation(track: LyricManagerTrack): boolean {
  const size = track.fileSizeByte ?? 0
  if (size <= 0) return false
  if (size <= SAFE_DIRECT_BYTES) return false

  // Server can chunk WAV files server-side up to the download limit
  const mime = (track.mimeType ?? '').toLowerCase()
  const ext = (track.fileName ?? '').split('.').pop()?.toLowerCase() ?? ''
  const isWav = mime.includes('wav') || ext === 'wav'
  if (isWav && size <= SERVER_DOWNLOAD_LIMIT) return false

  return true
}

function isValidExistingManifest(manifest: PreparedTranscriptionAudioManifest | null): boolean {
  return (
    manifest !== null
    && manifest.version === PREPARED_AUDIO_VERSION
    && manifest.chunks.length > 0
    && manifest.sampleRate === TARGET_SAMPLE_RATE
    && manifest.channels === TARGET_CHANNELS
    && manifest.bitsPerSample === BITS_PER_SAMPLE
  )
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Audio preparation was cancelled.', 'AbortError')
}

async function downloadWithProgress(
  url: string,
  signal: AbortSignal | undefined,
  onProgress: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Audio download failed (${response.status}).`)

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!total || !response.body) {
    onProgress(0.5)
    const buffer = await response.arrayBuffer()
    onProgress(1)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(received / total)
  }

  const result = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result.buffer
}

async function decodeAndResampleToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer)
  } catch {
    throw new Error(
      'This audio file could not be decoded in the browser. Convert it to a supported format (MP3, M4A, WAV, OGG) or configure the optional worker fallback.',
    )
  } finally {
    void ctx.close()
  }

  const targetFrames = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE)
  const offline = new OfflineAudioContext(TARGET_CHANNELS, Math.max(1, targetFrames), TARGET_SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

interface ChunkPlan {
  frameStart: number
  frameEnd: number
  overlapBeforeFrames: number
  overlapAfterFrames: number
}

function planChunks(totalFrames: number): ChunkPlan[] {
  const overlapFrames = Math.round(CHUNK_OVERLAP_SECONDS * TARGET_SAMPLE_RATE)
  const contentFramesPerChunk = Math.floor((TARGET_CHUNK_BYTES - WAV_HEADER_BYTES) / BYTES_PER_SAMPLE)

  const chunks: ChunkPlan[] = []
  let contentStart = 0

  while (contentStart < totalFrames) {
    const contentEnd = Math.min(contentStart + contentFramesPerChunk, totalFrames)
    const overlapBefore = contentStart > 0 ? Math.min(overlapFrames, contentStart) : 0
    const overlapAfter = contentEnd < totalFrames ? Math.min(overlapFrames, totalFrames - contentEnd) : 0
    chunks.push({
      frameStart: contentStart - overlapBefore,
      frameEnd: contentEnd + overlapAfter,
      overlapBeforeFrames: overlapBefore,
      overlapAfterFrames: overlapAfter,
    })
    contentStart = contentEnd
  }

  return chunks
}

function encodePcm16Wav(samples: Float32Array): Uint8Array {
  const dataBytes = samples.length * BYTES_PER_SAMPLE
  const totalBytes = WAV_HEADER_BYTES + dataBytes
  const buf = new ArrayBuffer(totalBytes)
  const view = new DataView(buf)

  view.setUint32(0, 0x52494646, false)  // 'RIFF'
  view.setUint32(4, totalBytes - 8, true)
  view.setUint32(8, 0x57415645, false)  // 'WAVE'
  view.setUint32(12, 0x666d7420, false) // 'fmt '
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)           // PCM
  view.setUint16(22, TARGET_CHANNELS, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, BYTES_PER_SEC, true)
  view.setUint16(32, TARGET_CHANNELS * BYTES_PER_SAMPLE, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  view.setUint32(36, 0x64617461, false) // 'data'
  view.setUint32(40, dataBytes, true)

  let pos = 44
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(pos, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true)
    pos += 2
  }

  return new Uint8Array(buf)
}

function chunkStoragePath(userId: string, trackDbId: string, index: number): string {
  return `${userId}/transcription-chunks/${trackDbId}/chunk-${String(index).padStart(3, '0')}.wav`
}

function chunkFileName(trackFileName: string, index: number): string {
  const dot = trackFileName.lastIndexOf('.')
  const base = dot > 0 ? trackFileName.slice(0, dot) : trackFileName
  return `${base}.transcription-${String(index).padStart(3, '0')}.wav`
}

export async function ensurePreparedTranscriptionAudio(
  track: LyricManagerTrack,
  options: EnsurePreparedTranscriptionAudioOptions = {},
): Promise<EnsurePreparedTranscriptionAudioResult> {
  const { signal, onProgress, force = false } = options

  if (!needsLocalPreparation(track)) return { prepared: false }
  if (!force && isValidExistingManifest(track.transcriptionAssets)) return { prepared: false }
  if (!track.storagePath) throw new Error('This track does not have a stored audio file.')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('You must be signed in to prepare transcription audio.')
  const userId = userData.user.id

  // Stage: downloading
  onProgress?.({ stage: 'downloading', progress: 0 })
  const { data: urlData, error: urlError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(track.storagePath, 600)
  if (urlError || !urlData?.signedUrl) throw new Error('Could not create a download URL for this track.')

  const audioBuffer = await downloadWithProgress(urlData.signedUrl, signal, fraction => {
    onProgress?.({ stage: 'downloading', progress: fraction * 0.3 })
  })
  throwIfAborted(signal)

  // Stage: decoding
  onProgress?.({ stage: 'decoding', progress: 0.3 })
  const pcm = await decodeAndResampleToMono16k(audioBuffer)
  throwIfAborted(signal)

  // Stage: planning
  onProgress?.({ stage: 'planning', progress: 0.42 })
  const totalFrames = pcm.length
  const durationMs = Math.round(totalFrames / TARGET_SAMPLE_RATE * 1000)
  const chunkPlan = planChunks(totalFrames)
  const chunkTotal = chunkPlan.length
  const chunks: PreparedTranscriptionAudioChunk[] = []

  for (let index = 0; index < chunkPlan.length; index++) {
    throwIfAborted(signal)
    const plan = chunkPlan[index]
    const slicedPcm = pcm.slice(plan.frameStart, plan.frameEnd)

    onProgress?.({ stage: 'encoding', progress: 0.45 + (index / chunkTotal) * 0.4, chunkIndex: index + 1, chunkTotal })
    const wavBytes = encodePcm16Wav(slicedPcm)

    throwIfAborted(signal)
    onProgress?.({ stage: 'uploading', progress: 0.45 + ((index + 0.5) / chunkTotal) * 0.4, chunkIndex: index + 1, chunkTotal })
    const storagePath = chunkStoragePath(userId, track.dbId, index)
    const fileName = chunkFileName(track.fileName, index)
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, new Blob([new Uint8Array(wavBytes)], { type: 'audio/wav' }), { contentType: 'audio/wav', upsert: true })
    if (uploadError) throw new Error(`Chunk upload failed: ${uploadError.message}`)

    chunks.push({
      index,
      storagePath,
      fileName,
      mimeType: 'audio/wav',
      byteSize: wavBytes.length,
      startMs: Math.round(plan.frameStart / TARGET_SAMPLE_RATE * 1000),
      endMs: Math.round(plan.frameEnd / TARGET_SAMPLE_RATE * 1000),
      overlapBeforeMs: Math.round(plan.overlapBeforeFrames / TARGET_SAMPLE_RATE * 1000),
      overlapAfterMs: Math.round(plan.overlapAfterFrames / TARGET_SAMPLE_RATE * 1000),
    })
  }

  // Stage: saving manifest
  onProgress?.({ stage: 'saving', progress: 0.95 })
  const manifest: PreparedTranscriptionAudioManifest = {
    version: PREPARED_AUDIO_VERSION,
    preparedAt: new Date().toISOString(),
    sourceFileSize: track.fileSizeByte ?? audioBuffer.byteLength,
    sourceMimeType: track.mimeType,
    durationMs,
    sampleRate: TARGET_SAMPLE_RATE,
    channels: TARGET_CHANNELS,
    bitsPerSample: BITS_PER_SAMPLE,
    chunks,
  }

  const { error: saveError } = await supabase
    .from('audio_tracks')
    .update({ transcription_assets: manifest })
    .eq('id', track.dbId)
  if (saveError) throw new Error(`Manifest save failed: ${saveError.message}`)

  onProgress?.({ stage: 'complete', progress: 1 })
  return { prepared: true }
}
