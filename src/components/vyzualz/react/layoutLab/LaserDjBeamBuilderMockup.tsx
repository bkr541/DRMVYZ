import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { NumberInputRow, SelectRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { IconMorphToggle } from '../controls/IconMorphToggle'

// ── LaserDjBeamBuilderMockup ────────────────────────────────────────────────
//
// Layout Lab / Template engine, REACT tab. A DJ-laser trigger-routing matrix —
// audio-intelligence sources as rows, beams as columns, click a cell to patch
// a source to a beam — the same source×destination matrix shape used by
// DMX patch bays, audio routing matrices, and synth mod matrices, rather than
// a flat form per beam.
//
// Row vocabulary is real, not invented:
//   - Rhythmic rows copy LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS from
//     LaserDmxShowManagerDomain.ts verbatim (none/beat/downbeat/bar intervals/
//     kick/snare).
//   - Audio Band rows copy AUDIO_BAND_OPTIONS from LaserDmxShowDirectorInspector.tsx
//     verbatim. These map to the real domain's `audioBand` trigger mode
//     (LaserDmxShowDirectorTriggerConfig.audioBand/audioThreshold) — the
//     simplified 9-option preset list just doesn't surface it directly, but
//     band-driven triggering is a real, existing capability.
// A beam holds exactly one trigger in the real domain, so a column is
// single-select (clicking a cell routes that source to the beam, exactly
// like selecting a radio in a matrix column — "None" is itself a real,
// explicit row for "no trigger", not a missing-selection state).
// "DJ laser" = the existing 'laser' fixture kind; there's no distinct
// DJ-laser fixture kind in the domain, and inventing one is out of scope for
// a Layout Lab mockup. The per-fixture beam list and endpoint/duration
// fields remain new, same as before — no per-fixture beam array or explicit
// duration field exists on the real domain yet.

const GRID_WIDTH = 18
const GRID_HEIGHT = 12

const DJ_LASER_FIXTURES = [
  { id: 'laser-dj-booth', name: 'Laser 1 — DJ Booth' },
  { id: 'laser-stage-left', name: 'Laser 2 — Stage Left' },
  { id: 'laser-stage-right', name: 'Laser 3 — Stage Right' },
  { id: 'laser-center-truss', name: 'Laser 4 — Center Truss' },
]

// Verbatim from LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.
const RHYTHMIC_TRIGGER_ROWS = [
  { value: 'none', label: 'None' },
  { value: 'beat', label: 'Beat' },
  { value: 'downbeat', label: 'Downbeat' },
  { value: '4bars', label: '4 Bars' },
  { value: '8bars', label: '8 Bars' },
  { value: '16bars', label: '16 Bars' },
  { value: '24bars', label: '24 Bars' },
  { value: 'kickHit', label: 'Kick Hit' },
  { value: 'snareHit', label: 'Snare Hit' },
]

// Verbatim from AUDIO_BAND_OPTIONS, namespaced so values never collide with
// the rhythmic rows above.
const AUDIO_BAND_TRIGGER_ROWS = [
  { value: 'band:sub', label: 'Sub' },
  { value: 'band:bass', label: 'Bass' },
  { value: 'band:lowMid', label: 'Low-mid' },
  { value: 'band:mid', label: 'Mid' },
  { value: 'band:highMid', label: 'High-mid' },
  { value: 'band:high', label: 'High' },
]

const ALL_TRIGGER_ROWS = [...RHYTHMIC_TRIGGER_ROWS, ...AUDIO_BAND_TRIGGER_ROWS]

function triggerLabel(value: string): string {
  return ALL_TRIGGER_ROWS.find(row => row.value === value)?.label ?? 'None'
}

interface Beam {
  id: string
  endpointX: number
  endpointY: number
  trigger: string
  durationBeats: number
}

function createBeam(id: string): Beam {
  return {
    id,
    endpointX: Math.round(GRID_WIDTH / 2),
    endpointY: Math.round(GRID_HEIGHT / 2),
    trigger: 'downbeat',
    durationBeats: 1,
  }
}

function MatrixRow({
  rowLabel,
  rowValue,
  beams,
  onRoute,
}: {
  rowLabel: string
  rowValue: string
  beams: Beam[]
  onRoute: (beamId: string, value: string) => void
}) {
  return (
    <div className="rv-dj-laser-matrix-row">
      <span className="rv-dj-laser-matrix-row-label">{rowLabel}</span>
      {beams.map((beam, index) => {
        const active = beam.trigger === rowValue
        return (
          <IconMorphToggle
            key={beam.id}
            checked={active}
            onCheckedChange={() => onRoute(beam.id, rowValue)}
            className="rv-dj-laser-matrix-cell"
            aria-label={`Route ${rowLabel} to Beam ${index + 1}`}
          />
        )
      })}
    </div>
  )
}

export function LaserDjBeamBuilderMockup() {
  const [selectedFixtureId, setSelectedFixtureId] = useState(DJ_LASER_FIXTURES[0].id)
  const [beamsByFixture, setBeamsByFixture] = useState<Record<string, Beam[]>>(() => (
    Object.fromEntries(DJ_LASER_FIXTURES.map(fixture => [fixture.id, [createBeam(`${fixture.id}-beam-1`)]]))
  ))
  const [focusedBeamId, setFocusedBeamId] = useState(`${DJ_LASER_FIXTURES[0].id}-beam-1`)
  const nextBeamIndexRef = useRef(2)

  const beams = beamsByFixture[selectedFixtureId] ?? []
  const focusedBeam = beams.find(beam => beam.id === focusedBeamId) ?? beams[0] ?? null
  const focusedBeamIndex = focusedBeam ? beams.findIndex(beam => beam.id === focusedBeam.id) : -1

  const updateBeam = (beamId: string, patch: Partial<Beam>) => {
    setBeamsByFixture(current => ({
      ...current,
      [selectedFixtureId]: current[selectedFixtureId].map(beam => (
        beam.id === beamId ? { ...beam, ...patch } : beam
      )),
    }))
  }

  const addBeam = () => {
    const id = `${selectedFixtureId}-beam-${nextBeamIndexRef.current++}`
    setBeamsByFixture(current => ({
      ...current,
      [selectedFixtureId]: [...(current[selectedFixtureId] ?? []), createBeam(id)],
    }))
    setFocusedBeamId(id)
  }

  const removeBeam = (beamId: string) => {
    setBeamsByFixture(current => {
      const remaining = current[selectedFixtureId].filter(beam => beam.id !== beamId)
      return { ...current, [selectedFixtureId]: remaining }
    })
    if (focusedBeamId === beamId) {
      const remaining = beams.filter(beam => beam.id !== beamId)
      setFocusedBeamId(remaining[0]?.id ?? '')
    }
  }

  const selectFixture = (fixtureId: string) => {
    setSelectedFixtureId(fixtureId)
    setFocusedBeamId(beamsByFixture[fixtureId]?.[0]?.id ?? '')
  }

  const matrixStyle = useMemo(() => ({ '--beam-count': beams.length } as CSSProperties), [beams.length])

  return (
    <div className="rv-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <p className="rv-presets-hint">
            Patch audio-intelligence sources to beams like a routing matrix: pick the fixture, add a beam per column, then click a row to route that trigger to it. Select a beam to edit its endpoint and hold duration below.
          </p>

          <SelectRow
            label="DJ Laser Fixture"
            value={selectedFixtureId}
            onChange={selectFixture}
            options={DJ_LASER_FIXTURES.map(fixture => ({ value: fixture.id, label: fixture.name }))}
            description="The fixture this routing matrix programs."
          />

          <div className="rv-dj-laser-matrix" style={matrixStyle} aria-label="Trigger routing matrix">
            <div className="rv-dj-laser-matrix-row rv-dj-laser-matrix-row--header">
              <span className="rv-dj-laser-matrix-corner">Source → Beam</span>
              {beams.map((beam, index) => (
                <div key={beam.id} className="rv-dj-laser-matrix-col-head">
                  <button
                    type="button"
                    className={`rv-dj-laser-matrix-col-head-btn${focusedBeam?.id === beam.id ? ' is-focused' : ''}`}
                    onClick={() => setFocusedBeamId(beam.id)}
                    aria-pressed={focusedBeam?.id === beam.id}
                  >
                    {index + 1}
                  </button>
                  {beams.length > 1 && (
                    <button
                      type="button"
                      className="rv-dj-laser-matrix-col-remove"
                      onClick={() => removeBeam(beam.id)}
                      aria-label={`Remove Beam ${index + 1}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="rv-dj-laser-matrix-group-label">Rhythmic Triggers</div>
            {RHYTHMIC_TRIGGER_ROWS.map(row => (
              <MatrixRow key={row.value} rowLabel={row.label} rowValue={row.value} beams={beams} onRoute={(beamId, value) => updateBeam(beamId, { trigger: value })} />
            ))}

            <div className="rv-dj-laser-matrix-group-label">Audio Bands</div>
            {AUDIO_BAND_TRIGGER_ROWS.map(row => (
              <MatrixRow key={row.value} rowLabel={row.label} rowValue={row.value} beams={beams} onRoute={(beamId, value) => updateBeam(beamId, { trigger: value })} />
            ))}
          </div>

          <IconChipButton tone="primary" onClick={addBeam} className="rv-dj-laser-add-beam">
            + Add Beam Column
          </IconChipButton>

          {focusedBeam && (
            <div className="rv-dj-laser-beam-detail">
              <div className="rv-dj-laser-beam-detail-head">
                <strong>Beam {focusedBeamIndex + 1}</strong>
                <span className="rv-dj-laser-signal-flow">{triggerLabel(focusedBeam.trigger)} → Beam {focusedBeamIndex + 1}</span>
              </div>

              <NumberInputRow
                label="Endpoint X"
                value={focusedBeam.endpointX}
                onChange={value => updateBeam(focusedBeam.id, { endpointX: value })}
                min={0}
                max={GRID_WIDTH}
                step={1}
              />
              <NumberInputRow
                label="Endpoint Y"
                value={focusedBeam.endpointY}
                onChange={value => updateBeam(focusedBeam.id, { endpointY: value })}
                min={0}
                max={GRID_HEIGHT}
                step={1}
              />
              <NumberInputRow
                label="Duration"
                value={focusedBeam.durationBeats}
                onChange={value => updateBeam(focusedBeam.id, { durationBeats: value })}
                min={0.25}
                max={32}
                step={0.25}
                unit="beats"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
