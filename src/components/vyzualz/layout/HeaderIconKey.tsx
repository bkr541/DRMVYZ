import type { ReactNode } from 'react'

interface HeaderIconKeyProps {
  /** Accessible name; also the tooltip unless `title` says more. */
  label: string
  title?: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  /** Toggle state; renders aria-pressed and the group's lit "on" treatment. */
  pressed?: boolean
  /** Destructive key: turns red on hover. */
  danger?: boolean
}

/**
 * An icon-only key for the header control group (see HeaderControlGroup.css): the same flat,
 * hairline-separated cell the Show Manager's New / Open / Save + Make Active keys use. There is
 * no visible text, so the label is the button's accessible name and tooltip.
 */
export function HeaderIconKey({ label, title, icon, onClick, disabled, pressed, danger }: HeaderIconKeyProps) {
  return (
    <button
      type="button"
      className={`vz-header-icon-key${danger ? ' vz-header-icon-key--danger' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}
