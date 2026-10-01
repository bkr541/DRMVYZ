import { useRef } from 'react'
import {
  cinema2WorkspaceSessionStore,
  type Cinema2PresetId,
  type Cinema2WorkspacePresetState,
} from '../cinema2'

interface Cinema2RestoreActivation {
  presetId: Cinema2PresetId
  state: Readonly<Cinema2WorkspacePresetState> | null
}

/**
 * Captures the inactive workspace state once for each preset activation.
 *
 * Runtime retirement writes a fresh snapshot to the mutable session store. That
 * write must not change the active Stage's restoreState prop: in StrictMode the
 * initial effect cleanup is intentionally replayed, and feeding its new object
 * back into the Stage would continuously retire and recreate the runtime.
 */
export function useCinema2WorkspaceRestoreState(
  presetId: Cinema2PresetId,
): Readonly<Cinema2WorkspacePresetState> | null {
  const activationRef = useRef<Cinema2RestoreActivation | null>(null)
  if (activationRef.current?.presetId !== presetId) {
    activationRef.current = {
      presetId,
      state: cinema2WorkspaceSessionStore.getPresetState(presetId),
    }
  }
  return activationRef.current.state
}
