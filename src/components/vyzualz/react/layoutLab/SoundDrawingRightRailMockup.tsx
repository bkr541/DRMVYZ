import { useState } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { PanelSubtabs } from '../PanelSubtabs'
import { RecordingPanel } from '../../recording/RecordingPanel'
import type { RecorderState, RecordingMode } from '../../../../hooks/useRecorder'
import { SoundDrawingFxMockup } from './SoundDrawingFxMockup'
import { SoundDrawingReactivityMockup } from './SoundDrawingReactivityMockup'
import { SoundDrawingPresetsMockup } from './SoundDrawingPresetsMockup'
import type { SoundDrawingMockState } from './useSoundDrawingMockState'

// ── SoundDrawingRightRailMockup ────────────────────────────────────────────
//
// Disconnected copy of the right inspector's PRESETS / DESIGN / REACT /
// OUTPUT tabs for Sound Drawing (panels/ReactWorkspacePanels.tsx). All four
// get their real sub-navigation and real Sound Drawing layout: PRESETS
// shows sample preset cards (SoundDrawingPresetsMockup — static swatches
// instead of ReactPresetThumbnail's live canvas render), OUTPUT reuses the
// real RecordingPanel component directly since it's already pure/props-
// driven, wired to a local simulated recorder state that never touches a
// real canvas or MediaRecorder.

type RightTab = 'presets' | 'design' | 'react' | 'output'
type DesignSurface = 'engine' | 'selection'
type ReactivitySurface = 'routing' | 'analysis'
type OutputSurface = 'recording' | 'production'

const RIGHT_TABS: RailTabOption<RightTab>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

function PresetsTabMockup() {
  return (
    <div className="rv-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <SoundDrawingPresetsMockup />
        </div>
      </div>
    </div>
  )
}

function DesignTabMockup({ state }: { state: SoundDrawingMockState }) {
  const [surface, setSurface] = useState<DesignSurface>('engine')
  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={setSurface}
        ariaLabel="Design surfaces"
        options={[
          { id: 'engine', label: 'ENGINE' },
          { id: 'selection', label: 'SELECTION', disabled: true },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <SoundDrawingFxMockup state={state} />
        </div>
      </div>
    </div>
  )
}

function ReactTabMockup({ state }: { state: SoundDrawingMockState }) {
  const [surface, setSurface] = useState<ReactivitySurface>('routing')
  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={setSurface}
        ariaLabel="Reactivity surfaces"
        options={[
          { id: 'routing', label: 'ROUTING' },
          { id: 'analysis', label: 'ANALYSIS' },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'analysis' ? (
            <div className="rv-ctrl-info rv-control-helper-copy">
              Music Intelligence diagnostics placeholder — Layout Lab does not run live audio analysis.
            </div>
          ) : (
            <SoundDrawingReactivityMockup state={state} />
          )}
        </div>
      </div>
    </div>
  )
}

function OutputTabMockup() {
  const [surface, setSurface] = useState<OutputSurface>('recording')
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [fps, setFps] = useState<30 | 60>(30)

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={setSurface}
        ariaLabel="Output surfaces"
        options={[
          { id: 'recording', label: 'RECORDING' },
          { id: 'production', label: 'PRODUCTION', disabled: true },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <RecordingPanel
            canvas={null}
            recorderState={recorderState}
            recordingMode={'video-only' as RecordingMode}
            recordingTime={0}
            recorderError={null}
            fps={fps}
            liveFps={0}
            onFpsChange={setFps}
            onStartRecording={() => setRecorderState('recording')}
            onStopRecording={() => setRecorderState('idle')}
            hasActiveProgramAudio={false}
            onExportPng={() => {}}
          />
        </div>
      </div>
    </div>
  )
}

export function SoundDrawingRightRailMockup({ state }: { state: SoundDrawingMockState }) {
  const [tab, setTab] = useState<RightTab>('design')

  return (
    <>
      <RailTabs tabs={RIGHT_TABS} activeTab={tab} onChange={setTab} ariaLabel="Sound Drawing inspector tabs" />
      <div className="vz-panel-body">
        {tab === 'presets' && <PresetsTabMockup />}
        {tab === 'design' && <DesignTabMockup state={state} />}
        {tab === 'react' && <ReactTabMockup state={state} />}
        {tab === 'output' && <OutputTabMockup />}
      </div>
    </>
  )
}
