import type { Cinema2MediaSlotId, Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MediaPresentation, Cinema2MediaSource } from '../media/Cinema2MediaSlotRuntime'
import type { Cinema2Runtime } from './Cinema2Runtime'

export interface Cinema2WorkspaceMediaSlotState {
  slotId: Cinema2MediaSlotId
  source: Readonly<Cinema2MediaSource>
  presentation: Readonly<Cinema2MediaPresentation>
}

/**
 * Minimal re-entry snapshot for the production workspace. It stores authored/user
 * parameter serialization plus media descriptors only. GPU handles, loaded media,
 * transient modulation, choreography and simulation state remain runtime-owned.
 */
export interface Cinema2WorkspacePresetState {
  presetId: Cinema2PresetId
  serializedParameterState: string
  mediaSlots: readonly Readonly<Cinema2WorkspaceMediaSlotState>[]
  /** Optional for older projects; explicit null means built-in or individual media. */
  poolId?: string | null
}

export function captureCinema2WorkspacePresetState(
  runtime: Cinema2Runtime,
): Readonly<Cinema2WorkspacePresetState> {
  const presetId = runtime.getCompiledPresetPlan().presetId
  const mediaSlots = runtime.getMediaSlotRuntimeSnapshot().slots
    .flatMap(slot => {
      // Everywhere may retain the last good image while a new one decodes.
      // Never serialize an uncommitted candidate (including a failed first load).
      const committed = slot.id === 'everywhere-screen-media'
        ? runtime.getMediaSlotRuntime().getCommittedSource(slot.id)
        : slot.source ? { source: slot.source, presentation: slot.presentation } : null
      return committed ? [Object.freeze({ slotId: slot.id, ...committed })] : []
    })

  return Object.freeze({
    presetId,
    serializedParameterState: runtime.serializeParameterState(),
    mediaSlots: Object.freeze(mediaSlots),
  })
}

/** Holds only inactive, serializable workspace state across React workspace mounts. */
export class Cinema2WorkspaceSessionStore {
  private activePresetId: Cinema2PresetId | null = null
  private readonly presetStates = new Map<Cinema2PresetId, Readonly<Cinema2WorkspacePresetState>>()

  getActivePresetId(): Cinema2PresetId | null {
    return this.activePresetId
  }

  selectPreset(presetId: Cinema2PresetId): void {
    this.activePresetId = presetId
  }

  getPresetState(presetId: Cinema2PresetId): Readonly<Cinema2WorkspacePresetState> | null {
    return this.presetStates.get(presetId) ?? null
  }

  captureRuntime(runtime: Cinema2Runtime): Readonly<Cinema2WorkspacePresetState> {
    const state = captureCinema2WorkspacePresetState(runtime)
    this.activePresetId = state.presetId
    this.presetStates.set(state.presetId, state)
    return state
  }

  storePresetState(state: Readonly<Cinema2WorkspacePresetState>): void {
    this.presetStates.set(state.presetId, state)
  }

  reset(): void {
    this.activePresetId = null
    this.presetStates.clear()
  }
}

/**
 * Session-lifetime owner for inactive workspace state. This deliberately holds
 * only serialized authored/user state and source descriptors, never live runtime
 * instances, GPU handles, loaded media, envelopes or simulation resources.
 */
export const cinema2WorkspaceSessionStore = new Cinema2WorkspaceSessionStore()

/** Rehydrates only media state that the active runtime canonically owns. */
export async function restoreCinema2WorkspaceMedia(
  runtime: Cinema2Runtime,
  state: Readonly<Cinema2WorkspacePresetState> | null | undefined,
): Promise<void> {
  if (!state || state.presetId !== runtime.getCompiledPresetPlan().presetId) return
  const mediaRuntime = runtime.getMediaSlotRuntime()
  const current = mediaRuntime.getSnapshot()

  await Promise.all(state.mediaSlots.map(async saved => {
    const slot = current.slots.find(candidate => candidate.id === saved.slotId)
    if (!slot || !slot.accepts.includes(saved.source.kind)) return
    await mediaRuntime.replace(saved.slotId, saved.source, saved.presentation)
  }))
}
