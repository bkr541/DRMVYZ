import { useMemo, useState } from 'react'
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
import { isCinemaLiveInstance } from './CinemaLiveOverrides'
import { DreamVizTextInput } from './controls/DreamVizTextInput'

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
      <div className="rv-cinema-panel-list__header">
        <strong>Presets</strong>
        <span>{presets.length}</span>
      </div>
      <DreamVizTextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search presets…" aria-label="Search Cinema presets" />
      <p className="rv-cinema-panel-list__hint">Choose a preset here. Preset creation and management live in Show Manager.</p>
      <div className="rv-preset-list">
        {presets.map(candidate => {
          const variations = state.instances.filter(instance => instance.compositionId === candidate.id && !isCinemaLiveInstance(instance))
          return (
            <button
              type="button"
              key={candidate.id}
              className={`rv-preset-card${candidate.id === preset?.id ? ' rv-preset-card--active' : ''}`}
              aria-pressed={candidate.id === preset?.id}
              onClick={() => selectPreset(candidate.id)}
            >
              <span className="rv-preset-name">{candidate.metadata.name}</span>
              <span className="rv-preset-engine-label">{isCinemaBuiltInComposition(candidate) ? 'Built-in' : 'Show Manager'}{variations.length ? ` · ${variations.length} variation${variations.length === 1 ? '' : 's'}` : ''}</span>
              {candidate.metadata.description && <span className="rv-preset-desc">{candidate.metadata.description}</span>}
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
            <button type="button" className={selectedNodeId === layer.node.id ? 'is-active' : ''} onClick={() => selectNode(layer.node.id)}>
              <span>{index + 1}</span><strong>{layer.node.label ?? String(layer.node.typeId)}</strong><small>{layer.node.enabled ? `${Math.round(layer.node.opacity * 100)}%` : 'Off'}</small>
            </button>
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
