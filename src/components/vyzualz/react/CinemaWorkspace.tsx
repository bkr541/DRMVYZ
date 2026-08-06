import { useMemo } from 'react'
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
} from '../cinema'

export type CinemaWorkspaceSurface = 'panel' | 'stage'

export interface CinemaWorkspaceModel {
  activeComposition: CinemaCompositionDefinition | null
  activeInstance: CinemaCompositionInstance | null
  compositionCount: number
  instanceCount: number
  diagnostics: CinemaDiagnosticSnapshot
  statusLabel: 'Foundation ready' | 'No active composition' | 'Needs attention'
  runtimeAvailable: false
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
}

/**
 * Builds a read-only workspace snapshot from canonical Cinema state.
 *
 * Stage 6 adds normalized frame status while retaining the capability diagnostic instead of constructing a
 * renderer, canvas, WebGL context, animation loop, or fallback runtime.
 */
export function resolveCinemaWorkspaceModel(input: CinemaWorkspaceStateInput): CinemaWorkspaceModel {
  const activeComposition = input.activeCompositionId == null
    ? null
    : input.compositions.find(composition => composition.id === input.activeCompositionId) ?? null
  const activeInstance = input.activeInstanceId == null
    ? null
    : input.instances.find(instance => instance.id === input.activeInstanceId) ?? null

  const diagnostics = [...input.lastDiagnostics.diagnostics, ...(input.frameBridge?.diagnostics.diagnostics ?? [])]
  diagnostics.push(createCinemaDiagnostic({
    code: 'CINEMA_CAPABILITY_UNAVAILABLE',
    severity: 'info',
    message: 'Cinema rendering runtime is reserved for Stage 7; Stage 6 provides normalized frame input only.',
    attribution: { stage: 'workspace-shell' },
    details: { runtimeAvailable: false },
  }))

  if (input.activeCompositionId == null) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
      severity: 'info',
      message: 'No active Cinema composition is selected. The workspace remains in safe non-rendering mode.',
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
      message: 'The selected Cinema instance is unavailable. The composition remains in safe non-rendering mode.',
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
        ? 'Foundation ready'
        : 'No active composition',
    runtimeAvailable: false,
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

export function CinemaWorkspace({
  surface,
  frameBridge = null,
}: {
  surface: CinemaWorkspaceSurface
  frameBridge?: CinemaFrameBuildResult | null
}) {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    activeInstanceId: store.activeInstanceId,
    compositions: store.compositions,
    instances: store.instances,
    lastDiagnostics: store.lastDiagnostics,
  })))
  const model = useMemo(() => resolveCinemaWorkspaceModel({ ...state, frameBridge }), [frameBridge, state])
  const compositionName = model.activeComposition?.metadata.name ?? 'None selected'
  const compositionId = model.activeComposition?.id ?? 'No composition ID'
  const instanceLabel = model.activeInstance?.label ?? 'Base composition'
  const firstDiagnostic = model.diagnostics.diagnostics[0]

  if (surface === 'panel') {
    return (
      <section className="rv-cinema-workspace rv-cinema-workspace--panel" aria-label="Cinema foundation setup">
        <div className="rv-cinema-workspace__eyebrow">Cinema Foundation</div>
        <h3>{model.statusLabel}</h3>
        <p>Canonical composition state is available. Rendering remains intentionally offline for this stage.</p>
        <dl className="rv-cinema-workspace__grid">
          <div><dt>Composition</dt><dd>{compositionName}</dd></div>
          <div><dt>Schema</dt><dd>v{CINEMA_COMPOSITION_SCHEMA_VERSION}</dd></div>
          <div><dt>Store</dt><dd>v{CINEMA_PERSISTED_STORE_SCHEMA_VERSION}</dd></div>
          <div><dt>Diagnostics</dt><dd>{diagnosticSummary(model.diagnostics)}</dd></div>
          <div><dt>Frame bridge</dt><dd>{model.frameAvailable ? `Ready · ${model.frameCapabilities} capabilities` : 'Waiting for canonical input'}</dd></div>
        </dl>
        <div className="rv-cinema-workspace__runtime" role="status">
          <strong>Runtime unavailable</strong>
          <span>No canvas, WebGL context, renderer, or animation loop is mounted.</span>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rv-cinema-workspace rv-cinema-workspace--stage"
      aria-label="Cinema workspace"
      data-cinema-workspace="foundation"
      data-runtime-available="false"
      data-cinema-frame-available={model.frameAvailable ? 'true' : 'false'}
    >
      <div className="rv-cinema-workspace__stage-card">
        <div className="rv-cinema-workspace__eyebrow">Cinema · Stage 6</div>
        <h2>Composition workspace foundation</h2>
        <p className="rv-cinema-workspace__lead">
          Cinema is selected through the production engine path. The canonical graph store is mounted, while visual execution remains safely offline.
        </p>
        <dl className="rv-cinema-workspace__grid rv-cinema-workspace__grid--stage">
          <div><dt>Active composition</dt><dd>{compositionName}</dd><small>{compositionId}</small></div>
          <div><dt>Active instance</dt><dd>{instanceLabel}</dd><small>{model.instanceCount} saved instance{model.instanceCount === 1 ? '' : 's'}</small></div>
          <div><dt>Compositions</dt><dd>{model.compositionCount}</dd><small>Schema v{CINEMA_COMPOSITION_SCHEMA_VERSION}</small></div>
          <div><dt>Diagnostics</dt><dd>{diagnosticSummary(model.diagnostics)}</dd><small>{model.statusLabel}</small></div>
          <div><dt>Frame bridge</dt><dd>{model.frameAvailable ? 'Normalized' : 'Unavailable'}</dd><small>{model.frameTrackId ?? 'No active track'}</small></div>
        </dl>
        <div className="rv-cinema-workspace__runtime" role="status" aria-live="polite">
          <strong>Renderer runtime begins in Stage 7</strong>
          <span>{model.frameAvailable ? 'The normalized frame bridge is active. ' : 'The normalized frame bridge is awaiting production input. '}Safe output remains active with no canvas, WebGL context, animation frame, renderer ownership, or GPU resource.</span>
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
