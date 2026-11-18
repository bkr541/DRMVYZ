import { useCallback, useEffect, useMemo, useState } from 'react'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { UnderlineTabs } from '../../../components/vyzualz/react/controls/UnderlineTabs'
import { PRESET_MANAGER_PRESETS } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import { buildAdminPresets, recordKey, type AdminPreset, type CatalogPack, type PackMember } from './presetAdmin'
import { PackPane } from './PackPane'
import { PresetCatalogPane } from './PresetCatalogPane'
import { addPackMember, createPack, deletePack, loadPackMembers, loadPacks, loadPresetMetadata, movePackMember, removePackMember, savePresetMetadata, updatePack } from './presetsApi'

type Section = 'presets' | 'packs'

/**
 * Preset Catalog Manager: the presets the app ships, across every engine, with their metadata and the packs they are in. It edits existing presets and
 * packs only; nothing here uploads, downloads or distributes a preset file.
 */
export function PresetsTab() {
  const [section, setSection] = useState<Section>('presets')
  const [rows, setRows] = useState<readonly PresetMetadataRow[]>([])
  const [packs, setPacks] = useState<readonly CatalogPack[]>([])
  const [members, setMembers] = useState<readonly PackMember[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setStatus('loading'); setError(null)
    Promise.all([loadPresetMetadata(), loadPacks(), loadPackMembers()])
      .then(([metadata, packRows, memberRows]) => { setRows(metadata); setPacks(packRows); setMembers(memberRows); setStatus('ready') })
      .catch((reason: Error) => { setError(reason.message); setStatus('error') })
  }, [])
  useEffect(load, [load])

  const presets = useMemo(() => buildAdminPresets(PRESET_MANAGER_PRESETS, rows, members), [rows, members])

  const nextPosition = (packId: string) => members.filter(member => member.pack_id === packId).reduce((max, member) => Math.max(max, member.position), 0) + 1
  const handlers = {
    onSave: async (preset: AdminPreset, row: PresetMetadataRow | null) => {
      const key = recordKey(preset.record)
      setRows(await savePresetMetadata(key.engine_id, key.preset_key, row, rows))
    },
    onAddToPack: async (preset: AdminPreset, packId: string) => {
      const key = recordKey(preset.record)
      const added = await addPackMember({ pack_id: packId, ...key, position: nextPosition(packId) })
      setMembers(current => [...current, added])
    },
    onRemoveFromPack: async (preset: AdminPreset, packId: string) => {
      const key = recordKey(preset.record)
      await removePackMember(packId, key.engine_id, key.preset_key)
      setMembers(current => current.filter(member => !(member.pack_id === packId && member.engine_id === key.engine_id && member.preset_key === key.preset_key)))
    },
  }
  const packHandlers = {
    onCreate: async (name: string) => {
      const created = await createPack(name, packs.reduce((max, pack) => Math.max(max, pack.display_order), 0) + 1)
      setPacks(current => [...current, created])
      return created
    },
    onUpdate: async (id: string, patch: Partial<Pick<CatalogPack, 'name' | 'description' | 'display_order'>>) => {
      const saved = await updatePack(id, patch)
      setPacks(current => current.map(pack => (pack.id === id ? saved : pack)))
    },
    onDelete: async (id: string) => {
      await deletePack(id)
      setPacks(current => current.filter(pack => pack.id !== id))
      setMembers(current => current.filter(member => member.pack_id !== id))
    },
    onAddMember: (packId: string, preset: AdminPreset) => handlers.onAddToPack(preset, packId),
    onRemoveMember: (packId: string, preset: AdminPreset) => handlers.onRemoveFromPack(preset, packId),
    onMoveMember: async (packId: string, preset: AdminPreset, direction: -1 | 1) => {
      const key = recordKey(preset.record)
      const ordered = members.filter(member => member.pack_id === packId).sort((a, b) => a.position - b.position)
      const index = ordered.findIndex(member => member.engine_id === key.engine_id && member.preset_key === key.preset_key)
      const other = ordered[index + direction]
      if (index < 0 || !other) return
      const mine = ordered[index]!
      // Swap the two positions (they are unique per pack by construction: new members take the next one).
      await Promise.all([movePackMember(packId, mine.engine_id, mine.preset_key, other.position), movePackMember(packId, other.engine_id, other.preset_key, mine.position)])
      setMembers(current => current.map(member => (member.pack_id !== packId ? member
        : member === mine ? { ...member, position: other.position } : member === other ? { ...member, position: mine.position } : member)))
    },
  }

  return (
    <div className="adm-presets">
      <UnderlineTabs ariaLabel="Preset catalog sections" activeTab={section} onChange={setSection} tabs={[{ id: 'presets', label: 'Presets' }, { id: 'packs', label: 'Packs' }]} className="adm-subtabs" />
      {status === 'error' && <NoticeCard tone="warning" title="The catalog could not be loaded" role="alert">{error} <button type="button" className="adm-link" onClick={load}>Try again</button></NoticeCard>}
      {status === 'loading' && <p className="adm-empty" role="status">Loading the catalog…</p>}
      {status === 'ready' && (section === 'presets'
        ? <PresetCatalogPane presets={presets} packs={packs} {...handlers} />
        : <PackPane presets={presets} packs={packs} members={members} {...packHandlers} />)}
    </div>
  )
}
