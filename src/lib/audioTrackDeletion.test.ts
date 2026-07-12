import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioCleanupJobRow } from '../types/database'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: { from: vi.fn(() => ({ remove: mocks.remove })) },
  },
}))

import { deleteAudioTrackCanonical, retryPendingAudioCleanup } from './audioTrackDeletion'

function cleanupJob(overrides: Partial<AudioCleanupJobRow> = {}): AudioCleanupJobRow {
  return {
    id: 'cleanup-1',
    user_id: 'user-1',
    audio_track_id: 'track-1',
    track_id_snapshot: 'track-1',
    kind: 'track_deletion',
    status: 'pending',
    storage_paths: [
      'user-1/original/track.wav',
      'user-1/transcription-chunks/track-1/op-1/chunk-000.wav',
      'user-1/transcription-chunks/track-1/op-1/chunk-001.wav',
    ],
    completed_paths: [],
    last_error: null,
    created_at: '2026-07-11T00:00:00.000Z',
    updated_at: '2026-07-11T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

function rpcSuccess(job: AudioCleanupJobRow) {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === 'request_audio_track_deletion') {
      return { data: { status: 'success', cleanup_job: job }, error: null }
    }
    if (name === 'update_audio_cleanup_job') {
      return {
        data: {
          status: 'success',
          cleanup_job: { ...job, status: 'complete', completed_paths: job.storage_paths },
        },
        error: null,
      }
    }
    if (name === 'finalize_audio_track_deletion') {
      return { data: { status: 'success', audio_track_id: job.track_id_snapshot }, error: null }
    }
    throw new Error(`Unexpected RPC: ${name}`)
  })
}

describe('canonical audio deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.remove.mockResolvedValue({ error: null })
  })

  it('removes only the server-derived exact original and derivative paths before finalization', async () => {
    const job = cleanupJob()
    rpcSuccess(job)

    const result = await deleteAudioTrackCanonical(job.track_id_snapshot)

    expect(result).toEqual({ ok: true, trackId: 'track-1', pendingCleanup: false, message: null })
    expect(mocks.remove.mock.calls).toEqual(job.storage_paths.map(path => [[path]]))
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_audio_track_deletion', { p_cleanup_job_id: job.id })
  })

  it('keeps partial storage deletion visible and durably records completed exact paths', async () => {
    const job = cleanupJob()
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'request_audio_track_deletion') return { data: { status: 'success', cleanup_job: job }, error: null }
      if (name === 'update_audio_cleanup_job') {
        expect(args).toMatchObject({
          p_cleanup_job_id: job.id,
          p_completed_paths: [job.storage_paths[0]],
          p_status: 'failed',
          p_error: 'storage unavailable',
        })
        return {
          data: { status: 'success', cleanup_job: { ...job, status: 'failed', completed_paths: [job.storage_paths[0]] } },
          error: null,
        }
      }
      throw new Error(`Unexpected RPC: ${name}`)
    })
    mocks.remove
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'storage unavailable' } })

    const result = await deleteAudioTrackCanonical(job.track_id_snapshot)

    expect(result.ok).toBe(true)
    expect(result.pendingCleanup).toBe(true)
    expect(result.message).toContain('storage unavailable')
    expect(mocks.rpc).not.toHaveBeenCalledWith('finalize_audio_track_deletion', expect.anything())
  })

  it('is idempotent after a completed deletion and performs no broad or repeated storage removal', async () => {
    const job = cleanupJob({ status: 'complete', completed_paths: cleanupJob().storage_paths, audio_track_id: null })
    mocks.rpc.mockResolvedValue({ data: { status: 'success', cleanup_job: job, already_deleted: true }, error: null })

    const result = await deleteAudioTrackCanonical(job.track_id_snapshot)

    expect(result.pendingCleanup).toBe(false)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('rejects cross-user or unavailable tracks before any storage path is accepted', async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: 'authorization_failure', message: 'The audio track is unavailable or not owned by the current user.' },
      error: null,
    })

    const result = await deleteAudioTrackCanonical('foreign-track')

    expect(result.ok).toBe(false)
    expect(result.message).toContain('not owned')
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('cannot confuse similar filenames because each storage call receives one canonical full path', async () => {
    const job = cleanupJob({
      storage_paths: [
        'user-1/original/live-set.wav',
        'user-1/original/live-set-copy.wav',
      ],
    })
    rpcSuccess(job)

    await deleteAudioTrackCanonical(job.track_id_snapshot)

    expect(mocks.remove).toHaveBeenNthCalledWith(1, ['user-1/original/live-set.wav'])
    expect(mocks.remove).toHaveBeenNthCalledWith(2, ['user-1/original/live-set-copy.wav'])
  })

  it('retries database finalization without deleting already-clean storage again', async () => {
    const job = cleanupJob({
      status: 'complete',
      completed_paths: cleanupJob().storage_paths,
      audio_track_id: 'track-1',
    })
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'list_pending_audio_cleanup') return { data: [job], error: null }
      if (name === 'finalize_audio_track_deletion') return { data: { status: 'success' }, error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    })

    const [result] = await retryPendingAudioCleanup()

    expect(result.pendingCleanup).toBe(false)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_audio_track_deletion', { p_cleanup_job_id: job.id })
  })

  it('retries a failed cleanup from persisted progress without deleting completed paths again', async () => {
    const job = cleanupJob({ status: 'failed', completed_paths: [cleanupJob().storage_paths[0]] })
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === 'list_pending_audio_cleanup') return { data: [job], error: null }
      if (name === 'update_audio_cleanup_job') {
        return { data: { status: 'success', cleanup_job: { ...job, status: 'complete', completed_paths: job.storage_paths } }, error: null }
      }
      if (name === 'finalize_audio_track_deletion') return { data: { status: 'success' }, error: null }
      throw new Error(`Unexpected RPC: ${name}`)
    })

    const [result] = await retryPendingAudioCleanup()

    expect(result.pendingCleanup).toBe(false)
    expect(mocks.remove).toHaveBeenCalledTimes(2)
    expect(mocks.remove).not.toHaveBeenCalledWith([job.storage_paths[0]])
  })
})
