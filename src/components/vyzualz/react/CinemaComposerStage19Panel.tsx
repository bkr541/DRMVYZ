import { type ReactNode, useMemo, useState } from 'react'
import {
  CINEMA_COMPOSER_MUSICAL_DIVISIONS,
  CINEMA_COMPOSER_PERFORMANCE_EVENTS,
  CINEMA_MODULATION_SOURCE_CATALOG,
  addCinemaComposerCameraShot,
  addCinemaComposerPerformanceAction,
  buildCinemaComposerDestinations,
  buildCinemaComposerTimelineModel,
  cinemaStableId,
  createCinemaCameraParameterSchemas,
  createCinemaComposerCamera,
  createCinemaComposerModulationRoute,
  createCinemaComposerPerformanceRule,
  getCinemaComposerCameraAssignedNodeIds,
  isCinemaCameraCapabilityCompatible,
  removeCinemaComposerCamera,
  removeCinemaComposerCameraShot,
  removeCinemaComposerModulationRoute,
  removeCinemaComposerPerformanceAction,
  removeCinemaComposerPerformanceRule,
  setCinemaComposerCameraNodeAssignment,
  setCinemaComposerCameraParameter,
  sourceDisabledReason,
  updateCinemaComposerCamera,
  updateCinemaComposerCameraShot,
  updateCinemaComposerModulationRoute,
  updateCinemaComposerPerformanceAction,
  updateCinemaComposerPerformanceRule,
  useCinemaStore,
  type CinemaActionId,
  type CinemaCameraId,
  type CinemaCameraMode,
  type CinemaCompositionDefinition,
  type CinemaControlDescriptor,
  type CinemaModulationMode,
  type CinemaControlPointId,
  type CinemaModulationSourceId,
  type CinemaNodeId,
  type CinemaParameterPath,
  type CinemaParameterValue,
  type CinemaPerformanceAction,
  type CinemaPerformanceEventCondition,
  type CinemaPerformanceRuleId,
  type CinemaPersistedDefinition,
} from '../cinema'
import type { CinemaWorkspaceFrameBridgeResult } from './CinemaWorkspaceFrameBridge'
import { Collapsible, NumberInputRow, SelectRow, TextInputRow, ToggleRow } from './ReactControlRows'

const CAMERA_MODES: readonly CinemaCameraMode[] = ['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path', 'auto-director']
const MODULATION_MODES: readonly CinemaModulationMode[] = ['add', 'multiply', 'replace', 'trigger']
const ACTION_TYPES: readonly CinemaPerformanceAction['type'][] = [
  'set-parameter', 'trigger-parameter', 'set-node-enabled', 'set-effect-enabled', 'select-camera',
  'resetNodeState', 'resetFeedback', 'reseedSimulation', 'clearTrailHistory', 'emit-event',
]

