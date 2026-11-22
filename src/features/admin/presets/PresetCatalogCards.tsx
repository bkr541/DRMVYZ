import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { PresetLibraryArtwork, presetArtworkBackdrop } from '../../../components/vyzualz/presetManager/PresetLibraryCard'
import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import { ReactPresetCard } from '../../../components/vyzualz/react/ReactPresetCard'
import { STATUS_LABELS, type AdminPreset } from './presetAdmin'

/** The status as a small chip, in the status's own colour (and always in words, never colour alone). */
export function StatusBadge({ status }: { status: AdminPreset['status'] }) {
  const key = status ?? 'unset'
  return <span className="adm-status" data-status={key}>{STATUS_LABELS[key]}</span>
}

/** The preset as users will see it once the admin's edits are saved: the stored record with the name, description, category and tags of the edit applied. */
export interface ShownPreset { record: PresetManagerRecord; name: string; description: string }

interface CardProps {
  preset: AdminPreset
  shown: ShownPreset
  active: boolean
  checked: boolean
  /** The admin has changes to this preset that are not saved yet. */
  changed: boolean
  onSelect: () => void
  onToggleChecked: () => void
}

/**
 * A preset as a poster tile: the same card the app's preset grids use, with its artwork, its name, the status as the card's chip, "Modified" while it has
 * unsaved changes, and a round button at the top right that adds it to (or removes it from) the bulk selection.
 */
export function AdminPresetTile({ preset, shown, active, checked, changed, onSelect, onToggleChecked }: CardProps) {
  return (
    <div className="adm-tile" data-checked={checked || undefined} data-status={preset.status ?? 'unset'} data-preset-id={preset.record.id}>
      <ReactPresetCard
        id={shown.record.sourceId}
        title={shown.name}
        description={shown.description}
        backdrop={presetArtworkBackdrop(shown.record)}
        chips={[{ label: STATUS_LABELS[preset.status ?? 'unset'] }]}
        isActive={active}
        isModified={changed}
        activateLabel={`Select ${shown.name}`}
        onActivate={onSelect}
        secondaryActions={[{
          id: 'select', iconOnly: true, label: `${checked ? 'Deselect' : 'Select'} ${shown.name} for bulk actions`, title: checked ? 'Remove from the selection' : 'Add to the selection',
          icon: <AppIcon kind={checked ? 'check' : 'plus'} size={12} color="currentColor" />, onSelect: onToggleChecked,
        }]}
      />
    </div>
  )
}

/** The compact row: Preset Manager's own library card (artwork on the right, name, engine) with the status beside the engine and a select button. */
export function AdminPresetRow({ preset, shown, active, checked, changed, onSelect, onToggleChecked }: CardProps) {
  const record = shown.record
  return (
    <article className={`pmv-card adm-row${active ? ' is-active' : ''}`} data-checked={checked || undefined} data-status={preset.status ?? 'unset'} data-preset-id={preset.record.id}>
      <button className="pmv-card-main" type="button" onClick={onSelect} aria-label={`Select ${shown.name}`} aria-pressed={active}>
        <PresetLibraryArtwork preset={record} className="pmv-thumbnail" />
        <span className="pmv-card-copy">
          <strong>{shown.name}{changed ? <span className="adm-edited" title="Has changes that are not saved yet"> •</span> : null}</strong>
          <span className="pmv-card-meta">
            <span className="pmv-card-type">{record.engineName}</span>
            <StatusBadge status={preset.status} />
          </span>
        </span>
      </button>
      <button className={`vz-media-star${checked ? ' vz-media-star--active' : ''}`} type="button" aria-pressed={checked} onClick={onToggleChecked}
        aria-label={`${checked ? 'Deselect' : 'Select'} ${shown.name} for bulk actions`} title={checked ? 'Remove from the selection' : 'Add to the selection'}>
        <AppIcon kind={checked ? 'check' : 'plus'} size={13} color="currentColor" />
      </button>
    </article>
  )
}
