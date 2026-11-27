/** Stable authored identities and runtime settings for the original animated sculpture. */
export const PULSE_PATTERNS = ['circulation','counterphase','inward-collapse','supernova','axis-shift','energy-cascade','resonance','optical-drift','blackout-pulse','phase-lock','singularity','overcharge'] as const
export const PULSE_PATTERN_OPTIONS = PULSE_PATTERNS.map(value => ({ value, label: value.split('-').map(word=>word[0]!.toUpperCase()+word.slice(1)).join(' ') }))
export type PulsePattern = typeof PULSE_PATTERNS[number]
export const clamp = (v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v))
export const mix = (a:number,b:number,t:number)=>a+(b-a)*t
export const wrap = (v:number,period:number)=>((v%period)+period)%period
export const PULSE_CONTROLS = [
 ['reactivity','Audio Reactivity',.8,0,1,.01,'master-controls','Performance'],
 ['intensity','Master Intensity',1,0,2,.01,'master-controls','Performance'],
 ['motionAmount','Motion Amount',1,0,2,.01,'master-controls','Performance'],
 ['playbackSpeed','Playback Speed',1,.25,3,.01,'master-controls','Performance'],
 ['modelSize','Model Size',1,.5,1.5,.01,'design','Structure'],
 ['layerSeparation','Layer Separation',1,.5,1.8,.01,'design','Structure'],
 ['visibleLayers','Visible Layer Count',4,1,4,1,'design','Structure'],
 ['enclosureOpacity','Enclosure Opacity',.12,0,.6,.01,'design','Structure'],
 ['frameTransmission','Frame Transmission',.64,0,1,.01,'design','Structure'],
 ['frameRoughness','Frame Roughness',.5,0,1,.01,'design','Structure'],
 ['rotationSpeed','Rotation Speed',.65,0,2,.01,'design','Rotation & Movement'],
 ['axisVariation','Axis Variation',.6,0,1,.01,'design','Rotation & Movement'],
 ['counterRotation','Counter Rotation',.7,0,1,.01,'design','Rotation & Movement'],
 ['expansionRange','Expansion Range',.3,0,.6,.01,'design','Rotation & Movement'],
 ['oscillation','Oscillation',.25,0,1,.01,'design','Rotation & Movement'],
 ['pulseCount','Pulse Count',48,12,48,1,'design','Energy Circulation'],
 ['pulseSpeed','Pulse Speed',1,.25,3,.01,'design','Energy Circulation'],
 ['pulseLength','Pulse Length',1,.25,2,.01,'design','Energy Circulation'],
 ['pulseIntensity','Pulse Intensity',1,0,2,.01,'design','Energy Circulation'],
 ['layerPhaseOffset','Layer Phase Offset',.25,0,1,.01,'design','Energy Circulation'],
 ['cameraSpeed','Camera Speed',.25,0,1,.01,'design','Camera'],
 ['cameraAmount','Camera Orbit Range',.43,0,1,.01,'design','Camera'],
 ['cameraZoom','Camera Zoom',1,.8,1.2,.01,'design','Camera'],
 ['fov','Field of View',42,30,65,1,'design','Camera'],
 ['bloom','Bloom',.65,0,1.5,.01,'effects','Optics'],
 ['reflectionIntensity','Reflection Intensity',.5,0,1,.01,'effects','Optics'],
 ['opticalDistortion','Optical Distortion',.1,0,.4,.01,'effects','Optics'],
 ['aberration','Chromatic Aberration',.05,0,.3,.01,'effects','Optics'],
 ['haze','Atmosphere',.18,0,.8,.01,'effects','Atmosphere & Energy'],
 ['energyTrails','Energy Trails',.25,0,1,.01,'effects','Atmosphere & Energy'],
 ['impactFlash','Impact Flash',.3,0,1,.01,'effects','Atmosphere & Energy'],
 ['particleAmount','Particle Amount',.2,0,1,.01,'effects','Atmosphere & Energy'],
] as const
export const SIGNALS = 'overallEnergy subAmount bassPressure lowMidAmount midAmount highsAmount airAmount fluxAmount vocalPresence directorIntensity directorMomentum buildAmount directorImpact variation beatAccent kickAccent snareAccent downbeatAccent barAccent phraseAccent sectionAccent dropAccent'.split(' ')
export const defaults = Object.fromEntries([...PULSE_CONTROLS.map(c=>[c[0],c[2]] as const),...SIGNALS.map(k=>[k,0] as const)]) as Record<string,number>
export type Color=readonly [number,number,number,number]
export const PALETTE = { primary:[1,81/255,0,1],secondary:[1,170/255,68/255,1],frame:[52/255,49/255,47/255,1],enclosureColor:[1,0,156/255,1],impact:[1,228/255,204/255,1],hazeTint:[57/255,21/255,37/255,1],background:[5/255,5/255,7/255,1] } satisfies Record<string,Color>
export type Palette=Record<keyof typeof PALETTE,Color>
export const PALETTE_LABELS=['Primary Energy','Secondary Energy','Frame Tint','Enclosure Emission','Impact Accent','Atmosphere','Background']
export interface PulseState {values:Record<string,number>;palette:Palette;pattern:PulsePattern;previous:PulsePattern;transition:number;phase:number;rotationPhases:number[];pulsePhases:number[];motion:number;flash:number;silence:number;enclosure:boolean;particles:boolean;flow:string;cameraMode:string}
/** Different spatial/temporal programs, not just emission presets. Parameters blend on pattern changes. */
export function patternPose(pattern:PulsePattern,layer:number,phase:number,signal:number):number[]{
 const l=layer/3, wave=Math.sin(phase*Math.PI*2-layer*1.25), alternating=layer%2? -1:1
 // rotation rate, pulse rate, expansion, extra twist, emission, alignment, wave gain, directional accent
 switch(pattern){
 case 'circulation':return [1,1,0,.10,1,0,.12,.1]
 case 'counterphase':return [alternating*1.35,-alternating*1.1,.08,alternating*.42,1.1,0,.18,.5]
 case 'inward-collapse':return [.65,1.55,-.7*l,-.35*l,.9+.4*(1-l),0,.3,.3]
 case 'supernova':return [1.2,1.6,.82*l,.5*l,1.25,0,.6,.8]
 case 'axis-shift':return [alternating*.8,1,.12,Math.sin(Math.floor(phase*4)*Math.PI/2+layer)*.85,1,0,.25,1]
 case 'energy-cascade':return [.75,1.15,.16*wave,.24*wave,.45+.85*(wave*.5+.5),0,.45,.5]
 case 'resonance':return [.7,1.05,.75*signal*(.35+.65*l),.16*wave,1+.3*signal,0,.9,.3]
 case 'optical-drift':return [.18,.32,.15,.10,.48,0,.08,0]
 case 'blackout-pulse':return [.4,.7,.22*signal,.16,.12+1.15*signal,0,.15,1]
 case 'phase-lock':return [.45,.75,.02,0,.9,.5+.5*Math.cos(phase*Math.PI*2),.1,.25]
 case 'singularity':return [1.4*l+.25,1.8-.8*l,-.64*l,.7*l,1.4-.9*l,0,.25,.5]
 case 'overcharge':return [alternating*1.85,-alternating*1.65,.36+.25*wave,.8*wave,1.45,0,.75,1]
 }
}
export function blendedPose(s:PulseState,layer:number):number[]{
 const t=clamp(s.transition),e=t*t*(3-2*t),signal=clamp(s.values.bassPressure!+.6*s.values.kickAccent!+.5*s.values.dropAccent!)
 const a=patternPose(s.previous,layer,s.phase,signal),b=patternPose(s.pattern,layer,s.phase,signal)
 return b.map((v,i)=>mix(a[i]!,v,e))
}
