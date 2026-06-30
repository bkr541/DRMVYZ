import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  SliderRow, SelectRow, ToggleRow, TextInputRow,
  CtrlSection, Collapsible,
} from './ReactControlRows'
import type { LaserDmxFixture, LaserDmxProfileId } from './ReactTypes'
import {
  getLaserDmxFixtureProfile,
  LASER_DMX_FIXTURE_PROFILES,
  resolveLaserDmxFixtureCapabilities,
} from './LaserDmxProductionRig'

const PROFILE_OPTIONS = Object.values(LASER_DMX_FIXTURE_PROFILES).map(profile => ({
  value: profile.id,
  label: profile.label,
}))

const PATH_KIND_OPTIONS = [
  { value: 'staticBeam',    label: 'Static Beam'   },
  { value: 'lineSweep',     label: 'Line Sweep'    },
  { value: 'fan',           label: 'Fan'           },
  { value: 'cone',          label: 'Cone'          },
  { value: 'circle',        label: 'Circle'        },
  { value: 'spiral',        label: 'Spiral'        },
  { value: 'lissajous',     label: 'Lissajous'     },
  { value: 'grid',          label: 'Grid'          },
  { value: 'tunnel',        label: 'Tunnel'        },
  { value: 'constellation', label: 'Constellation' },
  { value: 'svgPath',       label: 'SVG Path'      },
  { value: 'textPath',      label: 'Text Path'     },
]

const COLOR_MODE_OPTIONS = [
  { value: 'fixed',   label: 'Fixed'   },
  { value: 'palette', label: 'Palette' },
  { value: 'music',   label: 'Music'   },
]

type PositionKey = keyof LaserDmxFixture['position']
type ColorKey    = keyof LaserDmxFixture['color']
type BeamKey     = keyof LaserDmxFixture['beam']
type PathKey     = keyof LaserDmxFixture['path']

