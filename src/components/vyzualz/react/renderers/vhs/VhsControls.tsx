import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_VHS_SETTINGS, VHS_QUALITIES, type CanvasVhsSettings } from './VhsSettings'

const treatments = [{ value: 'tape', label: 'Tape' }, { value: 'crt', label: 'CRT' }, { value: 'hybrid', label: 'Hybrid' }]
const qualities = VHS_QUALITIES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))

export function VhsControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.vhs)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasVhsSettings>) => update({ vhs: { ...settings, ...patch } })
  return <Collapsible label="VHS" defaultOpen>
    <SelectRow label="Treatment" value={settings.treatment} options={treatments}
      onChange={treatment => set({ treatment: treatment as CanvasVhsSettings['treatment'], autoPerformance: false })} />
    <SliderRow label="Signal Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    {settings.treatment !== 'crt' && <Collapsible label="Tape Signal" defaultOpen>
      <SliderRow label="Signal Damage" value={settings.damage} onChange={damage => set({ damage })} min={0} max={1} step={0.01} />
      <SliderRow label="Tracking Error" value={settings.tracking} onChange={tracking => set({ tracking })} min={0} max={1} step={0.01} />
      <SliderRow label="Dropout Amount" value={settings.dropout} onChange={dropout => set({ dropout })} min={0} max={1} step={0.01} />
      <SliderRow label="Color Bleed" value={settings.bleed} onChange={bleed => set({ bleed })} min={0} max={1} step={0.01} />
    </Collapsible>}
    {settings.treatment !== 'tape' && <Collapsible label="CRT Display" defaultOpen>
      <SliderRow label="Scanline Strength" value={settings.scanlines} onChange={scanlines => set({ scanlines })} min={0} max={1} step={0.01} />
      <SliderRow label="Screen Curvature" value={settings.curvature} onChange={curvature => set({ curvature })} min={0} max={1} step={0.01} />
      <SliderRow label="Phosphor Mask" value={settings.phosphor} onChange={phosphor => set({ phosphor })} min={0} max={1} step={0.01} />
      <SliderRow label="Phosphor Persistence" value={settings.persistence} onChange={persistence => set({ persistence })} min={0} max={0.85} step={0.01} />
    </Collapsible>}
    <SliderRow label="Warp / Roll" value={settings.roll} onChange={roll => set({ roll })} min={0} max={1} step={0.01} />
    <SliderRow label="Grain" value={settings.grain} onChange={grain => set({ grain })} min={0} max={1} step={0.01} />
    <SliderRow label="RGB Misalignment" value={settings.misalignment} onChange={misalignment => set({ misalignment })} min={0} max={1} step={0.01} />
    <SliderRow label="Artifact Speed" value={settings.speed} onChange={speed => set({ speed })} min={0} max={4} step={0.01} />
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={qualities}
      onChange={quality => set({ quality: quality as CanvasVhsSettings['quality'] })} />
    <div className="rv-ctrl-action-row">
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset VHS settings"
        onClick={() => update({ vhs: { ...DEFAULT_CANVAS_VHS_SETTINGS } })}>Reset</button>
    </div>
  </Collapsible>
}
