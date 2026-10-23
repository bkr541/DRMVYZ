import React, { useEffect, useRef } from 'react'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_BLOCKSHIFT_PRESET_ID, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../../components/vyzualz/cinema2/presets/Cinema2BlockshiftPreset'
import { AudioFeatureBus } from '../../features/musicIntelligence/AudioFeatureBus'
import { blockshiftAudioFixture, type BlockshiftAudioProfile } from '../support/Cinema2BlockshiftAudioFixtures'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID } from '../../components/vyzualz/cinema2/parameters/Cinema2PerformanceParameters'

declare global {
  interface Window {
    __blockshiftAudio: {
      reset(): void
      replay(): void
      step(profile: BlockshiftAudioProfile, seconds?: number): void
      set(suffix: string, value: number | boolean | string): void
      pause(value: boolean): void
      seek(time: number, track?: string): void
      resize(width: number, height: number): void
      diagnostics(): { runtime: ReturnType<Cinema2Runtime['getSnapshot']>; engine: ReturnType<Cinema2Runtime['getDiagnosticsSnapshot']>; effects: ReturnType<Cinema2Runtime['getEffectRuntimeSnapshot']> }
      status(): { frames: number; time: number; targetTime: number; phase: string; authoredPattern: unknown; authored: unknown; director: ReturnType<Cinema2Runtime['getVisualDirectorFrame']>; choreography: ReturnType<Cinema2Runtime['getChoreographyRuntimeSnapshot']>; modules: ReturnType<Cinema2Runtime['getModuleRuntimeSnapshot']>; camera: ReturnType<Cinema2Runtime['getCameraRuntimeSnapshot']> }
    }
  }
}

/** Real production runtime/catalog/AudioFeatureBus, with a controlled host clock and explicit synthetic upstream publications. */
export function Cinema2BlockshiftAudioBrowserFixture() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvas.current) return
    let runtime: Cinema2Runtime, timestamp = 0, target = 0, publication = 0, paused = false, track = 'blockshift-p5-browser'
    let lastPublication: ReturnType<typeof blockshiftAudioFixture>
    const publish = (profile: BlockshiftAudioProfile, time: number) => {
      lastPublication = blockshiftAudioFixture(profile, time, ++publication, track)
      AudioFeatureBus.setFrame(lastPublication, 'blockshift-p5-browser')
    }
    const set = (suffix: string, value: number | boolean | string) => {
      const id = suffix === 'quality-mode' ? CINEMA2_QUALITY_MODE_PARAMETER_ID : Object.values(ids).find(id => id === `blockshift-${suffix}`)
      if (!id) throw new Error(`Unknown parameter ${suffix}`)
      const result = runtime.getParameterState().setPersistentValue(id, value)
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    }
    const reset = () => {
      runtime?.dispose(); AudioFeatureBus.reset(); timestamp = 0; target = 0; publication = 0; paused = false; track = 'blockshift-p5-browser'
      publish('silence', 0)
      const created = Cinema2Runtime.create(canvas.current!, {
        presetId: CINEMA2_BLOCKSHIFT_PRESET_ID,
        requestAnimationFrame: callback => window.requestAnimationFrame(() => { if (!paused) timestamp = Math.min(target, timestamp + 50); callback(timestamp) }),
        cancelAnimationFrame: id => window.cancelAnimationFrame(id),
        transportSource: { getState: () => ({ sourcePresent: true, playing: !paused, paused, animationActive: !paused, analysisActive: true, trackId: track, timeSec: timestamp / 1000, bpm: 120, bpmSync: false }) },
      })
      if (!created.runtime) throw new Error(created.error)
      runtime = created.runtime
      // Audio/geometry fixtures isolate those consumers; the atmosphere acceptance explicitly enables haze.
      set('camera-motion', false); set('motion-amount', 1); set('audio-reactivity', 1); set('atmosphere', false)
      runtime.resize({ width: 960, height: 540, dpr: 1 }); runtime.start()
    }
    window.__blockshiftAudio = {
      reset,
      replay: () => AudioFeatureBus.setFrame(lastPublication, 'blockshift-p5-browser'),
      step: (profile, seconds = 0.05) => { target += seconds * 1000; publish(profile, target / 1000) },
      set, pause: value => { paused = value },
      resize: (width, height) => runtime.resize({ width, height, dpr: 1 }),
      diagnostics: () => ({ runtime: runtime.getSnapshot(), engine: runtime.getDiagnosticsSnapshot(), effects: runtime.getEffectRuntimeSnapshot() }),
      seek: (time, source) => { if (source) track = source; timestamp = time * 1000; target = timestamp; publish('silence', time) },
      status: () => ({ frames: runtime.getSnapshot().frameCount, time: timestamp, targetTime: target, phase: runtime.getSnapshot().phase, authoredPattern: runtime.getParameterState().getValue(ids.pattern), authored: runtime.getParameterState().serialize(), director: runtime.getVisualDirectorFrame(), choreography: runtime.getChoreographyRuntimeSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), camera: runtime.getCameraRuntimeSnapshot() }),
    }
    reset()
    return () => runtime.dispose()
  }, [])
  return <canvas ref={canvas} data-cinema2-output-canvas="true" style={{ width: '100vw', height: '100vh' }} />
}
