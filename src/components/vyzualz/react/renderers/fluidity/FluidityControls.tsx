import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_FLUIDITY_SETTINGS, FLUIDITY_QUALITIES, type CanvasFluiditySettings } from './FluiditySettings'

const surfaces = [
  { value: 'sourceContours', label: 'Source Contours' },
  { value: 'ripples', label: 'Ripples' },
  { value: 'lenses', label: 'Lenses' },
  { value: 'ribs', label: 'Ribs' },
]

export function FluidityControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.fluidity)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasFluiditySettings>) => update({ fluidity: { ...settings, ...patch } })
  return <Collapsible label="Fluidity" defaultOpen>
    <SelectRow label="Surface" value={settings.surface} options={surfaces}
      onChange={surface => set({ surface: surface as CanvasFluiditySettings['surface'], autoPerformance: false })} />
    <SliderRow label="Glass Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SliderRow label="Refraction" value={settings.refraction} onChange={refraction => set({ refraction })} min={0} max={1} step={0.01} />
    <SliderRow label="Surface Scale" value={settings.surfaceScale} onChange={surfaceScale => set({ surfaceScale })} min={0} max={1} step={0.01} />
    <SliderRow label="Flow Speed" value={settings.flowSpeed} onChange={flowSpeed => set({ flowSpeed })} min={0} max={4} step={0.01} />
    <Collapsible label="Optics">
      <SliderRow label="Edge Bevel" value={settings.bevel} onChange={bevel => set({ bevel })} min={0} max={1} step={0.01} />
      <SliderRow label="Frostiness" value={settings.frost} onChange={frost => set({ frost })} min={0} max={1} step={0.01} />
      <SliderRow label="Highlight Strength" value={settings.highlight} onChange={highlight => set({ highlight })} min={0} max={1} step={0.01} />
      <SliderRow label="Light Angle" value={settings.lightAngle} onChange={lightAngle => set({ lightAngle })} min={-180} max={180} step={1} />
      <ToggleRow label="Preserve Colors" value={settings.preserveColors} onChange={preserveColors => set({ preserveColors })} />
      {!settings.preserveColors && <SliderRow label="Dispersion" value={settings.dispersion} onChange={dispersion => set({ dispersion })} min={0} max={1} step={0.01} />}
    </Collapsible>
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={FLUIDITY_QUALITIES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
      onChange={quality => set({ quality: quality as CanvasFluiditySettings['quality'] })} />
    <div className="rv-ctrl-action-row">
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Fluidity settings"
        onClick={() => update({ fluidity: { ...DEFAULT_CANVAS_FLUIDITY_SETTINGS } })}>Reset</button>
    </div>
  </Collapsible>
}
