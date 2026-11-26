import type * as T from 'three'
import { resolveCinema2ModelPresentation } from '../../model/Cinema2ModelPresentation'
import type { Cinema2LightingEnvironmentFrame } from '../../spatial/Cinema2LightingEnvironmentRuntime'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { EXOSKELETON_PALETTE, HERO_RADIUS, HERO_OFFSET, armorBankCounts, armorHalfExtent, armorPose, type ArmorInput } from './ExoskeletonGeometry'

type Read={n(key:string,fallback:number,min?:number,max?:number):number;text(key:string,fallback:string):string;on(key:string):boolean;color(key:keyof typeof EXOSKELETON_PALETTE):readonly number[]}
interface Hero {root:T.Object3D;matrix:T.Matrix4;center:T.Vector3;fit:number;box:T.Box3;materials:{material:T.MeshStandardMaterial;metalness:number;roughness:number;emissive:T.Color;emission:number}[]}
interface Plate { bank:number;index:number;count:number;station:T.Group;slide:T.Group;hinge:T.Group }
type Part = 'blade'|'liner'|'edge'|'channel'|'energy'|'rail'|'pin'|'joint'|'fastener'|'tip'
interface Batch {mesh:T.InstancedMesh;used:number}

const NEUTRAL_LIGHT: Cinema2Color = [1,1,1,1]

/** The engine's spot/point powers scale with range squared. The long-range armor rig
 * overwhelms the studio IBL at the small fitted hero. Keep the same positions, shadow
 * settings and resolved control authority, but use a restrained neutral key/fill in
 * Original mode. Never modify the shared frame or the authored palette. */
export function exoskeletonOriginalLighting(frame: Readonly<Cinema2LightingEnvironmentFrame>): Cinema2LightingEnvironmentFrame {
  return {...frame,lights:frame.lights.map(light=>{
    if(light.id==='exoskeleton-fill')return {...light,color:NEUTRAL_LIGHT,intensity:light.intensity*.8}
    if(light.id==='exoskeleton-key')return {...light,color:NEUTRAL_LIGHT,intensity:light.intensity*.22}
    if(light.id==='exoskeleton-rim')return {...light,color:NEUTRAL_LIGHT,intensity:light.intensity*.16}
    return light
  })}
}

