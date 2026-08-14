import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { CtrlSection, SelectRow } from '../ReactControlRows'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { HeadlinerCameraRuntime } from './HeadlinerCameraRuntime'
import {
  createHeadlinerFullscreenProgram,
  HeadlinerFullscreenCompositor,
} from './HeadlinerCompositor'

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
        description="Headliner uses the default computer front camera. Camera access is requested when Headliner becomes active."
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runtimeRef = useRef<HeadlinerCameraRuntime | null>(null)
  if (!runtimeRef.current) runtimeRef.current = new HeadlinerCameraRuntime('camera-1')
  const runtime = runtimeRef.current
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const compositor = new HeadlinerFullscreenCompositor({
      canvas,
      getProgramInput: () => createHeadlinerFullscreenProgram(
        runtime.getFrameSource(),
        runtime.getSnapshot().status,
      ),
      onLiveFps,
    })

    onCanvasReady?.(canvas)
    onLiveFps?.(0)
    compositor.start()
    void runtime.start(video)

    return () => {
      compositor.stop()
      runtime.stop()
      onCanvasReady?.(null)
    }
  }, [onCanvasReady, onLiveFps, runtime])

  const isLive = snapshot.status === 'live'
  const statusTitle = snapshot.status === 'requesting'
    ? 'Starting camera'
    : snapshot.status === 'error'
      ? snapshot.errorCode === 'permission-denied'
        ? 'Camera permission denied'
        : snapshot.errorCode === 'unavailable'
          ? 'Camera unavailable'
          : 'Camera error'
      : snapshot.status === 'disconnected'
        ? 'Connection Lost'
        : 'Camera not started'
  const statusBody = snapshot.status === 'requesting'
    ? 'Allow camera access to show the default front camera in Headliner.'
    : snapshot.message ?? 'Fullscreen workspace is preparing the default front camera.'

  return (
    <section
      className="rv-headliner-surface"
      aria-label="Headliner workspace"
      data-headliner-surface="camera"
      data-headliner-camera-status={snapshot.status}
    >
      <canvas
        ref={canvasRef}
        className="rv-headliner-program-canvas"
        data-headliner-output-canvas="true"
      />
      <video
        ref={videoRef}
        className="rv-headliner-camera-video"
        aria-hidden="true"
        autoPlay
        muted
        playsInline
      />
      {!isLive && (
        <div className="sr-only" role="status" aria-live="polite">
          <strong>{statusTitle}</strong>
          <span>{statusBody}</span>
        </div>
      )}
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
      body="Per-camera and master-output design controls are intentionally deferred until the Headliner effect model is defined."
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
