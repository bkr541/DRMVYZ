import { type KeyboardEvent, type ReactNode } from 'react'

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
  isActive = false,
  isModified = false,
  isFavorite = false,
  activateLabel,
  onActivate,
  onToggleFavorite,
  secondaryActions = [],
  className = '',
  shellClassName = '',
  titleText = description,
}: ReactPresetCardProps) {
  const hasThumbnail = Boolean(thumbnail)
  const hasActions = Boolean(onToggleFavorite) || secondaryActions.length > 0
  const visibleChips = chips.slice(0, 2)

  return (
    <div
      className={`rv-preset-card-shell rv-compact-preset-card-shell${hasActions ? ' rv-compact-preset-card-shell--has-actions' : ''}${shellClassName ? ` ${shellClassName}` : ''}`}
      data-preset-card-shell
      data-preset-card-id={id}
    >
      <button
        type="button"
        className={`rv-preset-card rv-shader-scene-card rv-compact-preset-card${hasThumbnail ? ' rv-preset-card--with-thumb' : ''}${isActive ? ' rv-preset-card--active rv-shader-scene-card--active' : ''}${className ? ` ${className}` : ''}`}
        onClick={onActivate}
        onKeyDown={handlePresetCardKeyDown}
        data-preset-card
        data-preset-card-id={id}
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={activateLabel}
        title={titleText}
      >
        <div className="rv-preset-card-layout rv-compact-preset-card-layout">
          {hasThumbnail && (
            <div className="rv-preset-thumb rv-shader-scene-thumb rv-compact-preset-thumb" aria-hidden="true">
              {thumbnail}
            </div>
          )}
          <div className="rv-preset-card-content rv-shader-scene-card-body rv-compact-preset-card-body">
            <div className="rv-preset-name rv-shader-scene-name">{title}</div>
            {(visibleChips.length > 0 || isModified) && (
              <div className="rv-shader-scene-meta rv-compact-preset-meta">
                {visibleChips.map((chip, index) => (
                  <span
                    key={`${chip.label}-${index}`}
                    className={index === 0 && chip.tone !== 'switch'
                      ? 'rv-shader-scene-category'
                      : `rv-shader-scene-badge${chip.tone === 'switch' ? ' rv-compact-preset-switch-badge' : ''}`}
                  >
                    {chip.label}
                  </span>
                ))}
                {isModified && <span className="rv-shader-scene-badge">Modified</span>}
              </div>
            )}
          </div>
        </div>
      </button>

      {hasActions && (
        <div className="rv-shader-scene-actions rv-compact-preset-actions" aria-label={`${title} preset actions`}>
          {onToggleFavorite && (
            <button
              type="button"
              className={`rv-shader-scene-action${isFavorite ? ' rv-shader-scene-action--active' : ''}`}
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
          {secondaryActions.map(action => (
            <button
              key={action.id}
              type="button"
              className={`rv-shader-scene-action rv-compact-preset-action${action.tone === 'danger' ? ' rv-shader-scene-action--danger' : ''}${action.iconOnly ? '' : ' rv-compact-preset-action--text'}`}
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
