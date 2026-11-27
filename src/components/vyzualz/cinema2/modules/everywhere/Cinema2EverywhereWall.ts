import type * as Three from 'three'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { everywhereMediaPose } from './Cinema2EverywhereMediaMotion'
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
  pitch: number; width: number; height: number; depth: number; style: 0 | 1 | 2
}
export const EVERYWHERE_WIDE_ASPECT = 1.9
const REFERENCE_CAMERA_Z = 14
const random = (i: number) => { const n=Math.sin(i*127.1+17.7)*43758.5453; return n-Math.floor(n) }

/** Keep the vertical composition on narrow outputs; expand the physical wall
 * uniformly in X/Y for ultra-wide output, without moving cabinets toward the lens. */
export function everywhereWallCoverScale(aspect: number): number {
  return Math.max(1, (Number.isFinite(aspect) ? aspect : EVERYWHERE_WIDE_ASPECT) / EVERYWHERE_WIDE_ASPECT)
}

/** One sculptural CRT installation, not a foreground collage over a tiled wall.
 * Slots are authored on the reference camera plane, then unprojected onto a
 * shallow concave shell. This keeps distant TVs from shrinking into wallpaper
 * while allowing genuine sidewalls, gaps, occlusion and camera parallax. */
export function buildEverywhereCabinetLayout(): EverywhereCabinet[] {
  const sets: EverywhereCabinet[] = [
    {x:0,y:-.08,z:1.12,scale:2.65,roll:-.025,yaw:0,pitch:0,seed:.34,width:1.06,height:1,depth:1.20,style:0},
  ]
  // Distinct silhouettes: wide living-room set, square portable, deep console.
  const proportions = [[1.06,.97,1.12],[.91,1.06,.83],[1.00,1.02,1.36]] as const
  // Each band has its own size, vertical stagger and independently spaced sides.
  // The two middle bands leave the hero's entire silhouette free.
  const bands = [
    {y:1.30,start:3.42,size:1.28}, {y:-1.35,start:3.42,size:1.23},
    {y:3.82,start:0,size:1.30}, {y:-3.92,start:0,size:1.28},
    {y:6.45,start:0,size:1.37}, {y:-6.55,start:0,size:1.36},
    {y:9.18,start:0,size:1.38}, {y:-9.25,start:0,size:1.38},
  ] as const
  const add = (px: number,py: number,projectedScale: number,seed: number,style: 0|1|2,roll: number) => {
    const [width,height,depth]=proportions[style]
    // Side banks and upper/lower edges wrap toward the viewer. The central
    // neighbours sit behind the hero, but never form a second overlapping wall.
    const z=-1.28+Math.min(2.85,Math.abs(px)**1.65*.038+Math.abs(py)*.075)+(seed-.5)*.68
    const perspective=(REFERENCE_CAMERA_Z-z)/REFERENCE_CAMERA_Z
    sets.push({x:px*perspective,y:py*perspective,z,scale:projectedScale*perspective,
      roll,yaw:-Math.atan2(px,REFERENCE_CAMERA_Z)*.73+(seed-.5)*.15,
      pitch:Math.atan2(py,REFERENCE_CAMERA_Z)*.43+(seed-.5)*.16,
      seed,width,height,depth:depth*(.91+seed*.18),style})
  }
  bands.forEach((band,row)=>{
    // Alternate a central cabinet with an off-centre seam; avoid a mirrored grid.
    let centerHalf=0
    if (band.start===0 && row%2===0) {
      const style=(row%3) as 0|1|2
      const size=band.size*(.95+random(row+88)*.12)
      const px=(random(row+15)-.5)*.45
      add(px,band.y,size,random(row+96),style,(random(row+400)-.5)*.26)
      centerHalf=size*proportions[style][0]*1.10+Math.abs(px)+.20
    }
    for (const side of [-1,1]) {
      let edge=band.start || centerHalf || .12
      let col=0
      while (edge<17.8) {
        const i=100+row*80+(side===1?40:0)+col*3
        const seed=random(i), style=Math.floor(random(i+1)*3) as 0|1|2
        const size=band.size*(.80+random(i+2)*.40)
        const roll=(random(i+2000)-.5)*.56
        // Reserve the silhouette including tilt and a deliberate dark seam.
        const half=size*(1.05*proportions[style][0]*Math.cos(roll)+.80*proportions[style][1]*Math.abs(Math.sin(roll)))
        const px=side*(edge+half), py=band.y+(random(i+3000)-.5)*.68
        add(px,py,size,seed,style,roll)
        edge+=half*2+.16+random(i+4000)*.15
        col++
      }
    }
  })
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
  private readonly instances: Three.InstancedMesh[] = []
  private readonly hardwareBatches: { mesh: Three.InstancedMesh; indices: number[] }[] = []
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
    this.caseMaterial = new THREE.MeshStandardMaterial({ roughness:.62, metalness:.19 })
    const lip = new THREE.MeshStandardMaterial({ color:0x555657, roughness:.42, metalness:.36 })
    const recess = new THREE.MeshStandardMaterial({ color:0x070a0a, roughness:.60, metalness:.1 })
    this.trimMaterial = new THREE.MeshStandardMaterial({ color:0x938578, roughness:.44, metalness:.55 })
    const add = (geometry: Three.BufferGeometry, material: Three.Material, shade?: (item: EverywhereCabinet)=>Three.Color) => {
      const mesh = new THREE.InstancedMesh(geometry,material,this.count)
      mesh.frustumCulled = false
      if (shade) {
        this.sets.forEach((item,index)=>mesh.setColorAt(index,shade(item)))
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate=true
      }
      this.instances.push(mesh)
      this.group.add(mesh)
    }
    const finish = (item: EverywhereCabinet) => {
      const c = item.style===0 ? [ .81,.83,.86 ] : item.style===1 ? [.57,.60,.63] : [.91,.76,.61]
      const value=.77+item.seed*.23
      return new THREE.Color().setRGB(c[0]!*value,c[1]!*value,c[2]!*value)
    }
    // Real CRT backs taper toward the tube neck instead of reading as flat slabs.
    const body=extrusion(1.99,1.464,.159,.83,.045).translate(0,0,-.86)
    const bodyVertices=body.getAttribute('position')
    for(let i=0;i<bodyVertices.count;i++) {
      const z=bodyVertices.getZ(i), t=THREE.MathUtils.smoothstep(z,-.90,-.03)
      bodyVertices.setXY(i,bodyVertices.getX(i)*(.76+.24*t),bodyVertices.getY(i)*(.79+.21*t))
    }
    bodyVertices.needsUpdate=true; body.computeVertexNormals()
    add(body,this.caseMaterial,finish)
    add(extrusion(1.98,1.45,.153,.129,.033,true).translate(0,0,.016),lip,finish)
    add(extrusion(1.898,1.344,.152,.046,.015,true).translate(0,.026,.144),recess)
    // Three physical control-panel designs, batched by style. All keep the same
    // screen aperture and share one screen program/material and one media feed.
    for(const style of [0,1,2] as const) {
      const hardware: Three.BufferGeometry[] = []
      const controls = style===0 ? [[.906,.325,.055],[.906,.155,.051],[-.68,-.651,.034],[-.55,-.651,.031],[-.42,-.651,.03]]
        : style===1 ? [[.91,.34,.044],[.91,.22,.038],[.91,.10,.026],[-.64,-.65,.022]]
        : [[.91,.30,.066],[.91,.10,.058],[-.64,-.65,.025],[-.50,-.65,.025]]
      for (const [x,y,r] of controls) hardware.push(new THREE.CylinderGeometry(r!*.83,r!,.047,12).rotateX(Math.PI/2).translate(x!,y!,.192))
      hardware.push(new THREE.BoxGeometry(style===1?.36:.24,.025,.024).translate(.51,-.655,.18))
      for(let row=0;row<(style===1?5:8);row++) hardware.push(new THREE.BoxGeometry(.066,.012,.014).translate(.916,-.035-row*.046,.177))
      const geometry=merge(hardware)!
      hardware.forEach(part=>part.dispose())
      const indices=this.sets.flatMap((item,index)=>item.style===style?[index]:[])
      const mesh=new THREE.InstancedMesh(geometry,this.trimMaterial,indices.length)
      mesh.frustumCulled=false
      indices.forEach((index,slot)=>mesh.setColorAt(slot,finish(this.sets[index]!)))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate=true
      this.hardwareBatches.push({mesh,indices}); this.group.add(mesh)
    }

    const { THREE: T } = library
    // Actual convex glass, with a curved image shader on top. The outer edges
    // stay at the original aperture depth, so the bezel still occludes them.
    const plane = new T.PlaneGeometry(1,1,12,10)
    const glassVertices=plane.getAttribute('position')
    for(let i=0;i<glassVertices.count;i++) {
      const x=glassVertices.getX(i)*2,y=glassVertices.getY(i)*2
      glassVertices.setZ(i,.052*(1-x*x)*(1-y*y))
    }
    glassVertices.needsUpdate=true; plane.computeVertexNormals()
    const data = new Float32Array(this.count*4)
    this.sets.forEach((item,index)=>data.set([1,item.seed,1.692*item.width/(1.186*item.height),index===0 ? 1 : 0],index*4))
    this.gains = new T.InstancedBufferAttribute(data,4)
    plane.setAttribute('aProgram',this.gains)
    this.eyePoses = new T.InstancedBufferAttribute(new Float32Array(this.count*4),4)
    plane.setAttribute('aEyePose',this.eyePoses)
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
    this.coolLight = new T.DirectionalLight(0xffffff,1.35)
    this.coolLight.position.set(-7,4,2.2)
    this.warmLight = new T.DirectionalLight(0xffffff,1.15)
    this.warmLight.position.set(7,2.3,1.0)
    this.group.add(this.coolLight,this.warmLight,new T.HemisphereLight(0xc5d4da,0x100b0c,.20))
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
    this.place(look.angle)
    const cover = everywhereWallCoverScale(aspectRatio)
    this.group.scale.set(cover,cover,1)
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

  private place(angle: number) {
    if (angle===this.lastAngle) return
    this.lastAngle=angle
    this.sets.forEach((item,index)=>{
      const object=this.placement
      object.position.set(item.x,item.y,item.z)
      object.scale.set(item.scale*item.width,item.scale*item.height,item.scale*item.depth)
      object.rotation.set(item.pitch*angle,item.yaw*angle,item.roll*angle)
      object.updateMatrix()
      for (const mesh of this.instances) mesh.setMatrixAt(index,object.matrix)
      this.screen.setMatrixAt(index,this.screenMatrix.multiplyMatrices(object.matrix,this.screenLocal))
    })
    for (const {mesh,indices} of this.hardwareBatches) {
      indices.forEach((index,slot)=>{ this.instances[0]!.getMatrixAt(index,this.screenMatrix); mesh.setMatrixAt(slot,this.screenMatrix) })
      mesh.instanceMatrix.needsUpdate=true
    }
    for (const mesh of [...this.instances,this.screen]) mesh.instanceMatrix.needsUpdate=true
  }

  private borrow(renderer: Three.WebGLRenderer, texture: Three.Texture, handle: WebGLTexture | null) {
    const properties=renderer.properties.get(texture) as { __webglTexture?: WebGLTexture; __version?: number }
    if (handle) { properties.__webglTexture=handle; properties.__version=texture.version }
    else { delete properties.__webglTexture; delete properties.__version }
  }

  dispose() {
    const materials=new Set<Three.Material>([this.screenMaterial])
    for (const mesh of [...this.instances,...this.hardwareBatches.map(batch=>batch.mesh),this.screen]) {
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
