import type { ReactNode } from 'react'
import './HeaderReadout.css'

/** Option E's compact editorial status readout, with live production content. */
export function HeaderReadout({ label, title, tone, busy, children }: {
  label: string
  title?: string
  tone?: 'saved' | 'saving' | 'unsaved' | 'error'
  busy?: boolean
  children: ReactNode
}) {
  return <div className="vz-header-readout" data-tone={tone} data-busy={busy || undefined} title={title}>
    <span className="vz-header-readout-label">{label}</span>
    <div className="vz-header-readout-values">{children}</div>
  </div>
}
