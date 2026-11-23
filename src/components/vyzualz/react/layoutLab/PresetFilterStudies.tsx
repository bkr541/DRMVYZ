import { useEffect, useId, useRef, useState } from 'react'
import { Dropdown } from '../../../shared/Dropdown'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../shared/InfoPopover'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { ReactPresetCard } from '../ReactPresetCard'
import { IconChipButton } from '../controls/IconChipButton'
import { IconMorphCheckbox } from '../controls/IconMorphToggle'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { TagPill } from '../controls/TagPill'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import popoverStyles from '../../../shared/InfoPopover/InfoPopover.css?inline'
import reactStyles from '../../../../styles/reactView.css?inline'
import mediaStyles from '../../../../styles/vyzualz.css?inline'
import styles from './presetFilterStudies.css?inline'

const STUDIES = [
  { id: 'chips', name: 'Quick Chips', description: 'Switch tags with one click.', icon: 'grid' },
  { id: 'dropdowns', name: 'Inline Dropdown', description: 'Choose a category and a tag from one menu.', icon: 'chevronDown' },
  { id: 'popover', name: 'Filter Popover', description: 'Choose multiple tags and apply them together.', icon: 'sliders' },
  { id: 'facets', name: 'Expandable Facets', description: 'Mix categories and tags with counts as you browse.', icon: 'list' },
  { id: 'tokens', name: 'Search Tokens', description: 'Type a category or tag directly into search.', icon: 'search' },
] as const

const CATEGORIES = ['Architecture', 'Light & Laser', 'Objects']
const TAGS = ['Laser', 'Night', 'Mechanical', 'Installation']

type Scope = 'system' | 'user'
type Facet = 'category' | 'tag'
type Filters = Record<Facet, string[]>

interface SamplePreset {
  id: string
  name: string
  category: string
  tags: readonly string[]
}

const SYSTEM_PRESETS: SamplePreset[] = [
  { id: 'afterhours', name: 'Afterhours', category: 'Light & Laser', tags: ['Laser', 'Night'] },
  { id: 'ancient-machine', name: 'Ancient Machine', category: 'Objects', tags: ['Mechanical'] },
  { id: 'atl-hoe', name: 'ATL HOE', category: 'Architecture', tags: ['Night'] },
  { id: 'atmosphere-reference', name: 'Crystalized', category: 'Objects', tags: ['Installation'] },
  { id: 'blockshift', name: 'Blockshift', category: 'Architecture', tags: ['Mechanical'] },
  { id: 'canopy', name: 'Canopy', category: 'Light & Laser', tags: ['Installation'] },
  { id: 'cathedral', name: 'Cathedral', category: 'Architecture', tags: ['Night', 'Installation'] },
  { id: 'chamber', name: 'Chamber', category: 'Architecture', tags: ['Mechanical'] },
  { id: 'constellation', name: 'Constellation', category: 'Objects', tags: ['Night'] },
  { id: 'crate-bass-sigil', name: 'Bass Sigil', category: 'Light & Laser', tags: ['Laser'] },
]

const USER_PRESETS: SamplePreset[] = [
  { ...SYSTEM_PRESETS[0]!, name: 'Opening Set' },
  { ...SYSTEM_PRESETS[4]!, name: 'Warmup Set' },
  { ...SYSTEM_PRESETS[5]!, name: 'Low Light' },
]

const EMPTY_FILTERS: Filters = { category: [], tag: [] }
const TOKEN_SUGGESTIONS = ['tag:laser', 'tag:night', 'category:architecture']
const tokenValue = (label: string) => label.toLowerCase().replaceAll(' & ', ' ').replaceAll(' ', '-')
const presetValues = (preset: SamplePreset, facet: Facet) => facet === 'category' ? [preset.category] : preset.tags
const toggleValue = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value]

const INLINE_FILTER_GROUPS = [
  { facet: 'category', group: 'Category', labels: CATEGORIES, resetLabel: 'Any category' },
  { facet: 'tag', group: 'Tag', labels: TAGS, resetLabel: 'Any tag' },
] as const
const INLINE_FILTER_OPTIONS = INLINE_FILTER_GROUPS.flatMap(({ facet, group, labels, resetLabel }) => [
  { value: `${facet}:`, label: resetLabel, group },
  ...labels.map(label => ({ value: `${facet}:${tokenValue(label)}`, label, group })),
])

function parseSearch(query: string, tokensEnabled: boolean) {
  const name: string[] = []
  const tokens: Filters = { category: [], tag: [] }
  for (const word of query.trim().toLowerCase().split(/\s+/)) {
    const token = tokensEnabled && /^(category|tag):(.+)$/.exec(word)
    if (token) tokens[token[1] as Facet].push(token[2]!)
    else name.push(word)
  }
  return { name: name.join(' '), tokens }
}

