import { useMemo } from 'react'
import { RailTabs } from '../../layout/RailTabs'
import { Collapsible, CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import type { ReactEngineId } from '../ReactTypes'
import { MockEngineDropdown } from './MockEngineDropdown'
import { resolveLayoutLabComposition } from './layoutLabComposition'
import {
  LASER_DMX_MOCK_FIXTURE_LABELS,
  type LaserDmxMockBeam,
  type LaserDmxMockFixtureKind,
  type LaserDmxMockGroup,
  type LaserDmxMockState,
} from './useLaserDmxMockState'

function ModeSelector({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-laser-rig-toolbar rv-laser-workspace-mode-help drm-help-overlay-anchor">
      <div className="rv-segmented-control rv-laser-rig-surfaces" role="tablist" aria-label="LaserDMX Beam Matrix surfaces">
        <button type="button" role="tab" aria-selected={state.mode === 'matrix'} className={state.mode === 'matrix' ? 'is-active' : ''} onClick={() => state.setMode('matrix')}>MATRIX</button>
        <button type="button" role="tab" aria-selected={state.mode === 'showDirector'} className={state.mode === 'showDirector' ? 'is-active' : ''} onClick={() => state.setMode('showDirector')}>SHOW DIRECTOR</button>
      </div>
      <span className="rv-ctrl-info" aria-label="LaserDMX Layout Lab local mode">LOCAL MOCK</span>
    </div>
  )
}

function MatrixProgram({ state }: { state: LaserDmxMockState }) {
  return (
    <>
      <Collapsible label="Program" defaultOpen>
        <div className="rv-bm-stats">
          <span>Beams: <strong>{state.beams.length} / 300</strong></span>
          <span>Groups: <strong>{state.groups.length}</strong></span>
          {state.selectedBeamIds.length > 0 && <span className="rv-bm-sel-badge">{state.selectedBeamIds.length} selected</span>}
        </div>
        <div className="rv-bm-toolbar">
          <button type="button" className="rv-glyph-upload-btn" aria-label="Add beam" onClick={state.addBeam}>+ Add Beam</button>
          {state.selectedBeamIds.length > 0 && <button type="button" className="rv-glyph-upload-btn" aria-label="Duplicate selected beam" onClick={() => state.duplicateSelectedBeams(false)}>⧉ Dup</button>}
          {state.selectedBeamIds.length > 0 && <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" aria-label={`Delete ${state.selectedBeamIds.length} selected beams`} onClick={state.deleteSelectedBeams}>× Del</button>}
          {state.selectedBeamIds.length > 0 && <button type="button" className="rv-glyph-upload-btn" aria-label="Clear beam selection" onClick={state.clearMatrixSelection}>Desel</button>}
          <button type="button" className="rv-glyph-upload-btn" aria-label="Select all beams" onClick={state.selectAllBeams}>All</button>
        </div>
        {state.resetMatrixConfirm ? (
          <div className="rv-bm-confirm">
            <span>Reset entire Beam Matrix program?</span>
            <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.resetMatrix}>Confirm Reset</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => state.setResetMatrixConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="rv-glyph-upload-btn rv-bm-reset-btn" aria-label="Reset Beam Matrix" onClick={() => state.setResetMatrixConfirm(true)}>Reset Matrix</button>
        )}
      </Collapsible>

      <div className="rv-show-director-design-panel rv-laser-global-controls">
        <CtrlSection label="Beam Matrix Design" />
        <Collapsible label="Canvas" defaultOpen>
          <ToggleRow label="Show Beam Editor" value={Boolean(state.controls.beamEditorVisible)} onChange={value => state.setControl('beamEditorVisible', value)} />
          <ToggleRow label="Snap to Grid" value={Boolean(state.controls.snapEnabled)} onChange={value => state.setControl('snapEnabled', value)} />
          <ToggleRow label="Show Grid" value={Boolean(state.controls.guidesVisible)} disabled={!Boolean(state.controls.beamEditorVisible)} onChange={value => state.setControl('guidesVisible', value)} />
          <ToggleRow label="Show Beam Paths" value={Boolean(state.controls.beamPathsVisible)} disabled={!Boolean(state.controls.beamEditorVisible)} onChange={value => state.setControl('beamPathsVisible', value)} />
          <SliderRow label="Overscan" value={Number(state.controls.overscanAmount)} min={0} max={0.5} step={0.01} onChange={value => state.setControl('overscanAmount', value)} />
        </Collapsible>
      </div>

      <Collapsible label="Reaction Groups" defaultOpen>
        <ReactionGroups state={state} />
      </Collapsible>

      <Collapsible label="Cue List" defaultOpen={false}>
        <div className="rv-ctrl-info">No authored cues yet. Performance programs and local route timing remain available without starting a cue scheduler.</div>
      </Collapsible>
    </>
  )
}

function ReactionGroups({ state }: { state: LaserDmxMockState }) {
  const group = state.selectedGroup
  return (
    <>
      <CtrlSection label="Reaction Groups" />
      <div className="rv-bm-group-list">
        {state.groups.map(candidate => (
          <div key={candidate.id} className={candidate.id === state.selectedGroupId ? 'rv-bm-group-row is-selected' : 'rv-bm-group-row'}>
            <button type="button" className="rv-bm-group-main" aria-label={`Select group ${candidate.name}`} onClick={() => state.selectGroup(candidate.id)}>
              <span className="rv-bm-group-swatch" style={{ background: `rgb(${candidate.color.red}, ${candidate.color.green}, ${candidate.color.blue})` }} />
              <span>{candidate.name}</span>
              <small>{state.beams.filter(beam => beam.groupId === candidate.id).length}</small>
            </button>
            <button type="button" aria-label={`${candidate.muted ? 'Unmute' : 'Mute'} group ${candidate.name}`} className={candidate.muted ? 'is-active' : ''} onClick={() => state.updateGroup(candidate.id, { muted: !candidate.muted })}>M</button>
            <button type="button" aria-label={`${candidate.soloed ? 'Unsolo' : 'Solo'} group ${candidate.name}`} className={candidate.soloed ? 'is-active' : ''} onClick={() => state.updateGroup(candidate.id, { soloed: !candidate.soloed })}>S</button>
          </div>
        ))}
      </div>
      <div className="rv-bm-button-row rv-bm-button-row--wrap">
        <button type="button" className="rv-glyph-upload-btn" aria-label="Add reaction group" onClick={state.addGroup}>+ Add Group</button>
        <button type="button" className="rv-glyph-upload-btn" disabled={!group} onClick={() => group && state.duplicateGroup(group.id)}>Duplicate</button>
        <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!group} onClick={() => group && state.deleteGroup(group.id)}>Delete</button>
      </div>
      {group && <GroupEditor group={group} state={state} />}
    </>
  )
}

