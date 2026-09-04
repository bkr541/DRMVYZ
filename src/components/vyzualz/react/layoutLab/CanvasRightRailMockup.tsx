import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { RailTabs } from '../../layout/RailTabs'
import { PanelSubtabs } from '../PanelSubtabs'
import { ReactPresetCard } from '../ReactPresetCard'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'
import {
  Collapsible,
  ColorRow,
  NumberInputRow,
  SelectRow,
  SliderRow,
  ToggleRow,
} from '../ReactControlRows'
import { CANVAS_LAYER_EFFECT_IDS, MAX_CANVAS_LAYER_EFFECTS, type CanvasLayerEffectId } from '../canvasPerformance/CanvasPerformanceTypes'
import type {
  CanvasFitMode,
  CanvasFractureAnchorMode,
  CanvasFractureColorSourceMode,
  CanvasFracturePlacementMode,
  CanvasFractureQualityMode,
  CanvasFractureQuantizeInterval,
  CanvasFractureTransitionMode,
  CanvasParticleQuality,
  CanvasPresetColorMode,
  CanvasSectionTriggerType,
  CanvasTriggerOn,
  ReactEngineId,
} from '../ReactTypes'
import {
  CANVAS_AUDIO_INTELLIGENCE_PARAMETERS,
  DEFAULT_CANVAS_ROUTE_INTENSITY,
  canvasEffectAudioLinkKey,
  type CanvasMockAudioIntelligenceParameterId,
  type CanvasMockEffectAudioRoute,
  type CanvasMockLayerRole,
  type CanvasMockState,
} from './useCanvasMockState'

/** Backspace / delete-key glyph — the remove affordance used across the
 *  Canvas Layout Lab routing rows (replaces the trashcan). */
function BackspaceIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="m12 9 6 6" />
      <path d="m18 9-6 6" />
    </svg>
  )
}

/** Circular X — the hover-revealed remove affordance on Highlight Wash's
 *  inline parameter rows. */
function CircleXIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}

/** Blueprint Bus junction node — the terminal the bus line branches into,
 *  sitting flush-left of the Audio Intelligence parameter picker. Mirrors the
 *  gutter add-route button (gray disc, white centre) at a smaller size. */
function BusJunctionIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="rgba(154, 178, 188, 0.4)" />
      <circle cx="8" cy="8" r="2" fill="#fff" />
    </svg>
  )
}

const CANVAS_LAYER_EFFECT_LABELS: Record<CanvasLayerEffectId, string> = {
  bloom: 'Bloom',
  echo: 'Echo',
  glitch: 'Glitch',
  melt: 'Melt',
  stutter: 'Stutter',
}

const CANVAS_LAYER_EFFECT_OPTIONS = CANVAS_LAYER_EFFECT_IDS.map(effectId => ({
  value: effectId,
  label: CANVAS_LAYER_EFFECT_LABELS[effectId],
}))

const CANVAS_AUDIO_INTELLIGENCE_PARAMETER_LABELS = Object.fromEntries(
  CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => [param.id, param.label]),
) as Record<CanvasMockAudioIntelligenceParameterId, string>

// A distinct, vivid hue per Audio Intelligence parameter — used by the
// alternate Add Effects concepts below, where color is how a routed
// parameter is shown (leading dot, entry tint). The canonical group names
// the parameter in words instead.
const CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS: Record<CanvasMockAudioIntelligenceParameterId, string> = {
  kick: '#ff5f6d',
  snare: '#ff9f5f',
  hiHat: '#ffd75f',
  bass: '#8dff5f',
  mid: '#5fffb0',
  high: '#5fe0ff',
  beat: '#5f9fff',
  downbeat: '#8d5fff',
  bar: '#c95fff',
  drop: '#ff5fd7',
  energy: '#ff5f9f',
  sectionChange: '#5fffe0',
}

/** Route-map helpers for the alternate concepts, which each keep their route
 * state in a local `Record<linkKey, CanvasMockEffectAudioRoute[]>` (the
 * canonical group uses the shared mock state instead). Each returns a new
 * map so the concept's `setLinks` stays a pure updater. */
type MockRouteMap = Record<string, CanvasMockEffectAudioRoute[]>

function withRouteParam(map: MockRouteMap, key: string, parameterId: CanvasMockAudioIntelligenceParameterId): MockRouteMap {
  const existing = map[key] ?? []
  if (existing.some(route => route.parameterId === parameterId)) return map
  return { ...map, [key]: [...existing, { parameterId, intensity: DEFAULT_CANVAS_ROUTE_INTENSITY }] }
}

function withoutRouteParam(map: MockRouteMap, key: string, parameterId: CanvasMockAudioIntelligenceParameterId): MockRouteMap {
  const existing = map[key]
  if (!existing) return map
  const next = existing.filter(route => route.parameterId !== parameterId)
  const copy = { ...map }
  if (next.length > 0) copy[key] = next
  else delete copy[key]
  return copy
}

function withRouteIntensity(map: MockRouteMap, key: string, parameterId: CanvasMockAudioIntelligenceParameterId, intensity: number): MockRouteMap {
  const existing = map[key]
  if (!existing) return map
  return { ...map, [key]: existing.map(route => route.parameterId === parameterId ? { ...route, intensity } : route) }
}

function firstRouteColor(routes: readonly CanvasMockEffectAudioRoute[] | undefined): string | undefined {
  return routes?.[0] ? CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[routes[0].parameterId] : undefined
}

/** Shared route body for every Add Effects concept: add one or more Audio
 * Intelligence parameters to this effect, each with its own master-intensity
 * slider for that effect + parameter combination, and a red remove control.
 * The concepts differ only in the trigger and entry styling around this. */
function AddEffectsRouteEditor({
  routes,
  effectLabel,
  parentLabel,
  showDots = false,
  bareIntensityLabel = false,
  inlineParamRow = false,
  pickerLeading,
  onAddParameter,
  onRemoveParameter,
  onSetIntensity,
}: {
  routes: readonly CanvasMockEffectAudioRoute[]
  effectLabel: string
  parentLabel: string
  showDots?: boolean
  /** Label the slider just "Intensity" instead of "<Parameter> Intensity"
   *  (the parameter name is already shown in the row head). */
  bareIntensityLabel?: boolean
  /** Collapse each routed parameter onto one row — dot, name, intensity
   *  slider, remove — with no "<Parameter> Intensity" label and no trailing
   *  percentage (the value shows in the slider's hover bubble instead). */
  inlineParamRow?: boolean
  /** Adornment rendered flush-left of the "Add parameter" picker row (e.g. a
   *  bus-junction node a concept's connector line terminates on). */
  pickerLeading?: ReactNode
  onAddParameter: (parameterId: CanvasMockAudioIntelligenceParameterId) => void
  onRemoveParameter: (parameterId: CanvasMockAudioIntelligenceParameterId) => void
  onSetIntensity: (parameterId: CanvasMockAudioIntelligenceParameterId, intensity: number) => void
}) {
  const routed = new Set(routes.map(route => route.parameterId))
  const available = CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.filter(param => !routed.has(param.id))
  const addOptions = available.map(param => showDots
    ? {
        value: param.id,
        label: param.label,
        style: { '--ai-param-dot': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[param.id] } as CSSProperties,
      }
    : { value: param.id, label: param.label })

  return (
    <div className="rv-ae-route-editor">
      {routes.map(route => {
        const label = CANVAS_AUDIO_INTELLIGENCE_PARAMETER_LABELS[route.parameterId]
        const dot = showDots ? (
          <span
            className="rv-ae-route-dot"
            style={{ '--dot-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[route.parameterId] } as CSSProperties}
            aria-hidden="true"
          />
        ) : null
        const removeLabel = `Remove the route for ${label} · ${effectLabel} on ${parentLabel}`
        if (inlineParamRow) {
          return (
            <div className="rv-ae-route-param rv-ae-route-param--inline" key={route.parameterId}>
              {dot}
              <span className="rv-ae-route-param-name">{label}</span>
              <BubbleRevealSlider
                className="rv-ae-route-inline-slider"
                min={0}
                max={1}
                step={0.01}
                value={route.intensity}
                onChange={event => onSetIntensity(route.parameterId, parseFloat(event.target.value))}
                bubbleLabel={`${Math.round(route.intensity * 100)}%`}
                revealOnHover
                aria-label={`${label} intensity · ${effectLabel} on ${parentLabel}`}
              />
              <button
                type="button"
                className="rv-ae-param-trash rv-ae-param-trash--hover"
                aria-label={removeLabel}
                onClick={() => onRemoveParameter(route.parameterId)}
              >
                <CircleXIcon size={13} />
              </button>
            </div>
          )
        }
        return (
          <div className="rv-ae-route-param" key={route.parameterId}>
            <div className="rv-ae-route-param-head">
              {dot}
              <span className="rv-ae-route-param-name">{label}</span>
              <button
                type="button"
                className="rv-ae-param-trash"
                aria-label={removeLabel}
                onClick={() => onRemoveParameter(route.parameterId)}
              >
                <BackspaceIcon size={12} />
              </button>
            </div>
            <SliderRow
              label={bareIntensityLabel ? 'Intensity' : `${label} Intensity`}
              value={route.intensity}
              min={0}
              max={1}
              step={0.01}
              onChange={value => onSetIntensity(route.parameterId, value)}
            />
          </div>
        )
      })}
      {available.length > 0 ? (
        pickerLeading != null ? (
          <div className="rv-ae-route-picker-row">
            {pickerLeading}
            <SelectRow
              label={routes.length > 0 ? 'Add another parameter' : 'Audio Intelligence Parameter'}
              value=""
              placeholder="Select Parameter…"
              onChange={value => { if (value) onAddParameter(value as CanvasMockAudioIntelligenceParameterId) }}
              options={addOptions}
              menuClassName={showDots ? 'rv-ae-param-menu' : undefined}
            />
          </div>
        ) : (
          <SelectRow
            label={routes.length > 0 ? 'Add another parameter' : 'Audio Intelligence Parameter'}
            value=""
            placeholder="Select Parameter…"
            onChange={value => { if (value) onAddParameter(value as CanvasMockAudioIntelligenceParameterId) }}
            options={addOptions}
            menuClassName={showDots ? 'rv-ae-param-menu' : undefined}
          />
        )
      ) : (
        <div className="rv-ae-route-editor-note">Every Audio Intelligence parameter is routed to this effect.</div>
      )}
    </div>
  )
}

/** Small equalizer-bars glyph for the "Highlight Wash" concept's leading
 * route trigger — a VJ-flavored stand-in for "this effect listens to audio." */
function RouteWaveGlyphIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" aria-hidden="true">
      <path d="M5 16V8" />
      <path d="M12 19V5" />
      <path d="M19 13v6" />
    </svg>
  )
}

