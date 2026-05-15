import React from 'react'
import type { MonitoringMode } from '../../types/audio'
import { MONITORING_MODE_LABELS, MONITORING_MODE_DESCRIPTIONS } from '../../types/audio'

const GROUPS: MonitoringMode[][] = [
  ['stereo', 'mono'],
  ['left', 'right', 'mid', 'side'],
  ['lowpass', 'highpass'],
  ['phone', 'car', 'club'],
]

const GROUP_LABELS = ['Output', 'Channel Isolation', 'Frequency Audition', 'Speaker Simulations']

interface Props {
  mode: MonitoringMode
  onChange: (m: MonitoringMode) => void
  primaryColor: string
}

export function MonitoringPanel({ mode, onChange, primaryColor }: Props) {
  return (
    <div className="monitoring-panel">
      <div className="settings-note" style={{ marginBottom: 12 }}>
        Affects what you <em>hear</em> — analysis meters always reflect the true signal.
      </div>

      {GROUPS.map((group, gi) => (
        <div key={gi} className="monitoring-group">
          <div className="settings-section-title">{GROUP_LABELS[gi]}</div>
          <div className="monitoring-grid">
            {group.map(m => (
              <button
                key={m}
                className={`monitoring-btn ${mode === m ? 'active' : ''}`}
                onClick={() => onChange(m)}
                title={MONITORING_MODE_DESCRIPTIONS[m]}
                style={{ '--accent': primaryColor } as React.CSSProperties}
              >
                <span className="monitoring-btn-label">{MONITORING_MODE_LABELS[m]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="monitoring-active-desc">
        <span style={{ color: primaryColor }}>▶</span>{' '}
        {MONITORING_MODE_DESCRIPTIONS[mode]}
      </div>

      <div className="settings-note" style={{ marginTop: 12 }}>
        Speaker simulations use Web Audio biquad filters as frequency response approximations.
        They are not impulse-response based and may differ from real speaker behavior.
      </div>
    </div>
  )
}
