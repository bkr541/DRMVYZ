import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HeaderActionIcon } from '../../../components/vyzualz/layout/HeaderActionIcon'
import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import { presetArtworkBackdrop } from '../../../components/vyzualz/presetManager/PresetLibraryCard'
import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { notify } from '../../../stores/notificationStore'
import { PresetSearchRow } from '../../../components/vyzualz/react/controls/PresetSearchRow'
import { Collapsible, TextAreaRow, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import { ReactPresetCard } from '../../../components/vyzualz/react/ReactPresetCard'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { VisualPresetSearch } from '../../../components/vyzualz/react/controls/VisualPresetSearch'
import type { FilterPreset } from '../../../components/vyzualz/react/layoutLab/presetFilterStudyData'
import { usePresetOrganizationStore } from '../../presetOrganization/presetOrganizationStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { loadPackArtwork, PACK_IMAGE_ACCEPT } from './presetsApi'
import { AdminHeaderActions } from '../AdminHeaderActions'
import type { AdminPreset, CatalogPack, CatalogPackEdit, PackMember } from './presetAdmin'

const NOOP = () => undefined

interface Props {
  presets: readonly AdminPreset[]
  packs: readonly CatalogPack[]
  members: readonly PackMember[]
  /** False while the Presets tab is showing: the pane stays mounted, so nothing typed in it is lost, but it takes nothing from the header. */
  active?: boolean
  onCreate: (name: string) => Promise<CatalogPack>
  onUpdate: (id: string, patch: CatalogPackEdit) => Promise<void>
  onUploadArtwork: (pack: CatalogPack, file: File) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddMember: (packId: string, preset: AdminPreset) => Promise<void>
  onRemoveMember: (packId: string, preset: AdminPreset) => Promise<void>
  onMoveMember: (packId: string, preset: AdminPreset, direction: -1 | 1) => Promise<void>
}

const memberKey = (member: PackMember) => `${member.engine_id}:${member.preset_key}`
const sortedPacks = (packs: readonly CatalogPack[]) => [...packs].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))

