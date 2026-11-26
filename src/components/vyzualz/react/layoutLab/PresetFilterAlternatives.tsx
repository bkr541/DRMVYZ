import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { HeaderActionIcon } from '../../layout/HeaderActionIcon'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import '../../layout/HeaderControlGroup.css'
import '../controls/LibraryViewToggle.css'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { usePresetScopeFilter } from '../../../../features/presetCatalog/presetCatalogStore'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'
import { ReactPresetArtwork, ReactPresetCard } from '../ReactPresetCard'
import { readReactPresetFavorites } from '../reactPresetLibraryState'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconChipButton } from '../controls/IconChipButton'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import {
  appliedFilters, DEFAULT_FILTERS, getFilterGroups, getStudyMatchingValues, getStudyMatchParts,
  matchesPreset, searchStudyPresets, toggleValue, type Facet, type FilterGroup, type FilterPreset, type Filters,
} from './presetFilterStudyData'
import { getPopupSections, type PopupChoice, type SearchMode } from './presetFilterPopupModel'

const studies = [
  { id: 'filter-menu', title: 'Filter Menu', icon: 'sliders', description: 'Cinema 2.0 · Compact cascading filter menu.' },
  { id: 'filter-checklist', title: 'Filter Checklist', icon: 'checklist', description: 'Cinema 2.0 · Searchable multi-select filter popover.' },
  { id: 'grouped-search', title: 'Grouped Search', icon: 'search', description: 'Cinema 2.0 · Search results grouped by match type.' },
  { id: 'metadata-suggestions', title: 'Search Suggestions', icon: 'tag', description: 'Cinema 2.0 · Choose matching presets or metadata.' },
  { id: 'visual-search', title: 'Visual Search', icon: 'image', description: 'Cinema 2.0 · Autocomplete with preset artwork.' },
] as const

type Study = typeof studies[number]
const facetIcons: Record<Facet, AppIconKind> = { name: 'search', category: 'layers', favorite: 'star', tag: 'tag', collection: 'folder' }

function Highlight({ value, query }: { value: string; query: string }) {
  return <>{getStudyMatchParts(value, query).map((part, index) => part.matched
    ? <mark className="ll-pf-smart-highlight" key={index}>{part.text}</mark>
    : <span key={index}>{part.text}</span>)}</>
}

function ScopeToggle({ scope, onChange, visualSearch }: { scope: PresetScopeTab; onChange: (next: PresetScopeTab) => void; visualSearch: boolean }) {
  const next = scope === 'system' ? 'user' : 'system'
  return <div className="vz-md-view-toggles">
    <div className="vz-header-group dv-library-view-toggle" data-preset-scope={scope} role="group"
      aria-label={`Preset scope: ${scope === 'system' ? 'System' : 'User'}`}>
      <HeaderIconKey label={next === 'user' ? 'User presets' : 'System presets'}
        icon={visualSearch
          ? <HeaderActionIcon action={next === 'user' ? 'userProfile' : 'grid'} />
          : <AppIcon kind={next === 'user' ? 'user' : 'layers'} size={12}
            viewBox={next === 'user' ? '6 2 20 28' : '2 2 28 28'} color="currentColor" />}
        onClick={() => onChange(next)} />
    </div>
  </div>
}

function changeFilter(filters: Filters, facet: Facet, value: string): Filters {
  const selected = filters[facet] ?? []
  return { ...filters, [facet]: facet === 'favorite' ? (selected.includes(value) ? [] : [value]) : toggleValue(selected, value) }
}

