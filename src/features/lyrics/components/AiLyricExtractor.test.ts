// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument, LyricTranscriptionJob, LyricTranscriptionJobRow } from '../../../types/lyrics'
import type { LyricManagerTrack } from '../lyricManagerTypes'

const mocks = vi.hoisted(() => ({
  ensurePreparedTranscriptionAudio: vi.fn(),
  functionsInvoke: vi.fn(),
  from: vi.fn(),
  getFullLyricDocument: vi.fn(),
  rollbackPreparedTranscriptionAudio: vi.fn(),
  getAudioPreparationOperation: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mocks.functionsInvoke },
    from: mocks.from,
  },
}))

vi.mock('../../../lib/lyricsDb', () => ({
  getFullLyricDocument: mocks.getFullLyricDocument,
}))

vi.mock('../services/localAudioPreparation', () => ({
  ensurePreparedTranscriptionAudio: mocks.ensurePreparedTranscriptionAudio,
  rollbackPreparedTranscriptionAudio: mocks.rollbackPreparedTranscriptionAudio,
}))

vi.mock('../../../lib/audioPreparationDb', () => ({
  getAudioPreparationOperation: mocks.getAudioPreparationOperation,
}))

import { OFFLINE_LYRIC_EXTRACTION_MESSAGE, AiLyricExtractor, chooseRecoveredJob, lyricJobPollDelayMs } from './AiLyricExtractor'
import { lyricTranscriptionProviderLabel } from '../services/lyricExtraction'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
let recentRows: LyricTranscriptionJobRow[]

function job(id: string, status: LyricTranscriptionJob['status'], createdAt: string): LyricTranscriptionJob {
  return {
    id,
    userId: 'user-1',
    audioTrackId: 'track-1',
    lyricDocumentId: status === 'completed' ? `doc-${id}` : null,
    provider: 'groq',
    status,
    progress: status === 'completed' ? 1 : 0.4,
    errorCode: null,
    errorMessage: null,
    providerMetadata: {},
    requestOptions: {},
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
  }
}

function jobRow(
  id: string,
  status: LyricTranscriptionJobRow['status'],
  overrides: Partial<LyricTranscriptionJobRow> = {},
): LyricTranscriptionJobRow {
  return {
    id,
    user_id: 'user-1',
    audio_track_id: 'track-1',
    lyric_document_id: status === 'completed' ? `doc-${id}` : null,
    provider: 'groq',
    status,
    progress: status === 'completed' ? 1 : 0.4,
    error_code: null,
    error_message: null,
    provider_metadata: {},
    request_options: {},
    created_at: '2026-06-29T12:00:00.000Z',
    updated_at: '2026-06-29T12:00:00.000Z',
    started_at: status === 'queued' ? null : '2026-06-29T12:00:05.000Z',
    completed_at: status === 'completed' ? '2026-06-29T12:01:00.000Z' : null,
    ...overrides,
  }
}

function selectedTrack(): LyricManagerTrack {
  return {
    id: 'audio-track-1',
    dbId: 'track-1',
    title: 'Reverie',
    fileName: 'reverie.mp3',
    storagePath: 'user-1/reverie.mp3',
    durationSec: 180,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 1024,
    mimeType: 'audio/mpeg',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-06-29T12:00:00.000Z',
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  }
}

function lyricDocument(id = 'doc-completed'): LyricDocument {
  return {
    id,
    userId: 'user-1',
    audioTrackId: 'track-1',
    visualSessionId: null,
    title: 'Recovered AI Draft',
    artist: 'DVYDRM',
    sourceType: 'ai_transcription',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: false,
    metadata: {},
    revision: 1,
    createdAt: '2026-06-29T12:00:00.000Z',
    updatedAt: '2026-06-29T12:00:00.000Z',
  }
}

function cue(): LyricCue {
  return {
    id: 'cue-1',
    text: 'Lay your doubts down',
    startMs: 0,
    endMs: 1200,
    reviewStatus: 'unreviewed',
    confidence: 0.66,
    warnings: ['needs_review'],
  }
}


function setDocumentVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function setNavigatorOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })
}

