import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SliderRow, SelectRow, ToggleRow, TextInputRow, CtrlSection, Collapsible } from './ReactControlRows'
import type {
  LaserDmxMatrixBeam, LaserDmxReactionGroup,
  LaserDmxMatrixBeamGeometry, LaserDmxMatrixTarget,
} from './ReactTypes'
import { LASER_DMX_MATRIX_COLUMNS, LASER_DMX_MATRIX_ROWS, LASER_DMX_MATRIX_MAX_BEAMS } from './ReactTypes'

const GEOMETRY_OPTIONS = [
  { value: 'line',          label: 'Line'           },
  { value: 'volumetricCone',label: 'Volumetric Cone'},
]

const TARGET_KIND_OPTIONS = [
  { value: 'grid',  label: 'Grid cell' },
  { value: 'stage', label: 'Stage (offscreen)' },
]

// ── Single-beam inspector ─────────────────────────────────────────────────────

interface SingleBeamProps {
  beam:   LaserDmxMatrixBeam
  groups: LaserDmxReactionGroup[]
}

function SingleBeamInspector({ beam, groups }: SingleBeamProps) {
  const {
    updateLaserDmxMatrixBeam,
    duplicateLaserDmxMatrixBeam,
    removeLaserDmxMatrixBeam,
  } = useReactStore(useShallow(s => ({
    updateLaserDmxMatrixBeam:  s.updateLaserDmxMatrixBeam,
    duplicateLaserDmxMatrixBeam: s.duplicateLaserDmxMatrixBeam,
    removeLaserDmxMatrixBeam:  s.removeLaserDmxMatrixBeam,
  })))

  const bid = beam.id
  const upd = (patch: Partial<LaserDmxMatrixBeam>) => updateLaserDmxMatrixBeam(bid, patch)

  const groupOptions = [
    { value: '', label: 'None' },
    ...groups.map(g => ({ value: g.id, label: g.name })),
  ]

  function setTarget(patch: Partial<LaserDmxMatrixTarget>) {
    upd({ target: { ...beam.target, ...patch } as LaserDmxMatrixTarget })
  }

  function switchTargetKind(kind: 'grid' | 'stage') {
    if (kind === 'grid') {
      upd({ target: { kind: 'grid', column: beam.origin.column, row: 1, z: 0 } })
    } else {
      const norm = { x: (beam.origin.column - 0.5) / LASER_DMX_MATRIX_COLUMNS, y: 0, z: 0 }
      upd({ target: { kind: 'stage', x: norm.x, y: norm.y, z: 0 } })
    }
  }

  return (
    <>
      <CtrlSection label="Selected Beam" />
      <TextInputRow label="Name" value={beam.name} onChange={v => upd({ name: v })} maxLength={32} />
      <ToggleRow label="Enabled" value={beam.enabled} onChange={v => upd({ enabled: v })} />

      <CtrlSection label="Group" />
      <SelectRow
        label="Group"
        value={beam.groupId ?? ''}
        onChange={v => upd({ groupId: v === '' ? null : v })}
        options={groupOptions}
      />
      <ToggleRow label="Use Group Color" value={beam.useGroupColor} onChange={v => upd({ useGroupColor: v })} />

      <CtrlSection label="Origin" />
      <SliderRow label="Col" value={beam.origin.column} onChange={v => upd({ origin: { ...beam.origin, column: Math.round(v) } })} min={1} max={LASER_DMX_MATRIX_COLUMNS} step={1} color="#4ac7db" />
      <SliderRow label="Row" value={beam.origin.row}    onChange={v => upd({ origin: { ...beam.origin, row:    Math.round(v) } })} min={1} max={LASER_DMX_MATRIX_ROWS}    step={1} color="#61d6aa" />
      <SliderRow label="Z"   value={beam.origin.z}      onChange={v => upd({ origin: { ...beam.origin, z: v } })}                 min={-1} max={1}                        step={0.01} color="#d8b95a" />

      <CtrlSection label="Target" />
      <SelectRow
        label="Kind"
        value={beam.target.kind}
        onChange={v => switchTargetKind(v as 'grid' | 'stage')}
        options={TARGET_KIND_OPTIONS}
      />
      {beam.target.kind === 'grid' ? (
        <>
          <SliderRow label="Target Col" value={beam.target.column} onChange={v => setTarget({ column: Math.round(v) })} min={1} max={LASER_DMX_MATRIX_COLUMNS} step={1} color="#4ac7db" />
          <SliderRow label="Target Row" value={beam.target.row}    onChange={v => setTarget({ row:    Math.round(v) })} min={1} max={LASER_DMX_MATRIX_ROWS}    step={1} color="#61d6aa" />
          <SliderRow label="Target Z"   value={beam.target.z}      onChange={v => setTarget({ z: v })}                 min={-1} max={1}                        step={0.01} color="#d8b95a" />
        </>
      ) : (
        <>
          <SliderRow label="Target X" value={beam.target.x} onChange={v => setTarget({ x: v })} min={-1} max={2} step={0.01} color="#4ac7db" />
          <SliderRow label="Target Y" value={beam.target.y} onChange={v => setTarget({ y: v })} min={-1} max={2} step={0.01} color="#61d6aa" />
          <SliderRow label="Target Z" value={beam.target.z} onChange={v => setTarget({ z: v })} min={-1} max={2} step={0.01} color="#d8b95a" />
        </>
      )}

      <Collapsible label="Appearance" defaultOpen>
        <SelectRow label="Geometry" value={beam.appearance.geometry} onChange={v => upd({ appearance: { ...beam.appearance, geometry: v as LaserDmxMatrixBeamGeometry } })} options={GEOMETRY_OPTIONS} />
        <SliderRow label="Dimmer"      value={beam.appearance.dimmer}        onChange={v => upd({ appearance: { ...beam.appearance, dimmer:        v } })} min={0} max={1}   step={0.01} color="#4ac7db" />
        <ToggleRow label="Shutter"     value={beam.appearance.shutterOpen}   onChange={v => upd({ appearance: { ...beam.appearance, shutterOpen:   v } })} />
        <SliderRow label="Width"       value={beam.appearance.width}         onChange={v => upd({ appearance: { ...beam.appearance, width:         v } })} min={0.1} max={8} step={0.05} color="#61d6aa" />
        <SliderRow label="Focus"       value={beam.appearance.focus}         onChange={v => upd({ appearance: { ...beam.appearance, focus:         v } })} min={0} max={1}   step={0.01} color="#d8b95a" />
        <SliderRow label="Glow"        value={beam.appearance.glow}          onChange={v => upd({ appearance: { ...beam.appearance, glow:          v } })} min={0} max={1}   step={0.01} color="#b84fc9" />
        <SliderRow label="Divergence"  value={beam.appearance.divergence}    onChange={v => upd({ appearance: { ...beam.appearance, divergence:    v } })} min={0} max={1}   step={0.01} color="#4ac7db" />
        <SliderRow label="Strobe Rate" value={beam.appearance.strobeRate}    onChange={v => upd({ appearance: { ...beam.appearance, strobeRate:    v } })} min={0} max={1}   step={0.01} color="#c0314a" />
        <SliderRow label="Flicker"     value={beam.appearance.flickerAmount} onChange={v => upd({ appearance: { ...beam.appearance, flickerAmount: v } })} min={0} max={1}   step={0.01} color="#c0314a" />
      </Collapsible>

      {!beam.useGroupColor && (
        <Collapsible label="Color" defaultOpen={false}>
          <SliderRow label="Red"   value={beam.color.red}   onChange={v => upd({ color: { ...beam.color, red:   Math.round(v) } })} min={0} max={255} step={1} color="#c0314a" />
          <SliderRow label="Green" value={beam.color.green} onChange={v => upd({ color: { ...beam.color, green: Math.round(v) } })} min={0} max={255} step={1} color="#61d6aa" />
          <SliderRow label="Blue"  value={beam.color.blue}  onChange={v => upd({ color: { ...beam.color, blue:  Math.round(v) } })} min={0} max={255} step={1} color="#4ac7db" />
          <SliderRow label="White" value={beam.color.white} onChange={v => upd({ color: { ...beam.color, white: Math.round(v) } })} min={0} max={255} step={1} color="#e8f4f8" />
          <SliderRow label="Alpha" value={beam.color.alpha} onChange={v => upd({ color: { ...beam.color, alpha: v } })} min={0} max={1} step={0.01} color="#b84fc9" />
        </Collapsible>
      )}

      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateLaserDmxMatrixBeam(bid)}>⧉ Dupe</button>
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          onClick={() => { if (window.confirm(`Delete beam "${beam.name}"?`)) removeLaserDmxMatrixBeam(bid) }}
        >
          × Delete
        </button>
      </div>
    </>
  )
}

