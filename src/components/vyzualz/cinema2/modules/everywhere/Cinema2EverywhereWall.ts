import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { everywhereEyePose } from './Cinema2EverywhereEyeMotion'
import { EVERYWHERE_SCREEN_FRAGMENT, EVERYWHERE_SCREEN_VERTEX } from './Cinema2EverywhereScreens'

export const EVERYWHERE_COLORS = {
  background: [.012,.018,.023,1],
  cabinet: [.20,.24,.255,1],
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
  layout: 'repeat' | 'wall'
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
}
// Five reference silhouettes, then irregular medium cabinets, then a continuous
// rear mosaic. All coordinates are in world space; the camera never sees a wall edge.
const MAIN: readonly EverywhereCabinet[] = [
  {x:0,y:-.08,z:1.12,scale:3.05,roll:-.035,yaw:0,seed:.34},
  {x:-4.68,y:2.42,z:.58,scale:1.98,roll:-.37,yaw:.13,seed:.22},
  {x:4.75,y:2.38,z:.48,scale:1.99,roll:.35,yaw:-.15,seed:.78},
  {x:-4.96,y:-2.70,z:.64,scale:1.83,roll:-.39,yaw:.18,seed:.41},
  {x:4.97,y:-2.60,z:.55,scale:1.87,roll:.36,yaw:-.17,seed:.84},
]
const MID: readonly (readonly [number,number,number,number,number,number])[] = [
  // x, y, depth, size, roll, yaw. Fill pockets rather than repeat a flat grid.
  [-6.9,3.2,-.60,.91,-.20,.21],[-2.83,3.55,-.53,.90,-.22,.08],
  [-.95,3.48,-.48,.84,-.10,.03],[.88,3.65,-.76,.83,.13,-.04],
  [2.65,3.49,-.38,.97,.19,-.12],[6.92,3.2,-.67,.88,.23,-.24],
  [-6.8,.83,-.56,.92,-.21,.22],[-3.54,.65,-.75,.79,.21,.09],
  [3.61,.70,-.46,.91,-.16,-.11],[6.77,.67,-.69,.98,.25,-.23],
  [-6.52,-.94,-.55,.96,.18,.23],[-3.62,-.77,-.43,.83,.16,.13],
  [3.72,-.72,-.57,.87,-.18,-.15],[6.61,-.87,-.49,.91,-.13,-.23],
  [-2.93,-3.26,-.33,.99,-.18,.10],[-1.06,-3.64,-.62,.85,.17,.03],
  [.97,-3.22,-.36,1.04,-.14,-.05],[2.89,-3.52,-.55,.91,.21,-.12],
  [-7.10,-3.58,-.75,.87,-.18,.23],[7.16,-3.55,-.76,.92,.17,-.22],
]
export const EVERYWHERE_REAR_SCALE = .96
export const EVERYWHERE_REAR_DEPTH = -2.25
export const EVERYWHERE_WIDE_ASPECT = 1.9

/** Cover, not contain: keep vertical framing on narrow previews; on unusually
 * wide outputs enlarge both transverse axes equally, preserving screen shape.
 * Depth is left alone, so even extreme widths cannot push the hero into the lens. */
export function everywhereWallCoverScale(aspect: number): number {
  return Math.max(1, (Number.isFinite(aspect) ? aspect : EVERYWHERE_WIDE_ASPECT) / EVERYWHERE_WIDE_ASPECT)
}

export function buildEverywhereCabinetLayout(): EverywhereCabinet[] {
  const sets = MAIN.map(item=>({...item}))
  const random = (i: number) => { const n=Math.sin(i*127.1+17.7)*43758.5453; return n-Math.floor(n) }
  MID.forEach(([x,y,z,scale,roll,yaw],index)=>sets.push({x,y,z,scale,roll,yaw,seed:random(index+150)}))
  // Constant overlapping pitch at the rear: the narrowest cabinet footprint
  // exceeds both pitches, including bevel corners and perspective safety margin.
  // No random holes, even behind the hero: those become visible during cropping.
  for (let row=0;row<9;row++) {
    for (let column=0;column<13;column++) {
      const i=row*13+column
      sets.push({x:(column-6)*1.65+(row%2 ? .41 : -.41),y:(row-4)*1.23,
        z:EVERYWHERE_REAR_DEPTH+(i%2)*.045,scale:EVERYWHERE_REAR_SCALE,roll:0,yaw:0,seed:random(i)})
    }
  }
  return sets
}

