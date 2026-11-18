import type * as THREE from 'three'
import type {Cinema2ThreeLibrary} from '../three/Cinema2ThreeLibrary'
import type {Cinema2RenderQualityLevel} from '../../contracts/Cinema2NativePresetManifest'
import {MOIRE_ORB_PATTERN_IDS,REACTOR_FIXTURE_COUNT,reactorPattern} from './MoireOrbPatterns'
import {MoireOrbReactorDetail} from './MoireOrbReactorDetail'
export interface ReactorControls {
 geometryMotion:boolean;fixtureMotion:boolean;intensity:number;coreScale:number;coreOpacity:number;coreGlow:number;layerSeparation:number;ringTravel:number;ringLighting:number;fixtureLighting:number;chamberLighting:number;coreDetailLighting:number;beamWidth:number;haze:number
 coreColor:readonly number[];ringColor:readonly number[];fixtureColor:readonly number[];chamberColor:readonly number[];detailColor:readonly number[]
}
type Material=THREE.MeshStandardMaterial|THREE.MeshBasicMaterial|THREE.ShaderMaterial
/** The original five-mesh lattice is the heart of a detailed, fully modelled reactor volume. */
export class MoireOrbReactorScene {
 private readonly geometries=new Set<THREE.BufferGeometry>()
 private readonly materials=new Set<Material>()
 private readonly environment:THREE.Group
 private readonly core:THREE.Group
 private readonly original:THREE.Group
 private readonly detail:MoireOrbReactorDetail
 private readonly layers:{mesh:THREE.Mesh;rotation:THREE.Quaternion;position:THREE.Vector3;scale:THREE.Vector3;material:THREE.MeshStandardMaterial;opacity:number}[]=[]
 private readonly rings:THREE.Group[]=[]
 private readonly segments:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]=[]
 private readonly fixtures:{head:THREE.Group;yoke:THREE.Group;beam:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;lens:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;light:THREE.SpotLight;target:THREE.Object3D;angle:number;initialized:boolean}[]=[]
 private readonly steel:THREE.MeshStandardMaterial
 private readonly wall:THREE.MeshStandardMaterial
 private readonly plate:THREE.MeshStandardMaterial
 private readonly copper:THREE.MeshStandardMaterial
 private activeLights=0
 private disposed=false
 constructor(private readonly library:Cinema2ThreeLibrary,private readonly root:THREE.Object3D){
  const T=library.THREE
  this.original=new T.Group();this.original.name='reactor-source-lattice';const children=[...root.children];root.add(this.original);children.forEach(child=>this.original.add(child));root.updateMatrixWorld(true)
  const box=new T.Box3().setFromObject(this.original),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),scale=6.4/Math.max(size.x,size.y,size.z)
  this.original.scale.setScalar(scale);this.original.position.copy(center).multiplyScalar(-scale)
  this.core=new T.Group();this.core.name='reactor-original-moire-core';root.add(this.core);this.core.add(this.original)
  this.original.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;const material=mesh.material as THREE.MeshStandardMaterial;material.depthWrite=false;this.layers.push({mesh,rotation:mesh.quaternion.clone(),position:mesh.position.clone(),scale:mesh.scale.clone(),material,opacity:material.opacity})}})
  this.environment=new T.Group();this.environment.name='reactor-complete-chamber';root.add(this.environment)
  this.steel=this.mat(new T.MeshStandardMaterial({color:'#34434e',metalness:.72,roughness:.4}))
  this.wall=this.mat(new T.MeshStandardMaterial({color:'#070c12',metalness:.3,roughness:.8,side:T.BackSide}))
  this.plate=this.mat(new T.MeshStandardMaterial({color:'#111923',metalness:.65,roughness:.5}))
  this.copper=this.mat(new T.MeshStandardMaterial({color:'#5a3822',metalness:.8,roughness:.4}))
  const black=this.mat(new T.MeshStandardMaterial({color:'#10151b',metalness:.6,roughness:.44}))
  const add=(geometry:THREE.BufferGeometry,material:Material,parent:THREE.Object3D=this.environment)=>{const mesh=new T.Mesh(this.geo(geometry),material);parent.add(mesh);return mesh}
  add(new T.SphereGeometry(17,64,32),this.wall)
  const rib=this.geo(new T.TorusGeometry(16.7,.23,6,96))
  for(let i=0;i<6;i++){const mesh=new T.Mesh(rib,this.plate);mesh.rotation.y=i*Math.PI/6;this.environment.add(mesh)}
  for(const y of [-11,0,11]){const mesh=add(new T.TorusGeometry(Math.sqrt(16.4**2-y*y),.22,6,80),black);mesh.rotation.x=Math.PI/2;mesh.position.y=y}
  this.detail=new MoireOrbReactorDetail(library,this.environment,this.core,{steel:this.steel,plate:this.plate,black,copper:this.copper})
  for(let i=0;i<4;i++)for(let strand=0;strand<3;strand++){
   const a=i*Math.PI/2+.08*(strand-1),x=Math.sin(a),z=Math.cos(a)
   add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(x*4.4,3.4,z*4.4),new T.Vector3(x*7.8,7,z*7.8),new T.Vector3(x*10.2,10.5,z*10.2)]),24,.055,5,false),strand===1?this.copper:black)
  }
  const arc=this.geo(new T.TorusGeometry(1,.014,5,10,Math.PI*2/16*.74))
  for(let r=0;r<3;r++){
   const group=new T.Group();group.name=`reactor-gimbal-${r}`;this.environment.add(group);this.rings.push(group)
   const radius=3.8+r*.58,frame=add(new T.TorusGeometry(radius,.095,6,96),black,group);frame.name=`reactor-ring-frame-${r}`
   for(let i=0;i<16;i++){const material=this.mat(new T.MeshBasicMaterial({color:'#22d9ff'})),mesh=new T.Mesh(arc,material);mesh.name=`reactor-segment-${r*16+i}`;mesh.rotation.z=i*Math.PI*2/16;mesh.scale.setScalar(radius+.15);group.add(mesh);this.segments.push(mesh)}
  }
  const beam=this.geo(new T.CylinderGeometry(0,1,1,18,1,true).rotateX(-Math.PI/2).translate(0,0,.5))
  for(let i=0;i<REACTOR_FIXTURE_COUNT;i++){
   const bank=i<6?1:-1,a=(i%6)*Math.PI/3+(bank<0?Math.PI/6:0),head=new T.Group(),yoke=new T.Group(),mount=new T.Group()
   head.name=`reactor-moving-fixture-${i}`;head.position.set(Math.sin(a)*10.2,bank*4.6,Math.cos(a)*10.2);yoke.position.copy(head.position);mount.position.copy(head.position);mount.rotation.y=a+Math.PI;this.environment.add(head,yoke,mount)
   const lensMaterial=this.mat(new T.MeshBasicMaterial({color:'#ffb64c'})),eye=this.detail.fixture(head,yoke,mount,lensMaterial)
   const volumeMaterial=this.mat(new T.ShaderMaterial({uniforms:{uColor:{value:new T.Color('#ffb64c')},uOpacity:{value:.01}},vertexShader:'varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalMatrix*normal;vView=-p.xyz;vUv=uv;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 uColor;uniform float uOpacity;varying vec3 vNormal;varying vec3 vView;varying vec2 vUv;void main(){float facing=pow(abs(dot(normalize(vNormal),normalize(vView))),1.4);float fade=pow(clamp(vUv.y,0.0,1.0),0.55)*smoothstep(0.0,0.08,vUv.y);gl_FragColor=vec4(uColor,uOpacity*facing*fade);}',transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending})),volume=new T.Mesh(beam,volumeMaterial);volume.position.z=1.02;head.add(volume)
   const target=new T.Object3D(),light=new T.SpotLight('#ffb64c',8,30,.15,.8,1.5);light.position.copy(head.position);light.target=target;this.environment.add(light,target)
   const attachment=head.position.clone().normalize().multiplyScalar(14.4),length=attachment.distanceTo(head.position),brace=add(new T.CylinderGeometry(.15,.15,length,8),black)
   brace.position.copy(attachment).add(head.position).multiplyScalar(.5);brace.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),head.position.clone().sub(attachment).normalize())
   this.fixtures.push({head,yoke,beam:volume,lens:eye,light,target,angle:a,initialized:false})
  }
 }
 private geo<G extends THREE.BufferGeometry>(geometry:G):G{this.geometries.add(geometry);return geometry}
 private mat<M extends Material>(material:M):M{this.materials.add(material);return material}
 draw(c:ReactorControls,phase:number,fixturePhase:number,weights:readonly number[],quality:Cinema2RenderQualityLevel){
  if(this.disposed)return
  const T=this.library.THREE,color=(values:readonly number[])=>new T.Color().setRGB(values[0],values[1],values[2],T.SRGBColorSpace),coreColor=color(c.coreColor),ringColor=color(c.ringColor),fixtureColor=color(c.fixtureColor)
  this.core.visible=this.environment.visible=c.intensity>0
  this.core.scale.setScalar(c.coreScale);this.core.rotation.set(Math.sin(phase*.13)*.07,phase*.065,Math.sin(phase*.11)*.04)
  this.layers.forEach((layer,i)=>{
   const rotation=new T.Quaternion().setFromEuler(new T.Euler(phase*.025*(i%2?1:-1)*c.layerSeparation,phase*.035*(i-2)*c.layerSeparation,Math.sin(phase*.3+i)*.08*c.layerSeparation))
   layer.mesh.quaternion.copy(layer.rotation).multiply(rotation);layer.mesh.position.copy(layer.position);layer.mesh.scale.copy(layer.scale).multiplyScalar(1+(i-2)*.06*c.layerSeparation)
   layer.material.color.copy(coreColor).multiplyScalar(c.intensity);layer.material.emissive.copy(coreColor).multiplyScalar(c.coreGlow*c.intensity*.45);layer.material.emissiveIntensity=1;layer.material.opacity=layer.opacity*c.coreOpacity
  })
  this.steel.color.copy(color(c.detailColor)).multiplyScalar(c.intensity);this.wall.color.copy(color(c.chamberColor)).multiplyScalar(c.intensity);this.plate.color.copy(color(c.detailColor)).multiplyScalar(c.intensity*.36);this.copper.color.copy(fixtureColor).multiplyScalar(c.intensity*.22)
  const mix=(index:number,p:number)=>{
   const result={light:0,scale:0}
   MOIRE_ORB_PATTERN_IDS.forEach((id,i)=>{const value=reactorPattern(id,p,index),weight=weights[i]??0;for(const key of Object.keys(result) as (keyof typeof result)[])result[key]+=value[key]*weight})
   return result
  }
  this.rings.forEach((ring,r)=>{
   const v=mix(r*16,phase),blended=new T.Quaternion(0,0,0,0),reference=new T.Quaternion()
   let initialized=false
   // Blend physical orientations, not unbounded accumulated Euler turns: long tracks must not cause extra spins.
   MOIRE_ORB_PATTERN_IDS.forEach((id,i)=>{const weight=weights[i]??0;if(weight<=0)return;const p=reactorPattern(id,phase,r*16),q=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2+(r-1)*.55+p.tilt*c.ringTravel,r*.7+p.turn*c.ringTravel,Math.sin(phase*.2+r)*.12*c.ringTravel));if(!initialized){reference.copy(q);initialized=true}const sign=reference.dot(q)<0?-1:1;blended.set(blended.x+q.x*weight*sign,blended.y+q.y*weight*sign,blended.z+q.z*weight*sign,blended.w+q.w*weight*sign)})
   ring.quaternion.copy(blended.normalize());ring.scale.setScalar(1+(v.scale-1)*c.ringTravel)
  })
  this.segments.forEach((mesh,index)=>{const v=mix(index,phase);mesh.material.color.copy(ringColor).multiplyScalar(c.intensity*c.ringLighting*(.015+v.light*1.8));mesh.visible=c.ringLighting>0})
  const budget=quality==='high'?12:quality==='medium'?6:4
  this.activeLights=c.fixtureLighting*c.intensity>0?budget:0
  this.detail.draw(phase,weights,coreColor,ringColor,c.coreDetailLighting*c.intensity,c.chamberLighting*c.intensity,c.coreGlow*c.intensity)
  this.fixtures.forEach((fixture,i)=>{
   const target=new T.Vector3()
   // Interpolate actual world targets so accumulated angular phases never whip a head around on a pattern change.
   MOIRE_ORB_PATTERN_IDS.forEach((id,j)=>{const p=reactorPattern(id,fixturePhase,i),a=fixture.angle+p.aimTurn;target.addScaledVector(new T.Vector3(Math.sin(a)*p.aimRadius,p.aimY,Math.cos(a)*p.aimRadius),weights[j]??0)})
   if((c.geometryMotion&&c.fixtureMotion)||!fixture.initialized){fixture.head.lookAt(target);fixture.yoke.rotation.y=Math.atan2(target.x-fixture.head.position.x,target.z-fixture.head.position.z);fixture.target.position.copy(target);fixture.initialized=true}
   const beamLength=Math.max(1.1,fixture.head.position.distanceTo(fixture.target.position))
   const power=c.intensity*c.fixtureLighting*(.5+.5*mix(i*4,phase).light)
   fixture.light.visible=i%(12/budget)===0&&power>0;fixture.light.color.copy(fixtureColor);fixture.light.intensity=power*12;fixture.light.angle=.065+c.beamWidth*.07
   fixture.lens.material.color.copy(fixtureColor).multiplyScalar(power*1.5)
   fixture.beam.visible=c.haze>0&&power>0;(fixture.beam.material.uniforms.uColor.value as THREE.Color).copy(fixtureColor).multiplyScalar(Math.min(1.5,power));fixture.beam.material.uniforms.uOpacity.value=c.haze*.14
   const width=Math.tan(fixture.light.angle)*beamLength;fixture.beam.scale.set(width,width,beamLength-1.02)
  })
 }
 inspect(){return {...this.detail.inspect(),coreDiameter:6.4,totalLightingCells:240,sourceMeshes:this.layers.length,ringSegments:this.segments.length,movingFixtures:this.fixtures.length,activeDirectLights:this.activeLights,chamberRadius:17,ownedGeometryCount:this.geometries.size,ownedMaterialCount:this.materials.size,source:'cinema2-crate-moire-orb'}}
 dispose(){if(this.disposed)return;this.disposed=true;this.detail.dispose();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.fixtures.forEach(f=>f.light.dispose());this.geometries.clear();this.materials.clear();this.environment.removeFromParent();this.core.removeFromParent()}
}
