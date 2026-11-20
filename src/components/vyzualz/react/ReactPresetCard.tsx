import { AppIcon } from '../../shared/icons/AppIcon'
import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { PresetBlueprintImage } from './PresetBlueprintImage'
import { hasPresetBlueprintArtwork, PresetBlueprintArtwork } from './PresetBlueprintArtwork'

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

/**
 * `poster` is the standard Matte Frame tile, with full-bleed artwork and a centered bottom caption.
 * `row` is the single-column layout with a small thumbnail used by compatibility browsers.
 */
export type ReactPresetCardLayout = 'poster' | 'row'

export interface ReactPresetCardProps {
  id: string
  title: string
  description: string
  /** Row layout only: the small thumbnail beside the name. */
  thumbnail?: ReactNode
  /** Poster layout only: full-color renderer content behind the name. Defaults to the generated production frame. */
  backdrop?: ReactNode
  layout?: ReactPresetCardLayout
  /** Extra `data-*` attributes for the card button (tests and automation look presets up by them). */
  dataAttributes?: Record<`data-${string}`, string>
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
  const columns = Number(group.dataset.presetColumns) || (group.clientWidth >= 720 ? 2 : 1)
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, cards.length, columns)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  cards[nextIndex]?.focus()
}

const SWITCH_CHIP_TONE = '#b84fc9'
const MODIFIED_CHIP_TONE = '#ffb347'
const DEFAULT_CHIP_TONE = '#4ac7db'

export function ReactPresetArtwork({ id, backdrop, className = '', appearance = 'blueprint' }: {
  id: string
  backdrop?: ReactNode
  className?: string
  appearance?: 'blueprint' | 'frame'
}) {
  const artworkFilterId = `preset-blueprint-${useId().replaceAll(':', '')}`
  if (appearance === 'frame') {
    return <span className={`rv-preset-spotlight-thumb rv-preset-spotlight-thumb--frame ${className}`.trim()} aria-hidden="true">
      <span className="rv-preset-frame-scene">{backdrop ?? <PresetBlueprintImage presetId={id} />}</span>
    </span>
  }
  const authoredArtworkId = backdrop == null && hasPresetBlueprintArtwork(id) ? id : null

  return (
    <span className={`rv-preset-spotlight-thumb rv-preset-spotlight-thumb--blueprint ${className}`.trim()} aria-hidden="true">
      {!authoredArtworkId && <svg className="rv-preset-blueprint-defs" width="0" height="0" focusable="false">
        <defs>
          <filter id={artworkFilterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="saturate" values="0" />
            <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" divisor="1" bias="0" preserveAlpha="true" />
            <feColorMatrix values="0 0 0 0 .29  0 0 0 0 .78  0 0 0 0 .86  0 2.5 0 0 0" />
          </filter>
        </defs>
      </svg>}
      <span
        className={`rv-preset-blueprint-scene${authoredArtworkId ? ' rv-preset-blueprint-scene--authored' : ''}`}
        style={authoredArtworkId ? undefined : { filter: `url(#${artworkFilterId})` }}
      >
        {backdrop ?? (authoredArtworkId ? <PresetBlueprintArtwork presetId={authoredArtworkId} /> : <PresetBlueprintImage presetId={id} />)}
      </span>
    </span>
  )
}

export function ReactPresetCard({
  id,
  title,
  thumbnail,
  backdrop,
  layout = 'poster',
  dataAttributes,
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
  disabled = false,
}: ReactPresetCardProps) {
  const poster = layout === 'poster'
  const hasThumbnail = !poster && Boolean(thumbnail)
  const visibleChips = chips.slice(0, 2)
  const chipTone = palette[0]?.color ?? DEFAULT_CHIP_TONE
  const switchChip = visibleChips.find(chip => chip.tone === 'switch')
  const chipLine = visibleChips.filter(chip => chip.tone !== 'switch').map(chip => chip.label).join(' · ')
  const statusId = useId()
  const hasStatusText = Boolean(switchChip || isModified || chipLine)
  const actions = (onToggleFavorite || secondaryActions.length > 0) ? (
    <div className="rv-preset-spotlight-actions" aria-label={`${title} preset actions`}>
      {onToggleFavorite && (
        <button
          type="button"
          className={`rv-preset-spotlight-action rv-preset-spotlight-action--favorite${isFavorite ? ' rv-preset-spotlight-action--active' : ''}`}
          onClick={event => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${title} ${isFavorite ? 'from' : 'to'} favorites`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <AppIcon kind={poster ? 'star' : isFavorite ? 'starOff' : 'star'} size={poster ? 13 : 15} color="currentColor" />
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
  ) : null

  return (
    <div
      className={`rv-preset-card-shell rv-preset-spotlight-shell${shellClassName ? ` ${shellClassName}` : ''}`}
      data-preset-card-shell
      data-preset-card-id={id}
      style={poster ? ({ '--rv-preset-tone': chipTone } as CSSProperties) : undefined}
    >
      <button
        type="button"
        className={`rv-preset-card rv-preset-spotlight-card${poster ? ' rv-preset-spotlight-card--poster' : hasThumbnail ? '' : ' rv-preset-spotlight-card--no-thumb'}${isActive ? ' rv-preset-card--active rv-preset-spotlight-card--active' : ''}${className ? ` ${className}` : ''}`}
        onClick={disabled ? undefined : onActivate}
        onKeyDown={handlePresetCardKeyDown}
        disabled={disabled}
        data-preset-card
        data-preset-card-id={id}
        {...dataAttributes}
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={activateLabel}
        aria-describedby={poster && hasStatusText ? statusId : undefined}
      >
        {poster ? (
          <>
            <ReactPresetArtwork id={id} backdrop={backdrop} appearance="frame" />
            <span className="rv-preset-spotlight-caption">
              <span className="rv-preset-spotlight-name" data-two-line={title.trim().includes(' ') || undefined}><span>{title}</span></span>
            </span>
          </>
        ) : (
          <>
            <span className="rv-preset-spotlight-accent" aria-hidden="true" />
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
          </>
        )}
      </button>

      {poster ? (isActive || hasStatusText || actions) && (
        <div className="rv-preset-poster-header">
          {(isActive || hasStatusText) && (
            <div className="rv-preset-poster-badges" id={hasStatusText ? statusId : undefined}>
              {isActive && <span className="rv-preset-poster-selection" aria-hidden="true"><AppIcon kind="check" size={12} /></span>}
              {switchChip && <Badge label={switchChip.label} tone={SWITCH_CHIP_TONE} />}
              {isModified && <Badge label="Modified" tone={MODIFIED_CHIP_TONE} />}
              {chipLine && <span className="rv-preset-poster-chip">{chipLine}</span>}
            </div>
          )}
          {actions}
        </div>
      ) : actions}
    </div>
  )
}
