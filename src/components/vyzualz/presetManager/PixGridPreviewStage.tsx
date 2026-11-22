import { useCallback, useMemo } from 'react'
import type { useReactStore } from '../../../stores/reactStore'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import { applyPixGridPresetSettings } from '../react/pixGrid/PixGridState'
import type { ReactPreset } from '../react/ReactTypes'

/** Live PixGrid render for the selected preset (or the Deck being built). No track is loaded here, so time is the preview clock the caller supplies. */
export function PixGridPreviewStage({ preset, pixGridState, pixGridDecks, intensity, motion, glow, bassReactivity, audioTimeSec }: {
  preset: ReactPreset
  pixGridState: ReturnType<typeof useReactStore.getState>['pixGridState']
  pixGridDecks: ReturnType<typeof useReactStore.getState>['pixGridDecks']
  intensity: number
  motion: number
  glow: number
  bassReactivity: number
  audioTimeSec: number
}) {
  const state = useMemo(
    () => applyPixGridPresetSettings(pixGridState, preset.id, preset.pixGridSettings),
    [pixGridState, preset],
  )
  const getAudioTime = useCallback(() => audioTimeSec, [audioTimeSec])
  return (
    <div className="pmv-pixgrid-stage" aria-label={`${preset.name} PixGrid preview`}>
      <PixGridSurface
        analyser={null}
        activePreset={preset}
        pixGridState={state}
        pixGridDecks={pixGridDecks}
        intensity={intensity}
        motion={motion}
        glow={glow}
        bassReactivity={bassReactivity}
        audioTimeSec={audioTimeSec}
        getAudioTime={getAudioTime}
        isPlaying={false}
        isPaused
      />
    </div>
  )
}
