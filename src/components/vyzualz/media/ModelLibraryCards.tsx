import { BUILTIN_MODELS, type BuiltinModel } from '../../../features/models/domain/builtinModels'
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
import { computeVirtualMediaWindow, MEDIA_SHEET_GAP } from './mediaLibraryWindow'

const MIN_MODEL_TILE = 120
const MAX_MODEL_TILE = 192
const MODEL_LIST_ROW_HEIGHT = 84

function ModelThumbnail({ asset }: { asset: ModelAsset }) {
  const [url, setUrl] = useState<string | null>(null), [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true; setUrl(null)
    if (asset.currentVersion) void modelAssetRepository.signedUrl(asset.id, asset.currentVersion, 'thumbnailPath')
      .then(result => { if (active) setUrl(result.url) }).catch(() => {})
    return () => { active = false }
  }, [asset.id, asset.currentVersion, retry])
  return url ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => { setUrl(null); if (!retry) setRetry(1) }} /> : <AppIcon kind="layers" size={28} />
}
export function ModelLibraryCards({ search, favorites, viewMode, activeId, onSelect, sectioned = false, collectionId, searchControl, onSelectBuiltin }: {
  search: string; favorites: boolean; viewMode: 'grid' | 'list'; activeId: string | null; onSelect(asset: ModelAsset): void; onSelectBuiltin?(model: BuiltinModel): void; sectioned?: boolean; collectionId?: string; searchControl?: ReactNode
}) {
  const libraryRevision = useModelEditorStore(s => s.libraryRevision)
  const accountId = useMediaStore(s => s.accountId)
  const draftId = useModelEditorStore(s => s.dirty ? s.id : null), draftName = useModelEditorStore(s => s.name)
  const showBuiltins = !!onSelectBuiltin && !favorites
  const [page, setPage] = useState<{ key: string; items: ModelAsset[]; cursor: ModelListCursor | null; builtinIds: BuiltinModel['id'][] }>({ key: '', items: [], cursor: null, builtinIds: [] })
  const key = JSON.stringify([accountId, search, favorites, collectionId, libraryRevision, showBuiltins])
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0), [metrics, setMetrics] = useState({ width: 280, height: 320, scrollTop: 0 })
  const [expanded, setExpanded] = useState(true)
  const root = useRef<HTMLDivElement>(null), generation = useRef(0), inFlight = useRef(false)
  const items = page.key === key ? page.items : []
  useEffect(() => {
    const token = ++generation.current; inFlight.current = true; setLoading(true); setError(null)
    if (root.current) root.current.scrollTop = 0
    void Promise.allSettled([
      modelAssetRepository.list({ search, favorite: favorites ? true : undefined, collectionId, includeDeletionPending: true, limit: 50 }),
      showBuiltins && collectionId ? modelAssetRepository.listBuiltinModelsInCollection(collectionId) : Promise.resolve([]),
    ]).then(([models, builtins]) => {
      if (generation.current !== token) return
      setPage({
        key, items: models.status === 'fulfilled' ? models.value.items : [],
        cursor: models.status === 'fulfilled' ? models.value.nextCursor : null,
        builtinIds: builtins.status === 'fulfilled' ? builtins.value : [],
      })
      const failure = models.status === 'rejected' ? models.reason : builtins.status === 'rejected' ? builtins.reason : null
      if (failure) setError(failure instanceof Error ? failure.message : 'Models could not be loaded.')
      inFlight.current = false
      setLoading(false)
    })
    return () => { generation.current = token + 1 }
  }, [key, search, favorites, collectionId, showBuiltins, refresh])
  useEffect(() => {
    const element = root.current
    if (!element) return
    const update = () => {
      const style = getComputedStyle(element)
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      setMetrics({ width: Math.max(0, element.clientWidth - padding) || 280, height: element.clientHeight || 320, scrollTop: element.scrollTop })
    }
    update(); element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null; observer?.observe(element)
    return () => { observer?.disconnect(); element.removeEventListener('scroll', update) }
  }, [expanded])
  const builtins = showBuiltins ? BUILTIN_MODELS.filter(model =>
    (!collectionId || (page.key === key && page.builtinIds.includes(model.id)))
      && `${model.name} ${model.description}`.toLowerCase().includes(search.trim().toLowerCase())) : []
  const rows = [...builtins.map(model => ({kind:'builtin' as const,model})), ...items.map(asset => ({kind:'saved' as const,asset}))]
  const gridColumns = metrics.width >= MIN_MODEL_TILE * 2 + MEDIA_SHEET_GAP ? 2 : 1
  const windowed = computeVirtualMediaWindow({
    itemCount: rows.length, ...metrics, viewMode, manager: true, gridColumns, listRowHeight: MODEL_LIST_ROW_HEIGHT,
    width: Math.min(metrics.width, gridColumns * MAX_MODEL_TILE + (gridColumns - 1) * MEDIA_SHEET_GAP),
  })
  const cardLayout = viewMode === 'grid' ? {
    '--vz-sheet-tile': `${windowed.tileSize}px`,
    gridTemplateColumns: `repeat(${windowed.columns}, var(--vz-sheet-tile))`,
  } : { '--mm-model-list-card-height': `${windowed.rowHeight - MEDIA_SHEET_GAP}px` }
  const loadMore = async () => {
    if (inFlight.current || page.key !== key || !page.cursor) return
    inFlight.current = true; setLoading(true); setError(null); const token = generation.current
    try {
      const result = await modelAssetRepository.list({ search, favorite: favorites ? true : undefined, collectionId, includeDeletionPending: true, cursor: page.cursor, limit: 50 })
      if (generation.current === token) setPage(previous => ({ ...previous, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()], cursor: result.nextCursor }))
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
    <Collapsible label="3D Models" icon={<AppIcon kind="layers" size={15} />} open={expanded} onOpenChange={setExpanded} bodyClassName="mm-model-group-body">
    {searchControl}
    <div className="mm-model-card-scroll" ref={root}>
      {draftId && !favorites && !collectionId && draftName.toLowerCase().includes(search.toLowerCase()) && <div className="mm-model-draft-card" role="status"><AppIcon kind="layers" size={14} /> {draftName} · Draft / Unsaved</div>}
      {error && <NoticeCard tone="error" title="Model library unavailable" role="alert">{error} <IconChipButton onClick={() => setRefresh(n => n + 1)}>Retry models</IconChipButton></NoticeCard>}
      {!loading && !error && !rows.length && <div className="vz-media-page-state">{search ? 'No models match this search.' : 'No saved 3D models.'}</div>}
      {windowed.topSpacer > 0 && <div style={{ height: windowed.topSpacer }} aria-hidden="true" />}
      <div className={viewMode === 'grid' ? 'vz-media-sheet' : 'vz-media-list mm-model-card-list'} style={cardLayout as CSSProperties}>
        {rows.slice(windowed.startIndex, windowed.endIndex).map(row => {
          const asset = row.kind === 'saved' ? row.asset : null
          const model = row.kind === 'builtin' ? row.model : row.asset
          const type = !asset ? 'Conduit' : asset.status === 'deletion_pending' ? 'Deletion pending' : asset.currentVersion ? `3D · v${asset.currentVersion}` : 'Draft record'
          return <div key={`${row.kind}:${model.id}`} className={`mm-model-card ${viewMode === 'list' ? 'mm-model-card--list' : ''}`}>
            <button type="button" className="mm-model-card-select" aria-label={`Select 3D model ${model.name}`} aria-pressed={activeId === model.id}
              onClick={() => { if (row.kind === 'builtin') onSelectBuiltin?.(row.model); else onSelect(row.asset) }}>
              <span className="mm-model-card-preview">
                {row.kind === 'builtin' ? <img src={row.model.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                  : <ModelThumbnail key={row.asset.currentVersion} asset={row.asset} />}
              </span>
              <span className="mm-model-card-text">
                <span className="mm-model-card-name" title={model.name}>{model.name}</span>
                <span className="mm-model-card-type">{type}</span>
              </span>
            </button>
            {asset && <button type="button" className="mm-model-favorite" aria-label={`Favorite model ${asset.name}`} aria-pressed={asset.favorite}
              disabled={busy === asset.id || asset.status === 'deletion_pending'} onClick={() => { void favorite(asset) }}><AppIcon kind="star" size={12} /></button>}
          </div>
        })}
      </div>
      {windowed.bottomSpacer > 0 && <div style={{ height: windowed.bottomSpacer }} aria-hidden="true" />}
      {loading && <div role="status" className="vz-media-page-state">Loading models…</div>}
      {page.key === key && page.cursor && <IconChipButton disabled={loading} onClick={() => { void loadMore() }}>Load more models</IconChipButton>}
    </div>
    </Collapsible>
  </section>
}
