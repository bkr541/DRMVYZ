import { useMemo } from 'react'
import { useMediaStore, type UploadedMedia } from '../../../../../stores/mediaStore'
import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { IconChipButton } from '../../controls/IconChipButton'
import { dispatchShiftgridCommand } from './ShiftgridCommandBus'
import {
  CANVAS_SHIFTGRID_FIT_MODE_OPTIONS,
  CANVAS_SHIFTGRID_INSPECTOR_GRID_PRESET_OPTIONS,
  CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS,
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS,
  CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS,
  CANVAS_SHIFTGRID_TRIGGER_OPTIONS,
  CANVAS_SHIFTGRID_WAVE_ROUTE_OPTIONS,
  DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  applyShiftgridAutoPerformance,
  applyShiftgridManualPattern,
  applyShiftgridPatternChange,
  applyShiftgridSourceMode,
  type CanvasShiftgridFitMode,
  type CanvasShiftgridGridPreset,
  type CanvasShiftgridMosaicType,
  type CanvasShiftgridPattern,
  type CanvasShiftgridPoolSelectionMode,
  type CanvasShiftgridReconstructionMode,
  type CanvasShiftgridSettings,
  type CanvasShiftgridSourceMode,
  type CanvasShiftgridTileShape,
  type CanvasShiftgridTrigger,
  type CanvasShiftgridWaveRoute,
} from './ShiftgridSettings'

const NO_POOL = ''

