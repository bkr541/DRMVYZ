import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorAudioBand,
  type LaserDmxShowDirectorBeamTargetMode,
  type LaserDmxShowDirectorColorMode,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorTriggerMode,
  type LaserDmxShowDirectorTriggerQuantize,
} from './ReactTypes'
import { CtrlSection, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'

interface LaserDmxShowDirectorInspectorProps {
  fixture: LaserDmxShowDirectorFixture | null
}

const COLOR_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorColorMode; label: string }> = [
  { value: 'fixed', label: 'Fixed fixture color' },
  { value: 'palette', label: 'React palette placeholder' },
  { value: 'music', label: 'Music reactive placeholder' },
  { value: 'fixtureDefault', label: 'Fixture default' },
]

const BEAM_TARGET_OPTIONS: Array<{ value: LaserDmxShowDirectorBeamTargetMode; label: string }> = [
  { value: 'forward', label: 'Forward' },
  { value: 'stageCenter', label: 'Stage center' },
  { value: 'customPoint', label: 'Custom target point' },
  { value: 'musicReactive', label: 'Music reactive target' },
]

const TRIGGER_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerMode; label: string }> = [
  { value: 'alwaysOn', label: 'Always on' },
  { value: 'beat', label: 'Beat' },
  { value: 'bar', label: 'Bar' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'section', label: 'Section' },
  { value: 'cuePoint', label: 'Cue point' },
  { value: 'energy', label: 'Energy threshold' },
  { value: 'audioBand', label: 'Audio band' },
]

const QUANTIZE_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerQuantize; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'beat', label: 'Beat' },
  { value: 'bar', label: 'Bar' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'section', label: 'Section' },
]

const AUDIO_BAND_OPTIONS: Array<{ value: LaserDmxShowDirectorAudioBand; label: string }> = [
  { value: 'sub', label: 'Sub' },
  { value: 'bass', label: 'Bass' },
  { value: 'lowMid', label: 'Low mid' },
  { value: 'mid', label: 'Mid' },
  { value: 'highMid', label: 'High mid' },
  { value: 'high', label: 'High' },
]

function isBeamFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return fixture.beam.beamEnabled || fixture.kind === 'laser' || fixture.kind === 'movingHead' || fixture.kind === 'ledBar'
    || fixture.kind === 'ledTube' || fixture.kind === 'strobe' || fixture.kind === 'blinder' || fixture.kind === 'parWash'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function colorInputValue(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#4ac7db'
}

