import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LyricCue, LyricDocument, LyricTranscriptionJob } from '../../../types/lyrics'
import { getFullLyricDocument, saveLyricDocumentAtomic } from '../../../lib/lyricsDb'
import { createLyricCueInputFromCue } from '../../../types/lyrics'
import { LYRIC_CUE_STYLE_LABELS, segmentTimedWords, segmentationProvenance, type LyricCueStyle } from '../../../../supabase/functions/_shared/lyricCueSegmentation'
import { formatMs } from '../../../lib/lyricsImport'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import {
  cancelLyricTranscription,
  getRecentLyricTranscriptionJobs,
  isActiveLyricTranscriptionJob,
  lyricTranscriptionProviderLabel,
  refreshLyricTranscriptionJob,
  retryLyricTranscription,
  startLyricTranscription,
  type LyricTranscriptionOptions,
} from '../services/lyricExtraction'
import { getLyricReviewStatistics } from '../utils/lyricReview'
import {
  ensurePreparedTranscriptionAudio,
  rollbackPreparedTranscriptionAudio,
  type LocalAudioPreparationProgress,
} from '../services/localAudioPreparation'
import { getAudioPreparationOperation } from '../../../lib/audioPreparationDb'

const CUE_STYLE_OPTIONS: Array<{ value: LyricCueStyle; description: string }> = [
  { value: 'hip-hop', description: 'Short rhythmic phrases' },
  { value: 'balanced', description: 'General-purpose lyric phrasing' },
  { value: 'melodic', description: 'Longer sung phrases' },
  { value: 'vocal-chops', description: 'Short repeated words and samples' },
]

const TIMING_OPTS = [
  { value: 'line', label: 'Line-level' },
  { value: 'word', label: 'Word-level' },
  { value: 'line+word', label: 'Line + Word' },
] as const

interface Props {
  selectedTrack: LyricManagerTrack | null
  existingDocumentCount: number
  activeVersionId: string | null
  onCompletedDraftResolved?: (document: LyricDocument) => void | Promise<void>
  onOpenCompletedDraft: (documentId: string) => void | Promise<void>
  onActivateCompletedDraft: (documentId: string) => void | Promise<void>
}

function jobStatusLabel(job: LyricTranscriptionJob): string {
  switch (job.status) {
    case 'queued': return 'Queued'
    case 'processing': return 'Processing'
    case 'completed': return 'Draft ready'
    case 'failed': return 'Failed'
    case 'cancelled': return 'Cancelled'
  }
}

const PROCESSING_STAGE_LABELS: Record<string, string> = {
  validating: 'Validating…',
  downloading: 'Downloading audio…',
  inspecting: 'Inspecting format…',
  routing: 'Preparing backend…',
  transcribing: 'Transcribing…',
  merging: 'Merging results…',
  saving: 'Saving draft…',
}

function processingStageLabel(job: LyricTranscriptionJob): string | null {
  if (job.status !== 'processing') return null
  const stage = job.providerMetadata.processingStage
  return typeof stage === 'string' ? (PROCESSING_STAGE_LABELS[stage] ?? null) : null
}

const LOCAL_PREPARATION_LABELS: Record<LocalAudioPreparationProgress['stage'], string> = {
  downloading: 'Downloading stored audio…',
  preflight: 'Checking renderer memory and workload…',
  decoding: 'Decoding audio locally…',
  planning: 'Planning Groq-ready audio…',
  encoding: 'Encoding transcription audio…',
  uploading: 'Uploading private transcription audio…',
  saving: 'Saving transcription manifest…',
  cleanup: 'Cleaning incomplete preparation assets…',
  complete: 'Audio preparation complete',
}

export const OFFLINE_LYRIC_EXTRACTION_MESSAGE = 'Lyric extraction requires an internet connection. Connect to the internet and try again.'
export const LYRIC_JOB_STALLED_AFTER_MS = 20 * 60 * 1000

export function lyricJobPollDelayMs(attempt: number, random = Math.random): number {
  const boundedAttempt = Math.max(0, Math.min(4, Math.floor(attempt)))
  const base = Math.min(30_000, 2_000 * (2 ** boundedAttempt))
  return Math.round(base * (0.85 + random() * 0.3))
}

const PROCESSING_MODE_LABELS: Record<string, string> = {
  direct: 'Direct mode',
  'wav-chunking': 'WAV chunking',
  'prepared-audio': 'Browser-prepared audio',
  'long-audio-worker': 'Custom long-audio fallback',
}

function browserReportsOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function providerWarningLabel(warning: string): string {
  return warning.split('_').join(' ')
}

