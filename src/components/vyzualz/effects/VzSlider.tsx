type VzSliderProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  colorTrack?: boolean
  /** When explicitly false, renders dimmed with an "Off in chain" hint. */
  chainEnabled?: boolean
}

export function VzSlider({ label, value, min = 0, max = 1, step = 0.01, onChange, colorTrack, chainEnabled }: VzSliderProps) {
  const pct   = `${((value - min) / (max - min)) * 100}%`
  const isOff = chainEnabled === false
  return (
    <div className={`vz-slider-wrap${isOff ? ' vz-slider-wrap--off' : ''}`}>
      <div className="vz-slider-header">
        <span className="vz-slider-label">{label}</span>
        <span className="vz-slider-val">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className={`vz-slider${colorTrack ? ' vz-slider--color' : ''}`}
        style={{ '--pct': pct } as React.CSSProperties}
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      {isOff && <span className="vz-slider-chain-hint">Off in chain</span>}
    </div>
  )
}
