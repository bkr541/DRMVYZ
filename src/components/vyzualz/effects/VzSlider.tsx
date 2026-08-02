import type { HelpId } from '../../../help/HelpCenter'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

type VzSliderProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  colorTrack?: boolean
  /** When explicitly false, renders dimmed with a hint line. */
  chainEnabled?: boolean
  /** Hover tooltip shown on the label. */
  tooltip?: string
  /** Text for the hint line shown when chainEnabled is false. Defaults to "Off in chain". */
  offHint?: string
  helpId?: HelpId
}

export function VzSlider({ label, value, min = 0, max = 1, step = 0.01, onChange, colorTrack, chainEnabled, tooltip, offHint, helpId }: VzSliderProps) {
  const pct   = `${((value - min) / (max - min)) * 100}%`
  const isOff = chainEnabled === false
  return (
    <div className={`vz-slider-wrap${isOff ? ' vz-slider-wrap--off' : ''}`}>
      <div className="vz-slider-header drm-help-target">
        <span className="vz-slider-label" title={tooltip}>{label}</span>
        {helpId && <HelpInfoTrigger helpId={helpId} currentValue={value.toFixed(2)} />}
        <span className="vz-slider-val">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className={`vz-slider${colorTrack ? ' vz-slider--color' : ''}`}
        style={{ '--pct': pct } as React.CSSProperties}
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      {isOff && <span className="vz-slider-chain-hint">{offHint ?? 'Off in chain'}</span>}
    </div>
  )
}
