import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_MUTAGEN_SETTINGS, MUTAGEN_PATTERN_OPTIONS, MUTAGEN_TRIGGER_OPTIONS, applyMutagenAutoPerformance, applyMutagenManualPattern, applyMutagenPatternChange, isMutagenPattern, type CanvasMutagenSettings } from './MutagenSettings'

export function MutagenDesignControls() {
  const settings = useReactStore(s => s.canvasPresetSettings.mutagen)
  const update = useReactStore(s => s.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasMutagenSettings>) => update({ mutagen: { ...settings, ...patch } })
  const defaults = DEFAULT_CANVAS_MUTAGEN_SETTINGS
  return (
    <Collapsible label="MUTAGEN" defaultOpen>
      <SelectRow label="Pattern" value={settings.pattern} options={MUTAGEN_PATTERN_OPTIONS.map(option => ({ ...option }))} onChange={pattern => { if (isMutagenPattern(pattern)) update({ mutagen: applyMutagenManualPattern(settings, pattern) }) }} />
      <ToggleRow label="Pattern Change" value={settings.patternChange} onChange={patternChange => update({ mutagen: applyMutagenPatternChange(settings, patternChange) })} description="Advances only on a new selected Trigger event. The Pattern field remains your authored selection." />
      {settings.patternChange && <SelectRow label="Trigger" value={settings.trigger} options={MUTAGEN_TRIGGER_OPTIONS.map(option => ({ ...option }))} onChange={trigger => set({ trigger: trigger as CanvasMutagenSettings['trigger'] })} />}
      <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => update({ mutagen: applyMutagenAutoPerformance(settings, autoPerformance) })} description="Chooses temporary musical looks without overwriting your authored Pattern. Pattern Change has priority." />
      <ToggleRow label="BPM Sync" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} description="Uses the qualified Shared Performance beat position for motion speed, independently of audio modulation and Pattern authority." />
      <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} resetValue={defaults.audioReactivity} description="Zero removes audio modulation and retains continuous manual motion." />
      <NumberInputRow label="Deterministic Seed" value={settings.deterministicSeed} min={0} max={2147483647} step={1} onChange={deterministicSeed => set({ deterministicSeed })} />
      <SliderRow label="Mutation" value={settings.mutation} onChange={mutation => set({ mutation })} min={0} max={1} step={0.01} resetValue={defaults.mutation} />
      <SliderRow label="Flow Speed" value={settings.flowSpeed} onChange={flowSpeed => set({ flowSpeed })} min={0} max={4} step={0.01} resetValue={defaults.flowSpeed} />
      {settings.pattern === 'vortex' && <SliderRow label="Vortex Twist" value={settings.vortexTwist} onChange={vortexTwist => set({ vortexTwist })} resetValue={defaults.vortexTwist} />}
      {settings.pattern === 'particulate' && <SliderRow label="Cell Size" value={settings.cellSize} onChange={cellSize => set({ cellSize })} resetValue={defaults.cellSize} />}
      {settings.pattern === 'terraform' && <SliderRow label="Terrain Height" value={settings.terrainHeight} onChange={terrainHeight => set({ terrainHeight })} resetValue={defaults.terrainHeight} />}
      {settings.pattern === 'fracture' && <SliderRow label="Shard Separation" value={settings.fractureSpread} onChange={fractureSpread => set({ fractureSpread })} resetValue={defaults.fractureSpread} />}
      {settings.pattern === 'spectralTear' && <SliderRow label="Tear Bands" value={Math.min(settings.tearBands, settings.quality === 'low' ? 12 : settings.quality === 'balanced' ? 24 : 48)} onChange={tearBands => set({ tearBands })} min={4} max={settings.quality === 'low' ? 12 : settings.quality === 'balanced' ? 24 : 48} step={1} resetValue={defaults.tearBands} description="Quality bounds the number of spatial frequency bands. These are image slices, not a second audio analyzer." />}
      {settings.pattern === 'recursion' && <SliderRow label="Recursion Depth" value={Math.min(settings.recursionDepth, settings.quality === 'low' ? 3 : settings.quality === 'balanced' ? 4 : 6)} onChange={recursionDepth => set({ recursionDepth })} min={1} max={settings.quality === 'low' ? 3 : settings.quality === 'balanced' ? 4 : 6} step={1} resetValue={defaults.recursionDepth} description="Auto quality may reduce the effective depth on larger stages." />}
      {settings.pattern === 'morph' && <SliderRow label="Shape Detail" value={settings.morphScale} onChange={morphScale => set({ morphScale })} resetValue={defaults.morphScale} />}
      <SliderRow label="Feedback Trails" value={settings.feedback} onChange={feedback => set({ feedback })} min={0} max={1} step={0.01} resetValue={defaults.feedback} />
      <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} resetValue={defaults.sourceMix} />
      <SliderRow label="Pattern Transition" value={settings.transitionDuration} onChange={transitionDuration => set({ transitionDuration })} min={0.1} max={2} step={0.05} resetValue={defaults.transitionDuration} formatValue={value => `${value.toFixed(2)} s`} />
      <SliderRow label="Glow" value={settings.glow} onChange={glow => set({ glow })} resetValue={defaults.glow} />
      <ToggleRow label="Preserve Colors" value={settings.preserveColors} onChange={preserveColors => set({ preserveColors })} />
      <SelectRow label="Quality" value={settings.quality} options={[{ value: 'auto', label: 'Auto' }, { value: 'low', label: 'Low' }, { value: 'balanced', label: 'Balanced' }, { value: 'high', label: 'High' }]} onChange={quality => set({ quality: quality as CanvasMutagenSettings['quality'] })} />
      <button type="button" className="rv-reset-btn" onClick={() => update({ mutagen: { ...defaults } })}>Reset MUTAGEN</button>
    </Collapsible>
  )
}
