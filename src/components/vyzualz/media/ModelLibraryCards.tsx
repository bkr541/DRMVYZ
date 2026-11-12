import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { modelAssetRepository } from '../../../features/models/data/modelAssetRepository'
import type { ModelListCursor } from '../../../features/models/data/modelAssetRepository'
import type { ModelAsset } from '../../../features/models/domain/modelAssetTypes'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { AppIcon } from '../../shared/icons/AppIcon'
import { NoticeCard } from '../react/controls/NoticeCard'
import { IconChipButton } from '../react/controls/IconChipButton'
import { Collapsible } from '../react/ReactControlRows'
import { computeVirtualMediaWindow } from './mediaLibraryWindow'

function ModelThumbnail({ asset }: { asset: ModelAsset }) {
  const [url, setUrl] = useState<string | null>(null), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true; setUrl(null)
    if (asset.currentVersion) void modelAssetRepository.signedUrl(asset.id, asset.currentVersion, 'thumbnailPath')
      .then(result => { if (active) setUrl(result.url) }).catch(() => {})
    return () => { active = false }
  }, [asset.id, asset.currentVersion, retry])
  return url ? <img src={url} alt="" loading="lazy" onError={() => { setUrl(null); if (!retry) setRetry(1) }} /> : <AppIcon kind="layers" size={28} />
}
export function ModelLibraryCards({ search, favorites, viewMode, activeId, onSelect, sectioned = false, collectionId, searchControl }: {
  search: string; favorites: boolean; viewMode: 'grid' | 'list'; activeId: string | null; onSelect(asset: ModelAsset): void; sectioned?: boolean; collectionId?: string; searchControl?: ReactNode
}) {
  const libraryRevision = useModelEditorStore(s => s.libraryRevision)
  const accountId = useMediaStore(s => s.accountId)
  const draftId = useModelEditorStore(s => s.dirty ? s.id : null), draftName = useModelEditorStore(s => s.name)
  const [page, setPage] = useState<{ key: string; items: ModelAsset[]; cursor: ModelListCursor | null }>({ key: '', items: [], cursor: null })
  const key = JSON.stringify([accountId, search, favorites, collectionId, libraryRevision])
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0), [metrics, setMetrics] = useState({ width: 280, height: 320, scrollTop: 0 })
  const [expanded, setExpanded] = useState(true)
  const root = useRef<HTMLDivElement>(null), generation = useRef(0), inFlight = useRef(false)
  const items = page.key === key ? page.items : []
  useEffect(() => {
    const token = ++generation.current; inFlight.current = true; setLoading(true); setError(null)
    if (root.current) root.current.scrollTop = 0
    void modelAssetRepository.list({ search, favorite: favorites ? true : undefined, collectionId, includeDeletionPending: true, limit: 50 }).then(result => {
      if (generation.current === token) setPage({ key, items: result.items, cursor: result.nextCursor })
    }).catch(error => { if (generation.current === token) { setPage({ key, items: [], cursor: null }); setError(error instanceof Error ? error.message : 'Models could not be loaded.') } })
      .finally(() => { if (generation.current === token) { inFlight.current = false; setLoading(false) } })
    return () => { generation.current = token + 1 }
  }, [key, search, favorites, collectionId, refresh])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const update = () => setMetrics({ width: element.clientWidth || 280, height: element.clientHeight || 320, scrollTop: element.scrollTop })
    update(); element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null; observer?.observe(element)
    return () => { observer?.disconnect(); element.removeEventListener('scroll', update) }
  }, [expanded])
  const windowed = computeVirtualMediaWindow({ itemCount: items.length, ...metrics, viewMode, manager: true })
  const loadMore = async () => {
    if (inFlight.current || page.key !== key || !page.cursor) return
    inFlight.current = true; setLoading(true); setError(null); const token = generation.current
    try {
      const result = await modelAssetRepository.list({ search, favorite: favorites ? true : undefined, collectionId, includeDeletionPending: true, cursor: page.cursor, limit: 50 })
      if (generation.current === token) setPage(previous => ({ key, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()], cursor: result.nextCursor }))
    } catch (error) { if (generation.current === token) setError(error instanceof Error ? error.message : 'More models could not be loaded.') }
    finally { if (generation.current === token) { inFlight.current = false; setLoading(false) } }
  }
  const favorite = async (asset: ModelAsset) => {
    const token = generation.current; setBusy(asset.id); setError(null)
    try {
      const updated = await modelAssetRepository.update(asset.id, { favorite: !asset.favorite })
      useModelEditorStore.getState().acceptFavorite(updated.id, updated.favorite)
      if (generation.current === token) setPage(previous => ({ ...previous, items: previous.items.map(item => item.id === updated.id ? updated : item).filter(item => !favorites || item.favorite) }))
    } catch (error) { if (generation.current === token) setError(error instanceof Error ? error.message : 'The model favorite could not be updated.') }
    finally { setBusy(null) }
  }
  return <section className={`mm-model-library${sectioned ? ' mm-model-library--sectioned' : ''}`} aria-label="3D Models" data-expanded={expanded}>
    <Collapsible label="3D Models" icon={<AppIcon kind="layers" size={15} />} open={expanded} onOpenChange={setExpanded} bodyClassName="mm-model-group-body" headerAccessory={<span className="mm-model-count">{items.length}{page.key === key && page.cursor ? '+' : ''} loaded · Newest first</span>}>
    {searchControl}
    <div className="mm-model-card-scroll" ref={root}>
      {draftId && !favorites && !collectionId && draftName.toLowerCase().includes(search.toLowerCase()) && <div className="mm-model-draft-card" role="status"><AppIcon kind="layers" size={14} /> {draftName} · Draft / Unsaved</div>}
      {error && <NoticeCard tone="error" title="Model library unavailable" role="alert">{error} <IconChipButton onClick={() => setRefresh(n => n + 1)}>Retry models</IconChipButton></NoticeCard>}
      {!loading && !error && !items.length && <div className="vz-media-page-state">{search ? 'No models match this search.' : 'No saved 3D models.'}</div>}
      {windowed.topSpacer > 0 && <div style={{ height: windowed.topSpacer }} aria-hidden="true" />}
      <div className={viewMode === 'grid' ? 'vz-media-sheet' : 'vz-media-list'} style={viewMode === 'grid' ? { '--vz-sheet-tile': `${windowed.tileSize}px` } as CSSProperties : undefined}>
        {items.slice(windowed.startIndex, windowed.endIndex).map(asset => <div key={`model:${asset.id}`} className={`mm-model-card ${viewMode === 'list' ? 'mm-model-card--list' : ''}`}>
          <button type="button" className="mm-model-card-select" aria-label={`Select 3D model ${asset.name}`} aria-pressed={activeId === asset.id} onClick={() => onSelect(asset)}>
            <ModelThumbnail asset={asset} /><span className="mm-model-card-name">{asset.name}</span><span className="mm-model-card-type">{asset.status === 'deletion_pending' ? 'Deletion pending' : asset.currentVersion ? `3D · v${asset.currentVersion}` : 'Draft record'}</span>
          </button>
          <button type="button" className="mm-model-favorite" aria-label={`Favorite model ${asset.name}`} aria-pressed={asset.favorite} disabled={busy === asset.id || asset.status === 'deletion_pending'} onClick={() => { void favorite(asset) }}><AppIcon kind="star" size={12} /></button>
        </div>)}
      </div>
      {windowed.bottomSpacer > 0 && <div style={{ height: windowed.bottomSpacer }} aria-hidden="true" />}
      {loading && <div role="status" className="vz-media-page-state">Loading models…</div>}
      {page.key === key && page.cursor && <IconChipButton disabled={loading} onClick={() => { void loadMore() }}>Load more models</IconChipButton>}
    </div>
    </Collapsible>
  </section>
}
