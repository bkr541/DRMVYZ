import { useState } from 'react'
import { AppIcon } from '../../shared/icons/AppIcon'
import { InertButton, StarButton, StoreArt } from './StoreArt'
import { formatStoreDate, formatStorePrice, type StoreArtSpec, type StoreItem } from './storeCatalog'

interface PresetStoreDetailProps {
  item: StoreItem
  favorite: boolean
  onToggleFavorite: () => void
  onBack: () => void
}

/** Generated stand-in for the live visualizer preview; the shape is the same for a pack member and a single preset. */
function StorePreview({ name, engine, art, position }: { name: string; engine: string; art: StoreArtSpec; position?: string }) {
  return (
    <div className="pms-preview-stage" role="img" aria-label={`Preview of ${name}`}>
      <StoreArt art={art} className="pms-preview-art" fit="contain" />
      <span className="pms-badge pms-preview-badge">PREVIEW</span>
      <div className="pms-preview-caption">
        <strong>{name}</strong>
        <span>{engine}{position ? ` • ${position}` : ''}</span>
      </div>
    </div>
  )
}

/** A row the catalog has no value for is left out rather than shown empty. */
function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="pms-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * One detail layout for both kinds of store item: preview and summary on top,
 * then (packs only) the preset records inside the pack, then the details list.
 */
export function PresetStoreDetail({ item, favorite, onToggleFavorite, onBack }: PresetStoreDetailProps) {
  const isPack = item.kind === 'pack'
  const contents = item.contents ?? []
  const [previewIndex, setPreviewIndex] = useState(0)
  const previewed = isPack ? contents[Math.min(previewIndex, contents.length - 1)] : undefined
  const engines = item.engines.join(' + ')
  const free = item.priceCents === 0
  const { details } = item

  return (
    <article className="pms-detail" aria-label={`${item.name} details`} data-detail-kind={item.kind}>
      <button type="button" className="pms-back" onClick={onBack}>
        <AppIcon kind="left" size={11} color="currentColor" /> Back to Store
      </button>

      <div className="pms-detail-top">
        <section className="pms-detail-preview" aria-label="Preview">
          <StorePreview
            name={previewed?.name ?? item.name}
            engine={previewed?.engine ?? engines}
            art={previewed?.art ?? item.art}
            position={previewed ? `${previewIndex + 1} of ${contents.length}` : undefined}
          />
        </section>

        <aside className="pms-detail-summary" aria-label="Summary">
          <span className="pms-detail-kind">{item.subtitle}</span>
          <h2 className="pms-detail-title">{item.name}</h2>
          <span className="pms-detail-meta">{isPack ? `${contents.length} Presets • ${engines}` : engines}</span>
          <p className="pms-detail-desc">{item.description}</p>
          <div className="pms-detail-buy">
            {free ? <span className="pms-free">FREE</span> : <span className="pms-detail-price">{formatStorePrice(item.priceCents)}</span>}
            <InertButton className="pms-cta" label={free ? `Get ${item.name}` : `Buy ${item.name}`}>
              {free ? 'Get Preset' : isPack ? 'Buy Pack' : 'Buy Preset'}
            </InertButton>
            <StarButton item={item} favorite={favorite} onToggle={onToggleFavorite} />
          </div>
        </aside>
      </div>

      {isPack && (
        <section className="pms-section" aria-label="Presets in this pack">
          <header className="pms-section-head"><h3>Presets in this pack ({contents.length})</h3></header>
          <div className="pms-grid pms-grid--contents">
            {contents.map((preset, index) => (
              <button
                key={preset.id}
                type="button"
                className={`pms-content-row${index === previewIndex ? ' is-active' : ''}`}
                aria-pressed={index === previewIndex}
                aria-label={`Preview ${preset.name}`}
                data-pack-preset={preset.id}
                onClick={() => setPreviewIndex(index)}
              >
                <StoreArt art={preset.art} className="pms-content-art" />
                <span className="pms-content-copy">
                  <strong>{preset.name}</strong>
                  <span className="pms-content-engine">{preset.engine}</span>
                  {preset.description && <span className="pms-content-desc">{preset.description}</span>}
                </span>
                {index === previewIndex && <span className="pms-content-state">Previewing</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="pms-section" aria-label={isPack ? 'Pack details' : 'Preset details'}>
        <header className="pms-section-head"><h3>{isPack ? 'Pack Details' : 'Preset Details'}</h3></header>
        <dl className="pms-detail-list">
          <DetailRow label="Type" value={item.subtitle} />
          {isPack && <DetailRow label="Presets" value={String(contents.length)} />}
          <DetailRow label={item.engines.length > 1 ? 'Engines' : 'Engine'} value={engines} />
          <DetailRow label="Category" value={details.category} />
          <DetailRow label="Author" value={details.author} />
          <DetailRow label="Version" value={details.version} />
          <DetailRow label="Download Size" value={details.sizeMb === undefined ? undefined : `${details.sizeMb} MB`} />
          <DetailRow label="Released" value={formatStoreDate(item.releasedAt)} />
          <DetailRow label="License" value={details.license} />
          <DetailRow label="Tags" value={details.tags.length > 0 ? details.tags.join(', ') : undefined} />
        </dl>
      </section>
    </article>
  )
}
