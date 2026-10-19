import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import {
  CANVAS_SHIFTGRID_EASING_OPTIONS,
  CANVAS_SHIFTGRID_GRID_MODE_OPTIONS,
  CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS,
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_QUALITY_OPTIONS,
  CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS,
  CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS,
  CANVAS_SHIFTGRID_TRIGGER_OPTIONS,
  type CanvasShiftgridEasing,
  type CanvasShiftgridGridMode,
  type CanvasShiftgridMosaicType,
  type CanvasShiftgridPattern,
  type CanvasShiftgridPoolSelectionMode,
  type CanvasShiftgridQuality,
  type CanvasShiftgridReconstructionMode,
  type CanvasShiftgridSourceMode,
  type CanvasShiftgridTileShape,
  type CanvasShiftgridTrigger,
} from './ShiftgridSettings'

export function ShiftgridDesignControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.shiftgrid)
  const setPresetSettings = useReactStore(state => state.setCanvasPresetSettings)
  const reset = useReactStore(state => state.resetCanvasPresetSettings)
  const set = (patch: Partial<typeof settings>) => setPresetSettings({ shiftgrid: { ...settings, ...patch } })

  return (
    <>
      <Collapsible label="SHIFTGRID Source" defaultOpen>
        <SelectRow label="Source Mode" value={settings.sourceMode} onChange={value => set({ sourceMode: value as CanvasShiftgridSourceMode })} options={[...CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS]} description="Single uses active CANVAS media. Pool uses the active Media Pool. Auto prefers a populated active pool." />
        <SelectRow label="Mosaic Type" value={settings.mosaicType} onChange={value => set({ mosaicType: value as CanvasShiftgridMosaicType })} options={[...CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS]} />
        <SelectRow label="Pool Selection" value={settings.poolSelectionMode} onChange={value => set({ poolSelectionMode: value as CanvasShiftgridPoolSelectionMode })} options={[...CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS]} disabled={settings.sourceMode === 'single'} />
        <ToggleRow label="Avoid Immediate Repeat" value={settings.avoidImmediateRepeat} onChange={avoidImmediateRepeat => set({ avoidImmediateRepeat })} disabled={settings.sourceMode === 'single'} />
        <NumberInputRow label="Pool Source Limit" value={settings.poolSourceLimit} onChange={poolSourceLimit => set({ poolSourceLimit })} min={1} max={64} step={1} disabled={settings.sourceMode === 'single'} description="Independent of CANVAS's four authored-layer compositor limit." />
      </Collapsible>
      <Collapsible label="Grid" defaultOpen>
        <SelectRow label="Grid Mode" value={settings.gridMode} onChange={value => set({ gridMode: value as CanvasShiftgridGridMode })} options={[...CANVAS_SHIFTGRID_GRID_MODE_OPTIONS]} />
        <NumberInputRow label="Columns" value={settings.gridColumns} onChange={gridColumns => set({ gridColumns })} min={2} max={32} step={1} disabled={settings.gridMode === 'auto'} />
        <NumberInputRow label="Rows" value={settings.gridRows} onChange={gridRows => set({ gridRows })} min={2} max={24} step={1} disabled={settings.gridMode === 'auto'} />
        <SelectRow label="Tile Shape" value={settings.tileShape} onChange={value => set({ tileShape: value as CanvasShiftgridTileShape })} options={[...CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS]} />
      </Collapsible>
      <Collapsible label="Reconstruction" defaultOpen>
        <SelectRow label="Behavior" value={settings.reconstructionMode} onChange={value => set({ reconstructionMode: value as CanvasShiftgridReconstructionMode })} options={[...CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS]} />
        <SliderRow label="Strength" value={settings.reconstructionStrength} onChange={reconstructionStrength => set({ reconstructionStrength })} color="#61d6aa" />
        <SliderRow label="Return Rate" value={settings.reconstructionRate} onChange={reconstructionRate => set({ reconstructionRate })} color="#4ac7db" />
        <NumberInputRow label="Hold" value={settings.holdBeats} onChange={holdBeats => set({ holdBeats })} min={0} max={32} step={1} unit="beats" />
      </Collapsible>
      <Collapsible label="Visual Quality" defaultOpen={false}>
        <SelectRow label="Quality" value={settings.quality} onChange={value => set({ quality: value as CanvasShiftgridQuality })} options={[...CANVAS_SHIFTGRID_QUALITY_OPTIONS]} />
        <SliderRow label="Render Scale" value={settings.renderScale} onChange={renderScale => set({ renderScale })} min={0.5} max={1} step={0.05} color="#8de7ff" />
        <NumberInputRow label="Tile Budget" value={settings.tileBudget} onChange={tileBudget => set({ tileBudget })} min={16} max={768} step={1} />
        <NumberInputRow label="Deterministic Seed" value={settings.deterministicSeed} onChange={deterministicSeed => set({ deterministicSeed })} min={0} max={999999999} step={1} />
        <ToggleRow label="Enhanced Effects" value={settings.enhancedEffects} onChange={enhancedEffects => set({ enhancedEffects })} />
        <SliderRow label="Depth" value={settings.depthAmount} onChange={depthAmount => set({ depthAmount })} color="#d8b95a" disabled={!settings.enhancedEffects} />
        <SliderRow label="Edge Glow" value={settings.edgeGlow} onChange={edgeGlow => set({ edgeGlow })} color="#72fff0" disabled={!settings.enhancedEffects} />
        <SliderRow label="Chromatic Split" value={settings.chromaticSplit} onChange={chromaticSplit => set({ chromaticSplit })} color="#ff4fd8" disabled={!settings.enhancedEffects} />
        <SliderRow label="Motion Blur" value={settings.motionBlur} onChange={motionBlur => set({ motionBlur })} color="#9ddcff" disabled={!settings.enhancedEffects} />
        <SliderRow label="Edge Feather" value={settings.edgeFeather} onChange={edgeFeather => set({ edgeFeather })} min={0} max={0.5} step={0.01} color="#e8f4f8" />
      </Collapsible>
      <button type="button" className="rv-reset-btn" onClick={reset}>Reset SHIFTGRID</button>
    </>
  )
}

