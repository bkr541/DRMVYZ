import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { UnderlineDropdown } from '../../../components/vyzualz/react/controls/UnderlineDropdown'

export interface LyricSearchFilterOption {
  value: string
  label: string
}

interface Props {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  searchAriaLabel: string
  filterId: string
  filterValue: string
  filterOptions: readonly LyricSearchFilterOption[]
  onFilterChange: (value: string) => void
  filterAriaLabel: string
  filterMenuLabel: string
  filterMenuWidth?: number
}

/**
 * The Lyric Manager left rail's search field + filter dropdown row. One component serves both the
 * Tracks and the Versions windows so they share width, icon, spacing and underline alignment
 * (styles: .lmv-track-search-row in lyricManager.css).
 */
export function LyricSearchFilterRow({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  filterId,
  filterValue,
  filterOptions,
  onFilterChange,
  filterAriaLabel,
  filterMenuLabel,
  filterMenuWidth = 220,
}: Props) {
  return (
    <div className="lmv-track-search-row">
      <div className="lmv-track-search-wrap">
        <svg className="lmv-track-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <DreamVizTextInput
          className="lmv-input lmv-track-search"
          type="search"
          value={searchValue}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
      </div>
      <UnderlineDropdown
        id={filterId}
        value={filterValue}
        options={filterOptions.map(({ value, label }) => ({ value, label }))}
        onChange={onFilterChange}
        ariaLabel={filterAriaLabel}
        menuLabel={filterMenuLabel}
        title={filterAriaLabel}
        size="dense"
        menuWidth={filterMenuWidth}
        showDescriptions={false}
        className="lmv-track-filter-dropdown"
      />
    </div>
  )
}
