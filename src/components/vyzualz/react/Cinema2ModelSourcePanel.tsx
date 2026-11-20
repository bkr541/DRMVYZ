import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Cinema2ParameterId, Cinema2NativePresetManifest } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { isCinema2UserModelPreview } from '../cinema2/model/Cinema2UserModelPreviewPatterns'
import { DEFAULT_MODEL_BINDING, parseUserModelBinding, serializeUserModelBinding } from '../cinema2/model/Cinema2ModelBinding'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { modelAssetRepository } from '../../../features/models/data/modelAssetRepository'
import type { ModelAsset } from '../../../features/models/domain/modelAssetTypes'
import { notify } from '../../../stores/notificationStore'
import { ModelLibraryCards } from '../media/ModelLibraryCards'
import { IconChipButton } from './controls/IconChipButton'
import { LibrarySearchRow } from './controls/LibrarySearchRow'
import { LibraryViewToggle, type LibraryView } from './controls/LibraryViewToggle'
import { DrawerNotice } from '../shared/DrawerNotice'

/** The preset parameter that holds the pinned model, when the preset has a model slot (its scene module declares `config.userModel`). */
export function findCinema2UserModelParameter(manifest: Readonly<Cinema2NativePresetManifest> | undefined): Cinema2ParameterId | null {
  for (const module of manifest?.modules ?? []) {
    const ref = module.config?.userModel ? module.parameterBindings?.userModel : undefined
    if (ref) return ref.$ref as Cinema2ParameterId
  }
  return null
}

interface PinnedModel { asset: ModelAsset; version: number }

/**
 * The Source tab for a preset with a model slot: the user's saved 3D models, picked the way the Canvas Engine picks media. Choosing a model pins its
 * current version in the preset's model parameter; Remove model clears it. A model edited later has a newer version, which is offered, never applied silently.
 */
export function Cinema2ModelSourcePanel({ runtime, parameterId, onOpenMediaManager }: { runtime: Cinema2Runtime; parameterId: Cinema2ParameterId; onOpenMediaManager?: () => void }) {
  const presetId = runtime.getCompiledPresetPlan().presetId, previewPrefix = 'drmvyz.cinema2.user-model-'
  const showSelectionControls = presetId !== 'drmvyz.cinema2.crate-bass-sigil' && !(presetId.startsWith(previewPrefix) && isCinema2UserModelPreview(presetId.slice(previewPrefix.length)))
  const state = runtime.getParameterState()
  const value = useSyncExternalStore(state.subscribe, () => state.getValue(parameterId), () => DEFAULT_MODEL_BINDING)
  const [search, setSearch] = useState(''), [view, setView] = useState<LibraryView>('grid')
  const [pinned, setPinned] = useState<PinnedModel | null>(null), [pinnedProblem, setPinnedProblem] = useState<string | null>(null)

  let binding: ReturnType<typeof parseUserModelBinding> | null = null
  try { binding = parseUserModelBinding(value) } catch { binding = null }
  const pinnedId = binding?.kind === 'user-model' ? binding.modelAssetId : null, pinnedVersion = binding?.kind === 'user-model' ? binding.version : 0

  // Which model is pinned, and whether a newer version of it exists.
  useEffect(() => {
    let active = true; setPinned(null); setPinnedProblem(null)
    if (!pinnedId) return
    void modelAssetRepository.get(pinnedId).then(asset => {
      if (!active) return
      if (asset.status !== 'ready') setPinnedProblem('This model was deleted or is unavailable.')
      else setPinned({ asset, version: pinnedVersion })
    }).catch(error => { if (active) setPinnedProblem(error instanceof Error ? error.message : 'The selected model is unavailable.') })
    return () => { active = false }
  }, [pinnedId, pinnedVersion])

  const pin = (asset: ModelAsset) => {
    if (asset.status !== 'ready' || asset.currentVersion < 1) { notify('react', { tone: 'error', title: 'Model unavailable', message: `${asset.name} has no saved version to use.` }); return }
    state.setPersistentValue(parameterId, serializeUserModelBinding({ kind: 'user-model', modelAssetId: asset.id, version: asset.currentVersion }))
  }
  const newer = pinned && pinned.asset.currentVersion > pinned.version ? pinned.asset : null

  return (
    <div className="rv-canvas-engine-panel" data-cinema2-model-source="slot">
      <div className="rv-canvas-library-shell">
        <ModelLibraryCards
          search={search} favorites={false} viewMode={view} activeId={pinnedId}
          onSelect={pin}
          sectioned
          searchControl={<LibrarySearchRow value={search} onChange={setSearch} placeholder="Search your 3D models" label="Search 3D models" clearable><LibraryViewToggle view={view} onChange={setView} /></LibrarySearchRow>}
        />
      </div>
      {showSelectionControls && <div className="rv-canvas-panel-status">
        <span>Model</span>
        <strong>{pinned ? `${pinned.asset.name} · v${pinned.version}` : pinnedId ? 'Loading…' : 'None chosen'}</strong>
      </div>}
      {!pinnedId && <p className="rv-ctrl-info">Pick one of your 3D models to place it in the middle of the preset.</p>}
      {newer && <DrawerNotice tone="info" title="A newer version is available" role="status">
        {newer.name} is now at v{newer.currentVersion}; this preset uses v{pinned!.version}. <IconChipButton onClick={() => pin(newer)}>Use v{newer.currentVersion}</IconChipButton>
      </DrawerNotice>}
      {showSelectionControls && pinnedId && <IconChipButton onClick={() => state.setPersistentValue(parameterId, DEFAULT_MODEL_BINDING)}>Remove model</IconChipButton>}
      {pinnedProblem && <DrawerNotice tone="warning" title="Selected model unavailable" role="alert">{pinnedProblem} {showSelectionControls ? 'Choose another model or remove it.' : 'Choose another model.'}</DrawerNotice>}
      {showSelectionControls && onOpenMediaManager && <IconChipButton onClick={onOpenMediaManager}>Open Media Manager</IconChipButton>}
    </div>
  )
}
