import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { TextInputRow } from '../../react/ReactControlRows'
import { IconChipButton } from '../../react/controls/IconChipButton'
import { DrawerNotice } from '../../shared/DrawerNotice'
import { useMediaStore } from '../../../../stores/mediaStore'
import { modelAssetRepository, type ModelListCursor } from '../../../../features/models/data/modelAssetRepository'
import type { ModelAsset, ModelAssetVersion } from '../../../../features/models/domain/modelAssetTypes'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding, serializeUserModelBinding } from './Cinema2ModelBinding'
import './Cinema2ModelSelector.css'
export const Cinema2ModelSelectorContext = createContext<{ openManager?: () => void; runtime?: Cinema2Runtime }>({})
export function Cinema2ModelSelector({ id, label, value, disabled, onChange, versionsOnly = false }: { id: string; label: string; value: unknown; disabled: boolean; onChange(value: string): void; versionsOnly?: boolean }) {
  const account = useMediaStore(s => s.accountId), { openManager } = useContext(Cinema2ModelSelectorContext)
  const requestKey = useRef(''), selectionSerial = useRef(0)
  const [search, setSearch] = useState(''), [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState<{ items: ModelAsset[]; cursor: ModelListCursor | null }>({ items: [], cursor: null })
  const [selected, setSelected] = useState<{ asset: ModelAsset; version: number; record: ModelAssetVersion } | null>(null), [thumbnail, setThumbnail] = useState<string | null>(null)
  const [versions, setVersions] = useState<ModelAssetVersion[]>([])
  const [versionLoading, setVersionLoading] = useState(false)
  const [versionHasMore, setVersionHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false), [selecting, setSelecting] = useState(false), [imageRetry, setImageRetry] = useState(0)
  requestKey.current = JSON.stringify([account, search, refresh])
  useEffect(() => { setSelecting(false); return () => { selectionSerial.current++ } }, [account, value])
  useEffect(() => {
    if (versionsOnly) return
    let active = true; setLoading(true); setError(null); setPage({ items: [], cursor: null })
    const timer = setTimeout(() => { void modelAssetRepository.list({ search, limit: 50 }).then(result => { if (active) setPage({ items: result.items.filter(a => a.status === 'ready'), cursor: result.nextCursor }) }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Models are unavailable.') }).finally(() => { if (active) setLoading(false) }) }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [account, search, refresh, versionsOnly])
  useEffect(() => {
    let active = true; setSelected(null); setThumbnail(null); setImageRetry(0)
    try {
      const binding = parseUserModelBinding(value)
      if (binding.kind === 'user-model') void Promise.all([modelAssetRepository.get(binding.modelAssetId), modelAssetRepository.getVersion(binding.modelAssetId, binding.version)]).then(([asset, record]) => {
        if (!active) return
        if (asset.status !== 'ready') throw new Error('This model has been deleted or is unavailable.')
        setSelected({ asset, version: binding.version, record })
      }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'The pinned model is unavailable.') })
    } catch (error) { setError(error instanceof Error ? error.message : 'Invalid model selection.') }
    return () => { active = false }
  }, [account, value, refresh])
  useEffect(() => {
    let active = true
    if (selected) void modelAssetRepository.signedUrl(selected.asset.id, selected.version, 'thumbnailPath').then(result => { if (active) setThumbnail(result.url) }).catch(() => {})
    return () => { active = false }
  }, [selected, imageRetry])
  const selectedId = selected?.asset.id
  useEffect(() => {
    let active = true; setVersions([]); setVersionHasMore(false); setVersionLoading(false)
    if (selectedId) {
      setVersionLoading(true)
      void modelAssetRepository.listVersions(selectedId).then(rows => { if (active) { setVersions(rows); setVersionHasMore(rows.length === 50) } }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Version history unavailable.') }).finally(() => { if (active) setVersionLoading(false) })
    }
    return () => { active = false }
  }, [account, selectedId, refresh])
  const choose = async (next: string) => {
    const token = ++selectionSerial.current
    if (next === DEFAULT_MODEL_BINDING) { setError(null); setSelecting(false); onChange(next); return }
    setSelecting(true); setError(null)
    try {
      const binding = parseUserModelBinding(next)
      if (binding.kind !== 'user-model') return
      const asset = await modelAssetRepository.get(binding.modelAssetId)
      await modelAssetRepository.getVersion(asset.id, binding.version)
      if (token !== selectionSerial.current) return
      if (asset.status !== 'ready' || useMediaStore.getState().accountId !== account) throw new Error('This model is unavailable to the current account.')
      onChange(serializeUserModelBinding(binding))
    } catch (error) { if (token === selectionSerial.current) setError(error instanceof Error ? error.message : 'Model selection failed.') }
    finally { if (token === selectionSerial.current) setSelecting(false) }
  }
  const options = [{ value: DEFAULT_MODEL_BINDING, label: 'No model', description: 'Leave the model slot empty' }, ...page.items.map(asset => ({ value: serializeUserModelBinding({ kind: 'user-model', modelAssetId: asset.id, version: asset.currentVersion }), label: `${asset.name} · v${asset.currentVersion}`, description: 'Pin this immutable version' }))]
  if (selected && !options.some(option => option.value === value)) options.push({ value: String(value), label: `${selected.asset.name} · v${selected.version}`, description: 'Current pinned selection' })
  const versionOptions = selected ? [...new Map([selected.record, ...versions].map(record => [record.version, record])).values()].sort((a,b) => b.version-a.version).map(record => ({value: String(record.version), label: `Version ${record.version}${record.version === selected.asset.currentVersion ? ' (latest)' : ''}`})) : []
  const stats = selected?.record.geometryStats
  return <div className="rv-ctrl-row" data-cinema2-model-selector>
    {!versionsOnly && <><label className="rv-ctrl-label" htmlFor={id}>{label}</label>
    <div className="cinema2-model-selection">{thumbnail ? <img src={thumbnail} alt="Selected model thumbnail" onError={() => { setThumbnail(null); if (!imageRetry) setImageRetry(1) }} /> : <AppIcon kind="layers" size={28} />}<span>{selected ? `${selected.asset.name} · v${selected.version} (pinned)` : value === DEFAULT_MODEL_BINDING ? 'No model' : 'Pinned model unavailable'}</span></div>
    <TextInputRow label="Search saved models" value={search} maxLength={200} disabled={disabled} onChange={setSearch} placeholder="Search your models…" />
    <Dropdown triggerId={id} ariaLabel={label} value={typeof value === 'string' ? value : DEFAULT_MODEL_BINDING} options={options} disabled={disabled || selecting} onChange={next => { void choose(next) }} size="compact" /></>}
    {selected && <>
      <Dropdown ariaLabel="Saved model version" value={String(selected.version)} options={versionOptions} disabled={disabled || selecting || versionLoading} onChange={next => { void choose(serializeUserModelBinding({ kind: 'user-model', modelAssetId: selected.asset.id, version: Number(next) })) }} size="compact" />
      {versionHasMore && <IconChipButton disabled={disabled || versionLoading} onClick={() => {
        const assetId = selected.asset.id, token = selectionSerial.current, before = versions.at(-1)?.version
        if (!before) return
        setVersionLoading(true)
        void modelAssetRepository.listVersions(assetId, before).then(rows => { if (token === selectionSerial.current) { setVersions(previous => [...new Map([...previous, ...rows].map(row => [row.version, row])).values()]); setVersionHasMore(rows.length === 50) } }).catch(error => { if (token === selectionSerial.current) setError(error instanceof Error ? error.message : 'More versions unavailable.') }).finally(() => { if (token === selectionSerial.current) setVersionLoading(false) })
      }}>Load older versions</IconChipButton>}
      {stats && <details className="rv-ctrl-info"><summary>Model details</summary><div>{stats.imported?.fileName ?? selected.asset.name}</div><div>{stats.triangles.toLocaleString()} triangles · {stats.meshes} meshes · {stats.materialCount ?? '—'} materials</div><div>{stats.imported?.imageCount ?? 0} embedded images · {stats.glbBytes ? `${(stats.glbBytes / 1048576).toFixed(1)} MiB GLB` : 'Size unavailable'}</div><div>Bounds: {stats.bounds.max.map((n,i) => (n-stats.bounds.min[i]!).toFixed(2)).join(' × ')}</div><div>{stats.imported?.gpuBytesEstimate ? `Estimated source buffers/textures: ${(stats.imported.gpuBytesEstimate / 1048576).toFixed(1)} MiB` : 'GPU estimate unavailable'}</div>{stats.imported?.warnings?.map(warning => <div key={warning}>{warning}</div>)}<div>Recommended quality: {stats.triangles > 40000 || (stats.imported?.maxImageSide ?? 0) > 4096 ? 'Auto / Performance' : 'Auto'}</div></details>}
    </>}
    {versionsOnly && !selected && !error && <span role="status">Loading pinned model details…</span>}
    {!versionsOnly && <>
    {loading && <span role="status">Loading saved models…</span>}
    {!loading && !page.items.length && !error && <p>No saved models match. Create a 3D model in Media Manager.</p>}
    {page.cursor && <IconChipButton disabled={loading} onClick={() => {
      const key = requestKey.current, cursor = page.cursor; setLoading(true)
      void modelAssetRepository.list({ search, cursor: cursor!, limit: 50 }).then(result => { if (requestKey.current === key) setPage(p => ({ items: [...new Map([...p.items, ...result.items.filter(a => a.status === 'ready')].map(a => [a.id, a])).values()], cursor: result.nextCursor })) }).catch(error => setError(error instanceof Error ? error.message : 'More models could not be loaded.')).finally(() => setLoading(false))
    }}>Load more models</IconChipButton>}
    <IconChipButton disabled={!openManager} onClick={openManager}>Open Model Library</IconChipButton></>}
    {error && <DrawerNotice tone="warning" title="Model unavailable" role="alert">{error} <IconChipButton onClick={() => setRefresh(n => n + 1)}>Retry models</IconChipButton></DrawerNotice>}
  </div>
}
