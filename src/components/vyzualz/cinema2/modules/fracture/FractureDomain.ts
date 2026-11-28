import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
export const FRACTURE_PATTERNS=[{value:'fracture',label:'Fracture'},{value:'suspension',label:'Suspension'},{value:'scatter',label:'Scatter'},{value:'contour-chase',label:'Contour Chase'},{value:'reconstruction',label:'Reconstruction'},{value:'shatter-wave',label:'Shatter Wave'}] as const
export type FracturePattern=typeof FRACTURE_PATTERNS[number]['value']
export const FRACTURE_COLORS={background:[3/255,3/255,9/255,1],structural:[14/255,17/255,29/255,1],primary:[181/255,140/255,1,1],secondary:[145/255,36/255,1,1],accent:[33/255,217/255,231/255,1]} as const satisfies Record<string,Cinema2Color>
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
export const PANEL_WIDTH=8, PANEL_HEIGHT=4.5
export type Point={x:number;y:number}
type Vec3={x:number;y:number;z:number}
export interface Shard {id:number; polygon:Point[]; center:Point; site:Point; neighbors:number[]; route:number; assemblyRank:number; assemblyRanks:number[]; area:number; group:number; groupCenter:Point; groupAxis:Point; axis:Point; tilt:number; target:Vec3; spinAxis:Vec3; speed:number}
const rectangle=():Point[]=>[{x:-4,y:-2.25},{x:4,y:-2.25},{x:4,y:2.25},{x:-4,y:2.25}]
function clip(poly:Point[],nx:number,ny:number,c:number):Point[]{
 const result:Point[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=a.x*nx+a.y*ny-c,db=b.x*nx+b.y*ny-c;if(da<=1e-9)result.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}}return result.filter((p,i)=>{const q=result[(i+result.length-1)%result.length]!;return Math.hypot(p.x-q.x,p.y-q.y)>1e-8})
}
export function polygonArea(poly:readonly Point[]){return poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length]!;return s+p.x*q.y-q.x*p.y},0)/2}
function centroid(poly:Point[]):Point{let x=0,y=0;for(let i=0;i<poly.length;i++){const p=poly[i]!,q=poly[(i+1)%poly.length]!,k=p.x*q.y-q.x*p.y;x+=(p.x+q.x)*k;y+=(p.y+q.y)*k}const a=6*polygonArea(poly);return {x:x/a,y:y/a}}
/** A seeded hierarchy of irregular straight fractures, not a regular site lattice.
 * Each split partitions its parent exactly. Shared edges can contain T junctions.
 */
