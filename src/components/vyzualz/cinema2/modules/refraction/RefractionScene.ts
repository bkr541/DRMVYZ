import type * as Three from 'three'
import type { Cinema2Color, Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { REFRACTION_COLORS, PRISM_ANCHORS, OPTICAL_APERTURE, opticalPath, prismPose, prismUv, type OpticalPoint, type RefractionMotion } from './RefractionDomain'

export interface RefractionLook extends RefractionMotion {
  count:number;depth:number;bevel:number;spacing:number;locked:boolean;
  mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
  reflection:number;spill:number; colors:{[K in keyof typeof REFRACTION_COLORS]:Cinema2Color};dt:number;paused:boolean;
}
const vertex=`varying vec2 vUV; void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform vec4 uCrop;uniform float uChannel,uSurfaceAspect,uFit,uScale,uAngle,uOpacity,uBrightness,uDistortion,uPhase;uniform vec2 uOffset;varying vec2 vUV;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){vec2 uv=uCrop.xy+vUV*uCrop.zw;float aspect=uChannel<.5?uAspect.x:uChannel<1.5?uAspect.y:uAspect.z;float fade=uChannel<.5?uFade.x:uChannel<1.5?uFade.y:uFade.z;
vec2 q=uv-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q.x*=uSurfaceAspect;q=mat2(c,-s,s,c)*q/max(.01,uScale);q.x/=max(.001,uSurfaceAspect);
float ratio=uSurfaceAspect/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;
q+=uDistortion*.035*vec2(sin(q.y*9.+uPhase),cos(q.x*8.-uPhase));
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(uChannel<.5)tex=texture2D(uFeed0,q);else if(uChannel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
// Borrowed media is straight-alpha RGBA, uploaded without Y flip or sRGB decoding.
// Reveal it on the front optical facet rather than tinting it through the glass.
gl_FragColor=vec4(linearRGB(tex.rgb)*uBrightness,tex.a*inside*fade*uOpacity);
#include <colorspace_fragment>
}`
type ShapeKind='up'|'down'|'slab'
interface Prism { group:Three.Group; glass:Three.Mesh<Three.BufferGeometry,Three.MeshPhysicalMaterial>; display:Three.Mesh<Three.BufferGeometry,Three.ShaderMaterial>; rim:Three.LineSegments<Three.BufferGeometry,Three.LineBasicMaterial>; beams:Three.Mesh<Three.CylinderGeometry,Three.MeshBasicMaterial>[]; kind:ShapeKind; fresh:boolean; motionX:number;motionY:number;motionZ:number }
interface ShapeParts { shell:Three.BufferGeometry; face:Three.BufferGeometry; edge:Three.BufferGeometry }
/** All source textures are borrowed from the same native GL context, never disposed by Three. */
export class RefractionScene {
  private readonly group:Three.Group
  private readonly prisms:Prism[]=[]
  private readonly materials:Three.Material[]=[]
  private readonly box:Three.BoxGeometry
  private readonly structural:Three.MeshStandardMaterial
  private readonly floor:Three.MeshStandardMaterial
  private readonly rail:Three.MeshStandardMaterial
  private readonly accent:Three.MeshBasicMaterial
  private readonly beamGeometry:Three.CylinderGeometry
  private readonly beamMaterials:Three.MeshBasicMaterial[]
  private readonly beamStart:Three.Vector3
  private readonly beamEnd:Three.Vector3
  private readonly beamAxis:Three.Vector3
  private readonly beamUp:Three.Vector3
  private readonly light:Three.PointLight
  private readonly textures:Three.Texture[]
  private readonly feeds:(Readonly<Cinema2ManagedMediaResource>|null)[]=[null,null,null]
  private readonly ages=[0,0,0];private lastStep=-1
  private readonly common:Record<string,Three.IUniform>
  private readonly color:Three.Color
  private parts:Record<ShapeKind,ShapeParts>
  private lastBevel=.025
  private renderer:Three.WebGLRenderer|null=null
  constructor(private readonly library:Cinema2ThreeLibrary,root:Three.Object3D){
    const T=library.THREE;this.group=new T.Group();root.add(this.group);this.color=new T.Color()
    const material=<M extends Three.Material>(m:M)=>{this.materials.push(m);return m}
    this.box=new T.BoxGeometry(1,1,1)
    this.structural=material(new T.MeshStandardMaterial({metalness:.64,roughness:.36}));this.floor=material(new T.MeshStandardMaterial({color:0x111927,metalness:.78,roughness:.23}));this.rail=material(new T.MeshStandardMaterial({metalness:.55,roughness:.32,emissiveIntensity:.22}));this.accent=material(new T.MeshBasicMaterial({color:0xffffff}));
    this.beamGeometry=new T.CylinderGeometry(1,1,1,6,1,true)
    this.beamMaterials=Array.from({length:3},()=>material(new T.MeshBasicMaterial({color:0xffffff,toneMapped:false})))
    this.beamStart=new T.Vector3();this.beamEnd=new T.Vector3();this.beamAxis=new T.Vector3();this.beamUp=new T.Vector3(0,1,0)
    this.textures=Array.from({length:3},()=>new T.Texture());this.common={uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uFit:{value:1},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uPhase:{value:0}}
    this.parts=this.makeParts(this.lastBevel)
    PRISM_ANCHORS.forEach((a,i)=>{
      const kind:ShapeKind=a.slab?'slab':a.inverted?'down':'up',parts=this.parts[kind],group=new T.Group();this.group.add(group)
      // Closed, thick faceted crystal, without an opaque backing masking the volume.
      const glassMaterial=material(new T.MeshPhysicalMaterial({transparent:true,opacity:.15,depthWrite:false,roughness:.15,metalness:.12,clearcoat:1,clearcoatRoughness:.1,ior:1.46,side:T.DoubleSide}));const glass=new T.Mesh(parts.shell,glassMaterial);glass.name=`refraction-crystal-${i}`;group.add(glass)
      const shader=material(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,transparent:true,depthWrite:false,uniforms:{...this.common,uCrop:{value:new T.Vector4(0,0,1,1)},uChannel:{value:0},uSurfaceAspect:{value:1},uDistortion:{value:0}}}));const display=new T.Mesh(parts.face,shader);display.name=`refraction-media-${i}`;group.add(display)
      const beams=[0,0,1,2].map((channel,segment)=>{const beam=new T.Mesh(this.beamGeometry,this.beamMaterials[channel]!);beam.name=`refraction-ray-${i}-${segment}`;group.add(beam);return beam})
      display.onBeforeRender=renderer=>{this.renderer=renderer;this.textures.forEach((texture,j)=>{const properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};const resource=this.feeds[j];if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}})}
      const rim=new T.LineSegments(parts.edge,material(new T.LineBasicMaterial({color:0xffffff})));group.add(rim)
      group.name=`refraction-prism-${i}`;this.prisms.push({group,glass,display,rim,beams,kind,fresh:true,motionX:0,motionY:0,motionZ:0})
    })
    const block=(x:number,y:number,z:number,w:number,h:number,d:number,m:Three.Material,roll=0)=>{const mesh=new T.Mesh(this.box,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.z=roll;mesh.receiveShadow=true;this.group.add(mesh);return mesh}
    // Black optical bench and receding baffles: open center, no illuminated room walls.
    block(0,-2.85,-3,16,.15,18,this.floor)
    block(0,0,-9,18,10,.3,this.structural)
    for(const side of [-1,1]){
      for(const z of [-8,-5.8,-3.6,-1.4]){
        block(side*5.9,.25,z,.34,6.3,.75,this.structural,-side*.12)
        block(side*5.35,2.9,z,2.05,.18,.7,this.structural,-side*.42)
        block(side*5.64,.25,z,.025,5.3,.055,this.rail,-side*.12)
        block(side*3.9,-2.74,z,.025,.025,1.75,this.rail)
      }
      // Low optical-bench rails provide perspective without crossing the hero aperture.
      block(side*4.4,-2.68,-3,.06,.055,11,this.accent)
    }
    this.light=new T.PointLight(0xffffff,1,9,2);this.light.position.set(0,1,2.2);this.group.add(this.light)
  }
  private makeParts(bevel:number):Record<ShapeKind,ShapeParts>{
    const T=this.library.THREE
    const make=(kind:ShapeKind):ShapeParts=>{
      // Wide clipped facets with a smaller asymmetric shoulder, rather than triangles.
      const profile=kind==='slab'?[[-.5,-.32],[-.36,-.5],[.36,-.5],[.5,-.32],[.5,.32],[.36,.5],[-.36,.5],[-.5,.32]]:[[-.5,-.24],[-.30,-.5],[.25,-.5],[.5,-.28],[.5,.20],[.24,.5],[-.28,.44],[-.5,.22]]
      const points=kind==='down'?profile.map(([x,y])=>[-x,-y]):profile
      const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)))
      const shell=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:.12});shell.translate(0,0,-1)
      // Full readable rectangle lies within all clipped profiles; its UV spans the entire feed.
      const face=new T.PlaneGeometry(OPTICAL_APERTURE.width,OPTICAL_APERTURE.height)
      return {shell,face,edge:new T.EdgesGeometry(shell,25)}
    };return {up:make('up'),down:make('down'),slab:make('slab')}
  }
  private disposeParts(){for(const parts of Object.values(this.parts))for(const geometry of Object.values(parts))geometry.dispose()}
  apply(look:RefractionLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number,quality:Cinema2RenderQualityLevel){
    const T=this.library.THREE,u=this.common,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace)
    if(Math.abs(this.lastBevel-look.bevel)>1e-5){this.disposeParts();this.parts=this.makeParts(look.bevel);this.lastBevel=look.bevel;for(const p of this.prisms){const parts=this.parts[p.kind];p.display.geometry=parts.face;p.glass.geometry=parts.shell;p.rim.geometry=parts.edge}}
    if(step!==this.lastStep){if(this.lastStep>=0&&look.layout==='continuous')this.ages[step%Math.max(1,resources.length)]=0;this.lastStep=step}
    for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0;this.feeds[i]=next}this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
    u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uPhase!.value=look.locked?0:look.phase
    set(this.structural.color,look.colors.structural);set(this.rail.color,look.colors.structural);set(this.rail.emissive,look.colors.secondary);set(this.accent.color,look.colors.accent);set(this.beamMaterials[0]!.color,look.colors.accent);set(this.beamMaterials[1]!.color,look.colors.primary);set(this.beamMaterials[2]!.color,look.colors.secondary);for(const m of this.beamMaterials)m.color.multiplyScalar(.8+look.edgeEmission*3.0);set(this.light.color,look.colors.primary);this.light.intensity=look.spill*8;this.floor.envMapIntensity=look.reflection;this.structural.envMapIntensity=look.reflection
    for(let i=0;i<this.prisms.length;i++){
      const prism=this.prisms[i]!,a=PRISM_ANCHORS[i]!,p=prismPose(i,look);prism.group.visible=i<look.count;if(!prism.group.visible){prism.fresh=true;continue}
      const spacing=look.spacing, depth=look.depth*a.width*2.4, motion=look.locked?0:1,blend=prism.fresh||look.locked?1:look.paused?0:1-Math.exp(-look.dt*8);prism.fresh=false
      prism.motionX+=(p.x*motion-prism.motionX)*blend;prism.motionY+=(p.y*motion-prism.motionY)*blend;prism.motionZ+=(p.z*motion-prism.motionZ)*blend
      const x=a.x*spacing+prism.motionX,y=a.y*(.85+.15*spacing)+prism.motionY,z=a.z+prism.motionZ
      // Authored spacing remains responsive while paused; choreography itself is frozen.
      prism.group.position.set(x,y,z);prism.group.rotation.x+=(p.rx*motion-prism.group.rotation.x)*blend;prism.group.rotation.y+=((a.inverted?-1:1)*(a.slab ? .10 : .24)+p.ry*motion-prism.group.rotation.y)*blend
      prism.group.scale.set(a.width,a.height,1);prism.glass.scale.z=depth;prism.rim.scale.z=depth
      prism.display.position.z=depth*.125+.004
      const q=prismUv(i,look.grouping,look.layout==='grouped',resources.length,step),v=prism.display.material.uniforms
      const hasMedia=look.visible&&this.feeds[q.channel]!=null
      prism.display.visible=hasMedia
      prism.glass.material.opacity=(hasMedia ? .075 : .18)+(1-look.transmission)*.38*p.glass
      prism.glass.material.roughness=look.roughness;set(prism.glass.material.emissive,look.colors.primary);prism.glass.material.emissiveIntensity=hasMedia ? .015 : .035+p.light*.12;prism.glass.material.envMapIntensity=look.reflection;set(prism.glass.material.color,look.colors.accent)
      set(this.color,look.colors.primary);this.color.multiplyScalar(p.light*1.6);prism.rim.material.color.copy(this.color);prism.rim.visible=look.edgeEmission>0&&(quality!=='low'||a.bank<2)
      prism.glass.material.forceSinglePass=quality==='low'
      v.uCrop!.value.set(q.x,q.y,q.w,q.h);v.uChannel!.value=q.channel;v.uSurfaceAspect!.value=q.aspect;v.uDistortion!.value=p.optical*(look.readability ? .35 : 1)
      const path=opticalPath(i,look,look.locked)
      const width=(.004+.009*p.light)*look.intensity*path.gain*(hasMedia&&look.readability ? .5 : 1)
      const show=look.edgeEmission>0&&look.intensity>0&&path.gain>.16&&(quality!=='low'||a.bank===0)
      this.beam(prism.beams[0]!,path.source,path.entry,depth,width,show)
      this.beam(prism.beams[1]!,path.entry,path.exit,depth,width*.75,show)
      this.beam(prism.beams[2]!,path.exit,path.primary,depth,width,show)
      this.beam(prism.beams[3]!,path.exit,path.secondary,depth,width*.75,show&&look.refraction>0&&(quality!=='low'||i===0))
    }
  }
  private beam(mesh:Three.Mesh,a:OpticalPoint,b:OpticalPoint,depth:number,width:number,visible:boolean){
    mesh.visible=visible;if(!visible)return
    this.beamStart.set(a[0],a[1],a[2]*depth);this.beamEnd.set(b[0],b[1],b[2]*depth)
    this.beamAxis.subVectors(this.beamEnd,this.beamStart);const length=this.beamAxis.length()
    mesh.position.copy(this.beamStart).add(this.beamEnd).multiplyScalar(.5)
    mesh.quaternion.setFromUnitVectors(this.beamUp,this.beamAxis.normalize());mesh.scale.set(width,length,width)
  }
  dispose(){this.beamGeometry.dispose();for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}this.disposeParts();this.box.dispose();this.materials.forEach(m=>m.dispose());this.light.dispose();this.group.removeFromParent()}
}
