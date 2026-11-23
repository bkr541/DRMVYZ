import { useId } from 'react'
import { DatePicker, type DatePickerMode } from '../../components/shared/DatePicker'

/** The standard label-above-field row (same markup as SelectRow) around the shared date picker, for a date or a date and time. */
export function DateTimeRow({ label, value, onChange, mode = 'datetime', description, min, max, clearable = false }: {
  label: string; value: string; onChange: (value: string) => void; mode?: DatePickerMode; description?: string; min?: string; max?: string; clearable?: boolean
}) {
  const id = useId()
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label-cluster"><label className="rv-ctrl-label" htmlFor={id}>{label}</label></span>
      <DatePicker
        id={`${id}-picker`} triggerId={id} value={value} onChange={onChange} mode={mode} min={min} max={max} clearable={clearable}
        ariaLabel={label} ariaDescribedBy={description ? `${id}-description` : undefined} size="compact" className="rv-ctrl-dropdown"
      />
      {description && <span id={`${id}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}
