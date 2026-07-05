import type { LaserDmxBeamSequence, LaserDmxSequenceMode } from './ReactTypes'
import { SliderRow, SelectRow, ToggleRow, Collapsible } from './ReactControlRows'

// stepsPerBeat → musical subdivision label
// stepsPerBeat=1 → 1 step per beat → quarter-note steps
// stepsPerBeat=2 → 2 steps per beat → eighth-note steps
const STEPS_PER_BEAT_OPTIONS = [
  { value: '0.25', label: '1 per bar'     },
  { value: '0.5',  label: '1/2 (half)'   },
  { value: '1',    label: '1/4 (beat)'   },
  { value: '2',    label: '1/8'          },
  { value: '4',    label: '1/16'         },
  { value: '8',    label: '1/32'         },
]

const SEQUENCE_MODE_OPTIONS = [
  { value: 'all',          label: 'All At Once'     },
  { value: 'forward',      label: 'Forward'         },
  { value: 'reverse',      label: 'Reverse'         },
  { value: 'alternate',    label: 'Alternate'       },
  { value: 'centerOut',    label: 'Center Out'      },
  { value: 'outsideIn',    label: 'Outside In'      },
  { value: 'randomSeeded', label: 'Random (Seeded)' },
  { value: 'custom',       label: 'Custom'          },
]

interface LaserDmxGroupSequencerControlsProps {
  sequence: LaserDmxBeamSequence
  onChange: (seq: LaserDmxBeamSequence) => void
}

export function LaserDmxGroupSequencerControls({ sequence, onChange }: LaserDmxGroupSequencerControlsProps) {
  const upd = (patch: Partial<LaserDmxBeamSequence>) => onChange({ ...sequence, ...patch })
  const { enabled, mode } = sequence

  // Find closest option value or default to '1'
  const stepsValue = STEPS_PER_BEAT_OPTIONS.some(o => o.value === String(sequence.stepsPerBeat))
    ? String(sequence.stepsPerBeat)
    : '1'

  const showSeed   = mode === 'randomSeeded'
  const showRotate = enabled && mode !== 'all' && mode !== 'custom'

  return (
    <Collapsible label="Sequencer" defaultOpen>
      <ToggleRow
        label="Sequencer Enabled"
        value={enabled}
        onChange={v => upd({ enabled: v })}
      />
      {enabled && (
        <>
          <SelectRow
            label="Mode"
            value={mode}
            onChange={v => upd({ mode: v as LaserDmxSequenceMode })}
            options={SEQUENCE_MODE_OPTIONS}
          />
          <SelectRow
            label="Steps / Beat"
            value={stepsValue}
            onChange={v => upd({ stepsPerBeat: parseFloat(v) })}
            options={STEPS_PER_BEAT_OPTIONS}
          />
          <SliderRow
            label="Step Gate"
            value={sequence.stepGate}
            onChange={v => upd({ stepGate: v })}
            min={0} max={1} step={0.01}
            color="#61d6aa"
          />
          <SliderRow
            label="Phase Spread"
            value={sequence.phaseSpread}
            onChange={v => upd({ phaseSpread: v })}
            min={0} max={1} step={0.01}
            color="#d8b95a"
          />
          <ToggleRow
            label="Reset on Downbeat"
            value={sequence.resetOnDownbeat}
            onChange={v => upd({ resetOnDownbeat: v })}
          />
          {showRotate && (
            <SliderRow
              label="Rotate Every (bars)"
              value={sequence.rotateEveryBars}
              onChange={v => upd({ rotateEveryBars: Math.round(v) })}
              min={0} max={32} step={1}
              color="#4ac7db"
            />
          )}
          {showSeed && (
            <SliderRow
              label="Random Seed"
              value={sequence.seed}
              onChange={v => upd({ seed: Math.round(v) })}
              min={0} max={255} step={1}
              color="#b84fc9"
            />
          )}
        </>
      )}
    </Collapsible>
  )
}
