import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  useCinemaStore,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaCompositionInstance,
  type CinemaCompositionInstanceId,
  type CinemaDiagnosticSnapshot,
  type CinemaFrameBuildResult,
  type CinemaRuntimeSnapshot,
} from '../cinema'
import { CinemaCanvas } from './CinemaCanvas'

export type CinemaWorkspaceSurface = 'panel' | 'stage'

export interface CinemaWorkspaceModel {
  activeComposition: CinemaCompositionDefinition | null
  activeInstance: CinemaCompositionInstance | null
  compositionCount: number
  instanceCount: number
  diagnostics: CinemaDiagnosticSnapshot
  statusLabel: 'Runtime ready' | 'No active composition' | 'Needs attention'
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
  frameBridge?: CinemaFrameBuildResult | null
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
        ? 'Runtime ready'
        : 'No active composition',
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

export function CinemaWorkspace({
  surface,
  frameBridge = null,
  onCanvasReady,
  onLiveFps,
}: {
  surface: CinemaWorkspaceSurface
  frameBridge?: CinemaFrameBuildResult | null
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<CinemaRuntimeSnapshot | null>(null)
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    instances: store.instances,
    lastDiagnostics: store.lastDiagnostics,
  })))
  const model = useMemo(() => resolveCinemaWorkspaceModel({
    ...state,
    frameBridge,
    runtimeDiagnostics: runtimeSnapshot?.diagnostics,
  }), [frameBridge, runtimeSnapshot?.diagnostics, state])
  const compositionName = model.activeComposition?.metadata.name ?? 'None selected'
  const compositionId = model.activeComposition?.id ?? 'No composition ID'
  const instanceLabel = model.activeInstance?.label ?? 'Base composition'
  const firstDiagnostic = model.diagnostics.diagnostics[0]

  if (surface === 'panel') {
    return (
      <section className="rv-cinema-workspace rv-cinema-workspace--panel" aria-label="Cinema runtime setup">
        <div className="rv-cinema-workspace__eyebrow">Cinema Runtime</div>
        <h3>{model.statusLabel}</h3>
        <p>Canonical composition state and the single-owner WebGL2 foundation are connected through the production engine path.</p>
        <dl className="rv-cinema-workspace__grid">
          <div><dt>Composition</dt><dd>{compositionName}</dd></div>
          <div><dt>Schema</dt><dd>v{CINEMA_COMPOSITION_SCHEMA_VERSION}</dd></div>
          <div><dt>Store</dt><dd>v{CINEMA_PERSISTED_STORE_SCHEMA_VERSION}</dd></div>
          <div><dt>Diagnostics</dt><dd>{diagnosticSummary(model.diagnostics)}</dd></div>
          <div><dt>Frame bridge</dt><dd>{model.frameAvailable ? `Ready · ${model.frameCapabilities} capabilities` : 'Waiting for canonical input'}</dd></div>
        </dl>
        <div className="rv-cinema-workspace__runtime" role="status">
          <strong>Stage 7 runtime wired</strong>
          <span>One visible canvas, one WebGL2 context, one animation loop, pooled targets, opaque textures, and context recovery are active. Graph execution begins in Stage 8.</span>
        </div>
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
    >
      <CinemaCanvas
        frameBridge={frameBridge}
        onCanvasReady={onCanvasReady}
        onLiveFps={onLiveFps}
        onRuntimeSnapshot={setRuntimeSnapshot}
      />
      <div className="rv-cinema-workspace__stage-card">
        <div className="rv-cinema-workspace__eyebrow">Cinema · Stage 7</div>
        <h2>Single-owner WebGL runtime</h2>
        <p className="rv-cinema-workspace__lead">
          Cinema now owns the live output canvas and GPU lifecycle. The current frame is intentionally neutral while node execution remains reserved for Stage 8.
        </p>
        <dl className="rv-cinema-workspace__grid rv-cinema-workspace__grid--stage">
          <div><dt>Active composition</dt><dd>{compositionName}</dd><small>{compositionId}</small></div>
          <div><dt>Active instance</dt><dd>{instanceLabel}</dd><small>{model.instanceCount} saved instance{model.instanceCount === 1 ? '' : 's'}</small></div>
          <div><dt>Runtime</dt><dd>{runtimeStatusLabel(runtimeSnapshot)}</dd><small>{runtimeSnapshot ? `${runtimeSnapshot.viewport.width} × ${runtimeSnapshot.viewport.height}` : 'Preparing canvas'}</small></div>
          <div><dt>Diagnostics</dt><dd>{diagnosticSummary(model.diagnostics)}</dd><small>{model.statusLabel}</small></div>
          <div><dt>Frame bridge</dt><dd>{model.frameAvailable ? 'Normalized' : 'Unavailable'}</dd><small>{model.frameTrackId ?? 'No active track'}</small></div>
        </dl>
        <div className="rv-cinema-workspace__runtime" role="status" aria-live="polite">
          <strong>{runtimeSnapshot?.phase === 'unavailable' ? 'Safe output only' : 'Cinema runtime owns the stage'}</strong>
          <span>Render targets and texture handles are runtime-only and never enter persisted Cinema state. Context loss pauses advancement and restoration rebuilds owned resources without starting a duplicate loop.</span>
        </div>
        {firstDiagnostic && (
          <div className="rv-cinema-workspace__diagnostic" role="note">
            <span>{firstDiagnostic.severity}</span>
            <strong>{firstDiagnostic.code}</strong>
            <p>{firstDiagnostic.message}</p>
          </div>
        )}
      </div>
    </section>
  )
}
