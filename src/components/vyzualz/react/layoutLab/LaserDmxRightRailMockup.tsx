import { useState, type ReactNode } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import {
  Collapsible,
  ColorRow,
  CtrlSection,
  NumberInputRow,
  SelectRow,
  SliderRow,
  TextInputRow,
  ToggleRow,
} from '../ReactControlRows'
import { PanelSubtabs } from '../PanelSubtabs'
import type { LaserDmxMockBeam, LaserDmxMockFixture, LaserDmxMockGroup, LaserDmxMockRoute, LaserDmxMockState } from './useLaserDmxMockState'
import { LASER_DMX_MOCK_FIXTURE_LABELS } from './useLaserDmxMockState'

type RightTab = 'presets' | 'design' | 'react' | 'output'

const RIGHT_TABS: RailTabOption<RightTab>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

const SOURCE_OPTIONS = [
  'Bass', 'Mid', 'High', 'Energy', 'Kick', 'Snare Hit', 'Beat', 'Downbeat', 'Four Bars', 'Section Boundary',
].map(value => ({ value, label: value }))

const TARGET_OPTIONS = [
  'Master Dimmer', 'Global Glow', 'Beam Width', 'Beam Strobe', 'Group Dimmer', 'Group Glow', 'Motion', 'Fog Density',
].map(value => ({ value, label: value }))

function ControlGroup({ children }: { children: ReactNode }) {
  return <div className="rv-ctrl-group">{children}</div>
}

