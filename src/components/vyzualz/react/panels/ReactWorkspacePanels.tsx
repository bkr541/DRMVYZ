import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../../stores/reactStore'
import type { Recorder } from '../../../../hooks/useRecorder'
import { ReactFxPanel } from '../ReactFxPanel'
import { ReactInspectorPanel } from '../ReactInspectorPanel'
import { ReactModulationPanel } from '../ReactModulationPanel'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { ReactRecordingPanel } from '../ReactRecordingPanel'
import { CinemaRenderedDiagnostics } from '../CinemaWorkspace'
import { CinemaInspectorPanel } from '../CinemaInspectorPanel'
import { CinemaComposerStage19Panel } from '../CinemaComposerStage19Panel'
import type { CinemaWorkspaceFrameBridgeResult } from '../CinemaWorkspaceFrameBridge'
import { isCinemaBuiltInComposition, useCinemaStore, type CinemaRuntimeSnapshot } from '../../cinema'
import { LaserDmxShowDirectorControls } from '../LaserDmxShowDirectorControls'
import { ProductionOutputPanel } from '../output/ProductionOutputPanel'
import { PixGridDesignPanel } from '../pixGrid/PixGridDesignPanel'
import { PixGridReactivityWorkspace, type PixGridReactivitySurface } from '../pixGrid/PixGridReactivityWorkspace'
import { PanelSubtabs } from '../PanelSubtabs'
import { getRequestedPixGridWorkspace, subscribePixGridWorkspace } from '../pixGrid/PixGridWorkspaceNavigation'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import { NoticeCard } from '../controls/NoticeCard'
import {
  isCanvasFracturesOutputDeferred,
  type CanvasOutputCapability,
} from '../canvasFracturesOutputContract'

type DesignSurface = 'engine' | 'selection'
type ReactivitySurface = 'routing' | 'performance' | 'analysis'
type OutputSurface = 'recording' | 'production'

const PIX_GRID_REACTIVITY_SURFACE_LABELS: Record<PixGridReactivitySurface, string> = {
  routing: 'Routing',
  events: 'Events',
  choreography: 'Choreography',
  analysis: 'Analysis',
}

