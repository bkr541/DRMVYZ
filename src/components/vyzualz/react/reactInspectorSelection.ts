import type {
  LaserDmxBeamMatrixSettings,
  ReactEngineId,
} from './ReactTypes'

export type ReactInspectableSelection =
  | { kind: 'shaderScene'; id: string }
  | { kind: 'canvasLayer'; id: string }
  | { kind: 'laserBeam'; id: string }
  | { kind: 'laserGroup'; id: string }

interface ResolveReactInspectorSelectionArgs {
  activeReactEngineId: ReactEngineId
  activeShaderId: string | null
  selectedCanvasLayerId: string | null
  laserDmxWorkspaceMode: unknown
  laserDmxBeamMatrix: LaserDmxBeamMatrixSettings
}

export function resolveReactInspectorSelection({
  activeReactEngineId,
  activeShaderId,
  selectedCanvasLayerId,
  laserDmxBeamMatrix,
}: ResolveReactInspectorSelectionArgs): ReactInspectableSelection | null {
  if (activeReactEngineId === 'shaderPads') {
    return activeShaderId ? { kind: 'shaderScene', id: activeShaderId } : null
  }

  if (activeReactEngineId === 'canvas') {
    return selectedCanvasLayerId ? { kind: 'canvasLayer', id: selectedCanvasLayerId } : null
  }

  if (activeReactEngineId !== 'laserDmx') return null

  const selectedBeam = laserDmxBeamMatrix.selectedBeamIds
    .map(id => laserDmxBeamMatrix.beams.find(beam => beam.id === id))
    .find(Boolean)
  if (selectedBeam) return { kind: 'laserBeam', id: selectedBeam.id }

  const selectedGroup = laserDmxBeamMatrix.groups.find(
    group => group.id === laserDmxBeamMatrix.selectedGroupId,
  )
  return selectedGroup ? { kind: 'laserGroup', id: selectedGroup.id } : null
}
