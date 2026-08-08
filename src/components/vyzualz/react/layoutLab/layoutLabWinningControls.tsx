import type { ReactNode } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'

// Compatibility adapters for Layout Lab. The actual production source of truth
// now lives in ../controls and is consumed by the application itself.

export interface UnderlineDropdownControlProps {
  eyebrow?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  ariaLabel?: string
}

export function UnderlineDropdownControl({ eyebrow, value, onChange, options, ariaLabel }: UnderlineDropdownControlProps) {
  return (
    <UnderlineDropdown
      eyebrow={eyebrow}
      value={value}
      onChange={next => onChange(next)}
      options={options}
      ariaLabel={ariaLabel}
      size="dense"
      showDescriptions={false}
    />
  )
}

export interface BubbleRevealSliderControlProps {
  eyebrow?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  ariaLabel?: string
}

export function BubbleRevealSliderControl({ eyebrow, value, onChange, min = 0, max = 100, ariaLabel }: BubbleRevealSliderControlProps) {
  return (
    <div className="lls-bubble">
      {eyebrow != null && <span className="lls-bubble-eyebrow">{eyebrow}</span>}
      <BubbleRevealSlider
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        aria-label={ariaLabel}
      />
    </div>
  )
}

export interface IconMorphToggleControlProps {
  value: boolean
  onChange: (value: boolean) => void
  ariaLabel?: string
}

export function IconMorphToggleControl({ value, onChange, ariaLabel }: IconMorphToggleControlProps) {
  return <IconMorphToggle checked={value} onCheckedChange={onChange} aria-label={ariaLabel} />
}

export interface TemplateTextInputControlProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  label?: ReactNode
}

export function TemplateTextInputControl({ value, onChange, placeholder, ariaLabel, className, label }: TemplateTextInputControlProps) {
  return (
    <>
      {label}
      <DreamVizTextInput
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
      />
    </>
  )
}