export function LaserDmxShowDirectorInspector({ fixture }: LaserDmxShowDirectorInspectorProps) {
  const {
    settings,
    updateFixture,
    deleteFixture,
    duplicateFixture,
  } = useReactStore(useShallow(s => ({
    settings:         s.laserDmxShowDirector.settings,
    updateFixture:    s.updateLaserDmxShowDirectorFixture,
    deleteFixture:    s.deleteLaserDmxShowDirectorFixture,
    duplicateFixture: s.duplicateLaserDmxShowDirectorFixture,
  })))

  const gridBounds = useMemo(() => ({
    maxX: Math.max(0, settings.gridSize.columns - 1),
    maxY: Math.max(0, settings.gridSize.rows - 1),
  }), [settings.gridSize.columns, settings.gridSize.rows])

  if (!fixture) {
    return (
      <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
        <div className="rv-show-director-panel__header">
          <span className="rv-show-director-kicker">Inspector</span>
          <h4>No Fixture Selected</h4>
          <p>Select a fixture on the canvas to tune its transform, beam placeholders, and control timing.</p>
        </div>
        <div className="rv-show-director-empty">
          <strong>Canvas waiting for a click.</strong>
          <span>Drag a component into the grid, then select it to edit the foundation data stored by Show Director.</span>
        </div>
      </aside>
    )
  }

  const typeLabel = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
  const supportsBeam = isBeamFixture(fixture)
  const update = (patch: Parameters<typeof updateFixture>[1]) => updateFixture(fixture.id, patch)

  return (
    <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
      <div className="rv-show-director-panel__header rv-show-director-inspector__header">
        <div>
          <span className="rv-show-director-kicker">Inspector</span>
          <h4>{fixture.label}</h4>
          <p>{typeLabel} · {fixture.enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
        <span className="rv-show-director-inspector__swatch" style={{ background: fixture.color }} aria-hidden="true" />
      </div>

      <div className="rv-show-director-inspector__body">
        <CtrlSection label="Fixture" />
        <TextInputRow label="Fixture name" value={fixture.label} onChange={label => update({ label })} />
        <div className="rv-show-director-readout-grid">
          <div><span>Type</span><strong>{typeLabel}</strong></div>
          <div><span>ID</span><strong>{fixture.id.slice(0, 8)}</strong></div>
        </div>
        <ToggleRow label="Enabled / active" value={fixture.enabled} onChange={enabled => update({ enabled })} />

        <CtrlSection label="Transform" />
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="X cell" value={fixture.x} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.1} onChange={x => update({ x: clamp(x, 0, gridBounds.maxX) })} />
          <NumberInputRow label="Y cell" value={fixture.y} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.1} onChange={y => update({ y: clamp(y, 0, gridBounds.maxY) })} />
          <NumberInputRow label="Z depth" value={fixture.z} step={0.1} onChange={z => update({ z })} />
          <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => update({ rotation: clamp(rotation, -360, 360) })} />
        </div>

        <CtrlSection label="Color + Output" />
        <SelectRow label="Color mode" value={fixture.colorMode} options={COLOR_MODE_OPTIONS} onChange={colorMode => update({ colorMode: colorMode as LaserDmxShowDirectorColorMode })} />
        <label className="rv-show-director-color-field">
          <span className="rv-ctrl-label">Fixed color</span>
          <input type="color" value={colorInputValue(fixture.color)} onChange={event => update({ color: event.target.value })} />
          <span>{fixture.color.toUpperCase()}</span>
        </label>
        <SliderRow label="Brightness" value={fixture.brightness} onChange={brightness => update({ brightness })} />

        <CtrlSection label="Beam Placeholder" />
        {supportsBeam ? (
          <>
            <ToggleRow label="Beam enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => update({ beam: { beamEnabled } })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Angle" value={fixture.beam.beamAngle} min={-360} max={360} step={1} unit="°" onChange={beamAngle => update({ beam: { beamAngle } })} />
              <NumberInputRow label="Spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} unit="°" onChange={beamSpread => update({ beam: { beamSpread } })} />
            </div>
            <SliderRow label="Focus" value={fixture.beam.focus} onChange={focus => update({ beam: { focus } })} />
            <SelectRow label="Target mode" value={fixture.beam.targetMode} options={BEAM_TARGET_OPTIONS} onChange={targetMode => update({ beam: { targetMode: targetMode as LaserDmxShowDirectorBeamTargetMode } })} />
          </>
        ) : (
          <div className="rv-show-director-placeholder-note">
            {typeLabel} stores position and control timing now. Beam-specific controls stay parked until this component type is compiled later.
          </div>
        )}

        <CtrlSection label="Control Placeholder" />
        <SelectRow label="Trigger mode" value={fixture.trigger.mode} options={TRIGGER_MODE_OPTIONS} onChange={mode => update({ trigger: { mode: mode as LaserDmxShowDirectorTriggerMode } })} />
        <SelectRow label="Quantize" value={fixture.trigger.quantize} options={QUANTIZE_OPTIONS} onChange={quantize => update({ trigger: { quantize: quantize as LaserDmxShowDirectorTriggerQuantize } })} />
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="Beat division" value={fixture.trigger.beatDivision} min={1} max={16} step={1} onChange={beatDivision => update({ trigger: { beatDivision: (beatDivision === 2 || beatDivision === 4 || beatDivision === 8 || beatDivision === 16 ? beatDivision : 1) as 1 | 2 | 4 | 8 | 16 } })} />
          <NumberInputRow label="Bar interval" value={fixture.trigger.barInterval} min={1} max={64} step={1} onChange={barInterval => update({ trigger: { barInterval } })} />
        </div>
        <SelectRow label="Audio band" value={fixture.trigger.audioBand} options={AUDIO_BAND_OPTIONS} onChange={audioBand => update({ trigger: { audioBand: audioBand as LaserDmxShowDirectorAudioBand } })} />
        <SliderRow label="Audio threshold" value={fixture.trigger.audioThreshold} onChange={audioThreshold => update({ trigger: { audioThreshold } })} />

        <div className="rv-show-director-inspector__actions">
          <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateFixture(fixture.id)}>Duplicate</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => deleteFixture(fixture.id)}>Delete</button>
        </div>
      </div>
    </aside>
  )
}
