import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../shared/InfoPopover'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { cinema2NativePresetRegistry } from '../../cinema2'
import { applyPresetMetadata } from '../../../../features/presetCatalog/presetMetadata'
import { usePresetScopeFilter } from '../../../../features/presetCatalog/presetCatalogStore'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'
import { usePresetMetadata } from '../../../../features/presetCatalog/presetMetadataStore'
import { usePresetOrganizationStore } from '../../../../features/presetOrganization/presetOrganizationStore'
import { useMediaStore } from '../../../../stores/mediaStore'
import { ReactPresetCard } from '../ReactPresetCard'
import { resolvePresetDiscoveryMetadata } from '../presetDiscovery'
import { readReactPresetFavorites } from '../reactPresetLibraryState'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconChipButton } from '../controls/IconChipButton'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { TagPill } from '../controls/TagPill'
import {
  DEFAULT_FILTERS, appliedFilters, getFilterGroups, matchesPreset, searchStudyPresets, toggleValue,
  getStudyMatchingValues, getStudyMatchParts,
  type Facet, type FilterGroup, type FilterPreset, type Filters,
} from './presetFilterStudyData'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import popoverStyles from '../../../shared/InfoPopover/InfoPopover.css?inline'
import reactStyles from '../../../../styles/reactView.css?inline'
import mediaStyles from '../../../../styles/vyzualz.css?inline'
import headerStyles from '../../layout/HeaderControlGroup.css?inline'
import viewToggleStyles from '../controls/LibraryViewToggle.css?inline'
import styles from './presetFilterStudies.css?inline'

// The Inspector study represents one engine, not a cross-engine library.
function useStudyPresets(): FilterPreset[] {
  const metadata = usePresetMetadata()
  const organizations = usePresetOrganizationStore(state => state.records)
  const loadOrganizations = usePresetOrganizationStore(state => state.load)
  const collections = useMediaStore(state => state.collections)
  const loadCollections = useMediaStore(state => state.loadCollections)
  useEffect(() => { void loadOrganizations(); void loadCollections() }, [loadOrganizations, loadCollections])

  return useMemo(() => {
    const shipped = cinema2NativePresetRegistry.list().filter(manifest => !manifest.metadata.tags?.includes('internal'))
      .map(manifest => ({
        id: `cinema2:${manifest.id}`,
        artworkId: manifest.id,
        name: manifest.metadata.name,
        description: manifest.metadata.description ?? manifest.metadata.name,
        ...resolvePresetDiscoveryMetadata(manifest.metadata, 'cinematic'),
      }))
    const collectionById = new Map(collections.map(collection => [collection.id, collection]))
    return applyPresetMetadata(shipped, metadata).map(preset => {
      const organization = organizations[preset.id]
      return {
        ...preset,
        tags: [...new Set([...preset.tags, ...(organization?.tags ?? [])])],
        favorite: false,
        collections: (organization?.collectionIds ?? []).flatMap(id => {
          const collection = collectionById.get(id)
          return collection ? [{ id, name: collection.name }] : []
        }),
      }
    })
  }, [metadata, organizations, collections])
}

