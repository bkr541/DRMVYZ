import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { CELLULAR_QUALITIES, DEFAULT_CANVAS_CELLULAR_SETTINGS, reseedCellular, type CanvasCellularSettings } from './CellularSettings'

export function CellularControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.cellular)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasCellularSettings>) => update({ cellular: { ...settings, ...patch } })
  return <Collapsible label="Cellular" defaultOpen>
    <SliderRow label="Growth Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SliderRow label="Growth Speed" value={settings.speed} onChange={speed => set({ speed })} min={0} max={2} step={0.01} />
    <SliderRow label="Cell Scale" value={settings.cellScale} onChange={cellScale => set({ cellScale })} min={2} max={64} step={1} />
    <Collapsible label="Reaction">
      <NumberInputRow label="Feed Rate" value={settings.feed} onChange={feed => set({ feed })} min={0} max={0.1} step={0.0001} />
      <NumberInputRow label="Kill Rate" value={settings.kill} onChange={kill => set({ kill })} min={0} max={0.1} step={0.0001} />
      <SliderRow label="Diffusion Balance" value={settings.diffusion} onChange={diffusion => set({ diffusion })} min={0} max={1} step={0.01} />
      <SliderRow label="Source Injection" value={settings.injection} onChange={injection => set({ injection })} min={0} max={1} step={0.01} />
    </Collapsible>
    <SliderRow label="Edge Definition" value={settings.edge} onChange={edge => set({ edge })} min={0} max={1} step={0.01} />
    <SelectRow label="Color Mode" value={settings.colorMode} options={[{ value: 'source', label: 'Source' }, { value: 'duotone', label: 'Duotone' }]}
      onChange={colorMode => set({ colorMode: colorMode as CanvasCellularSettings['colorMode'], autoPerformance: false })} />
    {settings.colorMode === 'duotone' && <>
      <ColorRow label="Duotone Color A" value={settings.colorA} onChange={colorA => set({ colorA })} />
      <ColorRow label="Duotone Color B" value={settings.colorB} onChange={colorB => set({ colorB })} />
    </>}
    <ToggleRow label="Allow Growth Outside Alpha" value={settings.expandAlpha} onChange={expandAlpha => set({ expandAlpha })} />
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={CELLULAR_QUALITIES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))}
      onChange={quality => set({ quality: quality as CanvasCellularSettings['quality'] })} />
    <div className="rv-ctrl-action-row">
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={reseedCellular}>Reseed</button>
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Cellular settings" onClick={() => {
        update({ cellular: { ...DEFAULT_CANVAS_CELLULAR_SETTINGS } })
        reseedCellular()
      }}>Reset</button>
    </div>
  </Collapsible>
}
