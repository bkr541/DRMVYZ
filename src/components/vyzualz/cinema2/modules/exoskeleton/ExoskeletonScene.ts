import type * as T from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { EXOSKELETON_PALETTE, HERO_RADIUS, HERO_OFFSET, armorBankCounts, armorHalfExtent, armorPose, type ArmorInput } from './ExoskeletonGeometry'

type Read={n(key:string,fallback:number,min?:number,max?:number):number;text(key:string,fallback:string):string;on(key:string):boolean;color(key:keyof typeof EXOSKELETON_PALETTE):readonly number[]}
interface Hero {root:T.Object3D;matrix:T.Matrix4;center:T.Vector3;fit:number;box:T.Box3;materials:{material:T.MeshStandardMaterial;metalness:number;roughness:number;emissive:T.Color;emission:number}[]}
interface Plate { bank:number;index:number;count:number;station:T.Group;slide:T.Group;hinge:T.Group;body:T.Mesh;inner:T.Mesh;seam:T.Mesh;rail:T.Mesh;pin:T.Mesh;emission:T.MeshStandardMaterial }

/** Independent scene geometry; the Three bridge owns the leased model and cloned model materials. */
export class ExoskeletonScene {
  private readonly geometries=new Set<T.BufferGeometry>()
  private readonly materials=new Set<T.Material>()
  private readonly plates:Plate[]=[]
  private readonly defaultHero:Hero
  private imported:Hero|null=null
  private readonly metal:T.MeshStandardMaterial
  private readonly dark:T.MeshStandardMaterial
  private readonly accent:T.MeshStandardMaterial
  private readonly floor:T.MeshStandardMaterial
  private readonly housing:T.MeshStandardMaterial
  private readonly heroLight:T.PointLight
  private readonly spillLights:T.PointLight[]=[]
  private readonly box:T.BoxGeometry
  private readonly plateGeometry:T.ExtrudeGeometry
  private readonly cylinder:T.CylinderGeometry
  private readonly shell:T.Group
  private readonly v:T.Vector3
  private readonly quaternion:T.Quaternion
  private readonly transform:T.Matrix4
  private readonly translation:T.Matrix4
  private readonly rotation:T.Euler
  private readonly scale:T.Vector3
  private readonly bounds:T.Box3
  private readonly center:T.Vector3
  private readonly extent:T.Vector3
  private readonly fitTransform:T.Matrix4
  private count=0
  private disposed=false
  constructor(private readonly library:Cinema2ThreeLibrary,root:T.Object3D){
    const {THREE}=library
    this.v=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.transform=new THREE.Matrix4();this.translation=new THREE.Matrix4();this.rotation=new THREE.Euler();this.scale=new THREE.Vector3();this.bounds=new THREE.Box3();this.center=new THREE.Vector3();this.extent=new THREE.Vector3();this.fitTransform=new THREE.Matrix4()
    this.box=this.geometry(new THREE.BoxGeometry(1,1,1));this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,24))
    const profile=new THREE.Shape();profile.moveTo(-.42,-.48);profile.lineTo(.42,-.48);profile.lineTo(.48,-.33);profile.lineTo(.48,.33);profile.lineTo(.32,.48);profile.lineTo(-.32,.48);profile.lineTo(-.48,.33);profile.lineTo(-.48,-.33);profile.closePath()
    this.plateGeometry=this.geometry(new THREE.ExtrudeGeometry(profile,{depth:.88,bevelEnabled:true,bevelThickness:.06,bevelSize:.018,bevelSegments:2,steps:1,curveSegments:1}));this.plateGeometry.translate(0,0,.06)
    this.metal=this.material(.16,.80,.32);this.dark=this.material(.028,.55,.55);this.accent=this.material(.68,.76,.27);this.floor=this.material(.09,.65,.45);this.housing=this.material(.18,.55,.38)
    const floor=this.mesh(root,this.box,this.floor);floor.position.set(0,-4.15,-2);floor.scale.set(18,.2,20)
    const wall=this.mesh(root,this.box,this.dark);wall.position.set(0,0,-5.8);wall.scale.set(12,12,.25)
    for(const x of [-5.6,5.6]){const side=this.mesh(root,this.box,this.dark);side.position.set(x,0,-2.8);side.scale.set(.35,12,6.3)}
    const hex=this.geometry(new THREE.TorusGeometry(1,.075,4,6));const bay=this.geometry(new THREE.CylinderGeometry(1,1,.18,6))
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const x=(col-2)*1.95+(row%2?.65:0),y=(row-2)*1.74
      const recess=this.mesh(root,bay,this.dark);recess.rotation.x=Math.PI/2;recess.position.set(x,y,-5.54);recess.scale.set(.84,1,.84)
      const frame=this.mesh(root,hex,this.metal);frame.position.set(x,y,-5.25);frame.scale.setScalar(.94);frame.rotation.z=Math.PI/6
    }
    // Vertical chamber ribs, ring and service plinth, separate from moving shell.
    for(let i=0;i<6;i++){const a=(i+1)*Math.PI/4;const rib=this.mesh(root,this.box,this.metal);rib.position.set(4.65*Math.cos(a),.1,4.0*Math.sin(a)-2.9);rib.scale.set(.20,8.4,.29);const stripe=this.mesh(root,this.box,this.housing);stripe.position.copy(rib.position);stripe.position.z+=.18;stripe.scale.set(.045,7.8,.045)}
    for(const y of [-3.97,4.1]){const ring=this.mesh(root,this.geometry(new THREE.TorusGeometry(3.8,.13,8,64)),this.metal);ring.rotation.x=Math.PI/2;ring.position.set(0,y,-.3)}
    for(const [y,r,h] of [[-4.02,3.15,.22],[-3.84,2.85,.18],[-3.70,2.45,.10]] as const){const plinth=this.mesh(root,this.cylinder,this.metal);plinth.position.set(0,y,0);plinth.scale.set(r,h,r)}
    for(let i=0;i<24;i++){const a=i*Math.PI/12;const cell=this.mesh(root,this.box,this.housing);cell.position.set(2.66*Math.cos(a),-3.73,2.66*Math.sin(a));cell.rotation.y=-a;cell.scale.set(.06,.06,.36)}
    this.shell=new THREE.Group();root.add(this.shell)
    const core=new THREE.Group();root.add(core)
    const coreMesh=this.mesh(core,this.geometry(new THREE.IcosahedronGeometry(1.4,0)),this.material(.53,.62,.25));coreMesh.scale.set(.9,1.05,.72)
    const edgeMaterial=new THREE.LineBasicMaterial({color:0x48e8ff});const coreEdges=new THREE.LineSegments(this.geometry(new THREE.EdgesGeometry(coreMesh.geometry)),edgeMaterial);this.materials.add(edgeMaterial);coreEdges.scale.copy(coreMesh.scale).multiplyScalar(1.006);core.add(coreEdges)
    this.defaultHero=this.prepareHero(core)
    for(const x of [-3.2,3.2]){const lamp=new THREE.PointLight(0x48e8ff,1,8,2);lamp.position.set(x,.8,1.2);root.add(lamp);this.spillLights.push(lamp)}
    this.heroLight=new THREE.PointLight(0xe8f1ff,1,8,2);this.heroLight.position.set(0,2,3.5);root.add(this.heroLight)
  }
  private geometry<G extends T.BufferGeometry>(geo:G):G{this.geometries.add(geo);return geo}
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial):T.Mesh{const mesh=new this.library.THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private prepareHero(root:T.Object3D):Hero{
    const {THREE}=this.library;if(root.matrixAutoUpdate)root.updateMatrix();root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const radius=size.length()/2
    const fit=Number.isFinite(radius)&&radius>1e-6?Math.min(HERO_RADIUS/radius,3.3/Math.max(size.x,1e-6),3.3/Math.max(size.y,1e-6)):1
    const materials:Hero['materials']=[];const seen=new Set<T.Material>()
    root.traverse((object:T.Object3D)=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const m=material as T.MeshStandardMaterial;if(m.isMeshStandardMaterial&&!seen.has(m)){seen.add(m);materials.push({material:m,metalness:m.metalness,roughness:m.roughness,emissive:m.emissive.clone(),emission:m.emissiveIntensity})}}})
    const matrix=root.matrix.clone();root.matrixAutoUpdate=false;return {root,matrix,center,fit,materials,box}
  }
  attachModel(root:T.Object3D){this.imported=this.prepareHero(root)}
  detachModel(root:T.Object3D){if(this.imported?.root===root)this.imported=null}
  private tint(material:T.MeshStandardMaterial,color:readonly number[],emission=0){const {THREE}=this.library;material.color.setRGB(color[0]!,color[1]!,color[2]!,THREE.SRGBColorSpace);material.emissive.copy(material.color);material.emissiveIntensity=emission}

  private poseHero(hero:Hero,p:Read,phase:number,safety:number,energy:number){
    const {THREE}=this.library;const motion=p.n('hero-motion',.2)*safety*(.7+.3*energy),f=hero.fit*p.n('model-scale',1,.5,1.2),rad=Math.PI/180
    this.rotation.set(p.n('model-pitch',0,-25,25)*rad+.025*motion*Math.sin(phase*.6),p.n('model-yaw',0,-180,180)*rad+.065*motion*Math.sin(phase*.4),p.n('model-roll',0,-20,20)*rad+.02*motion*Math.cos(phase*.5));this.quaternion.setFromEuler(this.rotation)
    this.v.set(p.n('model-x',0,-.2,.2)*HERO_OFFSET/.2,p.n('model-y',0,-.2,.2)*HERO_OFFSET/.2+.10*motion*Math.sin(phase*.7),p.n('model-z',0,-.2,.2)*HERO_OFFSET/.2);this.scale.setScalar(f)
    this.fitTransform.compose(this.v,this.quaternion,this.scale).multiply(this.translation.makeTranslation(-hero.center.x,-hero.center.y,-hero.center.z));hero.root.matrix.copy(this.transform.copy(this.fitTransform).multiply(hero.matrix));hero.root.matrixWorldNeedsUpdate=true
    const mode=p.text('material-mode','original'),accent=p.color('accent')
    for(const item of hero.materials){const m=item.material;m.metalness=mode==='brushed'?Math.max(.8,item.metalness):item.metalness;m.roughness=mode==='brushed'?.32:item.roughness;m.emissive.copy(item.emissive);m.emissiveIntensity=item.emission;if(mode==='edge'){m.emissive.setRGB(accent[0]!,accent[1]!,accent[2]!,THREE.SRGBColorSpace);m.emissiveIntensity=.25*p.n('hero-emission',.2)}}
  }
  private rebuild(count:number){
    if(count===this.count)return
    for(const plate of this.plates){this.shell.remove(plate.station);this.materials.delete(plate.emission);plate.emission.dispose()}
    this.plates.length=0;this.count=count
    const {THREE}=this.library
    armorBankCounts(count).forEach((n,bank)=>{for(let index=0;index<n;index++){
      const station=new THREE.Group(),slide=new THREE.Group(),hinge=new THREE.Group();this.shell.add(station);station.add(slide);slide.add(hinge)
      if(bank===0)station.rotation.y=-Math.PI/2;else if(bank===1)station.rotation.y=Math.PI/2;else if(bank===2)station.rotation.x=-Math.PI/2;else if(bank===3)station.rotation.x=Math.PI/2;else station.rotation.y=Math.PI
      const body=this.mesh(hinge,this.plateGeometry,this.metal);body.material=[this.metal,this.accent]
      const inner=this.mesh(hinge,this.plateGeometry,this.dark)
      const emission=this.material(.2,.2,.35),seam=this.mesh(hinge,this.box,emission),rail=this.mesh(station,this.box,this.housing),pin=this.mesh(slide,this.cylinder,this.accent);pin.rotation.z=Math.PI/2
      this.plates.push({bank,index,count:n,station,slide,hinge,body,inner,seam,rail,pin,emission})
    }})
  }
  apply(p:Read,input:Omit<ArmorInput,'phase'|'routePhase'>,phase:number,routePhase:number,quality:string){
    if(this.disposed)return
    const {THREE}=this.library,primary=p.color('primary'),secondary=p.color('secondary'),accent=p.color('accent'),structural=p.color('structural'),intensity=p.n('intensity',.75),energy=p.n('energy',0),spill=p.n('spill',.3)
    this.tint(this.metal,structural);this.tint(this.accent,accent);this.tint(this.housing,secondary,.12+p.n('interior-emission',.55)*.4*intensity)
    for(const material of [this.floor,this.metal,this.accent])material.envMapIntensity=p.n('reflection',.25)*1.8
    const hero=this.imported??this.defaultHero;this.defaultHero.root.visible=!this.imported&&p.on('model-visible');if(this.imported)this.imported.root.visible=p.on('model-visible');this.poseHero(hero,p,phase,input.safety,energy)
    // The cached world-space AABB includes original root transforms. Transform its corners by the instance pose, not by the asset matrix twice.
    this.bounds.copy(hero.box).applyMatrix4(this.fitTransform);this.bounds.getCenter(this.center);this.bounds.getSize(this.extent).multiplyScalar(.5)
    if(this.bounds.isEmpty()||!Number.isFinite(this.extent.lengthSq())){this.center.set(0,0,0);this.extent.set(1,1,1)}
    const largest=Math.max(this.extent.x,this.extent.y,this.extent.z,.35),clearance=p.n('shell-clearance',.2,.12,.4)
    const x=armorHalfExtent(this.extent.x,largest,clearance),y=armorHalfExtent(this.extent.y,largest,clearance),z=armorHalfExtent(this.extent.z,largest,clearance)
    this.shell.position.copy(this.center);this.rebuild(Number(p.text('plate-count','18'))===12?12:Number(p.text('plate-count','18'))===24?24:18)
    const aperture=p.n('front-aperture',.72,.5,1),depth=Math.max(.12,z*(2-aperture)),front=-z+depth,thickness=p.n('plate-thickness',.05,.02,.12),gap=p.n('seam-gap',.035,.01,.1)
    for(const plate of this.plates){
      const {bank,index,count,station,slide,hinge,body,inner,seam,rail,pin}=plate
      // All plates start outside the box. Local +Z always points away from it; local Y begins at a hinge, so a positive hinge angle never moves inward.
      let width:number,length:number
      if(bank<2){station.position.set(bank===0?-x:x,0,(front-z)/2);width=depth;length=2*y}
      else if(bank<4){station.position.set(0,bank===2?y:-y,(front-z)/2);width=2*x;length=depth}
      else{station.position.set(0,0,-z);width=2*x;length=2*y}
      const pitch=length/count,cell=Math.max(.025,pitch-Math.min(gap,pitch*.35)),w=Math.max(.035,width-Math.min(gap,width*.2)),origin=-length/2+index*pitch+(pitch-cell)/2
      const pose=armorPose(index,bank,{...input,phase,routePhase});const travel=bank===3?Math.min(pose.travel,.30):pose.travel
      slide.position.set(0,origin,.06+travel);hinge.rotation.x=pose.angle
      body.position.set(0,cell*.5,.02);body.scale.set(w,cell,thickness)
      inner.position.set(0,cell*.5,0);inner.scale.set(w*.89,cell*.83,.025)
      seam.position.set(0,cell*.82,.02+thickness+.008);seam.scale.set(w*.78,Math.min(.025,cell*.16),.012)
      rail.position.set(0,origin+.025,.06+travel*.5);rail.scale.set(w*.85,.035,.12+travel)
      pin.position.set(0,0,.03);pin.scale.set(.045,w*.67,.045)
      const gain=p.n('interior-emission',.55)*intensity*(.45+1.9*pose.pulse+.15*(p.n('high',0)+p.n('air',0))+.38*p.n('downbeat',0)+.20*p.n('phrase',0))
      this.tint(plate.emission,index%3===0?secondary:primary,gain);plate.emission.color.multiplyScalar(.35);pin.visible=quality!=='low'||index%2===0
    }
    this.spillLights.forEach((light,i)=>{const c=i===0?primary:secondary;light.color.setRGB(c[0]!,c[1]!,c[2]!,THREE.SRGBColorSpace);light.intensity=spill*intensity*(8+5*energy)})
    this.heroLight.color.setRGB(accent[0]!,accent[1]!,accent[2]!,THREE.SRGBColorSpace);this.heroLight.intensity=p.n('hero-emission',.2)*14;this.heroLight.visible=p.on('model-visible')
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.imported=null;this.plates.length=0}
}
