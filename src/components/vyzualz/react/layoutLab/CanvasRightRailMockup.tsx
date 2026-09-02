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
  canvasEffectAudioLinkKey,
  type CanvasMockAudioIntelligenceParameterId,
  type CanvasMockLayerRole,
  type CanvasMockState,
} from './useCanvasMockState'

/** "Remove route" icon — a broken chain link with a no-entry badge, matching
 * the placement/sizing of the trashcan used to remove an effect. Rendered
 * inline (rather than pulled from hugeicons-react) since it's a one-off
 * user-supplied glyph; fill is currentColor so its button controls the tint. */
function RouteRemoveIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M275.084,157.24c0.109,0.031,0.219,0.109,0.375,0.156l83.063-83.109c5.141-5.063,10.922-8.844,17.156-11.344
		c9.328-3.781,19.641-4.797,29.438-2.844c9.859,1.906,19.094,6.563,26.75,14.188c5.125,5.141,8.875,10.953,11.422,17.188
		c3.75,9.313,4.734,19.625,2.828,29.453c-1.922,9.813-6.578,19.078-14.25,26.75L315.74,263.803
		c-5.125,5.125-10.938,8.875-17.125,11.422c-9.344,3.766-19.672,4.703-29.484,2.813c-9.828-1.922-19.078-6.578-26.734-14.234
		c-4.156-4.172-7.391-8.75-9.813-13.672c-0.266-0.047-0.531-0.141-0.781-0.172c-5.719-1.078-11.828-0.469-17.172,1.75
		c-3.734,1.547-7.063,3.781-9.984,6.719l-1.656,1.688c-8.688,10.531-15.5,25.406-1.828,44.984
		c10.688,10.703,23.172,18.797,36.438,24.172c19.938,8.094,41.672,10.078,62.5,6.047c20.797-4,40.828-14.172,56.922-30.281
		l116.109-116.109c10.703-10.703,18.828-23.172,24.203-36.453c8.078-19.953,10.094-41.672,6.078-62.5
		c-4.031-20.797-14.203-40.844-30.281-56.922c-10.719-10.688-23.172-18.813-36.469-24.172c-19.938-8.109-41.672-10.094-62.5-6.078
		c-20.797,4.016-40.828,14.172-56.891,30.25L201.131,149.209c-0.438,0.406-0.828,0.859-1.266,1.328
		c0.141-0.047,0.328-0.094,0.469-0.094C225.443,145.412,251.287,147.756,275.084,157.24z" />
      <path d="M230.35,349.74c-0.125-0.078-0.25-0.109-0.391-0.172l-83.063,83.078c-5.141,5.125-10.922,8.891-17.156,11.375
		c-9.328,3.797-19.641,4.797-29.453,2.875c-9.844-1.922-19.094-6.594-26.75-14.25c-5.125-5.109-8.875-10.922-11.406-17.141
		c-3.75-9.297-4.75-19.656-2.828-29.438c1.922-9.844,6.594-19.094,14.234-26.734l116.141-116.172
		c5.125-5.109,10.922-8.844,17.125-11.375c9.313-3.828,19.656-4.75,29.484-2.859c9.828,1.938,19.047,6.594,26.734,14.234
		c4.156,4.141,7.391,8.781,9.813,13.703c0.266,0.047,0.531,0.109,0.781,0.172c5.703,1.047,11.844,0.438,17.156-1.766
		c3.734-1.563,7.078-3.828,9.969-6.75l1.688-1.672c8.641-10.516,15.484-25.422,1.828-44.984
		c-10.719-10.672-23.172-18.766-36.469-24.172c-19.922-8.063-41.641-10.063-62.469-6.063c-20.797,4.031-40.844,14.219-56.922,30.297
		L32.271,318.053c-10.719,10.703-18.813,23.156-24.188,36.438c-8.109,20-10.094,41.688-6.078,62.516
		c4.016,20.797,14.203,40.844,30.266,56.922C42.99,484.6,55.443,492.725,68.74,498.131c19.953,8.063,41.656,10.109,62.5,6.063
		c20.797-4,40.844-14.188,56.891-30.266l116.156-116.172c0.406-0.406,0.813-0.875,1.25-1.266c-0.156,0-0.328,0.047-0.469,0.047
		C279.959,361.537,254.131,359.225,230.35,349.74z" />
      <path d="M416.365,319.912c-52.797,0-95.609,42.844-95.609,95.625c0,52.813,42.813,95.672,95.609,95.672
		c52.813,0,95.641-42.859,95.641-95.672C512.006,362.756,469.178,319.912,416.365,319.912z M464.99,430.131h-97.234v-29.156h97.234
		V430.131z" />
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

const CANVAS_AUDIO_INTELLIGENCE_PARAMETER_OPTIONS = CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => ({
  value: param.id,
  label: param.label,
}))

