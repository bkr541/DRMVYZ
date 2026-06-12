import { useState, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import type {
  OscillatorSourceType,
  ClassicScopeMode,
  BuiltinOscillatorShape,
  OscillatorRenderMode,
  OscillatorAudioDisplaceMode,
  OscillatorGlyphAsset,
  OscillatorFontAsset,
  OscillatorSettings,
} from './ReactTypes'
import { makeFontAssetFromFile } from './renderers/fontGlyphUtils'
import { isSvgFilename } from '../../../lib/mediaRoles'

// ── Slider row (0–1 or custom range) ─────────────────────────────────────────

interface SliderRowProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  color?: string
}

function SliderRow({
  label, value, onChange,
  min = 0, max = 1, step = 0.01,
  color = '#4ac7db',
}: SliderRowProps) {
  const pct = `${Math.round(((value - min) / (max - min)) * 100)}%`
  const display =
    (min === 0 && max === 1) ? `${Math.round(value * 100)}%`
    : step >= 1             ? `${Math.round(value)}`
    :                         value.toFixed(2)
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <div className="rv-ctrl-slider-wrap">
        <input
          type="range"
          className="rv-ctrl-slider"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ '--accent': color, '--pct': pct } as React.CSSProperties}
        />
        <span className="rv-ctrl-val">{display}</span>
      </div>
    </div>
  )
}

// ── Select row ────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }
interface SelectRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
}

function SelectRow({ label, value, onChange, options }: SelectRowProps) {
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <select
        className="rv-ctrl-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Text input row ────────────────────────────────────────────────────────────

interface TextInputRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
}