function roundedPath(path: Three.Path, x: number, y: number, w: number, h: number, r: number) {
  const x1=x+w, y1=y+h
  path.moveTo(x+r,y); path.lineTo(x1-r,y); path.quadraticCurveTo(x1,y,x1,y+r)
  path.lineTo(x1,y1-r); path.quadraticCurveTo(x1,y1,x1-r,y1)
  path.lineTo(x+r,y1); path.quadraticCurveTo(x,y1,x,y1-r)
  path.lineTo(x,y+r); path.quadraticCurveTo(x,y,x+r,y); path.closePath()
}

export function everywhereScreenGain(item: Readonly<EverywhereCabinet>, index: number, look: Readonly<EverywhereLook>): number {
  const phase = look.phase
  const gaussian = (distance: number, width: number) => Math.exp(-((distance / width) ** 2))
  const radius = Math.hypot(item.x,item.y*.87)
  const front = (phase*.58)%1
  const coverage = Math.min(1,look.coverage + look.energy*.12 - look.vocal*.10)
  let gain = .71+item.seed*.28
  if (look.pattern === 'signal-sweep') gain = .22+.79*gaussian(item.x-(front*13-6.5),2.2)
  if (look.pattern === 'outward-pulse') gain = .24+.80*gaussian(radius-front*7.7,1.5)
  if (look.pattern === 'cross-cut') gain = .24+.76*gaussian(item.y-item.x*Math.cos(phase)*.66,1.04)
  if (look.pattern === 'channel-hold') gain = ((index+(Math.floor(phase*.68)))%3===0) ? 1 : .24
  if (look.pattern === 'ghost-feed') gain = .33+.61*(.5+.5*Math.sin(phase*2.15+item.seed*9.4))**2
  if (look.pattern === 'static-switch') gain = .66 + .30 * (1 + Math.sin(item.seed*17 + phase*2))*.5
  if (look.pattern === 'retro-broadcast') gain = .62 + .38*gaussian(item.y, 2.8)
  if (look.pattern === 'tape-tracking') gain = .42 + .55*gaussian(item.y - Math.sin(phase*.7)*3, 2.1)
  if (look.pattern === 'channel-mosaic') gain = .58 + .40*(.5+.5*Math.sin(index*2.4+Math.floor(phase*.5)))
  if (look.pattern === 'signal-relay') gain = .38 + .62*gaussian(radius-(front*7.5), 2.0)
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
  private readonly instances: Three.InstancedMesh[] = []
  private readonly screen: Three.InstancedMesh
  private readonly screenMaterial: Three.ShaderMaterial
  private readonly caseMaterial: Three.MeshStandardMaterial
  private readonly trimMaterial: Three.MeshStandardMaterial
  private readonly coolLight: Three.DirectionalLight
  private readonly warmLight: Three.DirectionalLight
  private readonly eyeTexture: Three.Texture
  private readonly mediaTexture: Three.Texture
  private readonly poolTextures: readonly Three.Texture[]
  private poolMedia: readonly (Readonly<Cinema2ManagedMediaResource> | null)[] = []
  private readonly placement: Three.Object3D
  private readonly screenMatrix: Three.Matrix4
  private readonly screenLocal: Three.Matrix4
  private readonly gains: Three.InstancedBufferAttribute
  private readonly eyePoses: Three.InstancedBufferAttribute
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
    this.screenMatrix = new THREE.Matrix4()
    this.screenLocal = new THREE.Matrix4().makeTranslation(-.036,.035,.205)
      .scale(new THREE.Vector3(1.692,1.186,1))
    const extrusion = (w: number,h: number,r: number,depth: number,bevel: number, aperture = false) => {
      const shape = new THREE.Shape()
      roundedPath(shape,-w/2,-h/2,w,h,r)
      if (aperture) {
        const hole = new THREE.Path()
        roundedPath(hole,-.903,-.577,1.736,1.224,.156)
        shape.holes.push(hole)
      }
      return new THREE.ExtrudeGeometry(shape,{curveSegments:5,depth,steps:1,bevelEnabled:true,bevelSegments:3,bevelThickness:bevel,bevelSize:bevel})
    }
    this.caseMaterial = new THREE.MeshStandardMaterial({ roughness:.37, metalness:.42 })
    const lip = new THREE.MeshStandardMaterial({ color:0x34434a, roughness:.26, metalness:.48 })
    const recess = new THREE.MeshStandardMaterial({ color:0x070a0a, roughness:.60, metalness:.1 })
    this.trimMaterial = new THREE.MeshStandardMaterial({ color:0xb29c7e, roughness:.28, metalness:.60 })
    const add = (geometry: Three.BufferGeometry, material: Three.Material) => {
      const mesh = new THREE.InstancedMesh(geometry,material,this.count)
      mesh.frustumCulled = false
      this.instances.push(mesh)
      this.group.add(mesh)
    }
    add(extrusion(1.99,1.464,.159,.61,.045).translate(0,0,-.64),this.caseMaterial)
    add(extrusion(1.98,1.45,.153,.129,.033,true).translate(0,0,.016),lip)
    add(extrusion(1.898,1.344,.152,.046,.015,true).translate(0,.026,.144),recess)
    const hardware: Three.BufferGeometry[] = []
    for (const [x,y,r] of [[.906,.325,.055],[.906,.155,.051],[-.68,-.651,.034],[-.55,-.651,.031],[-.42,-.651,.03]] as const) {
      hardware.push(new THREE.CylinderGeometry(r*.83,r,.047,12).rotateX(Math.PI/2).translate(x,y,.192))
    }
    hardware.push(new THREE.BoxGeometry(.24,.025,.024).translate(.51,-.655,.18))
    const blueSteel = merge(hardware)!
    hardware.forEach(geometry=>geometry.dispose())
    add(blueSteel,this.trimMaterial)
    const vents = Array.from({length:9},(_, row)=>new THREE.BoxGeometry(.088,.016,.012).translate(.916,-.025-row*.047,.179))
    const grille = merge(vents)!
    vents.forEach(geometry=>geometry.dispose())
    add(grille,recess)

    const { THREE: T } = library
    const plane = new T.PlaneGeometry(1,1)
    const data = new Float32Array(this.count*4)
    this.sets.forEach((item,index)=>data.set([1,item.seed,1.692/1.186,index===0 ? 1 : 0],index*4))
    this.gains = new T.InstancedBufferAttribute(data,4)
    plane.setAttribute('aProgram',this.gains)
    this.eyePoses = new T.InstancedBufferAttribute(new Float32Array(this.count*4),4)
    plane.setAttribute('aEyePose',this.eyePoses)
    this.eyeTexture = new T.Texture()
    this.mediaTexture = new T.Texture()
    this.poolTextures = Array.from({length:3},()=>new T.Texture())
    this.screenMaterial = new T.ShaderMaterial({
      vertexShader:EVERYWHERE_SCREEN_VERTEX,fragmentShader:EVERYWHERE_SCREEN_FRAGMENT,
      toneMapped:false,transparent:true,depthWrite:true,
      uniforms:{
        uEye:{value:this.eyeTexture},uMedia:{value:this.mediaTexture},uHasEye:{value:0},uHasMedia:{value:0},
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
    this.coolLight = new T.DirectionalLight(0xffffff,3.1)
    this.coolLight.position.set(-5,4,3.5)
    this.warmLight = new T.DirectionalLight(0xffffff,3.1)
    this.warmLight.position.set(6,1.7,1.65)
    this.group.add(this.coolLight,this.warmLight,new T.HemisphereLight(0xc5d4da,0x100b0c,.37))
    this.place(.84)
  }

  apply(look: Readonly<EverywhereLook>, eye: WebGLTexture | null, media: Readonly<Cinema2ManagedMediaResource> | null, poolMedia: readonly (Readonly<Cinema2ManagedMediaResource> | null)[] = [], poolStep = 0, aspectRatio = 16/9) {
    const { THREE } = this.library
    const uniforms = this.screenMaterial.uniforms
    this.eye = eye
    this.media = media
    this.poolMedia = poolMedia
    const aspect = (i: number) => { const feed = poolMedia[i]; return feed ? feed.width / Math.max(1,feed.height) : 0 }
    uniforms.uPoolAspect!.value.set(aspect(0),aspect(1),aspect(2))
    uniforms.uProgram!.value.set(Math.max(0,EVERYWHERE_PATTERNS.findIndex(p=>p.value===look.pattern)-5),poolStep,look.kick,look.snare)
    uniforms.uMusic!.value.set(look.bass,look.high,look.build,look.drop)
    this.place(look.angle)
    const cover = everywhereWallCoverScale(aspectRatio)
    this.group.scale.set(cover,cover,1)
    const animateEyes = !media && !poolMedia.some(Boolean)
    this.sets.forEach((item,index)=>{
      this.gains.setX(index,everywhereScreenGain(item,index,look))
      const pose=animateEyes ? everywhereEyePose(item,index,look) : [0,0,0,0] as const
      this.eyePoses.setXYZW(index,...pose)
    })
    this.gains.needsUpdate=true
    this.eyePoses.needsUpdate=true
    this.group.rotation.z = .010 * Math.sin(look.phase*.42) * look.motion
    this.group.position.z = .18 * look.build + .24 * look.drop
    const setColor = (color: Three.Color, rgba: Cinema2Color) => color.setRGB(rgba[0],rgba[1],rgba[2],THREE.SRGBColorSpace)
    setColor(this.caseMaterial.color,look.colors.cabinet)
    setColor(this.coolLight.color,look.colors.cool)
    setColor(this.warmLight.color,look.colors.warm)
    setColor(uniforms.uCool!.value,look.colors.cool)
    setColor(uniforms.uWarm!.value,look.colors.warm)
    setColor(uniforms.uTint!.value,look.colors.screen)
    uniforms.uLook!.value.set(look.phase,look.brightness,look.scan,look.glare)
    uniforms.uReaction!.value.set(look.bass+look.kick,(look.high+look.snare*.55)*(1-look.vocal*.7))
    uniforms.uHasEye!.value=eye ? 1 : 0
    uniforms.uHasMedia!.value=media ? 1 : 0
    uniforms.uLayout!.value=look.layout==='wall' ? 1 : 0
    if (media) {
      uniforms.uMediaAspect!.value=media.width/Math.max(1,media.height)
      uniforms.uMediaFit!.value=media.presentation.fit==='contain' ? 0 : media.presentation.fit==='cover' ? 1 : 2
      uniforms.uMediaOpacity!.value=media.presentation.opacity
      uniforms.uMediaTransform!.value.set(...media.presentation.position,...media.presentation.scale)
      uniforms.uMediaRotation!.value=media.presentation.rotation*Math.PI/180
    }
  }

  private place(angle: number) {
    if (angle===this.lastAngle) return
    this.lastAngle=angle
    this.sets.forEach((item,index)=>{
      const object=this.placement
      object.position.set(item.x,item.y,item.z)
      object.scale.setScalar(item.scale)
      object.rotation.set(item.z <= EVERYWHERE_REAR_DEPTH+.05 ? 0 : (item.seed-.5)*.12*angle,item.yaw*angle,item.roll*angle)
      object.updateMatrix()
      for (const mesh of this.instances) mesh.setMatrixAt(index,object.matrix)
      this.screen.setMatrixAt(index,this.screenMatrix.multiplyMatrices(object.matrix,this.screenLocal))
    })
    for (const mesh of [...this.instances,this.screen]) mesh.instanceMatrix.needsUpdate=true
  }

  private borrow(renderer: Three.WebGLRenderer, texture: Three.Texture, handle: WebGLTexture | null) {
    const properties=renderer.properties.get(texture) as { __webglTexture?: WebGLTexture; __version?: number }
    if (handle) { properties.__webglTexture=handle; properties.__version=texture.version }
    else { delete properties.__webglTexture; delete properties.__version }
  }

  dispose() {
    const materials=new Set<Three.Material>([this.screenMaterial])
    for (const mesh of [...this.instances,this.screen]) {
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
    this.group.removeFromParent()
  }
}
