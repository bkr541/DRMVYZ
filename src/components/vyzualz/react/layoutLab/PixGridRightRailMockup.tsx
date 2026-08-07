import { useMemo, useState, type ReactNode } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { RecordingPanel } from '../../recording/RecordingPanel'
import type { RecorderState, RecordingMode } from '../../../../hooks/useRecorder'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import {
  Collapsible,
  ColorRow,
  CtrlSection,
  NumberInputRow,
  SelectRow,
  SliderRow,
  TextInputRow,
  ToggleRow,
} from '../ReactControlRows'
import { PanelSubtabs, type PanelSubtabOption } from '../PanelSubtabs'
import { ReactPresetCard } from '../ReactPresetCard'
import type { ReactEngineId } from '../ReactTypes'
import type {
  PixGridMockDesignSurface,
  PixGridMockPreset,
  PixGridMockReactSurface,
  PixGridMockRoute,
  PixGridMockRouteKind,
  PixGridMockState,
  PixGridMockTargetScope,
} from './usePixGridMockState'

type RightTab = 'presets' | 'design' | 'react' | 'output'
type OutputSurface = 'recording' | 'production'

const RIGHT_TABS: RailTabOption<RightTab>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

const DESIGN_SURFACES: Array<PanelSubtabOption<PixGridMockDesignSurface>> = [
  { id: 'grid', label: 'Grid' },
  { id: 'scene', label: 'Scene' },
  { id: 'layer', label: 'Layer' },
  { id: 'selection', label: 'Selection' },
  { id: 'tool', label: 'Tool' },
]

const REACT_SURFACES: Array<PanelSubtabOption<PixGridMockReactSurface>> = [
  { id: 'routing', label: 'ROUTING' },
  { id: 'events', label: 'EVENTS' },
  { id: 'choreography', label: 'CHOREOGRAPHY' },
  { id: 'analysis', label: 'ANALYSIS' },
]

const QUALITY_OPTIONS = [
  { value: 'draft', label: 'Draft · 64 × 36' },
  { value: 'balanced', label: 'Balanced · 96 × 54' },
  { value: 'high', label: 'High · 160 × 90' },
  { value: 'ultra', label: 'Ultra · 256 × 144' },
]

const TOOL_OPTIONS = [
  { value: 'select', label: 'Select' },
  { value: 'pan', label: 'Pan' },
  { value: 'pencil', label: 'Pencil' },
  { value: 'eraser', label: 'Eraser' },
  { value: 'fill', label: 'Fill' },
  { value: 'eyedropper', label: 'Eyedropper' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'line', label: 'Line' },
  { value: 'marquee', label: 'Marquee' },
  { value: 'move', label: 'Move Selection' },
]

const SOURCE_OPTIONS = [
  { value: 'Bass', label: 'Bass' },
  { value: 'Energy', label: 'Energy' },
  { value: 'Phrase Progress', label: 'Phrase Progress' },
  { value: 'Kick', label: 'Kick' },
  { value: 'Snare Hit', label: 'Snare Hit' },
  { value: 'Beat', label: 'Beat' },
  { value: 'Downbeat', label: 'Downbeat' },
  { value: 'Four Bars', label: 'Four Bars' },
  { value: 'Section Boundary', label: 'Section Boundary' },
  { value: 'Semantic Moment', label: 'Semantic Moment · optional' },
]

const TARGET_SCOPE_OPTIONS = [
  { value: 'output', label: 'Output' },
  { value: 'scene', label: 'Scene' },
  { value: 'layer', label: 'Layer' },
  { value: 'group', label: 'Smart group mask' },
  { value: 'background', label: 'Background' },
  { value: 'transition', label: 'Transition' },
  { value: 'palette', label: 'Palette' },
]

const OPERATION_OPTIONS = [
  { value: 'Intensity', label: 'Intensity' },
  { value: 'Brightness', label: 'Brightness' },
  { value: 'Motion', label: 'Motion' },
  { value: 'Glow', label: 'Glow' },
  { value: 'Opacity', label: 'Opacity' },
  { value: 'Flash', label: 'Flash' },
  { value: 'Transition', label: 'Transition' },
  { value: 'Palette Shift', label: 'Palette Shift' },
]

const SECTION_OPTIONS = ['All sections', 'Intro', 'Verse', 'Build', 'Pre Drop', 'Drop', 'Breakdown', 'Bridge', 'Outro']
  .map(value => ({ value, label: value }))

const PHRASE_SEGMENT_OPTIONS = ['Any phrase segment', 'Entry', 'Early', 'Middle', 'Late', 'Exit']
  .map(value => ({ value, label: value }))

const CROSS_ENGINE_PRESET_GROUPS: Array<{
  engineId: Exclude<ReactEngineId, 'shaderPads' | 'pixGrid'>
  label: string
  icon: string
  presetName: string
  description: string
}> = [
  { engineId: 'cinema', label: 'Cinema', icon: '◉', presetName: 'Visual Composition', description: 'Composition-native visual performance engine.' },
  { engineId: 'oscilloscope', label: 'Sound Drawing', icon: '〰', presetName: 'XY Cyan Scope', description: 'Classic cyan scope preset.' },
  { engineId: 'laserDmx', label: 'LaserDMX', icon: '⌬', presetName: 'Beam Matrix', description: 'Beam Matrix look.' },
  { engineId: 'canvas', label: 'CANVAS', icon: '▣', presetName: 'Clean Playback', description: 'Clean uploaded-media playback.' },
]


function PresetThumbnail({ preset }: { preset: PixGridMockPreset }) {
  return (
    <div className="rv-layout-lab-pix-grid-preset-thumb">
      <div className="rv-layout-lab-pixel-matrix" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} style={{ background: preset.palette[index % preset.palette.length] }} />
        ))}
      </div>
    </div>
  )
}

function CrossEnginePresetGroup({
  group,
  onSelectEngine,
}: {
  group: typeof CROSS_ENGINE_PRESET_GROUPS[number]
  onSelectEngine: (id: ReactEngineId) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <div className={`rv-preset-group${collapsed ? ' rv-preset-group--collapsed' : ''}`}>
      <button type="button" className="rv-preset-group-hdr" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>
        <span className="rv-preset-group-hdr-icon" aria-hidden="true">{group.icon}</span>
        <span className="rv-preset-group-hdr-label">{group.label}</span>
        <span className="rv-preset-group-hdr-count">1</span>
        <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
      </button>
      {!collapsed && (
        <div className="rv-preset-group-cards" data-preset-grid>
          <ReactPresetCard
            id={`layout-lab-${group.engineId}-preset`}
            title={group.presetName}
            description={group.description}
            thumbnail={<div className="rv-layout-lab-cross-engine-thumb" aria-hidden="true">{group.icon}</div>}
            chips={[{ label: group.label }]}
            activateLabel={`Load ${group.presetName}`}
            onActivate={() => onSelectEngine(group.engineId)}
          />
        </div>
      )}
    </div>
  )
}