function FilterPopup({ mode, groups, searched, value, onChange, onClose, id }: {
  mode: 'filter-menu' | 'filter-checklist'; groups: FilterGroup[]; searched: FilterPreset[];
  value: Filters; onChange: (value: Filters) => void; onClose: () => void; id: string
}) {
  const [facet, setFacet] = useState<Facet | null>(null)
  const [term, setTerm] = useState('')
  const [draft, setDraft] = useState(value)
  const pop = useRef<HTMLDivElement>(null)
  const checklist = mode === 'filter-checklist'
  const filters = checklist ? draft : value
  const current = groups.find(group => group.id === facet)
  const checklistGroups = [...groups.filter(group => group.id !== 'name'), ...groups.filter(group => group.id === 'name')]
  const selectedCount = appliedFilters(groups, filters).length
  const count = searched.filter(preset => matchesPreset(preset, '', filters)).length
  const setFilters = checklist ? setDraft : onChange
  const choose = (group: Facet, option: string) => setFilters(changeFilter(filters, group, option))
  const matching = (group: FilterGroup) => group.options.filter(option => option.label.toLowerCase().includes(term.trim().toLowerCase()))
  const showFacet = (next: Facet | null) => { setFacet(next); setTerm('') }
  useEffect(() => {
    // Focus the new page's search field, or the first action in the root menu.
    pop.current?.querySelector<HTMLElement>(checklist || current ? 'input[type="text"]' : '[data-pfp-group]')?.focus()
  }, [checklist, current?.id])
  const renderOptions = (group: FilterGroup) => matching(group).map(option => {
    const checked = (filters[group.id] ?? []).includes(option.value)
    const optionCount = searched.filter(preset => matchesPreset(preset, '', { ...filters, [group.id]: [option.value] })).length
    return <label key={option.value} className="ll-pfp-check-row">
      <input type="checkbox" checked={checked} onChange={() => choose(group.id, option.value)} />
      <span className="ll-pfp-check-label"><Highlight value={option.label} query={term} /></span>
      <span className="ll-pfp-count">{optionCount}</span>
    </label>
  })
  return <div ref={pop} id={id} className="ll-pf-smart-popover ll-pfp-filter" role="dialog" aria-label="Filter presets">
    <div className="ll-pfp-head">
      {current && !checklist && <button type="button" className="ll-pfp-back" aria-label="Back to filters" onClick={() => showFacet(null)}><AppIcon kind="chevronRight" size={14} /></button>}
      <strong>{current && !checklist ? current.label : 'Filter presets'}</strong>
      <button type="button" className="ll-pfp-link" disabled={!selectedCount} onClick={() => setFilters(DEFAULT_FILTERS)}>Clear all</button>
    </div>
    {(checklist || current) && <div className="ll-pfp-find">
      <AppIcon kind="search" size={13} />
      <input type="text" value={term} aria-label={current ? `Find ${current.label.toLowerCase()}` : 'Find filter options'}
        placeholder={current ? `Find ${current.label.toLowerCase()}…` : 'Find filter options…'} onChange={event => setTerm(event.target.value)} />
      {term && <button type="button" aria-label="Clear filter search" onClick={() => setTerm('')}><AppIcon kind="close" size={12} /></button>}
    </div>}
    <div className="ll-pfp-filter-body">
      {checklist ? <>
        {checklistGroups.filter(group => matching(group).length > 0).map(group => <div className="ll-pfp-check-group" key={group.id} role="group" aria-label={group.label}>
          <div className="ll-pfp-section-label">{group.label}</div>{renderOptions(group)}
        </div>)}
        {!groups.some(group => matching(group).length > 0) && <div className="ll-pf-smart-no-results">No matching filters.</div>}
      </> : current ? <div role="group" aria-label={current.label}>
        {renderOptions(current)}
        {!matching(current).length && <div className="ll-pf-smart-no-results">No matching options.</div>}
      </div> : groups.map(group => {
        const chosen = appliedFilters([group], filters)
        return <button key={group.id} type="button" data-pfp-group={group.id} className="ll-pfp-group-row" onClick={() => showFacet(group.id)}>
          <AppIcon kind={facetIcons[group.id]} size={15} />
          <span className="ll-pfp-group-text"><strong>{group.label}</strong>{chosen.length > 0 && <small>{chosen.map(option => option.label).join(', ')}</small>}</span>
          {chosen.length > 0 && <span className="ll-pfp-count ll-pfp-selected">{chosen.length}</span>}
          <AppIcon kind="chevronRight" size={13} />
        </button>
      })}
    </div>
    <div className="ll-pfp-footer">
      <span>{count} {count === 1 ? 'preset' : 'presets'}</span>
      {checklist ? <><IconChipButton onClick={onClose}>Cancel</IconChipButton><IconChipButton tone="primary" onClick={() => { onChange(draft); onClose() }}>Apply</IconChipButton></>
        : <IconChipButton onClick={onClose}>Done</IconChipButton>}
    </div>
  </div>
}

