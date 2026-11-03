import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { PHASE_DRAG_CURVES, PHASE_DRAG_DIRECTIONS, PHASE_DRAG_MODES, PHASE_DRAG_QUALITIES, DEFAULT_CANVAS_PHASE_DRAG_SETTINGS, clearPhaseDragHistory, type CanvasPhaseDragSettings } from './PhaseDragSettings'

function options<T extends string>(values: readonly T[]) {
  return values.map(value => ({ value, label: value === 'pingPong' ? 'Ping Pong' : value[0].toUpperCase() + value.slice(1) }))
}

export function PhaseDragControls({ video }: { video: boolean }) {
  const settings = useReactStore(state => state.canvasPresetSettings.phaseDrag)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasPhaseDragSettings>) => update({ phaseDrag: { ...settings, ...patch } })
  const manual = (patch: Partial<CanvasPhaseDragSettings>) => set({ ...patch, autoPerformance: false })
  const capacity = settings.quality === 'low' ? 4 : settings.quality === 'balanced' ? 8 : 12
  const samples = Math.min(settings.historySamples, capacity)
  return <Collapsible label="Phase Drag" defaultOpen>
    <SelectRow label="Scan Mode" value={settings.scanMode} options={options(PHASE_DRAG_MODES)} onChange={scanMode => manual({ scanMode: scanMode as CanvasPhaseDragSettings['scanMode'] })} />
    <SliderRow label="Drag Amount" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
    <SliderRow label="History Window" value={settings.historyWindow} onChange={historyWindow => set({ historyWindow })} min={0.1} max={2} step={0.01} formatValue={value => `${value.toFixed(2)} s`} />
    <NumberInputRow label="History Samples" value={settings.historySamples} onChange={historySamples => set({ historySamples })} min={4} max={12} step={1}
      description={settings.quality === 'auto' && samples > 4 ? `Auto uses 4–${samples} samples depending on stage size.` : `${samples} effective samples at this quality.`} />
    <SliderRow label="Slit Width" value={settings.slitWidth} onChange={slitWidth => set({ slitWidth })} min={0.01} max={1} step={0.01} />
    <SliderRow label="Scan Speed" value={settings.scanSpeed} onChange={scanSpeed => set({ scanSpeed })} min={0} max={4} step={0.01} />
    <SelectRow label="Direction" value={settings.direction} options={options(PHASE_DRAG_DIRECTIONS)} onChange={direction => manual({ direction: direction as CanvasPhaseDragSettings['direction'] })} />
    <SelectRow label="Time Curve" value={settings.timeCurve} options={options(PHASE_DRAG_CURVES)} onChange={timeCurve => set({ timeCurve: timeCurve as CanvasPhaseDragSettings['timeCurve'] })} />
    {!video && <SliderRow label="Animated Still Movement" value={settings.stillMovement} onChange={stillMovement => set({ stillMovement })} min={0} max={1} step={0.01}
      description="Moves the still before sampling it. At zero, Phase Drag shows the original still." />}
    <ToggleRow label="Freeze History" value={settings.freezeHistory} onChange={freezeHistory => set({ freezeHistory })} />
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={clearPhaseDragHistory}>Clear History</button></div>
    <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
    <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
    <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
    <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance })} />
    <NumberInputRow label="Deterministic Seed" value={settings.deterministicSeed} onChange={deterministicSeed => set({ deterministicSeed })} min={0} max={0x7fffffff} step={1} />
    <SelectRow label="Quality" value={settings.quality} options={options(PHASE_DRAG_QUALITIES)} onChange={quality => set({ quality: quality as CanvasPhaseDragSettings['quality'] })} />
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" onClick={() => {
      update({ phaseDrag: { ...DEFAULT_CANVAS_PHASE_DRAG_SETTINGS } })
      clearPhaseDragHistory()
    }} aria-label="Reset Phase Drag settings">Reset</button></div>
  </Collapsible>
}
