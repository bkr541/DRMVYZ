import { Dropdown, type DropdownOption, type DropdownProps } from '../../../shared/Dropdown/Dropdown'

export interface UnderlineDropdownProps extends Omit<DropdownProps, 'options' | 'onChange'> {
  options: readonly DropdownOption[] | readonly string[]
  onChange?: (value: string, option: DropdownOption) => void
  eyebrow?: string
}

function normalizeOptions(options: UnderlineDropdownProps['options']): readonly DropdownOption[] {
  return options.map(option => typeof option === 'string' ? { value: option, label: option } : option)
}

/** Canonical DRMVYZ dropdown treatment from Layout Lab's “Underline” winner. */
export function UnderlineDropdown({ options, className = '', eyebrow, ...props }: UnderlineDropdownProps) {
  return (
    <Dropdown
      {...props}
      eyebrow={eyebrow}
      options={normalizeOptions(options)}
      className={`dv-underline-dropdown${className ? ` ${className}` : ''}`}
    />
  )
}
