import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { blendedPose, clamp, wrap, type Profile, type Color, type ChromaverseState } from './ChromaverseDomain'

interface ExternalTarget {setRenderTargetFramebuffer(target:Three.WebGLRenderTarget,framebuffer:WebGLFramebuffer):void}
type SurfaceMaterial=Three.MeshStandardMaterial & Partial<Three.MeshPhysicalMaterial>
type Surface={mesh:Three.Mesh;material:SurfaceMaterial;original:SurfaceMaterial;index:number;role:number;position:Three.Vector3;quaternion:Three.Quaternion;scale:Three.Vector3;morph:number[];baseMorph:number[];center:Three.Vector3;visible:boolean;instance:boolean}
const MAX_TRAILS=96
/** Owns only cloned material state, temporary instance buffers and motion trails. The GLB cache owns source geometry/textures. */
export class ChromaverseRenderer {
 private readonly scene:Three.Scene
 private readonly camera:Three.PerspectiveCamera
 private readonly target:Three.WebGLRenderTarget
 private readonly renderer:Three.WebGLRenderer
 private readonly guard:Cinema2GlStateGuard
 private readonly rig:Cinema2ThreeLightRig
 private readonly model:Three.Group
 private readonly normalizer:Three.Group
 private readonly mixer:Three.AnimationMixer|null
 private readonly duration:number
 private readonly surfaces:Surface[]=[]
 private readonly materials=new Set<Three.Material>()
 private readonly instances:Three.InstancedMesh|null
 private readonly instanceMaterial:SurfaceMaterial|null
 private readonly bounds:Three.Box3
 private readonly tmp:Three.Vector3
 private readonly world:Three.Vector3
 private readonly center:Three.Vector3
 private readonly axis:Three.Vector3
 private readonly quat:Three.Quaternion
 private readonly inv:Three.Matrix4
 private readonly matrix:Three.Matrix4
 private readonly tint:Three.Color
 private readonly accent:Three.Color
 private readonly instanceColor:Three.Color
 private readonly trailGeometry:Three.BufferGeometry
 private readonly trailMaterial:Three.LineBasicMaterial
 private readonly trail:Three.LineSegments
 private readonly trailData:Float32Array
 private readonly last:Three.Vector3[]
 private readonly radius:number
 private morphBytes=0
 private readonly identityGroups:Three.Object3D[]=[]
 private readonly identityBase:Three.Vector3[]=[]
 private readonly identityVisibility:boolean[]=[]
 private readonly alignment:number
 private priorPhase=-1
 private priorEpoch=-1
 private posed=false
 private disposed=false
 private active=0
 constructor(gl:WebGL2RenderingContext,private readonly library:Cinema2ThreeLibrary,private readonly asset:Cinema2ThreeLoadedAsset,private readonly root:Three.Object3D,private readonly profile:Profile){
  const T=library.THREE
  this.guard=new Cinema2GlStateGuard(gl);this.guard.capture()
  try{const host=getCinema2ThreeRenderer(library,gl);this.renderer=host.renderer;this.scene=new T.Scene();this.scene.environment=host.getEnvironment()}finally{this.guard.restore()}
  this.camera=new T.PerspectiveCamera();this.rig=new Cinema2ThreeLightRig(T,this.scene)
  this.target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});(this.target as unknown as {isXRRenderTarget:boolean}).isXRRenderTarget=true;this.target.texture.colorSpace=T.SRGBColorSpace
  this.model=new T.Group();this.normalizer=new T.Group();this.model.add(this.normalizer);this.normalizer.add(root);this.scene.add(this.model)
  this.bounds=new T.Box3();this.tmp=new T.Vector3();this.world=new T.Vector3();this.center=new T.Vector3();this.axis=new T.Vector3();this.quat=new T.Quaternion();this.inv=new T.Matrix4();this.matrix=new T.Matrix4();this.tint=new T.Color();this.accent=new T.Color();this.instanceColor=new T.Color()
  const clip=asset.animations[0];this.duration=clip?.duration??0;this.mixer=clip?new T.AnimationMixer(root):null
  if(clip&&this.mixer){this.mixer.clipAction(clip).play();this.mixer.setTime(this.duration*.2)}
  root.updateMatrixWorld(true)
  // Source positions and transforms are left intact; normalize the complete hierarchy, including the skeleton.
  this.bounds.setFromObject(root);const sphere=this.bounds.getBoundingSphere(new T.Sphere());
  if(!Number.isFinite(sphere.radius)||sphere.radius<1e-8)throw Error(`Invalid CHROMAVERSE bounds: ${profile.name}`)
  // PULSE's source axis is Y, not Z; normalize radial size independently so its opening fills the screen.
  this.alignment=profile.key==='pulse'||profile.key==='alter-ego'?Math.PI/2:0
  const size=this.bounds.getSize(new T.Vector3());this.radius=profile.interior?8.2:2.2
  const normalization=profile.key==='pulse'?1.65/Math.max(.001,Math.max(size.x,size.z)*.5):this.radius/sphere.radius
  this.normalizer.scale.setScalar(normalization);this.normalizer.position.copy(sphere.center).multiplyScalar(-normalization)
  this.model.rotation.x=this.alignment;this.scene.updateMatrixWorld(true)
  if(profile.key==='alter-ego'){
   const identityRoot=root.getObjectByName('head128');if(identityRoot)for(const child of identityRoot.children){this.identityGroups.push(child);this.identityBase.push(child.position.clone());this.identityVisibility.push(child.visible)}
  }
  const meshes:Three.Mesh[]=[];root.traverse(o=>{if((o as Three.Mesh).isMesh)meshes.push(o as Three.Mesh)})
  const geometries=new Set(meshes.map(m=>m.geometry));for(const geometry of geometries){const attrs=geometry.morphAttributes;for(const group of Object.values(attrs))for(const attribute of group??[])this.morphBytes+=(attribute as Three.BufferAttribute).array.byteLength}
  if(!meshes.length)throw Error(`No source meshes: ${profile.name}`)
  // These two assets have identical repeated plane/sphere geometry (verified in source GLB).
  // Batch their repeat elements as instances, while keeping the original animated nodes as transform drivers.
  const batch=profile.key==='starfield-warp'?meshes.filter(m=>/plane/i.test(m.name)):profile.key==='magic-warp'?meshes:[]
  const instanceSet=new Set(batch)
  const originalInstance=batch[0]?.material as SurfaceMaterial|undefined
  this.instanceMaterial=originalInstance?.isMeshStandardMaterial?originalInstance.clone() as SurfaceMaterial:null
  if(this.instanceMaterial){this.materials.add(this.instanceMaterial);this.instanceMaterial.color.setRGB(1,1,1);if(this.instanceMaterial.map&&!this.instanceMaterial.emissiveMap)this.instanceMaterial.emissiveMap=this.instanceMaterial.map;this.instanceMaterial.emissive.setRGB(.35,.35,.35);this.instanceMaterial.emissiveIntensity=1;this.instanceMaterial.depthWrite=false}
  this.instances=this.instanceMaterial?new T.InstancedMesh(batch[0]!.geometry,this.instanceMaterial,batch.length):null
  if(this.instances){this.instances.instanceMatrix.setUsage(T.DynamicDrawUsage);this.instances.frustumCulled=false;this.scene.add(this.instances)}
  // Material names and mesh names identify semantic layers. Preserve source textures and alpha modes.
  const roles=new Map<string,number>()
  for(const mesh of meshes){
   const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material as SurfaceMaterial
   if(!original||(original as SurfaceMaterial).isMeshStandardMaterial!==true)continue
   const mat=original as SurfaceMaterial, name=mesh.name.toLowerCase(), semantic=/sphere|plane/.test(name)?'node':/torus|arc/.test(name)?'ring':/helix/.test(name)?'helix':mat.name||'structure'
   if(!roles.has(semantic))roles.set(semantic,roles.size)
   const instance=!!this.instances&&instanceSet.has(mesh),material=instance?this.instanceMaterial!:mat.clone() as SurfaceMaterial
   if(!instance){this.materials.add(material);mesh.material=material}
   const index=this.surfaces.length;mesh.geometry.computeBoundingBox();const center=mesh.geometry.boundingBox?.getCenter(new T.Vector3())??new T.Vector3()
   const morph=mesh.morphTargetInfluences??[]
   this.surfaces.push({mesh,material,original:mat,index,role:roles.get(semantic)!,position:mesh.position.clone(),quaternion:mesh.quaternion.clone(),scale:mesh.scale.clone(),morph:[...morph],baseMorph:[...morph],center,visible:mesh.visible,instance})
   mesh.frustumCulled=false
  }
  this.trailData=new Float32Array(MAX_TRAILS*6);this.last=Array.from({length:MAX_TRAILS},()=>new T.Vector3());this.trailGeometry=new T.BufferGeometry();this.trailGeometry.setAttribute('position',new T.BufferAttribute(this.trailData,3).setUsage(T.DynamicDrawUsage));this.trailMaterial=new T.LineBasicMaterial({transparent:true,opacity:.1,depthWrite:false,blending:T.AdditiveBlending});this.trail=new T.LineSegments(this.trailGeometry,this.trailMaterial);this.trail.frustumCulled=false;this.scene.add(this.trail)
 }
 private setColor(target:Three.Color,c:Color){target.setRGB(c[0],c[1],c[2],this.library.THREE.SRGBColorSpace)}
 private pose(s:ChromaverseState,quality:string,epoch:number,exec:Cinema2ModuleRenderExecutionContext){
  const v=s.values,p=this.profile, motion=clamp(s.motion,0,2)*(1-.8*s.silence), energy=clamp(v.bassPressure!+.45*v.subAmount!+.5*v.kickAccent!+.4*v.dropAccent!), flash=clamp(s.flash*(.4*v.kickAccent!+.35*v.snareAccent!+.5*v.dropAccent!+.15*v.directorImpact!)), phase=s.phase;
  // Always restore authored local transforms before re-sampling. Never accumulate offsets across draws.
  if(this.posed)for(const [i,group] of this.identityGroups.entries()){group.position.copy(this.identityBase[i]!);group.visible=this.identityVisibility[i]!}
  if(this.posed)for(const x of this.surfaces){x.mesh.position.copy(x.position);x.mesh.quaternion.copy(x.quaternion);x.mesh.scale.copy(x.scale);x.mesh.visible=x.visible;if(x.mesh.morphTargetInfluences)for(let i=0;i<x.baseMorph.length;i++)x.mesh.morphTargetInfluences[i]=x.baseMorph[i]!}
  if(this.mixer&&this.duration>0)this.mixer.setTime(wrap(this.duration*.2+s.clipTime,this.duration));this.posed=true
  const dist=Math.hypot(...exec.camera!.position),e=this.camera.projectionMatrix.elements,fit=dist*Math.sin(Math.atan(Math.min(1/Math.abs(e[0]!),1/Math.abs(e[5]!))))*.90/this.radius
  this.model.scale.setScalar(p.interior?v.modelSize!:Math.min(v.modelSize!,fit));this.model.rotation.set(this.alignment,0,0)
  // Move full face/skeleton assemblies, not individual skinned surfaces. Restore the sampled group offsets on the next draw.
  if(p.key==='alter-ego')for(const [i,group] of this.identityGroups.entries()){
   this.identityBase[i]!.copy(group.position);this.identityVisibility[i]=group.visible;
   const u=i/Math.max(1,this.identityGroups.length-1),a=blendedPose(p,s,u),gain=motion*(v.separation!-.4)*.22;
   group.position.x+=gain*(u-.5+a.axial);group.position.z+=gain*a.radial;group.visible=group.visible&&(i===0||i/this.identityGroups.length<v.density!);
  }
  this.scene.updateMatrixWorld(true)
  this.active=0;let instanceIndex=0,trailCount=0;
  const advanced=epoch===this.priorEpoch&&Math.abs(phase-this.priorPhase)>1e-7, roleColors=[s.palette.primary,s.palette.secondary,s.palette.accent,s.palette.highlight];
  for(const x of this.surfaces){
   const m=x.mesh; x.position.copy(m.position);x.quaternion.copy(m.quaternion);x.scale.copy(m.scale);x.visible=m.visible;if(m.morphTargetInfluences)for(let i=0;i<x.baseMorph.length;i++)x.baseMorph[i]=m.morphTargetInfluences[i]!
   const u=x.index/Math.max(1,this.surfaces.length-1), a=blendedPose(p,s,u), angle=phase*Math.PI*2-u*12.566, localWave=Math.sin(angle), role=x.role%4;
   // Interleaved thinning keeps the form intact instead of removing one whole side.
   const threshold=(p.key==='alter-ego'&&this.identityGroups.length?1:v.density!)*(quality==='low'&&x.instance?.55:quality==='medium'&&x.instance?.8:1), show=x.visible&&((x.index*0.61803398875)%1<threshold||x.index===0)
   m.visible=show&&!x.instance
   const radial=1+motion*v.expansion!*(a.radial+.2*energy-.22*v.buildAmount!+.12*v.dropAccent!);const axial=motion*(a.axial*v.separation!+.1*v.phraseAccent!+.08*v.barAccent!+.05*v.sectionAccent!);
   // Use normalized world-space center for offsets, then return to the original parent space.
   // Local skin transforms are left intact; expressive morph targets are sampled and modulated separately.
   if(!(m as Three.SkinnedMesh).isSkinnedMesh&&m.parent){
    this.world.copy(x.center).applyMatrix4(m.matrixWorld);this.tmp.copy(this.world);this.tmp.x*=clamp(radial,.45,1.8);this.tmp.y*=clamp(radial,.45,1.8);this.tmp.z*=1+(v.separation!-1)*.4;
    switch(p.key){
     case 'pulse':this.tmp.z+=axial*.5;break;
     case 'space-jellyfish':this.tmp.y+=axial*.55;this.tmp.x+=localWave*motion*.12*v.midAmount!;break;
     case 'temple-of-light':this.tmp.z+=axial*.35;break;
     case 'starfield-warp':this.tmp.z=wrap(this.tmp.z+axial*2+phase*.7+8,16)-8;this.tmp.x*=1+v.expansion!*.3*localWave*motion;break;
     case 'torus':this.tmp.multiplyScalar(1+(v.separation!-1)*.18);this.tmp.z+=axial*.4;break;
     case 'time-tunnel':this.tmp.z+=axial*1.15;break;
     case 'hypnotic-flower':this.tmp.z+=axial*.35;this.tmp.y+=motion*v.width!*.13*localWave;break;
     case 'magic-warp':this.tmp.x+=motion*a.wave*.45*localWave;this.tmp.y+=axial*.6;this.tmp.z+=motion*Math.cos(angle)*.35*v.width!;break;
     case 'disco-waves':this.tmp.y+=axial*.35;this.tmp.z+=motion*a.wave*.12;break;
    }
    this.inv.copy(m.parent.matrixWorld).invert();this.tmp.applyMatrix4(this.inv);this.world.applyMatrix4(this.inv);m.position.add(this.tmp.sub(this.world));
    this.axis.set(p.key==='torus'?1:0,p.key==='space-jellyfish'||p.key==='magic-warp'?1:0,1).normalize();this.quat.setFromAxisAngle(this.axis,motion*v.rotationSpeed!*(a.twist+.13*localWave*v.midAmount!+.08*v.variation!+.09*v.snareAccent!));m.quaternion.multiply(this.quat);
    const size=clamp(1+motion*(a.radial*v.expansion!*.3+.1*v.beatAccent!+.14*v.lowMidAmount!),.55,1.6);m.scale.multiplyScalar(size);if(p.key==='starfield-warp')m.scale.multiplyScalar(.5+v.width!);if(p.key==='magic-warp')m.scale.multiplyScalar(.75+.5*v.width!);
   }else if(m.morphTargetInfluences?.length){
    const influences=m.morphTargetInfluences;for(let i=0;i<influences.length;i++)influences[i]=clamp(x.baseMorph[i]!*(.65+v.expansion!)+motion*(v.vocalPresence!*.12+energy*.06)*Math.max(0,Math.sin(angle+i*1.3)),0,1)
   }
   m.updateMatrixWorld(true);this.setColor(this.tint,roleColors[role]!);this.setColor(this.accent,s.palette.highlight)
   const light=clamp(a.light*(.8+.24*v.overallEnergy!+.15*v.directorIntensity!+.1*v.highsAmount!+.06*v.airAmount!+.07*v.fluxAmount!)+flash,0,1.5)*(1-.8*s.silence)
   if(x.instance&&this.instances){
    if(show){this.instances.setMatrixAt(instanceIndex,m.matrixWorld);this.instanceColor.copy(this.tint).lerp(this.accent,flash*.45).multiplyScalar(clamp(light*v.intensity!,.05,1.5));this.instances.setColorAt(instanceIndex++,this.instanceColor)}
   }else{
    const mat=x.material,orig=x.original, tint=v.tint!;mat.color.copy(orig.color).lerp(this.tint,tint*(p.key==='pulse'?1:.65));mat.emissive.copy(orig.emissive).lerp(this.tint,tint*.8+.18);if(p.key==='pulse'){mat.color.copy(this.tint);mat.emissive.copy(this.tint)}
    if(orig.map&&!orig.emissiveMap&&p.key!=='pulse'){mat.emissiveMap=orig.map}
    const base=Math.min(3,orig.emissiveIntensity??1);mat.emissiveIntensity=clamp((base*.55+v.glow!*1.3)*light*v.intensity!,0,p.key==='time-tunnel'?1.3:4);
    mat.opacity=clamp((p.key==='pulse'?Math.max(.58,orig.opacity):orig.opacity)*v.opacity!);const transparent=orig.transparent||v.opacity!<.999;if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true}mat.depthWrite=orig.depthWrite&&!(v.opacity!<.999);mat.envMapIntensity=v.reflection!*1.4;if(mat.isMeshPhysicalMaterial&&orig.transmission!=null)mat.transmission=quality==='low'?0:orig.transmission;
   }
   if(show){this.active++;if(trailCount<MAX_TRAILS&&x.index%Math.max(1,Math.floor(this.surfaces.length/MAX_TRAILS))===0){m.getWorldPosition(this.tmp);const prev=this.last[trailCount]!;const off=trailCount*6;if(advanced&&prev.distanceTo(this.tmp)<1.5){prev.toArray(this.trailData,off);this.tmp.toArray(this.trailData,off+3)}else{this.tmp.toArray(this.trailData,off);this.tmp.toArray(this.trailData,off+3)}prev.copy(this.tmp);trailCount++}}
  }
  if(this.instances){this.instances.count=instanceIndex;this.instances.instanceMatrix.needsUpdate=true;if(this.instances.instanceColor)this.instances.instanceColor.needsUpdate=true;this.instanceMaterial!.opacity=(this.surfaces.find(x=>x.instance)?.original.opacity??1)*v.opacity!;this.instanceMaterial!.emissiveIntensity=clamp(v.glow!*v.intensity!*(1-.8*s.silence),0,2);this.instanceMaterial!.envMapIntensity=v.reflection!}
  this.scene.environmentIntensity=v.reflection!;this.trail.visible=quality!=='low'&&v.trails!>0&&s.motion>0;this.trailMaterial.opacity=v.trails!*.38*(1-s.silence);this.setColor(this.trailMaterial.color,s.palette.accent);this.trailGeometry.setDrawRange(0,trailCount*2);this.trailGeometry.attributes.position!.needsUpdate=true;this.priorEpoch=epoch;this.priorPhase=phase;
 }
 draw(exec:Cinema2ModuleRenderExecutionContext,s:ChromaverseState,epoch:number){
  if(this.disposed||!exec.target||!exec.camera||!exec.lightingEnvironment||!exec.depthAvailable)return
  const renderer=this.renderer,shadow=renderer.shadowMap.enabled;this.guard.capture();try{
   renderer.resetState();renderer.shadowMap.enabled=false;this.rig.update(exec.lightingEnvironment);applyCinema2CameraFrame(this.camera,exec.camera);this.pose(s,exec.lightingEnvironment.quality,epoch)
   ;(renderer as unknown as ExternalTarget).setRenderTargetFramebuffer(this.target,exec.target);this.target.viewport.set(0,0,exec.width,exec.height);this.target.scissor.set(0,0,exec.width,exec.height);renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera)
  }finally{renderer.shadowMap.enabled=shadow;renderer.setRenderTarget(null);renderer.resetState();this.guard.restore()}
 }
 inspect(){return {assetId:this.asset.id,meshCount:this.surfaces.length,activeSurfaces:this.active,instanceCount:this.instances?.count??0,animationDuration:this.duration,animationTracks:this.asset.animations[0]?.tracks.length??0}}
 estimateGpuBytes(){return this.asset.gpuBytes+this.morphBytes+this.trailData.byteLength+(this.instances?.instanceMatrix.array.byteLength??0)+(this.instances?.instanceColor?.array.byteLength??0)+1024*1024}
 dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();this.mixer?.uncacheRoot(this.root);for(const x of this.materials)x.dispose();this.instances?.dispose();this.trailGeometry.dispose();this.trailMaterial.dispose();this.scene.clear();this.target.dispose()}
}
