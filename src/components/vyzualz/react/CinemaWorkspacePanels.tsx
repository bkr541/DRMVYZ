import { useMemo, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  buildCinemaComposerLibraryItems,
  getCinemaComposerLayers,
  getCinemaEditorSelection,
  useCinemaStore,
  type CinemaComposerLibraryItem,
  type CinemaNodeDefinition,
  type CinemaNodeId,
} from '../cinema'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { PresetSearchRow } from './controls/PresetSearchRow'
import { PanelSubtabs } from './PanelSubtabs'
import { LayerRow } from './controls/LayerRow'

// Same accent palette as the LayerRow canonical component's Layout Lab gallery.
const CINEMA_LAYER_ROW_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#b84fc9', '#d8b95a', '#61d6aa', '#ff6b6b']

function useCinemaPanelState() {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    definitions: store.definitions,
    editorMetadata: store.editorMetadata,
  })))
  const preset = state.compositions.find(candidate => candidate.id === state.activeCompositionId) ?? null
  return { state, preset }
}

export function CinemaPresetsPanel() {
  const { state, preset } = useCinemaPanelState()
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const needle = query.trim().toLowerCase()
  const presets = state.compositions.filter(candidate => {
    const text = `${candidate.metadata.name} ${candidate.metadata.description ?? ''} ${(candidate.metadata.tags ?? []).join(' ')}`.toLowerCase()
    return text.includes(needle)
  })

  const selectPreset = (id: typeof state.activeCompositionId) => {
    if (!id) return
    useCinemaStore.getState().setActiveCinemaComposition(id)
    const selected = state.compositions.find(candidate => candidate.id === id)
    const firstNode = selected ? selectableNodes(selected.nodes)[0]?.id ?? null : null
    useCinemaStore.getState().setCinemaEditorSelection(id, firstNode)
  }

  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema presets" data-preset-scope={scope}>
      <PanelSubtabs
        value={scope}
        options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]}
        onChange={setScope}
        ariaLabel="Preset scope"
      />
      <PresetSearchRow
        query={query}
        onQueryChange={setQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        ariaLabel="Search Cinema presets"
      />
      {scope === 'system' && (
      <div className={`rv-cinema-preset-grid${viewMode === 'list' ? ' rv-cinema-preset-grid--list' : ''}`}>
        {presets.map((candidate, index) => {
          const isActive = candidate.id === preset?.id
          const tone = CINEMA_LAYER_ROW_TONES[index % CINEMA_LAYER_ROW_TONES.length]
          return (
            <button
              type="button"
              key={candidate.id}
              className={`rv-cinema-preset-tile${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              title={candidate.metadata.description}
              onClick={() => selectPreset(candidate.id)}
            >
              <span className="rv-cinema-preset-tile-thumb" style={{ '--rv-preset-tone': tone } as CSSProperties} aria-hidden="true" />
              <span className="rv-cinema-preset-tile-name">{candidate.metadata.name}</span>
            </button>
          )
        })}
        {presets.length === 0 && <div className="rv-ctrl-info">No presets match “{query}”.</div>}
      </div>
      )}
    </section>
  )
}

export function CinemaLayersPanel() {
  const { state, preset } = useCinemaPanelState()
  if (!preset) return <EmptyPanel>Select a preset to see its layers.</EmptyPanel>
  const selectedNodeId = getCinemaEditorSelection(state.editorMetadata, preset.id)
  const structuredLayers = getCinemaComposerLayers(preset)
  const layers = structuredLayers.length > 0
    ? structuredLayers.map(layer => ({ node: layer.node, effects: layer.effects }))
    : selectableNodes(preset.nodes).map(node => ({ node, effects: [] as readonly CinemaNodeDefinition[] }))

  const selectNode = (nodeId: CinemaNodeId) => useCinemaStore.getState().setCinemaEditorSelection(preset.id, nodeId)
  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema layers">
      <div className="rv-cinema-panel-list__header"><strong>Layers</strong><span>{layers.length}</span></div>
      <p className="rv-cinema-panel-list__hint">Select a layer to edit its live look in Design. Build and reorder layers in Show Manager.</p>
      <div className="rv-cinema-layer-tree">
        {layers.map((layer, index) => (
          <div className="rv-cinema-layer-tree__branch" key={layer.node.id}>
            <LayerRow
              index={index + 1}
              label={layer.node.label ?? String(layer.node.typeId)}
              status={layer.node.enabled ? `${Math.round(layer.node.opacity * 100)}%` : 'Off'}
              tone={CINEMA_LAYER_ROW_TONES[index % CINEMA_LAYER_ROW_TONES.length]}
              active={selectedNodeId === layer.node.id}
              onClick={() => selectNode(layer.node.id)}
            />
            {layer.effects.map(effect => (
              <button type="button" className={`rv-cinema-layer-tree__effect${selectedNodeId === effect.id ? ' is-active' : ''}`} key={effect.id} onClick={() => selectNode(effect.id)}>
                <span>FX</span><strong>{effect.label ?? String(effect.typeId)}</strong>
              </button>
            ))}
          </div>
        ))}
        {layers.length === 0 && <div className="rv-ctrl-info">This preset does not expose a layer hierarchy.</div>}
      </div>
    </section>
  )
}

export function CinemaLibraryPanel() {
  const { state } = useCinemaPanelState()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | CinemaComposerLibraryItem['category']>('All')
  const items = useMemo(() => buildCinemaComposerLibraryItems(state.definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY), [state.definitions])
  const visible = items.filter(item => item.category !== 'Effects' && (category === 'All' || item.category === category) && `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema library">
      <div className="rv-cinema-panel-list__header"><strong>Library</strong><span>{visible.length}</span></div>
      <DreamVizTextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search visuals and masks…" aria-label="Search Cinema library" />
      <div className="rv-cinema-filter-row">
        {(['All', 'Visuals', 'Masks', 'Utilities'] as const).map(value => <button type="button" className={category === value ? 'is-active' : ''} key={value} onClick={() => setCategory(value)}>{value}</button>)}
      </div>
      <p className="rv-cinema-panel-list__hint">Browse available building blocks here. Add them to presets in Show Manager.</p>
      <div className="rv-cinema-library-grid">
        {visible.map(item => <article key={item.id} className={!item.available ? 'is-disabled' : ''}><strong>{item.label}</strong><small>{item.category} · {item.sourceKind}</small><p>{item.description}</p></article>)}
      </div>
    </section>
  )
}

function selectableNodes(nodes: readonly Readonly<CinemaNodeDefinition>[]) {
  return nodes.filter(node => node.family !== 'output')
}

function EmptyPanel({ children }: { children: string }) {
  return <div className="rv-ctrl-group"><div className="rv-ctrl-info">{children}</div></div>
}
