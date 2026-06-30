import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  SliderRow, SelectRow, ToggleRow, TextInputRow, NumberInputRow,
  CtrlSection, Collapsible,
} from './ReactControlRows'
import type { LaserDmxFixture, LaserDmxProfileId } from './ReactTypes'
import {
  diagnoseProductionRig,
  getLaserDmxFixtureProfile,
  LASER_DMX_FIXTURE_PROFILES,
  normalizeProductionStageModel,
  PRODUCTION_STAGE_COORDINATE_CONVENTION,
  PRODUCTION_VENUE_TEMPLATES,
  resolveLaserDmxFixtureCapabilities,
  resolveLaserDmxFixtureStageTransform,
  setActiveProductionCameraView,
  stageVectorToLegacyNormalized,
  type ProductionStageModel,
  type ProductionStageTransform,
} from './LaserDmxProductionRig'

const PROFILE_OPTIONS = Object.values(LASER_DMX_FIXTURE_PROFILES).map(profile => ({
  value: profile.id,
  label: profile.label,
}))

const PATH_KIND_OPTIONS = [
  { value: 'staticBeam', label: 'Static Beam' },
  { value: 'lineSweep', label: 'Line Sweep' },
  { value: 'fan', label: 'Fan' },
  { value: 'cone', label: 'Cone' },
  { value: 'circle', label: 'Circle' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'lissajous', label: 'Lissajous' },
  { value: 'grid', label: 'Grid' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'constellation', label: 'Constellation' },
  { value: 'svgPath', label: 'SVG Path' },
  { value: 'textPath', label: 'Text Path' },
]

const COLOR_MODE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'palette', label: 'Palette' },
  { value: 'music', label: 'Music' },
]

type ColorKey = keyof LaserDmxFixture['color']
type BeamKey = keyof LaserDmxFixture['beam']
type PathKey = keyof LaserDmxFixture['path']