function isPreparationRecoverableError(job: LyricTranscriptionJob | null): boolean {
  return job?.errorCode === 'long_audio_backend_not_configured'
    || job?.errorCode === 'transcription_asset_required'
    || job?.errorCode === 'prepared_audio_missing'
    || job?.errorCode === 'prepared_audio_invalid'
}

function isBrowserCodecFallbackError(error: unknown): boolean {
  return error instanceof Error
    && error.message.toLowerCase().includes('could not be decoded in the browser')
}

export function chooseRecoveredJob(jobs: LyricTranscriptionJob[]): LyricTranscriptionJob | null {
  return jobs.find(isActiveLyricTranscriptionJob) ?? jobs[0] ?? null
}

export function AiLyricExtractor({
  selectedTrack,
  existingDocumentCount,
  activeVersionId,
  onCompletedDraftResolved,
  onOpenCompletedDraft,
  onActivateCompletedDraft,
}: Props) {
  const [job, setJob] = useState<LyricTranscriptionJob | null>(null)
  const [document, setDocument] = useState<LyricDocument | null>(null)
  const [cues, setCues] = useState<LyricCue[]>([])
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [localPreparation, setLocalPreparation] = useState<LocalAudioPreparationProgress | null>(null)
  const [browserOnline, setBrowserOnline] = useState(browserReportsOnline)
  const [jobStalled, setJobStalled] = useState(false)
  const [pollRefreshNonce, setPollRefreshNonce] = useState(0)
  const selectedTrackId = selectedTrack?.dbId ?? null
  const preparationAbortRef = useRef<AbortController | null>(null)
  const operationGenerationRef = useRef(0)
  const selectedTrackIdRef = useRef<string | null>(selectedTrackId)
  selectedTrackIdRef.current = selectedTrackId
  const previewDocumentId = useRef<string | null>(null)
  const previewRequestGenerationRef = useRef(0)
  const pollGenerationRef = useRef(0)
  const pollTimerRef = useRef<number | null>(null)
  const jobOwnerRef = useRef<{ jobId: string | null; trackId: string | null; userId: string | null }>({ jobId: null, trackId: null, userId: null })
  jobOwnerRef.current = { jobId: job?.id ?? null, trackId: job?.audioTrackId ?? null, userId: job?.userId ?? null }

  const activeJobId = job && isActiveLyricTranscriptionJob(job) ? job.id : null
  const activeJobTrackId = activeJobId ? job?.audioTrackId ?? null : null
  const activeJobUserId = activeJobId ? job?.userId ?? null : null
  const jobFingerprintRef = useRef('')
  jobFingerprintRef.current = job ? `${job.status}:${job.progress}:${job.updatedAt}` : ''

  const beginOwnedOperation = useCallback(() => {
    operationGenerationRef.current += 1
    preparationAbortRef.current?.abort()
    const generation = operationGenerationRef.current
    const trackId = selectedTrackId
    const controller = new AbortController()
    preparationAbortRef.current = controller
    const isCurrent = () => (
      !controller.signal.aborted
      && operationGenerationRef.current === generation
      && selectedTrackIdRef.current === trackId
    )
    return { generation, trackId, controller, isCurrent }
  }, [selectedTrackId])

  useEffect(() => {
    const updateOnlineState = () => setBrowserOnline(browserReportsOnline())
    updateOnlineState()
    window.addEventListener('online', updateOnlineState)
    window.addEventListener('offline', updateOnlineState)
    return () => {
      window.removeEventListener('online', updateOnlineState)
      window.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  const [options, setOptions] = useState<LyricTranscriptionOptions>({
    language: 'auto',
    timingDetail: 'line+word',
    confidenceThreshold: 0.6,
    globalOffsetMs: 0,
    cueStyle: 'balanced',
  })
  const [reformatStyle, setReformatStyle] = useState<LyricCueStyle>('balanced')
  const [reformatPreview, setReformatPreview] = useState<LyricCue[] | null>(null)

  const loadPreview = useCallback(async (nextJob: LyricTranscriptionJob | null) => {
    const requestGeneration = ++previewRequestGenerationRef.current
    if (!nextJob?.lyricDocumentId || nextJob.status !== 'completed') {
      previewDocumentId.current = null
      setDocument(null)
      setCues([])
      return
    }
    if (previewDocumentId.current === nextJob.lyricDocumentId) return
    const full = await getFullLyricDocument(nextJob.lyricDocumentId)
    if (
      previewRequestGenerationRef.current !== requestGeneration
      || selectedTrackIdRef.current !== nextJob.audioTrackId
    ) return
    previewDocumentId.current = nextJob.lyricDocumentId
    setDocument(full.document)
    setCues(full.cues)
    void Promise.resolve(onCompletedDraftResolved?.(full.document)).catch(() => undefined)
  }, [onCompletedDraftResolved])

  useEffect(() => {
    let cancelled = false
    selectedTrackIdRef.current = selectedTrackId
    operationGenerationRef.current += 1
    previewRequestGenerationRef.current += 1
    previewDocumentId.current = null
    setJob(null)
    setDocument(null)
    setCues([])
    setError(null)
    setNotice(null)
    setLocalPreparation(null)
    setActionBusy(false)
    setJobStalled(false)
    pollGenerationRef.current += 1
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    preparationAbortRef.current?.abort()
    preparationAbortRef.current = null
    if (!selectedTrackId) return () => { cancelled = true }

    setLoading(true)
    getRecentLyricTranscriptionJobs(selectedTrackId)
      .then(async jobs => {
        if (cancelled) return
        const recovered = chooseRecoveredJob(jobs)
        setJob(recovered)
        await loadPreview(recovered)
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to recover transcription jobs.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      operationGenerationRef.current += 1
      pollGenerationRef.current += 1
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current)
      preparationAbortRef.current?.abort()
      preparationAbortRef.current = null
    }
  }, [loadPreview, selectedTrackId])

  useEffect(() => {
    if (!activeJobId || !activeJobTrackId || !activeJobUserId) {
      setJobStalled(false)
      return
    }
    const generation = ++pollGenerationRef.current
    const owner = { jobId: activeJobId, trackId: activeJobTrackId, userId: activeJobUserId }
    const startedAt = Date.now()
    let attempt = 0
    let lastFingerprint = jobFingerprintRef.current
    let stopped = false
    let polling = false

    const ownsPoll = () => {
      const current = jobOwnerRef.current
      return !stopped
        && pollGenerationRef.current === generation
        && selectedTrackIdRef.current === owner.trackId
        && current.jobId === owner.jobId
        && current.trackId === owner.trackId
        && current.userId === owner.userId
    }

    const clearTimer = () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }

    const schedule = (delay: number) => {
      if (!ownsPoll()) return
      clearTimer()
      pollTimerRef.current = window.setTimeout(() => { void poll() }, delay)
    }

    const poll = async () => {
      if (!ownsPoll() || polling) return
      if (globalThis.document.visibilityState === 'hidden') return
      if (Date.now() - startedAt >= LYRIC_JOB_STALLED_AFTER_MS) {
        setJobStalled(true)
        return
      }
      polling = true
      try {
        const refreshed = await refreshLyricTranscriptionJob(owner.jobId)
        if (!ownsPoll()
          || refreshed.audioTrackId !== owner.trackId
          || refreshed.userId !== owner.userId
          || refreshed.id !== owner.jobId) return
        const fingerprint = `${refreshed.status}:${refreshed.progress}:${refreshed.updatedAt}`
        attempt = fingerprint === lastFingerprint ? attempt + 1 : 0
        lastFingerprint = fingerprint
        setJob(refreshed)
        setJobStalled(false)
        setError(null)
        await loadPreview(refreshed)
        if (!isActiveLyricTranscriptionJob(refreshed)) return
      } catch (pollError) {
        if (!ownsPoll()) return
        attempt += 1
        setError(pollError instanceof Error ? pollError.message : 'Failed to refresh transcription status.')
      } finally {
        polling = false
      }
      if (ownsPoll()) schedule(lyricJobPollDelayMs(attempt))
    }

    const onVisibilityChange = () => {
      if (!ownsPoll()) return
      if (globalThis.document.visibilityState === 'hidden') {
        clearTimer()
        return
      }
      clearTimer()
      void poll()
    }

    setJobStalled(false)
    globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
    schedule(lyricJobPollDelayMs(0))

    return () => {
      stopped = true
      pollGenerationRef.current += 1
      clearTimer()
      globalThis.document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeJobId, activeJobTrackId, activeJobUserId, loadPreview, pollRefreshNonce])

  const review = useMemo(
    () => getLyricReviewStatistics(cues, options.confidenceThreshold),
    [cues, options.confidenceThreshold],
  )

  const handleStart = useCallback(async () => {
    if (!selectedTrack) return
    if (!browserReportsOnline()) {
      setBrowserOnline(false)
      setNotice(null)
      setError(OFFLINE_LYRIC_EXTRACTION_MESSAGE)
      return
    }
    const owned = beginOwnedOperation()
    setActionBusy(true)
    setError(null)
    setNotice(null)
    let preparationOperationId: string | undefined
    try {
      let preparation = { prepared: false } as Awaited<ReturnType<typeof ensurePreparedTranscriptionAudio>>
      let usingServerFallback = false
      try {
        preparation = await ensurePreparedTranscriptionAudio(selectedTrack, {
          signal: owned.controller.signal,
          isCurrent: owned.isCurrent,
          onProgress: progress => { if (owned.isCurrent()) setLocalPreparation(progress) },
        })
        preparationOperationId = preparation.operationId
      } catch (preparationError) {
        if (preparationError instanceof DOMException && preparationError.name === 'AbortError') throw preparationError
        if (!isBrowserCodecFallbackError(preparationError)) throw preparationError
        usingServerFallback = true
        if (owned.isCurrent()) setLocalPreparation(null)
      }
      if (!owned.isCurrent()) throw new DOMException('Audio preparation was cancelled.', 'AbortError')

      const result = await startLyricTranscription(selectedTrack.dbId, options, preparationOperationId)
      if (!owned.isCurrent()) {
        void cancelLyricTranscription(result.job.id).catch(() => undefined)
        throw new DOMException('The transcription request no longer owns the selected track.', 'AbortError')
      }
      setLocalPreparation(null)
      setJob(result.job)
      setDocument(null)
      setCues([])
      previewDocumentId.current = null
      setNotice(result.duplicate
        ? 'An extraction is already running for this track. Its status has been resumed.'
        : usingServerFallback
          ? 'Browser audio preparation could not decode this file. Extraction queued through the secure server fallback if it is configured.'
          : preparation.prepared
            ? 'Groq-ready audio prepared privately and extraction queued.'
            : 'Extraction queued. You can leave Lyric Manager and return without losing the job.')
    } catch (startError) {
      const wasCancelled = startError instanceof DOMException && startError.name === 'AbortError'
      let recovered = false
      let reconciliationFailure: string | null = null
      if (preparationOperationId) {
        try {
          const operation = await getAudioPreparationOperation(preparationOperationId)
          if (operation?.job_id) {
            if (!owned.isCurrent()) {
              await cancelLyricTranscription(operation.job_id).catch(() => undefined)
            } else {
              const attachedJob = await refreshLyricTranscriptionJob(operation.job_id)
              if (owned.isCurrent() && attachedJob.audioTrackId === selectedTrack.dbId) {
                setJob(attachedJob)
                setNotice('The server accepted the extraction before the response was interrupted. Its status has been recovered.')
                recovered = true
              }
            }
          } else if (!operation?.job_id) {
            await rollbackPreparedTranscriptionAudio(
              preparationOperationId,
              wasCancelled ? 'Audio preparation was cancelled before job creation.' : 'Transcription job creation failed.',
              wasCancelled ? 'cancelled' : 'failed',
            )
          }
        } catch (reconcileError) {
          reconciliationFailure = reconcileError instanceof Error
            ? reconcileError.message
            : 'Prepared-audio cleanup reconciliation failed.'
        }
      }
      if (!recovered && owned.isCurrent()) {
        const failure = startError instanceof Error ? startError.message : 'Failed to start lyric extraction.'
        if (!wasCancelled) {
          setError(reconciliationFailure ? `${failure} Cleanup reconciliation also failed: ${reconciliationFailure}` : failure)
        } else {
          setNotice(reconciliationFailure
            ? `Audio preparation was cancelled, but cleanup reconciliation needs attention: ${reconciliationFailure}`
            : 'Audio preparation cancelled. Any uploaded temporary chunks are being cleaned safely.')
        }
      }
    } finally {
      if (operationGenerationRef.current === owned.generation) {
        preparationAbortRef.current = null
        setLocalPreparation(null)
        setActionBusy(false)
      }
    }
  }, [beginOwnedOperation, options, selectedTrack])

  const handleCancel = useCallback(async () => {
    preparationAbortRef.current?.abort()
    pollGenerationRef.current += 1
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    operationGenerationRef.current += 1
    if (!job) {
      setNotice('Audio preparation cancellation requested. Temporary assets will be cleaned before the operation retires.')
      setActionBusy(false)
      return
    }
    setActionBusy(true)
    setError(null)
    try {
      const cancelledJob = await cancelLyricTranscription(job.id)
      if (cancelledJob.audioTrackId !== selectedTrackIdRef.current) return
      setJob(cancelledJob)
      setNotice('Cancellation requested. Work already inside a provider call may finish, but no later chunk, manifest, job result, or lyric draft will be applied.')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel transcription.')
    } finally {
      setActionBusy(false)
    }
  }, [job])

  const handleRetry = useCallback(async () => {
    if (!job) return
    if (!browserReportsOnline()) {
      setBrowserOnline(false)
      setNotice(null)
      setError(OFFLINE_LYRIC_EXTRACTION_MESSAGE)
      return
    }
    const owned = beginOwnedOperation()
    setActionBusy(true)
    setError(null)
    setNotice(null)
    let preparationOperationId: string | undefined
    try {
      if (selectedTrack) {
        try {
          const preparation = await ensurePreparedTranscriptionAudio(selectedTrack, {
            signal: owned.controller.signal,
            isCurrent: owned.isCurrent,
            onProgress: progress => { if (owned.isCurrent()) setLocalPreparation(progress) },
            force: job.errorCode === 'prepared_audio_missing' || job.errorCode === 'prepared_audio_invalid' || job.status === 'cancelled',
          })
          preparationOperationId = preparation.operationId
        } catch (preparationError) {
          if (preparationError instanceof DOMException && preparationError.name === 'AbortError') throw preparationError
          if (!isBrowserCodecFallbackError(preparationError)) throw preparationError
          if (owned.isCurrent()) setLocalPreparation(null)
        }
      }
      if (!owned.isCurrent()) throw new DOMException('Retry was cancelled.', 'AbortError')
      const result = await retryLyricTranscription(job.id, preparationOperationId)
      if (!owned.isCurrent()) {
        void cancelLyricTranscription(result.job.id).catch(() => undefined)
        throw new DOMException('Retry no longer owns the selected track.', 'AbortError')
      }
      setLocalPreparation(null)
      setJob(result.job)
      setDocument(null)
      setCues([])
      previewDocumentId.current = null
      setNotice(result.duplicate ? 'An active retry was already found and resumed.' : 'Retry queued.')
    } catch (retryError) {
      const wasCancelled = retryError instanceof DOMException && retryError.name === 'AbortError'
      let reconciliationFailure: string | null = null
      if (preparationOperationId) {
        try {
          const operation = await getAudioPreparationOperation(preparationOperationId)
          if (operation?.job_id && !owned.isCurrent()) {
            await cancelLyricTranscription(operation.job_id).catch(() => undefined)
          } else if (!operation?.job_id) {
            await rollbackPreparedTranscriptionAudio(
              preparationOperationId,
              wasCancelled ? 'Retry preparation was cancelled before job creation.' : 'Retry job creation failed.',
              wasCancelled ? 'cancelled' : 'failed',
            )
          }
        } catch (reconcileError) {
          reconciliationFailure = reconcileError instanceof Error
            ? reconcileError.message
            : 'Retry cleanup reconciliation failed.'
        }
      }
      if (owned.isCurrent()) {
        const failure = retryError instanceof Error ? retryError.message : 'Failed to retry transcription.'
        if (!wasCancelled) {
          setError(reconciliationFailure ? `${failure} Cleanup reconciliation also failed: ${reconciliationFailure}` : failure)
        } else {
          setNotice(reconciliationFailure
            ? `Audio preparation was cancelled, but retry cleanup needs attention: ${reconciliationFailure}`
            : 'Audio preparation cancelled. Temporary assets will not be reused until cleanup is reconciled.')
        }
      }
    } finally {
      if (operationGenerationRef.current === owned.generation) {
        preparationAbortRef.current = null
        setLocalPreparation(null)
        setActionBusy(false)
      }
    }
  }, [beginOwnedOperation, job, selectedTrack])

  const previewReformat = useCallback(() => {
    if (!document) return
    const words = cues.flatMap(cue => cue.words ?? [])
    const segmented = segmentTimedWords(words, reformatStyle, selectedTrack?.analysisPayload ?? null).map((cue, index): LyricCue => ({
      id: `reformat-preview-${index}`, startMs: cue.startMs, endMs: cue.endMs, text: cue.text, words: cue.words,
      source: 'transcription', reviewStatus: 'unreviewed', analysisMetadata: { boundaryReason: cue.boundaryReason },
      ...(cue.sectionId ? { sectionId: cue.sectionId } : {}),
    }))
    setReformatPreview(segmented)
  }, [cues, document, reformatStyle, selectedTrack?.analysisPayload])

  const saveReformat = useCallback(async () => {
    if (!document || !selectedTrack || !reformatPreview?.length) return
    setActionBusy(true); setError(null)
    try {
      const label = LYRIC_CUE_STYLE_LABELS[reformatStyle].replace(' / Rap', '')
      const result = await saveLyricDocumentAtomic({
        activate: false,
        document: {
          title: `${selectedTrack.title} AI Draft · ${label}`, artist: document.artist, audioTrackId: selectedTrack.dbId, visualSessionId: document.visualSessionId ?? null,
          sourceType: document.sourceType, sourceFormat: document.sourceFormat, rawSourceText: document.rawSourceText ?? null,
          defaultStyle: document.defaultStyle, defaultAnimation: document.defaultAnimation, defaultEffects: document.defaultEffects, globalOffsetMs: document.globalOffsetMs,
          metadata: { ...document.metadata, ...segmentationProvenance(reformatStyle, selectedTrack.analysisPayload ?? null, document.id), trackAnalysisVersion: selectedTrack.analysisPayload?.analysisVersion ?? null, trackAnalysisUpdatedAt: selectedTrack.analysisPayload?.lastGridRebuiltAt ?? selectedTrack.analysisPayload?.createdAt ?? null },
        },
        cues: reformatPreview.map((cue, index) => createLyricCueInputFromCue(cue, '', index)),
      })
      if (!result.ok) throw new Error(result.message)
      setNotice(`Saved ${result.cues.length} cues as a new inactive lyric version.`); setReformatPreview(null)
      await onCompletedDraftResolved?.(result.document)
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Failed to save reformatted cues.') }
    finally { setActionBusy(false) }
  }, [document, onCompletedDraftResolved, reformatPreview, reformatStyle, selectedTrack])

  if (!selectedTrack) {
    return (
      <div className="lmv-workflow-content">
        <div className="lmv-editor-placeholder">Select or upload a stored track before starting automatic lyric extraction.</div>
      </div>
    )
  }

  const active = isActiveLyricTranscriptionJob(job)
  const progressPercent = Math.round((job?.progress ?? 0) * 100)
  const providerWarnings = Array.isArray(job?.providerMetadata.warnings)
    ? job.providerMetadata.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []

  const stageLabel = job ? processingStageLabel(job) : null
  const chunksCompleted = metadataNumber(job?.providerMetadata, 'chunksCompleted')
  const chunksTotal = metadataNumber(job?.providerMetadata, 'chunksTotal')
  const unitCount = metadataNumber(job?.providerMetadata, 'unitCount')
  const showChunkProgress = active && chunksTotal !== null && chunksTotal > 1 && chunksCompleted !== null
  const modelLabel = metadataString(job?.providerMetadata, 'model')
  const rawProcessingMode = metadataString(job?.providerMetadata, 'processingMode')
  const processingModeLabel = rawProcessingMode ? (PROCESSING_MODE_LABELS[rawProcessingMode] ?? rawProcessingMode) : null
  const displayedChunkCount = chunksTotal && chunksTotal > 1 ? chunksTotal : unitCount && unitCount > 1 ? unitCount : null
  const jobMetadataBadges = [
    modelLabel,
    processingModeLabel,
    displayedChunkCount ? `${displayedChunkCount} chunks` : null,
  ].filter((value): value is string => Boolean(value))

  const preparationRecoverable = isPreparationRecoverableError(job)
  const canRetry = job?.status === 'failed' || job?.status === 'cancelled'

  const fnVersion = typeof job?.providerMetadata.fnVersion === 'string'
    ? job.providerMetadata.fnVersion : null

  return (
    <div className="lmv-workflow-content">
      <div className="lmv-ai-notice lmv-ai-notice--ready">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, opacity: 0.75 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        <span>
          Groq credentials stay server-side. For oversized tracks, DRMVYZ creates private transcription-ready audio in your browser before the server sends safe chunks.
        </span>
      </div>

      <div className="lmv-section-label">STORED TRACK</div>
      <div className="lmv-ai-track-card">
        <div>
          <strong>{selectedTrack.title}</strong>
          <span>{selectedTrack.artist || 'Unknown artist'}</span>
        </div>
        <div className="lmv-ai-track-meta">
          <span>{selectedTrack.durationSec ? `${Math.floor(selectedTrack.durationSec / 60)}:${String(Math.round(selectedTrack.durationSec % 60)).padStart(2, '0')}` : 'Duration pending'}</span>
          <span>{selectedTrack.mimeType || selectedTrack.fileName.split('.').pop()?.toUpperCase()}</span>
          <span>{existingDocumentCount} lyric version{existingDocumentCount === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="lmv-parse-next-hint">
        {activeVersionId
          ? 'Extraction creates a new inactive draft version. It will not overwrite or automatically replace the active lyrics.'
          : 'The first successful extraction will become active automatically. Later extractions remain inactive drafts until you choose to activate them.'}
      </div>

      <div className="lmv-section-label" style={{ marginTop: 16 }}>EXTRACTION SETTINGS</div>
      <div className="lmv-grid2">
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-extraction-language">LANGUAGE</label>
          <select id="lyric-extraction-language" className="lmv-select" value={options.language}
            disabled={active}
            onChange={event => setOptions(current => ({ ...current, language: event.target.value }))}>
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-extraction-timing">TIMING DETAIL</label>
          <select id="lyric-extraction-timing" className="lmv-select" value={options.timingDetail}
            disabled={active}
            onChange={event => setOptions(current => ({ ...current, timingDetail: event.target.value as LyricTranscriptionOptions['timingDetail'] }))}>
            {TIMING_OPTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-extraction-cue-style">CUE STYLE</label>
          <select id="lyric-extraction-cue-style" className="lmv-select" value={options.cueStyle ?? 'balanced'} disabled={active}
            onChange={event => setOptions(current => ({ ...current, cueStyle: event.target.value as LyricCueStyle }))}>
            {CUE_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{LYRIC_CUE_STYLE_LABELS[option.value]} · {option.description}</option>)}
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-extraction-offset">GLOBAL OFFSET MS</label>
          <input id="lyric-extraction-offset" className="lmv-num" type="number" step={50} value={options.globalOffsetMs ?? 0}
            disabled={active}
            onChange={event => setOptions(current => ({ ...current, globalOffsetMs: Number.parseInt(event.target.value, 10) || 0 }))} />
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label" htmlFor="lyric-extraction-confidence">CONFIDENCE THRESHOLD</label>
          <div className="lmv-slider-row">
            <input id="lyric-extraction-confidence" type="range" className="lmv-slider" min={0} max={1} step={0.05}
              disabled={active}
              value={options.confidenceThreshold ?? 0.6}
              onChange={event => setOptions(current => ({ ...current, confidenceThreshold: Number.parseFloat(event.target.value) }))} />
            <span className="lmv-slider-val">{(options.confidenceThreshold ?? 0.6).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {!active && (!job || job.status === 'completed') && (
        <button className="lmv-btn lmv-btn--primary lmv-extract-btn" disabled={loading || actionBusy || !browserOnline} onClick={() => { void handleStart() }}>
          {actionBusy
            ? localPreparation ? LOCAL_PREPARATION_LABELS[localPreparation.stage] : 'Starting…'
            : job?.status === 'completed' ? 'Extract Another Draft Version' : 'Start Automatic Extraction'}
        </button>
      )}
      {!browserOnline && (
        <div className="lmv-ai-offline-hint" role="status" aria-live="polite">{OFFLINE_LYRIC_EXTRACTION_MESSAGE}</div>
      )}

      {document && cues.some(cue => (cue.words?.length ?? 0) > 0) && (
        <div className="lmv-job-card">
          <div className="lmv-section-label">REFORMAT CUES</div>
          <div className="lmv-grid2">
            <select className="lmv-select" value={reformatStyle} onChange={event => { setReformatStyle(event.target.value as LyricCueStyle); setReformatPreview(null) }}>
              {CUE_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{LYRIC_CUE_STYLE_LABELS[option.value]}</option>)}
            </select>
            <button className="lmv-btn" onClick={previewReformat}>Preview Reformat</button>
          </div>
          {reformatPreview && <div className="lmv-parse-next-hint">Current: {cues.length} cues · Proposed: {reformatPreview.length} cues
            <div><button className="lmv-btn lmv-btn--primary" disabled={actionBusy} onClick={() => void saveReformat()}>Save New Inactive Version</button> <button className="lmv-btn" onClick={() => setReformatPreview(null)}>Cancel</button></div>
          </div>}
        </div>
      )}

      {localPreparation && (
        <div className="lmv-job-card lmv-job-card--processing" aria-live="polite">
          <div className="lmv-job-header">
            <div>
              <span className="lmv-job-status">Preparing audio</span>
              <span className="lmv-job-stage">{LOCAL_PREPARATION_LABELS[localPreparation.stage]}</span>
            </div>
            <span className="lmv-job-progress-label">{Math.round(localPreparation.progress * 100)}%</span>
          </div>
          <div className="lmv-job-progress" role="progressbar" aria-label="Local audio preparation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(localPreparation.progress * 100)}>
            <div style={{ width: `${Math.round(localPreparation.progress * 100)}%` }} />
          </div>
          {localPreparation.chunkTotal && localPreparation.chunkTotal > 1 && (
            <div className="lmv-job-chunk-progress">
              Chunk {localPreparation.chunkIndex ?? 1} of {localPreparation.chunkTotal}
            </div>
          )}
          {localPreparation.stage === 'decoding' && (
            <div className="lmv-parse-next-hint">
              Browser decoding cannot stop mid-call. Cancel still blocks every later resample, encode, upload, manifest, job, poll, and result step.
            </div>
          )}
          <div className="lmv-import-actions">
            <button className="lmv-btn lmv-btn--ghost" onClick={() => { void handleCancel() }}>Cancel Preparation</button>
          </div>
        </div>
      )}

      {job && (
        <div className={`lmv-job-card lmv-job-card--${job.status}`}>
          <div className="lmv-job-header">
            <div>
              <span className="lmv-job-status">{jobStatusLabel(job)}</span>
              <span className="lmv-job-provider">{lyricTranscriptionProviderLabel(job.provider)}</span>
              {stageLabel && <span className="lmv-job-stage">{stageLabel}</span>}
            </div>
            <span className="lmv-job-progress-label">{progressPercent}%</span>
          </div>
          <div className="lmv-job-progress" role="progressbar" aria-label="Transcription progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <div style={{ width: `${progressPercent}%` }} />
          </div>
          {jobMetadataBadges.length > 0 && (
            <div className="lmv-job-meta-strip">
              {jobMetadataBadges.map(badge => <span key={badge}>{badge}</span>)}
            </div>
          )}
          {showChunkProgress && (
            <div className="lmv-job-chunk-progress">
              Chunk {chunksCompleted} of {chunksTotal}
            </div>
          )}
          {providerWarnings.length > 0 && (
            <div className="lmv-job-warning-list">
              {providerWarnings.slice(0, 3).map(warning => <span key={warning}>Warning: {providerWarningLabel(warning)}</span>)}
            </div>
          )}
          {job.errorMessage && (
            <div className="lmv-job-error" role="alert">
              {preparationRecoverable
                ? 'This track needs a fresh transcription-ready audio copy. Retry Extraction and DRMVYZ will prepare it locally before restarting the server job.'
                : job.errorMessage}
            </div>
          )}
          {active && (
            <div className="lmv-import-actions">
              <button className="lmv-btn lmv-btn--ghost" disabled={actionBusy} onClick={() => { void handleCancel() }}>Cancel</button>
            </div>
          )}
          {active && jobStalled && (
            <div className="lmv-msg-list lmv-msg-list--warn" role="status">
              <div className="lmv-msg-item">This extraction has not changed for a while. Background polling is paused to avoid unnecessary traffic.</div>
              <div className="lmv-import-actions">
                <button className="lmv-btn lmv-btn--ghost" onClick={() => setPollRefreshNonce(value => value + 1)}>Refresh status</button>
              </div>
            </div>
          )}
          {canRetry && (
            <div className="lmv-import-actions">
              <button className="lmv-btn lmv-btn--primary" disabled={actionBusy || !browserOnline} onClick={() => { void handleRetry() }}>
                {actionBusy ? 'Retrying…' : 'Retry Extraction'}
              </button>
            </div>
          )}
          {fnVersion && (
            <div className="lmv-job-fn-version" aria-hidden="true">fn v{fnVersion}</div>
          )}
        </div>
      )}

      {notice && <div className="lmv-msg-list lmv-msg-list--warn" role="status" aria-live="polite"><div className="lmv-msg-item">{notice}</div></div>}
      {error && <div className="lmv-msg-list lmv-msg-list--error" role="alert"><div className="lmv-msg-item">✕ {error}</div></div>}

      {job?.status === 'completed' && document && (
        <>
          <div className="lmv-section-label" style={{ marginTop: 18 }}>REVIEW SUMMARY</div>
          <div className="lmv-validation-box">
            <div className="lmv-validation-row"><span className="lmv-val-label">Draft</span><span className="lmv-val-value">{document.title}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Cues</span><span className="lmv-val-value">{review.total}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Unreviewed</span><span className="lmv-val-value">{review.unreviewed}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Low confidence</span><span className="lmv-val-value">{review.lowConfidence}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Warnings</span><span className="lmv-val-value">{review.withWarnings}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Runtime status</span><span className="lmv-val-value">{document.isActive ? 'Active automatically' : 'Inactive draft'}</span></div>
          </div>

          {(providerWarnings.length > 0) && (
            <div className="lmv-msg-list lmv-msg-list--warn">
              {providerWarnings.slice(0, 4).map(warning => <div className="lmv-msg-item" key={warning}>Review warning: {providerWarningLabel(warning)}</div>)}
            </div>
          )}

          <div className="lmv-cue-preview-list" style={{ marginTop: 8 }}>
            {cues.slice(0, 8).map(cue => (
              <div key={cue.id} className="lmv-cue-preview-row">
                <span className="lmv-cue-ts">{formatMs(cue.startMs)} → {formatMs(cue.endMs)}</span>
                <span className="lmv-cue-text">{cue.text}</span>
                {cue.confidence !== undefined && <span className="lmv-cue-badge">{Math.round(cue.confidence * 100)}%</span>}
              </div>
            ))}
            {cues.length > 8 && <div className="lmv-cue-more">+{cues.length - 8} more cues</div>}
          </div>

          <div className="lmv-import-actions">
            <button className="lmv-btn lmv-btn--primary" onClick={() => { void onOpenCompletedDraft(document.id) }}>Open in Cue Editor</button>
            {!document.isActive && (
              <button className="lmv-btn lmv-btn--ghost" onClick={() => { void onActivateCompletedDraft(document.id) }}>Activate This Version</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
