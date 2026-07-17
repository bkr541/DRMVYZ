import { useMemo, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { composePixGridLogicalFrame } from './PixGridCompositor'
import { pixGridPreparedAssetCache } from './PixGridAssetPreparation'
import { createSilentPixGridAudioFrame } from './PixGridAudioRouting'
import {
  createDefaultPixGridReactionAssignment,
  createPixGridAlphaGroups,
  createPixGridConnectedRegionGroups,
  createPixGridDominantColorGroups,
  createPixGridGeometricGroups,
  createPixGridLuminanceGroups,
  createPixGridLayerAlphaGroup,
  createPixGridSelectionGroup,
  createPixGridSvgGroups,
  type PixGridMaskPixelSource,
  type PixGridSmartGroupMethod,
  type PixGridSvgGroupCandidate,
} from './PixGridGroups'
import { MAX_PIX_GRID_GROUPS, MAX_PIX_GRID_REACTIONS_PER_GROUP } from './PixGridLimits'
import { PIX_GRID_ASSIGNMENT_TARGETS } from './PixGridAssignmentCompiler'
import {
  PIX_GRID_AUDIO_INTELLIGENCE_SOURCES,
  getPixGridAudioIntelligenceSource,
} from './PixGridAudioIntelligenceRegistry'
import type {
  PixGridGeometricGroupPattern,
  PixGridGroup,
  PixGridReactionAssignment,
  PixGridReactionSource,
  PixGridState,
} from './PixGridTypes'

const SMART_METHODS: Array<{ value: PixGridSmartGroupMethod; label: string }> = [
  { value: 'selection', label: 'Current Marquee' },
  { value: 'dominantColor', label: 'Dominant Colors' },
  { value: 'luminanceBands', label: 'Luminance Bands' },
  { value: 'alpha', label: 'Foreground / Background' },
  { value: 'layerAlpha', label: 'Selected Layer Alpha' },
  { value: 'connectedRegions', label: 'Connected Regions' },
  { value: 'geometric', label: 'Geometric Pattern' },
  { value: 'svg', label: 'SVG Structure / Fills' },
]

const GEOMETRIC_OPTIONS: Array<{ value: PixGridGeometricGroupPattern; label: string }> = [
  { value: 'border', label: 'Border' }, { value: 'center', label: 'Center' },
  { value: 'left', label: 'Left Half' }, { value: 'right', label: 'Right Half' },
  { value: 'top', label: 'Top Half' }, { value: 'bottom', label: 'Bottom Half' },
  { value: 'quadrantTopLeft', label: 'Quadrants' }, { value: 'horizontalBands', label: 'Horizontal Bands' },
  { value: 'verticalBands', label: 'Vertical Bands' }, { value: 'alternatingRowsA', label: 'Alternating Rows' },
  { value: 'alternatingColumnsA', label: 'Alternating Columns' }, { value: 'checkerboardA', label: 'Checkerboard A/B' },
  { value: 'diagonalBands', label: 'Diagonal Bands' }, { value: 'radialRings', label: 'Radial Rings' },
  { value: 'deterministicClusters', label: 'Deterministic Clusters' },
]

const REACTION_SOURCE_OPTIONS = PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.map(definition => ({
  value: definition.id,
  label: `${definition.label}${definition.optional ? ' · optional' : ''}`,
}))

function label(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())
}

function selectedLayerSource(state: PixGridState): { source: PixGridMaskPixelSource; candidates: readonly PixGridSvgGroupCandidate[] } | null {
  const layerId = state.editor.selectedLayerId
  const layer = state.layers.find(candidate => candidate.id === layerId)
  if (!layer) return null
  if (layer.mediaId) {
    const prepared = pixGridPreparedAssetCache.findLatestMedia(layer.mediaId, state.matrixWidth, state.matrixHeight)
    if (prepared) return { source: prepared, candidates: prepared.svgGroupCandidates ?? [] }
  }
  const store = useReactStore.getState()
  const preset = store.reactPresets.find(candidate => candidate.id === store.activeReactPresetId && candidate.engine === 'pixGrid')
  if (!preset) return null
  const sceneId = 'pix-grid-smart-group-source'
  const isolated: PixGridState = {
    ...state,
    groups: [],
    selectedSceneId: sceneId,
    scenes: [{ id: sceneId, name: 'Smart Group Source', layerIds: [layer.id], pixelOverrides: [] }],
    layers: [{ ...layer, visible: true, opacity: 1 }],
    pixelOverrides: [],
  }
  const logical = composePixGridLogicalFrame(preset, isolated, createSilentPixGridAudioFrame())
  return { source: logical, candidates: [] }
}

