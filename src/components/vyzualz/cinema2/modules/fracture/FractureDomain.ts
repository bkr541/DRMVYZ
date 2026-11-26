import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
export const FRACTURE_PATTERNS=[{value:'fracture',label:'Fracture'},{value:'suspension',label:'Suspension'},{value:'scatter',label:'Scatter'},{value:'contour-chase',label:'Contour Chase'},{value:'reconstruction',label:'Reconstruction'},{value:'shatter-wave',label:'Shatter Wave'}] as const
export type FracturePattern=typeof FRACTURE_PATTERNS[number]['value']
export const FRACTURE_COLORS={background:[9/255,9/255,16/255,1],structural:[53/255,59/255,70/255,1],primary:[242/255,245/255,1,1],secondary:[113/255,60/255,1,1],accent:[33/255,217/255,231/255,1]} as const satisfies Record<string,Cinema2Color>
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export const PANEL_WIDTH=8, PANEL_HEIGHT=4.5
export type Point={x:number;y:number}
export interface Shard {id:number; polygon:Point[]; center:Point; site:Point; neighbors:number[]; route:number; axis:Point; tilt:number}
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
 const shards=sites.map((site,id):Shard=>{let polygon=rectangle();sites.forEach((other,j)=>{if(j===id)return;polygon=clip(polygon,other.x-site.x,other.y-site.y,(other.x**2+other.y**2-site.x**2-site.y**2)/2)});const center=centroid(polygon),angle=Math.atan2(center.y,center.x)+(random()-.5)*.22;return {id,polygon,center,site,neighbors:[],route:-1,axis:{x:Math.cos(angle),y:Math.sin(angle)},tilt:random()*2-1}})
 for(const shard of shards)for(const other of shards){if(other.id<=shard.id)continue;const shared=shard.polygon.filter(p=>other.polygon.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6));if(shared.length>=2){shard.neighbors.push(other.id);other.neighbors.push(shard.id)}}
 const first=shards.reduce((a,b)=>a.center.x<b.center.x?a:b);first.route=0;const queue=[first];for(let i=0;i<queue.length;i++){const a=queue[i]!;for(const id of a.neighbors){const b=shards[id]!;if(b.route<0){b.route=a.route+1;queue.push(b)}}}return shards
}
/** True uniform edge inset, capped by centroid clearance so no cell collapses. */
export function insetPolygon(shard:Shard,amount:number):Point[]{let clearance=Infinity;const edges=shard.polygon.map((a,i)=>{const b=shard.polygon[(i+1)%shard.polygon.length]!,len=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.y-a.y)/len,ny=(a.x-b.x)/len,c=a.x*nx+a.y*ny;clearance=Math.min(clearance,c-shard.center.x*nx-shard.center.y*ny);return {nx,ny,c}});let p=shard.polygon;const d=Math.min(amount,clearance*.55);for(const e of edges)p=clip(p,e.nx,e.ny,e.c-d);return p}
export interface FractureMotion {pattern:FracturePattern;phase:number;spread:number;depthTravel:number;rotation:number;reassemblyTime:number;active:boolean;intensity:number;safe:boolean;locked:boolean;readability:boolean;vocal:number;kick:number;snare:number;drop:number;bass:number;mid:number;build:number;downbeat:number;phrase:number;impact:number;high:number;energy:number;beat:number;crackEmission:number}
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)}
/** Shared beat phase, not an independent clock. Every cycle returns to the original plane. */
export function ruptureEnvelope(cycle:number){
 const c=((cycle%1)+1)%1
 const crack=smooth((c-.12)/.13),open=smooth((c-.25)/.22),close=smooth((c-.70)/.23)
 return {crack:crack*(1-close),open:open*(1-close),suspend:smooth((c-.47)/.10)*(1-close)}
}
/** Authored peripheral fragments: three offset depth strata, not a rectangular room. */
export function ruptureField(seed:number){
 return tessellate(36,seed^0x5f37).map((shard,i)=>{
  const layer=i%3,side=i%2?1:-1,t=Math.floor(i/6)/5
  const angle=-1.10+t*2.2+(shard.tilt*.13)
  const radius=1+layer*.24
  return {shard,layer,x:side*(4.9+Math.cos(angle)*1.7)*radius,y:Math.sin(angle)*4.8*radius+side*.38,z:layer===0?1.05+shard.tilt*.4:-2.5-(layer-1)*4.3+shard.tilt*.7,
   width:.82+layer*.78+Math.abs(shard.tilt)*.45,height:1.45+layer*.45,thickness:.18+layer*.25+Math.abs(shard.tilt)*.26,
   rx:shard.tilt*.65,ry:side*(.38+layer*.13),rz:side*(angle*.54+.32),lit:i%5===0||i%7===0}
 })
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
 let release=0,depth=0,tilt=0,light=.20,dx=shard.axis.x,dy=shard.axis.y,zSign=shard.id%2?1:-1
 switch(p.pattern){
  case 'fracture': // diagonal fault splits two plates, with a narrow traveling crack front
   release=.35*crack+.26*open;depth=.45*open*(.4+.6*wave);tilt=.25*crack;dx=side;dy=side*.38;light=.15+.85*wave**4;break
  case 'suspension': // alternating depth strata, with little lateral displacement
   release=.16*open;depth=.65*open+.28*suspend*local;tilt=.30*open;light=.22+.35*suspend;break
  case 'scatter': // radial expansion, outer pieces lead and retreat into the void
   release=open*(.64+.36*radius);depth=open*(.55+.45*local);tilt=.85*open;light=.22+.78*crack*wave;break
  case 'contour-chase': // a travelling luminous front physically lifts a narrow chain of cells
   release=.22*crack*wave**5;depth=.52*crack*wave**5;tilt=.18*crack*wave**5;light=.08+.92*wave**6;break
  case 'reconstruction': { // staggered return by connected adjacency, not by random timer
   const t=smooth((cycle-.50-(shard.route%5)*.035)/.32)
   release=smooth((cycle-.10)/.22)*(1-t);depth=.85*release;tilt=.65*release;light=.15+.85*t;break}
  case 'shatter-wave': { // sweep across the source plane with a spatially coherent depth crest
   const crest=Math.exp(-(((cycle*2.8-.9-shard.center.x/4)*3.6)**2))*crack
   release=.65*crest;depth=crest;tilt=.52*crest;dx=shard.axis.x*.75;dy=shard.axis.y;zSign=-1;light=.12+.88*crest;break}
 }
 // Phrase closes the fault; a shared drop always takes precedence. No local event detector.
 const reform=1-.86*p.phrase,transient=p.drop*(.78+.22*p.impact),hit=p.kick*(.35+.65*wave)
 release=clamp(release*reform+transient+.20*hit+.14*p.build);depth=clamp(depth*reform+transient+.26*hit);tilt=clamp(tilt*reform+transient+.12*hit)
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.72:1)*(p.readability?.68:1)*(1-.3*p.vocal):0
 const spread=p.spread===0?0:clamp(p.spread+.2*p.bass),travel=p.depthTravel===0?0:clamp(p.depthTravel+.2*p.bass),rotation=p.rotation===0?0:Math.min(70,p.rotation+8*p.mid)*Math.PI/180
 // Outward separation precedes larger rotation; depth is biased away from the camera.
 const angularClearance=clamp(release*1.6+depth*.4)
 return {x:dx*release*spread*amp*1.65,y:dy*release*spread*amp*1.05,z:zSign*depth*travel*amp*(zSign>0?1.45:2.65),rx:shard.tilt*tilt*rotation*amp*.48*angularClearance,ry:shard.axis.x*tilt*rotation*amp*.72*angularClearance,rz:shard.tilt*tilt*rotation*amp*.22*angularClearance,light:p.crackEmission===0?0:clamp(p.intensity*(p.crackEmission*(p.active?light:.22)+.15*p.high+.18*p.snare*wave+.15*p.downbeat*wave+.08*p.phrase+.05*p.beat+.05*p.energy))}
}