export function tessellate(count:number,seed:number):Shard[]{
 count=Math.round(clamp(count,16,120));let state=seed>>>0
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
 type Cell={polygon:Point[];group:number;priority:number}
 const split=(polygon:Point[]):[Point[],Point[]]=>{
  const center=centroid(polygon),angle=random()*Math.PI,nx=Math.cos(angle),ny=Math.sin(angle)
  const projection=polygon.map(p=>p.x*nx+p.y*ny),lo=Math.min(...projection),hi=Math.max(...projection)
  const c=clamp(center.x*nx+center.y*ny+(random()-.5)*(hi-lo)*.40,lo+(hi-lo)*.27,hi-(hi-lo)*.27)
  const a=clip(polygon,nx,ny,c),b=clip(polygon,-nx,-ny,-c)
  if(a.length>=3&&b.length>=3&&Math.min(polygonArea(a),polygonArea(b))>polygonArea(polygon)*.12)return [a,b]
  const mid=center.x*nx+center.y*ny
  return [clip(polygon,nx,ny,mid),clip(polygon,-nx,-ny,-mid)]
 }
 const cells:Cell[]=[{polygon:rectangle(),group:0,priority:1}]
 const subdivide=(roots:boolean)=>{
  let index=0,best=-1
  cells.forEach((c,i)=>{const score=polygonArea(c.polygon)*c.priority;if(score>best){best=score;index=i}})
  const cell=cells[index]!,[a,b]=split(cell.polygon)
  cells.splice(index,1,{polygon:a,group:cell.group,priority:.55+random()*1.55},{polygon:b,group:roots?cells.length:cell.group,priority:.55+random()*1.55})
 }
 while(cells.length<7)subdivide(true)
 const groups=cells.map(c=>centroid(c.polygon))
 cells.forEach((c,i)=>{c.group=i;c.priority=.55+random()*1.55})
 // Keep a few substantial plates intact; concentrate secondary cracks in other regions.
 const firstProtected=Math.floor(random()*7)
 const protectedGroups=new Set([firstProtected,(firstProtected+3)%7])
 cells.forEach(c=>{if(protectedGroups.has(c.group))c.priority=.04})
 while(cells.length<count)subdivide(false)
 const shards=cells.map(({polygon,group},id):Shard=>{
  const center=centroid(polygon),gc=groups[group]!,angle=Math.atan2(center.y,center.x)+(random()-.5)*.3
  const groupAngle=Math.atan2(gc.y,gc.x),area=polygonArea(polygon),tilt=random()*2-1
  return {id,polygon,center,site:center,neighbors:[],route:-1,assemblyRank:0,assemblyRanks:[],area,group,groupCenter:gc,groupAxis:{x:Math.cos(groupAngle),y:Math.sin(groupAngle)},axis:{x:Math.cos(angle),y:Math.sin(angle)},tilt,target:{x:0,y:0,z:0},spinAxis:{x:Math.cos(angle)*.65,y:Math.sin(angle)*.65,z:tilt},speed:.55+random()*1.2}
 })
 const overlaps=(a:Point,b:Point,c:Point,d:Point)=>{
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)
  if(len<1e-8||Math.abs(dx*(c.y-a.y)-dy*(c.x-a.x))>len*1e-7||Math.abs(dx*(d.y-a.y)-dy*(d.x-a.x))>len*1e-7)return false
  const u=((c.x-a.x)*dx+(c.y-a.y)*dy)/len,v=((d.x-a.x)*dx+(d.y-a.y)*dy)/len
  return Math.min(len,Math.max(u,v))-Math.max(0,Math.min(u,v))>1e-7
 }
 for(const shard of shards)for(const other of shards){if(other.id<=shard.id)continue
  if(shard.polygon.some((a,i)=>other.polygon.some((c,j)=>overlaps(a,shard.polygon[(i+1)%shard.polygon.length]!,c,other.polygon[(j+1)%other.polygon.length]!)))){shard.neighbors.push(other.id);other.neighbors.push(shard.id)}
 }
 const first=shards.reduce((a,b)=>a.center.x<b.center.x?a:b);first.route=0;const queue=[first]
 for(let i=0;i<queue.length;i++){const a=queue[i]!;for(const id of a.neighbors){const b=shards[id]!;if(b.route<0){b.route=a.route+1;queue.push(b)}}}
 // Precompute area-ranked connected growth. The last route starts two
 // independent islands, which merge as their frontiers meet.
 const centerScore=(s:Shard)=>Math.hypot(s.center.x,s.center.y)
 const leftScore=(s:Shard)=>s.center.x+Math.abs(s.center.y)*.18
 const rightScore=(s:Shard)=>-s.center.x+Math.abs(s.center.y)*.18
 const topScore=(s:Shard)=>-s.center.y+Math.abs(s.center.x)*.13
 const bottomScore=(s:Shard)=>s.center.y+Math.abs(s.center.x)*.13
 const diagonalScore=(s:Shard)=>s.center.x+s.center.y*1.4
 const dualScore=(s:Shard)=>Math.min(Math.hypot(s.center.x+2,s.center.y),Math.hypot(s.center.x-2,s.center.y))
 const scores=[centerScore,leftScore,rightScore,topScore,bottomScore,diagonalScore,dualScore]
 scores.forEach((score,route)=>{
  const origin=shards.reduce((a,b)=>score(a)<score(b)?a:b)
  const second=route===6?shards.reduce((a,b)=>Math.hypot(a.center.x+(origin.center.x>0?2:-2),a.center.y)<Math.hypot(b.center.x+(origin.center.x>0?2:-2),b.center.y)?a:b):origin
  const frontier=second===origin?[origin]:[origin,second],seen=new Set(frontier.map(s=>s.id));let area=0
  while(frontier.length){frontier.sort((a,b)=>score(a)-score(b));const a=frontier.shift()!;area+=a.area;a.assemblyRanks[route]=area/(PANEL_WIDTH*PANEL_HEIGHT)
   for(const id of a.neighbors)if(!seen.has(id)){seen.add(id);frontier.push(shards[id]!)}}
 })
 for(const shard of shards)shard.assemblyRank=shard.assemblyRanks[0]!
 // Major plates retain their source relationship at the nucleus. Smaller cells
 // occupy absolute ellipsoid targets with both positive and negative depth.
 const ranked=[...shards].sort((a,b)=>b.area-a.area)
 ranked.forEach((s,i)=>{
  const k=(i+.5)/ranked.length,az=Math.atan2(s.center.y/2.25,s.center.x/4)+s.tilt*.65
  const latitude=(i%2?1:-1)*(.20+.76*((i*.61803399+.17)%1)),h=Math.sqrt(1-latitude*latitude)
  const radius=.76+.38*((i*.754877666)%1),shell= k<.22?.28:k<.48?.72:1
  s.target={x:s.center.x*(1-shell)+Math.cos(az)*5.05*h*radius*shell,y:s.center.y*(1-shell)+Math.sin(az)*3.05*h*radius*shell,z:latitude*4.65*radius*shell}
 })
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
/** Small splinters with the same angular DNA, distributed in a true ellipsoid. */
export function ruptureField(seed:number){
 return tessellate(72,seed^0x5f37).map((shard,i)=>{
  const layer=i%3,angle=i*2.39996323+shard.tilt*.34,latitude=1-2*(i+.5)/72,h=Math.sqrt(1-latitude*latitude)
  const radial=.88+.36*((i*.61803399)%1),size=(.17+.36*((i*.754877666)%1))*(i%13===0?1.65:1)
  return {shard,layer,x:Math.cos(angle)*5.25*h*radial,y:Math.sin(angle)*3.25*h*radial,z:latitude*4.9*radial,
   width:size*1.15,height:size*.70,thickness:.035+size*.09,rx:shard.tilt*1.3,ry:Math.sin(angle)*1.15,rz:angle+shard.tilt*.6,lit:i%3===0}
 })
}
export const FRACTURE_TRAVEL={x:9.5,y:6.3,z:5.8} as const
function orbit(x:number,y:number,z:number,a:number,b:number){
 const c=Math.cos(a),s=Math.sin(a),u=x*c+z*s,v=z*c-x*s
 return {x:u,y:y*Math.cos(b)-v*Math.sin(b),z:y*Math.sin(b)+v*Math.cos(b)}
}
export function fieldPose(d:ReturnType<typeof ruptureField>[number],p:FractureMotion){
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.75:1):0
 const {open}=ruptureEnvelope(p.phase/(2*Math.PI)),phase=p.phase*d.shard.speed+d.shard.id*1.73
 const burst=clamp(open*.55+p.drop),pulse=(p.bass*.07+p.kick*.10)*p.shardVibration*Math.sin(phase*8)
 const expansion=1+amp*p.spread*(burst*.28*p.sphereExpansion-p.build*.17+pulse)
 const spin=amp*p.orbitalMotion*(.18+.36*burst)*Math.sin(phase*.65)*(d.layer%2?-1:1)
 const turned=orbit(d.x,d.y,d.z,spin,spin*.7),turn=amp*p.rotation*Math.PI/180*(.45*Math.sin(phase)+pulse+p.snare*.22)
 return {x:d.x+(turned.x*expansion-d.x)*p.spread,y:d.y+(turned.y*expansion-d.y)*p.spread,z:d.z+((turned.z*expansion-d.z))*p.depthTravel,rx:d.rx+turn*d.shard.tilt,ry:d.ry+turn,rz:d.rz-turn*.6}
}
export function obsidianRest(shard:Shard){
 const side=shard.group%2?1:-1
 return {x:shard.groupAxis.x*.22,y:shard.groupAxis.y*.18,z:-.18+shard.tilt*.42,rx:shard.tilt*.13,ry:side*.14,rz:shard.tilt*.065}
}
/** Area-ranked connected reveals. Return an exact zero motion multiplier for held cells. */
export function reconstructionWeight(shard:Shard,fraction:number,route=0){return 1-smooth((fraction-(shard.assemblyRanks[route]??shard.assemblyRank))/.065)}
export function shardPose(shard:Shard,p:FractureMotion){
 const phase=p.phase,cycle=((phase/(Math.PI*2))%1+1)%1,route=shard.route*.64
 const {crack,open,suspend}=ruptureEnvelope(cycle),local=phase*shard.speed+shard.id*2.39996323
 const {x:cx,y:cy}=shard.center, {x:gx,y:gy}=shard.groupAxis
 const wave=(1+Math.sin(phase*(2+2*p.build)-route))/2
 let plate=0,volume=0,shock=0,spin=0,light=.10,hold=0
 const readable=p.readability?1:.35,cluster=p.clusterReconstruction*readable
 switch(p.pattern){
  case 'fracture':
   plate=crack*(.92-.28*open);volume=open*.63;spin=open*.35;light=.12+.70*wave**5;hold=.53;break
  case 'suspension':
   plate=crack*.22;volume=open*.96;spin=suspend*.94+open*.28;light=.15+.42*wave**5;hold=.78;break
  case 'scatter':
   plate=crack*.32;volume=open;spin=suspend*.68;light=.20+.80*crack*wave**4;hold=.48;break
  case 'contour-chase': {
   const direction=Math.floor(phase/(2*Math.PI))%4
   const coord=direction===0?shard.route:direction===1?-shard.route:direction===2?(cx+cy)*1.1:(cx-cy)*1.1
   shock=crack*((1+Math.sin(phase*(2+3*p.build)-coord*.68))/2)**6
   light=.06+.94*shock;plate=crack*.12;hold=.82;break}
  case 'reconstruction': {
   const rise=smooth((cycle-.08)/.22),join=smooth((cycle-.38)/.36)
   volume=rise*(1-smooth((cycle-.79)/.14));spin=volume*.48
   hold=clamp(join*(.48+.52*cluster)+smooth((cycle-.74)/.12));light=.12+.64*volume;break}
  case 'shatter-wave': {
   const direction=Math.floor(phase/(2*Math.PI))%4
   const coordinate=direction===0?Math.hypot(cx/4,cy/2.25):direction===1?(cx/4+1)*.5:direction===2?(cy/2.25+1)*.5:(cx/4-cy/2.25+2)*.25
   const front=cycle*(1+Math.round(p.build*2))*1.45
   shock=crack*Math.exp(-(((((front%1.45)-.16-coordinate)*4.8))**2));volume=shock*.40;spin=shock*.45;light=.08+.92*shock;hold=.55;break}
 }
 const holdWindow=smooth((cycle-(p.readability?.49:.60))/.11)*(1-smooth((cycle-(p.readability?.80:.70))/.12))
 const fraction=p.pattern==='reconstruction'?hold:clamp(hold*cluster*holdWindow+.46*p.vocal*cluster+.82*p.phrase*cluster)
 const revealRoute=p.pattern==='reconstruction'?((Math.floor(phase/(2*Math.PI))%7)+7)%7:0
 const reform=reconstructionWeight(shard,fraction,revealRoute)*(1-.90*p.phrase*readable)
 const impact=clamp(p.drop*(.86+.14*p.impact)),compression=1-.52*p.build*(1-impact)
 const release=clamp(volume*compression+impact)*(impact+(1-impact)*reform)
 const structure=plate*compression*reform*(1-impact),kick=p.kick*(.45+.55*wave)*(impact+(1-impact)*reform)
 const physical=clamp(release+structure+shock*reform+kick*.35)
 const amp=p.active&&!p.locked?p.intensity*(p.safe?.84:1)*(1-.20*p.vocal*readable):0
 // The position target is absolute, so source-plane coordinates are cancelled as
 // release approaches one. Saved extents remain hard authorizations.
 const spread=p.spread,depth=p.depthTravel,expansion=p.sphereExpansion
 const breath=1+.085*p.sub*Math.sin(phase*2)
 const mix=clamp(release*expansion*amp*1.55*breath),xy=clamp(spread*1.32),zGain=clamp(depth*1.28)
 const orbitAmount=p.orbitalMotion*spin*reform*(1-.45*p.build)
 const t=shard.target,o=orbit(t.x,t.y,t.z,orbitAmount*Math.sin(local*.48)*.95,orbitAmount*Math.cos(local*.37)*.8)
 const v=p.shardVibration*(.44*p.bass+.32*p.sub+.24*p.kick)*clamp(release+shock*reform+kick*.35+structure*.22)*(.20+.19*p.build)/(1+shard.area*.25)
 const a=Math.sin(local*(7+4*p.build)),b=Math.cos(local*9),c=Math.sin(local*12)
 const dx=shard.axis.x,dy=shard.axis.y,normal=shard.tilt
 const impulse=shock*reform+kick*.32+p.downbeat*.10*physical
 const rotation=Math.min(70,p.rotation)*Math.PI/180*amp
 const individual=clamp(release+shock*reform+kick*.35),turn=individual*(.38+.35*p.mid)+orbitAmount*Math.sin(local*.85)*.48
 // Rigid plate turn around the root-region centroid. All descendants share
 // the same transform until their secondary fracture opens.
 const plateTurn=rotation*structure*Math.sin(shard.group*2.4)*.34*xy
 const px=cx-shard.groupCenter.x,py=cy-shard.groupCenter.y
 const plateX=px*(Math.cos(plateTurn)-1)-py*Math.sin(plateTurn),plateY=px*Math.sin(plateTurn)+py*(Math.cos(plateTurn)-1)
 return {
  x:clamp((o.x-cx)*mix*xy+amp*spread*(gx*structure*1.2+dx*impulse*.60+v*(dx*a-dy*b))+plateX,-FRACTURE_TRAVEL.x,FRACTURE_TRAVEL.x),
  y:clamp((o.y-cy)*mix*xy+amp*spread*(gy*structure*.90+dy*impulse*.45+v*(dy*a+dx*b))+plateY,-FRACTURE_TRAVEL.y,FRACTURE_TRAVEL.y),
  z:clamp(o.z*mix*zGain+amp*depth*(Math.sin(shard.group*2.4)*structure*1.65+normal*impulse*1.9+v*c),-FRACTURE_TRAVEL.z,FRACTURE_TRAVEL.z),
  rx:clamp(shard.spinAxis.x*turn+v*b+p.snare*individual*.16,-1,1)*rotation,
  ry:clamp(shard.spinAxis.y*turn+v*c,-1,1)*rotation,
  rz:clamp(shard.spinAxis.z*turn+v*a+structure*Math.sin(shard.group*2.4)*.34*xy,-1,1)*rotation,
  light:p.crackEmission===0?0:clamp(p.intensity*p.crackEmission*(p.active?light+.45*p.high*wave**4+.4*p.snare*wave+.5*p.drop*wave+.22*p.beat*wave+.18*p.energy:.10))
 }
}
