import { useEffect, useState, type ReactNode } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import { Collapsible, ColorRow, CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { PanelSubtabs, type PanelSubtabOption } from '../PanelSubtabs'
import {
  applyPixGridPoints,
  deletePixGridLayer,
  duplicatePixGridLayer,
  getPixGridActiveLayers,
  getPixGridActiveScene,
  renamePixGridScene,
  resetPixGridLayerTransform,
  updatePixGridLayer,
} from './PixGridAuthoring'
import type { PixGridEditorTool, PixGridState } from './PixGridTypes'
import { PIX_GRID_QUALITY_OPTIONS } from './PixGridControlContract'
import { PixGridHistoryGesture } from './PixGridHistoryGesture'
import {
  PIX_GRID_FOLLOW_TRACK_SCENE_VALUE,
  selectPixGridEditingTarget,
  selectPixGridPreviewScene,
} from './PixGridScenePreview'

type PixGridDesignSurface = 'grid' | 'scene' | 'layer' | 'selection' | 'tool'

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

const SURFACE_OPTIONS: Array<PanelSubtabOption<PixGridDesignSurface>> = [
  { id: 'grid', label: 'Grid' },
  { id: 'scene', label: 'Scene' },
  { id: 'layer', label: 'Layer' },
  { id: 'selection', label: 'Selection' },
  { id: 'tool', label: 'Tool' },
]

function selectionPoints(state: PixGridState) {
  const selection = state.editor.selection
  if (!selection) return []
  return Array.from({ length: selection.width * selection.height }, (_, index) => ({
    x: selection.x + index % selection.width,
    y: selection.y + Math.floor(index / selection.width),
  }))
}

function DesignSection({
  label,
  grouped,
  children,
}: {
  label: string
  grouped: boolean
  children: ReactNode
}) {
  if (grouped) {
    return <Collapsible label={label}>{children}</Collapsible>
  }

  return (
    <>
      <CtrlSection label={label} />
      {children}
    </>
  )
}

export function PixGridDesignPanel({ groupedSections = false }: { groupedSections?: boolean } = {}) {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const applyState = useReactStore(store => store.applyPixGridAuthoringState)
  const setRequestedQuality = useReactStore(store => store.setPixGridRequestedQuality)
  const setPresentation = useReactStore(store => store.setPixGridPresentation)
  const begin = useReactStore(store => store.beginPixGridHistoryTransaction)
  const commit = useReactStore(store => store.commitPixGridHistoryTransaction)
  const undo = useReactStore(store => store.undoPixGridEdit)
  const redo = useReactStore(store => store.redoPixGridEdit)
  const undoCount = useReactStore(store => store.pixGridUndoStack.length)
  const redoCount = useReactStore(store => store.pixGridRedoStack.length)
  const [surface, setSurface] = useState<PixGridDesignSurface>('grid')
  const scene = getPixGridActiveScene(state)
  const layers = getPixGridActiveLayers(state)
  const layer = layers.find(candidate => candidate.id === state.editor.selectedLayerId) ?? null
  const [sceneName, setSceneName] = useState(scene.name)

  useEffect(() => setSceneName(scene.name), [scene.id, scene.name])
  useEffect(() => {
    if (surface === 'layer' && !layer) setSurface('grid')
    if (surface === 'selection' && !state.editor.selection) setSurface('tool')
  }, [layer, state.editor.selection, surface])

  const updateEditor = (patch: Partial<PixGridState['editor']>) => setState({ editor: { ...state.editor, ...patch } })
  const updateLayer = (patch: Parameters<typeof updatePixGridLayer>[2]) => {
    if (layer) applyState(updatePixGridLayer(useReactStore.getState().pixGridState, layer.id, patch))
  }
  const targetValue = state.editor.selectedLayerId ?? 'scene'
  const activeSceneValue = state.editor.scenePreviewMode === 'followTrack'
    ? PIX_GRID_FOLLOW_TRACK_SCENE_VALUE
    : scene.id
  const targetOptions = [
    { value: 'scene', label: 'Scene Pixels' },
    ...layers.map(candidate => ({ value: candidate.id, label: candidate.name })),
  ]
  const surfaceOptions = SURFACE_OPTIONS.map(option => ({
    ...option,
    disabled: (option.id === 'layer' && !layer) || (option.id === 'selection' && !state.editor.selection),
  }))
  const qualityLabel = PIX_GRID_QUALITY_OPTIONS.find(option => option.value === state.quality)?.label ?? state.quality

  return (
    <div className="rv-ctrl-group rv-pix-grid-design-panel">
      <PanelSubtabs
        value={surface}
        options={surfaceOptions}
        onChange={setSurface}
        ariaLabel="PixGrid design sections"
        layout="scroll"
        className="rv-right-subtabs--embedded"
      />

      <DesignSection label="Editing Context" grouped={groupedSections}>
        <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
          <SelectRow
            label="Active Scene"
            value={activeSceneValue}
            options={[
              { value: PIX_GRID_FOLLOW_TRACK_SCENE_VALUE, label: 'Follow Track' },
              ...state.scenes.map(candidate => ({ value: candidate.id, label: candidate.name })),
            ]}
            onChange={value => {
              setState(selectPixGridPreviewScene(state, value))
            }}
            description={state.editor.scenePreviewMode === 'followTrack' ? 'Track analysis owns the live scene.' : 'Editing Context owns the live preview scene.'}
          />
          <HelpInfoTrigger
            helpId="react.pixGrid.design.editingContext.activeScene"
            currentValue={state.editor.scenePreviewMode === 'followTrack' ? 'Follow Track' : scene.name}
            currentValueTone="accent"
            placement="left"
          />
        </div>
        <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
          <SelectRow
            label="Edit Target"
            value={targetValue}
            options={targetOptions}
            onChange={value => {
              const selectedLayerId = value === 'scene' ? null : value
              setState(selectPixGridEditingTarget(state, selectedLayerId))
              setSurface(selectedLayerId ? 'layer' : 'scene')
            }}
            description={layer?.locked ? 'This layer is locked. Unlock it before editing its transform.' : 'Scene Pixels paints non-destructively above inherited artwork.'}
          />
          <HelpInfoTrigger
            helpId="react.pixGrid.design.editingContext.editTarget"
            currentValue={layer?.name ?? 'Scene Pixels'}
            currentValueTone={layer ? 'accent' : 'default'}
            placement="left"
          />
        </div>
        <div className="rv-ctrl-action-row rv-pix-grid-history-row" aria-label="PixGrid edit history">
          <button type="button" className="rv-reset-btn" disabled={undoCount === 0} onClick={undo}>Undo</button>
          <button type="button" className="rv-reset-btn" disabled={redoCount === 0} onClick={redo}>Redo</button>
          <span className="rv-ctrl-info" aria-label={`${undoCount} undo steps and ${redoCount} redo steps`}>{undoCount} / {redoCount}</span>
        </div>
      </DesignSection>

      {surface === 'grid' && (
        <DesignSection label="Grid Presentation" grouped={groupedSections}>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <SelectRow label={state.qualityMode === 'adaptive' ? 'Starting Quality' : 'Fixed Quality'} value={state.quality} options={PIX_GRID_QUALITY_OPTIONS} onChange={value => setRequestedQuality(value as typeof state.quality)} />
            <HelpInfoTrigger
              helpId="react.pixGrid.design.grid.quality"
              currentValue={`${state.qualityMode === 'adaptive' ? 'Adaptive start' : 'Fixed'} · ${qualityLabel}`}
              currentValueTone="accent"
              placement="left"
            />
          </div>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <PixGridHistoryGesture><SliderRow label="Cell Gap" value={state.cellGap} max={0.45} onChange={value => setPresentation({ cellGap: value })} /></PixGridHistoryGesture>
            <HelpInfoTrigger
              helpId="react.pixGrid.design.grid.cellGap"
              currentValue={`${Math.round(state.cellGap * 100)}%`}
              placement="left"
            />
          </div>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <PixGridHistoryGesture><SliderRow label="Cell Roundness" value={state.cellRoundness} max={0.5} onChange={value => setPresentation({ cellRoundness: value })} /></PixGridHistoryGesture>
            <HelpInfoTrigger
              helpId="react.pixGrid.design.grid.cellRoundness"
              currentValue={`${Math.round(state.cellRoundness * 100)}%`}
              placement="left"
            />
          </div>
          <PixGridHistoryGesture><SliderRow label="Cell Calibration" value={state.cellBrightness} onChange={value => setPresentation({ cellBrightness: value })} description="Advanced emitter calibration retained for compatibility." /></PixGridHistoryGesture>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <PixGridHistoryGesture><SliderRow label="Glow" value={state.glowAmount} onChange={value => setPresentation({ glowAmount: value })} description="Emitter halo strength." /></PixGridHistoryGesture>
            <HelpInfoTrigger
              helpId="react.pixGrid.performanceAndMatrix.ledMatrix.glow"
              currentValue={`${Math.round(state.glowAmount * 100)}%`}
              placement="left"
            />
          </div>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <PixGridHistoryGesture><SliderRow label="Diffusion" value={state.diffusion} onChange={value => setPresentation({ diffusion: value })} description="Emitter edge softness." /></PixGridHistoryGesture>
            <HelpInfoTrigger
              helpId="react.pixGrid.performanceAndMatrix.ledMatrix.diffusion"
              currentValue={`${Math.round(state.diffusion * 100)}%`}
              placement="left"
            />
          </div>
          <div className="rv-pix-grid-design-control-help drm-help-overlay-anchor">
            <ToggleRow label="RGB Subpixels" value={state.rgbSubpixelMode} onChange={value => setPresentation({ rgbSubpixelMode: value })} />
            <HelpInfoTrigger
              helpId="react.pixGrid.performanceAndMatrix.ledMatrix.rgbSubpixelMode"
              currentValue={state.rgbSubpixelMode ? 'On' : 'Off'}
              currentValueLabel="Status"
              currentValueTone={state.rgbSubpixelMode ? 'accent' : 'default'}
              placement="left"
            />
          </div>
          <ToggleRow label="Cell Guides" value={state.editor.guidesVisible} onChange={value => updateEditor({ guidesVisible: value })} />
        </DesignSection>
      )}

      {surface === 'scene' && (
        <DesignSection label="Scene" grouped={groupedSections}>
          <TextInputRow
            label="Name"
            value={sceneName}
            maxLength={96}
            onChange={setSceneName}
            onBlur={() => {
              if (sceneName.trim() && sceneName.trim() !== scene.name) applyState(renamePixGridScene(state, scene.id, sceneName))
              else setSceneName(scene.name)
            }}
          />
          <div className="rv-ctrl-info">{scene.layerIds.length} layers · {scene.pixelOverrides.length} sparse pixel overrides</div>
        </DesignSection>
      )}

      {surface === 'layer' && layer && (
        <DesignSection label="Layer" grouped={groupedSections}>
          <div className="rv-ctrl-info"><strong>{layer.name}</strong><br />{layer.mediaId ? 'Media Library artwork' : layer.assetId}</div>
          <ToggleRow label="Visible" value={layer.visible} onChange={value => updateLayer({ visible: value })} />
          <ToggleRow label="Locked" value={layer.locked === true} onChange={value => applyState(updatePixGridLayer(state, layer.id, { locked: value }))} />
          <PixGridHistoryGesture><SliderRow label="Opacity" value={layer.opacity} onChange={value => updateLayer({ opacity: value })} /></PixGridHistoryGesture>
          <PixGridHistoryGesture><SliderRow label="Position X" value={layer.position.x} onChange={value => updateLayer({ position: { ...layer.position, x: value } })} /></PixGridHistoryGesture>
          <PixGridHistoryGesture><SliderRow label="Position Y" value={layer.position.y} onChange={value => updateLayer({ position: { ...layer.position, y: value } })} /></PixGridHistoryGesture>
          <PixGridHistoryGesture><SliderRow label="Scale X" value={layer.scale.x} min={0.01} max={2} step={0.01} onChange={value => updateLayer({ scale: { ...layer.scale, x: value } })} /></PixGridHistoryGesture>
          <PixGridHistoryGesture><SliderRow label="Scale Y" value={layer.scale.y} min={0.01} max={2} step={0.01} onChange={value => updateLayer({ scale: { ...layer.scale, y: value } })} /></PixGridHistoryGesture>
          <PixGridHistoryGesture><SliderRow label="Rotation" value={layer.rotation} min={-180} max={180} step={1} onChange={value => updateLayer({ rotation: value })} /></PixGridHistoryGesture>
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => applyState(resetPixGridLayerTransform(state, layer.id))}>Reset Transform</button>
            <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => applyState(duplicatePixGridLayer(state, layer.id))}>Duplicate</button>
            <button type="button" className="rv-reset-btn" disabled={layer.locked} onClick={() => applyState(deletePixGridLayer(state, layer.id))}>Delete</button>
          </div>
        </DesignSection>
      )}

      {surface === 'selection' && state.editor.selection && (
        <DesignSection label="Selection" grouped={groupedSections}>
          <div className="rv-ctrl-info">X {state.editor.selection.x} · Y {state.editor.selection.y} · {state.editor.selection.width} × {state.editor.selection.height}</div>
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" onClick={() => {
              begin(); applyState(applyPixGridPoints(state, selectionPoints(state), { kind: 'restore' })); commit()
            }}>Restore Inherited</button>
            <button type="button" className="rv-reset-btn" onClick={() => {
              begin(); applyState(applyPixGridPoints(state, selectionPoints(state), { kind: 'off' })); commit()
            }}>Clear / Off</button>
            <button type="button" className="rv-reset-btn" onClick={() => updateEditor({ selection: null })}>Deselect</button>
          </div>
        </DesignSection>
      )}

      {surface === 'tool' && (
        <DesignSection label="Tool Settings" grouped={groupedSections}>
          <SelectRow label="Tool" value={state.editorTool} options={TOOL_OPTIONS} onChange={value => setState({ editorTool: value as PixGridEditorTool })} />
          <ColorRow
            label="Paint Color"
            value={state.editor.paintColor}
            onChange={paintColor => updateEditor({ paintColor })}
            description="The active paint, fill, line, and rectangle color."
          />
          <SliderRow label="Paint Opacity" value={state.editor.paintOpacity} onChange={value => updateEditor({ paintOpacity: value })} />
          <SelectRow
            label="Eraser Behavior"
            value={state.editor.eraserMode}
            options={[{ value: 'off', label: 'Clear / Force Off' }, { value: 'restore', label: 'Restore Inherited' }]}
            onChange={value => updateEditor({ eraserMode: value as 'off' | 'restore' })}
          />
          <SliderRow label="Zoom" value={state.editor.zoom} min={0.25} max={16} step={0.05} onChange={value => updateEditor({ zoom: value })} />
          <div className="rv-ctrl-action-row">
            <button type="button" className="rv-reset-btn" onClick={() => updateEditor({ zoom: 1, panX: 0, panY: 0 })}>Reset View</button>
          </div>
        </DesignSection>
      )}
    </div>
  )
}
