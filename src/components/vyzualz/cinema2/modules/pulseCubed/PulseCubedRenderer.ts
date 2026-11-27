import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { blendedPose, clamp, wrap, type Color, type PulseState } from './PulseCubedDomain'

interface ExternalFramebufferRenderer {setRenderTargetFramebuffer(target:Three.WebGLRenderTarget,framebuffer:WebGLFramebuffer):void}
type Surface={node:Three.Object3D;mesh:Three.Mesh;material:Three.MeshPhysicalMaterial}
type Layer={frame:Surface;pulses:Surface[];frameMixer:Three.AnimationMixer;pulseMixer:Three.AnimationMixer;baseScale:Three.Vector3}
const HISTORY=6,MAX_PARTICLES=96
/** The supplied animation remains authoritative for local paths. A per-layer mixer samples original tracks before a fresh bounded pose is applied. */
export class PulseCubedRenderer {
 private readonly scene:Three.Scene
 private readonly camera:Three.PerspectiveCamera
 private readonly target:Three.WebGLRenderTarget
 private readonly renderer:Three.WebGLRenderer
 private readonly guard:Cinema2GlStateGuard
 private readonly rig:Cinema2ThreeLightRig
 private readonly sculpture:Three.Group
 private readonly layers:Layer[]=[]
 private readonly enclosure:Surface
 private readonly enclosureMixer:Three.AnimationMixer
 private readonly ownedMaterials=new Set<Three.Material>()
 private readonly mixers:Three.AnimationMixer[]=[]
 private readonly duration:number
 private readonly history:Three.Vector3[][]
 private readonly historyVisible:boolean[][]
 private readonly trails:Three.LineSegments
 private readonly trailPositions:Float32Array
 private readonly trailColors:Float32Array
 private readonly trailGeometry:Three.BufferGeometry
 private readonly trailMaterial:Three.LineBasicMaterial
 private readonly particles:Three.Points
 private readonly particleGeometry:Three.BufferGeometry
 private readonly particleMaterial:Three.PointsMaterial
 private readonly particleSeeds:number[]
 private readonly particlePositions:Float32Array
 private readonly spill:Three.PointLight[]=[]
 private readonly scratch:Three.Vector3
 private readonly frameDelta:Three.Quaternion
 private readonly frameAtPulse:Three.Quaternion
 private readonly identity:Three.Quaternion
 private readonly twist:Three.Quaternion
 private readonly axis:Three.Vector3
 private readonly tint:Three.Color
 private readonly accent:Three.Color
 private readonly bounds:Three.Box3
 private readonly sphere:Three.Sphere
 private readonly normalization:number
 private epoch=-1
 private lastPhase=-1
 private activePulses=0
 private activeLayers=0
 private disposed=false
 constructor(gl:WebGL2RenderingContext,private readonly library:Cinema2ThreeLibrary,private readonly asset:Cinema2ThreeLoadedAsset,private readonly root:Three.Object3D,random:(index:number)=>number){
  const T=library.THREE;this.guard=new Cinema2GlStateGuard(gl);this.guard.capture()
  try{const host=getCinema2ThreeRenderer(library,gl);this.renderer=host.renderer;this.scene=new T.Scene();this.scene.environment=host.getEnvironment()}finally{this.guard.restore()}
  this.camera=new T.PerspectiveCamera();this.rig=new Cinema2ThreeLightRig(T,this.scene)
  this.target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});(this.target as unknown as {isXRRenderTarget:boolean}).isXRRenderTarget=true;this.target.texture.colorSpace=T.SRGBColorSpace
  this.sculpture=new T.Group();this.sculpture.add(root);this.scene.add(this.sculpture)
  this.scratch=new T.Vector3();this.frameDelta=new T.Quaternion();this.frameAtPulse=new T.Quaternion();this.identity=new T.Quaternion();this.twist=new T.Quaternion();this.axis=new T.Vector3();this.tint=new T.Color();this.accent=new T.Color();this.bounds=new T.Box3();this.sphere=new T.Sphere()
  const clip=asset.animations[0];if(!clip||clip.duration<=0)throw Error('PULSE CUBED requires the supplied animated GLB.')
  this.duration=clip.duration
  const pulseNodes:Three.Object3D[]=[],frameNodes:Three.Object3D[]=[];let shell:Three.Object3D|undefined
  root.traverse(node=>{if(node.name.startsWith('Sphere'))pulseNodes.push(node);else if(node.name.startsWith('ANI_'))frameNodes.push(node);else if(node.name.startsWith('Roundcube'))shell=node})
  const ordinal=(node:Three.Object3D)=>Number(node.name.match(/_(\d+)$/)?.[1]??0)
  pulseNodes.sort((a,b)=>ordinal(a)-ordinal(b));frameNodes.sort((a,b)=>ordinal(a)-ordinal(b))
  if(pulseNodes.length!==48||frameNodes.length!==4||!shell)throw Error(`Unexpected PULSE CUBED hierarchy (${frameNodes.length} frames, ${pulseNodes.length} pulses).`)
  const surface=(node:Three.Object3D):Surface=>{
   const mesh=node.children.find(child=>(child as Three.Mesh).isMesh)??node.children[0]?.children.find(child=>(child as Three.Mesh).isMesh)
   if(!mesh||!(mesh as Three.Mesh).isMesh)throw Error(`Missing mesh beneath ${node.name}.`)
   const m=mesh as Three.Mesh,original=Array.isArray(m.material)?m.material[0]:m.material
   if(!original||(original as Three.MeshPhysicalMaterial).isMeshPhysicalMaterial!==true)throw Error(`Physical GLB material missing on ${node.name}.`)
   const material=(original as Three.MeshPhysicalMaterial).clone();this.ownedMaterials.add(material);m.material=material;m.frustumCulled=false
   return {node,mesh:m,material}
  }
  const mixer=(nodes:Three.Object3D[]):Three.AnimationMixer=>{
   const names=new Set(nodes.map(node=>node.name)),tracks=clip.tracks.filter(track=>names.has(track.name.slice(0,track.name.lastIndexOf('.'))))
   if(!tracks.length)throw Error(`Missing authored animation tracks for ${nodes[0]?.name}.`)
   const m=new T.AnimationMixer(root),part=new T.AnimationClip(`pulse-${nodes[0]!.name}`,this.duration,tracks)
   m.clipAction(part).play();this.mixers.push(m);return m
  }
  // Source groups are ordered middle, inner-middle, inner, outer. Radius order matters for cascade and collapse.
  const order=[2,1,0,3]
  for(const group of order){const frame=frameNodes[group]!,nodes=pulseNodes.slice(group*12,group*12+12);this.layers.push({frame:surface(frame),pulses:nodes.map(surface),frameMixer:mixer([frame]),pulseMixer:mixer(nodes),baseScale:frame.scale.clone()})}
  this.enclosure=surface(shell);this.enclosureMixer=mixer([shell]);this.enclosureMixer.setTime(2.5)
  for(const layer of this.layers){layer.frameMixer.setTime(2.5);layer.pulseMixer.setTime(2.5)}
  root.updateMatrixWorld(true);this.bounds.setFromObject(root).getBoundingSphere(this.sphere)
  this.normalization=2.2/Math.max(.001,this.sphere.radius);root.scale.multiplyScalar(this.normalization)
  // World-space line buffer: short, bounded trails, no framebuffer feedback or per-frame allocations.
  this.history=Array.from({length:48},()=>Array.from({length:HISTORY},()=>new T.Vector3()))
  this.historyVisible=Array.from({length:48},()=>Array<boolean>(HISTORY).fill(false))
  this.trailPositions=new Float32Array(48*(HISTORY-1)*6);this.trailColors=new Float32Array(this.trailPositions.length)
  this.trailGeometry=new T.BufferGeometry();this.trailGeometry.setAttribute('position',new T.BufferAttribute(this.trailPositions,3).setUsage(T.DynamicDrawUsage));this.trailGeometry.setAttribute('color',new T.BufferAttribute(this.trailColors,3).setUsage(T.DynamicDrawUsage))
  this.trailMaterial=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.25,blending:T.AdditiveBlending,depthWrite:false});this.trails=new T.LineSegments(this.trailGeometry,this.trailMaterial);this.trails.frustumCulled=false;this.scene.add(this.trails)
  this.particleSeeds=Array.from({length:MAX_PARTICLES*3},(_,i)=>random(i));this.particlePositions=new Float32Array(MAX_PARTICLES*3);this.particleGeometry=new T.BufferGeometry();this.particleGeometry.setAttribute('position',new T.BufferAttribute(this.particlePositions,3).setUsage(T.DynamicDrawUsage));this.particleMaterial=new T.PointsMaterial({size:.028,transparent:true,opacity:.45,blending:T.AdditiveBlending,depthWrite:false});this.particles=new T.Points(this.particleGeometry,this.particleMaterial);this.particles.frustumCulled=false;this.scene.add(this.particles)
  for(let i=0;i<4;i++){const lamp=new T.PointLight(0xffffff,0,2.8,2);this.spill.push(lamp);this.scene.add(lamp)}
 }
 private color(target:Three.Color,value:Color){target.setRGB(value[0],value[1],value[2],this.library.THREE.SRGBColorSpace)}
 private pose(s:PulseState,quality:string){
  const v=s.values,energy=clamp(v.overallEnergy!),accent=clamp(s.flash*(.65*v.kickAccent!+.45*v.downbeatAccent!+.9*v.dropAccent!+.2*v.directorImpact!)),moving=clamp(s.motion,0,2),silence=1-.86*s.silence
  this.activeLayers=Math.round(v.visibleLayers!);this.activePulses=0
  this.color(this.accent,s.palette.impact)
  for(const [i,layer] of this.layers.entries()){
   const p=blendedPose(s,i),l=i/3,visible=i<this.activeLayers
   // The authored pulse path and frame transform share the same source coordinates. Retarget the pulse path by the frame's relative rotation.
   const offset=2.5+i*v.layerPhaseOffset!*.8,pulseTime=wrap(offset+s.pulsePhases[i]!*this.duration,this.duration),frameTime=wrap(offset+s.rotationPhases[i]!*this.duration,this.duration)
   layer.frame.node.scale.copy(layer.baseScale);layer.frameMixer.setTime(pulseTime);this.frameAtPulse.copy(layer.frame.node.quaternion)
   layer.pulseMixer.setTime(pulseTime);layer.frame.node.scale.copy(layer.baseScale);layer.frameMixer.setTime(frameTime)
   const frame=layer.frame.node
   // Twist and alignment are applied from the just-sampled authored pose, never the previous draw.
   this.axis.set(i===0?1:.35,i===1?1:.4,i>=2?1:.3).normalize()
   const twist=(p[3]!+.2*v.phraseAccent!+.12*v.barAccent!+.08*v.variation!)*v.axisVariation!*moving
   this.twist.setFromAxisAngle(this.axis,twist);frame.quaternion.premultiply(this.twist).slerp(this.identity,clamp(p[5]!*moving))
   this.frameDelta.copy(this.frameAtPulse).invert();this.frameDelta.premultiply(frame.quaternion)
   const spacing=clamp(1+(v.layerSeparation!-1)*(l-.5)*.7 + moving*v.expansionRange!*(p[2]!+.35*v.subAmount!+.28*v.kickAccent!+.3*v.dropAccent!-.32*v.buildAmount!*l)+moving*v.oscillation!*.09*p[6]!*Math.sin(s.phase*Math.PI*8+i),.48,1.48)
   // The original frame scales are per-layer constants or animated tracks. Preserve them and scale the corresponding pulse paths together.
   frame.scale.multiplyScalar(spacing);frame.visible=visible
   const fm=layer.frame.material;this.color(fm.color,s.palette.frame);fm.roughness=v.frameRoughness!;fm.metalness=.12
   fm.transmission=quality==='low'?0:v.frameTransmission!;fm.ior=1.35+v.opticalDistortion!*.8;fm.thickness=.03+v.opticalDistortion!*.28;fm.opacity=clamp(.36+(1-v.frameTransmission!)*.27+(quality==='low'?.12:0));fm.transparent=true;fm.depthWrite=false;fm.envMapIntensity=v.reflectionIntensity!*1.3;fm.specularIntensity=.63
   this.color(fm.emissive,s.palette.primary);fm.emissiveIntensity=clamp((.025+.09*v.midAmount!+.13*accent)*p[4]!*v.intensity!*silence,0,.4)
   layer.frame.mesh.renderOrder=10+i
   const visibleCount=Math.round(v.pulseCount!),weight=clamp(p[4]!*(1+.12*energy+.2*v.directorIntensity!+.18*v.fluxAmount!+.1*v.sectionAccent!)*(1+.12*v.airAmount!)*(1+accent*.75),0,2.2)
   for(const [j,pulse] of layer.pulses.entries()){
    // Interleave count across layers, rather than deleting a full layer at a time.
    const show=visible&&(j*4+i)<visibleCount
    pulse.node.visible=show;pulse.node.position.applyQuaternion(this.frameDelta).multiplyScalar(spacing);pulse.node.quaternion.premultiply(this.frameDelta)
    // The clip's longest scale axis carries pulse length; keep the two other axes thickened by bass independently.
    const sc=pulse.node.scale,axis=sc.x>=sc.y&&sc.x>=sc.z?'x':sc.y>=sc.z?'y':'z'
    const thick=1+moving*(.28*v.bassPressure!+.12*v.lowMidAmount!);sc.multiplyScalar(thick);sc[axis]*=v.pulseLength!*(1+moving*(.3*v.buildAmount!+.25*v.dropAccent!))
    const mat=pulse.material;this.color(mat.emissive,j%3===0?s.palette.secondary:s.palette.primary);mat.emissive.lerp(this.accent,clamp(accent*.32+v.snareAccent!*p[7]!*(i%2===0?.27:.07)))
    mat.emissiveIntensity=clamp(10*v.intensity!*v.pulseIntensity!*weight*silence*(1+.1*v.highsAmount!*Math.sin(s.phase*50+j)),0,24)
    pulse.mesh.renderOrder=0
    if(show&&Math.max(sc.x,sc.y,sc.z)>.01)this.activePulses++
   }
   const light=this.spill[i]!;this.color(light.color,i%2===0?s.palette.primary:s.palette.secondary);light.intensity=visible?Math.min(8,weight*accent*3+v.reflectionIntensity!*weight*.45)*v.intensity!*silence:0;light.position.set(Math.cos(s.phase*6+i*1.6)*.6*l,Math.sin(s.phase*6+i*1.6)*.6*l,.35*l)
  }
  this.enclosureMixer.setTime(wrap(2.5+s.rotationPhases[3]!*this.duration*.5,this.duration));this.enclosure.node.visible=s.enclosure;this.enclosure.mesh.renderOrder=30
  const enclosure=this.enclosure.material;this.color(enclosure.emissive,s.palette.enclosureColor);enclosure.emissiveIntensity=clamp((1.02+accent*1.3+v.downbeatAccent!*.4)*v.intensity!*silence,0,3);enclosure.opacity=v.enclosureOpacity!;enclosure.transparent=true;enclosure.depthWrite=false;enclosure.envMapIntensity=v.reflectionIntensity!*.55
  this.scene.environmentIntensity=v.reflectionIntensity!*.8
 }
 private fit(exec:Cinema2ModuleRenderExecutionContext,s:PulseState){
  // Camera Zoom scales the sculpture's projection in this isolated scene; the shared depth/camera matrices remain authoritative for effects.
  const scale=s.values.modelSize!*s.values.cameraZoom!;this.sculpture.scale.setScalar(1)
  // The shared sweep remains the actual camera rig. Pattern mode adds a bounded relative view articulation around the sculpture center.
  const pose=blendedPose(s,3),view=s.cameraMode==='pattern'?s.values.cameraAmount!*clamp(s.motion,0,1)*.35*pose[3]!:0
  this.sculpture.rotation.set(view*.5,view,0);this.sculpture.updateMatrixWorld(true)
  // The invariant center and conservative sphere fit keep all four frames inside square and portrait output at maximum expansion.
  this.bounds.setFromObject(this.root).getBoundingSphere(this.sphere)
  const e=this.camera.projectionMatrix.elements,distance=Math.hypot(...exec.camera!.position),tan=Math.min(1/Math.max(.01,Math.abs(e[0]!)),1/Math.max(.01,Math.abs(e[5]!)))
  const radius=Math.max(.001,this.sphere.radius+this.sphere.center.length()),maxScale=(distance*Math.sin(Math.atan(tan))*.90)/radius
  this.sculpture.scale.setScalar(Math.min(scale,maxScale));this.sculpture.updateMatrixWorld(true)
 }
 private updateTrails(s:PulseState,quality:string,epoch:number){
  const gain=s.values.energyTrails!,changed=epoch!==this.epoch,advance=changed||Math.abs(s.phase-this.lastPhase)>1e-8
  this.epoch=epoch;this.lastPhase=s.phase;this.trails.visible=gain>0&&quality!=='low';this.trailMaterial.opacity=gain*.52
  let offset=0
  for(const [i,layer] of this.layers.entries())for(const [j,pulse] of layer.pulses.entries()){
   const index=i*12+j,h=this.history[index]!,flags=this.historyVisible[index]!,visible=layer.frame.node.visible&&pulse.node.visible&&Math.max(pulse.node.scale.x,pulse.node.scale.y,pulse.node.scale.z)>.01
   pulse.node.getWorldPosition(this.scratch)
   if(changed||!visible||h[0]!.distanceTo(this.scratch)>1.2){for(let k=0;k<HISTORY;k++){h[k]!.copy(this.scratch);flags[k]=false}}
   if(advance){for(let k=HISTORY-1;k>0;k--){h[k]!.copy(h[k-1]!);flags[k]=flags[k-1]!}h[0]!.copy(this.scratch);flags[0]=visible}
   this.color(this.tint,j%3===0?s.palette.secondary:s.palette.primary)
   if(this.trails.visible)for(let k=0;k<(quality==='medium'?3:HISTORY-1);k++)if(flags[k]&&flags[k+1]){
    h[k]!.toArray(this.trailPositions,offset);h[k+1]!.toArray(this.trailPositions,offset+3);const a=(1-k/HISTORY)*.9,b=(1-(k+1)/HISTORY)*.65
    this.trailColors.set([this.tint.r*a,this.tint.g*a,this.tint.b*a,this.tint.r*b,this.tint.g*b,this.tint.b*b],offset);offset+=6
   }
  }
  this.trailGeometry.setDrawRange(0,offset/3);this.trailGeometry.attributes.position!.needsUpdate=true;this.trailGeometry.attributes.color!.needsUpdate=true
 }
 private updateParticles(s:PulseState,quality:string){
  this.particles.visible=s.particles&&quality!=='low';const count=Math.floor((quality==='medium'?36:MAX_PARTICLES)*s.values.particleAmount!*clamp(.25+s.values.highsAmount!*.4+s.values.dropAccent!*.35))
  this.particleGeometry.setDrawRange(0,this.particles.visible?count:0);if(!this.particles.visible)return
  for(let i=0;i<count;i++){const a=this.particleSeeds[i*3]!,b=this.particleSeeds[i*3+1]!,c=this.particleSeeds[i*3+2]!,phase=a*Math.PI*2+s.phase*(.6+b),radius=(1.55+c*.7)*this.sculpture.scale.x;this.particlePositions.set([Math.cos(phase)*radius,(b-.5)*radius*1.6,Math.sin(phase)*radius],i*3)}
  this.particleGeometry.attributes.position!.needsUpdate=true;this.color(this.particleMaterial.color,s.palette.secondary);this.particleMaterial.opacity=clamp(.12+s.values.highsAmount!*.28+s.flash*s.values.dropAccent!*.2)*(1-.8*s.silence)
 }
 draw(exec:Cinema2ModuleRenderExecutionContext,s:PulseState,epoch:number){
  if(this.disposed||!exec.target||!exec.camera||!exec.lightingEnvironment||!exec.depthAvailable)return
  const quality=exec.lightingEnvironment.quality,renderer=this.renderer,shadow=renderer.shadowMap.enabled
  this.guard.capture();try{
   renderer.resetState();renderer.shadowMap.enabled=false;this.rig.update(exec.lightingEnvironment);applyCinema2CameraFrame(this.camera,exec.camera)
   this.pose(s,quality);this.fit(exec,s);this.updateTrails(s,quality,epoch);this.updateParticles(s,quality)
   // The host owns the framebuffer and all post-processing. This is the same XR-style external target seam used by native Three modules.
   ;(renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target,exec.target)
   this.target.viewport.set(0,0,exec.width,exec.height);this.target.scissor.set(0,0,exec.width,exec.height)
   renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera)
  }finally{renderer.shadowMap.enabled=shadow;renderer.setRenderTarget(null);renderer.resetState();this.guard.restore()}
 }
 inspect(){return {assetId:this.asset.id,frameCount:this.layers.length,pulseCount:48,activePulses:this.activePulses,activeLayers:this.activeLayers,animationDuration:this.duration,animationTracks:this.asset.animations[0]?.tracks.length,normalization:this.normalization}}
 estimateGpuBytes(){return this.asset.gpuBytes+this.trailPositions.byteLength+this.trailColors.byteLength+this.particlePositions.byteLength+1024*1024}
 dispose(){if(this.disposed)return;this.disposed=true;for(const mixer of this.mixers){mixer.stopAllAction();mixer.uncacheRoot(this.root)}for(const material of this.ownedMaterials)material.dispose();this.trailGeometry.dispose();this.trailMaterial.dispose();this.particleGeometry.dispose();this.particleMaterial.dispose();this.scene.clear();this.target.dispose()}
}
