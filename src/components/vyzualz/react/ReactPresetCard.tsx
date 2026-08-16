import { type KeyboardEvent, type ReactNode } from 'react'
import { Badge } from './controls/Badge'

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
  disabled?: boolean
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
  const cards = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-preset-card]:not(:disabled)'))
  const currentIndex = cards.indexOf(event.currentTarget)
  const columns = group.clientWidth >= 720 ? 2 : 1
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, cards.length, columns)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  cards[nextIndex]?.focus()
}

const SWITCH_CHIP_TONE = '#b84fc9'
const MODIFIED_CHIP_TONE = '#ffb347'
const DEFAULT_CHIP_TONE = '#4ac7db'

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
  secondaryActions = [],
  className = '',
  shellClassName = '',
  titleText = description,
  disabled = false,
}: ReactPresetCardProps) {
  const hasThumbnail = Boolean(thumbnail)
  const hasActions = Boolean(onToggleFavorite) || secondaryActions.length > 0
  const visibleChips = chips.slice(0, 2)
  const chipTone = palette[0]?.color ?? DEFAULT_CHIP_TONE

  return (
    <div
      className={`rv-preset-card-shell rv-preset-spotlight-shell${shellClassName ? ` ${shellClassName}` : ''}`}
      data-preset-card-shell
      data-preset-card-id={id}
    >
      <button
        type="button"
        className={`rv-preset-card rv-preset-spotlight-card${hasThumbnail ? '' : ' rv-preset-spotlight-card--no-thumb'}${isActive ? ' rv-preset-card--active rv-preset-spotlight-card--active' : ''}${className ? ` ${className}` : ''}`}
        onClick={disabled ? undefined : onActivate}
        onKeyDown={handlePresetCardKeyDown}
        disabled={disabled}
        data-preset-card
        data-preset-card-id={id}
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={activateLabel}
        title={titleText}
      >
        {hasThumbnail && (
          <>
            <span className="rv-preset-spotlight-thumb" aria-hidden="true">{thumbnail}</span>
            <span className="rv-preset-spotlight-scrim" aria-hidden="true" />
          </>
        )}
        <span className="rv-preset-spotlight-caption">
          <span className="rv-preset-spotlight-name">{title}</span>
          {(visibleChips.length > 0 || isModified) && (
            <span className="rv-preset-spotlight-chips">
              {visibleChips.map((chip, index) => (
                <Badge
                  key={`${chip.label}-${index}`}
                  label={chip.label}
                  tone={chip.tone === 'switch' ? SWITCH_CHIP_TONE : chipTone}
                />
              ))}
              {isModified && <Badge label="Modified" tone={MODIFIED_CHIP_TONE} />}
            </span>
          )}
        </span>
      </button>

      {hasActions && (
        <div className="rv-preset-spotlight-actions" aria-label={`${title} preset actions`}>
          {onToggleFavorite && (
            <button
              type="button"
              className={`rv-preset-spotlight-action${isFavorite ? ' rv-preset-spotlight-action--active' : ''}`}
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
              className={`rv-preset-spotlight-action${action.tone === 'danger' ? ' rv-preset-spotlight-action--danger' : ''}${action.iconOnly ? '' : ' rv-preset-spotlight-action--text'}`}
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
