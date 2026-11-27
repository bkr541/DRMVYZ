import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { everywhereMediaPose } from './Cinema2EverywhereMediaMotion'
import { everywhereEyePose } from './Cinema2EverywhereEyeMotion'
import { EVERYWHERE_CABINET_STYLES, buildEverywhereCabinetParts } from './Cinema2EverywhereCabinets'
import { EVERYWHERE_SCREEN_FRAGMENT, EVERYWHERE_SCREEN_VERTEX } from './Cinema2EverywhereScreens'

export const EVERYWHERE_COLORS = {
  background: [.012,.018,.023,1],
  cabinet: [.095,.10,.105,1],
  cool: [.19,.92,1,1],
  warm: [1,.51,.22,1],
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

// World-space staging, in physical scene units (not camera-plane coordinates).
// [x,y,z, size, pitch,yaw,roll (degrees), cabinet family]. The positions and
// sizes are independent; perspective is left entirely to the shared camera.
// The hero, asymmetric satellites, edge wings and distant pockets deliberately
// do not share a row/column generator. Order keeps the hero at channel index 0.
const INSTALLATION = [
  [0.000,-0.120,2.050,2.65,0,-3,-2,0],
  [-5.163,1.508,0.685,1.53,8,5,-16,1],
  [4.777,2.170,-0.652,1.65,13,-48,17,2],
  [-4.476,-2.337,-0.112,1.36,-12,7,10,3],
  [4.954,-1.528,-0.135,1.39,-7,-43,-12,1],
  [-2.657,4.141,-0.553,1.27,21,16,13,3],
  [0.624,3.507,-1.699,1.4,23,-9,-12,1],
  [4.067,5.100,-2.802,1.14,26,-24,23,0],
  [-1.360,-4.394,-0.325,1.35,-20,11,-9,2],
  [1.783,-4.026,-1.640,1.44,-19,-18,16,3],
  [-5.927,4.629,-1.786,1.33,22,32,-20,2],
  [6.812,3.766,-2.628,1.12,19,-27,-9,3],
  [-6.597,-4.743,-2.446,1.36,-18,32,17,1],
  [5.452,-4.489,-1.260,1.28,-24,-29,-15,0],
  // Near wings: turned cabinet sidewalls, some intentional edge cropping.
  [-7.717,0.147,4.048,1.67,5,10,-11,2],
  [7.705,0.583,4.068,1.82,-8,-15,14,1],
  [-6.757,4.054,3.625,1.43,24,18,21,0],
  [6.670,-3.896,3.270,1.5,-28,-15,-20,3],
  [-5.692,-4.650,2.823,1.57,-26,8,-14,0],
  [6.597,5.211,2.778,1.55,27,-15,12,2],
  [-2.615,5.412,2.993,1.56,38,12,-17,1],
  [2.400,-5.500,2.500,1.7,-32,-15,20,2],
  // Distant pockets visible through the foreground, not a complete rear wall.
  [-2.100,2.050,-5.400,0.94,-10,-14,8,2],
  [2.000,2.250,-5.100,0.86,13,22,-19,3],
  [-0.350,5.850,-4.800,1.2,-18,9,12,0],
  [-3.500,-4.850,-5.800,1.22,15,-13,-21,3],
  [0.700,-5.900,-5.200,1.08,20,16,9,1],
  [3.350,-2.200,-6.200,0.97,-8,-17,19,2],
  [-5.700,0.100,-5.700,1.04,6,18,12,0],
  [6.800,1.000,-6.400,1.24,-7,-12,-22,2],
  [-8.716,2.322,-3.585,1.46,12,25,17,3],
  [8.439,-2.227,-3.765,1.45,-11,-32,-17,0],
  [-10.490,-1.882,-3.170,1.85,-16,43,-11,1],
  [10.567,2.795,-1.810,1.62,18,-37,16,2],
  [-9.678,6.129,-2.920,1.6,23,29,-17,0],
  [9.861,-6.173,-2.435,1.72,-27,-30,20,3],
  [-4.700,7.500,-4.100,1.51,31,21,18,2],
  [5.088,7.844,-3.992,1.53,29,-26,-14,1],
  [-5.129,-7.632,-3.160,1.58,-31,19,12,0],
  [5.000,-7.800,-4.100,1.67,-28,-18,-13,1],
  // Lateral extensions for exploratory camera offsets and ultrawide outputs.
  [-12.532,2.720,-1.750,1.8,-6,45,-18,2],
  [12.955,-0.478,-2.082,1.9,7,-49,15,1],
  [-13.223,-5.905,-3.693,1.9,-20,38,13,3],
  [13.230,5.188,-3.990,1.8,20,-40,-16,0],
  [-15.600,4.100,-4.253,2.1,17,48,-12,1],
  [15.748,-4.405,-4.419,2.0,-15,-47,17,2],
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
  return [1.02+.34*s,Math.sin(index*2.39)*.075,Math.cos(index*1.73)*.065,(index%5===0?.31:index%4===0?.13:0)]
}

export function everywhereScreenGain(item: Readonly<EverywhereCabinet>, index: number, look: Readonly<EverywhereLook>): number {
  const phase = look.phase
  const gaussian = (distance: number, width: number) => Math.exp(-((distance / width) ** 2))
  const radius = Math.hypot(item.x,item.y*.87)
  const front = (phase*.58)%1
  const coverage = Math.min(1,look.coverage + look.energy*.12 - look.vocal*.10)
  let gain = .71+item.seed*.28
  if (look.pattern === 'signal-sweep') gain = .22+.79*gaussian(item.x-(front*25-12.5),2.2)
  if (look.pattern === 'outward-pulse') gain = .24+.80*gaussian(radius-front*14,1.5)
  if (look.pattern === 'cross-cut') gain = .24+.76*gaussian(item.y-item.x*Math.cos(phase)*.66,1.04)
  if (look.pattern === 'channel-hold') gain = ((index+(Math.floor(phase*.68)))%3===0) ? 1 : .24
  if (look.pattern === 'ghost-feed') gain = .33+.61*(.5+.5*Math.sin(phase*2.15+item.seed*9.4))**2
  if (look.pattern === 'static-switch') gain = .66 + .30 * (1 + Math.sin(item.seed*17 + phase*2))*.5
  if (look.pattern === 'retro-broadcast') gain = .62 + .38*gaussian(item.y, 2.8)
  if (look.pattern === 'tape-tracking') gain = .42 + .55*gaussian(item.y - Math.sin(phase*.7)*3, 2.1)
  if (look.pattern === 'channel-mosaic') gain = .58 + .40*(.5+.5*Math.sin(index*2.4+Math.floor(phase*.5)))
  if (look.pattern === 'signal-relay') gain = .38 + .62*gaussian(radius-(front*14), 2.0)
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
    this.caseMaterial = new THREE.MeshStandardMaterial({roughness:.76,metalness:.13})
    this.woodTint=new THREE.Color(0x32241c)
    this.woodMaterial=new THREE.MeshStandardMaterial({color:0x32241c,roughness:.81,metalness:.04})
    const materials={
      shell:this.caseMaterial,
      wood:this.woodMaterial,
      bezel:new THREE.MeshStandardMaterial({color:0x151719,roughness:.52,metalness:.24}),
      recess:new THREE.MeshStandardMaterial({color:0x060708,roughness:.38,metalness:.2}),
      metal:new THREE.MeshStandardMaterial({color:0x777065,roughness:.36,metalness:.62}),
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
          varying float vCrtSpill; varying vec3 vCrtLocal;`)
          .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          float face=exp(-abs(vCrtLocal.z-.22)*5.0);
          float edge=pow(clamp(1.0-abs(vCrtLocal.y)*.55,0.0,1.0),2.0);
          vec3 bounce=mix(uCrtCool,uCrtWarm,smoothstep(-.8,.8,vCrtLocal.x));
          totalEmissiveRadiance+=bounce*diffuseColor.rgb*face*edge*vCrtSpill*.8;`)
      }
      material.customProgramCacheKey=()=> 'everywhere-cabinet-bounce-v1'
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
          const shade=.65+seed*.35
          mesh.setColorAt(slot,new THREE.Color().setRGB(shade,shade,shade))
        })
        if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true
        this.cabinetBatches.push({mesh,indices,spill}); this.group.add(mesh)
      }
    }

    const { THREE: T } = library
    // Actual convex glass, with a curved image shader on top. The outer edges
    // stay at the original aperture depth, so the bezel still occludes them.
    const plane = new T.PlaneGeometry(1,1,12,10)
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
        uLayout:{value:0},uMediaAspect:{value:1},uMediaFit:{value:1},uMediaOpacity:{value:1},uMediaRotation:{value:0},
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
    this.coolLight = new T.DirectionalLight(0xffffff,.95)
    this.coolLight.position.set(-9,5,-1.5)
    this.warmLight = new T.DirectionalLight(0xffffff,.82)
    this.warmLight.position.set(9,-1,1)
    this.group.add(this.coolLight,this.warmLight,new T.HemisphereLight(0x9bb9c5,0x160d08,.035))
    // A small fixed light budget adds actual short-range inter-cabinet spill.
    // No shadow maps or per-TV lights (which would scale with cabinet count).
    for(const index of [0,1,2,3,4,5]) {
      const light=new T.PointLight(0xffffff,0,4.2,2)
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
      light.intensity=powerAt(index)*(index===0?3.4:1.75)
      this.screen.getMatrixAt(index,this.screenMatrix)
      light.position.setFromMatrixPosition(this.screenMatrix)
      light.position.addScaledVector(this.lightNormal.set(0,0,1).transformDirection(this.screenMatrix),.22*item.scale)
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
    this.coolLight.dispose()
    this.warmLight.dispose()
    this.spillLights.forEach(({light})=>light.dispose())
    this.group.removeFromParent()
  }
}
