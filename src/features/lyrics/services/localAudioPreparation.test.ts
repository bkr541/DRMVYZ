import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioPreparationOperationRow } from '../../../types/database'

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  storageFrom: vi.fn(),
  beginAudioPreparation: vi.fn(),
  finalizeAudioPreparationManifest: vi.fn(),
  getAudioPreparationOperation: vi.fn(),
  markAudioPreparationChunkUploaded: vi.fn(),
  preparedAudioPathExists: vi.fn(),
  recordAudioPreparationCleanup: vi.fn(),
  recordAudioPreparationSupersededCleanup: vi.fn(),
  removePreparedAudioPath: vi.fn(),
  uploadPreparedAudioChunk: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.authGetUser },
    storage: { from: mocks.storageFrom },
  },
}))

vi.mock('../../../lib/audioPreparationDb', () => ({
  beginAudioPreparation: mocks.beginAudioPreparation,
  finalizeAudioPreparationManifest: mocks.finalizeAudioPreparationManifest,
  getAudioPreparationOperation: mocks.getAudioPreparationOperation,
  markAudioPreparationChunkUploaded: mocks.markAudioPreparationChunkUploaded,
  preparedAudioPathExists: mocks.preparedAudioPathExists,
  recordAudioPreparationCleanup: mocks.recordAudioPreparationCleanup,
  recordAudioPreparationSupersededCleanup: mocks.recordAudioPreparationSupersededCleanup,
  removePreparedAudioPath: mocks.removePreparedAudioPath,
  uploadPreparedAudioChunk: mocks.uploadPreparedAudioChunk,
}))

import { ensurePreparedTranscriptionAudio, rollbackPreparedTranscriptionAudio } from './localAudioPreparation'
import type { LyricManagerTrack } from '../lyricManagerTypes'

