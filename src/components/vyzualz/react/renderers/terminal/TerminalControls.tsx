import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_TERMINAL_SETTINGS, TERMINAL_FAMILIES, TERMINAL_QUALITIES, type CanvasTerminalSettings } from './TerminalSettings'

const choices = (values: readonly string[]) => values.map(value => ({ value, label: value === 'ascii' ? 'ASCII' : value[0].toUpperCase() + value.slice(1) }))

export function TerminalControls() {
  const settings = useReactStore(state => state.canvasPresetSettings.terminal)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasTerminalSettings>) => update({ terminal: { ...settings, ...patch } })
  return <Collapsible label="Terminal" defaultOpen>
    <SliderRow label="Glyph Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SelectRow label="Character Set" value={settings.family} options={choices(TERMINAL_FAMILIES)}
      onChange={family => set({ family: family as CanvasTerminalSettings['family'], autoPerformance: false })} />
    <SliderRow label="Cell Size" value={settings.cellSize} onChange={cellSize => set({ cellSize })} min={4} max={48} step={1} />
    <SliderRow label="Glyph Contrast" value={settings.contrast} onChange={contrast => set({ contrast })} min={0} max={2} step={0.01} />
    <SliderRow label="Brightness Bias" value={settings.brightness} onChange={brightness => set({ brightness })} min={-1} max={1} step={0.01} />
    <SliderRow label="Edge Awareness" value={settings.edge} onChange={edge => set({ edge })} min={0} max={1} step={0.01} />
    <SliderRow label="Character Change Rate" value={settings.changeRate} onChange={changeRate => set({ changeRate })} min={0} max={4} step={0.01} />
    <SelectRow label="Color Mode" value={settings.colorMode} options={choices(['source', 'monochrome'])}
      onChange={colorMode => set({ colorMode: colorMode as CanvasTerminalSettings['colorMode'] })} />
    {settings.colorMode === 'monochrome' && <ColorRow label="Monochrome Color" value={settings.color} onChange={color => set({ color })} />}
    <SliderRow label="Background Fill" value={settings.background} onChange={background => set({ background })} min={0} max={1} step={0.01} />
    <SliderRow label="Glyph Glow" value={settings.glow} onChange={glow => set({ glow })} min={0} max={1} step={0.01} />
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={choices(TERMINAL_QUALITIES)}
      onChange={quality => set({ quality: quality as CanvasTerminalSettings['quality'] })} />
    <div className="rv-ctrl-action-row">
      <button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Terminal settings"
        onClick={() => update({ terminal: { ...DEFAULT_CANVAS_TERMINAL_SETTINGS } })}>Reset</button>
    </div>
  </Collapsible>
}
