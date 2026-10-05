export type HeaderSaveTone = 'saved' | 'saving' | 'unsaved' | 'error'

/**
 * Save-state pill for a page header (Layout Lab Cinema → Design → "01 · Separate Chips"): a status dot
 * and a label in a rounded pill whose border takes the state's colour. Sits left of the CPU readout.
 */
export function HeaderSaveChip({ label, tone, className = '' }: { label: string; tone: HeaderSaveTone; className?: string }) {
  return (
    <span
      className={`vz-header-chip vz-header-chip--saved${className ? ` ${className}` : ''}`}
      data-save-tone={tone}
      role="status"
    >
      <i className="vz-header-save-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
