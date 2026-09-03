import { GridViewIcon, ListViewIcon } from 'hugeicons-react'
import { DreamVizTextInput } from './DreamVizTextInput'

// ── PresetSearchRow ──────────────────────────────────────────────────────────
//
// Canonical DRMVYZ preset-tab search header, shared by every engine's Preset
// tab (Cinema, Sound Drawing, Canvas, LaserDMX, PixGrid). A borderless search
// field whose bottom rule also spans a leading magnifier icon, a clear button
// that appears once text is typed, and a right-justified grid / list view
// toggle. Reuses the Media Library `vz-md-search-*` / `vz-md-view-*` classes;
// `.rv-preset-search-row` carries the icon-in-border treatment.

export type PresetViewMode = 'grid' | 'list'

export interface PresetSearchRowProps {
  query: string
  onQueryChange: (value: string) => void
  viewMode: PresetViewMode
  onViewModeChange: (mode: PresetViewMode) => void
  placeholder?: string
  ariaLabel?: string
  /** Drop the grid/list toggle where a panel has a single layout. */
  showViewToggle?: boolean
  className?: string
}

export function PresetSearchRow({
  query,
  onQueryChange,
  viewMode,
  onViewModeChange,
  placeholder = 'Search presets…',
  ariaLabel = 'Search presets',
  showViewToggle = true,
  className = '',
}: PresetSearchRowProps) {
  return (
    <div className={`vz-md-search-row rv-preset-search-row${className ? ` ${className}` : ''}`}>
      <div className="vz-md-search-wrap">
        <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
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
          >
            ✕
          </button>
        )}
      </div>
      {showViewToggle && (
        <div className="vz-md-view-toggles">
          <button
            type="button"
            className={`vz-md-view-btn${viewMode === 'grid' ? ' vz-md-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
            aria-label="Grid view"
            data-active={viewMode === 'grid' ? 'true' : 'false'}
          >
            <GridViewIcon size={13} color="currentColor" />
          </button>
          <button
            type="button"
            className={`vz-md-view-btn${viewMode === 'list' ? ' vz-md-view-btn--active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="List view"
            aria-label="List view"
            data-active={viewMode === 'list' ? 'true' : 'false'}
          >
            <ListViewIcon size={13} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  )
}