export function CinemaComposerStage19Panel({
  composition,
  definitions,
  frameBridge,
  edit,
  surface = 'all',
  readOnly = false,
}: {
  composition: Readonly<CinemaCompositionDefinition>
  definitions: readonly Readonly<CinemaPersistedDefinition>[]
  frameBridge: CinemaWorkspaceFrameBridgeResult | null
  edit: (label: string, editor: Parameters<ReturnType<typeof useCinemaStore.getState>['editCinemaComposition']>[2]) => void
  surface?: 'all' | 'routing' | 'performance' | 'camera' | 'timeline'
  readOnly?: boolean
}) {
  const destinations = useMemo(() => buildCinemaComposerDestinations(composition, definitions), [composition, definitions])
  const modulatableDestinations = destinations.filter(destination => destination.modulatable && destination.disabledReason == null)
  const performanceDestinations = destinations.filter(destination => destination.disabledReason == null)
  const numericPerformanceDestinations = performanceDestinations.filter(destination => destination.type === 'float' || destination.type === 'integer')
  const triggerPerformanceDestinations = performanceDestinations.filter(destination => destination.triggerable)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('')
  const [selectedRuleId, setSelectedRuleId] = useState<string>('')
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [actionType, setActionType] = useState<CinemaPerformanceAction['type']>('set-parameter')
  const activeRoute = composition.modulationRoutes.find(route => String(route.id) === selectedRouteId) ?? composition.modulationRoutes[0] ?? null
  const activeRule = composition.performanceRules.find(rule => String(rule.id) === selectedRuleId) ?? composition.performanceRules[0] ?? null
  const activeCamera = composition.cameras.find(camera => String(camera.id) === selectedCameraId) ?? composition.cameras[0] ?? null
  const runtimePreview = useCinemaStore(store => store.composerRuntimePreview)
  const timeline = useMemo(() => buildCinemaComposerTimelineModel(
    composition,
    frameBridge?.timeline ?? null,
    frameBridge?.frame.transport.audioTimeSec ?? 0,
  ), [composition, frameBridge])

  const addRoute = () => {
    const destination = modulatableDestinations[0]?.path
    if (!destination) return
    const result = createCinemaComposerModulationRoute(composition, { destination })
    const nextId = result.composition.modulationRoutes[result.composition.modulationRoutes.length - 1]?.id
    edit('Add Cinema modulation route', () => result)
    if (nextId) setSelectedRouteId(String(nextId))
  }
  const addRule = () => {
    const destination = numericPerformanceDestinations[0]?.path
    const result = createCinemaComposerPerformanceRule(composition, destination)
    const nextId = result.composition.performanceRules[result.composition.performanceRules.length - 1]?.id
    edit('Add Cinema performance rule', () => result)
    if (nextId) setSelectedRuleId(String(nextId))
  }
  const addPerformanceAction = () => {
    const destination = actionType === 'trigger-parameter'
      ? triggerPerformanceDestinations[0]?.path
      : actionType === 'set-parameter'
        ? numericPerformanceDestinations[0]?.path
        : undefined
    edit('Add Cinema performance action', current => addCinemaComposerPerformanceAction(current, activeRule!.id, actionType, destination))
  }
  const actionTypeDisabled = (type: CinemaPerformanceAction['type']) => (
    (type === 'select-camera' && composition.cameras.length === 0)
    || (type === 'set-parameter' && numericPerformanceDestinations.length === 0)
    || (type === 'trigger-parameter' && triggerPerformanceDestinations.length === 0)
  )
  const addCamera = () => {
    const result = createCinemaComposerCamera(composition)
    const nextId = result.composition.cameras[result.composition.cameras.length - 1]?.id
    edit('Add Cinema camera', () => result)
    if (nextId) setSelectedCameraId(String(nextId))
  }

  return (
    <div className="rv-cinema-stage19" aria-label="Cinema modulation performance camera and timeline authoring">
      {readOnly && <ComposerNotice>Preset structure is read-only in Cinema Engine. Author routes and performance rules in Show Manager.</ComposerNotice>}
      <fieldset className="rv-cinema-stage19__fieldset" disabled={readOnly}>
      {(surface === 'all' || surface === 'routing') && (
      <Collapsible label={`Modulation (${composition.modulationRoutes.length})`}>
        <div className="rv-cinema-stage19__toolbar">
          <SelectRow label="Route" value={activeRoute?.id ?? ''} onChange={setSelectedRouteId} options={composition.modulationRoutes.map((route, index) => ({ value: String(route.id), label: `Route ${index + 1} · ${shortSource(route.sourceId)}` }))} />
          <button type="button" onClick={addRoute} disabled={modulatableDestinations.length === 0} title={modulatableDestinations.length === 0 ? 'No compatible modulatable parameter destinations are available.' : undefined}>Add Route</button>
        </div>
        {!activeRoute ? <ComposerNotice>No modulation routes yet. Add one to map audio, musical, lyric, or state sources to schema-backed parameters.</ComposerNotice> : (
          <div className="rv-cinema-stage19__editor">
            <ToggleRow label="Enabled" value={activeRoute.enabled} onChange={enabled => edit('Toggle Cinema modulation route', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { enabled }))} />
            <SelectRow
              label="Source"
              value={String(activeRoute.sourceId)}
              onChange={value => edit('Change Cinema modulation source', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { sourceId: cinemaStableId<CinemaModulationSourceId>(value, 'modulation source') }))}
              options={CINEMA_MODULATION_SOURCE_CATALOG.map(source => ({ value: String(source.id), label: `${source.label} · ${source.kind}`, disabled: sourceDisabledReason(source, frameBridge?.frame ?? null) != null }))}
              description={CINEMA_MODULATION_SOURCE_CATALOG.find(source => source.id === activeRoute.sourceId) ? sourceDisabledReason(CINEMA_MODULATION_SOURCE_CATALOG.find(source => source.id === activeRoute.sourceId)!, frameBridge?.frame ?? null) ?? undefined : 'Unknown modulation source.'}
            />
            <SelectRow label="Destination" value={String(activeRoute.destination)} onChange={value => edit('Change Cinema modulation destination', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { destination: value as CinemaParameterPath }))} options={modulatableDestinations.map(destination => ({ value: String(destination.path), label: `${destination.label} · ${destination.path}` }))} />
            <SelectRow label="Operation" value={activeRoute.mode} onChange={mode => edit('Change Cinema modulation operation', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { mode: mode as CinemaModulationMode }))} options={MODULATION_MODES.map(mode => ({ value: mode, label: capitalize(mode) }))} />
            <NumberInputRow label="Amount" value={activeRoute.amount} step={0.01} onChange={amount => edit('Edit Cinema modulation amount', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { amount }))} />
            <NumberInputRow label="Offset" value={activeRoute.offset ?? 0} step={0.01} onChange={offset => edit('Edit Cinema modulation offset', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { offset }))} />
            <RangeEditor label="Input range" value={activeRoute.inputRange ?? [0, 1]} onChange={inputRange => edit('Edit Cinema modulation input range', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { inputRange }))} />
            <RangeEditor label="Output range" value={activeRoute.outputRange ?? [0, 1]} onChange={outputRange => edit('Edit Cinema modulation output range', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { outputRange }))} />
            <NumberInputRow label="Attack" value={activeRoute.attackMs ?? 0} min={0} step={1} unit="ms" onChange={attackMs => edit('Edit Cinema modulation attack', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { attackMs }))} />
            <NumberInputRow label="Release" value={activeRoute.releaseMs ?? 0} min={0} step={1} unit="ms" onChange={releaseMs => edit('Edit Cinema modulation release', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { releaseMs }))} />
            <NumberInputRow label="Smoothing" value={activeRoute.smoothing ?? 0} min={0} max={1} step={0.01} onChange={smoothing => edit('Edit Cinema modulation smoothing', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { smoothing }))} />
            <SelectRow label="Curve" value={curvePreset(activeRoute.curve)} onChange={preset => edit('Edit Cinema modulation curve', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { curve: curveForPreset(preset) }))} options={[{ value: 'linear', label: 'Linear' }, { value: 'ease-in', label: 'Ease In' }, { value: 'ease-out', label: 'Ease Out' }, { value: 's-curve', label: 'S-Curve' }]} />
            <SelectRow label="Musical division" value={activeRoute.quantization ?? 'none'} onChange={quantization => edit('Edit Cinema modulation musical division', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { quantization: quantization as typeof activeRoute.quantization }))} options={CINEMA_COMPOSER_MUSICAL_DIVISIONS.map(value => ({ value, label: musicalLabel(value) }))} description="Stored as a musical unit, not converted to milliseconds." />
            <ConditionEditor condition={activeRoute.condition ?? {}} onChange={condition => edit('Edit Cinema modulation condition', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { condition }))} />
            <RangeEditor label="Clamp" value={activeRoute.clamp ?? [0, 1]} onChange={clamp => edit('Edit Cinema modulation clamp', current => updateCinemaComposerModulationRoute(current, activeRoute.id, { clamp }))} />
            <div className="rv-cinema-stage19__actions">
              <button type="button" disabled={!activeRoute.enabled} aria-pressed={runtimePreview.modulationRouteId === activeRoute.id} onClick={() => useCinemaStore.getState().setCinemaComposerModulationPreview(composition.id, runtimePreview.modulationRouteId === activeRoute.id ? null : activeRoute.id)}>Test Route</button>
              <button type="button" onClick={() => edit('Remove Cinema modulation route', current => removeCinemaComposerModulationRoute(current, activeRoute.id))}>Remove Route</button>
            </div>
            <small className="rv-cinema-stage19__hint">Route testing is runtime-only. The saved parameter baseline and undo history are not overwritten.</small>
          </div>
        )}
      </Collapsible>
      )}

      {(surface === 'all' || surface === 'performance') && (
      <Collapsible label={`Performance (${composition.performanceRules.length})`} defaultOpen={false}>
        <div className="rv-cinema-stage19__toolbar">
          <SelectRow label="Rule" value={activeRule?.id ?? ''} onChange={setSelectedRuleId} options={composition.performanceRules.map(rule => ({ value: String(rule.id), label: rule.label }))} />
          <button type="button" onClick={addRule}>Add Rule</button>
        </div>
        {!activeRule ? <ComposerNotice>No performance rules yet. Add one for section, drop, lyric, phrase, or manual choreography.</ComposerNotice> : (
          <div className="rv-cinema-stage19__editor">
            <TextInputRow label="Label" value={activeRule.label} onChange={label => edit('Rename Cinema performance rule', current => updateCinemaComposerPerformanceRule(current, activeRule.id, { label }))} />
            <ToggleRow label="Enabled" value={activeRule.enabled} onChange={enabled => edit('Toggle Cinema performance rule', current => updateCinemaComposerPerformanceRule(current, activeRule.id, { enabled }))} />
            <NumberInputRow label="Priority" value={activeRule.priority} step={1} onChange={priority => edit('Edit Cinema performance priority', current => updateCinemaComposerPerformanceRule(current, activeRule.id, { priority }))} />
            <SelectRow label="Event" value={String(activeRule.condition.event ?? '')} onChange={event => edit('Edit Cinema performance condition', current => updateCinemaComposerPerformanceRule(current, activeRule.id, { condition: withRuleEvent(activeRule.id, activeRule.condition, event as CinemaPerformanceEventCondition) }))} options={[{ value: '', label: 'Continuous condition' }, ...CINEMA_COMPOSER_PERFORMANCE_EVENTS.map(event => ({ value: event, label: performanceEventLabel(event) }))]} />
            <PerformanceConditionEditor ruleId={activeRule.id} condition={activeRule.condition} onChange={condition => edit('Edit Cinema performance condition', current => updateCinemaComposerPerformanceRule(current, activeRule.id, { condition }))} />
            {activeRule.condition.event === 'manual' && (
              <div className="rv-cinema-stage19__manual">
                <span>Manual trigger</span>
                <button type="button" disabled={!activeRule.enabled || !activeRule.condition.manualActionIds?.[0]} onClick={() => {
                  const actionId = activeRule.condition.manualActionIds?.[0]
                  if (actionId) useCinemaStore.getState().triggerCinemaComposerManualAction(composition.id, actionId)
                }}>Trigger Preview</button>
                <small>{activeRule.condition.manualActionIds?.[0] ?? 'No manual action ID'}</small>
              </div>
            )}
            <div className="rv-cinema-stage19__subheading">Actions</div>
            {activeRule.actions.map(action => <PerformanceActionEditor key={action.id} action={action} composition={composition} destinations={performanceDestinations} onChange={next => edit('Edit Cinema performance action', current => updateCinemaComposerPerformanceAction(current, activeRule.id, action.id, next))} onRemove={() => edit('Remove Cinema performance action', current => removeCinemaComposerPerformanceAction(current, activeRule.id, action.id))} />)}
            <div className="rv-cinema-stage19__toolbar">
              <SelectRow label="New action" value={actionType} onChange={value => setActionType(value as CinemaPerformanceAction['type'])} options={ACTION_TYPES.map(type => ({ value: type, label: performanceActionLabel(type), disabled: actionTypeDisabled(type) }))} />
              <button type="button" disabled={actionTypeDisabled(actionType)} onClick={addPerformanceAction}>Add Action</button>
            </div>
            <button type="button" onClick={() => edit('Remove Cinema performance rule', current => removeCinemaComposerPerformanceRule(current, activeRule.id))}>Remove Rule</button>
          </div>
        )}
      </Collapsible>
      )}

      {(surface === 'all' || surface === 'camera') && (
      <Collapsible label={`Camera (${composition.cameras.length})`} defaultOpen={false}>
        <div className="rv-cinema-stage19__toolbar">
          <SelectRow label="Camera" value={activeCamera?.id ?? ''} onChange={setSelectedCameraId} options={composition.cameras.map(camera => ({ value: String(camera.id), label: camera.label }))} />
          <button type="button" onClick={addCamera}>Add Camera</button>
        </div>
        {!activeCamera ? <ComposerNotice>No Cinema camera resources are authored. Camera controls remain disabled until a resource is added.</ComposerNotice> : (
          <div className="rv-cinema-stage19__editor">
            <TextInputRow label="Label" value={activeCamera.label} onChange={label => edit('Rename Cinema camera', current => updateCinemaComposerCamera(current, activeCamera.id, { label }))} />
            <SelectRow label="Mode" value={activeCamera.mode} onChange={mode => edit('Change Cinema camera mode', current => updateCinemaComposerCamera(current, activeCamera.id, { mode: mode as CinemaCameraMode }))} options={CAMERA_MODES.map(mode => ({ value: mode, label: cameraModeLabel(mode), disabled: mode === 'auto-director' && (activeCamera.authoredShots?.length ?? 0) === 0 }))} description={activeCamera.mode === 'auto-director' && (activeCamera.authoredShots?.length ?? 0) === 0 ? 'Auto Director requires at least one authored shot.' : undefined} />
            <div className="rv-cinema-stage19__subheading">Transform</div>
            {createCinemaCameraParameterSchemas(activeCamera).slice(0, 7).map(schema => <CameraParameterEditor key={schema.id} cameraId={activeCamera.id} schema={schema} value={activeCamera.parameterValues[schema.id]} onChange={value => edit('Edit Cinema camera transform', current => setCinemaComposerCameraParameter(current, activeCamera.id, schema.id, value))} />)}
            <div className="rv-cinema-stage19__subheading">Safe range</div>
            <RangeVectorEditor label="Position min" value={activeCamera.safeRange?.minPosition ?? [-20, -20, 0.05]} onChange={minPosition => edit('Edit Cinema camera safe range', current => updateCinemaComposerCamera(current, activeCamera.id, { safeRange: { ...(activeCamera.safeRange ?? defaultSafeRange()), minPosition } }))} />
            <RangeVectorEditor label="Position max" value={activeCamera.safeRange?.maxPosition ?? [20, 20, 100]} onChange={maxPosition => edit('Edit Cinema camera safe range', current => updateCinemaComposerCamera(current, activeCamera.id, { safeRange: { ...(activeCamera.safeRange ?? defaultSafeRange()), maxPosition } }))} />
            <NumberInputRow label="Minimum FOV" value={activeCamera.safeRange?.minFovDegrees ?? 10} min={1} max={179} onChange={minFovDegrees => edit('Edit Cinema camera safe range', current => updateCinemaComposerCamera(current, activeCamera.id, { safeRange: { ...(activeCamera.safeRange ?? defaultSafeRange()), minFovDegrees } }))} />
            <NumberInputRow label="Maximum FOV" value={activeCamera.safeRange?.maxFovDegrees ?? 140} min={1} max={179} onChange={maxFovDegrees => edit('Edit Cinema camera safe range', current => updateCinemaComposerCamera(current, activeCamera.id, { safeRange: { ...(activeCamera.safeRange ?? defaultSafeRange()), maxFovDegrees } }))} />
            <div className="rv-cinema-stage19__subheading">Authored shots &amp; Auto Director</div>
            {(activeCamera.authoredShots ?? []).map(shot => (
              <div className="rv-cinema-stage19__card" key={shot.id}>
                <TextInputRow label="Shot label" value={shot.label ?? ''} onChange={label => edit('Rename Cinema camera shot', current => updateCinemaComposerCameraShot(current, activeCamera.id, shot.id, { label }))} />
                <SelectRow label="Shot mode" value={shot.mode} onChange={mode => edit('Edit Cinema camera shot', current => updateCinemaComposerCameraShot(current, activeCamera.id, shot.id, { mode: mode as Exclude<CinemaCameraMode, 'auto-director'> }))} options={CAMERA_MODES.filter(mode => mode !== 'auto-director').map(mode => ({ value: mode, label: cameraModeLabel(mode) }))} />
                <TextInputRow label="Sections" value={(shot.sections ?? []).join(', ')} onChange={value => edit('Edit Cinema camera shot sections', current => updateCinemaComposerCameraShot(current, activeCamera.id, shot.id, { sections: csv(value) }))} description="Comma-separated authoritative section types." />
                <NumberInputRow label="Weight" value={shot.weight ?? 1} min={0.001} step={0.1} onChange={weight => edit('Edit Cinema camera shot weight', current => updateCinemaComposerCameraShot(current, activeCamera.id, shot.id, { weight }))} />
                <NumberInputRow label="Minimum duration" value={shot.minimumDurationSec ?? 1} min={0} step={0.25} unit="s" onChange={minimumDurationSec => edit('Edit Cinema camera shot duration', current => updateCinemaComposerCameraShot(current, activeCamera.id, shot.id, { minimumDurationSec }))} />
                <button type="button" onClick={() => edit('Remove Cinema camera shot', current => removeCinemaComposerCameraShot(current, activeCamera.id, shot.id))}>Remove Shot</button>
              </div>
            ))}
            <button type="button" onClick={() => edit('Add Cinema camera shot', current => addCinemaComposerCameraShot(current, activeCamera.id))}>Add Shot From Current Transform</button>
            <div className="rv-cinema-stage19__subheading">Compatible node assignment</div>
            {composition.nodes.map(node => {
              const definition = definitions.find(candidate => candidate.id === node.typeId)?.definition
              const capability = definition?.capabilities.camera.mode ?? 'none'
              const compatible = isCinemaCameraCapabilityCompatible(capability)
              const explicit = getCinemaComposerCameraAssignedNodeIds(activeCamera)
              const compatibleIds = composition.nodes.filter(candidate => {
                const candidateMode = definitions.find(definitionCandidate => definitionCandidate.id === candidate.typeId)?.definition.capabilities.camera.mode ?? 'none'
                return isCinemaCameraCapabilityCompatible(candidateMode)
              }).map(candidate => candidate.id)
              const assigned = compatible && (explicit == null || explicit.includes(node.id))
              return <ToggleRow key={node.id} label={node.label ?? definition?.label ?? String(node.id)} value={assigned} disabled={!compatible} description={!definition ? 'Node definition is unavailable.' : !compatible ? `This node declares camera capability “${capability}” and cannot receive a Cinema camera.` : `Camera capability: ${capability}`} onChange={value => edit('Assign Cinema camera to node', current => setCinemaComposerCameraNodeAssignment(current, activeCamera.id, node.id, value, compatibleIds))} />
            })}
            <button type="button" onClick={() => edit('Remove Cinema camera', current => removeCinemaComposerCamera(current, activeCamera.id))}>Remove Camera</button>
          </div>
        )}
      </Collapsible>
      )}

      {(surface === 'all' || surface === 'timeline') && (
      <Collapsible label="Timeline" defaultOpen={false}>
        {!timeline.available ? <ComposerNotice>{timeline.disabledReason}</ComposerNotice> : <CinemaTimeline model={timeline} />}
      </Collapsible>
      )}
      </fieldset>
    </div>
  )
}

