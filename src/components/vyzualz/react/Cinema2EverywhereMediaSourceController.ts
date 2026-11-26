import { useReactStore } from '../../../stores/reactStore'
import type { Cinema2Runtime } from '../cinema2/runtime/Cinema2Runtime'
import { CINEMA2_EVERYWHERE_MEDIA_SLOT } from '../cinema2/presets/Cinema2EverywherePreset'

const generations = new WeakMap<Cinema2Runtime, number>()
export function beginEverywhereMediaRequest(runtime: Cinema2Runtime) {
  const generation=(generations.get(runtime)??0)+1
  generations.set(runtime,generation)
  return generation
}
export function isEverywhereMediaRequestCurrent(runtime: Cinema2Runtime, generation: number) {
  return generations.get(runtime)===generation
}
export function clearEverywhereIndividualMedia(runtime: Cinema2Runtime) {
  beginEverywhereMediaRequest(runtime)
  const slots=runtime.getMediaSlotRuntime()
  if(slots.getSlotSnapshot(CINEMA2_EVERYWHERE_MEDIA_SLOT)?.source) slots.remove(CINEMA2_EVERYWHERE_MEDIA_SLOT)
}
export function resetEverywhereMedia(runtime: Cinema2Runtime) {
  clearEverywhereIndividualMedia(runtime)
  useReactStore.getState().setActiveCanvasMediaPool(null)
}
export function activateEverywherePool(runtime: Cinema2Runtime, poolId: string|null) {
  if(poolId!==null && !useReactStore.getState().canvasOrchestrationSettings.mediaPools.some(pool=>pool.id===poolId)) return
  clearEverywhereIndividualMedia(runtime)
  useReactStore.getState().setActiveCanvasMediaPool(poolId)
}
/** Stage lifetime, not Source-tab lifetime. Covers external pool changes too. */
export function observeEverywherePool(runtime: Cinema2Runtime) {
  if(useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId) clearEverywhereIndividualMedia(runtime)
  const unsubscribe=useReactStore.subscribe((state,previous)=>{
    const next=state.canvasOrchestrationSettings.activeMediaPoolId
    if(next && next!==previous.canvasOrchestrationSettings.activeMediaPoolId) clearEverywhereIndividualMedia(runtime)
  })
  return ()=>{unsubscribe();beginEverywhereMediaRequest(runtime)}
}
