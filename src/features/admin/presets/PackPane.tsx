import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { Collapsible, SelectRow, TextAreaRow, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import type { AdminPreset, CatalogPack, PackMember } from './presetAdmin'

interface Props {
  presets: readonly AdminPreset[]
  packs: readonly CatalogPack[]
  members: readonly PackMember[]
  onCreate: (name: string) => Promise<CatalogPack>
  onUpdate: (id: string, patch: Partial<Pick<CatalogPack, 'name' | 'description' | 'display_order'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddMember: (packId: string, preset: AdminPreset) => Promise<void>
  onRemoveMember: (packId: string, preset: AdminPreset) => Promise<void>
  onMoveMember: (packId: string, preset: AdminPreset, direction: -1 | 1) => Promise<void>
}

function PackEditor({ pack, ...props }: { pack: CatalogPack } & Props) {
  const [name, setName] = useState(pack.name)
  const [description, setDescription] = useState(pack.description ?? '')
  const [orderText, setOrderText] = useState(String(pack.display_order))
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => { setName(pack.name); setDescription(pack.description ?? ''); setOrderText(String(pack.display_order)); setNotice(null) }, [pack])

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setNotice(null)
    try { await work() } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'That did not work.') } finally { setBusy(false) }
  }
  const byKey = useMemo(() => new Map(props.presets.map(preset => [preset.record.id, preset])), [props.presets])
  const ordered = props.members.filter(member => member.pack_id === pack.id).sort((a, b) => a.position - b.position)
  const inPack = new Set(ordered.map(member => `${member.engine_id}:${member.preset_key}`))
  const candidates = props.presets.filter(preset => !inPack.has(preset.record.id))
  const orderValid = /^-?\d{1,6}$/.test(orderText.trim())
  const valid = name.trim().length > 0 && name.trim().length <= 160 && orderValid

  return (
    <div className="rv-workspace-panel" aria-label={`${pack.name} pack`}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group">
            <Collapsible label="Pack">
              <TextInputRow label="Name" value={name} onChange={setName} maxLength={160} />
              {!name.trim() && <p className="adm-field-error" role="alert">A pack needs a name.</p>}
              <TextAreaRow label="Description" value={description} onChange={setDescription} rows={3} spellCheck />
              <TextInputRow label="Display Order" value={orderText} onChange={setOrderText} maxLength={7} inputMode="numeric" description="Lower comes first." />
              {!orderValid && <p className="adm-field-error" role="alert">Use a whole number.</p>}
              <div className="adm-inline-actions">
                <IconChipButton tone="primary" disabled={busy || !valid} onClick={() => void run(() => props.onUpdate(pack.id, { name: name.trim(), description: description.trim() || null, display_order: Number(orderText) }))}>Save Pack</IconChipButton>
              </div>
            </Collapsible>
            <Collapsible label={`Presets (${ordered.length})`}>
              {ordered.length === 0 && <p className="adm-muted">No presets in this pack yet.</p>}
              <ol className="adm-members">
                {ordered.map((member, index) => {
                  const preset = byKey.get(`${member.engine_id}:${member.preset_key}`)
                  return (
                    <li key={`${member.engine_id}:${member.preset_key}`} className="adm-member">
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
              <div className="adm-inline-actions">
                <SelectRow label="Add Preset" value={add} onChange={setAdd} placeholder="Choose a preset" menuSearch menuSearchPlaceholder="Search presets"
                  options={candidates.map(preset => ({ value: preset.record.id, label: `${preset.record.engineName} · ${preset.name}` }))} />
                <IconChipButton disabled={busy || !add} onClick={() => void run(async () => { const preset = byKey.get(add); if (preset) await props.onAddMember(pack.id, preset); setAdd('') })}>Add</IconChipButton>
              </div>
            </Collapsible>
          </div>
          {notice && <NoticeCard tone="warning" title="Not saved" role="alert">{notice}</NoticeCard>}
          <div className="adm-form-actions">
            <IconChipButton className="dv-icon-chip--danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete Pack</IconChipButton>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog title="Delete pack?" message={<>“{pack.name}” will be deleted. The presets in it are not deleted, only removed from the pack.</>} confirmLabel="Delete" busy={busy}
          onCancel={() => setConfirmDelete(false)} onConfirm={() => void run(async () => { await props.onDelete(pack.id); setConfirmDelete(false) })} />
      )}
    </div>
  )
}

/** Create, rename, order and delete packs, and arrange the presets in them. A pack only organizes presets the app already ships. */
export function PackPane(props: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const selected = props.packs.find(pack => pack.id === selectedId) ?? null
  const count = (id: string) => props.members.filter(member => member.pack_id === id).length
  const duplicate = props.packs.some(pack => pack.name.trim().toLowerCase() === newName.trim().toLowerCase())

  const create = async () => {
    setBusy(true); setNotice(null)
    try { const pack = await props.onCreate(newName.trim()); setNewName(''); setSelectedId(pack.id) } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'That did not work.') } finally { setBusy(false) }
  }

  return (
    <div className="adm-split">
      <section className="adm-main" aria-label="Preset packs">
        <div className="adm-toolbar">
          <div className="adm-new-pack">
            <TextInputRow label="New Pack" value={newName} onChange={setNewName} maxLength={160} placeholder="Pack name" />
            <IconChipButton tone="primary" disabled={busy || !newName.trim() || duplicate} onClick={() => void create()}>Create Pack</IconChipButton>
          </div>
          <span className="adm-count"><strong>{props.packs.length}</strong> pack{props.packs.length === 1 ? '' : 's'}</span>
        </div>
        {duplicate && newName.trim() && <p className="adm-field-error" role="alert">A pack with that name already exists.</p>}
        {notice && <NoticeCard tone="warning" title="Not created" role="alert">{notice}</NoticeCard>}
        {props.packs.length === 0 && <p className="adm-empty">No packs yet. Create one to group presets.</p>}
        <ul className="adm-cards">
          {[...props.packs].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)).map(pack => (
            <li key={pack.id} className={`adm-card${pack.id === selectedId ? ' is-selected' : ''}`}>
              <button type="button" className="adm-card-button" aria-pressed={pack.id === selectedId} onClick={() => setSelectedId(pack.id)}>
                <span className="adm-card-head"><strong>{pack.name}</strong><span className="adm-muted">{count(pack.id)} preset{count(pack.id) === 1 ? '' : 's'}</span></span>
                {pack.description && <span className="adm-card-body">{pack.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <aside className="adm-detail" aria-label="Pack editor">
        {selected ? <PackEditor key={selected.id} pack={selected} {...props} /> : <p className="adm-empty">Select a pack to rename it, order it and arrange its presets.</p>}
      </aside>
    </div>
  )
}
