import type * as Three from 'three'
import type { Cinema2Color, Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { FRACTURE_COLORS, PANEL_WIDTH, PANEL_HEIGHT, tessellate, insetPolygon, shardPose, ruptureField, fieldPose, obsidianRest, clamp, type Shard, type Point, type FractureMotion } from './FractureDomain'
export interface FractureLook extends FractureMotion {
 count:number;seed:number;crackWidth:number;thickness:number;reset:boolean;
 mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
 reflection:number;spill:number;debrisDensity:number;fractureLighting:number;colors:{[K in keyof typeof FRACTURE_COLORS]:Cinema2Color};dt:number;paused:boolean;
}
const vertex=`varying vec2 vUV; void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform float uLayout,uGroupMode,uChannels,uStep;uniform float uFit,uScale,uAngle,uOpacity,uBrightness,uPhase;uniform vec2 uOffset;uniform vec3 uPrimary,uSecondary;varying vec2 vUV;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){vec2 uv=vUV;float uChannel=mod(uStep,max(1.,uChannels)),uSurfaceAspect=16./9.;
if(uLayout>.5){if(uGroupMode<.5){vec2 region=min(floor(uv*2.),vec2(1.));uChannel=mod(region.x+region.y*2.+uStep,max(1.,uChannels));uv=uv*2.-region;}else{float region=min(floor(uv.y*3.),2.);uChannel=mod(region+uStep,max(1.,uChannels));uv.y=uv.y*3.-region;uSurfaceAspect*=3.;}}float aspect=uChannel<.5?uAspect.x:uChannel<1.5?uAspect.y:uAspect.z;float fade=uChannel<.5?uFade.x:uChannel<1.5?uFade.y:uFade.z;
vec2 q=uv-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q.x*=uSurfaceAspect;q=mat2(c,-s,s,c)*q/max(.01,uScale);q.x/=max(.001,uSurfaceAspect);
float ratio=uSurfaceAspect/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;

vec3 base=vec3(.006,.009,.015);
float fault=uv.x+uv.y*.44-.73+.035*sin(uv.y*19.);float vein=exp(-abs(fault)*35.);
float facets=pow(max(0.,cos(uv.x*17.+uv.y*9.+sin(uv.y*18.)*.7)),6.);
vec3 fallback=base+uPrimary*facets*.035+uSecondary*vein*.38;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(uChannel<.5)tex=texture2D(uFeed0,q);else if(uChannel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
vec3 content=aspect>0.?mix(fallback,mix(base,linearRGB(tex.rgb),tex.a*inside),fade):fallback;gl_FragColor=vec4(mix(base,content*uBrightness,uOpacity),1.);
#include <colorspace_fragment>
}`
interface RenderShard {data:Shard;group:Three.Group;body:Three.Mesh;edge:Three.MeshStandardMaterial;face:Three.Mesh;rim:Three.LineLoop<Three.BufferGeometry,Three.LineBasicMaterial>;insetScale:number;rest:ReturnType<typeof obsidianRest>}
interface FieldShard {group:Three.Group;body:Three.Mesh;rim:Three.LineSegments;data:ReturnType<typeof ruptureField>[number]}
/** Convex, closed bevel prism. The front plane is always z=0. */
function prism(T:Cinema2ThreeLibrary['THREE'],outer:Point[],inner:Point[],center:Point):Three.BufferGeometry{
 const rings=[{poly:inner,z:0},{poly:outer,z:-.16},{poly:outer,z:-.77},{poly:inner,z:-1}],vertices:number[]=[]
 const vert=(r:number,i:number)=>{const p=rings[r]!.poly[i]!;vertices.push(p.x-center.x,p.y-center.y,rings[r]!.z)}
 for(let r=0;r<3;r++)for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;vert(r,i);vert(r+1,i);vert(r+1,j);vert(r,i);vert(r+1,j);vert(r,j)}
 const sideVertices=vertices.length/3
 for(let i=1;i<inner.length-1;i++){vert(0,0);vert(0,i);vert(0,i+1);vert(3,0);vert(3,i+1);vert(3,i)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.addGroup(0,sideVertices,0);g.addGroup(sideVertices,vertices.length/3-sideVertices,1);return g
}
const contract=(poly:Point[],center:Point,ratio:number)=>poly.map(p=>({x:center.x+(p.x-center.x)*ratio,y:center.y+(p.y-center.y)*ratio}))
/** Native Three geometry with source UVs anchored to the original rest plane. */
export class FractureScene {
 private readonly group:Three.Group;private readonly shards:RenderShard[]=[];private readonly field:FieldShard[]=[];private fieldSeed=-1;private readonly structural:Three.MeshStandardMaterial;private readonly rear:Three.MeshStandardMaterial;private readonly fissure:Three.LineBasicMaterial;private readonly accent:Three.LineBasicMaterial;private readonly light:Three.PointLight;private readonly sideLights:Three.PointLight[];private readonly faceMaterial:Three.ShaderMaterial
 private readonly textures:Three.Texture[];private readonly feeds:(Readonly<Cinema2ManagedMediaResource>|null)[]=[null,null,null];private readonly ages=[0,0,0];private readonly color:Three.Color;private readonly common:Record<string,Three.IUniform>;private renderer:Three.WebGLRenderer|null=null;private geometryKey='';private lastStep=-1
 constructor(private readonly library:Cinema2ThreeLibrary,root:Three.Object3D){
  const T=library.THREE;this.group=new T.Group();root.add(this.group);this.color=new T.Color()
  this.structural=new T.MeshStandardMaterial({metalness:.74,roughness:.23,flatShading:true});this.rear=new T.MeshStandardMaterial({metalness:.58,roughness:.38,flatShading:true});this.fissure=new T.LineBasicMaterial({toneMapped:false});this.accent=new T.LineBasicMaterial({toneMapped:false})
  this.textures=Array.from({length:3},()=>new T.Texture());this.common={uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uLayout:{value:0},uGroupMode:{value:0},uChannels:{value:1},uStep:{value:0},uFit:{value:0},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uPhase:{value:0},uPrimary:{value:new T.Color()},uSecondary:{value:new T.Color()}}
  this.faceMaterial=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:this.common})
  this.light=new T.PointLight(0xffffff,1,12,2);this.light.position.set(0,1.7,2.9);this.group.add(this.light)
  this.sideLights=[new T.PointLight(0xffffff,0,8,2),new T.PointLight(0xffffff,0,8,2)]
  this.sideLights.forEach(l=>this.group.add(l))
 }
 private clearShards(){for(const s of this.shards){s.body.geometry.dispose();s.face.geometry.dispose();s.rim.geometry.dispose();s.rim.material.dispose();s.edge.dispose();s.group.removeFromParent()}this.shards.length=0}
 private clearField(){for(const f of this.field){f.body.geometry.dispose();f.rim.geometry.dispose();f.group.removeFromParent()}this.field.length=0}
 private rebuildField(seed:number){
  this.clearField();const T=this.library.THREE
  for(const data of ruptureField(seed)){
   const {shard}=data,group=new T.Group(),outer=shard.polygon,inner=contract(outer,shard.center,.82)
   const body=new T.Mesh(prism(T,outer,inner,shard.center),data.layer===0?this.structural:this.rear)
   body.scale.set(data.width,data.height,data.thickness);body.receiveShadow=true;group.add(body)
   // Only one or two bevel edges glow; no wireframe cage around each fragment.
   const points:Three.Vector3[]=[];for(let i=0;i<inner.length;i++){if((i+shard.id)%3!==0)continue;const a=inner[i]!,b=inner[(i+1)%inner.length]!;points.push(new T.Vector3((a.x-shard.center.x)*data.width,(a.y-shard.center.y)*data.height,.005),new T.Vector3((b.x-shard.center.x)*data.width,(b.y-shard.center.y)*data.height,.005))}
   const rim=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),data.layer===0?this.accent:this.fissure);group.add(rim);group.position.set(data.x,data.y,data.z);group.rotation.set(data.rx,data.ry,data.rz);this.group.add(group);this.field.push({group,body,rim,data})
  }
  this.fieldSeed=seed
 }
 private rebuild(look:FractureLook){
  this.clearShards();const T=this.library.THREE,gap=look.crackWidth*PANEL_WIDTH*.5
  for(const data of tessellate(look.count,look.seed)){
   const group=new T.Group();group.position.set(data.center.x,data.center.y,0);this.group.add(group)
   const outer=insetPolygon(data,gap),radius=Math.max(...outer.map(p=>Math.hypot(p.x-data.center.x,p.y-data.center.y))),bevelRatio=Math.min(.16,(.025+.035*Math.abs(data.tilt))/Math.max(.001,radius))
   const inner=contract(outer,data.center,1-bevelRatio)
   const edge=this.structural.clone();const body=new T.Mesh(prism(T,outer,inner,data.center),[edge,this.structural]);body.castShadow=true;body.receiveShadow=true;group.add(body)
   // Full rest-plane cap: no inset or bevel removes source pixels during reconstruction.
   // Contract the cap only while opening the fault, keeping UVs anchored to its original polygon.
   const shape=new T.Shape(data.polygon.map(p=>new T.Vector2(p.x-data.center.x,p.y-data.center.y)))
   const faceGeometry=new T.ShapeGeometry(shape),pos=faceGeometry.getAttribute('position'),uv=faceGeometry.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+data.center.x)/PANEL_WIDTH+.5,(pos.getY(i)+data.center.y)/PANEL_HEIGHT+.5)
   const face=new T.Mesh(faceGeometry,this.faceMaterial);face.position.z=.003;group.add(face)
   face.onBeforeRender=renderer=>{this.renderer=renderer;for(let i=0;i<3;i++){const texture=this.textures[i]!,resource=this.feeds[i],properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}}}
   const rimGeometry=new T.BufferGeometry().setFromPoints(inner.map(p=>new T.Vector3(p.x-data.center.x,p.y-data.center.y,0)))
   const rim=new T.LineLoop(rimGeometry,new T.LineBasicMaterial({color:0xffffff,toneMapped:false}));rim.position.z=.004;group.add(rim);this.shards.push({data,group,body,edge,face,rim,insetScale:Math.max(.65,1-bevelRatio-gap/Math.max(.001,radius)),rest:obsidianRest(data)})
  }
 }
 apply(look:FractureLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number,quality:Cinema2RenderQualityLevel){
  const T=this.library.THREE,u=this.common,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace),key=[look.count,look.seed,look.crackWidth].join(':');const rebuilt=key!==this.geometryKey;if(rebuilt){this.rebuild(look);this.geometryKey=key}if(this.fieldSeed!==look.seed)this.rebuildField(look.seed)
  const hadMedia=this.feeds.some(Boolean)
  if(step!==this.lastStep){if(this.lastStep>=0)this.ages.fill(0);this.lastStep=step}
  for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0}this.feeds[i]=next;this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
  u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uChannels!.value=Math.max(1,resources.length);u.uStep!.value=step;u.uLayout!.value=look.layout==='grouped'?1:0;u.uGroupMode!.value=look.grouping==='depth-bands'?1:0;u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uPhase!.value=look.phase;set(u.uPrimary!.value,look.colors.primary);set(u.uSecondary!.value,look.colors.secondary)
  const hasMedia=look.visible&&this.feeds.some(Boolean)
  set(this.structural.color,look.colors.structural);set(this.rear.color,look.colors.structural);this.rear.color.multiplyScalar(.55);set(this.fissure.color,look.colors.secondary);this.fissure.color.multiplyScalar(look.crackEmission*(.45+look.energy*.65));set(this.accent.color,look.colors.accent);this.accent.color.multiplyScalar(look.crackEmission*(.55+look.high*.7));set(this.light.color,look.colors.primary);this.light.intensity=look.spill*8;this.structural.envMapIntensity=look.reflection;this.rear.envMapIntensity=look.reflection
  const energy=look.active?clamp(.22+look.bass*.25+look.drop*.65+look.high*.18):.18
  const illumination=look.crackEmission*look.fractureLighting*look.intensity
  set(this.rear.emissive,look.colors.secondary);this.rear.emissiveIntensity=illumination*energy*.20
  set(this.structural.emissive,look.colors.secondary);this.structural.emissiveIntensity=illumination*energy*.10
  this.sideLights.forEach((l,i)=>{const side=i===0?-1:1;set(l.color,i===0?look.colors.secondary:look.colors.accent);l.intensity=look.spill*look.fractureLighting*look.intensity*(2+energy*15);l.position.set(side*(2.7+look.drop*.9),side*(1.8+look.drop*.35),1.8+look.drop*.6)})
  for(const f of this.field){const d=f.data,g=f.group
   // Stable density selection: changing density never rebuilds the source tessellation.
   const keep=look.debrisDensity>0&&((d.shard.id*.61803399)%1)<Math.min(1,1.5*look.debrisDensity)
   g.visible=keep&&(quality!=='low'||d.layer!==2||d.shard.id%2===0);f.rim.visible=d.lit&&look.crackEmission>0
   if(!look.paused||look.reset||look.locked||rebuilt){const p=fieldPose(d,look)
    // Keep foreground clear of the media during readable holds, including lateral camera sway.
    if(hasMedia&&look.readability&&p.z>-.3){const projected=1-p.z/11;const clearance=Math.max(Math.abs(p.x)/(4.6*projected),Math.abs(p.y)/(2.85*projected));const push=Math.max(1,1.08/Math.max(.1,clearance));p.x*=push;p.y*=push}
    const blend=rebuilt||look.reset||look.locked?1:1-Math.exp(-look.dt*9)
    const ease=(a:number,b:number)=>{const v=a+(b-a)*blend;return Math.abs(v-b)<.0001?b:v}
    g.position.set(ease(g.position.x,p.x),ease(g.position.y,p.y),ease(g.position.z,p.z));g.rotation.set(ease(g.rotation.x,p.rx),ease(g.rotation.y,p.ry),ease(g.rotation.z,p.rz))
   }
  }
  for(const s of this.shards){
   const p=shardPose(s.data,look),g=s.group,r=hasMedia?null:s.rest,rest=Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)<1e-6
   const blend=rebuilt||look.reset||look.locked||(hadMedia!==hasMedia&&!look.active)?1:look.paused?0:1-Math.exp(-look.dt*(rest?8/look.reassemblyTime:9));const ease=(from:number,to:number)=>{const v=from+(to-from)*blend;return Math.abs(v-to)<.0001?to:v}
   g.position.set(ease(g.position.x,s.data.center.x+p.x+(r?.x??0)),ease(g.position.y,s.data.center.y+p.y+(r?.y??0)),ease(g.position.z,p.z+(r?.z??0)))
   g.rotation.set(ease(g.rotation.x,p.rx+(r?.rx??0)),ease(g.rotation.y,p.ry+(r?.ry??0)),ease(g.rotation.z,p.rz+(r?.rz??0)))
   const displaced=Math.hypot(g.position.x-s.data.center.x,g.position.y-s.data.center.y,g.position.z)+Math.abs(g.rotation.x)+Math.abs(g.rotation.y)+Math.abs(g.rotation.z)
   const opening=hasMedia?clamp(displaced*3):1,capScale=1-(1-s.insetScale)*opening
   s.face.scale.set(capScale,capScale,1);s.body.scale.z=look.thickness*PANEL_HEIGHT*(.85+Math.abs(s.data.tilt)*1.55);s.body.castShadow=quality!=='low'||s.data.id%2===0;s.face.visible=look.visible
   s.edge.color.copy(this.structural.color);s.edge.envMapIntensity=look.reflection;set(s.edge.emissive,s.data.id%4===0?look.colors.accent:look.colors.secondary);s.edge.emissiveIntensity=p.light*look.fractureLighting*opening*1.7;
   set(this.color,look.colors.primary);this.color.multiplyScalar(p.light*2.4*(hasMedia?opening:1));s.rim.material.color.copy(this.color);s.rim.visible=look.crackEmission>0&&(!hasMedia||opening>.015)
  }
 }
 dispose(){for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}this.clearShards();this.clearField();for(const m of [this.structural,this.rear,this.fissure,this.accent,this.faceMaterial])m.dispose();this.light.dispose();for(const light of this.sideLights)light.dispose();this.group.removeFromParent()}
}
