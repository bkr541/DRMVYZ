import { useState } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { RailTabs } from '../../../components/vyzualz/layout/RailTabs'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { TagPill } from '../../../components/vyzualz/react/controls/TagPill'
import { Collapsible, SelectRow, TextAreaRow, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'
import { parseTags, STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_ORDER, type AdminPreset, type CatalogPack, type EditProblems, type PresetEdit, type PublicationStatus } from './presetAdmin'
import { activationLabel, presetVersionInfo } from './presetTechnical'

const NOOP = () => undefined
type InspectorTab = 'info' | 'store' | 'technical'
const TABS = [{ id: 'info', label: 'INFO' }, { id: 'store', label: 'STORE' }, { id: 'technical', label: 'TECHNICAL' }] as const
/** The status dropdown's options: each status with the sentence that says what it means. The empty status (nothing recorded) is `unset`. */
const STATUS_OPTIONS = STATUS_ORDER.map(value => ({ value: value || 'unset', label: STATUS_LABELS[value || 'unset'], description: STATUS_DESCRIPTIONS[value || 'unset'] }))

interface Props {
  preset: AdminPreset
  edit: PresetEdit
  problems: EditProblems
  /** The edit differs from what is stored. */
  changed: boolean
  busy: boolean
  packs: readonly CatalogPack[]
  onPatch: (patch: Partial<PresetEdit>) => void
  onPublish: () => void
  onAddToPack: (packId: string) => void
  onRemoveFromPack: (packId: string) => void
}

/** Tags as chips: type one and press Enter or a comma to add it, click a chip's × to remove it. */
function TagEditor({ tagsText, onChange, error }: { tagsText: string; onChange: (text: string) => void; error?: string }) {
  const [draft, setDraft] = useState('')
  const tags = parseTags(tagsText)
  const add = (raw: string) => {
    const next = parseTags(raw)
    if (next.length === 0) return
    onChange([...new Set([...tags, ...next])].join(', '))
    setDraft('')
  }
  return (
    <div className="adm-tags">
      <span className="rv-ctrl-label">Tags</span>
      {tags.length > 0 && (
        <ul className="adm-chips" aria-label="Tags">
          {tags.map(tag => (
            <li key={tag}><TagPill label={tag} removeLabel="Remove tag" onRemove={() => onChange(tags.filter(entry => entry !== tag).join(', '))} /></li>
          ))}
        </ul>
      )}
      <DreamVizTextInput
        aria-label="Add a tag" placeholder="Type a tag and press Enter" value={draft} maxLength={40}
        onChange={event => { const value = event.target.value; if (value.includes(',')) add(value); else setDraft(value) }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(draft) } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) onChange(tags.slice(0, -1).join(', ')) }}
        onBlur={() => add(draft)}
      />
      {error && <p className="adm-field-error" role="alert">{error}</p>}
    </div>
  )
}

/**
 * The right window: one preset's details, with publishing first. Everything here edits an unsaved draft (so the admin can move to another preset and come
 * back); Save writes it, Publish sets the status to Published and writes the draft in one step.
 */
