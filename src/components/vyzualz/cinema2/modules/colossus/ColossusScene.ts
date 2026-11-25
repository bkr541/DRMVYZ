import type * as T from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { COLOSSUS_PALETTE, HERO_RADIUS, HERO_OFFSET, colossusArmPose, type ArmInput, type Point } from './ColossusGeometry'

type Read = { n(key:string,fallback:number,min?:number,max?:number):number; text(key:string,fallback:string):string; on(key:string):boolean; color(key:keyof typeof COLOSSUS_PALETTE):readonly number[] }
interface Link { body:T.Mesh; inset:T.Mesh; rail:T.Mesh; cells:T.Mesh[]; piston:T.Mesh; sleeve:T.Mesh }
interface Arm { links:Link[]; shoulder:T.Group; elbow:T.Group; tool:T.Group; jaws:T.Mesh[] }
interface Hero { root:T.Object3D; matrix:T.Matrix4; center:T.Vector3; fit:number; materials:{material:T.MeshStandardMaterial; metalness:number; roughness:number; emissive:T.Color; emission:number}[] }
/** All mechanical geometry/materials are owned here; imported geometry/textures remain lease-owned. */
export class ColossusScene {
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
    this.box=this.geometry(new THREE.BoxGeometry(1,1,1));this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,12))
    const profile=new THREE.Shape();profile.moveTo(-.38,-.5);profile.lineTo(.38,-.5);profile.lineTo(.5,-.38);profile.lineTo(.5,.38);profile.lineTo(.38,.5);profile.lineTo(-.38,.5);profile.lineTo(-.5,.38);profile.lineTo(-.5,-.38);profile.closePath()
    this.chamfer=this.geometry(new THREE.ExtrudeGeometry(profile,{depth:1,bevelEnabled:false,steps:1}));this.chamfer.translate(0,0,-.5);this.chamfer.rotateX(Math.PI/2)
    this.metal=this.material(.34,.75,.34);this.dark=this.material(.035,.6,.48);this.accent=this.material(.8,.65,.27);this.floor=this.material(.13,.72,.38)
    const platform=this.mesh(root,this.box,this.floor);platform.position.set(0,-4.25,-1);platform.scale.set(24,.2,27)
    const ceiling=this.mesh(root,this.box,this.dark);ceiling.position.set(0,4.85,-5);ceiling.scale.set(24,.5,18)
    const back=this.mesh(root,this.box,this.dark);back.position.set(0,.2,-21);back.scale.set(23,11,.55)
    for(const side of [-1,1]){const wall=this.mesh(root,this.box,this.dark);wall.position.set(side*9.3,.2,-8);wall.scale.set(.55,9.1,28)}
    // Successive octagonal bulkheads, each with a darker recessed return and raised rails.
    const points:Point[]=[[-6,-4.1,0],[6,-4.1,0],[9,-2,0],[9,2,0],[6,4.55,0],[-6,4.55,0],[-9,2,0],[-9,-2,0]]
    for(let i=0;i<7;i++){
      const rib=new THREE.Group();root.add(rib);this.ribs.push(rib)
      for(let k=0;k<points.length;k++){
        const a=points[k]!,b=points[(k+1)%points.length]!
        this.segment(this.mesh(rib,this.box,this.dark),a,b,.65,.74)
        this.segment(this.mesh(rib,this.box,this.metal),[a[0],a[1],.43],[b[0],b[1],.43],.28,.20)
        if(k%2===0)this.segment(this.mesh(rib,this.box,this.accent),[a[0],a[1],.55],[b[0],b[1],.55],.035,.04)
      }
    }
    for(const side of [-1,1]){
      const tower=new THREE.Group();tower.position.set(side*7.6,0,-2.4);root.add(tower)
      const shell=this.mesh(tower,this.chamfer,this.metal);shell.scale.set(1.25,7.8,1.3)
      const face=this.mesh(tower,this.box,this.dark);face.position.z=.72;face.scale.set(.86,7.4,.16)
      for(let k=0;k<10;k++){
        const cell=this.mesh(tower,this.box,this.material(.2,.2,.38));cell.position.set(0,-3.35+k*.72,.83);cell.scale.set(.62,.22,.065);this.towerCells.push(cell)
      }
      const lamp=new THREE.PointLight(0x00d8e5,1,11,2);lamp.position.set(side*5,1,1);root.add(lamp);this.spillLights.push(lamp)
    }
    for(let i=0;i<4;i++){
      const joint=()=>{const group=new THREE.Group();root.add(group);const hub=this.mesh(group,this.cylinder,this.metal);hub.rotation.x=Math.PI/2;hub.scale.set(.42,.66,.42);const cap=this.mesh(group,this.cylinder,this.accent);cap.rotation.x=Math.PI/2;cap.position.z=.37;cap.scale.set(.23,.11,.23);return group}
      const shoulder=joint(),elbow=joint(),tool=joint()
      const links:Link[]=[]
      for(let j=0;j<2;j++){
        const body=this.mesh(root,this.chamfer,this.metal),inset=this.mesh(root,this.box,this.dark),rail=this.mesh(root,this.box,this.accent)
        const cells=Array.from({length:8},()=>this.mesh(root,this.box,this.material(.2,.25,.35)))
        const piston=this.mesh(root,this.cylinder,this.accent),sleeve=this.mesh(root,this.cylinder,this.dark)
        links.push({body,inset,rail,cells,piston,sleeve})
      }
      const jaws=[-1,1].map(()=>this.mesh(tool,this.box,this.metal))
      this.arms.push({links,shoulder,elbow,tool,jaws})
    }
    for(const radius of [4.7,6.3])for(let i=0;i<36;i++){
      const a=i*Math.PI/18,b=a+.135
      const cell=this.mesh(root,this.box,this.material(.18,.25,.4));this.segment(cell,[radius*Math.cos(a),-4.10,radius*Math.sin(a)-1.5],[radius*Math.cos(b),-4.10,radius*Math.sin(b)-1.5],.08,.09);this.tracks.push(cell)
    }
    // An original open emblem with cutout and bevelled faces, rather than a third-party logo.
    const emblem=new THREE.Group();root.add(emblem)
    const shape=new THREE.Shape();shape.moveTo(-2.65,-.78);shape.lineTo(-1.35,1.12);shape.lineTo(1.5,1.12);shape.lineTo(2.65,.05);shape.lineTo(1.35,-1.12);shape.lineTo(-1.5,-1.12);shape.closePath()
    const hole=new THREE.Path();hole.moveTo(-1.55,-.60);hole.lineTo(1.12,-.60);hole.lineTo(1.85,.05);hole.lineTo(1.22,.60);hole.lineTo(-1.1,.60);hole.lineTo(-1.78,-.52);hole.closePath();shape.holes.push(hole)
    const geo=this.geometry(new THREE.ExtrudeGeometry(shape,{depth:.40,bevelEnabled:true,bevelThickness:.09,bevelSize:.08,bevelSegments:2,steps:1,curveSegments:8}));geo.translate(0,0,-.2)
    const emblemMaterial=this.material(.67,.78,.27),sideMaterial=this.material(.19,.86,.29)
    const heroMesh=new THREE.Mesh(geo,[emblemMaterial,sideMaterial]);heroMesh.castShadow=true;heroMesh.receiveShadow=true;emblem.add(heroMesh)
    this.defaultHero=this.prepareHero(emblem)
    this.heroLight=new THREE.PointLight(0xeaf7ff,1,8,2);this.heroLight.position.set(0,2,3.5);root.add(this.heroLight)
  }
  private geometry<G extends T.BufferGeometry>(geo:G):G{this.geometries.add(geo);return geo}
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.MeshStandardMaterial){const mesh=new this.library.THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private segment(mesh:T.Mesh,a:Point,b:Point,width:number,depth:number){this.v.set(...a);this.v2.set(...b).sub(this.v);const length=this.v2.length();mesh.position.copy(this.v).addScaledVector(this.v2,.5);mesh.quaternion.setFromUnitVectors(this.axis,this.v2.normalize());mesh.scale.set(width,length,depth)}
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
    this.tint(this.metal,structural);this.tint(this.accent,accent);this.floor.envMapIntensity=p.n('reflection',.25)*1.8;this.metal.envMapIntensity=p.n('reflection',.25)*1.8;this.accent.envMapIntensity=p.n('reflection',.25)*1.8
    this.ribs.forEach((rib,i)=>{rib.position.z=-3.2-i*1.65*depth;rib.visible=quality!=='low'||i<5})
    const brightness=(q:number)=>{const distance=((q%1)+1)%1,activeWidth=width*density;return activeWidth>0&&distance<activeWidth?(1-distance/activeWidth)*intensity:0}
    this.arms.forEach((arm,i)=>{
      const pose=colossusArmPose(i,{...input,phase,routePhase});arm.shoulder.position.set(...pose.shoulder);arm.elbow.position.set(...pose.elbow);arm.tool.position.set(...pose.tip);arm.tool.rotation.z=Math.atan2(pose.tip[1],pose.tip[0]);
      arm.jaws.forEach((jaw,j)=>{jaw.position.set(-.03,(j?1:-1)*pose.jaw,.36);jaw.scale.set(.48,.15,.32);jaw.rotation.z=(j?1:-1)*.22})
      const endpoints=[pose.shoulder,pose.elbow,pose.tip]
      arm.links.forEach((link,j)=>{const a=endpoints[j]!,b=endpoints[j+1]!,off=(point:Point,z:number):Point=>[point[0],point[1],point[2]+z];this.segment(link.body,a,b,.58,.62);this.segment(link.inset,off(a,.35),off(b,.35),.40,.12);this.segment(link.rail,off(a,.44),off(b,.44),.045,.05)
        const travel=.58-.22*input.piston;const middle:Point=[a[0]+(b[0]-a[0])*travel,a[1]+(b[1]-a[1])*travel,a[2]+(b[2]-a[2])*travel-.48];this.segment(link.sleeve,off(a,-.48),middle,.16,.16);this.segment(link.piston,middle,off(b,-.48),.10,.10)
        link.cells.forEach((cell,k)=>{const t=(k+.5)/link.cells.length;cell.position.set(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+.49);cell.quaternion.copy(link.body.quaternion);cell.scale.set(.24,.115,.06);cell.visible=quality!=='low'||k%2===0;this.pulse(cell,j===0?primary:secondary,.15+3.5*brightness((k+j*8)/16-pose.pulse)+.7*(j===0?input.kick:input.snare)*intensity+.45*(p.n('high',0)+p.n('air',0))*intensity)})
      })
    })
    this.towerCells.forEach((cell,i)=>this.pulse(cell,primary,.12+2.4*brightness(i/10-routePhase)))
    this.tracks.forEach((cell,i)=>{cell.visible=quality!=='low'||i%2===0;this.pulse(cell,i<36?secondary:accent,.10+2.4*brightness(i/36-routePhase*.7)+(p.n('downbeat',0)*.7+p.n('phrase',0)*.25)*intensity)})
    this.spillLights.forEach((light,i)=>{const c=i===0?primary:secondary;light.color.setRGB(c[0]!,c[1]!,c[2]!,this.library.THREE.SRGBColorSpace);light.intensity=spill*intensity*(8+5*energy)})
    this.heroLight.color.setRGB(accent[0]!,accent[1]!,accent[2]!,this.library.THREE.SRGBColorSpace);this.heroLight.intensity=p.n('hero-emission',.2)*14;this.heroLight.visible=p.on('model-visible')
    this.defaultHero.root.visible=!this.imported&&p.on('model-visible');if(this.imported)this.imported.root.visible=p.on('model-visible');this.poseHero(this.imported??this.defaultHero,p,phase,input.safety,energy)
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.imported=null}
}
