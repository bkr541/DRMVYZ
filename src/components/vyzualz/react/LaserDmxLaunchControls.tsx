import { SliderRow, SelectRow } from './ReactControlRows'
import type { LaserDmxLaunchSettings, LaserDmxLaunchTrigger } from './ReactTypes'

const TRIGGER_OPTIONS: { value: LaserDmxLaunchTrigger; label: string }[] = [
  { value: 'none',        label: 'None (off)'    },
  { value: 'beat',        label: 'Beat'          },
  { value: 'downbeat',    label: 'Downbeat'      },
  { value: 'kick',        label: 'Kick'          },
  { value: 'snare',       label: 'Snare'         },
  { value: 'dropImpact',  label: 'Drop Impact'   },
]

interface LaserDmxLaunchControlsProps {
  launch:   LaserDmxLaunchSettings
  onChange: (patch: Partial<LaserDmxLaunchSettings>) => void
  maxActiveBeams:    number
  onMaxActiveChange: (v: number) => void
}

export function LaserDmxLaunchControls({
  launch,
  onChange,
  maxActiveBeams,
  onMaxActiveChange,
}: LaserDmxLaunchControlsProps) {
  const hasTrigger = launch.trigger !== 'none'

  return (
    <>
      <SelectRow
        label="Trigger"
        value={launch.trigger}
        onChange={v => onChange({ trigger: v as LaserDmxLaunchTrigger })}
        options={TRIGGER_OPTIONS}
      />
      {hasTrigger && (
        <>
          <SliderRow
            label="Threshold"
            value={launch.threshold}
            onChange={v => onChange({ threshold: v })}
            min={0} max={1} step={0.01}
          />
          <SliderRow
            label="Min Energy"
            value={launch.minimumEnergy}
            onChange={v => onChange({ minimumEnergy: v })}
            min={0} max={1} step={0.01}
          />
          <SliderRow
            label="Cooldown Beats"
            value={launch.cooldownBeats}
            onChange={v => onChange({ cooldownBeats: v })}
            min={0} max={16} step={0.25}
          />
        </>
      )}
      <SliderRow
        label="Max Active Beams"
        value={maxActiveBeams}
        onChange={v => onMaxActiveChange(Math.round(v))}
        min={0} max={16} step={1}
      />
      {maxActiveBeams === 0 && (
        <div className="rv-ctrl-info">0 = unlimited (all beams in group can be active simultaneously)</div>
      )}
    </>
  )
}