function mockRecentJobs(): void {
  mocks.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: async () => ({ data: recentRows, error: null }),
        }),
      }),
    }),
  }))
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderExtractor(track: LyricManagerTrack | null = selectedTrack()): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(React.createElement(AiLyricExtractor, {
      selectedTrack: track,
      existingDocumentCount: 0,
      onOpenCompletedDraft: vi.fn(),
      onActivateCompletedDraft: vi.fn(),
    }))
  })
  await flush()
}

async function rerenderExtractor(track: LyricManagerTrack | null): Promise<void> {
  await act(async () => {
    root!.render(React.createElement(AiLyricExtractor, {
      selectedTrack: track,
      existingDocumentCount: 0,
      onOpenCompletedDraft: vi.fn(),
      onActivateCompletedDraft: vi.fn(),
    }))
  })
  await flush()
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...container!.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

beforeEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  recentRows = []
  setNavigatorOnline(true)
  setDocumentVisibility('visible')
  mockRecentJobs()
  mocks.ensurePreparedTranscriptionAudio.mockResolvedValue({ prepared: false })
  mocks.rollbackPreparedTranscriptionAudio.mockResolvedValue(true)
  mocks.getAudioPreparationOperation.mockResolvedValue(null)
  mocks.functionsInvoke.mockImplementation(async (_name: string, options: { body?: Record<string, unknown> }) => {
    const action = options.body?.action
    if (action === 'start') return { data: { job: jobRow('started', 'queued'), duplicate: false }, error: null }
    if (action === 'retry') return { data: { job: jobRow('retried', 'queued'), duplicate: false }, error: null }
    if (action === 'status') return { data: { job: jobRow('completed', 'completed') }, error: null }
    if (action === 'cancel') return { data: { job: jobRow('cancelled', 'cancelled') }, error: null }
    return { data: {}, error: null }
  })
  mocks.getFullLyricDocument.mockResolvedValue({ document: lyricDocument(), cues: [cue()] })
})

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.useRealTimers()
})