function operation(overrides: Partial<AudioPreparationOperationRow> = {}): AudioPreparationOperationRow {
  return {
    id: 'row-1',
    user_id: 'user-1',
    audio_track_id: 'track-1',
    operation_id: 'op-1',
    version: 'browser-pcm16-v2',
    source_file_size: 30_000_000,
    duration_ms: 600_000,
    source_sample_rate: 48_000,
    source_channels: 2,
    target_sample_rate: 16_000,
    intended_chunk_count: 3,
    intended_paths: [
      'user-1/transcription-chunks/track-1/op-1/chunk-000.wav',
      'user-1/transcription-chunks/track-1/op-1/chunk-001.wav',
      'user-1/transcription-chunks/track-1/op-1/chunk-002.wav',
    ],
    uploaded_chunks: [
      { index: 0, path: 'user-1/transcription-chunks/track-1/op-1/chunk-000.wav', byteSize: 100 },
    ],
    cleanup_completed_indices: [],
    superseded_paths: [],
    superseded_completed_paths: [],
    manifest_saved: false,
    job_id: null,
    status: 'uploading',
    phase: 'uploading',
    last_error: null,
    created_at: '2026-07-11T00:00:00.000Z',
    updated_at: '2026-07-11T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

describe('prepared-audio rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mocks.removePreparedAudioPath.mockResolvedValue(undefined)
    mocks.recordAudioPreparationCleanup.mockImplementation(async () => operation({ status: 'failed' }))
    mocks.recordAudioPreparationSupersededCleanup.mockImplementation(async (_operationId, completedPaths) => operation({
      status: 'manifest_saved',
      manifest_saved: true,
      superseded_completed_paths: completedPaths,
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prepares a safe-size compressed track through decode, bounded encode, upload, and manifest phases', async () => {
    const sourceBytes = 20 * 1024 * 1024 + 1
    const initial = operation({
      source_file_size: sourceBytes,
      duration_ms: 2_000,
      intended_chunk_count: 1,
      intended_paths: ['user-1/transcription-chunks/track-1/op-1/chunk-000.wav'],
      uploaded_chunks: [],
    })
    const uploaded = operation({
      ...initial,
      uploaded_chunks: [{ index: 0, path: initial.intended_paths[0], byteSize: 64_044 }],
      status: 'uploading',
    })
    const finalized = operation({
      ...uploaded,
      manifest_saved: true,
      status: 'manifest_saved',
      phase: 'creating_job',
    })
    const track: LyricManagerTrack = {
      id: 'runtime-track-1',
      dbId: 'track-1',
      title: 'Safe Mix',
      fileName: 'safe-mix.mp3',
      storagePath: 'user-1/safe-mix.mp3',
      durationSec: 2,
      sampleRate: 48_000,
      channels: 2,
      fileSizeByte: sourceBytes,
      mimeType: 'audio/mpeg',
      transcriptionAssets: null,
      artist: 'DVYDRM',
      genre: null,
      bpm: null,
      musicalKey: null,
      createdAt: '2026-07-11T00:00:00.000Z',
      lyricVersionCount: 0,
      activeLyricDocumentId: null,
      activeLyricDocumentName: null,
    }

    mocks.authGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/audio' }, error: null }),
    })
    mocks.beginAudioPreparation.mockResolvedValue({ operation: initial, reconciled: false })
    mocks.preparedAudioPathExists.mockResolvedValue(false)
    mocks.uploadPreparedAudioChunk.mockResolvedValue({ reused: false })
    mocks.markAudioPreparationChunkUploaded.mockResolvedValue(uploaded)
    mocks.finalizeAudioPreparationManifest.mockResolvedValue({ operation: finalized, supersededPaths: [] })

    const source = new Uint8Array(sourceBytes)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source, {
      status: 200,
      headers: { 'content-length': String(sourceBytes) },
    })))
    vi.stubGlobal('Worker', undefined)
    vi.stubGlobal('AudioContext', class {
      async decodeAudioData() {
        return { duration: 2, sampleRate: 48_000, numberOfChannels: 2 }
      }
      async close() { return undefined }
    })
    vi.stubGlobal('OfflineAudioContext', class {
      destination = {}
      createBufferSource() {
        return { buffer: null as unknown, connect: vi.fn(), start: vi.fn(), disconnect: vi.fn() }
      }
      async startRendering() {
        return { duration: 2, getChannelData: () => new Float32Array(32_000) }
      }
    })
    const progress: string[] = []

    const result = await ensurePreparedTranscriptionAudio(track, {
      onProgress: update => progress.push(update.stage),
      isCurrent: () => true,
    })

    expect(result).toEqual({ prepared: true, operationId: 'op-1', reused: false })
    expect(mocks.uploadPreparedAudioChunk).toHaveBeenCalledOnce()
    expect(mocks.finalizeAudioPreparationManifest).toHaveBeenCalledOnce()
    expect(progress).toEqual(expect.arrayContaining(['preflight', 'downloading', 'decoding', 'planning', 'encoding', 'uploading', 'saving', 'complete']))
  })

  it('removes every deterministic path after a later-stage failure, including an upload with an ambiguous ledger response', async () => {
    const current = operation()
    mocks.getAudioPreparationOperation.mockResolvedValue(current)

    const cleaned = await rollbackPreparedTranscriptionAudio(current.operation_id, 'Manifest save failed.')

    expect(cleaned).toBe(true)
    expect(mocks.removePreparedAudioPath.mock.calls.map(call => call[0])).toEqual(current.intended_paths)
    expect(mocks.recordAudioPreparationCleanup).toHaveBeenCalledWith(
      current.operation_id,
      [0, 1, 2],
      'failed',
      'Manifest save failed.',
    )
  })

  it('records durable cleanup_pending state when cancellation cleanup cannot finish', async () => {
    const current = operation()
    mocks.getAudioPreparationOperation.mockResolvedValue(current)
    mocks.removePreparedAudioPath
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network unavailable'))

    const cleaned = await rollbackPreparedTranscriptionAudio(current.operation_id, 'Cancelled by user.', 'cancelled')

    expect(cleaned).toBe(false)
    expect(mocks.recordAudioPreparationCleanup).toHaveBeenCalledWith(
      current.operation_id,
      [0],
      'cleanup_pending',
      'network unavailable',
    )
  })

  it('resumes cleanup without deleting an already-completed deterministic chunk twice', async () => {
    const current = operation({ cleanup_completed_indices: [0] })
    mocks.getAudioPreparationOperation.mockResolvedValue(current)

    await rollbackPreparedTranscriptionAudio(current.operation_id, 'Retry cleanup.')

    expect(mocks.removePreparedAudioPath).not.toHaveBeenCalledWith(current.intended_paths[0])
    expect(mocks.removePreparedAudioPath).toHaveBeenCalledWith(current.intended_paths[1])
    expect(mocks.removePreparedAudioPath).toHaveBeenCalledWith(current.intended_paths[2])
  })

  it('does not roll back assets after a transcription job owns the operation', async () => {
    const current = operation({ status: 'job_created', job_id: 'job-1', manifest_saved: true })
    mocks.getAudioPreparationOperation.mockResolvedValue(current)

    const cleaned = await rollbackPreparedTranscriptionAudio(current.operation_id, 'Late client failure.')

    expect(cleaned).toBe(false)
    expect(mocks.removePreparedAudioPath).not.toHaveBeenCalled()
    expect(mocks.recordAudioPreparationCleanup).not.toHaveBeenCalled()
  })
})
