import type React from 'react'
import type { ReactPreset } from './ReactTypes'
import { ReactPresetThumbnail } from './ReactPresetThumbnail'
import { useEffectiveReactPresets } from '../../../features/personalization/useEffectiveReactPresets'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG } from './reactEngineCatalog'

interface Props {
  presets: ReactPreset[]
  activePresetId: string | null
  onSelect: (id: string) => void
}

export function ReactPresetBrowser({ presets, activePresetId, onSelect }: Props) {
  const displayPresets = useEffectiveReactPresets(presets).filter(preset => isSelectableReactEngineId(preset.engine))
  const thumbnailGenerationKey = displayPresets.map(preset => preset.id).join('|')
  return (
    <div className="rv-preset-browser">
      <div className="rv-panel-header">
        <span className="rv-panel-icon">◈</span>
        <span className="rv-panel-title">Visual Engines</span>
      </div>
      <div className="rv-preset-list">
        {displayPresets.map((preset) => {
          if (!isSelectableReactEngineId(preset.engine)) return null
          const isActive = preset.id === activePresetId
          return (
            <button
              key={preset.id}
              type="button"
              className={`rv-preset-card rv-preset-card--with-thumb${isActive ? ' rv-preset-card--active' : ''}`}
              style={{ '--accent': preset.palette.primary } as React.CSSProperties}
              aria-pressed={isActive}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(preset.id)}
              title={preset.description}
            >
              <div className="rv-preset-card-layout">
                <ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} />
                <div className="rv-preset-card-content">
                  <div className="rv-preset-card-header">
                    <span className="rv-preset-engine-icon" style={{ color: preset.palette.primary }}>
                      {REACT_ENGINE_CATALOG[preset.engine].icon}
                    </span>
                    <span className="rv-preset-name">{preset.name}</span>
                  </div>
                  <div className="rv-preset-engine-label">
                    {REACT_ENGINE_CATALOG[preset.engine].label}
                  </div>
                  <p className="rv-preset-desc">{preset.description}</p>
                  <div className="rv-preset-palette">
                    {Object.values(preset.palette).slice(0, 5).map((color, i) => (
                      <span
                        key={i}
                        className="rv-palette-swatch"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
