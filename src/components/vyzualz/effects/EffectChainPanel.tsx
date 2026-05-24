import { memo } from 'react'
import { Flowchart01Icon } from 'hugeicons-react'
import type { EffectChainOptionRow } from '../../../types/database'

type EffectChainPanelProps = {
  options:  EffectChainOptionRow[]
  loading:  boolean
  error:    string | null
  enabled:  Set<string>
  onToggle: (name: string) => void
  onRetry:  () => void
}

export const EffectChainPanel = memo(function EffectChainPanel({
  options, loading, error, enabled, onToggle, onRetry,
}: EffectChainPanelProps) {
  return (
    <div className="vz-chain-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <Flowchart01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Effect Chain</span>
      </div>

      {loading ? (
        <div className="vz-chain-state-msg">Loading effects…</div>
      ) : error ? (
        <div className="vz-chain-state-msg vz-chain-state-msg--error">
          <span>Unable to load effects.</span>
          <button className="vz-chain-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      ) : options.length === 0 ? (
        <div className="vz-chain-state-msg">No effects available.</div>
      ) : (
        <div className="vz-chain-grid">
          {options.map(option => (
            <button
              key={option.id}
              className={`vz-chain-btn${enabled.has(option.chain_name) ? ' vz-chain-btn--active' : ''}`}
              onClick={() => onToggle(option.chain_name)}
              title={`${option.description} • Category: ${option.category}`}
            >
              {option.chain_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
