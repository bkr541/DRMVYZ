import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorAudioBand,
  type LaserDmxShowDirectorBeatDivision,
  type LaserDmxShowDirectorBeamTargetMode,
  type LaserDmxShowDirectorColorMode,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorLedDirection,
  type LaserDmxShowDirectorMovingHeadPanTiltStyle,
  type LaserDmxShowDirectorSectionType,
  type LaserDmxShowDirectorTriggerMode,
  type LaserDmxShowDirectorVideoWallSource,
} from './ReactTypes'
import { CtrlSection, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'

interface LaserDmxShowDirectorInspectorProps {
  fixture: LaserDmxShowDirectorFixture | null
}

const COLOR_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorColorMode; label: string }> = [
  { value: 'fixed', label: 'Fixed color' },
  { value: 'palette', label: 'React palette' },
  { value: 'music', label: 'Music reactive' },
  { value: 'fixtureDefault', label: 'Fixture default' },
]

const BEAM_TARGET_OPTIONS: Array<{ value: LaserDmxShowDirectorBeamTargetMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'fan', label: 'Fan' },
  { value: 'sweep', label: 'Sweep' },
  { value: 'cross', label: 'Cross' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'audioReactive', label: 'Audio reactive' },
]

const TRIGGER_MODE_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerMode; label: string }> = [
  { value: 'alwaysOn', label: 'Always on' },
  { value: 'beat', label: 'Beat' },
  { value: 'bar', label: 'Bar' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'section', label: 'Section' },
  { value: 'cuePoint', label: 'Cue point' },
  { value: 'bassHit', label: 'Bass hit' },
  { value: 'snareTransient', label: 'Snare / transient' },
  { value: 'energy', label: 'Energy' },
  { value: 'audioBand', label: 'Audio band' },
]

const BEAT_DIVISION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '0.25', label: '1/4 beat' },
  { value: '0.5', label: '1/2 beat' },
  { value: '1', label: '1 beat' },
  { value: '2', label: '2 beats' },
  { value: '4', label: '4 beats' },
  { value: '8', label: '8 beats' },
]

const AUDIO_BAND_OPTIONS: Array<{ value: LaserDmxShowDirectorAudioBand; label: string }> = [
  { value: 'sub', label: 'Sub' },
  { value: 'bass', label: 'Bass' },
  { value: 'lowMid', label: 'Low-mid' },
  { value: 'mid', label: 'Mid' },
  { value: 'highMid', label: 'High-mid' },
  { value: 'high', label: 'High' },
]

const TRIGGER_HINTS: Record<LaserDmxShowDirectorTriggerMode, string> = {
  alwaysOn: 'Runs continuously. Good for haze, gentle washes, and layout previews when no track is loaded.',
  beat: 'Pulses on the selected beat division using BPM, beat index, and beat phase.',
  bar: 'Fires on downbeats. Use Bar interval for every 2, 4, or 8 bars.',
  phrase: 'Fires on phrase boundaries from the Music Intelligence phrase clock.',
  section: 'Stays active only while the current track section matches the selected gate.',
  cuePoint: 'Uses manual/imported cue markers first, then matching drop/section markers from analysis.',
  bassHit: 'Pulses when kick or bass transient strength crosses the hit threshold.',
  snareTransient: 'Pulses on snare-like or mid/high transient hits.',
  energy: 'Fades in when the track energy curve rises above the threshold.',
  audioBand: 'Pulses when the selected audio band crosses the threshold from below.',
}

const SECTION_OPTIONS: Array<{ value: LaserDmxShowDirectorSectionType; label: string }> = [
  { value: 'intro', label: 'Intro' },
  { value: 'verse', label: 'Verse' },
  { value: 'build', label: 'Build' },
  { value: 'drop', label: 'Drop' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'outro', label: 'Outro' },
]

const LED_DIRECTION_OPTIONS: Array<{ value: LaserDmxShowDirectorLedDirection; label: string }> = [
  { value: 'leftToRight', label: 'Left to right' },
  { value: 'rightToLeft', label: 'Right to left' },
  { value: 'centerOut', label: 'Center out' },
  { value: 'edgesIn', label: 'Edges in' },
  { value: 'chase', label: 'Chase' },
]