describe('AI lyric polling policy', () => {
  it('uses bounded exponential backoff with jitter instead of a constant interval', () => {
    expect(lyricJobPollDelayMs(0, () => 0.5)).toBe(2_000)
    expect(lyricJobPollDelayMs(1, () => 0.5)).toBe(4_000)
    expect(lyricJobPollDelayMs(4, () => 0.5)).toBe(30_000)
    expect(lyricJobPollDelayMs(99, () => 0)).toBe(25_500)
  })

  it('stops polling after a terminal completion', async () => {
    vi.useFakeTimers()
    recentRows = [jobRow('processing', 'processing')]
    mocks.functionsInvoke.mockResolvedValue({
      data: { job: jobRow('processing', 'completed', { lyric_document_id: 'doc-completed' }) },
      error: null,
    })

    await renderExtractor()
    await act(async () => {
      vi.advanceTimersByTime(3_000)
      await Promise.resolve()
      await Promise.resolve()
    })
    const statusCalls = mocks.functionsInvoke.mock.calls.filter(([, options]) => options?.body?.action === 'status')
    expect(statusCalls).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
    })
    expect(mocks.functionsInvoke.mock.calls.filter(([, options]) => options?.body?.action === 'status')).toHaveLength(1)
  })

  it('pauses while hidden and performs one immediate refresh when visible again', async () => {
    vi.useFakeTimers()
    recentRows = [jobRow('processing', 'processing')]
    mocks.functionsInvoke.mockResolvedValue({
      data: { job: jobRow('processing', 'processing', { updated_at: '2026-06-29T12:00:10.000Z' }) },
      error: null,
    })

    setDocumentVisibility('hidden')
    await renderExtractor()
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(mocks.functionsInvoke.mock.calls.filter(([, options]) => options?.body?.action === 'status')).toHaveLength(0)

    setDocumentVisibility('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mocks.functionsInvoke.mock.calls.filter(([, options]) => options?.body?.action === 'status')).toHaveLength(1)
  })

  it('abandons a stale polling response after the selected track changes', async () => {
    vi.useFakeTimers()
    recentRows = [jobRow('processing', 'processing')]
    const status = deferred<{ data: { job: LyricTranscriptionJobRow }; error: null }>()
    mocks.functionsInvoke.mockImplementation(async (_name: string, options: { body?: Record<string, unknown> }) => {
      if (options.body?.action === 'status') return status.promise
      return { data: { job: jobRow('cancelled', 'cancelled') }, error: null }
    })

    await renderExtractor()
    await act(async () => {
      vi.advanceTimersByTime(3_000)
      await Promise.resolve()
    })
    await rerenderExtractor({ ...selectedTrack(), dbId: 'track-2', id: 'audio-track-2', title: 'From Grace', storagePath: 'user-1/from-grace.mp3' })
    status.resolve({ data: { job: jobRow('processing', 'completed', { lyric_document_id: 'doc-completed' }) }, error: null })
    await flush()

    expect(mocks.getFullLyricDocument).not.toHaveBeenCalledWith('doc-completed')
    expect(container!.textContent).not.toContain('Draft ready')
  })

  it('clears polling timers on cancellation and unmount', async () => {
    vi.useFakeTimers()
    recentRows = [jobRow('processing', 'processing')]
    await renderExtractor()

    await act(async () => buttonByText('Cancel').click())
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
    })
    expect(mocks.functionsInvoke.mock.calls.filter(([, options]) => options?.body?.action === 'status')).toHaveLength(0)

    await act(async () => root?.unmount())
    root = null
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('AI lyric extractor refresh recovery', () => {
  it('resumes an active server-side job before showing older completed history', () => {
    const recovered = chooseRecoveredJob([
      job('completed', 'completed', '2026-06-29T12:00:00Z'),
      job('processing', 'processing', '2026-06-29T11:59:00Z'),
    ])
    expect(recovered?.id).toBe('processing')
  })

  it('opens the newest completed result when no active job exists', () => {
    const recovered = chooseRecoveredJob([
      job('latest', 'completed', '2026-06-29T12:00:00Z'),
      job('older', 'failed', '2026-06-29T11:00:00Z'),
    ])
    expect(recovered?.id).toBe('latest')
  })

  it('recovers a completed job and shows Groq job metadata without changing lyric saving', async () => {
    recentRows = [jobRow('completed', 'completed', {
      lyric_document_id: 'doc-completed',
      provider_metadata: {
        model: 'whisper-large-v3-turbo',
        processingMode: 'direct',
        unitCount: 1,
        warnings: ['chunk_boundary_uncertain'],
      },
    })]

    await renderExtractor()

    expect(mocks.getFullLyricDocument).toHaveBeenCalledWith('doc-completed')
    expect(container!.textContent).toContain('Draft ready')
    expect(container!.textContent).toContain('Groq Whisper')
    expect(container!.textContent).toContain('whisper-large-v3-turbo')
    expect(container!.textContent).toContain('Direct mode')
    expect(container!.textContent).toContain('Warning: chunk boundary uncertain')
    expect(container!.textContent).toContain('Recovered AI Draft')
  })

  it('continues polling active jobs and opens the completed draft when the server finishes', async () => {
    vi.useFakeTimers()
    recentRows = [jobRow('processing', 'processing', {
      provider_metadata: { processingStage: 'transcribing', processingMode: 'prepared-audio', chunksCompleted: 1, chunksTotal: 3 },
    })]
    mocks.functionsInvoke.mockResolvedValue({
      data: { job: jobRow('processing', 'completed', { lyric_document_id: 'doc-completed', provider_metadata: { model: 'whisper-large-v3-turbo', processingMode: 'prepared-audio', unitCount: 3 } }) },
      error: null,
    })

    await renderExtractor()
    await act(async () => {
      vi.advanceTimersByTime(4_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', { body: { action: 'status', jobId: 'processing' } })
    expect(mocks.getFullLyricDocument).toHaveBeenCalledWith('doc-completed')
    expect(container!.textContent).toContain('Draft ready')
    expect(container!.textContent).toContain('Browser-prepared audio')
  })
})

describe('AI lyric extractor internet-required guard', () => {
  it('disables extraction while offline and does not prepare audio or call the Edge Function', async () => {
    setNavigatorOnline(false)

    await renderExtractor()

    const button = buttonByText('Start Automatic Extraction')
    expect(button.disabled).toBe(true)
    expect(container!.textContent).toContain(OFFLINE_LYRIC_EXTRACTION_MESSAGE)

    await act(async () => button.click())
    expect(mocks.ensurePreparedTranscriptionAudio).not.toHaveBeenCalled()
    expect(mocks.functionsInvoke).not.toHaveBeenCalled()
  })

  it('reacts to browser offline events while mounted', async () => {
    await renderExtractor()
    expect(buttonByText('Start Automatic Extraction').disabled).toBe(false)

    setNavigatorOnline(false)
    await act(async () => window.dispatchEvent(new Event('offline')))

    expect(buttonByText('Start Automatic Extraction').disabled).toBe(true)
    expect(container!.textContent).toContain(OFFLINE_LYRIC_EXTRACTION_MESSAGE)
  })

  it('allows extraction again after the browser comes back online', async () => {
    setNavigatorOnline(false)
    await renderExtractor()
    expect(buttonByText('Start Automatic Extraction').disabled).toBe(true)

    setNavigatorOnline(true)
  setDocumentVisibility('visible')
    await act(async () => window.dispatchEvent(new Event('online')))

    const button = buttonByText('Start Automatic Extraction')
    expect(button.disabled).toBe(false)

    await act(async () => button.click())
    await flush()

    expect(mocks.ensurePreparedTranscriptionAudio).toHaveBeenCalled()
    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', {
      body: expect.objectContaining({
        action: 'start',
        audioTrackId: 'track-1',
        options: expect.objectContaining({ timingDetail: 'line+word' }),
      }),
    })
    expect(container!.textContent).toContain('Extraction queued')
  })

  it('keeps provider network failures useful without implying local offline transcription', async () => {
    mocks.functionsInvoke.mockResolvedValueOnce({
      data: { error: { code: 'provider_unavailable', message: 'The transcription provider could not be reached.' } },
      error: null,
    })

    await renderExtractor()
    await act(async () => buttonByText('Start Automatic Extraction').click())
    await flush()

    expect(mocks.ensurePreparedTranscriptionAudio).toHaveBeenCalled()
    expect(container!.textContent).toContain('The transcription provider could not be reached.')
    expect(container!.textContent).not.toContain('offline transcription')
  })

  it('continues to the secure server fallback when browser codec preparation cannot decode the track', async () => {
    mocks.ensurePreparedTranscriptionAudio.mockRejectedValueOnce(
      new Error('This audio file could not be decoded in the browser. Convert it to a supported format (MP3, M4A, WAV, OGG) or configure the optional worker fallback.'),
    )

    await renderExtractor()
    await act(async () => buttonByText('Start Automatic Extraction').click())
    await flush()

    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', {
      body: expect.objectContaining({ action: 'start', audioTrackId: 'track-1' }),
    })
    expect(container!.textContent).toContain('secure server fallback')
  })
})