function PresetsTabMockup({ state, onSelectEngine }: { state: PixGridMockState; onSelectEngine: (id: ReactEngineId) => void }) {
  const favoriteCount = state.presets.filter(preset => preset.favorite).length
  const visible = state.presetFilter === 'favorites'
    ? state.presets.filter(preset => preset.favorite)
    : state.presets
  const active = state.presets.find(preset => preset.id === state.activePresetId) ?? null
  const shownCount = visible.length + (state.presetFilter === 'all' ? CROSS_ENGINE_PRESET_GROUPS.length : 0)
  const cards = visible.map(preset => (
    <ReactPresetCard
      key={preset.id}
      id={preset.id}
      title={preset.name}
      description={preset.description}
      thumbnail={<PresetThumbnail preset={preset} />}
      chips={[{ label: 'Music Reactive' }]}
      palette={preset.palette.map(color => ({ color }))}
      isActive={preset.id === state.activePresetId}
      isModified={preset.modified}
      isFavorite={preset.favorite}
      activateLabel={`Load ${preset.name}`}
      onActivate={() => state.selectPreset(preset.id)}
      onToggleFavorite={() => state.togglePresetFavorite(preset.id)}
    />
  ))

  return (
    <div className="rv-workspace-panel">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-presets-panel" data-layout-lab-pix-grid="presets">
            <header className="rv-preset-library-header">
              <div className="rv-preset-library-engine">
                <span aria-hidden="true">▦</span>
                <div>
                  <strong>PixGrid</strong>
                  <small>{state.presetFilter === 'current' ? `${visible.length} presets for the selected engine` : `${shownCount} presets shown`}</small>
                  {active?.modified && <small role="status">Modified from {active.name}</small>}
                </div>
              </div>
              <div className="rv-preset-library-views" role="tablist" aria-label="Preset library filter">
                <button type="button" role="tab" aria-selected={state.presetFilter === 'current'} className={state.presetFilter === 'current' ? 'is-active' : ''} onClick={() => state.setPresetFilter('current')}>Current Engine</button>
                <button type="button" role="tab" aria-selected={state.presetFilter === 'favorites'} className={state.presetFilter === 'favorites' ? 'is-active' : ''} onClick={() => state.setPresetFilter('favorites')}>Favorites{favoriteCount ? ` ${favoriteCount}` : ''}</button>
                <button type="button" role="tab" aria-selected={state.presetFilter === 'all'} className={state.presetFilter === 'all' ? 'is-active' : ''} onClick={() => state.setPresetFilter('all')}>All Engines</button>
              </div>
            </header>

            <p className="rv-presets-hint">
              {state.presetFilter === 'current'
                ? 'PixGrid presets only. Use All Engines to browse other engines.'
                : state.presetFilter === 'favorites'
                  ? 'Star presets from any engine to keep them together here.'
                  : 'Selecting another engine’s preset switches that engine and loads the look.'}
            </p>

            <div className="rv-pix-grid-presets-help drm-help-overlay-anchor">
              {visible.length === 0 ? (
                <div className="rv-preset-library-empty">
                  <strong>No favorite presets yet</strong>
                  <span>Choose ☆ on a preset to pin it here.</span>
                </div>
              ) : state.presetFilter === 'current' ? (
                <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>{cards}</div>
              ) : (
                <>
                  <div className="rv-preset-group">
                    <button type="button" className="rv-preset-group-hdr" aria-expanded="true">
                      <span className="rv-preset-group-hdr-icon" aria-hidden="true">▦</span>
                      <span className="rv-preset-group-hdr-label">PixGrid</span>
                      <span className="rv-preset-group-hdr-count">{visible.length}</span>
                      <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
                    </button>
                    <div className="rv-preset-group-cards" data-preset-grid>{cards}</div>
                  </div>
                  {state.presetFilter === 'all' && CROSS_ENGINE_PRESET_GROUPS.map(group => (
                    <CrossEnginePresetGroup key={group.engineId} group={group} onSelectEngine={onSelectEngine} />
                  ))}
                </>
              )}
              <HelpInfoTrigger
                helpId="react.pixGrid.presetLibrary"
                currentValue={`${active?.name ?? 'No PixGrid preset selected'} · ${state.presetFilter === 'current' ? 'Current Engine' : state.presetFilter === 'favorites' ? 'Favorites' : 'All Engines'} · ${shownCount} shown`}
                currentValueTone={active ? 'accent' : 'default'}
                placement="left"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DesignSection({ label, children }: { label: string; children: ReactNode }) {
  return <><CtrlSection label={label} />{children}</>
}

function EditingContext({ state }: { state: PixGridMockState }) {
  const targetValue = state.selectedLayerId ?? 'scene'
  return (
    <DesignSection label="Editing Context">
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SelectRow
          label="Active Scene"
          value={state.previewSceneMode === 'followTrack' ? 'followTrack' : state.activeScene.id}
          options={[
            { value: 'followTrack', label: 'Follow Track' },
            ...state.scenes.map(scene => ({ value: scene.id, label: scene.name })),
          ]}
          onChange={value => {
            if (value === 'followTrack') state.setPreviewSceneMode('followTrack')
            else {
              state.selectScene(value)
              state.setPreviewSceneMode('selectedScene')
            }
          }}
          description={state.previewSceneMode === 'followTrack' ? 'Track analysis owns the live scene.' : 'Editing Context owns the live preview scene.'}
        />
        <HelpInfoTrigger helpId="react.pixGrid.design.editingContext.activeScene" currentValue={state.previewSceneMode === 'followTrack' ? 'Follow Track' : state.activeScene.name} currentValueTone="accent" placement="left" />
      </div>
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SelectRow
          label="Edit Target"
          value={targetValue}
          options={[
            { value: 'scene', label: 'Scene Pixels' },
            ...state.activeLayers.map(layer => ({ value: layer.id, label: layer.name })),
          ]}
          onChange={value => {
            const layerId = value === 'scene' ? null : value
            state.selectLayer(layerId)
            state.setDesignSurface(layerId ? 'layer' : 'scene')
          }}
          description={state.selectedLayer?.locked ? 'This layer is locked. Unlock it before editing its transform.' : 'Scene Pixels paints non-destructively above inherited artwork.'}
        />
        <HelpInfoTrigger helpId="react.pixGrid.design.editingContext.editTarget" currentValue={state.selectedLayer?.name ?? 'Scene Pixels'} currentValueTone={state.selectedLayer ? 'accent' : 'default'} placement="left" />
      </div>
      <div className="rv-ctrl-action-row rv-pix-grid-history-row" aria-label="PixGrid edit history">
        <button type="button" className="rv-reset-btn" disabled={state.undoCount === 0} onClick={state.undo}>Undo</button>
        <button type="button" className="rv-reset-btn" disabled={state.redoCount === 0} onClick={state.redo}>Redo</button>
        <span className="rv-ctrl-info" aria-label={`${state.undoCount} undo steps and ${state.redoCount} redo steps`}>{state.undoCount} / {state.redoCount}</span>
      </div>
    </DesignSection>
  )
}

function GridDesign({ state }: { state: PixGridMockState }) {
  return (
    <DesignSection label="Grid Presentation">
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SelectRow label={state.grid.qualityMode === 'adaptive' ? 'Starting Quality' : 'Fixed Quality'} value={state.grid.quality} options={QUALITY_OPTIONS} onChange={quality => state.setGrid({ quality })} />
        <HelpInfoTrigger helpId="react.pixGrid.design.grid.quality" currentValue={`${state.grid.qualityMode === 'adaptive' ? 'Adaptive start' : 'Fixed'} · ${QUALITY_OPTIONS.find(option => option.value === state.grid.quality)?.label ?? state.grid.quality}`} currentValueTone="accent" placement="left" />
      </div>
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SliderRow label="Cell Gap" value={state.grid.cellGap} max={0.45} onChange={cellGap => state.setGrid({ cellGap })} />
        <HelpInfoTrigger helpId="react.pixGrid.design.grid.cellGap" currentValue={`${Math.round(state.grid.cellGap * 100)}%`} placement="left" />
      </div>
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SliderRow label="Cell Roundness" value={state.grid.cellRoundness} max={0.5} onChange={cellRoundness => state.setGrid({ cellRoundness })} />
        <HelpInfoTrigger helpId="react.pixGrid.design.grid.cellRoundness" currentValue={`${Math.round(state.grid.cellRoundness * 100)}%`} placement="left" />
      </div>
      <SliderRow label="Cell Calibration" value={state.grid.cellBrightness} onChange={cellBrightness => state.setGrid({ cellBrightness })} description="Advanced emitter calibration retained for compatibility." />
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SliderRow label="Glow" value={state.grid.glow} onChange={glow => state.setGrid({ glow })} description="Emitter halo strength." />
        <HelpInfoTrigger helpId="react.pixGrid.performanceAndMatrix.ledMatrix.glow" currentValue={`${Math.round(state.grid.glow * 100)}%`} placement="left" />
      </div>
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <SliderRow label="Diffusion" value={state.grid.diffusion} onChange={diffusion => state.setGrid({ diffusion })} description="Emitter edge softness." />
        <HelpInfoTrigger helpId="react.pixGrid.performanceAndMatrix.ledMatrix.diffusion" currentValue={`${Math.round(state.grid.diffusion * 100)}%`} placement="left" />
      </div>
      <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
        <ToggleRow label="RGB Subpixels" value={state.grid.rgbSubpixels} onChange={rgbSubpixels => state.setGrid({ rgbSubpixels })} />
        <HelpInfoTrigger helpId="react.pixGrid.performanceAndMatrix.ledMatrix.rgbSubpixelMode" currentValue={state.grid.rgbSubpixels ? 'On' : 'Off'} currentValueLabel="Status" currentValueTone={state.grid.rgbSubpixels ? 'accent' : 'default'} placement="left" />
      </div>
      <ToggleRow label="Cell Guides" value={state.grid.cellGuides} onChange={cellGuides => state.setGrid({ cellGuides })} />
    </DesignSection>
  )
}

function SceneDesign({ state }: { state: PixGridMockState }) {
  return (
    <DesignSection label="Scene">
      <TextInputRow label="Name" value={state.activeScene.name} maxLength={96} onChange={state.renameScene} />
      <div className="rv-ctrl-info">{state.activeScene.layerIds.length} layers · {state.activeScene.pixelOverrideCount} sparse pixel overrides</div>
    </DesignSection>
  )
}

function LayerDesign({ state }: { state: PixGridMockState }) {
  const layer = state.selectedLayer
  if (!layer) return <div className="rv-ctrl-info">Select a layer from SETUP or Editing Context.</div>
  return (
    <DesignSection label="Layer">
      <div className="rv-ctrl-info"><strong>{layer.name}</strong><br />{layer.sourceKind === 'media' ? 'Media Library artwork' : layer.sourceId}</div>
      <ToggleRow label="Visible" value={layer.visible} onChange={visible => state.updateLayer(layer.id, { visible })} />
      <ToggleRow label="Locked" value={layer.locked} onChange={locked => state.updateLayer(layer.id, { locked })} />
      <SliderRow label="Opacity" value={layer.opacity} disabled={layer.locked} onChange={opacity => state.updateLayer(layer.id, { opacity })} />
      <SliderRow label="Position X" value={layer.position.x} disabled={layer.locked} onChange={x => state.updateLayer(layer.id, { position: { ...layer.position, x } })} />
      <SliderRow label="Position Y" value={layer.position.y} disabled={layer.locked} onChange={y => state.updateLayer(layer.id, { position: { ...layer.position, y } })} />
      <SliderRow label="Scale X" value={layer.scale.x} min={0.01} max={2} step={0.01} disabled={layer.locked} onChange={x => state.updateLayer(layer.id, { scale: { ...layer.scale, x } })} />
      <SliderRow label="Scale Y" value={layer.scale.y} min={0.01} max={2} step={0.01} disabled={layer.locked} onChange={y => state.updateLayer(layer.id, { scale: { ...layer.scale, y } })} />
      <SliderRow label="Rotation" value={layer.rotation} min={-180} max={180} step={1} disabled={layer.locked} onChange={rotation => state.updateLayer(layer.id, { rotation })} />
      <div className="rv-ctrl-action-row">
        <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => state.updateLayer(layer.id, { position: { x: 0.5, y: 0.5 }, scale: { x: 1, y: 1 }, rotation: 0 })}>Reset Transform</button>
        <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => state.duplicateLayer(layer.id)}>Duplicate</button>
        <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => state.deleteLayer(layer.id)}>Delete</button>
      </div>
    </DesignSection>
  )
}