function FilterPopover({ groups, presets, query, value, onChange }: {
  groups: readonly FilterGroup[]; presets: readonly FilterPreset[]; query: string
  value: Filters; onChange: (filters: Filters) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [nameQuery, setNameQuery] = useState('')
  const [expanded, setExpanded] = useState<Facet[]>(['name'])
  const count = appliedFilters(groups, value).length
  const draftCount = presets.filter(preset => matchesPreset(preset, query, draft)).length

  useEffect(() => {
    const ownerWindow = trigger.current?.ownerDocument.defaultView
    if (!open || !ownerWindow) return
    const frame = ownerWindow.requestAnimationFrame(() => first.current?.focus())
    return () => ownerWindow.cancelAnimationFrame(frame)
  }, [open])

  const close = () => { setOpen(false); trigger.current?.focus() }
  const setFacet = (facet: Facet, values: string[]) => setDraft(current => ({ ...current, [facet]: values }))

  return <>
    <IconChipButton ref={trigger} className="ll-pf-filter-trigger" aria-label="Filters"
      title={count ? `Filters (${count} applied)` : 'Filters'} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={open ? id : undefined} data-has-filters={count > 0}
      tone={open || count ? 'primary' : 'default'} icon={<AppIcon kind="sliders" size={14} />}
      onClick={() => { if (!open) { setDraft(value); setNameQuery(''); setExpanded(['name']) } setOpen(!open) }} />
    <InfoPopover id={id} open={open} anchorRef={trigger} title="Filter presets" closeLabel="Close filters"
      placement="below" align="end" offset={6} width={320} maxHeight={540} className="ll-pf-filter-popover"
      onOpenChange={setOpen} footer={<>
        <button type="button" className="ll-pf-reset" onClick={() => { setDraft(DEFAULT_FILTERS); setNameQuery('') }}>Reset all</button>
        <IconChipButton onClick={close}>Cancel</IconChipButton>
        <IconChipButton tone="primary" onClick={() => { onChange(draft); close() }}>Apply ({draftCount})</IconChipButton>
      </>}>
      <div className="ll-pf-facets">
        {groups.map(group => {
          const values = draft[group.id] ?? []
          const options = group.id === 'name' ? group.options.filter(option => option.label.toLowerCase().includes(nameQuery.trim().toLowerCase())) : group.options
          return <details key={group.id} open={expanded.includes(group.id)}>
            <summary onClick={event => { event.preventDefault(); setExpanded(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id]) }}><span>{group.label}{values.length > 0 && <em>{values.length}</em>}</span><AppIcon kind="chevronDown" size={13} /></summary>
            {group.id === 'name' && <input ref={first} className="ll-pf-name-search" aria-label="Find preset name" placeholder="Find a preset…" value={nameQuery} onChange={event => setNameQuery(event.target.value)} />}
            <div className="ll-pf-options" role="group" aria-label={group.label}>
              {group.id === 'favorite' && <label><input type="radio" name={`${id}-favorite`} checked={!values.length} onChange={() => setFacet(group.id, [])} /><span>Any</span></label>}
              {options.map(option => <label key={option.value}>
                <input type={group.id === 'favorite' ? 'radio' : 'checkbox'} name={group.id === 'favorite' ? `${id}-favorite` : undefined}
                  checked={values.includes(option.value)} onChange={() => setFacet(group.id, group.id === 'favorite' ? [option.value] : toggleValue(values, option.value))} />
                <span>{option.label}</span>
              </label>)}
              {!options.length && <p className="ll-pf-no-options">{group.id === 'name' && nameQuery ? 'No matching names.' : 'No options available.'}</p>}
            </div>
          </details>
        })}
      </div>
    </InfoPopover>
  </>
}

