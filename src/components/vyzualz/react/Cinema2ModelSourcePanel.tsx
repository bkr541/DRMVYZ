import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Cinema2ParameterId, Cinema2NativePresetManifest } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { isCinema2UserModelPreview } from '../cinema2/model/Cinema2UserModelPreviewPatterns'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding, serializeUserModelBinding } from '../cinema2/model/Cinema2ModelBinding'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { modelAssetRepository } from '../../../features/models/data/modelAssetRepository'
import type { ModelAsset } from '../../../features/models/domain/modelAssetTypes'
import { notify } from '../../../stores/notificationStore'
import { ModelLibraryCards } from '../media/ModelLibraryCards'
import { Cinema2ActiveSource, Cinema2SourceThumbnail } from './Cinema2ActiveSource'
import { LibrarySearchRow } from './controls/LibrarySearchRow'
import { LibraryViewToggle, type LibraryView } from './controls/LibraryViewToggle'
import { monumentLines } from '../cinema2/modules/monument/MonumentGeometry'
import type { Cinema2UserModelSlotSnapshot } from '../cinema2/model/Cinema2UserModelSlot'


/** The preset parameter that holds the pinned model, when the preset has a model slot (its scene module declares `config.userModel`). */
export function findCinema2UserModelParameter(manifest: Readonly<Cinema2NativePresetManifest> | undefined): Cinema2ParameterId | null {
  for (const module of manifest?.modules ?? []) {
    const ref = module.config?.userModel ? module.parameterBindings?.userModel : undefined
    if (ref) return ref.$ref as Cinema2ParameterId
  }
  return null
}

/** Both declared slot kinds can be presented independently. Monument's authored
 * typography/model selector remains exclusive, not a second media slot. */
export function resolveCinema2SourcePanels(manifest: Readonly<Cinema2NativePresetManifest> | undefined) {
  const modelParameter = findCinema2UserModelParameter(manifest)
  return { modelParameter, media: !modelParameter || (manifest?.id !== 'drmvyz.cinema2.monument' && (manifest?.mediaSlots?.length ?? 0) > 0) }
}

/** Presets whose model slot is part of the preset itself: the model is chosen from the library and replaced by choosing another, with no "Remove model" or media shortcuts. */
const PRESETS_WITH_A_FIXED_MODEL_SLOT: ReadonlySet<string> = new Set(['drmvyz.cinema2.crate-bass-sigil', 'drmvyz.cinema2.chamber'])

interface PinnedModel { asset: ModelAsset; version: number; lookupKey: string }

/**
 * The Source tab for a preset with a model slot: the user's saved 3D models, picked the way the Canvas Engine picks media. Choosing a model pins its
 * current version in the preset's model parameter; Remove model clears it. A model edited later has a newer version, which is offered, never applied silently.
 */