function replaceGroup(state: PixGridState, groupId: string, updater: (group: PixGridGroup) => PixGridGroup): PixGridState {
  return { ...state, groups: state.groups.map(group => group.id === groupId ? updater(group) : group) }
}

function replaceAssignment(group: PixGridGroup, assignmentId: string, patch: Partial<PixGridReactionAssignment>): PixGridGroup {
  return { ...group, reactions: group.reactions.map(assignment => assignment.id === assignmentId ? { ...assignment, ...patch } : assignment) }
}

export function PixGridGroupReactionPanel() {
  const state = useReactStore(store => store.pixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const setState = useReactStore(store => store.setPixGridState)
  const [method, setMethod] = useState<PixGridSmartGroupMethod>('selection')
  const [geometricPattern, setGeometricPattern] = useState<PixGridGeometricGroupPattern>('border')
  const group = useMemo(
    () => state.groups.find(candidate => candidate.id === state.editor.selectedGroupId) ?? state.groups[0] ?? null,
    [state.editor.selectedGroupId, state.groups],
  )
  const assignment = group?.reactions.find(candidate => candidate.id === state.editor.previewReactionAssignmentId)
    ?? group?.reactions[0]
    ?? null
  const sourceDefinition = assignment ? getPixGridAudioIntelligenceSource(assignment.source) : null
  const targetOptions = sourceDefinition
    ? PIX_GRID_ASSIGNMENT_TARGETS
        .filter(definition => definition.scopes.some(scope => scope === 'group' || scope === 'pixels') && definition.supportedSourceKinds.includes(sourceDefinition.kind))
        .map(definition => ({ value: definition.id, label: definition.label }))
    : []

  const updateEditor = (patch: Partial<PixGridState['editor']>) => setState({ editor: { ...state.editor, ...patch } })
  const addGroups = (groups: PixGridGroup[]) => {
    if (groups.length === 0) return
    const room = Math.max(0, MAX_PIX_GRID_GROUPS - state.groups.length)
    const accepted = groups.slice(0, room).map((candidate, index) => ({ ...candidate, priority: state.groups.length + index }))
    if (accepted.length === 0) return
    applyState({
      ...state,
      groups: [...state.groups, ...accepted],
      editor: { ...state.editor, selectedGroupId: accepted[0].id },
    })
  }

  const autoCreate = () => {
    const layerId = state.editor.selectedLayerId
    if (method === 'selection') {
      if (state.editor.selection) addGroups([createPixGridSelectionGroup(state.editor.selection, state.matrixWidth, state.matrixHeight, layerId)])
      return
    }
    if (method === 'geometric') {
      addGroups(createPixGridGeometricGroups(geometricPattern, state.matrixWidth, state.matrixHeight, layerId))
      return
    }
    const prepared = selectedLayerSource(state)
    if (!prepared) return
    if (method === 'dominantColor') addGroups(createPixGridDominantColorGroups(prepared.source, layerId))
    else if (method === 'luminanceBands') addGroups(createPixGridLuminanceGroups(prepared.source, layerId))
    else if (method === 'alpha') addGroups(createPixGridAlphaGroups(prepared.source, layerId))
    else if (method === 'layerAlpha') {
      const alphaGroup = createPixGridLayerAlphaGroup(prepared.source, layerId)
      if (alphaGroup) addGroups([alphaGroup])
    } else if (method === 'connectedRegions') addGroups(createPixGridConnectedRegionGroups(prepared.source, layerId))
    else if (method === 'svg') addGroups(createPixGridSvgGroups(prepared.candidates, prepared.source, layerId))
  }

  const updateGroup = (updater: (current: PixGridGroup) => PixGridGroup) => {
    if (group) applyState(replaceGroup(state, group.id, updater))
  }
  const updateAssignment = (patch: Partial<PixGridReactionAssignment>) => {
    if (group && assignment) updateGroup(current => replaceAssignment(current, assignment.id, patch))
  }

  return (
    <div className="rv-pix-grid-group-panel" data-testid="pix-grid-group-reaction-panel">
      <CtrlSection label="SMART PIXEL GROUPS" />
      <SelectRow label="Create By" value={method} options={SMART_METHODS} onChange={value => setMethod(value as PixGridSmartGroupMethod)} />
      {method === 'geometric' && <SelectRow label="Pattern" value={geometricPattern} options={GEOMETRIC_OPTIONS} onChange={value => setGeometricPattern(value as PixGridGeometricGroupPattern)} />}
      <div className="rv-ctrl-action-row">
        <button type="button" className="rv-reset-btn" disabled={state.groups.length >= MAX_PIX_GRID_GROUPS} onClick={autoCreate}>Create Group</button>
      </div>
      <div className="rv-ctrl-info">{state.groups.length} / {MAX_PIX_GRID_GROUPS} groups · compact masks compile only when inputs change</div>

      <div className="rv-pix-grid-group-list" role="list" aria-label="PixGrid groups">
        {[...state.groups].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).map(candidate => (
          <button
            key={candidate.id}
            type="button"
            role="listitem"
            className={candidate.id === group?.id ? 'is-active' : ''}
            onClick={() => updateEditor({ selectedGroupId: candidate.id })}
          >
            <span className="rv-pix-grid-group-swatch" style={{ background: candidate.displayColor ?? '#4ac7db' }} />
            <span>{candidate.name}</span><small>{candidate.reactions.length}</small>
          </button>
        ))}
      </div>

      {group && (
        <>
          <CtrlSection label="GROUP" />
          <TextInputRow label="Name" value={group.name} maxLength={96} onChange={value => updateGroup(current => ({ ...current, name: value }))} />
          <ToggleRow label="Enabled" value={group.enabled} onChange={value => updateGroup(current => ({ ...current, enabled: value }))} />
          <ToggleRow label="Show Mask" value={group.visible} onChange={value => updateGroup(current => ({ ...current, visible: value }))} />
          <SliderRow label="Priority" value={group.priority} min={-100} max={100} step={1} onChange={value => updateGroup(current => ({ ...current, priority: value }))} />
          <SelectRow label="Overlap" value={group.overlapBehavior} options={[
            { value: 'stack', label: 'Stack' }, { value: 'exclusive', label: 'Exclusive' }, { value: 'replace', label: 'Replace Lower Priority' },
          ]} onChange={value => updateGroup(current => ({ ...current, overlapBehavior: value as PixGridGroup['overlapBehavior'] }))} />
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" disabled={group.reactions.length >= MAX_PIX_GRID_REACTIONS_PER_GROUP} onClick={() => {
              const next = createDefaultPixGridReactionAssignment(group.reactions.length)
              applyState({
                ...replaceGroup(state, group.id, current => ({ ...current, reactions: [...current.reactions, next] })),
                editor: { ...state.editor, selectedGroupId: group.id, previewReactionAssignmentId: next.id },
              })
            }}>Add Reaction</button>
            <button type="button" className="rv-reset-btn" onClick={() => applyState({ ...state, groups: state.groups.filter(candidate => candidate.id !== group.id), editor: { ...state.editor, selectedGroupId: null, previewReactionAssignmentId: null } })}>Delete Group</button>
          </div>
        </>
      )}

      {group && assignment && (
        <>
          <CtrlSection label="REACTION" />
          <SelectRow label="Assignment" value={assignment.id} options={group.reactions.map(candidate => ({ value: candidate.id, label: candidate.name }))} onChange={value => updateEditor({ previewReactionAssignmentId: value })} />
          <TextInputRow label="Name" value={assignment.name} onChange={value => updateAssignment({ name: value })} />
          <ToggleRow label="Enabled" value={assignment.enabled} onChange={value => updateAssignment({ enabled: value })} />
          <SelectRow label="Source" value={assignment.source} options={REACTION_SOURCE_OPTIONS} onChange={value => updateAssignment({ source: value as PixGridReactionSource })} />
          <div className="rv-ctrl-info">{sourceDefinition?.category} · {sourceDefinition?.kind} · recommended {sourceDefinition?.recommendedTargets.slice(0, 3).map(label).join(', ')}</div>
          <SelectRow label="Scope" value={assignment.targetScope ?? 'group'} options={[
            { value: 'group', label: 'Group mask' }, { value: 'pixels', label: 'Selected sparse pixels / mask' },
          ]} onChange={value => updateAssignment({ targetScope: value as PixGridReactionAssignment['targetScope'], targetId: group.id })} />
          <SelectRow label="Target" value={assignment.target} options={targetOptions} onChange={value => updateAssignment({ target: value as PixGridReactionAssignment['target'] })} />
          <SliderRow label="Amount" value={assignment.amount} min={-2} max={2} step={0.01} onChange={value => updateAssignment({ amount: value })} />
          <SliderRow label="Threshold" value={assignment.threshold} onChange={value => updateAssignment({ threshold: value })} />
          <SliderRow label="Hysteresis" value={assignment.hysteresis ?? 0} max={0.5} step={0.01} onChange={value => updateAssignment({ hysteresis: value })} />
          <SelectRow label="Curve" value={assignment.curve ?? 'linear'} options={['linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential', 'logarithmic', 'smoothstep', 'stepped', 'gate', 'inverse'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ curve: value as PixGridReactionAssignment['curve'] })} />
          <SliderRow label="Attack" value={assignment.attack} max={2} step={0.01} onChange={value => updateAssignment({ attack: value })} />
          <SliderRow label="Hold" value={assignment.hold} max={2} step={0.01} onChange={value => updateAssignment({ hold: value })} />
          <SliderRow label="Release" value={assignment.release} max={4} step={0.01} onChange={value => updateAssignment({ release: value })} />
          <SliderRow label="Smoothing" value={assignment.smoothing} max={1} step={0.01} onChange={value => updateAssignment({ smoothing: value })} />
          <SliderRow label="Minimum Confidence" value={assignment.minimumConfidence} onChange={value => updateAssignment({ minimumConfidence: value })} />
          <SelectRow label="Polarity" value={assignment.polarity ?? (assignment.invert ? 'negative' : 'positive')} options={['positive', 'negative', 'bipolar'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ polarity: value as PixGridReactionAssignment['polarity'], invert: value === 'negative' })} />
          <SelectRow label="Quantize" value={assignment.quantization} options={['none', 'beat', 'bar', 'fourBars', 'eightBars', 'sixteenBars'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ quantization: value as PixGridReactionAssignment['quantization'] })} />
          <SelectRow label="Retrigger" value={assignment.retrigger} options={['restart', 'extend', 'ignoreWhileActive'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ retrigger: value as PixGridReactionAssignment['retrigger'] })} />
          <SelectRow label="Fallback" value={assignment.capabilityFallback} options={['disable', 'zero', 'energy', 'beat', 'midHighActivity', 'transient'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ capabilityFallback: value as PixGridReactionAssignment['capabilityFallback'] })} />
          <SelectRow label="Blend" value={assignment.blend} options={['add', 'multiply', 'replace', 'max'].map(value => ({ value, label: label(value) }))} onChange={value => updateAssignment({ blend: value as PixGridReactionAssignment['blend'] })} />
          <SliderRow label="Priority" value={assignment.priority ?? 0} min={-100} max={100} step={1} onChange={value => updateAssignment({ priority: value })} />
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" aria-pressed={state.editor.previewReactionAssignmentId === assignment.id} onClick={() => updateEditor({ previewReactionAssignmentId: state.editor.previewReactionAssignmentId === assignment.id ? null : assignment.id })}>Test / Preview</button>
            <button type="button" className="rv-reset-btn" onClick={() => applyState({
              ...replaceGroup(state, group.id, current => ({ ...current, reactions: current.reactions.filter(candidate => candidate.id !== assignment.id) })),
              editor: {
                ...state.editor,
                previewReactionAssignmentId: state.editor.previewReactionAssignmentId === assignment.id ? null : state.editor.previewReactionAssignmentId,
              },
            })}>Delete Reaction</button>
          </div>
        </>
      )}
    </div>
  )
}
