import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

export const OVERDRIVE_COLORS = {
  background: [.025,.03,.045,1], metal: [.19,.21,.25,1], titanium: [.57,.61,.68,1], carbon: [.075,.085,.10,1],
  core: [.90,.12,.95,1], conduit: [.55,.08,.68,1], rim: [.80,.86,1,1], accent: [1,.94,1,1],
} as const satisfies Record<string,Cinema2Color>
export const OVERDRIVE_PATTERNS = [
  {value:'core-lock',label:'Core Lock'}, {value:'piston-wave',label:'Piston Wave'},
  {value:'counterforce',label:'Counterforce'}, {value:'compression',label:'Compression'},
  {value:'expansion',label:'Expansion'}, {value:'acoustic-array',label:'Acoustic Array'},
  {value:'core-fracture',label:'Core Fracture'}, {value:'energy-relay',label:'Energy Relay'},
  {value:'iris',label:'Iris'}, {value:'vortex',label:'Vortex'}, {value:'overload',label:'Overload'},
  {value:'blackout',label:'Blackout'},
] as const
export type OverdrivePattern = typeof OVERDRIVE_PATTERNS[number]['value']
export type OverdrivePose = readonly [number,number,number,number,number,number,number,number]
// compression, wave travel, ring rotation, core separation, shutter, cone, relay, light
export const OVERDRIVE_POSES: Record<OverdrivePattern,OverdrivePose> = {
  'core-lock':[0,.06,.06,.02,0,.16,.12,1], 'piston-wave':[.18,.80,.10,.03,.10,.35,.35,1],
  counterforce:[.08,.12,.90,.10,.06,.25,.28,1], compression:[.85,.10,.10,.02,.48,.25,.45,.9],
  expansion:[-.65,.12,.20,.12,-.55,.25,.55,1], 'acoustic-array':[.08,.18,.12,.03,.04,.95,.30,1],
  'core-fracture':[-.15,.12,.25,.90,.08,.24,.45,1], 'energy-relay':[.06,.24,.12,.03,.10,.28,1,1],
  iris:[.18,.16,.25,.05,.95,.28,.45,.85], vortex:[-.08,.42,1,.25,.24,.42,.70,1],
  overload:[-.60,.85,.82,.82,-.45,1,1,1.3], blackout:[.05,.01,.02,0,.10,.01,.05,.11],
}
export interface OverdriveLook {
  pattern: OverdrivePattern; pose: OverdrivePose; phase: number; motion: number; intensity: number; reactivity: number;
  size: number; separation: number; rotation: number; compression: number; piston: number; speaker: number; aperture: number; relay: number;
  brightness: number; roughness: number; reflection: number; spill: number; key: number; detail: number;
  mode: string; style: string; text: string; mediaScale: number; mediaRotation: number;
  colors: {[K in keyof typeof OVERDRIVE_COLORS]: Cinema2Color};
  energy: number; bass: number; mid: number; high: number; vocal: number; kick: number; snare: number; beat: number; build: number; drop: number; phrase: number;
}
export const DEFAULT_OVERDRIVE_LOOK: OverdriveLook = {
  pattern:'core-lock',pose:OVERDRIVE_POSES['core-lock'],phase:0,motion:.65,intensity:.85,reactivity:.75,
  size:1,separation:.02,rotation:.35,compression:.15,piston:.35,speaker:.45,aperture:.2,relay:.5,
  brightness:1.1,roughness:.32,reflection:.65,spill:.65,key:.7,detail:1,mode:'auto',style:'led',text:'OVERDRIVE',mediaScale:1,mediaRotation:0,
  colors:OVERDRIVE_COLORS,energy:0,bass:0,mid:0,high:0,vocal:0,kick:0,snare:0,beat:0,build:0,drop:0,phrase:0,
}
export function overdriveBandRadius(y:number) { return Math.sqrt(Math.max(0,1.46**2-y*y)) }
export function overdriveAssemblyPose(index:number,look:OverdriveLook) {
  const a=index*Math.PI/5, p=look.pose, phase=look.phase, m=look.motion;
  const wave=Math.sin(phase*1.8-a*2)*p[1]*m;
  return { radial: 3.24 - .48*(look.compression+p[0]*m+look.build*.65-look.drop*.7) + wave*.26,
    stroke: look.piston*m*(wave*.38 + look.bass*.36 + look.kick*.29 - look.drop*.22),
    cone: look.speaker*m*(p[5]*Math.sin(phase*3-a)*.12+look.bass*.16+look.kick*.20),
    shutter: (look.aperture+p[4]*m)*.35, relay: Math.max(.03,look.relay*(.24+p[6]*Math.max(0,Math.cos(phase*1.4-a))*.75+look.high*.3+look.snare*(index%2?.65:.10))) };
}
type Merge = typeof import('three/examples/jsm/utils/BufferGeometryUtils.js')['mergeGeometries']
const vertex=`varying vec3 vLocal; void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment=`varying vec3 vLocal; uniform sampler2D uMedia,uText; uniform vec3 uColor; uniform float uMode,uStyle,uGain,uPhase,uAspect,uScale,uAngle,uBass;
void main(){vec2 uv=vLocal.xy/2.72+.5; vec2 grid=vec2(128.,64.);vec2 pix=(floor(uv*grid)+.5)/grid; vec2 q=(uStyle<.5?pix:uv)-.5;
float c=cos(uAngle),s=sin(uAngle);q=mat2(c,-s,s,c)*q/max(.1,uScale);q.x/=min(1.,uAspect);q.y*=max(1.,uAspect);q+=.5;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec3 rgb=uColor;float a=0.;
if(uMode>2.5){vec4 t=texture2D(uMedia,q);a=max(max(t.r,t.g),t.b)*t.a*inside;if(uStyle>1.5)rgb=t.rgb;}
else if(uMode>1.5){a=texture2D(uText,q).r*inside;}
else if(uMode>.5){float y=.5+sin(pix.x*22.+uPhase*2.)*(.06+uBass*.22)+sin(pix.x*44.-uPhase)*.04;a=1.-smoothstep(.012,.035,abs(pix.y-y));}
else {float y=.49+sin((pix.x-.5)*9.)*.22; a=1.-smoothstep(.04,.065,abs(pix.y-y));a*=step(.12,pix.x)*step(pix.x,.88);}
vec2 cell=abs(fract(uv*grid)-.5);float dotMask=(1.-smoothstep(.30,.46,cell.x))*(1.-smoothstep(.30,.46,cell.y));if(uStyle<.5)a*=dotMask;
a*=smoothstep(-.1,.25,vLocal.z);gl_FragColor=vec4(vec3(.009,.01,.017)+rgb*a*uGain,1.);}`

/** Authored world-space machine. Shared geometry and merged static components,
 * independently articulated telescoping rods, acoustic cones, and spherical ribs. */
export class OverdriveScene {
  private readonly group: Three.Group
  private readonly core: Three.Group
  private readonly rings: Three.Mesh[]=[]
  private readonly assemblies: {root:Three.Group;rod:Three.Group;cone:Three.Group;shutter:Three.Group;light:Three.MeshStandardMaterial}[]=[]
  private readonly metal: Three.MeshStandardMaterial
  private readonly titanium: Three.MeshStandardMaterial
  private readonly carbon: Three.MeshStandardMaterial
  private readonly dark: Three.MeshStandardMaterial
  private readonly screen: Three.ShaderMaterial
  private readonly mediaTexture: Three.Texture
  private readonly textTexture: Three.DataTexture
  private readonly key: Three.DirectionalLight
  private readonly rim: Three.DirectionalLight
  private readonly spill: Three.PointLight
  private readonly accent: Three.PointLight
  private readonly rotor: Three.Group
  private readonly rear: Three.Group
  private readonly geometries=new Set<Three.BufferGeometry>()
  private readonly materials=new Set<Three.Material>()
  private renderer: Three.WebGLRenderer|null=null
  private media: Readonly<Cinema2ManagedMediaResource>|null=null
  private lastText=''
  private lastDetail=-1
  private readonly weave: Three.DataTexture
  constructor(private readonly library:Cinema2ThreeLibrary,merge:Merge,root:Three.Object3D) {
    const T=library.THREE; this.group=new T.Group();root.add(this.group);
    const mat=(color:number,metalness:number,roughness:number)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness});this.materials.add(m);return m};
    this.metal=mat(0x30343f,.82,.32);this.titanium=mat(0x9299a6,.85,.27);this.carbon=mat(0x14161a,.30,.63);this.dark=mat(0x090b10,.35,.60);
    const tex=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,v=((x>>2)+(y>>2))%2?78:155;tex.set([v,v,v,255],i)}
    this.weave=new T.DataTexture(tex,32,32);this.weave.wrapS=this.weave.wrapT=T.RepeatWrapping;this.weave.repeat.set(7,7);this.weave.magFilter=T.LinearFilter;this.weave.needsUpdate=true;this.carbon.map=this.weave;
    const add=(parent:Three.Object3D,g:Three.BufferGeometry,m:Three.Material,x=0,y=0,z=0)=>{this.geometries.add(g);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh};
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>new T.BoxGeometry(w,h,d).translate(x,y,z);
    const cyl=(r:number,h:number,x:number,y:number,z:number,segments=24)=>new T.CylinderGeometry(r,r,h,segments).rotateX(Math.PI/2).translate(x,y,z);
    const tor=(r:number,t:number,x=0,y=0,z=0,segments=64)=>new T.TorusGeometry(r,t,8,segments).translate(x,y,z);
    const combine=(parts:Three.BufferGeometry[])=>{const g=merge(parts);parts.forEach(p=>p.dispose());if(!g)throw new Error('OVERDRIVE geometry merge failed');return g};
    this.core=new T.Group();this.group.add(this.core);
    this.mediaTexture=new T.Texture();this.textTexture=new T.DataTexture(new Uint8Array(512*128*4),512,128);this.textTexture.needsUpdate=true;
    this.screen=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:{uMedia:{value:this.mediaTexture},uText:{value:this.textTexture},uColor:{value:new T.Color()},uMode:{value:0},uStyle:{value:0},uGain:{value:2},uPhase:{value:0},uAspect:{value:1},uScale:{value:1},uAngle:{value:0},uBass:{value:0}}});this.materials.add(this.screen);
    const display=add(this.core,new T.SphereGeometry(1.395,64,40),this.screen);
    display.onBeforeRender=renderer=>{this.renderer=renderer;const p=renderer.properties.get(this.mediaTexture) as {__webglTexture?:WebGLTexture;__version?:number};if(this.media){p.__webglTexture=this.media.texture;p.__version=this.mediaTexture.version}else{delete p.__webglTexture;delete p.__version}};
    for(let i=0;i<56;i++){const y=-1.425+i*2.85/55,r=overdriveBandRadius(y);const rib=add(this.core,combine([new T.TorusGeometry(r,.021,6,96).rotateX(Math.PI/2),box(.055,.052,.075,r,0,0)]),i%5===0?this.titanium:this.metal,0,y,0);this.rings.push(rib)}
    this.rotor=new T.Group();this.rear=new T.Group();this.group.add(this.rotor,this.rear);
    for(let i=0;i<4;i++){const r=1.84+i*1.18;add(i<2?this.rotor:this.rear,tor(r,.085,0,0,-.72-i*.65),i%2?this.metal:this.titanium);add(this.rear,tor(r+.16,.12,0,0,-1.02-i*.65),this.dark)}
    // Deep continuous shell keeps the scene enclosed at unusual output ratios.
    const shell=add(this.rear,new T.CylinderGeometry(8.8,8.8,15,64,1,true).rotateX(Math.PI/2),this.dark,0,0,-1);(shell.material as Three.MeshStandardMaterial).side=T.DoubleSide;
    const back=add(this.rear,new T.CircleGeometry(8.8,64),this.dark,0,0,-7);back.rotation.z=.1;
    const bodyParts=[box(.84,1.65,.85,0,.52,-.38),box(1.06,.32,1.06,0,.80,-.28),box(.58,.4,.68,0,-.42,-.28),cyl(.61,.3,0,0,0),cyl(.35,.28,0,-1.12,-.48,12)];
    const rails:Three.BufferGeometry[]=[tor(.57,.055,0,0,.23),tor(.43,.037,0,0,.235),tor(.32,.047,0,-1.12,-.29,32)];
    for(const s of [-1,1]){rails.push(box(.09,2.7,.12,s*.48,.78,-.03),box(.13,2.35,.14,s*.34,.8,-.77));for(let j=0;j<8;j++)rails.push(box(.11,.10,.23,s*.43,.18+j*.18,-.08));}
    for(let j=0;j<12;j++){const a=j*Math.PI/6;rails.push(cyl(.045,.08,.51*Math.cos(a),.51*Math.sin(a),.27,8));}
    const fins:Three.BufferGeometry[]=[];for(let j=0;j<10;j++)fins.push(box(.80,.055,.67,0,.42+j*.115,-.43));
    const body=combine(bodyParts),rail=combine(rails),fin=combine(fins);
    const coneG=new T.LatheGeometry([new T.Vector2(0,.04),new T.Vector2(.16,.04),new T.Vector2(.25,.09),new T.Vector2(.48,.25),new T.Vector2(.51,.25)],48).rotateX(Math.PI/2);
    const shaft=combine([box(.15,1.35,.15,-.28,1.35,-.25),box(.15,1.35,.15,.28,1.35,-.25),box(.66,.12,.18,0,1.95,-.25)]);
    const shutterG=combine([box(.38,.72,.23,0,-.84,-.35),box(.5,.16,.26,0,-1.15,-.35)]);
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;const unit=new T.Group();unit.rotation.z=a;this.group.add(unit);const radial=new T.Group();unit.add(radial);radial.position.set(0,3.24,.65);
      const head=new T.Group();head.rotation.x=-.22;radial.add(head);add(head,body,this.metal);add(head,rail,this.titanium);add(head,fin,this.carbon);
      const cone=new T.Group();head.add(cone);add(cone,coneG,this.carbon);add(cone,new T.SphereGeometry(.16,20,12,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2),this.dark,0,0,.09);
      const rod=new T.Group();radial.add(rod);add(rod,shaft,this.titanium);const shutter=new T.Group();radial.add(shutter);add(shutter,shutterG,this.metal);
      const glow=mat(0x1b0924,.1,.4);glow.emissive.setHex(0xb012c8);add(radial,combine([box(.034,1.36,.06,-.31,.9,.43),box(.034,1.36,.06,.31,.9,.43),tor(.19,.018,0,-1.12,-.25,24)]),glow);
      this.assemblies.push({root:radial,rod,cone,shutter,light:glow});
      const rib=new T.Group();rib.rotation.z=a;this.rear.add(rib);add(rib,box(1.18,5.6,.85,0,5.3,-2.4),this.carbon);add(rib,box(.14,5.6,.12,-.48,5.3,-1.9),this.titanium);add(rib,box(.14,5.6,.12,.48,5.3,-1.9),this.metal);
      for(let j=0;j<6;j++)add(rib,box(1.08,.10,.20,0,3.3+j*.64,-1.85),this.metal);
      const bearing=new T.Group();bearing.rotation.z=a;this.rotor.add(bearing);add(bearing,cyl(.22,.35,0,1.75,-.30,12),this.metal);add(bearing,tor(.20,.035,0,1.75,-.10,24),this.titanium);
    }
    this.key=new T.DirectionalLight(0xffffff,3.4);this.key.position.set(-3,5,7);this.rim=new T.DirectionalLight(0xffffff,2.8);this.rim.position.set(5,-4,3);
    this.spill=new T.PointLight(0xff22ee,10,7,2);this.spill.position.set(0,0,1.7);this.accent=new T.PointLight(0xffffff,3,9,2);this.accent.position.set(0,-4,4);this.group.add(this.key,this.rim,this.spill,this.accent,new T.HemisphereLight(0xbfc8e2,0x11121c,.40));
  }
  private updateText(text:string){if(text===this.lastText)return;this.lastText=text; if(typeof document==='undefined')return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');if(!c)return;c.fillStyle='#000';c.fillRect(0,0,512,128);c.font='bold 86px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(text.slice(0,40),256,64,490);const d=c.getImageData(0,0,512,128).data;const out=this.textTexture.image.data as Uint8Array;for(let y=0;y<128;y++)out.set(d.subarray(y*2048,(y+1)*2048),(127-y)*2048);this.textTexture.needsUpdate=true;}
  apply(l:OverdriveLook,media:Readonly<Cinema2ManagedMediaResource>|null,quality:string,aspect:number){
    const color=(out:Three.Color,c:Cinema2Color)=>out.setRGB(c[0],c[1],c[2]);const p=l.pose,m=l.motion;
    this.group.scale.setScalar(Math.max(1,Math.min(1.7,aspect/1.95))); this.core.scale.setScalar(l.size);this.core.rotation.y=Math.sin(l.phase*.22)*.10*l.rotation*m;
    this.rings.forEach((r,i)=>{const y=-1.425+i*2.85/55;r.position.y=y*(1+l.separation*.26+p[3]*m*.36+l.drop*.17);r.rotation.y=l.phase*l.rotation*.12*(i%2?1:-1);r.rotation.z=Math.sin(l.phase*.7+i*.26)*p[3]*m*.12});
    this.rotor.rotation.z=l.phase*l.rotation*p[2]*m*.19+Math.sin(l.phase*.7)*l.mid*.12+l.phrase*.09;this.rear.rotation.z=-l.phase*l.rotation*p[2]*m*.06;
    this.assemblies.forEach((a,i)=>{const v=overdriveAssemblyPose(i,l);a.root.position.y=v.radial;a.rod.position.y=v.stroke;a.cone.position.z=v.cone;a.shutter.rotation.z=v.shutter*(i%2?1:-1);color(a.light.emissive,l.colors.conduit);a.light.emissiveIntensity=v.relay*l.intensity*p[7]*2;});
    color(this.metal.color,l.colors.metal);color(this.titanium.color,l.colors.titanium);color(this.carbon.color,l.colors.carbon);color(this.dark.color,l.colors.background);this.metal.roughness=l.roughness;this.titanium.roughness=Math.max(.12,l.roughness*.78);this.metal.envMapIntensity=this.titanium.envMapIntensity=l.reflection;const detail=quality==='low'?0:l.detail;if(Math.abs(detail-this.lastDetail)>.015){const pixels=this.weave.image.data as Uint8Array;for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,v=Math.round(255-(255-(((x>>2)+(y>>2))%2?78:155))*detail);pixels.set([v,v,v,255],i)}this.weave.needsUpdate=true;this.lastDetail=detail;}
    const gain=l.intensity*p[7];this.key.intensity=3.6*l.key*gain;this.rim.intensity=2.7*l.key*gain;color(this.rim.color,l.colors.rim);color(this.spill.color,l.colors.core);this.spill.intensity=14*l.spill*gain*(.65+l.bass*.4+l.drop*.5);color(this.accent.color,l.colors.accent);this.accent.intensity=5*l.snare*gain;
    this.media=media;const u=this.screen.uniforms;u.uMode.value=l.mode==='text'?2:l.mode==='waveform'?1:(l.mode==='media'||l.mode==='pool')&&media?3:0;u.uStyle.value=l.style==='raster'?1:l.style==='color'?2:0;u.uGain.value=l.brightness*gain*(1.7+l.beat*.4+l.energy*.3+l.vocal*.1);color(u.uColor.value,l.colors.core);u.uPhase.value=l.phase;u.uBass.value=l.bass;u.uAspect.value=media?media.width/Math.max(1,media.height):l.mode==='text'?4:1;u.uScale.value=l.mediaScale;u.uAngle.value=l.mediaRotation*Math.PI/180;if(l.mode==='text')this.updateText(l.text);
  }
  dispose(){this.renderer?.properties.remove(this.mediaTexture);this.mediaTexture.dispose();this.textTexture.dispose();this.weave.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
