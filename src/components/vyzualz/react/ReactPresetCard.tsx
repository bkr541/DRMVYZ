import { useState, type KeyboardEvent, type ReactNode } from 'react'

export type ReactPresetCardChipTone = 'mode' | 'switch'

export interface ReactPresetCardChip {
  label: string
  tone?: ReactPresetCardChipTone
}

export interface ReactPresetCardPaletteColor {
  color: string
  label?: string
}

export interface ReactPresetCardSecondaryAction {
  id: string
  label: string
  ariaLabel?: string
  title?: string
  icon?: ReactNode
  iconOnly?: boolean
  tone?: 'default' | 'danger'
  disabled?: boolean
  onSelect: () => void
}

export interface ReactPresetCardProps {
  id: string
  title: string
  description: string
  thumbnail?: ReactNode
  chips?: ReactPresetCardChip[]
  palette?: ReactPresetCardPaletteColor[]
  isActive?: boolean
  isModified?: boolean
  isFavorite?: boolean
  activateLabel: string
  onActivate: () => void
  onToggleFavorite?: () => void
  contentBeforeDescription?: ReactNode | ((detailsOpen: boolean) => ReactNode)
  expandedContent?: ReactNode
  showMore?: boolean
  secondaryActions?: ReactPresetCardSecondaryAction[]
  className?: string
  shellClassName?: string
  titleText?: string
}

export function resolvePresetCardNavigationIndex(
  currentIndex: number,
  key: string,
  itemCount: number,
  columns = 1,
): number | null {
  if (itemCount <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  const delta = key === 'ArrowRight'
    ? 1
    : key === 'ArrowLeft'
      ? -1
      : key === 'ArrowDown'
        ? columns
        : key === 'ArrowUp'
          ? -columns
          : 0
  if (delta === 0) return null
  return Math.max(0, Math.min(itemCount - 1, currentIndex + delta))
}

export function handlePresetCardKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
  const group = event.currentTarget.closest<HTMLElement>('[data-preset-grid]')
  if (!group) return
  const cards = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-preset-card]'))
  const currentIndex = cards.indexOf(event.currentTarget)
  const columns = group.clientWidth >= 720 ? 2 : 1
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, cards.length, columns)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  cards[nextIndex]?.focus()
}

export function ReactPresetCard({
  id,
  title,
  description,
  thumbnail,
  chips = [],
  palette = [],
  isActive = false,
  isModified = false,
  isFavorite = false,
  activateLabel,
  onActivate,
  onToggleFavorite,
  contentBeforeDescription,
  expandedContent,
  showMore = false,
  secondaryActions = [],
  className = '',
  shellClassName = '',
  titleText = description,
}: ReactPresetCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const hasThumbnail = Boolean(thumbnail)
  const hasMoreDetails = showMore
  const hasSecondaryActions = secondaryActions.length > 0

  return (
    <div
      className={`rv-preset-card-shell${detailsOpen ? ' rv-preset-card-shell--expanded' : ''}${hasSecondaryActions ? ' rv-preset-card-shell--has-secondary-actions' : ''}${shellClassName ? ` ${shellClassName}` : ''}`}
      data-preset-card-shell
      data-preset-card-id={id}
    >
      <button
        type="button"
        className={`rv-preset-card${hasThumbnail ? ' rv-preset-card--with-thumb' : ''}${isActive ? ' rv-preset-card--active' : ''}${detailsOpen ? ' rv-preset-card--expanded' : ''}${className ? ` ${className}` : ''}`}
        onClick={onActivate}
        onKeyDown={handlePresetCardKeyDown}
        data-preset-card
        data-preset-card-id={id}
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={activateLabel}
        title={titleText}
      >
        <div className="rv-preset-card-layout">
          {thumbnail}
          <div className="rv-preset-card-content">
            <div className="rv-preset-card-header">
              <span className="rv-preset-name">{title}</span>
            </div>
            {(chips.length > 0 || isModified) && (
              <div className="rv-preset-chip-row">
                {chips.map((chip, index) => (
                  <span
                    key={`${chip.label}-${index}`}
                    className={chip.tone === 'switch' ? 'rv-preset-switch-chip' : 'rv-preset-mode-chip'}
                  >
                    {chip.label}
                  </span>
                ))}
                {isModified && <span className="rv-preset-modified-chip">Modified</span>}
              </div>
            )}
            {typeof contentBeforeDescription === 'function' ? contentBeforeDescription(detailsOpen) : contentBeforeDescription}
            {detailsOpen && expandedContent}
            <p className="rv-preset-desc">{description}</p>
            {palette.length > 0 && (
              <div className="rv-preset-palette" aria-label={`${title} palette`}>
                {palette.slice(0, 5).map((item, index) => (
                  <span
                    key={`${item.color}-${index}`}
                    className="rv-palette-swatch"
                    style={{ background: item.color }}
                    title={item.label ?? item.color}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          className={`rv-preset-favorite${isFavorite ? ' rv-preset-favorite--active' : ''}`}
          onClick={event => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${title} ${isFavorite ? 'from' : 'to'} favorites`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      )}
      {hasMoreDetails && (
        <button
          type="button"
          className="rv-preset-more-btn"
          aria-expanded={detailsOpen}
          aria-label={`${detailsOpen ? 'Hide' : 'Show'} detailed information for ${title}`}
          onClick={event => {
            event.stopPropagation()
            setDetailsOpen(open => !open)
          }}
        >
          {detailsOpen ? 'Less' : 'More'} <span aria-hidden="true">▾</span>
        </button>
      )}
      {hasSecondaryActions && (
        <div className="rv-preset-secondary-actions" aria-label={`${title} preset actions`}>
          {secondaryActions.map(action => (
            <button
              key={action.id}
              type="button"
              className={`rv-preset-secondary-action${action.tone === 'danger' ? ' rv-preset-secondary-action--danger' : ''}${action.iconOnly ? ' rv-preset-secondary-action--icon' : ''}`}
              onClick={event => {
                event.stopPropagation()
                action.onSelect()
              }}
              aria-label={action.ariaLabel ?? action.label}
              title={action.title ?? action.ariaLabel ?? action.label}
              disabled={action.disabled}
            >
              {action.icon && <span aria-hidden="true">{action.icon}</span>}
              {!action.iconOnly && action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
