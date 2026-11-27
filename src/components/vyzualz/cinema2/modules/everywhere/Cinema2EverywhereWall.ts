import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { everywhereSpatialPosition } from './Cinema2EverywhereSpatial'
import { everywhereMediaPose } from './Cinema2EverywhereMediaMotion'
import { everywhereEyePose } from './Cinema2EverywhereEyeMotion'
import { EVERYWHERE_CABINET_STYLES, buildEverywhereCabinetParts } from './Cinema2EverywhereCabinets'
import { EVERYWHERE_SCREEN_FRAGMENT, EVERYWHERE_SCREEN_VERTEX } from './Cinema2EverywhereScreens'

export const EVERYWHERE_COLORS = {
  background: [.008,.010,.012,1],
  cabinet: [.075,.078,.081,1],
  cool: [.055,.71,.83,1],
  warm: [1,.52,.21,1],
  screen: [1,.97,.93,1],
} as const satisfies Readonly<Record<string,Cinema2Color>>

export const EVERYWHERE_PATTERNS = [
  {value:'all-eyes',label:'All Eyes'}, {value:'signal-sweep',label:'Signal Sweep'},
  {value:'outward-pulse',label:'Outward Pulse'}, {value:'cross-cut',label:'Cross Cut'},
  {value:'channel-hold',label:'Channel Hold'}, {value:'ghost-feed',label:'Ghost Feed'},
  {value:'static-switch',label:'Static Switch'}, {value:'retro-broadcast',label:'Retro Broadcast'},
  {value:'tape-tracking',label:'Tape Tracking'}, {value:'channel-mosaic',label:'Channel Mosaic'},
  {value:'signal-relay',label:'Signal Relay'}, {value:'midnight-replay',label:'Midnight Replay'},
] as const
export type EverywherePattern = typeof EVERYWHERE_PATTERNS[number]['value']
type Colors = { [Key in keyof typeof EVERYWHERE_COLORS]: Cinema2Color }
export interface EverywhereLook {
  pattern: EverywherePattern
  phase: number
  brightness: number
  coverage: number
  angle: number
  motion: number
  scan: number
  glare: number
  layout: 'repeat' | 'wall' | 'choreographed'
  mediaFit?: 'contain' | 'cover' | 'stretch'
  contentMotion?: number
  scaleVariation?: number
  screenPower?: boolean
  heroReadability?: boolean
  colors: Colors
  energy: number
  bass: number
  high: number
  vocal: number
  kick: number
  snare: number
  build: number
  drop: number
}

export interface EverywhereCabinet {
  x: number; y: number; z: number; scale: number; roll: number; yaw: number; seed: number
  pitch: number; width: number; height: number; depth: number; style: 0 | 1 | 2 | 3
}
export const EVERYWHERE_WIDE_ASPECT = 32/9
/** Wide output extends the lateral installation; it must never stretch a CRT. */
export function everywhereWallCoverScale(aspect: number): number {
  return Math.max(1, (Number.isFinite(aspect) ? aspect : EVERYWHERE_WIDE_ASPECT) / EVERYWHERE_WIDE_ASPECT)
}

