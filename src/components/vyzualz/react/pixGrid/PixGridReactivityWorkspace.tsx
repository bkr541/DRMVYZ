import { useEffect, useMemo, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import type { ReactSectionType } from '../ReactTypes'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { PIX_GRID_ASSIGNMENT_TARGETS } from './PixGridAssignmentCompiler'
import {
  PIX_GRID_AUDIO_INTELLIGENCE_SOURCES,
  getPixGridAudioIntelligenceSource,
  isPixGridContinuousSourceDefinition,
} from './PixGridAudioIntelligenceRegistry'
import { createDefaultPixGridReactionAssignment } from './PixGridGroups'
import {
  PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID,
  PIX_GRID_PERFORMANCE_PROGRAM_BY_ID,
  PIX_GRID_PERFORMANCE_PROGRAMS,
} from './PixGridPerformancePrograms'
import type {
  PixGridContinuousRoutePlan,
  PixGridEventRoutePlan,
  PixGridPerformanceAction,
  PixGridPerformanceProgram,
  PixGridProgramRouteTarget,
  PixGridSectionPlan,
} from './PixGridPerformanceTypes'
import {
  triggerPixGridPreviewSource,
  usePixGridReactivityRuntimeStatus,
} from './PixGridReactivityStatus'
import type {
  PixGridPerformanceProgramId,
  PixGridProgramRouteOverride,
  PixGridProgramSectionOverride,
  PixGridReactionAssignment,
  PixGridReactionSource,
  PixGridReactionTarget,
  PixGridReactionTargetScope,
  PixGridState,
} from './PixGridTypes'

export type PixGridReactivitySurface = 'routing' | 'events' | 'choreography' | 'analysis'

type UserRouteOwner = { kind: 'global' } | { kind: 'group'; groupId: string }
type RouteSelection =
  | { kind: 'program-continuous'; route: PixGridContinuousRoutePlan }
  | { kind: 'program-event'; route: PixGridEventRoutePlan }
  | { kind: 'user'; assignment: PixGridReactionAssignment; owner: UserRouteOwner }

const SOURCE_CATEGORY_LABELS: Record<string, string> = {
  frequency: 'Frequency',
  level: 'Energy',
  development: 'Musical development',
  progress: 'Progress',
  stem: 'Stem and vocal',
  confidence: 'Optional analysis',
  rhythm: 'Rhythm events',
  boundary: 'Cadence and sections',
  semantic: 'Semantic events',
  cue: 'Track Map',
}
const SECTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All sections' },
  ...(['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown'] as ReactSectionType[])
    .map(value => ({ value, label: label(value) })),
]
const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'output', label: 'Output' }, { value: 'scene', label: 'Scene' },
  { value: 'layer', label: 'Layer' }, { value: 'group', label: 'Smart group mask' },
  { value: 'pixels', label: 'Sparse pixels / mask' }, { value: 'background', label: 'Background' },
  { value: 'transition', label: 'Transition' }, { value: 'animation', label: 'Animation' },
  { value: 'palette', label: 'Palette' },
]
const PROGRAM_SCOPE_OPTIONS = SCOPE_OPTIONS.filter(option => ['output', 'scene', 'layer', 'group', 'background', 'transition', 'palette'].includes(option.value))
const CURVE_OPTIONS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential', 'logarithmic', 'smoothstep', 'stepped', 'gate', 'inverse']
const DECAY_OPTIONS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential', 'overshoot', 'step', 'stepped']
const TRANSITION_OPTIONS = ['cut', 'crossfade', 'rowWipe', 'columnWipe', 'checkerWipe', 'pixelDissolve', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff']

function label(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, char => char.toUpperCase())
}

function programForState(state: PixGridState): PixGridPerformanceProgram {
  const id = state.performance.sharedPerformanceProgramId
    ?? PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID[state.selectedPresetId ?? '']
    ?? PIX_GRID_PERFORMANCE_PROGRAMS[0].id
  return PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(id) ?? PIX_GRID_PERFORMANCE_PROGRAMS[0]
}

function routeTargetLabel(target: PixGridProgramRouteTarget): string {
  if ('role' in target) return `Role · ${label(target.role)}`
  if ('bankId' in target) return `Bank · ${label(target.bankId)}`
  if ('target' in target) return `${label(target.target.kind)} · ${label(target.target.id)}`
  return `Scope · ${label(target.scope)}`
}

function targetChoices(state: PixGridState, scope: PixGridReactionTargetScope): Array<{ value: string; label: string }> {
  if (scope === 'group' || scope === 'pixels') return state.groups.map(group => ({ value: group.id, label: group.name }))
  if (scope === 'layer' || scope === 'animation') return state.layers.map(layer => ({ value: layer.id, label: layer.name }))
  if (scope === 'scene') return state.scenes.map(scene => ({ value: scene.id, label: scene.name }))
  return []
}

function compactRouteOverride(value: PixGridProgramRouteOverride): PixGridProgramRouteOverride {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as PixGridProgramRouteOverride
}

function programRouteTarget(program: PixGridPerformanceProgram, target: PixGridProgramRouteTarget): { scope: PixGridReactionTargetScope; targetId: string | null } {
  const reference = 'target' in target
    ? target.target
    : 'role' in target
      ? program.bindings.find(binding => binding.roles.includes(target.role))?.target
      : 'bankId' in target
        ? program.banks.find(bank => bank.id === target.bankId)?.members[0]
        : null
  if ('scope' in target) return { scope: target.scope, targetId: null }
  if (!reference) return { scope: 'output', targetId: null }
  return { scope: reference.kind === 'group' ? 'group' : reference.kind, targetId: reference.id }
}

function routeTargetsGroup(program: PixGridPerformanceProgram, target: PixGridProgramRouteTarget, groupId: string): boolean {
  if ('target' in target) return target.target.kind === 'group' && target.target.id === groupId
  if ('role' in target) return program.bindings.some(binding => binding.roles.includes(target.role) && binding.target.kind === 'group' && binding.target.id === groupId)
  if ('bankId' in target) return program.banks.some(bank => bank.id === target.bankId && bank.members.some(member => member.kind === 'group' && member.id === groupId))
  return false
}

function occurrenceRuleLabel(rule: PixGridSectionPlan['occurrence'] | PixGridSectionPlan['dropOccurrence']): string {
  if (!rule) return 'All occurrences'
  const parts: string[] = []
  if (rule.occurrences?.length) parts.push(`Only ${rule.occurrences.join(', ')}`)
  if (rule.minOccurrence != null) parts.push(`From ${rule.minOccurrence}`)
  if (rule.maxOccurrence != null) parts.push(`Through ${rule.maxOccurrence}`)
  if (rule.every != null) parts.push(`Every ${rule.every}`)
  return parts.join(' · ') || 'Authored rule'
}

