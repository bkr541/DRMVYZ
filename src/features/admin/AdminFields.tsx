import { useId } from 'react'
import { DreamVizTextInput } from '../../components/vyzualz/react/controls/DreamVizTextInput'

/** The standard label-above-field row (same markup as TextInputRow) around a native date or date-and-time input. */
export function DateTimeRow({ label, value, onChange, type = 'datetime-local', description }: {
  label: string; value: string; onChange: (value: string) => void; type?: 'date' | 'datetime-local'; description?: string
}) {
  const id = useId()
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label-cluster"><label className="rv-ctrl-label" htmlFor={id}>{label}</label></span>
      <DreamVizTextInput id={id} type={type} className="rv-ctrl-text-input" value={value} onChange={event => onChange(event.target.value)} aria-describedby={description ? `${id}-description` : undefined} />
      {description && <span id={`${id}-description`} className="rv-ctrl-description">{description}</span>}
    </div>
  )
}
