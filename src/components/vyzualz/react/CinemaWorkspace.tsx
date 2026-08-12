import { useMemo, useState } from 'react'
import { NoticeCard } from './controls/NoticeCard'
import { useShallow } from 'zustand/react/shallow'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  useCinemaStore,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaCompositionInstance,
  type CinemaCompositionInstanceId,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
  type CinemaExternalAssetSnapshot,
  type CinemaRuntimeSnapshot,
} from '../cinema'
import { CinemaCanvas } from './CinemaCanvas'
import type { CinemaWorkspaceFrameBridgeResult } from './CinemaWorkspaceFrameBridge'
import type { CinemaWorkspaceRuntimeFrameConfig } from './CinemaWorkspaceRuntimeFrameSource'
import { Collapsible } from './ReactControlRows'

// ── Engine Mode (Shaders / Worlds) ──────────────────────────────────────────
//
// Mirrors Sound Drawing's "Engine Mode" source grid exactly (same
// .rv-sound-source-grid/.rv-sound-source-card radiogroup pattern). Visual
// selector only for now — it does not yet filter or drive anything.

type CinemaEngineMode = 'shaders' | 'worlds'

const CINEMA_ENGINE_MODE_OPTIONS: { value: CinemaEngineMode; label: string }[] = [
  { value: 'shaders', label: 'Shaders' },
  { value: 'worlds', label: 'Worlds' },
]

function CinemaEngineModeIcon({ mode }: { mode: CinemaEngineMode }) {
  if (mode === 'shaders') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 3v6M16 23v6M3 16h6M23 16h6M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4" />
        <circle cx="16" cy="16" r="5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" />
      <ellipse cx="16" cy="16" rx="11" ry="4.5" />
      <path d="M16 5v22" />
    </svg>
  )
}

function CinemaEngineModeGrid({
  onChange,
}: {
  onChange: (value: CinemaEngineMode) => void
}) {
  return (
    <div className="rv-sound-source-grid" role="group" aria-label="Cinema engine mode">
      {CINEMA_ENGINE_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="rv-sound-source-card"
          onClick={() => onChange(option.value)}
        >
          <span className="rv-sound-source-card-icon">
            <CinemaEngineModeIcon mode={option.value} />
          </span>
          <span className="rv-sound-source-card-label">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export type CinemaWorkspaceSurface = 'panel' | 'stage'

export interface CinemaWorkspaceModel {
  activeComposition: CinemaCompositionDefinition | null
  activeInstance: CinemaCompositionInstance | null
  compositionCount: number
  instanceCount: number
  diagnostics: CinemaDiagnosticSnapshot
  statusLabel: 'Ready' | 'No active preset' | 'Needs attention'
  runtimeAvailable: true
  frameAvailable: boolean
  frameTrackId: string | null
  frameCapabilities: number
}

interface CinemaWorkspaceStateInput {
  activeCompositionId: CinemaCompositionId | null
  activeInstanceId: CinemaCompositionInstanceId | null
  compositions: readonly CinemaCompositionDefinition[]
  instances: readonly CinemaCompositionInstance[]
  lastDiagnostics: CinemaDiagnosticSnapshot
  frameBridge?: CinemaWorkspaceFrameBridgeResult | null
  runtimeDiagnostics?: CinemaDiagnosticSnapshot | null
}

/** Builds a read-only workspace snapshot from canonical Cinema state and runtime diagnostics. */
export function resolveCinemaWorkspaceModel(input: CinemaWorkspaceStateInput): CinemaWorkspaceModel {
  const activeComposition = input.activeCompositionId == null
    ? null
    : input.compositions.find(composition => composition.id === input.activeCompositionId) ?? null
  const activeInstance = input.activeInstanceId == null
    ? null
    : input.instances.find(instance => instance.id === input.activeInstanceId) ?? null

  const diagnostics = [
    ...input.lastDiagnostics.diagnostics,
    ...(input.frameBridge?.diagnostics.diagnostics ?? []),
    ...(input.runtimeDiagnostics?.diagnostics ?? []),
  ]

  if (input.activeCompositionId == null) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
      severity: 'info',
      message: 'No active Cinema composition is selected. The runtime renders the neutral safe output.',
      attribution: { stage: 'workspace-shell' },
    }))
  } else if (!activeComposition) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_VALIDATION_FAILED',
      severity: 'error',
      message: 'The selected Cinema composition is unavailable. Canonical state was not changed.',
      attribution: { compositionId: input.activeCompositionId, stage: 'workspace-shell' },
    }))
  }

  if (input.activeInstanceId != null && !activeInstance) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_VALIDATION_FAILED',
      severity: 'error',
      message: 'The selected Cinema instance is unavailable. The composition remains on safe output.',
      attribution: { instanceId: input.activeInstanceId, stage: 'workspace-shell' },
    }))
  }

  const snapshot = createCinemaDiagnosticSnapshot(diagnostics)
  return {
    activeComposition,
    activeInstance,
    compositionCount: input.compositions.length,
    instanceCount: input.instances.length,
    diagnostics: snapshot,
    statusLabel: snapshot.counts.error > 0 || snapshot.counts.fatal > 0
      ? 'Needs attention'
      : activeComposition
        ? 'Ready'
        : 'No active preset',
    runtimeAvailable: true,
    frameAvailable: input.frameBridge != null,
    frameTrackId: input.frameBridge?.frame.transport.trackId ?? null,
    frameCapabilities: input.frameBridge
      ? Object.values(input.frameBridge.frame.capabilities).filter(Boolean).length
      : 0,
  }
}

