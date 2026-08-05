import { useEffect, useMemo, useState } from 'react'
import { RailTabs } from '../../layout/RailTabs'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import { PIX_GRID_BUILT_IN_ASSETS } from '../pixGrid/PixGridArtwork'
import type { ReactEngineId } from '../ReactTypes'
import { MockEngineDropdown } from './MockEngineDropdown'
import { resolveLayoutLabComposition } from './layoutLabComposition'
import type { PixGridMockMediaFilter, PixGridMockState } from './usePixGridMockState'

const MEDIA_FILTERS: Array<{ id: PixGridMockMediaFilter; label: string }> = [
  { id: 'all', label: 'All Visuals' },
  { id: 'collections', label: 'Collections' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'images', label: 'Still Images' },
  { id: 'svg', label: 'SVG' },
]

function PixGridSetupMockup({ state }: { state: PixGridMockState }) {
  const [sceneName, setSceneName] = useState(state.activeScene.name)
  useEffect(() => setSceneName(state.activeScene.name), [state.activeScene.id, state.activeScene.name])

  return (
    <div className="rv-pix-grid-authoring-panel" data-layout-lab-pix-grid="setup">
      <div className="rv-pix-grid-authoring-control-help drm-help-overlay-anchor">
        <button
          type="button"
          className={state.editOpen ? 'rv-pix-grid-edit-toggle is-active' : 'rv-pix-grid-edit-toggle'}
          aria-pressed={state.editOpen}
          onClick={() => state.setEditOpen(!state.editOpen)}
        >
          {state.editOpen ? 'Close PixGrid Edit' : 'Edit PixGrid'}
        </button>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.editOverlay"
          currentValue={state.editOpen ? 'Open' : 'Closed'}
          currentValueLabel="Status"
          currentValueTone={state.editOpen ? 'accent' : 'default'}
          placement="right"
        />
      </div>
      <div className="rv-ctrl-info rv-pix-grid-authoring-hint rv-control-helper-copy">
        Edit on the center canvas. Changes save automatically.
      </div>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid scenes">
        <header><strong>SCENES</strong><span>{state.scenes.length}</span></header>
        <div className="rv-pix-grid-scene-list">
          {state.scenes.map(scene => (
            <button
              key={scene.id}
              type="button"
              className={scene.id === state.activeScene.id ? 'is-active' : ''}
              onClick={() => state.selectScene(scene.id)}
            >
              <span>{scene.name}</span>
              <small>{scene.layerIds.length} layers</small>
            </button>
          ))}
        </div>
        <label className="rv-pix-grid-inline-field">
          <span>Scene Name</span>
          <input
            value={sceneName}
            maxLength={96}
            onChange={event => setSceneName(event.target.value)}
            onBlur={() => {
              if (sceneName.trim()) state.renameScene(sceneName)
              else setSceneName(state.activeScene.name)
            }}
          />
        </label>
        <div className="rv-pix-grid-browser-actions">
          <button type="button" onClick={state.addScene}>Add</button>
          <button type="button" onClick={state.duplicateScene}>Duplicate</button>
          <button type="button" disabled={state.scenes.length <= 1} onClick={state.deleteScene}>Delete</button>
        </div>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.scenes"
          currentValue={`${state.activeScene.name} · ${state.scenes.length} scene${state.scenes.length === 1 ? '' : 's'}`}
          currentValueTone="accent"
          placement="right"
        />
      </section>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid layers">
        <header><strong>LAYERS</strong><span>{state.activeLayers.length}</span></header>
        <div className="rv-pix-grid-layer-list">
          {state.activeLayers.map((layer, index) => (
            <div key={layer.id} className={state.selectedLayerId === layer.id ? 'is-active' : ''}>
              <button type="button" className="rv-pix-grid-layer-main" onClick={() => state.selectLayer(layer.id)}>
                <span>{layer.name}</span>
                <small>{layer.sourceKind === 'media' ? 'MEDIA' : 'BUILT-IN'}</small>
              </button>
              <button
                type="button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={() => state.updateLayer(layer.id, { visible: !layer.visible })}
              >{layer.visible ? '◉' : '○'}</button>
              <button
                type="button"
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                onClick={() => state.updateLayer(layer.id, { locked: !layer.locked })}
              >{layer.locked ? '🔒' : '◇'}</button>
              <button type="button" disabled={index === 0 || layer.locked} aria-label={`Move ${layer.name} down`} onClick={() => state.moveLayer(layer.id, -1)}>↓</button>
              <button type="button" disabled={index === state.activeLayers.length - 1 || layer.locked} aria-label={`Move ${layer.name} up`} onClick={() => state.moveLayer(layer.id, 1)}>↑</button>
              <button type="button" disabled={layer.locked} aria-label={`Duplicate ${layer.name}`} onClick={() => state.duplicateLayer(layer.id)}>⧉</button>
              <button type="button" disabled={layer.locked} aria-label={`Delete ${layer.name}`} onClick={() => state.deleteLayer(layer.id)}>×</button>
            </div>
          ))}
          {state.activeLayers.length === 0 && <p>No layers in this scene.</p>}
        </div>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.layers"
          currentValue={state.selectedLayer
            ? `${state.selectedLayer.name} selected · ${state.activeLayers.length} layer${state.activeLayers.length === 1 ? '' : 's'}`
            : `${state.activeLayers.length} layer${state.activeLayers.length === 1 ? '' : 's'} · none selected`}
          currentValueTone={state.selectedLayer ? 'accent' : 'default'}
          placement="right"
        />
      </section>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid built-in artwork">
        <header><strong>BUILT-INS</strong><span>{PIX_GRID_BUILT_IN_ASSETS.length}</span></header>
        <div className="rv-pix-grid-built-in-grid">
          {PIX_GRID_BUILT_IN_ASSETS.map(asset => (
            <button key={asset.id} type="button" onClick={() => state.addBuiltInLayer(asset.id, asset.name)}>
              <span>{asset.name}</span>
              <small>{asset.nativeSize.width} × {asset.nativeSize.height}</small>
            </button>
          ))}
        </div>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.builtIns"
          currentValue={`${PIX_GRID_BUILT_IN_ASSETS.length} built-in artwork source${PIX_GRID_BUILT_IN_ASSETS.length === 1 ? '' : 's'}`}
          placement="right"
        />
      </section>

      <div className="rv-ctrl-info rv-control-helper-copy">
        Use the MEDIA tab to add PNG, JPEG, static WebP, or SVG artwork as a layer. Upload remains in the shared Media Library.
      </div>
    </div>
  )
}

