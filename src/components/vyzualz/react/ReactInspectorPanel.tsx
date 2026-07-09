import { useSyncExternalStore } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { CtrlSection } from './ReactControlRows'
import type {
  OscillatorSettings,
  OscillatorGlyphAsset,
  OscillatorFontAsset,
} from './ReactTypes'
import { ShaderInspectorPanel } from './shaders/ui/ShaderInspectorPanel'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { LaserDmxBeamInspector } from './LaserDmxBeamInspector'
import { LaserDmxReactionGroupInspector } from './LaserDmxReactionGroupInspector'
import { ReactResetActions } from './ReactResetActions'
import { resolveReactInspectorSelection } from './reactInspectorSelection'
import {
  getSvgVisualCacheVersion,
  getSvgVisualEntry,
  subscribeSvgVisualCache,
} from './renderers/svgVisualCache'
import {
  buildUnifiedSvgStatus,
  resolveUnifiedSvgSource,
  SVG_RENDER_MODE_LABELS,
} from './svgSourceLifecycle'
import type { UnifiedSvgStatus } from './svgSourceLifecycle'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'

// ── Display maps ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  classic:      'Classic',
  builtinShape: 'Built-in Shape',
  text:         'Text',
  svg:          'SVG',
  svgGlyph:     'SVG Glyph',
  svgVisual:    'SVG Visual',
}

const CLASSIC_MODE_LABELS: Record<string, string> = {
  sectionAuto:  'Auto',
  waveform:     'Waveform',
  lissajous:    'Lissajous',
  radialScope:  'Radial Scope',
  spiralScope:  'Spiral Scope',
}

const SHAPE_LABELS: Record<string, string> = {
  circle:   'Circle',
  square:   'Square',
  triangle: 'Triangle',
  star:     'Star',
  hexagon:  'Hexagon',
  infinity: 'Infinity',
  spiral:   'Spiral',
  line:     'Line',
}

