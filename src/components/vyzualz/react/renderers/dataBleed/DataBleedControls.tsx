import { useMediaStore } from '../../../../../stores/mediaStore'
import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DATA_BLEED_FLOW_OPTIONS, DEFAULT_CANVAS_DATA_BLEED_SETTINGS, clearDataBleedHistory, type CanvasDataBleedSettings, type DataBleedFlowMode } from './DataBleedSettings'
export function DataBleedControls() {
  const settings = useReactStore(s => s.canvasPresetSettings.dataBleed)
  const update = useReactStore(s => s.setCanvasPresetSettings)
  const id = useReactStore(s => s.activeCanvasMediaId)
  const library = useMediaVideo(id)
  const set = (patch: Partial<CanvasDataBleedSettings>) => update({ dataBleed: { ...settings, ...patch } })
  const procedural = !library || settings.flowMode !== 'motion'
  return <Collapsible label="Data Bleed" defaultOpen>
    <SelectRow label="Flow Mode" value={settings.flowMode} options={[...DATA_BLEED_FLOW_OPTIONS]} onChange={flowMode => set({ flowMode: flowMode as DataBleedFlowMode, autoPerformance: false })} />
    {!library && settings.flowMode === 'motion' && <p className="rv-control-helper-copy">Still images use procedural flow. Select a video in Media Manager for motion estimation.</p>}
    <SliderRow label="Bleed Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SliderRow label="Block Size" value={settings.blockSize} onChange={blockSize => set({ blockSize })} min={2} max={64} step={1} />
    {library && settings.flowMode !== 'procedural' && <SliderRow label="Motion Sensitivity" value={settings.motionSensitivity} onChange={motionSensitivity => set({ motionSensitivity })} min={0} max={1} step={0.01} />}
    {procedural && <SliderRow label="Flow Speed" value={settings.flowSpeed} onChange={flowSpeed => set({ flowSpeed })} min={0} max={4} step={0.01} />}
    <SliderRow label="History Retention" value={settings.historyRetention} onChange={historyRetention => set({ historyRetention })} min={0} max={0.95} step={0.01} />
    <SliderRow label="Source Refresh" value={settings.sourceRefresh} onChange={sourceRefresh => set({ sourceRefresh })} min={0} max={1} step={0.01} />
    {procedural && <SliderRow label="Direction Bias" value={settings.directionBias} onChange={directionBias => set({ directionBias })} min={-180} max={180} step={1} />}
    <ToggleRow label="Freeze History" value={settings.freezeHistory} onChange={freezeHistory => set({ freezeHistory })} description="Holds the processed image. Edits apply on release; Clear History and source/transport resets refresh it." />
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={clearDataBleedHistory}>Clear History</button></div>
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.deterministicSeed} onChange={deterministicSeed => set({ deterministicSeed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={['auto', 'low', 'balanced', 'high'].map(value => ({ value, label: value === 'auto' ? 'Auto' : value[0].toUpperCase() + value.slice(1) }))} onChange={quality => set({ quality: quality as CanvasDataBleedSettings['quality'] })} />
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={() => { update({ dataBleed: { ...DEFAULT_CANVAS_DATA_BLEED_SETTINGS } }); clearDataBleedHistory() }} aria-label="Reset Data Bleed settings">Reset</button></div>
  </Collapsible>
}

function useMediaVideo(id: string | null): boolean {
  const library = useMediaStore(s => s.items.find(item => item.id === id)?.type)
  const legacy = useReactStore(s => s.canvasMediaItems.find(item => item.id === id)?.type)
  return (library ?? legacy) === 'video'
}