function matchesFacet(preset: SamplePreset, facet: Facet, values: string[]) {
  return values.length === 0 || presetValues(preset, facet).some(value => values.includes(tokenValue(value)))
}

function FilterOptions({ options, values, onToggle, count }: {
  options: string[]
  values: string[]
  onToggle: (value: string) => void
  count?: (value: string) => number
}) {
  return <div className="ll-pf-options">
    {options.map(label => {
      const value = tokenValue(label)
      return <label key={value}>
        <input type="checkbox" checked={values.includes(value)} onChange={() => onToggle(value)} />
        <span>{label}</span>
        {count && <span className="ll-pf-option-count" aria-hidden="true">{count(value)}</span>}
      </label>
    })}
  </div>
}

function FilterPopover({ value, onChange }: { value: string[]; onChange: (values: string[]) => void }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const firstTag = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    const ownerWindow = trigger.current?.ownerDocument.defaultView
    if (!open || !ownerWindow) return
    const frame = ownerWindow.requestAnimationFrame(() => firstTag.current?.focus())
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [open])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  return <>
    <IconChipButton
      ref={trigger}
      className="ll-pf-filter-trigger"
      tone={open ? 'primary' : 'default'}
      icon={<AppIcon kind="sliders" size={14} />}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      onClick={() => {
        setDraft(value)
        setOpen(!open)
      }}
    >Filters{value.length > 0 && <span className="ll-pf-trigger-count">{value.length}</span>}</IconChipButton>
    <InfoPopover
      id={id}
      open={open}
      anchorRef={trigger}
      title="Filter Presets"
      headerIcon={<AppIcon kind="sliders" />}
      closeLabel="Close filters"
      placement="below"
      align="end"
      width={300}
      className="ll-pf-filter-popover"
      onOpenChange={setOpen}
      sections={[{
        label: 'Tags',
        content: <div className="ll-pf-filter-options" role="group" aria-label="Preset tags">
          {TAGS.map((label, index) => {
            const tag = tokenValue(label)
            return <label key={tag}>
              <IconMorphCheckbox ref={index === 0 ? firstTag : undefined} checked={draft.includes(tag)}
                onChange={() => setDraft(current => toggleValue(current, tag))} />
              <span>{label}</span>
            </label>
          })}
        </div>,
      }]}
      footer={<>
        <IconChipButton onClick={close}>Cancel</IconChipButton>
        <IconChipButton tone="primary" onClick={() => { onChange(draft); close() }}>Apply</IconChipButton>
      </>}
    />
  </>
}

