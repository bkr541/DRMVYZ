import { AppIcon } from '../../../shared/icons/AppIcon'
import { MusicIntelligenceDiagnosticsPanel } from '../../modulation/MusicIntelligenceDiagnosticsPanel'
import '../trackTimeline/trackTimeline.css'
import { LAB_AUDIO_ANALYSIS, LAB_AUDIO_FRAME, LAB_TRACK_INFO } from './layoutLabAudioIntelligenceFixture'

// ── Layout Lab · AUDIO tab · Audio Intelligence ─────────────────────────────
//
// The Audio Intelligence window from the Track Timeline Visualizer, shown with fixed readings. This is the real
// MusicIntelligenceDiagnosticsPanel (every section, bar, dot and field) and the same Track header grid and window
// header, fed a fixed frame and analysis instead of the live audio bus, so it looks exactly as it does in the app while
// nothing is playing. The values differ from field to field on purpose; see layoutLabAudioIntelligenceFixture.ts.

const FRAME_SOURCE = { getFrame: () => LAB_AUDIO_FRAME }

export function LayoutLabAudioIntelligenceTab() {
  return (
    <div className="ll-audio-intelligence" aria-label="Audio Intelligence details">
      <header className="ttv-analysis-panel-header">
        <div>
          <AppIcon kind="waveform" className="ttv-analysis-panel-header-icon" />
          <span>Audio Intelligence</span>
        </div>
      </header>
      <div className="ttv-analysis-panel-body" tabIndex={0} role="region" aria-label="Scrollable Audio Intelligence details">
        <MusicIntelligenceDiagnosticsPanel
          ungrouped
          frameSource={FRAME_SOURCE}
          beatGridAnalysis={LAB_AUDIO_ANALYSIS}
          beatGridStale={false}
          headerRowLabel="Track"
          headerRow={(
            <div className="ttv-track-info-grid">
              {LAB_TRACK_INFO.map(([label, value]) => (
                <div key={label} className="ttv-track-info-row">
                  <span className="ttv-track-info-label">{label}</span>
                  <span className="ttv-track-info-value">{value}</span>
                </div>
              ))}
            </div>
          )}
        />
      </div>
    </div>
  )
}
