import type { ReactNode } from 'react'
import './HeaderControlGroup.css'

interface HeaderControlGroupProps {
  label: string
  className?: string
  children: ReactNode
}

const LOGO_SRC = `${import.meta.env.BASE_URL ?? '/'}drmvyz_logo_icon.png`

/** Logo, page name and divider shown at the far left of every page header. */
function HeaderBrand({ pageName }: { pageName: string }) {
  return (
    <div className="vz-header-brand">
      <img className="vz-header-brand-logo" src={LOGO_SRC} alt="" draggable={false} />
      <span className="vz-header-brand-name">{pageName}</span>
      <span className="vz-header-brand-divider" aria-hidden="true">|</span>
    </div>
  )
}

/** Left-aligned page actions; status controls remain at the right of the header. */
export function HeaderControlGroup({ label, className = '', children }: HeaderControlGroupProps) {
  const pageName = label.replace(/\s+controls$/i, '')
  return (
    <>
      <HeaderBrand pageName={pageName} />
      <div className={`vz-header-group${className ? ` ${className}` : ''}`} role="toolbar" aria-label={label}>
        {children}
      </div>
    </>
  )
}
