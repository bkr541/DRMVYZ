import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { applyCinema2CameraFrame } from '../three/Cinema2ThreeCameraLightMapping'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { clamp, organismBranchPoint, organismChildPoint, organismIllumination, organismLightPosition, type OrganismState, type Point } from './Cinema2OrganismDomain'

const CAPACITY = 4600
const ROOM_RADIUS = 14, FLOOR = -6.4, CEILING = 10.8
interface ExternalFramebufferRenderer { setRenderTargetFramebuffer(target:Three.WebGLRenderTarget, framebuffer:WebGLFramebuffer):void }
/** Procedural scene on the existing Cinema 2.0 Three host; no separate canvas or clock. */
export class Cinema2OrganismRenderer {
  private readonly scene:Three.Scene
  private readonly camera:Three.PerspectiveCamera
  private readonly target:Three.WebGLRenderTarget
  private readonly renderer:Three.WebGLRenderer
  private readonly guard:Cinema2GlStateGuard
  private readonly metal:Three.MeshStandardMaterial
  private readonly walls:Three.MeshStandardMaterial
  private readonly ribs:Three.MeshStandardMaterial
  private readonly floorMaterial:Three.MeshStandardMaterial
  private readonly coreMaterial:Three.MeshStandardMaterial
  private readonly core:Three.Mesh
  private readonly structural:Three.InstancedMesh
  private readonly luminous:Three.InstancedMesh
  private readonly lamps:Three.SpotLight[]=[]
  private readonly roomBatches:Three.InstancedMesh[]=[]
  private readonly geometries = new Set<Three.BufferGeometry>()
  private readonly materials = new Set<Three.Material>()
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
  private counts=[0,0]