// ── Multi-beam bulk editor ────────────────────────────────────────────────────

interface MultiBeamProps {
  beams:  LaserDmxMatrixBeam[]
  groups: LaserDmxReactionGroup[]
  maxBeams: number
}

function MultiBeamBulkEditor({ beams, groups, maxBeams }: MultiBeamProps) {
  const {
    updateLaserDmxMatrixBeam,
    removeSelectedLaserDmxMatrixBeams,
    duplicateLaserDmxMatrixBeamsWithOffset,
    setSelectedLaserDmxMatrixBeams,
  } = useReactStore(useShallow(s => ({
    updateLaserDmxMatrixBeam:               s.updateLaserDmxMatrixBeam,
    removeSelectedLaserDmxMatrixBeams:      s.removeSelectedLaserDmxMatrixBeams,
    duplicateLaserDmxMatrixBeamsWithOffset: s.duplicateLaserDmxMatrixBeamsWithOffset,
    setSelectedLaserDmxMatrixBeams:         s.setSelectedLaserDmxMatrixBeams,
  })))

  const [colOff, setColOff] = useState(1)
  const [rowOff, setRowOff] = useState(0)
  const [preserveGrp, setPreserveGrp] = useState(true)
  const [lastDupeMsg, setLastDupeMsg] = useState<string | null>(null)

  const groupOptions = [
    { value: '', label: 'None' },
    ...groups.map(g => ({ value: g.id, label: g.name })),
  ]

  function bulkSetGroup(gid: string) {
    beams.forEach(b => updateLaserDmxMatrixBeam(b.id, { groupId: gid === '' ? null : gid }))
  }

  function bulkEnable(enabled: boolean) {
    beams.forEach(b => updateLaserDmxMatrixBeam(b.id, { enabled }))
  }

  function dupeWithOffset() {
    const n = duplicateLaserDmxMatrixBeamsWithOffset(
      beams.map(b => b.id),
      colOff,
      rowOff,
      { preserveGroups: preserveGrp },
    )
    const wanted = beams.length
    if (n < wanted) {
      setLastDupeMsg(`Created ${n} of ${wanted} — beam limit (${maxBeams}) reached.`)
    } else {
      setLastDupeMsg(`Duplicated ${n} beam${n !== 1 ? 's' : ''}.`)
    }
  }

  return (
    <>
      <CtrlSection label={`${beams.length} Beams Selected`} />

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => bulkEnable(true)}>Enable All</button>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => bulkEnable(false)}>Disable All</button>
        <button
          type="button"
          className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
          aria-label="Delete selected beams"
          onClick={() => { if (window.confirm(`Delete ${beams.length} selected beams?`)) removeSelectedLaserDmxMatrixBeams() }}
        >
          × Delete
        </button>
      </div>

      <CtrlSection label="Assign Group" />
      <SelectRow label="Group" value="" onChange={bulkSetGroup} options={groupOptions} />
      <button
        type="button"
        className="rv-glyph-upload-btn"
        style={{ marginTop: 4 }}
        onClick={() => beams.forEach(b => updateLaserDmxMatrixBeam(b.id, { groupId: null }))}
      >
        Clear Group
      </button>

      <CtrlSection label="Duplicate with Offset" />
      <SliderRow label="Column Offset" value={colOff} onChange={v => setColOff(Math.round(v))} min={-14} max={14} step={1} color="#4ac7db" />
      <SliderRow label="Row Offset"    value={rowOff} onChange={v => setRowOff(Math.round(v))} min={-9}  max={9}  step={1} color="#61d6aa" />
      <ToggleRow label="Keep Groups" value={preserveGrp} onChange={setPreserveGrp} />
      <button type="button" className="rv-glyph-upload-btn" style={{ marginTop: 4 }} onClick={dupeWithOffset}>
        Duplicate {beams.length} Beam{beams.length !== 1 ? 's' : ''}
      </button>
      {lastDupeMsg && (
        <div className="rv-ctrl-info" style={{ marginTop: 4 }}>{lastDupeMsg}</div>
      )}

      <button
        type="button"
        className="rv-glyph-upload-btn"
        style={{ marginTop: 6 }}
        onClick={() => setSelectedLaserDmxMatrixBeams([])}
      >
        Clear Selection
      </button>
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export function LaserDmxBeamInspector() {
  const { laserDmxBeamMatrix } = useReactStore(
    useShallow(s => ({ laserDmxBeamMatrix: s.laserDmxBeamMatrix }))
  )
  const { beams, groups, selectedBeamIds } = laserDmxBeamMatrix
  const selectedBeams = beams.filter(b => selectedBeamIds.includes(b.id))

  if (selectedBeams.length === 0) {
    return (
      <div className="rv-ctrl-info">
        Click a beam in the editor to select it, or use Add Beam above.
      </div>
    )
  }

  if (selectedBeams.length === 1) {
    return <SingleBeamInspector beam={selectedBeams[0]} groups={groups} />
  }

  return (
    <MultiBeamBulkEditor
      beams={selectedBeams}
      groups={groups}
      maxBeams={LASER_DMX_MATRIX_MAX_BEAMS}
    />
  )
}
