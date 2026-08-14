import type {
  LaserDmxBeamMatrixSettings,
  OscillatorSettings,
  ReactEngineId,
} from './ReactTypes'

export type ReactInspectableSelection =
  | { kind: 'shaderScene'; id: string }
  | { kind: 'soundDrawingSource'; id: string }
  | { kind: 'canvasLayer'; id: string }
  | { kind: 'laserBeam'; id: string }
  | { kind: 'laserGroup'; id: string }

interface ResolveReactInspectorSelectionArgs {
  activeReactEngineId: ReactEngineId
  activeShaderId: string | null
  oscillatorSettings: OscillatorSettings
  selectedCanvasLayerId: string | null
  laserDmxWorkspaceMode: unknown
  laserDmxBeamMatrix: LaserDmxBeamMatrixSettings
}

export function resolveReactInspectorSelection({
  activeReactEngineId,
  activeShaderId,
  oscillatorSettings,
  selectedCanvasLayerId,
  laserDmxBeamMatrix,
}: ResolveReactInspectorSelectionArgs): ReactInspectableSelection | null {
  if (activeReactEngineId === 'shaderPads') {
    return activeShaderId ? { kind: 'shaderScene', id: activeShaderId } : null
  }

  if (activeReactEngineId === 'oscilloscope') {
    switch (oscillatorSettings.sourceType) {
      case 'svg':
        return oscillatorSettings.selectedSvgId
          ? { kind: 'soundDrawingSource', id: oscillatorSettings.selectedSvgId }
          : null
      case 'svgGlyph':
        return oscillatorSettings.selectedGlyphId
          ? { kind: 'soundDrawingSource', id: oscillatorSettings.selectedGlyphId }
          : null
      case 'svgVisual':
        return oscillatorSettings.selectedSvgVisualId
          ? { kind: 'soundDrawingSource', id: oscillatorSettings.selectedSvgVisualId }
          : null
      case 'classic':
        return { kind: 'soundDrawingSource', id: `classic:${oscillatorSettings.classicMode}` }
      case 'builtinShape':
        return { kind: 'soundDrawingSource', id: `shape:${oscillatorSettings.builtinShape}` }
      case 'text':
        return { kind: 'soundDrawingSource', id: 'text' }
      default:
        return null
    }
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
