import { useEffect, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import { PIX_GRID_BUILT_IN_ASSETS } from './PixGridArtwork'
import {
  addPixGridBuiltInLayer,
  addPixGridScene,
  deletePixGridLayer,
  deletePixGridScene,
  duplicatePixGridLayer,
  duplicatePixGridScene,
  getPixGridActiveLayers,
  getPixGridActiveScene,
  renamePixGridScene,
  reorderPixGridLayer,
  selectPixGridScene,
  updatePixGridLayer,
} from './PixGridAuthoring'

export function PixGridAuthoringPanel() {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const scene = getPixGridActiveScene(state)
  const layers = getPixGridActiveLayers(state)
  const selectedLayer = layers.find(candidate => candidate.id === state.editor.selectedLayerId) ?? null
  const [sceneName, setSceneName] = useState(scene.name)

  useEffect(() => setSceneName(scene.name), [scene.id, scene.name])

  const selectLayer = (layerId: string) => setState({ editor: { ...state.editor, selectedLayerId: layerId } })

  return (
    <div className="rv-pix-grid-authoring-panel">
      <div className="rv-pix-grid-authoring-control-help drm-help-overlay-anchor">
        <button
          type="button"
          className={state.authoringOverlayVisible ? 'rv-pix-grid-edit-toggle is-active' : 'rv-pix-grid-edit-toggle'}
          aria-pressed={state.authoringOverlayVisible}
          onClick={() => setOverlay(!state.authoringOverlayVisible)}
        >
          {state.authoringOverlayVisible ? 'Close PixGrid Edit' : 'Edit PixGrid'}
        </button>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.editOverlay"
          currentValue={state.authoringOverlayVisible ? 'Open' : 'Closed'}
          currentValueLabel="Status"
          currentValueTone={state.authoringOverlayVisible ? 'accent' : 'default'}
          placement="right"
        />
      </div>
      <div className="rv-ctrl-info rv-pix-grid-authoring-hint rv-control-helper-copy">Edit on the center canvas. Changes save automatically.</div>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid scenes">
        <header><strong>SCENES</strong><span>{state.scenes.length}</span></header>
        <div className="rv-pix-grid-scene-list">
          {state.scenes.map(candidate => (
            <button
              key={candidate.id}
              type="button"
              className={candidate.id === scene.id ? 'is-active' : ''}
              onClick={() => setState(selectPixGridScene(state, candidate.id))}
            >
              <span>{candidate.name}</span>
              <small>{candidate.layerIds.length} layers</small>
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
              if (sceneName.trim() && sceneName.trim() !== scene.name) applyState(renamePixGridScene(state, scene.id, sceneName))
              else setSceneName(scene.name)
            }}
          />
        </label>
        <div className="rv-pix-grid-browser-actions">
          <button type="button" onClick={() => applyState(addPixGridScene(state))}>Add</button>
          <button type="button" onClick={() => applyState(duplicatePixGridScene(state))}>Duplicate</button>
          <button type="button" disabled={state.scenes.length <= 1} onClick={() => applyState(deletePixGridScene(state))}>Delete</button>
        </div>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.scenes"
          currentValue={`${scene.name} · ${state.scenes.length} scene${state.scenes.length === 1 ? '' : 's'}`}
          currentValueTone="accent"
          placement="right"
        />
      </section>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid layers">
        <header><strong>LAYERS</strong><span>{layers.length}</span></header>
        <div className="rv-pix-grid-layer-list">
          {layers.map((layer, index) => (
            <div key={layer.id} className={state.editor.selectedLayerId === layer.id ? 'is-active' : ''}>
              <button type="button" className="rv-pix-grid-layer-main" onClick={() => selectLayer(layer.id)}>
                <span>{layer.name}</span>
                <small>{layer.mediaId ? 'MEDIA' : 'BUILT-IN'}</small>
              </button>
              <button
                type="button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={() => applyState(updatePixGridLayer(state, layer.id, { visible: !layer.visible }))}
              >{layer.visible ? '◉' : '○'}</button>
              <button
                type="button"
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                onClick={() => applyState(updatePixGridLayer(state, layer.id, { locked: !layer.locked }))}
              >{layer.locked ? '🔒' : '◇'}</button>
              <button type="button" disabled={index === 0 || layer.locked} aria-label={`Move ${layer.name} down`} onClick={() => applyState(reorderPixGridLayer(state, layer.id, -1))}>↓</button>
              <button type="button" disabled={index === layers.length - 1 || layer.locked} aria-label={`Move ${layer.name} up`} onClick={() => applyState(reorderPixGridLayer(state, layer.id, 1))}>↑</button>
              <button type="button" disabled={layer.locked} aria-label={`Duplicate ${layer.name}`} onClick={() => applyState(duplicatePixGridLayer(state, layer.id))}>⧉</button>
              <button type="button" disabled={layer.locked} aria-label={`Delete ${layer.name}`} onClick={() => applyState(deletePixGridLayer(state, layer.id))}>×</button>
            </div>
          ))}
          {layers.length === 0 && <p>No layers in this scene.</p>}
        </div>
        <HelpInfoTrigger
          helpId="react.pixGrid.authoring.layers"
          currentValue={selectedLayer
            ? `${selectedLayer.name} selected · ${layers.length} layer${layers.length === 1 ? '' : 's'}`
            : `${layers.length} layer${layers.length === 1 ? '' : 's'} · none selected`}
          currentValueTone={selectedLayer ? 'accent' : 'default'}
          placement="right"
        />
      </section>

      <section className="rv-pix-grid-browser-section rv-pix-grid-authoring-section-help drm-help-overlay-anchor" aria-label="PixGrid built-in artwork">
        <header><strong>BUILT-INS</strong><span>{PIX_GRID_BUILT_IN_ASSETS.length}</span></header>
        <div className="rv-pix-grid-built-in-grid">
          {PIX_GRID_BUILT_IN_ASSETS.map(asset => (
            <button key={asset.id} type="button" onClick={() => applyState(addPixGridBuiltInLayer(state, asset.id))}>
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

      <div className="rv-ctrl-info rv-control-helper-copy">Use the MEDIA tab to add PNG, JPEG, static WebP, or SVG artwork as a layer. Upload remains in the shared Media Library.</div>
    </div>
  )
}