describe('AI lyric extractor operation ownership', () => {
  it('rolls back prepared chunks when transcription job creation fails', async () => {
    mocks.ensurePreparedTranscriptionAudio.mockResolvedValueOnce({ prepared: true, operationId: 'prep-op-1' })
    mocks.functionsInvoke.mockResolvedValueOnce({ data: { error: { code: 'database_save_failure', message: 'Job creation failed.' } }, error: null })
    mocks.getAudioPreparationOperation.mockResolvedValueOnce({ job_id: null })

    await renderExtractor()
    await act(async () => buttonByText('Start Automatic Extraction').click())
    await flush()

    expect(mocks.rollbackPreparedTranscriptionAudio).toHaveBeenCalledWith(
      'prep-op-1',
      'Transcription job creation failed.',
      'failed',
    )
    expect(container!.textContent).toContain('Job creation failed.')
  })

  it('ignores a completed-document response that arrives after the selected track changes', async () => {
    const previewResponse = deferred<{ document: LyricDocument; cues: LyricCue[] }>()
    recentRows = [jobRow('old-completed', 'completed')]
    mocks.getFullLyricDocument.mockReturnValueOnce(previewResponse.promise)

    await renderExtractor()
    recentRows = []
    await rerenderExtractor({ ...selectedTrack(), id: 'audio-track-2', dbId: 'track-2', title: 'From Grace' })

    previewResponse.resolve({ document: lyricDocument('doc-old-completed'), cues: [cue()] })
    await flush()

    expect(container!.textContent).toContain('From Grace')
    expect(container!.textContent).not.toContain('Recovered AI Draft')
  })

  it('cancels and ignores a late start response after the selected track changes', async () => {
    const startResponse = deferred<{ data: { job: LyricTranscriptionJobRow; duplicate: boolean }; error: null }>()
    mocks.functionsInvoke.mockImplementation(async (_name: string, options: { body?: Record<string, unknown> }) => {
      if (options.body?.action === 'start') return startResponse.promise
      if (options.body?.action === 'cancel') return { data: { job: jobRow('late-job', 'cancelled') }, error: null }
      return { data: {}, error: null }
    })

    await renderExtractor()
    await act(async () => buttonByText('Start Automatic Extraction').click())
    const nextTrack = { ...selectedTrack(), id: 'audio-track-2', dbId: 'track-2', title: 'From Grace', fileName: 'from-grace.mp3', storagePath: 'user-1/from-grace.mp3' }
    await rerenderExtractor(nextTrack)
    expect(buttonByText('Start Automatic Extraction').disabled).toBe(false)

    startResponse.resolve({ data: { job: jobRow('late-job', 'queued'), duplicate: false }, error: null })
    await flush()
    await flush()

    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', { body: { action: 'cancel', jobId: 'late-job' } })
    expect(container!.textContent).toContain('From Grace')
    expect(container!.textContent).not.toContain('Extraction queued')
    expect(mocks.getFullLyricDocument).not.toHaveBeenCalled()
  })

  it('cancels a reconciled server job when an ambiguous start failure arrives after ownership changed', async () => {
    const startResponse = deferred<{ data: { error: { code: string; message: string } }; error: null }>()
    mocks.ensurePreparedTranscriptionAudio.mockResolvedValueOnce({ prepared: true, operationId: 'prep-op-attached' })
    mocks.getAudioPreparationOperation.mockResolvedValueOnce({ job_id: 'attached-job' })
    mocks.functionsInvoke.mockImplementation(async (_name: string, options: { body?: Record<string, unknown> }) => {
      if (options.body?.action === 'start') return startResponse.promise
      if (options.body?.action === 'cancel') return { data: { job: jobRow('attached-job', 'cancelled') }, error: null }
      return { data: {}, error: null }
    })

    await renderExtractor()
    await act(async () => buttonByText('Start Automatic Extraction').click())
    await rerenderExtractor({ ...selectedTrack(), id: 'audio-track-2', dbId: 'track-2', title: 'From Grace' })

    startResponse.resolve({ data: { error: { code: 'database_save_failure', message: 'Response interrupted.' } }, error: null })
    await flush()
    await flush()

    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', { body: { action: 'cancel', jobId: 'attached-job' } })
    expect(container!.textContent).not.toContain('Response interrupted.')
  })
})

