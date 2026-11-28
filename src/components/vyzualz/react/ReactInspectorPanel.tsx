import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { CtrlSection } from './ReactControlRows'
import {
  CANVAS_PRESET_BY_ID,
  type CanvasMediaItemType,
} from './ReactTypes'
import { ShaderInspectorPanel } from './shaders/ui/ShaderInspectorPanel'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { LaserDmxBeamInspector } from './LaserDmxBeamInspector'
import { LaserDmxReactionGroupInspector } from './LaserDmxReactionGroupInspector'
import { ReactResetActions } from './ReactResetActions'
import { resolveReactInspectorSelection } from './reactInspectorSelection'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'

// ── Display maps ──────────────────────────────────────────────────────────────

const CANVAS_MEDIA_TYPE_LABELS: Record<CanvasMediaItemType, string> = {
  video: 'Video',
  image: 'Image',
  svg:   'SVG',
}


function resolveCanvasLibraryMediaType(item: UploadedMedia): CanvasMediaItemType | null {
  const name = item.name.toLowerCase()
  const mimeType = item.mimeType?.toLowerCase() ?? ''
  if (item.mediaRole === 'svg' || mimeType === 'image/svg+xml' || name.endsWith('.svg')) return 'svg'
  if (item.type === 'image') return 'image'
  if (item.type === 'video') return 'video'
  return null
}

