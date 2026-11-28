import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { blendArcAngelPose, clamp01 } from './ArcAngelDomain'
import { ArcAngelArchitecture } from './ArcAngelArchitecture'
import { arcAngelClipTime, blendArcAngelStage } from './ArcAngelPatterns'
import type { ArcAngelPerformance } from './ArcAngelPerformance'

type Ring = { group:Three.Group; segments:Three.Mesh<Three.TorusGeometry,Three.MeshStandardMaterial>[]; radius:number; depth:number; tilt:number }
type Arm = { mesh:Three.SkinnedMesh; anchor:Three.Bone; material:Three.MeshStandardMaterial; index:number }
const TAU=Math.PI*2, RINGS=7, SEGMENTS=12, PARTICLES=460, HISTORY=12
const fract=(x:number)=>x-Math.floor(x)
const seed=(i:number)=>fract(Math.sin(i*127.1+311.7)*43758.5453)

/** World-space sculpture and stage content only. The shared bridge owns the camera, lighting rig, depth, HDR and renderer. */
export class ArcAngelScene {
  private readonly geometry=new Set<Three.BufferGeometry>()
  private readonly materials=new Set<Three.Material>()
  private readonly rings:Ring[]=[]
  private readonly arms:Arm[]=[]
  private readonly bodyMaterials:Three.MeshStandardMaterial[]=[]
  private readonly haloMaterials:Three.MeshStandardMaterial[]=[]
  private readonly glowMaterials:Three.MeshStandardMaterial[]=[]
  private readonly architecture:Three.Group
  private readonly sanctum:ArcAngelArchitecture
  private readonly conduits:Three.LineSegments<Three.BufferGeometry,Three.LineBasicMaterial>
  private readonly conduitPositions=new Float32Array(10*16*6)
  private readonly conduitEnd:Three.Vector3
  private readonly hero:Three.Group
  private readonly normalized:Three.Group
  private readonly structure:Three.MeshStandardMaterial
  private readonly trim:Three.MeshStandardMaterial
  private readonly jewel:Three.MeshStandardMaterial
  private readonly lights:Three.PointLight[]=[]
  private readonly shockwaves:Three.Mesh<Three.TorusGeometry,Three.MeshBasicMaterial>[]=[]
  private readonly particles:Three.Points<Three.BufferGeometry,Three.PointsMaterial>
  private readonly particlePositions=new Float32Array(PARTICLES*3)
  private readonly trails:Three.LineSegments<Three.BufferGeometry,Three.LineBasicMaterial>
  private readonly trailPositions=new Float32Array(10*(HISTORY-1)*6)
  private readonly history:Three.Vector3[][]=[]
  private readonly mixer:Three.AnimationMixer
  private readonly clips:{action:Three.AnimationAction;arm:number}[]=[]
  private readonly pos:Three.Vector3
  private readonly orig:Three.Object3D
  private readonly skeletons=new Set<Three.Skeleton>()
  private disposed=false
  private haloBase: {scale:Three.Vector3;quaternion:Three.Quaternion}|null=null
  private ringAngles=Array.from({length:RINGS},()=>0)
  private lastPhase=NaN;private lastEpoch=-1;private lastPattern='';private lastHistoryCount=0
  private duration=14.58
  constructor(private readonly lib:Cinema2ThreeLibrary,private readonly root:Three.Object3D,asset:Cinema2ThreeLoadedAsset,model:Three.Object3D){
    const T=lib.THREE;this.pos=new T.Vector3();this.conduitEnd=new T.Vector3();this.orig=model
    this.sanctum=new ArcAngelArchitecture(lib,root)
    this.architecture=new T.Group();this.architecture.name='arc-angel-celestial-apparatus';root.add(this.architecture)
    this.hero=new T.Group();this.hero.name='arc-angel-hero';root.add(this.hero)
    this.normalized=new T.Group();this.hero.add(this.normalized);this.normalized.add(model)
    // Original GLB uses metre-scale hundredths and is Y-up. Normalize from the inspected animation envelope, not the compact bind pose.
    this.normalized.scale.setScalar(155);this.normalized.position.set(0,-2.95,0)
    const cloned=new Map<Three.Material,Three.Material>()
    model.traverse(o=>{
      const mesh=o as Three.Mesh;if(!mesh.isMesh)return
      const clone=(m:Three.Material)=>{let result=cloned.get(m);if(!result){result=m.clone();cloned.set(m,result);this.materials.add(result)}return result}
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material)
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material]
      for(const m of mats){const mat=m as Three.MeshStandardMaterial;if(!mat.isMeshStandardMaterial)continue
        const name=mat.name.toLowerCase()
        if(name.includes('hand')||name.includes('skeletonskeleton')){if(!this.bodyMaterials.includes(mat))this.bodyMaterials.push(mat)}
        else if(name.includes('glow')){if(!this.glowMaterials.includes(mat))this.glowMaterials.push(mat);mat.depthWrite=false}
        else if(name.includes('halo')){if(!this.haloMaterials.includes(mat))this.haloMaterials.push(mat);if(mat.transparent)mat.depthWrite=false}
      }
      const skin=mesh as Three.SkinnedMesh
      if(skin.isSkinnedMesh){this.skeletons.add(skin.skeleton);skin.frustumCulled=false
        const anchor=skin.skeleton.bones.find(b=>/hand\d*.*arm_root/i.test(b.name))
        const armName=anchor?.name.match(/hand(\d*)/i)
        if(anchor&&armName){const index=Number(armName[1]||0);const material=(mats[0] as Three.MeshStandardMaterial).clone();this.materials.add(material);skin.material=material;this.arms.push({mesh:skin,anchor,material,index})}
      }
    })
    this.arms.sort((a,b)=>a.index-b.index)
    // Split the original clip by each independently skinned arm. All groups are evaluated by one mixer at explicit times.
    this.mixer=new T.AnimationMixer(model)
    const clip=asset.animations[0]
    if(clip){this.duration=clip.duration;const armNames=new Map<string,number>()
      for(const arm of this.arms)for(const bone of arm.mesh.skeleton.bones)armNames.set(bone.name,arm.index)
      const buckets=new Map<number,Three.KeyframeTrack[]>()
      for(const track of clip.tracks){const name=T.PropertyBinding.parseTrackName(track.name).nodeName??'';const arm=armNames.get(name)??-1;const list=buckets.get(arm)??[];list.push(track);buckets.set(arm,list)}
      for(const [arm,tracks] of buckets){const part=new T.AnimationClip(`arc-angel-${arm}`,clip.duration,tracks);const action=this.mixer.clipAction(part);action.play();action.paused=true;this.clips.push({action,arm})}
    }
    this.structure=this.own(new T.MeshStandardMaterial({color:0x57412a,metalness:.83,roughness:.42}))
    this.trim=this.own(new T.MeshStandardMaterial({color:0xb98d55,metalness:.76,roughness:.34,emissive:0x7b3c09,emissiveIntensity:.12}))
    this.jewel=this.own(new T.MeshStandardMaterial({color:0x9e571d,metalness:.45,roughness:.27,emissive:0xffa643,emissiveIntensity:1.6}))
    const tickGeo=this.geo(new T.BoxGeometry(.045,.18,.08)),blockGeo=this.geo(new T.BoxGeometry(.23,.35,.16)),jewelGeo=this.geo(new T.OctahedronGeometry(.11,0))
    const dummy=new T.Object3D()
    // Layered bronze armillary: full thick rims, inlaid rails, segmented light channels and fine engraved radial hardware.
    for(let i=0;i<RINGS;i++){
      const radius=[2.95,3.48,4.08,4.86,5.6,6.5,7.55][i]!,depth=-.95-i*.56
      const group=new T.Group();group.name=`arc-angel-ring-${i}`;this.architecture.add(group);group.position.z=depth
      group.add(new T.Mesh(this.geo(new T.TorusGeometry(radius,i===3?.23:.14,8,128)),this.structure))
      for(const offset of [-.12,.12])group.add(new T.Mesh(this.geo(new T.TorusGeometry(radius+offset,.022,6,128)),this.trim))
      const segments:Ring['segments']=[]
      const arcGeo=this.geo(new T.TorusGeometry(radius,.038,6,20,TAU/SEGMENTS*.68))
      for(let k=0;k<SEGMENTS;k++){const mat=this.own(new T.MeshStandardMaterial({color:0x91643a,metalness:.45,roughness:.26,emissive:0xff801e,emissiveIntensity:1}));const arc=new T.Mesh(arcGeo,mat);arc.rotation.z=k*TAU/SEGMENTS;arc.position.z=.095;group.add(arc);segments.push(arc)}
      const ticks=new T.InstancedMesh(tickGeo,this.trim,72),blocks=new T.InstancedMesh(blockGeo,this.structure,24),jewels=new T.InstancedMesh(jewelGeo,this.jewel,12)
      for(let k=0;k<72;k++){const angle=k*TAU/72;dummy.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,.11);dummy.rotation.set(0,0,angle-Math.PI/2);dummy.scale.set(1,k%3===0?1.6:.55,1);dummy.updateMatrix();ticks.setMatrixAt(k,dummy.matrix)}
      for(let k=0;k<24;k++){const angle=k*TAU/24;dummy.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,-.015);dummy.rotation.set(0,0,angle-Math.PI/2);dummy.scale.set(1,1,1);dummy.updateMatrix();blocks.setMatrixAt(k,dummy.matrix);if(k%2===0){dummy.position.z=.18;dummy.scale.set(.8,1.5,.7);dummy.updateMatrix();jewels.setMatrixAt(k/2,dummy.matrix)}}
      group.add(ticks,blocks,jewels);this.rings.push({group,segments,radius,depth,tilt:(i%2?1:-1)*(.035+i*.025)})
    }
    // Two oblique orbital rails and radial cathedral ribs provide foreground/background parallax rather than a flat graphic.
    const railGeo=this.geo(new T.TorusGeometry(5.6,.045,8,144));for(const side of [-1,1]){const rail=new T.Mesh(railGeo,this.trim);rail.rotation.set(side*.95,side*.3,.14*side);rail.position.z=-1.8;this.architecture.add(rail)}
    const ribGeo=this.geo(new T.CylinderGeometry(.045,.075,1,7)),spireGeo=this.geo(new T.ConeGeometry(.20,.65,6)),ribCount=24
    const ribs=new T.InstancedMesh(ribGeo,this.structure,ribCount*2),spires=new T.InstancedMesh(spireGeo,this.trim,ribCount)
    const up=new T.Vector3(0,1,0),end=new T.Vector3(),start=new T.Vector3(),dir=new T.Vector3()
    for(let i=0;i<ribCount;i++){
      const theta=i*TAU/ribCount;start.set(Math.cos(theta)*4.08,Math.sin(theta)*4.08,-2.1);end.set(Math.cos(theta)*8.2,Math.sin(theta)*8.2,-5.5);dir.subVectors(end,start);dummy.position.copy(start).addScaledVector(dir,.5);dummy.quaternion.setFromUnitVectors(up,dir.clone().normalize());dummy.scale.set(1,dir.length(),1);dummy.updateMatrix();ribs.setMatrixAt(i,dummy.matrix)
      start.set(Math.cos(theta+.045)*6.5,Math.sin(theta+.045)*6.5,-4.3);end.set(Math.cos(theta+.09)*8.7,Math.sin(theta+.09)*8.7,-7.2);dir.subVectors(end,start);dummy.position.copy(start).addScaledVector(dir,.5);dummy.quaternion.setFromUnitVectors(up,dir.clone().normalize());dummy.scale.set(.6,dir.length(),.6);dummy.updateMatrix();ribs.setMatrixAt(i+ribCount,dummy.matrix)
      dummy.position.set(Math.cos(theta)*5.6,Math.sin(theta)*5.6,-3.1);dummy.rotation.set(0,0,theta-Math.PI/2);dummy.scale.set(1,1,1);dummy.updateMatrix();spires.setMatrixAt(i,dummy.matrix)
    }
    this.architecture.add(ribs,spires)
    // A fixed pool of local point lights provides actual selective illumination on the skinned hero and bronze rings.
    for(let i=0;i<5;i++){const light=new T.PointLight(0xff913c,0,9,2);root.add(light);this.lights.push(light)}
    const shockGeo=this.geo(new T.TorusGeometry(1,.013,6,96));for(let i=0;i<4;i++){const wave=new T.Mesh(shockGeo,this.own(new T.MeshBasicMaterial({color:0xffa644,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending})));wave.position.y=-3.65+i*.035;wave.rotation.x=-Math.PI/2;root.add(wave);this.shockwaves.push(wave)}
    const pg=this.geo(new T.BufferGeometry());pg.setAttribute('position',new T.BufferAttribute(this.particlePositions,3).setUsage(T.DynamicDrawUsage));this.particles=new T.Points(pg,this.own(new T.PointsMaterial({color:0xffa342,size:.034,transparent:true,opacity:.6,depthWrite:false,blending:T.AdditiveBlending})));this.particles.frustumCulled=false;root.add(this.particles)
    const tg=this.geo(new T.BufferGeometry());tg.setAttribute('position',new T.BufferAttribute(this.trailPositions,3).setUsage(T.DynamicDrawUsage));tg.setDrawRange(0,0);this.trails=new T.LineSegments(tg,this.own(new T.LineBasicMaterial({color:0xffa342,transparent:true,opacity:.45,depthWrite:false,blending:T.AdditiveBlending})));this.trails.frustumCulled=false;root.add(this.trails)
    const cg=this.geo(new T.BufferGeometry());cg.setAttribute('position',new T.BufferAttribute(this.conduitPositions,3).setUsage(T.DynamicDrawUsage));cg.setDrawRange(0,0);this.conduits=new T.LineSegments(cg,this.own(new T.LineBasicMaterial({color:0xffcc88,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending})));this.conduits.frustumCulled=false;root.add(this.conduits)
    for(let i=0;i<10;i++)this.history.push(Array.from({length:HISTORY},()=>new T.Vector3()))
  }
  private own<T extends Three.Material>(material:T):T{this.materials.add(material);return material}
  private geo<T extends Three.BufferGeometry>(geometry:T):T{this.geometry.add(geometry);return geometry}
  private tint(target:Three.Color,p:ArcAngelPerformance,key:Parameters<ArcAngelPerformance['color']>[0]){const c=p.color(key);target.setRGB(c[0]!,c[1]!,c[2]!,this.lib.THREE.SRGBColorSpace)}
  apply(p:ArcAngelPerformance,quality:string){
    if(this.disposed)return
    const n=(key:string,fallback:number,min=0,max=1)=>p.n(key,fallback,min,max),a=(key:string)=>p.response[key]??0
    const phase=p.phase,weights=p.weights,pose=blendArcAngelPose(weights,phase),motion=p.safety*n('movement',.75),intensity=n('intensity',.8),silence=1-.83*a('silence')
    const elapsedPhase=p.epoch===this.lastEpoch&&Number.isFinite(this.lastPhase)?Math.max(0,Math.min(1,phase-this.lastPhase)):0
    if(p.epoch!==this.lastEpoch)this.ringAngles.fill(0)
    const kick=a('kick'),snare=a('snare'),drop=a('drop'),bass=(a('sub')+a('bass'))*.5,build=a('build'),vocal=a('vocal'),impact=a('impact')
    const flash=n('flash-accents',.45),hit=clamp01((kick*.4+snare*.26+drop*.68+a('downbeat')*.16+impact*.17)*flash),lightGain=intensity*silence*(.84+.16*a('energy'))
    const move=motion*(1-.20*vocal),spread=n('arm-spread',.75),blend=n('animation-blend',.8),halo=n('halo-scale',1,.6,1.4)
    const cue=blendArcAngelStage(weights,phase),articulation=n('articulation',.9),secondary=n('secondary-motion',.65)
    this.hero.visible=p.on('model-visible');this.hero.scale.setScalar(n('model-scale',1,.65,1.12));this.hero.position.y=move*(pose.lift*1.8*n('levitation',.65)+.16*bass+.14*Math.sin(phase*.22));this.hero.rotation.set(move*(.12*Math.sin(phase*.13)+.09*cue.gesture),move*.32*Math.sin(phase*.12),move*.08*Math.sin(phase*.19))
    // Preserve the authored skeletal tracks, sample a much broader range, and stagger mirrored arms.
    // The blend remains bounded and reversible on seeks; no accumulation on unverified bone axes.
    const excursion=clamp01(Math.sqrt(move)*blend*articulation*1.28)
    for(const {action,arm} of this.clips){
      const local=arm<0?pose:blendArcAngelPose(weights,phase,arm), gesture=blendArcAngelStage(weights,phase,arm<0?0:arm).gesture
      const delay=arm<0?(.45*cue.gesture):((local.armDelay-.5)*2.6*spread+(gesture-.5)*1.2*spread+.65*drop+.22*snare*(arm%2?1:-1)+secondary*.24*Math.sin(phase*.4-arm*.8))
      action.time=arcAngelClipTime(this.duration,local.time,delay,excursion)
    }
    this.mixer.update(0)
    const haloNode=this.orig.getObjectByName('halo');if(haloNode){if(!this.haloBase)this.haloBase={scale:haloNode.scale.clone(),quaternion:haloNode.quaternion.clone()};haloNode.scale.copy(this.haloBase.scale).multiplyScalar(halo*(1+.07*bass*move));haloNode.quaternion.copy(this.haloBase.quaternion);haloNode.rotateY(move*n('halo-rotation',.35)*Math.sin(phase*.12))}
    for(const mat of this.bodyMaterials){this.tint(mat.color,p,'body');mat.emissiveIntensity=.02+.1*lightGain*hit}
    for(const arm of this.arms){const local=blendArcAngelPose(weights,phase,arm.index);this.tint(arm.material.color,p,'body');this.tint(arm.material.emissive,p,arm.index%2?'secondary':'primary');arm.material.emissiveIntensity=lightGain*n('selective-light',.7)*(.012+.15*local.emission+.22*hit+.06*a('mid'));}
    for(const mat of this.haloMaterials){this.tint(mat.color,p,'secondary');this.tint(mat.emissive,p,'secondary');mat.emissiveIntensity=lightGain*(.7+1.5*hit+.5*bass)}
    for(const mat of this.glowMaterials){this.tint(mat.emissive,p,'primary');mat.emissiveIntensity=lightGain*(.2+.6*pose.emission+.6*hit)}
    this.tint(this.structure.color,p,'structural');this.tint(this.trim.color,p,'accent');this.tint(this.trim.emissive,p,'primary');this.tint(this.jewel.emissive,p,'primary');this.trim.emissiveIntensity=.07+lightGain*hit*.22;this.jewel.emissiveIntensity=lightGain*(.45+hit*2)
    const density=n('environment-density',.88),depth=n('spatial-depth',1,.6,1.5),speed=n('ring-rotation',.65),ringLight=n('ring-intensity',.8)
    this.architecture.visible=density>0;this.architecture.scale.set(1,1,depth)
    this.sanctum.apply(p,quality,hit,lightGain,move)
    for(const [i,r] of this.rings.entries()){
      const program=blendArcAngelPose(weights,phase,0,i),offset=i*.64
      r.group.visible=i<Math.max(1,Math.ceil(density*RINGS))
      this.ringAngles[i]=(this.ringAngles[i]!+elapsedPhase*speed*program.ringSpeed*.18*move)%TAU
      r.group.rotation.set((i>=4?.65+i*.11:r.tilt)+program.ringTilt*move*Math.sin(phase*.12+offset),-r.tilt+program.ringTilt*.75*move*Math.cos(phase*.10+offset),this.ringAngles[i]!+offset)
      r.group.position.z=r.depth*.8-.12*build*move*i
      const expansion=1+move*(.045*bass+.04*drop*program.shock);r.group.scale.setScalar(expansion)
      for(const [j,segment] of r.segments.entries()){
        const theta=j/SEGMENTS,run=.5+.5*Math.sin(TAU*(theta*(i%2?1:-1)-phase*(.12+Math.abs(program.ringSpeed)*.18)+i*.15))
        const alternating=(j%2===i%2?snare:kick)*flash,charge=clamp01(program.emission*(.3+.7*run)+build*.25+a('bar')*.10+alternating*.33+drop*.5*flash+a('section')*.12)
        this.tint(segment.material.emissive,p,(j+i)%4===0?'secondary':'primary');segment.material.emissiveIntensity=lightGain*ringLight*(.12+charge*3.1)*(.45+.55*density)
      }
    }
    for(const [i,l] of this.lights.entries()){const angle=phase*.22*move+i*TAU/5;l.position.set(Math.cos(angle)*3.1,Math.sin(angle)*2.5,i===0?2.8:-.15);this.tint(l.color,p,i%2?'secondary':'primary');l.intensity=(quality==='low'&&i>=3?0:1)*lightGain*n('selective-light',.7)*(7+12*hit+7*pose.emission+3*a('phrase'))}
    for(const [i,w] of this.shockwaves.entries()){const f=fract(phase*.13*move+i*.23);w.scale.setScalar(1.4+f*13);this.tint(w.material.color,p,i%2?'secondary':'primary');w.material.opacity=lightGain*n('impact-waves',.65)*(1-f)*clamp01(pose.shock*.24+hit+drop*.45*flash);w.visible=w.material.opacity>.005}
    const count=Math.floor((quality==='low'?100:quality==='medium'?240:PARTICLES)*n('particles',.65)*(0.7+.3*a('high')))
    this.particles.geometry.setDrawRange(0,count);this.particles.visible=count>0;this.tint(this.particles.material.color,p,'primary');this.particles.material.opacity=lightGain*(.28+.4*pose.emission+.18*a('air'))
    for(let i=0;i<count;i++){const theta=seed(i*3+1)*TAU+phase*.018*move,r=2.8+seed(i*3+2)*5.8;this.particlePositions.set([Math.cos(theta)*r,-3.4+seed(i*3+3)*12+Math.sin(phase*.06+seed(i)*TAU)*.4*move,Math.sin(theta)*r],i*3)}this.particles.geometry.attributes.position!.needsUpdate=true
    // Trails use wrist world positions, history is invalidated on seeks/re-entry and is never advanced on a repeated draw.
    this.root.updateMatrixWorld(true);const reset=p.epoch!==this.lastEpoch||p.pattern!==this.lastPattern;const changed=phase!==this.lastPhase
    if(reset)this.lastHistoryCount=0
    if(changed||reset){for(const arm of this.arms){const h=this.history[arm.index];if(!h)continue;const wrist=arm.mesh.skeleton.bones.find(b=>/arm_wrist/i.test(b.name))??arm.anchor;wrist.getWorldPosition(this.pos);this.root.worldToLocal(this.pos);if(reset)for(const v of h)v.copy(this.pos);else{for(let i=HISTORY-1;i>0;i--)h[i]!.copy(h[i-1]!);h[0]!.copy(this.pos)}}this.lastHistoryCount=Math.min(HISTORY,this.lastHistoryCount+1)}
    // World-space energy connections are recomputed from the actual animated wrists every draw.
    let conduitOffset=0
    const conduitGain=n('divine-conduits',.65)*lightGain*(.1+.7*cue.conduit+.35*build+.3*hit)
    if(p.on('model-visible')&&density>0&&conduitGain>.025&&quality!=='low')for(const arm of this.arms){
      if(arm.index>=10||arm.index<0||(quality==='medium'&&arm.index%2))continue
      const wrist=arm.mesh.skeleton.bones.find(b=>/arm_wrist/i.test(b.name))??arm.anchor;wrist.getWorldPosition(this.pos);this.root.worldToLocal(this.pos)
      const angle=arm.index*TAU/10,steps=16;this.conduitEnd.set(Math.sin(angle)*17.85,-2.45+(arm.index%4)*3.15,Math.cos(angle)*17.85)
      for(let j=0;j<steps;j++)for(const t of [j/steps,(j+1)/steps]){const arc=Math.sin(t*Math.PI),wobble=arc*.13*Math.sin(t*TAU*3+phase*.9+arm.index)*move;this.conduitPositions[conduitOffset++]=this.pos.x+(this.conduitEnd.x-this.pos.x)*t+wobble;this.conduitPositions[conduitOffset++]=this.pos.y+(this.conduitEnd.y-this.pos.y)*t+arc*(.65+.25*cue.conduit)+wobble;this.conduitPositions[conduitOffset++]=this.pos.z+(this.conduitEnd.z-this.pos.z)*t-wobble}
    }
    this.conduits.geometry.setDrawRange(0,conduitOffset/3);this.conduits.geometry.attributes.position!.needsUpdate=true;this.tint(this.conduits.material.color,p,'accent');this.conduits.material.opacity=Math.min(.8,conduitGain);this.conduits.visible=conduitOffset>0
    this.lastEpoch=p.epoch;this.lastPattern=p.pattern;this.lastPhase=phase
    let offset=0;const length=Math.min(this.lastHistoryCount,quality==='medium'?6:HISTORY)
    if(quality!=='low'&&motion>0&&p.on('model-visible'))for(const arm of this.arms){const h=this.history[arm.index];if(!h)continue;for(let i=1;i<length;i++){h[i-1]!.toArray(this.trailPositions,offset);h[i]!.toArray(this.trailPositions,offset+3);offset+=6}}
    this.trails.geometry.setDrawRange(0,offset/3);this.trails.geometry.attributes.position!.needsUpdate=true;this.tint(this.trails.material.color,p,'accent');this.trails.material.opacity=lightGain*n('energy-trails',.55)*pose.trail;this.trails.visible=offset>0&&this.trails.material.opacity>.005
  }
  inspect(){return {armRigs:this.arms.length,clipGroups:this.clips.length,ringCount:this.rings.length,animationDuration:this.duration}}
  dispose(){if(this.disposed)return;this.disposed=true;this.sanctum.dispose();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.orig);for(const skeleton of this.skeletons)skeleton.dispose();for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();this.root.clear()}
}
