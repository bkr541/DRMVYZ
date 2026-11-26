import { useReactStore } from '../../../stores/reactStore'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { captureCinema2WorkspacePresetState } from '../cinema2/runtime/Cinema2WorkspaceSession'
import type { Cinema2MediaSlotId, Cinema2PresetId } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { CINEMA2_EVERYWHERE_MEDIA_SLOT } from '../cinema2/presets/Cinema2EverywherePreset'

export function getCinema2PresetPoolId(state: ReturnType<typeof useReactStore.getState>, presetId: Cinema2PresetId | undefined): string | null {
  return state.cinema2Workspace.presets.find(preset => preset.presetId === presetId)?.poolId ?? null
}

const generations = new WeakMap<Cinema2Runtime, Map<Cinema2MediaSlotId, number>>()
export function beginEverywhereMediaRequest(runtime: Cinema2Runtime, slotId = CINEMA2_EVERYWHERE_MEDIA_SLOT) {
  let owner = generations.get(runtime)
  if (!owner) { owner = new Map(); generations.set(runtime, owner) }
  const generation = (owner.get(slotId) ?? 0) + 1
  owner.set(slotId, generation)
  return generation
}
export function isEverywhereMediaRequestCurrent(runtime: Cinema2Runtime, generation: number, slotId = CINEMA2_EVERYWHERE_MEDIA_SLOT) {
  return generations.get(runtime)?.get(slotId) === generation
}
export function clearEverywhereIndividualMedia(runtime: Cinema2Runtime) {
  beginEverywhereMediaRequest(runtime)
  const slots=runtime.getMediaSlotRuntime()
  slots.remove(CINEMA2_EVERYWHERE_MEDIA_SLOT)
}
/** Persist only the selection, not a second copy of the pool library. */
export function setCinema2PoolSelection(runtime: Cinema2Runtime, poolId: string | null) {
  const store = useReactStore.getState()
  if (poolId !== null && !store.canvasOrchestrationSettings.mediaPools.some(pool => pool.id === poolId)) return
  store.storeCinema2WorkspacePresetState({ ...captureCinema2WorkspacePresetState(runtime), poolId })
}
export function resetCinema2Media(runtime: Cinema2Runtime, slotId: Cinema2MediaSlotId, supportsPool: boolean) {
  beginEverywhereMediaRequest(runtime, slotId)
  runtime.getMediaSlotRuntime().remove(slotId)
  if (supportsPool) setCinema2PoolSelection(runtime, null)
  else useReactStore.getState().storeCinema2WorkspacePresetState(captureCinema2WorkspacePresetState(runtime))
}
export function activateCinema2Pool(runtime: Cinema2Runtime, slotId: Cinema2MediaSlotId, poolId: string | null) {
  if (poolId !== null && !useReactStore.getState().canvasOrchestrationSettings.mediaPools.some(pool => pool.id === poolId)) return
  beginEverywhereMediaRequest(runtime, slotId)
  runtime.getMediaSlotRuntime().remove(slotId)
  setCinema2PoolSelection(runtime, poolId)
}
export function resetEverywhereMedia(runtime: Cinema2Runtime) {
  resetCinema2Media(runtime, CINEMA2_EVERYWHERE_MEDIA_SLOT, true)
}
export function activateEverywherePool(runtime: Cinema2Runtime, poolId: string | null) {
  activateCinema2Pool(runtime, CINEMA2_EVERYWHERE_MEDIA_SLOT, poolId)
}
