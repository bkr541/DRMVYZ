import { useReactStore } from '../../../../../stores/reactStore'
import { Collapsible, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../../ReactControlRows'
import { DEFAULT_CANVAS_SINGULARITY_SETTINGS, SINGULARITY_MODES, SINGULARITY_PALETTES, SINGULARITY_PATTERNS, SINGULARITY_QUALITIES, SINGULARITY_TRIGGERS, type CanvasSingularitySettings } from './SingularitySettings'
export function SingularityControls() {
  const s = useReactStore(state => state.canvasPresetSettings.singularity)
  const update = useReactStore(state => state.setCanvasPresetSettings)
  const set = (patch: Partial<CanvasSingularitySettings>) => update({ singularity: { ...s, ...patch } })
  const options = (values: readonly string[]) => values.map(value => ({ value, label: value.toUpperCase() }))
  type Numeric = { [K in keyof CanvasSingularitySettings]: CanvasSingularitySettings[K] extends number ? K : never }[keyof CanvasSingularitySettings]
  const slider = (label: string, key: Numeric) => <SliderRow label={label} value={s[key]} onChange={value => set({ [key]: value })} min={0} max={1} step={.01}/>
  return <Collapsible label="SINGULARITY" defaultOpen>
    <Collapsible label="Form & Environment" defaultOpen>
      <SelectRow label="Media Presentation" value={s.mode} options={options(SINGULARITY_MODES)} onChange={mode=>set({mode:mode as CanvasSingularitySettings['mode']})}/>
      {slider('Fragment Density','fragmentDensity')}{slider('Fragment Size','fragmentSize')}{slider('Environmental Depth','depth')}{slider('Particle Density','particleDensity')}{slider('Source Scale','sourceScale')}{slider('Identity Preservation','identity')}
    </Collapsible>
    <Collapsible label="Motion & Physics" defaultOpen>
      {slider('Vortex Speed','speed')}{slider('Turbulence','turbulence')}{slider('Camera Motion','camera')}{slider('Reconstruction Speed','recovery')}
    </Collapsible>
    <Collapsible label="Material & Effects" defaultOpen>
      <SelectRow label="Palette" value={s.palette} options={options(SINGULARITY_PALETTES)} onChange={palette=>set({palette:palette as CanvasSingularitySettings['palette']})}/>
      <ToggleRow label="Preserve Source Colors" value={s.preserveColors} onChange={preserveColors=>set({preserveColors})}/>
      {slider('Bloom Intensity','glow')}{slider('Bloom Radius','bloomRadius')}{slider('Motion Trails','trails')}{slider('Glitch Intensity','glitch')}{slider('Background Opacity','background')}
      <SelectRow label="Quality" value={s.quality} options={options(SINGULARITY_QUALITIES)} onChange={quality=>set({quality:quality as CanvasSingularitySettings['quality']})}/>
      <NumberInputRow label="Seed" value={s.seed} onChange={seed=>set({seed})} min={0} max={0x7fffffff} step={1}/>
    </Collapsible>
    <Collapsible label="Audio & Choreography" defaultOpen>
      {slider('Audio Reactivity','audioReactivity')}{slider('Impact Strength','impactStrength')}
      <SelectRow label="Pattern" value={s.pattern} options={options(SINGULARITY_PATTERNS)} onChange={pattern=>set({pattern:pattern as CanvasSingularitySettings['pattern'],patternChange:false,autoPerformance:false})}/>
      <ToggleRow label="Pattern Change" value={s.patternChange} onChange={patternChange=>set({patternChange,...(patternChange?{autoPerformance:false}:{})})}/>
      {s.patternChange && <SelectRow label="Trigger" value={s.trigger} options={SINGULARITY_TRIGGERS.map(value=>({value,label:({beat2:'Every 2 Beats',beat4:'Every 4 Beats',bar4:'Every 4 Bars',bar8:'Every 8 Bars'} as Record<string,string>)[value]??value.toUpperCase()}))} onChange={trigger=>set({trigger:trigger as CanvasSingularitySettings['trigger']})}/>}
      <ToggleRow label="Auto Performance" value={s.autoPerformance} onChange={autoPerformance=>set({autoPerformance,...(autoPerformance?{patternChange:false}:{})})}/>
    </Collapsible>
    <div className="rv-ctrl-action-row"><button type="button" className="rv-ctrl-toggle rv-canvas-recipe-reset" aria-label="Reset Singularity settings" onClick={()=>update({singularity:{...DEFAULT_CANVAS_SINGULARITY_SETTINGS}})}>Reset</button></div>
  </Collapsible>
}
