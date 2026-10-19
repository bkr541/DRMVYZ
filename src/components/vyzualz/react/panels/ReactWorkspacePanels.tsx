import { useEffect, useState } from 'react'
import { IconChipButton } from '../controls/IconChipButton'
import { useReactStore } from '../../../../stores/reactStore'
import type { Recorder } from '../../../../hooks/useRecorder'
import { ReactFxPanel } from '../ReactFxPanel'
import { ReactInspectorPanel } from '../ReactInspectorPanel'
import { ReactModulationPanel } from '../ReactModulationPanel'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { ReactRecordingPanel } from '../ReactRecordingPanel'
import { Cinema2RuntimeDiagnostics } from '../Cinema2RuntimeDiagnostics'
import type { Cinema2Runtime, Cinema2RuntimeSnapshot } from '../../cinema2'
import { LaserDmxShowDirectorControls } from '../LaserDmxShowDirectorControls'
import { ProductionOutputPanel } from '../output/ProductionOutputPanel'
import { PixGridDesignPanel } from '../pixGrid/PixGridDesignPanel'
import { PixGridReactivityWorkspace, type PixGridReactivitySurface } from '../pixGrid/PixGridReactivityWorkspace'
import { PanelSubtabs } from '../PanelSubtabs'
import { getRequestedPixGridWorkspace, subscribePixGridWorkspace } from '../pixGrid/PixGridWorkspaceNavigation'
import { DrawerNotice } from '../../shared/DrawerNotice'
import {
  isCanvasFracturesOutputDeferred,
  isCanvasShiftgridOutputDeferred,
  type CanvasOutputCapability,
} from '../canvasFracturesOutputContract'

type DesignSurface = 'engine' | 'selection'
type ReactivitySurface = 'routing' | 'analysis'
type OutputSurface = 'recording' | 'production'

export function ReactDesignWorkspacePanel({ hasSelection }: { hasSelection: boolean }) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const laserDmxBeamMatrixAuthoringMode = useReactStore(state => state.laserDmxBeamMatrixAuthoringMode)
  const showDirectorDesign = activeReactEngineId === 'laserDmx' && laserDmxBeamMatrixAuthoringMode === 'showDirector'
  const pixGridDesign = activeReactEngineId === 'pixGrid'
  const [surface, setSurface] = useState<DesignSurface>(
    hasSelection ? 'selection' : 'engine',
  )

  useEffect(() => {
    setSurface(hasSelection ? 'selection' : 'engine')
  }, [hasSelection])

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

export function ReactReactivityWorkspacePanel() {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const pixGridActive = useReactStore(state => state.activeReactEngineId === 'pixGrid')
  const [surface, setSurface] = useState<ReactivitySurface>('routing')
  const [pixGridSurface, setPixGridSurface] = useState<PixGridReactivitySurface>(
    () => getRequestedPixGridWorkspace() ?? 'routing',
  )
  useEffect(() => subscribePixGridWorkspace(next => setPixGridSurface(next)), [])
  if (pixGridActive) {
    return (
      <div className="rv-workspace-panel">
        <div className="rv-pix-grid-reactivity-tabs-wrap">
          <PanelSubtabs
            value={pixGridSurface}
            onChange={value => setPixGridSurface(value)}
            ariaLabel="PixGrid reactivity surfaces"
            className="rv-pix-grid-reactivity-tabs"
            options={[
              { id: 'routing', label: 'ROUTING' },
              { id: 'events', label: 'EVENTS' },
              { id: 'choreography', label: 'CHOREOGRAPHY' },
              { id: 'analysis', label: 'ANALYSIS' },
            ]}
          />
        </div>
        <div className="rv-workspace-panel-body"><div className="rv-inspector rv-inspector-scroll"><PixGridReactivityWorkspace surface={pixGridSurface} /></div></div>
      </div>
    )
  }

  return (
    <div className="rv-workspace-panel">
      <PanelSubtabs
        value={surface}
        onChange={value => setSurface(value)}
        ariaLabel="Reactivity surfaces"
        options={[
          { id: 'routing', label: 'ROUTING' },
          { id: 'analysis', label: 'ANALYSIS' },
        ]}
      />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'analysis' ? <ReactAudioPanel /> : <ReactModulationPanel />}
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
  cinema2Runtime?: Cinema2Runtime | null
  cinema2RuntimeSnapshot?: Cinema2RuntimeSnapshot | null
}

export function ReactOutputWorkspacePanel({
  canvas,
  outputCapability,
  recorder,
  liveFps,
  hasActiveProgramAudio,
  onStartRecording,
  cinema2Runtime = null,
  cinema2RuntimeSnapshot = null,
}: ReactOutputWorkspacePanelProps) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const isLaserDmx = activeReactEngineId === 'laserDmx'
  const isCinema2 = activeReactEngineId === 'cinema2'
  const fracturesOutputDeferred = isCanvasFracturesOutputDeferred(outputCapability)
  const shiftgridOutputDeferred = isCanvasShiftgridOutputDeferred(outputCapability)
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
          {isCinema2 && (
            <Cinema2RuntimeDiagnostics
              runtime={cinema2Runtime}
              snapshot={cinema2RuntimeSnapshot}
            />
          )}
          {surface === 'production' && isLaserDmx ? (
            <div className="rv-ctrl-group"><ProductionOutputPanel /></div>
          ) : shiftgridOutputDeferred ? (
            <DrawerNotice tone="info" title="SHIFTGRID recording arrives in Phase 1" ariaLabel="SHIFTGRID recording unavailable">
              <p>Phase 0 establishes the renderer, media, settings, and lifecycle contracts without publishing placeholder artwork as output.</p>
              <IconChipButton disabled>Recording unavailable</IconChipButton>
            </DrawerNotice>
          ) : fracturesOutputDeferred ? (
            <DrawerNotice tone="info" title="Fractures recording is unavailable" ariaLabel="Fractures recording unavailable">
              <p>The effective Fractures renderer is active for preview and performance, but capture is intentionally disabled in the current MVP.</p>
              <IconChipButton disabled>Recording unavailable</IconChipButton>
            </DrawerNotice>
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
