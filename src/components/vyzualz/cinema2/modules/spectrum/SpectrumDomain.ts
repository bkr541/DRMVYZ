import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

export const SPECTRUM_PATTERNS = [
  {value:'orbit',label:'Orbit'}, {value:'radial-sweep',label:'Radial Sweep'},
  {value:'panorama',label:'Panorama'}, {value:'arena-pulse',label:'Arena Pulse'},
  {value:'circumference-relay',label:'Circumference Relay'}, {value:'surround',label:'Surround'},
] as const
export type SpectrumPattern = typeof SPECTRUM_PATTERNS[number]['value']
export const SPECTRUM_COLORS = {
  background:[8/255,11/255,18/255,1], structural:[41/255,52/255,63/255,1],
  primary:[0,216/255,229/255,1], secondary:[172/255,92/255,1,1], accent:[242/255,246/255,1,1],
} as const satisfies Record<string,Cinema2Color>
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export const TAU=Math.PI*2
export const bayAngle=(i:number,count:number)=>((i+.5)/count-.5)*TAU
export function spectrumUv(i:number,count:number,radius:number,height:number,coverage:string,grouping:string,grouped:boolean,channels:number,step:number,gap=0){
  // Whole-bay coverage ensures no partial screen boundary. Angular UVs stay attached to physical bays.
  const desired=coverage==='full-wrap'?count:coverage==='front-arc'?Math.ceil(count/3):Math.ceil(count*2/3)
  const first=Math.floor((count-desired)/2),end=first+desired
  if(i<first||i>=end)return {x:0,w:1,channel:-1,aspect:TAU*radius/count/height}
  let start=first,stop=end,group=0
  if(grouped){
    const groups=Math.min(desired,grouping==='quadrants'?4:3)
    for(let g=0;g<groups;g++){
      const a=first+Math.floor(g*desired/groups),b=first+Math.floor((g+1)*desired/groups)
      if(i>=a&&i<b){start=a;stop=b;group=g;break}
    }
  }
  const span=stop-start
  return {x:(i-start+gap/2)/span,w:(1-gap)/span,channel:(group+step)%Math.max(1,channels),aspect:TAU*radius/count*span/height}
}
export interface SpectrumMotion {
  pattern:SpectrumPattern;phase:number;opening:number;tilt:number;floorRelay:number;sweep:number;overhead:number;intensity:number;safe:boolean;readability:boolean;
  vocal:number;kick:number;snare:number;drop:number;bass:number;mid:number;build:number;downbeat:number;phrase:number;impact:number;high:number;energy:number;beat:number;
}
export function spectrumPose(i:number,count:number,p:SpectrumMotion){
  const a=bayAngle(i,count),t=p.phase,wave=Math.sin(t-a),packet=(.5+.5*Math.cos(t-a))**9,side=Math.abs(Math.sin(a)),pulse=.5+.5*Math.sin(t*2+i*Math.PI)
  let travel=0,tilt=0,light=0
  switch(p.pattern){
    case 'orbit':travel=.12*wave;tilt=.12*wave;light=.25+.55*packet;break
    case 'radial-sweep':travel=.65*(.5+.5*Math.sin(t*2-a*.55));tilt=.22*wave;light=.2+.8*(.5+.5*Math.sin(t*2-a*.55))**4;break
    case 'panorama':travel=0;tilt=0;light=.12;break
    case 'arena-pulse':travel=.7*pulse;tilt=.55*wave*(i%2?1:-1);light=.25+.65*pulse;break
    case 'circumference-relay':travel=.16*packet;tilt=.15*packet;light=.08+.92*packet;break
    case 'surround':travel=side*.85*(.5+.5*Math.sin(t))+.15*p.drop;tilt=side*.75*wave;light=.35+.55*packet+.25*p.drop;break
  }
  const calm=p.pattern==='panorama'?.12:1,restraint=(p.safe?.75:1)*(p.readability?.65:1)*(1-.3*p.vocal)*p.intensity
  const radial=clamp(travel*(p.opening+.15*p.bass)+calm*p.opening*(.25*p.kick+.15*p.build+.2*p.drop*p.impact),-.2,1)*restraint
  const angle=clamp(tilt+calm*.2*p.snare*(i%2?1:-1),-1,1)*Math.min(25,p.tilt+5*p.mid)*Math.PI/180*restraint
  return {radial,tilt:angle,light:clamp((light*p.sweep+.15*p.high+.12*p.downbeat*packet+.08*p.phrase+.08*p.energy)*p.intensity),overhead:clamp((p.overhead*(.25+.75*packet)+.15*p.high)*p.intensity*(1-.3*p.vocal))}
}
export function floorPulse(index:number,p:SpectrumMotion){
  const route=.5+.5*Math.cos(p.phase*2-index*.9)
  const accent=(p.pattern==='radial-sweep'||p.pattern==='arena-pulse'||p.pattern==='surround')?route**4:route*.35
  return clamp((p.floorRelay*(.15+accent)+.2*p.bass+.28*p.kick*route+.14*p.beat+.15*p.drop*p.impact)*p.intensity*(1-.3*p.vocal))
}