export function LaserDmxSpatialFixturesPanel() {
  const {
    laserDmxSettings,
    setLaserDmxSettings,
    selectLaserFixture,
    addLaserFixture,
    duplicateLaserFixture,
    removeLaserFixture,
    updateLaserFixture,
    applyLaserDmxVenueTemplate,
  } = useReactStore(useShallow(state => ({
    laserDmxSettings: state.laserDmxSettings,
    setLaserDmxSettings: state.setLaserDmxSettings,
    selectLaserFixture: state.selectLaserFixture,
    addLaserFixture: state.addLaserFixture,
    duplicateLaserFixture: state.duplicateLaserFixture,
    removeLaserFixture: state.removeLaserFixture,
    updateLaserFixture: state.updateLaserFixture,
    applyLaserDmxVenueTemplate: state.applyLaserDmxVenueTemplate,
  })))

  const [newProfileId, setNewProfileId] = useState<LaserDmxProfileId>('genericRgbLaser')
  const [venueTemplateId, setVenueTemplateId] = useState<(typeof PRODUCTION_VENUE_TEMPLATES)[number]['id']>(PRODUCTION_VENUE_TEMPLATES[1].id)
  const { fixtures, selectedFixtureId } = laserDmxSettings
  const fixture = fixtures.find(candidate => candidate.id === selectedFixtureId) ?? fixtures[0] ?? null
  const fixtureId = fixture?.id ?? ''
  const capabilities = fixture ? resolveLaserDmxFixtureCapabilities(fixture) : null
  const stage = normalizeProductionStageModel(laserDmxSettings.productionStage)
  const transform = fixture ? resolveLaserDmxFixtureStageTransform(fixture, stage) : null
  const diagnostics = diagnoseProductionRig(laserDmxSettings)
  const groups = laserDmxSettings.productionGroups ?? []
  const targets = laserDmxSettings.productionTargets ?? []

  function updateStage(patch: Partial<ProductionStageModel>) {
    setLaserDmxSettings({ productionStage: normalizeProductionStageModel({ ...stage, ...patch }) })
  }

  function updateTransform(next: ProductionStageTransform) {
    if (!fixture) return
    const legacy = stageVectorToLegacyNormalized(next.position, stage)
    updateLaserFixture(fixture.id, {
      stageTransform: next,
      position: {
        ...fixture.position,
        originX: legacy.x,
        originY: legacy.y,
        originZ: legacy.z,
        pan: next.orientation.yawDeg,
        tilt: next.orientation.pitchDeg,
        rotation: next.orientation.rollDeg,
      },
    })
  }

  function updatePosition(axis: 'x' | 'y' | 'z', value: number) {
    if (!transform) return
    updateTransform({ ...transform, position: { ...transform.position, [axis]: value } })
  }

  function updateOrientation(axis: 'yawDeg' | 'pitchDeg' | 'rollDeg', value: number) {
    if (!transform) return
    const orientation = { ...transform.orientation, [axis]: value }
    if (axis === 'yawDeg') orientation.panDeg = value
    if (axis === 'pitchDeg') orientation.tiltDeg = value
    updateTransform({ ...transform, orientation })
  }

  function setColor<K extends ColorKey>(key: K, value: LaserDmxFixture['color'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { color: { ...fixture.color, [key]: value } })
  }

  function setBeam<K extends BeamKey>(key: K, value: LaserDmxFixture['beam'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { beam: { ...fixture.beam, [key]: value } })
  }

  function setPath<K extends PathKey>(key: K, value: LaserDmxFixture['path'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { path: { ...fixture.path, [key]: value } })
  }

  function toggleGroup(groupId: string) {
    if (!fixture) return
    setLaserDmxSettings({
      productionGroups: groups.map(group => ({
        ...group,
        fixtureIds: group.id === groupId
          ? (group.fixtureIds.includes(fixture.id)
              ? group.fixtureIds.filter(id => id !== fixture.id)
              : [...group.fixtureIds, fixture.id])
          : group.fixtureIds,
      })),
    })
  }

  function addGroup() {
    const id = crypto.randomUUID()
    setLaserDmxSettings({
      productionGroups: [...groups, { id, name: `Fixture Group ${groups.length + 1}`, fixtureIds: fixture ? [fixture.id] : [] }],
    })
  }

  return (
    <>
      <CtrlSection label="Venue / Stage" />
      <SelectRow
        label="Starter Layout"
        value={venueTemplateId}
        onChange={value => setVenueTemplateId(value as (typeof PRODUCTION_VENUE_TEMPLATES)[number]['id'])}
        options={PRODUCTION_VENUE_TEMPLATES.map(template => ({ value: template.id, label: template.label }))}
        description="Applying is explicit and replaces the current stage layout and shared targets."
      />
      <button
        type="button"
        className="rv-glyph-upload-btn"
        onClick={() => applyLaserDmxVenueTemplate(venueTemplateId)}
        aria-label={`Apply ${PRODUCTION_VENUE_TEMPLATES.find(template => template.id === venueTemplateId)?.label ?? 'venue'} layout`}
      >
        Apply Layout
      </button>
      <div className="rv-ctrl-info">Axes: +X stage right, +Y up, +Z upstage. Origin is centre-downstage floor. Units are metres.</div>
      <span className="rv-ctrl-description" style={{ display: 'none' }}>{PRODUCTION_STAGE_COORDINATE_CONVENTION}</span>

      <Collapsible label="Stage Dimensions" defaultOpen={false}>
        <NumberInputRow label="Width" value={stage.dimensions.width} min={1} max={100} unit="m" onChange={width => updateStage({ dimensions: { ...stage.dimensions, width }, floor: { ...stage.floor, width } })} />
        <NumberInputRow label="Height" value={stage.dimensions.height} min={1} max={50} unit="m" onChange={height => updateStage({ dimensions: { ...stage.dimensions, height } })} />
        <NumberInputRow label="Depth" value={stage.dimensions.depth} min={1} max={100} unit="m" onChange={depth => updateStage({ dimensions: { ...stage.dimensions, depth }, floor: { ...stage.floor, depth } })} />
      </Collapsible>

      <Collapsible label="Camera / Guides" defaultOpen={false}>
        <SelectRow
          label="Saved View"
          value={stage.activeCameraViewId}
          onChange={viewId => setLaserDmxSettings({ productionStage: setActiveProductionCameraView(stage, viewId) })}
          options={stage.savedCameraViews.map(view => ({ value: view.id, label: view.name }))}
        />
        <SelectRow
          label="Render Quality"
          value={stage.editor.qualityTier}
          onChange={qualityTier => updateStage({ editor: { ...stage.editor, qualityTier: qualityTier as ProductionStageModel['editor']['qualityTier'] } })}
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
        />
        <ToggleRow label="Editor Guides" value={stage.editor.guidesVisible} onChange={guidesVisible => updateStage({ editor: { ...stage.editor, guidesVisible } })} />
        <ToggleRow label="Fixture Origins" value={laserDmxSettings.showFixtureOrigins ?? false} onChange={showFixtureOrigins => setLaserDmxSettings({ showFixtureOrigins })} />
        <ToggleRow label="Path Points" value={laserDmxSettings.showPathPoints ?? false} onChange={showPathPoints => setLaserDmxSettings({ showPathPoints })} />
      </Collapsible>

      <CtrlSection label="Fixtures" />
      <div style={{ display: 'flex', gap: 4, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <SelectRow label="Fixture Profile" value={newProfileId} onChange={value => setNewProfileId(value as LaserDmxProfileId)} options={PROFILE_OPTIONS} />
        </div>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => addLaserFixture(newProfileId)}>+ Add Fixture</button>
      </div>

      {fixtures.length === 0 ? (
        <div className="rv-ctrl-info">No fixtures. Choose a profile and add one to begin.</div>
      ) : (
        <div className="rv-glyph-list">
          {fixtures.map(candidate => (
            <div
              key={candidate.id}
              className={`rv-glyph-item${candidate.id === selectedFixtureId ? ' rv-glyph-item--active' : ''}${!candidate.enabled ? ' rv-glyph-item--disabled' : ''}`}
              onClick={() => selectLaserFixture(candidate.id)}
              role="button"
              tabIndex={0}
              aria-label={`Select fixture ${candidate.name}`}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') selectLaserFixture(candidate.id) }}
            >
              <span className="rv-glyph-item-name" title={candidate.name}>{candidate.enabled ? '●' : '○'} {candidate.name}</span>
              <button type="button" className="rv-glyph-item-del" aria-label={`${candidate.enabled ? 'Disable' : 'Enable'} fixture ${candidate.name}`} onClick={event => { event.stopPropagation(); updateLaserFixture(candidate.id, { enabled: !candidate.enabled }) }}>{candidate.enabled ? '⏸' : '▶'}</button>
            </div>
          ))}
        </div>
      )}

      {fixture && (
        <>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateLaserFixture(fixture.id)}>⧉ Duplicate</button>
            <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => removeLaserFixture(fixture.id)}>× Delete</button>
          </div>

          <CtrlSection label="Selected Fixture" />
          <TextInputRow label="Name" value={fixture.name} onChange={name => updateLaserFixture(fixture.id, { name })} maxLength={48} />
          <ToggleRow label="Enabled" value={fixture.enabled} onChange={enabled => updateLaserFixture(fixture.id, { enabled })} />

          <Collapsible label="Profile / DMX" defaultOpen={false}>
            <SelectRow
              label="Profile"
              value={fixture.dmx.profileId}
              onChange={value => {
                const profile = getLaserDmxFixtureProfile(value)
                if (!profile) return
                updateLaserFixture(fixture.id, { fixtureKind: profile.fixtureKind, dmx: { ...fixture.dmx, profileId: value as LaserDmxProfileId } })
              }}
              options={PROFILE_OPTIONS}
            />
            <NumberInputRow label="Universe" value={fixture.dmx.universe} min={1} max={16} step={1} onChange={universe => updateLaserFixture(fixture.id, { dmx: { ...fixture.dmx, universe: Math.round(universe) } })} />
            <NumberInputRow label="Start Address" value={fixture.dmx.startAddress} min={1} max={512} step={1} onChange={startAddress => updateLaserFixture(fixture.id, { dmx: { ...fixture.dmx, startAddress: Math.round(startAddress) } })} />
          </Collapsible>

          <Collapsible label="3D Position / Rotation" defaultOpen>
            {transform && (
              <>
                <NumberInputRow label="X" value={transform.position.x} min={-stage.dimensions.width} max={stage.dimensions.width} unit="m" onChange={value => updatePosition('x', value)} />
                <NumberInputRow label="Y" value={transform.position.y} min={-stage.dimensions.height} max={stage.dimensions.height * 2} unit="m" onChange={value => updatePosition('y', value)} />
                <NumberInputRow label="Z" value={transform.position.z} min={-stage.dimensions.depth} max={stage.dimensions.depth * 2} unit="m" onChange={value => updatePosition('z', value)} />
                <NumberInputRow label="Yaw" value={transform.orientation.yawDeg} min={-360} max={360} unit="°" onChange={value => updateOrientation('yawDeg', value)} />
                <NumberInputRow label="Pitch" value={transform.orientation.pitchDeg} min={-180} max={180} unit="°" onChange={value => updateOrientation('pitchDeg', value)} />
                <NumberInputRow label="Roll" value={transform.orientation.rollDeg} min={-180} max={180} unit="°" onChange={value => updateOrientation('rollDeg', value)} />
              </>
            )}
            <SelectRow
              label="Target Point / Zone"
              value={fixture.targetId ?? ''}
              onChange={targetId => updateLaserFixture(fixture.id, { targetId: targetId || null })}
              options={[{ value: '', label: 'Fixture manual aim' }, ...targets.map(target => ({ value: target.id, label: `${target.kind === 'zone' ? 'Zone' : 'Point'} · ${target.name}` }))]}
            />
          </Collapsible>

          <Collapsible label="Fixture Groups" defaultOpen={false}>
            {groups.length === 0 && <div className="rv-ctrl-info">No fixture groups yet.</div>}
            {groups.map(group => (
              <ToggleRow key={group.id} label={group.name} value={group.fixtureIds.includes(fixture.id)} onChange={() => toggleGroup(group.id)} />
            ))}
            <button type="button" className="rv-glyph-upload-btn" onClick={addGroup}>+ Create Group</button>
          </Collapsible>

          <Collapsible label="Fixture Color" defaultOpen={false}>
            <SelectRow label="Color Mode" value={fixture.color.mode} onChange={value => setColor('mode', value as LaserDmxFixture['color']['mode'])} options={COLOR_MODE_OPTIONS} />
            {(capabilities?.color?.mode === 'rgb' || capabilities?.color?.mode === 'rgbw') && (
              <>
                <SliderRow label="Red" value={fixture.color.red} onChange={value => setColor('red', Math.round(value))} min={0} max={255} step={1} color="#c0314a" />
                <SliderRow label="Green" value={fixture.color.green} onChange={value => setColor('green', Math.round(value))} min={0} max={255} step={1} color="#61d6aa" />
                <SliderRow label="Blue" value={fixture.color.blue} onChange={value => setColor('blue', Math.round(value))} min={0} max={255} step={1} color="#4ac7db" />
              </>
            )}
            {capabilities?.color?.mode === 'rgbw' && <SliderRow label="White" value={fixture.color.white} onChange={value => setColor('white', Math.round(value))} min={0} max={255} step={1} color="#e8f4f8" />}
            <SliderRow label="Alpha" value={fixture.color.alpha} onChange={value => setColor('alpha', value)} min={0} max={1} step={0.01} color="#b84fc9" />
          </Collapsible>

          <Collapsible label="Beam Shape" defaultOpen={false}>
            {capabilities?.dimmer && <SliderRow label="Dimmer" value={fixture.beam.dimmer} onChange={value => setBeam('dimmer', value)} min={0} max={1} step={0.01} color="#4ac7db" />}
            {capabilities?.shutter && <ToggleRow label="Shutter" value={fixture.beam.shutterOpen} onChange={value => setBeam('shutterOpen', value)} />}
            {capabilities?.beamPattern && <SliderRow label="Beam Width" value={fixture.beam.width} onChange={value => setBeam('width', value)} min={0.2} max={6} step={0.05} color="#61d6aa" />}
            {capabilities?.zoom && <SliderRow label="Zoom" value={fixture.beam.zoom} onChange={value => setBeam('zoom', value)} min={capabilities.zoom.min} max={capabilities.zoom.max} step={0.01} color="#d8b95a" />}
            {capabilities?.focus && <SliderRow label="Focus" value={fixture.beam.focus} onChange={value => setBeam('focus', value)} min={capabilities.focus.min} max={capabilities.focus.max} step={0.01} color="#d8b95a" />}
            {capabilities?.strobe && <SliderRow label="Strobe Rate" value={fixture.beam.strobeRate} onChange={value => setBeam('strobeRate', value)} min={capabilities.strobe.min} max={capabilities.strobe.max} step={0.01} color="#c0314a" />}
          </Collapsible>

          {capabilities?.beamPattern && (
            <Collapsible label="Path / Program" defaultOpen={false}>
              <SelectRow label="Path Kind" value={fixture.path.kind} onChange={value => setPath('kind', value as LaserDmxFixture['path']['kind'])} options={PATH_KIND_OPTIONS} />
              <SliderRow label="Scale" value={fixture.path.scale} onChange={value => setPath('scale', value)} min={0} max={2} step={0.01} color="#61d6aa" />
              <SliderRow label="Path Rotation" value={fixture.path.rotation} onChange={value => setPath('rotation', value)} min={-180} max={180} step={1} color="#d8b95a" />
              <SliderRow label="Scan Speed" value={fixture.path.scanSpeed} onChange={value => setPath('scanSpeed', value)} min={0} max={2} step={0.01} color="#61d6aa" />
              <SliderRow label="Points" value={fixture.path.pointCount} onChange={value => setPath('pointCount', Math.round(value))} min={1} max={160} step={1} color="#4ac7db" />
              <SliderRow label="Spread" value={fixture.path.spread} onChange={value => setPath('spread', value)} min={0} max={1} step={0.01} color="#61d6aa" />
              <SliderRow label="Complexity" value={fixture.path.complexity} onChange={value => setPath('complexity', value)} min={0} max={1} step={0.01} color="#b84fc9" />
            </Collapsible>
          )}
        </>
      )}

      <Collapsible label={`Rig Diagnostics (${diagnostics.length})`} defaultOpen={diagnostics.some(item => item.severity === 'error')}>
        {diagnostics.length === 0 ? (
          <div className="rv-ctrl-info">Rig positions, profiles, IDs, and targets are valid.</div>
        ) : diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}:${diagnostic.fixtureId ?? index}`} className="rv-ctrl-info" role={diagnostic.severity === 'error' ? 'alert' : 'status'}>
            {diagnostic.severity === 'error' ? 'Error' : 'Warning'} · {diagnostic.message}
          </div>
        ))}
      </Collapsible>
    </>
  )
}
