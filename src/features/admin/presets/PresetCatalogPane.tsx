import { useEffect, useMemo, useState } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { LibrarySearchRow } from '../../../components/vyzualz/react/controls/LibrarySearchRow'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { Collapsible, SelectRow, TextAreaRow, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import {
  ALL, NO_PACK, editFromPreset, filterAdminPresets, groupByEngine, groupByPack, rowFromEdit, sortAdminPresets, validateEdit,
  type AdminPreset, type CatalogPack, type PresetEdit, type PresetFilter, type PresetSortKey, type PublicationStatus,
} from './presetAdmin'
import { activationLabel, presetVersionInfo } from './presetTechnical'

const NOOP = () => undefined
const SORTS: { value: PresetSortKey; label: string }[] = [{ value: 'name', label: 'Name' }, { value: 'engine', label: 'Engine' }, { value: 'category', label: 'Category' }, { value: 'order', label: 'Display order' }]
const STATUSES: { value: string; label: string }[] = [{ value: ALL, label: 'Any status' }, { value: 'unset', label: 'Not set' }, { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }

interface Props {
  presets: readonly AdminPreset[]
  packs: readonly CatalogPack[]
  onSave: (preset: AdminPreset, row: PresetMetadataRow | null) => Promise<void>
  onAddToPack: (preset: AdminPreset, packId: string) => Promise<void>
  onRemoveFromPack: (preset: AdminPreset, packId: string) => Promise<void>
}

function PresetEditor({ preset, packs, onSave, onAddToPack, onRemoveFromPack }: { preset: AdminPreset } & Omit<Props, 'presets'>) {
  const [edit, setEdit] = useState<PresetEdit>(() => editFromPreset(preset))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [addPack, setAddPack] = useState('')
  // A different preset, or new values from the database, start the form again from what is stored.
  useEffect(() => { setEdit(editFromPreset(preset)); setNotice(null); setSaved(false) }, [preset])
  const problems = useMemo(() => validateEdit(edit), [edit])
  const record = preset.record
  const version = presetVersionInfo(record)
  const patch = (value: Partial<PresetEdit>) => { setEdit(current => ({ ...current, ...value })); setSaved(false) }
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setNotice(null)
    try { await work() } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'That did not work.') } finally { setBusy(false) }
  }
  const memberOf = packs.filter(pack => preset.packIds.includes(pack.id))
  const available = packs.filter(pack => !preset.packIds.includes(pack.id))

  return (
    <div className="rv-workspace-panel" aria-label={`${preset.name} preset`}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group">
            <Collapsible label="Metadata">
              <TextInputRow label="Name" value={edit.name} onChange={value => patch({ name: value })} maxLength={160} />
              {problems.name && <p className="adm-field-error" role="alert">{problems.name}</p>}
              <TextAreaRow label="Description" value={edit.description} onChange={value => patch({ description: value })} rows={3} spellCheck />
              <TextInputRow label="Category" value={edit.category} onChange={value => patch({ category: value })} maxLength={80} />
              <TextInputRow label="Tags" value={edit.tagsText} onChange={value => patch({ tagsText: value })} maxLength={1400} description="Separated by commas." />
              {problems.tags && <p className="adm-field-error" role="alert">{problems.tags}</p>}
              <TextInputRow label="Display Order" value={edit.orderText} onChange={value => patch({ orderText: value })} maxLength={7} inputMode="numeric" placeholder="Shipped order" description="Lower comes first; blank keeps the shipped order." />
              {problems.order && <p className="adm-field-error" role="alert">{problems.order}</p>}
              <SelectRow label="Publication Status" value={edit.status} onChange={value => patch({ status: value as PublicationStatus | '' })}
                options={[{ value: '', label: 'Not set' }, { value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
            </Collapsible>
            <Collapsible label="Store" defaultOpen={false}>
              <TextInputRow label="Store Title" value={edit.storeTitle} onChange={value => patch({ storeTitle: value })} maxLength={160} />
              <TextInputRow label="Store Subtitle" value={edit.storeSubtitle} onChange={value => patch({ storeSubtitle: value })} maxLength={200} />
              <TextInputRow label="Artwork Reference" value={edit.storeCover} onChange={value => patch({ storeCover: value })} maxLength={500} />
              <TextInputRow label="Preview Reference" value={edit.storePreview} onChange={value => patch({ storePreview: value })} maxLength={500} />
            </Collapsible>
            <Collapsible label="Packs">
              {memberOf.length === 0 && <p className="adm-muted">Not in any pack.</p>}
              <ul className="adm-chips">
                {memberOf.map(pack => (
                  <li key={pack.id} className="adm-chip"><span>{pack.name}</span><button type="button" aria-label={`Remove from ${pack.name}`} disabled={busy} onClick={() => void run(() => onRemoveFromPack(preset, pack.id))}>×</button></li>
                ))}
              </ul>
              {available.length > 0 && (
                <div className="adm-inline-actions">
                  <SelectRow label="Add to Pack" value={addPack} onChange={setAddPack} placeholder="Choose a pack" options={available.map(pack => ({ value: pack.id, label: pack.name }))} />
                  <IconChipButton disabled={busy || !addPack} onClick={() => void run(async () => { await onAddToPack(preset, addPack); setAddPack('') })}>Add</IconChipButton>
                </div>
              )}
            </Collapsible>
            <Collapsible label="Technical" defaultOpen={false}>
              <TextInputRow label="Preset ID" value={record.id} onChange={NOOP} readOnly maxLength={400} />
              <TextInputRow label="Source ID" value={record.sourceId} onChange={NOOP} readOnly maxLength={400} />
              <TextInputRow label="Visualizer Engine" value={record.engineName} onChange={NOOP} readOnly maxLength={100} />
              <TextInputRow label="Activation Type" value={activationLabel(record)} onChange={NOOP} readOnly maxLength={100} />
              <TextInputRow label="Camera Support" value={record.hasCamera ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
              <TextInputRow label="User Media Integration" value={record.canIntegrateUserMedia ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
              <TextInputRow label="3D Environment" value={record.is3dEnvironment ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
              <TextInputRow label="Version" value={version.version} onChange={NOOP} readOnly maxLength={100} />
              <TextInputRow label="Compatibility" value={version.compatibility} onChange={NOOP} readOnly maxLength={400} />
            </Collapsible>
          </div>
          {notice && <NoticeCard tone="warning" title="Not saved" role="alert">{notice}</NoticeCard>}
          {saved && <NoticeCard tone="success" title="Saved" role="status">The app shows this now.</NoticeCard>}
          <div className="adm-form-actions">
            <IconChipButton disabled={busy || !preset.row} title="Remove every change and show what the app ships" onClick={() => void run(() => onSave(preset, null))}>Reset to Shipped</IconChipButton>
            <IconChipButton tone="primary" disabled={busy || Object.keys(problems).length > 0} onClick={() => void run(async () => { await onSave(preset, rowFromEdit(record, edit)); setSaved(true) })}>{busy ? 'Saving…' : 'Save'}</IconChipButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Every shipped preset, by engine or by pack, with search, filters and sorting; selecting one opens its editor. */
export function PresetCatalogPane({ presets, packs, onSave, onAddToPack, onRemoveFromPack }: Props) {
  const [filter, setFilter] = useState<PresetFilter>({ query: '', engine: ALL, category: ALL, packId: ALL, status: ALL })
  const [sort, setSort] = useState<PresetSortKey>('name')
  const [grouping, setGrouping] = useState<'engine' | 'pack'>('engine')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const patch = (value: Partial<PresetFilter>) => setFilter(current => ({ ...current, ...value }))

  const engines = useMemo(() => [...new Set(presets.map(preset => preset.record.engineName))].sort(), [presets])
  const categories = useMemo(() => [...new Set(presets.map(preset => preset.category))].sort(), [presets])
  const visible = useMemo(() => sortAdminPresets(filterAdminPresets(presets, filter), sort), [presets, filter, sort])
  const groups = useMemo(() => (grouping === 'engine' ? groupByEngine(visible) : groupByPack(visible, packs)), [grouping, visible, packs])
  const selected = presets.find(preset => preset.record.id === selectedId) ?? null
  const packName = (id: string) => packs.find(pack => pack.id === id)?.name ?? ''

  return (
    <div className="adm-split">
      <section className="adm-main" aria-label="Preset catalog">
        <div className="adm-toolbar adm-toolbar--wrap">
          <LibrarySearchRow value={filter.query} onChange={value => patch({ query: value })} placeholder="Search presets" label="Search presets" clearable className="adm-search" />
          <div className="adm-filters">
            <SelectRow label="Engine" labelHidden ariaLabel="Filter by engine" value={filter.engine} onChange={value => patch({ engine: value })} options={[{ value: ALL, label: 'All engines' }, ...engines.map(engine => ({ value: engine, label: engine }))]} />
            <SelectRow label="Category" labelHidden ariaLabel="Filter by category" value={filter.category} onChange={value => patch({ category: value })} options={[{ value: ALL, label: 'All categories' }, ...categories.map(category => ({ value: category, label: category }))]} />
            <SelectRow label="Pack" labelHidden ariaLabel="Filter by pack" value={filter.packId} onChange={value => patch({ packId: value })} options={[{ value: ALL, label: 'All packs' }, { value: NO_PACK, label: 'No pack' }, ...packs.map(pack => ({ value: pack.id, label: pack.name }))]} />
            <SelectRow label="Status" labelHidden ariaLabel="Filter by publication status" value={filter.status} onChange={value => patch({ status: value })} options={STATUSES} />
            <SelectRow label="Sort" labelHidden ariaLabel="Sort presets" value={sort} onChange={value => setSort(value as PresetSortKey)} options={SORTS.map(option => ({ value: option.value, label: `Sort: ${option.label}` }))} />
            <SelectRow label="Group" labelHidden ariaLabel="Group presets" value={grouping} onChange={value => setGrouping(value as 'engine' | 'pack')} options={[{ value: 'engine', label: 'Group: Engine' }, { value: 'pack', label: 'Group: Pack' }]} />
          </div>
          <span className="adm-count" role="status" aria-live="polite"><strong>{visible.length.toLocaleString()}</strong> of {presets.length.toLocaleString()} presets</span>
        </div>
        <div className="adm-table-wrap">
          {groups.map(group => (
            <section key={group.id} className="adm-group" aria-label={group.label}>
              <h3 className="adm-group-title">{group.label}<span>{group.presets.length}</span></h3>
              {group.presets.length === 0 ? <p className="adm-muted adm-group-empty">No presets.</p> : (
                <table className="adm-table">
                  <thead><tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Tags</th><th scope="col">Packs</th><th scope="col">Order</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {group.presets.map(preset => (
                      <tr key={`${group.id}:${preset.record.id}`} className={preset.record.id === selectedId ? 'is-selected' : undefined} onClick={() => setSelectedId(preset.record.id)}>
                        <td><button type="button" className="adm-row-button" aria-pressed={preset.record.id === selectedId} onClick={event => { event.stopPropagation(); setSelectedId(preset.record.id) }}>{preset.name}{preset.row ? <span className="adm-edited" title="Changed from what the app ships"> •</span> : null}</button></td>
                        <td>{preset.category}</td>
                        <td className="adm-ellipsis" title={preset.tags.join(', ')}>{preset.tags.join(', ') || '—'}</td>
                        <td className="adm-ellipsis">{preset.packIds.map(packName).filter(Boolean).join(', ') || '—'}</td>
                        <td>{preset.order ?? '—'}</td>
                        <td>{preset.status ? STATUS_LABEL[preset.status] : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
          {visible.length === 0 && <p className="adm-empty">No presets match.</p>}
        </div>
      </section>
      <aside className="adm-detail" aria-label="Preset editor">
        {selected ? <PresetEditor key={selected.record.id} preset={selected} packs={packs} onSave={onSave} onAddToPack={onAddToPack} onRemoveFromPack={onRemoveFromPack} /> : <p className="adm-empty">Select a preset to see and edit its details.</p>}
      </aside>
    </div>
  )
}
