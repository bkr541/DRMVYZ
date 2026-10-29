import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import {
  DEFAULT_STORE_QUERY,
  MOCK_STORE_CATALOG,
  STORE_SECTIONS,
  findStoreItem,
  formatStorePrice,
  isStoreQueryActive,
  matchStoreItems,
  storeBannerItems,
  storeEngineNames,
  storeSectionItems,
  type StoreCatalog,
  type StoreItem,
  type StoreSectionId,
  type StoreSortId,
} from './storeCatalog'
import { PresetStoreDetail } from './PresetStoreDetail'
import { StarButton, StoreArt } from './StoreArt'
import '../../../styles/presetStore.css'

const SORT_OPTIONS: { value: StoreSortId; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceLow', label: 'Price: Low to High' },
  { value: 'priceHigh', label: 'Price: High to Low' },
  { value: 'name', label: 'Name (A–Z)' },
]
const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'pack', label: 'Packs' },
  { value: 'preset', label: 'Presets' },
]
const PRICE_OPTIONS = [
  { value: 'all', label: 'Any Price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
]

export function CartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2.4l2.2 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.76L20 8H6.2" />
      <circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" />
    </svg>
  )
}

function PackCard({ item, onOpen }: { item: StoreItem; onOpen: () => void }) {
  return (
    <article className="pms-pack" data-store-item={item.id} onClick={onOpen}>
      <StoreArt art={item.art} className="pms-pack-art" />
      <div className="pms-pack-copy">
        <button type="button" className="pms-open" onClick={onOpen} aria-label={`Open ${item.name}`}>{item.name}</button>
        <span className="pms-pack-kind">{item.subtitle}</span>
        <span className="pms-pack-meta">{item.presetCount} Presets • {item.engines.join(' + ')}</span>
        <span className="pms-price">{formatStorePrice(item.priceCents)}</span>
      </div>
      <AppIcon kind="chevronRight" size={14} color="currentColor" className="pms-pack-chevron" />
    </article>
  )
}

function PresetStoreCard({ item, favorite, onToggleFavorite, onOpen }: { item: StoreItem; favorite: boolean; onToggleFavorite: () => void; onOpen: () => void }) {
  const free = item.priceCents === 0
  return (
    <article className="pms-preset" data-store-item={item.id} onClick={onOpen}>
      <StoreArt art={item.art} className="pms-preset-art" />
      <div className="pms-preset-copy">
        {item.isNew && <span className="pms-new">NEW</span>}
        <button type="button" className="pms-open" onClick={onOpen} aria-label={`Open ${item.name}`}>{item.name}</button>
        <span className="pms-preset-kind">{item.subtitle}</span>
        <span className="pms-preset-desc">{item.description}</span>
        <span className="pms-preset-engine">{item.engines.join(' + ')}</span>
        <div className="pms-preset-foot">
          {free ? <span className="pms-free">FREE</span> : <span className="pms-price">{formatStorePrice(item.priceCents)}</span>}
          <button type="button" className="pms-preview" onClick={onOpen} aria-label={`Preview ${item.name}`}>
            Preview <AppIcon kind="play" size={9} color="currentColor" />
          </button>
        </div>
      </div>
      <StarButton item={item} favorite={favorite} onToggle={onToggleFavorite} />
    </article>
  )
}

function StoreItemCard({ item, favorite, onToggleFavorite, onOpen }: { item: StoreItem; favorite: boolean; onToggleFavorite: () => void; onOpen: () => void }) {
  return item.kind === 'pack'
    ? <PackCard item={item} onOpen={onOpen} />
    : <PresetStoreCard item={item} favorite={favorite} onToggleFavorite={onToggleFavorite} onOpen={onOpen} />
}

function Banner({ items, onOpen }: { items: readonly StoreItem[]; onOpen: (id: string) => void }) {
  const [index, setIndex] = useState(0)
  const item = items[Math.min(index, items.length - 1)]
  if (!item) return null
  const words = item.name.toUpperCase().split(' ')
  return (
    <section className="pms-banner" aria-label="Featured" data-store-item={item.id}>
      <StoreArt art={item.art} className="pms-banner-art" />
      <div className="pms-banner-shade" aria-hidden="true" />
      <div className="pms-banner-copy">
        <span className="pms-badge">FEATURED</span>
        <h2 className="pms-banner-title">{words.map(word => <span key={word}>{word}</span>)}</h2>
        <span className="pms-banner-kind">{item.subtitle.toUpperCase()}</span>
        <span className="pms-banner-meta">{item.presetCount} Presets <b aria-hidden="true">•</b> {item.engines.join(' + ')}</span>
        <p>{item.description}</p>
        <div className="pms-banner-actions">
          <span className="pms-banner-price">{formatStorePrice(item.priceCents)}</span>
          <button type="button" className="pms-cta" onClick={() => onOpen(item.id)} aria-label={`Explore ${item.name}`}>
            Explore Pack <AppIcon kind="right" size={12} color="currentColor" />
          </button>
        </div>
      </div>
      <div className="pms-dots" role="tablist" aria-label="Featured packs">
        {items.map((candidate, dot) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={dot === index}
            aria-label={candidate.name}
            className={`pms-dot${dot === index ? ' is-active' : ''}`}
            onClick={() => setIndex(dot)}
          />
        ))}
      </div>
    </section>
  )
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <header className="pms-section-head">
      <h3>{title}</h3>
      {onViewAll && (
        <button type="button" className="pms-view-all" onClick={onViewAll}>
          View All <AppIcon kind="right" size={11} color="currentColor" />
        </button>
      )}
    </header>
  )
}

