import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type Ref } from 'react'
import { Dropdown } from '../../../shared/Dropdown'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../shared/InfoPopover'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { ReactPresetCard } from '../ReactPresetCard'
import { IconChipButton } from '../controls/IconChipButton'
import { IconMorphCheckbox } from '../controls/IconMorphToggle'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { TagPill } from '../controls/TagPill'
import {
  DEFAULT_FILTERS, FILTER_GROUPS, QUICK_TAGS, SAMPLE_PRESETS, TOKEN_SUGGESTIONS,
  matchesPreset, parseSearch, toggleValue, tokenValue, type Facet, type Filters,
} from './presetFilterStudyData'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import popoverStyles from '../../../shared/InfoPopover/InfoPopover.css?inline'
import reactStyles from '../../../../styles/reactView.css?inline'
import mediaStyles from '../../../../styles/vyzualz.css?inline'
import styles from './presetFilterStudies.css?inline'

const STUDIES = [
  { id: 'chips', name: 'Quick Chips', description: 'Switch tags with one click.', icon: 'grid' },
  { id: 'dropdowns', name: 'Inline Dropdown', description: 'Choose one value per group from the shared dropdown.', icon: 'chevronDown' },
  { id: 'popover', name: 'Filter Popover', description: 'Combine criteria and apply them together.', icon: 'sliders' },
  { id: 'facets', name: 'Expandable Facets', description: 'Browse categories and tags with live result counts.', icon: 'list' },
  { id: 'tokens', name: 'Search Tokens', description: 'Type criteria directly into search.', icon: 'search' },
] as const

type FilterGroup = typeof FILTER_GROUPS[number]

const anyLabel = (group: FilterGroup) => 'any' in group ? group.any : `Any ${group.label.toLowerCase()}`
const FILTER_OPTIONS = FILTER_GROUPS.flatMap(group => [
  { value: `${group.id}:`, label: anyLabel(group), group: group.label },
  ...group.options.map(label => ({ value: `${group.id}:${tokenValue(label)}`, label, group: group.label })),
])
const INLINE_FACETS = FILTER_GROUPS.filter(group => group.id === 'category' || group.id === 'tag')

function FilterGroups({ groups = FILTER_GROUPS, filters, onChange, first, count }: {
  groups?: readonly FilterGroup[]
  filters: Filters
  onChange: (facet: Facet, values: string[]) => void
  first?: Ref<HTMLElement>
  count?: (facet: Facet, values: string[]) => number
}) {
  const radioGroup = useId()
  return <div className="ll-pf-facets">
    {groups.map((group, index) => {
      const { id, label, options } = group
      const values = filters[id] ?? []
      const single = 'single' in group
      const baseline = DEFAULT_FILTERS[id] ?? []
      const changed = values.length !== baseline.length || !baseline.every(value => values.includes(value))
      return <details key={id}>
        <summary ref={index === 0 ? first : undefined}>
          <span>{label}{changed && <em>{values.length || anyLabel(group)}</em>}</span>
          <AppIcon kind="chevronDown" size={13} />
        </summary>
        <div className="ll-pf-options" role="group" aria-label={label}>
          {(single ? ['', ...options] : options).map(option => {
            const value = tokenValue(option)
            const next = value === '' ? [] : single ? [value] : toggleValue(values, value)
            return <label key={option}>
              {single ? <input type="radio" name={`${radioGroup}-${id}`} checked={value ? values.includes(value) : values.length === 0}
                onChange={() => onChange(id, next)} />
                : <IconMorphCheckbox checked={values.includes(value)} onChange={() => onChange(id, next)} />}
              <span>{option || anyLabel(group)}</span>
              {count && <span className="ll-pf-option-count" aria-hidden="true">{count(id, next)}</span>}
            </label>
          })}
        </div>
      </details>
    })}
  </div>
}

function appliedFilters(filters: Filters) {
  return FILTER_GROUPS.flatMap(group => {
    const selected = filters[group.id] ?? []
    const baseline = DEFAULT_FILTERS[group.id] ?? []
    if (selected.length === baseline.length && baseline.every(value => selected.includes(value))) return []
    if (selected.length === 0) return [{ id: group.id, value: '', label: anyLabel(group) }]
    return group.options.flatMap(label => {
      const value = tokenValue(label)
      return selected.includes(value) ? [{ id: group.id, value, label }] : []
    })
  })
}

function renderFiltersButton(props: ComponentPropsWithRef<'button'>, count: number) {
  return <IconChipButton
    {...props}
    className="ll-pf-filter-trigger"
    tone={props['aria-expanded'] ? 'primary' : 'default'}
    icon={<AppIcon kind="sliders" size={14} />}
  >Filters{count > 0 && <span className="ll-pf-trigger-count">{count}</span>}</IconChipButton>
}