const RENDER_MODE_LABELS: Record<string, string> = {
  outline:    'Outline',
  multiTrace: 'Multi Trace',
  dots:       'Dots',
  ribbon:     'Ribbon',
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

function OscSourceDetails({
  osc,
  glyphAssets,
  fontAssets,
  svgStatus,
}: {
  osc: OscillatorSettings
  glyphAssets: OscillatorGlyphAsset[]
  fontAssets: OscillatorFontAsset[]
  svgStatus: UnifiedSvgStatus | null
}) {
  switch (osc.sourceType) {
    case 'classic':
      return (
        <KvRow label="Mode" value={CLASSIC_MODE_LABELS[osc.classicMode] ?? osc.classicMode} />
      )

    case 'builtinShape':
      return (
        <KvRow label="Shape" value={SHAPE_LABELS[osc.builtinShape] ?? osc.builtinShape} />
      )

    case 'text': {
      const font = fontAssets.find(f => f.id === osc.textFontId)
      return (
        <>
          <KvRow label="Text"  value={osc.text.trim() || '(empty)'} />
          <KvRow label="Font"  value={font?.name ?? (osc.textFontId ? 'Unknown font' : 'No font selected')} />
          <KvRow label="Size"  value={`${osc.textFontSize}px`} />
        </>
      )
    }

    case 'svg':
    case 'svgVisual':
    case 'svgGlyph': {
      if (svgStatus) {
        return (
          <>
            <KvRow label="Asset" value={svgStatus.assetName ?? (svgStatus.mediaId ? 'Unknown SVG' : 'No SVG selected')} />
            <KvRow label="Render As" value={svgStatus.renderModeLabel} />
            {svgStatus.renderMode === 'auto' && svgStatus.resolvedMode && (
              <KvRow label="Auto Output" value={svgStatus.resolvedMode === 'reactivePath' ? 'Reactive Path' : 'Original Artwork'} />
            )}
            {svgStatus.resolvedMode === 'reactivePath' && (
              <KvRow label="Points" value={svgStatus.pointCount.toLocaleString()} />
            )}
            <KvRow label="Palette" value={osc.svgUseReactPalette ? 'React palette' : 'Original colors'} />
            <KvRow label="Auto Rotate" value={osc.autoRotate ? 'On' : 'Off'} />
            {svgStatus.loading && <KvRow label="Status" value="Loading SVG caches…" />}
            {svgStatus.error && <KvRow label="Status" value={`Load error: ${svgStatus.error}`} />}
          </>
        )
      }

      const glyph = glyphAssets.find(g => g.id === osc.selectedGlyphId)
      return (
        <KvRow
          label="Glyph"
          value={glyph?.name ?? (osc.selectedGlyphId ? 'Unknown glyph' : 'No glyph selected')}
        />
      )
    }

    default:
      return null
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ReactInspectorPanel() {
  const {
    activeReactPresetId,
    activeReactEngineId,
    reactPresets,
    oscillatorSettings,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    oscillatorFontAssets,
    laserDmxWorkspaceMode,
    laserDmxBeamMatrix,
    resetOscillatorSettings,
  } = useReactStore(useShallow(s => ({
    activeReactPresetId:       s.activeReactPresetId,
    activeReactEngineId:       s.activeReactEngineId,
    reactPresets:              s.reactPresets,
    oscillatorSettings:        s.oscillatorSettings,
    oscillatorGlyphAssets:     s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache: s.oscillatorGlyphPointCache,
    oscillatorFontAssets:      s.oscillatorFontAssets,
    laserDmxWorkspaceMode:     s.laserDmxWorkspaceMode,
    laserDmxBeamMatrix:        s.laserDmxBeamMatrix,
    resetOscillatorSettings:   s.resetOscillatorSettings,
  })))
  const activeShaderId = useShaderPanelStore(s => s.activeShaderId)
  const allMediaItems = useMediaStore(state => state.items)
  useSyncExternalStore(
    subscribeSvgVisualCache,
    getSvgVisualCacheVersion,
    getSvgVisualCacheVersion,
  )

  const preset = activeReactPresetId
    ? reactPresets.find(p => p.id === activeReactPresetId && p.engine === activeReactEngineId) ?? null
    : null
  const inspectableSelection = resolveReactInspectorSelection({
    activeReactEngineId,
    activeShaderId,
    oscillatorSettings,
    laserDmxWorkspaceMode,
    laserDmxBeamMatrix,
  })

  const engineSummary = (
    <div className="rv-ctrl-group">
      <CtrlSection label="Engine Summary" />
      <KvRow label="Engine" value={REACT_ENGINE_CATALOG[activeReactEngineId].label} />
      <KvRow label="Active Preset" value={preset?.name ?? 'None'} />
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
    return (
      <>
        {engineSummary}
        <div className="rv-ctrl-group">
          <div className="rv-ctrl-info">
            CANVAS media inspection arrives with upload support in the next patch.
          </div>
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
            Select a Sound Drawing source, LaserDMX fixture, beam, or reaction group to inspect it.
            Active presets are shown above as engine context and do not count as object selections.
          </div>
        </div>
      </>
    )
  }

  const activeSvgSource = resolveUnifiedSvgSource(oscillatorSettings)
  const activeSvgEntry = activeSvgSource?.mediaId
    ? getSvgVisualEntry(activeSvgSource.mediaId)
    : null
  const svgStatus = buildUnifiedSvgStatus(
    oscillatorSettings,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    allMediaItems,
    activeSvgEntry,
  )

  const isSoundDrawingSource = inspectableSelection.kind === 'soundDrawingSource'
  const osc = oscillatorSettings
  let sourceModeLabel = ''
  if (isSoundDrawingSource) {
    const src = svgStatus ? 'SVG' : (SOURCE_LABELS[osc.sourceType] ?? osc.sourceType)
    let detail = ''
    if (svgStatus)                         detail = SVG_RENDER_MODE_LABELS[svgStatus.renderMode]
    if (osc.sourceType === 'classic')      detail = CLASSIC_MODE_LABELS[osc.classicMode] ?? ''
    if (osc.sourceType === 'builtinShape') detail = SHAPE_LABELS[osc.builtinShape] ?? ''
    sourceModeLabel = detail ? `${src} · ${detail}` : src
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

        {isSoundDrawingSource && (
          <>
            <KvRow label="Type" value="Sound Drawing Source" />
            {sourceModeLabel && <KvRow label="Source" value={sourceModeLabel} />}
            <OscSourceDetails
              osc={osc}
              glyphAssets={oscillatorGlyphAssets}
              fontAssets={oscillatorFontAssets}
              svgStatus={svgStatus}
            />
            {svgStatus?.resolvedMode === 'reactivePath' ? (
              <>
                <KvRow label="Path Style" value={RENDER_MODE_LABELS[osc.renderMode] ?? osc.renderMode} />
                <KvRow label="Resolution" value={`${osc.pathResolution} pts`} />
              </>
            ) : !svgStatus ? (
              <KvRow label="Render" value={RENDER_MODE_LABELS[osc.renderMode] ?? osc.renderMode} />
            ) : null}
            {osc.duplicateTraces > 1 && <KvRow label="Traces" value={String(osc.duplicateTraces)} />}
          </>
        )}

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
        {isSoundDrawingSource && (
          <button
            type="button"
            className="rv-osc-reset-btn"
            onClick={resetOscillatorSettings}
            title="Reset all Sound Drawing source selection, rendering, path, text, and modulation settings to defaults."
          >
            Reset Sound Drawing Settings
          </button>
        )}
        <ReactResetActions />
      </div>
    </>
  )
}
