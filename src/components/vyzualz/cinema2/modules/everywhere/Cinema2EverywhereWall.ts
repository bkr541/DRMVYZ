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
  background: [.012,.018,.023,1],
  cabinet: [.13,.135,.14,1],
  cool: [.12,.79,.86,1],
  warm: [1,.57,.30,1],
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

// Reference-led physical staging, in world units. Hero and the next 17
// silhouettes follow the dominant sets in the approved composition. Smaller
// sets fill projected openings at deeper levels; the final wings extend past
// the 16:9 frame for wide outputs. Positions are baked, never recomputed from
// the active camera. OBB clearance was checked at sampled Cabinet Angle values.
// [x,y,z,scale,pitch,yaw,roll (degrees),family]. Index zero is the hero feed.
const INSTALLATION = [
  [-0.082,-0.092,1.4,2.53,0,-2,0,0],
  // Major surrounding sets and reference-led satellites.
  [-4.826,1.469,2.2,1.219,5,18,-12,1],
  [5.14,2.035,2.0,1.246,-4,-23,12,1],
  [-5.518,-2.066,2.6,1.366,-5,15,-13,1],
  [6.191,-0.402,2.5,1.207,1,-18,12,1],
  [6.013,-3.524,0.491,1.73,-4.215,-18.187,9.933,3],
  [-2.525,4.035,0.008,1.465,7.312,9.592,-10.574,3],
  [-1.723,-4.1,1.2,1.091,-6,10,-7,1],
  [3.53,4.561,-1.628,1.462,8.248,-11.44,7.41,3],
  [-6.917,4.554,0.4,1.307,8,15,-9,3],
  [-5.969,5.17,-3.51,0.989,4.036,7.068,-10.861,1],
  [0.344,4.021,-0.861,0.755,1.639,1.641,-2.997,0],
  [0.809,3.983,-2.77,0.789,2.737,-7.362,3.651,1],
  [-6.174,3.427,-2.967,0.778,3.704,11.302,-5.505,3],
  [4.242,0.738,-0.7,0.736,-3,-8,5,0],
  [-4.309,-2.49,-1.0,0.599,-3,10,-5,1],
  [-0.66,-3.44,-1.0,0.714,-5,0,2,0],
  [1.03,-3.419,-1.3,0.716,-3,-5,6,3],
  // Smaller recessed sets fill the interstitial silhouettes.
  [6.039,-1.705,-4.011,1.167,0.052,-1.845,6.804,2],
  [-12.253,2.636,-5.188,1.749,1.72,4.598,-0.42,2],
  [-7.523,-0.037,-6.025,1.183,-0.908,1.094,-3.057,1],
  [9.468,4.446,-1.905,1.274,1.035,-17.526,-9.385,2],
  [-9.736,-0.399,-2.058,1.072,-3.3,11.997,2.221,3],
  [2.361,-6.83,-5.751,1.538,-6.674,2.003,-3.269,2],
  [7.533,5.319,-4.392,1.236,5.477,-12.363,-5.853,3],
  [-6.14,-5.326,-3.745,1.601,-0.616,10.236,8.271,2],
  [5.244,-6.042,-5.723,0.725,-9.849,-0.689,11.744,1],
  [-11.76,-7.819,-7.866,1.443,-6.5,11.971,8.64,2],
  [4.832,-3.842,-4.226,0.754,-4.024,-3.421,-7.616,1],
  [10.754,-3.451,-4.32,1.273,-4.869,-12.662,0.763,2],
  [13.77,1.9,-7.37,1.054,-3.33,-18.928,-10.245,2],
  [1.774,7.548,-7.976,1.177,8.847,6.091,-3.416,2],
  [-12.433,5.796,-4.378,1.076,6.659,6.295,0.696,3],
  [5.202,2.924,-7.44,0.878,2.892,-4.188,-5.932,0],
  [-4.96,-1.143,-3.538,0.952,0.618,10.449,9.055,2],
  [0.001,-6.001,-3.859,0.735,-3.917,7.354,-5.397,0],
  [-1.274,5.336,-4.058,1.001,5.632,5.513,-1.395,2],
  [-4.499,1.258,-3.917,0.881,4.205,6.12,11.296,2],
  [3.925,-5.195,-8.375,0.786,-3.712,-9.866,-2.567,1],
  [6.553,-0.425,-7.775,1.317,-2.595,-13.023,-2.632,2],
  // Lateral and edge extensions.
  [-18.153,-3.753,-1.71,1.867,-4.01,13.841,-6.789,3],
  [14.502,-4.325,-1.061,1.779,-6.751,-12.933,6.713,0],
  [-16.511,4.06,-1.445,2.175,5.592,15.687,6.127,2],
  [-13.117,-0.071,-1.432,1.775,4.227,17.835,-5.772,0],
  [21.736,-3.034,-5.751,1.713,2.462,-15.519,-0.299,1],
  [19.928,4.798,-3.6,2.062,4.216,-15.877,0.8,2],
  [15.287,-0.103,-1.441,1.608,-4.753,-14.818,-6.713,3],
  [-11.442,-3.908,-0.709,1.269,-3.031,9.194,-3.319,1],
  [-24.344,-0.13,-6.2,2.117,3.905,28.447,8.452,2],
  [16.596,5.924,-6.843,1.556,1.485,-9.884,-10.946,3],
  [26.299,1.908,-6.929,1.278,2.687,-23.906,-11.121,2],
  [16.437,2.096,-6.586,1.183,-1.243,-15.765,-3.328,2],
  [-18.95,5.26,-8.438,1.673,8.633,8.626,7.482,2],
  [16.372,-1.887,-8.752,1.49,-0.6,-16.382,3.461,1],
  [26.268,-6.483,-7.025,1.625,-8.148,-28.179,8.143,2],
  [14.885,-5.791,-7.312,1.183,-7.582,-6.928,5.809,1],
  // Perimeter continuation at the farthest authored camera distance.
  [30.281,-3.244,-6.94,1.825,-4.305,-15.931,-5.74,2],
  [-30.363,-5.694,-6.789,1.643,-5.434,16.05,-1.842,0],
  [10.429,-5.924,-1.334,1.142,0.571,-13.077,4.59,2],
  [-28.823,7.076,-6.871,2.036,9.823,24.823,-9.617,2],
  [25.303,6.398,-4.344,1.215,10.186,-19.688,-4.739,0],
  [23.437,0.968,-1.775,1.692,1.368,-26.511,-5.487,2],
  [-16.631,-7.771,-6.914,1.855,-1.053,5.661,10.132,2],
  [-23.876,0.852,-1.944,1.595,-2.856,20.704,5.047,2],
  [-2.159,6.906,-1.945,0.998,5.036,-5.215,-10.527,0],
  [-12.445,-2.178,-6.566,1.788,-7.232,2.458,4.889,3],
  [12.777,9.04,-8.668,1.317,7.208,-15.349,-6.286,0],
  [-14.849,8.728,-8.201,1.464,10.736,14.196,-11.864,2],
  [4.327,-6.716,-1.864,0.872,-7.143,-1.056,6.074,3],
  [-22.53,-2.173,-1.938,1.054,1.355,21.322,-5.945,1],
  [6.798,6.414,-1.366,1.191,10.916,1.003,10.335,2],
  [8.735,-7.69,-4.124,1.144,-3.778,-6.428,10.689,0],
  [12.421,3.348,-4.184,1.694,-0.386,-9.448,0.448,2],
  [31.282,4.64,-8.452,1.794,-2.935,-26.632,-2.452,0],
  [-22.453,-8.347,-6.278,1.546,-1.989,12.269,-3.388,3],
  [-6.168,7.728,-6.507,1.649,8.793,4.07,6.719,2],
  [22.946,-5.82,-1.571,1.1,-1.99,-23.057,-8.451,2],
] as const

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
  const closeup = index < 11 || index%3===0
  return [closeup ? 1.04+.25*s : 1.0+.07*s,
    Math.sin(index*2.39)*.055,Math.cos(index*1.73)*.055,
    closeup ? .015*s : .22+.28*s]
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
  private readonly cabinetBatches: { mesh: Three.InstancedMesh; indices: number[]; spill: Three.InstancedBufferAttribute }[] = []
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
    this.placement = new THREE.Object3D()
    this.lightNormal = new THREE.Vector3()
    this.screenMatrix = new THREE.Matrix4()
    this.screenLocals = EVERYWHERE_CABINET_STYLES.map(style=>new THREE.Matrix4().makeTranslation(style.screenX,style.screenY,style.screenZ)
      .scale(new THREE.Vector3(style.screenW,style.screenH,style.glassDepth)))
    this.spillCool={value:new THREE.Color()}; this.spillWarm={value:new THREE.Color()}
    this.caseMaterial = new THREE.MeshStandardMaterial({roughness:.57,metalness:.17})
    this.woodTint=new THREE.Color(0x493025)
    this.woodMaterial=new THREE.MeshStandardMaterial({color:0x493025,roughness:.71,metalness:.03})
    const materials={
      shell:this.caseMaterial,
      wood:this.woodMaterial,
      bezel:new THREE.MeshStandardMaterial({color:0x242526,roughness:.46,metalness:.32}),
      recess:new THREE.MeshStandardMaterial({color:0x060708,roughness:.38,metalness:.2}),
      metal:new THREE.MeshStandardMaterial({color:0x94867a,roughness:.34,metalness:.57}),
      dark:new THREE.MeshStandardMaterial({color:0x090a0a,roughness:.83,metalness:.02}),
    }
    // Screen bounce on its own physical bezel and cabinet. Each instance uses
    // the exact same power/exposure envelope as its picture. This is bounded
    // local irradiance, not a global emissive outline or a second render pass.
    for(const material of Object.values(materials)) {
      material.onBeforeCompile=shader=>{
        shader.uniforms.uCrtCool=this.spillCool; shader.uniforms.uCrtWarm=this.spillWarm
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
          attribute float aCrtSpill;
          varying float vCrtSpill;
          varying vec3 vCrtLocal;`)
          .replace('#include <begin_vertex>',`#include <begin_vertex>
          vCrtSpill=aCrtSpill; vCrtLocal=position;`)
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          uniform vec3 uCrtCool; uniform vec3 uCrtWarm;
          varying float vCrtSpill; varying vec3 vCrtLocal;
          float crtHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }`)
          .replace('#include <color_fragment>',`#include <color_fragment>
          // Fine cabinet wear, filtered at distance. No per-set texture allocation.
          vec3 cells=vCrtLocal*vec3(125.0,210.0,135.0);
          float detail=crtHash(floor(cells));
          float filterWidth=max(length(dFdx(cells)),length(dFdy(cells)));
          float wear=(detail-.5)*(1.0-smoothstep(.45,1.6,filterWidth));
          diffuseColor.rgb*=1.0+wear*.24;`)
          .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(roughnessFactor+wear*.18,.18,1.0);`)
          .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float face=exp(-abs(vCrtLocal.z-.20)*5.5);
          float lip=exp(-abs(vCrtLocal.z-.145)*13.0);
          vec3 bounce=mix(uCrtCool,uCrtWarm,smoothstep(-.70,.70,vCrtLocal.x+vCrtLocal.y*.30));
          totalEmissiveRadiance+=bounce*sqrt(max(diffuseColor.rgb,vec3(0.0)))*(face*.12+lip*.23)*vCrtSpill;`)
      }
      material.customProgramCacheKey=()=> 'everywhere-cabinet-bounce-v2'
    }
    for(const [style,spec] of EVERYWHERE_CABINET_STYLES.entries()) {
      const indices=this.sets.flatMap((item,index)=>item.style===style?[index]:[])
      for(const {geometry,material} of buildEverywhereCabinetParts(THREE,merge,spec)) {
        const spill=new THREE.InstancedBufferAttribute(new Float32Array(indices.length),1).setUsage(THREE.DynamicDrawUsage)
        geometry.setAttribute('aCrtSpill',spill)
        const mesh=new THREE.InstancedMesh(geometry,materials[material],indices.length)
        mesh.frustumCulled=false
        indices.forEach((index,slot)=>{
          const seed=this.sets[index]!.seed
          const shade=.72+seed*.28
          mesh.setColorAt(slot,new THREE.Color().setRGB(shade,shade,shade))
        })
        if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
        this.cabinetBatches.push({mesh,indices,spill}); this.group.add(mesh)
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
    this.coolLight = new T.DirectionalLight(0xffffff,1.35)
    this.coolLight.position.set(-12,7,5)
    this.warmLight = new T.DirectionalLight(0xffffff,1.65)
    this.warmLight.position.set(10,5,3)
    this.group.add(this.coolLight,this.warmLight,new T.HemisphereLight(0x9bb9c5,0x160d08,.045))
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
    this.woodMaterial.color.copy(this.caseMaterial.color).multiplyScalar(1.6).lerp(this.woodTint,.55)
    setColor(this.spillCool.value,look.colors.cool)
    setColor(this.spillWarm.value,look.colors.warm)
    const mediaReady=Boolean(media||poolMedia.some(Boolean))
    const powerAt=(index:number)=>Math.min(2.1,this.gains.getX(index)*look.brightness*(animateEyes ? (eye?1:0) : (mediaReady?this.mediaEffects.getX(index):0)))
    for(const {indices,spill} of this.cabinetBatches) {
      indices.forEach((index,slot)=>spill.setX(slot,powerAt(index)))
      spill.needsUpdate=true
    }
    for(const {light,index} of this.spillLights) {
      const item=this.sets[index]!
      light.color.copy(this.spillCool.value).lerp(this.spillWarm.value,index%2?.72:.28)
      light.intensity=powerAt(index)*(index===0?18:9)
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
      object.rotation.set(item.pitch*angle,item.yaw*angle,item.roll*angle)
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
