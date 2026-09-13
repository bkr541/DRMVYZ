import type { Cinema2Runtime, Cinema2RuntimeSnapshot } from '../cinema2'
import { CtrlSection } from './ReactControlRows'

export interface Cinema2RuntimeDiagnosticsProps {
  runtime: Cinema2Runtime | null
  snapshot: Cinema2RuntimeSnapshot | null
}

export function Cinema2RuntimeDiagnostics({ runtime, snapshot }: Cinema2RuntimeDiagnosticsProps) {
  if (!snapshot) {
    return <div className="rv-ctrl-info" data-cinema2-output-status="unavailable">Cinema 2.0 runtime status is unavailable.</div>
  }

  if (!runtime) {
    return (
      <div className="rv-ctrl-group" data-cinema2-output-status={snapshot.phase}>
        <CtrlSection label="Runtime" />
        <DiagnosticRow label="Status" value={snapshot.phase === 'running' ? 'Running' : titleCase(snapshot.phase)} />
        <DiagnosticRow label="Resolution" value={`${snapshot.viewport.width} × ${snapshot.viewport.height} @ ${formatDpr(snapshot.viewport.dpr)}×`} />
        {snapshot.statusMessage && <div className="rv-ctrl-info">{snapshot.statusMessage}</div>}
      </div>
    )
  }

  const plan = runtime.getCompiledPresetPlan()
  const media = runtime.getMediaSlotRuntimeSnapshot()
  const effects = runtime.getEffectRuntimeSnapshot()
  const camera = runtime.getCameraRuntimeSnapshot()
  const executor = runtime.getRenderGraphExecutorSnapshot()
  const resources = runtime.getResourceManagerSnapshot()
  const presetName = plan.manifest.metadata.name
  const phase = snapshot.phase === 'running' ? 'Running' : titleCase(snapshot.phase)

  return (
    <div className="rv-ctrl-group" data-cinema2-output-status={snapshot.phase}>
      <CtrlSection label="Runtime" />
      <DiagnosticRow label="Preset" value={presetName} />
      <DiagnosticRow label="Status" value={phase} />
      <DiagnosticRow label="Resolution" value={`${snapshot.viewport.width} × ${snapshot.viewport.height} @ ${formatDpr(snapshot.viewport.dpr)}×`} />
      <DiagnosticRow label="Render" value={`${executor.executedPassCount} executed · ${executor.failedPassCount} failed`} />
      <DiagnosticRow label="Media" value={media.slotCount === 0 ? 'No slots' : `${media.readyResourceCount}/${media.slotCount} ready`} />
      <DiagnosticRow label="Effects" value={effects.effects.length === 0 ? 'None' : `${effects.effects.length} authored`} />
      <DiagnosticRow label="Camera" value={camera.activeCameraId ?? 'Implicit safe camera'} />
      <DiagnosticRow label="GPU" value={`${resources.activeLeaseCount} active target${resources.activeLeaseCount === 1 ? '' : 's'}`} />
      {snapshot.statusMessage && <div className="rv-ctrl-info">{snapshot.statusMessage}</div>}
    </div>
  )
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rv-ctrl-row rv-cinema2-diagnostic-row">
      <span className="rv-ctrl-label">{label}</span>
      <span className="rv-ctrl-description">{value}</span>
    </div>
  )
}

function titleCase(value: string): string {
  return value.replace(/(^|-)([a-z])/g, (_match, separator: string, letter: string) => `${separator ? ' ' : ''}${letter.toUpperCase()}`)
}

function formatDpr(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