function AlternativePreview({ study, records }: { study: Study; records: readonly FilterPreset[] }) {
  const titleId = useId()
  const popupId = useId()
  const anchor = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [scope, setScope] = useState<PresetScopeTab>('system')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [exact, setExact] = useState<{ facet: Facet; value: string } | null>(null)
  const [selected, setSelected] = useState('')
  const [favoriteIds, setFavoriteIds] = useState(readReactPresetFavorites)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const isFilter = study.id === 'filter-menu' || study.id === 'filter-checklist'
  const inScope = usePresetScopeFilter('cinema2', scope)
  const scoped = useMemo(() => records.filter(preset => isFilter || inScope(preset.artworkId))
    .map(preset => ({ ...preset, favorite: favoriteIds.includes(preset.artworkId) })), [records, inScope, favoriteIds, isFilter])
  const groups = useMemo(() => getFilterGroups(scoped), [scoped])
  const active = useMemo(() => Object.fromEntries(groups.map(group => [group.id,
    (filters[group.id] ?? []).filter(item => group.options.some(option => option.value === item))])) as Filters, [groups, filters])
  const searched = useMemo(() => searchStudyPresets(scoped, query), [scoped, query])
  const visible = isFilter ? searched.filter(preset => matchesPreset(preset, '', active))
    : exact ? scoped.filter(preset => matchesPreset(preset, '', { [exact.facet]: [exact.value] })) : searched
  const sections = useMemo(() => isFilter ? [] : getPopupSections(study.id as SearchMode, scoped, query), [isFilter, study.id, scoped, query])
  const choices = sections.flatMap(section => section.choices)
  const activeIndex = choices.findIndex(choice => choice.key === highlighted)
  const optionId = (index: number) => `${popupId}-option-${index}`
  const showPopup = open && (isFilter || !!query.trim() || study.id === 'visual-search')
  const close = () => { setOpen(false); setHighlighted(null) }
  const closeFilter = () => { close(); trigger.current?.focus() }
  const changeQuery = (next: string) => { setQuery(next); setExact(null); setHighlighted(null); setOpen(!isFilter) }
  const selectChoice = (choice: PopupChoice) => {
    if (choice.kind === 'preset') {
      setSelected(choice.preset.id); setQuery(choice.preset.name); setExact({ facet: 'name', value: choice.preset.id })
    } else {
      setSelected(''); setQuery(choice.label); setExact({ facet: choice.facet, value: choice.value })
    }
    close()
  }
  const changeScope = (next: PresetScopeTab) => { setScope(next); setFilters(DEFAULT_FILTERS); setQuery(''); setExact(null); setSelected(''); close() }
  useEffect(() => {
    if (!showPopup) return
    const doc = anchor.current?.ownerDocument
    const outside = (event: Event) => { if (event.target && !anchor.current?.contains(event.target as Node)) { setOpen(false); setHighlighted(null) } }
    doc?.addEventListener('pointerdown', outside)
    doc?.addEventListener('focusin', outside)
    return () => { doc?.removeEventListener('pointerdown', outside); doc?.removeEventListener('focusin', outside) }
  }, [showPopup])
  useEffect(() => {
    if (showPopup && activeIndex >= 0) anchor.current?.ownerDocument.getElementById(`${popupId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [showPopup, activeIndex, popupId])
  const scopeToggle = <ScopeToggle scope={scope} onChange={changeScope} visualSearch={study.id === 'visual-search'} />
  const appliedCount = appliedFilters(groups, active).length
  let index = 0
  const renderChoice = (choice: PopupChoice): ReactNode => {
    const position = index++
    return <div id={optionId(position)} key={choice.key} role="option" aria-selected={activeIndex === position}
      className={`ll-pfp-choice${study.id === 'visual-search' ? ' ll-pfp-visual-choice' : ''}`} onMouseDown={event => event.preventDefault()}
      onClick={() => selectChoice(choice)}>
      {choice.kind === 'preset' ? <>
        {study.id === 'visual-search' && <ReactPresetArtwork id={choice.preset.artworkId} appearance="frame" className="ll-pfp-artwork" />}
        {study.id === 'metadata-suggestions' && <AppIcon kind="search" size={14} />}
        <div className="ll-pfp-choice-copy"><strong><Highlight value={choice.preset.name} query={query} /></strong>
          {getStudyMatchingValues(choice.preset, query).length > 0 ? <div className="ll-pf-smart-matches">
            {getStudyMatchingValues(choice.preset, query).map((value, i) => <span key={value}>{i > 0 && ' · '}<Highlight value={value} query={query} /></span>)}
          </div> : study.id === 'visual-search' && <div className="ll-pf-smart-matches">{choice.preset.category}</div>}
        </div>
        {selected === choice.preset.id && <AppIcon kind="check" size={14} className="ll-pfp-selected" />}
      </> : <>
        <AppIcon kind={facetIcons[choice.facet]} size={14} />
        <div className="ll-pfp-choice-copy"><strong><Highlight value={choice.label} query={query} /></strong></div>
        <span className="ll-pfp-count">{choice.count}</span><AppIcon kind="chevronRight" size={12} />
      </>}
    </div>
  }
  return <section className="ll-pf-study ll-pfp-study" data-preset-filter-study={study.id} aria-labelledby={titleId}>
    <h2 id={titleId}><AppIcon kind={study.icon} size={14} />{study.title}</h2>
    <p className="ll-pf-description">{study.description}</p>
    <div className="ll-pf-inspector">
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-pf-workspace-tabs">
        <span className="dv-underline-tab is-active" aria-current="page">Presets</span>
        <span className="dv-underline-tab">Design</span><span className="dv-underline-tab">React</span><span className="dv-underline-tab">Output</span>
      </div>
      <div className="ll-pf-scroll">
        <div className="ll-pf-controls">
          <div ref={anchor} className="ll-pf-smart-anchor" onKeyDown={event => {
            if (event.key === 'Escape' && showPopup) { event.preventDefault(); event.stopPropagation(); isFilter ? closeFilter() : close() }
          }}>
            {isFilter ? <PresetSearchRow query={query} onQueryChange={changeQuery} trailing={
              <IconChipButton ref={trigger} className="ll-pf-filter-trigger" aria-label="Filters" title="Filters" icon={<AppIcon kind="sliders" size={14} />}
                tone={showPopup || appliedCount ? 'primary' : 'default'} data-has-filters={appliedCount > 0}
                aria-haspopup="dialog" aria-expanded={showPopup} aria-controls={showPopup ? popupId : undefined} onClick={() => setOpen(current => !current)} />
            } /> : <div className="vz-md-search-row rv-preset-search-row">
              <div className="vz-md-search-wrap">
                <AppIcon kind="search" className="vz-md-search-icon" size="12" />
                <DreamVizTextInput ref={input} className="vz-md-search-input" value={query} placeholder="Search presets…" aria-label={`${study.title} presets`}
                  role="combobox" aria-autocomplete="list" aria-expanded={showPopup} aria-controls={showPopup ? popupId : undefined}
                  aria-activedescendant={showPopup && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  onChange={event => changeQuery(event.target.value)} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
                  onKeyDown={event => {
                    if (!choices.length) return
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault(); setOpen(true)
                      const next = !showPopup || activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1)
                        : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length
                      setHighlighted(choices[next].key)
                    } else if (event.key === 'Enter' && showPopup && activeIndex >= 0) { event.preventDefault(); selectChoice(choices[activeIndex]) }
                  }} />
                {query && <button type="button" className="vz-md-search-clear" aria-label="Clear search" title="Clear search" onMouseDown={event => event.preventDefault()} onClick={() => { changeQuery(''); input.current?.focus() }}><AppIcon kind="close" size={14} /></button>}
              </div>{scopeToggle}
            </div>}
            {showPopup && (study.id === 'filter-menu' || study.id === 'filter-checklist' ? <FilterPopup mode={study.id} id={popupId}
              groups={groups} searched={searched} value={active} onChange={setFilters} onClose={closeFilter} />
              : <div className="ll-pf-smart-popover ll-pfp-search">
                <div className="ll-pf-smart-summary">{searched.length} {searched.length === 1 ? 'match' : 'matches'}</div>
                <div id={popupId} role="listbox" aria-label="Matching presets and filters" className="ll-pf-smart-options">
                  {sections.map(section => <div key={section.label} role="group" aria-label={section.label} className="ll-pfp-result-group">
                    {study.id !== 'visual-search' && <div className="ll-pfp-section-label">{section.label}</div>}
                    {section.choices.map(renderChoice)}
                  </div>)}
                </div>
                {!choices.length && <p className="ll-pf-smart-no-results">No matching presets.</p>}
              </div>)}
          </div>
        </div>
        <div className="ll-pf-results-bar"><span role="status">{visible.length} {visible.length === 1 ? 'preset' : 'presets'}</span></div>
        {visible.length ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {visible.map(preset => <ReactPresetCard key={preset.id} id={preset.artworkId} engineId="cinema2" title={preset.name} description={preset.description}
            activateLabel={`Select ${preset.name}`} isFavorite={preset.favorite} onToggleFavorite={() => setFavoriteIds(current => toggleValue(current, preset.artworkId))}
            isActive={selected === preset.id} onActivate={() => setSelected(preset.id)} />)}
        </div> : <p className="ll-pf-empty">{query.trim() || appliedCount ? 'No presets match.' : isFilter ? 'No presets available.' : scope === 'user' ? 'No user presets yet.' : 'No system presets.'}</p>}
      </div>
    </div>
  </section>
}

export function PresetFilterAlternatives({ records }: { records: readonly FilterPreset[] }) {
  return <>{studies.map(study => <AlternativePreview key={study.id} study={study} records={records} />)}</>
}
