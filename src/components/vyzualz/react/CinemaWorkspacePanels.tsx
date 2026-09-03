import { useMemo, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  buildCinemaComposerLibraryItems,
  getCinemaComposerLayers,
  getCinemaEditorSelection,
  isCinemaBuiltInComposition,
  useCinemaStore,
  type CinemaComposerLibraryItem,
  type CinemaNodeDefinition,
  type CinemaNodeId,
} from '../cinema'
import { GridViewIcon, ListViewIcon } from 'hugeicons-react'
import { isCinemaLiveInstance } from './CinemaLiveOverrides'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { LayerRow } from './controls/LayerRow'
import { Badge } from './controls/Badge'

// Same accent palette as the LayerRow canonical component's Layout Lab gallery.
const CINEMA_LAYER_ROW_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#b84fc9', '#d8b95a', '#61d6aa', '#ff6b6b']

function useCinemaPanelState() {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    instances: store.instances,
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
    <section className="rv-cinema-panel-list" aria-label="Cinema presets">
      <div className="vz-md-search-row rv-cinema-preset-search-row">
        <div className="vz-md-search-wrap">
          <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <DreamVizTextInput
            className="vz-md-search-input"
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search presets…"
            aria-label="Search Cinema presets"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="vz-md-search-clear"
              onClick={() => setQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="vz-md-view-toggles">
          <button
            type="button"
            className={`vz-md-view-btn${viewMode === 'grid' ? ' vz-md-view-btn--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <GridViewIcon size={13} color="currentColor" />
          </button>
          <button
            type="button"
            className={`vz-md-view-btn${viewMode === 'list' ? ' vz-md-view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <ListViewIcon size={13} color="currentColor" />
          </button>
        </div>
      </div>
      <div className={`rv-cinema-preset-grid${viewMode === 'list' ? ' rv-cinema-preset-grid--list' : ''}`}>
        {presets.map((candidate, index) => {
          const variations = state.instances.filter(instance => instance.compositionId === candidate.id && !isCinemaLiveInstance(instance))
          const isActive = candidate.id === preset?.id
          const tone = CINEMA_LAYER_ROW_TONES[index % CINEMA_LAYER_ROW_TONES.length]
          const originLabel = `${isCinemaBuiltInComposition(candidate) ? 'Built-in' : 'Show Manager'}${variations.length ? ` · ${variations.length} variation${variations.length === 1 ? '' : 's'}` : ''}`
          const firstTag = candidate.metadata.tags?.[0]
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
              <span className="rv-cinema-preset-tile-chips">
                <Badge label={originLabel} tone={tone} />
                {firstTag && <Badge label={firstTag} tone={tone} />}
              </span>
            </button>
          )
        })}
        {presets.length === 0 && <div className="rv-ctrl-info">No presets match “{query}”.</div>}
      </div>
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
