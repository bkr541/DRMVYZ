import { describe, expect, it } from 'vitest'
import type { LyricTranscriptionJob } from '../../../types/lyrics'
import { chooseRecoveredJob } from './AiLyricExtractor'

function job(id: string, status: LyricTranscriptionJob['status'], createdAt: string): LyricTranscriptionJob {
  return {
    id,
    userId: 'user-1',
    audioTrackId: 'track-1',
    lyricDocumentId: status === 'completed' ? `doc-${id}` : null,
    provider: 'openai',
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
})
