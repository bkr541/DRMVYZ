import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'

export type PublicationStatus = NonNullable<PresetMetadataRow['publication_status']>

export interface CatalogPack { id: string; name: string; description: string | null; subtitle?: string | null; thumbnail_path?: string | null; display_order: number; created_at?: string; updated_at?: string }
export type CatalogPackEdit = Partial<Pick<CatalogPack, 'name' | 'description' | 'subtitle' | 'display_order'>>
export interface PackMember { pack_id: string; engine_id: string; preset_key: string; position: number }

/** A shipped preset with what the admin has changed. `row` is null while nothing is overridden. */
export interface AdminPreset {
  record: PresetManagerRecord
  row: PresetMetadataRow | null
  name: string
  description: string
  category: string
  tags: readonly string[]
  order: number | null
  status: PublicationStatus | null
  /** The emergency off switch is on: no user can see or use the preset, whatever its status. */
  disabled: boolean
  packIds: readonly string[]
}

/** `engine_id` and `preset_key` are a record's source and source id; the id is the two joined. */
export const recordKey = (record: Pick<PresetManagerRecord, 'artwork' | 'sourceId'>) => ({ engine_id: record.artwork, preset_key: record.sourceId })

export function buildAdminPresets(records: readonly PresetManagerRecord[], rows: readonly PresetMetadataRow[], members: readonly PackMember[]): AdminPreset[] {
  const byKey = new Map(rows.map(row => [`${row.engine_id}:${row.preset_key}`, row]))
  const packsByKey = new Map<string, string[]>()
  for (const member of members) packsByKey.set(`${member.engine_id}:${member.preset_key}`, [...(packsByKey.get(`${member.engine_id}:${member.preset_key}`) ?? []), member.pack_id])
  return records.map(record => {
    const row = byKey.get(record.id) ?? null
    return {
      record, row,
      name: row?.name ?? record.name, description: row?.description ?? record.description, category: row?.category ?? record.category, tags: row?.tags ?? record.tags,
      order: row?.display_order ?? null, status: row?.publication_status ?? null, disabled: row?.disabled === true, packIds: packsByKey.get(record.id) ?? [],
    }
  })
}

export interface PresetFilter { query: string; engine: string; category: string; packId: string; status: string }
export const ALL = 'all'
export const NO_PACK = 'none'
/** The status filter value for presets whose off switch is on. */
export const SWITCHED_OFF = 'off'

export function filterAdminPresets(presets: readonly AdminPreset[], filter: PresetFilter): AdminPreset[] {
  const query = filter.query.trim().toLowerCase()
  return presets.filter(preset => {
    if (filter.engine !== ALL && preset.record.engineName !== filter.engine) return false
    if (filter.category !== ALL && preset.category !== filter.category) return false
    if (filter.packId === NO_PACK ? preset.packIds.length > 0 : filter.packId !== ALL && !preset.packIds.includes(filter.packId)) return false
    if (filter.status === SWITCHED_OFF ? !preset.disabled : filter.status !== ALL && (preset.status ?? 'unset') !== filter.status) return false
    return !query || [preset.name, preset.description, preset.record.id, preset.record.sourceId, preset.record.engineName, preset.category, ...preset.tags].some(value => value.toLowerCase().includes(query))
  })
}

export type PresetSortKey = 'name' | 'engine' | 'category' | 'order'
export function sortAdminPresets(presets: readonly AdminPreset[], key: PresetSortKey): AdminPreset[] {
  const original = new Map(presets.map((preset, index) => [preset, index]))
  const compare: Record<PresetSortKey, (a: AdminPreset, b: AdminPreset) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    engine: (a, b) => a.record.engineName.localeCompare(b.record.engineName) || a.name.localeCompare(b.name),
    category: (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    // The order the app uses (see applyPresetMetadata): unset counts as 0, ties keep the shipped order.
    order: (a, b) => (a.order ?? 0) - (b.order ?? 0),
  }
  return [...presets].sort((a, b) => compare[key](a, b) || original.get(a)! - original.get(b)!)
}