describe('AI lyric extractor provider labels and retries', () => {
  it('labels known providers and only falls back to a raw id for unknown providers', () => {
    expect(lyricTranscriptionProviderLabel('groq')).toBe('Groq Whisper')
    expect(lyricTranscriptionProviderLabel('openai')).toBe('Legacy OpenAI')
    expect(lyricTranscriptionProviderLabel('custom')).toBe('Custom provider')
    expect(lyricTranscriptionProviderLabel('future-provider')).toBe('Provider: future-provider')
  })

  it('retries failed Groq jobs through the existing stored-track workflow', async () => {
    recentRows = [jobRow('failed-groq', 'failed', {
      error_code: 'rate_limit',
      error_message: 'The transcription provider is busy. Try again shortly.',
      provider_metadata: { model: 'whisper-large-v3-turbo', processingMode: 'direct' },
    })]

    await renderExtractor()
    await act(async () => buttonByText('Retry Extraction').click())
    await flush()

    expect(mocks.ensurePreparedTranscriptionAudio).toHaveBeenCalledWith(selectedTrack(), expect.objectContaining({
      force: false,
    }))
    expect(mocks.functionsInvoke).toHaveBeenCalledWith('lyric-transcription', { body: expect.objectContaining({ action: 'retry', jobId: 'failed-groq' }) })
    expect(container!.textContent).toContain('Retry queued.')
  })
})