// Reference silhouette staging: dominant hero, eight large peripheral consoles,
// smaller interstitial sets, lateral wings and far-camera perimeter. The
// placement was solved against tapered front/rear cabinet silhouettes (not
// enlarged bounding rectangles), with physical OBB separation across the
// bounded articulation range. All coordinates are physical world units.
// [x,y,z,scale,pitch,yaw,roll (degrees),family]. Index zero is the hero feed.
const INSTALLATION = [
  [0,-0.081,2.25,2.307,0,0,0,0],
  [-4.164,1.276,3.1,1.126,4,43,-12,1],
  [4.444,1.742,3,1.208,-6,-43,11,1],
  [-4.775,-1.791,3.6,1.252,-5,41,-14,1],
  [6.433,-0.605,1.346,1.446,1.805,-37.724,9.595,1],
  [4.927,-4.022,-0.04,1.658,-6.403,-27.521,9.202,3],
  [-2.023,3.573,-0.374,1.526,10.03,22.157,-11.814,3],
  [-1.616,-3.636,2,1.028,-10,18,-7,1],
  [3.243,3.879,-0.074,1.357,8.846,-20.502,8.841,3],
  [-5.997,4.056,1.6,1.248,10,26,-10,3],
  [-4.974,4.738,-2.274,0.926,7.299,12.729,-11.673,1],
  [-0.123,4.001,-3.278,0.793,1.688,5.741,-3.096,0],
  [0.88,2.759,-0.439,0.704,4.092,-7.018,3.34,1],
  [-5.868,3.096,-1.608,0.865,7.389,15.281,-5.76,3],
  [3.887,0.769,-0.7,0.747,-3,-13,5,0],
  [-3.897,-2.313,-0.6,0.64,-4,15,-5,1],
  [-0.634,-3.16,-0.8,0.744,-6,0,2,0],
  [1.387,-4.006,-2.577,0.86,-4.348,-8.005,5.176,3],
  [-7.999,1.727,0.8,0.798,3,38,-7,1],
  [8.135,2.642,0.3,0.69,4,-31,7,1],
  [7.719,-2.865,1,0.945,-5,-38,9,3],
  [-7.56,-3.939,1,0.901,-7,35,-6,0],
  // Recessed interstitial monitors.
  [-9.617,0.363,-5.473,1.746,-3.206,22.981,-5.552,2],
  [4.219,-1.355,-3.743,1.323,-3.497,-5.578,-8.899,1],
  [-5.871,-0.593,-4.045,1.442,1.35,19.761,3.592,2],
  [8.201,6.001,-5.526,1.682,4.087,-19.04,8.823,2],
  [8.871,-4.212,-3.23,1.741,-5.383,-30.922,8.762,2],
  [3.155,-5.418,-5.369,1.699,-7.245,-6.995,1.214,0],
  [-6.366,-5.618,-6.121,1.643,-4.216,19.92,-2.733,3],
  [-9.852,4.28,-3.432,1.152,1.831,26.1,-11.339,1],
  [3.372,3.338,-4.325,1.315,1.029,-3.582,2.771,2],
  [-4.099,3.286,-5.655,2.013,0.999,15.72,-10.609,2],
  [-6.947,-4.78,-1.439,0.959,-3.972,21.74,0.956,0],
  [0.486,5.7,-3.443,0.945,6.212,1.652,-8.743,1],
  [8.726,4.452,-2.06,1.353,2.487,-36.543,-9.429,3],
  [8.791,1.062,-1.894,1.615,-1.122,-31.987,-7.788,2],
  [-0.234,-5.82,-5.158,1.157,-8.115,0.496,-1.229,3],
  [-2.782,-3.584,-4.106,1.275,-7.864,-0.422,0.889,2],
  [4.558,-3.484,-8.079,1.122,-3.033,-8.062,-7.702,0],
  [6.403,-2.697,-5.829,1.117,-0.742,-18.01,-9.537,0],
  [-5.332,-0.925,-7.707,1.367,2.91,15.414,5.201,2],
  [2.714,6.552,-8.148,1.225,4.39,-7.427,3.138,3],
  [1.612,-3.844,-8.014,0.696,1.336,-8.458,1.902,1],
  [7.177,0.427,-7.512,0.89,2.977,-25.403,6.405,1],
  [-12.807,-0.353,-8.245,0.903,1.09,30.805,4.038,0],
  [-1.71,7.792,-8.18,0.99,3.233,-4.565,8.931,3],
  [-0.375,3.164,-5.419,0.75,1.123,-4.595,-11.254,2],
  [5.206,-0.002,-8.158,0.688,-3.491,-11.475,8.394,0],
  [-0.046,-3.755,-6.324,0.952,-3.372,7.262,1.177,2],
  [5.81,2.79,-8.263,1.098,5.742,-17.132,-11.563,1],
  [-12.687,1.567,-8.14,1.026,1.453,27.913,-4.39,0],
  [8.231,-4.261,-7.77,1.118,1.361,-19.052,-10.738,0],
  [1.17,-7.08,-8.024,1.117,-3.448,-11.601,-8.984,3],
  [7.292,-1.064,-5.943,0.702,1.551,-21.677,-4.433,1],
  [-9.737,-1.007,-8.283,0.976,-2.114,14.805,-6.916,1],
  [-3.864,0.614,-4.376,0.484,-0.259,2.448,-6.083,0],
  [12.034,-3.262,-8.172,1.286,-3.028,-33.214,2.978,3],
  [-5.4,-3.889,-4.168,0.975,-1.372,7.155,-6.014,0],
  [-6.2,4.687,-7.998,0.681,8.421,19.677,-3.443,1],
  [-12.834,6.704,-7.805,1.279,3.424,40.049,-9.24,0],
  [1.936,4.293,-6.348,1.28,1.055,-9.901,7.751,2],
  // Lateral continuation and far-camera edges.
  [-17.276,-0.08,-3.685,1.983,1.931,43,-6.425,3],
  [19.014,0.81,-3.457,1.827,-1.446,-43,-3.289,0],
  [16.24,-3.273,-0.671,1.574,-3.373,-43,-10.409,2],
  [-15.232,4.745,-1.72,1.54,2.363,43,-6.424,0],
  [12.809,1.234,-2.746,1.896,5.285,-43,9.802,2],
  [-12.031,-1.109,-0.743,1.941,-5.54,43,7.948,2],
  [15.462,3.073,-0.606,1.293,2.62,-43,-2.916,3],
  [-16.552,-4.281,-1.55,1.526,-6.262,43,-2.437,2],
  [17.28,-6.602,-5.76,1.57,-1.982,-43,-3.612,1],
  [-20.997,1.97,-6.13,2.032,1.526,43,-0.409,0],
  [20.061,6.024,-5.417,1.948,9.226,-43,9.859,2],
  [13.263,-2.927,-2.742,1.261,-6.085,-39.49,1.161,1],
  [-12.416,-5.046,-2.945,1.817,-7.952,33.239,7.056,3],
  [-22.104,-2.463,-5.202,1.604,-7.117,43,11.425,0],
  [-12.832,2.845,-0.785,0.987,5.194,43,0.604,1],
  [-17.315,-4.658,-5.329,1.97,-6.463,43,0.389,2],
  [-20.624,4.932,-3.392,1.336,9.244,43,0.908,0],
  [15.252,-1.749,-5.75,1.85,-2.241,-40.082,11.221,2],
  [15.471,5.829,-6.257,1.559,6.137,-43,5.68,0],
  [22.183,-1.824,-5.562,1.404,-3.874,-43,5.64,1],
  [13.1,-5.569,-5.267,1.094,-9.767,-31.589,-2.844,1],
  [-20.211,-3.768,-2.669,1.414,-0.115,43,1.085,3],
  [-16.223,5.446,-5.718,1.22,8.839,43,-5.029,2],
  [-14.558,-4.417,-8.924,1.85,0.462,32.829,-8.478,2],
  [-17.907,2.785,-9.047,1.608,-2.092,43,-5.447,2],
  [19.032,2.038,-7.197,1.201,0.244,-43,-3.469,2],
  [17.932,-2.265,-4.383,0.609,-4.833,-43,3.527,3],
  [-26.297,-0.216,-7.304,1.499,-3.262,43,11.737,0],
  [-12.673,4.881,-4.854,0.996,5.423,36.646,-2.496,1],
  [21.575,-5.232,-8.479,1.232,-0.406,-43,-0.744,1],
  [19.267,-1.375,-7.259,0.962,1.2,-40.606,-9.374,3],
  [-24.152,4.892,-8.789,1.352,1.145,43,-0.039,3],
  [21.091,4.041,-8.526,1.381,-1.635,-43,2.416,2],
  [16.842,3.934,-8.375,1.237,6.001,-43,-3.156,2],
  [27.333,7.604,-8.437,2.005,3.995,-43,-2.965,2],
  [26.764,-6.926,-8.48,1.386,-0.205,-43,3.63,1],
  [28.583,3.268,-8.745,1.65,8.15,-43,-2.866,3],
  [12.414,7.491,-8.44,1.14,10.296,-22.978,9.743,3],
  [-20.186,3.069,-1.538,0.983,-0.141,43,7.545,0],
  [19.165,3.461,-1.253,0.684,1.199,-43,11.48,1],
] as const