function PresetFilterPreview({ study }: { study: (typeof STUDIES)[number] }) {
  const titleId = useId()
  const [scope, setScope] = useState<Scope>('system')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState('')
  const usesTokens = study.id === 'tokens'
  const presets = scope === 'system' ? SYSTEM_PRESETS : USER_PRESETS
  const search = parseSearch(query, usesTokens)
  const active = usesTokens ? search.tokens : filters
  const filterCount = active.category.length + active.tag.length
  const namedPresets = presets.filter(preset => preset.name.toLowerCase().includes(search.name))
  const visiblePresets = namedPresets.filter(preset => (
    matchesFacet(preset, 'category', active.category) && matchesFacet(preset, 'tag', active.tag)
  ))
  const setFacet = (facet: Facet, values: string[]) => setFilters(current => ({ ...current, [facet]: values }))
  const countFor = (facet: Facet, value: string) => {
    const other = facet === 'category' ? 'tag' : 'category'
    return namedPresets.filter(preset => matchesFacet(preset, facet, [value]) && matchesFacet(preset, other, active[other])).length
  }

  return <section className="ll-pf-study" data-preset-filter-study={study.id} aria-labelledby={titleId}>
    <h2 id={titleId}><AppIcon kind={study.icon} size={14} />{study.name}</h2>
    <p className="ll-pf-description">{study.description}</p>
    <div className="ll-pf-inspector">
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-pf-workspace-tabs">
        <span className="dv-underline-tab is-active" aria-current="page">Presets</span>
        <span className="dv-underline-tab">Design</span>
        <span className="dv-underline-tab">React</span>
        <span className="dv-underline-tab">Output</span>
      </div>
      <div className="ll-pf-scroll">
        <div className="ll-pf-scope" role="group" aria-label="Preset source">
          <button type="button" aria-pressed={scope === 'system'} onClick={() => setScope('system')}>System</button>
          <button type="button" aria-pressed={scope === 'user'} onClick={() => setScope('user')}>User</button>
        </div>
        <div className="ll-pf-controls">
          <PresetSearchRow query={query} onQueryChange={setQuery} placeholder={usesTokens ? 'Search names or type tag:laser…' : undefined}
            trailing={study.id === 'popover' ? <FilterPopover value={filters.tag} onChange={values => setFacet('tag', values)} />
              : study.id === 'dropdowns' && <Dropdown
                className="ll-pf-dropdown-filter"
                size="dense"
                ariaLabel="Filters"
                menuLabel="Preset filters"
                menuBoundarySelector=".ll-pf-inspector"
                menuWidth={216}
                eyebrow={<AppIcon kind="sliders" size={14} />}
                placeholder={filterCount ? `Filters · ${filterCount}` : 'Filters'}
                value={null}
                options={INLINE_FILTER_OPTIONS}
                onChange={choice => {
                  const [field, value] = choice.split(':')
                  setFacet(field === 'category' ? 'category' : 'tag', value ? [value] : [])
                }}
              />} />
          {study.id === 'chips' && <div className="ll-pf-chips" role="group" aria-label="Quick tags">
            <IconChipButton className="ll-pf-chip" aria-pressed={!filters.tag.length} onClick={() => setFacet('tag', [])}>All</IconChipButton>
            {TAGS.map(label => {
              const value = tokenValue(label)
              return <IconChipButton className="ll-pf-chip" key={value} aria-pressed={filters.tag.includes(value)}
                onClick={() => setFacet('tag', filters.tag.includes(value) ? [] : [value])}>{label}</IconChipButton>
            })}
          </div>}
          {study.id === 'dropdowns' && filterCount > 0 && <div className="ll-pf-chips" role="group" aria-label="Applied filters">
            {INLINE_FILTER_GROUPS.map(({ facet, labels }) => {
              const label = labels.find(item => tokenValue(item) === filters[facet][0])
              return label && <TagPill key={facet} label={label} onRemove={() => setFacet(facet, [])} />
            })}
          </div>}
          {study.id === 'popover' && filters.tag.length > 0 && <div className="ll-pf-chips" aria-label="Applied tags">
            {TAGS.filter(label => filters.tag.includes(tokenValue(label))).map(label => (
              <TagPill label={label} key={label} onRemove={() => setFacet('tag', toggleValue(filters.tag, tokenValue(label)))} />
            ))}
          </div>}
          {study.id === 'facets' && <div className="ll-pf-facets">
            {([{ facet: 'category', label: 'Category', options: CATEGORIES }, { facet: 'tag', label: 'Tags', options: TAGS }] as const).map(({ facet, label, options }) => (
              <details key={facet} open={facet === 'category'}>
                <summary><span>{label} {filters[facet].length > 0 && <em>{filters[facet].length}</em>}</span><AppIcon kind="chevronDown" size={13} /></summary>
                <FilterOptions options={options} values={filters[facet]} onToggle={value => setFacet(facet, toggleValue(filters[facet], value))}
                  count={value => countFor(facet, value)} />
              </details>
            ))}
          </div>}
          {usesTokens && <div className="ll-pf-chips ll-pf-tokens" role="group" aria-label="Example search tokens">
            {TOKEN_SUGGESTIONS.map(token => {
              const words = query.trim().split(/\s+/).filter(Boolean)
              const included = words.some(word => word.toLowerCase() === token)
              return <IconChipButton className="ll-pf-chip" key={token} aria-pressed={included}
                onClick={() => setQuery((included ? words.filter(word => word.toLowerCase() !== token) : [...words, token]).join(' '))}>{token}</IconChipButton>
            })}
          </div>}
        </div>
        <div className="ll-pf-results-bar">
          <span role="status">{visiblePresets.length} {visiblePresets.length === 1 ? 'preset' : 'presets'}</span>
          {filterCount > 0 && <button type="button" onClick={() => {
            if (usesTokens) setQuery(search.name)
            else setFilters(EMPTY_FILTERS)
          }}>Clear filters</button>}
        </div>
        {visiblePresets.length > 0 ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {visiblePresets.map(preset => <ReactPresetCard key={preset.id} id={`drmvyz.cinema2.${preset.id}`}
            title={preset.name} description={preset.category} activateLabel={`Select ${preset.name}`}
            isActive={selected === `${scope}:${preset.id}`} onActivate={() => setSelected(`${scope}:${preset.id}`)} />)}
        </div> : <p className="ll-pf-empty">No presets match.</p>}
      </div>
    </div>
  </section>
}

export function PresetFilterStudies() {
  return <div className="ll-pf-studies" aria-label="Preset Filter studies">
    <style>{`@scope (.ll-pf-studies) { ${railStyles}\n${mediaStyles}\n${reactStyles} }\n${popoverStyles}\n${dropdownStyles}\n${styles}`}</style>
    {STUDIES.map(study => <PresetFilterPreview key={study.id} study={study} />)}
  </div>
}
