import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Cinema2ParameterId, Cinema2NativePresetManifest } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { isCinema2UserModelPreview } from '../cinema2/model/Cinema2UserModelPreviewPatterns'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding, serializeUserModelBinding } from '../cinema2/model/Cinema2ModelBinding'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { modelAssetRepository } from '../../../features/models/data/modelAssetRepository'
import type { ModelAsset } from '../../../features/models/domain/modelAssetTypes'
import { notify } from '../../../stores/notificationStore'
import { ModelLibraryCards } from '../media/ModelLibraryCards'
import { Cinema2ActiveSource, Cinema2SourceThumbnail } from './Cinema2ActiveSource'
import { LibrarySearchRow } from './controls/LibrarySearchRow'
import { LibraryViewToggle, type LibraryView } from './controls/LibraryViewToggle'
import { Collapsible } from './ReactControlRows'
import { Cinema2ModelSelector } from '../cinema2/model/Cinema2ModelSelector'


/** The preset parameter that holds the pinned model, when the preset has a model slot (its scene module declares `config.userModel`). */
export function findCinema2UserModelParameter(manifest: Readonly<Cinema2NativePresetManifest> | undefined): Cinema2ParameterId | null {
  for (const module of manifest?.modules ?? []) {
    const ref = module.config?.userModel ? module.parameterBindings?.userModel : undefined
    if (ref) return ref.$ref as Cinema2ParameterId
  }
  return null
}

/** Presets whose model slot is part of the preset itself: the model is chosen from the library and replaced by choosing another, with no "Remove model" or media shortcuts. */
const PRESETS_WITH_A_FIXED_MODEL_SLOT: ReadonlySet<string> = new Set(['drmvyz.cinema2.crate-bass-sigil', 'drmvyz.cinema2.chamber'])

interface PinnedModel { asset: ModelAsset; version: number }

/**
 * The Source tab for a preset with a model slot: the user's saved 3D models, picked the way the Canvas Engine picks media. Choosing a model pins its
 * current version in the preset's model parameter; Remove model clears it. A model edited later has a newer version, which is offered, never applied silently.
 */
export function Cinema2ModelSourcePanel({ runtime, parameterId }: { runtime: Cinema2Runtime; parameterId: Cinema2ParameterId; onOpenMediaManager?: () => void }) {
  const presetId = runtime.getCompiledPresetPlan().presetId, previewPrefix = 'drmvyz.cinema2.user-model-'
  const showSelectionControls = !PRESETS_WITH_A_FIXED_MODEL_SLOT.has(presetId) && !(presetId.startsWith(previewPrefix) && isCinema2UserModelPreview(presetId.slice(previewPrefix.length)))
  const state = runtime.getParameterState()
  const value = useSyncExternalStore(state.subscribe, () => state.getValue(parameterId), () => DEFAULT_MODEL_BINDING)
  const [search, setSearch] = useState(''), [view, setView] = useState<LibraryView>('grid')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [pinned, setPinned] = useState<PinnedModel | null>(null), [pinnedProblem, setPinnedProblem] = useState<string | null>(null)

  let binding: ReturnType<typeof parseUserModelBinding> | null = null
  try { binding = parseUserModelBinding(value) } catch { binding = null }
  const pinnedId = binding?.kind === 'user-model' ? binding.modelAssetId : null, pinnedVersion = binding?.kind === 'user-model' ? binding.version : 0

  // Which model is pinned, and whether a newer version of it exists.
  useEffect(() => {
    let active = true; setPinned(null); setPinnedProblem(null); setThumbnail(null)
    if (!pinnedId) return
    void modelAssetRepository.get(pinnedId).then(asset => {
      if (!active) return
      if (asset.status !== 'ready') setPinnedProblem('This model was deleted or is unavailable.')
      else {
        setPinned({ asset, version: pinnedVersion })
        void modelAssetRepository.getVersion(pinnedId, pinnedVersion).catch(error => { if (active) setPinnedProblem(error instanceof Error ? error.message : 'Pinned version unavailable.') })
        void modelAssetRepository.signedUrl(pinnedId, pinnedVersion, 'thumbnailPath').then(result => { if (active) setThumbnail(result.url) }).catch(() => {})
      }
    }).catch(error => { if (active) setPinnedProblem(error instanceof Error ? error.message : 'The selected model is unavailable.') })
    return () => { active = false }
  }, [runtime, parameterId, pinnedId, pinnedVersion])

  const pin = (asset: ModelAsset) => {
    if (asset.status !== 'ready' || asset.currentVersion < 1) { notify('react', { tone: 'error', title: 'Model unavailable', message: `${asset.name} has no saved version to use.` }); return }
    state.setPersistentValue(parameterId, serializeUserModelBinding({ kind: 'user-model', modelAssetId: asset.id, version: asset.currentVersion }))
  }
  const currentPinned = pinned?.asset.id === pinnedId && pinned.version === pinnedVersion ? pinned : null
  const newer = currentPinned && currentPinned.asset.currentVersion > currentPinned.version ? currentPinned.asset : null
  const library = useRef<HTMLDivElement>(null)
  const replace = () => queueMicrotask(() => (library.current?.querySelector<HTMLElement>('input') ?? library.current?.querySelector<HTMLElement>('button'))?.focus())

  return (
    <div className="rv-canvas-engine-panel" data-cinema2-model-source="slot">
      <Cinema2ActiveSource name={currentPinned ? `${currentPinned.asset.name} · v${pinnedVersion}` : pinnedId ? `Pinned model · v${pinnedVersion}` : 'Built-in model'}
        type={pinnedId ? '3D model' : 'Built-in content'} preview={<Cinema2SourceThumbnail url={currentPinned ? thumbnail : null} />}
        status={pinnedId && !currentPinned && !pinnedProblem ? 'Loading model…' : !pinnedId ? 'Pick one of your 3D models to replace the built-in content.' : newer ? 'A newer version is available' : undefined}
        error={pinnedProblem} actions={[
          { id: 'replace', label: pinnedId ? 'Replace model' : 'Choose model', onSelect: replace },
          ...(newer ? [{ id: 'update', label: `Use v${newer.currentVersion}`, onSelect: () => pin(newer) }] : []),
          ...(showSelectionControls && pinnedId ? [{ id: 'remove', label: 'Remove model / Restore built-in', onSelect: () => state.setPersistentValue(parameterId, DEFAULT_MODEL_BINDING) }] : []),
        ]} />
      {pinnedId && <Collapsible label="Model versions and details" defaultOpen={false}>
        <Cinema2ModelSelector key={pinnedId} id={`cinema2-source-${parameterId}`} label="Saved model version" value={value} disabled={false} versionsOnly
          onChange={next => {
            if (state.getValue(parameterId) !== value) return
            state.setPersistentValue(parameterId, next)
          }} />
      </Collapsible>}
      <div className="rv-canvas-library-shell" ref={library}>
        <ModelLibraryCards
          search={search} favorites={false} viewMode={view} activeId={pinnedId}
          onSelect={pin}
          sectioned
          searchControl={<LibrarySearchRow value={search} onChange={setSearch} placeholder="Search your 3D models" label="Search 3D models" clearable><LibraryViewToggle view={view} onChange={setView} /></LibrarySearchRow>}
        />
      </div>
    </div>
  )
}