export function PresetCatalogInspector({ preset, edit, problems, changed, busy, packs, onPatch, onPublish, onAddToPack, onRemoveFromPack }: Props) {
  const [tab, setTab] = useState<InspectorTab>('info')
  const [addPack, setAddPack] = useState('')
  const record = preset.record
  const version = presetVersionInfo(record)
  const memberOf = packs.filter(pack => preset.packIds.includes(pack.id))
  const available = packs.filter(pack => !preset.packIds.includes(pack.id))
  const blocked = Object.keys(problems).length > 0
  const published = edit.status === 'published'

  return (
    <>
      <RailTabs tabs={[...TABS]} activeTab={tab} onChange={setTab} ariaLabel="Preset inspector panels" className="rv-main-workspace-tabs" variant="underline" />
      <div className="vz-panel-body pmv-inspector-body adm-inspector-body" data-selected-preset={record.sourceId}>
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group">
            {tab === 'info' && (
              <>
                <Collapsible label="Publishing">
                  <SelectRow label="Status" value={edit.status || 'unset'} onChange={value => onPatch({ status: value === 'unset' ? '' : value as PublicationStatus })} options={STATUS_OPTIONS} showOptionDescriptions disabled={busy} />
                  <div className="adm-publish">
                    <IconChipButton tone="primary" disabled={busy || blocked} onClick={onPublish}
                      icon={<AppIcon kind="upload" size={12} color="currentColor" />}>{published && !changed ? 'Published' : changed ? 'Save & Publish' : 'Publish'}</IconChipButton>
                  </div>
                </Collapsible>
                <Collapsible label="Preset Info">
                  <TextInputRow label="Name" value={edit.name} onChange={value => onPatch({ name: value })} maxLength={160} />
                  {problems.name && <p className="adm-field-error" role="alert">{problems.name}</p>}
                  <TextAreaRow label="Description" value={edit.description} onChange={value => onPatch({ description: value })} rows={4} spellCheck />
                  <TextInputRow label="Category" value={edit.category} onChange={value => onPatch({ category: value })} maxLength={80} />
                  <TextInputRow label="Engine" value={record.engineName} onChange={NOOP} readOnly maxLength={100} />
                </Collapsible>
                <Collapsible label="Tags & Collections">
                  <TagEditor tagsText={edit.tagsText} onChange={text => onPatch({ tagsText: text })} error={problems.tags} />
                  <TextInputRow label="Display Order" value={edit.orderText} onChange={value => onPatch({ orderText: value })} maxLength={7} inputMode="numeric" placeholder="Shipped order" description="Lower comes first; blank keeps the shipped order." />
                  {problems.order && <p className="adm-field-error" role="alert">{problems.order}</p>}
                  <span className="rv-ctrl-label">Packs</span>
                  {memberOf.length === 0 && <p className="adm-muted">Not in any pack.</p>}
                  <ul className="adm-chips" aria-label="Packs this preset is in">
                    {memberOf.map(pack => (
                      <li key={pack.id}><TagPill label={pack.name} removeLabel="Remove from" disabled={busy} onRemove={() => onRemoveFromPack(pack.id)} /></li>
                    ))}
                  </ul>
                  {available.length > 0 && (
                    <div className="adm-inline-actions">
                      <SelectRow label="Add to Pack" value={addPack} onChange={setAddPack} placeholder="Choose a pack" options={available.map(pack => ({ value: pack.id, label: pack.name }))} />
                      <IconChipButton disabled={busy || !addPack} onClick={() => { onAddToPack(addPack); setAddPack('') }}>Add</IconChipButton>
                    </div>
                  )}
                </Collapsible>
              </>
            )}
            {tab === 'store' && (
              <Collapsible label="Store Listing">
                <TextInputRow label="Store Title" value={edit.storeTitle} onChange={value => onPatch({ storeTitle: value })} maxLength={160} />
                <TextInputRow label="Store Subtitle" value={edit.storeSubtitle} onChange={value => onPatch({ storeSubtitle: value })} maxLength={200} />
                <TextInputRow label="Artwork Reference" value={edit.storeCover} onChange={value => onPatch({ storeCover: value })} maxLength={500} />
                <TextInputRow label="Preview Reference" value={edit.storePreview} onChange={value => onPatch({ storePreview: value })} maxLength={500} />
              </Collapsible>
            )}
            {tab === 'technical' && (
              <Collapsible label="Technical">
                <TextInputRow label="Preset ID" value={record.id} onChange={NOOP} readOnly maxLength={400} />
                <TextInputRow label="Source ID" value={record.sourceId} onChange={NOOP} readOnly maxLength={400} />
                <TextInputRow label="Activation Type" value={activationLabel(record)} onChange={NOOP} readOnly maxLength={100} />
                <TextInputRow label="Camera Support" value={record.hasCamera ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
                <TextInputRow label="User Media Integration" value={record.canIntegrateUserMedia ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
                <TextInputRow label="3D Environment" value={record.is3dEnvironment ? 'Yes' : 'No'} onChange={NOOP} readOnly maxLength={10} />
                <TextInputRow label="Version" value={version.version} onChange={NOOP} readOnly maxLength={100} />
                <TextInputRow label="Compatibility" value={version.compatibility} onChange={NOOP} readOnly maxLength={400} />
              </Collapsible>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/** A notice for the inspector's footer: what just happened, or why it did not. */
export function InspectorNotice({ notice, saved }: { notice: string | null; saved: string | null }) {
  if (notice) return <NoticeCard tone="warning" title="Not saved" role="alert">{notice}</NoticeCard>
  if (saved) return <NoticeCard tone="success" title="Saved" role="status">{saved}</NoticeCard>
  return null
}