  constructor(gl:WebGL2RenderingContext, private readonly library:Cinema2ThreeLibrary) {
    const T=library.THREE
    this.guard=new Cinema2GlStateGuard(gl)
    this.guard.capture()
    try { this.renderer=getCinema2ThreeRenderer(library,gl).renderer } finally { this.guard.restore() }
    this.scene=new T.Scene(); this.camera=new T.PerspectiveCamera()
    this.target=new T.WebGLRenderTarget(1,1,{depthBuffer:true})
    ;(this.target as unknown as {isXRRenderTarget:boolean}).isXRRenderTarget=true
    this.target.texture.colorSpace=T.SRGBColorSpace
    this.matrix=new T.Matrix4(); this.a=new T.Vector3(); this.b=new T.Vector3(); this.d=new T.Vector3(); this.mid=new T.Vector3()
    this.axis=new T.Vector3(0,1,0); this.scale=new T.Vector3(); this.rotation=new T.Quaternion(); this.tint=new T.Color(); this.glowTint=new T.Color()
    this.metal=this.material(new T.MeshStandardMaterial({roughness:.38,metalness:.4}))
    this.walls=this.material(new T.MeshStandardMaterial({roughness:.88,metalness:.08,side:T.DoubleSide}))
    this.ribs=this.material(new T.MeshStandardMaterial({roughness:.62,metalness:.25}))
    this.floorMaterial=this.material(new T.MeshStandardMaterial({roughness:.42,metalness:.38}))
    this.coreMaterial=this.material(new T.MeshStandardMaterial({roughness:.3,metalness:.12}))
    const lit=this.material(new T.MeshBasicMaterial({color:0xffffff}))
    const rod=this.geometry(new T.CylinderGeometry(1,1,1,5,1))
    this.structural=new T.InstancedMesh(rod,this.metal,CAPACITY)
    this.luminous=new T.InstancedMesh(rod,lit,CAPACITY)
    for(const mesh of [this.structural,this.luminous]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count=0; mesh.frustumCulled=false; mesh.castShadow=true
      // Self-shadows on the steel keep the dense core legible; emissive bars don't need to receive.
      mesh.receiveShadow=mesh===this.structural; this.scene.add(mesh)
    }
    this.core=new T.Mesh(this.geometry(new T.IcosahedronGeometry(.56,2)),this.coreMaterial)
    this.scene.add(this.core); this.core.castShadow=true
    this.buildRoom()
    this.ambient=new T.AmbientLight(0xffffff,.06); this.scene.add(this.ambient)
    this.overhead=new T.PointLight(0xffffff,35,28,2); this.overhead.position.set(0,9,0); this.scene.add(this.overhead)
    for(let i=0;i<2;i++) {
      const light=new T.SpotLight(0xffffff,1000,38,Math.PI*.40,.29,2)
      light.target.position.set(0,0,0); light.castShadow=true; light.shadow.bias=-.00018; light.shadow.normalBias=.012
      light.shadow.camera.near=.25; light.shadow.camera.far=38
      this.lamps.push(light); this.scene.add(light,light.target)
    }
  }
  private geometry<T extends Three.BufferGeometry>(g:T):T { this.geometries.add(g);return g }
  private material<T extends Three.Material>(m:T):T {this.materials.add(m);return m}
  private mesh(g:Three.BufferGeometry,m:Three.Material,position:Point,scale:Point=[1,1,1]):Three.Mesh {
    const mesh=new this.library.THREE.Mesh(g,m); mesh.position.set(...position); mesh.scale.set(...scale); mesh.receiveShadow=true; this.scene.add(mesh);return mesh
  }
  private buildRoom():void {
    const T=this.library.THREE
    // Inward-facing cylindrical facets receive real shadows; ribs are sculpted over the surface.
    const shell=this.geometry(new T.CylinderGeometry(ROOM_RADIUS,ROOM_RADIUS,CEILING-FLOOR,48,1,true))
    this.mesh(shell,this.walls,[0,(CEILING+FLOOR)/2,0])
    const floorMat=this.floorMaterial
    const floor=this.mesh(this.geometry(new T.CircleGeometry(ROOM_RADIUS,64)),floorMat,[0,FLOOR,0]);floor.rotation.x=-Math.PI/2
    const ceiling=this.mesh(this.geometry(new T.RingGeometry(2.4,ROOM_RADIUS,64)),this.walls,[0,CEILING,0]);ceiling.rotation.x=Math.PI/2
    const box=this.geometry(new T.BoxGeometry(1,1,1)), rod=this.geometry(new T.CylinderGeometry(1,1,1,7,1))
    const trim=this.material(new T.MeshStandardMaterial({color:0x414956,emissive:0x8ca7c2,emissiveIntensity:.55,metalness:.3,roughness:.5}))
    const archBatch=new T.InstancedMesh(rod,this.ribs,16*12);archBatch.receiveShadow=true;this.scene.add(archBatch);this.roomBatches.push(archBatch)
    // Sixteen curved skeletal arches bend inward above and below each wall bay, not a flat box.
    for(let i=0;i<16;i++) {
      const az=i*Math.PI/8, points:Point[]=[]
      for(let j=0;j<=12;j++) {
        const t=j/12, y=FLOOR+.1+(CEILING-FLOOR-.2)*t, r=ROOM_RADIUS-.48-2.1*Math.pow(Math.abs(2*t-1),3)
        points.push([Math.cos(az+.06*Math.sin(t*Math.PI))*r,y,Math.sin(az+.06*Math.sin(t*Math.PI))*r])
      }
      for(let j=1;j<points.length;j++) {
        this.setRodMatrix(points[j-1]!,points[j]!,.17+.09*Math.abs(j/6-1));archBatch.setMatrixAt(i*12+j-1,this.matrix)
      }
      const p=this.mesh(box,trim,[Math.cos(az)*11.35,FLOOR+.30,Math.sin(az)*11.35],[.12,.18,.80]);p.rotation.y=-az
    }
    archBatch.instanceMatrix.needsUpdate=true
    const ring=this.geometry(new T.TorusGeometry(4.8,.045,5,96))
    const ringMesh=this.mesh(ring,trim,[0,FLOOR+.025,0]);ringMesh.rotation.x=Math.PI/2
    const ring2=this.mesh(this.geometry(new T.TorusGeometry(5.2,.035,5,96)),this.ribs,[0,FLOOR+.025,0]);ring2.rotation.x=Math.PI/2
    const plinth=this.mesh(this.geometry(new T.CylinderGeometry(5.1,5.25,.16,64)),floorMat,[0,FLOOR+.04,0]);plinth.receiveShadow=true
  }
  private setRodMatrix(p:Point,q:Point,r:number):void {
    this.a.set(...p);this.b.set(...q);this.d.subVectors(this.b,this.a);const length=this.d.length()
    if(length<.0001)return
    this.mid.addVectors(this.a,this.b).multiplyScalar(.5);this.rotation.setFromUnitVectors(this.axis,this.d.normalize());this.scale.set(r,length,r);this.matrix.compose(this.mid,this.rotation,this.scale)
  }
  private emit(p:Point,q:Point,r:number,lit:boolean,energy=1):void {
    this.a.set(...p);this.b.set(...q);this.d.subVectors(this.b,this.a);const length=this.d.length()
    const slot=lit?1:0,index=this.counts[slot]!
    if(length<.0001||index>=CAPACITY||r<.001)return
    const mesh=lit?this.luminous:this.structural
    this.mid.addVectors(this.a,this.b).multiplyScalar(.5);this.rotation.setFromUnitVectors(this.axis,this.d.normalize());this.scale.set(r,length,r)
    this.matrix.compose(this.mid,this.rotation,this.scale);mesh.setMatrixAt(index,this.matrix)
    if(lit){this.tint.copy(this.glowTint).multiplyScalar(Math.max(.025,energy));mesh.setColorAt(index,this.tint)}
    this.counts[slot]=index+1
  }
  /** Three triangular rails plus diagonals. Every brace is a solid occluder, not a line shader. */
  private truss(points:readonly Point[],width:number,branch:number,state:OrganismState,child:boolean):void {
    const gain=clamp(state.values.intensity,0,1.6)*(1-.87*state.silence)
    let previous:Point[]|null=null
    for(let j=0;j<points.length;j++) {
      const p=points[j]!,t=j/(points.length-1),q=points[Math.min(j+1,points.length-1)]!,r=points[Math.max(j-1,0)]!
      const dx=q[0]-r[0],dy=q[1]-r[1],dz=q[2]-r[2],len=Math.hypot(dx,dy,dz)
      if(len<.0001)continue
      // Basis perpendicular to the branch tangent; continuous except the deliberate nonparallel fallback.
      let ux=-dz,uy=0,uz=dx,ul=Math.hypot(ux,uz)
      if(ul<.0001){ux=0;uy=-dz;uz=dy;ul=Math.hypot(uy,uz)}
      ux/=ul;uy/=ul;uz/=ul
      const vx=(dy*uz-dz*uy)/len,vy=(dz*ux-dx*uz)/len,vz=(dx*uy-dy*ux)/len
      const taper=width*(.22+.78*Math.pow(1-t,.7)), next:Point[]=[]
      for(let k=0;k<3;k++){
        const a=k*Math.PI*2/3+branch*.4+t*.55,c=Math.cos(a)*taper,s=Math.sin(a)*taper
        next.push([p[0]+ux*c+vx*s,p[1]+uy*c+vy*s,p[2]+uz*c+vz*s])
      }
      const thickness=clamp(state.values.strandThickness,.014,.065)*(child?.65:1)*(.45+.55*(1-t))
      const illumination=organismIllumination(state,branch,t)*gain*2.8
      for(let k=0;k<3;k++){
        this.emit(next[k]!,next[(k+1)%3]!,thickness*.75,false)
        if(previous){
          this.emit(previous[k]!,next[k]!,thickness,k===(branch+j)%3,illumination)
          this.emit(previous[k]!,next[(k+1)%3]!,thickness*.64,(k+j+branch)%5===0,illumination*.65)
        }
      }
      previous=next
    }
  }
  private buildOrganism(state:OrganismState,quality:string):void {
    this.counts=[0,0]
    const T=this.library.THREE,v=state.values,core=clamp(v.coreScale,.7,1.3),gain=clamp(v.intensity,0,1.6)*(1-.87*state.silence)
    this.glowTint.setRGB(state.palette.strand[0],state.palette.strand[1],state.palette.strand[2],T.SRGBColorSpace)
    this.metal.color.setRGB(state.palette.metal[0],state.palette.metal[1],state.palette.metal[2],T.SRGBColorSpace)
    this.coreMaterial.color.setRGB(state.palette.core[0],state.palette.core[1],state.palette.core[2],T.SRGBColorSpace)
    this.coreMaterial.emissive.copy(this.coreMaterial.color)
    this.coreMaterial.emissiveIntensity=gain*(1.2+.4*v.overallEnergy+.32*v.directorIntensity+.25*state.flash*v.kickAccent+.25*v.dropAccent)
    this.core.scale.setScalar(core*(1+state.motion*(.06*v.subAmount+.06*v.dropAccent)))
    // Nested open triangulated cages retain a clear central silhouette.
    const segments=quality==='low'?10:14,rings=5
    const cage=(radius:number,offset:number)=>{
      const points:Point[][]=[]
      for(let j=0;j<=rings;j++){
        const e=-Math.PI*.43+Math.PI*.86*j/rings,ring:Point[]=[]
        for(let k=0;k<segments;k++){
          const a=k*Math.PI*2/segments+offset+(j%2)*Math.PI/segments+state.phase*.07*state.motion
          ring.push([Math.cos(a)*Math.cos(e)*radius,Math.sin(e)*radius,Math.sin(a)*Math.cos(e)*radius])
        }
        points.push(ring)
      }
      for(let j=0;j<=rings;j++)for(let k=0;k<segments;k++){
        const p=points[j]![k]!,q=points[j]![(k+1)%segments]!,r=clamp(v.strandThickness,.014,.065)
        this.emit(p,q,r,(k+j)%3===0,gain*1.9)
        if(j<rings){this.emit(p,points[j+1]![k]!,r*.8,(k+j)%4===0,gain*2.1);this.emit(p,points[j+1]![(k+1)%segments]!,r*.65,false)}
      }
    }
    cage(core*1.13,0);cage(core*.76,.38)
    const mainSteps=quality==='low'?8:quality==='medium'?11:15,childSteps=quality==='low'?4:quality==='medium'?6:8
    for(let i=0;i<12;i++){
      const points=Array.from({length:mainSteps+1},(_,j)=>organismBranchPoint(state,i,j/mainSteps))
      this.truss(points,.27,i,state,false)
      if(v.growth>.006)for(const child of [-1,1] as const){
        const childPoints=Array.from({length:childSteps+1},(_,j)=>organismChildPoint(state,i,child,j/childSteps))
        this.truss(childPoints,.13,i+child*3,state,true)
      }
    }
    for(const [i,mesh] of [this.structural,this.luminous].entries()) {mesh.count=this.counts[i]!;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}
  }
  draw(exec:Cinema2ModuleRenderExecutionContext,state:OrganismState):void {
    if(this.disposed)return
    if(!exec.target||!exec.depthAvailable||!exec.camera||!exec.lightingEnvironment)throw new Error('ORGANISM requires the shared world camera, light frame and depth target')
    const T=this.library.THREE,quality=exec.lightingEnvironment.quality,v=state.values
    const shadowEnabled=this.renderer.shadowMap.enabled,shadowType=this.renderer.shadowMap.type
    this.guard.capture()
    try{
      this.renderer.resetState()
      this.buildOrganism(state,quality)
      this.walls.color.setRGB(state.palette.wall[0],state.palette.wall[1],state.palette.wall[2],T.SRGBColorSpace)
      this.ribs.color.copy(this.walls.color).multiplyScalar(.58)
      this.floorMaterial.color.setRGB(state.palette.background[0],state.palette.background[1],state.palette.background[2],T.SRGBColorSpace).multiplyScalar(3.5)
      const shared=exec.lightingEnvironment.lights
      const ambient=shared.find(l=>l.type==='ambient'),overhead=shared.find(l=>l.type==='point')
      this.ambient.intensity=(ambient?.intensity??.035)*Math.PI*(1-.65*state.silence)
      if(ambient)this.ambient.color.setRGB(ambient.color[0],ambient.color[1],ambient.color[2],T.SRGBColorSpace)
      this.overhead.intensity=(overhead?.intensity??.12)*Math.PI*80*(1-.8*state.silence)
      if(overhead){this.overhead.position.set(...overhead.position);this.overhead.color.setRGB(overhead.color[0],overhead.color[1],overhead.color[2],T.SRGBColorSpace)}
      const size=quality==='low'?256:quality==='medium'?512:1024
      const gain=clamp(v.projectionIntensity,0,1.6)*clamp(v.intensity,0,1.6)*(1-.90*state.silence)
      for(const [i,light] of this.lamps.entries()){
        const authored=shared.filter(l=>l.type==='spot')[i]
        light.position.set(...organismLightPosition(state,i))
        if(authored)light.color.setRGB(authored.color[0],authored.color[1],authored.color[2],T.SRGBColorSpace)
        light.intensity=gain*(authored?.intensity??1)*1100*(1+.15*v.downbeatAccent+.13*state.flash*v.directorImpact)
        light.shadow.radius=clamp(v.shadowSoftness,0,3)
        if(size!==this.shadowSize){light.shadow.map?.dispose();light.shadow.map=null;light.shadow.mapSize.set(size,size)}
      }
      this.shadowSize=size
      this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap
      applyCinema2CameraFrame(this.camera,exec.camera)
      ;(this.renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target,exec.target)
      this.target.viewport.set(0,0,exec.width,exec.height);this.target.scissor.set(0,0,exec.width,exec.height)
      this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera)
    }finally{this.renderer.shadowMap.enabled=shadowEnabled;this.renderer.shadowMap.type=shadowType;this.renderer.setRenderTarget(null);this.renderer.resetState();this.guard.restore()}
  }
  inspect(){return {structuralInstances:this.counts[0],emissiveInstances:this.counts[1],shadowMapSize:this.shadowSize,shadowLights:this.lamps.length}}
  estimateGpuBytes():number{return CAPACITY*(64*2+12)+2*this.shadowSize*this.shadowSize*8+1024*1024}
  dispose():void{
    if(this.disposed)return;this.disposed=true
    for(const light of this.lamps)light.shadow.dispose()
    this.structural.dispose();this.luminous.dispose();for(const batch of this.roomBatches)batch.dispose()
    for(const m of this.materials)m.dispose();for(const g of this.geometries)g.dispose()
    this.scene.clear();this.target.dispose()
  }
}
