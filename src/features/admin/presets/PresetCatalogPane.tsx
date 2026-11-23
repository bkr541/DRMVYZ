import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { HeaderActionIcon } from '../../../components/vyzualz/layout/HeaderActionIcon'
import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import { WorkspaceSurface } from '../../../components/vyzualz/layout/FloatingWorkspace'
import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { LibraryViewToggle, type LibraryView } from '../../../components/vyzualz/react/controls/LibraryViewToggle'
import { LibrarySearchRow } from '../../../components/vyzualz/react/controls/LibrarySearchRow'
import { UnderlineDropdown } from '../../../components/vyzualz/react/controls/UnderlineDropdown'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import { AdminHeaderActions } from '../AdminHeaderActions'
import { AdminPresetTableRow, AdminPresetTile, type ShownPreset } from './PresetCatalogCards'
import { InspectorNotice, PresetCatalogInspector } from './PresetCatalogInspector'
import { PresetCatalogSummary } from './PresetCatalogSummary'
import {
  ALL, NO_PACK, STATUS_LABELS, STATUS_ORDER, currentEdit, filterAdminPresets, isEditChanged, parseTags, rowFromEdit, rowWithStatus, sortAdminPresets, statusCounts, validateEdit,
  type AdminPreset, type CatalogPack, type PresetEdit, type PresetFilter, type PresetSortKey, type PublicationStatus,
} from './presetAdmin'

const SORTS: { value: PresetSortKey; label: string }[] = [{ value: 'name', label: 'Sort: Name' }, { value: 'engine', label: 'Sort: Engine' }, { value: 'category', label: 'Sort: Category' }, { value: 'order', label: 'Sort: Display order' }]
/** The status chips, in the order the status dropdown offers them. */
const STATUS_CHIPS: readonly { value: string; label: string }[] = [{ value: ALL, label: 'All' }, ...STATUS_ORDER.map(value => ({ value: value || 'unset', label: STATUS_LABELS[value || 'unset'] }))]
/** What the toast says after a status is saved, and the label on the confirm button for a change to several presets. */
const STATUS_DONE: Readonly<Record<PublicationStatus, string>> = { designing: 'set to designing', draft: 'set to draft', published: 'published', archived: 'archived' }

export interface SaveManyResult { saved: number; error?: string }

interface Props {
  presets: readonly AdminPreset[]
  packs: readonly CatalogPack[]
  /** The Presets | Packs tabs, which sit at the top of the library window. */
  section: ReactNode
  /** False while the Packs tab is showing: the pane stays mounted so its unsaved edits are kept, but it takes nothing from the header. */
  active?: boolean
  onSave: (preset: AdminPreset, row: PresetMetadataRow | null) => Promise<void>
  /** Saves several presets one after another and says how many were saved before any failure. */
  onSaveMany: (changes: readonly { preset: AdminPreset; row: PresetMetadataRow | null }[]) => Promise<SaveManyResult>
  onAddToPack: (preset: AdminPreset, packId: string) => Promise<void>
  onRemoveFromPack: (preset: AdminPreset, packId: string) => Promise<void>
}

interface PendingConfirm { status: PublicationStatus; targets: readonly AdminPreset[] }

const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : 'That did not work.')

/**
 * The Preset Catalog, laid out like the User Accounts tab: a table of every shipped preset on the left (search, filters, status chips, a table or a poster
 * grid, and a multi-select with bulk Publish, Draft and Archive) and, on the right, the open preset: its thumbnail and facts, then its editable details.
 * Edits are kept as drafts per preset until saved, so the admin can move around and push everything at once from the header.
 */
