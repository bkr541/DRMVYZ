import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { ArcAngelPerformance } from './ArcAngelPerformance'
import { blendArcAngelStage } from './ArcAngelPatterns'
import { clamp01 } from './ArcAngelDomain'

const TAU=Math.PI*2, BAYS=12, LEVELS=4, FLOOR=-4.1
/** A closed architectural volume, with bounded pools of physical lights and visible fixture beams. */
export class ArcAngelArchitecture {
  readonly group:Three.Group
  private geometries=new Set<Three.BufferGeometry>()
  private materials=new Set<Three.Material>()
  private readonly shell:Three.MeshStandardMaterial
  private readonly metal:Three.MeshStandardMaterial
  private readonly panels:Three.Mesh<Three.BufferGeometry,Three.MeshStandardMaterial>[][]=[]
  private readonly floors:Three.Mesh<Three.BufferGeometry,Three.MeshStandardMaterial>[][]=[]
  private readonly crown:Three.Group
  private readonly crownLights:Three.Mesh<Three.BufferGeometry,Three.MeshStandardMaterial>[]=[]
  private readonly shutters:Three.Mesh[]=[]
  private readonly fragments:Three.Mesh<Three.BufferGeometry,Three.MeshStandardMaterial>[]=[]
  private readonly fixtures:{head:Three.Group;beam:Three.Mesh<Three.BufferGeometry,Three.ShaderMaterial>;lens:Three.Mesh<Three.BufferGeometry,Three.MeshStandardMaterial>;light:Three.SpotLight;target:Three.Object3D}[]=[]
  private readonly washes:Three.PointLight[]=[]
  private readonly dummy:Three.Object3D
  private readonly destination:Three.Vector3
  constructor(private readonly lib:Cinema2ThreeLibrary,root:Three.Object3D){
    const T=lib.THREE;this.group=new T.Group();this.group.name='arc-angel-celestial-sanctum';root.add(this.group)
    this.dummy=new T.Object3D();this.destination=new T.Vector3()
    this.shell=this.mat(new T.MeshStandardMaterial({color:0x231b18,metalness:.58,roughness:.64}))
    this.metal=this.mat(new T.MeshStandardMaterial({color:0x785737,metalness:.76,roughness:.35}))
    const dark=this.mat(new T.MeshStandardMaterial({color:0x141216,metalness:.45,roughness:.48}))
    const box=this.geo(new T.BoxGeometry(1,1,1)), cylinder=this.geo(new T.CylinderGeometry(1,1,1,64)), beamGeo=this.geo(new T.ConeGeometry(1,1,24,1,true))
    const lightMaterial=()=>this.mat(new T.MeshStandardMaterial({color:0x7e4724,emissive:0xffab57,emissiveIntensity:.1,metalness:.25,roughness:.32}))
    const add=<G extends Three.BufferGeometry,M extends Three.Material>(parent:Three.Object3D,geo:G,mat:M,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
    // Solid floor, stepped dais, and radial tracks. All geometry remains inside the camera-safe perimeter.
    add(this.group,cylinder,dark,0,FLOOR-.45,0,22,.8,22)
    add(this.group,cylinder,this.shell,0,FLOOR-.05,0,7.8,.45,7.8)
    add(this.group,cylinder,this.metal,0,FLOOR+.2,0,6.8,.15,6.8)
    add(this.group,cylinder,dark,0,FLOOR+.3,0,6.5,.1,6.5)
    for(let l=0;l<LEVELS;l++){
      const r=2.1+l*1.45,geo=this.geo(new T.TorusGeometry(r,.047,6,18,TAU/BAYS*.86)),row:typeof this.floors[number]=[]
      for(let i=0;i<BAYS;i++){const m=new T.Mesh(geo,lightMaterial());m.rotation.set(-Math.PI/2,0,i*TAU/BAYS);m.position.y=FLOOR+.38;this.group.add(m);row.push(m)}this.floors.push(row)
    }
    // Twelve repeating cathedral bays. The solid back wall, recessed panels and high ribs are real depth geometry.
    for(let i=0;i<BAYS;i++){
      const a=i*TAU/BAYS,bay=new T.Group();bay.position.set(Math.sin(a)*19,0,Math.cos(a)*19);bay.rotation.y=a;this.group.add(bay)
      add(bay,box,this.shell,0,3,1.15,10.2,15,1.3)
      add(bay,box,dark,0,3,.42,7.5,12.5,.25)
      for(const side of [-1,1]){
        add(bay,box,this.metal,side*4.2,2.5,-.1,.85,14,1.5)
        add(bay,box,this.shell,side*3.65,2.5,-.82,.55,13,1.1)
        for(const y of [-3.4,1,5.2,9.1])add(bay,box,this.metal,side*3.9,y,-.45,1.55,.35,1.5)
        const arch=add(bay,box,this.metal,side*2.05,10,-1.4,.55,5.6,.8);arch.rotation.z=side*.73
      }
      const pillar:typeof this.panels[number]=[]
      for(let l=0;l<LEVELS;l++){
        const y=-2.45+l*3.15
        add(bay,box,this.shell,0,y,-.62,2.8,2.9,.85)
        const panel=add(bay,box,lightMaterial(),0,y,-1.09,.16,2.48,.09);pillar.push(panel)
        add(bay,box,this.metal,-.9,y,-1.06,.12,2.6,.13);add(bay,box,this.metal,.9,y,-1.06,.12,2.6,.13)
      }this.panels.push(pillar)
      // Housing points inward; the moving head and actual spotlight share the same destination.
      const head=new T.Group();head.position.set(Math.sin(a)*17.7,5.5+(i%2)*1.8,Math.cos(a)*17.7);this.group.add(head)
      add(head,box,this.metal,0,0,0,1.05,.85,1.1)
      const lens=add(head,cylinder,lightMaterial(),0,-.52,0,.32,.1,.32)
      const bm=this.mat(new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(0xffb568)},gain:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv; uniform vec3 tint; uniform float gain; void main(){float fade=sin(3.14159265*clamp(vUv.y,0.0,1.0));gl_FragColor=vec4(tint,gain*fade*fade);}',transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}))
      const beam=new T.Mesh(beamGeo,bm);this.group.add(beam)
      const light=new T.SpotLight(0xffb568,0,36,.19,.7,2),target=new T.Object3D();light.target=target;this.group.add(light,target);this.fixtures.push({head,beam,lens,light,target})
      if(i%2===0){const wash=new T.PointLight(0xffa85c,0,8,2);wash.position.set(Math.sin(a)*15.8,1.3,Math.cos(a)*15.8);this.group.add(wash);this.washes.push(wash)}
    }
    // Overhead crown, concentric rails, and independently opening radial shutters.
    this.crown=new T.Group();this.crown.position.y=9.6;this.group.add(this.crown)
    for(const r of [3.6,5.1,7.5,12.8,19]){const rim=new T.Mesh(this.geo(new T.TorusGeometry(r,.24,8,96)),this.metal);rim.rotation.x=-Math.PI/2;this.crown.add(rim)}
    add(this.group,cylinder,this.shell,0,11.15,0,22,.65,22)
    for(let i=0;i<BAYS;i++){
      const a=i*TAU/BAYS,shutter=add(this.crown,box,this.shell,Math.sin(a)*3.1,0,Math.cos(a)*3.1,.85,.3,3.2);shutter.rotation.y=a;this.shutters.push(shutter)
      const g=this.geo(new T.TorusGeometry(5.15,.075,6,16,TAU/BAYS*.75)),m=new T.Mesh(g,lightMaterial());m.rotation.set(-Math.PI/2,0,a);m.position.y=-.3;this.crown.add(m);this.crownLights.push(m)
    }
    // Batch only static architecture, excluding every animated or emissive mesh.
    this.group.updateMatrixWorld(true)
    const batches=new Map<Three.Material,Three.Mesh[]>()
    this.group.traverse(o=>{const m=o as Three.Mesh;if(!m.isMesh||m.geometry!==box||Array.isArray(m.material)||![this.shell,this.metal,dark].includes(m.material as Three.MeshStandardMaterial))return;let parent=m.parent;while(parent&&parent!==this.group){if(parent===this.crown||this.fixtures.some(f=>f.head===parent))return;parent=parent.parent}const batch=batches.get(m.material)??[];batch.push(m);batches.set(m.material,batch)})
    const inverse=this.group.matrixWorld.clone().invert(),matrix=new T.Matrix4()
    for(const [material,meshes] of batches){const instanced=new T.InstancedMesh(box,material,meshes.length);meshes.forEach((m,i)=>{matrix.multiplyMatrices(inverse,m.matrixWorld);instanced.setMatrixAt(i,matrix);m.removeFromParent()});instanced.instanceMatrix.needsUpdate=true;this.group.add(instanced)}
    const shard=this.geo(new T.OctahedronGeometry(1,0));for(let i=0;i<24;i++){const m=new T.Mesh(shard,lightMaterial());m.scale.set(.17,.65,.24);this.group.add(m);this.fragments.push(m)}
  }
  private geo<G extends Three.BufferGeometry>(g:G):G{this.geometries.add(g);return g}
  private mat<M extends Three.Material>(m:M):M{this.materials.add(m);return m}
  apply(p:ArcAngelPerformance,quality:string,hit:number,gain:number,move:number){
    const T=this.lib.THREE,n=(key:string,fallback:number)=>p.n(key,fallback),phase=p.phase,weights=p.weights,build=p.response.build??0,drop=p.response.drop??0
    const density=n('environment-density',.88), lighting=n('pillar-lighting',.85), floor=n('platform-lighting',.8), fixtures=n('fixture-lighting',.8), crown=n('crown-reactor',.8), fragments=n('fragment-formation',.7)
    const tint=(c:Three.Color,key:'primary'|'secondary'|'accent'|'structural')=>{const v=p.color(key);c.setRGB(v[0]!,v[1]!,v[2]!,T.SRGBColorSpace)}
    this.group.visible=density>0;tint(this.shell.color,'structural');this.shell.color.multiplyScalar(.38);tint(this.metal.color,'structural')
    const overall=blendArcAngelStage(weights,phase), levelGain=gain*(.55+.45*density)*Number(density>0)
    for(let i=0;i<BAYS;i++)for(let l=0;l<LEVELS;l++){
      const cue=blendArcAngelStage(weights,phase,i,l),m=this.panels[i]![l]!.material,f=this.floors[l]![i]!.material
      tint(m.emissive,i%4===0?'secondary':'primary');tint(f.emissive,i%3===0?'accent':'primary')
      m.emissiveIntensity=levelGain*lighting*(.05+3.5*clamp01(cue.pillar+build*.32+hit*.28));f.emissiveIntensity=levelGain*floor*(.06+3.4*clamp01(cue.floor+drop*.28+hit*.3))
    }
    this.crown.rotation.y=phase*.025*move*n('platform-movement',.6)
    for(let i=0;i<BAYS;i++){
      const a=i*TAU/BAYS,cue=blendArcAngelStage(weights,phase,i),open=clamp01(cue.crown+build*.3)*move*crown
      this.shutters[i]!.position.set(Math.sin(a)*(3.1+open*2),0,Math.cos(a)*(3.1+open*2));const mat=this.crownLights[i]!.material;tint(mat.emissive,'accent');mat.emissiveIntensity=levelGain*crown*(.1+3.7*cue.crown+hit)
      const f=this.fixtures[i]!, sweep=n('fixture-movement',.7)*move, theta=a+Math.sin(phase*.18+i)*.8*sweep
      const targetRadius=i%3===0?11.5:2+cue.fixture*3*sweep
      this.destination.set(Math.sin(theta+(i%3===0?Math.PI:0))*targetRadius,i%3===0?FLOOR+.4:-2+cue.fixture*4,Math.cos(theta+(i%3===0?Math.PI:0))*targetRadius)
      f.target.position.copy(this.destination);f.light.position.copy(f.head.position);f.head.lookAt(this.destination);f.head.rotateX(-Math.PI/2)
      this.dummy.position.subVectors(f.head.position,this.destination);const length=this.dummy.position.length();f.beam.position.copy(this.destination).addScaledVector(this.dummy.position,.5);f.beam.quaternion.setFromUnitVectors(this.dummy.up,this.dummy.position.normalize());const width=.06+n('beam-width',.55)*.16;f.beam.scale.set(length*width,length,length*width)
      const power=levelGain*fixtures*clamp01(cue.fixture*.8+build*.18+hit*.3),stride=quality==='low'?6:quality==='medium'?3:2
      f.light.visible=i%stride===0;f.light.intensity=power*190;f.light.angle=Math.atan(width);tint(f.light.color,i%4===0?'secondary':'accent');tint(f.lens.material.emissive,'accent');f.lens.material.emissiveIntensity=power*3
      if(i%2===0){const wash=this.washes[i/2]!;wash.visible=quality!=='low'||i%4===0;wash.intensity=levelGain*lighting*(1+cue.pillar*18+hit*9);tint(wash.color,i%4===0?'secondary':'primary')}
      f.beam.visible=quality!=='low'&&power>.02;f.beam.material.uniforms.gain!.value=power*.075;tint(f.beam.material.uniforms.tint!.value as Three.Color,i%4===0?'secondary':'accent')
    }
    for(let i=0;i<this.fragments.length;i++){
      const m=this.fragments[i]!,a=i*TAU/24+phase*.045*move*(i%2?1:-1),r=7.1+move*(overall.fragment*1.5+drop*.9);m.visible=fragments>0&&i<Math.ceil(density*(quality==='low'?8:quality==='medium'?16:24));m.position.set(Math.sin(a)*r,-1.8+(i%4)*1.6+Math.sin(phase*.17+i)*move*overall.fragment,Math.cos(a)*r);m.rotation.set(.2+phase*.04*move,a,.25*Math.sin(a));tint(m.material.emissive,'primary');m.material.emissiveIntensity=levelGain*fragments*(.15+overall.fragment*1.6+hit)
    }
  }
  dispose(){this.group.removeFromParent();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.group.clear()}
}
