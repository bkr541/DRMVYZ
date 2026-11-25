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
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t)}
export function shardPose(shard:Shard,p:FractureMotion){
 const phase=p.phase,cycle=((phase/(Math.PI*2))%1+1)%1,route=shard.route*.57, wave=(1+Math.sin(phase*2-route))/2, pulse=Math.sin(Math.PI*cycle)**2,local=(1+Math.sin(phase*2+shard.id*1.73))/2;let release=0,depth=0,tilt=0,light=.35
 switch(p.pattern){case 'fracture':release=.12*local*pulse;depth=.12*wave*pulse;tilt=.08*local*pulse;light=.45+.45*wave;break;case 'suspension':release=.18*pulse;depth=.72*wave*pulse;tilt=.32*wave*pulse;light=.45;break;case 'scatter':release=pulse;depth=.85*pulse;tilt=pulse;light=.45+.55*pulse;break;case 'contour-chase':light=.14+.86*wave**5;break;case 'reconstruction':{const t=clamp((cycle-.05-(shard.route%5)*.035)/.64);release=(1-smooth(t))*smooth(cycle/.05);depth=release;tilt=release;light=.3+.7*(1-release);break}case 'shatter-wave':release=.72*wave**3*pulse;depth=wave*pulse;tilt=.65*release;light=.22+.78*wave**3;break}
 const transient=p.drop*(.78+.22*p.impact),hit=p.kick*(shard.id%4===Math.floor(phase*2)%4?1:0);release=clamp(release+transient+.22*hit+.12*p.build);depth=clamp(depth+transient+.25*hit);tilt=clamp(tilt+transient+.12*hit)
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.78:1)*(p.readability?.72:1)*(1-.3*p.vocal):0
 const spread=p.spread===0?0:clamp(p.spread+.2*p.bass),travel=p.depthTravel===0?0:clamp(p.depthTravel+.2*p.bass),rotation=p.rotation===0?0:Math.min(70,p.rotation+8*p.mid)*Math.PI/180
 return {x:shard.axis.x*release*spread*amp*1.35,y:shard.axis.y*release*spread*amp*.78,z:(shard.id%2?1:-1)*depth*travel*amp*1.2,rx:shard.tilt*tilt*rotation*amp*.65,ry:shard.axis.x*tilt*rotation*amp,rz:shard.tilt*tilt*rotation*amp*.22,light:p.crackEmission===0?0:clamp(p.intensity*(p.crackEmission*(p.active?light:.35)+.15*p.high+.18*p.snare*wave+.15*p.downbeat*wave+.08*p.phrase+.05*p.beat+.05*p.energy))}
}
