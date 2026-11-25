import type * as Three from 'three'
import type { Cinema2Color, Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { REFRACTION_COLORS, PRISM_ANCHORS, prismPose, prismUv, type RefractionMotion } from './RefractionDomain'

export interface RefractionLook extends RefractionMotion {
  count:number;depth:number;bevel:number;spacing:number;locked:boolean;
  mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
  reflection:number;spill:number; colors:{[K in keyof typeof REFRACTION_COLORS]:Cinema2Color};dt:number;paused:boolean;
}
const vertex=`varying vec2 vUV; void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform vec4 uCrop;uniform float uChannel,uSurfaceAspect,uFit,uScale,uAngle,uOpacity,uBrightness,uDistortion,uPhase;uniform vec2 uOffset;uniform vec3 uPrimary,uSecondary;varying vec2 vUV;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){vec2 uv=uCrop.xy+vUV*uCrop.zw;float aspect=uChannel<.5?uAspect.x:uChannel<1.5?uAspect.y:uAspect.z;float fade=uChannel<.5?uFade.x:uChannel<1.5?uFade.y:uFade.z;
vec2 q=uv-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q.x*=uSurfaceAspect;q=mat2(c,-s,s,c)*q/max(.01,uScale);q.x/=max(.001,uSurfaceAspect);
float ratio=uSurfaceAspect/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;
q+=uDistortion*.035*vec2(sin(q.y*9.+uPhase),cos(q.x*8.-uPhase));
vec3 base=vec3(.009,.014,.024);float caustic=pow(max(0.,cos((uv.x*1.7+uv.y*.8)*18.+sin(uv.y*8.)*.5)),19.);float ribbon=exp(-abs(uv.y-.48-.19*sin(uv.x*7.))*23.);vec3 fallback=base+uPrimary*caustic*.27+uSecondary*ribbon*.42;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(uChannel<.5)tex=texture2D(uFeed0,q);else if(uChannel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
vec3 content=aspect>0.?mix(fallback,mix(base,linearRGB(tex.rgb),tex.a*inside),fade):fallback;gl_FragColor=vec4(mix(base,content*uBrightness,uOpacity),1.);
#include <colorspace_fragment>
}`
type ShapeKind='up'|'down'|'slab'
interface Prism { group:Three.Group; backing:Three.Mesh; casing:Three.Mesh; glass:Three.Mesh<Three.BufferGeometry,Three.MeshPhysicalMaterial>; display:Three.Mesh<Three.BufferGeometry,Three.ShaderMaterial>; rim:Three.LineSegments<Three.BufferGeometry,Three.LineBasicMaterial>; kind:ShapeKind; fresh:boolean; motionX:number;motionY:number;motionZ:number }
interface ShapeParts { shell:Three.BufferGeometry; face:Three.BufferGeometry; ring:Three.BufferGeometry; edge:Three.BufferGeometry }
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
  private readonly glassSide:Three.MeshPhysicalMaterial
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
    this.glassSide=material(new T.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.32,depthWrite:false,metalness:.1,roughness:.15,clearcoat:1,ior:1.46,side:T.DoubleSide}))
    this.textures=Array.from({length:3},()=>new T.Texture());this.common={uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uFit:{value:1},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uPhase:{value:0},uPrimary:{value:new T.Color()},uSecondary:{value:new T.Color()}}
    this.parts=this.makeParts(this.lastBevel)
    PRISM_ANCHORS.forEach((a,i)=>{
      const kind:ShapeKind=a.slab?'slab':a.inverted?'down':'up',parts=this.parts[kind],group=new T.Group();this.group.add(group)
      const backing=new T.Mesh(parts.shell,this.structural);backing.castShadow=true;backing.receiveShadow=true;group.add(backing)
      const casing=new T.Mesh(parts.ring,this.glassSide);group.add(casing)
      const glassMaterial=material(new T.MeshPhysicalMaterial({transparent:true,opacity:.08,depthWrite:false,roughness:.15,metalness:.06,clearcoat:1,clearcoatRoughness:.1,ior:1.46,side:T.FrontSide}));const glass=new T.Mesh(parts.face,glassMaterial);glass.renderOrder=3;group.add(glass)
      const shader=material(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:{...this.common,uCrop:{value:new T.Vector4(0,0,1,1)},uChannel:{value:0},uSurfaceAspect:{value:1},uDistortion:{value:0}}}));const display=new T.Mesh(parts.face,shader);group.add(display)
      display.onBeforeRender=renderer=>{this.renderer=renderer;this.textures.forEach((texture,j)=>{const properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};const resource=this.feeds[j];if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}})}
      const rim=new T.LineSegments(parts.edge,material(new T.LineBasicMaterial({color:0xffffff})));group.add(rim)
      group.name=`refraction-prism-${i}`;this.prisms.push({group,backing,casing,glass,display,rim,kind,fresh:true,motionX:0,motionY:0,motionZ:0})
    })
    const block=(x:number,y:number,z:number,w:number,h:number,d:number,m:Three.Material,roll=0)=>{const mesh=new T.Mesh(this.box,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.z=roll;mesh.receiveShadow=true;this.group.add(mesh);return mesh}
    block(0,-2.9,-2,18,.18,20,this.floor);block(0,0,-8,17,9,.5,this.structural)
    for(const side of [-1,1]){
      block(side*7,0,-2,.55,8,15,this.structural)
      for(const z of [-7,-4.6,-2.2,.2,2.6]){
        block(side*6.1,0,z,.4,6,.55,this.structural);block(side*5.5,2.85,z,2.4,.28,.5,this.structural,-side*.55)
        block(side*5.83,0,z,.035,5.6,.07,this.rail);block(side*3.85,-2.79,z,.05,.025,2.0,this.rail)
      }
      for(let i=0;i<4;i++)block(side*(1.3+i*1.35),.2,-7.62,1.18,5.4,.24,this.structural,side*.05)
      block(side*6.2,2.3,-2,.055,.055,13,this.accent)
    }
    for(const z of [-7,-4.6,-2.2,.2,2.6])block(0,3.45,z,10,.22,.38,this.structural)
    this.light=new T.PointLight(0xffffff,1,9,2);this.light.position.set(0,1,2.2);this.group.add(this.light)
  }
  private makeParts(bevel:number):Record<ShapeKind,ShapeParts>{
    const T=this.library.THREE
    const make=(kind:ShapeKind):ShapeParts=>{
      const points=kind==='slab'?[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]:kind==='up'?[[-.5,-.5],[.5,-.5],[0,.5]]:[[.5,.5],[-.5,.5],[0,-.5]]
      const shape=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));const ringShape=shape.clone()
      const hole=points.slice().reverse().map(([x,y])=>new T.Vector2(x*.86,y*.86));ringShape.holes.push(new T.Path(hole))
      const shell=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:.08});shell.translate(0,0,-1)
      const ring=new T.ExtrudeGeometry(ringShape,{depth:1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:.07});ring.translate(0,0,-1)
      const inner=new T.Shape(points.map(([x,y])=>new T.Vector2(x*.86,y*.86)));const face=new T.ShapeGeometry(inner);const pos=face.getAttribute('position'),uv=face.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/.86+.5,pos.getY(i)/.86+.5)
      return {shell,ring,face,edge:new T.EdgesGeometry(ring,25)}
    };return {up:make('up'),down:make('down'),slab:make('slab')}
  }
  private disposeParts(){for(const parts of Object.values(this.parts))for(const geometry of Object.values(parts))geometry.dispose()}
  apply(look:RefractionLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number,quality:Cinema2RenderQualityLevel){
    const T=this.library.THREE,u=this.common,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace)
    if(Math.abs(this.lastBevel-look.bevel)>1e-5){this.disposeParts();this.parts=this.makeParts(look.bevel);this.lastBevel=look.bevel;for(const p of this.prisms){const parts=this.parts[p.kind];p.backing.geometry=parts.shell;p.casing.geometry=parts.ring;p.display.geometry=parts.face;p.glass.geometry=parts.face;p.rim.geometry=parts.edge}}
    if(step!==this.lastStep){if(this.lastStep>=0&&look.layout==='continuous')this.ages[step%Math.max(1,resources.length)]=0;this.lastStep=step}
    for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0;this.feeds[i]=next}this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
    u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uPhase!.value=look.phase;set(u.uPrimary!.value,look.colors.primary);set(u.uSecondary!.value,look.colors.secondary)
    set(this.structural.color,look.colors.structural);set(this.rail.color,look.colors.structural);set(this.rail.emissive,look.colors.secondary);set(this.accent.color,look.colors.accent);set(this.glassSide.color,look.colors.accent);this.glassSide.roughness=look.roughness;this.glassSide.opacity=.22+(1-look.transmission)*.48;set(this.light.color,look.colors.primary);this.light.intensity=look.spill*8;this.floor.envMapIntensity=look.reflection;this.structural.envMapIntensity=look.reflection
    for(let i=0;i<this.prisms.length;i++){
      const prism=this.prisms[i]!,a=PRISM_ANCHORS[i]!,p=prismPose(i,look);prism.group.visible=i<look.count;if(!prism.group.visible){prism.fresh=true;continue}
      const spacing=look.spacing, depth=look.depth*a.width, motion=look.locked?0:1,blend=prism.fresh||look.locked?1:look.paused?0:1-Math.exp(-look.dt*8);prism.fresh=false
      prism.motionX+=(p.x*motion-prism.motionX)*blend;prism.motionY+=(p.y*motion-prism.motionY)*blend;prism.motionZ+=(p.z*motion-prism.motionZ)*blend
      const x=a.x*spacing+prism.motionX,y=a.y*(.85+.15*spacing)+prism.motionY,z=a.z+prism.motionZ
      // Authored spacing remains responsive while paused; choreography itself is frozen.
      prism.group.position.set(x,y,z);prism.group.rotation.x+=(p.rx*motion-prism.group.rotation.x)*blend;prism.group.rotation.y+=(p.ry*motion-prism.group.rotation.y)*blend
      prism.group.scale.set(a.width,a.height,1);prism.backing.position.z=-depth*.62;prism.backing.scale.z=depth*.38;prism.casing.scale.z=depth;prism.rim.scale.z=depth;prism.display.position.z=-depth*.36;prism.glass.position.z=.005;prism.display.visible=look.visible;prism.glass.material.opacity=(.035+(1-look.transmission)*.72)*p.glass;prism.glass.material.roughness=look.roughness;set(prism.glass.material.color,look.colors.accent)
      set(this.color,look.colors.primary);this.color.multiplyScalar(.035+p.light*2.2);prism.rim.material.color.copy(this.color);prism.rim.visible=look.edgeEmission>0;prism.casing.visible=quality!=='low'||a.bank<2;prism.glass.visible=quality!=='low'||a.bank<2
      const q=prismUv(i,look.grouping,look.layout==='grouped',resources.length,step),v=prism.display.material.uniforms;v.uCrop!.value.set(q.x,q.y,q.w,q.h);v.uChannel!.value=q.channel;v.uSurfaceAspect!.value=q.aspect;v.uDistortion!.value=p.optical
    }
  }
  dispose(){for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}this.disposeParts();this.box.dispose();this.materials.forEach(m=>m.dispose());this.light.dispose();this.group.removeFromParent()}
}