function PerformanceActionEditor({
  action,
  composition,
  destinations,
  onChange,
  onRemove,
}: {
  action: Readonly<CinemaPerformanceAction>
  composition: Readonly<CinemaCompositionDefinition>
  destinations: readonly { path: CinemaParameterPath; label: string; type: CinemaControlDescriptor['type'] }[]
  onChange: (action: CinemaPerformanceAction) => void
  onRemove: () => void
}) {
  const nodeOptions = composition.nodes.map(node => ({ value: String(node.id), label: node.label ?? String(node.id) }))
  const actionDestinations = action.type === 'trigger-parameter'
    ? destinations.filter(destination => destination.type === 'trigger')
    : destinations.filter(destination => destination.type === 'float' || destination.type === 'integer')
  return (
    <div className="rv-cinema-stage19__card">
      <strong>{performanceActionLabel(action.type)}</strong>
      {(action.type === 'set-parameter' || action.type === 'trigger-parameter') && <SelectRow label="Destination" value={String(action.destination)} onChange={destination => onChange({ ...action, destination: destination as CinemaParameterPath })} options={actionDestinations.map(candidate => ({ value: String(candidate.path), label: `${candidate.label} · ${candidate.path}` }))} />}
      {action.type === 'set-parameter' && <NumberInputRow label="Value" value={typeof action.value === 'number' ? action.value : 0} step={0.01} onChange={value => onChange({ ...action, value })} />}
      {(action.type === 'set-node-enabled' || action.type === 'set-effect-enabled') && <><SelectRow label="Node" value={String(action.nodeId)} onChange={nodeId => onChange({ ...action, nodeId: cinemaStableId<CinemaNodeId>(nodeId, 'node') })} options={nodeOptions} /><ToggleRow label="Enabled state" value={action.enabled} onChange={enabled => onChange({ ...action, enabled })} /></>}
      {(action.type === 'resetNodeState' || action.type === 'resetFeedback' || action.type === 'reseedSimulation' || action.type === 'clearTrailHistory') && <SelectRow label="Node" value={String(action.nodeId)} onChange={nodeId => onChange({ ...action, nodeId: cinemaStableId<CinemaNodeId>(nodeId, 'node') })} options={nodeOptions} />}
      {action.type === 'select-camera' && <SelectRow label="Camera" value={String(action.cameraId)} onChange={cameraId => onChange({ ...action, cameraId: cinemaStableId<CinemaCameraId>(cameraId, 'camera') })} options={composition.cameras.map(camera => ({ value: String(camera.id), label: camera.label }))} />}
      {'duration' in action && action.duration && <div className="rv-cinema-stage19__duration"><NumberInputRow label="Duration" value={action.duration.value} min={0} step={0.25} onChange={value => onChange({ ...action, duration: { ...action.duration!, value } } as CinemaPerformanceAction)} /><SelectRow label="Duration unit" value={action.duration.unit} onChange={unit => onChange({ ...action, duration: { ...action.duration!, unit: unit as 'beats' | 'bars' } } as CinemaPerformanceAction)} options={[{ value: 'beats', label: 'Beats' }, { value: 'bars', label: 'Bars' }]} /></div>}
      {action.type === 'emit-event' && <TextInputRow label="Event ID" value={String(action.eventId)} onChange={eventId => onChange({ ...action, eventId: cinemaStableId(eventId, 'event') })} />}
      <button type="button" onClick={onRemove}>Remove Action</button>
    </div>
  )
}

