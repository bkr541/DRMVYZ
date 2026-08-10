import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import { NoticeCard } from './controls/NoticeCard'
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  CINEMA_GRAPH_EDITOR_MAX_VISIBLE_NODES,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  checkCinemaGraphConnection,
  clampCinemaGraphEditorZoom,
  connectCinemaGraphNodes,
  createCinemaDefinitionRegistryFromPersistedDefinitions,
  createCinemaGraphNode,
  defaultCinemaGraphNodePosition,
  getCinemaGraphDiagnosticsForConnection,
  getCinemaGraphDiagnosticsForNode,
  getCinemaGraphEditorCompositionMetadata,
  getCinemaGraphNodePorts,
  isCinemaBuiltInComposition,
  removeCinemaGraphConnection,
  removeCinemaGraphNodes,
  setCinemaGraphNodesEnabled,
  useCinemaStore,
  validateCinemaCompositionGraph,
  type CinemaCompositionDefinition,
  type CinemaConnectionId,
  type CinemaDiagnostic,
  type CinemaGraphEditorPoint,
  type CinemaGraphEditorViewport,
  type CinemaNodeId,
  type CinemaPersistedDefinition,
  type CinemaPortId,
} from '../cinema'

const NODE_WIDTH = 218
const NODE_HEADER_HEIGHT = 44
const PORT_ROW_HEIGHT = 22
const VIEWPORT_OVERSCAN = 320

interface CinemaAdvancedGraphEditorProps {
  composition: CinemaCompositionDefinition
  definitions: readonly CinemaPersistedDefinition[]
}

interface GraphEndpointDraft {
  nodeId: CinemaNodeId
  portId: CinemaPortId
}

interface DragState {
  pointerId: number
  origin: CinemaGraphEditorPoint
  baseline: Readonly<Record<string, CinemaGraphEditorPoint>>
  moved: boolean
  ownsTransaction: boolean
}

interface PanState {
  pointerId: number
  origin: CinemaGraphEditorPoint
  baseline: CinemaGraphEditorViewport
}

export function CinemaAdvancedGraphEditor(props: CinemaAdvancedGraphEditorProps) {
  return (
    <CinemaGraphEditorErrorBoundary fallback={<CinemaGraphStructuredFallback {...props} />}>
      <CinemaAdvancedGraphEditorSurface {...props} />
    </CinemaGraphEditorErrorBoundary>
  )
}