function GroupEditor({ group, state }: { group: LaserDmxMockGroup; state: LaserDmxMockState }) {
  const patchLaunch = (update: Partial<LaserDmxMockGroup['launch']>) => state.updateGroup(group.id, { launch: { ...group.launch, ...update } })
  const patchSequence = (update: Partial<LaserDmxMockGroup['sequence']>) => state.updateGroup(group.id, { sequence: { ...group.sequence, ...update } })
  const patchColor = (update: Partial<LaserDmxMockGroup['color']>) => state.updateGroup(group.id, { color: { ...group.color, ...update } })
  return (
    <>
      <CtrlSection label={`Edit: ${group.name}`} />
      <TextInputRow label="Name" value={group.name} placeholder="Group name" onChange={name => state.updateGroup(group.id, { name })} />
      <ToggleRow label="Group Enabled" value={group.enabled} onChange={enabled => state.updateGroup(group.id, { enabled })} />
      <ToggleRow label="Muted" value={group.muted} onChange={muted => state.updateGroup(group.id, { muted })} />
      <ToggleRow label="Solo" value={group.soloed} onChange={soloed => state.updateGroup(group.id, { soloed })} />
      <ToggleRow label="Color Override" value={group.colorOverride} onChange={colorOverride => state.updateGroup(group.id, { colorOverride })} />
      {group.colorOverride && (
        <>
          <SliderRow label="Red" value={group.color.red} min={0} max={255} step={1} onChange={red => patchColor({ red: Math.round(red) })} />
          <SliderRow label="Green" value={group.color.green} min={0} max={255} step={1} onChange={green => patchColor({ green: Math.round(green) })} />
          <SliderRow label="Blue" value={group.color.blue} min={0} max={255} step={1} onChange={blue => patchColor({ blue: Math.round(blue) })} />
          <SliderRow label="White" value={group.color.white} min={0} max={255} step={1} onChange={white => patchColor({ white: Math.round(white) })} />
          <SliderRow label="Alpha" value={group.color.alpha} min={0} max={1} step={0.01} onChange={alpha => patchColor({ alpha })} />
        </>
      )}
      <Collapsible label="Audio Launch" defaultOpen={group.launch.trigger !== 'none'}>
        <SelectRow label="Trigger" value={group.launch.trigger} options={[
          { value: 'none', label: 'None' }, { value: 'bassHit', label: 'Bass Hit' }, { value: 'snareTransient', label: 'Snare Transient' }, { value: 'downbeat', label: 'Downbeat' },
        ]} onChange={trigger => patchLaunch({ trigger })} />
        <SliderRow label="Threshold" value={group.launch.threshold} onChange={threshold => patchLaunch({ threshold })} />
        <SliderRow label="Min Energy" value={group.launch.minEnergy} onChange={minEnergy => patchLaunch({ minEnergy })} />
        <SliderRow label="Cooldown Beats" value={group.launch.cooldownBeats} min={0} max={16} step={1} onChange={cooldownBeats => patchLaunch({ cooldownBeats })} />
        <SliderRow label="Max Active Beams" value={group.launch.maxActiveBeams} min={1} max={32} step={1} onChange={maxActiveBeams => patchLaunch({ maxActiveBeams })} />
      </Collapsible>
      <Collapsible label="Sequencer" defaultOpen={group.sequence.enabled}>
        <ToggleRow label="Sequencer Enabled" value={group.sequence.enabled} onChange={enabled => patchSequence({ enabled })} />
        <SelectRow label="Mode" value={group.sequence.mode} options={[{ value: 'rotate', label: 'Rotate' }, { value: 'pingPong', label: 'Ping Pong' }, { value: 'random', label: 'Random' }]} onChange={mode => patchSequence({ mode })} />
        <SliderRow label="Steps / Beat" value={group.sequence.stepsPerBeat} min={0.25} max={8} step={0.25} onChange={stepsPerBeat => patchSequence({ stepsPerBeat })} />
        <SliderRow label="Step Gate" value={group.sequence.stepGate} onChange={stepGate => patchSequence({ stepGate })} />
        <SliderRow label="Phase Spread" value={group.sequence.phaseSpread} onChange={phaseSpread => patchSequence({ phaseSpread })} />
        <SliderRow label="Rotate Every (bars)" value={group.sequence.rotateEveryBars} min={1} max={32} step={1} onChange={rotateEveryBars => patchSequence({ rotateEveryBars })} />
        <SliderRow label="Random Seed" value={group.sequence.randomSeed} min={0} max={9999} step={1} onChange={randomSeed => patchSequence({ randomSeed })} />
        <ToggleRow label="Reset on Downbeat" value={group.sequence.resetOnDownbeat} onChange={resetOnDownbeat => patchSequence({ resetOnDownbeat })} />
      </Collapsible>
    </>
  )
}

