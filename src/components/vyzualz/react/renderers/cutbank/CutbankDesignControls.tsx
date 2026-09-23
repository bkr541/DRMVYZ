import { useMemo } from 'react'
import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, ColorRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { holdSliderToBeats, snapHoldBeats, cutRateToIntervalBeats } from './CutbankClock'
import { autoPaletteBars } from './CutbankPalette'
import {
  CANVAS_CUTBANK_LAYOUT_MODE_OPTIONS,
  CANVAS_CUTBANK_MEDIA_MODE_OPTIONS,
  CANVAS_CUTBANK_PALETTE_MODE_OPTIONS,
  CANVAS_CUTBANK_SELECTION_MODE_OPTIONS,
  CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS,
  CANVAS_CUTBANK_TREATMENT_MODE_OPTIONS,
  DEFAULT_CANVAS_CUTBANK_SETTINGS,
  type CanvasCutbankLayoutMode,
  type CanvasCutbankMediaMode,
  type CanvasCutbankPaletteMode,
  type CanvasCutbankSelectionMode,
  type CanvasCutbankSettings,
  type CanvasCutbankTransitionStyle,
  type CanvasCutbankTreatmentMode,
} from './CutbankSettings'

const NO_POOL = ''

function beatsLabel(beats: number): string {
  if (beats < 1) return `${beats} beat`
  return `${Number.isInteger(beats) ? beats : beats.toFixed(1)} beat${beats === 1 ? '' : 's'}`
}

/**
 * CUTBANK's Design-tab surface: exactly four parent groups (Master Controls,
 * Design, Effects, Palette) built from the shared DRMVYZ control rows. Rows
 * whose effect is impossible in the current configuration are hidden rather than
 * shown inert.
 */
