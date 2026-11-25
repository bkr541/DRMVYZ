import { presetArtworkBackdrop } from '../../../components/vyzualz/presetManager/PresetLibraryCard'
import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import { ReactPresetArtwork, ReactPresetCard } from '../../../components/vyzualz/react/ReactPresetCard'
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
          id: 'select', iconOnly: true, pressed: checked, label: `${checked ? 'Deselect' : 'Select'} ${shown.name} for bulk actions`, title: checked ? 'Remove from the selection' : 'Add to the selection',
          onSelect: onToggleChecked,
        }]}
      />
    </div>
  )
}

/**
 * A preset as a table row, like a user in the User Accounts table: the first cell is the round select button for the bulk selection, then the preset's
 * artwork and name ("Modified" while it has unsaved changes), its engine, category and status. Clicking anywhere on the row opens it in the detail panel.
 */
export function AdminPresetTableRow({ preset, shown, active, checked, changed, onSelect, onToggleChecked }: CardProps) {
  const record = shown.record
  return (
    <tr className={active ? 'is-selected' : undefined} data-checked={checked || undefined} data-status={preset.status ?? 'unset'} data-preset-id={preset.record.id} onClick={onSelect}>
      <td className="adm-cell-check">
        <button className="adm-check" type="button" aria-pressed={checked} onClick={event => { event.stopPropagation(); onToggleChecked() }}
          aria-label={`${checked ? 'Deselect' : 'Select'} ${shown.name} for bulk actions`} title={checked ? 'Remove from the selection' : 'Add to the selection'} />
      </td>
      <td>
        <button type="button" className="adm-row-button" aria-pressed={active} aria-label={`Select ${shown.name}`} onClick={event => { event.stopPropagation(); onSelect() }}>
          <ReactPresetArtwork appearance="frame" id={record.sourceId} backdrop={presetArtworkBackdrop(record)} className="adm-thumb" />
          <span className="adm-row-name">{shown.name}</span>
          {changed && <span className="adm-modified" title="Has changes that are not saved yet">Modified</span>}
        </button>
      </td>
      <td>{record.engineName}</td>
      <td className="adm-ellipsis" title={preset.category}>{shown.record.category}</td>
      <td><StatusBadge status={preset.status} /></td>
    </tr>
  )
}