function PixGridMediaMockup({ state }: { state: PixGridMockState }) {
  const filtered = useMemo(() => {
    const query = state.mediaSearch.trim().toLowerCase()
    return state.mediaItems.filter(item => {
      if (state.mediaFilter === 'favorites' && !item.favorite) return false
      if (state.mediaFilter === 'images' && item.kind !== 'image') return false
      if (state.mediaFilter === 'svg' && item.kind !== 'svg') return false
      if (state.mediaFilter === 'collections' && !item.collection) return false
      return !query || item.name.toLowerCase().includes(query) || item.collection?.toLowerCase().includes(query)
    })
  }, [state.mediaFilter, state.mediaItems, state.mediaSearch])

  return (
    <div className="vz-panel vz-media-browser rv-layout-lab-media-browser" style={{ flex: 1, minHeight: 0 }} data-layout-lab-pix-grid="media">
      <div className="vz-panel-header">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 5h16v14H4zM4 10h16M9 5v14" />
        </svg>
        <span className="vz-panel-title" title="PixGrid Image & SVG Media">PixGrid Image &amp; SVG Media</span>
        <button
          type="button"
          className="vz-import-btn vz-import-btn--secondary"
          title="Refresh media library"
          onClick={() => state.setMediaNotice('Local sample library refreshed. No shared media service was contacted.')}
        >Refresh</button>
      </div>

      <div className="vz-filter-tabs" aria-label="PixGrid media filters">
        {MEDIA_FILTERS.map(filter => (
          <button
            key={filter.id}
            type="button"
            className={`vz-filter-tab ${state.mediaFilter === filter.id ? 'vz-filter-tab--active' : ''}`}
            onClick={() => state.setMediaFilter(filter.id)}
          >{filter.label}</button>
        ))}
      </div>

      <div className="vz-md-search-row">
        <div className="vz-md-search-wrap">
          <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-4.99z" />
          </svg>
          <input className="vz-md-search-input" type="text" placeholder="Search media…" value={state.mediaSearch} onChange={event => state.setMediaSearch(event.target.value)} />
          {state.mediaSearch && <button type="button" className="vz-md-search-clear" title="Clear search" onClick={() => state.setMediaSearch('')}>✕</button>}
        </div>
        <div className="vz-md-view-toggles">
          <button type="button" className={`vz-md-view-btn${state.mediaView === 'grid' ? ' vz-md-view-btn--active' : ''}`} title="Grid view" onClick={() => state.setMediaView('grid')}>▦</button>
          <button type="button" className={`vz-md-view-btn${state.mediaView === 'list' ? ' vz-md-view-btn--active' : ''}`} title="List view" onClick={() => state.setMediaView('list')}>☷</button>
        </div>
      </div>

      <div className="vz-media-status-bar rv-layout-lab-media-status" role="status">
        <span>{filtered.length} compatible item{filtered.length === 1 ? '' : 's'}</span>
        <span>PNG · JPEG · static WebP · SVG</span>
      </div>

      {state.mediaNotice && (
        <div className="rv-ctrl-info rv-layout-lab-local-notice" role="status">
          {state.mediaNotice}
          <button type="button" aria-label="Dismiss media notice" onClick={() => state.setMediaNotice(null)}>×</button>
        </div>
      )}

      <div className="vz-media-scroll">
        {filtered.length === 0 ? (
          <div className="vz-media-empty">
            <span>{state.mediaSearch ? `No media matches "${state.mediaSearch}"` : 'No media available. Add files from Media Manager.'}</span>
            {!state.mediaSearch && (
              <button type="button" className="vz-media-empty-action" onClick={() => state.setMediaNotice('Media Manager is unavailable inside Layout Lab.')}>Open Media Manager</button>
            )}
          </div>
        ) : state.mediaFilter === 'collections' ? (
          <div className="vz-media-grid">
            {[...new Set(filtered.map(item => item.collection).filter(Boolean))].map(collection => (
              <button key={collection} type="button" className="vz-coll-folder" onClick={() => state.setMediaSearch(collection ?? '')}>
                <div className="vz-coll-folder-hd"><span>▣</span><span className="vz-coll-folder-name">{collection}</span><span className="vz-coll-folder-count">{filtered.filter(item => item.collection === collection).length} items</span></div>
                <div className="vz-coll-thumb-strip"><div className="vz-coll-thumb-empty" /></div>
              </button>
            ))}
          </div>
        ) : (
          <div className={state.mediaView === 'grid' ? 'vz-media-grid' : 'vz-media-list'}>
            {filtered.map(item => (
              <article
                key={item.id}
                className={`vz-media-card rv-layout-lab-media-card${item.selected ? ' is-active' : ''}${item.disabledReason ? ' vz-media-card--disabled' : ''}`}
                aria-label={item.name}
                title={item.disabledReason ?? undefined}
              >
                <button
                  type="button"
                  className="rv-layout-lab-media-select"
                  disabled={Boolean(item.disabledReason)}
                  onClick={() => state.editOpen ? state.addMediaLayer(item.id) : state.selectMedia(item.id)}
                  aria-pressed={item.selected}
                >
                  <div className="vz-media-thumb rv-layout-lab-media-thumb" aria-hidden="true">
                    <span>{item.kind === 'svg' ? 'SVG' : item.kind === 'video' ? 'VID' : 'IMG'}</span>
                  </div>
                  <div className="vz-media-info">
                    <div className="vz-media-name">{item.name}</div>
                    <small>{item.dimensions} · {item.kind === 'svg' ? 'SVG' : item.kind === 'video' ? 'Video' : 'Still image'}</small>
                    {item.disabledReason && <span className="vz-media-disabled-reason">{item.disabledReason}</span>}
                  </div>
                </button>
                <div className="rv-layout-lab-media-actions">
                  <button type="button" title={item.favorite ? 'Unfavourite' : 'Favourite'} aria-label={`${item.favorite ? 'Remove' : 'Add'} ${item.name} ${item.favorite ? 'from' : 'to'} favorites`} onClick={() => state.toggleMediaFavorite(item.id)}>{item.favorite ? '★' : '☆'}</button>
                  <button type="button" title="Preview media" aria-label={`Preview ${item.name}`} onClick={() => state.setMediaNotice(`${item.name} preview is visual-only in Layout Lab.`)}>◉</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function PixGridMockup({
  engineId,
  onSelectEngine,
  state,
}: {
  engineId: ReactEngineId
  onSelectEngine: (id: ReactEngineId) => void
  state: PixGridMockState
}) {
  const composition = resolveLayoutLabComposition('pixGrid')
  const [leftTab, setLeftTab] = useState(composition.defaultLeftTab)

  return (
    <div className="rv-left-workspace-shell" data-description-density="compact">
      <section className="rv-context-workspace" aria-label="PixGrid workspace mockup">
        <header className="rv-context-workspace-header">
          <MockEngineDropdown engineId={engineId} onSelect={onSelectEngine} />
        </header>
        <div className="rv-pix-grid-workspace-tabs-help drm-help-overlay-anchor">
          <RailTabs
            tabs={composition.leftTabs}
            activeTab={leftTab}
            onChange={setLeftTab}
            ariaLabel="PixGrid workspace tabs"
            className="rv-context-workspace-tabs"
          />
          <HelpInfoTrigger
            helpId="react.pixGrid.workspace.tabs"
            currentValue={composition.leftTabs.find(tab => tab.id === leftTab)?.label ?? 'Setup'}
            placement="right"
          />
        </div>
        <div className="rv-left-tab-body">
          <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
            {leftTab === 'workspace' && <PixGridSetupMockup state={state} />}
            {leftTab === 'media' && <PixGridMediaMockup state={state} />}
          </div>
        </div>
      </section>
    </div>
  )
}
