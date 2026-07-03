import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useReactStore } from '../../../stores/reactStore'
import {
  DEFAULT_PRODUCTION_CHASE,
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  type ProductionCompoundCue,
  type ProductionCueAction,
  type ProductionCueActionExecution,
  type ProductionCueTiming,
} from './LaserDmxProductionRig'
import { diagnoseProductionCues } from './renderers/LaserDmxShowDirector'

const ACTION_TYPES: ProductionCueAction['type'][] = [
  'activateLook', 'fadeToLook', 'blackout', 'reveal', 'setFixtureProperty', 'moveToTarget',
  'runMovementEffect', 'stopMovementEffect', 'startChase', 'stopChase', 'pulse', 'strobeBurst',
  'blinderHit', 'fogBurst', 'cryoBurst', 'paletteChange', 'fanOpen', 'fanClose',
  'gateFixtureGroup', 'triggerLegacyBeamAction',
]

function labelForAction(type: ProductionCueAction['type']): string {
  return type.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase())
}

function makeAction(
  type: ProductionCueAction['type'],
  groupId: string,
  fixtureId: string,
  lookId: string,
  targetId: string,
): ProductionCueAction {
  const base = { id: crypto.randomUUID(), execution: 'simultaneous' as const }
  switch (type) {
    case 'activateLook': return { ...base, type, lookId }
    case 'fadeToLook': return { ...base, type, lookId, transitionMs: 600 }
    case 'blackout': return { ...base, type }
    case 'reveal': return { ...base, type }
    case 'setFixtureProperty': return { ...base, type, groupId, properties: { dimmer: 1 } }
    case 'moveToTarget': return { ...base, type, groupId, targetId, snap: false }
    case 'runMovementEffect': return { ...base, type, groupId, movement: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT, enabled: true } }
    case 'stopMovementEffect': return { ...base, type, groupId }
    case 'startChase': return { ...base, type, groupId, chase: { ...DEFAULT_PRODUCTION_CHASE, enabled: true } }
    case 'stopChase': return { ...base, type, groupId }
    case 'pulse': return { ...base, type, groupId, intensity: 1, durationMs: 250 }
    case 'strobeBurst': return { ...base, type, groupId, pattern: 'quarterBeatBurst', rateHz: 12, intensity: 1, durationMs: 500 }
    case 'blinderHit': return { ...base, type, groupId, intensity: 1, durationMs: 250 }
    case 'fogBurst': return { ...base, type, fixtureId, intensity: 1, durationMs: 2200 }
    case 'cryoBurst': return { ...base, type, fixtureId, intensity: 1, durationMs: 900 }
    case 'paletteChange': return { ...base, type, groupId, paletteId: '' }
    case 'fanOpen': return { ...base, type, groupId }
    case 'fanClose': return { ...base, type, groupId }
    case 'gateFixtureGroup': return { ...base, type, groupId, open: true }
    case 'triggerLegacyBeamAction': return { ...base, type, targetType: 'group', targetId: groupId, action: 'gate' }
  }
}

function timingSummary(timing: ProductionCueTiming): string {
  if (timing.mode === 'manual') return 'Manual only'
  if (timing.mode === 'absolute') {
    const mins = Math.floor(timing.timeSec / 60)
    const secs = timing.timeSec - mins * 60
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
  }
  if (timing.mode === 'musical') {
    const subdivision = timing.subdivision > 1 ? ` + ${timing.subdivisionIndex}/${timing.subdivision}` : ''
    return `Bar ${timing.bar} · Beat ${timing.beat}${subdivision}`
  }
  const section = timing.sectionId || timing.sectionType || 'section'
  return `${section} #${timing.occurrence} + ${timing.offsetBars} bars ${timing.offsetBeats} beats`
}

function actionSummary(cue: ProductionCompoundCue): string {
  if (!cue.actions.length) return 'No actions'
  const labels = cue.actions.slice(0, 3).map(action => labelForAction(action.type))
  return `${labels.join(' · ')}${cue.actions.length > 3 ? ` +${cue.actions.length - 3}` : ''}`
}