function ShowDirectorRig({ state }: { state: LaserDmxMockState }) {
  return (
    <aside className="rv-show-director-panel rv-show-director-palette" aria-label="Show Director component palette">
      <div className="rv-show-director-panel__header"><h4>Lighting Components</h4></div>
      <label className="rv-show-director-search">
        <span>Search components</span>
        <input type="search" value={state.fixtureSearch} onChange={event => state.setFixtureSearch(event.target.value)} placeholder="Laser, strobe, CO2..." spellCheck={false} />
      </label>
      <div className="rv-show-director-palette__list" role="list">
        {state.filteredFixtureKinds.map(kind => (
          <button key={kind} type="button" className="rv-show-director-component-card" role="listitem" aria-label={`Add ${LASER_DMX_MOCK_FIXTURE_LABELS[kind]} to the Show Director canvas`} onClick={() => state.addFixture(kind)}>
            <span className="rv-show-director-component-card__icon" aria-hidden="true">{fixtureGlyph(kind)}</span>
            <span className="rv-show-director-component-card__label">{LASER_DMX_MOCK_FIXTURE_LABELS[kind]}</span>
          </button>
        ))}
      </div>
      {state.filteredFixtureKinds.length === 0 && <div className="rv-show-director-empty rv-show-director-empty--compact">No components matched “{state.fixtureSearch}”.</div>}
      <div className="rv-show-director-palette__design"><ShowDirectorGlobalControls state={state} /></div>
    </aside>
  )
}

