import { useState } from 'react'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { TagPill } from '../../../components/vyzualz/react/controls/TagPill'
import { Collapsible, SelectRow, TextAreaRow, TextInputRow, ToggleRow } from '../../../components/vyzualz/react/ReactControlRows'
import { parseTags, STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_ORDER, type AdminPreset, type CatalogPack, type EditProblems, type PresetEdit, type PublicationStatus } from './presetAdmin'
import type { ShownPreset } from './PresetCatalogCards'
import { PresetInAppCards } from './PresetCatalogSummary'
import { activationLabel, presetVersionInfo } from './presetTechnical'

const NOOP = () => undefined
/** The status dropdown's options: each status with the sentence that says what it means. The empty status (nothing recorded) is `unset`. */
const STATUS_OPTIONS = STATUS_ORDER.map(value => ({ value: value || 'unset', label: STATUS_LABELS[value || 'unset'], description: STATUS_DESCRIPTIONS[value || 'unset'] }))

interface Props {
  preset: AdminPreset
  /** The preset as users will see it with the unsaved edit applied (the In the App section). */
  shown: ShownPreset
  edit: PresetEdit
  problems: EditProblems
  busy: boolean
  packs: readonly CatalogPack[]
  onPatch: (patch: Partial<PresetEdit>) => void
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
 * The editing half of the detail panel: one preset's details, with publishing first. Everything here edits an unsaved draft (so the admin can move to another preset and come
 * back); Save writes it, Publish sets the status to Published and writes the draft in one step.
 */
export function PresetCatalogInspector({ preset, shown, edit, problems, busy, packs, onPatch, onAddToPack, onRemoveFromPack }: Props) {
  const [addPack, setAddPack] = useState('')
  const record = preset.record
  const version = presetVersionInfo(record)
  const memberOf = packs.filter(pack => preset.packIds.includes(pack.id))
  const available = packs.filter(pack => !preset.packIds.includes(pack.id))

  return (
    <div className="adm-inspector-body" data-selected-preset={record.sourceId}>
      <div className="rv-inspector">
        <div className="rv-ctrl-group">
          <Collapsible label="Publishing">
            <SelectRow label="Status" value={edit.status || 'unset'} onChange={value => onPatch({ status: value === 'unset' ? '' : value as PublicationStatus })} options={STATUS_OPTIONS} showOptionDescriptions disabled={busy} />
            <ToggleRow label="Switched Off" value={edit.disabled} onChange={value => onPatch({ disabled: value })} disabled={busy}
              description="Takes the preset out of every app, including pads, cues and saved work, within minutes of saving, whatever its status." />
            {edit.disabled && (
              <TextInputRow label="Note for Users" value={edit.disabledReason} onChange={value => onPatch({ disabledReason: value })} maxLength={280}
                placeholder="Optional, for example: being fixed for a display issue" description="Shown to anyone who tries to use the preset while it is off." />
            )}
            {problems.disabledReason && <p className="adm-field-error" role="alert">{problems.disabledReason}</p>}
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
          <Collapsible label="Store Listing">
            <TextInputRow label="Store Title" value={edit.storeTitle} onChange={value => onPatch({ storeTitle: value })} maxLength={160} />
            <TextInputRow label="Store Subtitle" value={edit.storeSubtitle} onChange={value => onPatch({ storeSubtitle: value })} maxLength={200} />
            <TextInputRow label="Artwork Reference" value={edit.storeCover} onChange={value => onPatch({ storeCover: value })} maxLength={500} />
            <TextInputRow label="Preview Reference" value={edit.storePreview} onChange={value => onPatch({ storePreview: value })} maxLength={500} />
          </Collapsible>
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
          <Collapsible label="In the App">
            <PresetInAppCards shown={shown} />
          </Collapsible>
        </div>
      </div>
    </div>
  )
}