function performanceActionLabel(action: PixGridPerformanceAction): string {
  switch (action.type) {
    case 'setScene': return `Select scene · ${label(action.sceneId)}`
    case 'setLayerActive': return `${action.active ? 'Enable' : 'Disable'} layer · ${label(action.layerId)}`
    case 'setGroupActive': return `${action.active ? 'Enable' : 'Disable'} group · ${label(action.groupId)}`
    case 'setLayerOpacity': return `Layer opacity · ${label(action.layerId)} · ${Math.round(action.opacity * 100)}%`
    case 'setGroupBrightness': return `Group brightness · ${label(action.groupId)} · ${action.brightness.toFixed(2)}`
    case 'setPaletteRole': return `Palette · ${typeof action.target === 'string' ? 'all' : 'layerId' in action.target ? label(action.target.layerId) : label(action.target.groupId)} · ${label(action.role)}`
    case 'flashGroup': return `Flash group · ${label(action.groupId)} · ${action.amount.toFixed(2)}`
    case 'revealRows': return `Reveal rows · ${action.progress.toFixed(2)} · ${action.from ?? 'top'}`
    case 'revealColumns': return `Reveal columns · ${action.progress.toFixed(2)} · ${action.from ?? 'left'}`
    case 'dissolveGroup': return `Dissolve group · ${label(action.groupId)} · ${action.amount.toFixed(2)}`
    case 'shiftGroup': return `Shift group · ${label(action.groupId)} · ${action.x ?? 0}, ${action.y ?? 0}`
    case 'recruitLayer': return `Recruit layer · ${label(action.layerId)} · ${Math.round((action.opacity ?? 1) * 100)}%`
    case 'changeAnimation': return `Animation · ${label(action.layerId)} · ${label(action.animation)}`
    case 'changeAnimationSpeed': return `Animation speed · ${action.multiplier.toFixed(2)}×`
    case 'reverseDirection': return 'Reverse direction'
    case 'triggerFrame': return `Trigger frame · step ${action.step ?? 1}`
    case 'freeze': return action.active ? 'Freeze motion' : 'Resume motion'
    case 'clear': return 'Clear performance state'
    case 'restore': return 'Restore authored state'
    case 'setTransition': return `Transition · ${label(action.transition)} · ${action.durationBeats ?? 0} beats`
    case 'setDensity': return `Density · ${Math.round(action.density * 100)}%`
    case 'setBackgroundState': return `Background · ${label(action.state)}${action.brightness == null ? '' : ` · ${Math.round(action.brightness * 100)}%`}`
  }
}

function ActionInspection({ title, actions }: { title: string; actions?: readonly PixGridPerformanceAction[] }) {
  return <><strong>{title}</strong>{actions?.length ? actions.map((action, index) => <span key={`${title}-${index}-${action.type}`}>{index + 1}. {performanceActionLabel(action)}</span>) : <span>None</span>}</>
}

function sourceValue(frame: ReturnType<typeof usePixGridReactivityRuntimeStatus>['audioFrame'], source: PixGridReactionSource): number | undefined {
  if (!frame) return undefined
  const direct = frame[source as keyof typeof frame]
  if (typeof direct === 'number') return direct
  if (typeof direct === 'boolean') return direct ? 1 : 0
  return frame.sourceValues?.[source]
}

function parseOccurrence(value: string): number[] | undefined {
  const parsed = value.split(',').map(item => Math.round(Number(item.trim()))).filter(item => Number.isFinite(item) && item > 0)
  return parsed.length ? [...new Set(parsed)].slice(0, 32) : undefined
}

