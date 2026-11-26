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
// A large central optical gate, staggered lateral crystal banks and deep relay surfaces.
// The first six anchors retain a complete composition at minimum prism count.
export const PRISM_ANCHORS: readonly PrismAnchor[] = [
  {x:0,y:.15,z:.65,width:3.05,height:3.65,bank:0,inverted:false,slab:false},
  {x:-2.65,y:-.25,z:-.15,width:1.85,height:3.65,bank:0,inverted:true,slab:false},
  {x:2.65,y:-.25,z:-.15,width:1.85,height:3.65,bank:0,inverted:false,slab:false},
  {x:-3.95,y:.55,z:-2.9,width:1.6,height:3.4,bank:1,inverted:false,slab:false},
  {x:3.95,y:.55,z:-2.9,width:1.6,height:3.4,bank:1,inverted:true,slab:false},
  {x:0,y:2.65,z:-2.8,width:3.1,height:.72,bank:1,inverted:false,slab:true},
  {x:-1.65,y:2.25,z:-4.1,width:1.3,height:1.5,bank:1,inverted:true,slab:false},
  {x:1.65,y:2.25,z:-4.1,width:1.3,height:1.5,bank:1,inverted:false,slab:false},
  {x:-4.3,y:-1.9,z:-4.1,width:1.65,height:.65,bank:2,inverted:false,slab:true},
  {x:4.3,y:-1.9,z:-4.1,width:1.65,height:.65,bank:2,inverted:false,slab:true},
  {x:-1.55,y:-2.2,z:-4.9,width:1.45,height:.65,bank:2,inverted:false,slab:true},
  {x:1.55,y:-2.2,z:-4.9,width:1.45,height:.65,bank:2,inverted:false,slab:true},
  {x:-5.4,y:.1,z:-5.1,width:1.25,height:2.8,bank:2,inverted:false,slab:false},
  {x:5.4,y:.1,z:-5.1,width:1.25,height:2.8,bank:2,inverted:true,slab:false},
  {x:-3.5,y:2.65,z:-6,width:1.4,height:.65,bank:2,inverted:false,slab:true},
  {x:3.5,y:2.65,z:-6,width:1.4,height:.65,bank:2,inverted:false,slab:true},
  {x:-5.3,y:2.65,z:-6.4,width:1.1,height:1.35,bank:2,inverted:true,slab:false},
  {x:5.3,y:2.65,z:-6.4,width:1.1,height:1.35,bank:2,inverted:false,slab:false},
]
export const OPTICAL_APERTURE = {width:.72,height:.60} as const
export function prismUv(index:number,grouping:string,grouped:boolean,channels:number,step:number){
  const p=PRISM_ANCHORS[index]!, count=Math.max(1,channels)
  // Continuous coordinates describe a common 12.8 x 6 composition in world XY.
  // Grouped coordinates describe a full fitted feed per physical aperture.
  const width=12.8,height=6
  const w=grouped?1:p.width*OPTICAL_APERTURE.width/width,h=grouped?1:p.height*OPTICAL_APERTURE.height/height
  const x=grouped?0:clamp(.5+p.x/width-w/2,0,1-w)
  const y=grouped?0:clamp(.5+p.y/height-h/2,0,1-h)
  const group=grouped?(grouping==='upright-inverted'?(p.inverted?1:0):p.bank):0
  return {x,y,w,h,channel:(group+step)%count,aspect:grouped?p.width*OPTICAL_APERTURE.width/(p.height*OPTICAL_APERTURE.height):width/height}
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

export type OpticalPoint = readonly [number, number, number]
export interface OpticalPath { source:OpticalPoint; entry:OpticalPoint; exit:OpticalPoint; primary:OpticalPoint; secondary:OpticalPoint; gain:number }
/** Analytic, artist-directed light paths in prism-local coordinates. Z is in crystal depths.
 * Both surface crossings are on the broad front/rear facets; the exit rays diverge outside
 * the crystal. No independent clock: phase and envelopes arrive from shared performance.
 */
export function opticalPath(index:number,p:RefractionMotion,locked=false):OpticalPath {
  const a=PRISM_ANCHORS[index]!,t=locked?0:p.phase,side=a.inverted?-1:1
  const wave=Math.sin(t+index*.51),sweep=(1-Math.cos(t))/2
  let sx=-.94*side,sy=.33,ex=-.25*side,ey=.14,ox=.25*side,oy=-.08,dx=.94*side,dy=-.36,spread=.08,gain=1
  switch(p.pattern){
    case 'prism-rotation': sy=.36*wave+.12;ey=.15*wave;oy=-.14*wave;dy=-.35*wave-.12;break
    case 'spectral-split': sy=-.42;ey=-.18;oy=.16;dy=.48;spread=.25+.19*sweep;break
    case 'transparency': sx=-.7*side;sy=.05;ex=-.18*side;ey=0;ox=.18*side;oy=0;dx=.7*side;dy=.05;spread=.035;gain=.45;break
    case 'convergence': {const inward=a.x===0?side:-Math.sign(a.x);sx=-.92*inward;sy=.43;ex=-.22*inward;ey=.18;ox=.22*inward;oy=-.12;dx=1.06*inward;dy=-.42+.28*sweep;spread=.05;break}
    case 'glass-relay': {sx=-.88;sy=.25;ex=-.26;ey=.10;ox=.26;oy=-.10;dx=.88;dy=-.25;const chase=((t/(2*Math.PI)*2)%1+1)%1,d=Math.abs(index/PRISM_CAPACITY-chase);gain=.12+.88*Math.exp(-(Math.min(d,1-d)**2)/.025);break}
    case 'refraction': sx=-.88*side;sy=-.38;ex=-.20*side;ey=-.14;ox=.12*side;oy=.18;dx=.9*side;dy=.28+.26*wave;spread=.15+.17*sweep;break
  }
  const split=spread*p.refraction*(p.readability ? .85 : 1)*(1-.3*p.vocal)*(1+.25*p.build+.25*p.drop)
  // The incident slope is restricted so the straight path always crosses both broad faces.
  // Interpolate from that straight ray to the authored optical bend; no claim of ray tracing.
  sx=ex+(sx-ex)*.42;sy=ey+(sy-ey)*.42
  const bend=p.refraction, straightY=ey+(ey-sy)*1.24/.88, straightX=ex+(ex-sx)*1.24/.88
  ox=straightX+(ox-straightX)*bend;oy=straightY+(oy-straightY)*bend
  const travelX=ox+(ex-sx)*1.53/.88,travelY=oy+(ey-sy)*1.53/.88
  dx=travelX+(dx-travelX)*bend;dy=travelY+(dy-travelY)*bend
  return {source:[sx,sy,-2],entry:[ex,ey,-1.12],exit:[ox,oy,.12],primary:[dx,dy+split,1.65],secondary:[dx,dy-split,1.65],gain}
}
