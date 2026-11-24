
export type Point = [number, number, number]
export type Color = readonly [number, number, number, number]
export type Palette = Record<'background'|'metal'|'secondary'|'strand'|'core'|'hazeTint', Color>
export type Emit = (a:Point,b:Point,r:number,role?:number,energy?:number)=>void
export interface ArtifactState {
  values:Record<string,number>; pattern:string; previous:string; transition:number; phase:number;
  motion:number; flash:number; silence:number; projectionPhase:number; extraEnabled:boolean; palette:Palette
}
export interface Control {key:string; label:string; description:string; value:number; min:number; max:number; step:number; group:string}
export interface ArtifactSpec {
  id:string; description:string; patterns:readonly string[]; build:string; drop:string;
  controls:readonly Control[]; extra?:{key:string;label:string;description:string}; palette:Palette; paletteLabels:readonly string[];
  room:{floor:number}; camera:{wide:Point;path:Point[];macro:Point[];fov:number};
  mood:readonly ({source:'mood.build'|'mood.calm'|'mood.peak'|'mood.complexity'|'mood.momentum';operation:'add'|'multiply';value:number;key:string})[];
  geometry:(s:ArtifactState,emit:Emit,quality:string)=>void
}
export const clamp=(x:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x))
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t
export const ease=(t:number)=>{t=clamp(t);return t*t*(3-2*t)}
export const TAU=Math.PI*2
export const SIGNALS=Object.fromEntries('overallEnergy subAmount bassPressure lowMidAmount midAmount highsAmount airAmount fluxAmount vocalPresence directorIntensity directorMomentum buildAmount directorImpact variation beatAccent kickAccent snareAccent downbeatAccent barAccent phraseAccent sectionAccent dropAccent'.split(' ').map(k=>[k,0]))
export function defaults(spec:ArtifactSpec):Record<string,number>{return {reactivity:1,motionAmount:.8,intensity:1,density:.85,motionRate:.7,strandThickness:.045,coreScale:1,coreIntensity:1,projectionIntensity:.85,lightDistance:5.8,projectionSpeed:.5,shadowSoftness:1,...Object.fromEntries(spec.controls.map(c=>[c.key,c.value])),...SIGNALS}}
export const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
export const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
export const mul=(a:Point,s:number):Point=>[a[0]*s,a[1]*s,a[2]*s]
export const cross=(a:Point,b:Point):Point=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
export const norm=(a:Point):Point=>mul(a,1/Math.max(1e-8,Math.hypot(...a)))
export const lerpPoint=(a:Point,b:Point,t:number):Point=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)]
export function rotate(p:Point,x:number,y:number,z:number):Point {
  const a=p[0],b=p[1]*Math.cos(x)-p[2]*Math.sin(x),c=p[1]*Math.sin(x)+p[2]*Math.cos(x)
  const d=a*Math.cos(y)+c*Math.sin(y),e=-a*Math.sin(y)+c*Math.cos(y)
  return [d*Math.cos(z)-b*Math.sin(z),d*Math.sin(z)+b*Math.cos(z),e]
}
export function sample(n:number,fn:(t:number)=>Point):Point[]{return Array.from({length:n+1},(_,i)=>fn(i/n))}
export const steps=(q:string,low:number,medium:number,high:number)=>q==='low'?low:q==='medium'?medium:high
export const pulse=(phase:number)=>.5+.5*Math.sin(phase)
export const movement=(s:ArtifactState)=>s.motion*(1-.7*s.values.vocalPresence)*(1-.8*s.silence)
export function pose<T extends number[]>(s:ArtifactState,fn:(pattern:string)=>T):T {
  const a=fn(s.previous),b=fn(s.pattern);return b.map((n,i)=>mix(a[i]!,n,ease(s.transition))) as T
}
/** Continuous transported section normals avoid sudden flips at vertical tangents. Rails and braces share nodes. */
export function truss(s:ArtifactState,emit:Emit,path:Point[],width:number,depth:number,seed:number,taper=0,energy=1,closed=false):void{
  let prior:Point[]|undefined,first:Point[]|undefined,normal:Point|undefined
  const v=s.values,rod=v.strandThickness,segments=path.length-1
  for(let i=0;i<path.length;i++){
    const t=i/segments,p=path[i]!, tangent=norm(sub(path[Math.min(i+1,segments)]!,path[Math.max(0,i-1)]!))
    if(i===segments&&closed&&first){prior&&connect(prior,first,i);break}
    const ref:Point=Math.abs(tangent[2])<.85?[0,0,1]:[0,1,0]
    const next=normal?sub(normal,mul(tangent,normal[0]*tangent[0]+normal[1]*tangent[1]+normal[2]*tangent[2])):cross(tangent,ref)
    normal=norm(Math.hypot(...next)<.001?cross(tangent,ref):next)
    const binormal=norm(cross(tangent,normal)),w=1-taper*Math.pow(t,1.15)
    const ring:Point[]=Array.from({length:3},(_,j)=>{const a=j*TAU/3+Math.PI/6;return add(p,add(mul(normal!,Math.cos(a)*width*w),mul(binormal,Math.sin(a)*depth*w)))})
    if(!first)first=ring
    for(let j=0;j<3;j++)emit(ring[j]!,ring[(j+1)%3]!,rod*.73,1)
    if(prior)connect(prior,ring,i)
    prior=ring
  }
  function connect(a:Point[],b:Point[],i:number){
    const t=i/segments,thin=1-taper*.65*t
    const light=energy*(.65+.55*v.midAmount+.3*v.highsAmount+.12*v.airAmount+.2*v.fluxAmount+.22*v.directorIntensity+.2*s.flash*v.beatAccent+.16*s.flash*v.directorImpact)*(.75+.25*pulse(s.phase*.8-t*5+seed))
    for(let j=0;j<3;j++){
      emit(a[j]!,b[j]!,rod*thin*1.18,0)
      if(((i*17+j*7+seed*3)%19+19)%19/19<v.density)emit(a[j]!,b[(j+1)%3]!,rod*thin*.68,1)
      if(j===(i+seed+30)%3){
        // Raise the inset channel onto the outer rail surface. A coaxial narrower cylinder would be hidden inside the opaque primary beam.
        const outerA=add(a[j]!,mul(norm(sub(a[j]!,path[i-1]!)),rod*thin*1.12))
        const outerB=add(b[j]!,mul(norm(sub(b[j]!,path[i]!)),rod*thin*1.12))
        const c=lerpPoint(outerA,outerB,.12),d=lerpPoint(outerA,outerB,.88)
        emit(c,d,rod*thin*.62,2,light)
      }
    }
  }
}
export function cage(s:ArtifactState,emit:Emit,center:Point,radii:Point,segments:number,levels:number,angle:number):void {
  const r=s.values.strandThickness,rows:Point[][]=[]
  for(let j=0;j<=levels;j++){
    const elev=-1.42+2.84*j/levels
    rows.push(Array.from({length:segments},(_,i)=>{const a=i*TAU/segments+angle+j%2*Math.PI/segments;return add(center,[radii[0]*Math.cos(elev)*Math.cos(a),radii[1]*Math.sin(elev),radii[2]*Math.cos(elev)*Math.sin(a)])}))
  }
  for(let j=0;j<=levels;j++)for(let i=0;i<segments;i++){
    const p=rows[j]![i]!,q=rows[j]![(i+1)%segments]!
    emit(p,q,r*.9,(i+j)%4===0?2:0,.95)
    if(j<levels){emit(p,rows[j+1]![i]!,r,0);emit(p,rows[j+1]![(i+1)%segments]!,r*.68,1)}
  }
}
export function lightPosition(spec:ArtifactSpec,s:ArtifactState,i:number):Point{
  // Both projectors remain in front of the sculpture so the rear architectural bays receive distinct projections.
  const v=s.values,spread=clamp(v.lightDistance-s.motion*(.65*v.dropAccent+.35*v.bassPressure),4.1,7.8)
  const phase=s.projectionPhase+(i?2.2:0),side=i?1:-1
  const bias=spec.id==='seraph'?1.1:spec.id==='relic'?.35:.65
  return [side*(spread*.72+.65*Math.sin(phase)),bias+side*.8+.55*Math.cos(phase),spread*.83+.4*Math.sin(phase*.7)]
}

/** Keep the entire physical assembly coherent at simultaneous control extremes. The safety fit only contracts poses that exceed the floor/room envelope; no individual beam endpoint is clipped. */
export function boundedGeometry(geometry:ArtifactSpec['geometry'],minY:number,maxRadius:number):ArtifactSpec['geometry'] {
  return (state,emit,quality)=>{
    const rods:{a:Point;b:Point;r:number;role:number;energy:number}[]=[]
    let fit=1
    geometry(state,(a,b,r,role=0,energy=1)=>{
      for(const p of [a,b]){
        if(p[1]<minY)fit=Math.min(fit,minY/p[1])
        const extent=Math.hypot(...p)+r;if(extent>maxRadius)fit=Math.min(fit,maxRadius/extent)
      }
      rods.push({a,b,r,role,energy})
    },quality)
    for(const rod of rods)emit(fit===1?rod.a:mul(rod.a,fit),fit===1?rod.b:mul(rod.b,fit),rod.r*fit,rod.role,rod.energy)
  }
}