function eligiblePoolImage(item: UploadedMedia): boolean {
  if (item.type !== 'image') return false
  const mime = item.mimeType?.toLowerCase() ?? ''
  if (mime) return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(mime)
  return /\.(png|jpe?g|webp|svg)(?:$|[?#])/i.test(item.url)
}

/** SHIFTGRID's complete Design-tab surface, using only canonical control rows. */
export function ShiftgridDesignControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.shiftgrid)
  const setPresetSettings = useReactStore(state => state.setCanvasPresetSettings)
  const reset = useReactStore(state => state.resetCanvasPresetSettings)
  const activeMediaId = useReactStore(state => state.activeCanvasMediaId)
  const legacyMedia = useReactStore(state => state.canvasMediaItems)
  const mediaPools = useReactStore(state => state.canvasOrchestrationSettings.mediaPools)
  const activeMediaPoolId = useReactStore(state => state.canvasOrchestrationSettings.activeMediaPoolId)
  const setActiveCanvasMediaPool = useReactStore(state => state.setActiveCanvasMediaPool)
  const libraryMedia = useMediaStore(state => state.items)
  const defaults = DEFAULT_CANVAS_SHIFTGRID_SETTINGS
  const set = (patch: Partial<CanvasShiftgridSettings>) => setPresetSettings({ shiftgrid: { ...settings, ...patch } })

  const poolOptions = useMemo(() => [
    { value: NO_POOL, label: mediaPools.length === 0 ? 'No Pools yet' : 'No Pool selected' },
    ...mediaPools.map(pool => ({ value: pool.id, label: `${pool.name} · ${pool.mediaIds.length + pool.textItems.length}` })),
  ], [mediaPools])
  const activePool = mediaPools.find(pool => pool.id === activeMediaPoolId) ?? null
  const eligibleIds = useMemo(() => new Set([
    ...libraryMedia.filter(eligiblePoolImage).map(item => item.id),
    ...legacyMedia.filter(item => item.type === 'svg' || (item.type === 'image' && /\.(png|jpe?g|webp|svg)(?:$|[?#])/i.test(item.objectUrl))).map(item => item.id),
  ]), [legacyMedia, libraryMedia])
  const eligiblePoolCount = activePool?.mediaIds.filter(id => eligibleIds.has(id)).length ?? 0
  const poolMode = settings.sourceMode !== 'single'
  const multiImageActive = poolMode && eligiblePoolCount >= 2
  const effectsActive = settings.enhancedEffects

  const slider = (
    key: keyof CanvasShiftgridSettings & string,
    label: string,
    color: string,
    description?: string,
    extra: { min?: number; max?: number; step?: number } = {},
  ) => (
    <SliderRow
      label={label}
      value={settings[key] as number}
      onChange={value => set({ [key]: value } as Partial<CanvasShiftgridSettings>)}
      min={extra.min ?? 0}
      max={extra.max ?? 1}
      step={extra.step ?? 0.01}
      color={color}
      resetValue={defaults[key] as number}
      description={description}
    />
  )

  return (
    <>
      <Collapsible label="Master Controls" defaultOpen>
        {slider('masterIntensity', 'Master Intensity', '#8de7ff', 'Scales SHIFTGRID performance motion and effect accents without changing image crop, grid geometry, or source identity.')}
        <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} description="Locks movement durations and structural changes to the qualified shared musical grid." />
        <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set(applyShiftgridAutoPerformance(settings, autoPerformance))} description="Lets Audio Intelligence choose temporary runtime choreography without overwriting the authored Pattern." />
        <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
          <div className="rv-ctrl-toggle-line">
            <span className="rv-ctrl-label">SHIFTGRID</span>
            <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={reset} aria-label="Reset SHIFTGRID settings">Reset</button>
          </div>
        </div>
      </Collapsible>

      <Collapsible label="Design" defaultOpen>
        <SelectRow label="Media Mode" value={settings.sourceMode} onChange={value => set(applyShiftgridSourceMode(settings, value as CanvasShiftgridSourceMode))} options={[...CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS]} description="Auto uses the active pool when it has multiple supported images, otherwise the active CANVAS image." />
        {poolMode && <SelectRow label="Media Pool" value={activeMediaPoolId ?? NO_POOL} onChange={value => setActiveCanvasMediaPool(value === NO_POOL ? null : value)} options={poolOptions} description={mediaPools.length === 0 ? 'Create a Pool in the Media Library → Pools tab, then add PNG, JPEG, WebP, or SVG media.' : `${eligiblePoolCount} eligible image${eligiblePoolCount === 1 ? '' : 's'} in the active pool.`} />}
        {multiImageActive && <SelectRow label="Mosaic Type" value={settings.mosaicType} onChange={value => set({ mosaicType: value as CanvasShiftgridMosaicType })} options={[...CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS]} description="Source assignment remains independent from the selected movement Pattern." />}
        <SelectRow label="Grid Layout" value={settings.gridPreset === 'custom' ? 'auto' : settings.gridPreset} onChange={value => set({ gridPreset: value as CanvasShiftgridGridPreset, gridMode: value === 'auto' ? 'auto' : 'fixed' })} options={[...CANVAS_SHIFTGRID_INSPECTOR_GRID_PRESET_OPTIONS]} />
        <SelectRow label="Tile Shape" value={settings.tileShape} onChange={value => set({ tileShape: value as CanvasShiftgridTileShape })} options={[...CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS]} />
        <SelectRow label="Image Fit" value={settings.fitMode} onChange={value => set({ fitMode: value as CanvasShiftgridFitMode })} options={[...CANVAS_SHIFTGRID_FIT_MODE_OPTIONS]} description="Contain preserves the complete image; Cover crops without stretching." />
        {multiImageActive && <SelectRow label="Source Selection" value={settings.poolSelectionMode === 'random' ? 'shuffle' : settings.poolSelectionMode} onChange={value => set({ poolSelectionMode: value as CanvasShiftgridPoolSelectionMode })} options={[...CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS]} />}
        {multiImageActive && <ToggleRow label="Avoid Immediate Repeat" value={settings.avoidImmediateRepeat} onChange={avoidImmediateRepeat => set({ avoidImmediateRepeat })} />}
        {multiImageActive && <NumberInputRow label="Source Hold" value={settings.sourceHoldDurationSec} onChange={sourceHoldDurationSec => set({ sourceHoldDurationSec })} min={0.5} max={30} step={0.5} unit="sec" description="Minimum time a complete-image target remains eligible before the next structural source event." />}
        {multiImageActive && (settings.mosaicType === 'travelingImageWave' || settings.mosaicType === 'autoMosaic') && <SelectRow label="Wave Route" value={settings.waveRoute} onChange={value => set({ waveRoute: value as CanvasShiftgridWaveRoute })} options={[...CANVAS_SHIFTGRID_WAVE_ROUTE_OPTIONS]} />}
        {multiImageActive && <div className="rv-ctrl-action-row" aria-label="SHIFTGRID primary reconstruction target">
          <IconChipButton onClick={() => set({ primaryTargetMediaId: activeMediaId })} disabled={!activeMediaId}>Use Active as Target</IconChipButton>
          <IconChipButton onClick={() => set({ primaryTargetMediaId: null })} disabled={!settings.primaryTargetMediaId}>Automatic Target</IconChipButton>
        </div>}
      </Collapsible>

      <Collapsible label="Choreography" defaultOpen>
        <SelectRow label="Pattern" value={settings.choreographyPattern} onChange={value => set(applyShiftgridManualPattern(settings, value as CanvasShiftgridPattern))} options={[...CANVAS_SHIFTGRID_PATTERN_OPTIONS]} />
        <ToggleRow label="Pattern Change" value={settings.patternChange} onChange={patternChange => set(applyShiftgridPatternChange(settings, patternChange))} description="Advances through a deterministic non-repeating cycle only when the selected Trigger publishes a new event." />
        {settings.patternChange && <SelectRow label="Trigger" value={settings.trigger} onChange={value => set({ trigger: value as CanvasShiftgridTrigger })} options={[...CANVAS_SHIFTGRID_TRIGGER_OPTIONS]} />}
        {slider('scrambleComplexity', 'Scramble Complexity', '#8de7ff')}
        {slider('movementSpeed', 'Slide Speed', '#4ac7db', undefined, { min: 0, max: 2, step: 0.01 })}
        {slider('movementAmount', 'Movement Intensity', '#61d6aa')}
        {slider('stagger', 'Movement Stagger', '#ff4fd8')}
        {slider('snapStrength', 'Snap Strength', '#d8b95a')}
        <SelectRow label="Reconstruction Behavior" value={settings.reconstructionMode} onChange={value => set({ reconstructionMode: value as CanvasShiftgridReconstructionMode })} options={[...CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS]} />
        {slider('reconstructionSpeed', 'Reconstruction Speed', '#4ac7db')}
        {settings.reconstructionMode === 'progressiveResolve' && <NumberInputRow label="Progressive Duration" value={settings.progressiveResolveDurationSec} onChange={progressiveResolveDurationSec => set({ progressiveResolveDurationSec })} min={1} max={60} step={1} unit="sec" />}
        <div className="rv-ctrl-action-row" aria-label="SHIFTGRID reconstruction action">
          <IconChipButton tone="primary" onClick={() => dispatchShiftgridCommand('reconstruct')}>Reconstruct Now</IconChipButton>
        </div>
      </Collapsible>

      <Collapsible label="Effects" defaultOpen>
        <ToggleRow label="Effects Enabled" value={settings.enhancedEffects} onChange={enhancedEffects => set({ enhancedEffects })} description="Off preserves clean source pixels and disables every optional tile treatment." />
        {effectsActive && <>
          <ToggleRow label="Tile Edge Glow" value={settings.tileEdgeGlowEnabled} onChange={tileEdgeGlowEnabled => set({ tileEdgeGlowEnabled })} />
          {settings.tileEdgeGlowEnabled && slider('edgeGlow', 'Edge Glow Strength', '#72fff0')}
          <ToggleRow label="Light Trails" value={settings.lightTrailsEnabled} onChange={lightTrailsEnabled => set({ lightTrailsEnabled })} />
          {settings.lightTrailsEnabled && slider('lightTrails', 'Trail Strength', '#8de7ff')}
          <ToggleRow label="Motion Blur" value={settings.motionBlurEnabled} onChange={motionBlurEnabled => set({ motionBlurEnabled })} />
          {settings.motionBlurEnabled && slider('motionBlur', 'Blur Strength', '#9ddcff')}
          <ToggleRow label="RGB Separation" value={settings.rgbSeparationEnabled} onChange={rgbSeparationEnabled => set({ rgbSeparationEnabled })} />
          {settings.rgbSeparationEnabled && slider('chromaticSplit', 'RGB Separation Strength', '#ff4fd8')}
          <ToggleRow label="Beat Pulse" value={settings.beatPulseEnabled} onChange={beatPulseEnabled => set({ beatPulseEnabled })} />
          {settings.beatPulseEnabled && slider('beatPulse', 'Beat Pulse Strength', '#61d6aa')}
          <ToggleRow label="Snap Flash" value={settings.snapFlashEnabled} onChange={snapFlashEnabled => set({ snapFlashEnabled })} />
          {settings.snapFlashEnabled && slider('snapFlash', 'Snap Flash Strength', '#f5e37b')}
          <ToggleRow label="Tile Gap" value={settings.tileGapEnabled} onChange={tileGapEnabled => set({ tileGapEnabled })} />
          {settings.tileGapEnabled && slider('tileGap', 'Tile Gap Size', '#d8b95a', 'Shrinks each destination cell without changing source crop or tile identity.', { min: 0, max: 0.2, step: 0.005 })}
        </>}
      </Collapsible>
    </>
  )
}

/** P5 consolidates SHIFTGRID authoring in DESIGN; REACT keeps shared routing/analysis only. */
export function ShiftgridReactControls() {
  return null
}
