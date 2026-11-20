import { AppIcon } from '../../../shared/icons/AppIcon'
import { useReactStore } from '../../../../stores/reactStore'
import { IconChipButton } from '../controls/IconChipButton'
import { LayerRow } from '../controls/LayerRow'
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
  reorderPixGridLayer,
  selectPixGridScene,
  updatePixGridLayer,
} from './PixGridAuthoring'

const PIX_GRID_ROW_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#b84fc9', '#d8b95a', '#61d6aa', '#ff6b6b']

/**
 * SOURCE tab: what PixGrid draws from. Edit PixGrid, the scene list (one scene per song section), the built-in artwork to add as layers,
 * and the Custom Workflow entry. The scene's layer stack is on the LAYERS tab and its name is edited in Design, as in the other engines.
 */
export function PixGridAuthoringPanel({ onCreateDeck }: { onCreateDeck?: () => void }) {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const scene = getPixGridActiveScene(state)

  return (
    <div className="rv-pix-grid-authoring-panel">
      <button
        type="button"
        className={state.authoringOverlayVisible ? 'rv-pix-grid-edit-toggle is-active' : 'rv-pix-grid-edit-toggle'}
        aria-pressed={state.authoringOverlayVisible}
        onClick={() => setOverlay(!state.authoringOverlayVisible)}
      >
        {state.authoringOverlayVisible ? 'Close PixGrid Edit' : 'Edit PixGrid'}
      </button>
      <div className="rv-ctrl-info rv-pix-grid-authoring-hint rv-control-helper-copy">Edit on the center canvas. Changes save automatically.</div>

      <section className="rv-engine-panel-list" aria-label="PixGrid scenes">
        <div className="rv-engine-panel-list__header"><strong>Scenes</strong><span>{state.scenes.length}</span></div>
        <div className="rv-engine-layer-tree">
          {state.scenes.map((candidate, index) => (
            <LayerRow
              key={candidate.id}
              index={index + 1}
              label={candidate.name}
              status={`${candidate.layerIds.length} layer${candidate.layerIds.length === 1 ? '' : 's'}`}
              tone={PIX_GRID_ROW_TONES[index % PIX_GRID_ROW_TONES.length]}
              active={candidate.id === scene.id}
              aria-pressed={candidate.id === scene.id}
              aria-label={`Select scene ${candidate.name}`}
              onClick={() => setState(selectPixGridScene(state, candidate.id))}
            />
          ))}
        </div>
        <div className="rv-ctrl-action-row">
          <IconChipButton onClick={() => applyState(addPixGridScene(state))}>Add</IconChipButton>
          <IconChipButton onClick={() => applyState(duplicatePixGridScene(state))}>Duplicate</IconChipButton>
          <IconChipButton disabled={state.scenes.length <= 1} onClick={() => applyState(deletePixGridScene(state))}>Delete</IconChipButton>
        </div>
      </section>

      <section className="rv-engine-panel-list" aria-label="PixGrid built-in artwork">
        <div className="rv-engine-panel-list__header"><strong>Built-in Artwork</strong><span>{PIX_GRID_BUILT_IN_ASSETS.length}</span></div>
        <div className="rv-pix-grid-built-in-grid">
          {PIX_GRID_BUILT_IN_ASSETS.map(asset => (
            <button key={asset.id} type="button" onClick={() => applyState(addPixGridBuiltInLayer(state, asset.id))}>
              <span>{asset.name}</span>
              <small>{asset.nativeSize.width} × {asset.nativeSize.height}</small>
            </button>
          ))}
        </div>
      </section>

      {onCreateDeck && (
        <section className="rv-engine-panel-list pmv-custom-workflow-entry" aria-label="PixGrid custom workflow">
          <div className="rv-engine-panel-list__header"><strong>Custom Workflow</strong></div>
          <div className="rv-ctrl-info rv-control-helper-copy">Build a preset from your own images. This opens the PixGrid Deck Builder in Preset Manager.</div>
          <div className="rv-ctrl-action-row">
            <IconChipButton onClick={onCreateDeck}>Create PixGrid Deck</IconChipButton>
          </div>
        </section>
      )}

      <div className="rv-ctrl-info rv-control-helper-copy">Use the MEDIA tab to add PNG, JPEG, static WebP, or SVG artwork as a layer. Upload remains in the shared Media Library.</div>
    </div>
  )
}