function actionTargetSummary(action: ProductionCueAction): string {
  if ('groupId' in action && action.groupId) return `Group: ${action.groupId}`
  if ('fixtureId' in action && action.fixtureId) return `Fixture: ${action.fixtureId}`
  if (action.type === 'activateLook' || action.type === 'fadeToLook') return `Look: ${action.lookId}`
  if (action.type === 'triggerLegacyBeamAction') return `${action.targetType}: ${action.targetId}`
  return 'Global'
}

function CueTimingEditor({ cue, groups, update }: { cue: ProductionCompoundCue; groups: { id: string; name: string }[]; update: (patch: Partial<ProductionCompoundCue>) => void }) {
  const mode = cue.manualOnly ? 'manual' : cue.timing.mode
  const musicalTiming = cue.timing.mode === 'musical' ? cue.timing : null
  const sectionTiming = cue.timing.mode === 'sectionRelative' ? cue.timing : null
  const setMode = (next: ProductionCueTiming['mode']) => {
    if (next === 'manual') update({ manualOnly: true, timing: { mode: 'manual' } })
    else if (next === 'absolute') update({ manualOnly: false, timing: { mode: 'absolute', timeSec: 0 } })
    else if (next === 'sectionRelative') update({
      manualOnly: false,
      timing: { mode: 'sectionRelative', sectionType: 'drop', occurrence: 1, offsetBars: 0, offsetBeats: 0, subdivision: 1, subdivisionIndex: 0, offsetSec: 0 },
    })
    else update({ manualOnly: false, timing: { mode: 'musical', bar: 1, beat: 1, subdivision: 1, subdivisionIndex: 0 } })
  }
  return (
    <div className="rv-cue-editor-grid">
      <label>Placement
        <select className="rv-ctrl-select" value={mode} onChange={event => setMode(event.target.value as ProductionCueTiming['mode'])}>
          <option value="musical">Bar / beat</option>
          <option value="absolute">Absolute time</option>
          <option value="sectionRelative">Section-relative</option>
          <option value="manual">Manual only</option>
        </select>
      </label>
      {musicalTiming && !cue.manualOnly && <>
        <label>Bar<input type="number" min={1} value={musicalTiming.bar} onChange={event => update({ timing: { ...musicalTiming, bar: Math.max(1, Number(event.target.value) || 1) } })} /></label>
        <label>Beat<input type="number" min={1} max={16} value={musicalTiming.beat} onChange={event => update({ timing: { ...musicalTiming, beat: Math.max(1, Number(event.target.value) || 1) } })} /></label>
        <label>Subdivision
          <select value={musicalTiming.subdivision} onChange={event => update({ timing: { ...musicalTiming, subdivision: Number(event.target.value) as 1 | 2 | 4 | 8 | 16 } })}>
            {[1, 2, 4, 8, 16].map(value => <option key={value} value={value}>1/{value}</option>)}
          </select>
        </label>
        <label>Sub index<input type="number" min={0} value={musicalTiming.subdivisionIndex} onChange={event => update({ timing: { ...musicalTiming, subdivisionIndex: Math.max(0, Number(event.target.value) || 0) } })} /></label>
      </>}
      {cue.timing.mode === 'absolute' && !cue.manualOnly &&
        <label>Time (seconds)<input type="number" min={0} step={0.001} value={cue.timing.timeSec} onChange={event => update({ timing: { mode: 'absolute', timeSec: Math.max(0, Number(event.target.value) || 0) } })} /></label>}
      {sectionTiming && !cue.manualOnly && <>
        <label>Section
          <select value={sectionTiming.sectionType ?? 'drop'} onChange={event => update({ timing: { ...sectionTiming, sectionId: undefined, sectionType: event.target.value as typeof sectionTiming.sectionType } })}>
            {['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown'].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>Occurrence<input type="number" min={1} value={sectionTiming.occurrence} onChange={event => update({ timing: { ...sectionTiming, occurrence: Math.max(1, Number(event.target.value) || 1) } })} /></label>
        <label>Offset bars<input type="number" value={sectionTiming.offsetBars} onChange={event => update({ timing: { ...sectionTiming, offsetBars: Number(event.target.value) || 0 } })} /></label>
        <label>Offset beats<input type="number" step={0.25} value={sectionTiming.offsetBeats} onChange={event => update({ timing: { ...sectionTiming, offsetBeats: Number(event.target.value) || 0 } })} /></label>
        <label>Offset seconds<input type="number" step={0.01} value={sectionTiming.offsetSec} onChange={event => update({ timing: { ...sectionTiming, offsetSec: Number(event.target.value) || 0 } })} /></label>
      </>}
      <label>Quantize
        <select value={cue.quantize} onChange={event => update({ quantize: event.target.value as ProductionCompoundCue['quantize'] })}>
          {['none', 'beat', 'eighth', 'sixteenth', 'bar', 'phrase', 'section'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="rv-show-director__group-target">Default fixture groups
        <select
          multiple
          size={Math.min(4, Math.max(2, groups.length))}
          value={cue.fixtureGroupIds}
          onChange={event => update({ fixtureGroupIds: Array.from(event.currentTarget.selectedOptions, option => option.value) })}
        >
          {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>
      <label>Priority<input type="number" value={cue.priority} onChange={event => update({ priority: Number(event.target.value) || 0 })} /></label>
      <label>Duration ms<input type="number" min={0} value={cue.durationMs ?? ''} placeholder="action default" onChange={event => update({ durationMs: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} /></label>
      <label>Transition ms<input type="number" min={0} value={cue.transitionMs ?? ''} placeholder="look default" onChange={event => update({ transitionMs: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} /></label>
      <label>Retrigger
        <select value={cue.retriggerPolicy} onChange={event => update({ retriggerPolicy: event.target.value as ProductionCompoundCue['retriggerPolicy'] })}>
          {['oncePerPass', 'restart', 'ignoreWhileActive', 'allow'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>On seek / cancel
        <select value={cue.cancellationBehavior} onChange={event => update({ cancellationBehavior: event.target.value as ProductionCompoundCue['cancellationBehavior'] })}>
          {['cancelOnSeek', 'restoreOnExit', 'holdUntilChanged', 'complete'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </div>
  )
}

function ActionEditor({
  action,
  groups,
  fixtures,
  looks,
  targets,
  update,
  moveUp,
  moveDown,
  duplicate,
  remove,
}: {
  action: ProductionCueAction
  groups: { id: string; name: string }[]
  fixtures: { id: string; name: string }[]
  looks: { id: string; name: string }[]
  targets: { id: string; name: string }[]
  update: (next: ProductionCueAction) => void
  moveUp: () => void
  moveDown: () => void
  duplicate: () => void
  remove: () => void
}) {
  const patch = (partial: Partial<ProductionCueAction>) => update({ ...action, ...partial } as ProductionCueAction)
  return (
    <div className="rv-show-action">
      <div className="rv-show-action__header">
        <select value={action.type} onChange={event => update(makeAction(event.target.value as ProductionCueAction['type'], groups[0]?.id ?? '', fixtures[0]?.id ?? '', looks[0]?.id ?? '', targets[0]?.id ?? ''))}>
          {ACTION_TYPES.map(type => <option key={type} value={type}>{labelForAction(type)}</option>)}
        </select>
        <select value={action.execution} onChange={event => patch({ execution: event.target.value as ProductionCueActionExecution })} title="Execution order">
          <option value="simultaneous">Simultaneous</option>
          <option value="sequential">Sequential</option>
        </select>
        <input aria-label="Action delay milliseconds" title="Delay ms" type="number" min={0} value={action.delayMs ?? 0} onChange={event => patch({ delayMs: Math.max(0, Number(event.target.value) || 0) })} />
        <button type="button" className="rv-glyph-upload-btn" onClick={moveUp} aria-label="Move action earlier">↑</button>
        <button type="button" className="rv-glyph-upload-btn" onClick={moveDown} aria-label="Move action later">↓</button>
        <button type="button" className="rv-glyph-upload-btn" onClick={duplicate} aria-label="Duplicate action">⧉</button>
        <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={remove} aria-label="Remove action">×</button>
      </div>
      <div className="rv-show-action__body">
        {'groupId' in action && <label>Group
          <select value={action.groupId ?? ''} onChange={event => patch({ groupId: event.target.value } as Partial<ProductionCueAction>)}>
            <option value="">Select group</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>}
        {'fixtureId' in action && !('groupId' in action && action.groupId) && <label>Fixture
          <select value={action.fixtureId ?? ''} onChange={event => patch({ fixtureId: event.target.value } as Partial<ProductionCueAction>)}>
            <option value="">Select fixture</option>{fixtures.map(fixture => <option key={fixture.id} value={fixture.id}>{fixture.name}</option>)}
          </select>
        </label>}
        {(action.type === 'activateLook' || action.type === 'fadeToLook') && <label>Look
          <select value={action.lookId} onChange={event => patch({ lookId: event.target.value })}>
            <option value="">Select Look</option>{looks.map(look => <option key={look.id} value={look.id}>{look.name}</option>)}
          </select>
        </label>}
        {action.type === 'moveToTarget' && <label>Target
          <select value={action.targetId} onChange={event => patch({ targetId: event.target.value })}>
            <option value="">Select target</option>{targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
          </select>
        </label>}
        {(action.type === 'pulse' || action.type === 'blinderHit' || action.type === 'fogBurst' || action.type === 'cryoBurst' || action.type === 'strobeBurst') &&
          <label>Intensity<input type="number" min={0} max={1} step={0.05} value={action.intensity ?? 1} onChange={event => patch({ intensity: Math.max(0, Math.min(1, Number(event.target.value) || 0)) })} /></label>}
        {action.type === 'strobeBurst' && <>
          <label>Pattern<select value={action.pattern} onChange={event => patch({ pattern: event.target.value as typeof action.pattern })}>
            {['singleHit', 'doubleHit', 'tripleHit', 'sustainedStrobe', 'quarterBeatBurst', 'eighthNoteBurst', 'rampUpBuildStrobe', 'alternatingLeftRight', 'centerOutFlash', 'randomizedFlicker', 'fullStageWhiteout', 'flashThenBlackout'].map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
          <label>Rate Hz<input type="number" min={0.1} max={30} step={0.1} value={action.rateHz ?? 12} onChange={event => patch({ rateHz: Number(event.target.value) || 12 })} /></label>
        </>}
        {action.type === 'gateFixtureGroup' && <label>Gate<select value={action.open ? 'open' : 'closed'} onChange={event => patch({ open: event.target.value === 'open' })}><option value="open">Open</option><option value="closed">Closed</option></select></label>}
        {action.type === 'setFixtureProperty' && <>
          <label>Dimmer<input type="number" min={0} max={1} step={0.05} value={action.properties.dimmer ?? ''} onChange={event => patch({ properties: { ...action.properties, dimmer: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label>
          <label>Shutter<select value={action.properties.shutterOpen == null ? '' : action.properties.shutterOpen ? 'open' : 'closed'} onChange={event => patch({ properties: { ...action.properties, shutterOpen: event.target.value === '' ? undefined : event.target.value === 'open' } })}><option value="">Unchanged</option><option value="open">Open</option><option value="closed">Closed</option></select></label>
        </>}
        <label>Duration ms<input type="number" min={0} value={action.durationMs ?? ''} placeholder="cue/default" onChange={event => patch({ durationMs: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} /></label>
        <span className="rv-show-action__target">{actionTargetSummary(action)}</span>
      </div>
    </div>
  )
}

export function LaserDmxCueListPanel() {
  const engine = useSharedAudio()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const {
    settings,
    beamMatrix,
    selectedCueId,
    addCue,
    duplicateCue,
    updateCue,
    reorderCue,
    deleteCue,
    selectCue,
    fireCue,
    manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId,
  } = useReactStore(useShallow(state => ({
    settings: state.laserDmxSettings,
    beamMatrix: state.laserDmxBeamMatrix,
    selectedCueId: state.selectedLaserDmxProductionCueId,
    addCue: state.addLaserDmxProductionCue,
    duplicateCue: state.duplicateLaserDmxProductionCue,
    updateCue: state.updateLaserDmxProductionCue,
    reorderCue: state.reorderLaserDmxProductionCue,
    deleteCue: state.deleteLaserDmxProductionCue,
    selectCue: state.selectLaserDmxProductionCue,
    fireCue: state.fireLaserDmxProductionCue,
    manualTrackSectionsByTrackId: state.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId: state.suppressedAutoSectionsByTrackId,
  })))
  const cues = settings.productionCues ?? []
  const effectiveAnalysis = useMemo(() => {
    const analysis = engine.currentAnalysis
    const grid = engine.currentEffectiveBeatGrid
    const bpm = engine.currentEffectiveBpm
    if (!analysis || !grid || bpm == null || bpm <= 0) return analysis
    return {
      ...analysis,
      bpmUsedForGrid: bpm,
      beatGridOffsetSec: grid[0]?.timeSec ?? analysis.beatGridOffsetSec,
      beatGrid: grid,
      downbeats: grid.filter(marker => marker.isDownbeat),
    }
  }, [engine.currentAnalysis, engine.currentEffectiveBeatGrid, engine.currentEffectiveBpm])
  const resolvedSections = useMemo(() => {
    const trackId = engine.currentTrackId
    const analyzedSections = effectiveAnalysis ? adaptMIAnalysis(effectiveAnalysis) : []
    const manualSections = trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
    const suppressedIds = trackId ? (suppressedAutoSectionsByTrackId[trackId] ?? []) : []
    return resolveTrackSections({ analyzedSections, manualSections, suppressedIds, durationSec: Math.max(1, engine.duration || 1) })
  }, [effectiveAnalysis, engine.currentTrackId, engine.duration, manualTrackSectionsByTrackId, suppressedAutoSectionsByTrackId])
  const bpm = engine.currentEffectiveBpm ?? 0
  const diagnostics = useMemo(
    () => diagnoseProductionCues(settings, beamMatrix, bpm, effectiveAnalysis, resolvedSections),
    [settings, beamMatrix, bpm, effectiveAnalysis, resolvedSections],
  )
  const diagnosticsByCue = useMemo(() => {
    const map = new Map<string, typeof diagnostics>()
    diagnostics.forEach(diagnostic => map.set(diagnostic.cueId, [...(map.get(diagnostic.cueId) ?? []), diagnostic]))
    return map
  }, [diagnostics])
  const groups = (settings.productionGroups ?? []).map(group => ({ id: group.id, name: group.name }))
  const fixtures = settings.fixtures.map(fixture => ({ id: fixture.id, name: fixture.name }))
  const looks = (settings.productionLooks ?? []).map(look => ({ id: look.id, name: look.name }))
  const targets = (settings.productionTargets ?? []).map(target => ({ id: target.id, name: target.name }))

  return (
    <div className="rv-cue-list rv-show-director">
      <div className="rv-cue-list-header">
        <div>
          <strong>Show Director</strong>
          <div className="rv-ctrl-info">Compound production events use the audio playhead plus the analyzed grid. Fire rehearses a cue without moving it.</div>
        </div>
        <div className="rv-show-director__buttons">
          <button type="button" className="rv-glyph-upload-btn" onClick={() => addCue()}>+ Cue</button>
          <button type="button" className="rv-glyph-upload-btn rv-show-director__fire" disabled={!selectedCueId} onClick={() => fireCue()}>GO / FIRE</button>
        </div>
      </div>
      {diagnostics.length > 0 && <div className="rv-show-director__diagnostics" role="status">{diagnostics.length} cue diagnostic{diagnostics.length === 1 ? '' : 's'} detected</div>}
      {cues.length === 0 && <div className="rv-cue-empty">No show cues yet. Add one to coordinate Looks, fixtures, movement, atmosphere, and legacy beam actions.</div>}
      {cues.map((cue, index) => {
        const expanded = expandedId === cue.id
        const selected = selectedCueId === cue.id
        const cueDiagnostics = diagnosticsByCue.get(cue.id) ?? []
        const update = (patch: Partial<ProductionCompoundCue>) => updateCue(cue.id, patch)
        return (
          <div key={cue.id} className={`rv-cue-row rv-show-cue${selected ? ' rv-show-cue--selected' : ''}${cue.enabled ? '' : ' rv-cue-row--disabled'}${cueDiagnostics.some(item => item.severity === 'error') ? ' rv-cue-row--invalid' : ''}`}>
            <div className="rv-cue-row-header">
              <button
                type="button"
                className={`rv-ctrl-toggle${cue.enabled ? ' rv-ctrl-toggle--on' : ''}`}
                aria-label={`${cue.enabled ? 'Disable' : 'Enable'} cue ${cue.label}`}
                onClick={() => update({ enabled: !cue.enabled })}
              >
                {cue.enabled ? 'On' : 'Off'}
              </button>
              <div className="rv-show-cue__identity">
                <input className="rv-cue-name-input" value={cue.label} onChange={event => update({ label: event.target.value })} aria-label="Cue label" />
                <button
                  type="button"
                  className="rv-show-cue__select rv-show-cue__summary"
                  aria-label={`Select cue ${cue.label}`}
                  aria-pressed={selected}
                  onClick={() => selectCue(cue.id)}
                >
                  <span>{timingSummary(cue.timing)}</span><span>{actionSummary(cue)}</span>
                </button>
              </div>
              <div className="rv-show-cue__toolbar" role="group" aria-label={`Actions for ${cue.label}`}>
                <span className="rv-cue-badge rv-cue-badge--action">P{cue.priority}</span>
                {cue.source === 'legacyBeamMigration' && <span className="rv-cue-badge rv-cue-badge--timing">Legacy</span>}
                {cueDiagnostics.length > 0 && <span className="rv-cue-error-icon" title={cueDiagnostics.map(item => item.message).join('\n')}>⚠ {cueDiagnostics.length}</span>}
                <button type="button" className="rv-glyph-upload-btn rv-show-cue__fire" aria-label={`Fire ${cue.label}`} onClick={() => fireCue(cue.id)}>Fire</button>
                <button type="button" className="rv-glyph-upload-btn" title="Move earlier" aria-label={`Move ${cue.label} earlier`} disabled={index === 0} onClick={() => reorderCue(cue.id, -1)}>↑</button>
                <button type="button" className="rv-glyph-upload-btn" title="Move later" aria-label={`Move ${cue.label} later`} disabled={index === cues.length - 1} onClick={() => reorderCue(cue.id, 1)}>↓</button>
                <button type="button" className="rv-glyph-upload-btn" title="Duplicate cue" aria-label={`Duplicate ${cue.label}`} onClick={() => duplicateCue(cue.id)}>⧉</button>
                <button type="button" className="rv-glyph-upload-btn" title={expanded ? 'Collapse cue' : 'Expand cue'} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${cue.label}`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : cue.id)}>{expanded ? '▲' : '▼'}</button>
                <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" title="Delete cue" aria-label={`Delete ${cue.label}`} onClick={() => deleteCue(cue.id)}>×</button>
              </div>
            </div>
            {expanded && <div className="rv-cue-body">
              <label className="rv-show-director__description">Description<textarea value={cue.description ?? ''} onChange={event => update({ description: event.target.value })} /></label>
              <CueTimingEditor cue={cue} groups={groups} update={update} />
              {cueDiagnostics.length > 0 && <div className="rv-show-cue__issues">{cueDiagnostics.map(item => <div key={`${item.code}:${item.actionId ?? ''}:${item.message}`} className={`rv-show-cue__issue rv-show-cue__issue--${item.severity}`}>{item.message}</div>)}</div>}
              <div className="rv-show-director__action-heading"><strong>Ordered actions</strong><button type="button" className="rv-glyph-upload-btn" onClick={() => update({ actions: [...cue.actions, makeAction('activateLook', groups[0]?.id ?? '', fixtures[0]?.id ?? '', looks[0]?.id ?? '', targets[0]?.id ?? '')] })}>+ Action</button></div>
              {cue.actions.map((action, actionIndex) => <ActionEditor
                key={action.id}
                action={action}
                groups={groups}
                fixtures={fixtures}
                looks={looks}
                targets={targets}
                update={next => update({ actions: cue.actions.map((candidate, index) => index === actionIndex ? next : candidate) })}
                moveUp={() => {
                  if (actionIndex === 0) return
                  const actions = [...cue.actions]
                  ;[actions[actionIndex - 1], actions[actionIndex]] = [actions[actionIndex], actions[actionIndex - 1]]
                  update({ actions })
                }}
                moveDown={() => {
                  if (actionIndex === cue.actions.length - 1) return
                  const actions = [...cue.actions]
                  ;[actions[actionIndex], actions[actionIndex + 1]] = [actions[actionIndex + 1], actions[actionIndex]]
                  update({ actions })
                }}
                duplicate={() => {
                  const duplicate = { ...JSON.parse(JSON.stringify(action)) as ProductionCueAction, id: crypto.randomUUID() }
                  update({ actions: [...cue.actions.slice(0, actionIndex + 1), duplicate, ...cue.actions.slice(actionIndex + 1)] })
                }}
                remove={() => update({ actions: cue.actions.filter((_, index) => index !== actionIndex) })}
              />)}
            </div>}
          </div>
        )
      })}
    </div>
  )
}