function TextInputRow({ label, value, onChange, maxLength = 32, placeholder = '' }: TextInputRowProps) {
  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label">{label}</span>
      <input
        type="text"
        className="rv-ctrl-text-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <div className="rv-ctrl-toggle-row">
      <span className="rv-ctrl-label">{label}</span>
      <button
        type="button"
        className={`rv-ctrl-toggle${value ? ' rv-ctrl-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="rv-ctrl-toggle-thumb" />
      </button>
    </div>
  )
}

// ── Section label (non-collapsible) ──────────────────────────────────────────

function CtrlSection({ label }: { label: string }) {
  return <div className="rv-ctrl-section-label">{label}</div>
}

// ── Collapsible sub-section ───────────────────────────────────────────────────

interface CollapsibleProps { label: string; defaultOpen?: boolean; children: React.ReactNode }

function Collapsible({ label, defaultOpen = true, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rv-ctrl-collapsible">
      <button
        type="button"
        className="rv-ctrl-collapsible-hdr"
        onClick={() => setOpen(o => !o)}
      >
        <span className="rv-ctrl-collapsible-arrow">{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && <div className="rv-ctrl-collapsible-body">{children}</div>}
    </div>
  )
}

// ── Oscillator status card ────────────────────────────────────────────────────

const SOURCE_LABELS: Record<OscillatorSourceType, string> = {
  classic:      'Classic Scope',
  builtinShape: 'Shape',
  text:         'Text',
  svgGlyph:     'SVG Glyph',
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
}: {
  osc: OscillatorSettings
  glyphAssets: OscillatorGlyphAsset[]
  fontAssets: OscillatorFontAsset[]
}) {
  const isClassic = osc.sourceType === 'classic'

  const selectedGlyph = (osc.sourceType === 'svgGlyph' && osc.selectedGlyphId)
    ? glyphAssets.find(a => a.id === osc.selectedGlyphId)
    : undefined

  const selectedFont = osc.textFontId ? fontAssets.find(f => f.id === osc.textFontId) : undefined

  let activeName: string | null = null
  if (osc.sourceType === 'builtinShape') {
    activeName = osc.builtinShape.charAt(0).toUpperCase() + osc.builtinShape.slice(1)
  } else if (osc.sourceType === 'text') {
    activeName = osc.text.trim() || null
  } else if (osc.sourceType === 'svgGlyph') {
    activeName = selectedGlyph?.name ?? null
  }

  const activeLabel =
    osc.sourceType === 'text'     ? 'Text'  :
    osc.sourceType === 'svgGlyph' ? 'Glyph' :
    'Shape'

  return (
    <div className="rv-osc-status-card">
      <StatusKV
        label="Source"
        value={<span className="rv-osc-status-val--source">{SOURCE_LABELS[osc.sourceType]}</span>}
      />

      {!isClassic && activeName && (
        <StatusKV
          label={activeLabel}
          value={<span className="rv-osc-status-val--highlight">{activeName}</span>}
        />
      )}

      {!isClassic && (
        <>
          <StatusKV label="Resolution" value={`${osc.pathResolution} pts`} />
          <StatusKV label="Render"     value={RENDER_LABELS[osc.renderMode]} />
        </>
      )}

      {osc.sourceType === 'svgGlyph' && (
        selectedGlyph ? (
          <>
            <StatusKV label="Points"   value={selectedGlyph.pointCount.toLocaleString()} />
            <StatusKV
              label="Uploaded"
              value={new Date(selectedGlyph.createdAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            />
          </>
        ) : (
          <div className="rv-osc-status-warn">
            No SVG selected — choose one from the Glyph dropdown below
          </div>
        )
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

// ── Main panel ────────────────────────────────────────────────────────────────

export function ReactControlPanel() {
  const fontInputRef = useRef<HTMLInputElement>(null)
  const [fontUploadError, setFontUploadError] = useState<string | null>(null)

  const {
    reactIntensity,       setReactIntensity,
    reactMotion,          setReactMotion,
    reactGlow,            setReactGlow,
    reactBassReactivity,  setReactBassReactivity,
    reactTrailDecay,      setReactTrailDecay,
    reactFogDensity,      setReactFogDensity,
    reactParticleDensity, setReactParticleDensity,
    activeReactEngineId,
    oscillatorSettings,   setOscillatorSettings, resetOscillatorSettings,
    oscillatorGlyphAssets,
    selectSvgMediaGlyph,
    oscillatorFontAssets,  addOscillatorFontAsset,  removeOscillatorFontAsset,  selectOscillatorFont,
    resetReactView,
  } = useReactStore(useShallow(s => ({
    reactIntensity:              s.reactIntensity,
    setReactIntensity:           s.setReactIntensity,
    reactMotion:                 s.reactMotion,
    setReactMotion:              s.setReactMotion,
    reactGlow:                   s.reactGlow,
    setReactGlow:                s.setReactGlow,
    reactBassReactivity:         s.reactBassReactivity,
    setReactBassReactivity:      s.setReactBassReactivity,
    reactTrailDecay:             s.reactTrailDecay,
    setReactTrailDecay:          s.setReactTrailDecay,
    reactFogDensity:             s.reactFogDensity,
    setReactFogDensity:          s.setReactFogDensity,
    reactParticleDensity:        s.reactParticleDensity,
    setReactParticleDensity:     s.setReactParticleDensity,
    activeReactEngineId:         s.activeReactEngineId,
    oscillatorSettings:          s.oscillatorSettings,
    setOscillatorSettings:       s.setOscillatorSettings,
    resetOscillatorSettings:     s.resetOscillatorSettings,
    oscillatorGlyphAssets:       s.oscillatorGlyphAssets,
    selectSvgMediaGlyph:         s.selectSvgMediaGlyph,
    oscillatorFontAssets:        s.oscillatorFontAssets,
    addOscillatorFontAsset:      s.addOscillatorFontAsset,
    removeOscillatorFontAsset:   s.removeOscillatorFontAsset,
    selectOscillatorFont:        s.selectOscillatorFont,
    resetReactView:              s.resetReactView,
  })))

  const osc = oscillatorSettings
  const set = setOscillatorSettings

  const isSoundDrawing = activeReactEngineId === 'oscilloscope'

  // SVG media items — source for the glyph dropdown
  const allMediaItems = useMediaStore(s => s.items)
  const svgMediaItems = allMediaItems.filter(m => m.mediaRole === 'svg' || isSvgFilename(m.name))

  // The media ID currently selected as a glyph (null if none / legacy local glyph)
  const selectedSvgMediaId = osc.selectedGlyphId?.startsWith('glyph-media:')
    ? osc.selectedGlyphId.slice('glyph-media:'.length)
    : null

  async function handleFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFontUploadError(null)
    try {
      const asset = await makeFontAssetFromFile(file)
      addOscillatorFontAsset(asset)
      selectOscillatorFont(asset.id)
    } catch (err) {
      setFontUploadError((err as Error).message)
    }
  }

  const isCinematic    = activeReactEngineId === 'cinematicPortal'
  const isShaderPads   = activeReactEngineId === 'shaderPads'

  return (
    <div className="rv-control-panel">
      <div className="rv-panel-header">
        <span className="rv-panel-icon">⊛</span>
        <span className="rv-panel-title">Controls</span>
      </div>

      <div className="rv-ctrl-group">
        <CtrlSection label="Master" />
        <SliderRow label="Intensity"  value={reactIntensity}      onChange={setReactIntensity}      color="#4ac7db" />
        <SliderRow label="Motion"     value={reactMotion}         onChange={setReactMotion}         color="#61d6aa" />
        <SliderRow label="Glow"       value={reactGlow}           onChange={setReactGlow}           color="#b84fc9" />
        <SliderRow label="Bass React" value={reactBassReactivity} onChange={setReactBassReactivity} color="#d8b95a" />

        {isSoundDrawing && (
          <>
            <CtrlSection label="Sound Drawing" />
            <OscillatorStatusCard osc={osc} glyphAssets={oscillatorGlyphAssets} fontAssets={oscillatorFontAssets} />
            <SliderRow
              label="Trail Decay"
              value={reactTrailDecay}
              onChange={setReactTrailDecay}
              color="#4ac7db"
            />

            {/* ── Source & Mode ──────────────────────────────────────────── */}
            <Collapsible label="Source & Mode">
              <SelectRow
                label="Source"
                value={osc.sourceType}
                onChange={v => set({ sourceType: v as OscillatorSourceType })}
                options={[
                  { value: 'classic',      label: 'Classic Scope' },
                  { value: 'builtinShape', label: 'Built-in Shape' },
                  { value: 'text',         label: 'Text' },
                  { value: 'svgGlyph',     label: 'SVG Glyph' },
                ]}
              />

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

              {osc.sourceType === 'text' && (
                <>
                  <TextInputRow
                    label="Text"
                    value={osc.text}
                    onChange={v => set({ text: v })}
                    maxLength={32}
                    placeholder="DRMVYZ"
                  />
                  {oscillatorFontAssets.length > 0 && (
                    <SelectRow
                      label="Font"
                      value={osc.textFontId ?? ''}
                      onChange={v => selectOscillatorFont(v || null)}
                      options={[
                        { value: '', label: '— canvas fallback —' },
                        ...oscillatorFontAssets.map((f: OscillatorFontAsset) => ({ value: f.id, label: f.name })),
                      ]}
                    />
                  )}
                  <SliderRow
                    label="Font Size"
                    value={osc.textFontSize}
                    onChange={v => set({ textFontSize: Math.round(v) })}
                    min={48} max={320} step={8}
                    color="#61d6aa"
                  />
                  <SliderRow
                    label="Spacing"
                    value={osc.textLetterSpacing}
                    onChange={v => set({ textLetterSpacing: Math.round(v) })}
                    min={-20} max={80} step={1}
                    color="#d8b95a"
                  />
                </>
              )}

              {osc.sourceType === 'svgGlyph' && (
                svgMediaItems.length === 0 ? (
                  <div className="rv-ctrl-info">No SVG media yet — import SVG files from the Media tab.</div>
                ) : (
                  <SelectRow
                    label="Glyph"
                    value={selectedSvgMediaId ?? ''}
                    onChange={v => { if (v) selectSvgMediaGlyph(v) }}
                    options={[
                      ...(selectedSvgMediaId ? [] : [{ value: '', label: '— select glyph —' }]),
                      ...svgMediaItems.map(m => ({ value: m.id, label: m.title ?? m.name })),
                    ]}
                  />
                )
              )}

              <SelectRow
                label="Render Mode"
                value={osc.renderMode}
                onChange={v => set({ renderMode: v as OscillatorRenderMode })}
                options={[
                  { value: 'outline',    label: 'Outline' },
                  { value: 'multiTrace', label: 'Multi Trace' },
                  { value: 'dots',       label: 'Dots' },
                  { value: 'ribbon',     label: 'Ribbon' },
                ]}
              />

              <SliderRow
                label="Duplicate Traces"
                value={osc.duplicateTraces}
                onChange={v => set({ duplicateTraces: Math.round(v) })}
                min={1} max={6} step={1}
                color="#61d6aa"
              />
            </Collapsible>

            {/* ── Path ──────────────────────────────────────────────────── */}
            <Collapsible label="Path">
              <SliderRow
                label="Resolution"
                value={osc.pathResolution}
                onChange={v => set({ pathResolution: Math.round(v) })}
                min={64} max={2048} step={64}
                color="#4ac7db"
              />
              <SliderRow
                label="Scale"
                value={osc.pathScale}
                onChange={v => set({ pathScale: v })}
                min={0.1} max={1.5} step={0.01}
                color="#61d6aa"
              />
              <SliderRow
                label="Rotation Speed"
                value={osc.rotationSpeed}
                onChange={v => set({ rotationSpeed: v })}
                min={-1} max={1} step={0.01}
                color="#d8b95a"
              />
              <ToggleRow
                label="Mirror X"
                value={osc.mirrorX}
                onChange={v => set({ mirrorX: v })}
              />
              <ToggleRow
                label="Mirror Y"
                value={osc.mirrorY}
                onChange={v => set({ mirrorY: v })}
              />
            </Collapsible>

            {/* ── Audio Reactivity ──────────────────────────────────────── */}
            <Collapsible label="Audio Reactivity">
              <SelectRow
                label="Displace Mode"
                value={osc.audioDisplaceMode}
                onChange={v => set({ audioDisplaceMode: v as OscillatorAudioDisplaceMode })}
                options={[
                  { value: 'normal',  label: 'Normal' },
                  { value: 'radial',  label: 'Radial' },
                  { value: 'tangent', label: 'Tangent' },
                  { value: 'xy',      label: 'XY' },
                ]}
              />
              <SliderRow
                label="Displacement"
                value={osc.audioDisplacement}
                onChange={v => set({ audioDisplacement: v })}
                color="#4ac7db"
              />
              <SliderRow
                label="Bass Scale"
                value={osc.bassScale}
                onChange={v => set({ bassScale: v })}
                color="#d8b95a"
              />
              <SliderRow
                label="Mid Twist"
                value={osc.midTwist}
                onChange={v => set({ midTwist: v })}
                color="#61d6aa"
              />
              <SliderRow
                label="High Jitter"
                value={osc.highJitter}
                onChange={v => set({ highJitter: v })}
                color="#b84fc9"
              />
              <SliderRow
                label="Beat Bloom"
                value={osc.beatBloom}
                onChange={v => set({ beatBloom: v })}
                color="#c0314a"
              />
            </Collapsible>

            {/* ── Font Library ─────────────────────────────────────────── */}
            <Collapsible label="Font Library" defaultOpen={false}>
              <div className="rv-ctrl-info">
                Upload .ttf or .otf files for OpenType vector text paths.
              </div>
              <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,font/ttf,font/otf"
                style={{ display: 'none' }}
                onChange={handleFontUpload}
              />
              <button
                type="button"
                className="rv-glyph-upload-btn"
                onClick={() => { setFontUploadError(null); fontInputRef.current?.click() }}
              >
                + Upload Font
              </button>
              {fontUploadError && (
                <div className="rv-osc-status-warn">{fontUploadError}</div>
              )}
              {oscillatorFontAssets.length > 0 && (
                <div className="rv-glyph-list">
                  {oscillatorFontAssets.map((asset: OscillatorFontAsset) => {
                    const isActive = osc.textFontId === asset.id
                    return (
                      <div
                        key={asset.id}
                        className={`rv-glyph-item${isActive ? ' rv-glyph-item--active' : ''}`}
                        onClick={() => selectOscillatorFont(asset.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') selectOscillatorFont(asset.id) }}
                      >
                        <span className="rv-glyph-item-name" title={asset.fileName}>
                          {asset.name}
                        </span>
                        <button
                          type="button"
                          className="rv-glyph-item-del"
                          title="Remove font"
                          onClick={e => { e.stopPropagation(); removeOscillatorFontAsset(asset.id) }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Collapsible>

            <button
              type="button"
              className="rv-osc-reset-btn"
              onClick={resetOscillatorSettings}
            >
              Reset Oscillator
            </button>
          </>
        )}

        {isCinematic && (
          <>
            <CtrlSection label="Cinematic" />
            <SliderRow label="Fog Density" value={reactFogDensity}      onChange={setReactFogDensity}      color="#61d6aa" />
            <SliderRow label="Particles"   value={reactParticleDensity} onChange={setReactParticleDensity} color="#4ac7db" />
          </>
        )}

        {isShaderPads && (
          <>
            <CtrlSection label="Shader Pads" />
            <SliderRow label="Particles" value={reactParticleDensity} onChange={setReactParticleDensity} color="#61d6aa" />
          </>
        )}
      </div>

      <div className="rv-ctrl-footer">
        <button className="rv-reset-btn" onClick={resetReactView} title="Reset all controls">
          Reset
        </button>
      </div>
    </div>
  )
}