function CategorizedSourceSelect({
  labelText,
  value,
  continuous,
  onChange,
}: {
  labelText: string
  value: PixGridReactionSource
  continuous: boolean
  onChange: (value: PixGridReactionSource) => void
}) {
  const grouped = useMemo(() => {
    const definitions = PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.filter(definition =>
      continuous ? isPixGridContinuousSourceDefinition(definition) : !isPixGridContinuousSourceDefinition(definition),
    )
    return [...new Set(definitions.map(definition => definition.category))].map(category => ({
      category,
      definitions: definitions.filter(definition => definition.category === category),
    }))
  }, [continuous])
  return (
    <div className="rv-ctrl-row">
      <label className="rv-ctrl-label" htmlFor={`pix-grid-source-${labelText.replace(/\s/g, '-')}`}>{labelText}</label>
      <select
        id={`pix-grid-source-${labelText.replace(/\s/g, '-')}`}
        className="rv-ctrl-select"
        value={value}
        onChange={event => onChange(event.target.value as PixGridReactionSource)}
      >
        {grouped.map(group => (
          <optgroup key={group.category} label={SOURCE_CATEGORY_LABELS[group.category] ?? label(group.category)}>
            {group.definitions.map(definition => (
              <option key={definition.id} value={definition.id}>{definition.label}{definition.optional ? ' · optional' : ''}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function RouteList({ routes, selectedId, onSelect }: { routes: Array<{ id: string; title: string; detail: string; badge: string; enabled: boolean }>; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="rv-pix-grid-route-list" role="list" aria-label="PixGrid routes">
      {routes.map(route => (
        <button key={route.id} type="button" role="listitem" className={route.id === selectedId ? 'is-active' : ''} onClick={() => onSelect(route.id)}>
          <span className={`rv-pix-grid-route-state ${route.enabled ? 'is-on' : 'is-off'}`} aria-hidden="true" />
          <span><strong>{route.title}</strong><small>{route.detail}</small></span>
          <em>{route.badge}</em>
        </button>
      ))}
      {routes.length === 0 && <div className="rv-ctrl-info">No routes in this category.</div>}
    </div>
  )
}

function ProgramRouteEditor({
  state,
  program,
  route,
  continuous,
  applyState,
}: {
  state: PixGridState
  program: PixGridPerformanceProgram
  route: PixGridContinuousRoutePlan | PixGridEventRoutePlan
  continuous: boolean
  applyState: (next: PixGridState) => void
}) {
  const override = state.performance.programOverrides.routes[route.id] ?? {}
  const source = (override.source ?? ('source' in route ? route.source : route.event)) as PixGridReactionSource
  const operation = override.operation ?? route.operation
  const amount = override.amount ?? route.amount
  const conditions = route.conditions ?? {}
  const update = (patch: Partial<PixGridProgramRouteOverride>) => {
    const routes = { ...state.performance.programOverrides.routes }
    const next = compactRouteOverride({ ...override, ...patch })
    if (Object.keys(next).length) routes[route.id] = next
    else delete routes[route.id]
    applyState({ ...state, performance: { ...state.performance, programOverrides: { ...state.performance.programOverrides, routes } } })
  }
  const reset = () => {
    const routes = { ...state.performance.programOverrides.routes }
    delete routes[route.id]
    applyState({ ...state, performance: { ...state.performance, programOverrides: { ...state.performance.programOverrides, routes } } })
  }
  const sourceDefinition = getPixGridAudioIntelligenceSource(source)
  const operations = PIX_GRID_ASSIGNMENT_TARGETS
    .filter(target => target.supportedSourceKinds.includes(sourceDefinition.kind))
    .map(target => ({ value: target.id, label: target.label }))
  const sectionValue = override.sectionTypes?.[0] ?? conditions.sectionTypes?.[0] ?? 'all'
  const authoredTarget = programRouteTarget(program, route.target)
  const targetScope = override.targetScope ?? authoredTarget.scope
  const targetIds = targetChoices(state, targetScope)
  const targetId = override.targetScope ? override.targetId : authoredTarget.targetId
  const inputRange = override.inputRange ?? route.inputRange ?? [0, 1]
  const outputRange = override.outputRange ?? route.outputRange ?? [0, 1]
  return (
    <Collapsible label={continuous ? 'CONTINUOUS ROUTE SETTINGS' : 'EVENT ROUTE SETTINGS'} defaultOpen>
      <div className="rv-pix-grid-origin-card"><strong>{route.id}</strong><span>{routeTargetLabel(route.target)}</span><small>{program.metadata.name} default{Object.keys(override).length ? ' · modified' : ''}</small></div>
      <ToggleRow label="Enabled" value={override.enabled !== false} onChange={enabled => update({ enabled })} />
      <CategorizedSourceSelect labelText={continuous ? 'Source' : 'Event'} value={source} continuous={continuous} onChange={value => update({ source: value })} />
      <SelectRow label="Target Scope" value={targetScope} options={PROGRAM_SCOPE_OPTIONS} onChange={value => {
        const nextScope = value as PixGridReactionTargetScope
        const choices = targetChoices(state, nextScope)
        update({ targetScope: nextScope, targetId: choices[0]?.value ?? null })
      }} />
      {targetIds.length > 0 && <SelectRow label="Target" value={targetId ?? targetIds[0]?.value ?? ''} options={targetIds} onChange={value => update({ targetId: value })} />}
      <SelectRow label="Operation" value={operation} options={operations} onChange={value => update({ operation: value as PixGridReactionTarget })} />
      <SliderRow label="Amount" value={amount} min={-4} max={4} step={0.01} onChange={value => update({ amount: value })} />
      <NumberInputRow label="Input Minimum" value={inputRange[0]} min={-4} max={4} step={0.01} onChange={value => update({ inputRange: [value, inputRange[1]] })} />
      <NumberInputRow label="Input Maximum" value={inputRange[1]} min={-4} max={4} step={0.01} onChange={value => update({ inputRange: [inputRange[0], value] })} />
      <NumberInputRow label="Output Minimum" value={outputRange[0]} min={-8} max={8} step={0.01} onChange={value => update({ outputRange: [value, outputRange[1]] })} />
      <NumberInputRow label="Output Maximum" value={outputRange[1]} min={-8} max={8} step={0.01} onChange={value => update({ outputRange: [outputRange[0], value] })} />
      {continuous ? (
        <>
          <SelectRow label="Polarity" value={override.polarity ?? ('polarity' in route ? route.polarity ?? 'positive' : 'positive')} options={['positive', 'negative', 'bipolar'].map(value => ({ value, label: label(value) }))} onChange={value => update({ polarity: value as PixGridProgramRouteOverride['polarity'] })} />
          <SelectRow label="Curve" value={override.curve ?? ('curve' in route ? route.curve ?? sourceDefinition.recommendedCurve : sourceDefinition.recommendedCurve)} options={CURVE_OPTIONS.map(value => ({ value, label: label(value) }))} onChange={value => update({ curve: value as PixGridProgramRouteOverride['curve'] })} />
        </>
      ) : (
        <SelectRow label="Decay Curve" value={override.decayCurve ?? ('envelope' in route ? route.envelope.curve ?? 'easeOut' : 'easeOut')} options={DECAY_OPTIONS.map(value => ({ value, label: label(value) }))} onChange={value => update({ decayCurve: value as PixGridProgramRouteOverride['decayCurve'] })} />
      )}
      <SliderRow label="Threshold" value={override.threshold ?? route.threshold ?? (continuous ? 0 : 0.01)} onChange={value => update({ threshold: value })} />
      <SliderRow label="Hysteresis" value={override.hysteresis ?? route.hysteresis ?? 0} max={0.5} step={0.01} onChange={value => update({ hysteresis: value })} />
      <SliderRow label="Smoothing" value={override.smoothing ?? route.smoothing ?? sourceDefinition.recommendedSmoothing.smoothing} max={1} step={0.01} onChange={value => update({ smoothing: value })} />
      {!continuous && 'envelope' in route && (
        <>
          <SliderRow label="Attack" value={override.attack ?? route.envelope.attack} max={2} step={0.005} onChange={value => update({ attack: value })} />
          <SliderRow label="Hold" value={override.hold ?? route.envelope.hold} max={2} step={0.005} onChange={value => update({ hold: value })} />
          <SliderRow label="Release" value={override.release ?? route.envelope.release} max={4} step={0.005} onChange={value => update({ release: value })} />
          <SelectRow label="Quantization" value={override.quantization ?? route.quantization ?? 'none'} options={['none', 'beat', 'bar', 'fourBars', 'eightBars', 'sixteenBars'].map(value => ({ value, label: label(value) }))} onChange={value => update({ quantization: value as PixGridProgramRouteOverride['quantization'] })} />
          <SelectRow label="Retrigger" value={override.retrigger ?? route.retrigger ?? 'restart'} options={['restart', 'extend', 'ignoreWhileActive'].map(value => ({ value, label: label(value) }))} onChange={value => update({ retrigger: value as PixGridProgramRouteOverride['retrigger'] })} />
        </>
      )}
      <SliderRow label="Minimum Confidence" value={override.minimumConfidence ?? route.minimumConfidence ?? 0} onChange={value => update({ minimumConfidence: value })} />
      <SelectRow label="Fallback" value={override.capabilityFallback ?? route.capabilityFallback ?? sourceDefinition.capabilityFallback} options={['disable', 'zero', 'energy', 'beat', 'midHighActivity', 'transient'].map(value => ({ value, label: label(value) }))} onChange={value => update({ capabilityFallback: value as PixGridProgramRouteOverride['capabilityFallback'] })} />
      <SelectRow label="Section Condition" value={sectionValue} options={SECTION_OPTIONS} onChange={value => update({ sectionTypes: value === 'all' ? undefined : [value as ReactSectionType] })} />
      <TextInputRow label="Section Occurrences" value={(override.sectionOccurrences ?? conditions.sectionOccurrences ?? []).join(', ')} placeholder="1, 2, 3" onChange={value => update({ sectionOccurrences: parseOccurrence(value) })} />
      <TextInputRow label="Drop Occurrences" value={(override.dropOccurrences ?? conditions.dropOccurrences ?? []).join(', ')} placeholder="1, 2" onChange={value => update({ dropOccurrences: parseOccurrence(value) })} />
      <SliderRow label="Priority" value={override.priority ?? route.priority ?? 0} min={-500} max={500} step={1} onChange={value => update({ priority: value })} />
      <SelectRow label="Blend" value={override.blend ?? route.blend ?? 'add'} options={['add', 'multiply', 'replace', 'max'].map(value => ({ value, label: label(value) }))} onChange={value => update({ blend: value as PixGridProgramRouteOverride['blend'] })} />
      <div className="rv-ctrl-action-row">
        <button type="button" className="rv-reset-btn" onClick={() => triggerPixGridPreviewSource(source)}>{continuous ? 'Preview Route' : 'Test Trigger'}</button>
        <button type="button" className="rv-reset-btn" disabled={!Object.keys(override).length} onClick={reset}>Reset Route</button>
      </div>
      <div className="rv-ctrl-info">Preview is transient and never writes a Track Map cue.</div>
    </Collapsible>
  )
}

function UserRouteEditor({ state, selection, applyState }: { state: PixGridState; selection: Extract<RouteSelection, { kind: 'user' }>; applyState: (next: PixGridState) => void }) {
  const { assignment, owner } = selection
  const update = (patch: Partial<PixGridReactionAssignment>) => {
    if (owner.kind === 'global') {
      applyState({ ...state, audioAssignments: state.audioAssignments.map(route => route.id === assignment.id ? { ...route, ...patch } : route) })
      return
    }
    const groupId = owner.groupId
    applyState({ ...state, groups: state.groups.map(group => group.id === groupId ? { ...group, reactions: group.reactions.map(route => route.id === assignment.id ? { ...route, ...patch } : route) } : group) })
  }
  const remove = () => {
    if (owner.kind === 'global') applyState({ ...state, audioAssignments: state.audioAssignments.filter(route => route.id !== assignment.id) })
    else {
      const groupId = owner.groupId
      applyState({ ...state, groups: state.groups.map(group => group.id === groupId ? { ...group, reactions: group.reactions.filter(route => route.id !== assignment.id) } : group) })
    }
  }
  const definition = getPixGridAudioIntelligenceSource(assignment.source)
  const continuous = isPixGridContinuousSourceDefinition(definition)
  const targetOptions = PIX_GRID_ASSIGNMENT_TARGETS.filter(target => target.scopes.includes(assignment.targetScope ?? 'output') && target.supportedSourceKinds.includes(definition.kind)).map(target => ({ value: target.id, label: target.label }))
  const targetIds = assignment.targetScope === 'group' || assignment.targetScope === 'pixels'
    ? state.groups.map(group => ({ value: group.id, label: group.name }))
    : assignment.targetScope === 'layer'
      ? state.layers.map(layer => ({ value: layer.id, label: layer.name }))
      : assignment.targetScope === 'scene'
        ? state.scenes.map(scene => ({ value: scene.id, label: scene.name }))
        : []
  const section = assignment.conditions?.includeSectionTypes?.[0] ?? 'all'
  return (
    <Collapsible label={continuous ? 'USER CONTINUOUS ROUTE' : 'USER EVENT ROUTE'} defaultOpen>
      <TextInputRow label="Name" value={assignment.name} onChange={name => update({ name })} />
      <ToggleRow label="Enabled" value={assignment.enabled} onChange={enabled => update({ enabled })} />
      <CategorizedSourceSelect labelText={continuous ? 'Source' : 'Event'} value={assignment.source} continuous={continuous} onChange={source => update({ source })} />
      <SelectRow label="Target Scope" value={assignment.targetScope ?? 'output'} options={SCOPE_OPTIONS} onChange={value => {
        const nextScope = value as PixGridReactionTargetScope
        update({ targetScope: nextScope, targetId: targetChoices(state, nextScope)[0]?.value ?? null })
      }} />
      {targetIds.length > 0 && <SelectRow label="Target" value={assignment.targetId ?? targetIds[0]?.value ?? ''} options={targetIds} onChange={targetId => update({ targetId })} />}
      <SelectRow label="Operation" value={assignment.target} options={targetOptions.length ? targetOptions : PIX_GRID_ASSIGNMENT_TARGETS.map(target => ({ value: target.id, label: target.label }))} onChange={value => update({ target: value as PixGridReactionTarget })} />
      <SliderRow label="Amount" value={assignment.amount} min={-4} max={4} step={0.01} onChange={amount => update({ amount })} />
      <NumberInputRow label="Input Minimum" value={assignment.inputRange?.[0] ?? 0} min={-4} max={4} step={0.01} onChange={value => update({ inputRange: [value, assignment.inputRange?.[1] ?? 1] })} />
      <NumberInputRow label="Input Maximum" value={assignment.inputRange?.[1] ?? 1} min={-4} max={4} step={0.01} onChange={value => update({ inputRange: [assignment.inputRange?.[0] ?? 0, value] })} />
      <NumberInputRow label="Output Minimum" value={assignment.outputRange?.[0] ?? 0} min={-8} max={8} step={0.01} onChange={value => update({ outputRange: [value, assignment.outputRange?.[1] ?? 1] })} />
      <NumberInputRow label="Output Maximum" value={assignment.outputRange?.[1] ?? 1} min={-8} max={8} step={0.01} onChange={value => update({ outputRange: [assignment.outputRange?.[0] ?? 0, value] })} />
      <SelectRow label="Polarity" value={assignment.polarity ?? 'positive'} options={['positive', 'negative', 'bipolar'].map(value => ({ value, label: label(value) }))} onChange={value => update({ polarity: value as PixGridReactionAssignment['polarity'] })} />
      <SelectRow label={continuous ? 'Curve' : 'Decay Curve'} value={continuous ? assignment.curve ?? 'linear' : assignment.decayCurve ?? 'easeOut'} options={(continuous ? CURVE_OPTIONS : DECAY_OPTIONS).map(value => ({ value, label: label(value) }))} onChange={value => continuous ? update({ curve: value as PixGridReactionAssignment['curve'] }) : update({ decayCurve: value as PixGridReactionAssignment['decayCurve'] })} />
      <SliderRow label="Threshold" value={assignment.threshold} onChange={threshold => update({ threshold })} />
      <SliderRow label="Hysteresis" value={assignment.hysteresis ?? 0} max={0.5} step={0.01} onChange={hysteresis => update({ hysteresis })} />
      <SliderRow label="Smoothing" value={assignment.smoothing} max={1} step={0.01} onChange={smoothing => update({ smoothing })} />
      {!continuous && <><SliderRow label="Attack" value={assignment.attack} max={2} step={0.005} onChange={attack => update({ attack })} /><SliderRow label="Hold" value={assignment.hold} max={2} step={0.005} onChange={hold => update({ hold })} /><SliderRow label="Release" value={assignment.release} max={4} step={0.005} onChange={release => update({ release })} /><SelectRow label="Quantization" value={assignment.quantization} options={['none', 'beat', 'bar', 'fourBars', 'eightBars', 'sixteenBars'].map(value => ({ value, label: label(value) }))} onChange={value => update({ quantization: value as PixGridReactionAssignment['quantization'] })} /><SelectRow label="Retrigger" value={assignment.retrigger} options={['restart', 'extend', 'ignoreWhileActive'].map(value => ({ value, label: label(value) }))} onChange={value => update({ retrigger: value as PixGridReactionAssignment['retrigger'] })} /></>}
      <SliderRow label="Minimum Confidence" value={assignment.minimumConfidence} onChange={minimumConfidence => update({ minimumConfidence })} />
      <SelectRow label="Fallback" value={assignment.capabilityFallback} options={['disable', 'zero', 'energy', 'beat', 'midHighActivity', 'transient'].map(value => ({ value, label: label(value) }))} onChange={value => update({ capabilityFallback: value as PixGridReactionAssignment['capabilityFallback'] })} />
      <SelectRow label="Section Condition" value={section} options={SECTION_OPTIONS} onChange={value => update({ conditions: { ...assignment.conditions, includeSectionTypes: value === 'all' ? [] : [value as ReactSectionType] } })} />
      <TextInputRow label="Section Occurrences" value={(assignment.conditions?.sectionOccurrences ?? []).join(', ')} placeholder="1, 2, 3" onChange={value => update({ conditions: { ...assignment.conditions, sectionOccurrences: parseOccurrence(value) ?? [] } })} />
      <TextInputRow label="Drop Occurrences" value={(assignment.conditions?.dropOccurrences ?? []).join(', ')} placeholder="1, 2" onChange={value => update({ conditions: { ...assignment.conditions, dropOccurrences: parseOccurrence(value) ?? [] } })} />
      <SliderRow label="Priority" value={assignment.priority ?? 0} min={-500} max={500} step={1} onChange={priority => update({ priority })} />
      <SelectRow label="Blend" value={assignment.blend} options={['add', 'multiply', 'replace', 'max'].map(value => ({ value, label: label(value) }))} onChange={value => update({ blend: value as PixGridReactionAssignment['blend'] })} />
      <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={() => triggerPixGridPreviewSource(assignment.source)}>{continuous ? 'Preview Route' : 'Test Trigger'}</button><button type="button" className="rv-reset-btn" onClick={remove}>Delete Route</button></div>
    </Collapsible>
  )
}

function RoutingOrEvents({ mode }: { mode: 'continuous' | 'event' }) {
  const state = useReactStore(store => store.pixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const status = usePixGridReactivityRuntimeStatus()
  const setOverlayVisible = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const program = programForState(state)
  const continuous = mode === 'continuous'
  const selections = useMemo<RouteSelection[]>(() => {
    const result: RouteSelection[] = []
    for (const route of continuous ? program.continuousRoutes : program.eventRoutes) result.push(continuous ? { kind: 'program-continuous', route: route as PixGridContinuousRoutePlan } : { kind: 'program-event', route: route as PixGridEventRoutePlan })
    for (const assignment of state.audioAssignments) {
      if (isPixGridContinuousSourceDefinition(getPixGridAudioIntelligenceSource(assignment.source)) === continuous) result.push({ kind: 'user', assignment, owner: { kind: 'global' } })
    }
    for (const group of state.groups) for (const assignment of group.reactions) {
      if (isPixGridContinuousSourceDefinition(getPixGridAudioIntelligenceSource(assignment.source)) === continuous) result.push({ kind: 'user', assignment, owner: { kind: 'group', groupId: group.id } })
    }
    return result
  }, [continuous, program, state.audioAssignments, state.groups])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedId || !selections.some(selection => `${selection.kind}:${selection.kind === 'user' ? selection.assignment.id : selection.route.id}` === selectedId)) {
      const first = selections[0]
      setSelectedId(first ? `${first.kind}:${first.kind === 'user' ? first.assignment.id : first.route.id}` : null)
    }
  }, [selectedId, selections])
  const selected = selections.find(selection => `${selection.kind}:${selection.kind === 'user' ? selection.assignment.id : selection.route.id}` === selectedId) ?? null
  const routeRows = selections.map(selection => {
    if (selection.kind === 'user') {
      const ownerGroupId = selection.owner.kind === 'group' ? selection.owner.groupId : null
      const group = ownerGroupId ? state.groups.find(candidate => candidate.id === ownerGroupId) : null
      return { id: `${selection.kind}:${selection.assignment.id}`, title: selection.assignment.name, detail: `${label(selection.assignment.source)} → ${label(selection.assignment.target)}${group ? ` · ${group.name}` : ''}`, badge: 'USER', enabled: selection.assignment.enabled }
    }
    const override = state.performance.programOverrides.routes[selection.route.id]
    const source = override?.source ?? (selection.kind === 'program-continuous' ? selection.route.source : selection.route.event)
    return { id: `${selection.kind}:${selection.route.id}`, title: label(selection.route.id), detail: `${label(source)} → ${label(override?.operation ?? selection.route.operation)} · ${routeTargetLabel(selection.route.target)}`, badge: override && Object.keys(override).length ? 'MODIFIED' : 'PRESET', enabled: override?.enabled !== false }
  })
  const selectedGroup = state.groups.find(group => group.id === state.editor.selectedGroupId) ?? state.groups[0] ?? null
  const directGroupRouteCount = selectedGroup ? selectedGroup.reactions.length + state.audioAssignments.filter(route => (route.targetScope === 'group' || route.targetScope === 'pixels') && route.targetId === selectedGroup.id).length : 0
  const programGroupRouteCount = selectedGroup ? [...program.continuousRoutes, ...program.eventRoutes].filter(route => state.performance.programOverrides.routes[route.id]?.enabled !== false && routeTargetsGroup(program, route.target, selectedGroup.id)).length : 0
  const groupRouteCount = directGroupRouteCount + programGroupRouteCount
  const maskCompilationStatus = !selectedGroup ? 'unavailable' : !selectedGroup.enabled ? 'disabled' : status.runtime ? status.runtime.compiledMaskGroups.includes(selectedGroup.id) ? 'compiled' : 'empty or missing' : 'pending live frame'
  const addRoute = (groupId: string | null = null) => {
    const next = createDefaultPixGridReactionAssignment(state.audioAssignments.length + groupRouteCount)
    next.id = `${next.id}-${Date.now().toString(36)}`
    next.name = continuous ? 'New Continuous Route' : 'New Event Route'
    next.source = continuous ? 'bass' : 'kick'
    next.targetScope = groupId ? 'group' : 'output'
    next.targetId = groupId
    next.quantization = continuous ? 'none' : 'beat'
    if (groupId) applyState({ ...state, groups: state.groups.map(group => group.id === groupId ? { ...group, reactions: [...group.reactions, next] } : group), editor: { ...state.editor, selectedGroupId: groupId, previewReactionAssignmentId: next.id } })
    else applyState({ ...state, audioAssignments: [...state.audioAssignments, next] })
    setSelectedId(`user:${next.id}`)
  }
  const duplicate = () => {
    if (!selected) return
    if (selected.kind === 'user') {
      const next = { ...selected.assignment, id: `${selected.assignment.id}-copy-${Date.now().toString(36)}`, name: `${selected.assignment.name} Copy` }
      if (selected.owner.kind === 'global') applyState({ ...state, audioAssignments: [...state.audioAssignments, next] })
      else {
        const groupId = selected.owner.groupId
        applyState({ ...state, groups: state.groups.map(group => group.id === groupId ? { ...group, reactions: [...group.reactions, next] } : group) })
      }
      setSelectedId(`user:${next.id}`)
      return
    }
    const route = selected.route
    const routeIsContinuous = 'source' in route
    const override = state.performance.programOverrides.routes[route.id] ?? {}
    const target = programRouteTarget(program, route.target)
    const next = createDefaultPixGridReactionAssignment(state.audioAssignments.length + groupRouteCount)
    next.id = `${route.id}-copy-${Date.now().toString(36)}`
    next.name = `${label(route.id)} Copy`
    next.enabled = override.enabled !== false
    next.source = override.source ?? (routeIsContinuous ? route.source : route.event)
    next.target = override.operation ?? route.operation
    next.targetScope = target.scope
    next.targetId = target.targetId
    next.amount = override.amount ?? route.amount
    next.inputRange = override.inputRange ?? route.inputRange ?? [0, 1]
    next.outputRange = override.outputRange ?? route.outputRange ?? [0, 1]
    next.threshold = override.threshold ?? route.threshold ?? (routeIsContinuous ? 0 : 0.01)
    next.hysteresis = override.hysteresis ?? route.hysteresis ?? 0
    next.smoothing = override.smoothing ?? route.smoothing ?? (routeIsContinuous ? 0.08 : 0)
    next.minimumConfidence = override.minimumConfidence ?? route.minimumConfidence ?? 0
    next.capabilityFallback = override.capabilityFallback ?? route.capabilityFallback ?? getPixGridAudioIntelligenceSource(next.source).capabilityFallback
    next.blend = override.blend ?? route.blend ?? 'add'
    next.priority = override.priority ?? route.priority ?? 0
    next.conditions = {
      includeSectionTypes: [...(override.sectionTypes ?? route.conditions?.sectionTypes ?? [])],
      sectionOccurrences: [...(override.sectionOccurrences ?? route.conditions?.sectionOccurrences ?? [])],
      dropOccurrences: [...(override.dropOccurrences ?? route.conditions?.dropOccurrences ?? [])],
    }
    if (routeIsContinuous) {
      next.polarity = override.polarity ?? route.polarity ?? 'positive'
      next.curve = override.curve ?? route.curve ?? 'linear'
      next.attack = override.attack ?? route.attack ?? next.attack
      next.hold = override.hold ?? route.hold ?? next.hold
      next.release = override.release ?? route.release ?? next.release
    } else {
      next.attack = override.attack ?? route.envelope.attack
      next.hold = override.hold ?? route.envelope.hold
      next.release = override.release ?? route.envelope.release
      next.decayCurve = (override.decayCurve ?? route.envelope.curve ?? 'easeOut') as PixGridReactionAssignment['decayCurve']
      next.quantization = override.quantization ?? route.quantization ?? 'none'
      next.retrigger = override.retrigger ?? route.retrigger ?? 'restart'
    }
    applyState({ ...state, audioAssignments: [...state.audioAssignments, next] })
    setSelectedId(`user:${next.id}`)
  }
  return (
    <div data-testid={`pix-grid-${mode}-workspace`}>
      <Collapsible label={continuous ? 'CONTINUOUS ROUTES' : 'EVENT ROUTES'} defaultOpen>
        <div className="rv-pix-grid-summary-strip"><span><strong>{continuous ? program.continuousRoutes.length : program.eventRoutes.length}</strong> preset</span><span><strong>{selections.filter(item => item.kind === 'user').length}</strong> user</span><span><strong>{program.metadata.name}</strong> active</span></div>
        <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={() => addRoute()}>Add Route</button><button type="button" className="rv-reset-btn" disabled={!selected} onClick={duplicate}>Duplicate</button></div>
        <RouteList routes={routeRows} selectedId={selectedId} onSelect={setSelectedId} />
      </Collapsible>
      {selected?.kind === 'program-continuous' && <ProgramRouteEditor state={state} program={program} route={selected.route} continuous applyState={applyState} />}
      {selected?.kind === 'program-event' && <ProgramRouteEditor state={state} program={program} route={selected.route} continuous={false} applyState={applyState} />}
      {selected?.kind === 'user' && <UserRouteEditor state={state} selection={selected} applyState={applyState} />}
      <Collapsible label="SMART GROUP INTEGRATION" defaultOpen={false}>
        <SelectRow label="Selected Group" value={selectedGroup?.id ?? ''} options={state.groups.map(group => ({ value: group.id, label: group.name }))} disabled={state.groups.length === 0} onChange={groupId => applyState({ ...state, editor: { ...state.editor, selectedGroupId: groupId } })} />
        <div className="rv-pix-grid-origin-card"><strong>{selectedGroup?.name ?? 'No group selected'}</strong><span>{selectedGroup ? `${selectedGroup.cellRuns.reduce((sum, run) => sum + run[2], 0)} materialized cells · ${selectedGroup.mask.kind}` : 'Create a smart group in Design.'}</span><small>{selectedGroup ? `${groupRouteCount} targeting routes (${directGroupRouteCount} user · ${programGroupRouteCount} program) · mask ${maskCompilationStatus}` : 'Unavailable'}</small></div>
        <ToggleRow label="Show Mask Overlay" value={selectedGroup?.visible ?? false} disabled={!selectedGroup} onChange={visible => selectedGroup && applyState({ ...state, groups: state.groups.map(group => group.id === selectedGroup.id ? { ...group, visible } : group) })} />
        <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" disabled={!selectedGroup} onClick={() => { if (!selectedGroup) return; setOverlayVisible(true); applyState({ ...state, authoringOverlayVisible: true, editor: { ...state.editor, selectedGroupId: selectedGroup.id } }) }}>Open Group in Editor</button><button type="button" className="rv-reset-btn" disabled={!selectedGroup} onClick={() => addRoute(selectedGroup?.id ?? null)}>Create Route for Group</button></div>
      </Collapsible>
    </div>
  )
}

function SectionPlanEditor({ state, plan, canDisable, applyState }: { state: PixGridState; plan: PixGridSectionPlan; canDisable: boolean; applyState: (next: PixGridState) => void }) {
  const override = state.performance.programOverrides.sections[plan.id] ?? {}
  const update = (patch: Partial<PixGridProgramSectionOverride>) => applyState({ ...state, performance: { ...state.performance, programOverrides: { ...state.performance.programOverrides, sections: { ...state.performance.programOverrides.sections, [plan.id]: { ...override, ...patch } } } } })
  const reset = () => {
    const sections = { ...state.performance.programOverrides.sections }; delete sections[plan.id]
    applyState({ ...state, performance: { ...state.performance, programOverrides: { ...state.performance.programOverrides, sections } } })
  }
  return (
    <Collapsible label="SECTION PLAN CONTROLS" defaultOpen>
      <ToggleRow label="Section Enabled" value={override.enabled !== false} disabled={override.enabled !== false && !canDisable} onChange={enabled => update({ enabled })} />
      <SliderRow label="Density Arc" value={override.density ?? plan.densityState?.value ?? 0.5} onChange={density => update({ density })} />
      <SliderRow label="Palette Arc" value={override.paletteIntensity ?? plan.paletteState?.intensity ?? 0.5} onChange={paletteIntensity => update({ paletteIntensity })} />
      <SliderRow label="Motion Arc" value={override.motion ?? plan.motionState?.amount ?? 0.5} max={2} onChange={motion => update({ motion })} />
      <SliderRow label="Negative Space" value={override.negativeSpace ?? plan.negativeSpaceTarget ?? 0.35} onChange={negativeSpace => update({ negativeSpace })} />
      <ToggleRow label="Four-bar Motifs" value={override.fourBarEnabled !== false && Boolean(plan.fourBarActions?.length)} disabled={!plan.fourBarActions?.length} onChange={fourBarEnabled => update({ fourBarEnabled })} />
      <ToggleRow label="Eight-bar Recruitment" value={override.eightBarEnabled !== false && Boolean(plan.eightBarRecruitment?.length)} disabled={!plan.eightBarRecruitment?.length} onChange={eightBarEnabled => update({ eightBarEnabled })} />
      <ToggleRow label="Sixteen-bar Evolution" value={override.sixteenBarEnabled !== false && Boolean(plan.sixteenBarEvolution?.length)} disabled={!plan.sixteenBarEvolution?.length} onChange={sixteenBarEnabled => update({ sixteenBarEnabled })} />
      <SelectRow label="Transition In" value={override.transitionIn ?? plan.transitionIn?.type ?? 'cut'} options={TRANSITION_OPTIONS.map(value => ({ value, label: label(value) }))} onChange={transitionIn => update({ transitionIn: transitionIn as PixGridProgramSectionOverride['transitionIn'] })} />
      <SelectRow label="Transition Out" value={override.transitionOut ?? plan.transitionOut?.type ?? 'cut'} options={TRANSITION_OPTIONS.map(value => ({ value, label: label(value) }))} onChange={transitionOut => update({ transitionOut: transitionOut as PixGridProgramSectionOverride['transitionOut'] })} />
      <div className="rv-pix-grid-choreo-grid"><div><strong>Entry</strong><span>{plan.entryActions?.length ?? 0} actions</span></div><div><strong>Body</strong><span>{plan.bodyActions?.length ?? 0} actions</span></div><div><strong>Exit</strong><span>{plan.exitActions?.length ?? 0} actions</span></div><div><strong>Occurrence</strong><span>{plan.occurrence ? 'authored' : 'all'}</span></div><div><strong>Drop occurrence</strong><span>{plan.dropOccurrence ? 'authored' : 'all'}</span></div><div><strong>Routes</strong><span>{(plan.continuousRouteIds?.length ?? 0) + (plan.eventRouteIds?.length ?? 0)}</span></div></div>
      <Collapsible label="ENTRY, BODY, AND EXIT ACTIONS" defaultOpen={false}><div className="rv-pix-grid-inspection-list"><ActionInspection title="Entry" actions={plan.entryActions} /><ActionInspection title="Body" actions={plan.bodyActions ?? plan.actions} /><ActionInspection title="Exit" actions={plan.exitActions} /></div></Collapsible>
      <Collapsible label="MOTIFS AND DEVELOPMENT" defaultOpen={false}><div className="rv-pix-grid-inspection-list">
        {plan.fourBarActions?.map((actions, index) => <ActionInspection key={`four-${index}`} title={`Four-bar motif ${index + 1}`} actions={actions} />) ?? <span>Four-bar motifs: none</span>}
        {plan.eightBarRecruitment?.map((actions, index) => <ActionInspection key={`eight-${index}`} title={`Eight-bar recruitment ${index + 1}`} actions={actions} />) ?? <span>Eight-bar recruitment: none</span>}
        {plan.sixteenBarEvolution?.map((actions, index) => <ActionInspection key={`sixteen-${index}`} title={`Sixteen-bar evolution ${index + 1}`} actions={actions} />) ?? <span>Sixteen-bar evolution: none</span>}
        {Object.entries(plan.eventActions ?? {}).map(([event, actions]) => <ActionInspection key={event} title={`${label(event)} event`} actions={actions} />)}
        <strong>Layer recruitment</strong><span>{plan.layerRecruitment?.map(item => `${label(item.layerId)} @ ${label(item.stage ?? 'body')}`).join(' · ') || 'None'}</span>
        <strong>Group recruitment</strong><span>{plan.groupRecruitment?.map(item => `${label(item.groupId)} @ ${label(item.stage ?? 'body')}`).join(' · ') || 'None'}</span>
        <strong>Occurrence rule</strong><span>{occurrenceRuleLabel(plan.occurrence)}</span>
        <strong>Drop occurrence rule</strong><span>{occurrenceRuleLabel(plan.dropOccurrence)}</span>
      </div></Collapsible>
      <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" disabled={!Object.keys(override).length} onClick={reset}>Reset Section</button></div>
    </Collapsible>
  )
}

function ChoreographyPanel() {
  const state = useReactStore(store => store.pixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const status = usePixGridReactivityRuntimeStatus()
  const program = programForState(state)
  const [sectionId, setSectionId] = useState(program.sectionPlans[0]?.id ?? '')
  useEffect(() => { if (!program.sectionPlans.some(plan => plan.id === sectionId)) setSectionId(program.sectionPlans[0]?.id ?? '') }, [program, sectionId])
  const plan = program.sectionPlans.find(candidate => candidate.id === sectionId) ?? program.sectionPlans[0]
  const enabledSectionCount = program.sectionPlans.filter(candidate => state.performance.programOverrides.sections[candidate.id]?.enabled !== false).length
  const clearOverride = () => applyState({ ...state, performance: { ...state.performance, lockedRoutes: [] }, layers: state.layers.map(layer => layer.locked ? { ...layer, locked: false } : layer) })
  const resetAll = () => applyState({ ...state, performance: { ...state.performance, programOverrides: { routes: {}, sections: {} }, lockedRoutes: [] } })
  const runtime = status.runtime
  return (
    <div data-testid="pix-grid-choreography-workspace">
      <Collapsible label="PERFORMANCE PROGRAM" defaultOpen>
        <SelectRow label="Active Program" value={program.id} options={PIX_GRID_PERFORMANCE_PROGRAMS.map(item => ({ value: item.id, label: item.metadata.name }))} onChange={value => applyState({ ...state, performance: { ...state.performance, sharedPerformanceProgramId: value as PixGridPerformanceProgramId, programOverrides: { routes: {}, sections: {} } } })} />
        <ToggleRow label="Auto Performance" value={state.performance.enabled} onChange={enabled => applyState({ ...state, performance: { ...state.performance, enabled } })} />
        <SliderRow label="Performance Intensity" value={state.performance.intensity} onChange={intensity => applyState({ ...state, performance: { ...state.performance, intensity } })} />
        <div className="rv-pix-grid-origin-card"><strong>{program.metadata.name}</strong><span>{program.metadata.description}</span><small>{program.visualRoles.length} visual roles · {program.bindings.length} bindings · {program.banks.length} banks</small></div>
        <div className="rv-pix-grid-live-card"><span>Active section <strong>{runtime?.activeSectionPlan ?? 'Waiting for analysis'}</strong></span><span>Motif <strong>{runtime?.activeProgramMotif ?? 'none'}</strong></span><span>Recruitment <strong>{runtime?.activeProgramRecruitment ?? 'none'}</strong></span><span>Evolution <strong>{runtime?.activeProgramEvolution ?? 'none'}</strong></span></div>
        <SelectRow label="Section Plan" value={plan?.id ?? ''} options={program.sectionPlans.map(item => ({ value: item.id, label: `${label(item.id)} · ${item.sectionTypes.map(label).join('/')}` }))} onChange={setSectionId} />
      </Collapsible>
      {plan && <SectionPlanEditor state={state} plan={plan} canDisable={enabledSectionCount > 1 || state.performance.programOverrides.sections[plan.id]?.enabled === false} applyState={applyState} />}
      <Collapsible label="VISUAL ROLES AND BANKS" defaultOpen={false}><div className="rv-pix-grid-inspection-list"><span>Roles: {program.visualRoles.map(label).join(' · ')}</span>{program.bindings.map(binding => <span key={binding.id}>{label(binding.id)}: {binding.target.kind} {label(binding.target.id)} → {binding.roles.map(label).join(', ')}</span>)}{program.banks.map(bank => <span key={bank.id}>{bank.label ?? label(bank.id)}: {bank.members.length} targets · {(bank.roles ?? []).map(label).join(', ')}</span>)}</div></Collapsible>
      <Collapsible label="ROUTE BANKS AND CAPABILITIES" defaultOpen={false}><div className="rv-pix-grid-inspection-list"><span>Continuous route bank: {program.continuousRoutes.length} authored routes</span><span>Event route bank: {program.eventRoutes.length} authored routes</span><span>Fallback order: {program.fallbackOrder?.map(label).join(' → ') || 'program default'}</span><span>Binding warnings: {runtime?.programBindingWarnings.length ? runtime.programBindingWarnings.join(' · ') : 'none'}</span><span>Manual precedence: {runtime?.manualOverridePrecedence ?? 'Program → cues → manual override'}</span></div></Collapsible>
      <Collapsible label="OVERRIDES" defaultOpen>
        <div className="rv-pix-grid-origin-card"><strong>{runtime?.activeCueActions.length ? 'Track Map cue override active' : state.performance.lockedRoutes.length || state.layers.some(layer => layer.locked) ? 'Manual override active' : 'Program controls output'}</strong><span>{runtime?.activeCueActions.join(' · ') || state.performance.lockedRoutes.join(' · ') || 'No temporary override routes.'}</span><small>Track Map cue state is distinct from preset defaults and user-authored configuration.</small></div>
        <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={clearOverride}>Clear Override</button><button type="button" className="rv-reset-btn" onClick={resetAll}>Reset Performance Configuration</button></div>
      </Collapsible>
    </div>
  )
}

function SignalRow({ source, labelText }: { source: PixGridReactionSource; labelText: string }) {
  const status = usePixGridReactivityRuntimeStatus()
  const frame = status.audioFrame
  const value = sourceValue(frame, source)
  const available = frame?.capabilities?.[source] !== false && value != null
  const confidence = frame?.confidence?.[source]
  const fallback = status.runtime?.fallbackSources.includes(source) ?? false
  const blocked = status.runtime?.confidenceBlockedSources.includes(source) ?? false
  const state = blocked ? 'blocked' : fallback ? 'fallback' : !available ? 'unavailable' : confidence != null && confidence < 0.35 ? 'degraded' : 'available'
  return <div className="rv-pix-grid-signal-row"><span>{labelText}</span><div><i style={{ width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` }} /></div><strong>{value == null ? 'Unavailable' : `${Math.round(value * 100)}%`}</strong><em className={`is-${state}`}>{label(state)}</em></div>
}

function EventStatus({ source, labelText }: { source: PixGridReactionSource; labelText: string }) {
  const status = usePixGridReactivityRuntimeStatus()
  const value = sourceValue(status.audioFrame, source)
  const available = status.audioFrame?.capabilities?.[source] !== false
  return <div className="rv-pix-grid-event-status"><span className={value && value > 0 ? 'is-active' : ''} /><strong>{labelText}</strong><em>{!available ? 'Unavailable' : value && value > 0 ? 'Triggered' : 'Idle'}</em></div>
}

function AnalysisPanel() {
  const status = usePixGridReactivityRuntimeStatus()
  const frame = status.audioFrame
  const runtime = status.runtime
  const renderer = status.renderer
  const signals: Array<[PixGridReactionSource, string]> = [
    ['sub', 'Sub'], ['bass', 'Bass'], ['lowMid', 'Low-mid'], ['mid', 'Mid'], ['high', 'High'], ['air', 'Air'],
    ['volume', 'Volume'], ['energy', 'Energy'], ['trackRelativeEnergy', 'Track-relative energy'], ['spectralFlux', 'Spectral flux'],
    ['tension', 'Tension'], ['complexity', 'Complexity'], ['buildProgress', 'Build progress'], ['sectionProgress', 'Section progress'],
    ['phraseProgress', 'Phrase progress'], ['beatPhase', 'Beat phase'], ['barProgress', 'Bar progress'], ['vocalActivity', 'Vocal activity'],
    ['bassStemActivity', 'Bass stem'], ['drumActivity', 'Drum stem'], ['melodyActivity', 'Melody stem'],
  ]
  const events: Array<[PixGridReactionSource, string]> = [
    ['beat', 'Beat'], ['downbeat', 'Downbeat'], ['kick', 'Kick'], ['snare', 'Snare'], ['hat', 'Hat'], ['transient', 'Transient'],
    ['barEntry', 'Bar'], ['fourBarBoundary', 'Four bars'], ['eightBarBoundary', 'Eight bars'], ['sixteenBarBoundary', 'Sixteen bars'],
    ['phraseEntry', 'Phrase entry'], ['sectionEntry', 'Section entry'], ['sectionExit', 'Section exit'], ['dropImpact', 'Drop impact'], ['semanticMoment', 'Semantic moment'],
  ]
  return (
    <div data-testid="pix-grid-analysis-workspace">
      <Collapsible label="LIVE AUTHORITATIVE ANALYSIS" defaultOpen>
        {!frame && <div className="rv-pix-grid-origin-card"><strong>Waiting for PixGrid frames</strong><span>Start playback or select PixGrid to publish live analysis.</span><small>No values are synthesized while analysis is absent.</small></div>}
        <div className="rv-pix-grid-signal-list">{signals.map(([source, title]) => <SignalRow key={source} source={source} labelText={title} />)}</div>
      </Collapsible>
      <Collapsible label="EVENTS AND MUSICAL POSITION" defaultOpen>
        <div className="rv-pix-grid-event-grid">{events.map(([source, title]) => <EventStatus key={source} source={source} labelText={title} />)}</div>
        <div className="rv-pix-grid-choreo-grid"><div><strong>Section</strong><span>{frame?.sectionType ? label(frame.sectionType) : 'Unavailable'}</span></div><div><strong>Phase</strong><span>{frame?.sectionPhase ? label(frame.sectionPhase) : 'Unavailable'}</span></div><div><strong>Occurrence</strong><span>{frame?.sectionOccurrence ?? 'Unavailable'}</span></div><div><strong>Drop</strong><span>{frame?.dropOccurrence ?? 'Unavailable'}</span></div><div><strong>4 / 8 / 16</strong><span>{runtime?.fourBarStage ?? '–'} / {runtime?.eightBarStage ?? '–'} / {runtime?.sixteenBarStage ?? '–'}</span></div><div><strong>Semantic</strong><span>{frame?.semanticMomentHit ? 'Active' : frame?.capabilities?.semanticMoment === false ? 'Unavailable' : 'Idle'}</span></div></div>
      </Collapsible>
      <Collapsible label="CAPABILITY STATUS" defaultOpen={false}>
        <div className="rv-pix-grid-diagnostic-tags"><span className="is-available">Available {runtime?.availableSources.length ?? 0}</span><span className="is-degraded">Degraded {runtime?.degradedSources.length ?? 0}</span><span className="is-fallback">Fallback {runtime?.assignmentsUsingFallback.length ?? 0}</span><span className="is-blocked">Confidence blocked {runtime?.assignmentsBlockedByConfidence.length ?? 0}</span><span className="is-unavailable">Unavailable {runtime?.unavailableSources.length ?? 0}</span></div>
      </Collapsible>
      <Collapsible label="RUNTIME DIAGNOSTICS" defaultOpen={false}>
        <div className="rv-pix-grid-diagnostics-grid">
          {[
            ['Total groups', renderer?.totalGroupCount ?? runtime?.enabledGroups.length], ['Compiled masks', renderer?.activeGroupMaskCount ?? runtime?.compiledMaskGroups.length],
            ['Continuous routes', renderer?.activeContinuousAssignmentCount ?? runtime?.activeContinuousAssignments.length], ['Event routes', renderer?.activeDiscreteAssignmentCount ?? runtime?.activeDiscreteAssignments.length],
            ['Program routes', renderer?.programGeneratedRouteCount ?? ((runtime?.activeProgramContinuousRoutes.length ?? 0) + (runtime?.activeProgramEventRoutes.length ?? 0))], ['User routes', renderer?.userAuthoredRouteCount ?? ((runtime?.activeContinuousAssignments.length ?? 0) + (runtime?.activeDiscreteAssignments.length ?? 0))],
            ['Active envelopes', renderer?.activeEventEnvelopeCount ?? runtime?.activeEventEnvelopes.length], ['Cue actions', renderer?.activeCueActionCount ?? runtime?.activeCueActions.length],
            ['Program actions', renderer?.activePerformanceActionCount ?? runtime?.activePerformanceActions.length], ['Transitions', renderer?.activeTransitionCount ?? runtime?.activeTransitions.length],
            ['Manual overrides', renderer?.manualOverrideCount ?? runtime?.manualOverrides.length], ['Degraded sources', renderer?.degradedSignalCount ?? runtime?.degradedSignals.length],
            ['Missing targets', renderer?.missingTargetCount ?? ((runtime?.missingTargets.length ?? 0) + (runtime?.programBindingWarnings.length ?? 0))], ['Compiler warnings', renderer?.assignmentCompilerWarningCount ?? runtime?.compilationWarnings.length],
            ['Renderer', renderer?.path ?? 'Unavailable'], ['Resolution', renderer ? `${renderer.logicalWidth} × ${renderer.logicalHeight}` : 'Unavailable'], ['FPS', renderer ? renderer.fps.toFixed(1) : 'Unavailable'],
          ].map(([name, value]) => <div key={name}><span>{name}</span><strong>{value ?? 0}</strong></div>)}
        </div>
        {runtime?.compilationWarnings.length ? <div className="rv-pix-grid-warning-list">{runtime.compilationWarnings.map(warning => <span key={warning}>{warning}</span>)}</div> : null}
      </Collapsible>
    </div>
  )
}

export function PixGridReactivityWorkspace({ surface }: { surface: PixGridReactivitySurface }) {
  const content = surface === 'events'
    ? <RoutingOrEvents mode="event" />
    : surface === 'choreography'
      ? <ChoreographyPanel />
      : surface === 'analysis'
        ? <AnalysisPanel />
        : <RoutingOrEvents mode="continuous" />

  return <div className="rv-ctrl-group rv-pix-grid-reactivity-workspace">{content}</div>
}