function SelectionDesign({ state }: { state: PixGridMockState }) {
  if (!state.selection) return <div className="rv-ctrl-info">No pixel selection.</div>
  return (
    <DesignSection label="Selection">
      <div className="rv-ctrl-info">X {state.selection.x} · Y {state.selection.y} · {state.selection.width} × {state.selection.height}</div>
      <div className="rv-ctrl-action-row">
        <button type="button" className="rv-reset-btn" onClick={() => state.setSelection({ ...state.selection!, width: state.selection!.width })}>Restore Inherited</button>
        <button type="button" className="rv-reset-btn" onClick={() => state.setSelection({ ...state.selection!, height: state.selection!.height })}>Clear / Off</button>
        <button type="button" className="rv-reset-btn" onClick={() => state.setSelection(null)}>Deselect</button>
      </div>
    </DesignSection>
  )
}

function ToolDesign({ state }: { state: PixGridMockState }) {
  return (
    <DesignSection label="Tool Settings">
      <SelectRow label="Tool" value={state.tool.tool} options={TOOL_OPTIONS} onChange={tool => state.setTool({ tool })} />
      <ColorRow label="Paint Color" value={state.tool.paintColor} onChange={paintColor => state.setTool({ paintColor })} description="The active paint, fill, line, and rectangle color." />
      <SliderRow label="Paint Opacity" value={state.tool.paintOpacity} onChange={paintOpacity => state.setTool({ paintOpacity })} />
      <SelectRow label="Eraser Behavior" value={state.tool.eraserMode} options={[{ value: 'off', label: 'Clear / Force Off' }, { value: 'restore', label: 'Restore Inherited' }]} onChange={eraserMode => state.setTool({ eraserMode })} />
      <SliderRow label="Zoom" value={state.tool.zoom} min={0.25} max={16} step={0.05} onChange={zoom => state.setTool({ zoom })} />
      <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={() => state.setTool({ zoom: 1 })}>Reset View</button></div>
    </DesignSection>
  )
}