export function ReactDesignWorkspacePanel({ hasSelection }: { hasSelection: boolean }) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const laserDmxBeamMatrixAuthoringMode = useReactStore(state => state.laserDmxBeamMatrixAuthoringMode)
  const showDirectorDesign = activeReactEngineId === 'laserDmx' && laserDmxBeamMatrixAuthoringMode === 'showDirector'
  const pixGridDesign = activeReactEngineId === 'pixGrid'
  const cinemaDesign = activeReactEngineId === 'cinema'
  const [surface, setSurface] = useState<DesignSurface>(hasSelection ? 'selection' : 'engine')

  useEffect(() => {
    setSurface(hasSelection ? 'selection' : 'engine')
  }, [hasSelection])

  if (cinemaDesign) {
    return <div className="rv-workspace-panel"><div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll"><CinemaInspectorPanel /></div></div></div>
  }

  if (pixGridDesign) {
    return (
      <div className="rv-workspace-panel">
        <div className="rv-workspace-panel-body">
          <div className="rv-inspector rv-inspector-scroll">
            <PixGridDesignPanel />
          </div>
        </div>
      </div>
    )
  }

  if (showDirectorDesign) {
    return (
      <div className="rv-workspace-panel">
        <div className="rv-workspace-panel-body">
          <div className="rv-inspector rv-inspector-scroll">
            <LaserDmxShowDirectorControls />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={value => setSurface(value)}
        ariaLabel="Design surfaces"
        options={[
          { id: 'engine', label: 'ENGINE' },
          { id: 'selection', label: 'SELECTION', disabled: !hasSelection },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'selection' && hasSelection ? <ReactInspectorPanel /> : <ReactFxPanel />}
        </div>
      </div>
    </div>
  )
}

export function ReactReactivityWorkspacePanel({ cinemaFrameBridge = null }: { cinemaFrameBridge?: CinemaWorkspaceFrameBridgeResult | null }) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const cinemaActive = activeReactEngineId === 'cinema'
  const pixGridActive = useReactStore(state => state.activeReactEngineId === 'pixGrid')
  const cinemaState = useCinemaStore(useShallow(state => ({ activeCompositionId: state.activeCompositionId, compositions: state.compositions, definitions: state.definitions })))
  const cinemaPreset = cinemaState.compositions.find(candidate => candidate.id === cinemaState.activeCompositionId) ?? null
  const [surface, setSurface] = useState<ReactivitySurface>('routing')
  const [pixGridSurface, setPixGridSurface] = useState<PixGridReactivitySurface>(
    () => getRequestedPixGridWorkspace() ?? 'routing',
  )
  useEffect(() => subscribePixGridWorkspace(next => setPixGridSurface(next)), [])
  useEffect(() => {
    if (!cinemaActive && surface === 'performance') setSurface('routing')
  }, [cinemaActive, surface])

  if (pixGridActive) {
    return (
      <div className="rv-workspace-panel">
        <div className="rv-pix-grid-reactivity-tabs-help drm-help-overlay-anchor">
          <PanelSubtabs
            value={pixGridSurface}
            onChange={value => setPixGridSurface(value)}
            ariaLabel="PixGrid reactivity surfaces"
            layout="wrap"
            className="rv-pix-grid-reactivity-tabs"
            options={[
              { id: 'routing', label: 'ROUTING' },
              { id: 'events', label: 'EVENTS' },
              { id: 'choreography', label: 'CHOREOGRAPHY' },
              { id: 'analysis', label: 'ANALYSIS' },
            ]}
          />
          <HelpInfoTrigger
            helpId="react.pixGrid.reactivity.workspace.tabs"
            currentValue={PIX_GRID_REACTIVITY_SURFACE_LABELS[pixGridSurface]}
            currentValueTone="accent"
            placement="left"
          />
        </div>
        <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll"><PixGridReactivityWorkspace surface={pixGridSurface} /></div></div>
      </div>
    )
  }

  const editCinema = (label: string, editor: Parameters<ReturnType<typeof useCinemaStore.getState>['editCinemaComposition']>[2]) => {
    if (cinemaPreset) useCinemaStore.getState().editCinemaComposition(cinemaPreset.id, label, editor)
  }

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={value => setSurface(value)}
        ariaLabel="Reactivity surfaces"
        options={[
          { id: 'routing', label: 'ROUTING' },
          ...(cinemaActive ? [{ id: 'performance' as const, label: 'PERFORMANCE' }] : []),
          { id: 'analysis', label: 'ANALYSIS' },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {cinemaActive ? (
            surface === 'analysis' ? <ReactAudioPanel /> : cinemaPreset ? (
              <CinemaComposerStage19Panel
                composition={cinemaPreset}
                definitions={cinemaState.definitions}
                frameBridge={cinemaFrameBridge}
                edit={editCinema}
                surface={surface}
                readOnly={isCinemaBuiltInComposition(cinemaPreset)}
              />
            ) : <div className="rv-ctrl-info">Select a Cinema preset to configure reactivity.</div>
          ) : surface === 'analysis' ? <ReactAudioPanel /> : <ReactModulationPanel />}
        </div>
      </div>
    </div>
  )
}

interface ReactOutputWorkspacePanelProps {
  canvas: HTMLCanvasElement | null
  outputCapability: CanvasOutputCapability
  recorder: Recorder
  liveFps: number
  hasActiveProgramAudio: boolean
  onStartRecording: (canvas: HTMLCanvasElement) => void
  cinemaFrameBridge?: CinemaWorkspaceFrameBridgeResult | null
  cinemaRuntimeSnapshot?: CinemaRuntimeSnapshot | null
}

export function ReactOutputWorkspacePanel({
  canvas,
  outputCapability,
  recorder,
  liveFps,
  hasActiveProgramAudio,
  onStartRecording,
  cinemaFrameBridge = null,
  cinemaRuntimeSnapshot = null,
}: ReactOutputWorkspacePanelProps) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const isLaserDmx = activeReactEngineId === 'laserDmx'
  const isCinema = activeReactEngineId === 'cinema'
  const fracturesOutputDeferred = isCanvasFracturesOutputDeferred(outputCapability)
  const [surface, setSurface] = useState<OutputSurface>('recording')

  useEffect(() => {
    if (!isLaserDmx && surface === 'production') setSurface('recording')
  }, [isLaserDmx, surface])

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={value => setSurface(value)}
        ariaLabel="Output surfaces"
        options={[
          { id: 'recording', label: 'RECORDING' },
          { id: 'production', label: 'PRODUCTION', disabled: !isLaserDmx },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {isCinema && (
            <CinemaRenderedDiagnostics
              frameBridge={cinemaFrameBridge}
              runtimeSnapshot={cinemaRuntimeSnapshot}
            />
          )}
          {surface === 'production' && isLaserDmx ? (
            <div className="rv-ctrl-group"><ProductionOutputPanel /></div>
          ) : fracturesOutputDeferred ? (
            <NoticeCard tone="info" title="Fractures recording is unavailable" ariaLabel="Fractures recording unavailable">
              <p>The effective Fractures renderer is active for preview and performance, but capture is intentionally disabled in the current MVP.</p>
              <button type="button" className="rv-reset-btn" disabled>Recording unavailable</button>
            </NoticeCard>
          ) : (
            <ReactRecordingPanel
              canvas={canvas}
              recorder={recorder}
              liveFps={liveFps}
              hasActiveProgramAudio={hasActiveProgramAudio}
              onStartRecording={onStartRecording}
            />
          )}
        </div>
      </div>
    </div>
  )
}