function PresetFilterPreview({ records }: { records: readonly FilterPreset[] }) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState('')
  // Preview-only favorite toggles; never mutate the user's saved library from Layout Lab.
  const [favoriteIds, setFavoriteIds] = useState(readReactPresetFavorites)
  const presets = useMemo(() => records.map(preset => ({ ...preset, favorite: favoriteIds.includes(preset.artworkId) })), [records, favoriteIds])
  const groups = useMemo(() => getFilterGroups(presets), [presets])
  const applied = appliedFilters(groups, filters)
  // Metadata can change while the study is open. Ignore selections that no longer exist.
  const active = Object.fromEntries(groups.map(group => [group.id, (filters[group.id] ?? []).filter(value => group.options.some(option => option.value === value))])) as Filters
  const visiblePresets = presets.filter(preset => matchesPreset(preset, query, active))

  return <section className="ll-pf-study" data-preset-filter-study="dropdowns" aria-labelledby={titleId}>
    <h2 id={titleId}><AppIcon kind="chevronDown" size={14} />Inline Dropdown</h2>
    <p className="ll-pf-description">Cinema 2.0 · Filter the engine's presets without leaving the Inspector.</p>
    <div className="ll-pf-inspector">
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-pf-workspace-tabs">
        <span className="dv-underline-tab is-active" aria-current="page">Presets</span>
        <span className="dv-underline-tab">Design</span><span className="dv-underline-tab">React</span><span className="dv-underline-tab">Output</span>
      </div>
      <div className="ll-pf-scroll">
        <div className="ll-pf-controls">
          <PresetSearchRow query={query} onQueryChange={setQuery} placeholder="Search preset names…"
            trailing={<FilterPopover groups={groups} presets={presets} query={query} value={active} onChange={setFilters} />} />
          {applied.length > 0 && <div className="ll-pf-chips" role="group" aria-label="Applied filters">
            {applied.map(({ id, value, label }) => <TagPill key={`${id}:${value}`} label={label} onRemove={() => setFilters(current => ({ ...current, [id]: (current[id] ?? []).filter(item => item !== value) }))} />)}
          </div>}
        </div>
        <div className="ll-pf-results-bar">
          <span role="status">{visiblePresets.length} {visiblePresets.length === 1 ? 'preset' : 'presets'}</span>
          {applied.length > 0 && <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>}
        </div>
        {visiblePresets.length > 0 ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {visiblePresets.map(preset => <ReactPresetCard key={preset.id} id={preset.artworkId} engineId="cinema2"
            title={preset.name} description={preset.description} activateLabel={`Select ${preset.name}`}
            isFavorite={preset.favorite} onToggleFavorite={() => setFavoriteIds(current => toggleValue(current, preset.artworkId))}
            isActive={selected === preset.id} onActivate={() => setSelected(preset.id)} />)}
        </div> : <p className="ll-pf-empty">No presets match.</p>}
      </div>
    </div>
  </section>
}

function HighlightedSearchValue({ value, query }: { value: string; query: string }) {
  return <>{getStudyMatchParts(value, query).map((part, index) => part.matched
    ? <mark key={index} className="ll-pf-smart-highlight">{part.text}</mark>
    : <span key={index}>{part.text}</span>)}</>
}

