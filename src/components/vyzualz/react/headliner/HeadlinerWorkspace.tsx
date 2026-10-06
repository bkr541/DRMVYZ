import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { Collapsible, CtrlSection, PaletteColorRow, SelectRow, SliderRow, ToggleRow } from '../ReactControlRows'
import { ReactAudioPanel } from '../ReactAudioPanel'
import { ConfirmDialog } from '../controls/ConfirmDialog'
import { IconChipButton } from '../controls/IconChipButton'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { PanelSubtabs } from '../PanelSubtabs'
import { ReactPresetCard } from '../ReactPresetCard'
import { DrawerNotice } from '../../shared/DrawerNotice'
import { usePresetScopeFilter } from '../../../../features/presetCatalog/presetCatalogStore'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import type { ReactTrackSection } from '../ReactTypes'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import { getNativeCameraBridge } from '../../../../native/cameraAccessBridge'
import { describeHeadlinerCameraStatus, HeadlinerCameraRuntime } from './HeadlinerCameraRuntime'
import { buildHeadlinerCameraOptions, useHeadlinerCameraDevices } from './HeadlinerCameraDevices'
import { isHeadlinerCameraWanted } from './HeadlinerCameraSession'
import { publishHeadlinerCameraRuntime, useHeadlinerCameraStatus } from './HeadlinerCameraStatus'
import {
  createHeadlinerFullscreenProgram,
  HeadlinerFullscreenCompositor,
} from './HeadlinerCompositor'
import {
  HEADLINER_GROUP_LABELS,
  HEADLINER_GROUP_ORDER,
  HEADLINER_PRESETS,
  resolveHeadlinerPresetClick,
  getHeadlinerBoolean,
  getHeadlinerPreset,
  isHeadlinerParameterVisible,
  resolveHeadlinerParameters,
  type HeadlinerParameterDefinition,
  type HeadlinerParameterValue,
  type HeadlinerParameterValues,
} from './HeadlinerEffectCatalog'
import { createHeadlinerEffectProcessor, type HeadlinerEffectProcessor } from './HeadlinerEffects'
import { HeadlinerTimingTracker } from './HeadlinerTiming'

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

export interface HeadlinerAudioInput {
  /** Fresh audio-clock time in seconds. */
  getAudioTime?: () => number
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: ReactTrackSection[]
  trackIdentity?: string | null
}