/** The right window: one pack's details and its presets. Save and Delete are the header's icons, as on the Presets tab. */
function PackInspector({ pack, ...props }: { pack: CatalogPack } & Props) {
  const [name, setName] = useState(pack.name)
  const [subtitle, setSubtitle] = useState(pack.subtitle ?? '')
  const [description, setDescription] = useState(pack.description ?? '')
  const [orderText, setOrderText] = useState(String(pack.display_order))
  const [add, setAdd] = useState('')
  const [search, setSearch] = useState('')
  const organizations = usePresetOrganizationStore(state => state.records)
  const loadOrganizations = usePresetOrganizationStore(state => state.load)
  const collections = useMediaStore(state => state.collections)
  const loadCollections = useMediaStore(state => state.loadCollections)
  useEffect(() => { void loadOrganizations(); void loadCollections() }, [loadOrganizations, loadCollections])
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { setName(pack.name); setSubtitle(pack.subtitle ?? ''); setDescription(pack.description ?? ''); setOrderText(String(pack.display_order)) }, [pack.name, pack.subtitle, pack.description, pack.display_order])

  const run = async (work: () => Promise<void>, message = 'Pack updated.') => {
    setBusy(true)
    try { await work(); notify('admin', { tone: 'success', title: 'Saved', message }) } catch (reason) { notify('admin', { tone: 'warning', title: 'Not saved', message: reason instanceof Error ? reason.message : 'That did not work.' }) } finally { setBusy(false) }
  }
  const byKey = useMemo(() => new Map(props.presets.map(preset => [preset.record.id, preset])), [props.presets])
  const ordered = props.members.filter(member => member.pack_id === pack.id).sort((a, b) => a.position - b.position)
  const inPack = new Set(ordered.map(memberKey))
  const candidates = props.presets.filter(preset => !inPack.has(preset.record.id))
  const records: FilterPreset[] = candidates.map(preset => {
    const organization = organizations[preset.record.id]
    return { id: preset.record.id, artworkId: preset.record.sourceId, name: preset.name, description: preset.description,
      category: preset.category, tags: [...new Set([...preset.tags, preset.record.engineName, ...(organization?.tags ?? [])])], favorite: false,
      collections: collections.filter(collection => organization?.collectionIds.includes(collection.id)).map(({ id, name }) => ({ id, name })) }
  })
  const selectedCandidate = candidates.find(preset => preset.record.id === add)
  const orderValid = /^-?\d{1,6}$/.test(orderText.trim())
  const valid = name.trim().length > 0 && name.trim().length <= 160 && orderValid
  const changed = name.trim() !== pack.name || (subtitle.trim() || null) !== (pack.subtitle ?? null) || (description.trim() || null) !== (pack.description ?? null) || (orderValid && Number(orderText) !== pack.display_order)
  const save = () => void run(() => props.onUpdate(pack.id, { name: name.trim(), subtitle: subtitle.trim() || null, description: description.trim() || null, display_order: Number(orderText) }))

  return (
    <div className="adm-inspector-body" aria-label={`${pack.name} pack`}>
      {props.active !== false && (
        <AdminHeaderActions>
          <HeaderIconKey label="Save pack" icon={<HeaderActionIcon action="save" />} disabled={busy || !valid || !changed} onClick={save} />
          <HeaderIconKey label="Delete pack" icon={<HeaderActionIcon action="delete" />} danger disabled={busy} onClick={() => setConfirmDelete(true)} />
        </AdminHeaderActions>
      )}
      <div className="rv-inspector">
        <div className="rv-ctrl-group">
          <Collapsible label="Pack">
            <TextInputRow label="Name" value={name} onChange={setName} maxLength={160} />
            {!name.trim() && <p className="adm-field-error" role="alert">A pack needs a name.</p>}
            <TextInputRow label="Subtitle" value={subtitle} onChange={setSubtitle} maxLength={160} placeholder="Optional secondary title" />
            <TextAreaRow label="Description" value={description} onChange={setDescription} rows={3} spellCheck />
            <TextInputRow label="Display Order" value={orderText} onChange={setOrderText} maxLength={7} inputMode="numeric" description="Lower comes first." />
            {!orderValid && <p className="adm-field-error" role="alert">Use a whole number.</p>}
          </Collapsible>
          <Collapsible label={`Presets (${ordered.length})`}>
            {ordered.length === 0 && <p className="adm-muted">No presets in this pack yet.</p>}
            <ol className="adm-members">
              {ordered.map((member, index) => {
                const preset = byKey.get(memberKey(member))
                return (
                  <li key={memberKey(member)} className="adm-member">
                    <span className="adm-member-name">{preset?.name ?? member.preset_key}<small>{preset?.record.engineName ?? member.engine_id}</small></span>
                    <span className="adm-member-actions">
                      <button type="button" aria-label="Move up" disabled={busy || index === 0 || !preset} onClick={() => preset && void run(() => props.onMoveMember(pack.id, preset, -1))}>↑</button>
                      <button type="button" aria-label="Move down" disabled={busy || index === ordered.length - 1 || !preset} onClick={() => preset && void run(() => props.onMoveMember(pack.id, preset, 1))}>↓</button>
                      <button type="button" aria-label={`Remove ${preset?.name ?? member.preset_key} from this pack`} disabled={busy || !preset} onClick={() => preset && void run(() => props.onRemoveMember(pack.id, preset))}>×</button>
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="adm-pack-add">
              <span className="adm-pack-add-label">Add Preset</span>
              <div className="adm-inline-actions">
                <VisualPresetSearch query={search} onQueryChange={value => { setSearch(value); setAdd('') }} records={records}
                  selectedId={add} onSelect={preset => { setAdd(preset.id); setSearch(preset.name) }} ariaLabel="Add Preset" placeholder="Search presets…"
                  portal disabled={busy || props.active === false} renderArtwork={preset => { const source = byKey.get(preset.id); return source ? presetArtworkBackdrop(source.record) : undefined }} />
                <IconChipButton disabled={busy || !selectedCandidate} onClick={() => selectedCandidate && void run(async () => { await props.onAddMember(pack.id, selectedCandidate); setAdd(''); setSearch('') })}>Add</IconChipButton>
              </div>
            </div>
          </Collapsible>
        </div>
      </div>
      {props.active !== false && confirmDelete && createPortal(
        <ConfirmDialog title="Delete pack?" message={<>“{pack.name}” will be deleted. The presets in it are not deleted, only removed from the pack.</>} confirmLabel="Delete" busy={busy}
          onCancel={() => setConfirmDelete(false)} onConfirm={() => void run(async () => { await props.onDelete(pack.id); setConfirmDelete(false) }, 'Pack deleted.')} />, document.body
      )}
    </div>
  )
}

/** The pack summary: the pack as a collection, its details and its presets in order, as cards. */
function PackStage({ pack, presets, members }: { pack: CatalogPack | null; presets: readonly AdminPreset[]; members: readonly PackMember[] }) {
  const byKey = useMemo(() => new Map(presets.map(preset => [preset.record.id, preset])), [presets])
  const ordered = pack ? members.filter(member => member.pack_id === pack.id).sort((a, b) => a.position - b.position) : []
  return (
    <div className="adm-stage adm-summary" aria-label="Pack preview workspace">
      {!pack ? (
        <div className="adm-stage-empty"><p className="adm-empty">Select a pack to see it here.</p></div>
      ) : (
        <div className="adm-stage-preview" role="group" aria-label={`${pack.name} pack`}>
          <div className="adm-preview-summary">
            <div className="adm-preview-title"><h2>{pack.name}</h2></div>
            <p className="adm-preview-description">{pack.description || 'No description.'}</p>
            <dl className="adm-facts">
              <div className="adm-fact"><dt>Presets</dt><dd>{ordered.length}</dd></div>
              <div className="adm-fact"><dt>Display order</dt><dd>{pack.display_order}</dd></div>
            </dl>
          </div>
          {ordered.length === 0 ? <p className="adm-muted">No presets in this pack yet. Add some from the inspector.</p> : (
            <div className="adm-pack-grid">
              {ordered.map((member, index) => {
                const preset = byKey.get(memberKey(member))
                return preset
                  ? <div className="adm-tile" key={memberKey(member)}><ReactPresetCard id={preset.record.sourceId} title={preset.name} description={preset.description} backdrop={presetArtworkBackdrop(preset.record)} chips={[{ label: `${index + 1}` }]} activateLabel={`${preset.name}, number ${index + 1} in the pack`} onActivate={NOOP} /></div>
                  : <div className="adm-tile adm-pack-missing" key={memberKey(member)}>{member.preset_key}</div>
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Each card owns its file picker and revocable preview URL; the catalog stores only the durable object path. */
function PackCard({ pack, count, selected, onSelect, onUpload }: { pack: CatalogPack; count: number; selected: boolean; onSelect: () => void; onUpload: (pack: CatalogPack, file: File) => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null)
  const [failedPath, setFailedPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const path = pack.thumbnail_path
  useEffect(() => {
    if (!path) return
    let cancelled = false
    let url: string | undefined
    const revoke = URL.revokeObjectURL?.bind(URL)
    void loadPackArtwork(path).then(blob => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setPreview({ path, url }); setFailedPath(null)
    }).catch(() => { if (!cancelled) setFailedPath(path) })
    return () => { cancelled = true; if (url) revoke?.(url) }
  }, [path])
  const image = preview && preview.path === path && failedPath !== path ? preview.url : null
  const upload = async (file: File) => {
    setBusy(true)
    try { await onUpload(pack, file); notify('admin', { tone: 'success', title: 'Saved', message: `${pack.name} artwork updated.` }) }
    catch (reason) { notify('admin', { tone: 'warning', title: 'Artwork not saved', message: reason instanceof Error ? reason.message : 'That did not work.' }) }
    finally { setBusy(false) }
  }
  return <li className={`adm-card adm-pack-cover${selected ? ' is-selected' : ''}`}>
    <div className="adm-pack-artwork">
      <button type="button" className="adm-pack-artwork-button" disabled={busy} aria-label={`${path ? 'Replace' : 'Upload'} artwork for ${pack.name}`} onClick={() => { onSelect(); fileInput.current?.click() }}>
        {image ? <img src={image} alt="" onError={() => setFailedPath(path ?? null)} /> : null}
        <span className={`adm-pack-upload-hint${image ? ' has-artwork' : ''}`}><AppIcon kind="image" size={22} />{busy ? 'Uploading…' : path && failedPath === path ? 'Artwork unavailable · Replace' : path && !image ? 'Loading artwork…' : image ? 'Replace artwork' : 'Upload artwork'}</span>
      </button>
      <input ref={fileInput} type="file" accept={PACK_IMAGE_ACCEPT} hidden aria-label={`Artwork file for ${pack.name}`} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(file) }} />
    </div>
    <button type="button" className="adm-card-button adm-pack-cover-copy" aria-label={`Select ${pack.name} (${count} presets)`} aria-pressed={selected} onClick={onSelect} title={pack.name}>
      <span className="adm-pack-cover-rule" aria-hidden="true" />
      <span className="adm-pack-cover-text"><strong>{pack.name}</strong><span>{pack.subtitle || `${count} preset${count === 1 ? '' : 's'}`}</span></span>
    </button>
  </li>
}

/**
 * The Packs tab uses the same two-column catalog layout: packs on the left, selected pack preview and editor on the right. A pack only organizes presets the app already ships.
 */
export function PackPane(props: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = props.packs.find(pack => pack.id === selectedId) ?? null
  const count = (id: string) => props.members.filter(member => member.pack_id === id).length
  const duplicate = props.packs.some(pack => pack.name.trim().toLowerCase() === newName.trim().toLowerCase())
  const visible = sortedPacks(props.packs).filter(pack => !query.trim() || `${pack.name} ${pack.subtitle ?? ''} ${pack.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))

  const create = async () => {
    setBusy(true)
    try { const pack = await props.onCreate(newName.trim()); setNewName(''); setSelectedId(pack.id); notify('admin', { tone: 'success', title: 'Saved', message: `${pack.name} created.` }) } catch (reason) { notify('admin', { tone: 'warning', title: 'Not created', message: reason instanceof Error ? reason.message : 'That did not work.' }) } finally { setBusy(false) }
  }

  return (
    <div className="adm-surface adm-pc" role="region" aria-label="Preset packs">
      <div className="adm-split adm-split--catalog">
        <section className="adm-main adm-browser" aria-label="Packs">
          <PresetSearchRow query={query} onQueryChange={setQuery} placeholder="Search packs…" ariaLabel="Search packs" className="adm-pack-search" />
          <div className="adm-new-pack">
            <TextInputRow label="New Pack" value={newName} onChange={setNewName} maxLength={160} placeholder="Pack name" />
            <IconChipButton tone="primary" disabled={busy || !newName.trim() || duplicate} onClick={() => void create()}>Create Pack</IconChipButton>
          </div>
          {duplicate && newName.trim() && <p className="adm-field-error adm-pad" role="alert">A pack with that name already exists.</p>}
          <div className="adm-list-head">
            <span className="adm-count" role="status" aria-live="polite"><strong>{visible.length}</strong> of {props.packs.length} pack{props.packs.length === 1 ? '' : 's'}</span>
          </div>
          <div className="adm-table-wrap adm-list">
            {props.packs.length === 0 ? <p className="adm-empty">No packs yet. Create one to group presets.</p> : visible.length === 0 ? <div className="pmv-empty">No packs match.</div> : (
              <ul className="adm-cards adm-pack-covers">
                {visible.map(pack => <PackCard key={pack.id} pack={pack} count={count(pack.id)} selected={pack.id === selectedId}
                  onSelect={() => setSelectedId(pack.id)} onUpload={props.onUploadArtwork} />)}
              </ul>
            )}
          </div>
        </section>
        <aside className="adm-detail adm-detail--preset" aria-label="Pack details">
          <div className="adm-detail-scroll rv-inspector-scroll">
            {selected ? <>
              <PackStage pack={selected} presets={props.presets} members={props.members} />
              <PackInspector key={selected.id} pack={selected} {...props} />
            </> : <p className="adm-empty adm-inspector-empty">Select a pack to rename it, order it and arrange its presets.</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}