function PerformanceConditionEditor({ condition, onChange }: { ruleId: CinemaPerformanceRuleId; condition: Readonly<CinemaCompositionDefinition['performanceRules'][number]['condition']>; onChange: (condition: CinemaCompositionDefinition['performanceRules'][number]['condition']) => void }) {
  return (
    <div className="rv-cinema-stage19__conditions">
      <TextInputRow label="Section types" value={(condition.sectionTypes ?? []).join(', ')} onChange={value => onChange({ ...condition, sectionTypes: csv(value) })} />
      <NumberInputRow label="Minimum energy" value={condition.minimumEnergy ?? 0} min={0} max={1} step={0.01} onChange={minimumEnergy => onChange({ ...condition, minimumEnergy })} />
      <NumberInputRow label="Maximum energy" value={condition.maximumEnergy ?? 1} min={0} max={1} step={0.01} onChange={maximumEnergy => onChange({ ...condition, maximumEnergy })} />
      <TriState label="Vocals" value={condition.vocalsActive} onChange={vocalsActive => onChange({ ...condition, vocalsActive })} />
      <TriState label="Build" value={condition.buildActive} onChange={buildActive => onChange({ ...condition, buildActive })} />
      <TriState label="Drop" value={condition.dropActive} onChange={dropActive => onChange({ ...condition, dropActive })} />
      <TriState label="Playing" value={condition.playing} onChange={playing => onChange({ ...condition, playing })} />
    </div>
  )
}

