import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { HeaderActionIcon } from '../../layout/HeaderActionIcon'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import '../../layout/HeaderControlGroup.css'
import './LibraryViewToggle.css'
import '../layoutLab/presetFilterStudies.css'
import { DreamVizTextInput } from './DreamVizTextInput'
import { ReactPresetArtwork } from '../ReactPresetCard'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'
import { getStudyMatchingValues, getStudyMatchParts, searchStudyPresets, type FilterPreset } from '../layoutLab/presetFilterStudyData'

function Highlight({ value, query }: { value: string; query: string }) {
  return <>{getStudyMatchParts(value, query).map((part, i) => part.matched
    ? <mark className="ll-pf-smart-highlight" key={i}>{part.text}</mark>
    : <span key={i}>{part.text}</span>)}</>
}

/** The Visual Search study's search row, used verbatim by the production browsers. */
export function VisualPresetSearch({ query, onQueryChange, scope, onScopeChange, records, selectedId, onSelect, renderArtwork, ariaLabel = 'Search presets' }: {
  query: string; onQueryChange: (query: string) => void; scope: PresetScopeTab;
  onScopeChange: (scope: PresetScopeTab) => void; records: readonly FilterPreset[];
  selectedId?: string | null; onSelect: (preset: FilterPreset) => void; renderArtwork?: (preset: FilterPreset) => ReactNode; ariaLabel?: string;
}) {
  const popupId = useId()
  const anchor = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const choices = searchStudyPresets(records, query)
  const activeIndex = choices.findIndex(preset => preset.id === highlighted)
  const optionId = (index: number) => `${popupId}-option-${index}`
  const close = () => { setOpen(false); setHighlighted(null) }
  const changeQuery = (next: string) => { onQueryChange(next); setHighlighted(null); setOpen(true) }
  const select = (preset: FilterPreset) => { onSelect(preset); close() }
  const nextScope = scope === 'system' ? 'user' : 'system'
  useEffect(() => {
    if (!open) return
    const doc = anchor.current?.ownerDocument
    const outside = (event: Event) => {
      if (event.target && !anchor.current?.contains(event.target as Node)) { setOpen(false); setHighlighted(null) }
    }
    doc?.addEventListener('pointerdown', outside)
    doc?.addEventListener('focusin', outside)
    return () => { doc?.removeEventListener('pointerdown', outside); doc?.removeEventListener('focusin', outside) }
  }, [open])
  useEffect(() => {
    if (open && activeIndex >= 0) anchor.current?.ownerDocument.getElementById(`${popupId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex, popupId])
  return <div ref={anchor} className="ll-pf-smart-anchor rv-visual-preset-search" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
  }}>
    <div className="vz-md-search-row rv-preset-search-row">
      <div className="vz-md-search-wrap">
        <AppIcon kind="search" className="vz-md-search-icon" size="12" />
        <DreamVizTextInput ref={input} className="vz-md-search-input" value={query} placeholder="Search presets…" aria-label={ariaLabel}
          role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? popupId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onChange={event => changeQuery(event.target.value)} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true)
              if (!choices.length) return
              const next = !open || activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : choices.length - 1)
                : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length
              setHighlighted(choices[next].id)
            } else if (event.key === 'Enter' && open && activeIndex >= 0) { event.preventDefault(); select(choices[activeIndex]) }
          }} />
        {query && <button type="button" className="vz-md-search-clear" aria-label="Clear search" title="Clear search" onMouseDown={event => event.preventDefault()} onClick={() => { changeQuery(''); input.current?.focus() }}><AppIcon kind="close" size={14} /></button>}
      </div>
      <div className="vz-md-view-toggles">
        <div className="vz-header-group dv-library-view-toggle" data-preset-scope={scope} role="group" aria-label={`Preset scope: ${scope === 'system' ? 'System' : 'User'}`}>
          <HeaderIconKey label={nextScope === 'user' ? 'User presets' : 'System presets'} icon={<HeaderActionIcon action={nextScope === 'user' ? 'userProfile' : 'grid'} />}
            onClick={() => { onScopeChange(nextScope); close() }} />
        </div>
      </div>
    </div>
    {open && <div className="ll-pf-smart-popover ll-pfp-search">
      <div className="ll-pf-smart-summary">{choices.length} {choices.length === 1 ? 'match' : 'matches'}</div>
      <div id={popupId} role="listbox" aria-label="Matching presets and filters" className="ll-pf-smart-options">
        <div role="group" aria-label="Presets" className="ll-pfp-result-group">
          {choices.map((preset, index) => {
            const metadata = getStudyMatchingValues(preset, query)
            return <div id={optionId(index)} key={preset.id} role="option" aria-selected={activeIndex === index} className="ll-pfp-choice ll-pfp-visual-choice"
              onMouseDown={event => event.preventDefault()} onClick={() => select(preset)}>
              <ReactPresetArtwork id={preset.artworkId} backdrop={renderArtwork?.(preset)} appearance="frame" className="ll-pfp-artwork" />
              <div className="ll-pfp-choice-copy"><strong><Highlight value={preset.name} query={query} /></strong>
                <div className="ll-pf-smart-matches">{metadata.length ? metadata.map((value, i) => <span key={value}>{i > 0 && ' · '}<Highlight value={value} query={query} /></span>) : preset.category}</div>
              </div>
              {selectedId === preset.id && <AppIcon kind="check" size={14} className="ll-pfp-selected" />}
            </div>
          })}
        </div>
      </div>
      {!choices.length && <p className="ll-pf-smart-no-results">No matching presets.</p>}
    </div>}
  </div>
}