export function ShiftgridReactControls() {
  const selected = useReactStore(state => state.selectedCanvasPresetId === 'canvas-shiftgrid')
  const settings = useReactStore(state => state.canvasPresetSettings.shiftgrid)
  const setPresetSettings = useReactStore(state => state.setCanvasPresetSettings)
  if (!selected) return null
  const set = (patch: Partial<typeof settings>) => setPresetSettings({ shiftgrid: { ...settings, ...patch } })
  return (
    <Collapsible label="SHIFTGRID Choreography" defaultOpen>
      <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
      <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
      <SelectRow label="Pattern" value={settings.choreographyPattern} onChange={value => set({ choreographyPattern: value as CanvasShiftgridPattern })} options={[...CANVAS_SHIFTGRID_PATTERN_OPTIONS]} />
      <ToggleRow label="Pattern Change" value={settings.patternChange} onChange={patternChange => set({ patternChange })} />
      <SelectRow label="Trigger" value={settings.trigger} onChange={value => set({ trigger: value as CanvasShiftgridTrigger })} options={[...CANVAS_SHIFTGRID_TRIGGER_OPTIONS]} disabled={!settings.patternChange} />
      <SliderRow label="Movement" value={settings.movementAmount} onChange={movementAmount => set({ movementAmount })} color="#61d6aa" />
      <SliderRow label="Speed" value={settings.movementSpeed} onChange={movementSpeed => set({ movementSpeed })} min={0} max={2} step={0.01} color="#4ac7db" />
      <SliderRow label="Travel Distance" value={settings.travelDistance} onChange={travelDistance => set({ travelDistance })} min={0} max={2} step={0.01} color="#d8b95a" />
      <SliderRow label="Stagger" value={settings.stagger} onChange={stagger => set({ stagger })} color="#ff4fd8" />
      <SelectRow label="Easing" value={settings.easing} onChange={value => set({ easing: value as CanvasShiftgridEasing })} options={[...CANVAS_SHIFTGRID_EASING_OPTIONS]} />
    </Collapsible>
  )
}
