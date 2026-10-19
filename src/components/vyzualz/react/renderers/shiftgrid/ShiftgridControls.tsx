import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { IconChipButton } from '../../controls/IconChipButton'
import { dispatchShiftgridCommand } from './ShiftgridCommandBus'
import {
  CANVAS_SHIFTGRID_EASING_OPTIONS,
  CANVAS_SHIFTGRID_GRID_PRESET_OPTIONS,
  CANVAS_SHIFTGRID_FIT_MODE_OPTIONS,
  CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS,
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_QUALITY_OPTIONS,
  CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS,
  CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS,
  CANVAS_SHIFTGRID_TRIGGER_OPTIONS,
  CANVAS_SHIFTGRID_WAVE_ROUTE_OPTIONS,
  type CanvasShiftgridEasing,
  type CanvasShiftgridGridPreset,
  type CanvasShiftgridFitMode,
  type CanvasShiftgridMosaicType,
  type CanvasShiftgridPattern,
  type CanvasShiftgridPoolSelectionMode,
  type CanvasShiftgridQuality,
  type CanvasShiftgridReconstructionMode,
  type CanvasShiftgridSourceMode,
  type CanvasShiftgridTileShape,
  type CanvasShiftgridTrigger,
  type CanvasShiftgridWaveRoute,
} from './ShiftgridSettings'