export function HeadlinerSurface({
  onCanvasReady,
  onLiveFps,
  audio,
}: {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  audio?: HeadlinerAudioInput
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
  const presetId = useReactStore(state => state.headlinerSettings.presetId)
  const parameterOverrides = useReactStore(state => state.headlinerSettings.parameters)
  const effectRef = useRef<{ presetId: string; processor: HeadlinerEffectProcessor } | null>(null)
  const effectInputRef = useRef({ presetId, parameterOverrides, audio })
  effectInputRef.current = { presetId, parameterOverrides, audio }

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const timingTracker = new HeadlinerTimingTracker()
    let previousContext: SharedPerformanceContext | null = null
    const compositor = new HeadlinerFullscreenCompositor({
      canvas,
      getProgramInput: () => {
        const current = runtime.getSnapshot()
        const source = runtime.getFrameSource()
        let effect = null
        const { presetId: activePresetId, parameterOverrides: overrides, audio: audioInput } = effectInputRef.current
        if (activePresetId === null && effectRef.current) {
          // Clean Playback: drop the previous preset's buffers and show the plain camera.
          effectRef.current.processor.dispose()
          effectRef.current = null
        }
        if (source && activePresetId !== null) {
          if (effectRef.current?.presetId !== activePresetId) {
            effectRef.current?.processor.dispose()
            effectRef.current = { presetId: activePresetId, processor: createHeadlinerEffectProcessor(getHeadlinerPreset(activePresetId).id) }
          }
          const parameters = resolveHeadlinerParameters(activePresetId, overrides[activePresetId])
          const audioTimeSec = audioInput?.getAudioTime?.() ?? AudioFeatureBus.getFrame().timeSec
          const identity = audioInput?.trackIdentity ?? 'headliner:unloaded-track'
          previousContext = buildSharedPerformanceContext({
            audioTimeSec: Number.isFinite(audioTimeSec) && audioTimeSec >= 0 ? audioTimeSec : 0,
            frame: AudioFeatureBus.getFrame(),
            analysis: audioInput?.trackAnalysis ?? null,
            resolvedSections: audioInput?.trackSections ?? [],
            trackIdentity: identity,
            trackChangeIdentity: `track:${identity}`,
            previous: previousContext,
          })
          effect = {
            processor: effectRef.current.processor,
            parameters,
            timing: timingTracker.update(
              performance.now() / 1000,
              previousContext,
              getHeadlinerBoolean(parameters, 'bpmSync', true),
              previousContext.audioTimeSec,
            ),
          }
        }
        return createHeadlinerFullscreenProgram(
          source,
          current.status,
          describeHeadlinerCameraStatus(current).title,
          effect,
        )
      },
      onLiveFps,
    })

    onCanvasReady?.(canvas)
    onLiveFps?.(0)
    compositor.start()
    publishHeadlinerCameraRuntime(runtime)
    // A fresh launch never opens the camera by itself; it comes on when the user connects it, and then
    // stays on across engine switches for the rest of the session.
    if (isHeadlinerCameraWanted()) void runtime.start(video, inputSourceRef.current)
    else runtime.holdOff(video, inputSourceRef.current)

    return () => {
      compositor.stop()
      effectRef.current?.processor.dispose()
      effectRef.current = null
      timingTracker.reset()
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

export function HeadlinerPresetsPanel() {
  const activePresetId = useReactStore(state => state.headlinerSettings.presetId)
  const setHeadlinerSettings = useReactStore(state => state.setHeadlinerSettings)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const needle = query.trim().toLowerCase()
  const inScope = usePresetScopeFilter('headliner', scope)
  const presets = HEADLINER_PRESETS.filter(preset => (
    inScope(preset.id) && `${preset.name} ${preset.description}`.toLowerCase().includes(needle)
  ))

  return (
    <section className="rv-cinema-panel-list" aria-label="Headliner presets" data-preset-scope={scope}>
      <PanelSubtabs
        value={scope}
        options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]}
        onChange={setScope}
        ariaLabel="Preset scope"
      />
      <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search Headliner presets" />
      <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2" data-headliner-preset-grid="true">
        {presets.map(preset => (
          <ReactPresetCard
            key={preset.id}
            id={preset.id}
            title={preset.name}
            description={preset.description}
            palette={[{ color: preset.tone }]}
            isActive={preset.id === activePresetId}
            activateLabel={`Load ${preset.name}`}
            onActivate={() => setHeadlinerSettings({ presetId: resolveHeadlinerPresetClick(preset.id, activePresetId) })}
            dataAttributes={{ 'data-headliner-preset-id': preset.id }}
          />
        ))}
        {presets.length === 0 && (
          <div className="rv-ctrl-info">
            {needle ? `No Headliner presets match \u201c${query}\u201d.` : scope === 'user' ? 'No user presets yet.' : 'No Headliner presets.'}
          </div>
        )}
      </div>
    </section>
  )
}

function formatHeadlinerValue(definition: Extract<HeadlinerParameterDefinition, { kind: 'slider' }>): ((value: number) => string) | undefined {
  switch (definition.format) {
    case 'ms': return value => `${Math.round(value)} ms`
    case 'seconds': return value => `${value.toFixed(2)} s`
    case 'degrees': return value => `${Math.round(value)}\u00b0`
    case 'number': return definition.step >= 1 ? value => `${Math.round(value)}` : value => value.toFixed(2)
    default: return undefined
  }
}

function HeadlinerParameterControl({
  definition,
  value,
  onChange,
}: {
  definition: HeadlinerParameterDefinition
  value: HeadlinerParameterValue
  onChange: (value: HeadlinerParameterValue) => void
}) {
  const id = `headliner-parameter-${definition.id}`
  switch (definition.kind) {
    case 'slider':
      return (
        <SliderRow
          id={id}
          label={definition.label}
          value={typeof value === 'number' ? value : definition.default}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          resetValue={definition.default}
          description={definition.description}
          formatValue={formatHeadlinerValue(definition) ?? (definition.format === 'percent'
            ? (amount: number) => `${Math.round(amount * 100)}%`
            : undefined)}
          onChange={onChange}
        />
      )
    case 'toggle':
      return (
        <ToggleRow
          id={id}
          label={definition.label}
          value={typeof value === 'boolean' ? value : definition.default}
          description={definition.description}
          onChange={onChange}
        />
      )
    case 'select':
      return (
        <SelectRow
          id={id}
          label={definition.label}
          value={typeof value === 'string' ? value : definition.default}
          options={definition.options.map(option => ({ value: option.value, label: option.label }))}
          description={definition.description}
          onChange={onChange}
        />
      )
    case 'color':
      return (
        <PaletteColorRow
          id={id}
          label={definition.label}
          value={typeof value === 'string' ? value : definition.default}
          description={definition.description}
          onChange={onChange}
        />
      )
  }
}

/** The standard four Design groups, filled from the active preset's parameters (empty on Clean Playback). */
export function HeadlinerDesignPanel() {
  const presetId = useReactStore(state => state.headlinerSettings.presetId)
  const overrides = useReactStore(state => state.headlinerSettings.parameters)
  const setHeadlinerSettings = useReactStore(state => state.setHeadlinerSettings)
  const preset = presetId === null ? null : getHeadlinerPreset(presetId)
  const values: HeadlinerParameterValues = preset ? resolveHeadlinerParameters(preset.id, overrides[preset.id]) : {}
  const hasOverrides = preset !== null && Object.keys(overrides[preset.id] ?? {}).length > 0

  const setValue = (id: string, value: HeadlinerParameterValue) => {
    if (!preset) return
    setHeadlinerSettings({
      parameters: { ...overrides, [preset.id]: { ...(overrides[preset.id] ?? {}), [id]: value } },
    })
  }
  const resetParameters = () => {
    if (!preset) return
    const { [preset.id]: _removed, ...rest } = overrides
    setHeadlinerSettings({ parameters: rest })
  }

  return (
    <div className="rv-workspace-panel rv-headliner-workspace-panel" data-headliner-design-preset={preset?.id ?? 'clean-playback'}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group" data-headliner-design-groups="master-controls design effects palette">
            {HEADLINER_GROUP_ORDER.map(group => {
              const controls = (preset?.parameters ?? []).filter(definition => (
                definition.group === group && isHeadlinerParameterVisible(definition, values)
              ))
              return (
                <Collapsible key={group} label={HEADLINER_GROUP_LABELS[group]}>
                  {controls.length === 0 ? (
                    <div className="rv-ctrl-info">No controls yet.</div>
                  ) : controls.map(definition => (
                    <HeadlinerParameterControl
                      key={`${preset?.id}:${definition.id}`}
                      definition={definition}
                      value={values[definition.id]}
                      onChange={value => setValue(definition.id, value)}
                    />
                  ))}
                </Collapsible>
              )
            })}
          </div>
          <div className="rv-ctrl-group" data-headliner-inspector-actions="true">
            <IconChipButton onClick={resetParameters} disabled={!hasOverrides}>Reset Parameters</IconChipButton>
          </div>
        </div>
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
