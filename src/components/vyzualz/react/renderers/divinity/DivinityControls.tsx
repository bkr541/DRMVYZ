import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_DIVINITY_SETTINGS, DIVINITY_QUALITIES, type CanvasDivinitySettings } from './DivinitySettings'

const masks = [{ value: 'luminance', label: 'Luminance' }, { value: 'alpha', label: 'Alpha' }]
const colors = [{ value: 'source', label: 'Source' }, { value: 'manual', label: 'Manual' }]
const qualities = DIVINITY_QUALITIES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))

export function DivinityControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.divinity)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasDivinitySettings>) => update({ divinity: { ...settings, ...patch } })
  return <Collapsible label="Divinity" defaultOpen>
    <SliderRow label="Ray Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SelectRow label="Mask Source" value={settings.mask} options={masks}
      onChange={mask => set({ mask: mask as CanvasDivinitySettings['mask'], autoPerformance: false })} />
    {settings.mask === 'luminance' && <SliderRow label="Highlight Threshold" value={settings.threshold}
      onChange={threshold => set({ threshold })} min={0} max={1} step={0.01} />}
    <SliderRow label="Light Origin X" value={settings.originX} onChange={originX => set({ originX })} min={0} max={1} step={0.01} />
    <SliderRow label="Light Origin Y" value={settings.originY} onChange={originY => set({ originY })} min={0} max={1} step={0.01} />
    <SliderRow label="Ray Length" value={settings.length} onChange={length => set({ length })} min={0} max={1} step={0.01} />
    <SliderRow label="Ray Spread" value={settings.spread} onChange={spread => set({ spread })} min={0} max={1} step={0.01} />
    <Collapsible label="Light Treatment">
      <SliderRow label="Density" value={settings.density} onChange={density => set({ density })} min={0} max={1} step={0.01} />
      <SliderRow label="Decay" value={settings.decay} onChange={decay => set({ decay })} min={0} max={1} step={0.01} />
      <SelectRow label="Ray Color" value={settings.colorMode} options={colors}
        onChange={colorMode => set({ colorMode: colorMode as CanvasDivinitySettings['colorMode'] })} />
      {settings.colorMode === 'manual' && <ColorRow label="Manual Ray Color" value={settings.color} onChange={color => set({ color })} />}
      <ToggleRow label="Clip Rays to Source Alpha" value={settings.clipToAlpha} onChange={clipToAlpha => set({ clipToAlpha })} />
    </Collapsible>
    <SliderRow label="Light Motion Speed" value={settings.motionSpeed} onChange={motionSpeed => set({ motionSpeed })} min={0} max={4} step={0.01} />
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={qualities}
      onChange={quality => set({ quality: quality as CanvasDivinitySettings['quality'] })} />
    <div className="rv-ctrl-action-row">
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Divinity settings"
        onClick={() => update({ divinity: { ...DEFAULT_CANVAS_DIVINITY_SETTINGS } })}>Reset</button>
    </div>
  </Collapsible>
}