function getCanvasLibraryMediaName(item: UploadedMedia): string {
  return item.title?.trim() || item.name
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rv-insp-kv">
      <span className="rv-insp-key">{label}</span>
      <span className="rv-insp-val" title={value}>{value}</span>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ReactInspectorPanel() {
  const {
    activeReactPresetId,
    activeReactEngineId,
    reactPresets,
    laserDmxWorkspaceMode,
    laserDmxBeamMatrix,
    canvasMediaItems,
    activeCanvasMediaId,
    canvasOrchestrationSettings,
    selectedCanvasLayerId,
    selectedCanvasPresetId,
  } = useReactStore(useShallow(s => ({
    activeReactPresetId:       s.activeReactPresetId,
    activeReactEngineId:       s.activeReactEngineId,
    reactPresets:              s.reactPresets,
    laserDmxWorkspaceMode:     s.laserDmxWorkspaceMode,
    laserDmxBeamMatrix:        s.laserDmxBeamMatrix,
    canvasMediaItems:          s.canvasMediaItems,
    activeCanvasMediaId:       s.activeCanvasMediaId,
    canvasOrchestrationSettings: s.canvasOrchestrationSettings,
    selectedCanvasLayerId:     s.selectedCanvasLayerId,
    selectedCanvasPresetId:    s.selectedCanvasPresetId,
  })))
  const activeShaderId = useShaderPanelStore(s => s.activeShaderId)
  const allMediaItems = useMediaStore(state => state.items)

  const preset = activeReactPresetId
    ? reactPresets.find(p => p.id === activeReactPresetId && p.engine === activeReactEngineId) ?? null
    : null
  const inspectableSelection = resolveReactInspectorSelection({
    activeReactEngineId,
    activeShaderId,
    selectedCanvasLayerId,
    laserDmxWorkspaceMode,
    laserDmxBeamMatrix,
  })

  const activePresetName = activeReactEngineId === 'canvas'
    ? CANVAS_PRESET_BY_ID[selectedCanvasPresetId]?.name ?? 'None'
    : preset?.name ?? 'None'

  const engineSummary = (
    <div className="rv-ctrl-group">
      <CtrlSection label="Engine Summary" />
      <KvRow label="Engine" value={REACT_ENGINE_CATALOG[activeReactEngineId].label} />
      <KvRow label="Active Preset" value={activePresetName} />
    </div>
  )

  if (activeReactEngineId === 'shaderPads') {
    return (
      <>
        {engineSummary}
        {inspectableSelection?.kind === 'shaderScene' ? (
          <ShaderInspectorPanel />
        ) : (
          <div className="rv-ctrl-group">
            <div className="rv-ctrl-info">Select a Shader scene from the ENGINE tab to inspect it.</div>
          </div>
        )}
        <div className="rv-ctrl-footer"><ReactResetActions /></div>
      </>
    )
  }

  if (activeReactEngineId === 'canvas') {
    const canvasReadyLibraryItems = allMediaItems.filter(item => resolveCanvasLibraryMediaType(item) !== null)
    const selectedLayer = inspectableSelection?.kind === 'canvasLayer'
      ? canvasOrchestrationSettings.authoredLayers.find(layer => layer.id === inspectableSelection.id) ?? null
      : null
    const selectedLibraryMedia = selectedLayer
      ? allMediaItems.find(item => item.id === selectedLayer.mediaId) ?? null
      : null
    const selectedLegacyMedia = selectedLayer
      ? canvasMediaItems.find(item => item.id === selectedLayer.mediaId) ?? null
      : null
    const selectedLayerName = selectedLibraryMedia
      ? getCanvasLibraryMediaName(selectedLibraryMedia)
      : selectedLegacyMedia?.name ?? (selectedLayer ? `Missing media · ${selectedLayer.mediaId}` : 'No layer selected')
    const selectedLayerType = selectedLibraryMedia
      ? resolveCanvasLibraryMediaType(selectedLibraryMedia)
      : selectedLegacyMedia?.type ?? null
    const activeLibraryMedia = activeCanvasMediaId
      ? allMediaItems.find(item => item.id === activeCanvasMediaId) ?? null
      : null
    const activeLegacyMedia = canvasMediaItems.find(item => item.id === activeCanvasMediaId) ?? null
    const activeType = activeLibraryMedia
      ? resolveCanvasLibraryMediaType(activeLibraryMedia)
      : activeLegacyMedia?.type ?? null
    const activeName = activeLibraryMedia
      ? getCanvasLibraryMediaName(activeLibraryMedia)
      : activeLegacyMedia?.name ?? 'No media selected'

    return (
      <>
        {engineSummary}
        {selectedLayer && (
          <div className="rv-ctrl-group">
            <CtrlSection label="CANVAS Layer" />
            <KvRow label="Position" value={`${selectedLayer.order + 1} of ${canvasOrchestrationSettings.authoredLayers.length}`} />
            <KvRow label="Media" value={selectedLayerName} />
            <KvRow label="Type" value={selectedLayerType ? CANVAS_MEDIA_TYPE_LABELS[selectedLayerType] : '—'} />
            <KvRow label="Ownership" value={selectedLayer.ownership === 'manual' ? 'Manual' : 'Automatic'} />
            <KvRow label="Pinned" value={selectedLayer.pinned ? 'Yes' : 'No'} />
            <KvRow label="State" value={!selectedLayer.enabled ? 'Off' : selectedLayer.solo ? 'Solo' : 'Enabled'} />
            <div className="rv-ctrl-info">Layer-specific production controls are not finalized yet. Selection is routed here without converting global CANVAS controls into per-layer settings.</div>
          </div>
        )}
        <div className="rv-ctrl-group">
          <CtrlSection label="CANVAS Media" />
          <KvRow label="Library Media" value={canvasReadyLibraryItems.length.toString()} />
          {canvasMediaItems.length > 0 && <KvRow label="Legacy Session Media" value={canvasMediaItems.length.toString()} />}
          <KvRow label="Active Visual" value={activeName} />
          <KvRow label="Type" value={activeType ? CANVAS_MEDIA_TYPE_LABELS[activeType] : '—'} />
        </div>
      </>
    )
  }

  if (!inspectableSelection) {
    return (
      <>
        {engineSummary}
        <div className="rv-ctrl-group">
          <div className="rv-ctrl-info">
            Select a LaserDMX fixture, beam, or reaction group to inspect it.
            Active presets are shown above as engine context and do not count as object selections.
          </div>
        </div>
      </>
    )
  }

  const selectedBeam = inspectableSelection.kind === 'laserBeam'
    ? laserDmxBeamMatrix.beams.find(beam => beam.id === inspectableSelection.id) ?? null
    : null
  const selectedGroup = inspectableSelection.kind === 'laserGroup'
    ? laserDmxBeamMatrix.groups.find(group => group.id === inspectableSelection.id) ?? null
    : null

  return (
    <>
      {engineSummary}
      <div className="rv-ctrl-group">
        <CtrlSection label="Selected Object" />

        {selectedBeam && (
          <>
            <KvRow label="Type" value="Beam Matrix Beam" />
            <KvRow label="Name" value={selectedBeam.name} />
            <KvRow label="Group" value={selectedBeam.groupId ?? 'None'} />
            <KvRow label="Enabled" value={selectedBeam.enabled ? 'Yes' : 'No'} />
          </>
        )}

        {selectedGroup && (
          <>
            <KvRow label="Type" value="Beam Matrix Reaction Group" />
            <KvRow label="Name" value={selectedGroup.name} />
            <KvRow label="Beams" value={String(laserDmxBeamMatrix.beams.filter(beam => beam.groupId === selectedGroup.id).length)} />
            <KvRow label="Enabled" value={selectedGroup.enabled ? 'Yes' : 'No'} />
          </>
        )}
      </div>

      {selectedBeam && <div className="rv-ctrl-group"><LaserDmxBeamInspector /></div>}
      {selectedGroup && <div className="rv-ctrl-group"><LaserDmxReactionGroupInspector /></div>}

      <div className="rv-ctrl-footer">
        <ReactResetActions />
      </div>
    </>
  )
}