function fixtureGlyph(kind: LaserDmxMockFixtureKind): string {
  switch (kind) {
    case 'laser': return '⌁'
    case 'movingHead': return '◉'
    case 'ledBar': return '▰'
    case 'ledTube': return '▯'
    case 'strobe': return '✦'
    case 'blinder': return '✺'
    case 'parWash': return '●'
    case 'videoWall': return '▣'
    case 'haze': return '≋'
    case 'co2Jet': return '↑'
  }
}

function ShowDirectorGlobalControls({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-show-director-design-panel rv-laser-global-controls">
      <CtrlSection label="Show Director Design" />
      <Collapsible label="Canvas" defaultOpen>
        <ToggleRow label="Snap to Grid" value={Boolean(state.controls.snapToGrid)} onChange={value => state.setControl('snapToGrid', value)} />
        <ToggleRow label="Show Grid" value={Boolean(state.controls.showGrid)} onChange={value => state.setControl('showGrid', value)} />
        <ToggleRow label="Show Labels" value={Boolean(state.controls.showLabels)} onChange={value => state.setControl('showLabels', value)} />
        <ToggleRow label="Show Beams" value={Boolean(state.controls.showBeams)} onChange={value => state.setControl('showBeams', value)} />
        <ToggleRow label="Highlight Fixtures" value={Boolean(state.controls.highlightFixtures)} onChange={value => state.setControl('highlightFixtures', value)} />
        <SliderRow label="Grid Size" value={Number(state.controls.gridSize)} min={8} max={64} step={1} onChange={value => state.setControl('gridSize', value)} />
        <SliderRow label="Stage Zoom" value={Number(state.controls.stageZoom)} min={0.25} max={3} step={0.05} onChange={value => state.setControl('stageZoom', value)} />
        <button type="button" className="rv-glyph-upload-btn" onClick={() => state.setControl('stageZoom', 1)}>Fit Stage</button>
      </Collapsible>
      <Collapsible label="Presentation & Renderer" defaultOpen>
        <SelectRow label="Presentation Mode" value={String(state.controls.presentationMode)} options={[{ value: 'editing', label: 'Editing' }, { value: 'performance', label: 'Performance' }]} onChange={value => state.setControl('presentationMode', value)} />
        <SelectRow label="Lighting Renderer" value={String(state.controls.lightingRenderer)} options={[{ value: 'webgl', label: 'WebGL' }, { value: 'canvas2d', label: 'Canvas 2D' }]} onChange={value => state.setControl('lightingRenderer', value)} />
        <SelectRow label="WebGL Quality" value={String(state.controls.webglQuality)} disabled={state.controls.lightingRenderer !== 'webgl'} options={[{ value: 'draft', label: 'Draft' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} onChange={value => state.setControl('webglQuality', value)} />
        <SelectRow label="Atmosphere Quality" value={String(state.controls.atmosphereQuality)} disabled={state.controls.lightingRenderer !== 'webgl'} options={[{ value: 'off', label: 'Off' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} onChange={value => state.setControl('atmosphereQuality', value)} />
        <SliderRow label="WebGL Render Scale" value={Number(state.controls.webglRenderScale)} disabled={state.controls.lightingRenderer !== 'webgl'} min={0.5} max={1.5} step={0.05} onChange={value => state.setControl('webglRenderScale', value)} />
        <div className="rv-ctrl-info">Renderer Diagnostics: local static fixture · WebGL2 available · context healthy · no renderer mounted.</div>
      </Collapsible>
      <Collapsible label="Layout" defaultOpen={false}>
        <div className="rv-show-director-design-actions" aria-label="Show Director layout actions">
          <button type="button" className="rv-glyph-upload-btn" disabled={!state.fixtures.length} onClick={state.duplicateRig}>Duplicate Rig</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!state.fixtures.length} onClick={() => state.mirrorRig('horizontal')}>Mirror Rig H</button>
          <button type="button" className="rv-glyph-upload-btn" disabled={!state.fixtures.length} onClick={() => state.mirrorRig('vertical')}>Mirror Rig V</button>
          {state.resetLayoutConfirm ? (
            <>
              <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.resetRig}>Confirm Reset Layout</button>
              <button type="button" className="rv-glyph-upload-btn" onClick={() => state.setResetLayoutConfirm(false)}>Cancel</button>
            </>
          ) : <button type="button" className="rv-glyph-upload-btn" disabled={!state.fixtures.length} onClick={() => state.setResetLayoutConfirm(true)}>Reset Layout</button>}
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!state.fixtures.length} onClick={state.clearRig}>Clear Rig</button>
        </div>
      </Collapsible>
    </div>
  )
}

function LayersMockup({ state }: { state: LaserDmxMockState }) {
  const groupOptions = [{ value: 'all', label: 'All groups' }, { value: 'none', label: 'No group' }, ...state.groups.map(group => ({ value: group.id, label: group.name }))]
  return (
    <div className="rv-bm-layers-panel" data-layout-lab-laserdmx="layers">
      <div className="rv-bm-layers-header">
        <span className="rv-bm-layers-title">LAYERS</span>
        <button type="button" className={state.layerFiltersOpen ? 'rv-glyph-upload-btn is-active' : 'rv-glyph-upload-btn'} aria-label="Toggle filters" aria-pressed={state.layerFiltersOpen} onClick={() => state.setLayerFiltersOpen(!state.layerFiltersOpen)}>FILTER</button>
      </div>
      {state.layerFiltersOpen && (
        <div className="rv-bm-layers-filters">
          <input value={state.layerNameFilter} onChange={event => state.setLayerNameFilter(event.target.value)} placeholder="Filter by name…" aria-label="Filter beams by name" />
          <SelectRow label="Group Filter" value={state.layerGroupFilter} options={groupOptions} onChange={state.setLayerGroupFilter} />
          <SelectRow label="Enabled State" value={state.layerEnabledFilter} options={[{ value: 'all', label: 'All states' }, { value: 'enabled', label: 'Enabled' }, { value: 'disabled', label: 'Disabled' }]} onChange={state.setLayerEnabledFilter} />
          <button type="button" className="rv-glyph-upload-btn" onClick={() => { state.setLayerNameFilter(''); state.setLayerGroupFilter('all'); state.setLayerEnabledFilter('all') }}>Clear filters</button>
        </div>
      )}
      <CtrlSection label={`Groups · ${state.groups.length}`} />
      {state.groups.length === 0 ? <div className="rv-ctrl-info">No groups — add one in the ENGINE tab.</div> : (
        <div className="rv-bm-layer-group-list">
          {state.groups.map(group => (
            <div key={group.id} className={group.id === state.selectedGroupId ? 'rv-bm-layer-group rv-layout-lab-laser-group-row is-selected' : 'rv-bm-layer-group rv-layout-lab-laser-group-row'}>
              <button type="button" className="rv-layout-lab-laser-group-main" aria-label={`Group ${group.name}`} onClick={() => state.selectGroup(group.id)}>
                <span className="rv-bm-group-swatch" style={{ background: `rgb(${group.color.red},${group.color.green},${group.color.blue})` }} />
                <span>{group.name}</span><small>{state.beams.filter(beam => beam.groupId === group.id).length} items</small><em>{group.enabled ? 'ON' : 'OFF'}</em>
              </button>
              <button type="button" className={group.muted ? 'rv-layout-lab-laser-group-state is-active' : 'rv-layout-lab-laser-group-state'} aria-label={`${group.muted ? 'Unmute' : 'Mute'} group ${group.name}`} aria-pressed={group.muted} onClick={() => state.updateGroup(group.id, { muted: !group.muted })}>M</button>
              <button type="button" className={group.soloed ? 'rv-layout-lab-laser-group-state is-active' : 'rv-layout-lab-laser-group-state'} aria-label={`${group.soloed ? 'Unsolo' : 'Solo'} group ${group.name}`} aria-pressed={group.soloed} onClick={() => state.updateGroup(group.id, { soloed: !group.soloed })}>S</button>
            </div>
          ))}
        </div>
      )}
      <CtrlSection label={`Beams · ${state.filteredBeams.length} / ${state.beams.length}`} />
      {state.beams.length === 0 ? <div className="rv-ctrl-info">No beams in the Beam Matrix program.</div> : state.filteredBeams.length === 0 ? <div className="rv-ctrl-info">No beams match the current filters.</div> : (
        <div className="rv-bm-layer-beam-list" role="list" aria-label="Beam list">
          {state.filteredBeams.map(beam => <BeamLayerRow key={beam.id} beam={beam} state={state} />)}
        </div>
      )}
      {state.mode === 'showDirector' && (
        <>
          <CtrlSection label={`Fixtures · ${state.fixtures.length}`} />
          <div className="rv-bm-layer-beam-list" role="list" aria-label="Show Director fixture list">
            {state.fixtures.map(fixture => (
              <button key={fixture.id} type="button" className={state.selectedFixtureIds.includes(fixture.id) ? 'rv-bm-layer-beam is-selected' : 'rv-bm-layer-beam'} onClick={event => state.selectFixture(fixture.id, event.metaKey || event.ctrlKey || event.shiftKey)}>
                <span>{fixture.name}</span><small>{LASER_DMX_MOCK_FIXTURE_LABELS[fixture.kind]} · {fixture.groupName}</small><em>{fixture.enabled ? 'ENABLED' : 'DISABLED'}</em>
              </button>
            ))}
            {state.fixtures.length === 0 && <div className="rv-ctrl-info">No fixtures in the Show Director rig.</div>}
          </div>
        </>
      )}
    </div>
  )
}

function BeamLayerRow({ beam, state }: { beam: LaserDmxMockBeam; state: LaserDmxMockState }) {
  const group = state.groups.find(candidate => candidate.id === beam.groupId)
  const selected = state.selectedBeamIds.includes(beam.id)
  return (
    <button type="button" className={selected ? 'rv-bm-layer-beam is-selected' : 'rv-bm-layer-beam'} onClick={event => state.selectBeam(beam.id, event.metaKey || event.ctrlKey || event.shiftKey)}>
      <span>{beam.name}</span>
      <small>#{beam.sequenceIndex + 1} · O {beam.origin.column},{beam.origin.row} → {beam.target.kind === 'grid' ? `${beam.target.column},${beam.target.row}` : `${beam.target.x.toFixed(2)},${beam.target.y.toFixed(2)}`} · {group?.name ?? 'No group'}</small>
      <em>{beam.enabled ? 'ENABLED' : 'DISABLED'}</em>
    </button>
  )
}

export function LaserDmxMockup({ engineId, onSelectEngine, state }: { engineId: ReactEngineId; onSelectEngine: (id: ReactEngineId) => void; state: LaserDmxMockState }) {
  const composition = useMemo(() => resolveLayoutLabComposition(engineId), [engineId])
  return (
    <div className="rv-left-workspace-shell" data-description-density="compact" data-layout-lab-laserdmx="left">
      <section className="rv-context-workspace">
        <header className="rv-context-workspace-header"><MockEngineDropdown engineId={engineId} onSelect={onSelectEngine} /></header>
        <RailTabs tabs={composition.leftTabs} activeTab={state.leftTab} onChange={value => state.setLeftTab(value as 'workspace' | 'layers')} ariaLabel="LaserDMX workspace tabs" />
        <div className="rv-context-workspace-body rv-inspector-scroll">
          {state.leftTab === 'layers' ? <LayersMockup state={state} /> : (
            <div className="rv-laser-workspace">
              <ModeSelector state={state} />
              <div className="rv-laser-workspace-surface" role="tabpanel">{state.mode === 'matrix' ? <MatrixProgram state={state} /> : <ShowDirectorRig state={state} />}</div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