function ConditionEditor({ condition, onChange }: { condition: Readonly<CinemaCompositionDefinition['modulationRoutes'][number]['condition']> & {}; onChange: (condition: NonNullable<CinemaCompositionDefinition['modulationRoutes'][number]['condition']>) => void }) {
  return <div className="rv-cinema-stage19__conditions"><TextInputRow label="Section types" value={(condition.sectionTypes ?? []).join(', ')} onChange={value => onChange({ ...condition, sectionTypes: csv(value) })} /><TriState label="Vocals" value={condition.vocalsActive} onChange={vocalsActive => onChange({ ...condition, vocalsActive })} /><TriState label="Build" value={condition.buildActive} onChange={buildActive => onChange({ ...condition, buildActive })} /><TriState label="Drop" value={condition.dropActive} onChange={dropActive => onChange({ ...condition, dropActive })} /><TriState label="Playing" value={condition.playing} onChange={playing => onChange({ ...condition, playing })} /></div>
}

function TriState({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (value: boolean | undefined) => void }) {
  return <SelectRow label={label} value={value === undefined ? 'any' : value ? 'true' : 'false'} onChange={next => onChange(next === 'any' ? undefined : next === 'true')} options={[{ value: 'any', label: 'Any' }, { value: 'true', label: 'Required' }, { value: 'false', label: 'Must be inactive' }]} />
}

