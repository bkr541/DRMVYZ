import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_MORPH_SETTINGS, MORPH_QUALITIES, MORPH_PATTERNS, MORPH_TRIGGERS, MORPH_DIRECTIONS, MORPH_PALETTES, type CanvasMorphSettings } from './MorphSettings'
export function MorphControls() {
  const settings = useReactStore(s => s.canvasPresetSettings.morph)
  const update = useReactStore(s => s.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasMorphSettings>) => update({ morph: { ...settings, ...patch } })
  const options = (values: readonly string[]) => values.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
  const evolving = settings.patternChange || settings.autoPerformance || settings.pattern === 'metamorphosis'
  return <Collapsible label="MORPH" defaultOpen>
    <Collapsible label="Form" defaultOpen>
      <SelectRow label="Mode" value={settings.mode} options={[{ value: 'smear', label: 'Smear / Liquid' }, { value: 'halftone', label: 'Halftone' }, { value: 'droste', label: 'Droste / Tunnel' }]}
        onChange={mode => set({ mode: mode as CanvasMorphSettings['mode'], autoPerformance: false, patternChange: false, pattern: settings.pattern === 'descent' || settings.pattern === 'metamorphosis' ? 'impact' : settings.pattern })} />
      <SliderRow label="Transformation" value={settings.amount} onChange={amount => set({ amount })} min={0} max={1} step={0.01} />
      <SliderRow label="Identity Preservation" value={settings.identity} onChange={identity => set({ identity })} min={0} max={1} step={0.01} />
      <SliderRow label="Complexity" value={settings.complexity} onChange={complexity => set({ complexity })} min={0} max={1} step={0.01} />
      <SliderRow label="Depth" value={settings.depth} onChange={depth => set({ depth })} min={0} max={1} step={0.01} />
      <SliderRow label="Source Reconstruction" value={settings.sourceMix} onChange={sourceMix => set({ sourceMix })} min={0} max={1} step={0.01} />
      {(settings.mode === 'halftone' || evolving) && <>
        <SliderRow label="Dot Density" value={settings.dotDensity} onChange={dotDensity => set({ dotDensity })} min={0} max={1} step={0.01} />
        <SliderRow label="Dot Size" value={settings.dotSize} onChange={dotSize => set({ dotSize })} min={0} max={1} step={0.01} />
      </>}
      {(settings.mode === 'droste' || settings.pattern === 'descent' || evolving) && <>
        <SliderRow label="Tunnel Depth" value={settings.tunnelDepth} onChange={tunnelDepth => set({ tunnelDepth })} min={0} max={1} step={0.01} />
        <SliderRow label="Spiral Twist" value={settings.twist} onChange={twist => set({ twist })} min={0} max={1} step={0.01} />
      </>}
    </Collapsible>
    <Collapsible label="Motion" defaultOpen>
      <SliderRow label="Flow Speed" value={settings.speed} onChange={speed => set({ speed })} min={0} max={4} step={0.01} />
      <SelectRow label="Direction" value={settings.direction} options={options(MORPH_DIRECTIONS)} onChange={direction => set({ direction: direction as CanvasMorphSettings['direction'] })} />
      <SliderRow label="Rotation" value={settings.rotation} onChange={rotation => set({ rotation })} min={0} max={1} step={0.01} />
      <SliderRow label="Recovery Speed" value={1-settings.recovery} onChange={speed => set({ recovery: 1-speed })} min={0} max={1} step={0.01} />
      <SliderRow label="Turbulence" value={settings.turbulence} onChange={turbulence => set({ turbulence })} min={0} max={1} step={0.01} />
    </Collapsible>
    <Collapsible label="Material & Mood" defaultOpen>
      <ToggleRow label="Source Colors" value={settings.preserveColors} onChange={preserveColors => set({ preserveColors })} />
      {!settings.preserveColors && <SelectRow label="Color Palette" value={settings.palette} options={options(MORPH_PALETTES)} onChange={palette => set({ palette: palette as CanvasMorphSettings['palette'] })} />}
      <SliderRow label="Brightness" value={settings.brightness} onChange={brightness => set({ brightness })} min={0} max={1} step={0.01} />
      <SliderRow label="Feedback Trails" value={settings.feedback} onChange={feedback => set({ feedback })} min={0} max={1} step={0.01} />
      <SliderRow label="Glow" value={settings.glow} onChange={glow => set({ glow })} min={0} max={1} step={0.01} />
      <SelectRow label="Quality" value={settings.quality} options={MORPH_QUALITIES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} onChange={quality => set({ quality: quality as CanvasMorphSettings['quality'] })} />
      <NumberInputRow label="Seed" value={settings.seed} onChange={seed => set({ seed })} min={0} max={0x7fffffff} step={1} />
    </Collapsible>
    <Collapsible label="Audio & Choreography" defaultOpen>
      <SliderRow label="Audio Reactivity" value={settings.audioReactivity} onChange={audioReactivity => set({ audioReactivity })} min={0} max={1} step={0.01} />
      <SliderRow label="Impact Strength" value={settings.impactStrength} onChange={impactStrength => set({ impactStrength })} min={0} max={1} step={0.01} />
      <SelectRow label="Pattern" value={settings.pattern} options={MORPH_PATTERNS.map(value => ({ value, label: value.toUpperCase() }))} onChange={pattern => set({ pattern: pattern as CanvasMorphSettings['pattern'], autoPerformance: false })} />
      <ToggleRow label="Pattern Change" value={settings.patternChange} onChange={patternChange => set({ patternChange, ...(patternChange ? { autoPerformance: false } : {}) })} />
      {settings.patternChange && <SelectRow label="Trigger" value={settings.trigger} options={MORPH_TRIGGERS.map(value => ({ value, label: value === 'beat2' ? 'Every 2 Beats' : value === 'beat4' ? 'Every 4 Beats' : value === 'bar4' ? 'Every 4 Bars' : value === 'bar8' ? 'Every 8 Bars' : value[0].toUpperCase() + value.slice(1) }))} onChange={trigger => set({ trigger: trigger as CanvasMorphSettings['trigger'] })} />}
      <SliderRow label="Mode Transition" value={settings.transitionDuration} onChange={transitionDuration => set({ transitionDuration })} min={0} max={3} step={0.05} />
      <ToggleRow label="Sync BPM" value={settings.bpmSync} onChange={bpmSync => set({ bpmSync })} />
      <ToggleRow label="Auto Performance" value={settings.autoPerformance} onChange={autoPerformance => set({ autoPerformance, ...(autoPerformance ? { patternChange: false } : {}) })} />
    </Collapsible>
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Morph settings" onClick={() => update({ morph: { ...DEFAULT_CANVAS_MORPH_SETTINGS } })}>Reset</button></div>
  </Collapsible>
}