/** Checkmark glyph — replaces RouteWaveGlyphIcon on the "Highlight Wash"
 * concept's trigger once a parameter is linked, so the trigger itself
 * confirms the route instead of only implying "listens to audio." */
function RouteCheckGlyphIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  )
}

const RIGHT_TABS = [
  { id: 'presets' as const, label: 'PRESETS' },
  { id: 'design' as const, label: 'DESIGN' },
  { id: 'react' as const, label: 'REACT' },
  { id: 'output' as const, label: 'OUTPUT' },
]

const TRIGGER_OPTIONS = [
  { value: 'manualOnly', label: 'Manual Only' },
  { value: 'trackStart', label: 'Track Start' },
  { value: 'sectionChange', label: 'Section Change' },
  { value: 'drop', label: 'Drop' },
  { value: 'every8Bars', label: 'Every 8 Bars' },
  { value: 'every16Bars', label: 'Every 16 Bars' },
]

const SECTION_OPTIONS: Array<{ value: CanvasSectionTriggerType; label: string }> = [
  { value: 'intro', label: 'Intro' },
  { value: 'build', label: 'Build' },
  { value: 'drop', label: 'Drop' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'outro', label: 'Outro' },
]


const CROSS_ENGINE_PRESETS: Array<{ engineId: Exclude<ReactEngineId, 'canvas'>; label: string; icon: string; preset: string; description: string }> = [
  { engineId: 'cinema', label: 'Cinema', icon: '◉', preset: 'Visual Composition', description: 'Composition-native visual performance engine.' },
  { engineId: 'oscilloscope', label: 'Sound Drawing', icon: '〰', preset: 'XY Cyan Scope', description: 'Classic scope preset.' },
  { engineId: 'laserDmx', label: 'LaserDMX', icon: '⌬', preset: 'Beam Matrix', description: 'LaserDMX performance preset.' },
  { engineId: 'pixGrid', label: 'PixGrid', icon: '▦', preset: 'Bass Beacon', description: 'Pixel-grid performance preset.' },
]

const LAYER_OPTIONS: Array<{ id: CanvasMockLayerRole; label: string }> = [
  { id: 'background', label: 'Background' },
  { id: 'hero', label: 'Hero' },
  { id: 'texture', label: 'Texture' },
  { id: 'foregroundAccent', label: 'Foreground Accent' },
  { id: 'mask', label: 'Mask' },
  { id: 'transition', label: 'Transition' },
  { id: 'feedback', label: 'Feedback' },
]

function WorkspaceBody({ children }: { children: ReactNode }) {
  return (
    <div className="rv-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">{children}</div>
      </div>
    </div>
  )
}

function PresetsMockup({ state, onSelectEngine }: { state: CanvasMockState; onSelectEngine: (id: ReactEngineId) => void }) {
  const favorites = state.presets.filter(preset => preset.favorite)
  const visible = state.presetFilter === 'favorites' ? favorites : state.presets
  return (
    <WorkspaceBody>
      <div className="rv-presets-panel" data-layout-lab-canvas="presets">
        <header className="rv-preset-library-header">
          <div className="rv-preset-library-engine">
            <span aria-hidden="true">▣</span>
            <div>
              <strong>CANVAS</strong>
              <small>{state.presetFilter === 'current' ? `${visible.length} presets for the selected engine` : `${visible.length} presets shown`}</small>
              {state.activePreset.modified && <small role="status">Modified from {state.activePreset.name}</small>}
            </div>
          </div>
          <div className="rv-preset-library-views" role="tablist" aria-label="Preset library filter">
            <button type="button" role="tab" aria-selected={state.presetFilter === 'current'} className={state.presetFilter === 'current' ? 'is-active' : ''} onClick={() => state.setPresetFilter('current')}>Current Engine</button>
            <button type="button" role="tab" aria-selected={state.presetFilter === 'favorites'} className={state.presetFilter === 'favorites' ? 'is-active' : ''} onClick={() => state.setPresetFilter('favorites')}>Favorites{favorites.length ? ` ${favorites.length}` : ''}</button>
            <button type="button" role="tab" aria-selected={state.presetFilter === 'all'} className={state.presetFilter === 'all' ? 'is-active' : ''} onClick={() => state.setPresetFilter('all')}>All Engines</button>
          </div>
        </header>
        <p className="rv-presets-hint">CANVAS presets transform active uploaded media. Auto Select can choose presets from Audio Intelligence.</p>
        {visible.length === 0 ? (
          <div className="rv-preset-library-empty"><strong>No favorite presets yet</strong><span>Choose ☆ on a preset to pin it here.</span></div>
        ) : (
          <div className="rv-preset-group">
            <button type="button" className="rv-preset-group-hdr" aria-expanded="true">
              <span className="rv-preset-group-hdr-icon" aria-hidden="true">▣</span>
              <span className="rv-preset-group-hdr-label">CANVAS Media Presets</span>
              <span className="rv-preset-group-hdr-count">{visible.length}</span>
              <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
            </button>
            <div className="rv-preset-group-cards" data-preset-grid>
              {visible.map(preset => (
                <ReactPresetCard
                  key={preset.id}
                  id={preset.id}
                  title={preset.name}
                  description={preset.description}
                  thumbnail={<div className={`rv-layout-lab-canvas-preset-thumb is-${preset.rendererKind}`} style={{ '--canvas-preset-accent': preset.accent } as CSSProperties}><span /></div>}
                  chips={[{ label: preset.rendererKind === 'fragmentCollage' ? 'Fractures' : preset.rendererKind === 'particleAura' ? 'Particles' : 'Media Recipe' }]}
                  isActive={preset.id === state.activePresetId}
                  isModified={preset.modified}
                  isFavorite={preset.favorite}
                  activateLabel={`Load ${preset.name}`}
                  onActivate={() => state.selectPreset(preset.id)}
                  onToggleFavorite={() => state.togglePresetFavorite(preset.id)}
                />
              ))}
            </div>
          </div>
        )}
        {state.presetFilter === 'all' && CROSS_ENGINE_PRESETS.map(group => (
          <div key={group.engineId} className="rv-preset-group">
            <button type="button" className="rv-preset-group-hdr" aria-expanded="true">
              <span className="rv-preset-group-hdr-icon" aria-hidden="true">{group.icon}</span>
              <span className="rv-preset-group-hdr-label">{group.label}</span>
              <span className="rv-preset-group-hdr-count">1</span>
              <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
            </button>
            <div className="rv-preset-group-cards" data-preset-grid>
              <ReactPresetCard
                id={`layout-lab-canvas-${group.engineId}`}
                title={group.preset}
                description={group.description}
                thumbnail={<div className="rv-layout-lab-canvas-cross-engine-thumb" aria-hidden="true">{group.icon}</div>}
                chips={[{ label: group.label }]}
                activateLabel={`Load ${group.preset}`}
                onActivate={() => onSelectEngine(group.engineId)}
              />
            </div>
          </div>
        ))}
      </div>
    </WorkspaceBody>
  )
}