/** Keep the physical wrap even at minimum articulation. Zero now means the
 * calmest installation, not a flat array of front-facing rectangles. */
export function everywhereCabinetArticulation(angle:number):number {
  return .65+.35*Math.max(0,Math.min(1.25,Number.isFinite(angle)?angle:.84))
}

export function buildEverywhereCabinetLayout(): EverywhereCabinet[] {
  const rad=Math.PI/180
  return INSTALLATION.map(([x,y,z,scale,pitch,yaw,roll,style],index)=>({
    x,y,z,scale,pitch:pitch*rad,yaw:yaw*rad,roll:roll*rad,style,
    width:1,height:1,depth:1,seed:index===0?.34:((index*0.61803398875+.17)%1),
  }))
}

/** Eye-only static broadcast differences. The existing musical eye poses stay
 * authoritative, including their synchronized drops, blinks and motion freeze. */
export function everywhereEyeFraming(item: EverywhereCabinet,index: number): readonly [number,number,number,number] {
  if(index===0) return [1,0,0,0]
  const s=item.seed
  const closeup = index < 10 || index%3===0
  return [closeup ? 1.01+.17*s : 1.0+.04*s,
    Math.sin(index*2.39)*.055,Math.cos(index*1.73)*.055,
    closeup ? .012*s : .24+.13*s]
}

export function everywhereScreenGain(item: Readonly<EverywhereCabinet>, index: number, look: Readonly<EverywhereLook>): number {
  const phase = look.phase
  const gaussian = (distance: number, width: number) => Math.exp(-((distance / width) ** 2))
  const { x,y,radius } = everywhereSpatialPosition(item)
  const front = (phase*.58)%1
  const coverage = Math.min(1,look.coverage + look.energy*.12 - look.vocal*.10)
  let gain = index===0 ? 1 : .77+item.seed*.23
  if (look.pattern === 'signal-sweep') gain = .22+.79*gaussian(x-(front*30-15),2.2)
  if (look.pattern === 'outward-pulse') gain = .24+.80*gaussian(radius-front*16,1.5)
  if (look.pattern === 'cross-cut') gain = .24+.76*gaussian(y-x*Math.cos(phase)*.66,1.04)
  if (look.pattern === 'channel-hold') gain = ((Math.floor((x+30)/3.4)+Math.floor((y+12)/2.4)+Math.floor(phase*.68))%3===0) ? 1 : .24
  if (look.pattern === 'ghost-feed') gain = .33+.61*(.5+.5*Math.sin(phase*2.15+item.seed*9.4))**2
  if (look.pattern === 'static-switch') gain = .66 + .30 * (1 + Math.sin(item.seed*17 + phase*2))*.5
  if (look.pattern === 'retro-broadcast') gain = .62 + .38*gaussian(y, 2.8)
  if (look.pattern === 'tape-tracking') gain = .42 + .55*gaussian(y - Math.sin(phase*.7)*3, 2.1)
  if (look.pattern === 'channel-mosaic') gain = .58 + .40*(.5+.5*Math.sin(index*2.4+Math.floor(phase*.5)))
  if (look.pattern === 'signal-relay') gain = .28 + .72*gaussian(radius-(1-front)*16, 2.0)
  if (look.pattern === 'midnight-replay') gain = .46 + .52*gaussian(radius, 3.0) + .10*Math.sin(phase*.5+item.seed*5)
  if (item.seed>coverage && index>0) gain*=.27
  const focus = .66 + .34 * Math.exp(-radius*.24)
  gain *= 1 - look.build*(1-focus)*1.5
  gain += look.kick*(index<5 ? .18 : .065) + look.bass*.11*focus
  gain += look.drop*.43*gaussian(radius-(1-look.drop)*7.2,2.5)
  return Math.min(1.5,Math.max(index===0 ? .48+look.vocal*.18 : .06,gain))
}

