import React, { useSyncExternalStore } from 'react'
import { LaserDmxEnginePanel } from './LaserDmxEnginePanel'
import { NeonLatticeEnginePanel } from './NeonLatticeEnginePanel'
import { CinematicWorldsEngineControls } from './CinematicWorldsControls'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import {
  SliderRow, SelectRow, ToggleRow, TextInputRow,
  CtrlSection, Collapsible,
} from './ReactControlRows'
import {
  getSvgVisualCacheVersion,
  getSvgVisualEntry,
  subscribeSvgVisualCache,
} from './renderers/svgVisualCache'
import {
  buildUnifiedSvgStatus,
  isUnifiedSvgMediaItem,
  resolveUnifiedSvgSource,
} from './svgSourceLifecycle'
import type {
  ReactEngineId,
  OscillatorSourceType,
  SvgRenderMode,
  ClassicScopeMode,
  BuiltinOscillatorShape,
  OscillatorGlyphAsset,
  OscillatorFontAsset,
  OscillatorSettings,
  OscillatorRenderMode,
  OscillatorGlyphPoint,
} from './ReactTypes'

// ── Engine family display data ────────────────────────────────────────────────

const ENGINE_IDS: ReactEngineId[] = ['shaderPads', 'cinematicPortal', 'oscilloscope', 'laserDmx', 'neonLattice']

const ENGINE_LABELS: Record<ReactEngineId, string> = {
  shaderPads:      'Shader Pads',
  cinematicPortal: 'Cinematic Worlds',
  oscilloscope:    'Sound Drawing',
  laserDmx:        'LaserDMX',
  neonLattice:     'Neon Lattice',
}

const ENGINE_ICONS: Record<ReactEngineId, string> = {
  shaderPads:      '◈',
  cinematicPortal: '◎',
  oscilloscope:    '〜',
  laserDmx:        '✦',
  neonLattice:     '⬡',
}

const ENGINE_DESCS: Record<ReactEngineId, string> = {
  shaderPads:      'Reactive shader fields driven by audio bands and beat timing.',
  cinematicPortal: 'Immersive cinematic environments, portals, media worlds and directed cameras.',
  oscilloscope:    'Live audio waveform drawing with glyph and text rendering.',
  laserDmx:        'DMX beam matrix and spatial fixture control with fog simulation.',
  neonLattice:     'Beat-reactive neon rail grid with pulsing blocks and shockwaves.',
}

// ── Oscillator status card ────────────────────────────────────────────────────

const SOURCE_LABELS: Record<OscillatorSourceType, string> = {
  classic:      'Classic Scope',
  builtinShape: 'Shape',
  text:         'Text',
  svg:          'SVG',
  svgGlyph:     'SVG Glyph',   // legacy — kept for backward-compat display
  svgVisual:    'SVG Visual',  // legacy — kept for backward-compat display
}

const RENDER_LABELS: Record<OscillatorRenderMode, string> = {
  outline:    'Outline',
  multiTrace: 'Multi Trace',
  dots:       'Dots',
  ribbon:     'Ribbon',
}

function StatusKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rv-osc-status-kv">
      <span className="rv-osc-status-key">{label}</span>
      <span className="rv-osc-status-val">{value}</span>
    </div>
  )
}