function SourceLink({ state }: { state: CanvasMockState }) {
  return (
    <Collapsible label="CANVAS Source Link" defaultOpen>
      <div className="rv-canvas-panel-copy">Source selection lives in the left SOURCE panel so the center visualizer stays render-only.</div>
      <ToggleRow label="Auto Select" value={state.engineSettings.autoSelectEnabled} onChange={state.setAutoSelectEnabled} />
      <div className="rv-layout-lab-canvas-summary-grid">
        <span>Preset<strong>{state.activePreset.name}</strong></span>
        <span>Source<strong>{state.activeMedia?.name ?? 'No active media'}</strong></span>
      </div>
      {state.presetOverride && (
        <div className="rv-layout-lab-canvas-lock-status">
          <span>{state.presetOverride.source === 'auto' ? 'Auto Select' : 'Manual preset'}: {state.presetOverride.label}</span>
          <button type="button" onClick={state.clearPresetOverride}>Clear</button>
        </div>
      )}
      {state.manualMediaOverrideActive && (
        <div className="rv-layout-lab-canvas-lock-status">
          <span>Media lock: Auto Select can change presets, but this source stays selected.</span>
          <button type="button" onClick={state.clearMediaOverride}>Clear</button>
        </div>
      )}
      {!state.activeMedia && <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">No CANVAS media is selected. Auto Select is waiting for saved compatible media.</div>}
      <div className="rv-canvas-engine-note">Audio Intelligence preview: static Drop fixture available. No analysis service is connected.</div>
      <button type="button" className="rv-layout-lab-canvas-command" onClick={state.runLocalAutoSelect}>Preview Auto Select</button>
    </Collapsible>
  )
}

function DisplayControls({ state }: { state: CanvasMockState }) {
  return (
    <Collapsible label="Display" defaultOpen>
      <SelectRow label="Fit Mode" value={state.engineSettings.fitMode} onChange={value => state.updateEngineSettings({ fitMode: value as CanvasFitMode })} options={[{ value: 'contain', label: 'Contain' }, { value: 'cover', label: 'Cover' }, { value: 'stretch', label: 'Stretch' }]} />
      <SliderRow label="Scale" value={state.engineSettings.scale} onChange={scale => state.updateEngineSettings({ scale })} min={0.1} max={4} step={0.01} />
      <SliderRow label="Position X" value={state.engineSettings.positionX} onChange={positionX => state.updateEngineSettings({ positionX })} min={-100} max={100} step={1} />
      <SliderRow label="Position Y" value={state.engineSettings.positionY} onChange={positionY => state.updateEngineSettings({ positionY })} min={-100} max={100} step={1} />
      <SliderRow label="Rotation" value={state.engineSettings.rotation} onChange={rotation => state.updateEngineSettings({ rotation })} min={-180} max={180} step={1} />
      <SliderRow label="Canvas Output Opacity" value={state.engineSettings.opacity} onChange={opacity => state.updateEngineSettings({ opacity })} min={0} max={1} step={0.01} />
    </Collapsible>
  )
}

function OrchestrationControls({ state }: { state: CanvasMockState }) {
  const hasPool = state.orchestration.mediaPoolIds.length > 0
  const lockedMediaOptions = [
    { value: '', label: 'Deterministic Auto' },
    ...state.orchestration.mediaPoolIds.map(id => {
      const item = state.mediaItems.find(candidate => candidate.id === id)
      return { value: id, label: item?.name ?? id }
    }),
  ]
  return (
    <Collapsible label="Performance Orchestration" defaultOpen>
      <ToggleRow label="Auto Performance" value={state.orchestration.enabled} onChange={enabled => state.updateOrchestration({ enabled })} disabled={!hasPool} />
      <div className="rv-layout-lab-canvas-summary-grid">
        <span>Pooled Sources<strong>{state.orchestration.mediaPoolIds.length}</strong></span>
        <span>Composition<strong>{state.orchestration.compositionPreference === 'auto' ? 'Auto Section Aware' : state.orchestration.compositionPreference}</strong></span>
      </div>
      {!hasPool && <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">Add saved media to the Performance Pool before enabling performance orchestration.</div>}
      <SelectRow label="Performance Show" value={state.orchestration.programId} onChange={programId => state.updateOrchestration({ programId })} disabled={!hasPool} options={[{ value: 'canvas-cinematic-bass-editor', label: 'Cinematic Bass Editor' }, { value: 'canvas-multi-source-performance', label: 'Multi-Source Performance' }, { value: 'canvas-source-showcase', label: 'Source Showcase' }]} />
      <ToggleRow label="Auto Role" value={state.orchestration.autoRoleEnabled} onChange={autoRoleEnabled => state.updateOrchestration({ autoRoleEnabled })} disabled={!hasPool} />
      <SelectRow label="Composition" value={state.orchestration.compositionPreference} onChange={compositionPreference => state.updateOrchestration({ compositionPreference })} disabled={!hasPool} options={[{ value: 'auto', label: 'Auto Section Aware' }, { value: 'hero-focus', label: 'Hero Focus' }, { value: 'layered-depth', label: 'Layered Depth' }, { value: 'rapid-cuts', label: 'Rapid Cuts' }]} />
      <SliderRow label="Layer Complexity" value={state.orchestration.complexity} onChange={complexity => state.updateOrchestration({ complexity })} disabled={!hasPool} />
      <SliderRow label="Transition Density" value={state.orchestration.transitionDensity} onChange={transitionDensity => state.updateOrchestration({ transitionDensity })} disabled={!hasPool} />
      <SliderRow label="Effect Intensity" value={state.orchestration.effectIntensity} onChange={effectIntensity => state.updateOrchestration({ effectIntensity })} disabled={!hasPool} />
      <SliderRow label="Motion Intensity" value={state.orchestration.motionIntensity} onChange={motionIntensity => state.updateOrchestration({ motionIntensity })} disabled={!hasPool} />
      <SliderRow label="Cut Density" value={state.orchestration.cutDensity} onChange={cutDensity => state.updateOrchestration({ cutDensity })} disabled={!hasPool} />
      <Collapsible label="Locks" defaultOpen={false}>
        <ToggleRow label="Media Lock" value={state.orchestration.mediaLock} onChange={mediaLock => state.updateOrchestration({ mediaLock })} disabled={!hasPool} />
        {LAYER_OPTIONS.map(layer => (
          <div key={layer.id} className="rv-layout-lab-canvas-layer-lock">
            <strong>{layer.label}</strong>
            <ToggleRow label="Lock Layer State" value={Boolean(state.orchestration.layerLocks[layer.id])} onChange={locked => state.setLayerLock(layer.id, locked)} disabled={!hasPool} />
            <SelectRow label="Locked Media" value={state.orchestration.mediaLocksByLayer[layer.id] ?? ''} onChange={value => state.setLockedMedia(layer.id, value || null)} options={lockedMediaOptions} disabled={!hasPool} />
          </div>
        ))}
      </Collapsible>
      <div className="rv-canvas-engine-note">Shared Performance: deterministic local diagnostics · section authority available · no runtime execution.</div>
      <button type="button" className="rv-layout-lab-canvas-command" onClick={state.resetOrchestration}>Reset Authored State</button>
    </Collapsible>
  )
}

function NormalRecipeControls({ state }: { state: CanvasMockState }) {
  const settings = state.presetSettings
  const customized = state.activePreset.modified
  return (
    <Collapsible label="CANVAS React Controls" defaultOpen>
      <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
        <div className="rv-ctrl-toggle-line"><span className="rv-ctrl-label">{state.activePreset.name}</span><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={state.resetPresetSettings}>Reset</button></div>
        {customized && <span className="rv-ctrl-description">Customized recipe active.</span>}
      </div>
      {settings.particleDensity > 0.02 && !state.activeMedia && <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">Particles need an active CANVAS library media item before they can sample pixels and emit from the source.</div>}
      <Collapsible label="Source + Reactivity" defaultOpen>
        <SliderRow label="Dry Source Mix" value={settings.drySourceMix} onChange={drySourceMix => state.updatePresetSettings({ drySourceMix, sourceVisibility: drySourceMix })} />
        <SliderRow label="Visual Intensity" value={settings.intensity} onChange={intensity => state.updatePresetSettings({ intensity })} />
        <SliderRow label="Bass Reactivity" value={settings.bassReactivity} onChange={bassReactivity => state.updatePresetSettings({ bassReactivity })} />
        <SliderRow label="Beat Pulse" value={settings.beatPulse} onChange={beatPulse => state.updatePresetSettings({ beatPulse })} />
      </Collapsible>
      <Collapsible label="FX" defaultOpen>
        <SliderRow label="Glow Amount" value={settings.glow} onChange={glow => state.updatePresetSettings({ glow })} />
        <SliderRow label="Trail Amount" value={settings.trailAmount} onChange={trailAmount => state.updatePresetSettings({ trailAmount })} />
        <SliderRow label="RGB Split" value={settings.rgbSplit} onChange={rgbSplit => state.updatePresetSettings({ rgbSplit })} />
        <SliderRow label="Glitch Amount" value={settings.glitchAmount} onChange={glitchAmount => state.updatePresetSettings({ glitchAmount })} />
        <SliderRow label="Stutter Rate" value={settings.stutterRate} onChange={stutterRate => state.updatePresetSettings({ stutterRate })} min={0} max={16} step={1} />
        <SliderRow label="Luma Threshold" value={settings.lumaThreshold} onChange={lumaThreshold => state.updatePresetSettings({ lumaThreshold })} />
      </Collapsible>
      <Collapsible label="Motion + Particles" defaultOpen={false}>
        <SliderRow label="Motion Amount" value={settings.motionAmount} onChange={motionAmount => state.updatePresetSettings({ motionAmount })} />
        <SliderRow label="Turbulence" value={settings.turbulence} onChange={turbulence => state.updatePresetSettings({ turbulence })} />
        <SliderRow label="Particle Density" value={settings.particleDensity} onChange={particleDensity => state.updatePresetSettings({ particleDensity })} />
        <SliderRow label="Particle Size" value={settings.particleSize} onChange={particleSize => state.updatePresetSettings({ particleSize })} min={0.5} max={8} step={0.1} />
        <SelectRow label="Particle Color Mode" value={settings.particleColorMode} onChange={value => state.updatePresetSettings({ particleColorMode: value as CanvasPresetColorMode })} options={[{ value: 'original', label: 'Original' }, { value: 'palette', label: 'DRMVYZ Palette' }, { value: 'audioReactive', label: 'Audio Reactive' }]} />
        <SelectRow label="Particle Quality" value={settings.particleQuality} onChange={value => state.updatePresetSettings({ particleQuality: value as CanvasParticleQuality })} options={[{ value: 'low', label: 'Low' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} />
      </Collapsible>
      {state.presetOverride?.source === 'auto' && <div className="rv-canvas-engine-note">{state.presetOverride.label}.</div>}
    </Collapsible>
  )
}

function FracturesControls({ state }: { state: CanvasMockState }) {
  const s = state.presetSettings
  const update = state.updatePresetSettings
  const command = (kind: 'refracture' | 'shuffle' | 'freeze' | 'anchor') => {
    if (kind === 'refracture') update({ fractureTopologyRevision: s.fractureTopologyRevision + 1, fractureLastManualAction: 'refracture' })
    if (kind === 'shuffle') update({ fractureLayoutRevision: s.fractureLayoutRevision + 1, fractureLastManualAction: 'shuffleLayout' })
    if (kind === 'freeze') update(s.fractureFreezeLayout
      ? { fractureFreezeLayout: false, fractureLastManualAction: 'releaseFreeze' }
      : { fractureFreezeLayout: true })
    if (kind === 'anchor') update({ fractureReturnToAnchor: true, fractureLastManualAction: 'returnToAnchor' })
  }
  return (
    <Collapsible label="Fractures Controls" defaultOpen>
      <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
        <div className="rv-ctrl-toggle-line"><span className="rv-ctrl-label">Fractures</span><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={state.resetPresetSettings}>Reset</button></div>
        {state.activePreset.modified && <span className="rv-ctrl-description">Customized recipe active.</span>}
      </div>
      <Collapsible label="Structure" defaultOpen>
        <SliderRow label="Fracture Intensity" value={s.fractureIntensity} onChange={fractureIntensity => update({ fractureIntensity })} />
        <SelectRow label="Fracture Mode" value={s.fractureMode} onChange={value => update({ fractureMode: value as typeof s.fractureMode })} options={[{ value: 'mixed', label: 'Mixed' }, { value: 'rectangles', label: 'Rectangles' }, { value: 'horizontalSlices', label: 'Horizontal Slices' }, { value: 'verticalSlices', label: 'Vertical Slices' }, { value: 'angledQuads', label: 'Angled Quadrilaterals' }]} />
        <SelectRow label="Anchor Mode" value={s.fractureAnchorMode} onChange={value => update({ fractureAnchorMode: value as CanvasFractureAnchorMode })} options={[{ value: 'alwaysVisible', label: 'Always Visible' }, { value: 'reactive', label: 'Reactive' }, { value: 'fadeWithMusic', label: 'Fade With Music' }, { value: 'fullyFragmented', label: 'Fully Fragmented' }]} />
        <SliderRow label="Focus Protection" value={s.fractureFocusProtection} onChange={fractureFocusProtection => update({ fractureFocusProtection })} />
        <SliderRow label="Focus X" value={s.fractureFocusX} onChange={fractureFocusX => update({ fractureFocusX })} />
        <SliderRow label="Focus Y" value={s.fractureFocusY} onChange={fractureFocusY => update({ fractureFocusY })} />
        <SliderRow label="Composition" value={s.fractureComposition} onChange={fractureComposition => update({ fractureComposition })} />
        <SelectRow label="Placement Mode" value={s.fracturePlacementMode} onChange={value => update({ fracturePlacementMode: value as CanvasFracturePlacementMode })} options={[{ value: 'balanced', label: 'Balanced' }, { value: 'offscreenSpill', label: 'Offscreen Spill' }, { value: 'heavyOverlap', label: 'Heavy Overlap' }, { value: 'anchorCover', label: 'Anchor Cover' }, { value: 'repeatedCrops', label: 'Repeated Crops' }, { value: 'mirrorFlip', label: 'Mirror and Flip' }, { value: 'randomMix', label: 'Random Mix' }]} />
        <SelectRow label="Topology Change" value={s.fractureTopologyInterval} onChange={value => update({ fractureTopologyInterval: value as CanvasFractureQuantizeInterval })} options={[{ value: 'manualOnly', label: 'Manual Only' }, { value: 'section', label: 'Every Section' }, { value: '16bars', label: 'Every 16 Bars' }, { value: '8bars', label: 'Every 8 Bars' }, { value: '4bars', label: 'Every 4 Bars' }]} />
        <SelectRow label="Layout Change" value={s.fractureLayoutInterval} onChange={value => update({ fractureLayoutInterval: value as CanvasFractureQuantizeInterval })} options={[{ value: 'manualOnly', label: 'Manual Only' }, { value: 'section', label: 'Every Section' }, { value: '16bars', label: 'Every 16 Bars' }, { value: '8bars', label: 'Every 8 Bars' }, { value: '4bars', label: 'Every 4 Bars' }, { value: 'bar', label: 'Every Bar' }]} />
        <NumberInputRow label="Variation Seed" value={s.fractureVariationSeed} onChange={fractureVariationSeed => update({ fractureVariationSeed })} min={0} max={999999} step={1} />
        <SelectRow label="Quality" value={s.fractureQuality} onChange={value => update({ fractureQuality: value as CanvasFractureQualityMode })} options={[{ value: 'auto', label: 'Auto' }, { value: 'low', label: 'Low' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }]} />
      </Collapsible>
      <Collapsible label="Motion" defaultOpen>
        <SliderRow label="Motion" value={s.fractureMotionAmount} onChange={fractureMotionAmount => update({ fractureMotionAmount })} />
        <SelectRow label="Transition" value={s.fractureTransitionMode} onChange={value => update({ fractureTransitionMode: value as CanvasFractureTransitionMode })} options={[{ value: 'hardGlitchCut', label: 'Hard Glitch Cut' }, { value: 'staggeredAssembly', label: 'Staggered Assembly' }, { value: 'zoomInOut', label: 'Zoom In and Out' }]} />
        <SliderRow label="Transition Speed" value={s.fractureTransitionSpeed} onChange={fractureTransitionSpeed => update({ fractureTransitionSpeed })} />
        <ToggleRow label="BPM Sync" value={s.fractureBpmSync} onChange={fractureBpmSync => update({ fractureBpmSync })} />
        <SliderRow label="Stagger" value={s.fractureStaggerAmount} onChange={fractureStaggerAmount => update({ fractureStaggerAmount })} />
        <SliderRow label="Zoom" value={s.fractureZoomAmount} onChange={fractureZoomAmount => update({ fractureZoomAmount })} />
        <div className="rv-layout-lab-canvas-command-grid">
          <button type="button" onClick={() => command('refracture')}>Refracture</button>
          <button type="button" onClick={() => command('shuffle')}>Shuffle Layout</button>
          <button type="button" onClick={() => command('freeze')}>{s.fractureFreezeLayout ? 'Unfreeze Layout' : 'Freeze Layout'}</button>
          <button type="button" onClick={() => command('anchor')}>Return to Anchor</button>
        </div>
        <div className="rv-canvas-engine-note">Topology revision {s.fractureTopologyRevision} · Layout revision {s.fractureLayoutRevision} · Last command {s.fractureLastManualAction}</div>
      </Collapsible>
      <Collapsible label="Effects" defaultOpen={false}>
        <SliderRow label="Effects Intensity" value={s.fractureEffectsIntensity} onChange={fractureEffectsIntensity => update({ fractureEffectsIntensity })} />
        <SliderRow label="Glow" value={s.fractureGlowAmount} onChange={fractureGlowAmount => update({ fractureGlowAmount })} />
        <SliderRow label="Glitch" value={s.fractureGlitchAmount} onChange={fractureGlitchAmount => update({ fractureGlitchAmount })} />
        <SliderRow label="Texture" value={s.fractureTextureAmount} onChange={fractureTextureAmount => update({ fractureTextureAmount })} />
        <SliderRow label="Trails" value={s.fractureTrailsAmount} onChange={fractureTrailsAmount => update({ fractureTrailsAmount })} />
        <SliderRow label="Depth" value={s.fractureDepthAmount} onChange={fractureDepthAmount => update({ fractureDepthAmount })} />
        <SliderRow label="Duplication" value={s.fractureDuplicationAmount} onChange={fractureDuplicationAmount => update({ fractureDuplicationAmount })} />
        <SliderRow label="Color Treatment" value={s.fractureColorTreatmentAmount} onChange={fractureColorTreatmentAmount => update({ fractureColorTreatmentAmount })} />
        <SelectRow label="Color Source" value={s.fractureColorSourceMode} onChange={value => update({ fractureColorSourceMode: value as CanvasFractureColorSourceMode })} options={[{ value: 'imageSampled', label: 'Image Sampled' }, { value: 'brandKit', label: 'Brand Kit' }, { value: 'manualOverride', label: 'Manual Override' }]} />
        <ColorRow label="Manual Primary Color" value={s.fractureManualPrimaryColor} onChange={fractureManualPrimaryColor => update({ fractureManualPrimaryColor })} disabled={s.fractureColorSourceMode !== 'manualOverride'} />
        <ColorRow label="Manual Supporting Color" value={s.fractureManualSupportingColor} onChange={fractureManualSupportingColor => update({ fractureManualSupportingColor })} disabled={s.fractureColorSourceMode !== 'manualOverride'} />
        {Object.entries(s.fractureEffectRoleWeights).map(([role, value]) => <SliderRow key={role} label={`${role[0].toUpperCase()}${role.slice(1)} Role`} value={value} onChange={next => update({ fractureEffectRoleWeights: { ...s.fractureEffectRoleWeights, [role]: next } })} />)}
      </Collapsible>
      <Collapsible label="Audio" defaultOpen={false}>
        <SliderRow label="Audio Response" value={s.fractureAudioResponse} onChange={fractureAudioResponse => update({ fractureAudioResponse })} />
        <SliderRow label="Bass Motion" value={s.fractureBassMotion} onChange={fractureBassMotion => update({ fractureBassMotion })} />
        <SliderRow label="Transient Glitch" value={s.fractureTransientGlitch} onChange={fractureTransientGlitch => update({ fractureTransientGlitch })} />
        <SliderRow label="Structural Response" value={s.fractureStructuralResponse} onChange={fractureStructuralResponse => update({ fractureStructuralResponse })} />
      </Collapsible>
      <div className="rv-canvas-engine-note">Fractures topology, layout, transitions, effect roles, modifier assignment, feedback, and source-derived colors are deterministic across playback, seeking, and looping. Audio modulation is represented with static local values. Recording and cast output remain intentionally unavailable for Fractures.</div>
    </Collapsible>
  )
}

function VideoTiming({ state }: { state: CanvasMockState }) {
  const t = state.activeVideoTiming
  const enabled = state.activeMediaIsVideo
  return (
    <Collapsible label="Video Timing" defaultOpen>
      <div className="rv-canvas-engine-note">{enabled ? 'These controls affect saved library video playback inside CANVAS. Clip audio stays muted so the loaded track remains in charge.' : 'CANVAS timing controls are video-only. Select a saved video to enable clip starts, ranges, loops, and musical triggers.'}</div>
      <SelectRow label="Trigger On" value={t.triggerOn} onChange={value => state.updateVideoTiming({ triggerOn: value as CanvasTriggerOn })} disabled={!enabled} options={TRIGGER_OPTIONS} description="Choose the musical moment that restarts the active CANVAS video clip." />
      <NumberInputRow label="Clip Start Time" value={t.clipStartSec} onChange={clipStartSec => state.updateVideoTiming({ clipStartSec })} min={0} max={21600} step={0.1} unit="sec" disabled={!enabled} />
      <NumberInputRow label="Clip End Time" value={t.clipEndSec || ''} onChange={clipEndSec => state.updateVideoTiming({ clipEndSec })} onEmpty={() => state.updateVideoTiming({ clipEndSec: 0 })} min={0} max={21600} step={0.1} unit="sec" disabled={!enabled} placeholder="Video end" />
      <div className="rv-canvas-engine-note">Active range: {enabled ? `${t.clipStartSec.toFixed(1)} sec → ${t.clipEndSec > 0 ? `${t.clipEndSec.toFixed(1)} sec` : 'video end'}` : 'No active video'}</div>
      <ToggleRow label="Loop Clip Range" value={t.loopClipRange} onChange={loopClipRange => state.updateVideoTiming({ loopClipRange })} disabled={!enabled} />
      <ToggleRow label="Loop Full Video" value={state.engineSettings.loopVideo} onChange={loopVideo => state.updateEngineSettings({ loopVideo })} disabled={!enabled} />
      <ToggleRow label="Restart on Drop" value={t.restartOnDrop} onChange={restartOnDrop => state.updateVideoTiming({ restartOnDrop })} disabled={!enabled} />
      <ToggleRow label="Restart on Section Change" value={t.restartOnSectionChange} onChange={restartOnSectionChange => state.updateVideoTiming({ restartOnSectionChange })} disabled={!enabled} />
      <ToggleRow label="Restart on Manual Preset Change" value={t.restartOnManualPresetChange} onChange={restartOnManualPresetChange => state.updateVideoTiming({ restartOnManualPresetChange })} disabled={!enabled} />
      <div className="rv-ctrl-section-label">Section Trigger Mapping</div>
      <div className="rv-canvas-engine-note">Map section-trigger restarts to Audio Intelligence sections after a track has been loaded and analyzed.</div>
      <div className="rv-layout-lab-canvas-role-grid">
        {SECTION_OPTIONS.map(option => <button key={option.value} type="button" disabled={!enabled} className={t.sectionTriggerTypes.includes(option.value) ? 'is-active' : ''} aria-pressed={t.sectionTriggerTypes.includes(option.value)} onClick={() => state.toggleSectionTrigger(option.value)}>{option.label}</button>)}
      </div>
      <button type="button" className="rv-layout-lab-canvas-command" disabled={!enabled} onClick={state.restartVideo}>Restart Clip</button>
      {state.restartVideoRevision > 0 && <div className="rv-canvas-engine-note" role="status">Local restart revision {state.restartVideoRevision}. No video element was created.</div>}
    </Collapsible>
  )
}

function DesignMockup({ state }: { state: CanvasMockState }) {
  return (
    <WorkspaceBody>
      <PanelSubtabs value={state.designSurface} options={[{ id: 'engine', label: 'ENGINE' }, { id: 'selection', label: 'SELECTION', disabled: true }]} onChange={state.setDesignSurface} ariaLabel="Canvas design surfaces" />
      <div className="rv-ctrl-group" data-layout-lab-canvas="design">
        <SourceLink state={state} />
        <DisplayControls state={state} />
        <OrchestrationControls state={state} />
        {state.isFractures ? <FracturesControls state={state} /> : <NormalRecipeControls state={state} />}
        <VideoTiming state={state} />
      </div>
    </WorkspaceBody>
  )
}

function AnalysisMockup() {
  const sections = [
    ['Audio Bands', 'Bass 62% · Mid 47% · High 38%'],
    ['Rhythm', 'Beat 128 · Downbeat 32 · Tempo 150 BPM'],
    ['Energy', 'Current 71% · Trend rising'],
    ['Section', 'Drop 2 · 16 bars remaining'],
    ['Harmonic', 'G Major · confidence 84%'],
    ['Stems', 'Drums 68% · Bass 54% · Vocals 21%'],
    ['Lyrics', 'No synchronized lyric fixture'],
    ['Semantic', 'Impact approaching · static sample'],
  ]
  return <div className="rv-layout-lab-canvas-analysis">{sections.map(([title, value]) => <section key={title}><strong>{title}</strong><span>{value}</span></section>)}</div>
}

/** Context handed to a concept's route renderer for one authored effect. */
interface AddEffectsRouteContext {
  layer: CanvasMockState['addEffectsLayers'][number]
  effectId: CanvasLayerEffectId
  effectIndex: number
  effectLabel: string
  parentLabel: string
  linkKey: string
}

/** Shared skeleton for one authored media layer: the Active Media select,
 * every configured effect's Select Effect dropdown + remove trashcan, and
 * the add-effect row. This is identical across the canonical Add Effects
 * group and all four alternate concepts below, so every concept shows the
 * complete authoring surface — not just its own route-linking idiom sitting
 * on top of borrowed, read-only data. `renderRoute` supplies the
 * concept-specific route trigger/picker nested under each effect;
 * `renderLeading` and `getEntryExtra` let a concept additionally place
 * something before the effect dropdown or style the whole effect entry
 * (e.g. a colored outline or background wash showing it's linked). */
function AddEffectsLayerGroup({
  state,
  layer,
  layerIndex,
  renderRoute,
  renderLeading,
  getEntryExtra,
  getMediaRowExtra,
  getGroupExtra,
  renderMediaRowLeading,
  renderAfterMediaRow,
  showEffects = true,
}: {
  state: CanvasMockState
  layer: CanvasMockState['addEffectsLayers'][number]
  layerIndex: number
  renderRoute: (ctx: AddEffectsRouteContext) => ReactNode
  renderLeading?: (ctx: AddEffectsRouteContext) => ReactNode
  getEntryExtra?: (ctx: AddEffectsRouteContext) => { className?: string; style?: CSSProperties }
  getMediaRowExtra?: (layer: CanvasMockState['addEffectsLayers'][number]) => { className?: string; style?: CSSProperties } | undefined
  /** Style the outer wrapper that holds the Active Media select, the effect
   *  dropdowns, and the add-effect row (e.g. a single framed panel). */
  getGroupExtra?: (layer: CanvasMockState['addEffectsLayers'][number]) => { className?: string; style?: CSSProperties } | undefined
  /** Content placed to the left of the Active Media select + label, stretched
   *  to that field's height (e.g. a square media thumbnail). */
  renderMediaRowLeading?: (layer: CanvasMockState['addEffectsLayers'][number]) => ReactNode
  /** Content placed between the Active Media select and the effect stack. */
  renderAfterMediaRow?: (layer: CanvasMockState['addEffectsLayers'][number]) => ReactNode
  /** When false, the effect-dropdown stack is hidden (a concept can gate it
   *  behind a disclosure control). Defaults to shown. */
  showEffects?: boolean
}) {
  const parentLabel = `Active Media ${layerIndex + 1}`
  const selectedEffects = new Set(layer.effects)
  const mediaRow = (
    <SelectRow
      label={parentLabel}
      value={layer.mediaId}
      onChange={() => {}}
      options={[{ value: layer.mediaId, label: layer.mediaName }]}
    />
  )
  const mediaRowExtra = getMediaRowExtra?.(layer)
  const groupExtra = getGroupExtra?.(layer)
  const mediaRowNode = mediaRowExtra
    ? <div className={mediaRowExtra.className} style={mediaRowExtra.style}>{mediaRow}</div>
    : mediaRow
  const mediaRowLeading = renderMediaRowLeading?.(layer)
  return (
    <div
      className={groupExtra?.className ? `rv-canvas-layer-effects-group ${groupExtra.className}` : 'rv-canvas-layer-effects-group'}
      style={groupExtra?.style}
    >
      {/* Which media occupies this slot is decided in the Media Library
          (Performance Pool / active selection) — display-only, styled
          like a real input field for consistency, matching the
          production Add Effects group. */}
      {mediaRowLeading != null ? (
        <div className="rv-canvas-layer-media-row">
          {mediaRowLeading}
          <div className="rv-canvas-layer-media-row__field">{mediaRowNode}</div>
        </div>
      ) : mediaRowNode}
      {renderAfterMediaRow?.(layer)}
      {showEffects && (
      <div className="rv-canvas-layer-effects-stack" data-canvas-effect-layer-id={layer.mediaId}>
        {layer.effects.map((effectId, effectIndex) => {
          const options = CANVAS_LAYER_EFFECT_OPTIONS.filter(option => (
            option.value === effectId || !selectedEffects.has(option.value)
          ))
          const effectLabel = CANVAS_LAYER_EFFECT_LABELS[effectId]
          const linkKey = canvasEffectAudioLinkKey(layer.mediaId, effectId)
          const ctx: AddEffectsRouteContext = { layer, effectId, effectIndex, effectLabel, parentLabel, linkKey }
          const extra = getEntryExtra?.(ctx)
          const entryClassName = extra?.className ? `rv-canvas-layer-effect-entry ${extra.className}` : 'rv-canvas-layer-effect-entry'
          return (
            <div className={entryClassName} style={extra?.style} key={`${layer.mediaId}:${effectIndex}`}>
              <div className="rv-canvas-layer-effect-row">
                {renderLeading?.(ctx)}
                <SelectRow
                  label="Effect"
                  id={`${layer.mediaId}-effect-${effectIndex}`}
                  value={effectId}
                  onChange={value => state.setCanvasLayerEffect(layer.mediaId, effectIndex, value as CanvasLayerEffectId)}
                  options={options}
                />
                <button
                  type="button"
                  className="vz-media-remove rv-canvas-layer-effect-remove"
                  aria-label={`Remove ${effectLabel} from ${parentLabel}`}
                  onClick={() => state.removeCanvasLayerEffectAt(layer.mediaId, effectIndex)}
                >
                  <BackspaceIcon size={14} />
                </button>
              </div>
              {renderRoute(ctx)}
            </div>
          )
        })}
        {layer.effects.length < MAX_CANVAS_LAYER_EFFECTS && (
          <div className="rv-canvas-layer-effect-row rv-canvas-layer-effect-row--empty">
            <SelectRow
              label={`Add effect to ${parentLabel}`}
              labelHidden
              value=""
              placeholder="Select Effect…"
              onChange={value => state.addCanvasLayerEffect(layer.mediaId, value as CanvasLayerEffectId)}
              options={CANVAS_LAYER_EFFECT_OPTIONS.filter(option => !selectedEffects.has(option.value))}
            />
          </div>
        )}
      </div>
      )}
    </div>
  )
}

/** Add Effects group — the canonical, approved design. Each configured
 * effect gets its own "Route Effect" toggle, right-justified directly under
 * that effect's dropdown. Expanding it reveals an indented Audio
 * Intelligence parameter picker nested under that specific effect — so the
 * routing UI never leaves this group, and which effect a route belongs to
 * is always visually unambiguous. */
function AddEffectsControls({ state }: { state: CanvasMockState }) {
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({})

  return (
    <Collapsible label="Add Effects" defaultOpen>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to author effects on it here.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          renderRoute={({ effectId, effectLabel, parentLabel, linkKey }) => {
            const routes = state.effectAudioLinks[linkKey] ?? []
            const routeExpanded = expandedRoutes[linkKey] ?? routes.length > 0
            return (
              <>
                <div className="rv-canvas-effect-route-row">
                  <button
                    type="button"
                    className="rv-canvas-effect-route-toggle"
                    aria-expanded={routeExpanded}
                    onClick={() => setExpandedRoutes(current => ({ ...current, [linkKey]: !routeExpanded }))}
                  >
                    {routes.length
                      ? `Route Effect · ${routes.length} parameter${routes.length === 1 ? '' : 's'}`
                      : 'Route Effect'}
                  </button>
                </div>
                {routeExpanded && (
                  <div className="rv-canvas-effect-route-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={effectLabel}
                      parentLabel={parentLabel}
                      onAddParameter={id => state.addEffectAudioParameter(layer.mediaId, effectId, id)}
                      onRemoveParameter={id => state.removeEffectAudioParameter(layer.mediaId, effectId, id)}
                      onSetIntensity={(id, value) => state.setEffectAudioParameterIntensity(layer.mediaId, effectId, id, value)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      ))}
    </Collapsible>
  )
}

/** Stand-in thumbnail image for the mock (no real media assets exist here) —
 *  the DRMVYZ logo, resolved against the app root so it also loads from the
 *  Layout Lab popup document. */
const MEDIA_THUMB_TEST_IMAGE = (() => {
  try { return new URL('/drmvyz_logo_icon.png', document.baseURI).href }
  catch { return '/drmvyz_logo_icon.png' }
})()

/** Square media thumbnail whose width and height exactly track the rendered
 *  height of the sibling media dropdown + label. Pure CSS can't derive one
 *  axis' length from a flex/grid sibling's content height, so measure it. */
function MediaThumbBox({ mediaName, mediaType }: { mediaName: string; mediaType: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState(46)
  useEffect(() => {
    const element = ref.current
    const field = element?.parentElement?.querySelector<HTMLElement>('.rv-canvas-layer-media-row__field')
    if (!element || !field || typeof ResizeObserver === 'undefined') return
    const measure = () => setSize(field.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(field)
    return () => observer.disconnect()
  }, [])
  return (
    <span
      ref={ref}
      className="rv-ae-orb-thumb"
      data-media-type={mediaType}
      role="img"
      aria-label={`${mediaName} thumbnail`}
      title={mediaName}
      style={{ width: size, height: size }}
    >
      <img
        className="rv-ae-orb-thumb-img"
        src={MEDIA_THUMB_TEST_IMAGE}
        alt=""
        onError={event => { event.currentTarget.style.display = 'none' }}
      />
    </span>
  )
}

/** Concept — "Highlight Wash." A leading equalizer-bars icon (before the
 * effect dropdown) toggles the shared route editor. Routing tints the Active
 * Media select's bottom border to the first parameter's color and swaps the
 * leading trigger for a checkmark; the parameter list is indented under the
 * effect dropdown, one compact row per parameter. Local route state,
 * comparison only. */
function AddEffectsHighlightWashConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<MockRouteMap>({})

  return (
    <Collapsible label="Add Effects — Highlight Wash" defaultOpen={false}>
      <div className="rv-canvas-engine-note">Routing a parameter colors the Active Media select's bottom border to match and swaps the leading trigger for a checkmark. The parameter list is indented under the effect dropdown — one compact row each: color dot, parameter, intensity slider (value on hover), remove. Concept only.</div>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to preview this concept.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getMediaRowExtra={mediaLayer => {
            // First routed parameter under this media item, across all of its
            // effects, sets the Active Media border color.
            const firstRoute = mediaLayer.effects
              .flatMap(effectId => links[canvasEffectAudioLinkKey(mediaLayer.mediaId, effectId)] ?? [])[0]
            const color = firstRoute ? CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[firstRoute.parameterId] : undefined
            return {
              className: `rv-ae-wash-media-row${color ? ' is-linked' : ''}`,
              style: color ? ({ '--wash-color': color } as CSSProperties) : undefined,
            }
          }}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-wash-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--wash-color': color } as CSSProperties) : undefined,
            }
          }}
          renderLeading={({ effectLabel, parentLabel, linkKey }) => {
            const routes = links[linkKey] ?? []
            const color = firstRouteColor(routes)
            const isOpen = expanded[linkKey] ?? routes.length > 0
            return (
              <button
                type="button"
                className={`rv-ae-wash-trigger${routes.length ? ' is-linked' : ''}`}
                style={color ? ({ '--wash-color': color } as CSSProperties) : undefined}
                aria-expanded={isOpen}
                aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                onClick={() => setExpanded(current => ({ ...current, [linkKey]: !isOpen }))}
              >
                {routes.length ? <RouteCheckGlyphIcon /> : <RouteWaveGlyphIcon />}
              </button>
            )
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = links[linkKey] ?? []
            const isOpen = expanded[linkKey] ?? routes.length > 0
            if (!isOpen) return null
            return (
              <div className="rv-ae-wash-route">
                <AddEffectsRouteEditor
                  routes={routes}
                  effectLabel={effectLabel}
                  parentLabel={parentLabel}
                  showDots
                  inlineParamRow
                  onAddParameter={id => setLinks(current => withRouteParam(current, linkKey, id))}
                  onRemoveParameter={id => setLinks(current => withoutRouteParam(current, linkKey, id))}
                  onSetIntensity={(id, value) => setLinks(current => withRouteIntensity(current, linkKey, id, value))}
                />
              </div>
            )
          }}
        />
      ))}
    </Collapsible>
  )
}

/** Shared local route state for the alternate concepts below: which Audio
 * Intelligence parameters are routed to each effect, whether that effect's
 * editor is expanded, and the add/remove/intensity handlers the shared
 * AddEffectsRouteEditor needs. */
function useConceptRoutes() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<MockRouteMap>({})
  const routesFor = (linkKey: string): CanvasMockEffectAudioRoute[] => links[linkKey] ?? []
  const isOpenFor = (linkKey: string) => expanded[linkKey] ?? routesFor(linkKey).length > 0
  const toggle = (linkKey: string) => {
    const next = !isOpenFor(linkKey)
    setExpanded(current => ({ ...current, [linkKey]: next }))
  }
  const editorHandlers = (linkKey: string) => ({
    onAddParameter: (id: CanvasMockAudioIntelligenceParameterId) => setLinks(current => withRouteParam(current, linkKey, id)),
    onRemoveParameter: (id: CanvasMockAudioIntelligenceParameterId) => setLinks(current => withoutRouteParam(current, linkKey, id)),
    onSetIntensity: (id: CanvasMockAudioIntelligenceParameterId, value: number) => setLinks(current => withRouteIntensity(current, linkKey, id, value)),
  })
  return { links, routesFor, isOpenFor, toggle, editorHandlers }
}

