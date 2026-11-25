import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

export const REFRACTION_PATTERNS = [
  {value:'prism-rotation',label:'Prism Rotation'}, {value:'spectral-split',label:'Spectral Split'},
  {value:'transparency',label:'Transparency'}, {value:'convergence',label:'Convergence'},
  {value:'glass-relay',label:'Glass Relay'}, {value:'refraction',label:'Refraction'},
] as const
export type RefractionPattern = typeof REFRACTION_PATTERNS[number]['value']
export const REFRACTION_COLORS = {
  background:[7/255,11/255,21/255,1], structural:[38/255,52/255,71/255,1],
  primary:[54/255,231/255,1,1], secondary:[137/255,84/255,1,1], accent:[241/255,230/255,1,1],
} as const satisfies Record<string,Cinema2Color>
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export const PRISM_CAPACITY=18
export interface PrismAnchor {x:number;y:number;z:number;width:number;height:number;bank:number;inverted:boolean;slab:boolean}
// Hero triptych first; additions fill the upper and outer negative space, never the hero sightline.
export const PRISM_ANCHORS: readonly PrismAnchor[] = [
  {x:-2.65,y:-.18,z:.65,width:2.45,height:3.15,bank:0,inverted:false,slab:false},
  {x:0,y:.12,z:.82,width:2.45,height:3.15,bank:0,inverted:true,slab:false},
  {x:2.65,y:-.18,z:.65,width:2.45,height:3.15,bank:0,inverted:false,slab:false},
  {x:-4.25,y:.95,z:-1.6,width:1.85,height:2.8,bank:1,inverted:true,slab:false},
  {x:4.25,y:.95,z:-1.6,width:1.85,height:2.8,bank:1,inverted:false,slab:false},
  {x:0,y:2.42,z:-2.25,width:2.45,height:.72,bank:1,inverted:false,slab:true},
  {x:-2.1,y:2.38,z:-2.6,width:1.5,height:1.55,bank:1,inverted:true,slab:false},
  {x:2.1,y:2.38,z:-2.6,width:1.5,height:1.55,bank:1,inverted:false,slab:false},
  {x:-4.2,y:-1.58,z:-3.2,width:1.65,height:.68,bank:2,inverted:false,slab:true},
  {x:4.2,y:-1.58,z:-3.2,width:1.65,height:.68,bank:2,inverted:false,slab:true},
  {x:-1.5,y:-1.95,z:-3.6,width:1.4,height:.65,bank:2,inverted:false,slab:true},
  {x:1.5,y:-1.95,z:-3.6,width:1.4,height:.65,bank:2,inverted:false,slab:true},
  {x:-5.5,y:.1,z:-4.4,width:1.4,height:2.1,bank:2,inverted:false,slab:false},
  {x:5.5,y:.1,z:-4.4,width:1.4,height:2.1,bank:2,inverted:true,slab:false},
  {x:-3.6,y:2.55,z:-5.2,width:1.45,height:.65,bank:2,inverted:false,slab:true},
  {x:3.6,y:2.55,z:-5.2,width:1.45,height:.65,bank:2,inverted:false,slab:true},
  {x:-5.3,y:2.55,z:-5.8,width:1.15,height:1.45,bank:2,inverted:true,slab:false},
  {x:5.3,y:2.55,z:-5.8,width:1.15,height:1.45,bank:2,inverted:false,slab:false},
]
export function prismUv(index:number,grouping:string,grouped:boolean,channels:number,step:number){
  const p=PRISM_ANCHORS[index]!, count=Math.max(1,channels)
  // Continuous coordinates describe a common 12.8 x 6 composition in world XY.
  // Grouped coordinates describe a full fitted feed per physical aperture.
  const width=12.8,height=6
  const w=grouped?1:p.width/width,h=grouped?1:p.height/height
  const x=grouped?0:clamp(.5+p.x/width-w/2,0,1-w)
  const y=grouped?0:clamp(.5+p.y/height-h/2,0,1-h)
  const group=grouped?(grouping==='upright-inverted'?(p.inverted?1:0):p.bank):0
  return {x,y,w,h,channel:(group+step)%count,aspect:grouped?p.width/p.height:width/height}
}
export interface RefractionMotion {
  pattern:RefractionPattern;phase:number;separation:number;rotation:number;transmission:number;roughness:number;refraction:number;
  intensity:number;safe:boolean;readability:boolean;vocal:number;kick:number;snare:number;drop:number;bass:number;mid:number;build:number;downbeat:number;phrase:number;impact:number;high:number;energy:number;beat:number;edgeEmission:number;
}
export function prismPose(index:number,p:RefractionMotion){
  const a=PRISM_ANCHORS[index]!,t=p.phase,side=a.inverted?-1:1,wave=Math.sin(t+index*.63), clear=(1-Math.cos(t))/2
  let x=0,y=0,z=0,rx=0,ry=0,light=.3,glass=1,optical=.15
  switch(p.pattern){
    case 'prism-rotation': ry=side*Math.sin(t)*.85;rx=.2*wave;z=.12*wave;light=.4+.22*Math.cos(t+index);break
    case 'spectral-split': x=Math.sign(a.x)*clear*.6;y=side*clear*.24;z=side*clear*.65;ry=side*clear*.45;light=.48+.2*wave;optical=.35;break
    case 'transparency': glass=.45+.55*clear;light=.28+.2*clear;z=.06*wave;break
    case 'convergence': x=-a.x*.10*clear;y=-a.y*.08*clear;z=(a.bank? .45:-.12)*clear;ry=.18*wave*(1-clear);light=.35+.5*clear;break
    case 'glass-relay': {const chase=(t/(2*Math.PI)*2)%1;const distance=Math.abs(index/PRISM_CAPACITY-chase);light=.16+.84*Math.exp(-(Math.min(distance,1-distance)**2)/.018);z=.22*light*side;break}
    case 'refraction': optical=.25+.75*clear;ry=side*.34*wave;rx=.16*wave;light=.4+.35*clear;glass=.75+.25*clear;break
  }
  const restraint=(p.readability ? .65 : 1)*(1-.3*p.vocal)*(p.safe ? .8 : 1),amp=p.intensity*restraint
  const rotation=p.rotation===0?0:Math.min(40,p.rotation+6*p.mid)*Math.PI/180
  const depth=clamp(z*(p.separation+.2*p.bass)+.25*p.kick*side+.15*p.build*side+.24*p.drop*wave,-.8,.8)
  const emission=p.edgeEmission===0?0:clamp((light*p.edgeEmission+.15*p.high+.08*p.snare*(a.inverted?1:0)+.14*p.downbeat*(1+wave)/2+.08*p.phrase+.06*p.beat+.05*p.energy+.16*p.impact*p.drop)*p.intensity)
  return {x:x*amp,y:y*amp,z:depth*amp,rx:rx*rotation*amp,ry:ry*rotation*amp,light:emission,glass:clamp(glass),optical:clamp(optical*p.refraction*restraint*(1+.15*p.kick))}
}