// Non-modal autocomplete: keep focus in the input while the results overlay is open.
// Selection and favorites are local to Layout Lab, just like the original study.
function SmartPresetFilterPreview({ records }: { records: readonly FilterPreset[] }) {
  const titleId = useId()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<PresetScopeTab>('system')
  const nextScope = scope === 'system' ? 'user' : 'system'
  const [selected, setSelected] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState(readReactPresetFavorites)
  const inScope = usePresetScopeFilter('cinema2', scope)
  const scoped = useMemo(() => records.filter(preset => inScope(preset.artworkId)), [records, inScope])
  const results = useMemo(() => searchStudyPresets(scoped, query), [scoped, query])
  const open = searchOpen && Boolean(query.trim())
  const activeIndex = results.findIndex(preset => preset.id === highlighted)
  const optionId = (index: number) => `${listId}-option-${index}`

  useEffect(() => {
    if (open && activeIndex >= 0) input.current?.ownerDocument.getElementById(`${listId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex, listId])

  const changeQuery = (value: string) => {
    setQuery(value)
    setHighlighted(null)
    setSearchOpen(true)
  }
  const closeSearch = () => { setSearchOpen(false); setHighlighted(null) }
  const selectResult = (preset: FilterPreset) => {
    setSelected(preset.id)
    setQuery(preset.name)
    closeSearch()
  }

  return <section className="ll-pf-study" data-preset-filter-study="smart-search" aria-labelledby={titleId}>
    <h2 id={titleId}><AppIcon kind="search" size={14} />Smart Search</h2>
    <p className="ll-pf-description">Cinema 2.0 · Search preset metadata within System or User.</p>
    <div className="ll-pf-inspector">
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-pf-workspace-tabs">
        <span className="dv-underline-tab is-active" aria-current="page">Presets</span>
        <span className="dv-underline-tab">Design</span><span className="dv-underline-tab">React</span><span className="dv-underline-tab">Output</span>
      </div>
      <div className="ll-pf-scroll">
        <div className="ll-pf-controls">
          <div className="ll-pf-smart-anchor">
            <div className="vz-md-search-row rv-preset-search-row">
              <div className="vz-md-search-wrap">
                <AppIcon kind="search" className="vz-md-search-icon" size="12" />
                <DreamVizTextInput ref={input} className="vz-md-search-input" value={query}
                  placeholder="Search presets…" aria-label="Smart search presets" role="combobox"
                  aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
                  aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                  title="Search name, category, tags and collections"
                  onChange={event => changeQuery(event.target.value)} onFocus={() => setSearchOpen(true)}
                  onClick={() => setSearchOpen(true)} onBlur={closeSearch}
                  onKeyDown={event => {
                    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); closeSearch(); return }
                    if (!query.trim() || !results.length) return
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault()
                      setSearchOpen(true)
                      const next = activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
                        : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
                      setHighlighted(results[next].id)
                    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
                      event.preventDefault(); selectResult(results[activeIndex])
                    }
                  }} />
                {query && <button type="button" className="vz-md-search-clear" aria-label="Clear smart search" title="Clear search"
                  onClick={() => { changeQuery(''); input.current?.focus() }}><AppIcon kind="close" size={14} /></button>}
              </div>
              <div className="vz-md-view-toggles">
                <div className="vz-header-group dv-library-view-toggle" data-preset-scope={scope}
                  role="group" aria-label={`Preset scope: ${scope === 'system' ? 'System' : 'User'}`}>
                  <HeaderIconKey label={nextScope === 'user' ? 'User presets' : 'System presets'}
                    icon={<AppIcon kind={nextScope === 'user' ? 'user' : 'layers'} size={12}
                      viewBox={nextScope === 'user' ? '6 2 20 28' : '2 2 28 28'} color="currentColor" />}
                    onClick={() => { setScope(nextScope); setSelected(''); closeSearch() }} />
                </div>
              </div>
            </div>
            {open && <div className="ll-pf-smart-popover">
              <div className="ll-pf-smart-summary">{results.length} {results.length === 1 ? 'match' : 'matches'}</div>
              <div id={listId} role="listbox" aria-label="Matching presets" className="ll-pf-smart-options">
                {results.map((preset, index) => {
                  const matchingValues = getStudyMatchingValues(preset, query)
                  return <div key={preset.id} id={optionId(index)} role="option"
                    aria-selected={activeIndex === index} className="ll-pf-smart-option"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => selectResult(preset)}>
                    <strong><HighlightedSearchValue value={preset.name} query={query} /></strong>
                    {matchingValues.length > 0 && <div className="ll-pf-smart-matches">
                      {matchingValues.map((value, index) => <span key={value}>
                        {index > 0 && ' · '}<HighlightedSearchValue value={value} query={query} />
                      </span>)}
                    </div>}
                  </div>
                })}
              </div>
              {!results.length && <p className="ll-pf-smart-no-results">No matching presets.</p>}
            </div>}
          </div>
        </div>
        <div className="ll-pf-results-bar"><span role="status">{results.length} {results.length === 1 ? 'preset' : 'presets'}</span></div>
        {results.length ? <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {results.map(preset => <ReactPresetCard key={preset.id} id={preset.artworkId} engineId="cinema2"
            title={preset.name} description={preset.description} activateLabel={`Select ${preset.name}`}
            isFavorite={favoriteIds.includes(preset.artworkId)} onToggleFavorite={() => setFavoriteIds(current => toggleValue(current, preset.artworkId))}
            isActive={selected === preset.id} onActivate={() => setSelected(preset.id)} />)}
        </div> : <p className="ll-pf-empty">{query.trim() ? 'No presets match.' : scope === 'user' ? 'No user presets yet.' : 'No system presets.'}</p>}
      </div>
    </div>
  </section>
}

export function PresetFilterStudies() {
  const records = useStudyPresets()
  return <div className="ll-pf-studies" aria-label="Preset Filter studies">
    <style>{`@scope (.ll-pf-studies) { ${railStyles}\n${mediaStyles}\n${reactStyles}\n${headerStyles.replaceAll(':root', ':scope')}\n${viewToggleStyles} }\n${popoverStyles}\n${styles}`}</style>
    <PresetFilterPreview records={records} />
    <SmartPresetFilterPreview records={records} />
  </div>
}
