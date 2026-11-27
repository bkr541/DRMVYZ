import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

export const OVERDRIVE_COLORS = {
  background: [.006,.009,.018,1], metal: [.040,.049,.069,1], titanium: [.30,.33,.40,1], carbon: [.035,.041,.056,1],
  core: [.94,.025,.87,1], conduit: [.62,.025,.58,1], rim: [.77,.83,1,1], accent: [1,.94,1,1],
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
/** Source exposure follows the existing LED Intensity, not the reactive machine gain. */
export function overdriveFullColorGain(look: Pick<OverdriveLook,'brightness'|'pattern'|'pose'>) {
  return look.brightness * (look.pattern === 'blackout' ? look.pose[7] : 1)
}
export const OVERDRIVE_CORE_RADIUS = 1.46
export const OVERDRIVE_RIB_COUNT = 56
export function overdriveBandRadius(y:number) { return Math.sqrt(Math.max(0,OVERDRIVE_CORE_RADIUS**2-y*y)) }
/** Axial staging puts the main acoustic bank in the foreground and its bearings
 * beside the core. These are real world coordinates, never viewport scaling. */
export const OVERDRIVE_FOREGROUND_Z = 2.65
export function overdriveInnerBankScale(size:number) { return 1 + .80 * (size - 1) }
/** Preserve a low-key image-based reflection even with older saved Reflection values. */
export function overdriveEnvironmentGain(look:Pick<OverdriveLook,'reflection'|'intensity'|'pose'>) {
  return .19 * look.reflection * look.intensity * look.pose[7]
}
/** Front-facing lathe profile: start at the outer lip and travel inward to the recessed centre.
 * Reversing this order makes the visible cone back-facing in Three.js. */
export const OVERDRIVE_CONE_PROFILE = [
  [.545,.405],[.515,.397],[.480,.36],[.430,.295],[.355,.215],
  [.270,.143],[.180,.098],[.105,.080],[.055,.102],[0,.110],
] as const
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
const fragment=`varying vec3 vLocal; uniform sampler2D uMedia,uText; uniform vec3 uColor; uniform float uMode,uStyle,uGain,uMediaGain,uPhase,uAspect,uScale,uAngle,uBass;
void main(){vec2 uv=vLocal.xy/2.92+.5; vec2 grid=vec2(144.,55.);vec2 gridUv=vec2(uv.x,(vLocal.y+1.425)/2.85);vec2 pix=(floor(gridUv*grid)+.5)/grid;pix.y=(pix.y-.5)*2.85/2.92+.5; vec2 q=(uStyle<.5?pix:uv)-.5;
float c=cos(uAngle),s=sin(uAngle);q=mat2(c,-s,s,c)*q/max(.1,uScale);q.x/=min(1.,uAspect);q.y*=max(1.,uAspect);q+=.5;
float inside=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);vec3 rgb=uColor;float a=0.;
if(uMode>2.5){
  // Managed media is top-down; the generated text texture is bottom-up.
  vec4 t=texture2D(uMedia,vec2(q.x,1.-q.y));
  if(uStyle>1.5){
    // Full Color is a display-referred source, not a luminance mask. The
    // existing LED Intensity controls exposure, independently of the machine.
    float coverage=t.a*inside*smoothstep(-.1,.25,vLocal.z);
    gl_FragColor=vec4(mix(vec3(.009,.01,.017),t.rgb*uMediaGain,coverage),1.);
    return;
  }
  a=max(max(t.r,t.g),t.b)*t.a*inside;
}
else if(uMode>1.5){a=texture2D(uText,q).r*inside;}
else if(uMode>.5){float y=.5+sin(pix.x*22.+uPhase*2.)*(.06+uBass*.22)+sin(pix.x*44.-uPhase)*.04;a=1.-smoothstep(.012,.035,abs(pix.y-y));}
else {// Broad, filled signal rather than a one-pixel outline; no borrowed logo.
  float x=(pix.x-.5);float y=.5+sin(x*9.4)*.15;float w=.093+.046*cos(x*7.);
  a=(1.-smoothstep(w,w+.018,abs(pix.y-y)))*smoothstep(.08,.19,pix.x)*(1.-smoothstep(.81,.92,pix.x));}
vec2 cell=abs(fract(gridUv*grid)-.5);float dotMask=(1.-smoothstep(.33,.48,cell.x))*(1.-smoothstep(.22,.43,cell.y));if(uStyle<.5)a*=dotMask;
float curvature=smoothstep(0.,.67,vLocal.z/1.46);
  a*=curvature;gl_FragColor=vec4(vec3(.006,.008,.013)+rgb*a*uGain,1.);}`

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
  private readonly shellMaterial: Three.MeshStandardMaterial
  private readonly diaphragm: Three.MeshStandardMaterial
  private readonly ribMaterial: Three.MeshStandardMaterial
  private readonly fill: Three.HemisphereLight
  private readonly brushed: Three.DataTexture
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
    this.metal=mat(0x30343f,.83,.36);this.titanium=mat(0x9299a6,.91,.30);
    this.carbon=mat(0x14161a,.24,.55);this.dark=mat(0x090b10,.08,.82);
    this.diaphragm=mat(0x373940,.21,.69);this.diaphragm.vertexColors=true;
    this.ribMaterial=mat(0x11151d,.81,.42);
    // Directional twill, not a checkerboard. Mipmapping suppresses moire on the distant hardware.
    const texture=(pixels:Uint8Array,size:number,repeat:number)=>{
      const t=new T.DataTexture(pixels,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);
      t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
    };
    this.weave=texture(new Uint8Array(64*64*4),64,8);this.carbon.map=this.weave;this.carbon.bumpMap=this.weave;this.carbon.bumpScale=.022;
    const brush=new Uint8Array(64*64*4);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const v=Math.round(155+36*Math.sin(y*2.9)+13*Math.sin(y*.73+x*.08));brush.set([v,v,v,255],(y*64+x)*4);
    }
    this.brushed=texture(brush,64,5);this.titanium.roughnessMap=this.brushed;this.titanium.bumpMap=this.brushed;this.titanium.bumpScale=.009;
    const add=(parent:Three.Object3D,g:Three.BufferGeometry,m:Three.Material,x=0,y=0,z=0,shadow=true)=>{
      this.geometries.add(g);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);
      mesh.castShadow=shadow;mesh.receiveShadow=shadow;parent.add(mesh);return mesh;
    };
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>new T.BoxGeometry(w,h,d).translate(x,y,z);
    const cyl=(r:number,h:number,x:number,y:number,z:number,segments=24)=>new T.CylinderGeometry(r,r,h,segments).rotateX(Math.PI/2).translate(x,y,z);
    const tor=(r:number,t:number,x=0,y=0,z=0,segments=64)=>new T.TorusGeometry(r,t,8,segments).translate(x,y,z);
    const combine=(parts:Three.BufferGeometry[])=>{
      // Extruded bevels are non-indexed; normalize only mixed batches. Never merge unlike attributes.
      const normalized=parts.some(p=>p.index===null)?parts.map(p=>p.index?p.toNonIndexed():p):parts;
      const g=merge(normalized);new Set([...parts,...normalized]).forEach(p=>p.dispose());
      if(!g)throw new Error('OVERDRIVE geometry merge failed');return g;
    };
    const plate=(w:number,h:number,d:number,x:number,y:number,z:number,bevel=.065)=>{
      const b=Math.min(bevel,w*.22,h*.22,d*.35),hw=w/2-b,hh=h/2-b;
      const shape=new T.Shape();shape.moveTo(-hw,-hh);shape.lineTo(hw,-hh);shape.lineTo(hw,hh);shape.lineTo(-hw,hh);shape.closePath();
      return new T.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,steps:1,curveSegments:1}).translate(x,y,z-d/2+b);
    };
    const lathe=(profile:readonly (readonly [number,number])[],segments=48)=>new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)),segments).rotateX(Math.PI/2);
    const pipe=(points:readonly (readonly [number,number,number])[],radius=.035)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x,y,z])=>new T.Vector3(x,y,z))),20,radius,6,false);
    this.core=new T.Group();this.group.add(this.core);
    this.mediaTexture=new T.Texture();this.textTexture=new T.DataTexture(new Uint8Array(512*128*4),512,128);this.textTexture.needsUpdate=true;
    this.screen=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,toneMapped:false,uniforms:{uMedia:{value:this.mediaTexture},uText:{value:this.textTexture},uColor:{value:new T.Color()},uMode:{value:0},uStyle:{value:0},uGain:{value:2},uMediaGain:{value:1},uPhase:{value:0},uAspect:{value:1},uScale:{value:1},uAngle:{value:0},uBass:{value:0}}});this.materials.add(this.screen);
    const display=add(this.core,new T.SphereGeometry(1.448,96,64),this.screen,0,0,0,false);display.name="overdrive-led-surface";
    display.onBeforeRender=renderer=>{this.renderer=renderer;const p=renderer.properties.get(this.mediaTexture) as {__webglTexture?:WebGLTexture;__version?:number};if(this.media){p.__webglTexture=this.media.texture;p.__version=this.mediaTexture.version}else{delete p.__webglTexture;delete p.__version}};
    // The ribs nearly meet the display surface: only a thin dark machined edge is visible.
    // Each rib retains its independent fracture transform and uses real spherical curvature.
    for(let i=0;i<OVERDRIVE_RIB_COUNT;i++){
      const y=-1.425+i*2.85/(OVERDRIVE_RIB_COUNT-1),r=overdriveBandRadius(y);
      const rib=add(this.core,new T.TorusGeometry(r,.009,5,96).rotateX(Math.PI/2),this.ribMaterial,0,y,0,false);
      rib.name='overdrive-core-rib';this.rings.push(rib);
    }
    this.rotor=new T.Group();this.rotor.name='overdrive-inner-bank';this.rear=new T.Group();this.rear.name='overdrive-chamber';this.group.add(this.rotor,this.rear);
    // Layered chamber: thick internal hoops are partly occluded by the equipment,
    // not brightly exposed chrome rings in front of a flat wall.
    for(const [r,z] of [[2.08,-.55],[3.35,-1.65],[4.75,-2.8],[6.45,-4.2],[7.8,1.1]] as const){
      add(this.rear,tor(r,.18,0,0,z,96),this.dark,0,0,0,false);
      add(this.rear,tor(r+.13,.045,0,0,z+.12,96),this.metal,0,0,0,false);
    }
    const shell=add(this.rear,new T.CylinderGeometry(8.8,8.8,15,64,1,true).rotateX(Math.PI/2),this.dark,0,0,-1,false);
    // Interior only, so the shell cannot catch the front-facing studio light as a large flat sheet.
    this.shellMaterial=this.dark.clone();this.shellMaterial.side=T.BackSide;this.materials.add(this.shellMaterial);shell.material=this.shellMaterial;
    const back=add(this.rear,new T.CircleGeometry(8.8,64),this.dark,0,0,-7,false);back.rotation.z=.1;

    // Primary acoustic assembly. Each batch is reused by the ten articulated units.
    // The voice-coil axis is local Z; the rack/actuator axis is local Y.
    const bodyParts:Three.BufferGeometry[]=[
      plate(1.10,1.48,.78,0,.68,-.42),plate(1.24,.36,1.04,0,1.24,-.34),
      plate(.83,.50,.88,0,-.48,-.38),plate(1.30,.29,.91,0,.38,-.40),
      lathe([[0,-.56],[.44,-.56],[.53,-.43],[.62,-.31],[.67,-.15],[.67,.24],[.64,.36],[.57,.43],[.54,.40],[.55,.29],[.55,-.09],[0,-.09]]),
    ];
    const rails:Three.BufferGeometry[]=[tor(.625,.036,0,0,.32,64),tor(.551,.021,0,0,.407,64)];
    const recess:Three.BufferGeometry[]=[tor(.572,.031,0,0,.389,64),cyl(.47,.20,0,0,-.37,32),plate(.93,.76,.29,0,1.03,-.02)];
    const fins:Three.BufferGeometry[]=[plate(.76,1.06,.59,0,1.04,-.36)];
    for(const sign of [-1,1]){
      rails.push(plate(.115,2.42,.15,sign*.51,1.12,-.11,.025),plate(.13,2.30,.18,sign*.40,1.12,-.72,.025));
      bodyParts.push(plate(.23,.57,.66,sign*.47,1.65,-.35),plate(.24,.36,.66,sign*.47,.58,-.35));
      // Rounded telescoping sleeve, exposed metal piston, and short mounting bolts.
      bodyParts.push(new T.CylinderGeometry(.12,.12,1.25,12).translate(sign*.38,1.56,-.30));
      for(let j=0;j<7;j++){
        recess.push(box(.16,.065,.36,sign*.46,.72+j*.15,-.31));
        fins.push(box(.075,.09,.43,sign*.41,.72+j*.15,-.31));
      }
      for(let j=0;j<3;j++)rails.push(cyl(.035,.08,sign*.48,.70+j*.47,.17,6));
    }
    for(let j=0;j<16;j++){
      const a=j*Math.PI/8;rails.push(cyl(.027,.055,.612*Math.cos(a),.612*Math.sin(a),.365,6));
      recess.push(box(.075,.085,.07,0,.62,.235).rotateZ(a));
    }
    const body=combine(bodyParts),rail=combine(rails),fin=combine(fins),inset=combine(recess);
    // Recessed diaphragm with physically front-facing normals and a darkening gradient
    // at the voice coil. The lower lip catches grazing white light; the interior remains dark.
    const coneG=lathe(OVERDRIVE_CONE_PROFILE,64);
    const positions=coneG.getAttribute('position'),coneColors=new Float32Array(positions.count*3);
    for(let i=0;i<positions.count;i++){
      const radius=Math.hypot(positions.getX(i),positions.getY(i));
      const ao=.24+.76*Math.pow(Math.min(1,radius/.545),1.65);
      coneColors.set([ao,ao,ao],i*3);
    }
    coneG.setAttribute('color',new T.BufferAttribute(coneColors,3));
    const shaft=combine([
      ...[-1,1].flatMap(sign=>[new T.CylinderGeometry(.068,.068,1.40,16).translate(sign*.38,2.01,-.30),
        plate(.19,.22,.30,sign*.38,2.51,-.30,.03)]),plate(.92,.16,.34,0,2.53,-.30,.03),
    ]);
    const shutterG=combine([plate(.35,.52,.23,0,-.78,-.37),plate(.51,.17,.30,0,-1.04,-.37)]);
    const cableG=combine([-1,1].map(sign=>pipe([[sign*.54,.35,-.16],[sign*.69,.64,-.28],[sign*.67,1.62,-.52],[sign*.45,2.18,-.49]],.041)));
    const indicators=combine([-1,1].flatMap(sign=>[box(.035,.21,.045,sign*.62,.80,.05),box(.035,.12,.045,sign*.62,1.23,.05),box(.09,.03,.04,sign*.36,1.36,.19)]));

    // Secondary actuators and the mechanical infrastructure visible through the gaps.
    // They fill three different axial layers with intentional negative space.
    const backing=combine([plate(1.48,4.1,.72,0,4.16,-2.15),plate(1.63,.43,.84,0,3.01,-1.95),plate(1.68,.47,.90,0,5.72,-1.93),
      plate(1.04,2.30,.58,0,5.63,-3.40),plate(.95,1.22,.70,0,7.15,-1.45)]);
    const backingRails=combine([-1,1].flatMap(sign=>[plate(.10,3.68,.15,sign*.63,4.16,-1.71,.02),plate(.12,2.45,.17,sign*.44,5.58,-3.02,.02),
      pipe([[sign*.70,2.71,-1.85],[sign*.83,3.22,-1.64],[sign*.83,5.36,-1.64],[sign*.59,6.18,-2.21]],.065),
      ...Array.from({length:6},(_,j)=>box(.19,.10,.28,sign*.56,3.18+j*.43,-1.64))]));
    const backingFins=combine(Array.from({length:10},(_,j)=>box(1.02,.055,.39,0,3.18+j*.22,-1.69)));
    const foreMount=combine([plate(1.28,1.70,1.05,0,6.1,2.65),plate(1.57,.42,1.25,0,5.65,2.65),plate(1.35,.38,1.15,0,6.84,2.75),
      ...[-1,1].map(sign=>plate(.18,2.14,.25,sign*.53,6.11,3.21,.035))]);
    const mountTrim=combine([-1,1].flatMap(sign=>[pipe([[sign*.51,5.0,2.5],[sign*.73,5.36,2.77],[sign*.79,6.35,3.14],[sign*.63,7.1,3.22]],.064),
      ...Array.from({length:4},(_,j)=>cyl(.051,.08,sign*.47,5.77+j*.32,3.32,6))]));
    const bearingBody=combine([lathe([[0,-.40],[.24,-.40],[.31,-.28],[.34,-.04],[.34,.18],[.28,.25],[.21,.25],[.21,.10],[0,.10]],32),
      plate(.48,.96,.42,0,.58,-.28),plate(.63,.27,.49,0,.79,-.29)]);
    const bearingTrim=combine([tor(.30,.035,0,0,.175,36),tor(.19,.026,0,0,.225,32),
      ...Array.from({length:8},(_,j)=>cyl(.035,.065,.273*Math.cos(j*Math.PI/4),.273*Math.sin(j*Math.PI/4),.21,6)),
      ...[-1,1].map(sign=>plate(.07,.83,.12,sign*.24,.56,-.02,.015))]);
    const bearingCap=combine([cyl(.18,.075,0,0,.14,24),tor(.095,.025,0,0,.19,24)]);
    const shoulder=combine([plate(.65,1.44,.46,0,3.70,-.65),plate(.87,.24,.58,0,3.16,-.54),plate(.81,.26,.61,0,4.19,-.51)]);
    const shoulderTrim=combine([-1,1].flatMap(sign=>[plate(.08,1.40,.15,sign*.32,3.70,-.33,.02),pipe([[sign*.24,3.03,-.5],[sign*.47,3.35,-.25],[sign*.47,4.15,-.29],[sign*.28,4.45,-.61]],.035)]));
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;const unit=new T.Group();unit.rotation.z=a;this.group.add(unit);
      const radial=new T.Group();radial.name='overdrive-acoustic-assembly';unit.add(radial);radial.position.set(0,3.24,OVERDRIVE_FOREGROUND_Z);
      // Inward tilt aims acoustic cones into the chamber/camera rather than along a flat plane.
      const head=new T.Group();head.rotation.x=.49;radial.add(head);
      add(head,body,this.metal);add(head,rail,this.titanium);add(head,fin,this.carbon);add(head,inset,this.dark);add(head,cableG,this.dark);
      const cone=new T.Group();head.add(cone);const diaphragm=add(cone,coneG,this.diaphragm);diaphragm.name='overdrive-recessed-diaphragm';
      const rod=new T.Group();head.add(rod);add(rod,shaft,this.titanium);
      const shutter=new T.Group();head.add(shutter);add(shutter,shutterG,this.metal);
      const glow=mat(0x190b20,.12,.42);glow.emissive.setHex(0xb012c8);add(head,indicators,glow,0,0,0,false);
      this.assemblies.push({root:radial,rod,cone,shutter,light:glow});
      const mount=new T.Group();unit.add(mount);add(mount,foreMount,this.carbon);add(mount,mountTrim,this.titanium);
      const rib=new T.Group();rib.rotation.z=a;this.rear.add(rib);add(rib,backing,this.metal);add(rib,backingRails,this.titanium);add(rib,backingFins,this.carbon);
      const mid=new T.Group();mid.rotation.z=a+Math.PI/10;this.rear.add(mid);add(mid,shoulder,this.carbon);add(mid,shoulderTrim,this.metal);
      const bearing=new T.Group();bearing.rotation.z=a+Math.PI/10;this.rotor.add(bearing);
      const socket=new T.Group();socket.position.set(0,1.79,.12);socket.rotation.x=.20;bearing.add(socket);
      add(socket,bearingBody,this.metal);add(socket,bearingTrim,this.titanium);add(socket,bearingCap,this.dark);
    }
    // Selective illumination: rear white glints, lower grazing key, magenta spill from the screen.
    this.key=new T.DirectionalLight(0xe2e8ff,0);this.key.position.set(-2,-5,3);
    this.rim=new T.DirectionalLight(0xe0e6ff,0);this.rim.position.set(2,5,-4);
    this.spill=new T.PointLight(0xff22ee,0,6.5,2);this.spill.position.set(0,0,1.05);
    this.accent=new T.PointLight(0xffffff,0,7,2);this.accent.position.set(0,-4,4.0);
    this.fill=new T.HemisphereLight(0xbfc8e2,0x11121c,0);this.group.add(this.key,this.rim,this.spill,this.accent,this.fill);
  }
  private updateText(text:string){if(text===this.lastText)return;this.lastText=text; if(typeof document==='undefined')return;const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');if(!c)return;c.fillStyle='#000';c.fillRect(0,0,512,128);c.font='bold 86px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(text.slice(0,40),256,64,490);const d=c.getImageData(0,0,512,128).data;const out=this.textTexture.image.data as Uint8Array;for(let y=0;y<128;y++)out.set(d.subarray(y*2048,(y+1)*2048),(127-y)*2048);this.textTexture.needsUpdate=true;}
  apply(l:OverdriveLook,media:Readonly<Cinema2ManagedMediaResource>|null,quality:string,_aspect:number){
    const color=(out:Three.Color,c:Cinema2Color)=>out.setRGB(c[0],c[1],c[2]);const p=l.pose,m=l.motion;
    this.core.scale.setScalar(l.size);this.rotor.scale.setScalar(overdriveInnerBankScale(l.size));this.core.rotation.y=Math.sin(l.phase*.22)*.10*l.rotation*m;
    this.rings.forEach((r,i)=>{const y=-1.425+i*2.85/(OVERDRIVE_RIB_COUNT-1);r.position.y=y*(1+l.separation*.26+p[3]*m*.36+l.drop*.17);r.rotation.y=l.phase*l.rotation*.12*(i%2?1:-1);r.rotation.z=Math.sin(l.phase*.7+i*.26)*p[3]*m*.12});
    this.rotor.rotation.z=l.phase*l.rotation*p[2]*m*.19+Math.sin(l.phase*.7)*l.mid*.12+l.phrase*.09;this.rear.rotation.z=-l.phase*l.rotation*p[2]*m*.06;
    this.assemblies.forEach((a,i)=>{const v=overdriveAssemblyPose(i,l);a.root.position.y=v.radial;a.root.position.z=OVERDRIVE_FOREGROUND_Z+v.stroke*.40;a.rod.position.y=v.stroke;a.cone.position.z=Math.max(-.045,Math.min(.045,v.cone*.30));a.shutter.rotation.z=v.shutter*(i%2?1:-1);color(a.light.emissive,l.colors.conduit);a.light.emissiveIntensity=v.relay*l.intensity*p[7]*2.7;});
    // Palette values stay user editable; distinct finishes keep chrome restricted to trim.
    color(this.metal.color,l.colors.metal);color(this.titanium.color,l.colors.titanium);
    color(this.carbon.color,l.colors.carbon);color(this.dark.color,l.colors.background);this.shellMaterial.color.copy(this.dark.color);
    // Blackout and master intensity also suppress the small fixed shared shadow key.
    const visibility=Math.min(1,l.intensity*p[7]*1.5);
    this.metal.color.multiplyScalar(visibility);this.titanium.color.multiplyScalar(visibility);
    this.carbon.color.multiplyScalar(visibility);this.dark.color.multiplyScalar(visibility);this.shellMaterial.color.multiplyScalar(visibility);
    this.ribMaterial.color.copy(this.metal.color).multiplyScalar(.29);
    this.diaphragm.color.copy(this.carbon.color).multiplyScalar(1.7);
    this.metal.roughness=l.roughness;this.titanium.roughness=Math.max(.19,l.roughness*.83);
    this.ribMaterial.roughness=Math.max(.35,l.roughness);
    const detail=quality==='low'?0:l.detail;
    this.carbon.bumpScale=.022*detail;this.titanium.bumpScale=.009*detail;
    if(Math.abs(detail-this.lastDetail)>.015){
      const pixels=this.weave.image.data as Uint8Array;
      for(let y=0;y<64;y++)for(let x=0;x<64;x++){
        const strandX=x%8,strandY=y%8,over=((x>>3)+(y>>3))%4<2;
        const strand=over?strandX:strandY;
        const v=Math.round(255-(255-(68+102*Math.sin((strand+.5)*Math.PI/8)+13*Math.cos((over?y:x)*1.4)))*detail);
        pixels.set([v,v,v,255],(y*64+x)*4);
      }
      this.weave.needsUpdate=true;this.lastDetail=detail;
    }
    const gain=l.intensity*p[7];
    this.fill.intensity=.075*gain;this.key.intensity=1.45*l.key*gain;this.rim.intensity=1.85*l.key*gain;
    color(this.rim.color,l.colors.rim);color(this.spill.color,l.colors.core);
    this.spill.intensity=24*l.spill*gain*(.68+l.bass*.44+l.drop*.55);
    color(this.accent.color,l.colors.accent);this.accent.intensity=(5+12*l.snare)*l.key*gain;
    this.media=media;const u=this.screen.uniforms;u.uMode.value=l.mode==='text'?2:l.mode==='waveform'?1:(l.mode==='media'||l.mode==='pool')&&media?3:0;u.uStyle.value=l.style==='raster'?1:l.style==='color'?2:0;u.uGain.value=l.brightness*gain*(3.0+l.beat*.65+l.energy*.5+l.vocal*.15);u.uMediaGain.value=overdriveFullColorGain(l);color(u.uColor.value,l.colors.core);u.uPhase.value=l.phase;u.uBass.value=l.bass;u.uAspect.value=media?media.width/Math.max(1,media.height):l.mode==='text'?4:1;u.uScale.value=l.mediaScale;u.uAngle.value=l.mediaRotation*Math.PI/180;if(l.mode==='text')this.updateText(l.text);
  }
  dispose(){this.renderer?.properties.remove(this.mediaTexture);this.mediaTexture.dispose();this.textTexture.dispose();this.weave.dispose();this.brushed.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
