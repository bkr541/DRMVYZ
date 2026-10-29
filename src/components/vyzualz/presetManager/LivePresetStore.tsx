import { PresetStore } from './PresetStore'
import { MOCK_STORE_CATALOG } from './storeCatalog'
import { useStoreCatalogSource } from './storeCatalogSource'

/** The Store backed by the database; the sample catalog stands in, with a visible reason, when the database has nothing to show. */
export function LivePresetStore() {
  const source = useStoreCatalogSource()
  if (source.status === 'loading') {
    return (
      <div className="pms-root" role="status" aria-label="Preset Store">
        <div className="pms-empty">Loading the store…</div>
      </div>
    )
  }
  return source.status === 'database'
    ? <PresetStore catalog={source.catalog} />
    : <PresetStore catalog={MOCK_STORE_CATALOG} notice={`Showing sample data. ${source.reason}`} />
}
