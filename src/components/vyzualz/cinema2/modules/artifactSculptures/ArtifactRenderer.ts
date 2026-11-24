import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { applyCinema2CameraFrame } from '../three/Cinema2ThreeCameraLightMapping'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { clamp, lightPosition, type ArtifactSpec, type ArtifactState, type Point } from './ArtifactDomain'
import { cathedral, mathematicalChamber, containmentVault, alienSanctuary, type Architecture } from './ArtifactArchitecture'

const CAPACITY=4600
interface ExternalFramebufferRenderer {setRenderTargetFramebuffer(target:Three.WebGLRenderTarget,framebuffer:WebGLFramebuffer):void}
/** Uses the production world pass and resource lease. No local animation clock or canvas. */
export class ArtifactRenderer {
  private readonly scene:Three.Scene
  private readonly camera:Three.PerspectiveCamera
  private readonly target:Three.WebGLRenderTarget
  private readonly renderer:Three.WebGLRenderer
  private readonly guard:Cinema2GlStateGuard
  private readonly metal:Three.MeshStandardMaterial
  private readonly secondary:Three.MeshStandardMaterial
  private readonly walls:Three.MeshStandardMaterial
  private readonly ribs:Three.MeshStandardMaterial
  private readonly floor:Three.MeshStandardMaterial
  private readonly trim:Three.MeshStandardMaterial
  private readonly coreMaterial:Three.MeshStandardMaterial
  private readonly core:Three.Mesh
  private readonly batches:Three.InstancedMesh[]=[]
  private readonly lamps:Three.SpotLight[]=[]
  private readonly architectureBatches:Three.InstancedMesh[]=[]
  private readonly geometries=new Set<Three.BufferGeometry>()
  private readonly materials=new Set<Three.Material>()
  private readonly ambient:Three.AmbientLight
  private readonly overhead:Three.PointLight
  private readonly matrix:Three.Matrix4
  private readonly a:Three.Vector3
  private readonly b:Three.Vector3
  private readonly d:Three.Vector3
  private readonly mid:Three.Vector3
  private readonly axis:Three.Vector3
  private readonly scale:Three.Vector3
  private readonly rotation:Three.Quaternion
  private readonly tint:Three.Color
  private readonly glowTint:Three.Color
  private disposed=false
  private shadowSize=0
  private counts=[0,0,0]
  private overflow=0
  private roomMeshes=0
  private roomDrawCalls=0
  constructor(gl:WebGL2RenderingContext,private readonly library:Cinema2ThreeLibrary,private readonly spec:ArtifactSpec){
    const T=library.THREE
    this.guard=new Cinema2GlStateGuard(gl);this.guard.capture()
    try{this.renderer=getCinema2ThreeRenderer(library,gl).renderer}finally{this.guard.restore()}
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera();this.target=new T.WebGLRenderTarget(1,1,{depthBuffer:true})
    ;(this.target as unknown as {isXRRenderTarget:boolean}).isXRRenderTarget=true
    this.target.texture.colorSpace=T.SRGBColorSpace
    this.matrix=new T.Matrix4();this.a=new T.Vector3();this.b=new T.Vector3();this.d=new T.Vector3();this.mid=new T.Vector3();this.axis=new T.Vector3(0,1,0);this.scale=new T.Vector3();this.rotation=new T.Quaternion();this.tint=new T.Color();this.glowTint=new T.Color()
    this.metal=this.mat(new T.MeshStandardMaterial({roughness:.38,metalness:.48}))
    this.secondary=this.mat(new T.MeshStandardMaterial({roughness:.62,metalness:.28}))
    this.walls=this.mat(new T.MeshStandardMaterial({roughness:.88,metalness:.05,side:T.DoubleSide}))
    this.ribs=this.mat(new T.MeshStandardMaterial({roughness:.65,metalness:.25}))
    this.floor=this.mat(new T.MeshStandardMaterial({roughness:.68,metalness:.25}))
    this.trim=this.mat(new T.MeshStandardMaterial({roughness:.45,metalness:.25,emissiveIntensity:.45}))
    this.coreMaterial=this.mat(new T.MeshStandardMaterial({roughness:.24,metalness:.15}))
    const rod=this.geo(new T.CylinderGeometry(1,1,1,6,1)),lit=this.mat(new T.MeshBasicMaterial({color:0xffffff}))
    for(const material of [this.metal,this.secondary,lit]){
      const mesh=new T.InstancedMesh(rod,material,CAPACITY);mesh.count=0;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=material!==lit;this.batches.push(mesh);this.scene.add(mesh)
    }
    this.core=new T.Mesh(this.geo(new T.IcosahedronGeometry(.52,2)),this.coreMaterial);this.core.castShadow=true;this.scene.add(this.core)
    this.buildArchitecture()
    this.ambient=new T.AmbientLight(0xffffff,.25);this.scene.add(this.ambient)
    this.overhead=new T.PointLight(0xffffff,90,45,2);this.overhead.position.set(0,10,4);this.scene.add(this.overhead)
    for(let i=0;i<2;i++){
      const light=new T.SpotLight(0xffffff,1500,50,Math.PI*.42,.22,2)
      light.target.position.set(0,0,-4);light.castShadow=true;light.shadow.bias=-.00012;light.shadow.normalBias=.018;light.shadow.camera.near=.35;light.shadow.camera.far=50
      this.lamps.push(light);this.scene.add(light,light.target)
    }
  }
  private geo<T extends Three.BufferGeometry>(g:T):T{this.geometries.add(g);return g}
  private mat<T extends Three.Material>(m:T):T{this.materials.add(m);return m}
  private buildArchitecture(){
    const T=this.library.THREE,box=this.geo(new T.BoxGeometry(1,1,1)),rod=this.geo(new T.CylinderGeometry(1,1,1,7,1))
    const materials={wall:this.walls,rib:this.ribs,floor:this.floor,trim:this.trim}
    type Role=keyof typeof materials
    const matrices=new Map<Three.BufferGeometry,Map<Role,Three.Matrix4[]>>()
    const queue=(geometry:Three.BufferGeometry,role:Role,matrix:Three.Matrix4)=>{
      let roles=matrices.get(geometry);if(!roles){roles=new Map();matrices.set(geometry,roles)}
      let items=roles.get(role);if(!items){items=[];roles.set(role,items)}
      items.push(matrix.clone());this.roomMeshes++
    }
    const add=(g:Three.BufferGeometry,p:Point,role:Role)=>{const mesh=new T.Mesh(g,materials[role]);mesh.position.set(...p);mesh.receiveShadow=true;this.scene.add(mesh);this.roomMeshes++;this.roomDrawCalls++;return mesh}
    const transform=new T.Object3D()
    const a:Architecture={
      box:(p,size,role,rotation)=>{transform.position.set(...p);transform.scale.set(...size);transform.rotation.set(...(rotation??[0,0,0]));transform.updateMatrix();queue(box,role,transform.matrix)},
      beam:(p,q,r,role)=>{if(this.rodMatrix(p,q,r))queue(rod,role,this.matrix)},
      disk:(p,r,h,role,segments=48)=>{add(this.geo(new T.CylinderGeometry(r,r,h,segments)),p,role)},
      ring:(p,r,thickness,role,segments=64)=>{add(this.geo(new T.TorusGeometry(r,thickness,6,segments)),p,role).rotation.x=Math.PI/2},
    }
    switch(this.spec.id){case 'seraph':cathedral(a,this.spec.room.floor);break;case 'paradox':mathematicalChamber(a,this.spec.room.floor);break;case 'relic':containmentVault(a,this.spec.room.floor);break;case 'monolith':alienSanctuary(a,this.spec.room.floor);break;default:throw Error(`Unknown architecture ${this.spec.id}`)}
    // Hundreds of fixed architectural supports collapse into at most eight static draw batches.
    for(const [geometry,roles] of matrices)for(const [role,items] of roles){
      const batch=new T.InstancedMesh(geometry,materials[role],items.length);batch.receiveShadow=true
      items.forEach((matrix,i)=>batch.setMatrixAt(i,matrix));batch.instanceMatrix.needsUpdate=true
      batch.computeBoundingSphere();this.scene.add(batch);this.architectureBatches.push(batch);this.roomDrawCalls++
    }
  }
  private rodMatrix(p:Point,q:Point,r:number):boolean{
    this.a.set(...p);this.b.set(...q);this.d.subVectors(this.b,this.a);const length=this.d.length()
    if(length<.0001)return false
    this.mid.addVectors(this.a,this.b).multiplyScalar(.5);this.rotation.setFromUnitVectors(this.axis,this.d.normalize());this.scale.set(r,length,r);this.matrix.compose(this.mid,this.rotation,this.scale);return true
  }
  private sculpture(s:ArtifactState,quality:string){
    const T=this.library.THREE,v=s.values,gain=clamp(v.intensity,0,1.6)*(1-.83*s.silence)
    this.counts=[0,0,0];this.overflow=0
    this.glowTint.setRGB(s.palette.strand[0],s.palette.strand[1],s.palette.strand[2],T.SRGBColorSpace)
    this.spec.geometry(s,(p,q,r,role=0,energy=1)=>{
      const i=clamp(Math.trunc(role),0,2),index=this.counts[i]!,batch=this.batches[i]!
      if(index>=CAPACITY){this.overflow++;return}
      if(!this.rodMatrix(p,q,r))return
      batch.setMatrixAt(index,this.matrix)
      if(i===2){this.tint.copy(this.glowTint).multiplyScalar(Math.max(.018,energy*gain*2.4));batch.setColorAt(index,this.tint)}
      this.counts[i]=index+1
    },quality)
    for(let i=0;i<this.batches.length;i++){const batch=this.batches[i]!;batch.count=this.counts[i]!;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true}
    this.core.scale.setScalar(v.coreScale*(1+s.motion*.08*v.subAmount));this.core.position.set(0,this.spec.id==='relic'?.75:0,this.spec.id==='relic'?-.38:0)
    this.core.rotation.set(s.phase*.07*s.motion,s.phase*.13*s.motion,0)
    this.coreMaterial.emissiveIntensity=v.coreIntensity*gain*(1.5+.55*v.overallEnergy+.25*v.directorIntensity+.24*s.flash*v.kickAccent+.24*v.dropAccent)
  }
  draw(exec:Cinema2ModuleRenderExecutionContext,s:ArtifactState):void{
    if(this.disposed)return
    if(!exec.target||!exec.depthAvailable||!exec.camera||!exec.lightingEnvironment)throw Error('Artifact requires shared world depth, camera and lighting')
    const T=this.library.THREE,v=s.values,quality=exec.lightingEnvironment.quality
    const shadowEnabled=this.renderer.shadowMap.enabled,shadowType=this.renderer.shadowMap.type
    this.guard.capture()
    try{
      this.renderer.resetState();this.sculpture(s,quality)
      const color=(m:Three.Color,key:keyof ArtifactState['palette'])=>{const c=s.palette[key];m.setRGB(c[0],c[1],c[2],T.SRGBColorSpace)}
      color(this.metal.color,'metal');color(this.secondary.color,'secondary');color(this.walls.color,'background');color(this.floor.color,'background');this.floor.color.multiplyScalar(.65)
      this.ribs.color.copy(this.walls.color).multiplyScalar(.65);color(this.trim.color,'strand');color(this.trim.emissive,'strand');this.trim.emissiveIntensity=.22*clamp(v.intensity,0,1.6)
      color(this.coreMaterial.color,'core');this.coreMaterial.emissive.copy(this.coreMaterial.color)
      const shared=exec.lightingEnvironment.lights,ambient=shared.find(l=>l.type==='ambient'),overhead=shared.find(l=>l.type==='point')
      this.ambient.intensity=(ambient?.intensity??.045)*Math.PI*2.4*(1-.55*s.silence)
      if(ambient)this.ambient.color.setRGB(ambient.color[0],ambient.color[1],ambient.color[2],T.SRGBColorSpace)
      this.overhead.intensity=(overhead?.intensity??.15)*Math.PI*105*(1-.7*s.silence)
      if(overhead){this.overhead.position.set(overhead.position[0],overhead.position[1],4);this.overhead.color.setRGB(overhead.color[0],overhead.color[1],overhead.color[2],T.SRGBColorSpace)}
      const size=quality==='low'?512:quality==='medium'?1024:2048,gain=clamp(v.projectionIntensity,0,1.6)*clamp(v.intensity,0,1.6)*(1-.88*s.silence)
      for(const [i,light] of this.lamps.entries()){
        const authored=shared.filter(l=>l.type==='spot')[i];light.position.set(...lightPosition(this.spec,s,i))
        if(authored)light.color.setRGB(authored.color[0],authored.color[1],authored.color[2],T.SRGBColorSpace)
        light.intensity=gain*(authored?.intensity??1)*1900*(1+.12*v.downbeatAccent+.14*s.flash*v.directorImpact)
        light.shadow.radius=clamp(v.shadowSoftness,0,3)
        if(size!==this.shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.set(size,size)}
      }
      this.shadowSize=size;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap
      applyCinema2CameraFrame(this.camera,exec.camera)
      ;(this.renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target,exec.target)
      this.target.viewport.set(0,0,exec.width,exec.height);this.target.scissor.set(0,0,exec.width,exec.height)
      this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera)
    }finally{this.renderer.shadowMap.enabled=shadowEnabled;this.renderer.shadowMap.type=shadowType;this.renderer.setRenderTarget(null);this.renderer.resetState();this.guard.restore()}
  }
  inspect(){return {structuralInstances:this.counts[0],secondaryInstances:this.counts[1],emissiveInstances:this.counts[2],overflow:this.overflow,architecture:this.spec.id,roomMeshes:this.roomMeshes,roomDrawCalls:this.roomDrawCalls,shadowMapSize:this.shadowSize,shadowLights:this.lamps.length}}
  estimateGpuBytes(){return CAPACITY*(64*3+12)+2*this.shadowSize*this.shadowSize*8+this.roomMeshes*2048+1024*1024}
  dispose(){if(this.disposed)return;this.disposed=true;for(const light of this.lamps)light.shadow.dispose();for(const mesh of [...this.batches,...this.architectureBatches])mesh.dispose();for(const m of this.materials)m.dispose();for(const g of this.geometries)g.dispose();this.scene.clear();this.target.dispose()}
}
