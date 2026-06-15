import { useSharedAudio } from '../../../context/AudioEngineContext'
import type { TrackAnalysisStatus } from '../../../features/musicIntelligence/types'

const STATUS_LABELS: Record<TrackAnalysisStatus, string> = {
  not_analyzed: 'No track loaded',
  queued:       'Queued',
  decoding:     'Decoding…',
  analyzing:    'Analyzing…',
  complete:     'Ready',
  failed:       'Analysis failed',
}

// Compact timing-readiness display.
// Only shown when sequencing is active so it doesn't clutter the panel.
export function LaserDmxTimingStatus({ sequencingActive }: { sequencingActive: boolean }) {
  const engine = useSharedAudio()
  const bpm    = engine.currentEffectiveBpm
  const status = engine.currentAnalysisStatus

  if (!sequencingActive) return null

  const bpmReady  = bpm !== null && bpm > 0
  const gridReady = status === 'complete'

  const bpmText = bpmReady ? `${(Math.round(bpm * 10) / 10).toFixed(1)} BPM` : '— BPM'
  const statusLabel = STATUS_LABELS[status] ?? 'Unknown'

  return (
    <div className="rv-bm-timing-status">
      <span className={`rv-bm-timing-bpm${bpmReady ? ' rv-bm-timing-bpm--ready' : ' rv-bm-timing-bpm--waiting'}`}>
        {bpmText}
      </span>
      <span className="rv-bm-timing-label">{statusLabel}</span>
      {!bpmReady && (
        <div className="rv-ctrl-info">
          Sequencer waiting for track analysis. Static mode still works.
        </div>
      )}
      {bpmReady && !gridReady && (
        <div className="rv-ctrl-info">
          Beat grid not ready — downbeat reset may be imprecise.
        </div>
      )}
      {status === 'failed' && (
        <div className="rv-ctrl-info" style={{ color: '#c0314a' }}>
          Analysis failed. Re-load the track to retry.
        </div>
      )}
    </div>
  )
}
