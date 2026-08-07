import { useEffect, useRef } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactPresetAutomationCue } from './ReactTypes'
import { isSelectableReactEngineId } from './reactEngineCatalog'
import { useCinemaStore } from '../cinema/CinemaStore'
import type { CinemaCompositionId } from '../cinema/CinemaIdentifiers'

/**
 * Returns the last enabled cue whose timeSec <= positionSec and whose presetId
 * is present in validPresetIds. Expects `cues` sorted ascending by timeSec.
 * Returns null when no qualifying cue precedes positionSec.
 */
export function resolveActiveCue(
  cues: ReactPresetAutomationCue[],
  positionSec: number,
  validPresetIds: Set<string>,
  validCinemaCompositionIds: Set<string> = new Set(),
): ReactPresetAutomationCue | null {
  let active: ReactPresetAutomationCue | null = null
  for (const cue of cues) {
    if (cue.timeSec > positionSec) break  // sorted — no further candidates
    if (!cue.enabled) continue
    const destinationIsValid = cue.cinemaCompositionId
      ? validCinemaCompositionIds.has(cue.cinemaCompositionId)
      : Boolean(cue.presetId && validPresetIds.has(cue.presetId))
    if (!destinationIsValid) continue
    active = cue
  }
  return active
}

/**
 * Fires selectReactPreset when the playhead crosses a ReactPresetAutomationCue.
 *
 * Behaviour:
 * - Forward playback: applies any enabled cue whose timeSec falls within the
 *   elapsed interval since the last render (crossing semantics).
 * - Seek / rewind / track change / initial load: resolves and applies the last
 *   enabled cue at or before the new position.
 * - No cue before the current position: leaves the active preset unchanged.
 * - Disabled cues and cues referencing a missing preset are ignored.
 * - The same cue is never reapplied on every render — a ref tracks the last
 *   applied cue id per track.
 *
 * Call this once from ReactView.
 */
export function useReactPresetAutomation(): void {
  const engine = useSharedAudio()

  // Subscribe to the raw cue map so the effect re-runs when cues change.
  const cuesByTrackId = useReactStore(s => s.presetAutomationCuesByTrackId)
  const reactPresets  = useReactStore(s => s.reactPresets)
  const cinemaCompositions = useCinemaStore(s => s.compositions)

  // Execution state — mutations here never cause re-renders.
  const lastAppliedCueIdRef = useRef<string | null>(null)
  const prevTrackIdRef      = useRef<string | null | undefined>(undefined)

  const { currentTrackId, currentTime } = engine

  useEffect(() => {
    if (!currentTrackId) {
      lastAppliedCueIdRef.current = null
      prevTrackIdRef.current      = null
      return
    }

    const rawCues    = cuesByTrackId[currentTrackId] ?? []
    const sortedCues = [...rawCues].sort((a, b) => a.timeSec - b.timeSec)
    const validIds = new Set(reactPresets.filter(p => isSelectableReactEngineId(p.engine)).map(p => p.id))
    const validCinemaIds = new Set(cinemaCompositions.map(composition => String(composition.id)))
    const activeCue = resolveActiveCue(sortedCues, currentTime, validIds, validCinemaIds)

    // Reset execution state on track change; treat first run as a track change.
    if (currentTrackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current      = currentTrackId
      lastAppliedCueIdRef.current = null
    }

    const activeCueId = activeCue?.id ?? null
    if (activeCueId !== lastAppliedCueIdRef.current) {
      if (activeCue) {
        // Imperative call: avoids adding selectReactPreset to the dep array
        // and breaks any potential subscribe loop (selectReactPreset changes
        // activeReactPresetId, which is not in this effect's dependencies).
        if (activeCue.cinemaCompositionId) {
          const result = useCinemaStore.getState().setActiveCinemaComposition(
            activeCue.cinemaCompositionId as CinemaCompositionId,
          )
          if (result.ok) useReactStore.getState().selectReactEngine('cinema')
        } else if (activeCue.presetId) {
          useReactStore.getState().selectReactPreset(activeCue.presetId)
        }
      }
      // Track the new state even when activeCue is null (no cue before current
      // position) so we don't retry the null→null no-op on every tick.
      lastAppliedCueIdRef.current = activeCueId
    }
  }, [currentTrackId, currentTime, cuesByTrackId, reactPresets, cinemaCompositions])
}