function diagnosticSummary(diagnostics: CinemaDiagnosticSnapshot): string {
  const problemCount = diagnostics.counts.error + diagnostics.counts.fatal
  if (problemCount > 0) return `${problemCount} error${problemCount === 1 ? '' : 's'}`
  const noticeCount = diagnostics.counts.warning + diagnostics.counts.info
  return `${noticeCount} notice${noticeCount === 1 ? '' : 's'}`
}

function runtimeStatusLabel(snapshot: CinemaRuntimeSnapshot | null): string {
  if (!snapshot) return 'Initializing'
  switch (snapshot.phase) {
    case 'running': return 'Running'
    case 'suspended': return 'Suspended'
    case 'context-lost': return 'Recovering context'
    case 'unavailable': return 'WebGL2 unavailable'
    case 'disposed': return 'Disposed'
    case 'initializing': return 'Initializing'
  }
}

function diagnosticSeverityRank(severity: 'info' | 'warning' | 'error' | 'fatal'): number {
  switch (severity) {
    case 'fatal': return 3
    case 'error': return 2
    case 'warning': return 1
    case 'info': return 0
  }
}

function findActionableDiagnostic(diagnostics: CinemaDiagnosticSnapshot): CinemaDiagnostic | null {
  return [...diagnostics.diagnostics]
    .filter(diagnostic => diagnostic.severity !== 'info')
    .sort((left, right) => diagnosticSeverityRank(right.severity) - diagnosticSeverityRank(left.severity))[0] ?? null
}

function useCinemaWorkspaceReadModel(
  frameBridge: CinemaWorkspaceFrameBridgeResult | null,
  runtimeSnapshot: CinemaRuntimeSnapshot | null,
) {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    instances: store.instances,
    definitions: store.definitions,
    lastDiagnostics: store.lastDiagnostics,
  })))
  const model = useMemo(() => resolveCinemaWorkspaceModel({
    ...state,
    frameBridge,
    runtimeDiagnostics: runtimeSnapshot?.diagnostics,
  }), [frameBridge, runtimeSnapshot?.diagnostics, state])

  return { state, model }
}

