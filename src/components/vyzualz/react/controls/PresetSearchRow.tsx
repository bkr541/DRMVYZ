import { AppIcon } from '../../../shared/icons/AppIcon'
import { DreamVizTextInput } from './DreamVizTextInput'
import type { ReactNode } from 'react'

// ── PresetSearchRow ──────────────────────────────────────────────────────────
//
// Canonical DRMVYZ preset-tab search header, shared by every engine's Preset
// tab (Cinema, Sound Drawing, Canvas, LaserDMX, PixGrid). A borderless search
// field whose bottom rule also spans a leading magnifier icon, a clear button
// that appears once text is typed. Preset lists have a single layout (the
// 01 · Preset Card row), so there is no grid / list toggle. Reuses the Media
// Library `vz-md-search-*` classes; `.rv-preset-search-row` carries the
// icon-in-border treatment.

export interface PresetSearchRowProps {
  query: string
  onQueryChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
  trailing?: ReactNode
}

export function PresetSearchRow({
  query,
  onQueryChange,
  placeholder = 'Search presets…',
  ariaLabel = 'Search presets',
  className = '',
  trailing,
}: PresetSearchRowProps) {
  return (
    <div className={`vz-md-search-row rv-preset-search-row${className ? ` ${className}` : ''}`}>
      <div className="vz-md-search-wrap">
        <AppIcon kind="search" className="vz-md-search-icon" size="12" />
        <DreamVizTextInput
          className="vz-md-search-input"
          type="text"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
        />
        {query.length > 0 && (
          <button
            type="button"
            className="vz-md-search-clear"
            onClick={() => onQueryChange('')}
            title="Clear search"
            aria-label="Clear search"
          ><AppIcon kind="close" size={14} /></button>
        )}
      </div>
      {trailing}
    </div>
  )
}
