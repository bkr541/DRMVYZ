import { memo } from 'react'
import { Flowchart01Icon } from 'hugeicons-react'

export const EFFECT_CHAIN_ITEMS = [
  'RGB Split','Glitch Bars','Scanlines','Tunnel','Displacement','Noise Fog','Bloom','Feedback','Strobe','Color Shift',
  'Spectrum Bars','Circular Spectrum','Oscilloscope','Beat Ring','Particle Burst',
  'Reactive Grid','Camera Shake','Kaleidoscope','Mirror Split','Radial Blur',
  'VHS Static','Datamosh Smear','Edge Glow','Color Cycle','Beat Flash','Edge Flicker',
] as const

type EffectChainPanelProps = {
  enabled: Set<string>
  onToggle: (name: string) => void
}

export const EffectChainPanel = memo(function EffectChainPanel({ enabled, onToggle }: EffectChainPanelProps) {
  return (
    <div className="vz-chain-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <Flowchart01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Effect Chain</span>
      </div>
      <div className="vz-chain-grid">
        {EFFECT_CHAIN_ITEMS.map(name => (
          <button key={name}
            className={`vz-chain-btn ${enabled.has(name) ? 'vz-chain-btn--active' : ''}`}
            onClick={() => onToggle(name)}
          >{name}</button>
        ))}
      </div>
    </div>
  )
})