export function PresetCatalogPane({ presets, packs, section, active = true, onSave, onSaveMany, onAddToPack, onRemoveFromPack }: Props) {
  const [filter, setFilter] = useState<PresetFilter>({ query: '', engine: ALL, category: ALL, packId: ALL, status: ALL })
  const [sort, setSort] = useState<PresetSortKey>('name')
  const [view, setView] = useState<LibraryView>('list')
  // Opens on the first preset (by name), so the detail panel is never empty on arrival.
  const [selectedId, setSelectedId] = useState<string | null>(() => sortAdminPresets(presets, 'name')[0]?.record.id ?? null)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const [drafts, setDrafts] = useState<Readonly<Record<string, PresetEdit>>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const patchFilter = (value: Partial<PresetFilter>) => setFilter(current => ({ ...current, ...value }))

  const engines = useMemo(() => [...new Set(presets.map(preset => preset.record.engineName))].sort(), [presets])
  const categories = useMemo(() => [...new Set(presets.map(preset => preset.category))].sort(), [presets])
  // The chips count what clicking them would show, so they follow every filter except their own.
  const counts = useMemo(() => statusCounts(filterAdminPresets(presets, { ...filter, status: ALL })), [presets, filter])
  const visible = useMemo(() => sortAdminPresets(filterAdminPresets(presets, filter), sort), [presets, filter, sort])
  const byId = useMemo(() => new Map(presets.map(preset => [preset.record.id, preset])), [presets])
  const selected = selectedId ? byId.get(selectedId) ?? null : null

  const shownFor = useCallback((preset: AdminPreset): ShownPreset => {
    const edit = drafts[preset.record.id]
    const name = edit?.name.trim() || preset.name
    const description = edit ? edit.description : preset.description
    return { name, description, record: { ...preset.record, name, description, category: edit?.category.trim() || preset.category, tags: edit ? parseTags(edit.tagsText) : preset.tags } }
  }, [drafts])
  const changedPresets = useMemo(() => presets.filter(preset => isEditChanged(preset, drafts[preset.record.id])), [presets, drafts])
  const changedIds = useMemo(() => new Set(changedPresets.map(preset => preset.record.id)), [changedPresets])
  const edit = selected ? currentEdit(selected, drafts) : null
  const problems = useMemo(() => (edit ? validateEdit(edit) : {}), [edit])

  const say = (message: string | null, failure: string | null = null) => { setSaved(message); setNotice(failure) }
  const run = async (work: () => Promise<void>) => {
    setBusy(true); say(null)
    try { await work() } catch (reason) { say(null, errorText(reason)) } finally { setBusy(false) }
  }
  const dropDrafts = (ids: readonly string[]) => setDrafts(current => { const next = { ...current }; for (const id of ids) delete next[id]; return next })

  const patchEdit = (patch: Partial<PresetEdit>) => {
    if (!selected || !edit) return
    const next = { ...edit, ...patch }
    setSaved(null); setNotice(null)
    setDrafts(current => {
      const rest = { ...current }
      if (isEditChanged(selected, next)) rest[selected.record.id] = next
      else delete rest[selected.record.id]
      return rest
    })
  }

  const toggleChecked = (id: string) => setChecked(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const allVisibleChecked = visible.length > 0 && visible.every(preset => checked.has(preset.record.id))
  const checkedPresets = useMemo(() => presets.filter(preset => checked.has(preset.record.id)), [presets, checked])
  /** What a header or bulk action applies to: the checked presets, else the one that is open. */
  const targets = checkedPresets.length > 0 ? checkedPresets : selected ? [selected] : []

  const saveAll = () => run(async () => {
    const ready = changedPresets.filter(preset => Object.keys(validateEdit(currentEdit(preset, drafts))).length === 0)
    const skipped = changedPresets.length - ready.length
    const result = await onSaveMany(ready.map(preset => ({ preset, row: rowFromEdit(preset.record, currentEdit(preset, drafts)) })))
    dropDrafts(ready.slice(0, result.saved).map(preset => preset.record.id))
    if (result.error) throw new Error(`Saved ${result.saved} of ${ready.length}. ${result.error}`)
    say(`Saved ${result.saved} preset${result.saved === 1 ? '' : 's'}.${skipped > 0 ? ` ${skipped} still need a fix before they can be saved.` : ''}`)
  })
  const resetSelectedToShipped = () => void run(async () => { if (!selected) return; await onSave(selected, null); dropDrafts([selected.record.id]); say('Back to what the app ships.') })
  const discardAll = () => { setDrafts({}); say(null) }

  const applyStatus = (list: readonly AdminPreset[], status: PublicationStatus) => run(async () => {
    const invalid = list.find(preset => Object.keys(validateEdit(currentEdit(preset, drafts))).length > 0)
    if (invalid) throw new Error(`Fix ${invalid.name} first: it has a change that cannot be saved.`)
    const subject = list.length === 1 ? shownFor(list[0]!).name : `${list.length} presets`
    const result = await onSaveMany(list.map(preset => ({ preset, row: rowWithStatus(preset, status, drafts[preset.record.id]) })))
    dropDrafts(list.slice(0, result.saved).map(preset => preset.record.id))
    setChecked(current => { const next = new Set(current); for (const preset of list.slice(0, result.saved)) next.delete(preset.record.id); return next })
    if (result.error) throw new Error(`${STATUS_LABELS[status]}: ${result.saved} of ${list.length} saved. ${result.error}`)
    say(`${subject} ${STATUS_DONE[status]}.`)
  })
  /** Archiving, and any change to several presets at once, asks first; publishing one preset does not. */
  const requestStatus = (list: readonly AdminPreset[], status: PublicationStatus) => {
    if (list.length === 0 || busy) return
    if (status === 'archived' || list.length > 1) setConfirm({ status, targets: list })
    else void applyStatus(list, status)
  }

  const moveSelection = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    if ((event.target as HTMLElement).closest('input, textarea, select')) return
    event.preventDefault()
    const index = visible.findIndex(preset => preset.record.id === selectedId)
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]
    if (next) setSelectedId(next.record.id)
  }
  const onRootKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (changedPresets.length > 0 && !busy) void saveAll() }
    else if (event.key === 'Escape' && checked.size > 0 && !confirm) setChecked(new Set())
  }

  const cardProps = (preset: AdminPreset) => ({
    preset, shown: shownFor(preset), active: preset.record.id === selectedId, checked: checked.has(preset.record.id), changed: changedIds.has(preset.record.id),
    onSelect: () => { setSelectedId(preset.record.id); say(null) }, onToggleChecked: () => toggleChecked(preset.record.id),
  })
  const publishCount = targets.length

  return (
    <WorkspaceSurface className="adm-surface adm-pc" role="region" aria-label="Preset catalog" onKeyDown={onRootKeyDown}>
      {active && <AdminHeaderActions>
        <HeaderIconKey label={`Save changes${changedPresets.length > 0 ? ` (${changedPresets.length})` : ''}`} icon={<HeaderActionIcon action="save" />} disabled={busy || changedPresets.length === 0} onClick={() => void saveAll()} />
        <HeaderIconKey label={publishCount > 1 ? `Publish ${publishCount} presets` : 'Publish preset'} icon={<AppIcon kind="upload" size={16} color="currentColor" aria-hidden="true" />} disabled={busy || publishCount === 0} onClick={() => requestStatus(targets, 'published')} />
        <HeaderIconKey label="Reset to shipped" title="Remove every saved change to the open preset and show what the app ships" icon={<HeaderActionIcon action="restore" />} disabled={busy || !selected?.row} onClick={resetSelectedToShipped} />
        <HeaderIconKey label="Discard unsaved changes" icon={<HeaderActionIcon action="reset" />} danger disabled={busy || changedPresets.length === 0} onClick={discardAll} />
      </AdminHeaderActions>}
      {section}
      <div className="adm-split adm-split--catalog">
        <section className="adm-main adm-browser" aria-label="Presets">
          <div className="adm-toolbar">
            <LibrarySearchRow value={filter.query} onChange={value => patchFilter({ query: value })} placeholder="Search presets" label="Search presets" clearable className="adm-search" />
            <span className="adm-count" role="status" aria-live="polite"><strong>{visible.length.toLocaleString()}</strong> of {presets.length.toLocaleString()} presets</span>
            <LibraryViewToggle view={view} onChange={setView} />
          </div>
          <div className="adm-filter-grid">
            <UnderlineDropdown id="adm-engine" value={filter.engine} onChange={value => patchFilter({ engine: value })} ariaLabel="Filter by engine" menuLabel="Engine" title="Engine" size="dense" menuWidth={190} showDescriptions={false}
              options={[{ value: ALL, label: 'All Engines' }, ...engines.map(engine => ({ value: engine, label: engine }))]} />
            <UnderlineDropdown id="adm-category" value={filter.category} onChange={value => patchFilter({ category: value })} ariaLabel="Filter by category" menuLabel="Category" title="Category" size="dense" menuWidth={190} showDescriptions={false}
              options={[{ value: ALL, label: 'All Categories' }, ...categories.map(category => ({ value: category, label: category }))]} />
            <UnderlineDropdown id="adm-pack" value={filter.packId} onChange={value => patchFilter({ packId: value })} ariaLabel="Filter by pack" menuLabel="Pack" title="Pack" size="dense" menuWidth={190} showDescriptions={false}
              options={[{ value: ALL, label: 'All Packs' }, { value: NO_PACK, label: 'No Pack' }, ...packs.map(pack => ({ value: pack.id, label: pack.name }))]} />
            <UnderlineDropdown id="adm-sort" value={sort} onChange={value => setSort(value as PresetSortKey)} ariaLabel="Sort presets" menuLabel="Sort" title="Sort" size="dense" menuWidth={190} showDescriptions={false} options={SORTS} />
          </div>
          <div className="adm-status-row">
            <div className="adm-status-chips" role="group" aria-label="Filter by status">
              {STATUS_CHIPS.map(chip => (
                <button key={chip.value} type="button" className="adm-status-chip" data-status={chip.value} aria-pressed={filter.status === chip.value} onClick={() => patchFilter({ status: chip.value })}>
                  {chip.label}<span>{counts[chip.value as keyof typeof counts].toLocaleString()}</span>
                </button>
              ))}
            </div>
            <button type="button" className="adm-link" disabled={visible.length === 0}
              onClick={() => setChecked(current => { const next = new Set(current); for (const preset of visible) { if (allVisibleChecked) next.delete(preset.record.id); else next.add(preset.record.id) } return next })}>
              {allVisibleChecked ? 'Clear selection' : 'Select all shown'}
            </button>
          </div>
          <div className="adm-table-wrap adm-list" aria-live="polite" onKeyDown={moveSelection}>
            {visible.length === 0 ? <div className="pmv-empty">No presets match.</div> : view === 'grid'
              ? <div className="adm-grid">{visible.map(preset => <AdminPresetTile key={preset.record.id} {...cardProps(preset)} />)}</div>
              : (
                <table className="adm-table adm-preset-table">
                  <thead>
                    <tr><th scope="col" className="adm-cell-check"><span className="adm-visually-hidden">Select</span></th><th scope="col">Preset</th><th scope="col">Engine</th><th scope="col">Category</th><th scope="col">Status</th></tr>
                  </thead>
                  <tbody>{visible.map(preset => <AdminPresetTableRow key={preset.record.id} {...cardProps(preset)} />)}</tbody>
                </table>
              )}
          </div>
          {checkedPresets.length > 0 && (
            <div className="adm-bulk" role="region" aria-label="Bulk actions">
              <span className="adm-bulk-count"><strong>{checkedPresets.length}</strong> selected <button type="button" className="adm-link" onClick={() => setChecked(new Set())}>Clear</button></span>
              <IconChipButton tone="primary" disabled={busy} onClick={() => requestStatus(checkedPresets, 'published')}>Publish</IconChipButton>
              <IconChipButton disabled={busy} onClick={() => requestStatus(checkedPresets, 'designing')}>Designing</IconChipButton>
              <IconChipButton disabled={busy} onClick={() => requestStatus(checkedPresets, 'draft')}>Draft</IconChipButton>
              <IconChipButton disabled={busy} onClick={() => requestStatus(checkedPresets, 'archived')}>Archive</IconChipButton>
            </div>
          )}
        </section>
        <aside className="adm-detail adm-detail--preset" aria-label="Preset details">
          <div className="adm-inspector-notice"><InspectorNotice notice={notice} saved={saved} /></div>
          {selected && edit ? (
            <>
              <PresetCatalogSummary key={`summary:${selected.record.id}`} preset={selected} shown={shownFor(selected)} packs={packs} changed={changedIds.has(selected.record.id)} />
              <PresetCatalogInspector
                key={`inspector:${selected.record.id}`} preset={selected} shown={shownFor(selected)} edit={edit} problems={problems} changed={changedIds.has(selected.record.id)} busy={busy} packs={packs}
                onPatch={patchEdit} onPublish={() => requestStatus([selected], 'published')}
                onAddToPack={packId => void run(() => onAddToPack(selected, packId))} onRemoveFromPack={packId => void run(() => onRemoveFromPack(selected, packId))}
              />
            </>
          ) : <p className="adm-empty adm-inspector-empty">Select a preset to see it and edit its details.</p>}
        </aside>
      </div>
      {confirm && (
        <ConfirmDialog
          title={confirm.status === 'archived' ? `Archive ${confirm.targets.length === 1 ? shownFor(confirm.targets[0]!).name : `${confirm.targets.length} presets`}?` : confirm.status === 'published' ? `Publish ${confirm.targets.length} presets?` : `Set ${confirm.targets.length} presets to ${STATUS_LABELS[confirm.status].toLowerCase()}?`}
          message={confirm.status === 'archived' ? 'Archived presets are marked as retired for the store. Their saved name, description, category, tags and order stay as they are.' : `This saves the status of ${confirm.targets.length} presets, together with any unsaved changes to them.`}
          confirmLabel={confirm.status === 'archived' ? 'Archive' : confirm.status === 'published' ? 'Publish' : `Set to ${STATUS_LABELS[confirm.status]}`} danger={confirm.status === 'archived'} confirmTone={confirm.status === 'archived' ? 'default' : 'primary'} iconTone="neutral"
          busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => { const pending = confirm; setConfirm(null); void applyStatus(pending.targets, pending.status) }}
        />
      )}
    </WorkspaceSurface>
  )
}
