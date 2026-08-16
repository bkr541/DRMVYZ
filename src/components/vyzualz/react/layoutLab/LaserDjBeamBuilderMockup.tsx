import { useRef, useState } from 'react'
import { NumberInputRow, SelectRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'

// ── LaserDjBeamBuilderMockup ────────────────────────────────────────────────
//
// Layout Lab / Template engine, REACT tab (previously empty). A DJ-laser beam
// programming workflow, composed entirely from ReactControlRows primitives
// (SelectRow, NumberInputRow) and the canonical IconChipButton — the same
// building blocks every real Design/React tab in the app already uses.
//
// Trigger vocabulary is copied verbatim from
// LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS in LaserDmxShowManagerDomain.ts —
// real LaserDMX Show Manager trigger semantics, not invented. The endpoint
// fields mirror the real beam.targetX/targetY grid (18×12,
// LASER_DMX_SHOW_MANAGER_GRID_SIZE). "DJ laser" here means the existing
// 'laser' fixture kind — there is no distinct DJ-laser fixture kind in the
// domain model, and adding one is out of scope for a Layout Lab mockup.
// Fixture names, and the "duration" and "beam list" concepts, are new —
// no per-fixture beam list or explicit hold-duration field exists yet on the
// real domain (fixtures hold exactly one beam + one trigger today).

const GRID_WIDTH = 18
const GRID_HEIGHT = 12

const DJ_LASER_FIXTURES = [
  { id: 'laser-dj-booth', name: 'Laser 1 — DJ Booth' },
  { id: 'laser-stage-left', name: 'Laser 2 — Stage Left' },
  { id: 'laser-stage-right', name: 'Laser 3 — Stage Right' },
  { id: 'laser-center-truss', name: 'Laser 4 — Center Truss' },
]

// Verbatim from LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.
const BEAM_TRIGGER_OPTIONS = [
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

interface BeamSegment {
  id: string
  endpointX: number
  endpointY: number
  trigger: string
  durationBeats: number
}

function createBeamSegment(id: string): BeamSegment {
  return {
    id,
    endpointX: Math.round(GRID_WIDTH / 2),
    endpointY: Math.round(GRID_HEIGHT / 2),
    trigger: 'downbeat',
    durationBeats: 1,
  }
}

export function LaserDjBeamBuilderMockup() {
  const [selectedFixtureId, setSelectedFixtureId] = useState(DJ_LASER_FIXTURES[0].id)
  const [beamsByFixture, setBeamsByFixture] = useState<Record<string, BeamSegment[]>>(() => (
    Object.fromEntries(DJ_LASER_FIXTURES.map(fixture => [fixture.id, [createBeamSegment(`${fixture.id}-beam-1`)]]))
  ))
  const nextBeamIndexRef = useRef(2)

  const beams = beamsByFixture[selectedFixtureId] ?? []

  const updateBeam = (beamId: string, patch: Partial<BeamSegment>) => {
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
      [selectedFixtureId]: [...(current[selectedFixtureId] ?? []), createBeamSegment(id)],
    }))
  }

  const removeBeam = (beamId: string) => {
    setBeamsByFixture(current => ({
      ...current,
      [selectedFixtureId]: current[selectedFixtureId].filter(beam => beam.id !== beamId),
    }))
  }

  return (
    <div className="rv-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <p className="rv-presets-hint">
            Program a DJ laser fixture: pick where each beam shoots, what triggers it on the beat grid, and how long it holds — then chain as many beams as the fixture should fire in sequence.
          </p>

          <SelectRow
            label="DJ Laser Fixture"
            value={selectedFixtureId}
            onChange={setSelectedFixtureId}
            options={DJ_LASER_FIXTURES.map(fixture => ({ value: fixture.id, label: fixture.name }))}
            description="The fixture this beam sequence programs."
          />

          <div className="rv-dj-laser-beam-list" aria-label="Programmed beams for the selected fixture">
            {beams.map((beam, index) => (
              <div key={beam.id} className="rv-dj-laser-beam-card">
                <div className="rv-dj-laser-beam-card-header">
                  <strong>Beam {index + 1}</strong>
                  <IconChipButton
                    onClick={() => removeBeam(beam.id)}
                    disabled={beams.length <= 1}
                    aria-label={`Remove Beam ${index + 1}`}
                  >
                    Remove
                  </IconChipButton>
                </div>

                <NumberInputRow
                  label="Endpoint X"
                  value={beam.endpointX}
                  onChange={value => updateBeam(beam.id, { endpointX: value })}
                  min={0}
                  max={GRID_WIDTH}
                  step={1}
                />
                <NumberInputRow
                  label="Endpoint Y"
                  value={beam.endpointY}
                  onChange={value => updateBeam(beam.id, { endpointY: value })}
                  min={0}
                  max={GRID_HEIGHT}
                  step={1}
                />

                <SelectRow
                  label="Trigger"
                  value={beam.trigger}
                  onChange={value => updateBeam(beam.id, { trigger: value })}
                  options={BEAM_TRIGGER_OPTIONS}
                  description="What turns this beam on and off."
                />

                <NumberInputRow
                  label="Duration"
                  value={beam.durationBeats}
                  onChange={value => updateBeam(beam.id, { durationBeats: value })}
                  min={0.25}
                  max={32}
                  step={0.25}
                  unit="beats"
                />
              </div>
            ))}
          </div>

          <IconChipButton tone="primary" onClick={addBeam} className="rv-dj-laser-add-beam">
            + Add Another Beam
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}
