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
import { MEDIA_ROLE_BADGE_LABELS } from '../../../lib/mediaRoles'

export function VzLayersPanel() {
  const {
    layerConfigs, setLayerConfig, resetLayerConfigs,
    layerItems, addLayerItem, removeLayerItem,
    updateLayerItem, reorderLayerItem, clearLayerItemsForLayer, setLayerItemSolo,
    activeMediaId, audioReactivityEnabled,
    selectedLayerId, selectedLayerItemId, setSelectedLayerItem,
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
    audioReactivityEnabled:   s.audioReactivityEnabled,
    selectedLayerId:          s.selectedLayerId,
    selectedLayerItemId:      s.selectedLayerItemId,
    setSelectedLayerItem:     s.setSelectedLayerItem,
  })))
  const items = useMediaStore(state => state.items)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  // Compute per-layer render summary: first visible item name + overflow count
  const renderStack = VZ_LAYER_RENDER_ORDER.map(layerId => {
    const cfg = layerConfigs.find(c => c.id === layerId) ?? DEFAULT_LAYER_CONFIGS.find(c => c.id === layerId)!
    const lItems = layerItems.filter(i => i.layerId === layerId).sort((a, b) => a.zIndex - b.zIndex)
    const visibleItems = cfg.enabled ? lItems.filter(i => i.enabled) : []
    const firstMedia = visibleItems.length > 0 ? items.find(m => m.id === visibleItems[0].mediaId) : null
    return {
      layerId,
      label: LAYER_LABELS[layerId],
      name: firstMedia ? (firstMedia.title ?? firstMedia.name ?? '?') : null,
      extraCount: Math.max(0, visibleItems.length - 1),
    }
  })

  return (
    <div className="vz-layers-panel vz-panel">
      <div className="vz-panel-header">
        <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Layers</span>
        <button className="vz-layers-reset-btn" onClick={resetLayerConfigs} title="Reset all layer configs to defaults">↺</button>
      </div>

      {/* Render stack: shows what's currently on the canvas per layer */}
      <div className="vz-layer-render-stack">
        <span className="vz-layer-stack-label">Rendering</span>
        {renderStack.map(({ layerId, label, name, extraCount }) => (
          <span key={layerId} className={`vz-layer-stack-item${name ? ' vz-layer-stack-item--active' : ''}`}>
            <span className="vz-layer-stack-id">{label}:</span>
            <span className="vz-layer-stack-name" title={name ?? undefined}>{name ?? '—'}</span>
            {extraCount > 0 && <span className="vz-layer-stack-more">+{extraCount}</span>}
          </span>
        ))}
      </div>

      {/* Global hint: shown once when no deck item is selected */}
      {!activeMediaId && (
        <div className="vz-layer-select-hint">
          Select a media item in the Deck tab, then use "Add Selected Media" to assign it to a layer.
        </div>
      )}

      <div className="vz-layers-list">
        {VZ_LAYER_RENDER_ORDER.map(layerId => {
          const cfg  = layerConfigs.find(c => c.id === layerId) ?? DEFAULT_LAYER_CONFIGS.find(c => c.id === layerId)!
          const pct  = `${cfg.opacity * 100}%`
          const lItems = layerItems
            .filter(i => i.layerId === layerId)
            .sort((a, b) => a.zIndex - b.zIndex)
          const hasItems = lItems.length > 0

          return (
            <div key={layerId} className={`vz-layer-item${cfg.enabled ? '' : ' vz-layer-item--off'}`}>
              <div
                className={`vz-layer-item-header${selectedLayerId === layerId && !selectedLayerItemId ? ' vz-layer-item-header--selected' : ''}`}
                onClick={() => setSelectedLayerItem(layerId, null)}
                title="Click to select this layer as effect target"
              >
                <button
                  className={`vz-layer-toggle${cfg.enabled ? ' vz-layer-toggle--on' : ''}`}
                  onClick={() => setLayerConfig(layerId, { enabled: !cfg.enabled })}
                  title={cfg.enabled ? 'Hide layer' : 'Show layer'}
                />
                <span className="vz-slider-label">{LAYER_LABELS[layerId]}</span>
                {hasItems && <span className="vz-layer-count">{lItems.length}</span>}
                <span className="vz-slider-val">{Math.round(cfg.opacity * 100)}%</span>
                <select
                  className="az-select vz-layer-blend-select"
                  value={cfg.blendMode}
                  disabled={!cfg.enabled || !hasItems}
                  title={hasItems ? 'Layer blend mode' : 'Add media to this layer to use blend modes'}
                  onChange={e => setLayerConfig(layerId, { blendMode: e.target.value as GlobalCompositeOperation })}
                >
                  {LAYER_BLEND_MODES.map(bm => (
                    <option key={bm} value={bm}>{bm}</option>
                  ))}
                </select>
              </div>

              {/* Assigned items list */}
              {hasItems && (
                <div className="vz-li-list">
                  {lItems.map((item, idx) => {
                    const media      = items.find(m => m.id === item.mediaId)
                    const isExpanded = expandedIds.has(item.id)
                    const isMissing  = !media
                    const roleBadge  = media?.mediaRole ? MEDIA_ROLE_BADGE_LABELS[media.mediaRole] : null
                    return (
                      <div
                        key={item.id}
                        className={`vz-li-row${item.enabled ? '' : ' vz-li-row--off'}${isMissing ? ' vz-li-row--missing' : ''}${selectedLayerItemId === item.id ? ' vz-li-row--selected' : ''}`}
                        onClick={() => setSelectedLayerItem(item.layerId, item.id)}
                      >
                        <div className="vz-li-row-main">
                          <button
                            className={`vz-li-en-btn${item.enabled ? ' vz-li-en-btn--on' : ''}`}
                            onClick={() => updateLayerItem(item.id, { enabled: !item.enabled })}
                            title={item.enabled ? 'Hide item' : 'Show item'}
                          />
                          <button
                            className={`vz-li-solo-btn${item.solo ? ' vz-li-solo-btn--on' : ''}`}
                            onClick={() => setLayerItemSolo(item.id)}
                            title="Solo this item (hides all others in this layer)"
                          >S</button>
                          <button
                            className={`vz-li-lock-btn${item.locked ? ' vz-li-lock-btn--on' : ''}`}
                            onClick={() => updateLayerItem(item.id, { locked: !item.locked })}
                            title={item.locked ? 'Unlock item' : 'Lock item (prevents edits)'}
                          >{item.locked ? '🔒' : '🔓'}</button>
                          <span className="vz-li-name" title={isMissing ? `Missing: ${item.mediaId}` : (media?.title ?? media?.name)}>
                            {isMissing ? '⚠ missing' : (media?.title ?? media?.name ?? '—')}
                          </span>
                          {roleBadge && (
                            <span className="vz-li-role-badge" title={`Role: ${media?.mediaRole ?? ''}`}>
                              {roleBadge}
                            </span>
                          )}
                          <button
                            className={`vz-li-expand-btn${isExpanded ? ' vz-li-expand-btn--open' : ''}`}
                            onClick={() => toggleExpand(item.id)}
                            title={isExpanded ? 'Close item controls' : 'Edit item controls (opacity, position, scale, blend)'}
                          >{isExpanded ? 'Close' : 'Edit'}</button>
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
                            title="Remove from layer"
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
                              <label
                                className="vz-li-field-label vz-li-field-label--wide"
                                title="When on, global live effects (scale pulse, Color Shift) apply to this item"
                              >Enable Global FX</label>
                              <button
                                className={`vz-li-audio-btn${(item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive) ? ' vz-li-audio-btn--on' : ''}`}
                                onClick={() => {
                                  const cur = item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive
                                  updateLayerItem(item.id, { enableGlobalFx: !cur, audioReactive: !cur })
                                }}
                                title={(item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive) ? 'Disable global FX for this item' : 'Enable global FX for this item'}
                              >{(item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive) ? 'On' : 'Off'}</button>
                              <button
                                className="vz-li-reset-btn"
                                disabled={item.locked}
                                onClick={() => updateLayerItem(item.id, { x: 0.5, y: 0.5, scale: 1, rotation: 0 })}
                                title={item.locked ? 'Unlock to reset transform' : 'Reset position, scale, and rotation'}
                              >↺ Reset</button>
                            </div>
                            {(item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive) && !audioReactivityEnabled && (
                              <div className="vz-li-audio-off-hint">
                                Inactive — global Audio Reactivity is off
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Empty state — shown when layer is on but nothing assigned */}
              {!hasItems && cfg.enabled && (
                <div className="vz-layer-empty">
                  <span className="vz-layer-empty-msg">No media assigned.</span>
                  <span className="vz-layer-empty-hint">Select a media item in the deck, then click "Add Selected Media" below.</span>
                </div>
              )}

              <div className="vz-layer-assign-row">
                <button
                  className="vz-li-add-btn"
                  disabled={!activeMediaId}
                  title={activeMediaId ? 'Add selected media item to this layer' : 'Select a media item in the deck first'}
                  onClick={() => activeMediaId && addLayerItem(activeMediaId, layerId)}
                >Add Selected Media</button>
                {hasItems && (
                  <button
                    className="vz-li-clear-btn"
                    onClick={() => clearLayerItemsForLayer(layerId)}
                    title="Remove all items from this layer"
                  >Clear</button>
                )}
              </div>

              {/* Layer opacity — disabled when nothing assigned (would have no effect) */}
              <input
                type="range"
                className="vz-slider vz-layer-opacity-slider"
                style={{ '--pct': pct } as React.CSSProperties}
                min={0} max={1} step={0.05}
                value={cfg.opacity}
                disabled={!hasItems}
                title={hasItems ? `Layer opacity: ${Math.round(cfg.opacity * 100)}%` : 'Add media to this layer to adjust opacity'}
                onChange={e => setLayerConfig(layerId, { opacity: parseFloat(e.target.value) })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