/** Independent scene geometry; the Three bridge owns the leased model and cloned model materials. */
export class ExoskeletonScene {
  private readonly geometries=new Set<T.BufferGeometry>()
  private readonly materials=new Set<T.Material>()
  private readonly plates:Plate[]=[]
  private readonly batches=new Map<Part,Batch>()
  private readonly dummy:T.Object3D
  private readonly instanceMatrix:T.Matrix4
  private readonly hingeMatrix:T.Matrix4
  private readonly instanceColor:T.Color
  private readonly staticBatches:T.InstancedMesh[]=[]
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
    this.dummy=new THREE.Object3D();this.instanceMatrix=new THREE.Matrix4();this.hingeMatrix=new THREE.Matrix4();this.instanceColor=new THREE.Color()
    this.box=this.geometry(new THREE.BoxGeometry(1,1,1));this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,24))
    // Swept, bevelled blade profile; all vertices remain inside the unit hinge envelope.
    const profile=new THREE.Shape();profile.moveTo(-.30,-.46);profile.lineTo(.29,-.46);profile.lineTo(.46,-.18);profile.lineTo(.36,.27);profile.lineTo(.10,.46);profile.lineTo(-.32,.39);profile.lineTo(-.46,.05);profile.closePath()
    this.plateGeometry=this.geometry(new THREE.ExtrudeGeometry(profile,{depth:.84,bevelEnabled:true,bevelThickness:.08,bevelSize:.025,bevelSegments:2,steps:1,curveSegments:1}));this.plateGeometry.translate(0,0,.08)
    this.metal=this.material(.22,.68,.34);this.dark=this.material(.045,.42,.62);this.accent=this.material(.68,.72,.30);this.floor=this.material(.07,.58,.46);this.housing=this.material(.14,.54,.42)
    // Compact, open-backed service cradle. No enclosing room-scale cylinder or full rings.
    const floor=this.mesh(root,this.box,this.floor);floor.position.set(0,-3.65,-1.2);floor.scale.set(13,.16,15)
    const wall=this.mesh(root,this.box,this.dark);wall.position.set(0,0,-5.5);wall.scale.set(12,9,.24)
    const block=(mat:T.MeshStandardMaterial,x:number,y:number,z:number,w:number,h:number,d:number,roll=0)=>{const m=this.mesh(root,this.box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.z=roll;return m}
    for(const side of [-1,1]){
      block(this.metal,side*3.45,-.45,-2.65,.38,5.9,.75,side*-.13)
      block(this.dark,side*3.09,-.45,-2.20,.22,4.7,.18,side*-.13)
      block(this.housing,side*3.09,-.45,-2.08,.035,4.25,.035,side*-.13)
      block(this.metal,side*2.52,2.75,-3.2,.36,2.4,.58,side*.85)
      block(this.metal,side*2.55,-2.85,-3.2,.38,2.1,.72,side*-.85)
      block(this.dark,side*2.4,-3.5,-.6,1.05,.20,5.8)
      block(this.housing,side*2.4,-3.37,-.6,.045,.035,5.5)
    }
    const rearCells=new THREE.InstancedMesh(this.box,this.metal,32);rearCells.name='exoskeleton-service-fins';root.add(rearCells);this.staticBatches.push(rearCells)
    for(let i=0;i<32;i++){const side=i<16?-1:1,k=i%16;this.dummy.position.set(side*(3.65+(k%2)*.42),-2.9+Math.floor(k/2)*.78,-4.8);this.dummy.rotation.set(0,0,side*.18);this.dummy.scale.set(.35,.48,.5);this.dummy.updateMatrix();rearCells.setMatrixAt(i,this.dummy.matrix)}
    rearCells.instanceMatrix.needsUpdate=true;rearCells.computeBoundingSphere()
    const plinth=this.mesh(root,this.box,this.metal);plinth.position.set(0,-3.44,-.6);plinth.scale.set(3.5,.28,3.4)
    const deck=this.mesh(root,this.box,this.dark);deck.position.set(0,-3.24,-.6);deck.scale.set(2.65,.14,2.7)
    this.shell=new THREE.Group();this.shell.name='exoskeleton-adaptive-armor';root.add(this.shell)
    const energy=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:true});this.materials.add(energy)
    const add=(part:Part,geo:T.BufferGeometry,mat:T.Material,capacity:number,shadow=true)=>{
      const mesh=new THREE.InstancedMesh(geo,mat,capacity);mesh.name=`exoskeleton-${part}`;mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=shadow;mesh.receiveShadow=shadow;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.shell.add(mesh);this.batches.set(part,{mesh,used:0})
    }
    add('blade',this.plateGeometry,this.metal,48);add('liner',this.plateGeometry,this.dark,48)
    add('edge',this.plateGeometry,this.accent,48);add('channel',this.box,this.dark,48)
    add('energy',this.box,energy,48,false);add('tip',this.box,energy,48,false);add('rail',this.box,this.housing,48)
    add('pin',this.cylinder,this.accent,24);add('joint',this.cylinder,this.dark,48);add('fastener',this.cylinder,this.accent,96,false)
    // Allocate color attributes before the shared bridge precompiles shader variants.
    for(const part of ['energy','tip'] as const){const mesh=this.batches.get(part)!.mesh;mesh.setColorAt(0,this.instanceColor.setRGB(1,1,1));mesh.instanceColor?.setUsage(THREE.DynamicDrawUsage)}
    const core=new THREE.Group();root.add(core)
    const coreMesh=this.mesh(core,this.geometry(new THREE.IcosahedronGeometry(1.4,0)),this.material(.53,.62,.25));coreMesh.scale.set(.9,1.05,.72)
    const edgeMaterial=new THREE.LineBasicMaterial({color:0x48e8ff});const coreEdges=new THREE.LineSegments(this.geometry(new THREE.EdgesGeometry(coreMesh.geometry)),edgeMaterial);this.materials.add(edgeMaterial);coreEdges.scale.copy(coreMesh.scale).multiplyScalar(1.006);core.add(coreEdges)
    this.defaultHero=this.prepareHero(core)
    for(const x of [-3.2,3.2]){const lamp=new THREE.PointLight(0x48e8ff,1,8,2);lamp.name=`exoskeleton-spill-${x<0?'left':'right'}`;lamp.position.set(x,.8,1.2);root.add(lamp);this.spillLights.push(lamp)}
    this.heroLight=new THREE.PointLight(0xe8f1ff,1,8,2);this.heroLight.name='exoskeleton-hero-light';this.heroLight.position.set(0,2,3.5);root.add(this.heroLight)
  }
  private geometry<G extends T.BufferGeometry>(geo:G):G{this.geometries.add(geo);return geo}
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial):T.Mesh{const mesh=new this.library.THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private prepareHero(root:T.Object3D,imported=false):Hero{
    const {THREE}=this.library;if(root.matrixAutoUpdate)root.updateMatrix();root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const radius=size.length()/2
    const fit=Number.isFinite(radius)&&radius>1e-6?Math.min(HERO_RADIUS/radius,3.3/Math.max(size.x,1e-6),3.3/Math.max(size.y,1e-6)):1
    const materials:Hero['materials']=[];const seen=new Set<T.Material>()
    root.traverse((object:T.Object3D)=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;const slots=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      // Three's ordinary depth shadow is opaque for blended/transmissive surfaces.
      // Keep opaque meshes and opaque alpha-tested cutouts as casters, not glass silhouettes.
      mesh.castShadow=!imported||slots.every(material=>!material.transparent&&((material as T.MeshPhysicalMaterial).transmission??0)===0);mesh.receiveShadow=true;for(const material of slots){const m=material as T.MeshStandardMaterial;if(m.isMeshStandardMaterial&&!seen.has(m)){seen.add(m);materials.push({material:m,metalness:m.metalness,roughness:m.roughness,emissive:m.emissive.clone(),emission:m.emissiveIntensity})}}})
    const matrix=root.matrix.clone();root.matrixAutoUpdate=false;return {root,matrix,center,fit,materials,box}
  }
  attachModel(root:T.Object3D){this.imported=this.prepareHero(root,true)}
  usesOriginalImportedLighting(mode:unknown){return this.imported!==null&&resolveCinema2ModelPresentation(mode)==='original'}
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
    for(const plate of this.plates)this.shell.remove(plate.station)
    this.plates.length=0;this.count=count
    const {THREE}=this.library
    armorBankCounts(count).forEach((n,bank)=>{for(let index=0;index<n;index++){
      const station=new THREE.Group(),slide=new THREE.Group(),hinge=new THREE.Group();this.shell.add(station);station.add(slide);slide.add(hinge)
      if(bank===0)station.rotation.y=-Math.PI/2;else if(bank===1)station.rotation.y=Math.PI/2;else if(bank===2)station.rotation.x=-Math.PI/2;else if(bank===3)station.rotation.x=Math.PI/2;else station.rotation.y=Math.PI
      this.plates.push({bank,index,count:n,station,slide,hinge})
    }})
  }
  // All matrices are shell-local, so the shared hero center is applied exactly once.
  private part(part:Part,parent:T.Matrix4,x:number,y:number,z:number,w:number,h:number,d:number,rx=0,ry=0,rz=0,color?:T.Color){
    const batch=this.batches.get(part)!;this.dummy.position.set(x,y,z);this.dummy.rotation.set(rx,ry,rz);this.dummy.scale.set(w,h,d);this.dummy.updateMatrix();this.instanceMatrix.multiplyMatrices(parent,this.dummy.matrix)
    batch.mesh.setMatrixAt(batch.used,this.instanceMatrix);if(color)batch.mesh.setColorAt(batch.used,color);batch.used++
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
    const aperture=p.n('front-aperture',.72,.5,1),depth=Math.max(.12,z*(2.3-.65*aperture)),front=-z+depth,thickness=p.n('plate-thickness',.05,.02,.12),gap=p.n('seam-gap',.035,.01,.1)
    const poseInput={...input,phase,routePhase}
    for(const batch of this.batches.values())batch.used=0
    for(const plate of this.plates){
      const {bank,index,count,station,slide,hinge}=plate
      let width:number,length:number
      if(bank<2){station.position.set(bank===0?-x:x,0,(front-z)/2);width=depth;length=2*y}
      else if(bank<4){station.position.set(0,bank===2?y:-y,(front-z)/2);width=2*x;length=depth}
      else{station.position.set(0,0,-z);width=2*x;length=2*y}
      const pitch=length/count,cell=Math.max(.025,pitch-Math.min(gap,pitch*.35)),w=Math.max(.035,width-Math.min(gap,width*.2)),origin=-length/2+index*pitch+(pitch-cell)/2
      const pose=armorPose(index,bank,poseInput),travel=bank===3?Math.min(pose.travel,.30):pose.travel
      // Hinge starts outward of the conservative model box. The positive Y blade envelope
      // rotates toward positive Z; the only negative Z parts are tiny, bounded pin radii.
      slide.position.set(0,origin,.105+travel);hinge.rotation.x=pose.angle
      station.updateMatrix();slide.updateMatrix();hinge.updateMatrix()
      const fixed=this.transform.copy(station.matrix),carriage=this.translation.multiplyMatrices(fixed,slide.matrix),moving=this.hingeMatrix.multiplyMatrices(carriage,hinge.matrix)
      const bladeWidth=w*.34,bladeLength=cell*.87,bladeDepth=thickness*1.7
      const gain=p.n('interior-emission',.55)*intensity*(.45+1.9*pose.pulse+.15*(p.n('high',0)+p.n('air',0))+.38*p.n('downbeat',0)+.20*p.n('phrase',0))
      const c=index%3===0?secondary:primary;this.instanceColor.setRGB(c[0]!,c[1]!,c[2]!,THREE.SRGBColorSpace).multiplyScalar(gain*2.4)
      for(const side of [-1,1]){
        const bx=side*w*.28,stagger=side===1?.06:0
        // A split rib with a dark underlayer, bevelled outer blade and raised edge spine.
        this.part('liner',moving,bx,cell*.48,.014,bladeWidth*1.12,bladeLength,bladeDepth*.52)
        this.part('blade',moving,bx,cell*(.47+stagger),.025+bladeDepth*.48,bladeWidth,bladeLength*.90,bladeDepth)
        this.part('edge',moving,bx+side*bladeWidth*.26,cell*.49,.025+bladeDepth*1.48,bladeWidth*.16,bladeLength*.65,Math.max(.012,thickness*.28))
        // Dark channel sits below the luminous insert and above the surrounding plate.
        this.part('channel',moving,bx,cell*.54,.032+bladeDepth*1.48,bladeWidth*.19,bladeLength*.62,.024)
        this.part('energy',moving,bx,cell*.54,.045+bladeDepth*1.48,bladeWidth*.055,bladeLength*.56,.009,0,0,0,this.instanceColor)
        // A narrow end-cap light wraps the edge, readable even from the open front.
        this.part('tip',moving,bx+side*bladeWidth*.34,cell*.30,.028+bladeDepth*.72,bladeWidth*.07,bladeLength*.24,bladeDepth*.36,0,0,0,this.instanceColor)
        this.part('rail',fixed,bx,origin+.035,.055+travel*.5,Math.min(.10,bladeWidth*.32),.07,.10+travel)
        this.part('joint',carriage,bx,0,.015,.058,.095,.058,0,0,Math.PI/2)
        if(quality!=='low')for(const end of quality==='high'?[.22,.70]:[.22])this.part('fastener',moving,bx+side*bladeWidth*.18,cell*end,.04+bladeDepth*1.48,.018,.016,.018,Math.PI/2)
      }
      this.part('pin',carriage,0,0,.025,.034,w*.78,.034,0,0,Math.PI/2)
    }
    for(const batch of this.batches.values()){batch.mesh.count=batch.used;batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true}
    // Three point lights illuminate every mesh in the scene, not just the armor.
    // Original keeps armor emissive strips colored, while direct illumination stays
    // neutral and bounded even when shared choreography drives spill on a drop.
    const original=this.usesOriginalImportedLighting(p.text('material-mode','original'))
    this.spillLights.forEach((light,i)=>{const c=original?NEUTRAL_LIGHT:i===0?primary:secondary;light.color.setRGB(c[0]!,c[1]!,c[2]!,THREE.SRGBColorSpace);light.intensity=spill*intensity*(original?1.8+.6*energy:8+5*energy)})
    const heroColor=original?NEUTRAL_LIGHT:accent
    this.heroLight.color.setRGB(heroColor[0]!,heroColor[1]!,heroColor[2]!,THREE.SRGBColorSpace);this.heroLight.intensity=p.n('hero-emission',.2)*(original?4:14);this.heroLight.visible=p.on('model-visible')
  }
  estimateAdditionalGpuBytes(){
    let bytes=0
    for(const {mesh} of this.batches.values())bytes+=mesh.instanceMatrix.array.byteLength+(mesh.instanceColor?.array.byteLength??0)
    for(const mesh of this.staticBatches)bytes+=mesh.instanceMatrix.array.byteLength
    return bytes
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.batches.forEach(b=>b.mesh.dispose());this.staticBatches.forEach(b=>b.dispose());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.imported=null;this.plates.length=0}
}