export interface PresetGroup { id: string; label: string; presets: AdminPreset[] }

export function groupByEngine(presets: readonly AdminPreset[]): PresetGroup[] {
  const groups = new Map<string, PresetGroup>()
  for (const preset of presets) {
    const label = preset.record.engineName
    if (!groups.has(label)) groups.set(label, { id: label, label, presets: [] })
    groups.get(label)!.presets.push(preset)
  }
  return [...groups.values()]
}

/** One group per pack (in pack order, empty packs included) and a last one for presets in no pack. A preset in two packs appears in both. */
export function groupByPack(presets: readonly AdminPreset[], packs: readonly CatalogPack[]): PresetGroup[] {
  const ordered = [...packs].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
  const groups: PresetGroup[] = ordered.map(pack => ({ id: pack.id, label: pack.name, presets: presets.filter(preset => preset.packIds.includes(pack.id)) }))
  const loose = presets.filter(preset => preset.packIds.length === 0)
  if (loose.length > 0) groups.push({ id: NO_PACK, label: 'No pack', presets: loose })
  return groups
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map(tag => tag.trim()).filter(Boolean))]
}

export interface PresetEdit {
  name: string; description: string; category: string; tagsText: string; orderText: string; status: PublicationStatus | ''
  storeTitle: string; storeSubtitle: string; storeCover: string; storePreview: string
  /** The emergency off switch, and the note users see while it is on. */
  disabled: boolean; disabledReason: string
}

export function editFromPreset(preset: AdminPreset): PresetEdit {
  return {
    name: preset.name, description: preset.description, category: preset.category, tagsText: preset.tags.join(', '), orderText: preset.order === null ? '' : String(preset.order),
    status: preset.status ?? '', storeTitle: preset.row?.store_title ?? '', storeSubtitle: preset.row?.store_subtitle ?? '', storeCover: preset.row?.store_cover_ref ?? '', storePreview: preset.row?.store_preview_ref ?? '',
    disabled: preset.row?.disabled === true, disabledReason: preset.row?.disabled_reason ?? '',
  }
}

export interface EditProblems { name?: string; order?: string; tags?: string; storeTitle?: string; disabledReason?: string }

export function validateEdit(edit: PresetEdit): EditProblems {
  const problems: EditProblems = {}
  if (!edit.name.trim()) problems.name = 'A preset needs a name.'
  else if (edit.name.trim().length > 160) problems.name = 'At most 160 characters.'
  if (edit.orderText.trim() && !/^-?\d{1,6}$/.test(edit.orderText.trim())) problems.order = 'Use a whole number.'
  else if (edit.orderText.trim() && Math.abs(Number(edit.orderText)) > 100000) problems.order = 'Between -100,000 and 100,000.'
  const tags = parseTags(edit.tagsText)
  if (tags.length > 32) problems.tags = 'At most 32 tags.'
  else if (tags.some(tag => tag.length > 40)) problems.tags = 'Each tag can be at most 40 characters.'
  if (edit.disabledReason.trim().length > 280) problems.disabledReason = 'At most 280 characters.'
  return problems
}

/**
 * The row to store for an edit: each column holds only what differs from what the app ships (NULL = keep the shipped value), and the store fields are
 * stored as typed. Null when nothing differs, which means the row should not exist.
 */