function OscillatorStatusCard({
  osc,
  glyphAssets,
  fontAssets,
  glyphCache,
  allMediaItems,
}: {
  osc: OscillatorSettings
  glyphAssets: OscillatorGlyphAsset[]
  fontAssets: OscillatorFontAsset[]
  glyphCache: Record<string, OscillatorGlyphPoint[]>
  allMediaItems: UploadedMedia[]
}) {
  useSyncExternalStore(
    subscribeSvgVisualCache,
    getSvgVisualCacheVersion,
    getSvgVisualCacheVersion,
  )

  const isClassic = osc.sourceType === 'classic'
  const svgSource = resolveUnifiedSvgSource(osc)
  const svgEntry = svgSource?.mediaId ? getSvgVisualEntry(svgSource.mediaId) : null
  const svgStatus = buildUnifiedSvgStatus(osc, glyphAssets, glyphCache, allMediaItems, svgEntry)
  const selectedGlyph = (osc.sourceType === 'svgGlyph' && !svgStatus && osc.selectedGlyphId)
    ? glyphAssets.find(asset => asset.id === osc.selectedGlyphId)
    : undefined
  const selectedFont = osc.textFontId ? fontAssets.find(font => font.id === osc.textFontId) : undefined

  let activeName: string | null = null
  if (osc.sourceType === 'builtinShape') {
    activeName = osc.builtinShape.charAt(0).toUpperCase() + osc.builtinShape.slice(1)
  } else if (osc.sourceType === 'text') {
    activeName = osc.text.trim() || null
  } else if (svgStatus) {
    activeName = svgStatus.assetName
  } else if (selectedGlyph) {
    activeName = selectedGlyph.name
  }

  const sourceLabel = svgStatus ? 'SVG' : SOURCE_LABELS[osc.sourceType]
  const activeLabel = osc.sourceType === 'text' ? 'Text' : svgStatus ? 'Asset' : selectedGlyph ? 'Glyph' : 'Shape'

  return (
    <div className="rv-osc-status-card">
      <StatusKV
        label="Source"
        value={<span className="rv-osc-status-val--source">{sourceLabel}</span>}
      />
      {!isClassic && activeName && (
        <StatusKV
          label={activeLabel}
          value={<span className="rv-osc-status-val--highlight">{activeName}</span>}
        />
      )}

      {svgStatus ? (
        <>
          <StatusKV
            label="Render As"
            value={svgStatus.renderMode === 'auto' && svgStatus.resolvedMode
              ? `${svgStatus.renderModeLabel} · ${svgStatus.resolvedMode === 'reactivePath' ? 'Reactive Path' : 'Original Artwork'}`
              : svgStatus.renderModeLabel}
          />
          {svgStatus.resolvedMode === 'reactivePath' && (
            <>
              <StatusKV label="Resolution" value={`${osc.pathResolution} pts`} />
              <StatusKV label="Points" value={svgStatus.pointCount.toLocaleString()} />
              <StatusKV label="Path Style" value={RENDER_LABELS[osc.renderMode]} />
            </>
          )}
          {svgStatus.resolvedMode === 'originalArtwork' && (
            <StatusKV label="Artwork" value={svgStatus.loaded ? 'Ready' : svgStatus.loading ? 'Loading…' : 'Not cached'} />
          )}
          <StatusKV label="React Palette" value={osc.svgUseReactPalette ? 'On' : 'Original colors'} />
          {svgStatus.loading && <div className="rv-ctrl-info">Loading SVG caches…</div>}
          {!svgStatus.mediaId && (
            <div className="rv-osc-status-warn">No SVG selected — choose one below</div>
          )}
          {svgStatus.error && (
            <div className="rv-osc-status-warn">Load error: {svgStatus.error}</div>
          )}
          {svgStatus.uploadedAt && (
            <StatusKV
              label="Uploaded"
              value={new Date(svgStatus.uploadedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            />
          )}
        </>
      ) : !isClassic ? (
        <>
          <StatusKV label="Resolution" value={`${osc.pathResolution} pts`} />
          <StatusKV label="Render" value={RENDER_LABELS[osc.renderMode]} />
        </>
      ) : null}

      {osc.sourceType === 'svgGlyph' && !svgStatus && !selectedGlyph && (
        <div className="rv-osc-status-warn">No SVG glyph selected</div>
      )}

      {osc.sourceType === 'text' && (
        <>
          {osc.text.trim() ? (
            <StatusKV label="Chars" value={osc.text.trim().length} />
          ) : (
            <div className="rv-osc-status-warn">Text is empty</div>
          )}
          {selectedFont ? (
            selectedFont.parseError ? (
              <div className="rv-osc-status-warn">{selectedFont.parseError}</div>
            ) : (
              <StatusKV label="Font" value={<span className="rv-osc-status-val--highlight">{selectedFont.name}</span>} />
            )
          ) : (
            <StatusKV label="Engine" value="Canvas fallback" />
          )}
        </>
      )}
    </div>
  )
}

// ── ENGINE panel ──────────────────────────────────────────────────────────────

export function ReactEnginePanel() {
  const {
    activeReactEngineId, selectReactEngine,
    oscillatorSettings,  setOscillatorSettings,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    selectSvgAsset,
    oscillatorFontAssets,
    fontUploadPending,
    fontRemovePending,
    selectOscillatorFont,
    fontSelectPending,
    glyphLostNotice,
    clearGlyphLostNotice,
  } = useReactStore(useShallow(s => ({
    activeReactEngineId:        s.activeReactEngineId,
    selectReactEngine:          s.selectReactEngine,
    oscillatorSettings:         s.oscillatorSettings,
    setOscillatorSettings:      s.setOscillatorSettings,
    oscillatorGlyphAssets:      s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:  s.oscillatorGlyphPointCache,
    selectSvgAsset:             s.selectSvgAsset,
    oscillatorFontAssets:       s.oscillatorFontAssets,
    fontUploadPending:          s.fontUploadPending,
    fontRemovePending:          s.fontRemovePending,
    selectOscillatorFont:       s.selectOscillatorFont,
    fontSelectPending:          s.fontSelectPending,
    glyphLostNotice:            s.glyphLostNotice,
    clearGlyphLostNotice:       s.clearGlyphLostNotice,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  // SVG Visual rehydration is handled by useSvgVisualRehydration in ReactView —
  // that hook always runs regardless of which panel tab is active.

  const allMediaItems = useMediaStore(state => state.items)
  const svgMediaItems = allMediaItems.filter(isUnifiedSvgMediaItem)
  const activeSvgSource = resolveUnifiedSvgSource(osc)
  const selectedSvgMediaId = activeSvgSource?.mediaId ?? null

  return (
    <div className="rv-ctrl-group">
      {/* ── Engine Family ──────────────────────────────────────────────── */}
      <CtrlSection label="Engine Family" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ENGINE_IDS.map(id => {
          const isActive = activeReactEngineId === id
          return (
            <button
              key={id}
              type="button"
              className={`rv-preset-card${isActive ? ' rv-preset-card--active' : ''}`}
              onClick={() => selectReactEngine(id)}
              aria-pressed={isActive}
              aria-label={`${ENGINE_LABELS[id]} engine${isActive ? ', selected' : ''}`}
              style={{ padding: '7px 10px' }}
            >
              <div className="rv-preset-card-header">
                <span className="rv-preset-name">
                  <span style={{ marginRight: 5, opacity: 0.75 }}>{ENGINE_ICONS[id]}</span>
                  {ENGINE_LABELS[id]}
                </span>
                {isActive && <span className="rv-preset-selected-label"><span className="rv-preset-active-dot" aria-hidden="true" />Selected</span>}
              </div>
              <p className="rv-preset-desc" style={{ marginTop: 3, marginBottom: 0 }}>{ENGINE_DESCS[id]}</p>
            </button>
          )
        })}
      </div>

      {/* ── Engine Mode: Cinematic Worlds ─────────────────────────────── */}
      {activeReactEngineId === 'cinematicPortal' && <CinematicWorldsEngineControls />}

      {/* ── Engine Mode: GLSL Shader ──────────────────────────────────── */}
      {activeReactEngineId === 'shaderPads' && (
        <>
          <CtrlSection label="Shader Scenes" />
          <div className="rv-ctrl-info">
            Shader uses Scenes rather than React presets. Choose and manage the
            active scene from the SCENES tab in the right rail.
          </div>
        </>
      )}

      {/* ── Engine Mode: LaserDMX ─────────────────────────────────────── */}
      {activeReactEngineId === 'laserDmx'     && <LaserDmxEnginePanel />}
      {activeReactEngineId === 'neonLattice'  && <NeonLatticeEnginePanel />}

      {/* ── Engine Mode: Oscilloscope ──────────────────────────────────── */}
      {activeReactEngineId === 'oscilloscope' && (
        <>
          <CtrlSection label="Engine Mode" />

          {glyphLostNotice && (
            <div className="rv-glyph-lost-notice">
              <span>
                <strong>"{glyphLostNotice}"</strong> was removed from your library.
                Select a new source below.
              </span>
              <button
                type="button"
                className="rv-glyph-lost-dismiss"
                onClick={clearGlyphLostNotice}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <OscillatorStatusCard
            osc={osc}
            glyphAssets={oscillatorGlyphAssets}
            fontAssets={oscillatorFontAssets}
            glyphCache={oscillatorGlyphPointCache}
            allMediaItems={allMediaItems}
          />

          <SelectRow
            label="Source"
            value={osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual' ? 'svg' : osc.sourceType}
            onChange={v => set({ sourceType: v as OscillatorSourceType })}
            options={[
              { value: 'classic',      label: 'Classic Scope' },
              { value: 'builtinShape', label: 'Built-in Shape' },
              { value: 'text',         label: 'Text' },
              { value: 'svg',          label: 'SVG' },
            ]}
          />

          {/* Classic Scope mode */}
          {osc.sourceType === 'classic' && (
            <>
              <ToggleRow
                label="Auto Section Mode"
                value={osc.autoSectionMode}
                onChange={v => set({ autoSectionMode: v })}
              />
              {!osc.autoSectionMode && (
                <SelectRow
                  label="Classic Mode"
                  value={osc.classicMode === 'sectionAuto' ? 'waveform' : osc.classicMode}
                  onChange={v => set({ classicMode: v as ClassicScopeMode })}
                  options={[
                    { value: 'waveform',    label: 'Waveform' },
                    { value: 'lissajous',   label: 'Lissajous' },
                    { value: 'radialScope', label: 'Radial Scope' },
                    { value: 'spiralScope', label: 'Spiral Scope' },
                  ]}
                />
              )}
            </>
          )}

          {/* Built-in shape picker */}
          {osc.sourceType === 'builtinShape' && (
            <SelectRow
              label="Shape"
              value={osc.builtinShape}
              onChange={v => set({ builtinShape: v as BuiltinOscillatorShape })}
              options={[
                { value: 'circle',   label: 'Circle' },
                { value: 'square',   label: 'Square' },
                { value: 'triangle', label: 'Triangle' },
                { value: 'star',     label: 'Star' },
                { value: 'hexagon',  label: 'Hexagon' },
                { value: 'infinity', label: 'Infinity' },
                { value: 'spiral',   label: 'Spiral' },
                { value: 'line',     label: 'Line' },
              ]}
            />
          )}

          {/* Text source */}
          {osc.sourceType === 'text' && (
            <>
              <TextInputRow
                label="Text"
                value={osc.text}
                onChange={v => set({ text: v })}
                maxLength={32}
                placeholder="DRMVYZ"
              />
              <ToggleRow
                label="Auto Rotate"
                value={osc.autoRotate === true}
                onChange={v => set({ autoRotate: v })}
              />
              {oscillatorFontAssets.length > 0 && (
                <SelectRow
                  label="Font"
                  value={osc.textFontId ?? ''}
                  onChange={v => selectOscillatorFont(v || null)}
                  disabled={fontUploadPending || !!fontSelectPending || !!fontRemovePending}
                  options={[
                    { value: '', label: '— canvas fallback —' },
                    ...oscillatorFontAssets.map((f: OscillatorFontAsset) => ({ value: f.id, label: f.name })),
                  ]}
                />
              )}
              {osc.sourceType === 'text' && (
                <SliderRow
                  label="Font Size"
                  value={osc.textFontSize}
                  onChange={v => set({ textFontSize: Math.round(v) })}
                  min={48} max={320} step={8}
                  color="#61d6aa"
                />
              )}
              <SliderRow
                label="Spacing"
                value={osc.textLetterSpacing}
                onChange={v => set({ textLetterSpacing: Math.round(v) })}
                min={-20} max={80} step={1}
                color="#d8b95a"
              />
            </>
          )}

          {/* Unified SVG picker (source type 'svg', or legacy svgGlyph/svgVisual) */}
          {(osc.sourceType === 'svg' || osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual') && (
            svgMediaItems.length === 0 ? (
              <div className="rv-ctrl-info">No SVG files yet — import from the Media tab.</div>
            ) : (
              <>
                <SelectRow
                  label="SVG File"
                  value={selectedSvgMediaId ?? ''}
                  onChange={v => { if (v) selectSvgAsset(v) }}
                  options={[
                    ...(selectedSvgMediaId ? [] : [{ value: '', label: '— select SVG —' }]),
                    ...svgMediaItems.map(m => ({ value: m.id, label: m.title ?? m.name })),
                  ]}
                />
                <SelectRow
                  label="Render As"
                  value={osc.svgRenderMode ?? 'auto'}
                  onChange={v => set({ svgRenderMode: v as SvgRenderMode })}
                  options={[
                    { value: 'auto',            label: 'Auto (Recommended)' },
                    { value: 'reactivePath',    label: 'Reactive Path' },
                    { value: 'originalArtwork', label: 'Original Artwork' },
                  ]}
                />
                <ToggleRow
                  label="React Palette"
                  value={osc.svgUseReactPalette !== false}
                  onChange={v => set({ svgUseReactPalette: v })}
                />
                <ToggleRow
                  label="Auto Rotate"
                  value={osc.autoRotate !== false}
                  onChange={v => set({ autoRotate: v })}
                />
                {(osc.svgRenderMode === 'auto' || osc.svgRenderMode === 'reactivePath') && (
                  <div className="rv-ctrl-info" style={{ marginTop: 2 }}>
                    Reactive Path deforms the SVG outline with audio. Original Artwork renders it at full fidelity with whole-object reactions.
                  </div>
                )}
              </>
            )
          )}

          {/* ── Source: path resolution (non-classic; hide for pure originalArtwork modes) ── */}
          {osc.sourceType !== 'classic' &&
           activeSvgSource?.renderMode !== 'originalArtwork' && (
            <>
              <CtrlSection label="Source" />
              <SliderRow
                label="Resolution"
                value={osc.pathResolution}
                onChange={v => set({ pathResolution: Math.round(v) })}
                min={64} max={2048} step={64}
                color="#4ac7db"
              />
            </>
          )}

        </>
      )}
    </div>
  )
}
