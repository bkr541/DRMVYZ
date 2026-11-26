import { useId, useMemo, useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { usePresetScopeFilter } from '../../../../features/presetCatalog/presetCatalogStore'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'
import { ReactPresetCard } from '../ReactPresetCard'
import { readReactPresetFavorites } from '../reactPresetLibraryState'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { TagPill } from '../controls/TagPill'
import { IconChipButton } from '../controls/IconChipButton'
import {
  appliedFilters, DEFAULT_FILTERS, getFilterGroups, getStudyMatchParts, matchesPreset,
  searchStudyPresets, toggleValue, type Facet, type FilterPreset, type Filters, type StudySearchField,
} from './presetFilterStudyData'

const studies = [
  { id: 'facet-ribbon', title: 'Facet Ribbon', icon: 'sliders', description: 'Quick-access categories and favorites, always in reach.' },
  { id: 'field-search', title: 'Field Search', icon: 'search', description: 'Choose exactly which metadata field to search.' },
  { id: 'facet-navigator', title: 'Facet Navigator', icon: 'layers', description: 'Browse filter groups and values in a two-column panel.' },
  { id: 'rule-builder', title: 'Rule Builder', icon: 'sliders', description: 'Compose precise filters with explicit field and value rules.' },
  { id: 'match-index', title: 'Match Index', icon: 'search', description: 'Discover matching metadata values with live result counts.' },
] as const

type Study = typeof studies[number]
const fields: { id: StudySearchField; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'name', label: 'Name' }, { id: 'category', label: 'Category' },
  { id: 'tag', label: 'Tags' }, { id: 'collection', label: 'Collections' },
]
const browseFacets: Facet[] = ['category', 'tag', 'collection', 'favorite', 'name']

function MatchText({ value, query }: { value: string; query: string }) {
  return <>{getStudyMatchParts(value, query).map((part, index) => part.matched
    ? <mark className="ll-pf-smart-highlight" key={index}>{part.text}</mark>
    : <span key={index}>{part.text}</span>)}</>
}