/** Collapsible + intro note + per-layer map shell shared by the concepts. */
function ConceptGroup({
  state,
  label,
  note,
  children,
}: {
  state: CanvasMockState
  label: string
  note: string
  children: (layer: CanvasMockState['addEffectsLayers'][number], layerIndex: number) => ReactNode
}) {
  return (
    <Collapsible label={label} defaultOpen={false}>
      <div className="rv-canvas-engine-note">{note}</div>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to preview this concept.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => children(layer, layerIndex))}
    </Collapsible>
  )
}

function DeckExpandGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  )
}

function DeckPlayGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function DeckChevronGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** Concept — "Blueprint Bus." The effect dropdowns indent under the Active
 * Media dropdown; a filled add-route button drops into the gutter where each
 * effect field used to start, with a neutral-gray bus line running down to
 * the indented Audio Intelligence parameters. Local route state. */
function AddEffectsBlueprintBusConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Blueprint Bus"
      note="The effect dropdowns are indented under the Active Media dropdown; a filled add-route button sits in the gutter where each effect field used to start, and a gray bus line runs down to the indented Audio Intelligence parameters. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-bus-group' })}
          renderMediaRowLeading={mediaLayer => {
            const media = state.mediaItems.find(item => item.id === mediaLayer.mediaId)
            return (
              <MediaThumbBox
                key={mediaLayer.mediaId}
                mediaName={mediaLayer.mediaName}
                mediaType={media?.type ?? 'image'}
              />
            )
          }}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-bus-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--bus-color': color } as CSSProperties) : undefined,
            }
          }}
          renderLeading={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <button
                type="button"
                className="rv-ae-bus-node"
                aria-expanded={open}
                aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                onClick={() => toggle(linkKey)}
              >
                {routes.length ? routes.length : '+'}
              </button>
            )
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <>
                {(open || routes.length > 0) && (
                  <span className={`rv-ae-bus-line${open ? ' is-open' : ''}`} aria-hidden="true" />
                )}
                {open && (
                  <div className="rv-ae-bus-editor">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={effectLabel}
                      parentLabel={parentLabel}
                      showDots
                      bareIntensityLabel
                      pickerLeading={<BusJunctionIcon />}
                      {...editorHandlers(linkKey)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/** Concept — "Preview Deck." Each effect entry reads as a card with a grip
 * handle and a full-width footer bar (expand / preview / chevron) that
 * toggles the route editor. Local route state, comparison only. */
function AddEffectsPreviewDeckConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Preview Deck"
      note="Each effect entry is a card with a grip handle and a footer action bar. The bar toggles the route editor and shows how many parameters are routed. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-deck-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--deck-color': color } as CSSProperties) : undefined,
            }
          }}
          renderLeading={() => <span className="rv-ae-deck-grip" aria-hidden="true" />}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <div className="rv-ae-deck-footer">
                <button
                  type="button"
                  className="rv-ae-deck-bar"
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                  onClick={() => toggle(linkKey)}
                >
                  <span className="rv-ae-deck-bar-label">Route{routes.length ? ` · ${routes.length}` : ''}</span>
                  <span className={`rv-ae-deck-bar-icons${open ? ' is-open' : ''}`}>
                    <DeckExpandGlyph />
                    <DeckPlayGlyph />
                    <span className="rv-ae-deck-chevron"><DeckChevronGlyph /></span>
                  </span>
                </button>
                {open && (
                  <div className="rv-ae-deck-body">
                    <AddEffectsRouteEditor routes={routes} effectLabel={effectLabel} parentLabel={parentLabel} showDots {...editorHandlers(linkKey)} />
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/* ───────────────────────────────────────────────────────────────────────────
   Round two of the Add Effects concept mock-ups. All five share ONE spacing
   scale (the --ae2-* custom properties set on the routing panel) and the same
   three-tier read: Active Media → Effect → Audio Intelligence parameter. They
   differ only in how that hierarchy — and the connection between the tiers —
   is drawn. Every connector below is correct by construction: it is a real
   container edge (a border that spans exactly its content), an element pinned
   to inset:0 of a positioned ancestor, or a tick pinned to top:50% of the row
   it points at. No connector uses a hand-tuned pixel offset.
   ─────────────────────────────────────────────────────────────────────────── */

/** Open/close control shared by the round-two concepts. */
function AE2RouteToggle({ className, open, count, effectLabel, parentLabel, onToggle }: {
  className: string
  open: boolean
  count: number
  effectLabel: string
  parentLabel: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={className}
      aria-expanded={open}
      aria-label={`${count ? 'Edit' : 'Add'} Audio Intelligence routes for ${effectLabel} on ${parentLabel}`}
      onClick={onToggle}
    >
      {count ? `Audio Intelligence · ${count}` : 'Add Audio Intelligence'}
    </button>
  )
}

/** Concept — "Nested Trays." Pure containment: Active Media, each Effect, and
 * that effect's Audio Intelligence parameters are three nested trays — each
 * one indent step deeper, one shade lighter, the same inner padding, a
 * tier-colored left bar. No connector lines, so nothing can misalign. */
function AddEffectsNestedTraysConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Nested Trays"
      note="Active Media, Effect, and Audio Intelligence are three nested trays — each one step deeper, one shade lighter, the same 10px inner padding, a tier-colored left bar. Hierarchy is carried entirely by containment. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-tray-group' })}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-tray-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--tray-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={ctx => {
            const routes = routesFor(ctx.linkKey)
            const open = isOpenFor(ctx.linkKey)
            return (
              <>
                <AE2RouteToggle
                  className="rv-ae-tray-toggle"
                  open={open}
                  count={routes.length}
                  effectLabel={ctx.effectLabel}
                  parentLabel={ctx.parentLabel}
                  onToggle={() => toggle(ctx.linkKey)}
                />
                {open && (
                  <div className="rv-ae-tray-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={ctx.effectLabel}
                      parentLabel={ctx.parentLabel}
                      showDots
                      inlineParamRow
                      {...editorHandlers(ctx.linkKey)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/** Concept — "Tier Chips." No boxes and no lines. Every row carries a
 * fixed-width uppercase tier chip on the left — MEDIA, FX, AI — in the tier
 * color, and each tier steps one indent further right. The chip column keeps
 * the hierarchy legible while scanning a long effect list. */
function AddEffectsTierChipsConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Tier Chips"
      note="No boxes, no lines. Each row gets a fixed-width tier chip on the left — MEDIA, FX, AI — in the tier color, and each tier steps one indent right. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-chip-group' })}
          renderMediaRowLeading={() => <span className="rv-ae-chip rv-ae-chip--media" aria-hidden="true">Media</span>}
          renderLeading={() => <span className="rv-ae-chip rv-ae-chip--fx" aria-hidden="true">FX</span>}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-chip-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--chip-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={ctx => {
            const routes = routesFor(ctx.linkKey)
            const open = isOpenFor(ctx.linkKey)
            return (
              <>
                <button
                  type="button"
                  className={`rv-ae-chip rv-ae-chip--ai rv-ae-chip-toggle${open ? ' is-open' : ''}`}
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} Audio Intelligence routes for ${ctx.effectLabel} on ${ctx.parentLabel}`}
                  onClick={() => toggle(ctx.linkKey)}
                >
                  AI{routes.length ? ` · ${routes.length}` : ' +'}
                </button>
                {open && (
                  <div className="rv-ae-chip-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={ctx.effectLabel}
                      parentLabel={ctx.parentLabel}
                      showDots
                      inlineParamRow
                      {...editorHandlers(ctx.linkKey)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/** Concept — "Trunk Line." A two-level tree whose every trunk is a real
 * container border, so it always spans exactly its children: the group's
 * left border carries the effects; an open effect's left border carries its
 * parameters. Each child row ticks off its trunk at the row's vertical
 * centre. Nothing is positioned by a guessed offset. */
function AddEffectsTrunkLineConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Trunk Line"
      note="A two-level tree where every trunk is a real container edge — the group border carries the effects, an open effect's border carries its parameters — so a trunk always spans exactly its children. Each row ticks off its trunk at the row's centre. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-trunk-group' })}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-trunk-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--trunk-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={ctx => {
            const routes = routesFor(ctx.linkKey)
            const open = isOpenFor(ctx.linkKey)
            return (
              <div className={`rv-ae-trunk-route${open ? ' is-open' : ''}`}>
                <AE2RouteToggle
                  className="rv-ae-trunk-toggle"
                  open={open}
                  count={routes.length}
                  effectLabel={ctx.effectLabel}
                  parentLabel={ctx.parentLabel}
                  onToggle={() => toggle(ctx.linkKey)}
                />
                {open && (
                  <div className="rv-ae-trunk-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={ctx.effectLabel}
                      parentLabel={ctx.parentLabel}
                      showDots
                      inlineParamRow
                      {...editorHandlers(ctx.linkKey)}
                    />
                  </div>
                )}
              </div>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/** Concept — "Spine & Dots." One spine runs the full height of the group
 * (pinned to its top and bottom, so it can never fall short). Active Media
 * and each Effect ride the spine as a dot pinned to their row's centre — big
 * filled for media, medium for an effect. Parameters sit indented off the
 * spine as small leaf bullets. No branching lines. */
function AddEffectsSpineDotsConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Spine & Dots"
      note="One spine spans the full group height (pinned top-to-bottom). Active Media and each Effect ride it as a dot pinned to their row's centre; parameters sit indented as leaf bullets. No branching lines. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-spine-group' })}
          getMediaRowExtra={() => ({ className: 'rv-ae-spine-row rv-ae-spine-row--media' })}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-spine-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--spine-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={ctx => {
            const routes = routesFor(ctx.linkKey)
            const open = isOpenFor(ctx.linkKey)
            return (
              <>
                <AE2RouteToggle
                  className="rv-ae-spine-toggle"
                  open={open}
                  count={routes.length}
                  effectLabel={ctx.effectLabel}
                  parentLabel={ctx.parentLabel}
                  onToggle={() => toggle(ctx.linkKey)}
                />
                {open && (
                  <div className="rv-ae-spine-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={ctx.effectLabel}
                      parentLabel={ctx.parentLabel}
                      inlineParamRow
                      {...editorHandlers(ctx.linkKey)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

/** Concept — "Numbered Steps." A left gutter numbers each effect 1, 2, 3…
 * The number sits at a shared offset (--ae2-num-top) and the connecting line
 * is capped to that same offset, so the line always meets the number. An
 * open effect's line runs on down beside its parameter list. */
function AddEffectsNumberedStepsConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Numbered Steps"
      note="A left gutter numbers each effect. The number and the connecting line share one offset constant, so the line always meets the number; an open effect's line continues beside its parameter list. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={() => ({ className: 'rv-ae-steps-group' })}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            const open = isOpenFor(linkKey)
            return {
              className: `rv-ae-steps-entry${open ? ' is-open' : ''}${color ? ' is-linked' : ''}`,
              style: color ? ({ '--steps-color': color } as CSSProperties) : undefined,
            }
          }}
          renderLeading={ctx => <span className="rv-ae-steps-num" aria-hidden="true">{ctx.effectIndex + 1}</span>}
          renderRoute={ctx => {
            const routes = routesFor(ctx.linkKey)
            const open = isOpenFor(ctx.linkKey)
            return (
              <>
                <AE2RouteToggle
                  className="rv-ae-steps-toggle"
                  open={open}
                  count={routes.length}
                  effectLabel={ctx.effectLabel}
                  parentLabel={ctx.parentLabel}
                  onToggle={() => toggle(ctx.linkKey)}
                />
                {open && (
                  <div className="rv-ae-steps-panel">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={ctx.effectLabel}
                      parentLabel={ctx.parentLabel}
                      showDots
                      {...editorHandlers(ctx.linkKey)}
                    />
                  </div>
                )}
              </>
            )
          }}
        />
      )}
    </ConceptGroup>
  )
}

function ReactMockup({ state }: { state: CanvasMockState }) {
  return (
    <WorkspaceBody>
      <PanelSubtabs value={state.reactSurface} options={[{ id: 'routing', label: 'ROUTING' }, { id: 'analysis', label: 'ANALYSIS' }]} onChange={state.setReactSurface} ariaLabel="Canvas react surfaces" />
      {state.reactSurface === 'routing' ? (
        <div className="rv-ctrl-group" data-layout-lab-canvas="routing">
          <AddEffectsControls state={state} />
          <AddEffectsHighlightWashConcept state={state} />
          <AddEffectsBlueprintBusConcept state={state} />
          <AddEffectsPreviewDeckConcept state={state} />
          <AddEffectsNestedTraysConcept state={state} />
          <AddEffectsTierChipsConcept state={state} />
          <AddEffectsTrunkLineConcept state={state} />
          <AddEffectsSpineDotsConcept state={state} />
          <AddEffectsNumberedStepsConcept state={state} />
        </div>
      ) : <AnalysisMockup />}
    </WorkspaceBody>
  )
}

function RecordingMockup({ state }: { state: CanvasMockState }) {
  if (state.isFractures) {
    return (
      <div className="rv-layout-lab-canvas-output-unavailable" data-layout-lab-canvas="fractures-output">
        <strong>Fractures recording is unavailable</strong>
        <p>The effective Fractures renderer is active for preview and performance, but capture is intentionally disabled in the current MVP.</p>
        <button type="button" disabled>Recording unavailable</button>
      </div>
    )
  }
  return (
    <div className="rv-layout-lab-canvas-recording" data-layout-lab-canvas="recording">
      <div className="rv-canvas-engine-note">Local presentation only. Layout Lab does not read a canvas, create MediaRecorder, or save files.</div>
      <SelectRow label="Frame Rate" value={String(state.recordingFps)} onChange={value => state.setRecordingFps(value === '30' ? 30 : 60)} options={[{ value: '30', label: '30 FPS' }, { value: '60', label: '60 FPS' }]} />
      <button type="button" className={state.recordingActive ? 'rv-layout-lab-canvas-record is-active' : 'rv-layout-lab-canvas-record'} aria-pressed={state.recordingActive} onClick={() => state.setRecordingActive(!state.recordingActive)}>{state.recordingActive ? 'Stop Recording Mock' : 'Start Recording Mock'}</button>
      <button type="button" className="rv-layout-lab-canvas-command" onClick={state.exportPngMock}>PNG Frame</button>
      {state.recordingRevision > 0 && <div className="rv-canvas-engine-note" role="status">PNG frame simulation {state.recordingRevision} completed locally.</div>}
    </div>
  )
}

function OutputMockup({ state }: { state: CanvasMockState }) {
  return (
    <WorkspaceBody>
      <PanelSubtabs value={state.outputSurface} options={[{ id: 'recording', label: 'RECORDING' }, { id: 'production', label: 'PRODUCTION', disabled: true }]} onChange={state.setOutputSurface} ariaLabel="Canvas output surfaces" />
      <RecordingMockup state={state} />
    </WorkspaceBody>
  )
}

export function CanvasRightRailMockup({ state, onSelectEngine }: { state: CanvasMockState; onSelectEngine: (id: ReactEngineId) => void }) {
  return (
    <>
      <RailTabs tabs={RIGHT_TABS} activeTab={state.rightTab} onChange={state.setRightTab} ariaLabel="Canvas inspector tabs" />
      {state.rightTab === 'presets' && <PresetsMockup state={state} onSelectEngine={onSelectEngine} />}
      {state.rightTab === 'design' && <DesignMockup state={state} />}
      {state.rightTab === 'react' && <ReactMockup state={state} />}
      {state.rightTab === 'output' && <OutputMockup state={state} />}
    </>
  )
}