function CameraParameterEditor({ cameraId: _cameraId, schema, value, onChange }: { cameraId: CinemaCameraId; schema: ReturnType<typeof createCinemaCameraParameterSchemas>[number]; value: CinemaParameterValue | undefined; onChange: (value: CinemaParameterValue) => void }) {
  if (schema.type === 'float') return <NumberInputRow label={schema.label} value={typeof value === 'number' ? value : schema.default} min={schema.min} max={schema.max} step={schema.step ?? 0.01} unit={schema.unit} onChange={onChange} />
  if (schema.type === 'vector3') return <RangeVectorEditor label={schema.label} value={Array.isArray(value) && value.length === 3 ? value as unknown as readonly [number, number, number] : schema.default as readonly [number, number, number]} onChange={onChange} />
  return null
}

function RangeEditor({ label, value, onChange }: { label: string; value: readonly [number, number]; onChange: (value: readonly [number, number]) => void }) {
  return <div className="rv-cinema-stage19__range"><span>{label}</span><NumberInputRow label="Min" value={value[0]} step={0.01} onChange={minimum => onChange([minimum, value[1]])} /><NumberInputRow label="Max" value={value[1]} step={0.01} onChange={maximum => onChange([value[0], maximum])} /></div>
}

function RangeVectorEditor({ label, value, onChange }: { label: string; value: readonly [number, number, number]; onChange: (value: readonly [number, number, number]) => void }) {
  return <div className="rv-cinema-stage19__range rv-cinema-stage19__range--vector"><span>{label}</span>{value.map((axis, index) => <NumberInputRow key={index} label={['X', 'Y', 'Z'][index]} value={Number(axis)} step={0.01} onChange={next => { const clone = [...value] as [number, number, number]; clone[index] = next; onChange(clone) }} />)}</div>
}

