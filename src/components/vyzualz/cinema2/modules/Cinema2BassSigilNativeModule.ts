import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import type * as THREE from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { BASS_SIGIL_PALETTE, BASS_SIGIL_PATTERN_IDS, deformBassSigilPoint, type BassSigilPattern } from './bassSigil/Cinema2BassSigilMotion'

export const CINEMA2_BASS_SIGIL_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('bass-sigil-native')
const ROLE: Record<string, keyof typeof BASS_SIGIL_PALETTE | 'backing' | 'glow'> = {
  textBlack: 'wordmark', edge: 'edge', textRed: 'core', sphere: 'membrane', dots: 'particles', material: 'backing', bgShine: 'backing', glowBg: 'glow',
}
interface Rest { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
interface Surface { material: THREE.MeshStandardMaterial; role: typeof ROLE[string]; color: THREE.Color; emissive: THREE.Color; opacity: number; glow: number }
const restOf = (object: THREE.Object3D): Rest => ({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() })

/** Only per-instance transforms/materials and private geometry clones are changed. Original asset stays intact. */
export class Cinema2BassSigilModelController {
  readonly afterVisibility = true
  private readonly clock = new Cinema2BeatClock()
  private readonly selection = new Cinema2MainframePatternController<BassSigilPattern>(BASS_SIGIL_PATTERN_IDS, 'reference-vortex')
  private readonly policy = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly auto = new Cinema2PatternAutoPerformance<BassSigilPattern>({buildPattern:'lens-collapse',dropPattern:'shock-bloom',buildMaxBeats:32,dropBeats:8})
  private autoReason: string | null = null
  private basePattern: BassSigilPattern = 'reference-vortex'
  private performingPhase: number | null = null
  private transition: { start:number; duration:number; poses:Rest[]; vertices:Float32Array } | null = null
  private beats = 0
  private readonly surfaces: Surface[] = []
  private readonly owned: THREE.BufferGeometry[] = []
  private readonly moving: Rest[] = []
  private hero: THREE.Group | null = null
  private heroRest: THREE.Vector3 | null = null
  private logoPhase = 0
  private logoSpinPhase = 0
  private lastTimestamp: number | null = null
  private sphere: THREE.Mesh | null = null
  private sphereBase: Float32Array | null = null
  private readonly particles: THREE.Mesh[] = []
  private context: Cinema2ModuleUpdateContext | null = null
  private phase = 0
  private lastBeat: number | null = null
  private previousTime: number | null = null
  private sourceIdentity: string | null = null
  private generation = -1
  private audioGeneration = -1
  private authoredPattern: BassSigilPattern | null = null
  private patternEditRevision: number | null = null
  private pattern: BassSigilPattern = 'reference-vortex'

