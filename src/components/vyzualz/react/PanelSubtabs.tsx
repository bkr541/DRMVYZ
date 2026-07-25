export interface PanelSubtabOption<T extends string> {
  id: T
  label: string
  disabled?: boolean
}

export interface PanelSubtabsProps<T extends string> {
  value: T
  options: Array<PanelSubtabOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  layout?: 'equal' | 'wrap'
  className?: string
}

export function PanelSubtabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  layout = 'equal',
  className = '',
}: PanelSubtabsProps<T>) {
  const classes = [
    'rv-right-subtabs',
    layout === 'wrap' ? 'rv-right-subtabs--wrap' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} role="tablist" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? 'is-active' : ''}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
