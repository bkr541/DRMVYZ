import { AppIcon } from '../../../components/shared/icons/AppIcon'
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
        <AppIcon kind="search" className="lmv-track-search-icon" size="12" />
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