/** LAYERS tab: the active scene's layer stack in the shared layer-row list (the same rows, header and hover actions as CANVAS). */
export function PixGridLayersPanel() {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const layers = getPixGridActiveLayers(state)
  const selectLayer = (layerId: string) => setState({ editor: { ...state.editor, selectedLayerId: layerId } })

  return (
    <section className="rv-engine-panel-list" aria-label="PixGrid layers">
      <div className="rv-engine-panel-list__header"><strong>Layers</strong><span>{layers.length}</span></div>
      <div className="rv-engine-layer-tree">
        {layers.map((layer, index) => {
          const source = layer.mediaId ? 'Media' : 'Built-in'
          const status = `${source} · ${layer.visible ? `${Math.round(layer.opacity * 100)}%` : 'Hidden'}${layer.locked ? ' · Locked' : ''}`
          return (
            <div key={layer.id} className="rv-canvas-layer-stack-row" data-pix-grid-layer-id={layer.id}>
              <LayerRow
                index={index + 1}
                label={layer.name}
                status={status}
                tone={PIX_GRID_ROW_TONES[index % PIX_GRID_ROW_TONES.length]}
                active={state.editor.selectedLayerId === layer.id}
                aria-pressed={state.editor.selectedLayerId === layer.id}
                aria-label={`Select layer ${index + 1}: ${layer.name}`}
                onClick={() => selectLayer(layer.id)}
              />
              <div className="rv-canvas-layer-row-actions" aria-label={`Actions for ${layer.name}`}>
                <IconChipButton
                  className="rv-canvas-layer-row-action"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  icon={<AppIcon kind={layer.visible ? 'eyeOff' : 'eye'} size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(updatePixGridLayer(state, layer.id, { visible: !layer.visible })) }}
                />
                <IconChipButton
                  className="rv-canvas-layer-row-action"
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  icon={<AppIcon kind={layer.locked ? 'unlock' : 'lock'} size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(updatePixGridLayer(state, layer.id, { locked: !layer.locked })) }}
                />
                <IconChipButton
                  className="rv-canvas-layer-row-action"
                  title="Move layer up"
                  aria-label={`Move ${layer.name} up`}
                  disabled={index === 0 || layer.locked}
                  icon={<AppIcon kind="up" size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(reorderPixGridLayer(state, layer.id, -1)) }}
                />
                <IconChipButton
                  className="rv-canvas-layer-row-action"
                  title="Move layer down"
                  aria-label={`Move ${layer.name} down`}
                  disabled={index === layers.length - 1 || layer.locked}
                  icon={<AppIcon kind="down" size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(reorderPixGridLayer(state, layer.id, 1)) }}
                />
                <IconChipButton
                  className="rv-canvas-layer-row-action"
                  title="Duplicate layer"
                  aria-label={`Duplicate ${layer.name}`}
                  disabled={layer.locked}
                  icon={<AppIcon kind="copy" size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(duplicatePixGridLayer(state, layer.id)) }}
                />
                <IconChipButton
                  className="rv-canvas-layer-row-action rv-canvas-layer-row-action--delete"
                  title="Delete layer"
                  aria-label={`Delete ${layer.name}`}
                  disabled={layer.locked}
                  icon={<AppIcon kind="delete" size={12} color="currentColor" />}
                  onClick={event => { event.stopPropagation(); applyState(deletePixGridLayer(state, layer.id)) }}
                />
              </div>
            </div>
          )
        })}
        {layers.length === 0 && <div className="rv-ctrl-info">No layers in this scene. Add built-in artwork from the SOURCE tab or media from the MEDIA tab.</div>}
      </div>
    </section>
  )
}