function AlternativePreview({ study, records }: { study: Study; records: readonly FilterPreset[] }) {
  const titleId = useId()
  const [scope, setScope] = useState<PresetScopeTab>('system')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(readReactPresetFavorites)
  const [field, setField] = useState<StudySearchField>('all')
  const [facet, setFacet] = useState<Facet>(study.id === 'match-index' ? 'tag' : 'category')
  const [value, setValue] = useState('')
  const [optionQuery, setOptionQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)
  const inScope = usePresetScopeFilter('cinema2', scope)
  const scoped = useMemo(() => records.filter(preset => inScope(preset.artworkId))
    .map(preset => ({ ...preset, favorite: favoriteIds.includes(preset.artworkId) })), [records, inScope, favoriteIds])
  const groups = useMemo(() => getFilterGroups(scoped), [scoped])
  const active = useMemo(() => Object.fromEntries(groups.map(group => [group.id,
    (filters[group.id] ?? []).filter(item => group.options.some(option => option.value === item))])) as Filters, [groups, filters])
  const searched = useMemo(() => searchStudyPresets(scoped, query, study.id === 'field-search' ? field : 'all'), [scoped, query, field, study.id])
  const results = useMemo(() => searched.filter(preset => matchesPreset(preset, '', active)), [searched, active])
  const applied = appliedFilters(groups, active)
  const group = groups.find(item => item.id === facet)!
  const categories = groups.find(item => item.id === 'category')!.options
  const changeFacet = (next: Facet) => { setFacet(next); setValue(''); setOptionQuery('') }
  const toggle = (id: Facet, item: string) => setFilters(current => ({ ...current,
    [id]: id === 'favorite' ? (current[id]?.includes(item) ? [] : [item]) : toggleValue(current[id] ?? [], item),
  }))
  const reset = () => { setFilters(DEFAULT_FILTERS); setQuery(''); setValue(''); setOptionQuery(''); setField('all') }
  const count = (id: Facet, item: string) => searched.filter(preset => matchesPreset(preset, '', { ...active, [id]: [item] })).length
  const availableRules = group.options.filter(option => !active[facet]?.includes(option.value))
  const ruleValue = availableRules.some(option => option.value === value) ? value : ''
  // Index values are derived from the matching records, not invented suggestions. Each
  // row represents an exact facet value; count is conditional on the other active facets.
  const indexGroups = groups.filter(item => item.id === 'category' || item.id === 'tag' || item.id === 'collection')
  const indexRows = study.id !== 'match-index' ? [] : indexGroups.find(item => item.id === facet)?.options.map(option => ({ ...option, count: count(facet, option.value) }))
    .filter(option => option.count > 0 || active[facet]?.includes(option.value))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) ?? []

  return <section className="ll-pf-study ll-pf-alternative" data-preset-filter-study={study.id} aria-labelledby={titleId}>
    <h2 id={titleId}><AppIcon kind={study.icon} size={14} />{study.title}</h2>
    <p className="ll-pf-description">Cinema 2.0 · {study.description}</p>
    <div className="ll-pf-inspector">
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-pf-workspace-tabs">
        <span className="dv-underline-tab is-active" aria-current="page">Presets</span>
        <span className="dv-underline-tab">Design</span><span className="dv-underline-tab">React</span><span className="dv-underline-tab">Output</span>
      </div>
      <div className="ll-pf-scroll">
        <div className="ll-pf-controls">
          <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel={`${study.title} search`}
            placeholder={study.id === 'field-search' && field !== 'all' ? `Search ${fields.find(item => item.id === field)!.label.toLowerCase()}…` : 'Search presets…'}
            trailing={<div className="vz-md-view-toggles"><div className="vz-header-group dv-library-view-toggle" data-preset-scope={scope} role="group" aria-label={`Preset scope: ${scope === 'system' ? 'System' : 'User'}`}>
              <HeaderIconKey label={scope === 'system' ? 'User presets' : 'System presets'}
                icon={<AppIcon kind={scope === 'system' ? 'user' : 'layers'} size={12} viewBox={scope === 'system' ? '6 2 20 28' : '2 2 28 28'} color="currentColor" />}
                onClick={() => { setScope(scope === 'system' ? 'user' : 'system'); setSelected(''); setFilters(DEFAULT_FILTERS); setValue(''); setOptionQuery('') }} />
            </div></div>} />

          {study.id === 'facet-ribbon' && <div className="ll-pfa-ribbon">
            <div className="ll-pfa-ribbon-heading"><span>Category</span><button type="button" className="ll-pfa-favorite" aria-pressed={active.favorite?.includes('yes') ?? false} onClick={() => toggle('favorite', 'yes')}><AppIcon kind="star" size={12} />Favorites</button></div>
            <div className="ll-pfa-ribbon-track" role="group" aria-label="Categories">
              <button type="button" aria-pressed={!active.category?.length} onClick={() => setFilters(current => ({ ...current, category: [] }))}>All</button>
              {categories.map(option => <button type="button" key={option.value} aria-pressed={active.category?.includes(option.value) ?? false} onClick={() => toggle('category', option.value)}>{option.label}</button>)}
            </div>
          </div>}

          {study.id === 'field-search' && <div className="ll-pfa-field-tabs" role="group" aria-label="Search field">
            {fields.map(item => <button type="button" key={item.id} aria-pressed={field === item.id} onClick={() => setField(item.id)}>{item.label}</button>)}
          </div>}

          {study.id === 'facet-navigator' && <div className="ll-pfa-navigator">
            <button type="button" className="ll-pfa-panel-heading" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><AppIcon kind="sliders" size={13} /><span>Browse filters</span><span className="ll-pfa-count">{applied.length || ''}</span><AppIcon kind="chevronDown" size={12} /></button>
            {panelOpen && <div className="ll-pfa-navigator-body">
              <div className="ll-pfa-navigator-rail" role="group" aria-label="Filter groups">
                {browseFacets.map(id => <button type="button" key={id} aria-pressed={facet === id} onClick={() => changeFacet(id)}><span>{groups.find(item => item.id === id)!.label}</span>{Boolean(active[id]?.length) && <small>{active[id]!.length}</small>}</button>)}
              </div>
              <div className="ll-pfa-navigator-values">
                <input className="ll-pfa-input" aria-label="Find filter values" placeholder="Find values…" value={optionQuery} onChange={event => setOptionQuery(event.target.value)} />
                <div className="ll-pfa-value-list" role="group" aria-label={group.label}>
                  {group.options.filter(option => option.label.toLowerCase().includes(optionQuery.trim().toLowerCase())).map(option => <label key={option.value}>
                    <input type="checkbox" checked={active[facet]?.includes(option.value) ?? false} onChange={() => toggle(facet, option.value)} /><span>{option.label}</span><small>{count(facet, option.value)}</small>
                  </label>)}
                  {!group.options.some(option => option.label.toLowerCase().includes(optionQuery.trim().toLowerCase())) && <span className="ll-pfa-muted">No values</span>}
                </div>
              </div>
            </div>}
          </div>}

          {study.id === 'rule-builder' && <div className="ll-pfa-builder">
            <div className="ll-pfa-builder-heading"><span>Filter rules</span><small>Match all groups</small></div>
            <div className="ll-pfa-builder-row">
              <select className="ll-pfa-input" aria-label="Rule field" value={facet} onChange={event => changeFacet(event.target.value as Facet)}>{browseFacets.map(id => <option value={id} key={id}>{groups.find(item => item.id === id)!.label}</option>)}</select>
              <select className="ll-pfa-input" aria-label="Rule value" value={ruleValue} onChange={event => setValue(event.target.value)}><option value="">Select value…</option>{availableRules.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <IconChipButton tone="primary" disabled={!ruleValue} aria-label="Add filter rule" onClick={() => { if (ruleValue) { toggle(facet, ruleValue); setValue('') } }}>Add</IconChipButton>
            </div>
            {applied.length > 0 && <div className="ll-pfa-rule-list">
              {groups.filter(item => active[item.id]?.length).map(item => <div className="ll-pfa-rule-group" key={item.id}><span>{item.label}</span><div className="ll-pf-chips">{applied.filter(rule => rule.id === item.id).map((rule, index) => <span className="ll-pfa-rule-token" key={rule.value}>{index > 0 && <small>OR</small>}<TagPill label={rule.label} onRemove={() => toggle(rule.id, rule.value)} /></span>)}</div></div>)}
            </div>}
          </div>}

          {study.id === 'match-index' && <div className="ll-pfa-index">
            <div className="ll-pfa-index-header" role="group" aria-label="Metadata index">
              {indexGroups.map(item => <button type="button" key={item.id} aria-pressed={facet === item.id} onClick={() => changeFacet(item.id)}>{item.label}</button>)}
            </div>
            <div className="ll-pfa-index-values" role="group" aria-label="Matching metadata values">
              {indexRows.map(option => <button type="button" key={option.value} aria-pressed={active[facet]?.includes(option.value) ?? false} onClick={() => toggle(facet, option.value)}>
                <span><MatchText value={option.label} query={query} /></span><span className="ll-pfa-index-meter" aria-hidden="true"><i style={{ width: `${100 * option.count / Math.max(1, searched.length)}%` }} /></span><small>{option.count}</small>
              </button>)}
              {!indexRows.length && <span className="ll-pfa-muted">No matching values</span>}
            </div>
          </div>}

          {study.id !== 'rule-builder' && study.id !== 'facet-ribbon' && applied.length > 0 && <div className="ll-pf-chips" role="group" aria-label="Applied filters">
            {applied.map(item => <TagPill key={`${item.id}:${item.value}`} label={item.label} onRemove={() => toggle(item.id, item.value)} />)}
          </div>}
        </div>
        <div className="ll-pf-results-bar"><span role="status">{results.length} {results.length === 1 ? 'preset' : 'presets'}</span>{(applied.length > 0 || query || field !== 'all') && <button type="button" onClick={reset}>Reset</button>}</div>
        {results.length ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {results.map(preset => <ReactPresetCard key={preset.id} id={preset.artworkId} engineId="cinema2" title={preset.name} description={preset.description} activateLabel={`Select ${preset.name}`}
            isFavorite={preset.favorite} onToggleFavorite={() => setFavoriteIds(current => toggleValue(current, preset.artworkId))} isActive={selected === preset.id} onActivate={() => setSelected(preset.id)} />)}
        </div> : <p className="ll-pf-empty">{!scoped.length ? `No ${scope} presets.` : 'No presets match.'}</p>}
      </div>
    </div>
  </section>
}

export function PresetFilterAlternatives({ records }: { records: readonly FilterPreset[] }) {
  return <>{studies.map(study => <AlternativePreview key={study.id} study={study} records={records} />)}</>
}
