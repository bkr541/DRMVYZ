import type { LaserDmxBeamMotion, LaserDmxBeamTravelMode } from './ReactTypes'
import { SliderRow, Collapsible, SelectRow } from './ReactControlRows'

const TRAVEL_MODE_OPTIONS = [
  { value: 'static',     label: 'Static'      },
  { value: 'grow',       label: 'Grow'        },
  { value: 'projectile', label: 'Projectile'  },
  { value: 'scanner',    label: 'Scanner'     },
  { value: 'pulseTrain', label: 'Pulse Train' },
]

// beatsPerTravel = N means the full travel takes N beats
const BEATS_PER_TRAVEL_OPTIONS = [
  { value: '0.25', label: '1/16 beat'         },
  { value: '0.5',  label: '1/8 note'          },
  { value: '1',    label: '1/4 note (1 beat)' },
  { value: '2',    label: '1/2 note (2 beats)'},
  { value: '4',    label: '1 bar (4 beats)'   },
  { value: '8',    label: '2 bars'            },
  { value: '16',   label: '4 bars'            },
]

const EASING_OPTIONS = [
  { value: 'linear',    label: 'Linear'      },
  { value: 'easeIn',    label: 'Ease In'     },
  { value: 'easeOut',   label: 'Ease Out'    },
  { value: 'easeInOut', label: 'Ease In/Out' },
]

const RETRIGGER_OPTIONS = [
  { value: 'restart',  label: 'Restart'  },
  { value: 'continue', label: 'Continue' },
  { value: 'queue',    label: 'Queue'    },
]

interface LaserDmxBeamMotionControlsProps {
  motion:   LaserDmxBeamMotion
  onChange: (motion: LaserDmxBeamMotion) => void
}

export function LaserDmxBeamMotionControls({ motion, onChange }: LaserDmxBeamMotionControlsProps) {
  const upd = (patch: Partial<LaserDmxBeamMotion>) => onChange({
    ...motion,
    ...patch,
    // Editing a legacy beam also migrates it to physically valid source-to-target travel.
    direction: 'forward',
    mode: patch.mode ?? ((motion.mode as string) === 'pingPong' ? 'grow' : motion.mode),
  })
  const m = (motion.mode as string) === 'pingPong' ? 'grow' : motion.mode

  // Conditional visibility by mode
  const isAnimated  = m !== 'static'
  const showTail    = m === 'projectile' || m === 'scanner' || m === 'pulseTrain'
  const showHeadGlow  = m !== 'static'
  const showEasing    = m !== 'static' && m !== 'pulseTrain'
  const showRetrigger = m !== 'static'

  // Find closest beats option or fall back to first
  const beatsValue = BEATS_PER_TRAVEL_OPTIONS.some(o => o.value === String(motion.beatsPerTravel))
    ? String(motion.beatsPerTravel)
    : '1'

  return (
    <Collapsible label="Beam Motion" defaultOpen>
      <SelectRow
        label="Travel Mode"
        value={m}
        onChange={v => upd({ mode: v as LaserDmxBeamTravelMode })}
        options={TRAVEL_MODE_OPTIONS}
      />
      {isAnimated && (
        <>
          <SelectRow
            label="Duration"
            value={beatsValue}
            onChange={v => upd({ beatsPerTravel: parseFloat(v) })}
            options={BEATS_PER_TRAVEL_OPTIONS}
          />
          {showEasing && (
            <SelectRow
              label="Easing"
              value={motion.easing}
              onChange={v => upd({ easing: v as LaserDmxBeamMotion['easing'] })}
              options={EASING_OPTIONS}
            />
          )}
          {showTail && (
            <SliderRow
              label={m === 'scanner' ? 'Segment Length' : 'Tail Length'}
              value={motion.tailLength}
              onChange={v => upd({ tailLength: v })}
              min={0} max={1} step={0.01}
              color="#d8b95a"
            />
          )}
          {showHeadGlow && (
            <SliderRow
              label="Head Glow"
              value={motion.headGlow}
              onChange={v => upd({ headGlow: v })}
              min={0} max={1} step={0.01}
              color="#b84fc9"
            />
          )}
          {showRetrigger && (
            <SelectRow
              label="Retrigger"
              value={motion.retrigger}
              onChange={v => upd({ retrigger: v as LaserDmxBeamMotion['retrigger'] })}
              options={RETRIGGER_OPTIONS}
            />
          )}
          <SliderRow
            label="Phase Offset"
            value={motion.phaseOffset}
            onChange={v => upd({ phaseOffset: v })}
            min={0} max={1} step={0.01}
            color="#61d6aa"
          />
        </>
      )}
    </Collapsible>
  )
}