type Merge = typeof import('three/examples/jsm/utils/BufferGeometryUtils.js')['mergeGeometries']

export class Cinema2EverywhereWall {
  private readonly group: Three.Group
  private readonly sets = buildEverywhereCabinetLayout()
  private readonly cabinetBatches: { mesh: Three.InstancedMesh; indices: number[]; spill: Three.InstancedBufferAttribute; neighbor: Three.InstancedBufferAttribute }[] = []
  private readonly neighbors: {index:number; side:number; weight:number}[][]
  private readonly powers: Float32Array
  private readonly incident: Float32Array
  private readonly screen: Three.InstancedMesh
  private readonly screenMaterial: Three.ShaderMaterial
  private readonly caseMaterial: Three.MeshStandardMaterial
  private readonly woodMaterial: Three.MeshStandardMaterial
  private readonly woodTint: Three.Color
  private readonly coolLight: Three.DirectionalLight
  private readonly warmLight: Three.DirectionalLight
  private readonly eyeTexture: Three.Texture
  private readonly mediaTexture: Three.Texture
  private readonly poolTextures: readonly Three.Texture[]
  private poolMedia: readonly (Readonly<Cinema2ManagedMediaResource> | null)[] = []
  private readonly placement: Three.Object3D
  private readonly lightNormal: Three.Vector3
  private readonly screenMatrix: Three.Matrix4
  private readonly screenLocals: Three.Matrix4[]
  private readonly backing: Three.Mesh<Three.BufferGeometry,Three.MeshBasicMaterial>
  private readonly spillLights: { light: Three.PointLight; index: number }[] = []
  private readonly spillCool: { value: Three.Color }
  private readonly spillWarm: { value: Three.Color }
  private readonly gains: Three.InstancedBufferAttribute
  private readonly eyePoses: Three.InstancedBufferAttribute
  private readonly mediaPoses: Three.InstancedBufferAttribute
  private readonly mediaEffects: Three.InstancedBufferAttribute
  private renderer: Three.WebGLRenderer | null = null
  private media: Readonly<Cinema2ManagedMediaResource> | null = null
  private eye: WebGLTexture | null = null
  private lastAngle = NaN
  readonly count: number

