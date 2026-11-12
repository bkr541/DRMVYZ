import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { TextInputRow } from '../../react/ReactControlRows'
import { IconChipButton } from '../../react/controls/IconChipButton'
import { NoticeCard } from '../../react/controls/NoticeCard'
import { useMediaStore } from '../../../../stores/mediaStore'
import { modelAssetRepository, type ModelListCursor } from '../../../../features/models/data/modelAssetRepository'
import type { ModelAsset } from '../../../../features/models/domain/modelAssetTypes'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding, serializeUserModelBinding } from './Cinema2ModelBinding'
import './Cinema2ModelSelector.css'
export const Cinema2ModelSelectorContext = createContext<{ openManager?: () => void; runtime?: Cinema2Runtime }>({})
export function Cinema2ModelSelector({ id, label, value, disabled, onChange }: { id: string; label: string; value: unknown; disabled: boolean; onChange(value: string): void }) {
  const account = useMediaStore(s => s.accountId), { openManager, runtime } = useContext(Cinema2ModelSelectorContext)
  const [runtimeNotice, setRuntimeNotice] = useState<{ code: string; message: string } | null>(null)
  useEffect(() => {
    if (!runtime) return
    const update = () => { const diagnostic = runtime.getModuleRuntimeSnapshot().modules.flatMap(module => module.diagnostics).find(entry => entry.code.startsWith('CINEMA2_USER_MODEL_')); setRuntimeNotice(previous => previous?.code === diagnostic?.code && previous?.message === diagnostic?.message ? previous : diagnostic ? { code: diagnostic.code, message: diagnostic.message } : null) }
    update(); const timer = setInterval(update, 500); return () => clearInterval(timer)
  }, [runtime, value])
  const requestKey = useRef(''), selectionSerial = useRef(0)
  const [search, setSearch] = useState(''), [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState<{ items: ModelAsset[]; cursor: ModelListCursor | null }>({ items: [], cursor: null })
  const [selected, setSelected] = useState<{ asset: ModelAsset; version: number } | null>(null), [thumbnail, setThumbnail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(false), [selecting, setSelecting] = useState(false), [imageRetry, setImageRetry] = useState(0)
  requestKey.current = JSON.stringify([account, search, refresh])
  useEffect(() => () => { selectionSerial.current++ }, [account, value])
  useEffect(() => {
    let active = true; setLoading(true); setError(null); setPage({ items: [], cursor: null })
    const timer = setTimeout(() => { void modelAssetRepository.list({ search, limit: 50 }).then(result => { if (active) setPage({ items: result.items.filter(a => a.status === 'ready'), cursor: result.nextCursor }) }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Models are unavailable.') }).finally(() => { if (active) setLoading(false) }) }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [account, search, refresh])
  useEffect(() => {
    let active = true; setSelected(null); setThumbnail(null); setImageRetry(0)
    try {
      const binding = parseUserModelBinding(value)
      if (binding.kind === 'user-model') void Promise.all([modelAssetRepository.get(binding.modelAssetId), modelAssetRepository.getVersion(binding.modelAssetId, binding.version)]).then(([asset]) => {
        if (!active) return
        if (asset.status !== 'ready') throw new Error('This model has been deleted or is unavailable.')
        setSelected({ asset, version: binding.version })
      }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'The pinned model is unavailable.') })
    } catch (error) { setError(error instanceof Error ? error.message : 'Invalid model selection.') }
    return () => { active = false }
  }, [account, value, refresh])
  useEffect(() => {
    let active = true
    if (selected) void modelAssetRepository.signedUrl(selected.asset.id, selected.version, 'thumbnailPath').then(result => { if (active) setThumbnail(result.url) }).catch(() => {})
    return () => { active = false }
  }, [selected, imageRetry])
  const choose = async (next: string) => {
    const token = ++selectionSerial.current
    if (next === DEFAULT_MODEL_BINDING) { setError(null); onChange(next); return }
    setSelecting(true); setError(null)
    try {
      const binding = parseUserModelBinding(next)
      if (binding.kind !== 'user-model') return
      const asset = await modelAssetRepository.get(binding.modelAssetId)
      await modelAssetRepository.getVersion(asset.id, binding.version)
      if (token !== selectionSerial.current) return
      if (asset.status !== 'ready' || useMediaStore.getState().accountId !== account) throw new Error('This model is unavailable to the current account.')
      onChange(serializeUserModelBinding(binding))
    } catch (error) { setError(error instanceof Error ? error.message : 'Model selection failed.') }
    finally { setSelecting(false) }
  }
  const options = [{ value: DEFAULT_MODEL_BINDING, label: 'Default model', description: 'Neutral built-in placeholder' }, ...page.items.map(asset => ({ value: serializeUserModelBinding({ kind: 'user-model', modelAssetId: asset.id, version: asset.currentVersion }), label: `${asset.name} · v${asset.currentVersion}`, description: 'Pin this immutable version' }))]
  if (selected && !options.some(option => option.value === value)) options.push({ value: String(value), label: `${selected.asset.name} · v${selected.version}`, description: 'Current pinned selection' })
  return <div className="rv-ctrl-row" data-cinema2-model-selector>
    <label className="rv-ctrl-label" htmlFor={id}>{label}</label>
    <div className="cinema2-model-selection">{thumbnail ? <img src={thumbnail} alt="Selected model thumbnail" onError={() => { setThumbnail(null); if (!imageRetry) setImageRetry(1) }} /> : <AppIcon kind="layers" size={28} />}<span>{selected ? `${selected.asset.name} · v${selected.version} (pinned)` : value === DEFAULT_MODEL_BINDING ? 'Default model' : 'Pinned model unavailable'}</span></div>
    <TextInputRow label="Search saved models" value={search} maxLength={200} disabled={disabled} onChange={setSearch} placeholder="Search your models…" />
    <Dropdown triggerId={id} ariaLabel={label} value={typeof value === 'string' ? value : DEFAULT_MODEL_BINDING} options={options} disabled={disabled || selecting} onChange={next => { void choose(next) }} size="compact" />
    {loading && <span role="status">Loading saved models…</span>}
    {!loading && !page.items.length && !error && <p>No saved models match. Create a 3D model in Media Manager.</p>}
    {page.cursor && <IconChipButton disabled={loading} onClick={() => {
      const key = requestKey.current, cursor = page.cursor; setLoading(true)
      void modelAssetRepository.list({ search, cursor: cursor!, limit: 50 }).then(result => { if (requestKey.current === key) setPage(p => ({ items: [...new Map([...p.items, ...result.items.filter(a => a.status === 'ready')].map(a => [a.id, a])).values()], cursor: result.nextCursor })) }).catch(error => setError(error instanceof Error ? error.message : 'More models could not be loaded.')).finally(() => setLoading(false))
    }}>Load more models</IconChipButton>}
    <IconChipButton disabled={!openManager} onClick={openManager}>Create in Media Manager</IconChipButton>
    {runtimeNotice && (runtimeNotice.code === 'CINEMA2_USER_MODEL_LOADING' ? <span role="status">{runtimeNotice.message}</span> : <NoticeCard tone="warning" title="Selected model unavailable" role="alert">{runtimeNotice.message} Choose Default model or another saved model to continue.</NoticeCard>)}
    {error && <NoticeCard tone="warning" title="Model unavailable" role="alert">{error} <IconChipButton onClick={() => setRefresh(n => n + 1)}>Retry models</IconChipButton></NoticeCard>}
  </div>
}