export function PresetStore({ catalog = MOCK_STORE_CATALOG }: { catalog?: StoreCatalog }) {
  const [query, setQuery] = useState(DEFAULT_STORE_QUERY)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [section, setSection] = useState<StoreSectionId | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(() => new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const engineOptions = useMemo(
    () => [{ value: 'all', label: 'All Engines' }, ...storeEngineNames(catalog).map(engine => ({ value: engine, label: engine }))],
    [catalog],
  )
  const banner = useMemo(() => storeBannerItems(catalog), [catalog])
  const results = useMemo(() => matchStoreItems(catalog, query), [catalog, query])
  const searching = isStoreQueryActive(query)
  const activeFilterCount = Number(query.type !== 'all') + Number(query.price !== 'all') + Number(query.engine !== 'all')
  const detailItem = detailId ? findStoreItem(catalog, detailId) : null
  const sectionTitle = STORE_SECTIONS.find(candidate => candidate.id === section)?.title

  const toggleFavorite = (id: string) => setFavoriteIds(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const patch = (next: Partial<typeof query>) => {
    setDetailId(null)
    setSection(null)
    setQuery(current => ({ ...current, ...next }))
  }
  const renderCards = (items: readonly StoreItem[]) => items.map(item => (
    <StoreItemCard key={item.id} item={item} favorite={favoriteIds.has(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} onOpen={() => setDetailId(item.id)} />
  ))

  // A new page of the store always starts at the top.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [detailId, section])

  return (
    <div className="pms-root" role="tabpanel" aria-label="Preset Store">
      <div className="pms-toolbar">
        <PresetSearchRow
          className="pms-search"
          query={query.text}
          onQueryChange={text => patch({ text })}
          placeholder="Search presets, packs, and effects…"
          ariaLabel="Search the store"
        />
        <button
          type="button"
          className={`pms-filter-btn${filtersOpen || activeFilterCount > 0 ? ' is-active' : ''}`}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(open => !open)}
        >
          <AppIcon kind="sliders" size={14} color="currentColor" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <label className="pms-sort">
          <span>Sort</span>
          <UnderlineDropdown
            id="preset-store-sort"
            value={query.sort}
            options={SORT_OPTIONS}
            onChange={value => patch({ sort: value as StoreSortId })}
            ariaLabel="Sort store items"
            menuLabel="Sort store items"
            title="Sort store items"
            size="dense"
            menuWidth={190}
            showDescriptions={false}
            className="pms-sort-dropdown"
          />
        </label>
      </div>

      {filtersOpen && (
        <div className="pms-filters" role="group" aria-label="Store filters">
          {([
            ['type', TYPE_OPTIONS, 'Item type'],
            ['price', PRICE_OPTIONS, 'Price'],
            ['engine', engineOptions, 'Engine'],
          ] as const).map(([key, options, label]) => (
            <UnderlineDropdown
              key={key}
              id={`preset-store-${key}`}
              value={query[key]}
              options={options}
              onChange={value => patch({ [key]: value })}
              ariaLabel={label}
              menuLabel={label}
              title={label}
              size="dense"
              menuWidth={170}
              showDescriptions={false}
              className="pms-filter-dropdown"
            />
          ))}
          {activeFilterCount > 0 && (
            <button type="button" className="pms-clear" onClick={() => patch({ type: 'all', price: 'all', engine: 'all' })}>Clear filters</button>
          )}
        </div>
      )}

      <div className="pms-scroll" ref={scrollRef}>
        {detailItem ? (
          <PresetStoreDetail
            key={detailItem.id}
            item={detailItem}
            favorite={favoriteIds.has(detailItem.id)}
            onToggleFavorite={() => toggleFavorite(detailItem.id)}
            onBack={() => setDetailId(null)}
          />
        ) : searching ? (
          <section className="pms-section" aria-label="Search results">
            <SectionHeader title={`Results (${results.length})`} />
            {results.length > 0
              ? <div className="pms-grid">{renderCards(results)}</div>
              : <div className="pms-empty">No store items match your search.</div>}
          </section>
        ) : section ? (
          <section className="pms-section" aria-label={sectionTitle}>
            <button type="button" className="pms-back" onClick={() => setSection(null)}>
              <AppIcon kind="left" size={11} color="currentColor" /> Back to Store
            </button>
            <SectionHeader title={sectionTitle ?? ''} />
            <div className="pms-grid">{renderCards(storeSectionItems(catalog, section, query.sort))}</div>
          </section>
        ) : (
          <>
            <Banner items={banner} onOpen={setDetailId} />
            {STORE_SECTIONS.map(({ id, title }) => {
              const items = storeSectionItems(catalog, id, query.sort)
              if (items.length === 0) return null
              return (
                <section key={id} className="pms-section" aria-label={title}>
                  <SectionHeader title={title} onViewAll={() => setSection(id)} />
                  <div className={id === 'packs' ? 'pms-grid pms-grid--packs' : 'pms-grid'}>{renderCards(items.slice(0, id === 'packs' ? 2 : 3))}</div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
