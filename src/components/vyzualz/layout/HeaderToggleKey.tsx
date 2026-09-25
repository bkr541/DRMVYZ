import type { ReactNode } from 'react'

interface HeaderToggleKeyProps {
  checked: boolean
  onChange: (next: boolean) => void
  children: ReactNode
  title?: string
  disabled?: boolean
}

/**
 * A toggle drawn as one of the header control group's keys (see HeaderControlGroup.css):
 * the same flat key as every other button in the group, with an indicator light that
 * glows while the toggle is on and disappears while it is off.
 */
export function HeaderToggleKey({ checked, onChange, children, title, disabled }: HeaderToggleKeyProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="vz-header-toggle"
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="vz-header-light" aria-hidden="true" />
      {children}
    </button>
  )
}
