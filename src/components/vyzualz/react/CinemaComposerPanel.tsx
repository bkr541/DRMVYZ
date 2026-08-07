import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  addCinemaComposerNode,
  assignCinemaComposerMask,
  attachCinemaComposerEffect,
  buildCinemaComposerLibraryItems,
  cinemaStableId,
  createCinemaComposerComposition,
  decodeCinemaPackage,
  encodeCinemaPackage,
  duplicateCinemaComposerLayer,
  getCinemaComposerLayers,
  getCinemaComposerMaskNodes,
  getCinemaCompositionLibraryStatus,
  getCinemaEditorSelection,
  getCinemaGraphEditorCompositionMetadata,
  isCinemaComposerComposition,
  removeCinemaComposerEffect,
  removeCinemaComposerLayer,
  removeCinemaComposerMask,
  reorderCinemaComposerEffect,
  reorderCinemaComposerLayer,
  setCinemaComposerBlendMode,
  setCinemaComposerLayerEnabled,
  setCinemaComposerLayerOpacity,
  useCinemaStore,
  type CinemaComposerBlendMode,
  type CinemaComposerLibraryItem,
  type CinemaCollectionId,
  type CinemaCompositionId,
  type CinemaNodeId,
} from '../cinema'
import { Collapsible, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import type { CinemaWorkspaceFrameBridgeResult } from './CinemaWorkspaceFrameBridge'
import { CinemaComposerStage19Panel } from './CinemaComposerStage19Panel'
import { CinemaAdvancedGraphEditor } from './CinemaAdvancedGraphEditor'

const BLEND_OPTIONS: readonly CinemaComposerBlendMode[] = [
  'normal', 'add', 'screen', 'multiply', 'lighten', 'darken', 'difference', 'overlay', 'masked',
]

export function CinemaComposerPanel({ frameBridge = null }: { frameBridge?: CinemaWorkspaceFrameBridgeResult | null }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'All' | CinemaComposerLibraryItem['category']>('All')
  const [renameDraft, setRenameDraft] = useState('')
  const [libraryMessage, setLibraryMessage] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    definitions: store.definitions,
    instances: store.instances,
    collections: store.collections,
    editorMetadata: store.editorMetadata,
    undoCount: store.undoStack.length,
    redoCount: store.redoStack.length,
    historyTransaction: store.historyTransaction,
  })))
  const active = state.compositions.find(composition => composition.id === state.activeCompositionId) ?? null
  const libraryStatus = active ? getCinemaCompositionLibraryStatus(active) : null
  useEffect(() => {
    setRenameDraft(active?.metadata.name ?? '')
    setLibraryMessage('')
  }, [active?.id, active?.metadata.name])
  const structured = active != null && isCinemaComposerComposition(active)
  const layers = active && structured ? getCinemaComposerLayers(active) : []
  const masks = active && structured ? getCinemaComposerMaskNodes(active) : []
  const selectedNodeId = active ? getCinemaEditorSelection(state.editorMetadata, active.id) : null
  const editorMode = active ? getCinemaGraphEditorCompositionMetadata(state.editorMetadata, active.id).mode : 'structured'
  const selectedLayer = layers.find(layer => layer.node.id === selectedNodeId)
    ?? layers.find(layer => layer.effects.some(effect => effect.id === selectedNodeId))
    ?? null
  const library = useMemo(() => buildCinemaComposerLibraryItems(state.definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY), [state.definitions])
  const filteredLibrary = library.filter(item => {
    const haystack = `${item.label} ${item.description} ${item.category} ${item.sourceId}`.toLowerCase()
    return (category === 'All' || item.category === category) && haystack.includes(search.trim().toLowerCase())
  })

  const createComposition = () => {
    const id = nextCompositionId(state.compositions.map(composition => String(composition.id)))
    const composition = createCinemaComposerComposition({ id, name: `Cinema Composition ${state.compositions.length + 1}` })
    const upsert = useCinemaStore.getState().upsertCinemaComposition(composition)
    if (upsert.ok) {
      useCinemaStore.getState().setActiveCinemaComposition(id)
      const firstLayer = getCinemaComposerLayers(composition)[0]?.node.id ?? null
      useCinemaStore.getState().setCinemaEditorSelection(id, firstLayer)
    }
  }

  const saveComposition = () => {
    if (!active || libraryStatus?.provenance === 'built-in') return
    const result = useCinemaStore.getState().saveCinemaComposition(active.id)
    setLibraryMessage(result.ok ? 'Composition saved.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to save composition.'))
  }

  const saveCompositionAs = () => {
    if (!active) return
    const id = nextCompositionId(state.compositions.map(composition => String(composition.id)))
    const result = useCinemaStore.getState().saveCinemaCompositionAs(active.id, id, `${active.metadata.name} Copy`)
    setLibraryMessage(result.ok ? 'Saved as a new user composition.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to save composition copy.'))
  }

  const duplicateComposition = () => {
    if (!active) return
    const id = nextCompositionId(state.compositions.map(composition => String(composition.id)))
    const result = useCinemaStore.getState().duplicateCinemaComposition(active.id, id, `${active.metadata.name} Copy`)
    setLibraryMessage(result.ok ? 'Composition duplicated with independent graph IDs.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to duplicate composition.'))
  }

  const renameComposition = () => {
    if (!active || libraryStatus?.provenance === 'built-in') return
    const result = useCinemaStore.getState().renameCinemaComposition(active.id, renameDraft)
    setLibraryMessage(result.ok ? 'Composition renamed.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to rename composition.'))
  }

  const deleteComposition = () => {
    if (!active || libraryStatus?.provenance === 'built-in') return
    const result = useCinemaStore.getState().deleteCinemaComposition(active.id)
    setLibraryMessage(result.ok ? 'Composition deleted; selection moved to a safe fallback.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to delete composition.'))
  }

  const exportComposition = () => {
    if (!active) return
    const encoded = encodeCinemaPackage(useCinemaStore.getState().exportCinemaCompositionPackage(active.id))
    if (!encoded.ok) {
      setLibraryMessage(firstDiagnostic(encoded.diagnostics.diagnostics, 'Unable to export composition.'))
      return
    }
    const blob = new Blob([encoded.value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${active.id}.cinema.json`
      anchor.click()
      setLibraryMessage('Composition package exported.')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const importComposition = async (file: File | null) => {
    if (!file) return
    try {
      const decoded = decodeCinemaPackage(await file.text())
      if (!decoded.ok) {
        setLibraryMessage(firstDiagnostic(decoded.diagnostics.diagnostics, 'Import package is invalid.'))
        return
      }
      const result = useCinemaStore.getState().importCinemaPackage(decoded.value, { mode: 'merge', conflictPolicy: 'reject' })
      setLibraryMessage(result.ok ? 'Cinema package imported.' : firstDiagnostic(result.diagnostics.diagnostics, 'Cinema package was not imported.'))
    } catch (error) {
      setLibraryMessage(`Cinema package was not imported: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const addCollection = () => {
    if (!active) return
    const id = nextCollectionId(state.collections.map(collection => String(collection.id)))
    const result = useCinemaStore.getState().upsertCinemaCollection({
      id,
      label: `Collection ${state.collections.length + 1}`,
      compositionIds: [active.id],
      metadata: { cinemaLibrary: true },
    })
    setLibraryMessage(result.ok ? 'Collection created.' : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to create collection.'))
  }

  const toggleCollection = (collectionId: CinemaCollectionId) => {
    if (!active) return
    const collection = state.collections.find(candidate => candidate.id === collectionId)
    if (!collection) return
    const included = collection.compositionIds.includes(active.id)
    const result = useCinemaStore.getState().upsertCinemaCollection({
      ...collection,
      compositionIds: included
        ? collection.compositionIds.filter(id => id !== active.id)
        : [...collection.compositionIds, active.id],
    })
    setLibraryMessage(result.ok ? (included ? 'Removed from collection.' : 'Added to collection.') : firstDiagnostic(result.diagnostics.diagnostics, 'Unable to update collection.'))
  }

  const edit = (label: string, editor: Parameters<ReturnType<typeof useCinemaStore.getState>['editCinemaComposition']>[2]) => {
    if (!active) return
    useCinemaStore.getState().editCinemaComposition(active.id, label, editor)
  }

  const beginGesture = (label: string) => {
    if (!useCinemaStore.getState().historyTransaction) useCinemaStore.getState().beginCinemaHistoryTransaction(label)
  }
  const endGesture = () => {
    if (useCinemaStore.getState().historyTransaction) useCinemaStore.getState().commitCinemaHistoryTransaction()
  }

  const addLibraryItem = (item: CinemaComposerLibraryItem) => {
    if (!active || !structured || !item.available) return
    const definition = state.definitions.find(candidate => candidate.id === item.typeId)
    if (!definition) return
    if (item.category === 'Effects') {
      if (!selectedLayer) return
      edit(`Attach ${item.label}`, composition => attachCinemaComposerEffect(composition, selectedLayer.node.id, definition, state.definitions))
    } else if (item.category === 'Visuals' || item.category === 'Masks') {
      edit(`Add ${item.label}`, composition => addCinemaComposerNode(composition, definition, state.definitions))
    }
  }

  return (
    <section className="rv-cinema-composer" aria-label="Cinema Composer">
      <div className="rv-cinema-composer__heading">
        <div>
          <div className="rv-cinema-workspace__eyebrow">Cinema Composer</div>
          <h3>Visuals &amp; Library</h3>
        </div>
        <div className="rv-cinema-composer__history" aria-label="Cinema edit history">
          <button type="button" onClick={() => useCinemaStore.getState().undoCinemaEdit()} disabled={state.undoCount === 0 || state.historyTransaction != null}>Undo</button>
          <button type="button" onClick={() => useCinemaStore.getState().redoCinemaEdit()} disabled={state.redoCount === 0 || state.historyTransaction != null}>Redo</button>
        </div>
      </div>

      <SelectRow
        label="Composition"
        value={active?.id ?? ''}
        onChange={value => useCinemaStore.getState().setActiveCinemaComposition(value ? cinemaStableId<CinemaCompositionId>(value, 'composition') : null)}
        options={[
          { value: '', label: 'No composition' },
          ...state.compositions.map(composition => ({ value: String(composition.id), label: composition.metadata.name })),
        ]}
      />
      <button type="button" className="rv-cinema-composer__primary" onClick={createComposition}>New Composition</button>

      {active && (
        <div className="rv-cinema-composer__mode" role="group" aria-label="Cinema editor mode">
          <button type="button" aria-pressed={editorMode === 'structured'} onClick={() => useCinemaStore.getState().setCinemaGraphEditorMode(active.id, 'structured')}>Structured</button>
          <button type="button" aria-pressed={editorMode === 'graph'} onClick={() => useCinemaStore.getState().setCinemaGraphEditorMode(active.id, 'graph')}>Graph</button>
          <span>Two views, one canonical composition.</span>
        </div>
      )}

      {active && (
        <Collapsible label="Composition management">
          <div className="rv-cinema-library-manager">
            <div className="rv-cinema-library-manager__status">
              <strong>{libraryStatus?.provenance === 'built-in' ? 'Built-in / reference' : 'User composition'}</strong>
              <span>{libraryStatus?.modified ? 'Modified · save to checkpoint this revision' : 'Saved'}</span>
            </div>
            <label className="rv-cinema-composer__search">
              <span>Composition name</span>
              <input
                value={renameDraft}
                onChange={event => setRenameDraft(event.target.value)}
                disabled={libraryStatus?.provenance === 'built-in'}
              />
            </label>
            <div className="rv-cinema-library-manager__actions">
              <button type="button" onClick={renameComposition} disabled={libraryStatus?.provenance === 'built-in' || renameDraft.trim() === active.metadata.name || renameDraft.trim() === ''}>Rename</button>
              <button type="button" onClick={saveComposition} disabled={libraryStatus?.provenance === 'built-in' || !libraryStatus?.modified}>Save</button>
              <button type="button" onClick={saveCompositionAs}>Save As</button>
              <button type="button" onClick={duplicateComposition}>Duplicate</button>
              <button type="button" onClick={deleteComposition} disabled={libraryStatus?.provenance === 'built-in'}>Delete</button>
            </div>
            <div className="rv-cinema-library-manager__actions">
              <button type="button" onClick={exportComposition}>Export Composition</button>
              <button type="button" onClick={() => importInputRef.current?.click()}>Import Composition</button>
              <input
                ref={importInputRef}
                className="rv-cinema-library-manager__file-input"
                type="file"
                accept="application/json,.json"
                aria-label="Choose Cinema composition package"
                onChange={event => {
                  const file = event.currentTarget.files?.[0] ?? null
                  void importComposition(file)
                  event.currentTarget.value = ''
                }}
              />
            </div>
            <div className="rv-cinema-library-manager__collections" aria-label="Cinema collections">
              <div className="rv-cinema-library-manager__actions">
                <strong>Collections</strong>
                <button type="button" onClick={addCollection}>New Collection</button>
              </div>
              {state.collections.length === 0 ? <small>No collections yet.</small> : state.collections.map(collection => (
                <label key={collection.id}>
                  <input
                    type="checkbox"
                    checked={collection.compositionIds.includes(active.id)}
                    onChange={() => toggleCollection(collection.id)}
                  />
                  <span>{collection.label}</span>
                </label>
              ))}
            </div>
            {libraryMessage && <div className="rv-cinema-library-manager__message" role="status">{libraryMessage}</div>}
          </div>
        </Collapsible>
      )}

      {active && editorMode === 'graph' ? (
        <CinemaAdvancedGraphEditor composition={active} definitions={state.definitions} />
      ) : !structured ? (
        <div className="rv-cinema-composer__notice" role="note">
          <strong>Structured editing is not active for this composition.</strong>
          <span>Switch to Graph to inspect any canonical composition, or create a Composer composition for structured visual-layer editing.</span>
        </div>
      ) : (
        <>
          <Collapsible label={`Visuals (${layers.length})`}>
            <div className="rv-cinema-composer__layer-list" role="list" aria-label="Cinema visual layers">
              {layers.map((layer, index) => (
                <div className={`rv-cinema-composer__layer${selectedNodeId === layer.node.id ? ' is-selected' : ''}`} role="listitem" key={layer.node.id}>
                  <button
                    type="button"
                    className="rv-cinema-composer__layer-select"
                    aria-pressed={selectedNodeId === layer.node.id}
                    onClick={() => useCinemaStore.getState().setCinemaEditorSelection(active.id, layer.node.id)}
                  >
                    <strong>{layer.node.label ?? layer.node.typeId}</strong>
                    <span>{layer.node.family} · {layer.blendMode} · {Math.round(layer.node.opacity * 100)}%</span>
                  </button>
                  <div className="rv-cinema-composer__layer-actions" aria-label={`${layer.node.label ?? 'Layer'} actions`}>
                    <button type="button" aria-label="Move layer up" disabled={index === 0} onClick={() => edit('Reorder Cinema layer', composition => reorderCinemaComposerLayer(composition, layer.node.id, -1, state.definitions))}>↑</button>
                    <button type="button" aria-label="Move layer down" disabled={index === layers.length - 1} onClick={() => edit('Reorder Cinema layer', composition => reorderCinemaComposerLayer(composition, layer.node.id, 1, state.definitions))}>↓</button>
                    <button type="button" aria-label="Duplicate layer" onClick={() => edit('Duplicate Cinema layer', composition => duplicateCinemaComposerLayer(composition, layer.node.id, state.definitions))}>Duplicate</button>
                    <button type="button" aria-label="Remove layer" disabled={layers.length <= 1} onClick={() => edit('Remove Cinema layer', composition => removeCinemaComposerLayer(composition, layer.node.id, state.definitions))}>Remove</button>
                  </div>
                  {selectedNodeId === layer.node.id && (
                    <div className="rv-cinema-composer__layer-controls">
                      <ToggleRow label="Enabled" value={layer.node.enabled} onChange={enabled => edit('Toggle Cinema layer', composition => setCinemaComposerLayerEnabled(composition, layer.node.id, enabled, state.definitions))} />
                      <SliderRow
                        label="Opacity"
                        value={layer.node.opacity}
                        onChange={opacity => edit('Adjust Cinema layer opacity', composition => setCinemaComposerLayerOpacity(composition, layer.node.id, opacity, state.definitions))}
                        onInteractionStart={() => beginGesture('Adjust Cinema layer opacity')}
                        onInteractionEnd={endGesture}
                      />
                      <SelectRow
                        label="Blend mode"
                        value={layer.blendMode}
                        onChange={mode => edit('Change Cinema blend mode', composition => setCinemaComposerBlendMode(composition, layer.node.id, mode as CinemaComposerBlendMode, state.definitions))}
                        options={BLEND_OPTIONS.map(mode => ({ value: mode, label: capitalize(mode), disabled: mode === 'masked' && !layer.maskNodeId }))}
                      />
                      <SelectRow
                        label="Mask"
                        value={layer.maskNodeId ?? ''}
                        onChange={mask => edit('Assign Cinema mask', composition => assignCinemaComposerMask(composition, layer.node.id, mask ? cinemaStableId<CinemaNodeId>(mask, 'node') : null, state.definitions))}
                        options={[{ value: '', label: 'No mask' }, ...masks.map(mask => ({ value: String(mask.id), label: mask.label ?? String(mask.id) }))]}
                      />
                    </div>
                  )}
                  {layer.effects.length > 0 && (
                    <div className="rv-cinema-composer__effects" aria-label={`${layer.node.label ?? 'Layer'} effects`}>
                      {layer.effects.map((effect, effectIndex) => (
                        <div key={effect.id} className={selectedNodeId === effect.id ? 'is-selected' : ''}>
                          <button type="button" aria-pressed={selectedNodeId === effect.id} onClick={() => useCinemaStore.getState().setCinemaEditorSelection(active.id, effect.id)}>{effect.label ?? effect.typeId}</button>
                          <button type="button" aria-label="Move effect up" disabled={effectIndex === 0} onClick={() => edit('Reorder Cinema effect', composition => reorderCinemaComposerEffect(composition, effect.id, -1, state.definitions))}>↑</button>
                          <button type="button" aria-label="Move effect down" disabled={effectIndex === layer.effects.length - 1} onClick={() => edit('Reorder Cinema effect', composition => reorderCinemaComposerEffect(composition, effect.id, 1, state.definitions))}>↓</button>
                          <button type="button" aria-label="Remove effect" onClick={() => edit('Remove Cinema effect', composition => removeCinemaComposerEffect(composition, effect.id, state.definitions))}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Collapsible>

          {masks.length > 0 && (
            <Collapsible label={`Masks (${masks.length})`} defaultOpen={false}>
              {masks.map(mask => (
                <div className="rv-cinema-composer__library-item" key={mask.id}>
                  <button type="button" className="rv-cinema-composer__layer-select" aria-pressed={selectedNodeId === mask.id} onClick={() => useCinemaStore.getState().setCinemaEditorSelection(active.id, mask.id)}>
                    <strong>{mask.label ?? mask.typeId}</strong><span>{mask.enabled ? 'Assigned' : 'Available'}</span>
                  </button>
                  <button type="button" aria-label={`Remove ${mask.label ?? 'mask'}`} onClick={() => edit('Remove Cinema mask', composition => removeCinemaComposerMask(composition, mask.id, state.definitions))}>Remove</button>
                </div>
              ))}
            </Collapsible>
          )}
        </>
      )}

      {structured && active && (
        <CinemaComposerStage19Panel
          composition={active}
          definitions={state.definitions}
          frameBridge={frameBridge}
          edit={edit}
        />
      )}

      <Collapsible label="Library">
        <label className="rv-cinema-composer__search">
          <span>Search visuals</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search nodes, adapters, effects…" />
        </label>
        <SelectRow label="Category" value={category} onChange={value => setCategory(value as typeof category)} options={['All', 'Visuals', 'Masks', 'Effects', 'Utilities'].map(value => ({ value, label: value }))} />
        <div className="rv-cinema-composer__library" role="list" aria-label="Cinema node library">
          {filteredLibrary.map(item => {
            const effectNeedsLayer = item.category === 'Effects' && !selectedLayer
            const disabled = editorMode === 'graph' || !structured || !item.available || effectNeedsLayer
            const reason = editorMode === 'graph'
              ? 'Use the graph toolbar to add typed nodes while Graph mode is active.'
              : !structured
                ? 'Create or select a structured Cinema Composer composition first.'
              : item.disabledReason ?? (effectNeedsLayer ? 'Select a visual layer before attaching an effect.' : undefined)
            return (
              <div className="rv-cinema-composer__library-item" role="listitem" key={item.id}>
                <div><strong>{item.label}</strong><span>{item.category} · {item.sourceKind}</span></div>
                <button type="button" disabled={disabled} title={reason} aria-label={`Add ${item.label}`} onClick={() => addLibraryItem(item)}>Add</button>
                {reason && disabled && <small>{reason}</small>}
              </div>
            )
          })}
        </div>
      </Collapsible>

      <Collapsible label="Saved compositions & presets" defaultOpen={false}>
        {state.compositions.map(composition => (
          <button
            type="button"
            key={composition.id}
            className="rv-cinema-composer__saved"
            aria-pressed={composition.id === active?.id && state.activeInstanceId == null}
            onClick={() => useCinemaStore.getState().setActiveCinemaComposition(composition.id)}
          >
            <strong>{composition.metadata.name}</strong>
            <span>{getCinemaCompositionLibraryStatus(composition).provenance === 'built-in' ? 'Built-in / reference composition' : getCinemaCompositionLibraryStatus(composition).modified ? 'User composition · modified' : 'User composition · saved'}</span>
          </button>
        ))}
        {state.instances.map(instance => {
          const composition = state.compositions.find(candidate => candidate.id === instance.compositionId)
          return (
            <button
              type="button"
              key={instance.id}
              className="rv-cinema-composer__saved"
              aria-pressed={state.activeInstanceId === instance.id}
              onClick={() => useCinemaStore.getState().setActiveCinemaComposition(instance.compositionId, instance.id)}
            >
              <strong>{instance.label}</strong>
              <span>Saved preset · {composition?.metadata.name ?? instance.compositionId}</span>
            </button>
          )
        })}
      </Collapsible>
    </section>
  )
}

function nextCompositionId(existing: readonly string[]): CinemaCompositionId {
  const ids = new Set(existing)
  let candidate = 'composer-composition'
  let suffix = 2
  while (ids.has(candidate)) candidate = `composer-composition-${suffix++}`
  return cinemaStableId<CinemaCompositionId>(candidate, 'composition')
}

function nextCollectionId(existing: readonly string[]): CinemaCollectionId {
  const ids = new Set(existing)
  let candidate = 'cinema-collection'
  let suffix = 2
  while (ids.has(candidate)) candidate = `cinema-collection-${suffix++}`
  return cinemaStableId<CinemaCollectionId>(candidate, 'collection')
}

function firstDiagnostic(
  diagnostics: readonly { message: string }[],
  fallback: string,
): string {
  return diagnostics[0]?.message ?? fallback
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
