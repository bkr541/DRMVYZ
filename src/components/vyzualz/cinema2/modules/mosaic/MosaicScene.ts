import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { MOSAIC_COLORS, MOSAIC_HEIGHT, MOSAIC_WIDTH, mosaicPose, mosaicUv, type MosaicMotion } from './MosaicDomain'

export interface MosaicLook extends MosaicMotion {
  columns:number;rows:number;gap:number;thickness:number;frameWidth:number;waveRate:number;
  mode:string;visible:boolean;fit:string;layout:string;grouping:string;scale:number;offsetX:number;offsetY:number;angle:number;opacity:number;brightness:number;transition:number;
  reflection:number;spill:number; colors:{[K in keyof typeof MOSAIC_COLORS]:Cinema2Color}; locked:boolean; dt:number; paused:boolean;
}
const vertex=`attribute vec4 aCrop; attribute vec2 aChannel; varying vec2 vUV; varying vec2 vChannel;
void main(){vUV=aCrop.xy+uv*aCrop.zw;vChannel=aChannel;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`
const fragment=`uniform sampler2D uFeed0,uFeed1,uFeed2;uniform vec3 uAspect,uFade;uniform float uFit,uScale,uAngle,uOpacity,uBrightness,uVisible;uniform vec2 uOffset;uniform vec3 uPrimary,uSecondary;varying vec2 vUV,vChannel;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){float channel=floor(vChannel.x+.5);float aspect=channel<.5?uAspect.x:channel<1.5?uAspect.y:uAspect.z;float fade=channel<.5?uFade.x:channel<1.5?uFade.y:uFade.z;
vec2 q=vUV-.5-uOffset;float c=cos(uAngle),s=sin(uAngle);q=mat2(c,-s,s,c)*q/max(.01,uScale);
float ratio=vChannel.y/max(.001,aspect);if(uFit<.5){q*=vec2(max(1.,ratio),max(1.,1./ratio));}else if(uFit<1.5){q*=vec2(min(1.,ratio),min(1.,1./ratio));}q+=.5;
vec3 base=vec3(.009,.015,.023);float band=exp(-abs(vUV.y-.5-.19*sin(vUV.x*12.))*30.);float rings=pow(max(0.,cos(length((vUV-.5)*vec2(1.5,1.))*35.)),14.);vec3 fallback=base+uPrimary*band*.55+uSecondary*rings*.16;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec4 tex=vec4(0.);q.y=1.-q.y;if(aspect>0.){if(channel<.5)tex=texture2D(uFeed0,q);else if(channel<1.5)tex=texture2D(uFeed1,q);else tex=texture2D(uFeed2,q);}
vec3 content=aspect>0.?mix(fallback,mix(base,linearRGB(tex.rgb),tex.a*inside),fade):fallback;gl_FragColor=vec4(mix(base,content*uBrightness,uOpacity*uVisible),1.);
#include <colorspace_fragment>
}`
const CAPACITY=96
export class MosaicScene {
  private readonly group:Three.Group
  private readonly geometries:Three.BufferGeometry[]=[]
  private readonly materials:Three.Material[]=[]
  private readonly body:Three.InstancedMesh;private readonly trim:Three.InstancedMesh;private readonly rail:Three.InstancedMesh;private readonly display:Three.InstancedMesh
  private readonly structural:Three.MeshStandardMaterial;private readonly energy:Three.MeshBasicMaterial;private readonly secondary:Three.MeshStandardMaterial;private readonly accent:Three.MeshBasicMaterial;private readonly floor:Three.MeshStandardMaterial
  private readonly shader:Three.ShaderMaterial;private readonly crop:Three.InstancedBufferAttribute;private readonly channel:Three.InstancedBufferAttribute
  private readonly textures:Three.Texture[];private readonly feeds:(Readonly<Cinema2ManagedMediaResource>|null)[]=[null,null,null];private readonly ages=[0,0,0];private lastStep=-1
  private readonly dummy:Three.Object3D;private readonly local:Three.Matrix4;private readonly matrix:Three.Matrix4;private readonly scale:Three.Vector3;private readonly color:Three.Color;private readonly light:Three.PointLight
  private renderer:Three.WebGLRenderer|null=null
  private readonly poses=new Float32Array(CAPACITY*5);private lastGrid='';private readonly anchor:Three.Vector3;private readonly end:Three.Vector3;private readonly axis:Three.Vector3
  constructor(private readonly library:Cinema2ThreeLibrary,root:Three.Object3D){
    const T=library.THREE;this.group=new T.Group();root.add(this.group)
    this.anchor=new T.Vector3();this.end=new T.Vector3();this.axis=new T.Vector3(0,0,1);this.dummy=new T.Object3D();this.local=new T.Matrix4();this.matrix=new T.Matrix4();this.scale=new T.Vector3();this.color=new T.Color()
    const geometry=<G extends Three.BufferGeometry>(g:G)=>{this.geometries.push(g);return g};const material=<M extends Three.Material>(m:M)=>{this.materials.push(m);return m}
    this.structural=material(new T.MeshStandardMaterial({metalness:.55,roughness:.35}));this.floor=material(new T.MeshStandardMaterial({color:0x18212a,metalness:.7,roughness:.27}));this.secondary=material(new T.MeshStandardMaterial({metalness:.6,roughness:.4,emissiveIntensity:.3}));this.energy=material(new T.MeshBasicMaterial({color:0xffffff}));this.accent=material(new T.MeshBasicMaterial({color:0xffffff}))
    const box=geometry(new T.BoxGeometry(1,1,1));const shape=new T.Shape();shape.moveTo(-.47,-.5);shape.lineTo(.47,-.5);shape.lineTo(.5,-.47);shape.lineTo(.5,.47);shape.lineTo(.47,.5);shape.lineTo(-.47,.5);shape.lineTo(-.5,.47);shape.lineTo(-.5,-.47);shape.closePath()
    const housing=geometry(new T.ExtrudeGeometry(shape,{depth:.9,bevelEnabled:true,bevelThickness:.025,bevelSize:.008,bevelSegments:1,steps:1}));housing.translate(0,0,-.95)
    const mesh=(g:Three.BufferGeometry,m:Three.Material)=>{const v=new T.InstancedMesh(g,m,CAPACITY);v.frustumCulled=false;v.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(v);return v}
    this.body=mesh(housing,this.structural);this.body.castShadow=true;this.body.receiveShadow=true
    this.trim=mesh(box,this.energy);this.rail=mesh(box,this.secondary);this.rail.castShadow=true
    const plane=geometry(new T.PlaneGeometry(1,1));this.crop=new T.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4);this.channel=new T.InstancedBufferAttribute(new Float32Array(CAPACITY*2),2);plane.setAttribute('aCrop',this.crop);plane.setAttribute('aChannel',this.channel)
    this.textures=Array.from({length:3},()=>new T.Texture());this.shader=material(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:{uFeed0:{value:this.textures[0]},uFeed1:{value:this.textures[1]},uFeed2:{value:this.textures[2]},uAspect:{value:new T.Vector3()},uFade:{value:new T.Vector3()},uFit:{value:0},uScale:{value:1},uAngle:{value:0},uOffset:{value:new T.Vector2()},uOpacity:{value:1},uBrightness:{value:1},uVisible:{value:1},uPrimary:{value:new T.Color()},uSecondary:{value:new T.Color()}}}))
    this.display=mesh(plane,this.shader);this.display.onBeforeRender=renderer=>{this.renderer=renderer;this.textures.forEach((texture,i)=>{const properties=renderer.properties.get(texture) as {__webglTexture?:WebGLTexture;__version?:number};const resource=this.feeds[i];if(resource){properties.__webglTexture=resource.texture;properties.__version=texture.version}else{delete properties.__webglTexture;delete properties.__version}})}
    const staticBox=(x:number,y:number,z:number,w:number,h:number,d:number,m:Three.Material)=>{const v=new T.Mesh(box,m);v.position.set(x,y,z);v.scale.set(w,h,d);v.receiveShadow=true;this.group.add(v);return v}
    staticBox(0,0,-1.75,13,7,.4,this.structural);staticBox(0,-2.65,0,15,.18,13,this.floor)
    for(const side of [-1,1]){staticBox(side*5.15,0,-.55,.65,6,2.1,this.structural);staticBox(side*4.87,0,.54,.035,5.6,.035,this.accent)}
    for(let i=0;i<13;i++)staticBox((i-6)*.75,0,-1.4,.065,5.4,.13,this.secondary)
    for(let i=0;i<8;i++)staticBox(0,(i-3.5)*.7,-1.28,9.5,.045,.12,this.structural)
    for(const z of [-.9,1.6,4])staticBox(0,2.85,z,10,.045,.10,this.accent)
    this.light=new T.PointLight(0xffffff,1,8,2);this.light.position.set(0,.8,1.5);this.group.add(this.light)
  }
  apply(look:MosaicLook,resources:readonly (Readonly<Cinema2ManagedMediaResource>|null)[],step:number){
    if(step!==this.lastStep){if(this.lastStep>=0&&look.layout==='continuous')this.ages[step%Math.max(1,resources.length)]=0;this.lastStep=step}
    const T=this.library.THREE,u=this.shader.uniforms,set=(color:Three.Color,value:Cinema2Color)=>color.setRGB(value[0],value[1],value[2],T.SRGBColorSpace)
    for(let i=0;i<3;i++){const next=resources[i]??null;if(next?.texture!==this.feeds[i]?.texture){this.ages[i]=0;this.feeds[i]=next}this.ages[i]=Math.min(2,this.ages[i]!+look.dt)}
    u.uAspect!.value.set(...this.feeds.map(r=>r?r.width/Math.max(1,r.height):0) as [number,number,number]);u.uFade!.value.set(...this.ages.map(a=>look.transition===0?1:Math.min(1,a/look.transition)) as [number,number,number]);u.uFit!.value=look.fit==='contain'?0:look.fit==='cover'?1:2;u.uScale!.value=look.scale;u.uAngle!.value=look.angle*Math.PI/180;u.uOffset!.value.set(look.offsetX,look.offsetY);u.uOpacity!.value=look.opacity;u.uBrightness!.value=look.brightness;u.uVisible!.value=look.visible?1:0;set(u.uPrimary!.value,look.colors.primary);set(u.uSecondary!.value,look.colors.secondary)
    set(this.structural.color,look.colors.structural);set(this.secondary.color,look.colors.structural);set(this.secondary.emissive,look.colors.secondary);set(this.accent.color,look.colors.accent);set(this.light.color,look.colors.primary);this.light.intensity=look.spill*8;this.floor.envMapIntensity=look.reflection;this.structural.envMapIntensity=look.reflection
    const w=MOSAIC_WIDTH/look.columns,h=MOSAIC_HEIGHT/look.rows,gap=Math.min(look.gap*w,h*.2),border=Math.min(look.frameWidth*w,(h-gap)*.35),depth=look.thickness*w,grouped=look.layout==='grouped',count=look.columns*look.rows,channels=Math.max(1,resources.length)
    const grid=`${look.columns}:${look.rows}`,fresh=grid!==this.lastGrid;this.lastGrid=grid;const blend=fresh||look.locked?1:look.paused?0:1-Math.exp(-look.dt*9)
    const place=(mesh:Three.InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{this.local.makeTranslation(x,y,z);this.local.scale(this.scale.set(sx,sy,sz));mesh.setMatrixAt(index,this.matrix.multiplyMatrices(this.dummy.matrix,this.local))}
    for(let row=0;row<look.rows;row++)for(let column=0;column<look.columns;column++){
      const i=row*look.columns+column,p=mosaicPose(column,row,look.columns,look.rows,look),motion=look.locked?0:1
      const x=(column+.5)*w-MOSAIC_WIDTH/2,y=(row+.5)*h-MOSAIC_HEIGHT/2,offset=i*5
      const smooth=(j:number,v:number)=>{const a=this.poses[offset+j]!;const next=a+(v*motion-a)*blend;this.poses[offset+j]=next;return next}
      this.dummy.position.set(x+smooth(0,p.x*w),y+smooth(1,p.y*w),smooth(2,p.z*w));this.dummy.rotation.set(smooth(3,p.rx),smooth(4,p.ry),0);this.dummy.updateMatrix()
      place(this.body,i,0,0,0,w-gap,h-gap,depth);place(this.trim,i,0,0,0,w-gap-border*.7,h-gap-border*.7,.014);place(this.display,i,0,0,.009,w-gap-border*2,h-gap-border*2,1);// Telescoping mount connects the fixed service wall to the moving tile rear.
      this.anchor.set(x,y,-1.32);this.end.set(0,0,-depth).applyMatrix4(this.dummy.matrix);this.dummy.position.copy(this.anchor).lerp(this.end,.5);this.end.sub(this.anchor);const length=this.end.length();this.dummy.quaternion.setFromUnitVectors(this.axis,this.end.normalize());this.dummy.scale.set(.11*w,.11*h,length);this.dummy.updateMatrix();this.rail.setMatrixAt(i,this.dummy.matrix);this.dummy.scale.setScalar(1)
      set(this.color,look.colors.primary);this.color.multiplyScalar(.06+p.light*2);this.trim.setColorAt(i,this.color)
      const uv=mosaicUv(column,row,look.columns,look.rows,look.grouping,grouped,channels,step);this.crop.setXYZW(i,uv.x,uv.y,uv.w,uv.h);this.channel.setXY(i,uv.channel,uv.aspect)
    }
    for(const mesh of [this.body,this.trim,this.rail,this.display]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true}this.trim.instanceColor!.needsUpdate=true;this.crop.needsUpdate=true;this.channel.needsUpdate=true
  }
  dispose(){for(const texture of this.textures){this.renderer?.properties.remove(texture);texture.dispose()}for(const m of [this.body,this.trim,this.rail,this.display])m.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.light.dispose();this.group.removeFromParent()}
}
