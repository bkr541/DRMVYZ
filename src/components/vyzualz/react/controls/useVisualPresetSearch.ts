import { useEffect, useState } from 'react'
import { usePresetMetadata } from '../../../../features/presetCatalog/presetMetadataStore'
import { usePresetOrganizationStore } from '../../../../features/presetOrganization/presetOrganizationStore'
import { useMediaStore } from '../../../../stores/mediaStore'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'
import { searchStudyPresets, type FilterPreset } from '../layoutLab/presetFilterStudyData'
import { buildVisualPresetRecords, type VisualPresetSource } from './visualPresetSearchModel'

export function useVisualPresetSearch(engineId: string, sources: readonly VisualPresetSource[], scope: PresetScopeTab,
  setScope: (scope: PresetScopeTab) => void, inScope: (id: string) => boolean, context = engineId, onActivate?: (id: string) => void) {
  const [state, setState] = useState({ context, query: '', selectedId: null as string | null })
  const current = state.context === context ? state : { context, query: '', selectedId: null }
  useEffect(() => { setState(previous => previous.context === context ? previous : { context, query: '', selectedId: null }) }, [context])
  const metadata = usePresetMetadata()
  const organizations = usePresetOrganizationStore(state => state.records)
  const loadOrganizations = usePresetOrganizationStore(state => state.load)
  const collections = useMediaStore(state => state.collections)
  const loadCollections = useMediaStore(state => state.loadCollections)
  useEffect(() => { void loadOrganizations(); void loadCollections() }, [loadOrganizations, loadCollections])
  const records = buildVisualPresetRecords(engineId, sources.filter(source => inScope(source.id)), metadata, organizations, collections)
  const matching = current.selectedId ? records.filter(record => record.id === current.selectedId) : searchStudyPresets(records, current.query)
  const matchingIds = new Set(matching.map(record => record.id))
  const recordsById = new Map(records.map(record => [record.id, record]))
  return {
    query: current.query, matchingIds, recordsById,
    searchProps: { query: current.query, scope, records, selectedId: current.selectedId,
      onQueryChange: (query: string) => setState({ context, query, selectedId: null }),
      onScopeChange: (next: PresetScopeTab) => { setScope(next); setState({ context, query: '', selectedId: null }) },
      onSelect: (record: FilterPreset) => { setState({ context, query: record.name, selectedId: record.id }); onActivate?.(record.id) },
    },
  }
}