function PresetCard({ name, description, favorite, modified, active, onSelect, onToggleFavorite }: { name: string; description: string; favorite: boolean; modified: boolean; active: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  return (
    <div className="rv-layout-lab-laserdmx-preset-card-shell">
      <button type="button" className={active ? 'rv-preset-card rv-preset-card--active' : 'rv-preset-card'} aria-label={`Load LaserDMX preset ${name}`} aria-pressed={active} onClick={onSelect}>
        <div className="rv-preset-card-thumb rv-layout-lab-laserdmx-preset-thumb" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="rv-preset-card-copy"><strong>{name}</strong><span>{description}</span><small>{modified ? 'MODIFIED' : 'BUILT-IN'} {active ? '· CURRENT' : ''}</small></div>
      </button>
      <button type="button" className="rv-layout-lab-laserdmx-favorite" aria-label={`${favorite ? 'Remove' : 'Add'} ${name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={onToggleFavorite}>{favorite ? '★' : '☆'}</button>
    </div>
  )
}

function PresetsTab({ state }: { state: LaserDmxMockState }) {
  const favorites = state.presets.filter(preset => preset.favorite).length
  const matrixPresets = state.visiblePresets.filter(preset => preset.family === 'matrix')
  const performancePresets = state.visiblePresets.filter(preset => preset.family === 'performance')
  const rigPresets = state.visiblePresets.filter(preset => preset.family === 'rig')
  return (
    <div className="rv-presets-panel" data-layout-lab-laserdmx="presets">
      <header className="rv-preset-library-header">
        <div className="rv-preset-library-engine"><span aria-hidden="true">⌬</span><div><strong>LaserDMX</strong><small>{state.mode === 'matrix' ? `${matrixPresets.length} Beam Matrix presets` : `${performancePresets.length} Performance Shows · ${rigPresets.length} Rig Layouts`}</small></div></div>
        <div className="rv-preset-library-views" role="tablist" aria-label="Preset library filter">
          <button type="button" role="tab" aria-selected={state.presetFilter === 'current'} className={state.presetFilter === 'current' ? 'is-active' : ''} onClick={() => state.setPresetFilter('current')}>Current Engine</button>
          <button type="button" role="tab" aria-selected={state.presetFilter === 'favorites'} className={state.presetFilter === 'favorites' ? 'is-active' : ''} onClick={() => state.setPresetFilter('favorites')}>Favorites {favorites}</button>
          <button type="button" role="tab" aria-selected={state.presetFilter === 'all'} className={state.presetFilter === 'all' ? 'is-active' : ''} onClick={() => state.setPresetFilter('all')}>All Engines</button>
        </div>
      </header>
      <p className="rv-presets-hint">{state.mode === 'matrix'
        ? 'Beam Matrix looks only. Switch to Show Director for Performance Shows and Rig Layouts.'
        : 'Performance Shows combine a deterministic program with a rig. Rig Layouts remain static, and Matrix mode contains Beam Matrix looks.'}</p>
      {state.presetFilter === 'all' && <div className="rv-ctrl-info">All Engines is a local browser state in Layout Lab. LaserDMX cards remain visible without switching production engines.</div>}
      {state.visiblePresets.length === 0 && <div className="rv-preset-library-empty"><strong>No favorite presets yet</strong><span>Choose ☆ on a preset to pin it here.</span></div>}
      {state.mode === 'matrix' ? (
        <section className="rv-preset-group" aria-label="Beam Matrix Presets">
          <header className="rv-preset-group-hdr"><span className="rv-preset-group-hdr-label">Beam Matrix Presets</span><span>{matrixPresets.length}</span></header>
          <div className="rv-preset-group-cards">{matrixPresets.map(preset => <PresetCard key={preset.id} name={preset.name} description={preset.description} favorite={preset.favorite} modified={preset.modified} active={state.activePresetId === preset.id} onSelect={() => state.applyPreset(preset.id)} onToggleFavorite={() => state.togglePresetFavorite(preset.id)} />)}</div>
        </section>
      ) : (
        <>
          <section className="rv-preset-group rv-show-director-performance-preset-group" aria-label="Show Director Performance Shows">
            <header className="rv-preset-group-hdr"><span className="rv-preset-group-hdr-label">Show Director Performance Shows</span><span>{performancePresets.length}</span></header>
            <div className="rv-preset-group-cards">{performancePresets.map(preset => <PresetCard key={preset.id} name={preset.name} description={preset.description} favorite={preset.favorite} modified={preset.modified} active={state.activePresetId === preset.id} onSelect={() => state.applyPreset(preset.id)} onToggleFavorite={() => state.togglePresetFavorite(preset.id)} />)}</div>
          </section>
          <section className="rv-preset-group rv-show-director-preset-group" aria-label="Show Director starter rig layouts">
            <header className="rv-preset-group-hdr"><span className="rv-preset-group-hdr-label">Show Director Rig Layouts</span><span>{rigPresets.length}</span></header>
            <div className="rv-preset-group-cards">{rigPresets.map(preset => <PresetCard key={preset.id} name={preset.name} description={preset.description} favorite={preset.favorite} modified={preset.modified} active={state.activePresetId === preset.id} onSelect={() => state.applyPreset(preset.id)} onToggleFavorite={() => state.togglePresetFavorite(preset.id)} />)}</div>
          </section>
        </>
      )}
    </div>
  )
}

function MatrixEngineDesign({ state }: { state: LaserDmxMockState }) {
  return (
    <ControlGroup>
      <Collapsible label="React Master" defaultOpen>
        <SliderRow label="Preview Output Trim" value={Number(state.controls.previewOutputTrim)} onChange={value => state.setControl('previewOutputTrim', value)} />
        <SliderRow label="Motion" value={Number(state.controls.motion)} onChange={value => state.setControl('motion', value)} />
        <SliderRow label="Preview Glow Trim" value={Number(state.controls.previewGlowTrim)} onChange={value => state.setControl('previewGlowTrim', value)} />
        <SliderRow label="Bass React" value={Number(state.controls.bassReact)} onChange={value => state.setControl('bassReact', value)} />
      </Collapsible>
      <Collapsible label="Output Styling" defaultOpen>
        <SliderRow label="Authored Show Dimmer" value={Number(state.controls.masterDimmer)} onChange={value => state.setControl('masterDimmer', value)} />
        <SliderRow label="Safety Clamp" value={Number(state.controls.safetyClamp)} onChange={value => state.setControl('safetyClamp', value)} />
        <SliderRow label="Bg Fade" value={Number(state.controls.backgroundFade)} onChange={value => state.setControl('backgroundFade', value)} />
        <SliderRow label="Persistence" value={Number(state.controls.beamPersistence)} onChange={value => state.setControl('beamPersistence', value)} />
      </Collapsible>
      <Collapsible label="Global Beam" defaultOpen>
        <SliderRow label="Beam Width" value={Number(state.controls.globalBeamWidth)} min={0.1} max={6} step={0.05} onChange={value => state.setControl('globalBeamWidth', value)} />
        <SliderRow label="Authored Show Glow" value={Number(state.controls.globalGlow)} onChange={value => state.setControl('globalGlow', value)} />
        <SliderRow label="Strobe Rate" value={Number(state.controls.globalStrobeRate)} onChange={value => state.setControl('globalStrobeRate', value)} />
      </Collapsible>
      <Collapsible label="Fog" defaultOpen={false}>
        <ToggleRow label="Fog Enabled" value={Boolean(state.controls.fogEnabled)} onChange={value => state.setControl('fogEnabled', value)} />
        <SliderRow label="Density" value={Number(state.controls.fogDensity)} onChange={value => state.setControl('fogDensity', value)} />
        <SliderRow label="Opacity" value={Number(state.controls.fogOpacity)} onChange={value => state.setControl('fogOpacity', value)} />
        <SliderRow label="Noise Scale" value={Number(state.controls.fogNoiseScale)} min={0.1} max={4} step={0.05} onChange={value => state.setControl('fogNoiseScale', value)} />
        <SliderRow label="Drift Speed" value={Number(state.controls.fogDriftSpeed)} onChange={value => state.setControl('fogDriftSpeed', value)} />
        <SliderRow label="Drift Direction" value={Number(state.controls.fogDriftDirection)} onChange={value => state.setControl('fogDriftDirection', value)} />
        <SliderRow label="Turbulence" value={Number(state.controls.fogTurbulence)} onChange={value => state.setControl('fogTurbulence', value)} />
        <SliderRow label="Diffusion" value={Number(state.controls.fogDiffusion)} onChange={value => state.setControl('fogDiffusion', value)} />
        <SliderRow label="Dissipation" value={Number(state.controls.fogDissipation)} onChange={value => state.setControl('fogDissipation', value)} />
        <SliderRow label="Beam Scatter" value={Number(state.controls.fogBeamScatter)} onChange={value => state.setControl('fogBeamScatter', value)} />
        <SliderRow label="Color Absorption" value={Number(state.controls.fogColorAbsorption)} onChange={value => state.setControl('fogColorAbsorption', value)} />
        <SelectRow label="Quality" value={String(state.controls.fogQuality)} options={[{ value: 'draft', label: 'Draft' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} onChange={value => state.setControl('fogQuality', value)} />
      </Collapsible>
      <button type="button" className="rv-reset-btn" onClick={() => { state.setControl('previewOutputTrim', 1); state.setControl('motion', 0.5); state.setControl('previewGlowTrim', 0.5); state.setControl('bassReact', 0.5) }}>Reset Master</button>
      <div className="rv-ctrl-info">Preview trims and authored output controls remain local to Layout Lab.</div>
    </ControlGroup>
  )
}

function MatrixSelectionDesign({ state }: { state: LaserDmxMockState }) {
  if (state.selectedGroup) return <GroupSelection group={state.selectedGroup} state={state} />
  if (state.selectedBeams.length === 1) return <SingleBeamSelection beam={state.selectedBeams[0]} state={state} />
  if (state.selectedBeams.length > 1) return <MultiBeamSelection beams={state.selectedBeams} state={state} />
  return <div className="rv-ctrl-info">Click a beam in the editor or choose a Reaction Group from RIG/LAYERS.</div>
}

function GroupSelection({ group, state }: { group: LaserDmxMockGroup; state: LaserDmxMockState }) {
  return (
    <ControlGroup>
      <CtrlSection label="Reaction Groups" />
      <CtrlSection label={`Edit: ${group.name}`} />
      <TextInputRow label="Name" value={group.name} onChange={name => state.updateGroup(group.id, { name })} />
      <ToggleRow label="Group Enabled" value={group.enabled} onChange={enabled => state.updateGroup(group.id, { enabled })} />
      <ToggleRow label="Muted" value={group.muted} onChange={muted => state.updateGroup(group.id, { muted })} />
      <ToggleRow label="Solo" value={group.soloed} onChange={soloed => state.updateGroup(group.id, { soloed })} />
      <ToggleRow label="Color Override" value={group.colorOverride} onChange={colorOverride => state.updateGroup(group.id, { colorOverride })} />
      <Collapsible label="Audio Launch" defaultOpen>
        <SelectRow label="Trigger" value={group.launch.trigger} options={[{ value: 'none', label: 'None' }, { value: 'bassHit', label: 'Bass Hit' }, { value: 'snareTransient', label: 'Snare Transient' }]} onChange={trigger => state.updateGroup(group.id, { launch: { ...group.launch, trigger } })} />
        <SliderRow label="Threshold" value={group.launch.threshold} onChange={threshold => state.updateGroup(group.id, { launch: { ...group.launch, threshold } })} />
        <SliderRow label="Min Energy" value={group.launch.minEnergy} onChange={minEnergy => state.updateGroup(group.id, { launch: { ...group.launch, minEnergy } })} />
        <SliderRow label="Cooldown Beats" value={group.launch.cooldownBeats} min={0} max={16} step={1} onChange={cooldownBeats => state.updateGroup(group.id, { launch: { ...group.launch, cooldownBeats } })} />
        <SliderRow label="Max Active Beams" value={group.launch.maxActiveBeams} min={1} max={32} step={1} onChange={maxActiveBeams => state.updateGroup(group.id, { launch: { ...group.launch, maxActiveBeams } })} />
      </Collapsible>
      <Collapsible label="Sequencer" defaultOpen>
        <ToggleRow label="Sequencer Enabled" value={group.sequence.enabled} onChange={enabled => state.updateGroup(group.id, { sequence: { ...group.sequence, enabled } })} />
        <SelectRow label="Mode" value={group.sequence.mode} options={[{ value: 'rotate', label: 'Rotate' }, { value: 'pingPong', label: 'Ping Pong' }, { value: 'random', label: 'Random' }]} onChange={mode => state.updateGroup(group.id, { sequence: { ...group.sequence, mode } })} />
        <SliderRow label="Steps / Beat" value={group.sequence.stepsPerBeat} min={0.25} max={8} step={0.25} onChange={stepsPerBeat => state.updateGroup(group.id, { sequence: { ...group.sequence, stepsPerBeat } })} />
        <SliderRow label="Step Gate" value={group.sequence.stepGate} onChange={stepGate => state.updateGroup(group.id, { sequence: { ...group.sequence, stepGate } })} />
        <SliderRow label="Phase Spread" value={group.sequence.phaseSpread} onChange={phaseSpread => state.updateGroup(group.id, { sequence: { ...group.sequence, phaseSpread } })} />
        <SliderRow label="Rotate Every (bars)" value={group.sequence.rotateEveryBars} min={1} max={32} step={1} onChange={rotateEveryBars => state.updateGroup(group.id, { sequence: { ...group.sequence, rotateEveryBars } })} />
        <SliderRow label="Random Seed" value={group.sequence.randomSeed} min={0} max={9999} step={1} onChange={randomSeed => state.updateGroup(group.id, { sequence: { ...group.sequence, randomSeed } })} />
        <ToggleRow label="Reset on Downbeat" value={group.sequence.resetOnDownbeat} onChange={resetOnDownbeat => state.updateGroup(group.id, { sequence: { ...group.sequence, resetOnDownbeat } })} />
      </Collapsible>
      <div className="rv-bm-button-row"><button type="button" className="rv-glyph-upload-btn" onClick={() => state.duplicateGroup(group.id)}>Duplicate</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => state.deleteGroup(group.id)}>Delete</button></div>
    </ControlGroup>
  )
}

function SingleBeamSelection({ beam, state }: { beam: LaserDmxMockBeam; state: LaserDmxMockState }) {
  const groupOptions = [{ value: '', label: 'None' }, ...state.groups.map(group => ({ value: group.id, label: group.name }))]
  const updateAppearance = (update: Partial<LaserDmxMockBeam['appearance']>) => state.updateBeam(beam.id, { appearance: { ...beam.appearance, ...update } })
  const updateMotion = (update: Partial<LaserDmxMockBeam['motion']>) => state.updateBeam(beam.id, { motion: { ...beam.motion, ...update } })
  const updateColor = (update: Partial<LaserDmxMockBeam['color']>) => state.updateBeam(beam.id, { color: { ...beam.color, ...update } })
  return (
    <ControlGroup>
      <CtrlSection label="Selected Beam" />
      <TextInputRow label="Name" value={beam.name} onChange={name => state.updateBeam(beam.id, { name })} />
      <ToggleRow label="Beam Enabled" value={beam.enabled} onChange={enabled => state.updateBeam(beam.id, { enabled })} />
      <CtrlSection label="Group" />
      <SelectRow label="Group" value={beam.groupId ?? ''} options={groupOptions} onChange={groupId => state.updateBeam(beam.id, { groupId: groupId || null })} />
      <ToggleRow label="Use Group Color" value={beam.useGroupColor} onChange={useGroupColor => state.updateBeam(beam.id, { useGroupColor })} />
      <CtrlSection label="Origin" />
      <SliderRow label="Col" value={beam.origin.column} min={1} max={15} step={1} onChange={column => state.updateBeam(beam.id, { origin: { ...beam.origin, column: Math.round(column) } })} />
      <SliderRow label="Row" value={beam.origin.row} min={1} max={9} step={1} onChange={row => state.updateBeam(beam.id, { origin: { ...beam.origin, row: Math.round(row) } })} />
      <SliderRow label="Z" value={beam.origin.z} min={-1} max={1} step={0.01} onChange={z => state.updateBeam(beam.id, { origin: { ...beam.origin, z } })} />
      <CtrlSection label="Target" />
      <SelectRow label="Kind" value={beam.target.kind} options={[{ value: 'grid', label: 'Grid' }, { value: 'stage', label: 'Stage' }]} onChange={kind => state.updateBeam(beam.id, { target: { ...beam.target, kind: kind as 'grid' | 'stage' } })} />
      {beam.target.kind === 'grid' ? (
        <><SliderRow label="Target Col" value={beam.target.column} min={1} max={15} step={1} onChange={column => state.updateBeam(beam.id, { target: { ...beam.target, column: Math.round(column) } })} /><SliderRow label="Target Row" value={beam.target.row} min={1} max={9} step={1} onChange={row => state.updateBeam(beam.id, { target: { ...beam.target, row: Math.round(row) } })} /><SliderRow label="Target Z" value={beam.target.z} min={-1} max={1} step={0.01} onChange={z => state.updateBeam(beam.id, { target: { ...beam.target, z } })} /></>
      ) : (
        <><SliderRow label="Target X" value={beam.target.x} min={-1} max={2} step={0.01} onChange={x => state.updateBeam(beam.id, { target: { ...beam.target, x } })} /><SliderRow label="Target Y" value={beam.target.y} min={-1} max={2} step={0.01} onChange={y => state.updateBeam(beam.id, { target: { ...beam.target, y } })} /><SliderRow label="Target Z" value={beam.target.z} min={-1} max={2} step={0.01} onChange={z => state.updateBeam(beam.id, { target: { ...beam.target, z } })} /></>
      )}
      <CtrlSection label="Sequence" />
      <SliderRow label="Sequence Index" value={beam.sequenceIndex} min={0} max={299} step={1} onChange={sequenceIndex => state.updateBeam(beam.id, { sequenceIndex: Math.round(sequenceIndex) })} />
      <Collapsible label="Motion" defaultOpen={false}>
        <ToggleRow label="Beam Motion" value={beam.motion.enabled} onChange={enabled => updateMotion({ enabled })} />
        <SelectRow label="Travel Mode" value={beam.motion.travelMode} options={[{ value: 'sweep', label: 'Sweep' }, { value: 'snap', label: 'Snap' }, { value: 'orbit', label: 'Orbit' }]} onChange={travelMode => updateMotion({ travelMode })} />
        <SliderRow label="Duration" value={beam.motion.duration} min={0.1} max={16} step={0.1} onChange={duration => updateMotion({ duration })} />
        <SelectRow label="Easing" value={beam.motion.easing} options={[{ value: 'linear', label: 'Linear' }, { value: 'easeInOut', label: 'Ease In Out' }]} onChange={easing => updateMotion({ easing })} />
        <SelectRow label="Retrigger" value={beam.motion.retrigger} options={[{ value: 'restart', label: 'Restart' }, { value: 'continue', label: 'Continue' }]} onChange={retrigger => updateMotion({ retrigger })} />
        <SliderRow label="Phase Offset" value={beam.motion.phaseOffset} onChange={phaseOffset => updateMotion({ phaseOffset })} />
        <SliderRow label="Head Glow" value={beam.motion.headGlow} onChange={headGlow => updateMotion({ headGlow })} />
      </Collapsible>
      <Collapsible label="Appearance" defaultOpen>
        <SelectRow label="Geometry" value={beam.appearance.geometry} options={[{ value: 'beam', label: 'Beam' }, { value: 'fan', label: 'Fan' }, { value: 'sheet', label: 'Sheet' }]} onChange={geometry => updateAppearance({ geometry })} />
        <SliderRow label="Dimmer" value={beam.appearance.dimmer} onChange={dimmer => updateAppearance({ dimmer })} />
        <ToggleRow label="Shutter" value={beam.appearance.shutterOpen} onChange={shutterOpen => updateAppearance({ shutterOpen })} />
        <SliderRow label="Width" value={beam.appearance.width} min={0.1} max={8} step={0.05} onChange={width => updateAppearance({ width })} />
        <SliderRow label="Focus" value={beam.appearance.focus} onChange={focus => updateAppearance({ focus })} />
        <SliderRow label="Glow" value={beam.appearance.glow} onChange={glow => updateAppearance({ glow })} />
        <SliderRow label="Divergence" value={beam.appearance.divergence} onChange={divergence => updateAppearance({ divergence })} />
        <SliderRow label="Strobe Rate" value={beam.appearance.strobeRate} onChange={strobeRate => updateAppearance({ strobeRate })} />
        <SliderRow label="Flicker" value={beam.appearance.flicker} onChange={flicker => updateAppearance({ flicker })} />
      </Collapsible>
      {!beam.useGroupColor && <Collapsible label="Color" defaultOpen={false}>
        <SliderRow label="Red" value={beam.color.red} min={0} max={255} step={1} onChange={red => updateColor({ red: Math.round(red) })} />
        <SliderRow label="Green" value={beam.color.green} min={0} max={255} step={1} onChange={green => updateColor({ green: Math.round(green) })} />
        <SliderRow label="Blue" value={beam.color.blue} min={0} max={255} step={1} onChange={blue => updateColor({ blue: Math.round(blue) })} />
        <SliderRow label="White" value={beam.color.white} min={0} max={255} step={1} onChange={white => updateColor({ white: Math.round(white) })} />
        <SliderRow label="Alpha" value={beam.color.alpha} onChange={alpha => updateColor({ alpha })} />
      </Collapsible>}
      <div className="rv-bm-button-row"><button type="button" className="rv-glyph-upload-btn" onClick={() => state.duplicateSelectedBeams(false)}>⧉ Dupe</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.deleteSelectedBeams}>× Delete</button></div>
    </ControlGroup>
  )
}

function MultiBeamSelection({ beams, state }: { beams: LaserDmxMockBeam[]; state: LaserDmxMockState }) {
  const groupOptions = [{ value: '', label: 'None' }, ...state.groups.map(group => ({ value: group.id, label: group.name }))]
  const bulk = (update: Partial<LaserDmxMockBeam>) => beams.forEach(beam => state.updateBeam(beam.id, update))
  return (
    <ControlGroup>
      <CtrlSection label={`${beams.length} Beams Selected`} />
      <div className="rv-bm-button-row rv-bm-button-row--wrap"><button type="button" className="rv-glyph-upload-btn" onClick={() => bulk({ enabled: true })}>Enable All</button><button type="button" className="rv-glyph-upload-btn" onClick={() => bulk({ enabled: false })}>Disable All</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" aria-label="Delete selected beams" onClick={state.deleteSelectedBeams}>× Delete</button></div>
      <CtrlSection label="Assign Group" />
      <SelectRow label="Group" value="" options={groupOptions} onChange={groupId => beams.forEach(beam => state.updateBeam(beam.id, { groupId: groupId || null }))} />
      <button type="button" className="rv-glyph-upload-btn" onClick={() => beams.forEach(beam => state.updateBeam(beam.id, { groupId: null }))}>Clear Group</button>
      <CtrlSection label="Duplicate with Offset" />
      <SliderRow label="Column Offset" value={Number(state.controls.multiBeamColumnOffset)} min={-14} max={14} step={1} onChange={value => state.setControl('multiBeamColumnOffset', Math.round(value))} />
      <SliderRow label="Row Offset" value={Number(state.controls.multiBeamRowOffset)} min={-9} max={9} step={1} onChange={value => state.setControl('multiBeamRowOffset', Math.round(value))} />
      <ToggleRow label="Keep Groups" value={Boolean(state.controls.multiBeamKeepGroups)} onChange={value => state.setControl('multiBeamKeepGroups', value)} />
      <button type="button" className="rv-glyph-upload-btn" onClick={() => state.duplicateSelectedBeams(true)}>Duplicate {beams.length} Beams</button>
      <button type="button" className="rv-glyph-upload-btn" onClick={state.clearMatrixSelection}>Clear Selection</button>
    </ControlGroup>
  )
}

function MatrixDesignTab({ state }: { state: LaserDmxMockState }) {
  const hasSelection = Boolean(state.selectedGroup || state.selectedBeams.length)
  return (
    <div className="rv-workspace-panel" data-layout-lab-laserdmx="matrix-design">
      <PanelSubtabs value={state.designSurface} onChange={state.setDesignSurface} ariaLabel="Design surfaces" options={[{ id: 'engine', label: 'ENGINE' }, { id: 'selection', label: 'SELECTION', disabled: !hasSelection }]} />
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">{state.designSurface === 'selection' && hasSelection ? <MatrixSelectionDesign state={state} /> : <MatrixEngineDesign state={state} />}</div></div>
    </div>
  )
}

function PerformanceProgram({ state }: { state: LaserDmxMockState }) {
  return (
    <Collapsible label="Performance Program" defaultOpen>
      <ToggleRow label="Performance Program" value={Boolean(state.controls.performanceProgram)} onChange={value => state.setControl('performanceProgram', value)} />
      <SliderRow label="Program Intensity" value={Number(state.controls.programIntensity)} disabled={!Boolean(state.controls.performanceProgram)} onChange={value => state.setControl('programIntensity', value)} />
      <SliderRow label="Variation Amount" value={Number(state.controls.variationAmount)} disabled={!Boolean(state.controls.performanceProgram)} onChange={value => state.setControl('variationAmount', value)} />
      <SliderRow label="Audio Intelligence Response" value={Number(state.controls.audioIntelligenceResponse)} disabled={!Boolean(state.controls.performanceProgram)} onChange={value => state.setControl('audioIntelligenceResponse', value)} />
      <NumberInputRow label="Variation Seed" value={Number(state.controls.variationSeed)} min={0} max={999999} step={1} disabled={!Boolean(state.controls.performanceProgram)} onChange={value => state.setControl('variationSeed', value)} />
      <SelectRow label="Analysis Fallback" value={String(state.controls.analysisFallback)} disabled={!Boolean(state.controls.performanceProgram)} options={[{ value: 'musicalClock', label: 'Musical Clock' }, { value: 'energyOnly', label: 'Energy Only' }, { value: 'static', label: 'Static' }]} onChange={value => state.setControl('analysisFallback', value)} />
      <div className="rv-show-director-performance-status">
        <div className="rv-show-director-performance-status__title">Runtime + Finite Cue Inspector</div>
        <dl><div><dt>Show</dt><dd>Neon Cathedral</dd></div><div><dt>Section</dt><dd>Drop 1</dd></div><div><dt>Scene</dt><dd>Prismatic Impact</dd></div><div><dt>Variation</dt><dd>Four-bar B</dd></div><div><dt>8-bar Stage</dt><dd>2</dd></div><div><dt>Analysis</dt><dd>Ready</dd></div><div><dt>Primary Cue</dt><dd>drop-prism-crown</dd></div><div><dt>Accent Cues</dt><dd>snare-spears, co2-impact</dd></div><div><dt>Macro</dt><dd>Prismatic Crown</dd></div><div><dt>Cue Start / Remaining</dt><dd>128.00 / 3.50 beats</dd></div><div><dt>Pattern Frame</dt><dd>stable-frame-17</dd></div><div><dt>Frame Revision</dt><dd>3</dd></div><div><dt>Transition</dt><dd>release-to-blackout</dd></div><div><dt>Relationships</dt><dd>Stage Left ↔ Stage Right</dd></div><div><dt>Audio Modulation</dt><dd>bass 0.72, energy 0.81</dd></div><div><dt>Geometry Rebuilds</dt><dd>0</dd></div><div><dt>Pattern Cache</dt><dd>18 hits / 1 miss</dd></div><div><dt>Ray Slots</dt><dd>24</dd></div><div><dt>Group Sync</dt><dd>Deterministic</dd></div><div><dt>Topology / Cue</dt><dd>0</dd></div><div><dt>Modulation Bounds</dt><dd>intensity, phase, scan rate</dd></div><div><dt>Topology Changes</dt><dd>0</dd></div><div><dt>Compatibility</dt><dd>Layout Lab static fixture</dd></div><div><dt>Cue Trigger</dt><dd>section:drop</dd></div><div><dt>Quantization</dt><dd>downbeat</dd></div><div><dt>Lifecycle</dt><dd>hold · 62%</dd></div><div><dt>Attack / Movement</dt><dd>0.25 / 1.00 beats</dd></div><div><dt>Hold / Release</dt><dd>2.00 / 0.50 beats</dd></div><div><dt>Blackout</dt><dd>0.25 beats · after completion</dd></div><div><dt>Start → Destination</dt><dd>low fan → prism crown</dd></div><div><dt>Rotation</dt><dd>patternRotation · 1 turn · 4.00 beats</dd></div><div><dt>Repeat / Maximum</dt><dd>2× · 8.00 beats max</dd></div><div><dt>Target Groups</dt><dd>Lasers, Moving Heads</dd></div><div><dt>Parameter Ownership</dt><dd>intensity, patternPhase, color</dd></div><div><dt>Completion</dt><dd>blackout · release ownership yes</dd></div><div><dt>Fixture Movement</dt><dd>pan, tilt</dd></div><div><dt>Scanner-Frame Movement</dt><dd>patternScale, patternRotation</dd></div><div><dt>Pattern Rotation</dt><dd>Finite</dd></div><div><dt>Pattern Scale</dt><dd>Finite cue-owned</dd></div><div><dt>Fixture Intensity</dt><dd>Cue-owned</dd></div><div><dt>Output / Shutter</dt><dd>Open while active</dd></div></dl>
      </div>
      <CtrlSection label="Shared Core Diagnostics" />
      <div className="rv-ctrl-info">Deterministic local sample · transport disconnected · no performance runtime executed.</div>
    </Collapsible>
  )
}

function FixtureTools({ state }: { state: LaserDmxMockState }) {
  const count = state.selectedFixtures.length
  return (
    <Collapsible label="Fixture Tools" defaultOpen>
      <div className="rv-show-director-design-actions" aria-label="Selected Show Director fixture actions">
        <button type="button" className="rv-glyph-upload-btn" disabled={!count} onClick={state.duplicateSelectedFixtures}>{count > 1 ? 'Duplicate Selected' : 'Duplicate'}</button>
        <button type="button" className="rv-glyph-upload-btn" disabled={!count} onClick={state.rotateSelectedFixtures}>Rotate 90°</button>
        <button type="button" className="rv-glyph-upload-btn" disabled={!count} onClick={() => state.mirrorSelectedFixtures('horizontal')}>Mirror H</button>
        <button type="button" className="rv-glyph-upload-btn" disabled={!count} onClick={() => state.mirrorSelectedFixtures('vertical')}>Mirror V</button>
        <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" disabled={!count} onClick={state.deleteSelectedFixtures}>{count > 1 ? 'Delete Selected' : 'Delete'}</button>
      </div>
    </Collapsible>
  )
}

function ShowDirectorInspector({ state }: { state: LaserDmxMockState }) {
  if (state.selectedFixtures.length === 0) return <div className="rv-show-director-empty">Select a fixture on the stage or in LAYERS to inspect it.</div>
  if (state.selectedFixtures.length > 1) return <MultiFixtureInspector state={state} />
  if (!state.primaryFixture) return <div className="rv-show-director-empty">The selected fixture is no longer available.</div>
  return <SingleFixtureInspector fixture={state.primaryFixture} state={state} />
}

function MultiFixtureInspector({ state }: { state: LaserDmxMockState }) {
  const primary = state.primaryFixture
  return (
    <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director bulk fixture inspector">
      <ControlGroup>
      <CtrlSection label="Selected Fixtures" />
      <div className="rv-ctrl-info"><strong>{state.selectedFixtures.length} selected</strong><br />Primary: {primary?.name ?? 'None'}</div>
      <SelectRow label="Bulk Trigger Recipe" value="Beat Pulse" options={[{ value: 'Beat Pulse', label: 'Beat Pulse' }, { value: 'Drop Impact', label: 'Drop Impact' }, { value: 'Section Lift', label: 'Section Lift' }]} onChange={triggerRecipe => state.selectedFixtures.forEach(fixture => state.updateFixture(fixture.id, { triggerRecipe }))} />
      <TextInputRow label="Group name" value={primary?.groupName ?? ''} onChange={groupName => state.selectedFixtures.forEach(fixture => state.updateFixture(fixture.id, { groupName }))} />
      <div className="rv-bm-button-row rv-bm-button-row--wrap"><button type="button" className="rv-glyph-upload-btn" onClick={() => state.selectedFixtures.forEach(fixture => state.updateFixture(fixture.id, { enabled: true }))}>Enable Selected</button><button type="button" className="rv-glyph-upload-btn" onClick={() => state.selectedFixtures.forEach(fixture => state.updateFixture(fixture.id, { enabled: false }))}>Disable Selected</button></div>
      <CtrlSection label="Recommended Recipes" />
      <div className="rv-ctrl-info">Beat Pulse · Downbeat Crown · Section Lift · Drop Impact</div>
      <div className="rv-bm-button-row rv-bm-button-row--wrap"><button type="button" className="rv-glyph-upload-btn" onClick={state.groupSelectedFixtures}>Group</button><button type="button" className="rv-glyph-upload-btn" onClick={state.ungroupSelectedFixtures}>Ungroup</button><button type="button" className="rv-glyph-upload-btn" onClick={state.duplicateSelectedFixtures}>Duplicate Selected</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.deleteSelectedFixtures}>Delete Selected</button></div>
      </ControlGroup>
    </aside>
  )
}

function SingleFixtureInspector({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  return (
    <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
      <ControlGroup>
      <div className="rv-segmented-control" role="tablist" aria-label="Show Director inspector mode"><button type="button" role="tab" aria-selected={state.fixtureInspectorMode === 'dj'} className={state.fixtureInspectorMode === 'dj' ? 'is-active' : ''} onClick={() => state.setFixtureInspectorMode('dj')}>DJ</button><button type="button" role="tab" aria-selected={state.fixtureInspectorMode === 'production'} className={state.fixtureInspectorMode === 'production' ? 'is-active' : ''} onClick={() => state.setFixtureInspectorMode('production')}>PRODUCTION</button></div>
      {state.fixtureInspectorMode === 'dj' ? <FixtureDjControls fixture={fixture} state={state} /> : <FixtureProductionControls fixture={fixture} state={state} />}
      </ControlGroup>
    </aside>
  )
}

function FixtureDjControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  return (
    <>
      <CtrlSection label="DJ Controls" />
      <div className="rv-ctrl-info"><strong>{LASER_DMX_MOCK_FIXTURE_LABELS[fixture.kind]}</strong> · {fixture.name}</div>
      <ToggleRow label="On / off" value={fixture.enabled} onChange={enabled => state.updateFixture(fixture.id, { enabled })} />
      <TextInputRow label="Name" value={fixture.name} onChange={name => state.updateFixture(fixture.id, { name })} />
      <ColorRow label="Color" value={fixture.color} onChange={color => state.updateFixture(fixture.id, { color })} />
      <SliderRow label="Brightness" value={fixture.brightness} onChange={brightness => state.updateFixture(fixture.id, { brightness })} />
      <SelectRow label="Aim" value={String(state.controls.fixtureAim)} options={[{ value: 'stageCenter', label: 'Stage Center' }, { value: 'audience', label: 'Audience Safe Zone' }, { value: 'ceiling', label: 'Ceiling' }]} onChange={value => state.setControl('fixtureAim', value)} />
      {fixture.kind === 'laser' && <><SelectRow label="Pattern" value={String(state.controls.scannerPattern)} options={[{ value: 'fan', label: 'Fan' }, { value: 'circle', label: 'Circle' }, { value: 'lissajous', label: 'Lissajous' }]} onChange={value => state.setControl('scannerPattern', value)} /><SliderRow label="Pattern size" value={Number(state.controls.scannerPatternSize)} onChange={value => state.setControl('scannerPatternSize', value)} /></>}
      <CtrlSection label="Trigger Recipe" />
      <SelectRow label="Recipe" value={fixture.triggerRecipe} options={[{ value: 'Beat Pulse', label: 'Beat Pulse' }, { value: 'Section Lift', label: 'Section Lift' }, { value: 'Drop Impact', label: 'Drop Impact' }]} onChange={triggerRecipe => state.updateFixture(fixture.id, { triggerRecipe })} />
      <TextInputRow label="Group" value={fixture.groupName} onChange={groupName => state.updateFixture(fixture.id, { groupName })} />
      <div className="rv-bm-button-row"><button type="button" className="rv-glyph-upload-btn" onClick={state.duplicateSelectedFixtures}>Duplicate</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.deleteSelectedFixtures}>Delete</button></div>
    </>
  )
}

function FixtureProductionControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  const patchPosition = (update: Partial<LaserDmxMockFixture['position']>) => state.updateFixture(fixture.id, { position: { ...fixture.position, ...update } })
  const beamKind = fixture.kind === 'laser' || fixture.kind === 'movingHead'
  return (
    <>
      <CtrlSection label="Fixture" />
      <div className="rv-show-director-readout-grid"><div><span>Type</span><strong>{LASER_DMX_MOCK_FIXTURE_LABELS[fixture.kind]}</strong></div><div><span>ID</span><strong>{fixture.id.replace('mock-', '').slice(0, 12)}</strong></div></div>
      <CtrlSection label="Transform" />
      <SelectRow label="Depth layer" value={fixture.position.depthLayer} options={[{ value: 'Overhead', label: 'Overhead' }, { value: 'Mid Stage', label: 'Mid Stage' }, { value: 'Floor', label: 'Floor' }]} onChange={depthLayer => patchPosition({ depthLayer })} />
      <SliderRow label="Position X" value={fixture.position.x} onChange={x => patchPosition({ x })} />
      <SliderRow label="Position Y" value={fixture.position.y} onChange={y => patchPosition({ y })} />
      <SliderRow label="Depth / Z" value={fixture.position.z} min={-4} max={8} step={0.1} onChange={z => patchPosition({ z })} />
      <SliderRow label="Rotation" value={fixture.position.rotation} min={-180} max={180} step={1} onChange={rotation => patchPosition({ rotation })} />
      <CtrlSection label="Light" />
      <ToggleRow label="Enabled / active" value={fixture.enabled} onChange={enabled => state.updateFixture(fixture.id, { enabled })} />
      <TextInputRow label="Label / name" value={fixture.name} onChange={name => state.updateFixture(fixture.id, { name })} />
      <TextInputRow label="Group" value={fixture.groupName} onChange={groupName => state.updateFixture(fixture.id, { groupName })} />
      <SelectRow label="Color mode" value={String(state.controls.fixtureColorMode)} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'palette', label: 'Palette' }, { value: 'music', label: 'Music' }, { value: 'fixtureDefault', label: 'Fixture Default' }]} onChange={value => state.setControl('fixtureColorMode', value)} />
      <ColorRow label="Color" value={fixture.color} onChange={color => state.updateFixture(fixture.id, { color })} />
      <SliderRow label="Brightness" value={fixture.brightness} onChange={brightness => state.updateFixture(fixture.id, { brightness })} />
      {beamKind && <BeamFixtureControls fixture={fixture} state={state} />}
      {fixture.kind === 'laser' && <ScannerControls state={state} />}
      <OpticsControls fixture={fixture} state={state} />
      <TriggerControls fixture={fixture} state={state} />
      <KindSpecificControls fixture={fixture} state={state} />
      <div className="rv-bm-button-row"><button type="button" className="rv-glyph-upload-btn" onClick={state.duplicateSelectedFixtures}>Duplicate</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.deleteSelectedFixtures}>Delete</button></div>
    </>
  )
}

function BeamFixtureControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  return (
    <>
      <CtrlSection label="Beam" />
      <ToggleRow label="Beam enabled" value={fixture.beamEnabled} onChange={beamEnabled => state.updateFixture(fixture.id, { beamEnabled })} />
      <SelectRow label="Target mode" value={String(state.controls.beamTargetMode)} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'fan', label: 'Fan' }, { value: 'sweep', label: 'Sweep' }, { value: 'cross', label: 'Cross' }, { value: 'mirror', label: 'Mirror' }, { value: 'audioReactive', label: 'Audio Reactive' }]} onChange={value => state.setControl('beamTargetMode', value)} />
      <SliderRow label="Target X" value={Number(state.controls.beamTargetX)} onChange={value => state.setControl('beamTargetX', value)} />
      <SliderRow label="Target Y" value={Number(state.controls.beamTargetY)} onChange={value => state.setControl('beamTargetY', value)} />
      <SliderRow label="Target depth" value={Number(state.controls.beamTargetDepth)} onChange={value => state.setControl('beamTargetDepth', value)} />
      <SliderRow label="Beam angle" value={Number(state.controls.beamAngle)} onChange={value => state.setControl('beamAngle', value)} />
      <SliderRow label="Beam spread" value={Number(state.controls.beamSpread)} onChange={value => state.setControl('beamSpread', value)} />
      <SliderRow label="Focus" value={Number(state.controls.beamFocus)} onChange={value => state.setControl('beamFocus', value)} />
    </>
  )
}

function ScannerControls({ state }: { state: LaserDmxMockState }) {
  return (
    <Collapsible label="Scanner Pattern" defaultOpen>
      <CtrlSection label="Scanner" />
      <SelectRow label="Pattern type" value={String(state.controls.scannerPattern)} options={[{ value: 'fan', label: 'Fan' }, { value: 'circle', label: 'Circle' }, { value: 'lissajous', label: 'Lissajous' }, { value: 'custom', label: 'Custom Path' }]} onChange={value => state.setControl('scannerPattern', value)} />
      <SliderRow label="Pattern size" value={Number(state.controls.scannerPatternSize)} onChange={value => state.setControl('scannerPatternSize', value)} />
      <SliderRow label="Phase" value={Number(state.controls.scannerPhase)} onChange={value => state.setControl('scannerPhase', value)} />
      <SliderRow label="Scan rate" value={Number(state.controls.scannerScanRate)} onChange={value => state.setControl('scannerScanRate', value)} />
      <SliderRow label="Radius" value={Number(state.controls.scannerRadius)} onChange={value => state.setControl('scannerRadius', value)} />
      <ToggleRow label="Scanner shutter closed" value={Boolean(state.controls.scannerShutterClosed)} onChange={value => state.setControl('scannerShutterClosed', value)} />
      <CtrlSection label="Scanner Path" />
      <div className="rv-ctrl-info">Ordered scanner path points · {Number(state.controls.scannerPointCount)} deterministic local points.</div>
      <SelectRow label="Interpolation" value={String(state.controls.scannerInterpolation)} options={[{ value: 'linear', label: 'Linear' }, { value: 'catmullRom', label: 'Catmull-Rom' }]} onChange={value => state.setControl('scannerInterpolation', value)} />
      <SelectRow label="Playback" value={String(state.controls.scannerPlayback)} options={[{ value: 'loop', label: 'Loop' }, { value: 'pingPong', label: 'Ping Pong' }, { value: 'once', label: 'Once' }]} onChange={value => state.setControl('scannerPlayback', value)} />
      <div className="rv-bm-button-row rv-bm-button-row--wrap"><button type="button" className="rv-glyph-upload-btn" onClick={() => state.setControl('scannerPathRevision', Number(state.controls.scannerPathRevision) + 1)}>Reverse Path</button><button type="button" className="rv-glyph-upload-btn" onClick={() => state.setControl('scannerPointCount', Number(state.controls.scannerPointCount) + 1)}>Add Point</button><button type="button" className="rv-glyph-upload-btn" onClick={() => { state.setControl('scannerPointCount', 18); state.setControl('scannerPathRevision', 0) }}>Reset Path</button></div>
      <ToggleRow label="Closed path" value={Boolean(state.controls.scannerClosedPath)} onChange={value => state.setControl('scannerClosedPath', value)} />
      <ToggleRow label="Blank retrace" value={Boolean(state.controls.scannerBlankRetrace)} onChange={value => state.setControl('scannerBlankRetrace', value)} />
      <NumberInputRow label="Point dwell" value={Number(state.controls.scannerPointDwell)} min={0} max={1000000} step={1} unit="µs" onChange={value => state.setControl('scannerPointDwell', value)} />
      <NumberInputRow label="Corner dwell" value={Number(state.controls.scannerCornerDwell)} min={0} max={1000000} step={1} unit="µs" onChange={value => state.setControl('scannerCornerDwell', value)} />
      <NumberInputRow label="Blanking delay" value={Number(state.controls.scannerBlankingDelay)} min={0} max={100000} step={1} unit="µs" onChange={value => state.setControl('scannerBlankingDelay', value)} />
      <CtrlSection label="Scanner Optics" />
      <SelectRow label="Optical mode" value={String(state.controls.scannerOpticalMode)} options={[{ value: 'single', label: 'Single' }, { value: 'copies', label: 'Optical Copies' }, { value: 'apertures', label: 'Aperture Array' }]} onChange={value => state.setControl('scannerOpticalMode', value)} />
      <NumberInputRow label="Optical copies" value={Number(state.controls.scannerOpticalCopies)} min={1} max={25} step={1} onChange={value => state.setControl('scannerOpticalCopies', value)} />
      <NumberInputRow label="Optical spread" value={Number(state.controls.scannerOpticalSpread)} min={0} max={90} step={1} unit="°" onChange={value => state.setControl('scannerOpticalSpread', value)} />
      <NumberInputRow label="Apertures" value={Number(state.controls.scannerApertures)} min={1} max={8} step={1} onChange={value => state.setControl('scannerApertures', value)} />
      <CtrlSection label="Scanner Advanced" />
      <NumberInputRow label="Max velocity" value={Number(state.controls.scannerMaxVelocity)} min={1} max={100000} step={100} onChange={value => state.setControl('scannerMaxVelocity', value)} />
      <NumberInputRow label="Max acceleration" value={Number(state.controls.scannerMaxAcceleration)} min={1} max={10000000} step={1000} onChange={value => state.setControl('scannerMaxAcceleration', value)} />
      <NumberInputRow label="Exposure" value={Number(state.controls.scannerExposure)} min={4.1667} max={83.333} step={0.1} unit="ms" onChange={value => state.setControl('scannerExposure', value)} />
      <TextInputRow label="Calibration profile" value={String(state.controls.scannerCalibrationProfile)} onChange={value => state.setControl('scannerCalibrationProfile', value)} />
      <div className="rv-show-director-scanner-points" aria-label="Ordered scanner path points">
        <div className="rv-show-director-scanner-point"><strong>#1</strong><span>X 3.0</span><span>Y 8.0</span><span>Visible</span></div>
        <div className="rv-show-director-scanner-point"><strong>#2</strong><span>X 8.0</span><span>Y 2.0</span><span>Corner dwell 24 µs</span></div>
        <div className="rv-show-director-scanner-point"><strong>#3</strong><span>X 13.0</span><span>Y 8.0</span><span>Blank retrace</span></div>
      </div>
      <CtrlSection label="Scanner Diagnostics" />
      <div className="rv-show-director-scanner-diagnostics"><div><span>Pattern</span><strong>{String(state.controls.scannerPattern)}</strong></div><div><span>Points</span><strong>{Number(state.controls.scannerPointCount)}</strong></div><div><span>Visible</span><strong>{Math.max(0, Number(state.controls.scannerPointCount) - 1)}</strong></div><div><span>Blanked</span><strong>1</strong></div><div><span>Dwell</span><strong>228 µs</strong></div><div><span>Optical copies</span><strong>{Number(state.controls.scannerOpticalCopies)}</strong></div><div><span>Apertures</span><strong>{Number(state.controls.scannerApertures)}</strong></div><div><span>Compatibility</span><strong>Native scanner · revision {Number(state.controls.scannerPathRevision)}</strong></div></div>
      <CtrlSection label="Legacy Migration" />
      <div className="rv-bm-button-row"><button type="button" className="rv-glyph-upload-btn" onClick={() => state.setControl('scannerMigrationState', 'previewed')}>Preview Conversion</button><button type="button" className="rv-glyph-upload-btn" disabled={state.controls.scannerMigrationState !== 'previewed'} onClick={() => state.setControl('scannerMigrationState', 'applied')}>Apply Conversion</button></div>
      <div className="rv-ctrl-info">{state.controls.scannerMigrationState === 'applied' ? 'Local conversion preview applied. Production scanner data remains unchanged.' : state.controls.scannerMigrationState === 'previewed' ? 'Local conversion preview ready to apply.' : 'No legacy migration is required for this deterministic local scanner.'}</div>
    </Collapsible>
  )
}

function OpticsControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  const movingHead = fixture.kind === 'movingHead'
  return (
    <>
      <CtrlSection label="Optics / Structure" />
      <SelectRow label="Primitive" value={fixture.primitive} options={[{ value: 'scanner', label: 'Scanner' }, { value: 'cone', label: 'Cone' }, { value: 'fan', label: 'Fan' }, { value: 'wash', label: 'Wash' }]} onChange={primitive => state.updateFixture(fixture.id, { primitive })} />
      <NumberInputRow label="Ray count" value={Number(state.controls.opticsRayCount)} min={1} max={12} step={1} onChange={value => state.setControl('opticsRayCount', value)} />
      <NumberInputRow label="Fan width" value={Number(state.controls.opticsFanWidth)} min={0} max={180} step={1} unit="°" onChange={value => state.setControl('opticsFanWidth', value)} />
      <SliderRow label="Optical softness" value={Number(state.controls.opticsSoftness)} onChange={value => state.setControl('opticsSoftness', value)} />
      <SliderRow label="Source intensity" value={Number(state.controls.opticsSourceIntensity)} onChange={value => state.setControl('opticsSourceIntensity', value)} />
      <SliderRow label="Atmosphere response" value={Number(state.controls.opticsAtmosphereResponse)} onChange={value => state.setControl('opticsAtmosphereResponse', value)} />
      {movingHead && <><SliderRow label="Zoom" value={Number(state.controls.opticsZoom)} onChange={value => state.setControl('opticsZoom', value)} /><SliderRow label="Iris" value={Number(state.controls.opticsIris)} onChange={value => state.setControl('opticsIris', value)} /><SliderRow label="Frost" value={Number(state.controls.opticsFrost)} onChange={value => state.setControl('opticsFrost', value)} /><SelectRow label="Gobo pattern" value={String(state.controls.opticsGoboPattern)} options={[{ value: 'open', label: 'Open' }, { value: 'dots', label: 'Dots' }, { value: 'breakup', label: 'Breakup' }]} onChange={value => state.setControl('opticsGoboPattern', value)} /><SliderRow label="Gobo amount" value={Number(state.controls.opticsGoboAmount)} onChange={value => state.setControl('opticsGoboAmount', value)} /><NumberInputRow label="Gobo rotation" value={Number(state.controls.opticsGoboRotation)} min={-360} max={360} step={1} unit="°" onChange={value => state.setControl('opticsGoboRotation', value)} /><SelectRow label="Prism" value={String(state.controls.opticsPrism)} options={[{ value: '1', label: 'Off' }, { value: '3', label: '3 Facet' }, { value: '5', label: '5 Facet' }]} onChange={value => state.setControl('opticsPrism', value)} /><NumberInputRow label="Prism rotation" value={Number(state.controls.opticsPrismRotation)} min={-360} max={360} step={1} unit="°" onChange={value => state.setControl('opticsPrismRotation', value)} /></>}
    </>
  )
}

function TriggerControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  return (
    <>
      <CtrlSection label="Trigger / Timing" />
      <SelectRow label="Trigger mode" value={fixture.triggerMode} options={[{ value: 'alwaysOn', label: 'Always On' }, { value: 'beat', label: 'Beat' }, { value: 'bar', label: 'Bar' }, { value: 'phrase', label: 'Phrase' }, { value: 'section', label: 'Section' }, { value: 'cuePoint', label: 'Cue Point' }, { value: 'bassHit', label: 'Bass Hit' }, { value: 'snareTransient', label: 'Snare Transient' }, { value: 'energy', label: 'Energy' }, { value: 'audioBand', label: 'Audio Band' }]} onChange={triggerMode => state.updateFixture(fixture.id, { triggerMode })} />
      <div className="rv-show-director-trigger-notes" role="note" aria-label="Show Director timing requirements"><span>Timing remains a deterministic local UI simulation. No transport, cue scheduler, or Audio Intelligence service is mounted.</span></div>
      {['beat', 'bar', 'phrase'].includes(fixture.triggerMode) && <SelectRow label="Beat division" value={String(state.controls.triggerBeatDivision)} options={[{ value: '0.25', label: '1/4' }, { value: '0.5', label: '1/2' }, { value: '1', label: '1 Beat' }, { value: '2', label: '2 Beats' }, { value: '4', label: '4 Beats' }, { value: '8', label: '8 Beats' }]} onChange={value => state.setControl('triggerBeatDivision', value)} />}
      {fixture.triggerMode === 'bar' && <NumberInputRow label="Bar interval" value={Number(state.controls.triggerBarInterval)} min={1} max={64} step={1} onChange={value => state.setControl('triggerBarInterval', value)} />}
      {fixture.triggerMode === 'phrase' && <NumberInputRow label="Phrase bars" value={Number(state.controls.triggerPhraseBars)} min={1} max={128} step={1} onChange={value => state.setControl('triggerPhraseBars', value)} />}
      {fixture.triggerMode === 'section' && <SelectRow label="Section" value={String(state.controls.triggerSection)} options={[{ value: 'intro', label: 'Intro' }, { value: 'verse', label: 'Verse' }, { value: 'build', label: 'Build' }, { value: 'preDrop', label: 'Pre Drop' }, { value: 'drop', label: 'Drop' }, { value: 'breakdown', label: 'Breakdown' }, { value: 'bridge', label: 'Bridge' }, { value: 'outro', label: 'Outro' }]} onChange={value => state.setControl('triggerSection', value)} />}
      {fixture.triggerMode === 'cuePoint' && <TextInputRow label="Cue point ID" value={String(state.controls.triggerCuePoint)} placeholder="A, B, Drop 1..." onChange={value => state.setControl('triggerCuePoint', value)} />}
      {fixture.triggerMode === 'audioBand' && <SelectRow label="Audio band" value={String(state.controls.triggerAudioBand)} options={[{ value: 'sub', label: 'Sub' }, { value: 'bass', label: 'Bass' }, { value: 'mid', label: 'Mid' }, { value: 'high', label: 'High' }]} onChange={value => state.setControl('triggerAudioBand', value)} />}
      {['audioBand', 'bassHit', 'snareTransient'].includes(fixture.triggerMode) && <SliderRow label={fixture.triggerMode === 'audioBand' ? 'Band threshold' : 'Hit threshold'} value={Number(state.controls.triggerAudioThreshold)} onChange={value => state.setControl('triggerAudioThreshold', value)} />}
      {fixture.triggerMode === 'energy' && <SliderRow label="Energy threshold" value={Number(state.controls.triggerEnergyThreshold)} onChange={value => state.setControl('triggerEnergyThreshold', value)} />}
      <NumberInputRow label="Fade in" value={Number(state.controls.triggerFadeIn)} min={0} max={10000} step={25} unit="ms" onChange={value => state.setControl('triggerFadeIn', value)} />
      <NumberInputRow label="Fade out" value={Number(state.controls.triggerFadeOut)} min={0} max={10000} step={25} unit="ms" onChange={value => state.setControl('triggerFadeOut', value)} />
    </>
  )
}

function KindSpecificControls({ fixture, state }: { fixture: LaserDmxMockFixture; state: LaserDmxMockState }) {
  switch (fixture.kind) {
    case 'strobe':
      return <><CtrlSection label="Strobe" /><NumberInputRow label="Strobe rate" value={Number(state.controls.strobeRateHz)} min={0} max={30} step={0.5} unit="Hz" onChange={value => state.setControl('strobeRateHz', value)} /></>
    case 'ledBar':
    case 'ledTube':
      return <><CtrlSection label={fixture.kind === 'ledBar' ? 'LED Bar' : 'LED Tube'} /><NumberInputRow label="Cell count" value={Number(state.controls.ledCellCount)} min={1} max={64} step={1} onChange={value => state.setControl('ledCellCount', value)} /><SelectRow label="Direction" value={String(state.controls.ledDirection)} options={[{ value: 'forward', label: 'Forward' }, { value: 'reverse', label: 'Reverse' }, { value: 'centerOut', label: 'Center Out' }]} onChange={value => state.setControl('ledDirection', value)} /></>
    case 'movingHead':
      return <><CtrlSection label="Moving Head" /><SelectRow label="Pan / tilt style" value={String(state.controls.movingHeadStyle)} options={[{ value: 'mirrored', label: 'Mirrored' }, { value: 'synchronized', label: 'Synchronized' }, { value: 'alternating', label: 'Alternating' }]} onChange={value => state.setControl('movingHeadStyle', value)} /></>
    case 'haze':
      return <><CtrlSection label="Haze" /><SliderRow label="Haze intensity" value={Number(state.controls.hazeIntensity)} onChange={value => state.setControl('hazeIntensity', value)} /></>
    case 'co2Jet':
      return <><CtrlSection label="CO₂ Jet" /><NumberInputRow label="Burst duration" value={Number(state.controls.co2BurstDuration)} min={50} max={10000} step={50} unit="ms" onChange={value => state.setControl('co2BurstDuration', value)} /></>
    case 'videoWall':
      return <><CtrlSection label="Video Wall" /><SliderRow label="Wall brightness" value={Number(state.controls.wallBrightness)} onChange={value => state.setControl('wallBrightness', value)} /><SelectRow label="Source" value={String(state.controls.videoSource)} options={[{ value: 'Program Visual', label: 'Program Visual' }, { value: 'Camera', label: 'Camera' }, { value: 'Black', label: 'Black' }]} onChange={value => state.setControl('videoSource', value)} /></>
    default:
      return null
  }
}

function ShowDirectorDesignTab({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-workspace-panel" data-layout-lab-laserdmx="show-director-design">
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll"><ControlGroup><PerformanceProgram state={state} /><FixtureTools state={state} /><ShowDirectorInspector state={state} /></ControlGroup></div></div>
    </div>
  )
}

function RouteEditor({ route, state }: { route: LaserDmxMockRoute; state: LaserDmxMockState }) {
  return (
    <Collapsible label={`${route.scope === 'global' ? 'Global' : route.scope === 'group' ? 'Group' : 'Beam'} Route`} defaultOpen>
      <div className="rv-bm-button-row"><ToggleRow label="Route Enabled" value={route.enabled} onChange={enabled => state.updateRoute(route.id, { enabled })} /><button type="button" className="rv-glyph-item-del" title="Delete route" aria-label="Delete modulation route" onClick={() => state.deleteRoute(route.id)}>×</button></div>
      <SelectRow label="Source" value={route.source} options={SOURCE_OPTIONS} onChange={source => state.updateRoute(route.id, { source })} />
      <SelectRow label="Target" value={route.target} options={TARGET_OPTIONS} onChange={target => state.updateRoute(route.id, { target })} />
      <SelectRow label="Curve" value={route.curve} options={[{ value: 'linear', label: 'Linear' }, { value: 'smoothstep', label: 'Smoothstep' }, { value: 'easeOut', label: 'Ease Out' }]} onChange={curve => state.updateRoute(route.id, { curve })} />
      <SelectRow label="Mode" value={route.mode} options={[{ value: 'add', label: 'Add' }, { value: 'replace', label: 'Replace' }, { value: 'multiply', label: 'Multiply' }]} onChange={mode => state.updateRoute(route.id, { mode })} />
      <SliderRow label="Amount" value={route.amount} onChange={amount => state.updateRoute(route.id, { amount })} />
      <SliderRow label="Min" value={route.min} min={-1} max={1} onChange={min => state.updateRoute(route.id, { min })} />
      <SliderRow label="Max" value={route.max} min={-1} max={1} onChange={max => state.updateRoute(route.id, { max })} />
      <div className="rv-ctrl-info">Offset targets accept negative Min/Max values; absolute targets clamp to the supported output range.</div>
      <SliderRow label="Smoothing" value={route.smoothing} onChange={smoothing => state.updateRoute(route.id, { smoothing })} />
      <SliderRow label="Attack" value={route.attack} onChange={attack => state.updateRoute(route.id, { attack })} />
      <SliderRow label="Release" value={route.release} onChange={release => state.updateRoute(route.id, { release })} />
      <ToggleRow label="Invert" value={route.invert} onChange={invert => state.updateRoute(route.id, { invert })} />
      <Collapsible label="Trigger Timing" defaultOpen={false}>
        <SelectRow label="Timing" value={route.timing} options={[{ value: 'continuous', label: 'Continuous' }, { value: 'barBeat', label: 'Bar / Beat' }, { value: 'bars', label: 'Bars' }, { value: 'range', label: 'Bar Range' }, { value: 'everyNBars', label: 'Every N Bars' }]} onChange={timing => state.updateRoute(route.id, { timing })} />
        <div className="rv-ctrl-info">Timing status: local fixture · next eligible boundary 129.1.</div>
        {route.timing === 'barBeat' && <><NumberInputRow label="Bar" value={route.bar} min={1} max={9999} step={1} onChange={bar => state.updateRoute(route.id, { bar })} /><NumberInputRow label="Beat" value={route.beat} min={1} max={16} step={1} onChange={beat => state.updateRoute(route.id, { beat })} /></>}
        {route.timing === 'bars' && <NumberInputRow label="Bars" value={route.bars} min={1} max={128} step={1} onChange={bars => state.updateRoute(route.id, { bars })} />}
        {route.timing === 'range' && <><NumberInputRow label="Start Bar" value={route.startBar} min={1} max={9999} step={1} onChange={startBar => state.updateRoute(route.id, { startBar })} /><NumberInputRow label="End Bar" value={route.endBar} min={1} max={9999} step={1} onChange={endBar => state.updateRoute(route.id, { endBar })} /></>}
        {route.timing === 'everyNBars' && <><NumberInputRow label="Every N bars" value={route.everyNBars} min={1} max={128} step={1} onChange={everyNBars => state.updateRoute(route.id, { everyNBars })} /><NumberInputRow label="Anchor bar" value={route.anchorBar} min={1} max={9999} step={1} onChange={anchorBar => state.updateRoute(route.id, { anchorBar })} /></>}
      </Collapsible>
    </Collapsible>
  )
}

function RoutingTab({ state }: { state: LaserDmxMockState }) {
  const groupAvailable = Boolean(state.selectedGroup)
  const beamAvailable = state.selectedBeams.length === 1
  const ownerId = state.routeScope === 'group' ? state.selectedGroupId : state.routeScope === 'beam' ? state.selectedBeamIds[0] ?? null : null
  const routes = state.routes.filter(route => route.scope === state.routeScope && (route.scope === 'global' || route.ownerId === ownerId))
  return (
    <ControlGroup>
      <Collapsible label="Scope" defaultOpen>
        <SelectRow label="Routes for" value={state.routeScope} options={[{ value: 'global', label: 'Global Matrix' }, { value: 'group', label: groupAvailable ? `Group · ${state.selectedGroup?.name}` : 'Group · select one', disabled: !groupAvailable }, { value: 'beam', label: beamAvailable ? `Beam · ${state.selectedBeams[0]?.name}` : state.selectedBeams.length > 1 ? 'Beam · multiple selected' : 'Beam · select one', disabled: !beamAvailable }]} onChange={value => state.setRouteScope(value as 'global' | 'group' | 'beam')} />
      </Collapsible>
      {state.routeScope === 'global' && <Collapsible label="Global Matrix Routes" defaultOpen>{routes.map(route => <RouteEditor key={route.id} route={route} state={state} />)}<button type="button" className="rv-glyph-upload-btn" onClick={() => state.addRoute('global')}>+ Add Global Route</button></Collapsible>}
      {state.routeScope === 'group' && (groupAvailable ? <Collapsible label="Group Routes" defaultOpen><div className="rv-ctrl-info">Routes for {state.selectedGroup?.name}</div>{routes.map(route => <RouteEditor key={route.id} route={route} state={state} />)}<button type="button" className="rv-glyph-upload-btn" onClick={() => state.addRoute('group')}>+ Add Group Route</button></Collapsible> : <div className="rv-ctrl-info">Select one reaction group to edit group routes.</div>)}
      {state.routeScope === 'beam' && (state.selectedBeams.length === 0 ? <div className="rv-ctrl-info">Select one beam to edit beam routes.</div> : state.selectedBeams.length > 1 ? <div className="rv-ctrl-info">Beam routes require exactly one selected beam.</div> : <Collapsible label="Beam Routes" defaultOpen><div className="rv-ctrl-info">Routes for {state.selectedBeams[0].name}</div>{routes.map(route => <RouteEditor key={route.id} route={route} state={state} />)}<button type="button" className="rv-glyph-upload-btn" onClick={() => state.addRoute('beam')}>+ Add Beam Route</button></Collapsible>)}
    </ControlGroup>
  )
}

function AnalysisTab() {
  return (
    <ControlGroup>
      <CtrlSection label="AUDIO INPUT AND TRANSPORT" />
      <div className="rv-ctrl-info">Source: Layout Lab static fixture · Transport: disconnected · BPM: 150 · Beat: 129.1 · Downbeat confidence: 0.94.</div>
      <CtrlSection label="MUSIC / AUDIO INTELLIGENCE" />
      <div className="rv-show-director-performance-status"><dl><div><dt>Bass</dt><dd>0.72</dd></div><div><dt>Mid</dt><dd>0.48</dd></div><div><dt>High</dt><dd>0.36</dd></div><div><dt>Energy</dt><dd>0.81</dd></div><div><dt>Kick</dt><dd>Hit</dd></div><div><dt>Snare</dt><dd>Idle</dd></div><div><dt>Section</dt><dd>Drop</dd></div><div><dt>Phrase</dt><dd>5 / 8</dd></div><div><dt>Four bars</dt><dd>Boundary in 3.0 beats</dd></div><div><dt>Eight bars</dt><dd>Stage 2</dd></div></dl></div>
      <CtrlSection label="ROUTING DIAGNOSTICS" />
      <div className="rv-ctrl-info">Available · 3 local routes · no AudioFeatureBus import · no live analysis subscription.</div>
      <CtrlSection label="DEGRADED / EMPTY STATES" />
      <div className="rv-ctrl-info">If analysis is unavailable, the selected Analysis Fallback supplies deterministic musical-clock values. Empty values remain visibly unavailable rather than reading production state.</div>
    </ControlGroup>
  )
}

function ReactTab({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-workspace-panel" data-layout-lab-laserdmx="react">
      <PanelSubtabs value={state.reactSurface} onChange={state.setReactSurface} ariaLabel="Reactivity surfaces" options={[{ id: 'routing', label: 'ROUTING' }, { id: 'analysis', label: 'ANALYSIS' }]} />
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">{state.reactSurface === 'routing' ? <RoutingTab state={state} /> : <AnalysisTab />}</div></div>
    </div>
  )
}

function RecordingTab({ state }: { state: LaserDmxMockState }) {
  return (
    <ControlGroup>
      <Collapsible label="Recording" defaultOpen>
        <div className="rv-ctrl-info"><strong>{state.recordingState === 'recording' ? 'RECORDING (SIMULATED)' : 'READY'}</strong><br />Layout Lab never reads the canvas, instantiates MediaRecorder, creates an object URL, or saves a file.</div>
        <SelectRow label="Recording Mode" value={String(state.controls.recordingMode)} options={[{ value: 'video', label: 'Video' }, { value: 'imageSequence', label: 'Image Sequence' }]} onChange={value => state.setControl('recordingMode', value)} />
        <SelectRow label="Frame Rate" value={String(state.controls.recordingFrameRate)} options={[{ value: '30', label: '30 FPS' }, { value: '60', label: '60 FPS' }]} onChange={value => state.setControl('recordingFrameRate', value)} />
        <button type="button" className={state.recordingState === 'recording' ? 'rv-glyph-upload-btn rv-glyph-upload-btn--danger' : 'rv-glyph-upload-btn'} onClick={state.toggleRecording}>{state.recordingState === 'recording' ? 'Stop Simulated Recording' : 'Start Simulated Recording'}</button>
      </Collapsible>
    </ControlGroup>
  )
}

function ProductionTab({ state }: { state: LaserDmxMockState }) {
  const physicalUnavailable = state.outputAdapter !== 'virtual'
  return (
    <ControlGroup>
      <Collapsible label="Production Output" defaultOpen>
        <div className="rv-ctrl-info" role="status" aria-live="polite"><strong>{state.outputStatusMessage}</strong></div>
        <SelectRow label="Adapter" value={state.outputAdapter} options={[{ value: 'virtual', label: 'Virtual Output' }, { value: 'artnet', label: 'Art-Net (trusted host required)' }, { value: 'sacn', label: 'sACN (trusted host required)' }]} description="Virtual Output is canonical. Art-Net and sACN are protocol-ready but cannot transmit from this renderer-only Layout Lab." onChange={value => state.setOutputAdapter(value as 'virtual' | 'artnet' | 'sacn')} />
        <button type="button" className={state.rehearsalMode ? 'rv-glyph-upload-btn rv-glyph-upload-btn--active' : 'rv-glyph-upload-btn'} aria-pressed={state.rehearsalMode} onClick={() => state.setRehearsalMode(!state.rehearsalMode)}>Rehearsal Preview: {state.rehearsalMode ? 'ON' : 'OFF'}</button>
        <div className="rv-ctrl-info">Rehearsal Preview routes cues, looks, and pad actions to Virtual Output only. Enabling it immediately disarms physical output.</div>
        <SliderRow label="Hardware Master" value={Number(state.controls.hardwareMaster)} onChange={value => state.setControl('hardwareMaster', value)} description="Independent from virtual preview intensity. It is applied only while preparing adapter channel frames." />
        <SliderRow label="Strobe Limit" value={Number(state.controls.strobeLimit)} min={0} max={30} step={1} onChange={value => state.setControl('strobeLimit', value)} description="Adapter-side normalized flash limit. This does not claim medical or regulatory safety." />
        <div className="rv-bm-button-row rv-bm-button-row--wrap"><button type="button" className="rv-glyph-upload-btn" disabled={physicalUnavailable || state.outputArmed || (state.rehearsalMode && physicalUnavailable)} onClick={state.armOutput}>{state.outputAdapter === 'virtual' ? 'Arm Virtual Test' : 'Arm Session'}</button><button type="button" className="rv-glyph-upload-btn" disabled={!state.outputArmed && !state.emergencyBlackout} onClick={state.disarmOutput}>Disarm</button><button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={state.triggerEmergencyBlackout}>Emergency Blackout</button><button type="button" className="rv-glyph-upload-btn" disabled={!state.emergencyBlackout} onClick={state.clearBlackout}>Clear Latch</button></div>
        {physicalUnavailable && <div className="rv-ctrl-info">No network packets can be sent: Layout Lab has no Electron main process, preload bridge, trusted IPC boundary, output adapter, WebUSB, WebSerial, Art-Net, sACN, MIDI, OSC, or DMX connection.</div>}
        <div className="rv-ctrl-info">INFO: Virtual adapter selected; output frames remain local and synthetic.</div>
        <div className="rv-ctrl-info">WARNING: Fixture overlap and exclusion-zone checks use deterministic mock diagnostics.</div>
        <div className="rv-ctrl-info">INFO: Heartbeat, stale-frame, cooldown, and fail-dark policy are visually represented but never executed.</div>
        <div className="rv-ctrl-info">Address, overlap, profile, exclusion-zone, stale-frame, heartbeat, cooldown, and fail-dark checks are diagnostic safeguards only. DRMVYZ does not certify physical laser or venue safety.</div>
      </Collapsible>
    </ControlGroup>
  )
}

function OutputTab({ state }: { state: LaserDmxMockState }) {
  return (
    <div className="rv-workspace-panel" data-layout-lab-laserdmx="output">
      <PanelSubtabs value={state.outputSurface} onChange={state.setOutputSurface} ariaLabel="Output surfaces" options={[{ id: 'recording', label: 'RECORDING' }, { id: 'production', label: 'PRODUCTION' }]} />
      <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll">{state.outputSurface === 'production' ? <ProductionTab state={state} /> : <RecordingTab state={state} />}</div></div>
    </div>
  )
}

export function LaserDmxRightRailMockup({ state }: { state: LaserDmxMockState }) {
  const [tab, setTab] = useState<RightTab>('design')
  return (
    <>
      <RailTabs tabs={RIGHT_TABS} activeTab={tab} onChange={value => setTab(value as RightTab)} ariaLabel="LaserDMX inspector tabs" />
      {tab === 'presets' ? <PresetsTab state={state} /> : tab === 'design' ? state.mode === 'matrix' ? <MatrixDesignTab state={state} /> : <ShowDirectorDesignTab state={state} /> : tab === 'react' ? <ReactTab state={state} /> : <OutputTab state={state} />}
    </>
  )
}
