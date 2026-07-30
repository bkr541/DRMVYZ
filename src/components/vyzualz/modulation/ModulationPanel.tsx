import { useState } from 'react'
import { Route01Icon } from 'hugeicons-react'
import { EFFECT_LABELS } from '../../../lib/audioModulation'
import type { ModulationRoute } from '../../../lib/audioModulation'
import { getMISourceLabel } from '../../../lib/miSourceRegistry'

type ModulationPanelProps = {
  routes: ModulationRoute[]
  onToggle: (id: string) => void
  onSetAmount: (id: string, amount: number) => void
  audioReactivityEnabled: boolean
  onSetAudioReactivity: (v: boolean) => void
}

export function ModulationPanel({ routes, onToggle, onSetAmount, audioReactivityEnabled, onSetAudioReactivity }: ModulationPanelProps) {
  const [open, setOpen] = useState(true)
  const activeCount = routes.filter(r => r.enabled).length

  return (
    <div className="vz-panel vz-mod-panel">
      <button className="vz-panel-header vz-mod-header" onClick={() => setOpen(v => !v)}>
        <Route01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Modulation</span>
        <span className="vz-mod-summary">{activeCount}/{routes.length} active</span>
        <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {/* ── Audio Reactivity master toggle — always visible ─────────────── */}
      <div
        className={`vz-mod-reactivity-row${audioReactivityEnabled ? ' vz-mod-reactivity-row--on' : ''}`}
        onClick={() => onSetAudioReactivity(!audioReactivityEnabled)}
        role="switch"
        aria-checked={audioReactivityEnabled}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSetAudioReactivity(!audioReactivityEnabled) }}
        title={audioReactivityEnabled
          ? 'Visual parameters can respond to audio and modulation routes.'
          : 'Beat-driven movement and modulation are disabled.'}
      >
        <span className="vz-mod-reactivity-label">Audio Reactivity</span>
        <span className={`vz-mod-reactivity-track${audioReactivityEnabled ? ' vz-mod-reactivity-track--on' : ''}`}>
          <span className="vz-mod-reactivity-thumb" />
        </span>
        <span className="vz-mod-reactivity-state">{audioReactivityEnabled ? 'ON' : 'OFF'}</span>
      </div>
      {!audioReactivityEnabled && (
        <p className="vz-mod-reactivity-hint">
          Beat-driven movement and modulation are disabled.
        </p>
      )}

      {open && (
        <div className={`vz-mod-list${!audioReactivityEnabled ? ' vz-mod-list--inactive' : ''}`}>
          {routes.map(route => (
            <div key={route.id} className={`vz-mod-route ${route.enabled ? 'vz-mod-route--on' : ''}`}>
              <div className="vz-mod-route-header">
                <button
                  type="button"
                  className="vz-mod-toggle"
                  onClick={() => onToggle(route.id)}
                  aria-pressed={route.enabled}
                  aria-label={`${route.enabled ? 'Disable' : 'Enable'} ${EFFECT_LABELS[route.effectId] ?? route.effectId} modulation route`}
                  title={route.enabled ? 'Disable route' : 'Enable route'}
                >
                  <span className={`vz-mod-dot ${route.enabled ? 'vz-mod-dot--on' : ''}`} />
                </button>
                <span className="vz-mod-target">{EFFECT_LABELS[route.effectId] ?? route.effectId}</span>
                <span className="vz-mod-source">{getMISourceLabel(route.source)}</span>
              </div>
              <div className="vz-mod-route-slider">
                <input
                  type="range"
                  className="vz-slider vz-mod-amount"
                  style={{ '--pct': `${route.amount * 100}%` } as React.CSSProperties}
                  min={0} max={1} step={0.05}
                  value={route.amount}
                  title={`Amount: ${route.amount.toFixed(2)}`}
                  onChange={e => onSetAmount(route.id, parseFloat(e.target.value))}
                />
                <span className="vz-mod-amount-val">{route.amount.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