function CinemaAdvancedGraphEditorSurface({ composition, definitions }: CinemaAdvancedGraphEditorProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const editorMetadata = useCinemaStore(store => store.editorMetadata)
  const historyTransaction = useCinemaStore(store => store.historyTransaction)
  const metadata = getCinemaGraphEditorCompositionMetadata(editorMetadata, composition.id)
  const immutable = isCinemaBuiltInComposition(composition)
  const [connectionDraft, setConnectionDraft] = useState<GraphEndpointDraft | null>(null)
  const [message, setMessage] = useState('')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [panState, setPanState] = useState<PanState | null>(null)
  const [draftPositions, setDraftPositions] = useState<Readonly<Record<string, CinemaGraphEditorPoint>> | null>(null)
  const [draftViewport, setDraftViewport] = useState<CinemaGraphEditorViewport | null>(null)
  const [surfaceSize, setSurfaceSize] = useState({ width: 1200, height: 680 })
  const [addTypeId, setAddTypeId] = useState('')
  const [accessibleFrom, setAccessibleFrom] = useState('')
  const [accessibleTo, setAccessibleTo] = useState('')

  const registryResult = useMemo(
    () => createCinemaDefinitionRegistryFromPersistedDefinitions(definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY),
    [definitions],
  )
  const validation = useMemo(
    () => validateCinemaCompositionGraph(composition, registryResult.registry),
    [composition, registryResult.registry],
  )
  const positions = useMemo(() => {
    const persisted = draftPositions ?? metadata.nodePositions
    return Object.fromEntries(composition.nodes.map((node, index) => [
      String(node.id),
      persisted[String(node.id)] ?? defaultCinemaGraphNodePosition(index),
    ])) as Record<string, CinemaGraphEditorPoint>
  }, [composition.nodes, draftPositions, metadata.nodePositions])
  const viewport = draftViewport ?? metadata.viewport
  const selectedNodeIds = new Set(metadata.selectedNodeIds.map(String))
  const selectedConnectionId = metadata.selectedConnectionId
  const nodeById = useMemo(() => new Map(composition.nodes.map(node => [String(node.id), node])), [composition.nodes])
  const definitionByType = useMemo(() => new Map(definitions.map(definition => [String(definition.id), definition])), [definitions])
  const addableDefinitions = useMemo(
    () => definitions.filter(definition => definition.definition.family !== 'output').sort((left, right) => left.definition.label.localeCompare(right.definition.label)),
    [definitions],
  )

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect) setSurfaceSize({ width: rect.width, height: rect.height })
    })
    observer.observe(surface)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setDraftPositions(null)
    setDraftViewport(null)
    setConnectionDraft(null)
    setMessage('')
  }, [composition.id])

  const visibleNodes = useMemo(() => composition.nodes.filter(node => {
    const position = positions[String(node.id)]
    const screenX = viewport.x + position.x * viewport.zoom
    const screenY = viewport.y + position.y * viewport.zoom
    const width = NODE_WIDTH * viewport.zoom
    const height = nodeHeight(node, definitionByType.get(String(node.typeId))) * viewport.zoom
    return screenX + width >= -VIEWPORT_OVERSCAN
      && screenX <= surfaceSize.width + VIEWPORT_OVERSCAN
      && screenY + height >= -VIEWPORT_OVERSCAN
      && screenY <= surfaceSize.height + VIEWPORT_OVERSCAN
  }).slice(0, CINEMA_GRAPH_EDITOR_MAX_VISIBLE_NODES), [composition.nodes, positions, viewport, definitionByType, surfaceSize])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => String(node.id))), [visibleNodes])

  const selectNode = (nodeId: CinemaNodeId, additive: boolean) => {
    const current = metadata.selectedNodeIds
    const next = additive
      ? current.some(id => id === nodeId)
        ? current.filter(id => id !== nodeId)
        : [...current, nodeId]
      : [nodeId]
    useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, next, null)
  }

  const beginNodeDrag = (event: ReactPointerEvent<HTMLDivElement>, nodeId: CinemaNodeId) => {
    if (immutable || event.button !== 0) return
    event.stopPropagation()
    const selected = selectedNodeIds.has(String(nodeId)) ? metadata.selectedNodeIds : [nodeId]
    if (!selectedNodeIds.has(String(nodeId))) useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, [nodeId], null)
    const baseline = Object.fromEntries(selected.map(id => [String(id), positions[String(id)] ?? defaultCinemaGraphNodePosition(0)]))
    const ownsTransaction = !historyTransaction
    if (ownsTransaction) useCinemaStore.getState().beginCinemaHistoryTransaction('Move Cinema graph nodes')
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({ pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, baseline, moved: false, ownsTransaction })
  }

  const moveNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const dx = (event.clientX - dragState.origin.x) / viewport.zoom
    const dy = (event.clientY - dragState.origin.y) / viewport.zoom
    const next = { ...metadata.nodePositions }
    for (const [nodeId, baseline] of Object.entries(dragState.baseline)) {
      next[nodeId] = { x: baseline.x + dx, y: baseline.y + dy }
    }
    setDraftPositions(next)
    if (!dragState.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) setDragState({ ...dragState, moved: true })
  }

  const finishNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const next = draftPositions
    if (dragState.moved && next) {
      useCinemaStore.getState().setCinemaGraphNodePositions(composition.id, next, 'Move Cinema graph nodes')
      if (dragState.ownsTransaction) useCinemaStore.getState().commitCinemaHistoryTransaction()
    } else if (dragState.ownsTransaction) {
      useCinemaStore.getState().cancelCinemaHistoryTransaction()
    }
    setDragState(null)
    setDraftPositions(null)
  }

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanState({ pointerId: event.pointerId, origin: { x: event.clientX, y: event.clientY }, baseline: viewport })
    useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, [], null)
  }

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panState || panState.pointerId !== event.pointerId) return
    setDraftViewport({
      ...panState.baseline,
      x: panState.baseline.x + event.clientX - panState.origin.x,
      y: panState.baseline.y + event.clientY - panState.origin.y,
    })
  }

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panState || panState.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (draftViewport) useCinemaStore.getState().setCinemaGraphEditorViewport(composition.id, draftViewport)
    setPanState(null)
    setDraftViewport(null)
  }

  const zoom = (nextZoom: number, focusX = surfaceSize.width / 2, focusY = surfaceSize.height / 2) => {
    const clamped = clampCinemaGraphEditorZoom(nextZoom)
    const worldX = (focusX - viewport.x) / viewport.zoom
    const worldY = (focusY - viewport.y) / viewport.zoom
    const next = {
      x: focusX - worldX * clamped,
      y: focusY - worldY * clamped,
      zoom: clamped,
    }
    useCinemaStore.getState().setCinemaGraphEditorViewport(composition.id, next)
  }

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = surfaceRef.current?.getBoundingClientRect()
    const focusX = rect ? event.clientX - rect.left : surfaceSize.width / 2
    const focusY = rect ? event.clientY - rect.top : surfaceSize.height / 2
    zoom(viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1), focusX, focusY)
  }

  const addNode = () => {
    const definition = definitions.find(candidate => String(candidate.id) === addTypeId)
    if (!definition || immutable) return
    const store = useCinemaStore.getState()
    const ownsTransaction = !store.historyTransaction
    if (ownsTransaction) store.beginCinemaHistoryTransaction('Add Cinema graph node')
    let createdId: CinemaNodeId | null = null
    const result = store.editCinemaComposition(composition.id, `Add ${definition.definition.label}`, current => {
      const created = createCinemaGraphNode(current, definition)
      createdId = created.selectedNodeId
      return created
    })
    if (result.ok && createdId) {
      const currentMetadata = getCinemaGraphEditorCompositionMetadata(useCinemaStore.getState().editorMetadata, composition.id)
      const index = composition.nodes.length
      store.setCinemaGraphNodePositions(composition.id, {
        ...currentMetadata.nodePositions,
        [String(createdId)]: defaultCinemaGraphNodePosition(index),
      }, 'Place Cinema graph node')
      if (ownsTransaction) store.commitCinemaHistoryTransaction()
      setMessage(`${definition.definition.label} added as a disabled draft. Wire required ports, then enable it atomically.`)
    } else {
      if (ownsTransaction) store.cancelCinemaHistoryTransaction()
      setMessage(firstDiagnostic(result.diagnostics.diagnostics, 'Cinema node could not be added.'))
    }
  }

  const connect = (from: GraphEndpointDraft, to: GraphEndpointDraft) => {
    if (immutable) return
    const candidate = { fromNodeId: from.nodeId, fromPortId: from.portId, toNodeId: to.nodeId, toPortId: to.portId }
    const check = checkCinemaGraphConnection(composition, candidate, definitions, registryResult.registry, { replaceExistingInput: true })
    if (!check.ok || !check.connection) {
      setMessage(firstDiagnostic(check.diagnostics.diagnostics, 'Cinema connection is invalid.'))
      return
    }
    const result = useCinemaStore.getState().editCinemaComposition(composition.id, 'Connect Cinema graph nodes', current => ({
      composition: connectCinemaGraphNodes(current, candidate, definitions, registryResult.registry, { replaceExistingInput: true }),
      selectedNodeId: to.nodeId,
    }))
    if (result.ok) {
      useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, [to.nodeId], check.connection.id)
      setConnectionDraft(null)
      setMessage(check.replacedConnectionIds.length > 0 ? 'Connection added and the occupied single-input connection was replaced atomically.' : check.connection.enabled ? 'Connection added to the canonical Cinema graph.' : 'Pending typed connection added. It will activate with its disabled draft node.')
    } else {
      setMessage(firstDiagnostic(result.diagnostics.diagnostics, 'Cinema connection could not be added.'))
    }
  }

  const selectPort = (nodeId: CinemaNodeId, portId: CinemaPortId, direction: 'input' | 'output') => {
    if (immutable) return
    if (direction === 'output') {
      setConnectionDraft({ nodeId, portId })
      setMessage('Select a compatible input port to complete the connection.')
      return
    }
    if (!connectionDraft) {
      setMessage('Select an output port first, then choose this input port.')
      return
    }
    connect(connectionDraft, { nodeId, portId })
  }

  const activateSelectedDrafts = () => {
    if (immutable || metadata.selectedNodeIds.length === 0) return
    const draftNodeIds = metadata.selectedNodeIds.filter(nodeId => (
      nodeId !== composition.outputNodeId
      && composition.nodes.some(node => node.id === nodeId && !node.enabled)
    ))
    if (draftNodeIds.length === 0) return
    const result = useCinemaStore.getState().editCinemaComposition(
      composition.id,
      'Activate Cinema graph drafts',
      current => ({
        composition: setCinemaGraphNodesEnabled(current, draftNodeIds, true, definitions),
        selectedNodeId: draftNodeIds[0] ?? null,
      }),
    )
    setMessage(result.ok
      ? `${draftNodeIds.length} draft node${draftNodeIds.length === 1 ? '' : 's'} activated.`
      : firstDiagnostic(result.diagnostics.diagnostics, 'Draft nodes could not be activated. Complete required typed connections first.'))
  }

  const deleteSelection = () => {
    if (immutable) return
    const store = useCinemaStore.getState()
    if (selectedConnectionId) {
      const result = store.editCinemaComposition(composition.id, 'Delete Cinema graph connection', current => ({
        composition: removeCinemaGraphConnection(current, selectedConnectionId),
        selectedNodeId: metadata.selectedNodeIds[0] ?? null,
      }))
      if (result.ok) store.setCinemaGraphEditorSelection(composition.id, metadata.selectedNodeIds, null)
      setMessage(result.ok ? 'Connection removed.' : firstDiagnostic(result.diagnostics.diagnostics, 'Connection could not be removed.'))
      return
    }
    const deletable = metadata.selectedNodeIds.filter(nodeId => nodeId !== composition.outputNodeId)
    if (deletable.length === 0) return
    const result = store.editCinemaComposition(composition.id, 'Delete Cinema graph nodes', current => removeCinemaGraphNodes(current, deletable))
    setMessage(result.ok ? `${deletable.length} node${deletable.length === 1 ? '' : 's'} removed with dependent references reconciled.` : firstDiagnostic(result.diagnostics.diagnostics, 'Cinema nodes could not be removed.'))
  }

  const fitGraph = () => {
    if (composition.nodes.length === 0) return
    const points = composition.nodes.map(node => positions[String(node.id)])
    const minX = Math.min(...points.map(point => point.x))
    const minY = Math.min(...points.map(point => point.y))
    const maxX = Math.max(...points.map(point => point.x + NODE_WIDTH))
    const maxY = Math.max(...composition.nodes.map((node, index) => points[index].y + nodeHeight(node, definitionByType.get(String(node.typeId)))))
    const graphWidth = Math.max(1, maxX - minX)
    const graphHeight = Math.max(1, maxY - minY)
    const nextZoom = clampCinemaGraphEditorZoom(Math.min((surfaceSize.width - 80) / graphWidth, (surfaceSize.height - 80) / graphHeight, 1))
    useCinemaStore.getState().setCinemaGraphEditorViewport(composition.id, {
      x: (surfaceSize.width - graphWidth * nextZoom) / 2 - minX * nextZoom,
      y: (surfaceSize.height - graphHeight * nextZoom) / 2 - minY * nextZoom,
      zoom: nextZoom,
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && !isTextInput(event.target)) {
      event.preventDefault()
      deleteSelection()
    }
  }

  const accessibleConnect = () => {
    const from = parseEndpoint(accessibleFrom)
    const to = parseEndpoint(accessibleTo)
    if (from && to) connect(from, to)
  }

  const endpointOptions = composition.nodes.flatMap(node => {
    const ports = getCinemaGraphNodePorts(node, definitions)
    return [...ports.outputs.map(port => ({
      value: endpointValue(node.id, port.id),
      label: `${node.label ?? node.typeId} → ${port.label} (${port.dataType})`,
      direction: 'output' as const,
    })), ...ports.inputs.map(port => ({
      value: endpointValue(node.id, port.id),
      label: `${node.label ?? node.typeId} ← ${port.label} (${port.dataType})`,
      direction: 'input' as const,
    }))]
  })

  return (
    <div className="rv-cinema-graph-editor">
      <div className="rv-cinema-graph-editor__toolbar" aria-label="Cinema graph controls">
        <label>
          <span>Add node</span>
          <DropdownSelect value={addTypeId} onChange={event => setAddTypeId(event.target.value)} disabled={immutable}>
            <option value="">Choose a node…</option>
            {addableDefinitions.map(definition => <option key={definition.id} value={definition.id}>{definition.definition.label} · {definition.definition.family}</option>)}
          </DropdownSelect>
        </label>
        <button type="button" onClick={addNode} disabled={immutable || !addTypeId}>Add</button>
        <button type="button" onClick={() => zoom(viewport.zoom * 1.15)}>Zoom +</button>
        <button type="button" onClick={() => zoom(viewport.zoom / 1.15)}>Zoom −</button>
        <button type="button" onClick={fitGraph}>Fit</button>
        <button
          type="button"
          onClick={activateSelectedDrafts}
          disabled={immutable || !composition.nodes.some(node => metadata.selectedNodeIds.includes(node.id) && !node.enabled && node.id !== composition.outputNodeId)}
        >Activate drafts</button>
        <button type="button" onClick={deleteSelection} disabled={immutable || (metadata.selectedNodeIds.length === 0 && !selectedConnectionId)}>Delete</button>
        <span className="rv-cinema-graph-editor__zoom">{Math.round(viewport.zoom * 100)}%</span>
      </div>

      {immutable && <NoticeCard tone="info" role="status" title="Reference graph">Built-in Cinema compositions are inspectable here but remain immutable. Duplicate one to edit its graph.</NoticeCard>}
      {message && <NoticeCard tone="info" role="status">{message}</NoticeCard>}
      {validation.diagnostics.diagnostics.length > 0 && (
        <NoticeCard
          tone="warning"
          role="status"
          ariaLabel="Cinema graph diagnostics"
          title={`${validation.diagnostics.counts.error + validation.diagnostics.counts.fatal} errors · ${validation.diagnostics.counts.warning} warnings`}
        >
          {validation.diagnostics.diagnostics[0]?.message}
        </NoticeCard>
      )}

      <div
        ref={surfaceRef}
        className="rv-cinema-graph-editor__surface"
        tabIndex={0}
        aria-label="Cinema freeform graph canvas. Drag empty space to pan, drag node headers to arrange, and use Delete to remove selected items."
        onKeyDown={onKeyDown}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onWheel={onWheel}
      >
        <svg className="rv-cinema-graph-editor__connections" width="100%" height="100%" aria-hidden="true">
          {composition.connections.filter(connection => visibleNodeIds.has(String(connection.from.nodeId)) && visibleNodeIds.has(String(connection.to.nodeId))).map(connection => {
            const fromNode = nodeById.get(String(connection.from.nodeId))
            const toNode = nodeById.get(String(connection.to.nodeId))
            if (!fromNode || !toNode) return null
            const fromDefinition = definitionByType.get(String(fromNode.typeId))
            const toDefinition = definitionByType.get(String(toNode.typeId))
            const fromPortIndex = fromDefinition?.definition.outputPorts.findIndex(port => port.id === connection.from.portId) ?? 0
            const toPortIndex = toDefinition?.definition.inputPorts.findIndex(port => port.id === connection.to.portId) ?? 0
            const fromPosition = positions[String(fromNode.id)]
            const toPosition = positions[String(toNode.id)]
            const x1 = viewport.x + (fromPosition.x + NODE_WIDTH) * viewport.zoom
            const y1 = viewport.y + (fromPosition.y + NODE_HEADER_HEIGHT + 16 + Math.max(0, fromPortIndex) * PORT_ROW_HEIGHT) * viewport.zoom
            const x2 = viewport.x + toPosition.x * viewport.zoom
            const y2 = viewport.y + (toPosition.y + NODE_HEADER_HEIGHT + 16 + Math.max(0, toPortIndex) * PORT_ROW_HEIGHT) * viewport.zoom
            const bend = Math.max(45, Math.abs(x2 - x1) * 0.45)
            const diagnostics = getCinemaGraphDiagnosticsForConnection(validation.diagnostics, connection.id)
            return (
              <path
                key={connection.id}
                d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                className={`${selectedConnectionId === connection.id ? 'is-selected ' : ''}${!connection.enabled ? 'is-disabled ' : ''}${diagnostics.length > 0 ? 'has-diagnostic' : ''}`.trim()}
                onPointerDown={event => {
                  event.stopPropagation()
                  useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, metadata.selectedNodeIds, connection.id)
                }}
              />
            )
          })}
        </svg>

        <div className="rv-cinema-graph-editor__world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
          {visibleNodes.map(node => {
            const position = positions[String(node.id)]
            const ports = getCinemaGraphNodePorts(node, definitions)
            const diagnostics = getCinemaGraphDiagnosticsForNode(validation.diagnostics, node.id)
            const selected = selectedNodeIds.has(String(node.id))
            return (
              <article
                key={node.id}
                className={`rv-cinema-graph-node${selected ? ' is-selected' : ''}${!node.enabled ? ' is-disabled' : ''}${diagnostics.length > 0 ? ' has-diagnostic' : ''}`}
                style={{ transform: `translate(${position.x}px, ${position.y}px)`, width: NODE_WIDTH }}
                aria-label={`${node.label ?? node.typeId} graph node`}
                aria-selected={selected}
                onPointerDown={event => {
                  event.stopPropagation()
                  selectNode(node.id, event.shiftKey || event.metaKey || event.ctrlKey)
                }}
              >
                <div
                  className="rv-cinema-graph-node__header"
                  onPointerDown={event => beginNodeDrag(event, node.id)}
                  onPointerMove={moveNodeDrag}
                  onPointerUp={finishNodeDrag}
                  onPointerCancel={finishNodeDrag}
                >
                  <div><strong>{node.label ?? node.typeId}</strong><span>{node.family} · {node.enabled ? 'enabled' : 'disabled draft'}</span></div>
                  {node.id === composition.outputNodeId && <span className="rv-cinema-graph-node__badge">Output</span>}
                </div>
                <div className="rv-cinema-graph-node__ports">
                  <div>
                    {ports.inputs.map(port => (
                      <button
                        type="button"
                        key={port.id}
                        className="rv-cinema-graph-port rv-cinema-graph-port--input"
                        title={`Input ${port.label}: ${port.dataType}`}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={() => selectPort(node.id, port.id, 'input')}
                      ><i aria-hidden="true" /><span>{port.label}</span><small>{port.dataType}</small></button>
                    ))}
                  </div>
                  <div>
                    {ports.outputs.map(port => (
                      <button
                        type="button"
                        key={port.id}
                        className={`rv-cinema-graph-port rv-cinema-graph-port--output${connectionDraft?.nodeId === node.id && connectionDraft.portId === port.id ? ' is-armed' : ''}`}
                        title={`Output ${port.label}: ${port.dataType}`}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={() => selectPort(node.id, port.id, 'output')}
                      ><small>{port.dataType}</small><span>{port.label}</span><i aria-hidden="true" /></button>
                    ))}
                  </div>
                </div>
                {diagnostics.length > 0 && <div className="rv-cinema-graph-node__diagnostic" title={diagnostics.map(diagnostic => diagnostic.message).join('\n')}>⚠ {diagnostics.length}</div>}
              </article>
            )
          })}
        </div>

        {composition.nodes.length > visibleNodes.length && (
          <div className="rv-cinema-graph-editor__bounded-note" role="status">
            Rendering {visibleNodes.length} of {composition.nodes.length} nodes in/near the viewport. Pan or Fit to reveal others.
          </div>
        )}
      </div>

      <details className="rv-cinema-graph-accessible">
        <summary>Accessible graph controls</summary>
        <p>These controls edit the same canonical graph without drag gestures.</p>
        <div className="rv-cinema-graph-accessible__connect">
          <label><span>Output port</span><DropdownSelect value={accessibleFrom} onChange={event => setAccessibleFrom(event.target.value)}><option value="">Choose output…</option>{endpointOptions.filter(option => option.direction === 'output').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
          <label><span>Input port</span><DropdownSelect value={accessibleTo} onChange={event => setAccessibleTo(event.target.value)}><option value="">Choose input…</option>{endpointOptions.filter(option => option.direction === 'input').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
          <button type="button" onClick={accessibleConnect} disabled={immutable || !accessibleFrom || !accessibleTo}>Connect</button>
        </div>
        <div className="rv-cinema-graph-accessible__list" role="list" aria-label="Cinema graph nodes">
          {composition.nodes.map(node => (
            <button key={node.id} type="button" role="listitem" aria-pressed={selectedNodeIds.has(String(node.id))} onClick={() => selectNode(node.id, false)}>
              <strong>{node.label ?? node.typeId}</strong><span>{node.family} · {getCinemaGraphNodePorts(node, definitions).inputs.length} inputs · {getCinemaGraphNodePorts(node, definitions).outputs.length} outputs</span>
            </button>
          ))}
        </div>
        <div className="rv-cinema-graph-accessible__list" role="list" aria-label="Cinema graph connections">
          {composition.connections.map(connection => (
            <button key={connection.id} type="button" role="listitem" aria-pressed={selectedConnectionId === connection.id} onClick={() => useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, metadata.selectedNodeIds, connection.id)}>
              <strong>{connection.id}</strong><span>{connection.from.nodeId}:{connection.from.portId} → {connection.to.nodeId}:{connection.to.portId}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

function CinemaGraphStructuredFallback({ composition, definitions }: CinemaAdvancedGraphEditorProps) {
  const editorMetadata = useCinemaStore(store => store.editorMetadata)
  const metadata = getCinemaGraphEditorCompositionMetadata(editorMetadata, composition.id)
  const immutable = isCinemaBuiltInComposition(composition)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('The visual graph surface could not initialize. Structured graph controls remain available.')
  const registry = useMemo(() => createCinemaDefinitionRegistryFromPersistedDefinitions(definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY).registry, [definitions])
  const endpoints = composition.nodes.flatMap(node => {
    const ports = getCinemaGraphNodePorts(node, definitions)
    return {
      outputs: ports.outputs.map(port => ({ value: endpointValue(node.id, port.id), label: `${node.label ?? node.typeId} → ${port.label}` })),
      inputs: ports.inputs.map(port => ({ value: endpointValue(node.id, port.id), label: `${node.label ?? node.typeId} ← ${port.label}` })),
    }
  })
  const outputs = endpoints.flatMap(endpoint => endpoint.outputs)
  const inputs = endpoints.flatMap(endpoint => endpoint.inputs)
  const connectFallback = () => {
    const source = parseEndpoint(from)
    const target = parseEndpoint(to)
    if (!source || !target) return
    const result = useCinemaStore.getState().editCinemaComposition(composition.id, 'Connect Cinema graph nodes', current => ({
      composition: connectCinemaGraphNodes(current, { fromNodeId: source.nodeId, fromPortId: source.portId, toNodeId: target.nodeId, toPortId: target.portId }, definitions, registry, { replaceExistingInput: true }),
      selectedNodeId: target.nodeId,
    }))
    setMessage(result.ok ? 'Connection added.' : firstDiagnostic(result.diagnostics.diagnostics, 'Connection could not be added.'))
  }
  return (
    <div className="rv-cinema-graph-fallback" role="region" aria-label="Cinema structured graph fallback">
      <NoticeCard tone="error" role="alert" title="Graph surface unavailable">{message}</NoticeCard>
      <div className="rv-cinema-graph-accessible__connect">
        <label><span>Output port</span><DropdownSelect value={from} onChange={event => setFrom(event.target.value)}>{<option value="">Choose output…</option>}{outputs.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
        <label><span>Input port</span><DropdownSelect value={to} onChange={event => setTo(event.target.value)}>{<option value="">Choose input…</option>}{inputs.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
        <button type="button" onClick={connectFallback} disabled={immutable || !from || !to}>Connect</button>
      </div>
      {composition.nodes.map(node => (
        <div className="rv-cinema-graph-fallback__node" key={node.id}>
          <button type="button" aria-pressed={metadata.selectedNodeIds.includes(node.id)} onClick={() => useCinemaStore.getState().setCinemaGraphEditorSelection(composition.id, [node.id], null)}>{node.label ?? node.typeId}</button>
          <span>{node.family}</span>
        </div>
      ))}
    </div>
  )
}

class CinemaGraphEditorErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The fallback is intentionally local. Canonical Cinema state is never replaced on a UI failure.
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function nodeHeight(node: CinemaCompositionDefinition['nodes'][number], definition: CinemaPersistedDefinition | undefined): number {
  const portRows = Math.max(definition?.definition.inputPorts.length ?? 0, definition?.definition.outputPorts.length ?? 0, 1)
  return NODE_HEADER_HEIGHT + 30 + portRows * PORT_ROW_HEIGHT
}

function endpointValue(nodeId: CinemaNodeId, portId: CinemaPortId): string {
  return `${nodeId}\u001f${portId}`
}

function parseEndpoint(value: string): GraphEndpointDraft | null {
  const [nodeId, portId] = value.split('\u001f')
  return nodeId && portId ? { nodeId: nodeId as CinemaNodeId, portId: portId as CinemaPortId } : null
}

function firstDiagnostic(diagnostics: readonly Pick<CinemaDiagnostic, 'message'>[], fallback: string): string {
  return diagnostics[0]?.message ?? fallback
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}