export function rowFromEdit(record: PresetManagerRecord, edit: PresetEdit): PresetMetadataRow | null {
  const differs = (value: string, shipped: string) => (value.trim() === shipped.trim() ? null : value.trim())
  const tags = parseTags(edit.tagsText)
  const shippedTags = [...record.tags]
  const sameTags = tags.length === shippedTags.length && tags.every((tag, index) => tag === shippedTags[index])
  const blank = (value: string) => value.trim() || null
  const row: PresetMetadataRow = {
    ...recordKey(record),
    name: differs(edit.name, record.name), description: differs(edit.description, record.description), category: differs(edit.category, record.category),
    tags: sameTags ? null : tags, display_order: edit.orderText.trim() ? Number(edit.orderText) : null, publication_status: edit.status || null,
    store_title: blank(edit.storeTitle), store_subtitle: blank(edit.storeSubtitle), store_cover_ref: blank(edit.storeCover), store_preview_ref: blank(edit.storePreview),
    disabled: edit.disabled, disabled_reason: edit.disabled ? blank(edit.disabledReason) : null,
  }
  const { engine_id: _engine, preset_key: _key, updated_at: _at, disabled: _disabled, ...columns } = row
  void _engine; void _key; void _at
  // The off switch defaults to off (false), which, like a NULL, changes nothing.
  return !_disabled && Object.values(columns).every(value => value === null) ? null : row
}

export const STATUS_LABELS: Readonly<Record<PublicationStatus | 'unset', string>> = { unset: 'Not set', designing: 'Designing', draft: 'Draft', published: 'Published', archived: 'Archived' }

/** One sentence on what each status means, shown under it in the status dropdown. */
export const STATUS_DESCRIPTIONS: Readonly<Record<PublicationStatus | 'unset', string>> = {
  unset: 'No status is recorded, so the preset is available to everyone as it ships.',
  designing: 'Still being designed, so only admins can see and use it.',
  draft: 'Ready to review but not released, so only admins can see and use it.',
  published: 'Released and available to everyone.',
  archived: 'Retired and hidden from everyone, with its saved details kept.',
}

/** The statuses in the order they are offered: from nothing recorded, through the work, to done. */
export const STATUS_ORDER: readonly (PublicationStatus | '')[] = ['', 'designing', 'draft', 'published', 'archived']

export type StatusCounts = Record<PublicationStatus | 'unset' | 'all' | typeof SWITCHED_OFF, number>

/** How many presets are in each status, for the status dropdown. The counts follow the other filters, so each option says what selecting it will show. */
export function statusCounts(presets: readonly AdminPreset[]): StatusCounts {
  const counts: StatusCounts = { all: presets.length, unset: 0, designing: 0, draft: 0, published: 0, archived: 0, off: 0 }
  for (const preset of presets) {
    counts[preset.status ?? 'unset'] += 1
    if (preset.disabled) counts.off += 1
  }
  return counts
}

const editKey = (edit: PresetEdit) => JSON.stringify([edit.name.trim(), edit.description.trim(), edit.category.trim(), parseTags(edit.tagsText), edit.orderText.trim(), edit.status,
  edit.storeTitle.trim(), edit.storeSubtitle.trim(), edit.storeCover.trim(), edit.storePreview.trim(), edit.disabled, edit.disabled ? edit.disabledReason.trim() : ''])

/** True when a draft differs from what is stored. Whitespace and tag spacing do not count. */
export const isEditChanged = (preset: AdminPreset, edit: PresetEdit | undefined): boolean => edit !== undefined && editKey(edit) !== editKey(editFromPreset(preset))

/** The edit to show for a preset: the admin's unsaved draft if there is one, else what is stored. */
export const currentEdit = (preset: AdminPreset, drafts: Readonly<Record<string, PresetEdit>>): PresetEdit => drafts[preset.record.id] ?? editFromPreset(preset)

/** The row that saves `status` for a preset, keeping any unsaved draft of its other fields. Null means the preset would carry no changes at all. */
export function rowWithStatus(preset: AdminPreset, status: PublicationStatus | '', draft?: PresetEdit): PresetMetadataRow | null {
  return rowFromEdit(preset.record, { ...(draft ?? editFromPreset(preset)), status })
}

/** The status a set of presets all share, or 'mixed'. */
export function sharedStatus(presets: readonly AdminPreset[]): PublicationStatus | 'unset' | 'mixed' {
  const statuses = new Set(presets.map(preset => preset.status ?? 'unset'))
  return statuses.size === 1 ? [...statuses][0]! : 'mixed'
}
