import { useEffect, useMemo, useRef, useState } from 'react'
import { Collapsible } from '../../../components/vyzualz/react/ReactControlRows'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import type { LyricCue, LyricDocument, LyricTranscriptionJob } from '../../../types/lyrics'
import type { LyricWriteStatus } from '../../../stores/lyricsStore'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'
import { getLyricReviewStatistics } from '../utils/lyricReview'

interface Props {
  selectedTrack: LyricManagerTrack | null
  loadedTrackMatches: boolean
  activeVersion: LyricDocumentVersion | null
  editorDocument: LyricDocument | null
  cues: LyricCue[]
  trackMapAvailable: boolean
  trackMapRevision: string | null
  saveStatus: LyricWriteStatus
  saveRevision: number | null
  runtimeAudioTrackId: string | null
  runtimeActiveDocumentId: string | null
  lyricsDisplayEnabled: boolean
  latestJob: LyricTranscriptionJob | null
  jobsLoading?: boolean
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requestString(job: LyricTranscriptionJob | null, key: string): string | null {
  const value = job?.requestOptions[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cueStyleLabel(value: string | null): string {
  if (!value) return 'Balanced / unspecified'
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function CopyableValue({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
  }, [])

  if (!value) return <span className="lmv-diagnostic-missing">Missing</span>
  return (
    <span className="lmv-copyable-value">
      <code title={value}>{value}</code>
      <button
        type="button"
        className="lmv-inline-action"
        onClick={() => {
          const write = navigator.clipboard?.writeText(value)
          if (!write) return
          void write.then(() => {
            setCopied(true)
            if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current)
            resetTimerRef.current = window.setTimeout(() => {
              resetTimerRef.current = null
              setCopied(false)
            }, 1200)
          }).catch(() => undefined)
        }}
        aria-label={`Copy identifier ${value}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}

export function LyricWorkflowStatus({
  selectedTrack,
  loadedTrackMatches,
  activeVersion,
  editorDocument,
  cues,
  trackMapAvailable,
  trackMapRevision,
  saveStatus,
  saveRevision,
  runtimeAudioTrackId,
  runtimeActiveDocumentId,
  lyricsDisplayEnabled,
  latestJob,
  jobsLoading = false,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const review = useMemo(() => getLyricReviewStatistics(cues), [cues])
  const wordCount = cues.reduce((total, cue) => total + (cue.words?.length ?? 0), 0)
  const cueStyle = requestString(latestJob, 'cueStyle')
    ?? metadataString(editorDocument?.metadata, 'cueSegmentationStyle')
    ?? metadataString(editorDocument?.metadata, 'cueStyle')
  const extractionSource = latestJob
    ? latestJob.sourceMode === 'vocal_reference' ? 'Vocal Reference' : 'Full Mix'
    : editorDocument?.sourceType === 'ai_transcription' ? 'AI extraction' : 'Manual / import'
  const reviewLabel = cues.length === 0
    ? 'No cues'
    : review.unreviewed === 0 && review.lowConfidence === 0
      ? 'Review complete'
      : `${review.unreviewed} unreviewed · ${review.lowConfidence} low confidence`

  return (
    <section className="lmv-extraction-console" aria-label="Lyric workflow status">
      <Collapsible label="Workflow Status" defaultOpen>
        <dl className="lmv-workflow-status-grid">
          <div><dt>Selected track</dt><dd>{selectedTrack?.title || selectedTrack?.fileName || 'None'}</dd></div>
          <div><dt>Loaded-track match</dt><dd className={loadedTrackMatches ? 'lmv-status-good' : 'lmv-status-missing'}>{loadedTrackMatches ? 'Matched' : 'Not matched'}</dd></div>
          <div><dt>Active lyric version</dt><dd>{activeVersion?.title || 'None'}</dd></div>
          <div><dt>Cue count</dt><dd>{cues.length}</dd></div>
          <div><dt>Track Map</dt><dd>{trackMapAvailable ? 'Available' : 'Unavailable'}</dd></div>
          <div><dt>Extraction source</dt><dd>{extractionSource}</dd></div>
          <div><dt>Cue Style</dt><dd>{cueStyleLabel(cueStyle)}</dd></div>
          <div><dt>Save status</dt><dd>{saveStatus.replace(/_/g, ' ')}</dd></div>
          <div><dt>Review status</dt><dd>{reviewLabel}</dd></div>
        </dl>

        <DualRailCollapsible
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          headerClassName="lmv-collapsible-toggle lmv-diagnostics-toggle"
          label="Advanced diagnostics"
        >
          <div className="lmv-diagnostics" aria-label="Advanced lyric diagnostics">
            <p>Identifiers and state only. Provider keys, signed URLs, storage paths, and raw payloads are intentionally excluded.</p>
            <dl>
              <div><dt>Canonical audio track ID</dt><dd><CopyableValue value={selectedTrack?.dbId ?? null} /></dd></div>
              <div><dt>Runtime dbId</dt><dd><CopyableValue value={runtimeAudioTrackId} /></dd></div>
              <div><dt>Editor document ID</dt><dd><CopyableValue value={editorDocument?.id ?? null} /></dd></div>
              <div><dt>Actual active document ID</dt><dd><CopyableValue value={runtimeActiveDocumentId ?? activeVersion?.id ?? null} /></dd></div>
              <div><dt>Transcription job</dt><dd>{jobsLoading ? 'Loading…' : <CopyableValue value={latestJob?.id ?? null} />}</dd></div>
              <div><dt>Job status</dt><dd>{latestJob?.status ?? 'None'}</dd></div>
              <div><dt>Analysis source mode</dt><dd>{latestJob?.sourceMode ?? 'Not recorded'}</dd></div>
              <div><dt>Track Map revision</dt><dd>{trackMapRevision ?? 'Missing'}</dd></div>
              <div><dt>Cue / word counts</dt><dd>{cues.length} / {wordCount}</dd></div>
              <div><dt>Save revision</dt><dd>{saveRevision ?? 'Not saved this session'}</dd></div>
              <div><dt>Display state</dt><dd>{lyricsDisplayEnabled ? 'Global display on' : 'Global display off'} · {editorDocument?.isActive ? 'Open version active' : 'Open version inactive'}</dd></div>
            </dl>
          </div>
        </DualRailCollapsible>
      </Collapsible>
    </section>
  )
}
