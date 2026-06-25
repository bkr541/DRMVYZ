import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { CtrlSection } from './ReactControlRows'
import type {
  ReactEngineId,
  OscillatorSettings,
  OscillatorGlyphAsset,
  OscillatorFontAsset,
} from './ReactTypes'

// ── Display maps ──────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<ReactEngineId, string> = {
  shaderPads:      'Shader Pads',
  cinematicPortal: 'Cinematic Portal',
  oscilloscope:    'Sound Drawing',
  laserDmx:        'LaserDMX',
  neonLattice:     'Neon Lattice',
}

const SOURCE_LABELS: Record<string, string> = {
  classic:      'Classic',
  builtinShape: 'Built-in Shape',
  text:         'Text',
  svgGlyph:     'SVG Glyph',
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
}: {
  osc: OscillatorSettings
  glyphAssets: OscillatorGlyphAsset[]
  fontAssets: OscillatorFontAsset[]
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

    case 'svgGlyph': {
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
    oscillatorFontAssets,
    resetOscillatorSettings,
    resetReactView,
  } = useReactStore(useShallow(s => ({
    activeReactPresetId:     s.activeReactPresetId,
    activeReactEngineId:     s.activeReactEngineId,
    reactPresets:            s.reactPresets,
    oscillatorSettings:      s.oscillatorSettings,
    oscillatorGlyphAssets:   s.oscillatorGlyphAssets,
    oscillatorFontAssets:    s.oscillatorFontAssets,
    resetOscillatorSettings: s.resetOscillatorSettings,
    resetReactView:          s.resetReactView,
  })))

  const preset = activeReactPresetId
    ? reactPresets.find(p => p.id === activeReactPresetId) ?? null
    : null

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!preset) {
    return (
      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">
          Select a React engine, preset, glyph, or source to inspect it.
          {/*
           * TODO: When a full object/layer selection model is added to the
           * React store (e.g. selectedReactObjectId, selectedLayerId), wire
           * it here so INSP shows the selected object's transform and properties.
           */}
        </div>
      </div>
    )
  }

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'
  const osc = oscillatorSettings

  // Concise source label for the Info row
  let sourceModeLabel = ''
  if (isSoundDrawing) {
    const src = SOURCE_LABELS[osc.sourceType] ?? osc.sourceType
    let detail = ''
    if (osc.sourceType === 'classic')      detail = CLASSIC_MODE_LABELS[osc.classicMode] ?? ''
    if (osc.sourceType === 'builtinShape') detail = SHAPE_LABELS[osc.builtinShape] ?? ''
    sourceModeLabel = detail ? `${src} · ${detail}` : src
  }

  return (
    <>
      <div className="rv-ctrl-group">

        {/* ── Info ──────────────────────────────────────────────────── */}
        <CtrlSection label="Info" />
        <KvRow label="Name"   value={preset.name} />
        <KvRow label="Type"   value="Preset" />
        <KvRow label="Engine" value={ENGINE_LABELS[activeReactEngineId] ?? activeReactEngineId} />
        {isSoundDrawing && sourceModeLabel && (
          <KvRow label="Source" value={sourceModeLabel} />
        )}

        {/* ── Source (Sound Drawing only) ───────────────────────────── */}
        {isSoundDrawing && (
          <>
            <CtrlSection label="Source" />
            <OscSourceDetails
              osc={osc}
              glyphAssets={oscillatorGlyphAssets}
              fontAssets={oscillatorFontAssets}
            />
            <KvRow label="Render" value={RENDER_MODE_LABELS[osc.renderMode] ?? osc.renderMode} />
            {osc.duplicateTraces > 1 && (
              <KvRow label="Traces" value={String(osc.duplicateTraces)} />
            )}
          </>
        )}

        {/*
         * TODO: Transform group — add X/Y/Scale/Rotation/Opacity controls here
         * once per-object transforms are supported (future layers/elements model).
         * rotationSpeed and pathScale are in FX → Path until then.
         */}

      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="rv-ctrl-footer">
        {isSoundDrawing && (
          <button
            type="button"
            className="rv-osc-reset-btn"
            onClick={resetOscillatorSettings}
            title="Reset oscillator source settings to defaults"
          >
            Reset Source
          </button>
        )}
        <button
          type="button"
          className="rv-reset-btn"
          onClick={resetReactView}
          title="Reset all visual controls to defaults"
        >
          Reset All
        </button>
        {/*
         * TODO: Add "Clear Selection" and "Remove" when the object/layer
         * selection model exists.
         */}
      </div>
    </>
  )
}