export function LaserDmxSpatialFixturesPanel() {
  const {
    laserDmxSettings,
    selectLaserFixture,
    addLaserFixture,
    duplicateLaserFixture,
    removeLaserFixture,
    updateLaserFixture,
  } = useReactStore(useShallow(s => ({
    laserDmxSettings:     s.laserDmxSettings,
    selectLaserFixture:   s.selectLaserFixture,
    addLaserFixture:      s.addLaserFixture,
    duplicateLaserFixture:s.duplicateLaserFixture,
    removeLaserFixture:   s.removeLaserFixture,
    updateLaserFixture:   s.updateLaserFixture,
  })))

  const { fixtures, selectedFixtureId } = laserDmxSettings
  const fixture = fixtures.find(f => f.id === selectedFixtureId) ?? fixtures[0] ?? null
  const fid = fixture?.id ?? ''
  const capabilities = fixture ? resolveLaserDmxFixtureCapabilities(fixture) : null

  function setPosition<K extends PositionKey>(key: K, value: LaserDmxFixture['position'][K]) {
    if (!fixture) return
    updateLaserFixture(fid, { position: { ...fixture.position, [key]: value } })
  }
  function setColor<K extends ColorKey>(key: K, value: LaserDmxFixture['color'][K]) {
    if (!fixture) return
    updateLaserFixture(fid, { color: { ...fixture.color, [key]: value } })
  }
  function setBeam<K extends BeamKey>(key: K, value: LaserDmxFixture['beam'][K]) {
    if (!fixture) return
    updateLaserFixture(fid, { beam: { ...fixture.beam, [key]: value } })
  }
  function setPath<K extends PathKey>(key: K, value: LaserDmxFixture['path'][K]) {
    if (!fixture) return
    updateLaserFixture(fid, { path: { ...fixture.path, [key]: value } })
  }

  if (fixtures.length === 0) {
    return (
      <>
        <CtrlSection label="Fixtures" />
        <div className="rv-ctrl-info">No fixtures — add one to begin.</div>
        <button type="button" className="rv-glyph-upload-btn" onClick={addLaserFixture}>
          + Add Fixture
        </button>
      </>
    )
  }

  return (
    <>
      <CtrlSection label="Fixtures" />
      <div className="rv-glyph-list">
        {fixtures.map(f => (
          <div
            key={f.id}
            className={`rv-glyph-item${f.id === selectedFixtureId ? ' rv-glyph-item--active' : ''}${!f.enabled ? ' rv-glyph-item--disabled' : ''}`}
            onClick={() => selectLaserFixture(f.id)}
            role="button"
            tabIndex={0}
            aria-label={`Select fixture ${f.name}`}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectLaserFixture(f.id) }}
          >
            <span className="rv-glyph-item-name" title={f.name}>
              {f.enabled ? '●' : '○'} {f.name}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                className="rv-glyph-item-del"
                title={f.enabled ? 'Disable' : 'Enable'}
                aria-label={`${f.enabled ? 'Disable' : 'Enable'} fixture ${f.name}`}
                onClick={e => { e.stopPropagation(); updateLaserFixture(f.id, { enabled: !f.enabled }) }}
              >
                {f.enabled ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                className="rv-glyph-item-del"
                title="Remove fixture"
                aria-label={`Remove fixture ${f.name}`}
                onClick={e => { e.stopPropagation(); removeLaserFixture(f.id) }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <button type="button" className="rv-glyph-upload-btn" onClick={addLaserFixture}>+ Add</button>
        {fixture && (
          <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateLaserFixture(fid)}>⧉ Dupe</button>
        )}
      </div>

      {!fixture && (
        <div className="rv-ctrl-info">Select a fixture above to edit.</div>
      )}

      {fixture && (
        <>
          <CtrlSection label="Identity" />
          <TextInputRow
            label="Name"
            value={fixture.name}
            onChange={v => updateLaserFixture(fid, { name: v })}
            maxLength={32}
            placeholder="Fixture name"
          />
          <ToggleRow
            label="Enabled"
            value={fixture.enabled}
            onChange={v => updateLaserFixture(fid, { enabled: v })}
          />

          <Collapsible label="DMX Identity" defaultOpen={false}>
            <SliderRow label="Universe"      value={fixture.dmx.universe}     onChange={v => updateLaserFixture(fid, { dmx: { ...fixture.dmx, universe: Math.max(1, Math.round(v)) } })} min={1} max={16} step={1} color="#4ac7db" />
            <SliderRow label="Start Address" value={fixture.dmx.startAddress} onChange={v => updateLaserFixture(fid, { dmx: { ...fixture.dmx, startAddress: Math.max(1, Math.min(512, Math.round(v))) } })} min={1} max={512} step={1} color="#4ac7db" />
            <SelectRow
              label="Profile"
              value={fixture.dmx.profileId}
              onChange={v => {
                const profile = getLaserDmxFixtureProfile(v)
                if (!profile) return
                updateLaserFixture(fid, {
                  fixtureKind: profile.fixtureKind,
                  dmx: { ...fixture.dmx, profileId: v as LaserDmxProfileId },
                })
              }}
              options={PROFILE_OPTIONS}
            />
            <SelectRow
              label="Channel Mode"
              value={fixture.dmx.channelMode}
              onChange={v => updateLaserFixture(fid, { dmx: { ...fixture.dmx, channelMode: v as 'basic' | 'extended' } })}
              options={[{ value: 'basic', label: 'Basic' }, { value: 'extended', label: 'Extended' }]}
            />
          </Collapsible>

          <Collapsible label="Position / Aim" defaultOpen={false}>
            <SliderRow label="Origin X" value={fixture.position.originX} onChange={v => setPosition('originX', v)} min={0} max={1} step={0.01} color="#61d6aa" />
            <SliderRow label="Origin Y" value={fixture.position.originY} onChange={v => setPosition('originY', v)} min={0} max={1} step={0.01} color="#61d6aa" />
            <SliderRow label="Origin Z" value={fixture.position.originZ} onChange={v => setPosition('originZ', v)} min={-1} max={1} step={0.01} color="#61d6aa" />
            <SliderRow label="Target X" value={fixture.position.targetX} onChange={v => setPosition('targetX', v)} min={0} max={1} step={0.01} color="#4ac7db" />
            <SliderRow label="Target Y" value={fixture.position.targetY} onChange={v => setPosition('targetY', v)} min={0} max={1} step={0.01} color="#4ac7db" />
            <SliderRow label="Target Z" value={fixture.position.targetZ} onChange={v => setPosition('targetZ', v)} min={-1} max={1} step={0.01} color="#4ac7db" />
            {capabilities?.panTilt && (
              <>
                <SliderRow label="Pan"      value={fixture.position.pan}     onChange={v => setPosition('pan',     v)} min={-capabilities.panTilt.panRangeDeg / 2} max={capabilities.panTilt.panRangeDeg / 2} step={1} color="#d8b95a" />
                <SliderRow label="Tilt"     value={fixture.position.tilt}    onChange={v => setPosition('tilt',    v)} min={-capabilities.panTilt.tiltRangeDeg / 2} max={capabilities.panTilt.tiltRangeDeg / 2} step={1} color="#d8b95a" />
              </>
            )}
            {capabilities?.beamPattern && (
              <SliderRow label="Rotation" value={fixture.position.rotation} onChange={v => setPosition('rotation', v)} min={-180} max={180} step={1} color="#d8b95a" />
            )}
            <ToggleRow label="Mirror X" value={fixture.position.mirrorX} onChange={v => setPosition('mirrorX', v)} />
            <ToggleRow label="Mirror Y" value={fixture.position.mirrorY} onChange={v => setPosition('mirrorY', v)} />
          </Collapsible>

          <Collapsible label="Fixture Color" defaultOpen={false}>
            <SelectRow
              label="Color Mode"
              value={fixture.color.mode}
              onChange={v => setColor('mode', v as 'fixed' | 'palette' | 'music')}
              options={COLOR_MODE_OPTIONS}
            />
            {(capabilities?.color?.mode === 'rgb' || capabilities?.color?.mode === 'rgbw') && (
              <>
                <SliderRow label="Red"   value={fixture.color.red}   onChange={v => setColor('red',   Math.round(v))} min={0} max={255} step={1} color="#c0314a" />
                <SliderRow label="Green" value={fixture.color.green} onChange={v => setColor('green', Math.round(v))} min={0} max={255} step={1} color="#61d6aa" />
                <SliderRow label="Blue"  value={fixture.color.blue}  onChange={v => setColor('blue',  Math.round(v))} min={0} max={255} step={1} color="#4ac7db" />
              </>
            )}
            {capabilities?.color?.mode === 'rgbw' && (
              <SliderRow label="White" value={fixture.color.white} onChange={v => setColor('white', Math.round(v))} min={0} max={255} step={1} color="#e8f4f8" />
            )}
            <SliderRow label="Alpha"       value={fixture.color.alpha}           onChange={v => setColor('alpha',          v)} min={0} max={1}   step={0.01} color="#b84fc9" />
            <SliderRow label="Cycle Speed" value={fixture.color.colorCycleSpeed} onChange={v => setColor('colorCycleSpeed', v)} min={0} max={2}   step={0.01} color="#d8b95a" />
          </Collapsible>

          <Collapsible label="Beam Shape" defaultOpen={false}>
            {capabilities?.dimmer && (
              <SliderRow label="Dimmer" value={fixture.beam.dimmer} onChange={v => setBeam('dimmer', v)} min={0} max={1} step={0.01} color="#4ac7db" />
            )}
            {capabilities?.shutter && (
              <ToggleRow label="Shutter" value={fixture.beam.shutterOpen} onChange={v => setBeam('shutterOpen', v)} />
            )}
            {capabilities?.beamPattern && (
              <SliderRow label="Beam Width" value={fixture.beam.width} onChange={v => setBeam('width', v)} min={0.2} max={6} step={0.05} color="#61d6aa" />
            )}
            {capabilities?.zoom && (
              <SliderRow label="Zoom" value={fixture.beam.zoom} onChange={v => setBeam('zoom', v)} min={capabilities.zoom.min} max={capabilities.zoom.max} step={0.01} color="#d8b95a" />
            )}
            {capabilities?.focus && (
              <SliderRow label="Focus" value={fixture.beam.focus} onChange={v => setBeam('focus', v)} min={capabilities.focus.min} max={capabilities.focus.max} step={0.01} color="#d8b95a" />
            )}
            {capabilities?.strobe && (
              <>
                <SliderRow label="Strobe Rate" value={fixture.beam.strobeRate} onChange={v => setBeam('strobeRate', v)} min={capabilities.strobe.min} max={capabilities.strobe.max} step={0.01} color="#c0314a" />
                <SliderRow label="Flicker" value={fixture.beam.flickerAmount} onChange={v => setBeam('flickerAmount', v)} min={0} max={1} step={0.01} color="#c0314a" />
              </>
            )}
          </Collapsible>

          {capabilities?.beamPattern && (
            <Collapsible label="Path / Program" defaultOpen>
            <SelectRow
              label="Path Kind"
              value={fixture.path.kind}
              onChange={v => setPath('kind', v as LaserDmxFixture['path']['kind'])}
              options={PATH_KIND_OPTIONS}
            />
            <SliderRow label="Scale"         value={fixture.path.scale}        onChange={v => setPath('scale',        v)}              min={0} max={2}    step={0.01} color="#61d6aa" />
            <SliderRow label="Path Rotation" value={fixture.path.rotation}     onChange={v => setPath('rotation',     v)}              min={-180} max={180} step={1}   color="#d8b95a" />
            <SliderRow label="Offset X"      value={fixture.path.offsetX}      onChange={v => setPath('offsetX',      v)}              min={-1} max={1}   step={0.01} color="#4ac7db" />
            <SliderRow label="Offset Y"      value={fixture.path.offsetY}      onChange={v => setPath('offsetY',      v)}              min={-1} max={1}   step={0.01} color="#4ac7db" />
            <SliderRow label="Scan Speed"    value={fixture.path.scanSpeed}    onChange={v => setPath('scanSpeed',    v)}              min={0} max={2}    step={0.01} color="#61d6aa" />
            <SliderRow label="Phase Offset"  value={fixture.path.phaseOffset}  onChange={v => setPath('phaseOffset',  v)}              min={0} max={1}    step={0.01} color="#b84fc9" />
            <SliderRow label="Points"        value={fixture.path.pointCount}   onChange={v => setPath('pointCount',   Math.round(v))}  min={1} max={160}  step={1}    color="#4ac7db" />
            <SliderRow label="Spread"        value={fixture.path.spread}       onChange={v => setPath('spread',       v)}              min={0} max={1}    step={0.01} color="#61d6aa" />
            <SliderRow label="Radius"        value={fixture.path.radius}       onChange={v => setPath('radius',       v)}              min={0} max={1}    step={0.01} color="#d8b95a" />
            <SliderRow label="Complexity"    value={fixture.path.complexity}   onChange={v => setPath('complexity',   v)}              min={0} max={1}    step={0.01} color="#b84fc9" />
            <SliderRow label="Smoothing"     value={fixture.path.smoothing}    onChange={v => setPath('smoothing',    v)}              min={0} max={1}    step={0.01} color="#4ac7db" />
            <SliderRow label="Progress"      value={fixture.path.pathProgress} onChange={v => setPath('pathProgress', v)}              min={0} max={1}    step={0.01} color="#61d6aa" />
            </Collapsible>
          )}
        </>
      )}
    </>
  )
}
