import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioPreparationOperationRow } from '../types/database'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
  rows: [] as AudioPreparationOperationRow[],
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(async () => ({ data: mocks.rows, error: null })),
      }
      return query
    }),
    storage: {
      from: vi.fn(() => ({
        list: mocks.list,
        remove: mocks.remove,
        upload: mocks.upload,
      })),
    },
  },
}))

import {
  preparedAudioPathExists,
  retryPendingAudioPreparationCleanup,
  uploadPreparedAudioChunk,
} from './audioPreparationDb'

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
    status: 'cleanup_pending',
    phase: 'cleanup',
    last_error: 'network unavailable',
    created_at: '2026-07-11T00:00:00.000Z',
    updated_at: '2026-07-11T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

describe('prepared-audio cleanup recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = [operation()]
    mocks.list.mockResolvedValue({ data: [], error: null })
    mocks.remove.mockResolvedValue({ error: null })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name !== 'record_audio_preparation_cleanup') throw new Error(`Unexpected RPC: ${name}`)
      return {
        data: {
          status: 'success',
          operation: operation({
            status: 'failed',
            phase: 'failed',
            cleanup_completed_indices: args.p_completed_indices as number[],
          }),
        },
        error: null,
      }
    })
  })

  it('retries every deterministic path, including uploads whose ledger response was ambiguous', async () => {
    const current = mocks.rows[0]

    await retryPendingAudioPreparationCleanup()

    expect(mocks.remove.mock.calls).toEqual(current.intended_paths.map(path => [[path]]))
    expect(mocks.rpc).toHaveBeenCalledWith('record_audio_preparation_cleanup', {
      p_operation_id: current.operation_id,
      p_completed_indices: [0, 1, 2],
      p_status: 'failed',
      p_error: null,
    })
  })
})

describe('prepared-audio deterministic chunk validation', () => {
  const path = 'user-1/transcription-chunks/track-1/op-1/chunk-000.wav'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rows = []
    mocks.list.mockResolvedValue({
      data: [{ name: 'chunk-000.wav', metadata: { size: 100 } }],
      error: null,
    })
    mocks.upload.mockResolvedValue({ error: null })
  })

  it('reuses a deterministic chunk only when its stored byte size matches', async () => {
    await expect(preparedAudioPathExists(path, 100)).resolves.toBe(true)
    await expect(preparedAudioPathExists(path, 99)).resolves.toBe(false)

    await expect(uploadPreparedAudioChunk(path, new ArrayBuffer(100))).resolves.toEqual({ reused: true })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('does not treat a conflicting object with the wrong size as a valid retry chunk', async () => {
    mocks.list.mockResolvedValue({
      data: [{ name: 'chunk-000.wav', metadata: { size: 99 } }],
      error: null,
    })
    mocks.upload.mockResolvedValue({ error: { message: 'The resource already exists' } })

    await expect(uploadPreparedAudioChunk(path, new ArrayBuffer(100)))
      .rejects.toThrow('Chunk upload failed: The resource already exists')
  })
})
