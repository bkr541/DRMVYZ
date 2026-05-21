import { useState } from 'react'
import { Layers01Icon } from 'hugeicons-react'
import { useVisualStore } from '../../../stores/visualStore'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import {
  VZ_LAYER_RENDER_ORDER,
  DEFAULT_LAYER_CONFIGS, LAYER_LABELS, LAYER_BLEND_MODES,
} from '../../../types/vzLayers'
import type { VzLayerItem } from '../../../types/vzLayers'

export function VzLayersPanel() {
  const {
    layerConfigs, setLayerConfig, resetLayerConfigs,
    layerItems, addLayerItem, removeLayerItem,
    updateLayerItem, reorderLayerItem, clearLayerItemsForLayer, setLayerItemSolo,
    activeMediaId,
  } = useVisualStore(useShallow(s => ({
    layerConfigs:             s.layerConfigs,
    setLayerConfig:           s.setLayerConfig,
    resetLayerConfigs:        s.resetLayerConfigs,
    layerItems:               s.layerItems,
    addLayerItem:             s.addLayerItem,
    removeLayerItem:          s.removeLayerItem,
    updateLayerItem:          s.updateLayerItem,
    reorderLayerItem:         s.reorderLayerItem,
    clearLayerItemsForLayer:  s.clearLayerItemsForLayer,
    setLayerItemSolo:         s.setLayerItemSolo,
    activeMediaId:            s.activeMediaId,
  })))
  const { items } = useMediaStore()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  return (
    <div className="vz-layers-panel vz-panel">
      <div className="vz-panel-header">
        <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Layers</span>
        <button className="vz-layers-reset-btn" onClick={resetLayerConfigs} title="Reset layer configs">↺</button>
      </div>
      <div className="vz-layers-list">
        {VZ_LAYER_RENDER_ORDER.map(layerId => {
          const cfg  = layerConfigs.find(c => c.id === layerId) ?? DEFAULT_LAYER_CONFIGS.find(c => c.id === layerId)!
          const pct  = `${cfg.opacity * 100}%`
          const lItems = layerItems
            .filter(i => i.layerId === layerId)
            .sort((a, b) => a.zIndex - b.zIndex)

          return (
            <div key={layerId} className={`vz-layer-item${cfg.enabled ? '' : ' vz-layer-item--off'}`}>
              <div className="vz-layer-item-header">
                <button
                  className={`vz-layer-toggle${cfg.enabled ? ' vz-layer-toggle--on' : ''}`}
                  onClick={() => setLayerConfig(layerId, { enabled: !cfg.enabled })}
                  title={cfg.enabled ? 'Hide layer' : 'Show layer'}
                />
                <span className="vz-slider-label">{LAYER_LABELS[layerId]}</span>
                <span className="vz-slider-val">{Math.round(cfg.opacity * 100)}%</span>
                <select
                  className="az-select vz-layer-blend-select"
                  value={cfg.blendMode}
                  disabled={!cfg.enabled}
                  title="Layer blend mode"
                  onChange={e => setLayerConfig(layerId, { blendMode: e.target.value as GlobalCompositeOperation })}
                >
                  {LAYER_BLEND_MODES.map(bm => (
                    <option key={bm} value={bm}>{bm}</option>
                  ))}
                </select>
              </div>

              {lItems.length > 0 && (
                <div className="vz-li-list">
                  {lItems.map((item, idx) => {
                    const media      = items.find(m => m.id === item.mediaId)
                    const isExpanded = expandedIds.has(item.id)
                    const isMissing  = !media
                    return (
                      <div key={item.id} className={`vz-li-row${item.enabled ? '' : ' vz-li-row--off'}${isMissing ? ' vz-li-row--missing' : ''}`}>
                        <div className="vz-li-row-main">
                          <button
                            className={`vz-li-en-btn${item.enabled ? ' vz-li-en-btn--on' : ''}`}
                            onClick={() => updateLayerItem(item.id, { enabled: !item.enabled })}
                            title={item.enabled ? 'Disable item' : 'Enable item'}
                          />
                          <button
                            className={`vz-li-solo-btn${item.solo ? ' vz-li-solo-btn--on' : ''}`}
                            onClick={() => setLayerItemSolo(item.id)}
                            title="Solo"
                          >S</button>
                          <button
                            className={`vz-li-lock-btn${item.locked ? ' vz-li-lock-btn--on' : ''}`}
                            onClick={() => updateLayerItem(item.id, { locked: !item.locked })}
                            title={item.locked ? 'Unlock' : 'Lock'}
                          >{item.locked ? '🔒' : '🔓'}</button>
                          <span className="vz-li-name" title={isMissing ? `Missing: ${item.mediaId}` : (media?.title ?? media?.name)}>
                            {isMissing ? '⚠ missing' : (media?.title ?? media?.name ?? '—')}
                          </span>
                          <button
                            className="vz-li-expand-btn"
                            onClick={() => toggleExpand(item.id)}
                            title={isExpanded ? 'Collapse' : 'Expand controls'}
                          >{isExpanded ? '▴' : '▾'}</button>
                          <button
                            className="vz-li-up-btn"
                            disabled={item.locked || idx === 0}
                            onClick={() => reorderLayerItem(item.id, 'up')}
                            title={item.locked ? 'Unlock to reorder' : 'Move up'}
                          >↑</button>
                          <button
                            className="vz-li-down-btn"
                            disabled={item.locked || idx === lItems.length - 1}
                            onClick={() => reorderLayerItem(item.id, 'down')}
                            title={item.locked ? 'Unlock to reorder' : 'Move down'}
                          >↓</button>
                          <button
                            className="vz-li-remove-btn"
                            onClick={() => removeLayerItem(item.id)}
                            title="Remove"
                          >×</button>
                        </div>

                        {isExpanded && (
                          <div className={`vz-li-expanded${item.locked ? ' vz-li-expanded--locked' : ''}`}>
                            <div className="vz-li-row2">
                              <label className="vz-li-field-label">Opacity</label>
                              <input
                                type="range" className="vz-li-slider"
                                min={0} max={1} step={0.05} value={item.opacity}
                                disabled={item.locked}
                                onChange={e => updateLayerItem(item.id, { opacity: parseFloat(e.target.value) })}
                              />
                              <span className="vz-li-val">{item.opacity.toFixed(2)}</span>
                            </div>
                            <div className="vz-li-row2">
                              <label className="vz-li-field-label">Blend</label>
                              <select
                                className="az-select vz-li-select"
                                value={item.blendMode}
                                onChange={e => updateLayerItem(item.id, { blendMode: e.target.value as GlobalCompositeOperation })}
                              >
                                {LAYER_BLEND_MODES.map(bm => <option key={bm} value={bm}>{bm}</option>)}
                              </select>
                            </div>
                            <div className="vz-li-row2">
                              <label className="vz-li-field-label">Fit</label>
                              <select
                                className="az-select vz-li-select"
                                value={item.fitMode}
                                onChange={e => updateLayerItem(item.id, { fitMode: e.target.value as VzLayerItem['fitMode'] })}
                              >
                                <option value="contain">Contain</option>
                                <option value="cover">Cover</option>
                                <option value="stretch">Stretch</option>
                                <option value="original">Original</option>
                              </select>
                            </div>
                            <div className="vz-li-row2">
                              <label className="vz-li-field-label">Anchor</label>
                              <select
                                className="az-select vz-li-select"
                                value={item.anchor}
                                onChange={e => updateLayerItem(item.id, { anchor: e.target.value as VzLayerItem['anchor'] })}
                              >
                                <option value="center">Center</option>
                                <option value="topLeft">Top Left</option>
                                <option value="topRight">Top Right</option>
                                <option value="bottomLeft">Bot Left</option>
                                <option value="bottomRight">Bot Right</option>
                              </select>
                            </div>
                            <div className="vz-li-transform-grid">
                              <label className="vz-li-field-label">X</label>
                              <input type="number" className="vz-li-num" min={0} max={1} step={0.01}
                                value={item.x} disabled={item.locked}
                                onChange={e => updateLayerItem(item.id, { x: parseFloat(e.target.value) || 0 })} />
                              <label className="vz-li-field-label">Y</label>
                              <input type="number" className="vz-li-num" min={0} max={1} step={0.01}
                                value={item.y} disabled={item.locked}
                                onChange={e => updateLayerItem(item.id, { y: parseFloat(e.target.value) || 0 })} />
                              <label className="vz-li-field-label">Scale</label>
                              <input type="number" className="vz-li-num" min={0.01} max={10} step={0.1}
                                value={item.scale} disabled={item.locked}
                                onChange={e => updateLayerItem(item.id, { scale: parseFloat(e.target.value) || 1 })} />
                              <label className="vz-li-field-label">Rot°</label>
                              <input type="number" className="vz-li-num" min={-360} max={360} step={1}
                                value={item.rotation} disabled={item.locked}
                                onChange={e => updateLayerItem(item.id, { rotation: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="vz-li-row2">
                              <label className="vz-li-field-label">Audio</label>
                              <button
                                className={`vz-li-audio-btn${item.audioReactive ? ' vz-li-audio-btn--on' : ''}`}
                                onClick={() => updateLayerItem(item.id, { audioReactive: !item.audioReactive })}
                                title="Toggle audio reactivity"
                              >{item.audioReactive ? 'ON' : 'OFF'}</button>
                              <button
                                className="vz-li-reset-btn"
                                disabled={item.locked}
                                onClick={() => updateLayerItem(item.id, { x: 0.5, y: 0.5, scale: 1, rotation: 0 })}
                                title={item.locked ? 'Unlock to reset transform' : 'Reset transform'}
                              >↺ Reset</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="vz-layer-assign-row">
                <button
                  className="vz-li-add-btn"
                  disabled={!activeMediaId}
                  title={activeMediaId ? 'Add active media to this layer' : 'Select a media item first'}
                  onClick={() => activeMediaId && addLayerItem(activeMediaId, layerId)}
                >+ Active</button>
                {lItems.length > 0 && (
                  <button
                    className="vz-li-clear-btn"
                    onClick={() => clearLayerItemsForLayer(layerId)}
                    title="Remove all items from this layer"
                  >Clear</button>
                )}
              </div>

              <input
                type="range"
                className="vz-slider vz-layer-opacity-slider"
                style={{ '--pct': pct } as React.CSSProperties}
                min={0} max={1} step={0.05}
                value={cfg.opacity}
                title={`Layer opacity: ${Math.round(cfg.opacity * 100)}%`}
                onChange={e => setLayerConfig(layerId, { opacity: parseFloat(e.target.value) })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
