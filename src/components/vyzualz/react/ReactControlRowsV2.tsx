import { useId } from 'react'
import { DropdownV2 } from '../../shared/Dropdown/dropdown_v2'
import type { SelectRowProps } from './ReactControlRows'

// Shared dropdown_v2-based drop-in for ReactControlRows' SelectRow — identical
// row layout and prop signature, only the underlying dropdown widget differs.
// Opt-in per engine (currently CANVAS, LaserDMX, Sound Drawing) while every
// other engine still renders SelectRow's original Dropdown.
export function SelectRowV2({ label, value, onChange, options, disabled, id, description }: SelectRowProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label-cluster">
        <label className="rv-ctrl-label" htmlFor={inputId}>{label}</label>
      </span>
      <DropdownV2
        id={`${inputId}-dropdown`}
        triggerId={inputId}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        ariaLabel={label}
        className="rv-ctrl-dropdown-v2"
      />
      {description && <span id={`${inputId}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}
