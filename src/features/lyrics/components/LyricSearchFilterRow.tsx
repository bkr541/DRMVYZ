import { LibrarySearchRow } from '../../../components/vyzualz/react/controls/LibrarySearchRow'
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
 * using the shared flat library search treatment.
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
    <LibrarySearchRow className="lmv-track-search-row" value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} label={searchAriaLabel}>
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
    </LibrarySearchRow>
  )
}
