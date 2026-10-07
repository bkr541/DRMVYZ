import { useState, type CSSProperties } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import { isDockBlankSpace } from '../../shared/dockBlankSpace'

// ── TemplateAudioDockMockup ─────────────────────────────────────────────────
//
// A disconnected preview of the bottom audio dock (VyzualzAudioDock) for the
// Template tab's empty lower area. Every element currently in the production
// dock is represented, styled with the same production classes so it cannot
// visually drift. State is local-only — no audio engine, no stores. The
// Rekordbox tools dropdown is intentionally omitted: it now lives in the top
// header (portaled out of the dock), so it is no longer part of the dock.

const MOCK_ACCENT_COLOR = '#4ac7db'
const MOCK_WAVEFORM_BAR_COUNT = 140

function mockWaveformBarHeight(index: number): number {
  const a = Math.sin(index * 0.21) * 0.5 + 0.5
  const b = Math.sin(index * 0.07 + 1.3) * 0.5 + 0.5
  const c = Math.sin(index * 0.5 + 3) * 0.15
  return Math.max(0.08, Math.min(1, a * 0.6 + b * 0.5 + c))
}

export function TemplateAudioDockMockup() {
  const [collapsed, setCollapsed] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(0.82)
  const [bpm, setBpm] = useState(128)
  const [bpmSync, setBpmSync] = useState(true)
  // The stale-analysis banner is conditional in production (it only shows
  // when a manual BPM diverges from a fresh analysis) and the dock's fixed
  // 124px height + overflow:hidden isn't tall enough to fit it alongside
  // the BPM block permanently. Toggle it on demand instead of always-on so
  // the default view stays faithful to production's real footprint.
  const [showStaleBanner, setShowStaleBanner] = useState(false)
  const volPct = `${Math.round(volume * 100)}%`

  const dockClassName = [
    'az-dock',
    'vz-transport-dock',
    'vz-transport-dock--expandable',
    collapsed ? 'vz-transport-dock--collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={dockClassName}
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="Bottom audio dock (mockup)"
      onClick={event => { if (isDockBlankSpace(event.target, event.currentTarget)) setCollapsed(value => !value) }}
    >
      {/* ── LEFT: play button + title/artist + volume ────────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-left vz-dock-card">
        <div className="vz-dock-play-slot">
          <button
            type="button"
            className="az-play-btn"
            title={playing ? 'Pause (mockup)' : 'Play (mockup)'}
            aria-label={playing ? 'Pause (mockup)' : 'Play (mockup)'}
            style={{ borderColor: MOCK_ACCENT_COLOR, color: MOCK_ACCENT_COLOR, boxShadow: `0 0 12px ${MOCK_ACCENT_COLOR}30` }}
            onClick={() => setPlaying(value => !value)}
          >
            {playing
              ? <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              : <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
          </button>
        </div>

        <label className="vz-dock-addtrack-btn" title="Replace Track (mockup)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span>Replace Track</span>
        </label>

        <div className="vz-dock-left-body">
          <div className="vz-dock-track-row">
            <span className="vz-dock-track-title" title="Midnight Run">Midnight Run</span>
            <span className="vz-dock-track-artist" title="DVYDRM">DVYDRM</span>
          </div>

          <div className="az-dock-volume vz-dock-volume-row">
            <span className="az-dock-vol-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            </span>
            <span className="az-dock-vol-db vz-dock-vol-db">
              {volume < 0.001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`}
            </span>
            <BubbleRevealSlider
              type="range"
              className="az-dock-vol-slider"
              aria-label="Track volume (mockup)"
              title={`Track volume: ${Math.round(volume * 100)}%`}
              min={0}
              max={1}
              step={0.005}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              style={{ '--pct': volPct } as CSSProperties}
            />
          </div>
        </div>

        <label className="vz-dock-addtrack-btn" title="Replace Track (mockup)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span>Replace Track</span>
        </label>
      </div>
      </div>

      {/* ── CENTER: waveform + zoom buttons ─────────────────────────────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-center vz-dock-card">
        <div className="vz-dock-waveform-wrap">
          <div className="rv-layout-lab-dock-waveform" aria-hidden="true">
            {Array.from({ length: MOCK_WAVEFORM_BAR_COUNT }, (_, index) => (
              <span
                key={index}
                className="rv-layout-lab-dock-waveform-bar"
                style={{ '--bar-height': mockWaveformBarHeight(index) } as CSSProperties}
              />
            ))}
            <span className="rv-layout-lab-dock-waveform-cue" style={{ left: '22%' }} title="Cue marker (mockup)" />
            <span className="rv-layout-lab-dock-waveform-cue" style={{ left: '61%' }} title="Cue marker (mockup)" />
            <span className="rv-layout-lab-dock-waveform-playhead" style={{ left: '38%' }} />
          </div>
        </div>
        <div className="vz-dock-zoom-btns">
          <button type="button" className="vz-dock-zoom-btn" title="Zoom in (mockup)">+</button>
          <button type="button" className="vz-dock-zoom-btn" title="Zoom out (mockup)">−</button>
        </div>
      </div>
      </div>

      {/* ── RIGHT: BPM + stale-analysis banner + TAP / CUE / SYNC ───────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-right vz-dock-card">
        <div className="vz-dock-right-main">
          <div className="vz-dock-bpm-wrap">
            <div className="vz-dock-bpm-block">
              <div className="vz-dock-bpm-block-top">
                <span className="vz-dock-bpm-block-label">BPM</span>
                <button type="button" className="vz-dock-bpm-reset-btn" title="Reset to analyzed BPM (mockup)">↺</button>
              </div>
              <div className="vz-dock-bpm-block-row">
                <span
                  className="vz-dock-bpm-block-val"
                  title="Double-click to edit BPM (mockup)"
                  style={{ cursor: 'text' }}
                >
                  {bpm.toFixed(2)}
                </span>
                <div className="vz-dock-bpm-chevrons">
                  <button type="button" className="vz-dock-bpm-chevron" title="BPM +1" onClick={() => setBpm(value => value + 1)}>
                    <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 15l5-5 5 5z" /></svg>
                  </button>
                  <button type="button" className="vz-dock-bpm-chevron" title="BPM −1" onClick={() => setBpm(value => value - 1)}>
                    <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 9l5 5 5-5z" /></svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="vz-dock-bpm-analyzed-label"
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setShowStaleBanner(value => !value)}
                title="Toggle the stale-analysis banner (mockup)"
              >
                analyzed 126.40
              </button>
            </div>

            {showStaleBanner && (
              <div className="vz-dock-bpm-stale">
                <div className="vz-dock-bpm-stale-info">
                  <span>Grid: 126&thinsp;BPM</span>
                  <span className="vz-dock-bpm-stale-arrow">→</span>
                  <span>128&thinsp;BPM</span>
                </div>
                <div className="vz-dock-bpm-stale-actions">
                  <button type="button" className="vz-dock-bpm-stale-btn">Keep</button>
                  <button type="button" className="vz-dock-bpm-stale-btn">Re-snap</button>
                  <button type="button" className="vz-dock-bpm-stale-btn vz-dock-bpm-stale-btn--pri">Reanalyze 128</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="vz-dock-right-btns">
          <button type="button" className="vz-dock-tap-btn" title="Tap tempo (mockup)" aria-label="Tap tempo (mockup)">
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 16V8M12 16V4M18 16v-5" />
            </svg>
            <span className="vz-dock-tap-label">TAP</span>
          </button>
          <button type="button" className="vz-dock-cue-btn" title="Set cue point (mockup)" aria-label="Set cue point (mockup)">
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 21V4m0 1h11l-2.5 3L16 11H5" />
            </svg>
            <span className="vz-dock-cue-label">CUE</span>
          </button>
          <button
            type="button"
            className={`vz-dock-sync-master-btn${bpmSync ? ' vz-dock-sync-master-btn--on' : ''}`}
            onClick={() => setBpmSync(value => !value)}
            title={bpmSync ? 'BPM Sync: ON (mockup)' : 'BPM Sync: OFF (mockup)'}
            aria-label={bpmSync ? 'BPM Sync: ON (mockup)' : 'BPM Sync: OFF (mockup)'}
          >
            {bpmSync && <span className="vz-dock-sync-dot" />}
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.5 13.5l3-3M7.2 16.8l-1 1a3.4 3.4 0 0 1-4.8-4.8l3.2-3.2a3.4 3.4 0 0 1 4.8 0M16.8 7.2l1-1a3.4 3.4 0 0 1 4.8 4.8l-3.2 3.2a3.4 3.4 0 0 1-4.8 0" />
            </svg>
            <span className="vz-dock-sync-master-label">SYNC</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
