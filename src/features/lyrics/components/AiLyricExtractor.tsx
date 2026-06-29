import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LyricCue, LyricDocument, LyricTranscriptionJob } from '../../../types/lyrics'
import { getFullLyricDocument } from '../../../lib/lyricsDb'
import { formatMs } from '../../../lib/lyricsImport'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import {
  cancelLyricTranscription,
  getRecentLyricTranscriptionJobs,
  isActiveLyricTranscriptionJob,
  refreshLyricTranscriptionJob,
  retryLyricTranscription,
  startLyricTranscription,
  type LyricTranscriptionOptions,
} from '../services/lyricExtraction'
import { getLyricReviewStatistics } from '../utils/lyricReview'

const TIMING_OPTS = [
  { value: 'line', label: 'Line-level' },
  { value: 'word', label: 'Word-level' },
  { value: 'line+word', label: 'Line + Word' },
] as const

interface Props {
  selectedTrack: LyricManagerTrack | null
  existingDocumentCount: number
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

export function chooseRecoveredJob(jobs: LyricTranscriptionJob[]): LyricTranscriptionJob | null {
  return jobs.find(isActiveLyricTranscriptionJob) ?? jobs[0] ?? null
}

export function AiLyricExtractor({
  selectedTrack,
  existingDocumentCount,
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
  const previewDocumentId = useRef<string | null>(null)

  const selectedTrackId = selectedTrack?.dbId ?? null
  const activeJobId = job && isActiveLyricTranscriptionJob(job) ? job.id : null

  const [options, setOptions] = useState<LyricTranscriptionOptions>({
    language: 'auto',
    timingDetail: 'line+word',
    confidenceThreshold: 0.6,
    globalOffsetMs: 0,
  })

  const loadPreview = useCallback(async (nextJob: LyricTranscriptionJob | null) => {
    if (!nextJob?.lyricDocumentId || nextJob.status !== 'completed') {
      previewDocumentId.current = null
      setDocument(null)
      setCues([])
      return
    }
    if (previewDocumentId.current === nextJob.lyricDocumentId) return
    const full = await getFullLyricDocument(nextJob.lyricDocumentId)
    previewDocumentId.current = nextJob.lyricDocumentId
    setDocument(full.document)
    setCues(full.cues)
  }, [])

  useEffect(() => {
    let cancelled = false
    previewDocumentId.current = null
    setJob(null)
    setDocument(null)
    setCues([])
    setError(null)
    setNotice(null)
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

    return () => { cancelled = true }
  }, [loadPreview, selectedTrackId])

  useEffect(() => {
    if (!activeJobId) return
    let cancelled = false
    const poll = async () => {
      try {
        const refreshed = await refreshLyricTranscriptionJob(activeJobId)
        if (cancelled) return
        setJob(refreshed)
        setError(null)
        await loadPreview(refreshed)
      } catch (pollError) {
        if (!cancelled) setError(pollError instanceof Error ? pollError.message : 'Failed to refresh transcription status.')
      }
    }
    const timer = window.setInterval(() => { void poll() }, 4_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeJobId, loadPreview])

  const review = useMemo(
    () => getLyricReviewStatistics(cues, options.confidenceThreshold),
    [cues, options.confidenceThreshold],
  )

  const handleStart = useCallback(async () => {
    if (!selectedTrack) return
    setActionBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await startLyricTranscription(selectedTrack.dbId, options)
      setJob(result.job)
      setDocument(null)
      setCues([])
      previewDocumentId.current = null
      setNotice(result.duplicate
        ? 'An extraction is already running for this track. Its status has been resumed.'
        : 'Extraction queued. You can leave Lyric Manager and return without losing the job.')
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start lyric extraction.')
    } finally {
      setActionBusy(false)
    }
  }, [options, selectedTrack])

  const handleCancel = useCallback(async () => {
    if (!job) return
    setActionBusy(true)
    setError(null)
    try {
      const cancelled = await cancelLyricTranscription(job.id)
      setJob(cancelled)
      setNotice('Cancellation requested. A provider call already in flight may finish, but its result will not replace your lyrics.')
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel transcription.')
    } finally {
      setActionBusy(false)
    }
  }, [job])

  const handleRetry = useCallback(async () => {
    if (!job) return
    setActionBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await retryLyricTranscription(job.id)
      setJob(result.job)
      setDocument(null)
      setCues([])
      previewDocumentId.current = null
      setNotice(result.duplicate ? 'An active retry was already found and resumed.' : 'Retry queued.')
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : 'Failed to retry transcription.')
    } finally {
      setActionBusy(false)
    }
  }, [job])

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