function CinemaTimeline({ model }: { model: ReturnType<typeof buildCinemaComposerTimelineModel> }) {
  const percent = (timeSec: number) => `${Math.max(0, Math.min(100, timeSec / Math.max(0.001, model.durationSec) * 100))}%`
  const grouped = ['section', 'lyric', 'beat', 'bar', 'phrase', 'modulation', 'performance'] as const
  return (
    <div className="rv-cinema-timeline" data-cinema-timeline="authoritative">
      <div className="rv-cinema-timeline__summary"><strong>{formatTime(model.playheadSec)}</strong><span>{formatTime(model.durationSec)}</span></div>
      <div className="rv-cinema-timeline__viewport">
        <div className="rv-cinema-timeline__playhead" style={{ left: percent(model.playheadSec) }} aria-label={`Current playhead ${formatTime(model.playheadSec)}`} />
        {grouped.map(kind => <div className={`rv-cinema-timeline__lane rv-cinema-timeline__lane--${kind}`} key={kind}><span className="rv-cinema-timeline__lane-label">{capitalize(kind)}</span><div className="rv-cinema-timeline__lane-track">{model.markers.filter(marker => marker.kind === kind).slice(0, kind === 'beat' ? 512 : 256).map(marker => {
          const width = marker.endSec == null ? undefined : `${Math.max(0.15, (marker.endSec - marker.timeSec) / model.durationSec * 100)}%`
          return <span key={marker.id} className="rv-cinema-timeline__marker" style={{ left: percent(marker.timeSec), width }} title={`${marker.label} · ${formatTime(marker.timeSec)}`}><i>{kind === 'section' || kind === 'lyric' ? marker.label : ''}</i></span>
        })}</div></div>)}
      </div>
      <small>Markers reference the normalized Cinema playhead, authoritative track sections/beat grid, runtime lyric cues, authored modulation divisions, and performance cues. No duplicate timeline store is created.</small>
    </div>
  )
}

