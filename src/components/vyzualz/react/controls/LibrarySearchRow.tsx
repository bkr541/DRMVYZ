import type { ReactNode } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { DreamVizTextInput } from './DreamVizTextInput'
import './LibrarySearchRow.css'

interface LibrarySearchRowProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  children?: ReactNode
  className?: string
  clearable?: boolean
}

/** Flat library search treatment shared by Lyric Manager and Cinema 2.0. */
export function LibrarySearchRow({ value, onChange, placeholder, label, children, className = '', clearable = false }: LibrarySearchRowProps) {
  return <div className={`dv-library-search-row${className ? ` ${className}` : ''}`}>
    <div className="dv-library-search-wrap">
      <AppIcon kind="search" className="dv-library-search-icon" size={12} />
      <DreamVizTextInput
        className={`dv-library-search-input${clearable ? ` is-clearable${value ? ' has-clear' : ''}` : ''}`}
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {clearable && value && <button type="button" className="dv-library-search-clear" aria-label="Clear search" onClick={() => onChange('')}><AppIcon kind="close" size={14} /></button>}
    </div>
    {children}
  </div>
}