function FilterPopover({ value, onChange }: { value: Filters; onChange: (filters: Filters) => void }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    const ownerWindow = trigger.current?.ownerDocument.defaultView
    if (!open || !ownerWindow) return
    const frame = ownerWindow.requestAnimationFrame(() => first.current?.focus())
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [open])

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  return <>
    {renderFiltersButton({
      ref: trigger,
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-controls': open ? id : undefined,
      onClick: () => {
        setDraft(value)
        setOpen(!open)
      },
    }, appliedFilters(value).length)}
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
      footer={<>
        <IconChipButton onClick={() => setDraft(DEFAULT_FILTERS)}>Reset</IconChipButton>
        <IconChipButton onClick={close}>Cancel</IconChipButton>
        <IconChipButton tone="primary" onClick={() => { onChange(draft); close() }}>Apply</IconChipButton>
      </>}
    >
      <FilterGroups filters={draft} first={first}
        onChange={(facet, values) => setDraft(current => ({ ...current, [facet]: values }))} />
    </InfoPopover>
  </>
}

function PresetFilterPreview({ study }: { study: (typeof STUDIES)[number] }) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState('')
  const usesTokens = study.id === 'tokens'
  const search = parseSearch(query, usesTokens)
  const active = usesTokens ? { ...DEFAULT_FILTERS, ...search.filters } : filters
  const applied = appliedFilters(active)
  const visiblePresets = SAMPLE_PRESETS.filter(preset => matchesPreset(preset, search.text, active))
  const setFacet = (facet: Facet, values: string[]) => {
    if (usesTokens) {
      const words = query.trim().split(/\s+/).filter(word => word && !word.toLowerCase().startsWith(`${facet}:`))
      const selection = values.length > 0 ? values : ['any']
      setQuery([...words, ...selection.map(value => `${facet}:${value}`)].join(' '))
    } else {
      setFilters(current => ({ ...current, [facet]: values }))
    }
  }
  const countFor = (facet: Facet, values: string[]) =>
    SAMPLE_PRESETS.filter(preset => matchesPreset(preset, search.text, { ...active, [facet]: values })).length

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
          {['System', 'User', 'All'].map(label => {
            const source = label === 'All' ? '' : tokenValue(label)
            return <button type="button" key={label} aria-pressed={(active.source?.[0] ?? '') === source}
              onClick={() => setFacet('source', source ? [source] : [])}>{label}</button>
          })}
        </div>
        <div className="ll-pf-controls">
          <PresetSearchRow query={query} onQueryChange={setQuery}
            placeholder={usesTokens ? 'Search or type tag:laser…' : 'Search preset metadata…'}
            trailing={study.id === 'popover' ? <FilterPopover value={filters} onChange={setFilters} />
              : study.id === 'dropdowns' && <Dropdown
                className="ll-pf-dropdown-filter"
                size="dense"
                ariaLabel="Filters"
                menuLabel="Preset filters"
                menuAlign="end"
                menuWidth={250}
                menuSearch
                menuSearchPlaceholder="Find a filter option…"
                renderTrigger={props => renderFiltersButton(props, applied.length)}
                value={null}
                options={FILTER_OPTIONS}
                onChange={choice => {
                  const [field, value] = choice.split(':')
                  setFacet(field as Facet, value ? [value] : [])
                }}
              />} />
          {study.id === 'chips' && <div className="ll-pf-chips" role="group" aria-label="Quick tags">
            <IconChipButton className="ll-pf-chip" aria-pressed={!filters.tag?.length} onClick={() => setFacet('tag', [])}>All tags</IconChipButton>
            {QUICK_TAGS.map(label => {
              const value = tokenValue(label)
              const checked = filters.tag?.includes(value) ?? false
              return <IconChipButton className="ll-pf-chip" key={value} aria-pressed={checked}
                onClick={() => setFacet('tag', checked ? [] : [value])}>{label}</IconChipButton>
            })}
          </div>}
          {(study.id === 'dropdowns' || study.id === 'popover') && applied.length > 0 &&
            <div className="ll-pf-chips" role="group" aria-label="Applied filters">
              {applied.map(({ id, value, label }) => (
                <TagPill key={`${id}:${value}`} label={label} onRemove={() => {
                  const remaining = (filters[id] ?? []).filter(item => item !== value)
                  setFacet(id, remaining.length ? remaining : DEFAULT_FILTERS[id] ?? [])
                }} />
              ))}
            </div>}
          {study.id === 'facets' && <FilterGroups groups={INLINE_FACETS} filters={active} onChange={setFacet} count={countFor} />}
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
          {applied.length > 0 && <button type="button" onClick={() => {
            if (usesTokens) setQuery(search.text)
            else setFilters(DEFAULT_FILTERS)
          }}>Clear filters</button>}
        </div>
        {visiblePresets.length > 0 ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {visiblePresets.map(preset => <ReactPresetCard key={preset.id} id={preset.artworkId}
            title={preset.name} description={preset.description} activateLabel={`Select ${preset.name}`}
            isActive={selected === preset.id} onActivate={() => setSelected(preset.id)} />)}
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