function ComposerNotice({ children }: { children: ReactNode }) { return <div className="rv-cinema-composer__notice" role="note"><span>{children}</span></div> }
function csv(value: string): string[] { return value.split(',').map(item => item.trim()).filter(Boolean) }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1) }
function shortSource(value: string): string { const tail = value.split('.').slice(-1)[0]; return tail ? tail.split('-').join(' ') : value }
function musicalLabel(value: string): string { const text = value.split('-').join(' '); return value === 'none' ? 'Continuous' : capitalize(text) }
function performanceEventLabel(value: string): string { return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()) }
function performanceActionLabel(value: string): string { return capitalize(value.split('-').join(' ').replace(/([A-Z])/g, ' $1')) }
function cameraModeLabel(value: string): string { return capitalize(value.split('-').join(' ')) }
function curvePreset(curve: CinemaCompositionDefinition['modulationRoutes'][number]['curve']): string {
  const midpoint = curve?.find(point => point.position > 0.1 && point.position < 0.9)
  if (!midpoint) return 'linear'
  if (midpoint.value < midpoint.position - 0.1) return 'ease-in'
  if (midpoint.value > midpoint.position + 0.1) return 'ease-out'
  return 's-curve'
}
function curveForPreset(value: string): readonly { id: CinemaControlPointId; position: number; value: number; interpolation?: 'step' | 'linear' | 'smooth' }[] {
  const point = (id: string, position: number, curveValue: number, interpolation: 'step' | 'linear' | 'smooth' = 'smooth') => ({ id: cinemaStableId<CinemaControlPointId>(id, 'control point'), position, value: curveValue, interpolation })
  switch (value) {
    case 'ease-in': return [point('composer-curve-start', 0, 0), point('composer-curve-mid', 0.5, 0.2), point('composer-curve-end', 1, 1, 'linear')]
    case 'ease-out': return [point('composer-curve-start', 0, 0), point('composer-curve-mid', 0.5, 0.8), point('composer-curve-end', 1, 1, 'linear')]
    case 's-curve': return [point('composer-curve-start', 0, 0), point('composer-curve-quarter', 0.25, 0.1), point('composer-curve-three-quarter', 0.75, 0.9), point('composer-curve-end', 1, 1, 'linear')]
    default: return [point('composer-curve-start', 0, 0), point('composer-curve-end', 1, 1, 'linear')]
  }
}
function withRuleEvent(ruleId: CinemaPerformanceRuleId, condition: Readonly<CinemaCompositionDefinition['performanceRules'][number]['condition']>, event: CinemaPerformanceEventCondition | ''): CinemaCompositionDefinition['performanceRules'][number]['condition'] { if (!event) return { ...condition, event: undefined, manualActionIds: undefined }; if (event !== 'manual') return { ...condition, event, manualActionIds: undefined }; const existing = condition.manualActionIds?.[0] ?? cinemaStableId<CinemaActionId>(`${ruleId}-manual`, 'manual action'); return { ...condition, event, manualActionIds: [existing] } }
function defaultSafeRange() { return { minPosition: [-20, -20, 0.05] as const, maxPosition: [20, 20, 100] as const, minFovDegrees: 10, maxFovDegrees: 140, minNear: 0.001, maxFar: 10000 } }
function formatTime(value: number): string { const total = Math.max(0, Number.isFinite(value) ? value : 0); const minutes = Math.floor(total / 60); const seconds = total - minutes * 60; return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}` }
