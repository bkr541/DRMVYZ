import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { CtrlSection, SelectRow } from '../ReactControlRows'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { ConfirmDialog } from '../controls/ConfirmDialog'
import { IconChipButton } from '../controls/IconChipButton'
import { DrawerNotice } from '../../shared/DrawerNotice'
import { getNativeCameraBridge } from '../../../../native/cameraAccessBridge'
import { describeHeadlinerCameraStatus, HeadlinerCameraRuntime } from './HeadlinerCameraRuntime'
import { buildHeadlinerCameraOptions, useHeadlinerCameraDevices } from './HeadlinerCameraDevices'
import { publishHeadlinerCameraRuntime, useHeadlinerCameraStatus } from './HeadlinerCameraStatus'
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
  const { snapshot, disconnect, connect } = useHeadlinerCameraStatus()
  // Camera names are hidden by the browser until access has been granted, so re-read once the camera goes live.
  const { devices } = useHeadlinerCameraDevices(snapshot?.status === 'live')
  const liveCameraLabel = snapshot?.status === 'live' ? snapshot.cameraLabel : null
  const options = buildHeadlinerCameraOptions(devices, settings.inputSourceId, liveCameraLabel)
  const description = liveCameraLabel
    ? `Live: ${liveCameraLabel}`
    : devices.length === 0
      ? 'No cameras detected yet. Connect a camera or start a virtual camera (such as OBS); this list updates automatically.'
      : `${devices.length} ${devices.length === 1 ? 'camera' : 'cameras'} detected. Default Front Camera uses your system's preferred camera.`

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
        {[1, 2, 3].map(slot => (
          <button
            key={slot}
            type="button"
            className="rv-sound-source-card rv-headliner-mode-placeholder"
            aria-label={`Engine mode slot ${slot + 1}, not available yet`}
            disabled
          />
        ))}
      </div>

      <CtrlSection label="Input Source" />
      <SelectRow
        id="headliner-input-source"
        label="Camera"
        value={settings.inputSourceId}
        onChange={inputSourceId => setHeadlinerSettings({ inputSourceId })}
        options={options}
        description={description}
      />
      <div className="rv-ctrl-action-row">
        {snapshot?.userDisconnected ? (
          <IconChipButton onClick={connect}>Connect Camera</IconChipButton>
        ) : (
          <IconChipButton onClick={disconnect} disabled={!snapshot || snapshot.status === 'idle'}>
            Disconnect Camera
          </IconChipButton>
        )}
      </div>
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
  const inputSourceId = useReactStore(state => state.headlinerSettings.inputSourceId)
  const inputSourceRef = useRef(inputSourceId)
  inputSourceRef.current = inputSourceId
  const status = describeHeadlinerCameraStatus(snapshot)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const compositor = new HeadlinerFullscreenCompositor({
      canvas,
      getProgramInput: () => {
        const current = runtime.getSnapshot()
        return createHeadlinerFullscreenProgram(
          runtime.getFrameSource(),
          current.status,
          describeHeadlinerCameraStatus(current).title,
        )
      },
      onLiveFps,
    })

    onCanvasReady?.(canvas)
    onLiveFps?.(0)
    compositor.start()
    publishHeadlinerCameraRuntime(runtime)
    void runtime.start(video, inputSourceRef.current)

    return () => {
      compositor.stop()
      publishHeadlinerCameraRuntime(null)
      runtime.stop()
      onCanvasReady?.(null)
    }
  }, [onCanvasReady, onLiveFps, runtime])

  // Switching cameras in the setup panel reopens the stream; the first run is covered by start() above.
  useEffect(() => {
    runtime.setSource(inputSourceId)
  }, [inputSourceId, runtime])

  const isLive = snapshot.status === 'live'
  const statusBody = snapshot.status === 'requesting'
    ? 'Allow camera access to show the camera in Headliner.'
    : status.detail ?? 'Fullscreen workspace is preparing the camera.'
  const permissionBlocked = snapshot.status === 'error' && snapshot.errorCode === 'permission-denied'
  const showNotice = !permissionBlocked && (snapshot.status === 'error'
    || (snapshot.status === 'disconnected' && snapshot.errorCode !== null))
  const canOpenSettings = permissionBlocked && typeof getNativeCameraBridge()?.openSettings === 'function'
  // The permission prompt is a dialog, shown each time the camera is blocked. "Not now" hides it for
  // this attempt only; the next failed attempt (Try again, another camera) raises it again.
  const [permissionDismissed, setPermissionDismissed] = useState(false)
  useEffect(() => {
    if (snapshot.status !== 'error') setPermissionDismissed(false)
  }, [snapshot.status])
  const retryCamera = () => {
    setPermissionDismissed(false)
    runtime.retry()
  }

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
      {permissionBlocked && !permissionDismissed && (
        <ConfirmDialog
          title="Camera Access Needed"
          message={status.detail}
          iconTone="neutral"
          danger={false}
          confirmTone="primary"
          cancelLabel="Not now"
          confirmLabel={canOpenSettings ? 'Open Camera Settings' : 'Try again'}
          secondary={canOpenSettings ? { label: 'Try again', onClick: retryCamera } : undefined}
          onCancel={() => setPermissionDismissed(true)}
          onConfirm={() => {
            if (canOpenSettings) void getNativeCameraBridge()?.openSettings?.()
            else retryCamera()
          }}
        />
      )}
      {showNotice && (
        <DrawerNotice tone="warning" role="alert" title={status.title}>
          <div>{status.detail}</div>
          <div className="rv-ctrl-action-row">
            <IconChipButton onClick={() => runtime.retry()}>Try again</IconChipButton>
          </div>
        </DrawerNotice>
      )}
      {!isLive && (
        <div className="sr-only" role="status" aria-live="polite">
          <strong>{status.title}</strong>
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

/** Headliner has no design controls yet; the tab stays so the inspector layout matches the other engines. */
export function HeadlinerDesignPanel() {
  return (
    <div className="rv-workspace-panel rv-headliner-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll" />
      </div>
    </div>
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
