import type * as THREE from 'three'
import type {Cinema2ThreeLibrary} from '../three/Cinema2ThreeLibrary'
import {MOIRE_ORB_PATTERN_IDS,reactorCellPattern} from './MoireOrbPatterns'
export const REACTOR_CHAMBER_CELLS=144,REACTOR_CORE_CELLS=48
export interface ReactorSurfaces {steel:THREE.MeshStandardMaterial;plate:THREE.MeshStandardMaterial;black:THREE.MeshStandardMaterial;copper:THREE.MeshStandardMaterial}
/** Recessed equipment, containment machinery and addressable LED banks, batched without flattening their real depth. */
export class MoireOrbReactorDetail {
 private readonly geometries=new Set<THREE.BufferGeometry>()
 private readonly batches=new Set<THREE.InstancedMesh>()
 private readonly box:THREE.BoxGeometry
 private readonly cylinder:THREE.CylinderGeometry
 private readonly circle:THREE.CircleGeometry
 private readonly bolt:THREE.CylinderGeometry
 private readonly glass:THREE.MeshPhysicalMaterial
 private readonly dome:THREE.SphereGeometry
 private readonly plasma:THREE.MeshStandardMaterial
 private readonly field:THREE.MeshBasicMaterial
 private readonly nucleus:THREE.Group
 private readonly glow:THREE.MeshBasicMaterial
 private readonly chamberCells:THREE.InstancedMesh
 private readonly coreCells:THREE.InstancedMesh
 private readonly chamberGroup:THREE.Group
 private readonly coreGroup:THREE.Group
 private detailPieces=0
 constructor(private readonly library:Cinema2ThreeLibrary,environment:THREE.Group,core:THREE.Group,private readonly surfaces:ReactorSurfaces){
  const T=library.THREE
  this.box=this.geo(new T.BoxGeometry(1,1,1));this.cylinder=this.geo(new T.CylinderGeometry(1,1,1,12));this.circle=this.geo(new T.CircleGeometry(1,16));this.bolt=this.geo(new T.CylinderGeometry(1,1,1,6).rotateX(Math.PI/2))
  this.glass=new T.MeshPhysicalMaterial({color:'#beddf5',roughness:.1,metalness:.05,clearcoat:1,transparent:true,opacity:.17,depthWrite:false})
  this.dome=this.geo(new T.SphereGeometry(.275,16,10,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2))
  this.glow=new T.MeshBasicMaterial({color:'white'})
  this.chamberGroup=new T.Group();this.chamberGroup.name='reactor-layered-equipment-bays';environment.add(this.chamberGroup)
  this.plasma=new T.MeshStandardMaterial({color:'#24304b',emissive:'#343c9f',roughness:.28,metalness:.65,flatShading:true})
  this.field=new T.MeshBasicMaterial({color:'#394a99'})
  this.nucleus=new T.Group();this.nucleus.name='reactor-plasma-armature';core.add(this.nucleus)
  this.nucleus.add(new T.Mesh(this.geo(new T.IcosahedronGeometry(.88,1)),this.plasma))
  for(let coil=0;coil<3;coil++){const points=Array.from({length:49},(_,i)=>{const a=i*Math.PI*2/48;return new T.Vector3(Math.sin(a)*1.65,Math.sin(a*3)*.32,Math.cos(a)*1.65)}),mesh=new T.Mesh(this.geo(new T.TubeGeometry(new T.CatmullRomCurve3(points,true),72,.035,5,true)),this.field);mesh.rotation.set(coil*Math.PI/3,coil*.7,coil*Math.PI/3);this.nucleus.add(mesh)}
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const direction=new T.Vector3(x,y,z).normalize(),spoke=new T.Mesh(this.geo(new T.CylinderGeometry(.055,.09,.85,6)),surfaces.steel);spoke.position.copy(direction).multiplyScalar(1.5);spoke.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);this.nucleus.add(spoke)}
  this.coreGroup=new T.Group();this.coreGroup.name='reactor-containment-machinery';core.add(this.coreGroup)
  this.chamberCells=new T.InstancedMesh(this.box,this.glow,REACTOR_CHAMBER_CELLS);this.chamberCells.name='reactor-chamber-lighting-cells';environment.add(this.chamberCells);this.batches.add(this.chamberCells)
  this.coreCells=new T.InstancedMesh(this.box,this.glow,REACTOR_CORE_CELLS);this.coreCells.name='reactor-core-electrode-cells';core.add(this.coreCells);this.batches.add(this.coreCells)
  const scratch=new T.Object3D(),off=new T.Color(0,0,0)
  const cell=(mesh:THREE.InstancedMesh,index:number,position:THREE.Vector3,scale:THREE.Vector3,rotation:THREE.Quaternion)=>{scratch.position.copy(position);scratch.scale.copy(scale);scratch.quaternion.copy(rotation);scratch.updateMatrix();mesh.setMatrixAt(index,scratch.matrix);mesh.setColorAt(index,off)}
  // Three radial depth layers: deep backplates, protruding machinery, then service columns/frames.
  for(let bayIndex=0;bayIndex<12;bayIndex++){
   const a=bayIndex*Math.PI/6,bay=new T.Group();bay.name=`reactor-equipment-bay-${bayIndex}`;bay.position.set(Math.sin(a)*14.6,0,Math.cos(a)*14.6);bay.lookAt(0,0,0);this.chamberGroup.add(bay)
   this.block(bay,[0,0,-.6],[5.4,20.5,.7],surfaces.plate)
   for(const x of [-2.45,2.45]){
    this.block(bay,[x,0,.45],[.6,21.5,1.75],surfaces.black)
    this.pipe(bay,[x*.8,0,1.1],[.13,8.9,.13],surfaces.steel)
    for(const y of [-8.6,0,8.6])this.block(bay,[x,y,1.28],[.83,.42,.42],surfaces.copper)
   }
   for(const y of [-9.7,9.7]){this.block(bay,[0,y,.8],[5.3,.7,1.8],surfaces.black);this.block(bay,[0,y+.12,1.75],[4.3,.08,.12],surfaces.steel)}
   for(const y of [-6,0,6])for(const x of [-1.15,1.15]){
    const z=bayIndex%3===1?.55:1.05
    this.block(bay,[x,y,z],[1.75,2.5,1.25],surfaces.black)
    this.block(bay,[x,y,z+.64],[1.5,2.15,.12],surfaces.plate)
    for(let fin=0;fin<7;fin++)this.block(bay,[x,y-.78+fin*.26,z+.81],[1.37,.07,.32],surfaces.steel)
    for(const sx of [-.68,.68])for(const sy of [-.96,.96])this.fastener(bay,[x+sx,y+sy,z+.88],.065)
    if(bayIndex%3===0){const wheel=new T.Mesh(this.geo(new T.TorusGeometry(.34,.065,5,16)),surfaces.copper);wheel.position.set(x,y,z+1.02);bay.add(wheel);wheel.userData.reactorStatic=true;this.detailPieces++;for(let blade=0;blade<4;blade++){const b=this.block(bay,[x,y,z+1.02],[.52,.08,.14],surfaces.black);b.rotation.z=blade*Math.PI/4}}
   }
   // Front buttress is separated from the recessed backplate by almost three metres.
   const front=new T.Group();front.position.set(Math.sin(a)*11.8,0,Math.cos(a)*11.8);front.lookAt(0,0,0);this.chamberGroup.add(front)
   this.block(front,[0,0,0],[.65,19.8,.85],surfaces.black)
   for(const y of [-7.5,-3.7,3.7,7.5]){this.block(front,[0,y,.55],[1.0,.3,.5],surfaces.steel);this.pipe(front,[0,y,.9],[.18,.36,.18],surfaces.copper,new T.Euler(Math.PI/2,0,0))}
   bay.updateMatrixWorld(true)
   for(let side=0;side<2;side++)for(let row=0;row<4;row++){
    const local=new T.Vector3(side?2.07:-2.07,-6.9+row*4.6,1.42),index=bayIndex*8+side*4+row
    this.block(bay,local.toArray(),[.19,1.52,.16],surfaces.black)
    cell(this.chamberCells,index,local.clone().add(new T.Vector3(0,0,.12)).applyMatrix4(bay.matrixWorld),new T.Vector3(.065,1.16,.07),bay.quaternion)
   }
  }
  for(const side of [-1,1]){
   const deck=new T.Group();deck.position.y=side*10.7;this.chamberGroup.add(deck)
   const shape=new T.Shape();shape.absarc(0,0,14.5,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,5.3,0,Math.PI*2,true);shape.holes.push(hole)
   const plate=new T.Mesh(this.geo(new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:48}).rotateX(Math.PI/2)),surfaces.plate);plate.userData.reactorStatic=true;deck.add(plate)
   for(const radius of [5.45,8,11.5,14]){const rim=new T.Mesh(this.geo(new T.TorusGeometry(radius,.12,5,80).rotateX(Math.PI/2)),surfaces.steel);deck.add(rim);rim.userData.reactorStatic=true}
   for(let i=0;i<24;i++){
    const a=i*Math.PI/12,spoke=new T.Group();spoke.rotation.y=a;deck.add(spoke)
    this.block(spoke,[0,-side*.15,9.7],[.32,.34,8.5],surfaces.black)
    for(const r of [6.1,9,12.2]){this.block(spoke,[0,-side*.38,r],[.7,.22,1.0],surfaces.black);this.fastener(spoke,[0,-side*.53,r],.11)}
    const index=96+(side>0?24:0)+i
    cell(this.chamberCells,index,new T.Vector3(Math.sin(a)*10,side*10.33,Math.cos(a)*10),new T.Vector3(.13,.06,.85),new T.Quaternion().setFromEuler(new T.Euler(0,a,0)))
   }
  }
  // A larger original orb is backed by two toothed containment collars and six armoured electrode vanes.
  for(const side of [-1,1]){
   const collar=new T.Group();collar.position.y=side*1.45;this.coreGroup.add(collar)
   for(const [radius,tube,material]of [[3.32,.13,surfaces.black],[3.53,.055,surfaces.steel]] as const){const ring=new T.Mesh(this.geo(new T.TorusGeometry(radius,tube,6,96).rotateX(Math.PI/2)),material);ring.userData.reactorStatic=true;collar.add(ring)}
   for(let i=0;i<24;i++){
    const a=i*Math.PI/12,part=new T.Group();part.rotation.y=a;collar.add(part)
    this.block(part,[0,0,3.4],[.3,.36,.58],surfaces.black);this.block(part,[0,.15,3.56],[.36,.09,.23],surfaces.copper)
    this.fastener(part,[-.09,.05,3.71],.035);this.fastener(part,[.09,.05,3.71],.035)
    const index=(side>0?24:0)+i
    cell(this.coreCells,index,new T.Vector3(Math.sin(a)*3.735,side*1.45,Math.cos(a)*3.735),new T.Vector3(.18,.12,.055),new T.Quaternion().setFromEuler(new T.Euler(0,a,0)))
   }
   this.batch(collar)
  }
  for(let i=0;i<6;i++){
   const a=(i+.5)*Math.PI/3,vane=new T.Group();vane.rotation.y=a;this.coreGroup.add(vane)
   this.block(vane,[0,0,3.63],[.28,2.8,.5],surfaces.black)
   for(const y of [-1.05,-.35,.35,1.05]){this.block(vane,[0,y,3.94],[.48,.19,.18],surfaces.steel);this.fastener(vane,[0,y,4.06],.055)}
   this.pipe(vane,[.18,0,3.79],[.06,1.2,.06],surfaces.copper)
  }
  this.batch(this.chamberGroup);this.batch(this.coreGroup)
  this.chamberCells.instanceMatrix.needsUpdate=true;this.coreCells.instanceMatrix.needsUpdate=true
 }
 private geo<G extends THREE.BufferGeometry>(g:G):G{this.geometries.add(g);return g}
 private block(parent:THREE.Object3D,p:readonly number[],scale:readonly number[],material:THREE.Material){const mesh=new this.library.THREE.Mesh(this.box,material);mesh.position.set(p[0],p[1],p[2]);mesh.scale.set(scale[0],scale[1],scale[2]);mesh.userData.reactorStatic=true;parent.add(mesh);this.detailPieces++;return mesh}
 private pipe(parent:THREE.Object3D,p:readonly number[],scale:readonly number[],material:THREE.Material,rotation?:THREE.Euler){const mesh=new this.library.THREE.Mesh(this.cylinder,material);mesh.position.set(p[0],p[1],p[2]);mesh.scale.set(scale[0],scale[1],scale[2]);if(rotation)mesh.rotation.copy(rotation);mesh.userData.reactorStatic=true;parent.add(mesh);this.detailPieces++;return mesh}
 private fastener(parent:THREE.Object3D,p:readonly number[],radius:number){const mesh=new this.library.THREE.Mesh(this.bolt,this.surfaces.steel);mesh.position.set(p[0],p[1],p[2]);mesh.scale.set(radius,radius,.07);mesh.userData.reactorStatic=true;parent.add(mesh);this.detailPieces++;return mesh}
 /** A detailed moving optical head and a separate yawing yoke; every part remains true geometry. */
 fixture(head:THREE.Group,yoke:THREE.Group,mount:THREE.Group,lensMaterial:THREE.MeshBasicMaterial){
  const T=this.library.THREE,s=this.surfaces
  this.pipe(mount,[0,-.86,0],[.6,.13,.6],s.black);this.pipe(mount,[0,-.67,0],[.37,.12,.37],s.copper)
  this.block(yoke,[0,-.53,0],[1.22,.2,.55],s.black)
  for(const x of [-.57,.57]){this.block(yoke,[x,-.16,0],[.18,.83,.5],s.black);this.pipe(yoke,[x,.13,0],[.19,.12,.19],s.steel,new T.Euler(0,0,Math.PI/2))}
  this.pipe(head,[0,0,-.05],[.43,1.0,.43],s.black,new T.Euler(Math.PI/2,0,0))
  this.pipe(head,[0,0,-.56],[.37,.12,.37],s.steel,new T.Euler(Math.PI/2,0,0))
  for(const z of [-.38,-.17,.04,.25]){this.block(head,[0,.4,z],[.62,.09,.075],s.steel);for(const side of [-1,1])this.block(head,[side*.4,0,z],[.08,.6,.08],s.black)}
  const bezel=new T.Mesh(this.geo(new T.TorusGeometry(.35,.065,6,24)),s.steel);bezel.position.z=.53;bezel.userData.reactorStatic=true;head.add(bezel)
  for(let i=0;i<8;i++){const a=i*Math.PI/4;this.fastener(head,[Math.sin(a)*.34,Math.cos(a)*.34,.58],.035)}
  const lens=new T.Mesh(this.circle,lensMaterial);lens.scale.setScalar(.265);lens.position.z=.515;head.add(lens)
  const retainer=new T.Mesh(this.geo(new T.TorusGeometry(.22,.025,5,24)),s.copper);retainer.position.z=.54;retainer.userData.reactorStatic=true;head.add(retainer)
  for(let i=0;i<6;i++){const a=i*Math.PI/3,diode=new T.Mesh(this.circle,lensMaterial);diode.scale.setScalar(.035);diode.position.set(Math.sin(a)*.18,Math.cos(a)*.18,.545);head.add(diode)}
  for(const z of [-.35,-.14,.07]){const led=new T.Mesh(this.circle,lensMaterial);led.scale.setScalar(.018);led.position.set(.32,.25,z);led.rotation.y=Math.PI/2;head.add(led)}
  const glass=new T.Mesh(this.dome,this.glass);glass.position.z=.525;glass.scale.z=.28;head.add(glass)
  head.children.forEach(part=>{part.position.multiplyScalar(1.6);part.scale.multiplyScalar(1.6)});yoke.scale.setScalar(1.6);mount.scale.setScalar(1.6)
  this.batch(head);this.batch(yoke);this.batch(mount);return lens
 }
 private batch(root:THREE.Object3D){
  const T=this.library.THREE,groups=new Map<string,THREE.Mesh[]>();root.updateWorldMatrix(true,true)
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh||!mesh.userData.reactorStatic||Array.isArray(mesh.material))return;const key=`${mesh.geometry.uuid}:${mesh.material.uuid}`;const list=groups.get(key)??[];list.push(mesh);groups.set(key,list)})
  const inverse=root.matrixWorld.clone().invert()
  for(const meshes of groups.values()){
   if(meshes.length<2)continue
   const first=meshes[0],instance=new T.InstancedMesh(first.geometry,first.material as THREE.Material,meshes.length)
   meshes.forEach((mesh,i)=>{instance.setMatrixAt(i,new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));mesh.removeFromParent()});root.add(instance);this.batches.add(instance)
  }
 }
 draw(phase:number,weights:readonly number[],coreColor:THREE.Color,ringColor:THREE.Color,corePower:number,chamberPower:number,glow:number){
  this.nucleus.rotation.set(phase*.17,-phase*.11,phase*.08);this.plasma.emissive.copy(coreColor).multiplyScalar(glow*1.2);this.field.color.copy(coreColor).lerp(ringColor,.2).multiplyScalar(glow*.9)
  const T=this.library.THREE,scratch=new T.Color()
  for(let i=0;i<REACTOR_CHAMBER_CELLS;i++){
   const domain=i<96?'wall':'deck';let power=0
   MOIRE_ORB_PATTERN_IDS.forEach((id,j)=>{power+=reactorCellPattern(id,phase,domain,i)*(weights[j]??0)})
   this.chamberCells.setColorAt(i,scratch.copy(ringColor).multiplyScalar(power*chamberPower*1.45))
  }
  for(let i=0;i<REACTOR_CORE_CELLS;i++){
   let power=0;MOIRE_ORB_PATTERN_IDS.forEach((id,j)=>{power+=reactorCellPattern(id,phase,'core',i)*(weights[j]??0)})
   this.coreCells.setColorAt(i,scratch.copy(coreColor).lerp(ringColor,.3).multiplyScalar(power*corePower*1.65))
  }
  if(this.chamberCells.instanceColor)this.chamberCells.instanceColor.needsUpdate=true
  if(this.coreCells.instanceColor)this.coreCells.instanceColor.needsUpdate=true
 }
 inspect(){return {chamberCells:REACTOR_CHAMBER_CELLS,coreElectrodeCells:REACTOR_CORE_CELLS,equipmentBays:12,mechanicalDetailPieces:this.detailPieces+12,plasmaArmature:true,instancedDetailBatches:this.batches.size}}
 dispose(){this.batches.forEach(b=>b.dispose());this.geometries.forEach(g=>g.dispose());this.glow.dispose();this.glass.dispose();this.plasma.dispose();this.field.dispose();this.nucleus.removeFromParent();this.chamberGroup.removeFromParent();this.coreGroup.removeFromParent();this.chamberCells.removeFromParent();this.coreCells.removeFromParent()}
}
