import type * as T from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { COLOSSUS_PALETTE, COLOSSUS_FLOOR_Y, HERO_RADIUS, HERO_OFFSET, colossusArmPose, type ArmInput, type Point } from './ColossusGeometry'

interface Placement { position:Point; scale:Point; rotation?:Point }
type Read = { n(key:string,fallback:number,min?:number,max?:number):number; text(key:string,fallback:string):string; on(key:string):boolean; color(key:keyof typeof COLOSSUS_PALETTE):readonly number[] }
interface Link { body:T.Mesh; inset:T.Mesh; rail:T.Mesh; flange:T.Mesh; cells:T.Mesh[]; piston:T.Mesh; sleeve:T.Mesh }
interface Arm { links:Link[]; shoulder:T.Group; elbow:T.Group; tool:T.Group; jaws:T.Mesh[] }
interface Hero { root:T.Object3D; matrix:T.Matrix4; center:T.Vector3; fit:number; materials:{material:T.MeshStandardMaterial; metalness:number; roughness:number; emissive:T.Color; emission:number}[] }
/** All mechanical geometry/materials are owned here; imported geometry/textures remain lease-owned. */
export class ColossusScene {
  private readonly batches=new Set<T.InstancedMesh>()
  private readonly details:T.Object3D[]=[]
  private readonly highDetails:T.Object3D[]=[]
  private readonly geometries=new Set<T.BufferGeometry>()
  private readonly materials=new Set<T.Material>()
  private readonly arms:Arm[]=[]
  private readonly ribs:T.Group[]=[]
  private readonly tracks:T.Mesh[]=[]
  private readonly towerCells:T.Mesh[]=[]
  private readonly defaultHero:Hero
  private imported:Hero|null=null
  private readonly metal:T.MeshStandardMaterial
  private readonly dark:T.MeshStandardMaterial
  private readonly accent:T.MeshStandardMaterial
  private readonly floor:T.MeshStandardMaterial
  private readonly casing:T.MeshStandardMaterial
  private readonly feed:T.MeshStandardMaterial
  private readonly returnChannel:T.MeshStandardMaterial
  private readonly pilot:T.MeshStandardMaterial
  private readonly heroLight:T.PointLight
  private readonly spillLights:T.PointLight[]=[]
  private readonly box:T.BoxGeometry
  private readonly cylinder:T.CylinderGeometry
  private readonly chamfer:T.ExtrudeGeometry
  private readonly v:T.Vector3
  private readonly v2:T.Vector3
  private readonly axis:T.Vector3
  private readonly quaternion:T.Quaternion
  private readonly transform:T.Matrix4
  private readonly translation:T.Matrix4
  private readonly rotation:T.Euler
  private readonly scale:T.Vector3
  private disposed=false
  constructor(private readonly library:Cinema2ThreeLibrary,root:T.Object3D){
    const {THREE}=library
    this.v=new THREE.Vector3();this.v2=new THREE.Vector3();this.axis=new THREE.Vector3(0,1,0);this.quaternion=new THREE.Quaternion();this.transform=new THREE.Matrix4();this.translation=new THREE.Matrix4();this.rotation=new THREE.Euler();this.scale=new THREE.Vector3()
    this.box=this.geometry(new THREE.BoxGeometry(1,1,1));this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,24))
    const profile=new THREE.Shape();profile.moveTo(-.38,-.5);profile.lineTo(.38,-.5);profile.lineTo(.5,-.38);profile.lineTo(.5,.38);profile.lineTo(.38,.5);profile.lineTo(-.38,.5);profile.lineTo(-.5,.38);profile.lineTo(-.5,-.38);profile.closePath()
    this.chamfer=this.geometry(new THREE.ExtrudeGeometry(profile,{depth:.88,bevelEnabled:true,bevelThickness:.06,bevelSize:.045,bevelSegments:1,steps:1}));this.chamfer.translate(0,0,-.44);this.chamfer.rotateX(Math.PI/2)
    this.metal=this.material(.34,.72,.34);this.dark=this.material(.025,.28,.76);this.accent=this.material(.8,.78,.26);this.floor=this.material(.085,.65,.28)
    this.casing=this.material(.16,.48,.48);this.feed=this.material(.08,.38,.4);this.returnChannel=this.material(.08,.38,.4);this.pilot=this.material(.08,.3,.5)
    // Separate the machinery chamber into a grounded deck, deep service bays and a distant reactor wall.
    const block=(parent:T.Object3D,mat:T.MeshStandardMaterial,position:Point,scale:Point,geo=this.box as T.BufferGeometry)=>{
      const mesh=this.mesh(parent,geo,mat);mesh.position.set(...position);mesh.scale.set(...scale);return mesh
    }
    block(root,this.floor,[0,COLOSSUS_FLOOR_Y-.16,-10],[29,.32,43])
    block(root,this.dark,[0,.8,-31],[25,14,.8])
    block(root,this.dark,[0,7.1,-14],[23,.7,35])
    for(const side of [-1,1])block(root,this.dark,[side*11.6,.5,-12],[.8,13,38])
    // Runway plates and recessed parallel channels carry perspective toward the rear, not a small circular stage.
    const slabs:Placement[]=[],seams:Placement[]=[],grates:Placement[]=[]
    for(let z=7;z>=-29;z-=3){
      slabs.push({position:[0,COLOSSUS_FLOOR_Y+.04,z],scale:[6.4,.08,2.92]})
      for(const side of [-1,1]){
        slabs.push({position:[side*5.8,COLOSSUS_FLOOR_Y+.04,z],scale:[4.4,.08,2.88]})
        seams.push({position:[side*3.65,COLOSSUS_FLOOR_Y+.095,z],scale:[.045,.035,2.1]})
        for(let k=0;k<5;k++)grates.push({position:[side*8.8,COLOSSUS_FLOOR_Y+.09,z-1+k*.48],scale:[1.7,.09,.12]})
      }
    }
    this.batch(root,this.box,this.floor,slabs);this.batch(root,this.box,this.feed,seams,false)
    this.details.push(this.batch(root,this.box,this.casing,grates,false))
    // Layered portal ribs: a solid load-bearing arch, stepped armor and narrow recessed light strips.
    const points:Point[]=[[-10.2,-5.1,0],[-10.2,2.8,0],[-7.6,6.05,0],[7.6,6.05,0],[10.2,2.8,0],[10.2,-5.1,0]]
    for(let i=0;i<7;i++){
      const rib=new THREE.Group();rib.name=`colossus-rib-${i}`;root.add(rib);this.ribs.push(rib)
      const shells:T.Matrix4[]=[],armor:T.Matrix4[]=[],rails:T.Matrix4[]=[],pilots:T.Matrix4[]=[]
      const dummy=new THREE.Object3D()
      const matrix=(a:Point,b:Point,w:number,d:number)=>{this.segment(dummy,a,b,w,d);dummy.updateMatrix();return dummy.matrix.clone()}
      for(let k=0;k<points.length-1;k++){
        const a=points[k]!,b=points[k+1]!,front=(q:Point,z:number):Point=>[q[0],q[1],z]
        shells.push(matrix(a,b,1.25,1.3))
        armor.push(matrix(front(a,.62),front(b,.62),.91,.46))
        rails.push(matrix(front(a,.89),front(b,.89),.22,.11))
        if(k!==2||i%2===0)pilots.push(matrix(front(a,.97),front(b,.97),.045,.045))
      }
      this.matrixBatch(rib,this.chamfer,this.dark,shells);this.matrixBatch(rib,this.chamfer,this.casing,armor);this.matrixBatch(rib,this.box,this.metal,rails);this.matrixBatch(rib,this.box,this.pilot,pilots,false)
    }
    // Recessed service machinery on both sides, massive front pilasters, overhead crane rails.
    for(const side of [-1,1]){
      const tower=new THREE.Group();tower.position.set(side*9.7,0,-5.4);root.add(tower)
      block(tower,this.casing,[0,.35,0],[2.05,10.1,2.4],this.chamfer)
      block(tower,this.dark,[-side*.48,.35,1.25],[1.04,8.8,.25])
      block(tower,this.metal,[-side*.96,.35,1.52],[.28,9.1,.32],this.chamfer)
      for(let k=0;k<10;k++){
        const cell=this.mesh(tower,this.box,this.material(.2,.2,.38));cell.position.set(-side*.48,-3.65+k*.87,1.42);cell.scale.set(.66,.18,.075);cell.castShadow=false;this.towerCells.push(cell)
      }
      const housings:Placement[]=[],vents:Placement[]=[],pipes:Placement[]=[],bolts:Placement[]=[]
      for(let z=-9;z>=-27;z-=4.5){
        housings.push({position:[side*10.65,-1.45,z],scale:[1.6,6.8,3.6]})
        for(let k=0;k<8;k++)vents.push({position:[side*9.76,-3.9+k*.53,z],scale:[.15,.15,2.6]})
        pipes.push({position:[side*9.2,4.1,z],scale:[.38,4.4,.38],rotation:[Math.PI/2,0,0]})
        for(let k=0;k<4;k++)bolts.push({position:[side*9.7,-3.85+k*1.65,z+1.55],scale:[.14,.18,.14],rotation:[0,0,Math.PI/2]})
      }
      this.batch(root,this.chamfer,this.casing,housings)
      this.details.push(this.batch(root,this.box,this.metal,vents,false),this.batch(root,this.cylinder,this.metal,pipes,false))
      this.highDetails.push(this.batch(root,this.cylinder,this.accent,bolts,false))
      block(root,this.casing,[side*7.6,.25,3.2],[1.8,11,2.1],this.chamfer)
      block(root,this.dark,[side*7.0,.25,3.85],[.48,9.4,.32])
      block(root,this.returnChannel,[side*6.75,.25,4.02],[.075,7.5,.08])
      block(root,this.casing,[side*5.8,6.3,-9],[1.3,.8,25],this.chamfer)
      block(root,this.dark,[side*5.8,5.83,-9],[.63,.18,25])
      block(root,this.feed,[side*5.8,5.7,-9],[.075,.055,24])
      const lamp=new THREE.PointLight(0x00d8e5,1,14,2);lamp.position.set(side*6.2,1.4,.7);root.add(lamp);this.spillLights.push(lamp)
    }
    // Distant stacked bulkhead machinery has an independent silhouette behind the hero.
    const rear:Placement[]=[],rearSlits:Placement[]=[]
    for(let x=-8;x<=8;x+=2){
      rear.push({position:[x,.7,-29.6],scale:[1.72,9.5,1.4]})
      rearSlits.push({position:[x,.7,-28.81],scale:[.065,7.8,.065]})
    }
    this.batch(root,this.chamfer,this.casing,rear);this.batch(root,this.box,this.pilot,rearSlits,false)
    for(let i=0;i<4;i++){
      const joint=()=>{const group=new THREE.Group();root.add(group);const hub=this.mesh(group,this.cylinder,this.metal);hub.rotation.x=Math.PI/2;hub.scale.set(.63,.82,.63);const ring=this.mesh(group,this.cylinder,this.dark);ring.rotation.x=Math.PI/2;ring.position.z=.46;ring.scale.set(.52,.16,.52);const cap=this.mesh(group,this.cylinder,this.accent);cap.rotation.x=Math.PI/2;cap.position.z=.58;cap.scale.set(.32,.13,.32);const core=this.mesh(group,this.cylinder,this.feed);core.rotation.x=Math.PI/2;core.position.z=.66;core.scale.set(.17,.06,.17);return group}
      const shoulder=joint(),elbow=joint(),tool=joint();shoulder.name=`colossus-shoulder-${i}`;elbow.name=`colossus-elbow-${i}`;tool.name=`colossus-tool-${i}`
      const links:Link[]=[]
      for(let j=0;j<2;j++){
        const body=this.mesh(root,this.chamfer,this.metal),inset=this.mesh(root,this.box,this.dark),rail=this.mesh(root,this.box,this.accent),flange=this.mesh(root,this.chamfer,this.casing)
        const cells=Array.from({length:8},()=>this.mesh(root,this.box,this.material(.2,.25,.35)))
        const piston=this.mesh(root,this.cylinder,this.accent),sleeve=this.mesh(root,this.cylinder,this.dark)
        cells.forEach(cell=>{cell.castShadow=false});links.push({body,inset,rail,flange,cells,piston,sleeve})
      }
      const jaws=[-1,1].map(()=>this.mesh(tool,this.chamfer,this.metal))
      this.arms.push({links,shoulder,elbow,tool,jaws})
    }
    for(const radius of [5.1,7.2])for(let i=0;i<36;i++){
      const a=i*Math.PI/18,b=a+.135
      const cell=this.mesh(root,this.box,this.material(.18,.25,.4));this.segment(cell,[radius*Math.cos(a),COLOSSUS_FLOOR_Y+.13,radius*Math.sin(a)-1.5],[radius*Math.cos(b),COLOSSUS_FLOOR_Y+.13,radius*Math.sin(b)-1.5],.08,.09);cell.castShadow=false;this.tracks.push(cell)
    }
    // An original open emblem with cutout and bevelled faces, rather than a third-party logo.
    const emblem=new THREE.Group();emblem.name='colossus-default-hero';root.add(emblem)
    const shape=new THREE.Shape();shape.moveTo(-2.65,-.78);shape.lineTo(-1.35,1.12);shape.lineTo(1.5,1.12);shape.lineTo(2.65,.05);shape.lineTo(1.35,-1.12);shape.lineTo(-1.5,-1.12);shape.closePath()
    const hole=new THREE.Path();hole.moveTo(-1.55,-.60);hole.lineTo(1.12,-.60);hole.lineTo(1.85,.05);hole.lineTo(1.22,.60);hole.lineTo(-1.1,.60);hole.lineTo(-1.78,-.52);hole.closePath();shape.holes.push(hole)
    const geo=this.geometry(new THREE.ExtrudeGeometry(shape,{depth:.40,bevelEnabled:true,bevelThickness:.09,bevelSize:.08,bevelSegments:2,steps:1,curveSegments:8}));geo.translate(0,0,-.2)
    const emblemMaterial=this.material(.67,.78,.27),sideMaterial=this.material(.19,.86,.29)
    const heroMesh=new THREE.Mesh(geo,[emblemMaterial,sideMaterial]);heroMesh.castShadow=true;heroMesh.receiveShadow=true;emblem.add(heroMesh)
    this.defaultHero=this.prepareHero(emblem)
    this.heroLight=new THREE.PointLight(0xeaf7ff,1,8,2);this.heroLight.position.set(0,2.5,4.7);root.add(this.heroLight)
  }
  private geometry<G extends T.BufferGeometry>(geo:G):G{this.geometries.add(geo);return geo}
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial){const mesh=new this.library.THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private batch(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial,placements:Placement[],shadow=true){
    const dummy=new this.library.THREE.Object3D()
    const matrices=placements.map(p=>{dummy.position.set(...p.position);dummy.scale.set(...p.scale);dummy.rotation.set(...(p.rotation??[0,0,0]));dummy.updateMatrix();return dummy.matrix.clone()})
    return this.matrixBatch(parent,geo,mat,matrices,shadow)
  }
  private matrixBatch(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial,matrices:T.Matrix4[],shadow=true){
    const mesh=new this.library.THREE.InstancedMesh(geo,mat,matrices.length)
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix))
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);this.batches.add(mesh);return mesh
  }
  private segment(mesh:T.Object3D,a:Point,b:Point,width:number,depth:number){this.v.set(...a);this.v2.set(...b).sub(this.v);const length=this.v2.length();mesh.position.copy(this.v).addScaledVector(this.v2,.5);mesh.quaternion.setFromUnitVectors(this.axis,this.v2.normalize());mesh.scale.set(width,length,depth)}
  private prepareHero(root:T.Object3D):Hero{
    const {THREE}=this.library;if(root.matrixAutoUpdate)root.updateMatrix();root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const radius=size.length()/2
    const fit=Number.isFinite(radius)&&radius>1e-6?Math.min(HERO_RADIUS/radius,5.7/Math.max(size.x,1e-6),4.8/Math.max(size.y,1e-6)):1
    const materials:Hero['materials']=[];const seen=new Set<T.Material>()
    root.traverse((object:T.Object3D)=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const m=material as T.MeshStandardMaterial;if(m.isMeshStandardMaterial&&!seen.has(m)){seen.add(m);materials.push({material:m,metalness:m.metalness,roughness:m.roughness,emissive:m.emissive.clone(),emission:m.emissiveIntensity})}}})
    const matrix=root.matrix.clone();root.matrixAutoUpdate=false;return {root,matrix,center,fit,materials}
  }
  attachModel(root:T.Object3D){this.imported=this.prepareHero(root)}
  detachModel(root:T.Object3D){if(this.imported?.root===root)this.imported=null}
  private tint(material:T.MeshStandardMaterial,color:readonly number[],emission=0){const {THREE}=this.library;material.color.setRGB(color[0]!,color[1]!,color[2]!,THREE.SRGBColorSpace);material.emissive.copy(material.color);material.emissiveIntensity=emission}
  private pulse(cell:T.Mesh,color:readonly number[],gain:number){this.tint(cell.material as T.MeshStandardMaterial,color,gain);(cell.material as T.MeshStandardMaterial).color.multiplyScalar(.26)}
  private poseHero(hero:Hero,p:Read,phase:number,safety:number,energy:number){
    const {THREE}=this.library;const motion=p.n('hero-motion',.2)*safety*(.7+.3*energy),f=hero.fit*p.n('model-scale',1,.5,1.2),rad=Math.PI/180
    this.rotation.set(p.n('model-pitch',0,-25,25)*rad+.025*motion*Math.sin(phase*.6),p.n('model-yaw',0,-180,180)*rad+.065*motion*Math.sin(phase*.4),p.n('model-roll',0,-20,20)*rad+.02*motion*Math.cos(phase*.5));this.quaternion.setFromEuler(this.rotation)
    this.v.set(p.n('model-x',0,-.2,.2)*HERO_OFFSET/.2,p.n('model-y',0,-.2,.2)*HERO_OFFSET/.2+.10*motion*Math.sin(phase*.7),p.n('model-z',0,-.2,.2)*HERO_OFFSET/.2);this.scale.setScalar(f)
    this.transform.compose(this.v,this.quaternion,this.scale).multiply(this.translation.makeTranslation(-hero.center.x,-hero.center.y,-hero.center.z)).multiply(hero.matrix);hero.root.matrix.copy(this.transform);hero.root.matrixWorldNeedsUpdate=true
    const mode=p.text('material-mode','original'),accent=p.color('accent')
    for(const item of hero.materials){const m=item.material;m.metalness=mode==='brushed'?Math.max(.8,item.metalness):item.metalness;m.roughness=mode==='brushed'?.32:item.roughness;m.emissive.copy(item.emissive);m.emissiveIntensity=item.emission;if(mode==='edge'){m.emissive.setRGB(accent[0]!,accent[1]!,accent[2]!,THREE.SRGBColorSpace);m.emissiveIntensity=.25*p.n('hero-emission',.2)}}
  }
  apply(p:Read,input:Omit<ArmInput,'phase'|'routePhase'>,phase:number,routePhase:number,quality:string){
    if(this.disposed)return
    const primary=p.color('primary'),secondary=p.color('secondary'),accent=p.color('accent'),structural=p.color('structural'),intensity=p.n('intensity',.75),spill=p.n('spill',.3),density=p.n('route-density',.55),width=p.n('pulse-width',.2,.05,.6),depth=p.n('bay-depth',1,.75,1.5),energy=p.n('energy',0)
    this.tint(this.metal,structural);this.metal.color.multiplyScalar(1.8)
    this.tint(this.casing,structural);this.casing.color.multiplyScalar(.62)
    this.tint(this.accent,accent);this.accent.color.multiplyScalar(.58)
    const reflection=p.n('reflection',.25)
    this.floor.envMapIntensity=reflection*2.4;this.metal.envMapIntensity=reflection*1.8;this.accent.envMapIntensity=reflection*1.8;this.casing.envMapIntensity=reflection*1.25
    // Steady guide lights in idle, cyan charging channels during builds, amber mechanical release on drops.
    this.tint(this.feed,primary,intensity*(.16+.9*input.build+.35*energy));this.feed.color.multiplyScalar(.18)
    this.tint(this.returnChannel,secondary,intensity*(.10+2.2*input.release+.35*input.snare));this.returnChannel.color.multiplyScalar(.14)
    this.tint(this.pilot,accent,intensity*(.08+.40*input.build+.55*input.release));this.pilot.color.multiplyScalar(.12)
    this.details.forEach(mesh=>{mesh.visible=quality!=='low'});this.highDetails.forEach(mesh=>{mesh.visible=quality==='high'})
    this.ribs.forEach((rib,i)=>{rib.position.z=-4.4-i*2.55*depth;rib.visible=quality!=='low'||i<5})
    const brightness=(q:number)=>{const distance=((q%1)+1)%1,activeWidth=width*density;return activeWidth>0&&distance<activeWidth?(1-distance/activeWidth)*intensity:0}
    this.arms.forEach((arm,i)=>{
      const pose=colossusArmPose(i,{...input,phase,routePhase});arm.shoulder.position.set(...pose.shoulder);arm.elbow.position.set(...pose.elbow);arm.tool.position.set(...pose.tip);arm.tool.rotation.z=Math.atan2(pose.tip[1],pose.tip[0]);
      arm.jaws.forEach((jaw,j)=>{jaw.position.set(-.24,(j?1:-1)*pose.jaw,.30);jaw.scale.set(.80,.22,.40);jaw.rotation.z=(j?1:-1)*.22})
      const endpoints=[pose.shoulder,pose.elbow,pose.tip]
      arm.links.forEach((link,j)=>{const a=endpoints[j]!,b=endpoints[j+1]!,off=(point:Point,z:number):Point=>[point[0],point[1],point[2]+z];this.segment(link.body,a,b,.94,.87);this.segment(link.inset,off(a,.48),off(b,.48),.65,.14);this.segment(link.rail,off(a,.58),off(b,.58),.055,.055);this.segment(link.flange,off(a,-.35),off(b,-.35),.61,.37)
        const travel=.58-.22*input.piston;const middle:Point=[a[0]+(b[0]-a[0])*travel,a[1]+(b[1]-a[1])*travel,a[2]+(b[2]-a[2])*travel-.64];this.segment(link.sleeve,off(a,-.64),middle,.23,.23);this.segment(link.piston,middle,off(b,-.64),.14,.14)
        link.cells.forEach((cell,k)=>{const t=(k+.5)/link.cells.length;cell.position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+.60);cell.quaternion.copy(link.body.quaternion);cell.scale.set(.38,.15,.07);cell.visible=quality!=='low'||k%2===0;this.pulse(cell,j===0?primary:secondary,.15+3.5*brightness((k+j*8)/16-pose.pulse)+.7*(j===0?input.kick:input.snare)*intensity+.45*(p.n('high',0)+p.n('air',0))*intensity)})
      })
    })
    this.towerCells.forEach((cell,i)=>this.pulse(cell,primary,.12+2.4*brightness(i/10-routePhase)))
    this.tracks.forEach((cell,i)=>{cell.visible=quality!=='low'||i%2===0;this.pulse(cell,i<36?secondary:accent,.10+2.4*brightness(i/36-routePhase*.7)+(p.n('downbeat',0)*.7+p.n('phrase',0)*.25)*intensity)})
    this.spillLights.forEach((light,i)=>{const c=i===0?primary:secondary;light.color.setRGB(c[0]!,c[1]!,c[2]!,this.library.THREE.SRGBColorSpace);light.intensity=spill*intensity*(12+9*energy+11*(i===0?input.build:input.release))})
    this.heroLight.color.setRGB(accent[0]!,accent[1]!,accent[2]!,this.library.THREE.SRGBColorSpace);this.heroLight.intensity=p.n('hero-emission',.2)*22;this.heroLight.visible=p.on('model-visible')
    this.defaultHero.root.visible=!this.imported&&p.on('model-visible');if(this.imported)this.imported.root.visible=p.on('model-visible');this.poseHero(this.imported??this.defaultHero,p,phase,input.safety,energy)
  }
  estimateAdditionalGpuBytes(){let bytes=0;for(const batch of this.batches)bytes+=batch.instanceMatrix.array.byteLength;return bytes}
  dispose(){if(this.disposed)return;this.disposed=true;this.batches.forEach(mesh=>mesh.dispose());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.imported=null}
}
