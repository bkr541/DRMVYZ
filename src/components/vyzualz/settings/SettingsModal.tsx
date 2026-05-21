import { useState, useEffect } from 'react'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'

const SHORTCUTS = [
  { key: '1–5', desc: 'Switch Preset' },
  { key: 'F',   desc: 'Fullscreen' },
  { key: 'G',   desc: 'Glitch Punch' },
  { key: 'B',   desc: 'Bass Pulse' },
  { key: 'SPC', desc: 'Beat Flash' },
  { key: 'V',   desc: 'Next Media' },
]

function ShortcutPanel() {
  return (
    <div className="vz-shortcuts-section">
      <span className="vz-shortcuts-label">Shortcuts</span>
      <div className="vz-shortcut-grid">
        {SHORTCUTS.map(s => (
          <div key={s.key} className="vz-shortcut-card">
            <span className="vz-shortcut-key">{s.key}</span>
            <span className="vz-shortcut-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemSettingsPanel() {
  const {
    quality, setQuality, bpmSync, toggleBpmSync, bpm,
    resetEffects, resetModulationRoutes,
  } = useVisualStore()
  const { storageAvailable, authRequired } = useMediaStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="az-popover-section-title">Canvas Quality</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['High', 'Medium', 'Low'] as const).map(q => (
            <button
              key={q}
              className={`vz-settings-seg-btn${quality === q ? ' vz-settings-seg-btn--active' : ''}`}
              onClick={() => setQuality(q)}
            >{q}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">BPM Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`vz-settings-seg-btn${bpmSync ? ' vz-settings-seg-btn--active' : ''}`}
            onClick={toggleBpmSync}
            style={{ minWidth: 54 }}
          >{bpmSync ? 'ON' : 'OFF'}</button>
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.45)', fontFamily: 'var(--az-font-data)' }}>
            {bpmSync ? `Locked to ${bpm} BPM` : 'Free-running beat phase'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Media Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: storageAvailable && !authRequired ? '#61d6aa' : 'rgba(245,248,250,0.2)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.55)', fontFamily: 'var(--az-font-data)' }}>
            {!storageAvailable ? 'Local only — Supabase not configured'
              : authRequired   ? 'Signed out — media stored locally'
              :                  'Cloud sync enabled'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Reset</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="vz-settings-reset-btn"
            onClick={resetEffects}
            title="Set all effect sliders back to defaults"
          >Reset Effects</button>
          <button
            className="vz-settings-reset-btn"
            onClick={resetModulationRoutes}
            title="Restore default audio modulation routing"
          >Reset Modulation</button>
        </div>
      </div>
    </div>
  )
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'account' | 'shortcuts' | 'system'>('account')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="vsm-backdrop" onMouseDown={onClose}>
      <div className="vsm-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div className="vsm-header">
          <div className="vsm-title">SETTINGS</div>
          <button className="vsm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="vsm-body">
          <nav className="vsm-nav">
            <div
              className={`vsm-nav-item${tab === 'account' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('account')}
            >Account</div>
            <div
              className={`vsm-nav-item${tab === 'shortcuts' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('shortcuts')}
            >Shortcuts</div>
            <div
              className={`vsm-nav-item${tab === 'system' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('system')}
            >System Settings</div>
          </nav>
          <div className="vsm-content">
            {tab === 'account' && (
              <p className="vsm-account-placeholder">Account settings coming soon.</p>
            )}
            {tab === 'shortcuts' && <ShortcutPanel />}
            {tab === 'system' && <SystemSettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