  constructor(private readonly library: Cinema2ThreeLibrary, merge: Merge, root: Three.Object3D) {
    const { THREE } = library
    this.group = new THREE.Group()
    root.add(this.group)
    this.count = this.sets.length
    this.powers=new Float32Array(this.count)
    this.incident=new Float32Array(this.count*4)
    // Local indirect screen light is evaluated from the real physical neighbors.
    // This costs at most six scalar contributions per cabinet, not a light per TV.
    this.neighbors=this.sets.map((item,index)=>{
      const yaw=item.yaw*everywhereCabinetArticulation(.84)
      return this.sets.flatMap((other,j)=>{
        if(j===index)return []
        const dx=other.x-item.x,dy=other.y-item.y,dz=other.z-item.z
        const x=dx*Math.cos(yaw)-dz*Math.sin(yaw)
        const radius=Math.hypot(dx,dy,dz*.85)
        const range=(item.scale+other.scale)*2.5
        if(radius>range)return []
        const side=Math.abs(x)>Math.abs(dy) ? (x<0?0:1) : (dy>0?2:3)
        const weight=Math.min(.65,other.scale*other.scale/Math.max(.9,radius*radius)*2.5)*Math.exp(-Math.max(0,-dz)*.17)
        return [{index:j,side,weight}]
      }).sort((a,b)=>b.weight-a.weight).slice(0,6)
    })
    this.placement = new THREE.Object3D()
    this.lightNormal = new THREE.Vector3()
    this.screenMatrix = new THREE.Matrix4()
    this.screenLocals = EVERYWHERE_CABINET_STYLES.map(style=>new THREE.Matrix4().makeTranslation(style.screenX,style.screenY,style.screenZ)
      .scale(new THREE.Vector3(style.screenW,style.screenH,style.glassDepth)))
    this.spillCool={value:new THREE.Color()}; this.spillWarm={value:new THREE.Color()}
    this.caseMaterial = new THREE.MeshStandardMaterial({roughness:.47,metalness:.26})
    this.woodTint=new THREE.Color(0x24170f)
    this.woodMaterial=new THREE.MeshStandardMaterial({color:0x24170f,roughness:.64,metalness:.03})
    const materials={
      shell:this.caseMaterial,
      wood:this.woodMaterial,
      bezel:new THREE.MeshStandardMaterial({color:0x111317,roughness:.43,metalness:.32}),
      recess:new THREE.MeshStandardMaterial({color:0x050607,roughness:.38,metalness:.2}),
      metal:new THREE.MeshStandardMaterial({color:0x433a31,roughness:.28,metalness:.78}),
      dark:new THREE.MeshStandardMaterial({color:0x090a0a,roughness:.83,metalness:.02}),
    }
    // Real standard materials, augmented with screen-dependent indirect
    // irradiance, cavity attenuation and directional edge reflections. Front
    // plates are deliberately dark: only narrow bevels catch strong light.
    for(const [finish,material] of Object.entries(materials)) {
      const isWood=finish==='wood', isMetal=finish==='metal', isDark=finish==='dark'||finish==='recess'
      material.onBeforeCompile=shader=>{
        shader.uniforms.uCrtCool=this.spillCool; shader.uniforms.uCrtWarm=this.spillWarm
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
          attribute float aCrtSpill;
          attribute vec4 aCrtNeighbor;
          varying float vCrtSpill;
          varying vec4 vCrtNeighbor;
          varying vec3 vCrtLocal;
          varying vec3 vCrtLocalNormal;
          varying vec3 vCrtWorldNormal;
          varying vec3 vCrtWorld;`)
          .replace('#include <begin_vertex>',`#include <begin_vertex>
          vCrtSpill=aCrtSpill; vCrtNeighbor=aCrtNeighbor;
          vCrtLocal=position; vCrtLocalNormal=normal;
          vCrtWorldNormal=mat3(modelMatrix)*mat3(instanceMatrix)*normal;
          vCrtWorld=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;`)
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          uniform vec3 uCrtCool; uniform vec3 uCrtWarm;
          varying float vCrtSpill; varying vec4 vCrtNeighbor;
          varying vec3 vCrtLocal; varying vec3 vCrtLocalNormal;
          varying vec3 vCrtWorldNormal; varying vec3 vCrtWorld;
          float crtHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }`)
          .replace('#include <color_fragment>',`#include <color_fragment>
          vec3 localN=normalize(vCrtLocalNormal);
          vec3 worldN=normalize(vCrtWorldNormal);
          vec3 crtViewDir=normalize(cameraPosition-vCrtWorld);
          float frontFacing=smoothstep(.45,.98,localN.z);
          float bevel=smoothstep(.12,.42,abs(localN.z))*smoothstep(.12,.42,length(localN.xy));
          vec3 cells=vCrtLocal*vec3(120.0,200.0,145.0);
          float detail=crtHash(floor(cells));
          float filterWidth=max(length(dFdx(cells)),length(dFdy(cells)));
          float wear=(detail-.5)*(1.0-smoothstep(.4,1.6,filterWidth));
          float scratches=step(.94,crtHash(floor(vCrtLocal*vec3(11.0,310.0,43.0))))*(1.0-smoothstep(.6,2.0,filterWidth));
          float patina=crtHash(floor(vCrtLocal*vec3(13.0,19.0,17.0)));
          float grain=${isWood?'sin(vCrtLocal.y*175.0+sin(vCrtLocal.z*13.0)*2.8+sin(vCrtLocal.y*35.0)*.7)*.13':'0.0'};
          diffuseColor.rgb*=1.0+wear*.48+grain+(patina-.5)*.16;
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*2.0+vec3(.014,.007,.003),scratches*.35);`)
          .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(roughnessFactor+wear*.28+patina*.11-scratches*.15,.16,1.0);`)
          .replace('#include <aomap_fragment>',`#include <aomap_fragment>
          // Front plane fill is much darker than side/top panels. The cavity
          // attenuation prevents the recessed black bezel reading as silver.
          float cavity=mix(1.0,${isDark?'.17':isMetal?'.42':'.33'},frontFacing);
          reflectedLight.directDiffuse*=cavity;
          reflectedLight.indirectDiffuse*=cavity*.64;
          reflectedLight.indirectSpecular*=mix(.68,.27,frontFacing);
          reflectedLight.directSpecular*=mix(1.0,.36,frontFacing);`)
          .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float nearLip=exp(-abs(vCrtLocal.z-.145)*13.0);
          float nearFront=exp(-abs(vCrtLocal.z-.10)*2.8);
          vec3 bounce=mix(uCrtCool,uCrtWarm,smoothstep(-.72,.72,vCrtLocal.x+vCrtLocal.y*.25));
          float directional=max(0.0,-localN.x)*vCrtNeighbor.x+max(0.0,localN.x)*vCrtNeighbor.y
            +max(0.0,localN.y)*vCrtNeighbor.z+max(0.0,-localN.y)*vCrtNeighbor.w;
          vec3 warmHalf=normalize(normalize(vec3(.70,.76,.24))+crtViewDir);
          vec3 coolHalf=normalize(normalize(vec3(-.89,.31,.14))+crtViewDir);
          float warmEdge=pow(max(0.0,dot(worldN,warmHalf)),24.0);
          float coolEdge=pow(max(0.0,dot(worldN,coolHalf)),22.0);
          float powered=.19+.81*min(1.5,vCrtSpill);
          vec3 edgeLight=(uCrtWarm*warmEdge*1.4+uCrtCool*coolEdge*.74)*bevel*nearFront*powered;
          vec3 sideBounce=(uCrtCool*(vCrtNeighbor.x*.68+vCrtNeighbor.z*.19)+uCrtWarm*(vCrtNeighbor.y*.73+vCrtNeighbor.w*.24));
          totalEmissiveRadiance+=bounce*nearLip*bevel*vCrtSpill*${isDark?'.025':'.14'}
            +sideBounce*min(1.0,directional)*nearFront*${isDark?'.008':'.105'}
            +edgeLight*${isDark?'.05':isMetal?'1.0':'.53'};`)
      }
      material.customProgramCacheKey=()=> `everywhere-cinematic-cabinet-v3-${finish}`
    }
    for(const [style,spec] of EVERYWHERE_CABINET_STYLES.entries()) {
      const indices=this.sets.flatMap((item,index)=>item.style===style?[index]:[])
      for(const {geometry,material} of buildEverywhereCabinetParts(THREE,merge,spec)) {
        const spill=new THREE.InstancedBufferAttribute(new Float32Array(indices.length),1).setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('aCrtSpill',spill)
        const neighbor=new THREE.InstancedBufferAttribute(new Float32Array(indices.length*4),4).setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('aCrtNeighbor',neighbor)
        const mesh=new THREE.InstancedMesh(geometry,materials[material],indices.length)
        mesh.frustumCulled=false
        indices.forEach((index,slot)=>{
          const seed=this.sets[index]!.seed
          const shade=.72+seed*.28
          mesh.setColorAt(slot,new THREE.Color().setRGB(shade,shade,shade))
        })
        if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
        this.cabinetBatches.push({mesh,indices,spill,neighbor}); this.group.add(mesh)
      }
    }

    const { THREE: T } = library
    // Actual convex glass, with a curved image shader on top. The outer edges
    // stay at the original aperture depth, so the bezel still occludes them.
    const plane = new T.PlaneGeometry(1,1,20,16)
    const glassVertices=plane.getAttribute('position')
    for(let i=0;i<glassVertices.count;i++) {
      const x=glassVertices.getX(i)*2,y=glassVertices.getY(i)*2
      glassVertices.setZ(i,(1-x*x)*(1-y*y))
    }
    glassVertices.needsUpdate=true; plane.computeVertexNormals()
    const data = new Float32Array(this.count*4)
    this.sets.forEach((item,index)=>data.set([1,item.seed,EVERYWHERE_CABINET_STYLES[item.style]!.screenW*item.width/(EVERYWHERE_CABINET_STYLES[item.style]!.screenH*item.height),index===0 ? 1 : 0],index*4))
    this.gains = new T.InstancedBufferAttribute(data,4)
    plane.setAttribute('aProgram',this.gains)
    this.eyePoses = new T.InstancedBufferAttribute(new Float32Array(this.count*4),4)
    plane.setAttribute('aEyePose',this.eyePoses)
    const framing=new Float32Array(this.count*4)
    this.sets.forEach((item,index)=>framing.set(everywhereEyeFraming(item,index),index*4))
    plane.setAttribute('aEyeFraming',new T.InstancedBufferAttribute(framing,4))
    this.mediaPoses = new T.InstancedBufferAttribute(new Float32Array(this.count*4),4).setUsage(T.DynamicDrawUsage)
    this.mediaEffects = new T.InstancedBufferAttribute(new Float32Array(this.count*4),4).setUsage(T.DynamicDrawUsage)
    plane.setAttribute('aMediaPose',this.mediaPoses)
    plane.setAttribute('aMediaEffects',this.mediaEffects)
    this.eyeTexture = new T.Texture()
    this.mediaTexture = new T.Texture()
    this.poolTextures = Array.from({length:3},()=>new T.Texture())
    this.screenMaterial = new T.ShaderMaterial({
      vertexShader:EVERYWHERE_SCREEN_VERTEX,fragmentShader:EVERYWHERE_SCREEN_FRAGMENT,
      toneMapped:false,transparent:true,depthWrite:true,
      uniforms:{
        uEye:{value:this.eyeTexture},uMedia:{value:this.mediaTexture},uHasEye:{value:0},uHasMedia:{value:0},uSourceMode:{value:0},
        uPool0:{value:this.poolTextures[0]},uPool1:{value:this.poolTextures[1]},uPool2:{value:this.poolTextures[2]},
        uPoolAspect:{value:new T.Vector3()},uProgram:{value:new T.Vector4()},uMusic:{value:new T.Vector4()},
        uWallExtent:{value:new T.Vector2(30,15)},uLayout:{value:0},uMediaAspect:{value:1},uMediaFit:{value:1},uMediaOpacity:{value:1},uMediaRotation:{value:0},
        uMediaTransform:{value:new T.Vector4(.5,.5,1,1)},uLook:{value:new T.Vector4()},
        uReaction:{value:new T.Vector2()},uTint:{value:new T.Color()},uCool:{value:new T.Color()},uWarm:{value:new T.Color()},
      },
    })
    this.screen = new T.InstancedMesh(plane,this.screenMaterial,this.count)
    this.screen.frustumCulled = false
    this.screen.onBeforeRender = renderer => {
      this.renderer = renderer
      this.borrow(renderer,this.eyeTexture,this.eye)
      this.borrow(renderer,this.mediaTexture,this.media?.texture ?? null)
      this.poolTextures.forEach((texture,index)=>this.borrow(renderer,texture,this.poolMedia[index]?.texture ?? null))
    }
    this.group.add(this.screen)
    // Recessed architectural envelope, behind every cabinet. Its curvature
    // remains physical at every aspect; the dark surface only reads in gaps.
    const backingGeometry=new T.PlaneGeometry(76,32,24,1)
    const back=backingGeometry.getAttribute('position')
    for(let i=0;i<back.count;i++) back.setZ(i,-15+2.0*(back.getX(i)/38)**2)
    back.needsUpdate=true; backingGeometry.computeVertexNormals()
    this.backing=new T.Mesh(backingGeometry,new T.MeshBasicMaterial({color:0x090b0d}))
    this.group.add(this.backing)
    // Directional grazing light reveals sidewalls without flattening the wall.
    this.coolLight = new T.DirectionalLight(0xffffff,2.15)
    this.coolLight.position.set(-16,6,2.4)
    this.warmLight = new T.DirectionalLight(0xffffff,2.65)
    this.warmLight.position.set(9,13,1.5)
    this.group.add(this.coolLight,this.warmLight,new T.HemisphereLight(0x536a73,0x160d08,.018))
    // A small fixed light budget adds actual short-range inter-cabinet spill.
    // No shadow maps or per-TV lights (which would scale with cabinet count).
    for(const index of [0,1,2,3,4,5]) {
      const light=new T.PointLight(0xffffff,0,5.4,2)
      this.spillLights.push({light,index}); this.group.add(light)
    }
    this.place(.84)
  }

  apply(look: Readonly<EverywhereLook>, eye: WebGLTexture | null, media: Readonly<Cinema2ManagedMediaResource> | null, poolMedia: readonly (Readonly<Cinema2ManagedMediaResource> | null)[] = [], poolStep = 0, aspectRatio = 16/9, sourceMode: 'eyes'|'single'|'pool' = poolMedia.some(Boolean) ? 'pool' : media ? 'single' : 'eyes') {
    const { THREE } = this.library
    const uniforms = this.screenMaterial.uniforms
    this.eye = eye
    media = sourceMode==='single' ? media : null
    poolMedia = sourceMode==='pool' ? poolMedia : []
    this.media = media
    this.poolMedia = poolMedia
    const aspect = (i: number) => { const feed = poolMedia[i]; return feed ? feed.width / Math.max(1,feed.height) : 0 }
    uniforms.uPoolAspect!.value.set(aspect(0),aspect(1),aspect(2))
    uniforms.uProgram!.value.set(Math.max(0,EVERYWHERE_PATTERNS.findIndex(p=>p.value===look.pattern)-5),poolStep,look.kick,look.snare)
    uniforms.uMusic!.value.set(look.bass,look.high,look.build,look.drop)
    const cover = everywhereWallCoverScale(aspectRatio)
    uniforms.uWallExtent!.value.set(30*Math.max(1,(Number.isFinite(aspectRatio)?aspectRatio:16/9)/2),15)
    // Reposition the installation laterally for wide outputs; never scale the
    // meshes or cancel their natural perspective.
    this.group.scale.set(1,1,1)
    this.place(look.angle,cover)
    const animateEyes = sourceMode==='eyes'
    this.sets.forEach((item,index)=>{
      this.gains.setX(index,everywhereScreenGain(item,index,look))
      const pose=animateEyes ? everywhereEyePose(item,index,look) : [0,0,0,0] as const
      this.eyePoses.setXYZW(index,...pose)
      const content=everywhereMediaPose(item,index,look)
      this.mediaPoses.setXYZW(index,content.scale,content.x,content.y,content.rotation)
      this.mediaEffects.setXYZW(index,content.power,content.channel,content.distortion,content.stretch)
    })
    this.gains.needsUpdate=true
    this.eyePoses.needsUpdate=true
    this.mediaPoses.needsUpdate=true
    this.mediaEffects.needsUpdate=true
    this.group.rotation.z = 0
    this.group.position.z = 0
    const setColor = (color: Three.Color, rgba: Cinema2Color) => color.setRGB(rgba[0],rgba[1],rgba[2],THREE.SRGBColorSpace)
    setColor(this.caseMaterial.color,look.colors.cabinet)
    setColor(this.backing.material.color,look.colors.background)
    this.caseMaterial.color.multiplyScalar(.63)
    this.woodMaterial.color.copy(this.caseMaterial.color).multiplyScalar(1.25).lerp(this.woodTint,.60)
    setColor(this.spillCool.value,look.colors.cool)
    setColor(this.spillWarm.value,look.colors.warm)
    const mediaReady=Boolean(media||poolMedia.some(Boolean))
    const powerAt=(index:number)=>Math.min(2.1,this.gains.getX(index)*look.brightness*(animateEyes ? (eye?1:0) : (mediaReady?this.mediaEffects.getX(index):0)))
    this.sets.forEach((_,index)=>{this.powers[index]=powerAt(index)})
    this.incident.fill(0)
    this.neighbors.forEach((neighbors,index)=>{
      for(const {index:source,side,weight} of neighbors) {
        const offset=index*4+side
        this.incident[offset]=Math.min(1.4,this.incident[offset]!+this.powers[source]!*weight)
      }
    })
    for(const {indices,spill,neighbor} of this.cabinetBatches) {
      indices.forEach((index,slot)=>{
        spill.setX(slot,this.powers[index]!)
        const o=index*4
        neighbor.setXYZW(slot,this.incident[o]!,this.incident[o+1]!,this.incident[o+2]!,this.incident[o+3]!)
      })
      spill.needsUpdate=true; neighbor.needsUpdate=true
    }
    for(const {light,index} of this.spillLights) {
      const item=this.sets[index]!
      light.color.copy(this.spillCool.value).lerp(this.spillWarm.value,index%2?.72:.28)
      light.intensity=this.powers[index]!*(index===0?22:13)
      this.screen.getMatrixAt(index,this.screenMatrix)
      light.position.setFromMatrixPosition(this.screenMatrix)
      light.position.addScaledVector(this.lightNormal.set(0,0,1).transformDirection(this.screenMatrix),.43*item.scale)
    }
    setColor(this.coolLight.color,look.colors.cool)
    setColor(this.warmLight.color,look.colors.warm)
    setColor(uniforms.uCool!.value,look.colors.cool)
    setColor(uniforms.uWarm!.value,look.colors.warm)
    setColor(uniforms.uTint!.value,look.colors.screen)
    uniforms.uLook!.value.set(look.phase,look.brightness,look.scan,look.glare)
    uniforms.uReaction!.value.set(look.bass+look.kick,(look.high+look.snare*.55)*(1-look.vocal*.7))
    uniforms.uHasEye!.value=eye && animateEyes ? 1 : 0
    uniforms.uSourceMode!.value=sourceMode==='eyes' ? 0 : sourceMode==='single' ? 1 : 2
    uniforms.uHasMedia!.value=media ? 1 : 0
    uniforms.uLayout!.value=look.layout==='wall' ? 1 : look.layout==='choreographed' ? 2 : 0
    uniforms.uMediaFit!.value=look.mediaFit==='cover' ? 1 : look.mediaFit==='stretch' ? 2 : 0
    if (media) {
      uniforms.uMediaAspect!.value=media.width/Math.max(1,media.height)
      if (!look.mediaFit) uniforms.uMediaFit!.value=media.presentation.fit==='contain' ? 0 : media.presentation.fit==='cover' ? 1 : 2
      uniforms.uMediaOpacity!.value=media.presentation.opacity
      uniforms.uMediaTransform!.value.set(...media.presentation.position,...media.presentation.scale)
      uniforms.uMediaRotation!.value=media.presentation.rotation*Math.PI/180
    }
  }

  private lastCover = NaN
  private place(angle: number,cover=1) {
    if (angle===this.lastAngle && cover===this.lastCover) return
    this.lastAngle=angle; this.lastCover=cover
    const matrices=this.sets.map((item,index)=>{
      const object=this.placement
      // Preserve the central composition; spread only the outer wings on
      // ultra-wide output instead of stretching the physical cabinet meshes.
      object.position.set(item.x+(cover-1)*Math.sign(item.x)*Math.max(0,Math.abs(item.x)-3),item.y,item.z)
      object.scale.set(item.scale*item.width,item.scale*item.height,item.scale*item.depth)
      const articulation=everywhereCabinetArticulation(angle)
      object.rotation.set(item.pitch*articulation,item.yaw*articulation,item.roll*articulation)
      object.updateMatrix()
      this.screen.setMatrixAt(index,this.screenMatrix.multiplyMatrices(object.matrix,this.screenLocals[item.style]!))
      return object.matrix.clone()
    })
    for(const {mesh,indices} of this.cabinetBatches) {
      indices.forEach((index,slot)=>mesh.setMatrixAt(slot,matrices[index]!))
      mesh.instanceMatrix.needsUpdate=true
    }
    this.screen.instanceMatrix.needsUpdate=true
  }

  private borrow(renderer: Three.WebGLRenderer, texture: Three.Texture, handle: WebGLTexture | null) {
    const properties=renderer.properties.get(texture) as { __webglTexture?: WebGLTexture; __version?: number }
    if (handle) { properties.__webglTexture=handle; properties.__version=texture.version }
    else { delete properties.__webglTexture; delete properties.__version }
  }

  dispose() {
    const materials=new Set<Three.Material>([this.screenMaterial])
    for (const mesh of [...this.cabinetBatches.map(batch=>batch.mesh),this.screen]) {
      mesh.geometry.dispose()
      mesh.dispose()
      if (!Array.isArray(mesh.material)) materials.add(mesh.material)
    }
    materials.forEach(material=>material.dispose())
    for (const texture of [this.mediaTexture,this.eyeTexture,...this.poolTextures]) {
      this.renderer?.properties.remove(texture)
      texture.dispose()
    }
    this.backing.geometry.dispose()
    this.backing.material.dispose()
    this.coolLight.dispose()
    this.warmLight.dispose()
    this.spillLights.forEach(({light})=>light.dispose())
    this.group.removeFromParent()
  }
}