const MOVING_HEAD_STYLE_OPTIONS: Array<{ value: LaserDmxShowDirectorMovingHeadPanTiltStyle; label: string }> = [
  { value: 'locked', label: 'Locked aim' },
  { value: 'smoothSweep', label: 'Smooth sweep' },
  { value: 'snap', label: 'Snap turns' },
  { value: 'figureEight', label: 'Figure eight' },
  { value: 'audioReactive', label: 'Audio reactive' },
]

const VIDEO_WALL_SOURCE_OPTIONS: Array<{ value: LaserDmxShowDirectorVideoWallSource; label: string }> = [
  { value: 'placeholder', label: 'Source placeholder' },
  { value: 'reactVisual', label: 'React visual placeholder' },
  { value: 'media', label: 'Media placeholder' },
  { value: 'camera', label: 'Camera placeholder' },
]

const BEAM_FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser',
  'movingHead',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'parWash',
])

function isBeamFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return BEAM_FIXTURE_KINDS.has(fixture.kind)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function defaultEndpointForFixture(fixture: LaserDmxShowDirectorFixture, maxX: number, maxY: number, snapEnabled: boolean): { x: number; y: number } {
  const distance = Math.max(2, Math.min(maxX + 1, maxY + 1) * 0.32)
  const radians = (finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)) * Math.PI / 180
  const rawX = clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, maxX)
  const rawY = clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, maxY)
  return {
    x: snapEnabled ? Math.round(rawX) : Math.round(rawX * 10) / 10,
    y: snapEnabled ? Math.round(rawY) : Math.round(rawY * 10) / 10,
  }
}

function colorInputValue(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#4ac7db'
}

function beatDivisionValue(value: LaserDmxShowDirectorBeatDivision): string {
  return String(value)
}

function parseBeatDivision(value: string): LaserDmxShowDirectorBeatDivision {
  const numeric = Number(value)
  if (numeric === 0.25 || numeric === 0.5 || numeric === 2 || numeric === 4 || numeric === 8) return numeric
  return 1
}

function firstSection(fixture: LaserDmxShowDirectorFixture): LaserDmxShowDirectorSectionType {
  return fixture.trigger.sectionTypes[0] ?? 'drop'
}

function triggerRequirementNotes(fixture: LaserDmxShowDirectorFixture): string[] {
  const notes: string[] = []
  switch (fixture.trigger.mode) {
    case 'beat':
    case 'bar':
    case 'phrase':
      notes.push('Requires BPM/beat analysis during playback. The editor still works without a loaded track.')
      break
    case 'section':
      notes.push('Requires analyzed or manually edited track sections. Use Always On or Beat for a safe fallback when no sections exist.')
      break
    case 'cuePoint':
      notes.push('Requires cue markers or matching analyzed drop/section markers. Enter a cue ID to target a specific marker.')
      if (fixture.trigger.cuePointIds.length === 0) notes.push('No cue point ID is set yet; this trigger will listen for generic drop/cue markers only.')
      break
    case 'bassHit':
    case 'snareTransient':
    case 'audioBand':
      notes.push('Requires live audio band/transient data. In silent preview this trigger may stay idle.')
      break
    case 'energy':
      notes.push('Requires the Music Intelligence energy curve. If no curve is available, the fixture will not force itself on.')
      break
    case 'alwaysOn':
    default:
      break
  }
  return notes
}

