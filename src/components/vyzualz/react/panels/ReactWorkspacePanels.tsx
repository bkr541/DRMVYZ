import { useEffect, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import type { Recorder } from '../../../../hooks/useRecorder'
import { ReactFxPanel } from '../ReactFxPanel'
import { ReactInspectorPanel } from '../ReactInspectorPanel'
import { ReactModulationPanel } from '../ReactModulationPanel'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { ReactRecordingPanel } from '../ReactRecordingPanel'
import { LaserDmxShowDirectorControls } from '../LaserDmxShowDirectorControls'
import { ProductionOutputPanel } from '../output/ProductionOutputPanel'

type DesignSurface = 'engine' | 'selection'
type ReactivitySurface = 'routing' | 'analysis'
type OutputSurface = 'recording' | 'production'

function PanelSubtabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ id: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div className="rv-right-subtabs" role="tablist" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? 'is-active' : ''}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ReactDesignWorkspacePanel({ hasSelection }: { hasSelection: boolean }) {
  const activeReactEngineId = useReactStore(state => state.activeReactEngineId)
  const laserDmxBeamMatrixAuthoringMode = useReactStore(state => state.laserDmxBeamMatrixAuthoringMode)
  const showDirectorDesign = activeReactEngineId === 'laserDmx' && laserDmxBeamMatrixAuthoringMode === 'showDirector'
  const [surface, setSurface] = useState<DesignSurface>(hasSelection ? 'selection' : 'engine')

  useEffect(() => {
    setSurface(hasSelection ? 'selection' : 'engine')
  }, [hasSelection])

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
  const [surface, setSurface] = useState<ReactivitySurface>('routing')

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
  recorder: Recorder
  liveFps: number
  hasActiveProgramAudio: boolean
  onStartRecording: (canvas: HTMLCanvasElement) => void
}

export function ReactOutputWorkspacePanel({
  canvas,
  recorder,
  liveFps,
  hasActiveProgramAudio,
  onStartRecording,
}: ReactOutputWorkspacePanelProps) {
  const isLaserDmx = useReactStore(state => state.activeReactEngineId === 'laserDmx')
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
          {surface === 'production' && isLaserDmx ? (
            <div className="rv-ctrl-group"><ProductionOutputPanel /></div>
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
