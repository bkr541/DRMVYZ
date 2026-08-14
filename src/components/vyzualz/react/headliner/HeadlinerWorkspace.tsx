import { useEffect } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { CtrlSection, SelectRow } from '../ReactControlRows'
import { ReactAudioPanel } from '../ReactAudioPanel'

function HeadlinerFullscreenIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 12V5h7M20 5h7v7M27 20v7h-7M12 27H5v-7" />
      <rect x="10" y="10" width="12" height="12" rx="2" />
    </svg>
  )
}

export function HeadlinerEnginePanel() {
  const settings = useReactStore(state => state.headlinerSettings)
  const setHeadlinerSettings = useReactStore(state => state.setHeadlinerSettings)

  return (
    <section className="rv-headliner-engine-panel" aria-label="Headliner setup">
      <CtrlSection label="Engine Mode" />
      <div className="rv-sound-source-grid rv-headliner-mode-grid" aria-label="Headliner engine modes">
        <button
          type="button"
          className="rv-sound-source-card is-active"
          aria-pressed="true"
          onClick={() => setHeadlinerSettings({ mode: 'fullscreen' })}
        >
          <span className="rv-sound-source-card-icon"><HeadlinerFullscreenIcon /></span>
          <span className="rv-sound-source-card-label">Fullscreen</span>
        </button>
      </div>

      <CtrlSection label="Input Source" />
      <SelectRow
        id="headliner-input-source"
        label="Camera"
        value={settings.inputSourceId}
        onChange={() => setHeadlinerSettings({ inputSourceId: 'default-front-camera' })}
        options={[{ value: 'default-front-camera', label: 'Default Front Camera' }]}
        description="Stage 1 reserves the default computer front camera. Camera permission and capture begin in Stage 2."
      />
    </section>
  )
}

export function HeadlinerSurface({
  onCanvasReady,
  onLiveFps,
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  useEffect(() => {
    onCanvasReady?.(null)
    onLiveFps?.(0)
    return () => onCanvasReady?.(null)
  }, [onCanvasReady, onLiveFps])

  return (
    <section
      className="rv-headliner-surface"
      aria-label="Headliner workspace"
      data-headliner-surface="foundation"
    >
      <div className="rv-headliner-surface-placeholder" role="status">
        <span className="rv-headliner-surface-icon" aria-hidden="true"><HeadlinerFullscreenIcon /></span>
        <strong>Camera not started</strong>
        <span>Fullscreen workspace ready for the default front camera.</span>
      </div>
    </section>
  )
}

function HeadlinerEmptyWorkspacePanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rv-workspace-panel rv-headliner-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-headliner-empty-state">
            <strong>{title}</strong>
            <span>{body}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeadlinerPresetsPanel() {
  return (
    <HeadlinerEmptyWorkspacePanel
      title="Headliner presets coming later"
      body="This foundation does not invent preset recipes before the camera and effect model exists."
    />
  )
}

export function HeadlinerDesignPanel() {
  return (
    <HeadlinerEmptyWorkspacePanel
      title="Camera design controls are not available yet"
      body="Per-camera and master-output design controls are intentionally deferred until the Headliner runtime is connected."
    />
  )
}

export function HeadlinerReactivityPanel() {
  return (
    <div className="rv-workspace-panel rv-headliner-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-headliner-global-analysis-note">
            Headliner-specific reactions are not authored yet. Shared music analysis remains available below.
          </div>
          <ReactAudioPanel />
        </div>
      </div>
    </div>
  )
}

export function HeadlinerOutputPanel() {
  return (
    <HeadlinerEmptyWorkspacePanel
      title="Headliner output is not connected yet"
      body="Camera output and recording are intentionally deferred until the live compositor is introduced."
    />
  )
}