function DesignTabMockup({ state }: { state: PixGridMockState }) {
  const options = DESIGN_SURFACES.map(option => ({
    ...option,
    disabled: (option.id === 'layer' && !state.selectedLayer) || (option.id === 'selection' && !state.selection),
  }))
  return (
    <div className="rv-workspace-panel" data-layout-lab-pix-grid="design">
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group rv-pix-grid-design-panel">
            <PanelSubtabs value={state.designSurface} options={options} onChange={state.setDesignSurface} ariaLabel="PixGrid design sections" layout="scroll" className="rv-right-subtabs--embedded" />
            <EditingContext state={state} />
            {state.designSurface === 'grid' && <GridDesign state={state} />}
            {state.designSurface === 'scene' && <SceneDesign state={state} />}
            {state.designSurface === 'layer' && <LayerDesign state={state} />}
            {state.designSurface === 'selection' && <SelectionDesign state={state} />}
            {state.designSurface === 'tool' && <ToolDesign state={state} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteList({ routes, selectedId, onSelect }: { routes: PixGridMockRoute[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="rv-pix-grid-route-list" role="list" aria-label="PixGrid routes">
      {routes.map(route => (
        <button key={route.id} type="button" role="listitem" className={route.id === selectedId ? 'is-active' : ''} onClick={() => onSelect(route.id)}>
          <span className={`rv-pix-grid-route-state ${route.enabled ? 'is-on' : 'is-off'}`} aria-hidden="true" />
          <span><strong>{route.name}</strong><small>{route.source} → {route.targetScope}</small></span>
          <em>{route.origin === 'program' ? 'PROGRAM' : route.origin === 'preset' ? 'PRESET' : 'USER'}</em>
        </button>
      ))}
      {routes.length === 0 && <div className="rv-ctrl-info">No routes in this category.</div>}
    </div>
  )
}

function routeTargetOptions(state: PixGridMockState, scope: PixGridMockTargetScope) {
  if (scope === 'group') return state.groups.map(group => ({ value: group.id, label: group.name }))
  if (scope === 'layer') return state.activeLayers.map(layer => ({ value: layer.id, label: layer.name }))
  if (scope === 'scene') return state.scenes.map(scene => ({ value: scene.id, label: scene.name }))
  return []
}

function RouteEditor({ route, state }: { route: PixGridMockRoute; state: PixGridMockState }) {
  const continuous = route.kind === 'continuous'
  const targets = routeTargetOptions(state, route.targetScope)
  const update = (patch: Partial<PixGridMockRoute>) => state.updateRoute(route.id, patch)
  return (
    <Collapsible label={continuous ? (route.origin === 'user' ? 'USER CONTINUOUS ROUTE' : 'CONTINUOUS ROUTE SETTINGS') : (route.origin === 'user' ? 'USER EVENT ROUTE' : 'EVENT ROUTE SETTINGS')} defaultOpen>
      {route.origin === 'user' && <TextInputRow label="Name" value={route.name} onChange={name => update({ name })} />}
      <div className="rv-pix-grid-origin-card">
        <strong>{route.id}</strong>
        <span>{route.targetScope} · {route.targetId ?? 'global'}</span>
        <small>{route.origin === 'program' ? 'Performance program default' : route.origin === 'preset' ? 'Preset route' : 'User-authored route'}{route.modified ? ' · modified' : ''}</small>
      </div>
      <ToggleRow label="Enabled" value={route.enabled} onChange={enabled => update({ enabled })} />
      <SelectRow label={continuous ? 'Source' : 'Event'} value={route.source} options={SOURCE_OPTIONS} onChange={source => update({ source })} />
      <SelectRow label="Target Scope" value={route.targetScope} options={TARGET_SCOPE_OPTIONS} onChange={value => {
        const targetScope = value as PixGridMockTargetScope
        update({ targetScope, targetId: routeTargetOptions(state, targetScope)[0]?.value ?? null })
      }} />
      {targets.length > 0 && <SelectRow label="Target" value={route.targetId ?? targets[0]?.value ?? ''} options={targets} onChange={targetId => update({ targetId })} />}
      <SelectRow label="Operation" value={route.operation} options={OPERATION_OPTIONS} onChange={operation => update({ operation })} />
      <SliderRow label="Amount" value={route.amount} min={-4} max={4} step={0.01} description="Signed strength applied after source shaping and eligibility checks." onChange={amount => update({ amount })} />
      <NumberInputRow label="Input Minimum" value={route.inputMinimum} min={-4} max={4} step={0.01} onChange={inputMinimum => update({ inputMinimum })} />
      <NumberInputRow label="Input Maximum" value={route.inputMaximum} min={-4} max={4} step={0.01} onChange={inputMaximum => update({ inputMaximum })} />
      <NumberInputRow label="Output Minimum" value={route.outputMinimum} min={-4} max={4} step={0.01} onChange={outputMinimum => update({ outputMinimum })} />
      <NumberInputRow label="Output Maximum" value={route.outputMaximum} min={-4} max={4} step={0.01} onChange={outputMaximum => update({ outputMaximum })} />
      {continuous ? (
        <>
          <SelectRow label="Polarity" value={route.polarity} options={['Positive', 'Negative', 'Bipolar'].map(value => ({ value, label: value }))} onChange={polarity => update({ polarity })} />
          <SelectRow label="Curve" value={route.curve} options={['Linear', 'Ease In', 'Ease Out', 'Ease In Out', 'Exponential', 'Logarithmic', 'Smoothstep', 'Stepped', 'Gate', 'Inverse'].map(value => ({ value, label: value }))} onChange={curve => update({ curve })} />
        </>
      ) : (
        <SelectRow label="Decay Curve" value={route.decayCurve} options={['Linear', 'Ease In', 'Ease Out', 'Ease In Out', 'Exponential', 'Overshoot', 'Step', 'Stepped'].map(value => ({ value, label: value }))} onChange={decayCurve => update({ decayCurve })} />
      )}
      <SliderRow label="Threshold" value={route.threshold} onChange={threshold => update({ threshold })} description="Minimum shaped source value required before this route can contribute." />
      <SliderRow label="Hysteresis" value={route.hysteresis} onChange={hysteresis => update({ hysteresis })} />
      <SliderRow label="Smoothing" value={route.smoothing} onChange={smoothing => update({ smoothing })} />
      {!continuous && (
        <>
          <SliderRow label="Attack" value={route.attack} onChange={attack => update({ attack })} />
          <SliderRow label="Hold" value={route.hold} onChange={hold => update({ hold })} />
          <SliderRow label="Release" value={route.release} onChange={release => update({ release })} />
          <SliderRow label="Cooldown" value={route.cooldown} onChange={cooldown => update({ cooldown })} description="Minimum seconds between accepted event triggers, independent of envelope length." />
          <SelectRow label="Quantization" value={route.quantization} options={['None', 'Beat', 'Bar', 'Four Bars', 'Eight Bars', 'Sixteen Bars'].map(value => ({ value, label: value }))} onChange={quantization => update({ quantization })} />
          <SelectRow label="Retrigger" value={route.retrigger} options={['Restart', 'Extend', 'Ignore While Active'].map(value => ({ value, label: value }))} onChange={retrigger => update({ retrigger })} />
        </>
      )}
      {['Bass', 'Kick'].includes(route.source) && <ToggleRow label="Use Bass Reactivity" value={route.bassReactivity} onChange={bassReactivity => update({ bassReactivity })} description="Let the global Bass Reactivity control scale this bass-sensitive source." />}
      <SliderRow label="Minimum Confidence" value={route.minimumConfidence} onChange={minimumConfidence => update({ minimumConfidence })} description="Reject optional or inferred analysis below this confidence." />
      <SelectRow label="Fallback" value={route.fallback} options={['Disable', 'Zero', 'Energy', 'Beat', 'Mid High Activity', 'Transient'].map(value => ({ value, label: value }))} onChange={fallback => update({ fallback })} description="Replacement source used when the authored source is unavailable." />
      <SelectRow label="Include Section" value={route.includeSection} options={SECTION_OPTIONS} onChange={includeSection => update({ includeSection })} />
      <SelectRow label="Exclude Section" value={route.excludeSection} options={SECTION_OPTIONS} onChange={excludeSection => update({ excludeSection })} />
      <SelectRow label="Section Phase" value={route.sectionPhase} options={['Any section phase', 'Entry', 'Body', 'Exit'].map(value => ({ value, label: value }))} onChange={sectionPhase => update({ sectionPhase })} />
      <SelectRow label="Phrase Segment" value={route.phraseSegment} options={PHRASE_SEGMENT_OPTIONS} onChange={phraseSegment => update({ phraseSegment })} />
      <SliderRow label="Minimum Energy" value={route.minimumEnergy} onChange={minimumEnergy => update({ minimumEnergy })} />
      <SliderRow label="Maximum Energy" value={route.maximumEnergy} onChange={maximumEnergy => update({ maximumEnergy })} />
      <ToggleRow label="Auto Performance Only" value={route.autoPerformanceOnly} description="Require the shared performance program to be active before this route is eligible." onChange={autoPerformanceOnly => update({ autoPerformanceOnly })} />
      <SelectRow label="Active Layer" value={route.activeLayerId ?? 'any'} options={[{ value: 'any', label: 'Any active layer' }, ...state.layers.map(layer => ({ value: layer.id, label: layer.name }))]} onChange={value => update({ activeLayerId: value === 'any' ? null : value })} />
      <SelectRow label="Active Group" value={route.activeGroupId ?? 'any'} options={[{ value: 'any', label: 'Any active group' }, ...state.groups.map(group => ({ value: group.id, label: group.name }))]} onChange={value => update({ activeGroupId: value === 'any' ? null : value })} />
      <TextInputRow label="Section Occurrences" value={route.sectionOccurrences} placeholder="1, 2, 3" onChange={sectionOccurrences => update({ sectionOccurrences })} />
      <TextInputRow label="Drop Occurrences" value={route.dropOccurrences} placeholder="1, 2" onChange={dropOccurrences => update({ dropOccurrences })} />
      <SliderRow label="Priority" value={route.priority} min={-1000} max={1000} step={1} onChange={priority => update({ priority })} />
      <SelectRow label="Blend" value={route.blend} options={['Add', 'Multiply', 'Replace', 'Max'].map(value => ({ value, label: value }))} onChange={blend => update({ blend })} />
      <div className="rv-ctrl-action-row">
        <button type="button" className="rv-reset-btn" onClick={() => state.previewRoute(route.id)}>{continuous ? 'Preview Route' : 'Test Trigger'}</button>
        <button type="button" className="rv-reset-btn" disabled={!route.modified} onClick={() => state.resetRoute(route.id)}>Reset Route</button>
        {route.origin === 'user' && <button type="button" className="rv-reset-btn" onClick={() => state.deleteRoute(route.id)}>Delete</button>}
      </div>
      {route.previewRevision > 0 && <div className="rv-ctrl-info" role="status">Transient preview revision {route.previewRevision}. No Track Map cue was written.</div>}
      <div className="rv-ctrl-info">Preview is transient and never writes a Track Map cue.</div>
    </Collapsible>
  )
}

function SmartGroupIntegration({ state }: { state: PixGridMockState }) {
  const group = state.selectedGroup
  return (
    <Collapsible label="SMART GROUP INTEGRATION" defaultOpen>
      <SelectRow label="Selected Group" value={group?.id ?? 'none'} options={[{ value: 'none', label: 'No group selected' }, ...state.groups.map(item => ({ value: item.id, label: item.name }))]} onChange={value => state.selectGroup(value === 'none' ? null : value)} />
      {group ? (
        <>
          <div className="rv-pix-grid-origin-card"><strong>{group.name}</strong><span>{group.memberCount} resolved cells</span><small>{group.origin === 'preset' ? 'Preset smart group' : 'User smart group'} · {group.enabled ? 'enabled' : 'disabled'}</small></div>
          <ToggleRow label="Show Mask Overlay" value={group.showMaskOverlay} onChange={showMaskOverlay => state.updateGroup(group.id, { showMaskOverlay })} />
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" onClick={() => state.setDesignSurface('selection')}>Open Group in Editor</button>
            <button type="button" className="rv-reset-btn" onClick={() => state.addRoute('continuous')}>Create Route for Group</button>
          </div>
        </>
      ) : (
        <>
          <div className="rv-ctrl-info">Select a smart group to inspect its origin, mask, and route ownership.</div>
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" disabled>Open Group in Editor</button>
            <button type="button" className="rv-reset-btn" disabled>Create Route for Group</button>
          </div>
        </>
      )}
    </Collapsible>
  )
}

function RoutingOrEvents({ state, kind }: { state: PixGridMockState; kind: PixGridMockRouteKind }) {
  const routes = state.routes.filter(route => route.kind === kind)
  const selected = kind === 'continuous' ? state.selectedContinuousRoute : state.selectedEventRoute
  return (
    <div className="rv-ctrl-group rv-pix-grid-reactivity-workspace" data-layout-lab-pix-grid={kind === 'continuous' ? 'routing' : 'events'}>
      <Collapsible label={kind === 'continuous' ? 'CONTINUOUS ROUTES' : 'EVENT ROUTES'} defaultOpen>
        <div className="rv-pix-grid-route-summary"><strong>{routes.length}</strong><span>{routes.filter(route => route.origin === 'program').length} program · {routes.filter(route => route.origin === 'user').length} user</span></div>
        <RouteList routes={routes} selectedId={selected?.id ?? null} onSelect={id => state.selectRoute(kind, id)} />
        <div className="rv-ctrl-action-row">
          <button type="button" className="rv-reset-btn" onClick={() => state.addRoute(kind)}>Add Route</button>
          <button type="button" className="rv-reset-btn" disabled={!selected} onClick={() => selected && state.duplicateRoute(selected.id)}>Duplicate</button>
        </div>
      </Collapsible>
      {selected && <RouteEditor route={selected} state={state} />}
      <SmartGroupIntegration state={state} />
    </div>
  )
}

function ChoreographyPanel({ state }: { state: PixGridMockState }) {
  const c = state.choreography
  return (
    <div className="rv-ctrl-group rv-pix-grid-reactivity-workspace" data-layout-lab-pix-grid="choreography">
      <Collapsible label="PERFORMANCE PROGRAM" defaultOpen>
        <SelectRow label="Change Performance Program Only" value={c.programId} options={[
          { value: 'pix-grid-bass-beacon-performance', label: 'Bass Beacon Performance' },
          { value: 'pix-grid-geometric-reactor-performance', label: 'Geometric Reactor Performance' },
          { value: 'pix-grid-pixel-parade-performance', label: 'Pixel Parade Performance' },
        ]} onChange={programId => state.setChoreography({ programId })} description="Changes only the authored performance program and its overrides. Artwork and presentation settings remain unchanged." />
        <div className="rv-pix-grid-origin-card"><strong>{c.programId.replace(/-/g, ' ')}</strong><span>Preset-owned authored program</span><small>{c.overrideActive ? 'Manual override active' : 'Program controls output'}</small></div>
        <ToggleRow label="Auto Performance" value={c.autoPerformance} onChange={autoPerformance => state.setChoreography({ autoPerformance })} />
        <SliderRow label="Performance Intensity" value={c.intensity} onChange={intensity => state.setChoreography({ intensity })} />
        <div className="rv-pix-grid-live-card">
          <span>Active section <strong>Drop · body</strong></span>
          <span>Motif <strong>four-bar flare</strong></span>
          <span>Recruitment <strong>accent bank 2</strong></span>
          <span>Evolution <strong>sixteen-bar expansion</strong></span>
        </div>
        <SelectRow label="Section Plan" value={c.sectionPlan} options={[
          { value: 'intro-entry', label: 'Intro Entry · intro' },
          { value: 'verse-body', label: 'Verse Body · verse' },
          { value: 'build-body', label: 'Build Body · build' },
          { value: 'drop-body', label: 'Drop Body · drop' },
          { value: 'breakdown-body', label: 'Breakdown Body · breakdown' },
        ]} onChange={sectionPlan => state.setChoreography({ sectionPlan })} />
      </Collapsible>

      <Collapsible label="SECTION PLAN CONTROLS" defaultOpen>
        <ToggleRow label="Section Enabled" value={c.sectionEnabled} onChange={sectionEnabled => state.setChoreography({ sectionEnabled })} />
        <SliderRow label="Density Arc" value={c.densityArc} onChange={densityArc => state.setChoreography({ densityArc })} />
        <SliderRow label="Palette Arc" value={c.paletteArc} onChange={paletteArc => state.setChoreography({ paletteArc })} />
        <SliderRow label="Motion Arc" value={c.motionArc} onChange={motionArc => state.setChoreography({ motionArc })} />
        <SliderRow label="Negative Space" value={c.negativeSpace} onChange={negativeSpace => state.setChoreography({ negativeSpace })} />
        <ToggleRow label="Four-bar Motifs" value={c.fourBarMotifs} onChange={fourBarMotifs => state.setChoreography({ fourBarMotifs })} />
        <ToggleRow label="Eight-bar Recruitment" value={c.eightBarRecruitment} onChange={eightBarRecruitment => state.setChoreography({ eightBarRecruitment })} />
        <ToggleRow label="Sixteen-bar Evolution" value={c.sixteenBarEvolution} onChange={sixteenBarEvolution => state.setChoreography({ sixteenBarEvolution })} />
        <SelectRow label="Transition In" value={c.transitionIn} options={['Cut', 'Crossfade', 'Row Wipe', 'Column Wipe', 'Checker Wipe', 'Pixel Dissolve', 'Radial Reveal', 'Palette Fade', 'Power On', 'Power Off'].map(value => ({ value, label: value }))} onChange={transitionIn => state.setChoreography({ transitionIn })} />
        <SelectRow label="Transition Out" value={c.transitionOut} options={['Cut', 'Crossfade', 'Row Wipe', 'Column Wipe', 'Checker Wipe', 'Pixel Dissolve', 'Radial Reveal', 'Palette Fade', 'Power On', 'Power Off'].map(value => ({ value, label: value }))} onChange={transitionOut => state.setChoreography({ transitionOut })} />
        <NumberInputRow label="Occurrence" value={1} min={1} step={1} onChange={() => state.setChoreography({ overrideActive: true })} />
        <NumberInputRow label="Drop Occurrence" value={1} min={1} step={1} onChange={() => state.setChoreography({ overrideActive: true })} />
        <TextInputRow label="Continuous Route IDs" value="bass-pressure, phrase-motion" onChange={() => state.setChoreography({ overrideActive: true })} />
        <TextInputRow label="Event Route IDs" value="snare-impact" onChange={() => state.setChoreography({ overrideActive: true })} />
        <Collapsible label="ENTRY, BODY, AND EXIT ACTIONS" defaultOpen={false}>
          <div className="rv-pix-grid-inspection-list"><strong>Entry</strong><span>1. Transition · Pixel Dissolve · 2 beats</span><strong>Body</strong><span>1. Recruit layer · Accent Bank · 100%</span><strong>Exit</strong><span>1. Palette · highlight → accent</span></div>
        </Collapsible>
        <Collapsible label="MOTIFS AND DEVELOPMENT" defaultOpen={false}>
          <div className="rv-pix-grid-inspection-list"><strong>Four-bar motif 1</strong><span>Flash percussion accents</span><strong>Eight-bar recruitment 1</strong><span>Recruit side chevrons</span><strong>Sixteen-bar evolution 1</strong><span>Expand rings and reverse direction</span><strong>Layer recruitment</strong><span>Drop Chevrons @ body</span><strong>Group recruitment</strong><span>Percussion Accents @ body</span><strong>Occurrence rule</strong><span>All occurrences</span><strong>Drop occurrence rule</strong><span>Only 1, 2</span></div>
        </Collapsible>
        <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={() => state.setChoreography({ overrideActive: false })}>Reset Section</button></div>
      </Collapsible>

      <Collapsible label="VISUAL ROLES AND BANKS" defaultOpen={false}>
        <div className="rv-pix-grid-inspection-list"><span>Roles: hero · support · accent · background</span><span>hero-bank: group Hero Typography → hero</span><span>accent-bank: group Percussion Accents → accent</span><span>Background bank: 1 target · background</span></div>
      </Collapsible>
      <Collapsible label="ROUTE BANKS AND CAPABILITIES" defaultOpen={false}>
        <div className="rv-pix-grid-inspection-list"><span>Continuous route bank: {state.routes.filter(route => route.kind === 'continuous').length} authored routes</span><span>Event route bank: {state.routes.filter(route => route.kind === 'event').length} authored routes</span><span>Fallback order: energy → beat → transient</span><span>Binding warnings: none</span><span>Manual precedence: Program → cues → manual override</span></div>
      </Collapsible>
      <Collapsible label="OVERRIDES" defaultOpen>
        <div className="rv-pix-grid-origin-card"><strong>{c.overrideActive ? 'Manual override active' : 'Program controls output'}</strong><span>{c.overrideActive ? 'Local Layout Lab settings differ from preset defaults.' : 'No temporary override routes.'}</span><small>Track Map cue state is distinct from preset defaults and user-authored configuration.</small></div>
        <div className="rv-ctrl-action-row"><button type="button" className="rv-reset-btn" onClick={state.clearOverride}>Clear Override</button><button type="button" className="rv-reset-btn" onClick={state.resetPerformance}>Reset Performance Configuration</button></div>
      </Collapsible>
    </div>
  )
}

function MetricRows({ rows }: { rows: Array<[string, string]> }) {
  return <div className="rv-pix-grid-diagnostics-grid">{rows.map(([name, value]) => <div key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>
}

function AnalysisPanel({ state }: { state: PixGridMockState }) {
  const activeRoutes = state.routes.filter(route => route.enabled).slice(0, 2)
  return (
    <div className="rv-ctrl-group rv-pix-grid-reactivity-workspace" data-layout-lab-pix-grid="analysis">
      <div className="rv-layout-lab-static-diagnostic" role="status">Static deterministic Layout Lab diagnostics. No live audio, transport, feature bus, worker, or renderer is running.</div>
      <Collapsible label="AUDIO INPUT AND TRANSPORT" defaultOpen>
        <MetricRows rows={[["Audio source", "Track Input · unavailable"], ["Transport", "Stopped"], ["Track time", "01:24.000 / 03:42.000"], ["Effective BPM", "150"], ["Analysis owner", "Synthetic Layout Lab fixture"]]} />
      </Collapsible>
      <Collapsible label="PERCEPTUAL RESPONSE METER" defaultOpen>
        <MetricRows rows={[["Routes existing", `${state.routes.length}`], ["Routes executing", `${activeRoutes.length}`], ["Pixels changing", "1,842"], ["Visibly perceptible", "Yes"], ["Response magnitude", "72%"]]} />
        <small className="rv-pix-grid-diagnostic-note">Routes existing, routes executing, pixels changing, and changes being visibly perceptible are measured as separate states.</small>
      </Collapsible>
      <Collapsible label="WHY PIXGRID IS MOVING" defaultOpen>
        <div className="rv-pix-grid-motion-reasons">
          <div><strong>Autonomous layer animation</strong><span>3 active definitions</span><small>Driven by elapsed time and the global Motion multiplier.</small></div>
          <div><strong>Beat-synchronized animation</strong><span>2 active definitions</span><small>Driven by beat or cue clocks, not transient envelopes.</small></div>
          <div><strong>Audio-envelope group actions</strong><span>2 active envelopes</span><small>Driven by continuous routes and transient attack, hold, release, and cooldown.</small></div>
          <div><strong>Performance-program actions</strong><span>4 actions</span><small>Driven by authored visual roles, route banks, motifs, and recruitment.</small></div>
          <div><strong>Scene and phrase transitions</strong><span>1 transition</span><small>Driven by section plans, phrase boundaries, or Track Map cues.</small></div>
          <div><strong>Global Motion</strong><span>82%</span><small>Separate from music-reaction intensity.</small></div>
        </div>
      </Collapsible>
      <Collapsible label="PERFORMANCE STATE" defaultOpen={false}>
        <MetricRows rows={[["Program", state.choreography.programId], ["Active section plan", state.choreography.sectionPlan], ["Motif", "four-bar flare"], ["Recruitment", "accent bank 2"], ["Evolution", "sixteen-bar expansion"], ["Override", state.choreography.overrideActive ? "Manual" : "None"]]} />
      </Collapsible>
      <Collapsible label="ACTIVE ROUTES AND ENVELOPES" defaultOpen>
        <div className="rv-pix-grid-route-activity" role="list" aria-label="Active PixGrid audio routes">
          {activeRoutes.map(route => <div key={route.id} role="listitem"><strong>{route.name}</strong><span>{route.source} → {route.operation}</span><small>{route.kind === 'event' ? 'attack' : 'continuous'} · {Math.round(Math.abs(route.amount) * 100)}%</small></div>)}
          {!activeRoutes.length && <div className="rv-ctrl-info">No route is currently producing a non-zero action. Open Inactive Route Reasons below to see why.</div>}
        </div>
        <Collapsible label="INACTIVE ROUTE REASONS" defaultOpen={false}><div className="rv-pix-grid-warning-list"><span><strong>Optional semantic route</strong> · capability unavailable</span><span><strong>Outro suppressor</strong> · section condition not met</span></div></Collapsible>
      </Collapsible>
      <Collapsible label="SMART GROUP LIVE INSPECTION" defaultOpen={false}>
        <div className="rv-pix-grid-group-inspection" role="list" aria-label="PixGrid smart group diagnostics">
          {state.groups.map(group => <div key={group.id} role="listitem"><strong>{group.name}</strong><span>{group.memberCount} cells · {group.enabled ? 'enabled' : 'disabled'}</span><small>{group.showMaskOverlay ? 'Mask overlay visible' : 'Mask overlay hidden'}</small></div>)}
        </div>
      </Collapsible>
      <Collapsible label="LIVE AUTHORITATIVE ANALYSIS" defaultOpen>
        <div className="rv-pix-grid-origin-card"><strong>Layout Lab static fixture</strong><span>Values are deterministic and not published by the PixGrid runtime.</span><small>No values are synthesized from user audio.</small></div>
        <MetricRows rows={[["Bass", "0.78"], ["Kick", "Triggered"], ["Snare", "Idle"], ["Energy", "0.66"], ["Phrase progress", "0.42"], ["Confidence", "0.94"]]} />
      </Collapsible>
      <Collapsible label="EVENTS AND MUSICAL POSITION" defaultOpen>
        <div className="rv-pix-grid-choreo-grid"><div><strong>Section</strong><span>Drop</span></div><div><strong>Phase</strong><span>Body</span></div><div><strong>Occurrence</strong><span>1</span></div><div><strong>Drop</strong><span>1</span></div><div><strong>4 / 8 / 16</strong><span>2 / 1 / 0</span></div><div><strong>Semantic</strong><span>Idle</span></div></div>
      </Collapsible>
      <Collapsible label="CAPABILITY STATUS" defaultOpen={false}><MetricRows rows={[["Beat grid", "Available"], ["Sections", "Available"], ["Stem activity", "Degraded"], ["Semantic moments", "Unavailable"], ["Track Map cues", "Available"]]} /></Collapsible>
      <Collapsible label="CONFIGURATION VALIDATION" defaultOpen={false}>
        <div className="rv-pix-grid-validation-summary" role="status"><strong>VALID</strong><span>Deterministic mock configuration is structurally coherent.</span></div>
        <div className="rv-pix-grid-validation-list" role="list" aria-label="PixGrid validation issues"><div className="rv-ctrl-info">Smart groups, routes, fallbacks, performance program, and migration metadata are structurally valid.</div></div>
      </Collapsible>
      <Collapsible label="RUNTIME DIAGNOSTICS" defaultOpen={false}>
        <MetricRows rows={[["State schema", "8"], ["Preset config", "8"], ["Layer graph", "canonical"], ["Canonical migration", "Complete"], ["Fallback routes", "Inactive"], ["Active audio sources", "6"], ["Active assignments", `${activeRoutes.length}`], ["Affected groups", "2"], ["Affected cells", "1,842"], ["Renderer", "Unavailable · Layout Lab"], ["Requested / effective quality", `${state.grid.quality} / unavailable`], ["Resolution", "160 × 90 fixture"], ["FPS", "Unavailable"]]} />
      </Collapsible>
    </div>
  )
}

function ReactTabMockup({ state }: { state: PixGridMockState }) {
  const [surface, setSurface] = useState<PixGridMockReactSurface>('routing')
  const labels: Record<PixGridMockReactSurface, string> = { routing: 'Routing', events: 'Events', choreography: 'Choreography', analysis: 'Analysis' }
  return (
    <div className="rv-workspace-panel">
      <div className="rv-pix-grid-reactivity-tabs-help drm-help-overlay-anchor">
        <PanelSubtabs value={surface} onChange={setSurface} ariaLabel="PixGrid reactivity surfaces" layout="wrap" className="rv-pix-grid-reactivity-tabs" options={REACT_SURFACES} />
        <HelpInfoTrigger helpId="react.pixGrid.reactivity.workspace.tabs" currentValue={labels[surface]} currentValueTone="accent" placement="left" />
      </div>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          {surface === 'routing' && <RoutingOrEvents state={state} kind="continuous" />}
          {surface === 'events' && <RoutingOrEvents state={state} kind="event" />}
          {surface === 'choreography' && <ChoreographyPanel state={state} />}
          {surface === 'analysis' && <AnalysisPanel state={state} />}
        </div>
      </div>
    </div>
  )
}

function OutputTabMockup({ state }: { state: PixGridMockState }) {
  const [surface, setSurface] = useState<OutputSurface>('recording')
  const canvas = useMemo(() => typeof document === 'undefined' ? null : document.createElement('canvas'), [])
  return (
    <div className="rv-workspace-panel" data-layout-lab-pix-grid="output">
      <PanelSubtabs value={surface} onChange={setSurface} ariaLabel="Output surfaces" options={[{ id: 'recording', label: 'RECORDING' }, { id: 'production', label: 'PRODUCTION', disabled: true }]} />
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <RecordingPanel
            canvas={canvas}
            recorderState={state.recording.state as RecorderState}
            recordingMode={'video-only' as RecordingMode}
            recordingTime={state.recording.state === 'recording' ? 12 : 0}
            recorderError={null}
            fps={state.recording.fps}
            liveFps={60}
            onFpsChange={state.setRecordingFps}
            onStartRecording={() => state.setRecordingState('recording')}
            onStopRecording={() => state.setRecordingState('idle')}
            hasActiveProgramAudio={false}
            onExportPng={() => {}}
          />
          <div className="rv-ctrl-info rv-control-helper-copy">Layout Lab simulates recorder-shaped UI state only. It never reads the canvas, creates a MediaRecorder, saves a file, or creates an object URL.</div>
        </div>
      </div>
    </div>
  )
}

export function PixGridRightRailMockup({ state, onSelectEngine }: { state: PixGridMockState; onSelectEngine: (id: ReactEngineId) => void }) {
  const [tab, setTab] = useState<RightTab>('design')
  return (
    <>
      <RailTabs tabs={RIGHT_TABS} activeTab={tab} onChange={setTab} ariaLabel="PixGrid inspector tabs" />
      <div className="vz-panel-body">
        {tab === 'presets' && <PresetsTabMockup state={state} onSelectEngine={onSelectEngine} />}
        {tab === 'design' && <DesignTabMockup state={state} />}
        {tab === 'react' && <ReactTabMockup state={state} />}
        {tab === 'output' && <OutputTabMockup state={state} />}
      </div>
    </>
  )
}