export function Cinema2ModelSourcePanel({ runtime, parameterId }: { runtime: Cinema2Runtime; parameterId: Cinema2ParameterId; onOpenMediaManager?: () => void }) {
  const presetId = runtime.getCompiledPresetPlan().presetId, previewPrefix = 'drmvyz.cinema2.user-model-'
  const monument = presetId === 'drmvyz.cinema2.monument'
  const showSelectionControls = !PRESETS_WITH_A_FIXED_MODEL_SLOT.has(presetId) && !(presetId.startsWith(previewPrefix) && isCinema2UserModelPreview(presetId.slice(previewPrefix.length)))
  const libraryRevision = useModelEditorStore(s => s.libraryRevision)
  const accountId = useMediaStore(s => s.accountId)
  const state = runtime.getParameterState()
  const value = useSyncExternalStore(state.subscribe, () => state.getValue(parameterId), () => DEFAULT_MODEL_BINDING)
  // Monument retains the existing authored source mode for older saved presets.
  // Subscribe to primitive values so external edits/restores refresh the same card.
  const readMonument = (key: string, fallback: string) => {
    const candidate = monument ? state.getValue(`monument-${key}` as Cinema2ParameterId) : undefined
    return typeof candidate === 'string' ? candidate : fallback
  }
  const mode = useSyncExternalStore(state.subscribe, () => readMonument('content-type', 'text'))
  const firstLine = useSyncExternalStore(state.subscribe, () => readMonument('text', 'STAGELESS'))
  const secondLine = useSyncExternalStore(state.subscribe, () => readMonument('line-2', ''))
  const thirdLine = useSyncExternalStore(state.subscribe, () => readMonument('line-3', ''))
  const font = useSyncExternalStore(state.subscribe, () => readMonument('font', 'anton'))
  const [search, setSearch] = useState(''), [view, setView] = useState<LibraryView>('grid')
  const [thumbnail, setThumbnail] = useState<{ lookupKey: string; url: string } | null>(null)
  const [pinned, setPinned] = useState<PinnedModel | null>(null), [problem, setProblem] = useState<{ lookupKey: string; message: string } | null>(null)

  let binding: ReturnType<typeof parseUserModelBinding> | null = null
  try { binding = parseUserModelBinding(value) } catch { binding = null }
  const pinnedId = binding?.kind === 'user-model' ? binding.modelAssetId : null, pinnedVersion = binding?.kind === 'user-model' ? binding.version : 0

  const typographyActive = monument && (mode !== 'model' || !pinnedId)
  const activePinnedId = typographyActive ? null : pinnedId
  const lines = monumentLines(firstLine, secondLine, thirdLine)
  const typographyName = lines.filter(line => line.trim()).join(' / ') || 'Empty typography'
  const typographyType = `${firstLine === 'STAGELESS' && !secondLine && !thirdLine && font === 'anton' ? 'Built-in' : 'Custom'} typography · ${font === 'stageless' ? 'STAGELESS Sans Bold' : 'Anton'}`
  // Use the runtime's existing slot inspection (not a second loading pipeline).
  const [renderStatus, setRenderStatus] = useState<{ key: string; snapshot: Cinema2UserModelSlotSnapshot } | null>(null)
  useEffect(() => {
    if (!monument || !activePinnedId) return
    const update = () => {
      const inspection = runtime.getModuleRuntimeSnapshot().modules.find(module => module.moduleId === 'monument-hall')?.inspection as { userModel?: Cinema2UserModelSlotSnapshot } | undefined
      const snapshot = inspection?.userModel
      if (!snapshot || snapshot.binding !== value) return
      const key = JSON.stringify([accountId, value])
      setRenderStatus(previous => previous?.key === key && previous.snapshot.status === snapshot.status && previous.snapshot.message === snapshot.message ? previous : { key, snapshot })
    }
    setRenderStatus(null); update()
    const timer = setInterval(update, 500)
    return () => clearInterval(timer)
  }, [runtime, monument, activePinnedId, value, accountId])
  const liveStatus = renderStatus?.key === JSON.stringify([accountId, value]) ? renderStatus.snapshot : null

  const lookupKey = JSON.stringify([accountId, libraryRevision, parameterId, pinnedId, pinnedVersion])
  const pinnedProblem = problem?.lookupKey === lookupKey ? problem.message : null

  // Which model is pinned, and whether a newer version of it exists.
  useEffect(() => {
    let active = true; setPinned(null); setProblem(null); setThumbnail(null)
    if (!pinnedId) return
    void modelAssetRepository.get(pinnedId).then(async asset => {
      if (!active) return
      if (asset.status !== 'ready') setProblem({ lookupKey, message: 'This model was deleted or is unavailable.' })
      else {
        // Validate the immutable version before advertising a preview or update action.
        await modelAssetRepository.getVersion(pinnedId, pinnedVersion)
        if (!active) return
        setPinned({ asset, version: pinnedVersion, lookupKey })
        void modelAssetRepository.signedUrl(pinnedId, pinnedVersion, 'thumbnailPath').then(result => { if (active) setThumbnail({ lookupKey, url: result.url }) }).catch(() => {})
      }
    }).catch(error => { if (active) setProblem({ lookupKey, message: `The selected model or pinned version is unavailable.${error instanceof Error ? ` ${error.message}` : ''}` }) })
    return () => { active = false }
  }, [runtime, pinnedId, pinnedVersion, lookupKey])

  const writeBinding = (next: string, nextMode: 'model' | 'text') => {
    if (monument) state.setPersistentValues({ [parameterId]: next, 'monument-content-type': nextMode })
    else state.setPersistentValue(parameterId, next)
  }
  const pin = (asset: ModelAsset) => {
    if (asset.status !== 'ready' || asset.currentVersion < 1) { notify('react', { tone: 'error', title: 'Model unavailable', message: `${asset.name} has no saved version to use.` }); return }
    writeBinding(serializeUserModelBinding({ kind: 'user-model', modelAssetId: asset.id, version: asset.currentVersion }), 'model')
  }
  const currentPinned = pinned?.lookupKey === lookupKey && pinned.asset.id === pinnedId && pinned.version === pinnedVersion ? pinned : null
  const newer = currentPinned && currentPinned.asset.currentVersion > currentPinned.version ? currentPinned.asset : null
  const library = useRef<HTMLDivElement>(null)
  const replace = () => queueMicrotask(() => (library.current?.querySelector<HTMLElement>('input') ?? library.current?.querySelector<HTMLElement>('button'))?.focus())

  const runtimeProblem = monument && activePinnedId && liveStatus && liveStatus.status !== 'ready' && liveStatus.status !== 'loading' ? liveStatus.message ?? 'The selected model could not be shown.' : null
  const modelFallback = monument && activePinnedId && liveStatus?.status !== 'ready'
  const status = typographyActive
    ? pinnedId ? 'Typography is active. Your saved model is retained.' : 'Choose a 3D model to replace the typography.'
    : monument && activePinnedId && (pinnedProblem || runtimeProblem) ? `Your typography is the fallback when the pinned model cannot load: ${typographyName}.`
    : monument && activePinnedId && (!liveStatus || liveStatus.status === 'loading') ? `Loading model… Typography fallback: ${typographyName}.`
    : pinnedProblem && presetId === 'drmvyz.cinema2.colossus' && pinnedId ? 'The built-in content is used when the pinned model cannot load.'
    : pinnedId && !currentPinned && !pinnedProblem ? 'Loading model…' : !pinnedId ? 'Pick one of your 3D models to replace the built-in content.' : newer ? 'A newer version is available' : undefined

  return (
    <div className="rv-canvas-engine-panel" data-cinema2-model-source="slot">
      <Cinema2ActiveSource name={typographyActive ? typographyName : currentPinned ? `${currentPinned.asset.name} · v${pinnedVersion}` : pinnedId ? `Pinned model · v${pinnedVersion}` : 'Built-in model'}
        type={typographyActive ? typographyType : modelFallback ? '3D model · Typography fallback' : pinnedId ? '3D model' : 'Built-in content'} preview={<Cinema2SourceThumbnail url={activePinnedId && currentPinned && thumbnail?.lookupKey === lookupKey ? thumbnail.url : null} />}
        status={status}
        error={typographyActive ? null : pinnedProblem ?? runtimeProblem} actions={[
          { id: 'replace', label: activePinnedId ? 'Replace model' : 'Choose model', onSelect: replace },
          ...(newer && !typographyActive ? [{ id: 'update', label: `Use v${newer.currentVersion}`, onSelect: () => pin(newer) }] : []),
          ...(monument && activePinnedId ? [{ id: 'typography', label: 'Use typography (keep model)', onSelect: () => writeBinding(String(value), 'text') }] : []),
          ...(typographyActive && pinnedId ? [{ id: 'resume-model', label: 'Use saved model', onSelect: () => writeBinding(String(value), 'model') }] : []),
          ...(showSelectionControls && pinnedId ? [{ id: 'remove', label: monument ? 'Remove model / Restore typography' : 'Remove model / Restore built-in', onSelect: () => writeBinding(DEFAULT_MODEL_BINDING, 'text') }] : []),
          ...(typographyActive && mode === 'model' && !pinnedId ? [{ id: 'restore-text', label: 'Restore typography controls', onSelect: () => writeBinding(DEFAULT_MODEL_BINDING, 'text') }] : []),
        ]} />
      <div className="rv-canvas-library-shell" ref={library}>
        <ModelLibraryCards
          search={search} favorites={false} viewMode={view} activeId={activePinnedId}
          onSelect={pin}
          sectioned
          searchControl={<LibrarySearchRow value={search} onChange={setSearch} placeholder="Search your 3D models" label="Search 3D models" clearable><LibraryViewToggle view={view} onChange={setView} /></LibrarySearchRow>}
        />
      </div>
    </div>
  )
}