export function CutbankDesignControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.cutbank)
  const setCanvasPresetSettings = useReactStore(state => state.setCanvasPresetSettings)
  const resetCanvasPresetSettings = useReactStore(state => state.resetCanvasPresetSettings)
  const mediaPools = useReactStore(state => state.canvasOrchestrationSettings.mediaPools)
  const activeMediaPoolId = useReactStore(state => state.canvasOrchestrationSettings.activeMediaPoolId)
  const setActiveCanvasMediaPool = useReactStore(state => state.setActiveCanvasMediaPool)

  const set = (patch: Partial<CanvasCutbankSettings>) => setCanvasPresetSettings({ cutbank: { ...settings, ...patch } })
  const poolOptions = useMemo(() => [
    { value: NO_POOL, label: mediaPools.length === 0 ? 'No Pools yet' : 'No Pool selected' },
    ...mediaPools.map(pool => ({ value: pool.id, label: `${pool.name} · ${pool.mediaIds.length + pool.textItems.length}` })),
  ], [mediaPools])

  const holdLabel = (value: number) => {
    const beats = holdSliderToBeats(value)
    return settings.bpmSync ? beatsLabel(snapHoldBeats(beats)) : `${beatsLabel(beats)} at the fallback tempo`
  }
  const effectsActive = settings.effectsEnabled && settings.treatmentMode !== 'none'
  const autoTreatment = settings.treatmentMode === 'auto'
  const paletteUsesAccents = settings.paletteMode === 'custom' || settings.paletteMode === 'auto'
  const defaults = DEFAULT_CANVAS_CUTBANK_SETTINGS

  const slider = (
    key: keyof CanvasCutbankSettings & string,
    label: string,
    color: string,
    description?: string,
    extra: { min?: number; max?: number; step?: number } = {},
  ) => (
    <SliderRow
      label={label}
      value={settings[key] as number}
      onChange={value => set({ [key]: value } as Partial<CanvasCutbankSettings>)}
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
        {slider('masterIntensity', 'Master Intensity', '#8de7ff', 'Scales the ceiling of motion, effects, transitions, and layout aggression.')}
        <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} description="Cuts, holds, and transitions land on beats and bars from the shared performance clock." />
        <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} description="Lets the song's energy, drops, and vocals steer CUTBANK inside the limits set below." />
        {slider('chaos', 'Chaos', '#ff4fd8', 'Performance unpredictability: interruptions, hold jitter, treatment changes. Separate from Composition Freedom.')}
        {slider('motionAmount', 'Motion Amount', '#61d6aa')}
        {slider('transitionIntensity', 'Transition Intensity', '#4ac7db')}
        <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
          <div className="rv-ctrl-toggle-line">
            <span className="rv-ctrl-label">CUTBANK</span>
            <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={resetCanvasPresetSettings} aria-label="Reset CUTBANK settings">Reset</button>
          </div>
        </div>
      </Collapsible>

      <Collapsible label="Design" defaultOpen>
        <SelectRow
          label="Media Pool"
          value={activeMediaPoolId ?? NO_POOL}
          onChange={value => { setActiveCanvasMediaPool(value === NO_POOL ? null : value) }}
          options={poolOptions}
          description={mediaPools.length === 0 ? 'Create a Pool in the Media Library → Pools tab, then add media and text to it.' : undefined}
        />
        <SelectRow label="Media Mode" value={settings.mediaMode} onChange={value => set({ mediaMode: value as CanvasCutbankMediaMode })} options={[...CANVAS_CUTBANK_MEDIA_MODE_OPTIONS]} />
        <SelectRow label="Selection Mode" value={settings.selectionMode} onChange={value => set({ selectionMode: value as CanvasCutbankSelectionMode })} options={[...CANVAS_CUTBANK_SELECTION_MODE_OPTIONS]} />
        <SelectRow label="Layout Mode" value={settings.layoutMode} onChange={value => set({ layoutMode: value as CanvasCutbankLayoutMode })} options={[...CANVAS_CUTBANK_LAYOUT_MODE_OPTIONS]} />
        {slider('layoutComplexity', 'Layout Complexity', '#d8b95a', 'Low: one dominant item. High: more layers, stacks, and fragments.')}
        {slider('cutRate', 'Cut Rate', '#4ac7db', `About one cut every ${beatsLabel(Math.round(cutRateToIntervalBeats(settings.cutRate) * 4) / 4)} before energy and hold limits.`)}
        {slider('minimumHold', 'Minimum Hold', '#61d6aa', holdLabel(settings.minimumHold))}
        {slider('maximumHold', 'Maximum Hold', '#61d6aa', holdLabel(settings.maximumHold))}
        {slider('compositionFreedom', 'Composition Freedom', '#ff4fd8', 'One macro for cropping, overscan, scale spread, rotation, negative space, and layout variety. Separate from Chaos.')}
        {slider('layerCount', 'Layer Count', '#8de7ff', 'Maximum simultaneous elements (limited to four for playback safety).', { min: 1, max: 4, step: 1 })}
      </Collapsible>

      <Collapsible label="Effects" defaultOpen>
        <ToggleRow label="Effects Enabled" value={settings.effectsEnabled} onChange={effectsEnabled => set({ effectsEnabled })} description="Off keeps content, layouts, selection, and basic transitions but removes treatment processing." />
        {settings.effectsEnabled && (
          <SelectRow label="Treatment Mode" value={settings.treatmentMode} onChange={value => set({ treatmentMode: value as CanvasCutbankTreatmentMode })} options={[...CANVAS_CUTBANK_TREATMENT_MODE_OPTIONS]} description={autoTreatment ? 'Auto chooses treatments from the music, never beyond the sliders below.' : settings.treatmentMode === 'manual' ? 'Manual holds every treatment at its slider.' : 'None bypasses treatment processing.'} />
        )}
        {effectsActive && (
          <>
            {slider('effectAmount', 'Effect Amount', '#8de7ff', 'Global ceiling for every treatment below.')}
            {autoTreatment && slider('treatmentVariety', 'Treatment Variety', '#d8b95a', 'How many treatment families Auto may combine.')}
            {slider('grain', 'Grain', '#d8b95a')}
            {slider('threshold', 'Threshold', '#e8f4f8', 'Xerox / photocopy / halftone / dither / edge-trace print processing.')}
            {slider('distortion', 'Distortion', '#ff4fd8')}
            {slider('signalDamage', 'Signal Damage', '#ff6b6b')}
            {slider('rgbSplit', 'RGB Split', '#4ac7db')}
            {slider('feedback', 'Feedback', '#61d6aa', 'Previous-frame trails (one bounded buffer).')}
            {slider('lensWarp', 'Lens Warp', '#8de7ff')}
            {slider('smear', 'Smear', '#ff4fd8')}
          </>
        )}
        {slider('flashAmount', 'Flash Amount', '#ffffff', 'White flashes, black frames, and exposure impacts. At 0 there are none.')}
        <SelectRow label="Transition Style" value={settings.transitionStyle} onChange={value => set({ transitionStyle: value as CanvasCutbankTransitionStyle })} options={[...CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS]} />
        {slider('transitionDuration', 'Transition Duration', '#4ac7db', settings.bpmSync ? 'Snaps to 1/8 beat … 2 beats.' : 'About 0.05 s … 1 s.')}
        {settings.transitionStyle === 'auto' && slider('transitionVariety', 'Transition Variety', '#d8b95a', 'How many transition families Auto may choose from.')}
      </Collapsible>

      <Collapsible label="Palette" defaultOpen>
        <SelectRow label="Palette Mode" value={settings.paletteMode} onChange={value => set({ paletteMode: value as CanvasCutbankPaletteMode })} options={[...CANVAS_CUTBANK_PALETTE_MODE_OPTIONS]} />
        {settings.paletteMode !== 'monochrome' && slider('sourceColorAmount', 'Source Color Amount', '#61d6aa', 'How much of the original color survives.')}
        {slider('saturation', 'Saturation', '#ff4fd8')}
        {slider('contrast', 'Contrast', '#e8f4f8')}
        {slider('exposure', 'Exposure', '#d8b95a')}
        {slider('blackLevel', 'Black Level', '#8fa6ad')}
        {slider('whiteLevel', 'White Level', '#e8f4f8')}
        <ColorRow label="Tint" value={settings.tintColor} onChange={tintColor => set({ tintColor })} />
        {slider('tintAmount', 'Tint Amount', '#d8b95a')}
        {paletteUsesAccents && <ColorRow label="Accent Color 1" value={settings.accentColor1} onChange={accentColor1 => set({ accentColor1 })} />}
        {paletteUsesAccents && <ColorRow label="Accent Color 2" value={settings.accentColor2} onChange={accentColor2 => set({ accentColor2 })} />}
        {paletteUsesAccents && slider('colorizeAmount', 'Colorize Amount', '#4ac7db', 'How strongly the accent colors replace source color.')}
        <ToggleRow label="Invert Colors" value={settings.invertColors} onChange={invertColors => set({ invertColors })} />
        {settings.paletteMode === 'auto' && slider('colorChangeRate', 'Color Change Rate', '#61d6aa', `A new palette state about every ${autoPaletteBars(settings.colorChangeRate)} bar${autoPaletteBars(settings.colorChangeRate) === 1 ? '' : 's'}.`)}
      </Collapsible>
    </>
  )
}