  return (
    <div className="lmv-workflow-content">
      <div className="lmv-ai-notice lmv-ai-notice--ready">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, opacity: 0.75 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        <span>
          The server reads the private stored file for <strong>{selectedTrack.title}</strong>. Provider credentials and signed storage URLs never enter the browser.
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
      {existingDocumentCount > 0 && (
        <div className="lmv-parse-next-hint">
          Extraction creates a new inactive draft version. It will not overwrite or automatically replace the active lyrics.
        </div>
      )}

      <div className="lmv-section-label" style={{ marginTop: 16 }}>EXTRACTION SETTINGS</div>
      <div className="lmv-grid2">
        <div className="lmv-field">
          <label className="lmv-field-label">LANGUAGE</label>
          <select className="lmv-select" value={options.language}
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
          <label className="lmv-field-label">TIMING DETAIL</label>
          <select className="lmv-select" value={options.timingDetail}
            disabled={active}
            onChange={event => setOptions(current => ({ ...current, timingDetail: event.target.value as LyricTranscriptionOptions['timingDetail'] }))}>
            {TIMING_OPTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">GLOBAL OFFSET MS</label>
          <input className="lmv-num" type="number" step={50} value={options.globalOffsetMs ?? 0}
            disabled={active}
            onChange={event => setOptions(current => ({ ...current, globalOffsetMs: Number.parseInt(event.target.value, 10) || 0 }))} />
        </div>
        <div className="lmv-field">
          <label className="lmv-field-label">CONFIDENCE THRESHOLD</label>
          <div className="lmv-slider-row">
            <input type="range" className="lmv-slider" min={0} max={1} step={0.05}
              disabled={active}
              value={options.confidenceThreshold ?? 0.6}
              onChange={event => setOptions(current => ({ ...current, confidenceThreshold: Number.parseFloat(event.target.value) }))} />
            <span className="lmv-slider-val">{(options.confidenceThreshold ?? 0.6).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {!active && (!job || job.status === 'completed') && (
        <button className="lmv-btn lmv-btn--primary lmv-extract-btn" disabled={loading || actionBusy} onClick={() => { void handleStart() }}>
          {actionBusy ? 'Starting…' : job?.status === 'completed' ? 'Extract Another Draft Version' : 'Start Automatic Extraction'}
        </button>
      )}

      {job && (
        <div className={`lmv-job-card lmv-job-card--${job.status}`}>
          <div className="lmv-job-header">
            <div>
              <span className="lmv-job-status">{jobStatusLabel(job)}</span>
              <span className="lmv-job-provider">{job.provider === 'openai' ? 'OpenAI' : 'Custom provider'}</span>
            </div>
            <span className="lmv-job-progress-label">{progressPercent}%</span>
          </div>
          <div className="lmv-job-progress" aria-label={`Transcription progress ${progressPercent}%`}>
            <div style={{ width: `${progressPercent}%` }} />
          </div>
          {job.errorMessage && <div className="lmv-job-error">{job.errorMessage}</div>}
          {active && (
            <div className="lmv-import-actions">
              <button className="lmv-btn lmv-btn--ghost" disabled={actionBusy} onClick={() => { void handleCancel() }}>Cancel</button>
            </div>
          )}
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <div className="lmv-import-actions">
              <button className="lmv-btn lmv-btn--primary" disabled={actionBusy} onClick={() => { void handleRetry() }}>
                {actionBusy ? 'Retrying…' : 'Retry Extraction'}
              </button>
            </div>
          )}
        </div>
      )}

      {notice && <div className="lmv-msg-list lmv-msg-list--warn"><div className="lmv-msg-item">{notice}</div></div>}
      {error && <div className="lmv-msg-list lmv-msg-list--error"><div className="lmv-msg-item">✕ {error}</div></div>}

      {job?.status === 'completed' && document && (
        <>
          <div className="lmv-section-label" style={{ marginTop: 18 }}>REVIEW SUMMARY</div>
          <div className="lmv-validation-box">
            <div className="lmv-validation-row"><span className="lmv-val-label">Draft</span><span className="lmv-val-value">{document.title}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Cues</span><span className="lmv-val-value">{review.total}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Unreviewed</span><span className="lmv-val-value">{review.unreviewed}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Low confidence</span><span className="lmv-val-value">{review.lowConfidence}</span></div>
            <div className="lmv-validation-row"><span className="lmv-val-label">Warnings</span><span className="lmv-val-value">{review.withWarnings}</span></div>
          </div>

          {(providerWarnings.length > 0) && (
            <div className="lmv-msg-list lmv-msg-list--warn">
              {providerWarnings.slice(0, 4).map(warning => <div className="lmv-msg-item" key={warning}>Review warning: {warning.split('_').join(' ')}</div>)}
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
            <button className="lmv-btn lmv-btn--ghost" onClick={() => { void onActivateCompletedDraft(document.id) }}>Activate This Version</button>
          </div>
        </>
      )}
    </div>
  )
}
