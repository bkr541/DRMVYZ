import type * as Three from 'three'
import type { Cinema2Color, Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { FRACTURE_COLORS, PANEL_WIDTH, PANEL_HEIGHT, tessellate, insetPolygon, shardPose, type Shard, type FractureMotion } from './FractureDomain'
export interface FractureLook extends FractureMotion {
 count:number;seed:number;crackWidth:number;thickness:number;reset:boolean;
 mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
 reflection:number;spill:number;colors:{[K in keyof typeof FRACTURE_COLORS]:Cinema2Color};dt:number;paused:boolean;
}
const vertex=`varying vec2 vUV; void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform float uLayout,uGroupMode,uChannels,uStep;uniform float uFit,uScale,uAngle,uOpacity,uBrightness,uPhase;uniform vec2 uOffset;uniform vec3 uPrimary,uSecondary;varying vec2 vUV;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){vec2 uv=vUV;float uChannel=mod(uStep,max(1.,uChannels)),uSurfaceAspect=16./9.;
if(uLayout>.5){if(uGroupMode<.5){vec2 region=min(floor(uv*2.),vec2(1.));uChannel=mod(region.x+region.y*2.+uStep,max(1.,uChannels));uv=uv*2.-region;}else{float region=min(floor(uv.y*3.),2.);uChannel=mod(region+uStep,max(1.,uChannels));uv.y=uv.y*3.-region;uSurfaceAspect*=3.;}}float aspect=uChannel<.5?uAspect.x:uChannel<1.5?uAspect.y:uAspect.z;float fade=uChannel<.5?uFade.x:uChannel<1.5?uFade.y:uFade.z;
vec2 q=uv-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q.x*=uSurfaceAspect;q=mat2(c,-s,s,c)*q/max(.01,uScale);q.x/=max(.001,uSurfaceAspect);
float ratio=uSurfaceAspect/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;

vec3 base=vec3(.009,.014,.024);float caustic=pow(max(0.,cos((uv.x*1.7-uv.y*.8)*22.)),22.);float ribbon=exp(-abs(uv.y-.5-.20*sin(uv.x*5.))*18.);vec3 fallback=base+uPrimary*caustic*.27+uSecondary*ribbon*.42;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(uChannel<.5)tex=texture2D(uFeed0,q);else if(uChannel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
vec3 content=aspect>0.?mix(fallback,mix(base,linearRGB(tex.rgb),tex.a*inside),fade):fallback;gl_FragColor=vec4(mix(base,content*uBrightness,uOpacity),1.);
#include <colorspace_fragment>
}`
interface RenderShard {data:Shard;group:Three.Group;body:Three.Mesh;face:Three.Mesh;rim:Three.LineLoop<Three.BufferGeometry,Three.LineBasicMaterial>}
/** Native Three geometry with source UVs anchored to the original rest plane. */
export class FractureScene {
 private readonly group:Three.Group;private readonly shards:RenderShard[]=[];private readonly box:Three.BoxGeometry;private readonly structural:Three.MeshStandardMaterial;private readonly floor:Three.MeshStandardMaterial;private readonly rear:Three.MeshStandardMaterial;private readonly fissure:Three.MeshBasicMaterial;private readonly accent:Three.MeshBasicMaterial;private readonly light:Three.PointLight;private readonly faceMaterial:Three.ShaderMaterial
 private readonly textures:Three.Texture[];private readonly feeds:(Readonly<Cinema2ManagedMediaResource>|null)[]=[null,null,null];private readonly ages=[0,0,0];private readonly color:Three.Color;private readonly common:Record<string,Three.IUniform>;private renderer:Three.WebGLRenderer|null=null;private geometryKey='';private lastStep=-1
 constructor(private readonly library:Cinema2ThreeLibrary,root:Three.Object3D){
  const T=library.THREE;this.group=new T.Group();root.add(this.group);this.color=new T.Color();this.box=new T.BoxGeometry(1,1,1)
  this.structural=new T.MeshStandardMaterial({metalness:.66,roughness:.34});this.floor=new T.MeshStandardMaterial({color:0x171923,metalness:.72,roughness:.3});this.rear=new T.MeshStandardMaterial({color:0x171923,metalness:.25,roughness:.78});this.fissure=new T.MeshBasicMaterial();this.accent=new T.MeshBasicMaterial()
  this.textures=Array.from({length:3},()=>new T.Texture());this.common={uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uLayout:{value:0},uGroupMode:{value:0},uChannels:{value:1},uStep:{value:0},uFit:{value:0},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uPhase:{value:0},uPrimary:{value:new T.Color()},uSecondary:{value:new T.Color()}}
  this.faceMaterial=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:this.common})
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,m:Three.Material,roll=0)=>{const mesh=new T.Mesh(this.box,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.z=roll;mesh.receiveShadow=true;mesh.castShadow=m===this.structural||m===this.rear;this.group.add(mesh);return mesh}
  block(0,-3.25,-3,23,.22,20,this.floor);block(0,0,-8.8,21,12,.4,this.rear)
  // Broken overlapping wall planes framing an open central rear recess.
  for(const side of [-1,1]){
   block(side*6.8,.1,-3.8,3.2,8.5,6,this.rear,side*.13)
   block(side*5.1,.05,-1.8,.64,6.9,1.1,this.structural,-side*.17)
   block(side*5.45,1.4,-4,1.1,4.9,1.4,this.structural,side*.39)
   block(side*4.95,2.75,-3.2,3.1,.72,1.4,this.structural,-side*.24)
   block(side*5.03,.05,-1.19,.035,6.3,.035,this.accent,-side*.17)
   for(let i=0;i<4;i++){const x=side*(2.4+i*.88),z=-7.9+i*.29;block(x,.4+(i%2)*.65,z,1.08,5.6,.75,this.rear,side*(i%2?.25:-.17));block(x-side*.5,.4+(i%2)*.65,z+.42,.038,5.1,.055,this.fissure,side*(i%2?.25:-.17))}
   const seam=block(side*3.4,-3.12,-1.1,.045,.035,11,this.fissure);seam.rotation.y=side*.24
   const outer=block(side*4.65,-3.11,-2,.035,.035,10,this.accent);outer.rotation.y=-side*.16
  }
  block(-.9,3.8,-4,9,.65,1.9,this.structural,.10);block(2.7,-2.95,-4.6,4.4,.4,2.1,this.structural,-.035)
  this.light=new T.PointLight(0xffffff,1,12,2);this.light.position.set(0,1.7,2.9);this.group.add(this.light)
 }
 private clearShards(){for(const s of this.shards){s.body.geometry.dispose();s.face.geometry.dispose();s.rim.geometry.dispose();s.rim.material.dispose();s.group.removeFromParent()}this.shards.length=0}
 private rebuild(look:FractureLook){
  this.clearShards();const T=this.library.THREE,gap=look.crackWidth*PANEL_WIDTH*.5
  for(const data of tessellate(look.count,look.seed)){
   const group=new T.Group();group.position.set(data.center.x,data.center.y,0);this.group.add(group)
   // The outer shoulder stays within its source cell; a second inset creates the chamfered face.
   const outer=insetPolygon(data,gap),radius=Math.max(...outer.map(p=>Math.hypot(p.x-data.center.x,p.y-data.center.y))),bevelRatio=Math.min(.10,.018/Math.max(.001,radius));
   const inner=outer.map(p=>({x:data.center.x+(p.x-data.center.x)*(1-bevelRatio),y:data.center.y+(p.y-data.center.y)*(1-bevelRatio)}));
   const shape=(poly:typeof outer)=>new T.Shape(poly.map(p=>new T.Vector2(p.x-data.center.x,p.y-data.center.y)))
   // Four equal-topology rings: front cap, shoulder, rear shoulder, rear cap.
   // Explicit convex triangulation avoids variable bevel topology and sliver crossings.
   const rings=[{poly:inner,z:0},{poly:outer,z:-.10},{poly:outer,z:-.90},{poly:inner,z:-1}];const vertices:number[]=[]
   const vert=(r:number,i:number)=>{const p=rings[r]!.poly[i]!;vertices.push(p.x-data.center.x,p.y-data.center.y,rings[r]!.z)}
   for(let r=0;r<3;r++)for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;vert(r,i);vert(r+1,i);vert(r+1,j);vert(r,i);vert(r+1,j);vert(r,j)}
   for(let i=1;i<inner.length-1;i++){vert(0,0);vert(0,i);vert(0,i+1);vert(3,0);vert(3,i+1);vert(3,i)}
   const bodyGeometry=new T.BufferGeometry();bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));bodyGeometry.computeVertexNormals()
   const body=new T.Mesh(bodyGeometry,this.structural);body.castShadow=true;body.receiveShadow=true;group.add(body)
   const faceGeometry=new T.ShapeGeometry(shape(inner)),pos=faceGeometry.getAttribute('position'),uv=faceGeometry.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+data.center.x)/PANEL_WIDTH+.5,(pos.getY(i)+data.center.y)/PANEL_HEIGHT+.5)
   const face=new T.Mesh(faceGeometry,this.faceMaterial);face.position.z=.002;group.add(face)
   face.onBeforeRender=renderer=>{this.renderer=renderer;for(let i=0;i<3;i++){const texture=this.textures[i]!,resource=this.feeds[i],properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}}}
   const rimGeometry=new T.BufferGeometry().setFromPoints(inner.map(p=>new T.Vector3(p.x-data.center.x,p.y-data.center.y,0)))
   const rim=new T.LineLoop(rimGeometry,new T.LineBasicMaterial({color:0xffffff,toneMapped:false}));rim.position.z=.004;group.add(rim);this.shards.push({data,group,body,face,rim})
  }
 }
 apply(look:FractureLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number,quality:Cinema2RenderQualityLevel){
  const T=this.library.THREE,u=this.common,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace),key=[look.count,look.seed,look.crackWidth].join(':');const rebuilt=key!==this.geometryKey;if(rebuilt){this.rebuild(look);this.geometryKey=key}
  if(step!==this.lastStep){if(this.lastStep>=0)this.ages.fill(0);this.lastStep=step}
  for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0;this.feeds[i]=next}this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
  u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uChannels!.value=Math.max(1,resources.length);u.uStep!.value=step;u.uLayout!.value=look.layout==='grouped'?1:0;u.uGroupMode!.value=look.grouping==='depth-bands'?1:0;u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uPhase!.value=look.phase;set(u.uPrimary!.value,look.colors.primary);set(u.uSecondary!.value,look.colors.secondary)
  set(this.structural.color,look.colors.structural);set(this.rear.color,look.colors.structural);this.rear.color.multiplyScalar(.32);set(this.fissure.color,look.colors.secondary);this.fissure.color.multiplyScalar(.38+look.crackEmission*.7);set(this.accent.color,look.colors.accent);this.accent.color.multiplyScalar(.45);set(this.light.color,look.colors.primary);this.light.intensity=look.spill*8;this.floor.envMapIntensity=look.reflection;this.structural.envMapIntensity=look.reflection
  for(const s of this.shards){const p=shardPose(s.data,look),g=s.group,rest=Math.abs(p.x)+Math.abs(p.y)+Math.abs(p.z)+Math.abs(p.rx)+Math.abs(p.ry)+Math.abs(p.rz)<1e-6,blend=rebuilt||look.reset||look.locked?1:look.paused?0:1-Math.exp(-look.dt*(rest?8/look.reassemblyTime:9));const ease=(from:number,to:number)=>{const v=from+(to-from)*blend;return Math.abs(v-to)<.0001?to:v};g.position.set(ease(g.position.x,s.data.center.x+p.x),ease(g.position.y,s.data.center.y+p.y),ease(g.position.z,p.z));g.rotation.set(ease(g.rotation.x,p.rx),ease(g.rotation.y,p.ry),ease(g.rotation.z,p.rz));s.body.scale.z=look.thickness*PANEL_HEIGHT;s.body.castShadow=quality!=='low'||s.data.id%2===0;s.face.visible=look.visible;set(this.color,look.colors.primary);this.color.multiplyScalar(p.light*2.4);s.rim.material.color.copy(this.color);s.rim.visible=look.crackEmission>0}
 }
 dispose(){for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}this.clearShards();this.box.dispose();for(const m of [this.structural,this.floor,this.rear,this.fissure,this.accent,this.faceMaterial])m.dispose();this.light.dispose();this.group.removeFromParent()}
}