  constructor(private readonly library: Cinema2ThreeLibrary) {}
  attach(root: THREE.Object3D) {
    const { THREE } = this.library
    root.updateMatrixWorld(true)
    const edge = root.getObjectByName('Object_24')
    if (!edge) throw new Error('Bass Sigil original wordmark is missing.')
    const bounds = new THREE.Box3().setFromObject(edge), center = bounds.getCenter(new THREE.Vector3()), scale = 6 / bounds.getSize(new THREE.Vector3()).x
    const rig = new THREE.Group(), children = [...root.children]
    root.add(rig); children.forEach(child => rig.add(child)); rig.scale.setScalar(scale); rig.position.copy(center).multiplyScalar(-scale)
    // These source parents share the same local source coordinate frame.
    const meshNames = ['Object_4','Object_6','Object_8','Object_10','Object_12','Object_14','Object_24']
    const hero = new THREE.Group(), sourceParent = edge.parent!.parent!
    sourceParent.add(hero); hero.position.copy(center)
    for (const name of meshNames) {
      const object = root.getObjectByName(name)?.parent
      if (!object) throw new Error(`Bass Sigil original part is missing: ${name}`)
      object.position.sub(center); hero.add(object)
    }
    this.hero = hero
    this.heroRest = hero.position.clone()
    this.sphere = root.getObjectByName('Object_18') as THREE.Mesh
    if (!this.sphere?.isMesh) throw new Error('Bass Sigil original cellular sphere is missing.')
    this.sphere.geometry = this.sphere.geometry.clone(); this.owned.push(this.sphere.geometry)
    this.sphereBase = new Float32Array(this.sphere.geometry.attributes.position.array)
    for (const name of ['Object_20','Object_22']) {
      const mesh = root.getObjectByName(name) as THREE.Mesh
      mesh.geometry = mesh.geometry.clone(); this.owned.push(mesh.geometry); this.particles.push(mesh)
    }
    for (const name of ['Object_18','Object_20','Object_22','Object_10','Object_12','Object_14','Object_4','Object_8']) {
      this.moving.push(restOf(root.getObjectByName(name)!.parent!))
    }
    root.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = material as THREE.MeshStandardMaterial, role = ROLE[m.name]
        if (!role) continue
        this.surfaces.push({ material: m, role, color: m.color.clone(), emissive: m.emissive.clone(), opacity: m.opacity, glow: m.emissiveIntensity })
        if (m.transparent) m.depthWrite = false
      }
    })
  }
  update(context: Cinema2ModuleUpdateContext) {
    this.context = context
    const { frame, parameters } = context, time = frame.transport?.timeSec ?? frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.transport?.trackId ?? null,frame.audio?.upstream.trackId??null,frame.audio?.upstream.sourceId??null,frame.audio?.upstream.analysisRevision??null,frame.audio?.upstream.timelineRevision??null])
    const audioGeneration = frame.audio?.discontinuity?.generation ?? 0
    const reset = this.sourceIdentity !== identity || this.audioGeneration !== audioGeneration || this.generation !== frame.contextGeneration || (this.previousTime != null && (time < this.previousTime - .01 || time - this.previousTime > .75))
    if (reset) { this.clock.reset(); this.selection.reset(); this.policy.reset(); this.auto.reset(); this.transition=null; this.phase = 0; this.logoPhase = 0; this.logoSpinPhase = 0; this.lastBeat = null; this.previousTime = null }
    const idleDelta = this.lastTimestamp == null ? frame.deltaTimeSec : Math.min(.1, Math.max(0, (frame.timestampMs-this.lastTimestamp)/1000))
    this.lastTimestamp = frame.timestampMs
    const timingFrame = !frame.transport?.sourcePresent && !frame.transport?.paused ? { ...frame, transport: undefined, deltaTimeSec: Number.isFinite(idleDelta) ? idleDelta : 0 } : frame
    const beats = this.clock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    this.beats = beats
    const rate = this.number('motionRate', 1, 0, 2)
    const elapsedBeats = this.lastBeat == null ? 0 : Math.max(0, beats - this.lastBeat)
    this.phase += frame.transport?.animationActive !== false ? elapsedBeats * rate * Math.PI / 4 : 0
    this.logoPhase += elapsedBeats * Math.PI / 8
    this.logoSpinPhase += elapsedBeats * this.number('logoSpinRate', .25, 0, 2) * Math.PI / 8
    this.lastBeat = beats
    const editRevision = parameters.getEditRevision?.('pattern')
    let patternEdited = editRevision != null && this.patternEditRevision != null && editRevision !== this.patternEditRevision
    if (patternEdited) this.selection.reset()
    this.patternEditRevision = editRevision ?? null
    const authored = parameters.get('pattern') as BassSigilPattern
    const pattern = BASS_SIGIL_PATTERN_IDS.includes(authored) ? authored : 'reference-vortex'
    patternEdited ||= this.authoredPattern != null && this.authoredPattern !== pattern
    this.authoredPattern = pattern
    const autoOn = parameters.get('autoPerformance') === true && this.number('reactivity',.65,0,1)>0 && frame.transport?.sourcePresent === true && (frame.transport.playing === true || frame.transport.paused === true) && frame.mood != null
    const controls = this.policy.update({saved:{patternChange:parameters.get('patternChange')===true,trigger:(parameters.get('trigger')??'bar4') as Cinema2AfterhoursTriggerId},mood:frame.mood,autoPerformance:autoOn})
    const drop = resolveCinema2AfterhoursTriggerEventIdentity(frame,'drop',this.previousTime)
    const event = controls.trigger==='drop' ? drop : resolveCinema2AfterhoursTriggerEventIdentity(frame,controls.trigger,this.previousTime)
    const selected=this.selection.update({authoredPattern:pattern,patternChange:controls.patternChange,trigger:controls.trigger,triggerEventId:event,absoluteBeat:beats,reset})
    this.basePattern=selected.activePattern
    const performance=this.auto.update({enabled:autoOn,absoluteBeat:beats,buildCharge:frame.mood?.silence && frame.mood.silence>.5 ? 0 : frame.director?.context.build.available ? frame.director.context.build.value??0 : 0,dropEventId:drop,patternEdited,reset,basePattern:this.basePattern,patternChange:controls.patternChange})
    const next=performance.pattern??this.basePattern
    if(next!==this.pattern && !patternEdited && !reset && this.sphere) this.transition={start:beats,duration:performance.reason==='drop'?.125:1,poses:this.moving.map(r=>restOf(r.object)),vertices:new Float32Array(this.sphere.geometry.attributes.position.array)}
    if(patternEdited||reset)this.transition=null
    this.pattern=next;this.autoReason=performance.reason
    this.performingPhase=performance.reason==='drop' ? (beats-performance.startBeat)*Math.PI/4 : null
    this.previousTime = time; this.sourceIdentity = identity; this.generation = frame.contextGeneration; this.audioGeneration = audioGeneration
  }
  private number(name: string, fallback: number, min: number, max: number) {
    const value = this.context?.parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  }
  beforeDraw() {
    if (!this.context || !this.sphere || !this.sphereBase || !this.hero) return
    const { THREE } = this.library
    const phase = this.performingPhase??this.phase
    const extent = this.number('geometryExtent', .35, 0, 1), travel = this.number('coreTravel', .25, 0, 1)
    const master = this.number('intensity', 1, 0, 2), depth = this.number('tunnelDepth', 1, .5, 1.5)
    this.hero.scale.setScalar(this.number('heroScale', 1, .75, 1.15))
    const logoPhase = this.logoPhase, sway = this.number('logoSway', .35, 0, 1)
    const radians = Math.PI / 180
    this.hero.rotation.set(
      this.number('logoPitch',0,-90,90)*radians + Math.sin(logoPhase*.7)*sway*.3,
      this.number('logoHeading',0,-180,180)*radians + this.logoSpinPhase,
      this.number('logoRoll',0,-180,180)*radians + Math.sin(logoPhase*.9)*sway*.16,
    )
    if (this.heroRest) {
      this.hero.position.copy(this.heroRest)
      this.hero.position.x += Math.sin(logoPhase*.8)*sway*.6
      this.hero.position.y += Math.sin(logoPhase*1.1)*sway*.35
    }
    for (const rest of this.moving) {
      rest.object.position.copy(rest.position); rest.object.quaternion.copy(rest.quaternion); rest.object.scale.copy(rest.scale)
    }
    const shell = this.moving[0].object, first = this.moving[1].object, second = this.moving[2].object
    const q = new THREE.Quaternion(), axis = new THREE.Vector3(0,1,0)
    const turn = (object: THREE.Object3D, x: number, y: number, z: number) => {
      object.quaternion.multiply(q.setFromAxisAngle(axis.set(1,0,0),x)).multiply(q.setFromAxisAngle(axis.set(0,1,0),y)).multiply(q.setFromAxisAngle(axis.set(0,0,1),z))
    }
    switch (this.pattern) {
      case 'reference-vortex': turn(shell,phase*.55,phase*.8,phase*.35); turn(second,0,-phase*.7,0); break
      case 'countercurrent': turn(shell,0,0,phase); turn(first,0,0,-phase*.8); turn(second,0,0,phase*.8); break
      case 'axial-pressure': turn(shell,0,phase*.1,0); first.scale.z *= 1-.2*extent*(.5+.5*Math.sin(phase)); second.scale.z *= 1-.3*extent*(.5+.5*Math.sin(phase)); break
      case 'orbital-weave': turn(shell,.45,phase*.5,.3); turn(first,phase*.5,0,.5); turn(second,-phase*.5,.6,-.5); break
      case 'broken-crown': turn(shell,0,phase*.15,.15); turn(first,0,0,.35+phase*.15); turn(second,0,0,-.35-phase*.15); break
      case 'tidal-ribbon': turn(shell,.2,phase*.25,0); turn(first,0,phase*.3,.3*Math.sin(phase)); turn(second,0,-phase*.3,-.3*Math.sin(phase)); break
      case 'lens-collapse': turn(shell,.15,0,0); first.scale.multiplyScalar(.90); second.scale.multiplyScalar(.86); break
      case 'shock-bloom': {
        const r = 1 + extent * .2 * Math.pow(.5+.5*Math.cos(phase),4)
        first.scale.multiplyScalar(r); second.scale.multiplyScalar(r); turn(shell,phase*.1,0,0); break
      }
    }
    shell.scale.multiplyScalar(this.number('membraneScale', 1, .65, 1.4)); shell.scale.z *= depth
    first.scale.z *= depth; second.scale.z *= depth
    const score = this.number('scoreAmount',.5,0,1)
    const release = score*this.number('shellRelease',0,0,1), twist = score*this.number('shellTwist',0,0,1)
    shell.scale.multiplyScalar(1+release*.12)
    const position = this.sphere.geometry.getAttribute('position')
    for (let i=0;i<position.count;i++) {
      const point = deformBassSigilPoint(this.pattern,this.sphereBase[i*3],this.sphereBase[i*3+1],this.sphereBase[i*3+2],phase,extent)
      const angle=twist*.3*point[2],c=Math.cos(angle),s=Math.sin(angle)
      position.setXYZ(i,point[0]*c-point[1]*s,point[0]*s+point[1]*c,point[2])
    }
    position.needsUpdate = true; this.sphere.geometry.computeVertexNormals(); this.sphere.geometry.computeBoundingSphere()
    for(let i=3;i<6;i++) {
      const rest = this.moving[i], stroke = Math.sin(phase*4+(i-3)*1.7)
      const cue=this.number(['barLeft','barMiddle','barRight'][i-3],0,0,1)
      rest.object.position.y += stroke*travel*1.6 + cue*score*travel*3
      rest.object.position.z += Math.cos(phase*4+(i-3)*1.7)*travel*.25
    }
    if(this.transition) {
      const t=Math.min(1,Math.max(0,(this.beats-this.transition.start)/this.transition.duration)),blend=t*t*(3-2*t)
      this.moving.forEach((rest,i)=>{const from=this.transition!.poses[i];rest.object.position.lerpVectors(from.position,rest.object.position.clone(),blend);rest.object.quaternion.slerpQuaternions(from.quaternion,rest.object.quaternion.clone(),blend);rest.object.scale.lerpVectors(from.scale,rest.object.scale.clone(),blend)})
      for(let i=0;i<position.count;i++){const from=this.transition.vertices;position.setXYZ(i,from[i*3]+(position.getX(i)-from[i*3])*blend,from[i*3+1]+(position.getY(i)-from[i*3+1])*blend,from[i*3+2]+(position.getZ(i)-from[i*3+2])*blend)}
      if(t>=1)this.transition=null
      position.needsUpdate=true;this.sphere.geometry.computeVertexNormals();this.sphere.geometry.computeBoundingSphere()
    }
    const density = this.number('particleDensity', 1, 0, 1)
    for(const mesh of this.particles) {
      const count = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count
      mesh.geometry.setDrawRange(0,Math.floor(count*density/3)*3)
    }
    const opacity = this.number('membraneOpacity', 1, 0, 1), glow = this.number('glow', 1, 0, 2)
    for(const surface of this.surfaces) {
      const {material,role} = surface
      material.color.copy(surface.color); material.emissive.copy(surface.emissive)
      if(role in BASS_SIGIL_PALETTE) {
        const color = this.context.parameters.get(`${role}Color`)
        const defaults = BASS_SIGIL_PALETTE[role as keyof typeof BASS_SIGIL_PALETTE]
        if(Array.isArray(color) && color.slice(0,3).some((v,i)=>Math.abs(Number(v)-defaults[i])>1e-6)) {
          material.color.setRGB(Number(color[0]),Number(color[1]),Number(color[2]),THREE.SRGBColorSpace)
          if(surface.emissive.r+surface.emissive.g+surface.emissive.b>0)material.emissive.copy(material.color)
        }
      }
      material.color.multiplyScalar(master); material.emissive.multiplyScalar(master)
      material.emissiveIntensity = surface.glow * (role==='core'||role==='glow' ? glow : 1)
      material.opacity = surface.opacity * (role==='membrane' ? opacity : role==='glow' ? Math.min(1,glow) : 1) * (master===0 ? 0 : 1)
      if(role==='glow')material.color.multiplyScalar(glow)
    }
  }
  inspect() { return { ...this.policy.inspect(), basePattern:this.basePattern, overrideReason:this.autoReason, pattern: this.pattern, phase: this.phase, logoPhase: this.logoPhase, logoSpinPhase: this.logoSpinPhase, source: 'cinema2-crate-bass-sigil', ownedGeometryCount: this.owned.length } }
  dispose() { this.owned.forEach(g=>g.dispose()); this.owned.length=0; this.surfaces.length=0; this.particles.length=0; this.moving.length=0; this.hero=null; this.heroRest=null; this.sphere=null; this.sphereBase=null; this.context=null; this.clock.reset(); this.selection.reset(); this.policy.reset(); this.auto.reset(); this.transition=null }
}
export const cinema2BassSigilModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_BASS_SIGIL_MODULE_TYPE_ID, resourceKey: 'bass-sigil-native:bridge', createModelController: library => new Cinema2BassSigilModelController(library),
})