// A distinct, vivid hue per Audio Intelligence parameter — used only by the
// alternate Add Effects concepts below, where color is the whole point of
// showing an effect is linked to a parameter (same fill, same outline, same
// connector line). The canonical group above doesn't need this; it says the
// parameter's name in words instead.
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

/** Small neutral chain-link glyph for the "Outline Glow" concept's route
 * trigger — distinct from RouteRemoveIcon (which is specifically the red
 * "break this link" affordance). Two offset rounded links, currentColor. */
function RouteLinkGlyphIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" aria-hidden="true">
      <path d="M10 14a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.6 6.34" />
      <path d="M14 10a5 5 0 0 0-7.07 0L4.81 12.1a5 5 0 0 0 7.07 7.07L13.4 17.66" />
    </svg>
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
}: {
  state: CanvasMockState
  layer: CanvasMockState['addEffectsLayers'][number]
  layerIndex: number
  renderRoute: (ctx: AddEffectsRouteContext) => ReactNode
  renderLeading?: (ctx: AddEffectsRouteContext) => ReactNode
  getEntryExtra?: (ctx: AddEffectsRouteContext) => { className?: string; style?: CSSProperties }
  getMediaRowExtra?: (layer: CanvasMockState['addEffectsLayers'][number]) => { className?: string; style?: CSSProperties } | undefined
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
  return (
    <div className="rv-canvas-layer-effects-group">
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
                  label={`Effect ${effectIndex + 1} for ${parentLabel}`}
                  labelHidden
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
  const toggleRoute = (key: string) => setExpandedRoutes(current => ({ ...current, [key]: !current[key] }))

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
            const linkedParameterId = state.effectAudioLinks[linkKey]
            const routeExpanded = Boolean(expandedRoutes[linkKey])
            return (
              <>
                <div className="rv-canvas-effect-route-row">
                  <button
                    type="button"
                    className="rv-canvas-effect-route-toggle"
                    aria-expanded={routeExpanded}
                    onClick={() => toggleRoute(linkKey)}
                  >
                    {linkedParameterId ? `Route Effect: ${CANVAS_AUDIO_INTELLIGENCE_PARAMETER_LABELS[linkedParameterId]}` : 'Route Effect'}
                  </button>
                </div>
                {routeExpanded && (
                  <div className="rv-canvas-effect-route-panel">
                    <div className="rv-canvas-effect-route-picker-row">
                      <SelectRow
                        label="Audio Intelligence Parameter"
                        value={linkedParameterId ?? ''}
                        placeholder="Select Parameter…"
                        onChange={value => state.setEffectAudioLink(layer.mediaId, effectId, value as CanvasMockAudioIntelligenceParameterId)}
                        options={CANVAS_AUDIO_INTELLIGENCE_PARAMETER_OPTIONS}
                      />
                      {linkedParameterId && (
                        <button
                          type="button"
                          className="rv-canvas-effect-route-remove"
                          aria-label={`Remove the route for ${effectLabel} on ${parentLabel}`}
                          onClick={() => state.unlinkEffectAudioParameter(layer.mediaId, effectId)}
                        >
                          <RouteRemoveIcon size={13} />
                        </button>
                      )}
                    </div>
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

/** Concept — "Floating Route Orb." A small round trigger floats centered on
 * the bottom edge of each effect entry (a classic FAB treatment). Clicking
 * it reveals a horizontal, scrollable strip of colored parameter pills
 * instead of a dropdown — tap a color, done. Once linked, the orb itself
 * fills solid with that parameter's color and the whole entry grows a
 * matching underline, so the orb and the entry visibly read as "the same
 * thing." Full Add Effects authoring (Active Media, Select Effect, add and
 * remove) plus independent local route-link state — a styling comparison,
 * not wired to the canonical group above. */
function AddEffectsFloatingOrbConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<Record<string, CanvasMockAudioIntelligenceParameterId>>({})

  return (
    <Collapsible label="Add Effects — Floating Route Orb" defaultOpen={false}>
      <div className="rv-canvas-engine-note">A route orb floats on the bottom edge of each effect entry. Click it for a strip of colored parameters — picking one fills the orb and underlines the whole entry to match. Concept only.</div>
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
            const linkedId = links[linkKey]
            return {
              className: `rv-ae-orb-entry${linkedId ? ' is-linked' : ''}`,
              style: linkedId ? ({ '--orb-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const linkedId = links[linkKey]
            const isOpen = Boolean(expanded[linkKey])
            return (
              <>
                <div className="rv-ae-orb-anchor">
                  <button
                    type="button"
                    className="rv-ae-orb-trigger"
                    aria-expanded={isOpen}
                    aria-label={`${linkedId ? 'Change' : 'Add'} route for ${effectLabel} on ${parentLabel}`}
                    onClick={() => setExpanded(current => ({ ...current, [linkKey]: !current[linkKey] }))}
                  >
                    {linkedId ? '' : '+'}
                  </button>
                </div>
                {isOpen && (
                  <div className="rv-ae-orb-strip">
                    {CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => (
                      <button
                        key={param.id}
                        type="button"
                        className={`rv-ae-orb-pill${linkedId === param.id ? ' is-active' : ''}`}
                        style={{ '--pill-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[param.id] } as CSSProperties}
                        onClick={() => {
                          setLinks(current => ({ ...current, [linkKey]: param.id }))
                          setExpanded(current => ({ ...current, [linkKey]: false }))
                        }}
                      >
                        {param.label}
                      </button>
                    ))}
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

/** Concept — "Outline Glow." A neutral chain-link button beside each effect
 * opens a vertical list of parameters, each with its own color dot. Linking
 * one wraps the *whole effect entry* in a soft glowing outline tinted to
 * that exact color — the link reads as "this entry belongs to that color,"
 * not just a small badge. Full Add Effects authoring plus independent local
 * route-link state, comparison only. */
function AddEffectsOutlineGlowConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<Record<string, CanvasMockAudioIntelligenceParameterId>>({})

  return (
    <Collapsible label="Add Effects — Outline Glow" defaultOpen={false}>
      <div className="rv-canvas-engine-note">A chain-link button opens a parameter list. Linking one wraps that effect's whole entry in a soft glowing outline in the parameter's color. Concept only.</div>
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
            const linkedId = links[linkKey]
            return {
              className: `rv-ae-glow-entry${linkedId ? ' is-linked' : ''}`,
              style: linkedId ? ({ '--glow-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties) : undefined,
            }
          }}
          renderRoute={({ effectLabel, parentLabel, linkKey }) => {
            const linkedId = links[linkKey]
            const isOpen = Boolean(expanded[linkKey])
            return (
              <div className="rv-ae-glow-footer">
                <button
                  type="button"
                  className="rv-ae-glow-link-btn"
                  aria-expanded={isOpen}
                  aria-label={`${linkedId ? 'Change' : 'Add'} route for ${effectLabel} on ${parentLabel}`}
                  onClick={() => setExpanded(current => ({ ...current, [linkKey]: !current[linkKey] }))}
                >
                  <RouteLinkGlyphIcon />
                  {linkedId ? CANVAS_AUDIO_INTELLIGENCE_PARAMETER_LABELS[linkedId] : 'Route Effect'}
                </button>
                {isOpen && (
                  <div className="rv-ae-glow-list">
                    {CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => (
                      <button
                        key={param.id}
                        type="button"
                        className="rv-ae-glow-option"
                        aria-pressed={linkedId === param.id}
                        onClick={() => {
                          setLinks(current => ({ ...current, [linkKey]: param.id }))
                          setExpanded(current => ({ ...current, [linkKey]: false }))
                        }}
                      >
                        <span className="rv-ae-glow-dot" style={{ '--dot-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[param.id] } as CSSProperties} />
                        {param.label}
                      </button>
                    ))}
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

/** Concept — "Connector Line." A text "+ Route" trigger opens a tight grid
 * of colored pads (VJ pad-grid styling). Once linked, a short colored line
 * literally draws from the trigger to a tag chip carrying the parameter's
 * name — a miniature patch cable rather than a badge or an outline. Full Add
 * Effects authoring plus independent local route-link state, comparison
 * only. */
function AddEffectsConnectorLineConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<Record<string, CanvasMockAudioIntelligenceParameterId>>({})

  return (
    <Collapsible label="Add Effects — Connector Line" defaultOpen={false}>
      <div className="rv-canvas-engine-note">"+ Route" sits centered on the row. Picking a parameter from the column below draws a short vertical line down to its tag. Concept only.</div>
      {state.addEffectsLayers.length === 0 && (
        <div className="rv-canvas-engine-note">Add media to the Performance Pool (Design tab) or select an active media item to preview this concept.</div>
      )}
      {state.addEffectsLayers.map((layer, layerIndex) => (
        <AddEffectsLayerGroup
          key={layer.mediaId}
          state={state}
          layer={layer}
          layerIndex={layerIndex}
          renderRoute={({ linkKey }) => {
            const linkedId = links[linkKey]
            const isOpen = Boolean(expanded[linkKey])
            return (
              <div className="rv-ae-line-footer">
                <div className="rv-ae-line-route">
                  <button
                    type="button"
                    className="rv-ae-line-trigger"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(current => ({ ...current, [linkKey]: !current[linkKey] }))}
                  >
                    {linkedId ? 'Change Route' : '+ Route'}
                  </button>
                </div>
                {linkedId && (
                  <div className="rv-ae-line-tag-stack">
                    <span className="rv-ae-line-connector" style={{ '--line-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties} aria-hidden="true" />
                    <span className="rv-ae-line-tag" style={{ '--tag-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties}>
                      {CANVAS_AUDIO_INTELLIGENCE_PARAMETER_LABELS[linkedId]}
                    </span>
                  </div>
                )}
                {isOpen && (
                  <div className="rv-ae-line-column">
                    {CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => (
                      <button
                        key={param.id}
                        type="button"
                        className={`rv-ae-line-option${linkedId === param.id ? ' is-active' : ''}`}
                        style={{ '--swatch-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[param.id] } as CSSProperties}
                        onClick={() => {
                          setLinks(current => ({ ...current, [linkKey]: param.id }))
                          setExpanded(current => ({ ...current, [linkKey]: false }))
                        }}
                      >
                        {param.label}
                      </button>
                    ))}
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
 * Select Effect dropdown, not after — the odd one out on purpose) opens a
 * segmented row of parameter chips. Linking one washes the *entire entry's
 * background* in a soft tint of that color — the boldest of the four link
 * treatments, meant for scanning a long list of effects at a glance. Full
 * Add Effects authoring plus independent local route-link state, comparison
 * only. */
function AddEffectsHighlightWashConcept({ state }: { state: CanvasMockState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [links, setLinks] = useState<Record<string, CanvasMockAudioIntelligenceParameterId>>({})

  return (
    <Collapsible label="Add Effects — Highlight Wash" defaultOpen={false}>
      <div className="rv-canvas-engine-note">Linking a parameter washes the entry, colors the Active Media select's bottom border to match, drops a vertical line down to it, and swaps the trigger for a matching checkmark. Concept only.</div>
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
            // First linked effect under this media item sets the Active
            // Media border color — a layer usually carries one linked
            // effect in this demo, and "first found" is a reasonable,
            // simple tie-break when it carries more.
            const linkedId = mediaLayer.effects
              .map(effectId => links[canvasEffectAudioLinkKey(mediaLayer.mediaId, effectId)])
              .find((value): value is CanvasMockAudioIntelligenceParameterId => Boolean(value))
            return {
              className: `rv-ae-wash-media-row${linkedId ? ' is-linked' : ''}`,
              style: linkedId ? ({ '--wash-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties) : undefined,
            }
          }}
          getEntryExtra={({ linkKey }) => {
            const linkedId = links[linkKey]
            return {
              className: `rv-ae-wash-entry${linkedId ? ' is-linked' : ''}`,
              style: linkedId ? ({ '--wash-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] } as CSSProperties) : undefined,
            }
          }}
          renderLeading={({ effectLabel, parentLabel, linkKey }) => {
            const linkedId = links[linkKey]
            const color = linkedId ? CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[linkedId] : undefined
            return (
              <>
                {linkedId && <span className="rv-ae-wash-connector" style={{ '--wash-color': color } as CSSProperties} aria-hidden="true" />}
                <button
                  type="button"
                  className={`rv-ae-wash-trigger${linkedId ? ' is-linked' : ''}`}
                  style={color ? ({ '--wash-color': color } as CSSProperties) : undefined}
                  aria-expanded={Boolean(expanded[linkKey])}
                  aria-label={`${linkedId ? 'Change' : 'Add'} route for ${effectLabel} on ${parentLabel}`}
                  onClick={() => setExpanded(current => ({ ...current, [linkKey]: !current[linkKey] }))}
                >
                  {linkedId ? <RouteCheckGlyphIcon /> : <RouteWaveGlyphIcon />}
                </button>
              </>
            )
          }}
          renderRoute={({ linkKey }) => {
            if (!expanded[linkKey]) return null
            const linkedId = links[linkKey]
            return (
              <div className="rv-ae-wash-segmented">
                {CANVAS_AUDIO_INTELLIGENCE_PARAMETERS.map(param => (
                  <button
                    key={param.id}
                    type="button"
                    className={`rv-ae-wash-chip${linkedId === param.id ? ' is-active' : ''}`}
                    style={{ '--chip-color': CANVAS_AUDIO_INTELLIGENCE_PARAMETER_COLORS[param.id] } as CSSProperties}
                    onClick={() => {
                      setLinks(current => ({ ...current, [linkKey]: param.id }))
                      setExpanded(current => ({ ...current, [linkKey]: false }))
                    }}
                  >
                    {param.label}
                  </button>
                ))}
              </div>
            )
          }}
        />
      ))}
    </Collapsible>
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
          <AddEffectsOutlineGlowConcept state={state} />
          <AddEffectsConnectorLineConcept state={state} />
          <AddEffectsHighlightWashConcept state={state} />
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
