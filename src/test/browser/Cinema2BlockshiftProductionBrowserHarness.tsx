import { Cinema2BlockshiftAudioBrowserFixture } from './Cinema2BlockshiftAudioBrowserFixture'
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AudioEngineProvider } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import { Cinema2Stage } from '../../components/vyzualz/react/Cinema2Stage'
import type { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { CINEMA2_BLOCKSHIFT_PRESET_ID, CINEMA2_BLOCKSHIFT_PARAMETER_IDS as ids } from '../../components/vyzualz/cinema2/presets/Cinema2BlockshiftPreset'
import '../../styles.css'
import '../../styles/analyzer.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'

type TimingOptions = { bpm: number; localSync: boolean; hostSync: boolean; motion: number; rate: number }
let timingRuntime: Cinema2Runtime | null = null
let resetTiming: ((options: TimingOptions) => void) | null = null
let pauseTiming: (() => void) | null = null
let resumeTiming: (() => void) | null = null

declare global {
  interface Window {
    __blockshiftTiming: {
      reset(options: TimingOptions): void
      ready(): boolean
      frames(): number
      pause(): void
      resume(): void
      set(suffix: string, value: number | string | boolean): void
      camera(): ReturnType<Cinema2Runtime['getCameraRuntimeSnapshot']> | undefined
    }
  }
}
window.__blockshiftTiming = {
  reset: options => resetTiming?.(options),
  ready: () => timingRuntime?.getSnapshot().phase === 'running',
  frames: () => timingRuntime?.getSnapshot().frameCount ?? 0,
  pause: () => pauseTiming?.(),
  resume: () => resumeTiming?.(),
  set: (suffix, value) => {
    const id = Object.values(ids).find(id => id === `blockshift-${suffix}`)
    if (!id || !timingRuntime) throw new Error(`Unknown or unavailable BLOCKSHIFT control: ${suffix}`)
    const result = timingRuntime.getParameterState().setPersistentValue(id, value)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  },
  camera: () => timingRuntime?.getCameraRuntimeSnapshot(),
}

/** Standard production Stage driven by a deterministic host transport fixture; no analyzed music events are injected. */
function TimingFixture() {
  const [options, setOptions] = useState<TimingOptions>({ bpm: 120, localSync: true, hostSync: false, motion: 1, rate: 1 })
  const [generation, setGeneration] = useState(0)
  const [paused, setPaused] = useState(true)
  resetTiming = next => { timingRuntime = null; setOptions(next); setPaused(false); setGeneration(value => value + 1) }
  pauseTiming = () => setPaused(true)
  resumeTiming = () => setPaused(false)
  return <Cinema2Stage key={generation} presetId={CINEMA2_BLOCKSHIFT_PRESET_ID}
    isPlaying={!paused} isPaused={paused} analysisActive activeAudioTrackId="blockshift-host-transport-fixture"
    bpm={options.bpm} bpmSync={options.hostSync} getAudioTime={() => performance.now() / 1000}
    onRuntimeReady={runtime => {
      timingRuntime = runtime
      if (!runtime) return
      for (const [id, value] of [[ids.bpmSync, options.localSync], [ids.motionAmount, options.motion], [ids.motionRate, options.rate], [ids.rotationRange, 45], [ids.atmosphere, false], [ids.bloom, 0]] as const) {
        const result = runtime.getParameterState().setPersistentValue(id, value)
        if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
      }
    }} />
}

// Both views use the normal catalog; no special BLOCKSHIFT registration exists in this entry.
const root = document.getElementById('root')
if (!root) throw new Error('BLOCKSHIFT acceptance root missing.')
const timing = new URLSearchParams(location.search).has('timing-fixture')
const audioFixture = new URLSearchParams(location.search).has('audio-fixture')
createRoot(root).render(
  <React.StrictMode><AudioEngineProvider>
    {audioFixture ? <Cinema2BlockshiftAudioBrowserFixture /> : timing ? <TimingFixture /> : <VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView="react" />}
  </AudioEngineProvider></React.StrictMode>,
)
