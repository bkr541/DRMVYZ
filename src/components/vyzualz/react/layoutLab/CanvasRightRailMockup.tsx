import { useState, type CSSProperties, type ReactNode } from 'react'
import { Delete02Icon } from 'hugeicons-react'
import { RailTabs } from '../../layout/RailTabs'
import { PanelSubtabs } from '../PanelSubtabs'
import { ReactPresetCard } from '../ReactPresetCard'
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
        return (
          <div className="rv-ae-route-param" key={route.parameterId}>
            <div className="rv-ae-route-param-head">
              {showDots && (
                <span
                  className="rv-ae-route-dot"
                  style={{ '--dot-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[route.parameterId] } as CSSProperties}
                  aria-hidden="true"
                />
              )}
              <span className="rv-ae-route-param-name">{label}</span>
              <button
                type="button"
                className="rv-ae-param-trash"
                aria-label={`Remove the route for ${label} · ${effectLabel} on ${parentLabel}`}
                onClick={() => onRemoveParameter(route.parameterId)}
              >
                <Delete02Icon size={12} color="currentColor" />
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
        <SelectRow
          label={routes.length > 0 ? 'Add another parameter' : 'Audio Intelligence Parameter'}
          value=""
          placeholder="Select Parameter…"
          onChange={value => { if (value) onAddParameter(value as CanvasMockAudioIntelligenceParameterId) }}
          options={addOptions}
          menuClassName={showDots ? 'rv-ae-param-menu' : undefined}
        />
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
  return (
    <div
      className={groupExtra?.className ? `rv-canvas-layer-effects-group ${groupExtra.className}` : 'rv-canvas-layer-effects-group'}
      style={groupExtra?.style}
    >
      {/* Which media occupies this slot is decided in the Media Library
          (Performance Pool / active selection) — display-only, styled
          like a real input field for consistency, matching the
          production Add Effects group. */}
      {mediaRowExtra ? <div className={mediaRowExtra.className} style={mediaRowExtra.style}>{mediaRow}</div> : mediaRow}
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
                  style={{ position: 'static' }}
                  aria-label={`Remove ${effectLabel} from ${parentLabel}`}
                  onClick={() => state.removeCanvasLayerEffectAt(layer.mediaId, effectIndex)}
                >
                  <Delete02Icon size={13} color="currentColor" />
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

/** Concept — "Floating Route Orb." A small round trigger sits on its own row
 * below the effect input. Clicking it opens the shared route editor: add one
 * or more Audio Intelligence parameters, each with its own master-intensity
 * slider. Once routed, the orb shows the parameter count and the entry takes
 * the first parameter's color. Local route state, a styling comparison only. */
function AddEffectsFloatingOrbConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<MockRouteMap>({})

  return (
    <Collapsible label="Add Effects — Floating Route Orb" defaultOpen={false}>
      <div className="rv-canvas-engine-note">The route orb sits on its own row below the effect input. Click it to open the parameter editor — add several Audio Intelligence parameters, each with a master-intensity slider for that effect + parameter combination. Concept only.</div>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to preview this concept.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-orb-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--orb-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = links[linkKey] ?? []
            const isOpen = expanded[linkKey] ?? routes.length > 0
            return (
              <div className="rv-ae-orb-footer">
                <div className="rv-ae-orb-row">
                  <button
                    type="button"
                    className="rv-ae-orb-trigger"
                    aria-expanded={isOpen}
                    aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                    onClick={() => setExpanded(current => ({ ...current, [linkKey]: !isOpen }))}
                  >
                    {routes.length ? routes.length : '+'}
                  </button>
                </div>
                {isOpen && (
                  <div className="rv-ae-orb-picker">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={effectLabel}
                      parentLabel={parentLabel}
                      showDots
                      onAddParameter={id => setLinks(current => withRouteParam(current, linkKey, id))}
                      onRemoveParameter={id => setLinks(current => withoutRouteParam(current, linkKey, id))}
                      onSetIntensity={(id, value) => setLinks(current => withRouteIntensity(current, linkKey, id, value))}
                    />
                  </div>
                )}
              </div>
            )
          }}
        />
      ))}
    </Collapsible>
  )
}

/** Concept — "Connector Line." A dashed "+ Route" trigger opens the shared
 * route editor. Routing keeps its patch-cable identity through the effect
 * input's own bottom border and value text taking the first parameter's
 * color; the editor holds the multi-parameter list and per-parameter
 * master-intensity sliders. Local route state, comparison only. */
function AddEffectsConnectorLineConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<MockRouteMap>({})

  return (
    <Collapsible label="Add Effects — Connector Line" defaultOpen={false}>
      <div className="rv-canvas-engine-note">"+ Route" sits centered on the row. Once routed, the effect input's bottom border and value text take the first parameter's color and the editor drops in below — add parameters, set a master-intensity slider per effect + parameter combination. Concept only.</div>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to preview this concept.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-line-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--line-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = links[linkKey] ?? []
            const isOpen = expanded[linkKey] ?? routes.length > 0
            return (
              <div className="rv-ae-line-footer">
                <div className="rv-ae-line-route">
                  <button
                    type="button"
                    className="rv-ae-line-trigger"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(current => ({ ...current, [linkKey]: !isOpen }))}
                  >
                    {routes.length ? `Routes · ${routes.length}` : '+ Route'}
                  </button>
                </div>
                {isOpen && (
                  <div className="rv-ae-line-body">
                    <AddEffectsRouteEditor
                      routes={routes}
                      effectLabel={effectLabel}
                      parentLabel={parentLabel}
                      showDots
                      onAddParameter={id => setLinks(current => withRouteParam(current, linkKey, id))}
                      onRemoveParameter={id => setLinks(current => withoutRouteParam(current, linkKey, id))}
                      onSetIntensity={(id, value) => setLinks(current => withRouteIntensity(current, linkKey, id, value))}
                    />
                  </div>
                )}
              </div>
            )
          }}
        />
      ))}
    </Collapsible>
  )
}

/** Concept — "Highlight Wash." A leading equalizer-bars icon (before the
 * effect dropdown) toggles the shared route editor. Routing washes the whole
 * entry's background in the first parameter's color and tints the Active
 * Media select's bottom border to match — the boldest treatment, for
 * scanning a long effect list. Local route state, comparison only. */
function AddEffectsHighlightWashConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<MockRouteMap>({})

  return (
    <Collapsible label="Add Effects — Highlight Wash" defaultOpen={false}>
      <div className="rv-canvas-engine-note">Routing a parameter washes the entry, colors the Active Media select's bottom border to match, and swaps the leading trigger for a checkmark. The editor holds the multi-parameter list and a master-intensity slider per effect + parameter combination. Concept only.</div>
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

/** Deterministic red / amber / green / cyan / violet outline per stacked row,
 * used by Rack Group until a routed parameter supplies its own color. */
const RACK_FALLBACK_COLORS = ['#ff5f6d', '#ffd75f', '#8dff5f', '#5fe0ff', '#c95fff']

function rackReqId(linkKey: string): string {
  let hash = 7
  for (const character of linkKey) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return `REQ-OPE-${Math.abs(hash) % 90_000_000 + 10_000_000}`
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
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-bus-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--bus-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <>
                <button
                  type="button"
                  className="rv-ae-bus-node"
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                  onClick={() => toggle(linkKey)}
                >
                  {routes.length ? routes.length : '+'}
                </button>
                {(open || routes.length > 0) && <span className="rv-ae-bus-line" aria-hidden="true" />}
                {open && (
                  <div className="rv-ae-bus-editor">
                    <AddEffectsRouteEditor routes={routes} effectLabel={effectLabel} parentLabel={parentLabel} showDots bareIntensityLabel {...editorHandlers(linkKey)} />
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

/** Concept — "Signal Break." One framed panel wraps the Active Media and
 * Select Effect dropdowns; picking an effect grows it downward to reveal the
 * broken-tail pill route trigger and its editor. Local route state. */
function AddEffectsSignalBreakConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Signal Break"
      note="A single framed panel wraps the Active Media dropdown and the Select Effect dropdown; picking an effect expands the panel downward to reveal a broken-tail pill route trigger and, once opened, the parameter editor. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getGroupExtra={groupLayer => {
            const linkedColor = groupLayer.effects
              .map(effectId => firstRouteColor(links[canvasEffectAudioLinkKey(groupLayer.mediaId, effectId)]))
              .find((candidate): candidate is string => Boolean(candidate))
            return {
              className: `rv-ae-break-group${linkedColor ? ' is-linked' : ''}`,
              style: linkedColor ? ({ '--break-color': linkedColor } as CSSProperties) : undefined,
            }
          }}
          getEntryExtra={({ linkKey }) => {
            const color = firstRouteColor(links[linkKey])
            return {
              className: `rv-ae-break-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--break-color': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <div className="rv-ae-break-route">
                <button
                  type="button"
                  className={`rv-ae-break-trigger${routes.length ? ' is-linked' : ''}`}
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                  onClick={() => toggle(linkKey)}
                >
                  <span className="rv-ae-break-dot" aria-hidden="true" />
                  {routes.length ? `Signal · ${routes.length} route${routes.length === 1 ? '' : 's'}` : '+ Route signal'}
                  <span className="rv-ae-break-tail" aria-hidden="true" />
                </button>
                {open && (
                  <div className="rv-ae-break-editor">
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

/** Concept — "Accent Stack." A colored left accent rail marks a routed effect;
 * a square badge trigger opens the editor and a category-style subtitle
 * summarises it. Local route state, comparison only. */
function AddEffectsAccentStackConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Accent Stack"
      note="A colored left accent rail marks a routed effect. The square badge opens the editor; a subtitle summarises how many parameters are routed. Concept only."
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
              className: `rv-ae-accent-entry${color ? ' is-linked' : ''}`,
              style: color ? ({ '--accent-c': color } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <div className="rv-ae-accent-footer">
                <button
                  type="button"
                  className={`rv-ae-accent-trigger${routes.length ? ' is-linked' : ''}`}
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                  onClick={() => toggle(linkKey)}
                >
                  <span className="rv-ae-accent-badge" aria-hidden="true">{routes.length ? routes.length : '+'}</span>
                  <span className="rv-ae-accent-sub">
                    {routes.length ? `${routes.length} route${routes.length === 1 ? '' : 's'} · Audio Intelligence` : 'Route Audio Intelligence'}
                  </span>
                </button>
                {open && (
                  <div className="rv-ae-accent-body">
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

/** Concept — "Rack Group." The Active Media row becomes a dark rack header and
 * each effect sits in its own outlined rack row with a request-id pill trigger
 * and an orange typed connector into its editor. Local route state. */
function AddEffectsRackGroupConcept({ state }: { state: CanvasMockState }) {
  const { links, routesFor, isOpenFor, toggle, editorHandlers } = useConceptRoutes()
  return (
    <ConceptGroup
      state={state}
      label="Add Effects — Rack Group"
      note="The Active Media row is a dark rack header; each effect is an outlined rack row with a request-id pill trigger and an orange typed connector into its editor. Concept only."
    >
      {(layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          getMediaRowExtra={() => ({ className: 'rv-ae-rack-header' })}
          getEntryExtra={({ effectIndex, linkKey }) => {
            const routed = firstRouteColor(links[linkKey])
            const color = routed ?? RACK_FALLBACK_COLORS[effectIndex % RACK_FALLBACK_COLORS.length]
            return {
              className: `rv-ae-rack-row${routed ? ' is-linked' : ''}`,
              style: { '--rack-color': color } as CSSProperties,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const routes = routesFor(linkKey)
            const open = isOpenFor(linkKey)
            return (
              <div className="rv-ae-rack-foot">
                <button
                  type="button"
                  className={`rv-ae-rack-trigger${routes.length ? ' is-linked' : ''}`}
                  aria-expanded={open}
                  aria-label={`${routes.length ? 'Edit' : 'Add'} routes for ${effectLabel} on ${parentLabel}`}
                  onClick={() => toggle(linkKey)}
                >
                  <span className="rv-ae-rack-badge" aria-hidden="true">{routes.length ? routes.length : '+'}</span>
                  <span className="rv-ae-rack-meta">{rackReqId(linkKey)}</span>
                </button>
                {open && (
                  <div className="rv-ae-rack-body">
                    <span className="rv-ae-rack-connector" aria-hidden="true" />
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

function ReactMockup({ state }: { state: CanvasMockState }) {
  return (
    <WorkspaceBody>
      <PanelSubtabs value={state.reactSurface} options={[{ id: 'routing', label: 'ROUTING' }, { id: 'analysis', label: 'ANALYSIS' }]} onChange={state.setReactSurface} ariaLabel="Canvas react surfaces" />
      {state.reactSurface === 'routing' ? (
        <div className="rv-ctrl-group" data-layout-lab-canvas="routing">
          <AddEffectsControls state={state} />
          <AddEffectsFloatingOrbConcept state={state} />
          <AddEffectsConnectorLineConcept state={state} />
          <AddEffectsHighlightWashConcept state={state} />
          <AddEffectsBlueprintBusConcept state={state} />
          <AddEffectsSignalBreakConcept state={state} />
          <AddEffectsPreviewDeckConcept state={state} />
          <AddEffectsAccentStackConcept state={state} />
          <AddEffectsRackGroupConcept state={state} />
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