export function CinemaRenderedDiagnostics({
  frameBridge = null,
  runtimeSnapshot = null,
}: {
  frameBridge?: CinemaWorkspaceFrameBridgeResult | null
  runtimeSnapshot?: CinemaRuntimeSnapshot | null
}) {
  const [open, setOpen] = useState(true)
  const { model } = useCinemaWorkspaceReadModel(frameBridge, runtimeSnapshot)
  const compositionName = model.activeComposition?.metadata.name ?? 'None selected'
  const compositionId = model.activeComposition?.id ?? 'No composition ID'
  const instanceLabel = model.activeInstance?.label ?? 'Base composition'

  return (
    <section className={`rv-cinema-rendered-diagnostics${open ? ' is-open' : ''}`} aria-label="Rendered Diagnostics">
      <button
        type="button"
        className="rv-cinema-rendered-diagnostics__header"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
      >
        <span className="rv-cinema-rendered-diagnostics__dot" aria-hidden="true" />
        <span>Rendered Diagnostics</span>
        <span className={`rv-cinema-rendered-diagnostics__caret${open ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="rv-cinema-rendered-diagnostics__body">
          <div className="rv-cinema-rendered-diagnostics__card">
            <div className="rv-cinema-rendered-diagnostics__card-header">
              <span>{compositionName}</span>
              <span>Cinema</span>
            </div>
            <p className="rv-cinema-rendered-diagnostics__description">
              Composer modulation, performance, camera, timeline, graph execution, and runtime health for the rendered Cinema output.
            </p>
            <dl className="rv-cinema-rendered-diagnostics__grid">
              <div><dt>Active composition</dt><dd>{compositionName}</dd><small>{compositionId}</small></div>
              <div><dt>Active instance</dt><dd>{instanceLabel}</dd><small>{model.instanceCount} saved instance{model.instanceCount === 1 ? '' : 's'}</small></div>
              <div><dt>Runtime</dt><dd>{runtimeStatusLabel(runtimeSnapshot)}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.viewport.width} × ${runtimeSnapshot.viewport.height}` : 'Preparing canvas'}</small></div>
              <div><dt>Graph</dt><dd>{runtimeSnapshot?.graph.outputRendered ? 'Output rendered' : 'Safe output'}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.graph.initializedNodeCount}/${runtimeSnapshot.graph.activeNodeCount} nodes ready` : 'Compiling'}</small></div>
              <div><dt>Performance</dt><dd>{runtimeSnapshot ? `${runtimeSnapshot.graph.activePerformanceRuleCount}/${runtimeSnapshot.graph.performanceRuleCount} rules active` : 'Preparing'}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.graph.activePerformanceTransientCount} timed overrides` : 'No runtime snapshot'}</small></div>
              <div><dt>Quality</dt><dd>{runtimeSnapshot ? `${runtimeSnapshot.graph.quality.selectedTier} · ${runtimeSnapshot.graph.quality.pressure}` : 'High · nominal'}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.graph.quality.degradedNodeCount} degraded · ${runtimeSnapshot.graph.quality.skippedNodeCount} skipped` : 'Graph budget pending'}</small></div>
              <div><dt>GPU budget</dt><dd>{runtimeSnapshot ? `${runtimeSnapshot.telemetry.targets.estimatedAllocationMemoryMb.toFixed(1)} MB targets` : 'Preparing'}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.telemetry.targets.totalAllocationCount} allocations · ${runtimeSnapshot.telemetry.frameTime.averageMs.toFixed(2)} ms avg render` : 'No telemetry snapshot'}</small></div>
              <div><dt>Recovery</dt><dd>{runtimeSnapshot?.telemetry.context.lastRecoveryStatus ?? 'none'}</dd><small>{runtimeSnapshot ? `Context generation ${runtimeSnapshot.contextGeneration}` : 'Context not initialized'}</small></div>
              <div><dt>Diagnostics</dt><dd>{diagnosticSummary(model.diagnostics)}</dd><small>{model.statusLabel}</small></div>
              <div><dt>Frame bridge</dt><dd>{model.frameAvailable ? 'Normalized' : 'Unavailable'}</dd><small>{model.frameTrackId ?? 'No active track'}</small></div>
            </dl>
            <div className="rv-cinema-rendered-diagnostics__runtime" role="status" aria-live="polite">
              <strong>{runtimeSnapshot?.phase === 'unavailable' ? 'Safe output only' : 'Cinema runtime owns the stage'}</strong>
              <span>Quality decisions, frame-time samples, target pressure, diagnostics history, recovery events, decoded media, and GPU resources remain runtime-only. Transparent or disabled nodes can stop consuming render work without rewriting authored state.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function CinemaWorkspace({
  surface,
  frameBridge = null,
  runtimeFrameConfig = null,
  assetSources = [],
  runtimeSnapshot: controlledRuntimeSnapshot,
  onCanvasReady,
  onLiveFps,
  onRuntimeSnapshot,
}: {
  surface: CinemaWorkspaceSurface
  frameBridge?: CinemaWorkspaceFrameBridgeResult | null
  runtimeFrameConfig?: Readonly<CinemaWorkspaceRuntimeFrameConfig> | null
  assetSources?: readonly Readonly<CinemaExternalAssetSnapshot>[]
  runtimeSnapshot?: CinemaRuntimeSnapshot | null
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  onRuntimeSnapshot?: (snapshot: CinemaRuntimeSnapshot) => void
}) {
  const [localRuntimeSnapshot, setLocalRuntimeSnapshot] = useState<CinemaRuntimeSnapshot | null>(null)
  const runtimeSnapshot = controlledRuntimeSnapshot === undefined ? localRuntimeSnapshot : controlledRuntimeSnapshot
  const { state, model } = useCinemaWorkspaceReadModel(frameBridge, runtimeSnapshot)
  if (surface === 'panel') {
    return (
      <section className="rv-cinema-workspace rv-cinema-workspace--panel" aria-label="Cinema runtime setup">
        <Collapsible label="Engine Mode" defaultOpen bodyClassName="rv-cinema-engine-mode-body">
          <CinemaEngineModeGrid onChange={() => {}} />
        </Collapsible>
      </section>
    )
  }

  return (
    <section
      className="rv-cinema-workspace rv-cinema-workspace--stage"
      aria-label="Cinema workspace"
      data-cinema-workspace="runtime"
      data-runtime-available={runtimeSnapshot?.phase === 'unavailable' ? 'false' : 'true'}
      data-runtime-phase={runtimeSnapshot?.phase ?? 'initializing'}
      data-cinema-frame-available={model.frameAvailable ? 'true' : 'false'}
      data-cinema-output-rendered={runtimeSnapshot?.graph.outputRendered ? 'true' : 'false'}
      data-cinema-active-node-count={runtimeSnapshot?.graph.activeNodeCount ?? 0}
      data-cinema-quality-tier={runtimeSnapshot?.graph.quality.selectedTier ?? 'high'}
      data-cinema-quality-pressure={runtimeSnapshot?.graph.quality.pressure ?? 'nominal'}
      data-cinema-degraded-node-count={runtimeSnapshot?.graph.quality.degradedNodeCount ?? 0}
      data-cinema-recovery-status={runtimeSnapshot?.telemetry.context.lastRecoveryStatus ?? 'none'}
    >
      <CinemaCanvas
        frameBridge={frameBridge}
        runtimeFrameConfig={runtimeFrameConfig}
        composition={model.activeComposition}
        instance={model.activeInstance}
        definitions={state.definitions}
        assetSources={assetSources}
        onCanvasReady={onCanvasReady}
        onLiveFps={onLiveFps}
        onRuntimeSnapshot={(snapshot) => {
          if (controlledRuntimeSnapshot === undefined) setLocalRuntimeSnapshot(snapshot)
          onRuntimeSnapshot?.(snapshot)
        }}
      />
    </section>
  )
}
