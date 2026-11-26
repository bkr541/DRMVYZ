import type * as Three from 'three'
import type { Cinema2Color, Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { SPECTRUM_COLORS, bayAngle, spectrumPose, spectrumUv, floorPulse, type SpectrumMotion } from './SpectrumDomain'

export interface SpectrumLook extends SpectrumMotion {
  count:number;radius:number;height:number;gap:number;coverage:string;locked:boolean;
  mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
  reflection:number;spill:number;colors:{[K in keyof typeof SPECTRUM_COLORS]:Cinema2Color};dt:number;paused:boolean;
}
const vertex=`attribute vec4 aCrop; attribute vec2 aChannel; varying vec2 vUV; varying vec2 vChannel;
void main(){vUV=aCrop.xy+uv*aCrop.zw;vChannel=aChannel;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform float uFit,uScale,uAngle,uOpacity,uBrightness,uVisible;uniform vec2 uOffset;uniform vec3 uPrimary,uSecondary;varying vec2 vUV,vChannel;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){float channel=floor(vChannel.x+.5);float aspect=channel<0.?0.:channel<.5?uAspect.x:channel<1.5?uAspect.y:uAspect.z;float fade=channel<.5?uFade.x:channel<1.5?uFade.y:uFade.z;
vec2 q=vUV-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q.x*=vChannel.y;q=mat2(c,-s,s,c)*q/max(.01,uScale);q.x/=max(.001,vChannel.y);
float ratio=vChannel.y/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;
vec3 base=vec3(.009,.015,.023);float band=exp(-abs(vUV.y-.5-.19*sin(vUV.x*6.28318))*30.);float rings=pow(max(0.,cos(vUV.x*37.6991+vUV.y*12.)),14.);vec3 fallback=base+uPrimary*band*.55+uSecondary*rings*.16;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(channel<.5)tex=texture2D(uFeed0,q);else if(channel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
vec3 content=aspect>0.?mix(fallback,mix(base,linearRGB(tex.rgb),tex.a*inside),fade):fallback;gl_FragColor=vec4(mix(base,content*uBrightness,uOpacity*uVisible),1.);
#include <colorspace_fragment>
}`

const CAPACITY=16
/** Concave cylindrical patches: +Z is inward at the rear bay; U increases clockwise in the camera view. */
function curvedPatch(T: Cinema2ThreeLibrary['THREE'],halfAngle:number,segments:number,depth=0){
  const positions:number[]=[],uv:number[]=[],indices:number[]=[]
  for(let i=0;i<=segments;i++){
    const u=i/segments,a=(2*u-1)*halfAngle
    for(const y of [-.5,.5]){positions.push(Math.sin(a),y,1-Math.cos(a));uv.push(u,y+.5)}
    if(i<segments){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
  }
  if(depth>0){
    const size=positions.length/3,front=positions.slice(),frontUv=uv.slice(),frontFaces=indices.slice()
    for(let i=0;i<front.length;i+=3)positions.push(front[i]!,front[i+1]!,front[i+2]!-depth)
    uv.push(...frontUv)
    for(let i=0;i<frontFaces.length;i+=3)indices.push(frontFaces[i]!+size,frontFaces[i+2]!+size,frontFaces[i+1]!+size)
    for(let i=0;i<segments;i++){const k=i*2;indices.push(k,k+size,k+2,k+2,k+size,k+2+size,k+1,k+3,k+1+size,k+3,k+3+size,k+1+size)}
    const e=size-2;indices.push(0,1,size,1,size+1,size,e,e+size,e+1,e+1,e+size,e+size+1)
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g
}
export class SpectrumScene {
  private readonly group:Three.Group
  private readonly geometries:Three.BufferGeometry[]=[]
  private readonly materials:Three.Material[]=[]
  private readonly body:Three.InstancedMesh;private readonly display:Three.InstancedMesh;private readonly header:Three.InstancedMesh;private readonly sill:Three.InstancedMesh
  private readonly pylons:Three.InstancedMesh;private readonly seams:Three.InstancedMesh;private readonly upper:Three.InstancedMesh
  private readonly structure:Three.MeshStandardMaterial;private readonly floor:Three.MeshStandardMaterial;private readonly energy:Three.MeshBasicMaterial;private readonly accent:Three.MeshBasicMaterial;private readonly upperEnergy:Three.MeshBasicMaterial
  private readonly shader:Three.ShaderMaterial;private readonly crop:Three.InstancedBufferAttribute;private readonly channel:Three.InstancedBufferAttribute
  private readonly textures:Three.Texture[]=[];private readonly feeds:(Readonly<Cinema2ManagedMediaResource>|null)[]=[null,null,null];private readonly ages=[0,0,0];private lastStep=-1
  private readonly dummy:Three.Object3D;private readonly local:Three.Matrix4;private readonly matrix:Three.Matrix4;private readonly scale:Three.Vector3;private readonly color:Three.Color;private readonly light:Three.PointLight
  private readonly rings:Three.Mesh<Three.BufferGeometry,Three.MeshBasicMaterial>[]=[];private readonly trusses:Three.Mesh[]=[];private readonly ground:Three.Mesh
  private renderer:Three.WebGLRenderer|null=null;private disposed=false;private lastGeometry='';private readonly poses=new Float32Array(CAPACITY*2)
  constructor(private readonly library:Cinema2ThreeLibrary,root:Three.Object3D){
    const T=library.THREE;this.group=new T.Group()
    try {
    this.dummy=new T.Object3D();this.local=new T.Matrix4();this.matrix=new T.Matrix4();this.scale=new T.Vector3();this.color=new T.Color()
    const geometry=<G extends Three.BufferGeometry>(g:G)=>{this.geometries.push(g);return g};const material=<M extends Three.Material>(m:M)=>{this.materials.push(m);return m}
    this.structure=material(new T.MeshStandardMaterial({metalness:.65,roughness:.37,side:T.DoubleSide}));this.floor=material(new T.MeshStandardMaterial({color:0x151d27,metalness:.7,roughness:.3}));this.energy=material(new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));this.accent=material(new T.MeshBasicMaterial({color:0xffffff}));this.upperEnergy=material(new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}))
    const box=geometry(new T.BoxGeometry(1,1,1)),panel=()=>geometry(curvedPatch(T,Math.PI/12,10))
    const mesh=(g:Three.BufferGeometry,m:Three.Material)=>{const v=new T.InstancedMesh(g,m,CAPACITY);v.frustumCulled=false;v.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(v);return v}
    this.body=mesh(panel(),this.structure);this.body.castShadow=true;this.body.receiveShadow=true
    this.header=mesh(panel(),this.structure);this.sill=mesh(panel(),this.energy);this.upper=mesh(panel(),this.upperEnergy)
    this.pylons=mesh(box,this.structure);this.pylons.castShadow=true;this.pylons.receiveShadow=true;this.seams=mesh(box,this.accent)
    const screen=panel();this.crop=new T.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4);this.channel=new T.InstancedBufferAttribute(new Float32Array(CAPACITY*2),2);screen.setAttribute('aCrop',this.crop);screen.setAttribute('aChannel',this.channel)
    for(let i=0;i<3;i++)this.textures.push(new T.Texture());this.shader=material(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:{uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uFit:{value:0},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uVisible:{value:1},uPrimary:{value:new T.Color()},uSecondary:{value:new T.Color()}}}))
    this.display=mesh(screen,this.shader);this.display.onBeforeRender=renderer=>{this.renderer=renderer;this.textures.forEach((texture,i)=>{const properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};const resource=this.feeds[i];if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}})}
    const cylinder=geometry(new T.CylinderGeometry(1,1,1,64)),torus=geometry(new T.TorusGeometry(1,.009,6,96)),beam=geometry(new T.TorusGeometry(1,.025,8,96))
    const staticMesh=(g:Three.BufferGeometry,m:Three.Material,y:number)=>{const v=new T.Mesh(g,m);v.position.y=y;v.receiveShadow=true;this.group.add(v);return v}
    this.ground=staticMesh(cylinder,this.floor,-3.05)
    const platform=staticMesh(cylinder,this.structure,-2.78);platform.scale.set(1.65,.38,1.65);platform.castShadow=true
    const cap=staticMesh(cylinder,this.floor,-2.55);cap.scale.set(1.48,.10,1.48)
    for(let i=0;i<5;i++){const mat=material(new T.MeshBasicMaterial({color:0xffffff}));const ring=staticMesh(torus,mat,-2.89);ring.rotation.x=-Math.PI/2;this.rings.push(ring)}
    for(let i=0;i<3;i++){const ring=staticMesh(beam,this.structure,3.1+i*.28);ring.rotation.x=-Math.PI/2;this.trusses.push(ring)}
    this.light=new T.PointLight(0xffffff,1,15,2);this.light.position.set(0,1.5,0);this.group.add(this.light)
    root.add(this.group)
    } catch(error) {
      this.dispose()
      throw error
    }
  }
  private updateGeometry(look:SpectrumLook,quality:Cinema2RenderQualityLevel){
    const segments=quality==='low'?6:12,key=`${look.count}:${look.gap}:${segments}`
    if(key===this.lastGeometry)return false
    this.lastGeometry=key;const T=this.library.THREE,half=Math.PI/look.count*(1-look.gap)
    for(const mesh of [this.body,this.header,this.sill,this.upper,this.display]){
      const old=mesh.geometry;const next=curvedPatch(T,mesh===this.display?half*.97:half,segments,mesh===this.body?.04:mesh===this.header?.025:0)
      this.geometries.push(next);mesh.geometry=next
      const index=this.geometries.indexOf(old);if(index>=0)this.geometries.splice(index,1)
      old.dispose()
      if(mesh===this.display){mesh.geometry.setAttribute('aCrop',this.crop);mesh.geometry.setAttribute('aChannel',this.channel)}
    }return true
  }
  apply(look:SpectrumLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number,quality:Cinema2RenderQualityLevel){
    const fresh=this.updateGeometry(look,quality),T=this.library.THREE,u=this.shader.uniforms,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace)
    if(step!==this.lastStep){if(this.lastStep>=0&&look.layout==='continuous')this.ages[step%Math.max(1,resources.length)]=0;this.lastStep=step}
    for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0;this.feeds[i]=next}this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
    u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uVisible!.value=look.visible?1:0;set(u.uPrimary!.value,look.colors.primary);set(u.uSecondary!.value,look.colors.secondary)
    set(this.structure.color,look.colors.structural);set(this.accent.color,look.colors.accent);set(this.light.color,look.colors.primary);this.light.intensity=look.spill*9*(1-.3*look.vocal);this.floor.envMapIntensity=look.reflection;this.structure.envMapIntensity=look.reflection
    const r=look.radius,h=look.height,baseY=-2.1+h/2,channels=Math.max(1,resources.length),blend=fresh||look.locked?1:look.paused?0:1-Math.exp(-look.dt*7)
    this.ground.scale.set(r+1,.25,r+1)
    this.rings.forEach((ring,i)=>{const radius=1.9+(r-2.3)*i/4;ring.scale.set(radius,radius,1);set(ring.material.color,look.colors.primary);ring.material.color.multiplyScalar(.04+floorPulse(i,look)*2)})
    this.trusses.forEach((ring,i)=>{const radius=r+.35-i*.32;ring.scale.set(radius,radius,2);ring.position.y=baseY+h/2+.6+i*.27})
    const place=(mesh:Three.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{this.local.makeTranslation(x,y,z);this.local.scale(this.scale.set(sx,sy,sz));mesh.setMatrixAt(index,this.matrix.multiplyMatrices(this.dummy.matrix,this.local))}
    for(let i=0;i<look.count;i++){
      const a=bayAngle(i,look.count),p=spectrumPose(i,look.count,look),s=Math.sin(a),c=Math.cos(a),offset=i*2
      const smooth=(j:number,v:number)=>{const old=this.poses[offset+j]!;const next=old+((look.locked?0:v)-old)*blend;this.poses[offset+j]=next;return next}
      const radial=r+smooth(0,p.radial)*.9,tilt=smooth(1,p.tilt)
      // Rear axis faces +Z; radial outward travel and local hinge tilt are real transforms.
      this.dummy.position.set(s*radial,baseY,-c*radial);this.dummy.rotation.set(tilt,-a,0,'YXZ');this.dummy.updateMatrix()
      place(this.body,i,0,0,-.04,r,h+.24,r);place(this.display,i,0,0,0,r,h,r);place(this.header,i,0,h/2+.12,-.035,r,.16,r);place(this.sill,i,0,-h/2-.07,.025,r,.045,r)
      set(this.color,look.colors.primary);this.color.multiplyScalar(.04+p.light*2);this.sill.setColorAt(i,this.color)
      const uv=spectrumUv(i,look.count,r,h,look.coverage,look.grouping,look.layout==='grouped',channels,step,1-(1-look.gap)*.97);this.crop.setXYZW(i,uv.x,0,uv.w,1);this.channel.setXY(i,uv.channel,uv.aspect)
      // Fixed structural pylons and truss channel stay on the original circular rail.
      const edge=a-Math.PI/look.count,er=r+.16;this.dummy.position.set(Math.sin(edge)*er,baseY,-Math.cos(edge)*er);this.dummy.rotation.set(0,-edge,0);this.dummy.updateMatrix()
      place(this.pylons,i,0,0,0,.15,h+.92,.52);place(this.seams,i,0,0,.28,.027,h+.65,.025)
      this.dummy.position.set(s*r,baseY+h/2+.45,-c*r);this.dummy.rotation.set(0,-a,0);this.dummy.updateMatrix();place(this.upper,i,0,0,0,r,.07,r)
      set(this.color,look.colors.secondary);this.color.multiplyScalar(.03+p.overhead*2);this.upper.setColorAt(i,this.color)
    }
    for(const mesh of [this.body,this.display,this.header,this.sill,this.pylons,this.seams,this.upper]){mesh.count=look.count;mesh.instanceMatrix.needsUpdate=true}
    this.display.visible=look.visible;this.sill.instanceColor!.needsUpdate=true;this.upper.instanceColor!.needsUpdate=true;this.crop.needsUpdate=true;this.channel.needsUpdate=true
  }
  dispose(){
    if(this.disposed)return
    this.disposed=true
    // The media runtime owns the external WebGL textures. Never let Three delete them.
    for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}
    this.group.traverse(object=>{
      const mesh=object as Three.InstancedMesh
      if(mesh.isInstancedMesh)mesh.dispose()
      const light=object as Three.PointLight
      if(light.isPointLight)light.dispose()
    })
    this.geometries.forEach(g=>g.dispose());this.geometries.length=0
    this.materials.forEach(m=>m.dispose());this.materials.length=0
    this.feeds.fill(null);this.renderer=null;this.group.removeFromParent();this.group.clear()
  }
}
