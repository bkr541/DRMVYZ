import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
export const FRACTURE_PATTERNS=[{value:'fracture',label:'Fracture'},{value:'suspension',label:'Suspension'},{value:'scatter',label:'Scatter'},{value:'contour-chase',label:'Contour Chase'},{value:'reconstruction',label:'Reconstruction'},{value:'shatter-wave',label:'Shatter Wave'}] as const
export type FracturePattern=typeof FRACTURE_PATTERNS[number]['value']
export const FRACTURE_COLORS={background:[9/255,9/255,16/255,1],structural:[53/255,59/255,70/255,1],primary:[242/255,245/255,1,1],secondary:[113/255,60/255,1,1],accent:[33/255,217/255,231/255,1]} as const satisfies Record<string,Cinema2Color>
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export const PANEL_WIDTH=8, PANEL_HEIGHT=4.5
export type Point={x:number;y:number}
export interface Shard {id:number; polygon:Point[]; center:Point; site:Point; neighbors:number[]; route:number; assemblyRank:number; axis:Point; tilt:number}
const rectangle=():Point[]=>[{x:-4,y:-2.25},{x:4,y:-2.25},{x:4,y:2.25},{x:-4,y:2.25}]
function clip(poly:Point[],nx:number,ny:number,c:number):Point[]{
 const result:Point[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=a.x*nx+a.y*ny-c,db=b.x*nx+b.y*ny-c;if(da<=1e-9)result.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}}return result.filter((p,i)=>{const q=result[(i+result.length-1)%result.length]!;return Math.hypot(p.x-q.x,p.y-q.y)>1e-8})
}
export function polygonArea(poly:readonly Point[]){return poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length]!;return s+p.x*q.y-q.x*p.y},0)/2}
function centroid(poly:Point[]):Point{let x=0,y=0;for(let i=0;i<poly.length;i++){const p=poly[i]!,q=poly[(i+1)%poly.length]!,k=p.x*q.y-q.x*p.y;x+=(p.x+q.x)*k;y+=(p.y+q.y)*k}const a=6*polygonArea(poly);return {x:x/a,y:y/a}}
/** Jittered rows guarantee separated sites; clipping every bisector creates matching shared seams. */
export function tessellate(count:number,seed:number):Shard[]{
 count=Math.round(clamp(count,16,120));let state=seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
 const rows=Math.max(2,Math.round(Math.sqrt(count*PANEL_HEIGHT/PANEL_WIDTH))),sites:Point[]=[]
 for(let row=0;row<rows;row++){const cols=Math.floor(count/rows)+(row<count%rows?1:0);for(let col=0;col<cols;col++)sites.push({x:-4+(col+.5+(random()-.5)*.72)*PANEL_WIDTH/cols,y:-2.25+(row+.5+(random()-.5)*.72)*PANEL_HEIGHT/rows})}
 const shards=sites.map((site,id):Shard=>{let polygon=rectangle();sites.forEach((other,j)=>{if(j===id)return;polygon=clip(polygon,other.x-site.x,other.y-site.y,(other.x**2+other.y**2-site.x**2-site.y**2)/2)});const center=centroid(polygon),angle=Math.atan2(center.y,center.x)+(random()-.5)*.22;return {id,polygon,center,site,neighbors:[],route:-1,assemblyRank:0,axis:{x:Math.cos(angle),y:Math.sin(angle)},tilt:random()*2-1}})
 for(const shard of shards)for(const other of shards){if(other.id<=shard.id)continue;const shared=shard.polygon.filter(p=>other.polygon.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6));if(shared.length>=2){shard.neighbors.push(other.id);other.neighbors.push(shard.id)}}
 const first=shards.reduce((a,b)=>a.center.x<b.center.x?a:b);first.route=0;const queue=[first];for(let i=0;i<queue.length;i++){const a=queue[i]!;for(const id of a.neighbors){const b=shards[id]!;if(b.route<0){b.route=a.route+1;queue.push(b)}}}
 // Grow a connected island from the media center; every prefix is contiguous.
 const origin=shards.reduce((a,b)=>Math.hypot(a.center.x,a.center.y)<Math.hypot(b.center.x,b.center.y)?a:b)
 const island=[origin],seen=new Set([origin.id]);for(let i=0;i<island.length;i++){const a=island[i]!;a.assemblyRank=i/(shards.length-1);for(const id of a.neighbors){if(!seen.has(id)){seen.add(id);island.push(shards[id]!)}}}
 return shards
}
/** True uniform edge inset, capped by centroid clearance so no cell collapses. */
export function insetPolygon(shard:Shard,amount:number):Point[]{let clearance=Infinity;const edges=shard.polygon.map((a,i)=>{const b=shard.polygon[(i+1)%shard.polygon.length]!,len=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.y-a.y)/len,ny=(a.x-b.x)/len,c=a.x*nx+a.y*ny;clearance=Math.min(clearance,c-shard.center.x*nx-shard.center.y*ny);return {nx,ny,c}});let p=shard.polygon;const d=Math.min(amount,clearance*.55);for(const e of edges)p=clip(p,e.nx,e.ny,e.c-d);return p}
export interface FractureMotion {pattern:FracturePattern;phase:number;spread:number;depthTravel:number;rotation:number;reassemblyTime:number;active:boolean;intensity:number;safe:boolean;locked:boolean;readability:boolean;vocal:number;kick:number;snare:number;drop:number;bass:number;mid:number;build:number;downbeat:number;phrase:number;impact:number;high:number;energy:number;beat:number;crackEmission:number;sphereExpansion:number;orbitalMotion:number;shardVibration:number;clusterReconstruction:number;sub:number}
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)}
/** Shared beat phase, not an independent clock. Every cycle returns to the original plane. */
export function ruptureEnvelope(cycle:number){
 const c=((cycle%1)+1)%1
 const crack=smooth((c-.12)/.13),open=smooth((c-.25)/.22),close=smooth((c-.70)/.23)
 return {crack:crack*(1-close),open:open*(1-close),suspend:smooth((c-.47)/.10)*(1-close)}
}
/** Seeded irregular ellipsoidal shell: near fragments frame the image, far fragments fill depth. */
export function ruptureField(seed:number){
 return tessellate(48,seed^0x5f37).map((shard,i)=>{
  const layer=i<16?0:i<32?1:2,slot=i%16
  const angle=slot*2.39996323+layer*.87+shard.tilt*.26
  const c=Math.cos(angle),s=Math.sin(angle),jitter=1+shard.tilt*.10
  // Near/middle shards clear the intact rectangle in camera projection. Far shards may sit behind it.
  const edge=1/Math.max(Math.abs(c)/4.9,Math.abs(s)/3.15)
  const radial=layer===0?edge*.93:layer===1?edge*1.24:edge*(.42+.80*((slot*.61803399)%1))
  const z=layer===0?1.2+shard.tilt*1.15:layer===1?-1.8+shard.tilt*1.25:-5.7+shard.tilt*2.3
  const size=(layer===0?1.05:layer===1?.83:.67)*(1+Math.abs(shard.tilt)*.65)
  return {shard,layer,x:c*radial*jitter,y:s*radial*jitter,z,
   width:size*(.65+.48*Math.abs(c)),height:size*(.78+.65*Math.abs(s)),thickness:.24+size*.36,
   rx:shard.tilt*1.15,ry:Math.sin(angle)*.85,rz:angle+shard.tilt*.45,lit:i%5===0||i%7===0}
 })
}
/** Stronger forward/backward travel without changing UVs or the original source plane. */
export const FRACTURE_TRAVEL={x:5.8,y:4.1,z:5.4} as const
/** Rotate a point around two alternating axes; no mutable simulation clock. */
function orbit(x:number,y:number,z:number,a:number,b:number){
 const c=Math.cos(a),s=Math.sin(a),u=x*c+z*s,v=z*c-x*s
 return {x:u,y:y*Math.cos(b)-v*Math.sin(b),z:y*Math.sin(b)+v*Math.cos(b)}
}
/** Environmental fragments follow the same musical phase and energy as the source media. */
export function fieldPose(d:ReturnType<typeof ruptureField>[number],p:FractureMotion){
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.65:1):0
 const {open}=ruptureEnvelope(p.phase/(2*Math.PI)),burst=clamp(open*.55+p.drop),phase=p.phase+d.shard.id*1.73
 const pulse=(p.bass*.12+p.kick*.17)*p.shardVibration*Math.sin(phase*5.5)
 const expansion=1+amp*p.spread*(burst*.45*p.sphereExpansion-p.build*.13+pulse)
 const spin=amp*p.orbitalMotion*burst*(d.layer===0?.10:.30)*Math.sin(phase*.45)*(d.layer%2?-1:1)
 const turned=orbit(d.x,d.y,d.z,spin,spin*.63),turn=amp*p.rotation*Math.PI/180*(.25*Math.sin(phase)+pulse+p.snare*.22)
 return {x:d.x+(turned.x*expansion-d.x)*p.spread,y:d.y+(turned.y*expansion-d.y)*p.spread,z:d.z+((turned.z-d.z)-burst*.6*amp)*p.depthTravel,rx:d.rx+turn*d.shard.tilt,ry:d.ry+turn,rz:d.rz-turn*.6}
}
/** Rest offset for procedural stone only. Media always returns to the exact source plane. */
export function obsidianRest(shard:Shard){
 const fault=shard.center.x+shard.center.y*.78-.25
 const side=fault<0?-1:1,edge=Math.exp(-Math.abs(fault)*.58)
 return {x:side*(.13+.34*edge),y:side*.16*edge,z:-.22+shard.tilt*.38-.52*(1-edge),rx:shard.tilt*.10,ry:side*.10*edge,rz:shard.tilt*.045}
}
export function shardPose(shard:Shard,p:FractureMotion){
 const phase=p.phase,cycle=((phase/(Math.PI*2))%1+1)%1,route=shard.route*.57
 const radius=Math.hypot(shard.center.x/4,shard.center.y/2.25),fault=shard.center.x+shard.center.y*.78-.25,side=fault<0?-1:1
 const wave=(1+Math.sin(phase*2-route))/2,local=(1+Math.sin(phase*2+shard.id*1.73))/2
 const {crack,open,suspend}=ruptureEnvelope(cycle)
 const zSign=shard.id%2?1:-1
 let release=0,depth=0,tilt=0,light=.20,dx=shard.axis.x,dy=shard.axis.y,orbitWeight=0
 switch(p.pattern){
  case 'fracture': // shared plate translation before individual pieces break away
   release=.48*crack+.35*open;depth=.62*open*(.4+.6*wave);tilt=.22*crack+.48*open;dx=side*(1-open)+dx*open;dy=side*.38*(1-open)+dy*open;orbitWeight=.3*open;light=.15+.85*wave**4;break
  case 'suspension':
   release=.58*open;depth=.72*open+.28*suspend*local;tilt=.62*open;orbitWeight=suspend;light=.22+.35*suspend;break
  case 'scatter':
   release=open*(.78+.22*radius);depth=open*(.65+.35*local);tilt=.95*open;orbitWeight=.8*suspend;light=.22+.78*crack*wave;break
  case 'contour-chase': {
   const front=Math.max(wave**5,p.build*((1+Math.sin(phase*4+route))/2)**7)
   release=.30*crack*front;depth=.76*crack*front;tilt=.36*crack*front;light=.08+.92*front;break}
  case 'reconstruction': {
   const t=smooth((cycle-.45-shard.assemblyRank*.21)/.24)
   release=smooth((cycle-.10)/.22)*(1-t);depth=.93*release;tilt=.76*release;orbitWeight=.55*release;light=.15+.85*t;break}
  case 'shatter-wave': {
   const axis=Math.cos(Math.floor(phase/(2*Math.PI))*2.39996323),across=shard.center.x/4*axis+shard.center.y/2.25*Math.sqrt(Math.max(0,1-axis*axis))
   const crest=Math.exp(-(((cycle*2.8-.9-across)*3.6)**2))*crack
   release=.70*crest;depth=crest;tilt=.68*crest;light=.12+.88*crest;break}
 }
 // A connected central island reassembles first. Drop retains precedence, but every quiet cycle ends at home.
 const reveal=p.clusterReconstruction*(p.readability?1:.45)
 const hold=smooth((cycle-.52)/.13)*(1-smooth((cycle-.76)/.12))
 const fraction=clamp((.20+.55*reveal)*hold+.45*p.vocal*reveal+.70*p.phrase*reveal)
 const island=fraction>0?1-smooth((fraction-shard.assemblyRank)*18):1
 const reform=(1-.90*p.phrase)*island
 const transient=p.drop*(.78+.22*p.impact),hit=p.kick*(.35+.65*wave),buildCompression=1-.40*p.build
 release=clamp(release*reform*buildCompression+transient+.19*hit*island)
 depth=clamp(depth*reform*buildCompression+transient+.24*hit*island)
 tilt=clamp(tilt*reform+transient+.14*hit*island)
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.78:1)*(1-.24*p.vocal):0
 const spread=p.spread===0?0:clamp(p.spread+.16*p.bass),travel=p.depthTravel===0?0:clamp(p.depthTravel+.18*p.bass),rotation=p.rotation===0?0:Math.min(70,p.rotation+8*p.mid)*Math.PI/180
 const strength=.45+.55*p.sphereExpansion
 // Each shard gets a deterministic 3D target, distributed both toward and away from camera.
 const latitude=zSign*(.30+.68*((shard.id*.61803399)%1)),horizontal=Math.sqrt(1-latitude*latitude)
 const radialWeight=p.pattern==='fracture'?1-open*(.4-.4*horizontal):.6+.4*horizontal
 const targetX=dx*radialWeight*release,targetY=dy*radialWeight*release,targetZ=latitude*depth
 const orbitAmount=p.orbitalMotion*Math.max(orbitWeight*reform,transient*.45)
 const o=orbit(targetX,targetY,targetZ,orbitAmount*Math.sin(phase*.66+shard.id*.18)*zSign,orbitAmount*Math.cos(phase*.51+shard.tilt)*.65)
 // Seeded radial/tangential vibration is beat-phase driven; it fades with the opening envelope.
 const vibration=p.shardVibration*(.46*p.bass+.30*p.sub+.24*p.kick)*Math.max(release,depth)*.22
 const oscillation=Math.sin(phase*8+shard.id*2.39996323),tangent=Math.cos(phase*6+shard.id*1.73)
 const angularClearance=clamp(release*1.6+depth*.65),spin=p.orbitalMotion*Math.max(release,depth)*Math.sin(phase+shard.id*.71)*.5
 return {x:clamp(o.x+vibration*(dx*oscillation-dy*tangent),-1,1)*FRACTURE_TRAVEL.x*spread*amp*strength,
  y:clamp(o.y+vibration*(dy*oscillation+dx*tangent),-1,1)*FRACTURE_TRAVEL.y*spread*amp*strength,
  z:clamp(o.z+vibration*oscillation,-1,1)*FRACTURE_TRAVEL.z*travel*amp*strength,
  rx:clamp(shard.tilt*tilt+spin+vibration*tangent,-1,1)*rotation*amp*angularClearance,
  ry:clamp(shard.axis.x*tilt-spin*.65+vibration*oscillation,-1,1)*rotation*amp*angularClearance,
  rz:clamp(shard.tilt*tilt*.6+spin*.7+p.snare*tilt*.18,-1,1)*rotation*amp*angularClearance,
  light:p.crackEmission===0?0:clamp(p.intensity*(p.crackEmission*(p.active?light:.22)+.15*p.high+.18*p.snare*wave+.15*p.downbeat*wave+.08*p.phrase+.05*p.beat+.05*p.energy))}
}