export function ShiftgridDesignControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.shiftgrid)
  const setPresetSettings = useReactStore(state => state.setCanvasPresetSettings)
  const reset = useReactStore(state => state.resetCanvasPresetSettings)
  const activeMediaId = useReactStore(state => state.activeCanvasMediaId)
  const set = (patch: Partial<typeof settings>) => setPresetSettings({ shiftgrid: { ...settings, ...patch } })

  return (
    <>
      <Collapsible label="SHIFTGRID Source" defaultOpen>
        <SelectRow label="Source Mode" value={settings.sourceMode} onChange={value => set({ sourceMode: value as CanvasShiftgridSourceMode })} options={[...CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS]} description="Single uses active CANVAS media. Pool uses the active Media Pool. Auto prefers a populated active pool." />
        <SelectRow label="Mosaic Type" value={settings.mosaicType} onChange={value => set({ mosaicType: value as CanvasShiftgridMosaicType })} options={[...CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS]} description="Combines independently with the selected tile choreography pattern." />
        <SelectRow label="Pool Selection" value={settings.poolSelectionMode} onChange={value => set({ poolSelectionMode: value as CanvasShiftgridPoolSelectionMode })} options={[...CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS]} disabled={settings.sourceMode === 'single'} />
        <ToggleRow label="Avoid Immediate Repeat" value={settings.avoidImmediateRepeat} onChange={avoidImmediateRepeat => set({ avoidImmediateRepeat })} disabled={settings.sourceMode === 'single'} />
        <NumberInputRow label="Pool Source Limit" value={settings.poolSourceLimit} onChange={poolSourceLimit => set({ poolSourceLimit })} min={1} max={10} step={1} disabled={settings.sourceMode === 'single'} description="Bounded by the canonical ten-handle Canvas media budget, independent of the authored-layer limit." />
        <NumberInputRow label="Source Hold" value={settings.sourceHoldDurationSec} onChange={sourceHoldDurationSec => set({ sourceHoldDurationSec })} min={0.5} max={30} step={0.5} unit="sec" disabled={settings.mosaicType === 'singleImage'} />
        <SelectRow label="Wave Route" value={settings.waveRoute} onChange={value => set({ waveRoute: value as CanvasShiftgridWaveRoute })} options={[...CANVAS_SHIFTGRID_WAVE_ROUTE_OPTIONS]} disabled={settings.mosaicType !== 'travelingImageWave' && settings.mosaicType !== 'autoMosaic'} />
        <div className="rv-ctrl-action-row" aria-label="SHIFTGRID primary target selection">
          <IconChipButton onClick={() => set({ primaryTargetMediaId: activeMediaId })} disabled={!activeMediaId}>Use Active as Target</IconChipButton>
          <IconChipButton onClick={() => set({ primaryTargetMediaId: null })} disabled={!settings.primaryTargetMediaId}>Automatic Target</IconChipButton>
        </div>
      </Collapsible>
      <Collapsible label="Grid" defaultOpen>
        <SelectRow label="Layout" value={settings.gridPreset} onChange={value => set({ gridPreset: value as CanvasShiftgridGridPreset, gridMode: value === 'auto' ? 'auto' : 'fixed' })} options={[...CANVAS_SHIFTGRID_GRID_PRESET_OPTIONS]} />
        <NumberInputRow label="Columns" value={settings.gridColumns} onChange={gridColumns => set({ gridColumns })} min={2} max={32} step={1} disabled={settings.gridPreset !== 'custom'} />
        <NumberInputRow label="Rows" value={settings.gridRows} onChange={gridRows => set({ gridRows })} min={2} max={24} step={1} disabled={settings.gridPreset !== 'custom'} />
        <SelectRow label="Tile Shape" value={settings.tileShape} onChange={value => set({ tileShape: value as CanvasShiftgridTileShape })} options={[...CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS]} />
        <SelectRow label="Image Fit" value={settings.fitMode} onChange={value => set({ fitMode: value as CanvasShiftgridFitMode })} options={[...CANVAS_SHIFTGRID_FIT_MODE_OPTIONS]} description="Contain preserves the complete source; Cover crops without distortion." />
      </Collapsible>
      <Collapsible label="Reconstruction" defaultOpen>
        <SelectRow label="Strategy" value={settings.reconstructionMode} onChange={value => set({ reconstructionMode: value as CanvasShiftgridReconstructionMode })} options={[...CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS]} description="Phrase and Drop boundaries are exposed now; Audio Intelligence will drive them in P4." />
        <SliderRow label="Reconstruction Speed" value={settings.reconstructionSpeed} onChange={reconstructionSpeed => set({ reconstructionSpeed })} color="#4ac7db" />
        <NumberInputRow label="Progressive Duration" value={settings.progressiveResolveDurationSec} onChange={progressiveResolveDurationSec => set({ progressiveResolveDurationSec })} min={1} max={60} step={1} unit="sec" disabled={settings.reconstructionMode !== 'progressiveResolve'} />
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
      <div className="rv-ctrl-action-row" aria-label="SHIFTGRID prototype actions">
        <IconChipButton onClick={() => dispatchShiftgridCommand('showOriginal')}>Show Original</IconChipButton>
        <IconChipButton onClick={() => dispatchShiftgridCommand('scramble')}>Scramble</IconChipButton>
        <IconChipButton onClick={() => dispatchShiftgridCommand('slideSwap')}>Slide / Swap</IconChipButton>
        <IconChipButton tone="primary" onClick={() => dispatchShiftgridCommand('reconstruct')}>Reconstruct Now</IconChipButton>
      </div>
      <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
      <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} disabled description="Audio Intelligence timing arrives in P4; P2 playback is deterministic on its own timeline." />
      <SelectRow label="Pattern" value={settings.choreographyPattern} onChange={value => set({ choreographyPattern: value as CanvasShiftgridPattern })} options={[...CANVAS_SHIFTGRID_PATTERN_OPTIONS]} />
      <ToggleRow label="Pattern Change" value={settings.patternChange} onChange={patternChange => set({ patternChange })} />
      <SelectRow label="Trigger" value={settings.trigger} onChange={value => set({ trigger: value as CanvasShiftgridTrigger })} options={[...CANVAS_SHIFTGRID_TRIGGER_OPTIONS]} disabled={!settings.patternChange} />
      <SliderRow label="Motion Intensity" value={settings.movementAmount} onChange={movementAmount => set({ movementAmount })} color="#61d6aa" />
      <SliderRow label="Slide Speed" value={settings.movementSpeed} onChange={movementSpeed => set({ movementSpeed })} min={0} max={2} step={0.01} color="#4ac7db" />
      <SliderRow label="Movement Stagger" value={settings.stagger} onChange={stagger => set({ stagger })} color="#ff4fd8" />
      <SliderRow label="Snap Strength" value={settings.snapStrength} onChange={snapStrength => set({ snapStrength })} color="#d8b95a" />
      <SliderRow label="Scramble Complexity" value={settings.scrambleComplexity} onChange={scrambleComplexity => set({ scrambleComplexity })} color="#8de7ff" />
      <SelectRow label="Easing" value={settings.easing} onChange={value => set({ easing: value as CanvasShiftgridEasing })} options={[...CANVAS_SHIFTGRID_EASING_OPTIONS]} />
    </Collapsible>
  )
}