export function LaserDmxShowDirectorInspector({ fixture }: LaserDmxShowDirectorInspectorProps) {
  const {
    fixtures,
    settings,
    updateFixture,
    deleteFixture,
    duplicateFixture,
  } = useReactStore(useShallow(s => ({
    fixtures:         s.laserDmxShowDirector.fixtures,
    settings:         s.laserDmxShowDirector.settings,
    updateFixture:    s.updateLaserDmxShowDirectorFixture,
    deleteFixture:    s.deleteLaserDmxShowDirectorFixture,
    duplicateFixture: s.duplicateLaserDmxShowDirectorFixture,
  })))
  const [draftLabel, setDraftLabel] = useState('')

  useEffect(() => {
    setDraftLabel(fixture?.label ?? '')
  }, [fixture?.id, fixture?.label])

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
          <p>Select a fixture to edit beam, color, and timing, plus transform, fades, and fixture-specific parameters.</p>
        </div>
        <div className="rv-show-director-empty">
          <strong>Select a fixture to edit beam, color, and timing</strong>
          <span>Drag a light component onto the Show Director canvas, then click it to open its production controls.</span>
        </div>
      </aside>
    )
  }

  const typeLabel = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
  const supportsBeam = isBeamFixture(fixture)
  const triggerNotes = triggerRequirementNotes(fixture)
  const defaultEndpoint = defaultEndpointForFixture(fixture, gridBounds.maxX, gridBounds.maxY, settings.snapEnabled)
  const defaultTargetX = defaultEndpoint.x
  const defaultTargetY = defaultEndpoint.y
  const fixtureIndex = fixtures.findIndex(item => item.id === fixture.id)
  const defaultFixtureLabel = `${typeLabel} ${Math.max(1, fixtureIndex + 1)}`
  const update = (patch: Parameters<typeof updateFixture>[1]) => updateFixture(fixture.id, patch)
  const commitLabelDraft = () => {
    const trimmed = draftLabel.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : defaultFixtureLabel
    setDraftLabel(nextLabel)
    if (nextLabel !== fixture.label) update({ label: nextLabel })
  }
  const handleLabelDraftChange = (label: string) => {
    setDraftLabel(label)
    if (label.trim().length > 0 && label !== fixture.label) update({ label })
  }
  const updateTriggerMode = (mode: LaserDmxShowDirectorTriggerMode) => {
    update({
      trigger: {
        mode,
        ...(mode === 'bassHit' ? { audioBand: 'bass' as const, audioThreshold: fixture.trigger.audioThreshold || 0.65 } : {}),
        ...(mode === 'snareTransient' ? { audioBand: 'highMid' as const, audioThreshold: fixture.trigger.audioThreshold || 0.58 } : {}),
        ...(mode === 'audioBand' ? { audioBand: fixture.trigger.audioBand ?? 'bass', audioThreshold: fixture.trigger.audioThreshold || 0.5 } : {}),
      },
    })
  }

  return (
    <aside className="rv-show-director-panel rv-show-director-inspector" aria-label="Show Director fixture inspector">
      <div className="rv-show-director-panel__header rv-show-director-inspector__header">
        <div>
          <span className="rv-show-director-kicker">Inspector</span>
          <h4>{fixture.label}</h4>
          <p>{typeLabel} · {fixture.enabled ? 'Enabled' : 'Disabled'} · {fixture.groupId || 'No group'}</p>
        </div>
        <span className="rv-show-director-inspector__swatch" style={{ background: fixture.color }} aria-hidden="true" />
      </div>

      <div className="rv-show-director-inspector__body">
        <CtrlSection label="Fixture" />
        <div className="rv-show-director-readout-grid">
          <div><span>Type</span><strong>{typeLabel}</strong></div>
          <div><span>ID</span><strong>{fixture.id.slice(0, 8)}</strong></div>
        </div>

        <CtrlSection label="Transform" />
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="Position X" value={fixture.x} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.1} onChange={x => update({ x: clamp(x, 0, gridBounds.maxX) })} />
          <NumberInputRow label="Position Y" value={fixture.y} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.1} onChange={y => update({ y: clamp(y, 0, gridBounds.maxY) })} />
          <NumberInputRow label="Height / Z" value={fixture.z} min={-10} max={10} step={0.1} onChange={z => update({ z: clamp(z, -10, 10) })} />
          <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => update({ rotation: clamp(rotation, -360, 360) })} />
        </div>

        <CtrlSection label="Light" />
        <ToggleRow label="Enabled / active" value={fixture.enabled} onChange={enabled => update({ enabled })} />
        <TextInputRow label="Label / name" value={draftLabel} maxLength={48} onChange={handleLabelDraftChange} onBlur={commitLabelDraft} />
        <TextInputRow label="Group" value={fixture.groupId ?? ''} maxLength={32} placeholder="Ungrouped" onChange={group => update({ groupId: group.trim() ? group.trim() : null })} />
        <SelectRow label="Color mode" value={fixture.colorMode} options={COLOR_MODE_OPTIONS} onChange={colorMode => update({ colorMode: colorMode as LaserDmxShowDirectorColorMode })} />
        <label className="rv-show-director-color-field">
          <span className="rv-ctrl-label">Color</span>
          <input type="color" value={colorInputValue(fixture.color)} onChange={event => update({ color: event.target.value })} />
          <span>{colorInputValue(fixture.color).toUpperCase()}</span>
        </label>
        <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => update({ brightness: clamp(brightness, 0, 1) })} />

        {supportsBeam && (
          <>
            <CtrlSection label="Beam" />
            <ToggleRow label="Beam enabled" value={fixture.beam.beamEnabled} onChange={beamEnabled => update({ beam: { beamEnabled } })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Beam angle" value={fixture.beam.beamAngle} min={-360} max={360} step={1} unit="°" onChange={beamAngle => update({ beam: { beamAngle: clamp(beamAngle, -360, 360) } })} />
              <NumberInputRow label="Beam spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} unit="°" onChange={beamSpread => update({ beam: { beamSpread: clamp(beamSpread, 0, 180) } })} />
            </div>
            <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => update({ beam: { focus: clamp(focus, 0, 1) } })} />
            <SelectRow label="Target mode" value={fixture.beam.targetMode} options={BEAM_TARGET_OPTIONS} onChange={targetMode => update({ beam: { targetMode: targetMode as LaserDmxShowDirectorBeamTargetMode } })} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Target X" value={fixture.beam.targetX ?? defaultTargetX} min={0} max={gridBounds.maxX} step={settings.snapEnabled ? 1 : 0.1} onChange={targetX => update({ beam: { targetX: clamp(targetX, 0, gridBounds.maxX) } })} />
              <NumberInputRow label="Target Y" value={fixture.beam.targetY ?? defaultTargetY} min={0} max={gridBounds.maxY} step={settings.snapEnabled ? 1 : 0.1} onChange={targetY => update({ beam: { targetY: clamp(targetY, 0, gridBounds.maxY) } })} />
            </div>
          </>
        )}

        <CtrlSection label="Trigger / Timing" />
        <SelectRow label="Trigger mode" value={fixture.trigger.mode} options={TRIGGER_MODE_OPTIONS} onChange={mode => updateTriggerMode(mode as LaserDmxShowDirectorTriggerMode)} />
        <p className="rv-show-director-trigger-hint">{TRIGGER_HINTS[fixture.trigger.mode]}</p>
        {triggerNotes.length > 0 && (
          <div className="rv-show-director-trigger-notes" role="note" aria-label="Show Director timing requirements">
            {triggerNotes.map(note => <span key={note}>{note}</span>)}
          </div>
        )}
        {(fixture.trigger.mode === 'beat' || fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase') && (
          <SelectRow label="Beat division" value={beatDivisionValue(fixture.trigger.beatDivision)} options={BEAT_DIVISION_OPTIONS} onChange={beatDivision => update({ trigger: { beatDivision: parseBeatDivision(beatDivision) } })} />
        )}
        {(fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase') && (
          <div className="rv-show-director-field-grid">
            {fixture.trigger.mode === 'bar' && <NumberInputRow label="Bar interval" value={fixture.trigger.barInterval} min={1} max={64} step={1} onChange={barInterval => update({ trigger: { barInterval: clamp(Math.round(barInterval), 1, 64) } })} />}
            {fixture.trigger.mode === 'phrase' && <NumberInputRow label="Phrase bars" value={fixture.trigger.phraseLengthBars} min={1} max={128} step={1} onChange={phraseLengthBars => update({ trigger: { phraseLengthBars: clamp(Math.round(phraseLengthBars), 1, 128) } })} />}
          </div>
        )}
        {fixture.trigger.mode === 'section' && (
          <SelectRow label="Section" value={firstSection(fixture)} options={SECTION_OPTIONS} onChange={sectionType => update({ trigger: { sectionTypes: [sectionType as LaserDmxShowDirectorSectionType] } })} />
        )}
        {fixture.trigger.mode === 'cuePoint' && (
          <TextInputRow label="Cue point ID" value={fixture.trigger.cuePointIds[0] ?? ''} maxLength={32} placeholder="A, B, Drop 1..." onChange={cuePointId => update({ trigger: { cuePointIds: cuePointId.trim() ? [cuePointId.trim()] : [] } })} />
        )}
        {fixture.trigger.mode === 'audioBand' && (
          <SelectRow label="Audio band" value={fixture.trigger.audioBand} options={AUDIO_BAND_OPTIONS} onChange={audioBand => update({ trigger: { audioBand: audioBand as LaserDmxShowDirectorAudioBand } })} />
        )}
        {(fixture.trigger.mode === 'bassHit' || fixture.trigger.mode === 'snareTransient' || fixture.trigger.mode === 'audioBand') && (
          <SliderRow label={fixture.trigger.mode === 'audioBand' ? 'Band threshold' : 'Hit threshold'} value={fixture.trigger.audioThreshold} min={0} max={1} step={0.01} onChange={audioThreshold => update({ trigger: { audioThreshold: clamp(audioThreshold, 0, 1) } })} />
        )}
        {fixture.trigger.mode === 'energy' && (
          <SliderRow label="Energy threshold" value={fixture.trigger.energyThreshold} min={0} max={1} step={0.01} onChange={energyThreshold => update({ trigger: { energyThreshold: clamp(energyThreshold, 0, 1) } })} />
        )}
        <div className="rv-show-director-field-grid">
          <NumberInputRow label="Fade in" value={fixture.trigger.fadeInMs} min={0} max={10000} step={25} unit="ms" onChange={fadeInMs => update({ trigger: { fadeInMs: clamp(Math.round(fadeInMs), 0, 10000) } })} />
          <NumberInputRow label="Fade out" value={fixture.trigger.fadeOutMs} min={0} max={10000} step={25} unit="ms" onChange={fadeOutMs => update({ trigger: { fadeOutMs: clamp(Math.round(fadeOutMs), 0, 10000) } })} />
        </div>

        {fixture.kind === 'strobe' && (
          <>
            <CtrlSection label="Strobe" />
            <NumberInputRow label="Strobe rate" value={fixture.component.strobeRate} min={0} max={30} step={0.5} unit="Hz" onChange={strobeRate => update({ component: { strobeRate: clamp(strobeRate, 0, 30) } })} />
          </>
        )}

        {(fixture.kind === 'ledBar' || fixture.kind === 'ledTube') && (
          <>
            <CtrlSection label={fixture.kind === 'ledBar' ? 'LED Bar' : 'LED Tube'} />
            <div className="rv-show-director-field-grid">
              <NumberInputRow label="Cell count" value={fixture.component.ledCellCount} min={1} max={64} step={1} onChange={ledCellCount => update({ component: { ledCellCount: clamp(Math.round(ledCellCount), 1, 64) } })} />
              <SelectRow label="Direction" value={fixture.component.ledDirection} options={LED_DIRECTION_OPTIONS} onChange={ledDirection => update({ component: { ledDirection: ledDirection as LaserDmxShowDirectorLedDirection } })} />
            </div>
          </>
        )}

        {fixture.kind === 'movingHead' && (
          <>
            <CtrlSection label="Moving Head" />
            <SelectRow label="Pan / tilt style" value={fixture.component.movingHeadPanTiltStyle} options={MOVING_HEAD_STYLE_OPTIONS} onChange={movingHeadPanTiltStyle => update({ component: { movingHeadPanTiltStyle: movingHeadPanTiltStyle as LaserDmxShowDirectorMovingHeadPanTiltStyle } })} />
          </>
        )}

        {fixture.kind === 'haze' && (
          <>
            <CtrlSection label="Haze" />
            <SliderRow label="Haze intensity" value={fixture.component.hazeIntensity} min={0} max={1} step={0.01} onChange={hazeIntensity => update({ component: { hazeIntensity: clamp(hazeIntensity, 0, 1) } })} />
          </>
        )}

        {fixture.kind === 'co2Jet' && (
          <>
            <CtrlSection label="CO₂ Jet" />
            <NumberInputRow label="Burst duration" value={fixture.component.co2BurstDurationMs} min={50} max={10000} step={50} unit="ms" onChange={co2BurstDurationMs => update({ component: { co2BurstDurationMs: clamp(Math.round(co2BurstDurationMs), 50, 10000) } })} />
          </>
        )}

        {fixture.kind === 'videoWall' && (
          <>
            <CtrlSection label="Video Wall" />
            <SliderRow label="Wall brightness" value={fixture.component.videoWallBrightness} min={0} max={1} step={0.01} onChange={videoWallBrightness => update({ component: { videoWallBrightness: clamp(videoWallBrightness, 0, 1) } })} />
            <SelectRow
              label="Source (coming soon)"
              value={fixture.component.videoWallSource}
              options={VIDEO_WALL_SOURCE_OPTIONS}
              onChange={() => undefined}
              disabled
              description="Video Wall currently compiles as a layout placeholder panel. Media, camera, and React Visual routing are not wired yet."
            />
          </>
        )}

        <div className="rv-show-director-inspector__actions">
          <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateFixture(fixture.id)}>Duplicate</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => deleteFixture(fixture.id)}>Delete</button>
        </div>
      </div>
    </aside>
  )
}
